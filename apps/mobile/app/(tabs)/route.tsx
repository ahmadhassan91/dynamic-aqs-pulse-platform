import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { CheckInTrainingSessionRequest, CompleteTrainingSessionRequest, CreateTrainingSessionRequest } from '@pulse/contracts/training';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { formatDate, formatDateTime, initials } from '@/lib/format';
import { ACCOUNT_MAP_STATUS_META, buildConsignmentSignalMap, deriveAccountMapStatus, formatGroupClassification } from '@/lib/account-map-status';
import { NavigateSheet } from '@/components/navigate-sheet';
import { RouteStopPicker } from '@/components/route-stop-picker';
import { SavedRoutesSheet } from '@/components/saved-routes-sheet';
import type { NavTarget } from '@/lib/external-nav';
import type { SavedRoute } from '@/lib/saved-routes';
import { deleteRoute, duplicateRoute, saveRoute, useSavedRoutes } from '@/lib/saved-routes-store';
import { addRouteStop, moveRouteStop, removeRouteStop, setRouteSelection, useRouteSelection } from '@/lib/route-selection-store';
import { DEFAULT_DWELL_MINUTES, MAX_DWELL_MINUTES, MIN_DWELL_MINUTES, computeRouteSchedule, formatMinutesOfDay, optimizeRouteOrder, roundMiles, routeLegMiles, routeTotalMiles, suggestedAccountIdsFromRoutePlans } from '@/lib/route-planning';
import { clearRouteVisitDraft, describeDraftSaveFailure, getLatestCheckedInRouteVisitDraft, upsertRouteVisitDraftDurably } from '@/lib/mobile-draft-queue';
import { checkInTrainingSessionRecord, completeTrainingSessionRecord, createTrainingSessionRecord, fetchTerritoryMapWorkspace } from '@/lib/api';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

type RouteVisitAccount = Pick<AccountSummary, 'id' | 'displayName'> & Partial<AccountSummary>;

type ActiveVisit = {
  localVisitId: string;
  account: RouteVisitAccount;
  checkedInAt: string;
  sessionId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  crmStatus: 'pending' | 'checked_in' | 'local_only';
  crmMessage?: string;
  createRequest: CreateTrainingSessionRequest;
  checkInRequest: CheckInTrainingSessionRequest;
};

type CompletedVisit = ActiveVisit & {
  checkedOutAt: string;
  notes: string;
};

export default function RouteScreen() {
  const { palette: colors } = useTheme();
  const { apiBaseUrl, auth } = useSession();
  // Load the same query as the map (200) so a stop added from the map normally resolves here and isn't
  // dropped by the prune effect — both tabs fetch independently and rely on the deterministic server
  // ordering, so the sets match in practice (RTE-P7 shares the selection across both tabs).
  const { accounts, consignmentSites, errorMessage, isLoading, reload } = useFieldData(200);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [completedVisits, setCompletedVisits] = useState<CompletedVisit[]>([]);
  const [notes, setNotes] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [visitSyncMessage, setVisitSyncMessage] = useState<string | null>(null);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
  const isVisitSyncSuccess = visitSyncMessage === 'CRM saved';

  const selectedIds = useRouteSelection();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [isLoadingSuggested, setIsLoadingSuggested] = useState(false);
  const [startMinutes, setStartMinutes] = useState(() => roundToFiveMinutes(currentMinutesOfDay()));
  const [dwellByStopId, setDwellByStopId] = useState<Record<string, number>>({});
  const savedRoutes = useSavedRoutes();
  const [isRoutesSheetOpen, setIsRoutesSheetOpen] = useState(false);

  const accountsById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);

  // Seed the route once (oldest last-touch first) so the screen isn't empty; fully editable after.
  useEffect(() => {
    if (selectedIds !== null || accounts.length === 0) return;
    const seeded = [...accounts].sort((left, right) => routeSeedRank(left) - routeSeedRank(right)).slice(0, 8).map((account) => account.id);
    setRouteSelection(seeded);
  }, [accounts, selectedIds]);

  // Keep the selection aligned with the loaded accounts so route positions match selectedIds positions
  // (a refresh can drop a previously-selected account from the loaded set). Without this, index-based
  // reorder would act on the wrong entry, and a dropped id would linger as a ghost selection.
  useEffect(() => {
    // Guard on accounts.length so a freshly-mounted Route tab (selection persisted in the shared store,
    // own accounts still loading) can't prune the selection to [] before its accounts arrive — which
    // would also permanently block re-seed. Mirrors the seed effect's guard.
    if (selectedIds === null || accounts.length === 0) return;
    const loaded = new Set(accounts.map((account) => account.id));
    const pruned = selectedIds.filter((id) => loaded.has(id));
    if (pruned.length !== selectedIds.length) setRouteSelection(pruned);
  }, [accounts, selectedIds]);

  // Keep dwell entries in sync with the selection — covers stops removed from the Map tab, which mutate
  // the shared store directly and never run removeStop here.
  useEffect(() => {
    if (selectedIds === null) return;
    const ids = new Set(selectedIds);
    setDwellByStopId((current) => {
      const keys = Object.keys(current);
      if (keys.every((key) => ids.has(key))) return current;
      const next: Record<string, number> = {};
      for (const key of keys) if (ids.has(key)) next[key] = current[key]!;
      return next;
    });
  }, [selectedIds]);

  const routeAccounts = useMemo(
    () => (selectedIds ?? []).map((id) => accountsById.get(id)).filter((account): account is AccountSummary => Boolean(account)),
    [selectedIds, accountsById],
  );

  const availableAccounts = useMemo(() => {
    const selected = new Set(selectedIds ?? []);
    return accounts.filter((account) => !selected.has(account.id));
  }, [accounts, selectedIds]);

  const routePoints = useMemo(
    () => routeAccounts.map((account) => (hasCoords(account) ? { latitude: account.latitude, longitude: account.longitude } : null)),
    [routeAccounts],
  );
  const legMiles = useMemo(() => routeLegMiles(routePoints), [routePoints]);
  const totalMiles = useMemo(() => routeTotalMiles(routePoints), [routePoints]);
  const locatedStopCount = useMemo(() => routeAccounts.filter(hasCoords).length, [routeAccounts]);

  // RTE-P5: per-stop dwell + cumulative arrival / end-of-day ETA (straight-line + circuity estimate).
  const schedule = useMemo(
    () => computeRouteSchedule(legMiles, routeAccounts.map((account) => dwellByStopId[account.id] ?? DEFAULT_DWELL_MINUTES)),
    [legMiles, routeAccounts, dwellByStopId],
  );
  const finishMinutes = startMinutes + (schedule.stops[schedule.stops.length - 1]?.arrivalOffsetMinutes ?? 0);

  // Arrival times stay trustworthy only until the first unmeasurable (coordless) leg; past that the
  // estimate silently assumes zero travel, so downstream arrivals are suppressed rather than shown as fact.
  const arrivalReliable = useMemo(() => {
    let reliable = true;
    return legMiles.map((leg, index) => {
      if (index > 0 && leg === null) reliable = false;
      return reliable;
    });
  }, [legMiles]);

  function cycleDwell(id: string) {
    setPlanMessage(null);
    setDwellByStopId((current) => {
      const next = (current[id] ?? DEFAULT_DWELL_MINUTES) + MIN_DWELL_MINUTES;
      return { ...current, [id]: next > MAX_DWELL_MINUTES ? MIN_DWELL_MINUTES : next };
    });
  }

  async function handleSaveCurrentRoute(name: string) {
    // Re-saving the same name replaces that route rather than minting a silent duplicate.
    const existing = savedRoutes.find((route) => route.name.trim().toLowerCase() === name.trim().toLowerCase());
    const { persisted } = await saveRoute({ ...(existing ? { id: existing.id } : {}), name, stopIds: selectedIds ?? [], dwellByStopId, startMinutes });
    setPlanMessage(
      persisted
        ? `${existing ? 'Updated' : 'Saved'} route "${name}".`
        : `Couldn't persist "${name}" (device storage issue) — kept for this session only.`,
    );
  }
  function handleLoadRoute(route: SavedRoute) {
    const loaded = new Set(accounts.map((account) => account.id));
    const usable = route.stopIds.filter((id) => loaded.has(id));
    setIsRoutesSheetOpen(false);
    if (usable.length === 0) {
      setPlanMessage(`None of "${route.name}"'s ${route.stopIds.length} stop${route.stopIds.length === 1 ? '' : 's'} are in your loaded accounts — current route kept.`);
      return;
    }
    setRouteSelection(usable);
    setDwellByStopId(Object.fromEntries(usable.map((id) => [id, route.dwellByStopId[id] ?? DEFAULT_DWELL_MINUTES])));
    setStartMinutes(roundToFiveMinutes(route.startMinutes));
    const dropped = route.stopIds.length - usable.length;
    setPlanMessage(`Loaded "${route.name}" — ${usable.length} stop${usable.length === 1 ? '' : 's'}${dropped > 0 ? ` (${dropped} not in your loaded accounts)` : ''}.`);
  }
  function confirmDeleteRoute(route: SavedRoute) {
    Alert.alert('Delete route', `Delete "${route.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteRoute(route.id) },
    ]);
  }

  function addStop(id: string) {
    setPlanMessage(null); // the order provenance no longer describes the current arrangement
    addRouteStop(id);
  }
  function removeStop(id: string) {
    setPlanMessage(null);
    removeRouteStop(id); // the dwell-sync effect drops its dwell entry
  }
  function moveStop(index: number, direction: -1 | 1) {
    setPlanMessage(null);
    moveRouteStop(index, direction);
  }
  function optimizeOrder() {
    const located = routeAccounts.filter(hasCoords);
    if (located.length < 2) {
      setPlanMessage('Add at least 2 located stops to optimize the order.');
      return;
    }
    const without = routeAccounts.filter((account) => !hasCoords(account)).map((account) => account.id);
    const ordered = optimizeRouteOrder(located.map((account) => ({ id: account.id, latitude: account.latitude, longitude: account.longitude })));
    setRouteSelection([...ordered.map((stop) => stop.id), ...without]);
    setPlanMessage(`Optimized ${located.length} stop${located.length === 1 ? '' : 's'} by nearest-neighbour (straight-line).`);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  async function loadSuggestedRoute() {
    if (!auth) {
      setPlanMessage('Sign in to load the server route plan.');
      return;
    }
    setIsLoadingSuggested(true);
    setPlanMessage(null);
    try {
      const workspace = await fetchTerritoryMapWorkspace(apiBaseUrl, auth.tokens.accessToken);
      const suggested = suggestedAccountIdsFromRoutePlans(workspace.routePlans);
      const rank = new Map(suggested.map((id, index) => [id, index] as const));
      const ordered = accounts
        .filter((account) => rank.has(account.id))
        .sort((left, right) => rank.get(left.id)! - rank.get(right.id)!)
        .map((account) => account.id);
      if (ordered.length === 0) {
        setPlanMessage('No server route plan covers your loaded accounts yet — build the route manually.');
        return;
      }
      setRouteSelection(ordered);
      const dropped = suggested.length - ordered.length;
      setPlanMessage(
        `Loaded ${ordered.length} stop${ordered.length === 1 ? '' : 's'} in the server's suggested order${dropped > 0 ? ` (${dropped} more aren't in your loaded accounts)` : ''}.`,
      );
    } catch {
      setPlanMessage('Could not load the server route plan. Build or optimize the route manually.');
    } finally {
      setIsLoadingSuggested(false);
    }
  }

  // Preserve the map's colour-coding into the route list so a stop's status (sold / consignment /
  // consignment-overdue / ...) stays visible while building the route — Don's MMC pain point.
  const consignmentSignals = useMemo(() => buildConsignmentSignalMap(consignmentSites, new Date()), [consignmentSites]);

  useEffect(() => {
    if (activeVisit) return;
    const draft = getLatestCheckedInRouteVisitDraft();
    if (!draft) return;
    if (!draft.payload.createRequest || !draft.payload.checkInRequest) return;
    const account = accounts.find((item) => item.id === draft.payload.accountId) ?? {
      id: draft.payload.accountId,
      displayName: draft.payload.accountName,
    };
    setActiveVisit({
      account,
      checkedInAt: draft.payload.checkedInAt,
      checkInRequest: draft.payload.checkInRequest,
      createRequest: draft.payload.createRequest,
      crmMessage: 'Checked-in visit restored from this phone. Add checkout notes and complete it here.',
      crmStatus: draft.payload.sessionId ? 'checked_in' : 'local_only',
      latitude: draft.payload.latitude,
      localVisitId: draft.payload.localVisitId ?? draft.id,
      longitude: draft.payload.longitude,
      sessionId: draft.payload.sessionId,
    });
    setNotes(draft.payload.notes ?? '');
  }, [accounts, activeVisit]);

  async function startVisit(account: AccountSummary) {
    setLocationError(null);
    setVisitSyncMessage(null);
    if (!auth?.identity.userId) {
      setVisitSyncMessage('Sign in before starting a route visit so CRM can assign the trainer correctly.');
      return;
    }
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const checkedInAt = new Date().toISOString();
    const localVisitId = `route-${account.id}-${Date.now()}`;
    const createRequest = buildRouteVisitCreateRequest(account, auth.identity.userId, checkedInAt);
    const checkInRequest = buildRouteVisitCheckInRequest(checkedInAt);
    const visit: ActiveVisit = {
      account,
      checkedInAt,
      crmStatus: 'pending',
      createRequest,
      checkInRequest,
      localVisitId,
    };
    setActiveVisit(visit);
    try {
      await saveCheckedInRouteVisitDraft(visit);
    } catch (draftError) {
      setVisitSyncMessage(draftError instanceof Error ? `Visit started, but offline draft failed: ${draftError.message}` : 'Visit started, but offline draft failed.');
    }

    let createdSessionId: string | undefined;
    try {
      const created = await createTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, account.id, createRequest);
      createdSessionId = created.id;
      await saveCheckedInRouteVisitDraft({ ...visit, sessionId: created.id, crmStatus: 'pending', crmMessage: 'CRM session created; checking in...' });
      setActiveVisit((current) => current && current.checkedInAt === checkedInAt ? {
        ...current,
        sessionId: created.id,
        crmStatus: 'pending',
        crmMessage: 'CRM session created; checking in...',
      } : current);
      await checkInTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, created.id, checkInRequest);
      await saveCheckedInRouteVisitDraft({ ...visit, sessionId: created.id, crmStatus: 'checked_in', crmMessage: 'CRM checked in' });
      setActiveVisit((current) => current && current.checkedInAt === checkedInAt ? { ...current, sessionId: created.id, crmStatus: 'checked_in', crmMessage: 'CRM checked in' } : current);
    } catch (error) {
      await saveCheckedInRouteVisitDraft({
        ...visit,
        ...(createdSessionId ? { sessionId: createdSessionId } : {}),
        crmStatus: 'local_only',
        crmMessage: error instanceof Error ? error.message : 'CRM check-in failed. Complete the visit and retry from Sync Status.',
      });
      setActiveVisit((current) => current && current.checkedInAt === checkedInAt ? {
        ...current,
        ...(createdSessionId ? { sessionId: createdSessionId } : {}),
        crmStatus: 'local_only',
        crmMessage: error instanceof Error ? error.message : 'CRM check-in failed. Complete the visit and retry from Sync Status.',
      } : current);
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setActiveVisit((existing) => existing && existing.checkedInAt === checkedInAt ? {
          ...existing,
          latitude: roundCoordinate(current.coords.latitude),
          longitude: roundCoordinate(current.coords.longitude),
        } : existing);
        const latest = {
          ...visit,
          ...(createdSessionId ? { sessionId: createdSessionId } : {}),
          latitude: roundCoordinate(current.coords.latitude),
          longitude: roundCoordinate(current.coords.longitude),
        };
        await saveCheckedInRouteVisitDraft(latest);
        return;
      }
      setLocationError('Location permission was not granted. The visit can still be timed, but GPS evidence is missing.');
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Unable to capture current location.');
    }
  }

  async function completeVisit() {
    if (!activeVisit || !notes.trim()) return;
    const checkedOutAt = new Date().toISOString();
    const checkoutNotes = notes.trim();
    const completeRequest = buildRouteVisitCompleteRequest(activeVisit, checkoutNotes, checkedOutAt);
    setIsSubmittingVisit(true);
    setVisitSyncMessage(null);
    let savedToCrm = false;
    let savedForLater = false;
    if (auth && activeVisit.sessionId) {
      try {
        await completeTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, activeVisit.sessionId, completeRequest);
        savedToCrm = true;
        savedForLater = true;
        clearRouteVisitDraft(activeVisit.localVisitId);
        setVisitSyncMessage('CRM saved');
      } catch (error) {
        try {
          await saveRouteVisitDraft(activeVisit, checkedOutAt, checkoutNotes, completeRequest, error);
          savedForLater = true;
          setVisitSyncMessage(describeDraftSaveFailure(error).message);
        } catch (draftError) {
          setVisitSyncMessage(draftError instanceof Error ? `Visit not saved yet: ${draftError.message}` : 'Visit not saved yet. Your notes are still on screen; shorten them and try again.');
        }
      }
    } else {
      try {
        await saveRouteVisitDraft(activeVisit, checkedOutAt, checkoutNotes, completeRequest);
        savedForLater = true;
        setVisitSyncMessage(describeDraftSaveFailure().message);
      } catch (draftError) {
        setVisitSyncMessage(draftError instanceof Error ? `Visit not saved yet: ${draftError.message}` : 'Visit not saved yet. Your notes are still on screen; shorten them and try again.');
      }
    }
    if (savedForLater) {
      setCompletedVisits((items) => [
        {
          ...activeVisit,
          checkedOutAt,
          notes: checkoutNotes,
        },
        ...items,
      ]);
      setActiveVisit(null);
      setNotes('');
    }
    setIsSubmittingVisit(false);
    if (savedToCrm && Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  return (
    <Screen>
      <HeroCard title="Route plan" eyebrow="Field execution" icon={{ name: 'map.fill', fallback: 'R' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Build and optimize your route, check in on site, and hand off to navigation. Road/traffic optimization stays parked until the maps decision.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MiniMetric label="Stops" value={String(routeAccounts.length)} />
          <MiniMetric label="Done" value={String(completedVisits.length)} />
        </View>
      </HeroCard>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {locationError ? <ErrorState message={locationError} /> : null}
      {visitSyncMessage ? (
        isVisitSyncSuccess ? <SuccessNotice message={visitSyncMessage} /> : <ErrorState message={visitSyncMessage} />
      ) : null}
      {isLoading ? <LoadingState label="Building route plan..." /> : null}

      {activeVisit ? (
        <Card style={{ borderColor: '#B7E4C7', backgroundColor: '#F3FFF7' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text selectable style={{ ...typography.caption, color: colors.success, textTransform: 'uppercase' }}>
                Checked in
              </Text>
              <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                {activeVisit.account.displayName}
              </Text>
              <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                Started {formatDateTime(activeVisit.checkedInAt)}
              </Text>
            </View>
            <View style={{ gap: spacing.xs, alignItems: 'flex-end' }}>
              <Pill label={activeVisit.latitude !== undefined ? 'GPS captured' : 'Timed only'} tone={activeVisit.latitude !== undefined ? 'active' : 'review'} />
              <Pill label={activeVisit.crmStatus === 'checked_in' ? 'CRM checked in' : activeVisit.crmStatus === 'local_only' ? 'Will retry' : 'CRM pending'} tone={activeVisit.crmStatus === 'checked_in' ? 'active' : 'pending'} />
            </View>
          </View>
          {activeVisit.crmMessage ? (
            <Text selectable style={{ ...typography.caption, color: activeVisit.crmStatus === 'checked_in' ? colors.success : colors.warning }}>
              {activeVisit.crmMessage}
            </Text>
          ) : null}
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Checkout notes, follow-up, site observations..."
            placeholderTextColor={colors.subtle}
            style={{
              minHeight: 112,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.md,
              color: colors.text,
              textAlignVertical: 'top',
              ...typography.body,
            }}
          />
          <PrimaryButton label={isSubmittingVisit ? 'Saving visit...' : 'Complete visit'} disabled={!notes.trim() || isSubmittingVisit} icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }} onPress={() => void completeVisit()} />
        </Card>
      ) : null}

      <SectionTitle title="Route builder" detail="Select stops, optimize the order (nearest-neighbour, straight-line), and hand off to navigation. Provider-backed road/traffic optimization stays parked until the maps decision." />

      {planMessage ? <Text selectable style={{ ...typography.caption, color: colors.muted }}>{planMessage}</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <SecondaryButton label="Add stops" icon={{ name: 'plus.circle.fill', fallback: 'Add' }} onPress={() => setIsPickerOpen(true)} />
        </View>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <SecondaryButton label="Optimize order" icon={{ name: 'arrow.up.arrow.down.circle.fill', fallback: 'Opt' }} disabled={locatedStopCount < 2} onPress={optimizeOrder} />
        </View>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <SecondaryButton label={isLoadingSuggested ? 'Loading...' : 'Load suggested'} icon={{ name: 'map.fill', fallback: 'Plan' }} disabled={isLoadingSuggested} onPress={() => void loadSuggestedRoute()} />
        </View>
        <View style={{ flexBasis: '47%', flexGrow: 1 }}>
          <SecondaryButton label={savedRoutes.length ? `Routes (${savedRoutes.length})` : 'Save / load'} icon={{ name: 'list.bullet', fallback: 'Routes' }} onPress={() => setIsRoutesSheetOpen(true)} />
        </View>
      </View>

      {locatedStopCount >= 2 ? (
        <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
          ~{roundMiles(totalMiles)} mi straight-line · {locatedStopCount === routeAccounts.length ? `${routeAccounts.length} stops` : `${locatedStopCount} of ${routeAccounts.length} located`}
        </Text>
      ) : null}

      {routeAccounts.length >= 1 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
          <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>Start</Text>
          <RouteIconButton icon="minus.circle.fill" label="Earlier start time" disabled={startMinutes <= 0} onPress={() => setStartMinutes((value) => Math.max(0, value - 15))} />
          <Text selectable style={{ ...typography.subtitle, color: colors.text, fontVariant: ['tabular-nums'] }}>{formatMinutesOfDay(startMinutes)}</Text>
          <RouteIconButton icon="plus.circle.fill" label="Later start time" disabled={startMinutes >= 1435} onPress={() => setStartMinutes((value) => Math.min(1435, value + 15))} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Set start time to now"
            onPress={() => setStartMinutes(roundToFiveMinutes(currentMinutesOfDay()))}
            hitSlop={6}
            style={({ pressed }) => ({ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '800' }}>Now</Text>
          </Pressable>
          {routeAccounts.length >= 2 ? (
            <Text selectable style={{ ...typography.caption, color: colors.muted }}>
              → finish ~{formatMinutesOfDay(finishMinutes)}{finishMinutes >= 1440 ? ' (+1d)' : ''} ({locatedStopCount === routeAccounts.length ? 'est.' : 'est., excludes unlocated stops'})
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ gap: spacing.md }}>
        {routeAccounts.map((account, index) => {
          const meta = ACCOUNT_MAP_STATUS_META[deriveAccountMapStatus(account, consignmentSignals.get(account.id))];
          const stopNavTarget: NavTarget | null = hasCoords(account)
            ? { latitude: account.latitude, longitude: account.longitude, label: account.displayName }
            : null;
          return (
            <RouteStopCard
              key={account.id}
              account={account}
              disabled={Boolean(activeVisit)}
              index={index + 1}
              isDone={completedVisits.some((visit) => visit.account.id === account.id)}
              onStart={() => void startVisit(account)}
              statusColor={meta.color}
              statusLabel={meta.label}
              canNavigate={stopNavTarget !== null}
              onNavigate={() => stopNavTarget && setNavTarget(stopNavTarget)}
              legMiles={legMiles[index] ?? null}
              arrivalLabel={index > 0 && arrivalReliable[index] ? formatMinutesOfDay(startMinutes + (schedule.stops[index]?.arrivalOffsetMinutes ?? 0)) : undefined}
              dwellMinutes={dwellByStopId[account.id] ?? DEFAULT_DWELL_MINUTES}
              onCycleDwell={() => cycleDwell(account.id)}
              onRemove={() => removeStop(account.id)}
              onMoveUp={() => moveStop(index, -1)}
              onMoveDown={() => moveStop(index, 1)}
              canMoveUp={index > 0}
              canMoveDown={index < routeAccounts.length - 1}
            />
          );
        })}
      </View>

      {routeAccounts.length === 0 && !isLoading ? (
        <EmptyState title="No stops on the route yet" detail="Tap Add stops to build a route, or Load suggested to start from the server's nearest-neighbour plan." />
      ) : null}

      <SecondaryButton label="Refresh accounts" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />

      {completedVisits.length ? (
        <>
          <SectionTitle title="Completed today" />
          <View style={{ gap: spacing.md }}>
            {completedVisits.map((visit) => (
              <Card key={`${visit.account.id}-${visit.checkedOutAt}`} style={{ gap: spacing.sm }}>
                <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                  {visit.account.displayName}
                </Text>
                <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                  {formatDateTime(visit.checkedInAt)} to {formatDateTime(visit.checkedOutAt)}
                </Text>
                <Text selectable style={{ ...typography.callout, color: colors.text }}>
                  {visit.notes}
                </Text>
              </Card>
            ))}
          </View>
        </>
      ) : null}

      <RouteStopPicker visible={isPickerOpen} accounts={availableAccounts} onAdd={addStop} onClose={() => setIsPickerOpen(false)} />
      <SavedRoutesSheet
        visible={isRoutesSheetOpen}
        savedRoutes={savedRoutes}
        canSaveCurrent={routeAccounts.length > 0}
        onSaveCurrent={handleSaveCurrentRoute}
        onLoad={handleLoadRoute}
        onDuplicate={(route) => void duplicateRoute(route.id, `${route.name} copy`)}
        onDelete={confirmDeleteRoute}
        onClose={() => setIsRoutesSheetOpen(false)}
      />
      <NavigateSheet target={navTarget} onClose={() => setNavTarget(null)} />
    </Screen>
  );
}

function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function hasCoords(account: AccountSummary): account is AccountSummary & { latitude: number; longitude: number } {
  return typeof account.latitude === 'number' && typeof account.longitude === 'number';
}

function routeSeedRank(account: AccountSummary): number {
  return account.lastEngagementAt ? new Date(account.lastEngagementAt).getTime() : 0;
}

function currentMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function roundToFiveMinutes(minutes: number): number {
  return Math.min(1435, Math.max(0, Math.round(minutes / 5) * 5));
}

function RouteIconButton({ icon, label, onPress, disabled, tone }: { icon: string; label: string; onPress?: (() => void) | undefined; disabled?: boolean | undefined; tone?: 'danger' }) {
  const { palette: colors } = useTheme();
  const color = disabled ? colors.subtle : tone === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 })}
    >
      <NativeIcon name={icon} fallback={label} color={color} size={18} />
    </Pressable>
  );
}

function buildRouteVisitCreateRequest(account: RouteVisitAccount, trainerUserId: string, checkedInAt: string): CreateTrainingSessionRequest {
  return {
    activityKind: 'site_visit',
    attendeeCount: 0,
    durationMinutes: 45,
    notes: `Mobile route visit for ${account.displayName}.`,
    scheduledAt: new Date(Date.now() + 30_000).toISOString(),
    title: `Route visit - ${account.displayName}`,
    trainerUserId,
  };
}

function buildRouteVisitCheckInRequest(checkedInAt: string): CheckInTrainingSessionRequest {
  return {
    checkedInAt,
    notes: 'Mobile route visit check-in.',
  };
}

function buildRouteVisitCompleteRequest(activeVisit: ActiveVisit, checkoutNotes: string, checkedOutAt: string): CompleteTrainingSessionRequest {
  const durationMinutes = Math.max(1, Math.round((new Date(checkedOutAt).getTime() - new Date(activeVisit.checkedInAt).getTime()) / 60_000));
  const gpsSummary = activeVisit.latitude !== undefined && activeVisit.longitude !== undefined
    ? `GPS captured near ${roundCoordinate(activeVisit.latitude)}, ${roundCoordinate(activeVisit.longitude)}.`
    : 'Timed visit only; GPS was not captured.';
  return {
    attendeeCount: 0,
    checkedOutAt,
    completedAt: checkedOutAt,
    completionSummary: `Mobile route visit completed for ${activeVisit.account.displayName}. ${gpsSummary}`,
    durationMinutes,
    checkoutNotes: `${checkoutNotes}\n\n${gpsSummary}`,
    notes: checkoutNotes,
    proofAttachmentCount: 0,
  };
}

async function saveRouteVisitDraft(activeVisit: ActiveVisit, checkedOutAt: string, checkoutNotes: string, completeRequest: CompleteTrainingSessionRequest, error?: unknown) {
  const failureCopy = describeDraftSaveFailure(error);
  await upsertRouteVisitDraftDurably({
    kind: 'route_visit',
    title: `Route visit: ${activeVisit.account.displayName}`,
    detail: failureCopy.detail,
    payload: {
      kind: 'route_visit',
      localVisitId: activeVisit.localVisitId,
      stage: 'completed',
      accountId: activeVisit.account.id,
      accountName: activeVisit.account.displayName,
      checkedInAt: activeVisit.checkedInAt,
      checkedOutAt,
      notes: checkoutNotes,
      createRequest: activeVisit.createRequest,
      checkInRequest: activeVisit.checkInRequest,
      completeRequest,
      ...(activeVisit.sessionId ? { sessionId: activeVisit.sessionId } : {}),
      ...(activeVisit.latitude !== undefined ? { latitude: roundCoordinate(activeVisit.latitude) } : {}),
      ...(activeVisit.longitude !== undefined ? { longitude: roundCoordinate(activeVisit.longitude) } : {}),
    },
  });
}

async function saveCheckedInRouteVisitDraft(activeVisit: ActiveVisit) {
  await upsertRouteVisitDraftDurably({
    kind: 'route_visit',
    title: `Route visit: ${activeVisit.account.displayName}`,
    detail: 'Checked-in visit saved on this device. Complete checkout in Route or retry CRM sync from Sync Status.',
    payload: {
      kind: 'route_visit',
      localVisitId: activeVisit.localVisitId,
      stage: 'checked_in',
      accountId: activeVisit.account.id,
      accountName: activeVisit.account.displayName,
      checkedInAt: activeVisit.checkedInAt,
      notes: '',
      createRequest: activeVisit.createRequest,
      checkInRequest: activeVisit.checkInRequest,
      ...(activeVisit.sessionId ? { sessionId: activeVisit.sessionId } : {}),
      ...(activeVisit.latitude !== undefined ? { latitude: roundCoordinate(activeVisit.latitude) } : {}),
      ...(activeVisit.longitude !== undefined ? { longitude: roundCoordinate(activeVisit.longitude) } : {}),
    },
  });
}

function RouteStopCard({
  account,
  arrivalLabel,
  canMoveDown,
  canMoveUp,
  canNavigate,
  disabled,
  dwellMinutes,
  index,
  isDone,
  legMiles,
  onCycleDwell,
  onMoveDown,
  onMoveUp,
  onNavigate,
  onRemove,
  onStart,
  statusColor,
  statusLabel,
}: {
  account: AccountSummary;
  arrivalLabel?: string | undefined;
  canMoveDown?: boolean;
  canMoveUp?: boolean;
  canNavigate: boolean;
  disabled: boolean;
  dwellMinutes?: number;
  index: number;
  isDone: boolean;
  legMiles?: number | null;
  onCycleDwell?: () => void;
  onMoveDown?: () => void;
  onMoveUp?: () => void;
  onNavigate: () => void;
  onRemove?: () => void;
  onStart: () => void;
  statusColor: string;
  statusLabel: string;
}) {
  const { palette: colors } = useTheme();
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: radius.full,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDone ? colors.successSoft : colors.aquaSoft,
              borderWidth: 1,
              borderColor: isDone ? '#B7E4C7' : '#BAE6FD',
            }}
          >
            <Text selectable style={{ ...typography.caption, color: isDone ? colors.success : colors.aqua }}>
              {isDone ? 'Done' : index}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                accessible
                accessibilityLabel={`Map status: ${statusLabel}`}
                style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: statusColor }}
              />
              <Text selectable style={{ ...typography.subtitle, color: colors.text, flexShrink: 1 }}>
                {account.displayName}
              </Text>
            </View>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {account.territoryName ?? account.regionName ?? 'No territory assigned'}
            </Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text selectable style={{ ...typography.caption, color: colors.primaryDeep }}>
              {initials(account.displayName)}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <FieldChip label="TM" value={account.assignedTmName ?? 'Unassigned'} />
          <FieldChip label="Last touch" value={formatDate(account.lastEngagementAt)} />
          <FieldChip label="Group" value={account.affinityGroupName ?? account.ownershipGroupName ?? formatGroupClassification(account.groupClassification) ?? 'Independent'} />
        </View>

        {onRemove ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text selectable style={{ ...typography.caption, color: colors.muted, flexShrink: 1 }}>
                {arrivalLabel ? `Arrive ~${arrivalLabel} · ` : ''}
                {typeof legMiles === 'number' ? `${roundMiles(legMiles)} mi from previous` : index === 1 ? 'start of route' : 'distance n/a'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <RouteIconButton icon="chevron.up" label={`Move ${account.displayName} up`} disabled={!canMoveUp} onPress={onMoveUp} />
                <RouteIconButton icon="chevron.down" label={`Move ${account.displayName} down`} disabled={!canMoveDown} onPress={onMoveDown} />
                <RouteIconButton icon="xmark.circle.fill" label={`Remove ${account.displayName} from route`} tone="danger" onPress={onRemove} />
              </View>
            </View>
            {onCycleDwell ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Dwell ${dwellMinutes ?? DEFAULT_DWELL_MINUTES} minutes at ${account.displayName}, tap to change`}
                onPress={onCycleDwell}
                hitSlop={4}
                style={({ pressed }) => ({ alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 })}
              >
                <Text selectable={false} style={{ ...typography.caption, color: colors.primaryDeep, fontWeight: '800' }}>
                  Dwell: {dwellMinutes ?? DEFAULT_DWELL_MINUTES} min
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${account.displayName}`}
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <NativeIcon name="doc.text.magnifyingglass" fallback="i" color={colors.primary} size={16} />
            <Text style={{ ...typography.callout, color: colors.primary, fontWeight: '800' }}>View</Text>
          </View>
        </Pressable>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        {canNavigate ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Navigate to ${account.displayName}`}
              onPress={onNavigate}
              style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1 })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                <NativeIcon name="location.north.fill" fallback="Nav" color={colors.primary} size={16} />
                <Text style={{ ...typography.callout, color: colors.primary, fontWeight: '800' }}>Navigate</Text>
              </View>
            </Pressable>
            <View style={{ width: 1, backgroundColor: colors.border }} />
          </>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isDone ? `Visit complete for ${account.displayName}` : `Check in at ${account.displayName}`}
          accessibilityState={{ disabled: disabled || isDone }}
          disabled={disabled || isDone}
          onPress={onStart}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: disabled || isDone ? colors.surfacePressed : colors.primary,
            opacity: pressed ? 0.84 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <NativeIcon name="location.fill" fallback=">" color={disabled || isDone ? colors.subtle : colors.white} size={16} />
            <Text style={{ ...typography.callout, color: disabled || isDone ? colors.subtle : colors.white, fontWeight: '800' }}>
              {isDone ? 'Complete' : 'Check in'}
            </Text>
          </View>
        </Pressable>
      </View>
    </Card>
  );
}

function FieldChip({ label, value }: { label: string; value: string }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.full, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ flex: 1, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', padding: spacing.md, gap: 2, borderCurve: 'continuous' }}>
      <Text selectable style={{ ...typography.caption, color: '#BFDBFE', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.textInverse, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function SuccessNotice({ message }: { message: string }) {
  const { palette: colors } = useTheme();
  return (
    <Card style={{ borderColor: '#B7E4C7', backgroundColor: '#F3FFF7' }}>
      <Text selectable style={{ ...typography.subtitle, color: colors.success }}>
        Visit saved
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.text }}>
        {message}
      </Text>
    </Card>
  );
}

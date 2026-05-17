import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { CheckInTrainingSessionRequest, CompleteTrainingSessionRequest, CreateTrainingSessionRequest } from '@pulse/contracts/training';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { formatDate, formatDateTime, initials } from '@/lib/format';
import { enqueueDraft } from '@/lib/mobile-draft-queue';
import { checkInTrainingSessionRecord, completeTrainingSessionRecord, createTrainingSessionRecord } from '@/lib/api';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

type ActiveVisit = {
  account: AccountSummary;
  checkedInAt: string;
  sessionId?: string;
  latitude?: number;
  longitude?: number;
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
  const { apiBaseUrl, auth } = useSession();
  const { accounts, errorMessage, isLoading, reload } = useFieldData(30);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [completedVisits, setCompletedVisits] = useState<CompletedVisit[]>([]);
  const [notes, setNotes] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [visitSyncMessage, setVisitSyncMessage] = useState<string | null>(null);
  const [isSubmittingVisit, setIsSubmittingVisit] = useState(false);

  const stops = useMemo(() => {
    return [...accounts]
      .sort((left, right) => {
        const leftTouch = left.lastEngagementAt ? new Date(left.lastEngagementAt).getTime() : 0;
        const rightTouch = right.lastEngagementAt ? new Date(right.lastEngagementAt).getTime() : 0;
        return leftTouch - rightTouch;
      })
      .slice(0, 8);
  }, [accounts]);

  async function startVisit(account: AccountSummary) {
    setLocationError(null);
    setVisitSyncMessage(null);
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const checkedInAt = new Date().toISOString();
    const createRequest = buildRouteVisitCreateRequest(account, auth?.identity.userId, checkedInAt);
    const checkInRequest = buildRouteVisitCheckInRequest(checkedInAt);
    const visit: ActiveVisit = {
      account,
      checkedInAt,
      crmStatus: 'pending',
      createRequest,
      checkInRequest,
    };
    setActiveVisit(visit);

    if (!auth) {
      setActiveVisit({ ...visit, crmStatus: 'local_only', crmMessage: 'No active CRM session. Complete the visit and retry from Sync Status after signing in.' });
      return;
    }

    try {
      const created = await createTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, account.id, createRequest);
      await checkInTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, created.id, checkInRequest);
      setActiveVisit((current) => current && current.checkedInAt === checkedInAt ? { ...current, sessionId: created.id, crmStatus: 'checked_in', crmMessage: 'CRM checked in' } : current);
    } catch (error) {
      setActiveVisit((current) => current && current.checkedInAt === checkedInAt ? { ...current, crmStatus: 'local_only', crmMessage: error instanceof Error ? error.message : 'CRM check-in failed. Complete the visit and retry from Sync Status.' } : current);
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setActiveVisit((existing) => existing && existing.checkedInAt === checkedInAt ? {
          ...existing,
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        } : existing);
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
    const completeRequest = buildRouteVisitCompleteRequest(activeVisit, notes.trim(), checkedOutAt);
    setIsSubmittingVisit(true);
    setVisitSyncMessage(null);
    let savedToCrm = false;
    if (auth && activeVisit.sessionId) {
      try {
        await completeTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, activeVisit.sessionId, completeRequest);
        savedToCrm = true;
        setVisitSyncMessage('CRM saved');
      } catch (error) {
        saveRouteVisitDraft(activeVisit, checkedOutAt, notes.trim(), completeRequest, error);
        setVisitSyncMessage('Draft on phone. Retry from Sync Status when CRM is reachable.');
      }
    } else {
      saveRouteVisitDraft(activeVisit, checkedOutAt, notes.trim(), completeRequest);
      setVisitSyncMessage('Draft on phone. Retry from Sync Status when CRM is reachable.');
    }
    setCompletedVisits((items) => [
      {
        ...activeVisit,
        checkedOutAt,
        notes: notes.trim(),
      },
      ...items,
    ]);
    setActiveVisit(null);
    setNotes('');
    setIsSubmittingVisit(false);
    if (savedToCrm && Platform.OS === 'ios') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  return (
    <Screen>
      <HeroCard title="Route plan" eyebrow="Field execution" icon={{ name: 'map.fill', fallback: 'R' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Order nearby work, check in on site, and keep the visit trail clean before provider-backed optimization is approved.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MiniMetric label="Stops" value={String(stops.length)} />
          <MiniMetric label="Done" value={String(completedVisits.length)} />
        </View>
      </HeroCard>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {locationError ? <ErrorState message={locationError} /> : null}
      {visitSyncMessage ? <ErrorState message={visitSyncMessage} /> : null}
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
            placeholder="Checkout notes, follow-up, inventory observations..."
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

      <SectionTitle title="Suggested stops" detail="Provider-neutral ordering uses stale engagement first; optimization stays parked until the map provider decision." />
      <View style={{ gap: spacing.md }}>
        {stops.map((account, index) => (
          <RouteStopCard
            key={account.id}
            account={account}
            disabled={Boolean(activeVisit)}
            index={index + 1}
            isDone={completedVisits.some((visit) => visit.account.id === account.id)}
            onStart={() => void startVisit(account)}
          />
        ))}
      </View>

      {!stops.length && !isLoading ? (
        <EmptyState title="No route stops yet" detail="Refresh when accounts are available for this role, then start with the oldest last-touch account." />
      ) : null}

      <SecondaryButton label="Refresh route" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />

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
    </Screen>
  );
}

function roundCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

function buildRouteVisitCreateRequest(account: AccountSummary, trainerUserId: string | undefined, checkedInAt: string): CreateTrainingSessionRequest {
  return {
    activityKind: 'site_visit',
    attendeeCount: 0,
    durationMinutes: 45,
    notes: `Mobile route visit for ${account.displayName}.`,
    scheduledAt: new Date(Date.now() + 30_000).toISOString(),
    title: `Route visit - ${account.displayName}`,
    trainerUserId: trainerUserId ?? 'mobile-session-user',
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

function saveRouteVisitDraft(activeVisit: ActiveVisit, checkedOutAt: string, checkoutNotes: string, completeRequest: CompleteTrainingSessionRequest, error?: unknown) {
  enqueueDraft({
    kind: 'route_visit',
    title: `Route visit: ${activeVisit.account.displayName}`,
    detail: error instanceof Error ? `CRM sync failed: ${error.message}` : 'Draft on this device until CRM accepts the route visit.',
    payload: {
      kind: 'route_visit',
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

function RouteStopCard({
  account,
  disabled,
  index,
  isDone,
  onStart,
}: {
  account: AccountSummary;
  disabled: boolean;
  index: number;
  isDone: boolean;
  onStart: () => void;
}) {
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
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              {account.displayName}
            </Text>
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
          <FieldChip label="Group" value={account.affinityGroupName ?? account.ownershipGroupName ?? account.groupClassification ?? 'Independent'} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
          style={({ pressed }) => ({ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.72 : 1 })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
            <NativeIcon name="doc.text.magnifyingglass" fallback="i" color={colors.primary} size={16} />
            <Text onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })} style={{ ...typography.callout, color: colors.primary, fontWeight: '800' }}>View</Text>
          </View>
        </Pressable>
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Pressable
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
            <Text onPress={disabled || isDone ? undefined : onStart} style={{ ...typography.callout, color: disabled || isDone ? colors.subtle : colors.white, fontWeight: '800' }}>
              {isDone ? 'Complete' : 'Check in'}
            </Text>
          </View>
        </Pressable>
      </View>
    </Card>
  );
}

function FieldChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderRadius: radius.full, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
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

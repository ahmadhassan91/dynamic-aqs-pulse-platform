import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { formatDate, formatDateTime, initials } from '@/lib/format';
import { enqueueDraft } from '@/lib/mobile-draft-queue';
import { useFieldData } from '@/hooks/use-mobile-data';
import { colors, radius, spacing, typography } from '@/theme';

type ActiveVisit = {
  account: AccountSummary;
  checkedInAt: string;
  latitude?: number;
  longitude?: number;
};

type CompletedVisit = ActiveVisit & {
  checkedOutAt: string;
  notes: string;
};

export default function RouteScreen() {
  const { accounts, errorMessage, isLoading, reload } = useFieldData(30);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [completedVisits, setCompletedVisits] = useState<CompletedVisit[]>([]);
  const [notes, setNotes] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);

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
    if (Platform.OS === 'ios') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const visit: ActiveVisit = { account, checkedInAt: new Date().toISOString() };
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.granted) {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setActiveVisit({
          ...visit,
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        return;
      }
      setLocationError('Location permission was not granted. The visit can still be timed, but GPS evidence is missing.');
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Unable to capture current location.');
    }
    setActiveVisit(visit);
  }

  function completeVisit() {
    if (!activeVisit || !notes.trim()) return;
    enqueueDraft({
      kind: 'route_visit',
      title: `Route visit: ${activeVisit.account.displayName}`,
      detail: 'Draft on this device until the CRM field visit API is approved.',
      payload: {
        kind: 'route_visit',
        accountId: activeVisit.account.id,
        accountName: activeVisit.account.displayName,
        checkedInAt: activeVisit.checkedInAt,
        checkedOutAt: new Date().toISOString(),
        notes: notes.trim(),
        ...(activeVisit.latitude !== undefined ? { latitude: activeVisit.latitude } : {}),
        ...(activeVisit.longitude !== undefined ? { longitude: activeVisit.longitude } : {}),
      },
    });
    setCompletedVisits((items) => [
      {
        ...activeVisit,
        checkedOutAt: new Date().toISOString(),
        notes: notes.trim(),
      },
      ...items,
    ]);
    setActiveVisit(null);
    setNotes('');
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
            <Pill label={activeVisit.latitude !== undefined ? 'GPS captured' : 'Timed only'} tone={activeVisit.latitude !== undefined ? 'active' : 'review'} />
          </View>
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
          <PrimaryButton label="Complete visit" disabled={!notes.trim()} icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }} onPress={completeVisit} />
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
            <Text style={{ ...typography.callout, color: colors.primary, fontWeight: '800' }}>View</Text>
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

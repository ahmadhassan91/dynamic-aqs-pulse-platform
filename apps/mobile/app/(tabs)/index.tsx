import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { CalendarEventSummary } from '@pulse/contracts/calendar';
import { AccountCard } from '@/components/account-card';
import { LeadCard } from '@/components/lead-card';
import { MobileNextActionCard } from '@/components/mobile-next-action-card';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, MetricCard, NativeIcon, Pill, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { PulseLogo } from '@/components/pulse-logo';
import { useMobileNextActions } from '@/hooks/use-mobile-next-actions';
import { fetchCalendarWorkspace } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { MobileLiveApiStatus } from '@/lib/mobile-live-api-status';
import type { MobileNextAction } from '@/lib/mobile-next-action';
import { countOverdueRoseSites } from '@/lib/today-metrics';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function FieldHomeScreen() {
  const { auth, signOut, apiBaseUrl } = useSession();
  const { fieldData, nextActions } = useMobileNextActions();
  const { accounts, consignmentSites, consignmentWorkItems, errorMessage, isLoading, leads, liveApiStatus, queueSummary, reload } = fieldData;

  const activeAccounts = accounts.filter((account) => account.lifecycleStatus === 'active').length;

  // UX-M-007 — overdue ROSE audit and SLA breach badge derived from already-fetched data
  const now = new Date();
  const overdueRoseCount = countOverdueRoseSites(consignmentSites, now);
  const slaBreachCount = queueSummary?.slaRiskCount ?? 0;

  // UX-M-004 — day-agenda strip
  const [todayEvents, setTodayEvents] = useState<CalendarEventSummary[]>([]);
  const [agendaLoading, setAgendaLoading] = useState(false);

  const loadDayAgenda = useCallback(async () => {
    if (!auth) return;
    setAgendaLoading(true);
    try {
      const startDate = now.toISOString().slice(0, 10);
      const endDate = startDate;
      const response = await fetchCalendarWorkspace(apiBaseUrl, auth.tokens.accessToken, { startDate, endDate });
      setTodayEvents(response.items.slice(0, 5));
    } catch {
      // Agenda is best-effort — never block Today
    } finally {
      setAgendaLoading(false);
    }
  }, [apiBaseUrl, auth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadDayAgenda();
  }, [loadDayAgenda]);

  async function handleReload() {
    await reload();
    await loadDayAgenda();
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
        <PulseLogo compact />
        <View style={{ width: 110 }}>
          <SecondaryButton label="Sign out" icon={{ name: 'rectangle.portrait.and.arrow.right', fallback: 'Out' }} onPress={() => void signOut()} />
        </View>
      </View>

      <HeroCard title="Today" eyebrow="Pulse mobile" icon={{ name: 'bolt.horizontal.circle.fill', fallback: 'P' }}>
        <Text selectable style={{ ...typography.callout, color: '#DBEAFE' }}>
          {auth?.identity.displayName ?? auth?.identity.email ?? 'Pulse user'} · {formatRoleLabel(auth?.identity.role)}
        </Text>
      </HeroCard>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading field data..." /> : null}

      {/* UX-M-004 — Day agenda strip */}
      <DayAgendaStrip events={todayEvents} isLoading={agendaLoading} />

      <SectionTitle title="Start here" detail="Pulse ranks route, lead, ROSE, and phone-saved work into one next action." />
      <MobileNextActionCard action={nextActions.primary} onPress={openNextAction} />

      <SectionTitle title="Today's priorities" detail="Start with the oldest urgent follow-up, then refresh when you are back online." />
      <View style={{ gap: spacing.md }}>
        {leads.slice(0, 3).map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        {!leads.length && !isLoading ? <EmptyState title="No priority leads right now" detail="Tap Refresh after your next connection check. If work is missing, ask your RD to confirm your territory access." /> : null}
      </View>

      {/* UX-M-007 — metric strip with overdue ROSE + SLA breach badges */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <MetricCard label="Open actions" value={String(queueSummary?.openActionCount ?? leads.length)} detail={`${queueSummary?.urgentCount ?? 0} urgent`} />
        <MetricCard
          label="SLA risk"
          value={String(slaBreachCount)}
          detail={slaBreachCount > 0 ? `${queueSummary?.stagnantCount ?? 0} stagnant` : 'No SLA breach'}
          {...(slaBreachCount > 0 ? { badge: 'warning' as const } : {})}
        />
        <MetricCard
          label="ROSE"
          value={String(consignmentSites.length)}
          detail={overdueRoseCount > 0 ? `${overdueRoseCount} overdue` : `${consignmentWorkItems.length} work items`}
          {...(overdueRoseCount > 0 ? { badge: 'danger' as const } : {})}
        />
        <MetricCard label="Accounts" value={String(accounts.length)} detail={`${activeAccounts} active in this view`} />
      </View>

      {liveApiStatus ? <LiveApiStatusCard status={liveApiStatus} /> : null}

      <SectionTitle title="Accounts nearby" detail="Open an account card for context, or use Route to build the next stop list." />
      <View style={{ gap: spacing.md }}>
        {accounts.slice(0, 3).map((account) => <AccountCard key={account.id} account={account} />)}
      </View>

      <SecondaryButton label="Refresh Today" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void handleReload()} />
    </Screen>
  );
}

function openNextAction(action: MobileNextAction) {
  router.push(action.targetHref as never);
}

// UX-M-004 — Day agenda strip component
function DayAgendaStrip({ events, isLoading }: { events: CalendarEventSummary[]; isLoading: boolean }) {
  const today = new Date();
  const label = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(today);

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <NativeIcon name="calendar" fallback="Cal" color={colors.primary} size={16} />
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {label}
          </Text>
        </View>
        {events.length > 0 ? (
          <View
            style={{
              borderRadius: radius.full,
              backgroundColor: colors.primarySoft,
              minWidth: 22,
              height: 22,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.xs,
            }}
          >
            <Text style={{ ...typography.caption, color: colors.primary }}>{events.length}</Text>
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          Loading schedule...
        </Text>
      ) : events.length === 0 ? (
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          No scheduled events today.
        </Text>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {events.map((event) => (
            <AgendaEventRow key={event.id} event={event} />
          ))}
        </View>
      )}
    </Card>
  );
}

function AgendaEventRow({ event }: { event: CalendarEventSummary }) {
  const toneMap: Record<string, string> = {
    scheduled: 'pending',
    completed: 'active',
    cancelled: 'inactive',
    no_show: 'risk',
  };
  const tone = toneMap[event.status] ?? 'pending';
  const timeLabel = formatDateTime(event.startsAt);
  const contextLabel = event.accountName ?? event.leadName ?? event.locationName;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'flex-start',
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.sm,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={{ ...typography.callout, color: colors.text, fontWeight: '700' }}>
          {event.title}
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          {timeLabel}{contextLabel ? ` · ${contextLabel}` : ''}
        </Text>
      </View>
      <Pill label={event.status.replace(/_/g, ' ')} tone={tone} />
    </View>
  );
}

function LiveApiStatusCard({ status }: { status: MobileLiveApiStatus }) {
  const tone = status.overall === 'ready' ? 'active' : status.overall === 'partial' ? 'review' : 'pending';
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Live CRM data
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            {status.message}
          </Text>
        </View>
        <Pill label={status.overall} tone={tone} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {status.sections.map((section) => (
          <View key={section.key} style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
            <Text selectable style={{ ...typography.caption, color: section.status === 'failed' ? colors.warning : colors.muted }}>
              {section.label}: {section.status === 'failed' ? 'failed' : section.count}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function formatRoleLabel(role?: string) {
  return role?.replace(/_/g, ' ') ?? 'Field user';
}

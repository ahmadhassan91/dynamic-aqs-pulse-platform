import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { AccountCard } from '@/components/account-card';
import { LeadCard } from '@/components/lead-card';
import { MobileNextActionCard } from '@/components/mobile-next-action-card';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, MetricCard, Pill, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { PulseLogo } from '@/components/pulse-logo';
import { useMobileNextActions } from '@/hooks/use-mobile-next-actions';
import type { MobileLiveApiStatus } from '@/lib/mobile-live-api-status';
import type { MobileNextAction } from '@/lib/mobile-next-action';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export default function FieldHomeScreen() {
  const { auth, signOut } = useSession();
  const { fieldData, nextActions } = useMobileNextActions();
  const { accounts, consignmentSites, consignmentWorkItems, errorMessage, isLoading, leads, liveApiStatus, queueSummary, reload } = fieldData;

  const activeAccounts = accounts.filter((account) => account.lifecycleStatus === 'active').length;

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

      <SectionTitle title="Start here" detail="Pulse ranks route, lead, ROSE, and phone-saved work into one next action." />
      <MobileNextActionCard action={nextActions.primary} onPress={openNextAction} />

      <SectionTitle title="Today’s priorities" detail="Start with the oldest urgent follow-up, then refresh when you are back online." />
      <View style={{ gap: spacing.md }}>
        {leads.slice(0, 3).map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        {!leads.length && !isLoading ? <EmptyState title="No priority leads right now" detail="Tap Refresh after your next connection check. If work is missing, ask your RD to confirm your territory access." /> : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <MetricCard label="Open actions" value={String(queueSummary?.openActionCount ?? leads.length)} detail={`${queueSummary?.urgentCount ?? 0} urgent`} />
        <MetricCard label="SLA risk" value={String(queueSummary?.slaRiskCount ?? 0)} detail={`${queueSummary?.stagnantCount ?? 0} stagnant`} />
        <MetricCard label="ROSE" value={String(consignmentSites.length)} detail={`${consignmentWorkItems.length} work items`} />
        <MetricCard label="Accounts" value={String(accounts.length)} detail={`${activeAccounts} active in this view`} />
      </View>

      {liveApiStatus ? <LiveApiStatusCard status={liveApiStatus} /> : null}

      <SectionTitle title="Accounts nearby" detail="Open an account card for context, or use Route to build the next stop list." />
      <View style={{ gap: spacing.md }}>
        {accounts.slice(0, 3).map((account) => <AccountCard key={account.id} account={account} />)}
      </View>

      <SecondaryButton label="Refresh Today" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />
    </Screen>
  );
}

function openNextAction(action: MobileNextAction) {
  router.push(action.targetHref as never);
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

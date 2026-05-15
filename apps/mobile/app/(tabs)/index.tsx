import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AccountCard } from '@/components/account-card';
import { LeadCard } from '@/components/lead-card';
import { Card, EmptyState, ErrorState, LoadingState, MetricCard, Screen, SectionTitle } from '@/components/native-kit';
import { PulseLogo } from '@/components/pulse-logo';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function FieldHomeScreen() {
  const { auth, signOut } = useSession();
  const { accounts, errorMessage, isLoading, leads, queueSummary, reload } = useFieldData(8);

  const activeAccounts = accounts.filter((account) => account.lifecycleStatus === 'active').length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
        <PulseLogo compact />
        <Pressable onPress={signOut} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface }}>
          <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '800' }}>Sign out</Text>
        </Pressable>
      </View>

      <Card style={{ backgroundColor: colors.primary, borderColor: colors.primaryDeep }}>
        <Text selectable style={{ ...typography.largeTitle, color: colors.white }}>
          Field workspace
        </Text>
        <Text selectable style={{ ...typography.callout, color: '#DBEAFE' }}>
          {auth?.identity.displayName ?? auth?.identity.email ?? 'Pulse user'} · {auth?.identity.role.replace(/_/g, ' ')}
        </Text>
      </Card>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading field data..." /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <MetricCard label="Open actions" value={String(queueSummary?.openActionCount ?? leads.length)} detail={`${queueSummary?.urgentCount ?? 0} urgent`} />
        <MetricCard label="SLA risk" value={String(queueSummary?.slaRiskCount ?? 0)} detail={`${queueSummary?.stagnantCount ?? 0} stagnant`} />
        <MetricCard label="Accounts" value={String(accounts.length)} detail={`${activeAccounts} active in this view`} />
      </View>

      <SectionTitle title="Today’s priorities" detail="Start with leads and account follow-ups before route execution." />
      <View style={{ gap: spacing.md }}>
        {leads.slice(0, 3).map((lead) => <LeadCard key={lead.id} lead={lead} />)}
        {!leads.length && !isLoading ? <EmptyState title="No leads loaded" detail="Refresh when you are connected or adjust backend access for this role." /> : null}
      </View>

      <SectionTitle title="Accounts nearby" detail="Foundation view for the future route/map slice." />
      <View style={{ gap: spacing.md }}>
        {accounts.slice(0, 3).map((account) => <AccountCard key={account.id} account={account} />)}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <QuickAction label="Refresh" onPress={() => void reload()} />
        <QuickAction label="Scan card" onPress={() => router.push('/ocr-capture')} />
        <QuickAction label="Lead inbox" onPress={() => router.push('/(tabs)/leads')} />
      </View>
    </Screen>
  );
}

function QuickAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <Text style={{ ...typography.callout, color: colors.primary, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

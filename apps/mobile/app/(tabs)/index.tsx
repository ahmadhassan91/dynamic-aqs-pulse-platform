import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { AccountCard } from '@/components/account-card';
import { LeadCard } from '@/components/lead-card';
import { EmptyState, ErrorState, HeroCard, LoadingState, MetricCard, NativeIcon, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { PulseLogo } from '@/components/pulse-logo';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export default function FieldHomeScreen() {
  const { auth, signOut } = useSession();
  const { accounts, consignmentSites, consignmentWorkItems, errorMessage, isLoading, leads, queueSummary, reload } = useFieldData(8);

  const activeAccounts = accounts.filter((account) => account.lifecycleStatus === 'active').length;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
        <PulseLogo compact />
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <BellButton count={(queueSummary?.urgentCount ?? 0) + consignmentWorkItems.length} />
          <View style={{ width: 110 }}>
            <SecondaryButton label="Sign out" icon={{ name: 'rectangle.portrait.and.arrow.right', fallback: 'Out' }} onPress={() => void signOut()} />
          </View>
        </View>
      </View>

      <HeroCard title="Field workspace" eyebrow="Pulse mobile" icon={{ name: 'bolt.horizontal.circle.fill', fallback: 'P' }}>
        <Text selectable style={{ ...typography.callout, color: '#DBEAFE' }}>
          {auth?.identity.displayName ?? auth?.identity.email ?? 'Pulse user'} · {auth?.identity.role.replace(/_/g, ' ')}
        </Text>
      </HeroCard>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading field data..." /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <MetricCard label="Open actions" value={String(queueSummary?.openActionCount ?? leads.length)} detail={`${queueSummary?.urgentCount ?? 0} urgent`} />
        <MetricCard label="SLA risk" value={String(queueSummary?.slaRiskCount ?? 0)} detail={`${queueSummary?.stagnantCount ?? 0} stagnant`} />
        <MetricCard label="Consign" value={String(consignmentSites.length)} detail={`${consignmentWorkItems.length} work items`} />
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
        <QuickAction label="Refresh" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />
        <QuickAction label="Scan card" icon={{ name: 'camera.viewfinder', fallback: 'S' }} onPress={() => router.push('/ocr-capture')} />
        <QuickAction label="Consign" icon={{ name: 'shippingbox.fill', fallback: 'C' }} onPress={() => router.push('/(tabs)/consignment')} />
      </View>
    </Screen>
  );
}

function BellButton({ count }: { count: number }) {
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      style={({ pressed }) => ({
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <NativeIcon name="bell.fill" fallback="!" color={colors.primary} size={18} />
      {count > 0 ? (
        <View style={{ position: 'absolute', right: 6, top: 5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ color: colors.white, fontSize: 10, lineHeight: 12, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{Math.min(count, 9)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: { name: string; fallback: string }; label: string; onPress: () => void }) {
  return <View style={{ flex: 1 }}><SecondaryButton label={label} icon={icon} onPress={onPress} /></View>;
}

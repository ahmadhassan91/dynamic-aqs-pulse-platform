import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import { Pill } from '@/components/native-kit';
import { formatDate, initials } from '@/lib/format';
import { colors, radius, softShadow, spacing, typography } from '@/theme';

export function AccountCard({ account }: { account: AccountSummary }) {
  return (
    <Link href={{ pathname: '/account/[id]', params: { id: account.id } }} asChild>
      <Pressable
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          borderCurve: 'continuous',
          ...softShadow,
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: radius.full,
              backgroundColor: colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#C7DDFE',
            }}
          >
            <Text style={{ color: colors.primaryDeep, fontWeight: '800' }}>{initials(account.displayName)}</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              {account.displayName}
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {account.territoryName ?? account.regionName ?? 'Territory not assigned'}
            </Text>
          </View>
          <Pill label={account.lifecycleStatus} tone={account.lifecycleStatus} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Meta label="TM" value={account.assignedTmName ?? 'Unassigned'} />
          <Meta label="Dealer group" value={account.affinityGroupName ?? account.ownershipGroupName ?? account.groupClassification ?? 'Independent'} />
          <Meta label="Last touch" value={formatDate(account.lastEngagementAt)} />
        </View>
      </Pressable>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 98, gap: 2 }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {value}
      </Text>
    </View>
  );
}

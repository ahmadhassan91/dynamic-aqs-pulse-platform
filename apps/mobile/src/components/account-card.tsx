import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import { Pill } from '@/components/native-kit';
import { ACCOUNT_MAP_STATUS_META, deriveAccountMapStatus, formatGroupClassification } from '@/lib/account-map-status';
import { formatDate, initials } from '@/lib/format';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/providers/theme-provider';

export function AccountCard({ account }: { account: AccountSummary }) {
  const { palette: colors, softShadow } = useTheme();
  const statusMeta = ACCOUNT_MAP_STATUS_META[deriveAccountMapStatus(account)];
  return (
    <Link href={{ pathname: '/account/[id]', params: { id: account.id } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open account: ${account.displayName} — ${statusMeta.label}`}
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
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 14,
                height: 14,
                borderRadius: radius.full,
                backgroundColor: statusMeta.color,
                borderWidth: 2,
                borderColor: colors.surface,
              }}
            />
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
          <Meta label="Dealer group" value={account.affinityGroupName ?? account.ownershipGroupName ?? formatGroupClassification(account.groupClassification) ?? 'Independent'} />
          <Meta label="Last touch" value={formatDate(account.lastEngagementAt)} />
        </View>
      </Pressable>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { palette: colors } = useTheme();
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

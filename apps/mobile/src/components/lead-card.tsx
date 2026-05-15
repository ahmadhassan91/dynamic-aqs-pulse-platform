import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { LeadSummary } from '@pulse/contracts/leads';
import { Pill } from '@/components/native-kit';
import { formatDate, humanize } from '@/lib/format';
import { colors, radius, spacing, typography } from '@/theme';

export function LeadCard({ lead }: { lead: LeadSummary }) {
  return (
    <Link href={{ pathname: '/lead/[id]', params: { id: lead.id } }} asChild>
      <Pressable
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          opacity: pressed ? 0.86 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              {lead.companyName}
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {lead.contactDisplayName ?? lead.email ?? lead.phone ?? 'No primary contact yet'}
            </Text>
          </View>
          <Pill label={humanize(lead.stage)} tone={lead.stage} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Meta label="Owner" value={lead.leadOwnerName ?? lead.assignedTmName ?? 'Unassigned'} />
          <Meta label="Source" value={lead.leadSourceName ?? lead.leadSourceCode ?? 'Unknown'} />
          <Meta label="Created" value={formatDate(lead.createdAt)} />
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

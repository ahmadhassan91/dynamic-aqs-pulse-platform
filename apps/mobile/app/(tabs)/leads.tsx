import { useMemo, useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import type { LeadWorkflowQueueItem } from '@pulse/contracts/leads';
import { LeadCard } from '@/components/lead-card';
import { EmptyState, ErrorState, HeroCard, ListScreen, LoadingState, SearchField, Pill } from '@/components/native-kit';
import { formatDate, humanize } from '@/lib/format';
import { useFieldData } from '@/hooks/use-mobile-data';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/providers/theme-provider';

export default function LeadsScreen() {
  const { palette: colors } = useTheme();
  const { errorMessage, isLoading, leads, workflowQueueItems } = useFieldData(50);
  const [query, setQuery] = useState('');
  const useWorkflowQueue = leads.length === 0 && workflowQueueItems.length > 0;

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) => [lead.companyName, lead.contactDisplayName, lead.email, lead.phone, lead.leadSourceName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [leads, query]);
  const filteredQueue = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workflowQueueItems;
    return workflowQueueItems.filter((item) => [item.companyName, item.contactDisplayName, item.email, item.phone, item.leadSourceName, item.nextAction, item.reason]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [workflowQueueItems, query]);
  const visibleCount = useWorkflowQueue ? filteredQueue.length : filteredLeads.length;

  const header = (
    <>
      <HeroCard title="Lead inbox" eyebrow="Follow-up queue" icon={{ name: 'person.crop.circle.badge.plus', fallback: 'L' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Mobile-first working list for new field activity, urgent response, and business-card capture.
        </Text>
      </HeroCard>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search company, contact, source..."
      />
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading leads..." /> : null}
      {useWorkflowQueue ? (
        <View style={{ backgroundColor: colors.warningSoft, borderColor: '#FACC15', borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }}>
          <Text selectable style={{ ...typography.callout, color: colors.text }}>
            No raw leads are assigned to this mobile view, so this inbox is showing your CRM workflow queue.
          </Text>
        </View>
      ) : null}
    </>
  );
  const empty = !visibleCount && !isLoading
    ? <EmptyState title="No leads found" detail="Try another search or confirm this role has lead visibility." />
    : null;

  if (useWorkflowQueue) {
    return (
      <ListScreen
        data={filteredQueue}
        keyExtractor={(item) => `${item.leadId}-${item.actionType}`}
        renderItem={(item) => <WorkflowQueueCard item={item} />}
        header={header}
        empty={empty}
      />
    );
  }
  return (
    <ListScreen
      data={filteredLeads}
      keyExtractor={(lead) => lead.id}
      renderItem={(lead) => <LeadCard lead={lead} />}
      header={header}
      empty={empty}
    />
  );
}

function WorkflowQueueCard({ item }: { item: LeadWorkflowQueueItem }) {
  const { palette: colors, softShadow } = useTheme();
  return (
    <Link href={{ pathname: '/lead/[id]', params: { id: item.leadId } }} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open lead: ${item.companyName}`}
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              {item.companyName}
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {item.contactDisplayName || item.email || item.phone || 'No primary contact yet'}
            </Text>
          </View>
          <Pill label={humanize(item.urgency)} tone={item.urgency === 'high' ? 'review' : 'pending'} />
        </View>
        <Text selectable style={{ ...typography.callout, color: colors.text }}>
          {item.nextAction}
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          {item.reason}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Meta label="Owner" value={item.leadOwnerName ?? item.assignedTmName ?? 'Unassigned'} />
          <Meta label="Stage" value={item.stageLabel} />
          <Meta label="Due" value={item.initialContactDueAt ? formatDate(item.initialContactDueAt) : 'Not set'} />
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

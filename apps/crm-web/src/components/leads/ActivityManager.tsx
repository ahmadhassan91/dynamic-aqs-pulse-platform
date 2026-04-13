'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Group,
  MultiSelect,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconActivity,
  IconAlertCircle,
  IconAlertTriangle,
  IconArchive,
  IconCheck,
  IconClock,
  IconFlame,
  IconHistory,
  IconInfoCircle,
  IconListDetails,
  IconMail,
  IconPhone,
  IconSearch,
} from '@tabler/icons-react';
import type {
  LeadHistoryFeedEntry,
  LeadLifecycleStatusKey,
  LeadRoutingPolicySummary,
  LeadStageKey,
  LeadSummary,
  LeadWorkflowQueueItem,
} from '@pulse/contracts';
import { fetchLeadHistoryFeed, fetchLeadRoutingPolicy, fetchLeadWorkflowQueue, fetchLeads } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type WorkflowTab = 'all' | 'urgent' | 'stagnant';
type InactiveTab = 'parked' | 'closed';

const PAGE_SIZE_OPTIONS = ['10', '25', '50'] as const;

function formatStageLabel(stage: LeadStageKey) {
  switch (stage) {
    case 'new':
      return '1. New Lead';
    case 'discovery_scheduled':
      return '2. Discovery Scheduled';
    case 'discovery_completed':
      return '3. Discovery Completed';
    case 'cis_sent':
      return '4. CIS Sent';
    case 'cis_signed':
      return '5. CIS Signed';
    case 'onboarding_completed':
      return '6. Onboarding Completed';
    case 'customer_active':
      return '7. Customer Active';
  }
}

function getStageColor(stage: LeadStageKey) {
  switch (stage) {
    case 'new':
      return 'blue';
    case 'discovery_scheduled':
      return 'indigo';
    case 'discovery_completed':
      return 'orange';
    case 'cis_sent':
      return 'grape';
    case 'cis_signed':
      return 'teal';
    case 'onboarding_completed':
      return 'cyan';
    case 'customer_active':
      return 'green';
  }
}

function getUrgencyWeight(urgency: LeadWorkflowQueueItem['urgency']) {
  switch (urgency) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function getOwnerLabel(item: LeadWorkflowQueueItem) {
  return item.assignedTmName ?? item.leadOwnerName ?? 'Unassigned';
}

function getLeadOwnerLabel(lead: LeadSummary) {
  return lead.assignedTmName ?? lead.leadOwnerName ?? 'Unassigned';
}

function getWorkflowOwners(items: LeadWorkflowQueueItem[], inactiveLeads: LeadSummary[]) {
  return [...new Set([
    ...items.flatMap((item) => [item.assignedTmName, item.leadOwnerName].filter(Boolean) as string[]),
    ...inactiveLeads.flatMap((lead) => [lead.assignedTmName, lead.leadOwnerName].filter(Boolean) as string[]),
  ])].sort((left, right) => left.localeCompare(right));
}

function formatRoutingBasis(value: LeadRoutingPolicySummary['routingBasis']) {
  return value === 'service_tech_count' ? 'service tech count' : 'truck count';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatLifecycleStatus(value: LeadLifecycleStatusKey) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getLifecycleColor(value: LeadLifecycleStatusKey) {
  if (value === 'parked') return 'yellow';
  if (value === 'closed') return 'dark';
  return 'green';
}

function formatHistoryActor(entry: LeadHistoryFeedEntry) {
  return entry.actor?.displayName ?? 'System';
}

export default function ActivityManager() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [queueItems, setQueueItems] = useState<LeadWorkflowQueueItem[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [historyItems, setHistoryItems] = useState<LeadHistoryFeedEntry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [parkedLeads, setParkedLeads] = useState<LeadSummary[]>([]);
  const [parkedTotal, setParkedTotal] = useState(0);
  const [closedLeads, setClosedLeads] = useState<LeadSummary[]>([]);
  const [closedTotal, setClosedTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowTab>('all');
  const [inactiveTab, setInactiveTab] = useState<InactiveTab>('parked');
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [pageByTab, setPageByTab] = useState<Record<WorkflowTab, number>>({
    all: 1,
    urgent: 1,
    stagnant: 1,
  });
  const [debouncedSearch] = useDebouncedValue(searchQuery, 200);

  useEffect(() => {
    if (!auth) {
      setQueueItems([]);
      setRoutingPolicy(null);
      setHistoryItems([]);
      setHistoryTotal(0);
      setParkedLeads([]);
      setParkedTotal(0);
      setClosedLeads([]);
      setClosedTotal(0);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadWorkflowData() {
      setIsLoading(true);
      setError(null);

      try {
        const [queueResponse, routingPolicyResponse, historyResponse, parkedResponse, closedResponse] = await Promise.all([
          fetchLeadWorkflowQueue(apiBaseUrl, accessToken, {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            limit: 200,
          }),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
          fetchLeadHistoryFeed(apiBaseUrl, accessToken, {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            limit: 20,
          }),
          fetchLeads(apiBaseUrl, accessToken, {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            lifecycleStatus: 'parked',
            limit: 50,
          }),
          fetchLeads(apiBaseUrl, accessToken, {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            lifecycleStatus: 'closed',
            limit: 50,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setQueueItems(queueResponse.items);
        setRoutingPolicy(routingPolicyResponse);
        setHistoryItems(historyResponse.items);
        setHistoryTotal(historyResponse.total);
        setParkedLeads(parkedResponse.items);
        setParkedTotal(parkedResponse.total);
        setClosedLeads(closedResponse.items);
        setClosedTotal(closedResponse.total);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWorkflowData();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, debouncedSearch]);

  const allInactiveLeads = useMemo(() => [...parkedLeads, ...closedLeads], [parkedLeads, closedLeads]);
  const ownerOptions = useMemo(() => getWorkflowOwners(queueItems, allInactiveLeads), [queueItems, allInactiveLeads]);
  const initialContactSlaHours = routingPolicy?.initialContactSlaHours ?? 24;
  const discoverySchedulingSlaHours = routingPolicy?.discoverySchedulingSlaHours ?? 72;
  const cisFollowUpBusinessDays = routingPolicy?.cisFollowUpBusinessDays ?? 5;
  const stagnantDayThreshold = routingPolicy?.stagnantStageDays ?? 7;

  const workflowItems = useMemo<LeadWorkflowQueueItem[]>(() => {
    return queueItems
      .filter((item) => {
        if (ownerFilter.length === 0) {
          return true;
        }

        return ownerFilter.includes(item.assignedTmName ?? '') || ownerFilter.includes(item.leadOwnerName ?? '');
      })
      .sort((left, right) => {
        const urgencyDelta = getUrgencyWeight(right.urgency) - getUrgencyWeight(left.urgency);
        if (urgencyDelta !== 0) {
          return urgencyDelta;
        }
        if (left.slaRisk !== right.slaRisk) {
          return left.slaRisk ? -1 : 1;
        }
        return left.daysInStage - right.daysInStage;
      });
  }, [ownerFilter, queueItems]);

  const urgentItems = useMemo(
    () => workflowItems.filter((item) => item.urgency === 'high'),
    [workflowItems],
  );

  const stagnantItems = useMemo(
    () => workflowItems.filter((item) => item.daysInStage > stagnantDayThreshold),
    [stagnantDayThreshold, workflowItems],
  );

  const filteredParkedLeads = useMemo(
    () => parkedLeads.filter((lead) => ownerFilter.length === 0 || ownerFilter.includes(getLeadOwnerLabel(lead))),
    [ownerFilter, parkedLeads],
  );

  const filteredClosedLeads = useMemo(
    () => closedLeads.filter((lead) => ownerFilter.length === 0 || ownerFilter.includes(getLeadOwnerLabel(lead))),
    [closedLeads, ownerFilter],
  );
  const filteredInactiveCount = filteredParkedLeads.length + filteredClosedLeads.length;

  const itemsByTab: Record<WorkflowTab, LeadWorkflowQueueItem[]> = {
    all: workflowItems,
    urgent: urgentItems,
    stagnant: stagnantItems,
  };

  const activeItems = itemsByTab[activeTab];
  const totalPages = Math.max(1, Math.ceil(activeItems.length / pageSize));
  const currentPage = Math.min(pageByTab[activeTab], totalPages);
  const rangeStart = activeItems.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
  const rangeEnd = Math.min(currentPage * pageSize, activeItems.length);
  const paginatedItems = activeItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!isHydrated || !auth) {
    return null;
  }

  const inactiveItems = inactiveTab === 'parked' ? filteredParkedLeads : filteredClosedLeads;

  return (
    <Box>
      <Stack gap="md" mb="xl">
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="sm" fw={600}>This workspace reflects current lead activity and historical movement.</Text>
          <Text size="xs" c="dimmed">
            Queue actions come from live stage, SLA, and next required action. Recent history is read from the lead audit trail,
            and parked or closed records remain visible here for operational follow-up and recovery.
            {routingPolicy ? ` Routing is currently based on ${formatRoutingBasis(routingPolicy.routingBasis)}.` : ''}
          </Text>
        </Alert>

        {error ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 5 }}>
          <MetricCard
            label="Open Actions"
            value={String(workflowItems.length)}
            color="blue"
            icon={<IconListDetails size={20} />}
          />
          <MetricCard
            label="Urgent Actions"
            value={String(urgentItems.length)}
            color={urgentItems.length > 0 ? 'orange' : 'gray'}
            icon={<IconFlame size={20} />}
          />
          <MetricCard
            label={`Stagnant >${stagnantDayThreshold}d`}
            value={String(stagnantItems.length)}
            color={stagnantItems.length > 0 ? 'red' : 'green'}
            icon={<IconAlertTriangle size={20} />}
          />
          <MetricCard
            label="Recent History"
            value={String(historyTotal)}
            color="grape"
            icon={<IconHistory size={20} />}
          />
          <MetricCard
            label="Inactive Leads"
            value={String(ownerFilter.length === 0 ? parkedTotal + closedTotal : filteredInactiveCount)}
            color="dark"
            icon={<IconArchive size={20} />}
          />
        </SimpleGrid>

        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            placeholder="Search companies, contacts, or workflow activity..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
            style={{ flex: '1 1 320px' }}
          />
          <MultiSelect
            placeholder="Filter owner"
            data={ownerOptions}
            value={ownerFilter}
            onChange={setOwnerFilter}
            style={{ width: 240 }}
            clearable
            searchable
          />
        </Group>
      </Stack>

      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab((value as WorkflowTab) || 'all')}
        variant="pills"
        radius="md"
      >
        <Tabs.List mb="md">
          <Tabs.Tab value="all" leftSection={<IconListDetails size={16} />}>
            Workflow Queue ({workflowItems.length})
          </Tabs.Tab>
          <Tabs.Tab value="urgent" leftSection={<IconFlame size={16} />} color="orange">
            Urgent ({urgentItems.length})
          </Tabs.Tab>
          <Tabs.Tab value="stagnant" leftSection={<IconAlertTriangle size={16} />} color="red">
            Stagnant ({stagnantItems.length})
          </Tabs.Tab>
        </Tabs.List>

        <Card withBorder p="xs" radius="md" mb="md">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Text size="sm" fw={600}>
              {activeItems.length === 0 ? 'No workflow items in this view' : `Showing ${rangeStart}-${rangeEnd} of ${activeItems.length}`}
            </Text>
            <Group gap="xs" align="center" wrap="wrap">
              <Select
                size="xs"
                w={150}
                label="Records per page"
                value={String(pageSize)}
                onChange={(value) => {
                  setPageSize(Number(value ?? 10));
                  setPageByTab({ all: 1, urgent: 1, stagnant: 1 });
                }}
                data={PAGE_SIZE_OPTIONS.map((value) => ({
                  value,
                  label: `${value} per page`,
                }))}
              />
              {totalPages > 1 ? (
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={(nextPage) => setPageByTab((current) => ({ ...current, [activeTab]: nextPage }))}
                  size="sm"
                />
              ) : null}
            </Group>
          </Group>
        </Card>

        <Tabs.Panel value={activeTab}>
          <Stack gap="sm">
            {paginatedItems.length === 0 ? (
              <EmptyState
                icon={<IconCheck size={32} color="var(--mantine-color-green-6)" />}
                message={isLoading ? 'Refreshing workflow queue...' : 'All clear. No workflow items in this view.'}
              />
            ) : (
              paginatedItems.map((item) => (
                <Card key={item.leadId} withBorder radius="md" shadow="sm" p="md">
                  <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
                    <Group gap="md" align="flex-start" style={{ flex: 1 }}>
                      <ThemeIcon size="xl" radius="md" color={item.colorToken} variant="light">
                        {item.actionType === 'call'
                          ? <IconPhone size={24} />
                          : item.actionType === 'email'
                            ? <IconMail size={24} />
                            : item.urgency === 'high'
                              ? <IconFlame size={24} />
                              : <IconListDetails size={24} />}
                      </ThemeIcon>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Group gap="xs" wrap="wrap">
                          <Text fw={700} size="md">{item.nextAction}</Text>
                          <Badge size="xs" color={item.colorToken} variant="light">{item.stageLabel}</Badge>
                          {item.slaRisk ? <Badge size="xs" color="red" variant="filled">SLA risk</Badge> : null}
                          {item.daysInStage > stagnantDayThreshold ? (
                            <Badge size="xs" color="orange" variant="light">
                              {item.daysInStage}d in stage
                            </Badge>
                          ) : null}
                        </Group>
                        <Text size="sm" c="dimmed">{item.reason}</Text>
                        <Group gap="xs" wrap="wrap">
                          <Text size="sm" fw={600}>{item.companyName}</Text>
                          <Text size="xs" c="dimmed">•</Text>
                          <Text size="xs" c="dimmed">{item.contactDisplayName}</Text>
                          <Text size="xs" c="dimmed">•</Text>
                          <Text size="xs" c="dimmed">Assigned: {getOwnerLabel(item)}</Text>
                          <Text size="xs" c="dimmed">•</Text>
                          <Text size="xs" c="dimmed">{item.leadSourceName}</Text>
                        </Group>
                      </Stack>
                    </Group>

                    <Group gap="sm" align="center">
                      <Stack gap={0} align="flex-end">
                        <Text
                          size="xs"
                          fw={700}
                          c={item.urgency === 'high' ? 'red' : item.urgency === 'medium' ? 'orange' : 'dimmed'}
                        >
                          {item.urgency === 'high' ? 'High Priority' : item.urgency === 'medium' ? 'Medium Priority' : 'Low Priority'}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {item.routingTeam === 'strategic_growth' ? 'Strategic Growth' : 'National TM'}
                        </Text>
                      </Stack>
                      <Button component={Link} href={`/leads/${item.leadId}`} variant="light" color={item.colorToken} size="sm">
                        Open Record
                      </Button>
                    </Group>
                  </Group>
                </Card>
              ))
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Paper withBorder radius="md" p="lg" mt="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Recent Lead History</Text>
              <Text size="sm" c="dimmed">
                Recent lead changes are pulled from the live audit trail so ops can review reopen, park, close, and workflow movement without opening every record.
              </Text>
            </Stack>
            <Badge color="grape" variant="light">{historyTotal} recent events</Badge>
          </Group>

          {historyItems.length === 0 ? (
            <EmptyState
              icon={<IconHistory size={32} color="var(--mantine-color-violet-6)" />}
              message={isLoading ? 'Refreshing lead history...' : 'No recent lead history matches this filter.'}
            />
          ) : (
            <Stack gap="sm">
              {historyItems.map((entry) => (
                <Card key={entry.id} withBorder radius="md" p="md">
                  <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700}>{entry.title}</Text>
                        <Badge size="xs" color={getStageColor(entry.stage)} variant="light">
                          {formatStageLabel(entry.stage)}
                        </Badge>
                        <Badge size="xs" color={getLifecycleColor(entry.lifecycleStatus)} variant="outline">
                          {formatLifecycleStatus(entry.lifecycleStatus)}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">{entry.summary}</Text>
                      <Group gap="xs" wrap="wrap">
                        <Text size="sm" fw={600}>{entry.companyName}</Text>
                        <Text size="xs" c="dimmed">•</Text>
                        <Text size="xs" c="dimmed">{entry.contactDisplayName}</Text>
                        <Text size="xs" c="dimmed">•</Text>
                        <Text size="xs" c="dimmed">{formatDateTime(entry.occurredAt)}</Text>
                        <Text size="xs" c="dimmed">•</Text>
                        <Text size="xs" c="dimmed">{formatHistoryActor(entry)}</Text>
                      </Group>
                    </Stack>
                    <Button component={Link} href={`/leads/${entry.leadId}`} variant="subtle" size="sm">
                      Open Record
                    </Button>
                  </Group>
                </Card>
              ))}
            </Stack>
          )}
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg" mt="xl">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={700}>Inactive Lead Records</Text>
              <Text size="sm" c="dimmed">
                Parked and closed leads remain visible for recovery, reporting, and duplicate-aware intake decisions.
              </Text>
            </Stack>
            <Badge color="dark" variant="light">
              {ownerFilter.length === 0 ? parkedTotal + closedTotal : filteredInactiveCount} inactive leads
            </Badge>
          </Group>

          <Tabs value={inactiveTab} onChange={(value) => setInactiveTab((value as InactiveTab) || 'parked')} variant="pills" radius="md">
            <Tabs.List>
              <Tabs.Tab value="parked" leftSection={<IconClock size={16} />}>
                Parked ({filteredParkedLeads.length})
              </Tabs.Tab>
              <Tabs.Tab value="closed" leftSection={<IconArchive size={16} />}>
                Closed ({filteredClosedLeads.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value={inactiveTab} pt="md">
              {inactiveItems.length === 0 ? (
                <EmptyState
                  icon={<IconArchive size={32} color="var(--mantine-color-dark-4)" />}
                  message={isLoading ? 'Refreshing inactive lead records...' : `No ${inactiveTab} leads match this filter.`}
                />
              ) : (
                <Stack gap="sm">
                  {inactiveItems.map((lead) => (
                    <Card key={lead.id} withBorder radius="md" p="md">
                      <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs" wrap="wrap">
                            <Text fw={700}>{lead.companyName}</Text>
                            <Badge size="xs" color={getLifecycleColor(lead.lifecycleStatus)} variant="filled">
                              {formatLifecycleStatus(lead.lifecycleStatus)}
                            </Badge>
                            <Badge size="xs" color={getStageColor(lead.stage)} variant="light">
                              {formatStageLabel(lead.stage)}
                            </Badge>
                          </Group>
                          <Text size="sm" c="dimmed">
                            {lead.lifecycleReasonNote
                              ? `${lead.lifecycleReasonCode ?? 'Reason'}: ${lead.lifecycleReasonNote}`
                              : lead.lifecycleReasonCode ?? 'Lifecycle reason recorded'}
                          </Text>
                          <Group gap="xs" wrap="wrap">
                            <Text size="xs" c="dimmed">{lead.contactDisplayName}</Text>
                            <Text size="xs" c="dimmed">•</Text>
                            <Text size="xs" c="dimmed">Assigned: {getLeadOwnerLabel(lead)}</Text>
                            <Text size="xs" c="dimmed">•</Text>
                            <Text size="xs" c="dimmed">Updated {formatDateTime(lead.updatedAt)}</Text>
                          </Group>
                        </Stack>
                        <Button component={Link} href={`/leads/${lead.id}`} variant="subtle" size="sm">
                          Open Record
                        </Button>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Paper>
    </Box>
  );
}

function MetricCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: ReactNode;
}) {
  return (
    <Card withBorder radius="md" p="sm" bg={`${color}.0`}>
      <Group justify="space-between">
        <Stack gap={0}>
          <Text size="xs" c="dimmed" fw={700}>{label}</Text>
          <Text size="xl" fw={800} c={color === 'gray' ? 'dark' : `${color}.7`}>{value}</Text>
        </Stack>
        <ThemeIcon color={color} variant="light" size="lg">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function EmptyState({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <Paper withBorder p="xl" radius="md" style={{ borderStyle: 'dashed' }} bg="transparent">
      <Stack align="center" gap="xs">
        {icon}
        <Text size="sm" c="dimmed">{message}</Text>
      </Stack>
    </Paper>
  );
}

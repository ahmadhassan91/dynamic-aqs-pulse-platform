'use client';

import { useEffect, useMemo, useState } from 'react';
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
  IconCheck,
  IconFlame,
  IconInfoCircle,
  IconListDetails,
  IconMail,
  IconPhone,
  IconSearch,
} from '@tabler/icons-react';
import type { LeadRoutingPolicySummary, LeadStageKey, LeadWorkflowQueueItem } from '@pulse/contracts';
import { fetchLeadRoutingPolicy, fetchLeadWorkflowQueue } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type WorkflowTab = 'all' | 'urgent' | 'stagnant';

const PAGE_SIZE_OPTIONS = ['10', '25', '50'] as const;
const STAGNANT_DAY_THRESHOLD = 7;

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

function getWorkflowOwners(items: LeadWorkflowQueueItem[]) {
  return [...new Set(items.flatMap((item) => [item.assignedTmName, item.leadOwnerName].filter(Boolean) as string[]))]
    .sort((left, right) => left.localeCompare(right));
}

export default function ActivityManager() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [queueItems, setQueueItems] = useState<LeadWorkflowQueueItem[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkflowTab>('all');
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
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadWorkflowData() {
      setIsLoading(true);
      setError(null);

      try {
        const [queueResponse, routingPolicyResponse] = await Promise.all([
          fetchLeadWorkflowQueue(apiBaseUrl, accessToken, {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            limit: 200,
          }),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setQueueItems(queueResponse.items);
        setRoutingPolicy(routingPolicyResponse);
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

  const ownerOptions = useMemo(() => getWorkflowOwners(queueItems), [queueItems]);

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
    () => workflowItems.filter((item) => item.daysInStage > STAGNANT_DAY_THRESHOLD),
    [workflowItems],
  );

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

  return (
    <Box>
      <Stack gap="md" mb="xl">
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />}>
          <Text size="sm" fw={600}>This queue reflects current lead activity.</Text>
          <Text size="xs" c="dimmed">
            It is built from each lead&apos;s live stage, 48-hour initial contact SLA, and next required action.
            {routingPolicy ? ` Routing is currently based on ${formatRoutingBasis(routingPolicy.routingBasis)}.` : ''}
          </Text>
        </Alert>

        {error ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <Card withBorder radius="md" p="sm" bg="blue.0">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={700}>OPEN ACTIONS</Text>
                <Text size="xl" fw={800}>{workflowItems.length}</Text>
              </Stack>
              <ThemeIcon color="blue" variant="light" size="lg">
                <IconListDetails size={20} />
              </ThemeIcon>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" bg={urgentItems.length > 0 ? 'orange.0' : 'gray.0'}>
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={700}>URGENT ACTIONS</Text>
                <Text size="xl" fw={800} c={urgentItems.length > 0 ? 'orange.7' : 'dark'}>{urgentItems.length}</Text>
              </Stack>
              <ThemeIcon color={urgentItems.length > 0 ? 'orange' : 'gray'} variant="light" size="lg">
                <IconFlame size={20} />
              </ThemeIcon>
            </Group>
          </Card>
          <Card withBorder radius="md" p="sm" bg={stagnantItems.length > 0 ? 'red.0' : 'green.0'}>
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xs" c="dimmed" fw={700}>STAGNANT (&gt;7d)</Text>
                <Text size="xl" fw={800} c={stagnantItems.length > 0 ? 'red.7' : 'green.7'}>{stagnantItems.length}</Text>
              </Stack>
              <ThemeIcon color={stagnantItems.length > 0 ? 'red' : 'green'} variant="light" size="lg">
                <IconAlertTriangle size={20} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            placeholder="Search companies, contacts, or queue actions..."
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
              <Paper withBorder p="xl" radius="md" style={{ borderStyle: 'dashed' }} bg="transparent">
                <Stack align="center" gap="xs">
                  <IconCheck size={32} color="var(--mantine-color-green-6)" />
                  <Text size="sm" c="dimmed">
                    {isLoading ? 'Refreshing workflow queue...' : 'All clear. No workflow items in this view.'}
                  </Text>
                </Stack>
              </Paper>
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
                          {item.daysInStage > STAGNANT_DAY_THRESHOLD ? (
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
    </Box>
  );
}

function formatRoutingBasis(value: LeadRoutingPolicySummary['routingBasis']) {
  return value === 'service_tech_count' ? 'service tech count' : 'truck count';
}

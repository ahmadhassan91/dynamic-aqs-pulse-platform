'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import type {
  TerritoryDashboardAlert,
  TerritoryDashboardCoverageSummary,
  TerritoryDashboardLifecycleSummary,
  TerritoryDashboardOwnerMetricSummary,
  TerritoryDashboardPipelineSummary,
  TerritoryDashboardQueueSummary,
  TerritoryDashboardRegionRollupSummary,
  TerritoryDashboardStats,
  TerritoryDashboardTrainingPenetrationSummary,
  TerritoryDashboardWorkload,
} from '@pulse/contracts';
import {
  Badge,
  Button,
  Group,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

type TerritoryDetailView = 'workload' | 'regions' | 'owners';

export type TerritoryNextWorkItem = {
  id: string;
  recordName: string;
  recordMeta: string;
  gapLabel: string;
  locationLabel: string;
  ownerLabel: string;
  tone: 'blue' | 'teal' | 'orange' | 'grape' | 'red';
  actions: ReactNode;
};

export function TerritoryCommandDashboard({
  stats,
  coverage,
  lifecycle,
  pipeline,
  trainingPenetration,
  alerts,
  workloads,
  queue,
  regionRollups,
  ownerMetrics,
  nextWorkItems,
  canManageTerritorySetup = false,
}: {
  stats: TerritoryDashboardStats;
  coverage: TerritoryDashboardCoverageSummary;
  lifecycle: TerritoryDashboardLifecycleSummary;
  pipeline: TerritoryDashboardPipelineSummary;
  trainingPenetration: TerritoryDashboardTrainingPenetrationSummary;
  alerts: TerritoryDashboardAlert[];
  workloads: TerritoryDashboardWorkload[];
  queue: TerritoryDashboardQueueSummary;
  regionRollups: TerritoryDashboardRegionRollupSummary[];
  ownerMetrics: TerritoryDashboardOwnerMetricSummary[];
  nextWorkItems: TerritoryNextWorkItem[];
  canManageTerritorySetup?: boolean;
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeDetailView, setActiveDetailView] = useState<TerritoryDetailView>('workload');
  const territoriesMissingManager = queue.territoriesMissingManager;
  const territoriesMissingShipping = queue.territoriesMissingShippingCenter;
  const regionsMissingDirector = queue.regionsMissingDirector;
  const hygieneIssues = canManageTerritorySetup ? territoriesMissingManager + territoriesMissingShipping + regionsMissingDirector : 0;
  const alertDetailByLabel = new Map(alerts.map((alert) => [alert.label, alert.detail]));
  const coveredAttentionLabels = new Set([
    'Unassigned active leads',
    'Unassigned active accounts',
    'Territories missing a Manager',
    'Territories missing a Shipping Center',
    'Regions missing a Director',
  ]);
  const additionalAlerts = alerts.filter((alert) => !coveredAttentionLabels.has(alert.label));
  const attentionItemCount = additionalAlerts.length + hygieneIssues + queue.unassignedLeads + queue.unassignedAccounts;
  const nextWorkTotal = queue.unassignedLeads + queue.unassignedAccounts;
  const hiddenNextWorkCount = Math.max(nextWorkTotal - nextWorkItems.length, 0);

  return (
    <Stack gap="lg">
      <Paper withBorder radius="xl" p="lg" data-testid="territory-action-queue">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Group gap="sm" align="flex-start">
              <ThemeIcon radius="xl" color={attentionItemCount > 0 ? 'orange' : 'teal'} variant="light">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
              <div>
                <Title order={3}>Territory Action Queue</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  {canManageTerritorySetup
                    ? 'Fix assignment gaps, territory hygiene, and unassigned work before reviewing performance.'
                    : 'Review scoped routing gaps and unassigned work before opening reports or maps.'}
                </Text>
              </div>
            </Group>
            <Badge color={attentionItemCount > 0 ? 'orange' : 'teal'} variant="light">
              {attentionItemCount} {attentionItemCount === 1 ? 'item' : 'items'}
            </Badge>
          </Group>

          {attentionItemCount === 0 ? (
            <Text size="sm" c="dimmed">
              Everything looks clean — no routing gaps, no unassigned work, no territory hygiene issues.
            </Text>
          ) : (
            <Stack gap="xs">
              {queue.unassignedLeads > 0 ? (
                <AttentionRow
                  label="Unassigned active leads"
                  detail={alertDetailByLabel.get('Unassigned active leads')}
                  value={queue.unassignedLeads}
                  tone="orange"
                />
              ) : null}
              {queue.unassignedAccounts > 0 ? (
                <AttentionRow
                  label="Unassigned active accounts"
                  detail={alertDetailByLabel.get('Unassigned active accounts')}
                  value={queue.unassignedAccounts}
                  tone="orange"
                />
              ) : null}
              {canManageTerritorySetup && territoriesMissingManager > 0 ? (
                <AttentionRow
                  label="Territories missing a Manager"
                  detail={alertDetailByLabel.get('Territories missing a Manager')}
                  value={territoriesMissingManager}
                  tone="orange"
                />
              ) : null}
              {canManageTerritorySetup && territoriesMissingShipping > 0 ? (
                <AttentionRow
                  label="Territories missing a Shipping Center"
                  detail={alertDetailByLabel.get('Territories missing a Shipping Center')}
                  value={territoriesMissingShipping}
                  tone="red"
                />
              ) : null}
              {canManageTerritorySetup && regionsMissingDirector > 0 ? (
                <AttentionRow
                  label="Regions missing a Director"
                  detail={alertDetailByLabel.get('Regions missing a Director')}
                  value={regionsMissingDirector}
                  tone="blue"
                />
              ) : null}
              {additionalAlerts.map((alert) => (
                <AttentionRow key={alert.label} label={alert.label} detail={alert.detail} tone={alert.tone} />
              ))}
            </Stack>
          )}

          {nextWorkItems.length > 0 ? (
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <div>
                  <Title order={4}>Next territory work</Title>
                  <Text size="sm" c="dimmed">
                    Open the record, assign territory, or review history without leaving the action queue first.
                  </Text>
                </div>
                <Badge color="orange" variant="light">
                  Showing {nextWorkItems.length} of {nextWorkTotal}
                </Badge>
              </Group>

              <Table.ScrollContainer minWidth={560}>
                <Table aria-label="Next territory work" striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Work item</Table.Th>
                      <Table.Th>Gap</Table.Th>
                      <Table.Th>State / territory</Table.Th>
                      <Table.Th>Owner / scope</Table.Th>
                      <Table.Th>Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {nextWorkItems.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text fw={700} lineClamp={1}>
                              {item.recordName}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={1}>
                              {item.recordMeta}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={item.tone} variant="light">
                            {item.gapLabel}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{item.locationLabel}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{item.ownerLabel}</Text>
                        </Table.Td>
                        <Table.Td>{item.actions}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>

              {hiddenNextWorkCount > 0 ? (
                <Text size="xs" c="dimmed">
                  {hiddenNextWorkCount} more assignment {hiddenNextWorkCount === 1 ? 'item is' : 'items are'} available from Work Queues.
                </Text>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper withBorder radius="xl" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>Performance details</Title>
              <Text size="sm" c="dimmed" mt={4}>
                Training, lifecycle, pipeline, territory, regional, and owner detail stay tucked away until leaders need the next layer.
              </Text>
            </div>
            <Button variant="light" size="xs" onClick={() => setIsDetailsOpen((current) => !current)}>
              {isDetailsOpen ? 'Hide Details' : 'Show Details'}
            </Button>
          </Group>

          {isDetailsOpen ? (
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, xl: 5 }} spacing="lg">
                <Paper withBorder radius="lg" p="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={5}>Lead routing posture</Title>
                      <Badge color="blue" variant="light">
                        Live data
                      </Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 2, xl: 2 }} spacing="sm">
                      <Metric label="Active Leads" value={stats.activeLeads} />
                      <Metric label="Unassigned" value={stats.unassignedLeads} tone={stats.unassignedLeads > 0 ? 'orange' : 'teal'} />
                      <Metric label="Strategic Growth" value={stats.strategicGrowthLeads} />
                      <Metric label="National TM" value={stats.nationalTmLeads} />
                    </SimpleGrid>

                    <Text size="sm" c={coverage.overdue90DayCount > 0 ? 'orange' : 'dimmed'}>
                      {coverage.overdue90DayCount} active accounts need a 90-day engagement review.
                    </Text>
                  </Stack>
                </Paper>

                <Paper withBorder radius="lg" p="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={5}>Engagement coverage</Title>
                      <Badge color={coverage.overdue90DayCount > 0 ? 'orange' : 'teal'} variant="light">
                        {coverage.overdue90DayCount} stale
                      </Badge>
                    </Group>

                    <Stack gap="sm">
                      <CoverageStat label="30-day" pct={coverage.engaged30DayPercent} threshold={75} />
                      <CoverageStat label="60-day" pct={coverage.engaged60DayPercent} threshold={85} />
                      <CoverageStat label="90-day" pct={coverage.engaged90DayPercent} threshold={90} />
                    </Stack>
                  </Stack>
                </Paper>

                <Paper withBorder radius="lg" p="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={5}>Training penetration</Title>
                      <Badge color="grape" variant="light">
                        CRM signal
                      </Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 2, md: 4, xl: 2 }} spacing="sm">
                      <Metric label="Total Accounts" value={trainingPenetration.totalAccounts} />
                      <Metric label="Trained Accounts" value={trainingPenetration.trainedAccounts} tone="teal" />
                      <Metric label="Active Programs" value={trainingPenetration.activeProgramsCount} tone="blue" />
                      <Metric label="Penetration %" value={trainingPenetration.penetrationPercent} tone={trainingPenetration.penetrationPercent >= 75 ? 'teal' : 'orange'} />
                    </SimpleGrid>
                  </Stack>
                </Paper>

                <Paper withBorder radius="lg" p="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={5}>Lifecycle posture</Title>
                      <Badge color="teal" variant="light">
                        Account mix
                      </Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 2, xl: 2 }} spacing="sm">
                      <Metric label="Active" value={lifecycle.activeAccountCount} tone="teal" />
                      <Metric label="At Risk" value={lifecycle.atRiskAccountCount} tone={lifecycle.atRiskAccountCount > 0 ? 'orange' : 'teal'} />
                      <Metric label="Inactive" value={lifecycle.inactiveAccountCount} tone={lifecycle.inactiveAccountCount > 0 ? 'grape' : 'teal'} />
                      <Metric label="Churned" value={lifecycle.churnedAccountCount} tone={lifecycle.churnedAccountCount > 0 ? 'red' : 'teal'} />
                    </SimpleGrid>
                  </Stack>
                </Paper>

                <Paper withBorder radius="lg" p="md">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={5}>Pipeline posture</Title>
                      <Badge color="blue" variant="light">
                        Lead phases
                      </Badge>
                    </Group>

                    <SimpleGrid cols={{ base: 2, xl: 2 }} spacing="sm">
                      <Metric label="New" value={pipeline.newLeadCount} tone="blue" />
                      <Metric label="Discovery" value={pipeline.discoveryLeadCount} tone="grape" />
                      <Metric label="CIS" value={pipeline.cisLeadCount} tone="orange" />
                      <Metric label="Onboarding" value={pipeline.onboardingLeadCount} tone="teal" />
                    </SimpleGrid>
                  </Stack>
                </Paper>
              </SimpleGrid>

              <Tabs
                value={activeDetailView}
                onChange={(value) => setActiveDetailView((value as TerritoryDetailView | null) ?? 'workload')}
                keepMounted={false}
              >
                <Group justify="space-between" align="center" mb="sm">
                  <Tabs.List>
                    <Tabs.Tab value="workload">Workload</Tabs.Tab>
                    <Tabs.Tab value="regions">Regions</Tabs.Tab>
                    <Tabs.Tab value="owners">Owners</Tabs.Tab>
                  </Tabs.List>
                  <Badge color="grape" variant="light">
                    Focused details
                  </Badge>
                </Group>

                <Tabs.Panel value="workload">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={5}>Territory workload snapshot</Title>
                      <Badge color="grape" variant="light">
                        Top territories
                      </Badge>
                    </Group>

                    <Table.ScrollContainer minWidth={640}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Territory</Table.Th>
                            <Table.Th>Ownership</Table.Th>
                            <Table.Th>Load</Table.Th>
                            <Table.Th>Signals</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {workloads.map((item) => (
                            <Table.Tr key={item.territoryId}>
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text fw={700}>{item.territoryName}</Text>
                                  <Text size="xs" c="dimmed">
                                    {item.territoryCode} · {item.regionName}
                                  </Text>
                                  <StateBadges states={item.coveredStates} />
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <DataLine label="TM" value={item.managerName ?? 'Unassigned'} tone={item.managerName ? 'gray' : 'orange'} />
                                  <DataLine label="RD" value={item.directorUserName ?? 'Unassigned'} tone={item.directorUserName ? 'gray' : 'orange'} />
                                  <DataLine label="Ship" value={item.shippingCenterName ?? 'Unassigned'} tone={item.shippingCenterName ? 'gray' : 'orange'} />
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Group gap={6}>
                                  <CompactCount label="Leads" value={item.activeLeadCount} tone="blue" />
                                  <CompactCount label="Accounts" value={item.activeAccountCount} tone="teal" />
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Group gap={6}>
                                    <CompactCount label="90d stale" value={item.overdue90DayAccountCount} tone={item.overdue90DayAccountCount > 0 ? 'orange' : 'teal'} />
                                    <CompactCount label="At risk" value={item.atRiskAccountCount} tone={item.atRiskAccountCount > 0 ? 'orange' : 'teal'} />
                                  </Group>
                                  <PipelineSummary
                                    newCount={item.newLeadCount}
                                    discoveryCount={item.discoveryLeadCount}
                                    cisCount={item.cisLeadCount}
                                    onboardingCount={item.onboardingLeadCount}
                                  />
                                </Stack>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="regions">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={5}>Regional rollups</Title>
                      <Badge color="blue" variant="light">
                        Director view
                      </Badge>
                    </Group>

                    <Table.ScrollContainer minWidth={640}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Region</Table.Th>
                            <Table.Th>Director</Table.Th>
                            <Table.Th>Territories</Table.Th>
                            <Table.Th>Attention</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {regionRollups.map((item) => (
                            <Table.Tr key={item.regionId}>
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text fw={700}>{item.regionName}</Text>
                                  <Text size="xs" c="dimmed">
                                    {item.regionCode} · {item.coveredStates} covered states · {item.shippingCenterCount} shipping hubs
                                  </Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{item.directorUserName ?? 'Unassigned'}</Table.Td>
                              <Table.Td>
                                <Group gap={6}>
                                  <CompactCount label="Terr." value={item.territoryCount} tone="blue" />
                                  <CompactCount label="Leads" value={item.activeLeadCount} tone="blue" />
                                  <CompactCount label="Accounts" value={item.activeAccountCount} tone="teal" />
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Group gap={6}>
                                    <CompactCount label="90d stale" value={item.overdue90DayAccountCount} tone={item.overdue90DayAccountCount > 0 ? 'orange' : 'teal'} />
                                    <CompactCount label="At risk" value={item.atRiskAccountCount} tone={item.atRiskAccountCount > 0 ? 'orange' : 'teal'} />
                                  </Group>
                                  <Group gap={6}>
                                    <CompactCount label="Missing TM" value={item.territoriesMissingManager} tone={item.territoriesMissingManager > 0 ? 'orange' : 'teal'} />
                                    <CompactCount label="Missing ship" value={item.territoriesMissingShippingCenter} tone={item.territoriesMissingShippingCenter > 0 ? 'orange' : 'teal'} />
                                  </Group>
                                </Stack>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                </Tabs.Panel>

                <Tabs.Panel value="owners">
                  <Stack gap="sm">
                    <Group justify="space-between">
                      <Title order={5}>Owner workload</Title>
                      <Badge color="grape" variant="light">
                        TM / RD rollups
                      </Badge>
                    </Group>

                    <Table.ScrollContainer minWidth={640}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Owner</Table.Th>
                            <Table.Th>Scope</Table.Th>
                            <Table.Th>Coverage</Table.Th>
                            <Table.Th>Attention</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {ownerMetrics.map((item) => (
                            <Table.Tr key={`${item.ownerRole}:${item.ownerUserId ?? item.ownerName}`}>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Text fw={700}>{item.ownerName}</Text>
                                  <Badge size="xs" variant="light" color={item.ownerRole === 'territory_manager' ? 'blue' : 'grape'}>
                                    {item.ownerRole === 'territory_manager' ? 'TM' : 'RD'}
                                  </Badge>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Group gap={6}>
                                    <CompactCount label="Regions" value={item.regionCount} tone="grape" />
                                    <CompactCount label="Terr." value={item.territoryCount} tone="blue" />
                                  </Group>
                                  <Text size="xs" c="dimmed">
                                    {item.activeLeadCount} leads · {item.activeAccountCount} accounts
                                  </Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Group gap={6}>
                                  <CompactCount label="30d" value={item.engaged30DayAccountCount} tone="teal" />
                                  <CompactCount label="90d" value={item.engaged90DayAccountCount} tone="teal" />
                                </Group>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <CompactCount label="Risk" value={item.atRiskAccountCount} tone={item.atRiskAccountCount > 0 ? 'orange' : 'teal'} />
                                  <Text size="xs" c="dimmed">
                                    {item.coveredStates} states · {item.shippingCenterCount} shipping hubs
                                  </Text>
                                </Stack>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

    </Stack>
  );
}

function Metric({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: number;
  tone?: 'blue' | 'teal' | 'orange' | 'grape' | 'red';
}) {
  return (
    <Paper withBorder radius="lg" p="md">
      <Text size="xs" fw={600} c="dimmed">
        {label}
      </Text>
      <Title order={4} c={tone}>
        {value}
      </Title>
    </Paper>
  );
}

type CompactTone = 'blue' | 'teal' | 'orange' | 'grape' | 'red' | 'gray';

function CompactCount({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: number;
  tone?: CompactTone;
}) {
  return (
    <Group gap={4} wrap="nowrap">
      <Badge color={tone} variant="light" size="sm">
        {value}
      </Badge>
      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
        {label}
      </Text>
    </Group>
  );
}

function DataLine({
  label,
  value,
  tone = 'gray',
}: {
  label: string;
  value: string;
  tone?: CompactTone;
}) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text size="xs" c="dimmed" w={32}>
        {label}
      </Text>
      <Badge color={tone} variant="light" size="sm" style={{ maxWidth: 180 }}>
        <Text span size="xs" lineClamp={1}>
          {value}
        </Text>
      </Badge>
    </Group>
  );
}

function StateBadges({ states }: { states: string[] }) {
  if (states.length === 0) {
    return (
      <Text size="xs" c="orange">
        No state coverage
      </Text>
    );
  }

  const visibleStates = states.slice(0, 4);
  const hiddenCount = states.length - visibleStates.length;

  return (
    <Group gap={4}>
      {visibleStates.map((state) => (
        <Badge key={state} size="xs" variant="light" color="blue">
          {state}
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Badge size="xs" variant="light" color="gray">
          +{hiddenCount}
        </Badge>
      ) : null}
    </Group>
  );
}

function PipelineSummary({
  newCount,
  discoveryCount,
  cisCount,
  onboardingCount,
}: {
  newCount: number;
  discoveryCount: number;
  cisCount: number;
  onboardingCount: number;
}) {
  return (
    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
      N {newCount} · D {discoveryCount} · CIS {cisCount} · O {onboardingCount}
    </Text>
  );
}

function CoverageStat({ label, pct, threshold }: { label: string; pct: number; threshold: number }) {
  const tone: 'teal' | 'orange' | 'red' = pct >= threshold ? 'teal' : pct < threshold / 2 ? 'red' : 'orange';
  return (
    <Stack gap={4} style={{ flex: 1, minWidth: 72 }}>
      <Group justify="space-between" gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="xs" fw={700} c={tone}>
          {pct}%
        </Text>
      </Group>
      <Progress value={Math.min(pct, 100)} color={tone} size="sm" radius="xl" />
      <Text size="10px" c="dimmed">
        Target {threshold}%
      </Text>
    </Stack>
  );
}

function AttentionRow({
  label,
  detail,
  value,
  tone = 'orange',
}: {
  label: string;
  detail?: string | undefined;
  value?: number | undefined;
  tone?: 'blue' | 'teal' | 'orange' | 'grape' | 'red';
}) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Stack gap={2}>
        <Text size="sm" fw={600}>
          {label}
        </Text>
        {detail ? (
          <Text size="xs" c="dimmed">
            {detail}
          </Text>
        ) : null}
      </Stack>
      {typeof value === 'number' ? (
        <Badge color={tone} variant="light" size="lg">
          {value}
        </Badge>
      ) : (
        <Badge color={tone} variant="light">
          Attention
        </Badge>
      )}
    </Group>
  );
}

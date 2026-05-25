'use client';

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
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

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
}) {
  const territoriesMissingManager = queue.territoriesMissingManager;
  const territoriesMissingShipping = queue.territoriesMissingShippingCenter;
  const regionsMissingDirector = queue.regionsMissingDirector;
  const hygieneIssues = territoriesMissingManager + territoriesMissingShipping + regionsMissingDirector;
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

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={3}>Lead routing posture</Title>
                <Text c="dimmed" size="sm" mt={4}>
                  Where new lead volume is sitting in territory ownership right now.
                </Text>
              </div>
              <Badge color="blue" variant="light">
                Live data
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Metric label="Active Leads" value={stats.activeLeads} />
              <Metric label="Unassigned" value={stats.unassignedLeads} tone={stats.unassignedLeads > 0 ? 'orange' : 'teal'} />
              <Metric label="Strategic Growth" value={stats.strategicGrowthLeads} />
              <Metric label="National TM" value={stats.nationalTmLeads} />
            </SimpleGrid>

            <Stack gap={6}>
              <Group justify="space-between">
                <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                  Customer engagement coverage
                </Text>
                <Text size="xs" c={coverage.overdue90DayCount > 0 ? 'orange' : 'dimmed'}>
                  {coverage.overdue90DayCount} accounts stale 90d+
                </Text>
              </Group>
              <Group gap="lg">
                <CoverageStat label="30-day" pct={coverage.engaged30DayPercent} threshold={75} />
                <CoverageStat label="60-day" pct={coverage.engaged60DayPercent} threshold={85} />
                <CoverageStat label="90-day" pct={coverage.engaged90DayPercent} threshold={90} />
              </Group>
            </Stack>
          </Stack>
        </Paper>

        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Group gap="sm">
                <ThemeIcon radius="xl" color={attentionItemCount > 0 ? 'orange' : 'teal'} variant="light">
                  <IconAlertTriangle size={18} />
                </ThemeIcon>
                <div>
                  <Title order={4}>Needs attention</Title>
                  <Text size="sm" c="dimmed">
                    Routing gaps, territory hygiene, and unassigned work in one place.
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
                {territoriesMissingManager > 0 ? (
                  <AttentionRow
                    label="Territories missing a Manager"
                    detail={alertDetailByLabel.get('Territories missing a Manager')}
                    value={territoriesMissingManager}
                    tone="orange"
                  />
                ) : null}
                {territoriesMissingShipping > 0 ? (
                  <AttentionRow
                    label="Territories missing a Shipping Center"
                    detail={alertDetailByLabel.get('Territories missing a Shipping Center')}
                    value={territoriesMissingShipping}
                    tone="red"
                  />
                ) : null}
                {regionsMissingDirector > 0 ? (
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
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Training penetration</Title>
            <Badge color="grape" variant="light">
              CRM-owned signal
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <Metric label="Total Accounts" value={trainingPenetration.totalAccounts} />
            <Metric label="Trained Accounts" value={trainingPenetration.trainedAccounts} tone="teal" />
            <Metric label="Active Programs" value={trainingPenetration.activeProgramsCount} tone="blue" />
            <Metric label="Penetration %" value={trainingPenetration.penetrationPercent} tone={trainingPenetration.penetrationPercent >= 75 ? 'teal' : 'orange'} />
          </SimpleGrid>

          <Text size="sm" c="dimmed">
            This gives RDs and territory leadership a clean answer to how much of the active account base has actually received training, using the CRM-owned training history instead of waiting on ERP reporting.
          </Text>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Lifecycle posture</Title>
              <Badge color="teal" variant="light">
                Account mix
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Metric label="Active" value={lifecycle.activeAccountCount} tone="teal" />
              <Metric label="At Risk" value={lifecycle.atRiskAccountCount} tone={lifecycle.atRiskAccountCount > 0 ? 'orange' : 'teal'} />
              <Metric label="Inactive" value={lifecycle.inactiveAccountCount} tone={lifecycle.inactiveAccountCount > 0 ? 'grape' : 'teal'} />
              <Metric label="Churned" value={lifecycle.churnedAccountCount} tone={lifecycle.churnedAccountCount > 0 ? 'red' : 'teal'} />
            </SimpleGrid>

            <Text size="sm" c="dimmed">
              This gives RDs and leadership a clean account-status posture from the CRM-owned lifecycle data, without pretending we already have ERP revenue truth in the territory kernel.
            </Text>
          </Stack>
        </Paper>

        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Pipeline posture</Title>
              <Badge color="blue" variant="light">
                Lead phases
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Metric label="New" value={pipeline.newLeadCount} tone="blue" />
              <Metric label="Discovery" value={pipeline.discoveryLeadCount} tone="grape" />
              <Metric label="CIS" value={pipeline.cisLeadCount} tone="orange" />
              <Metric label="Onboarding" value={pipeline.onboardingLeadCount} tone="teal" />
            </SimpleGrid>

            <Text size="sm" c="dimmed">
              Territory pipeline is grouped by real workflow phase so TMs and RDs can see where prospecting load is accumulating before first-order conversion.
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Territory workload snapshot</Title>
            <Badge color="grape" variant="light">
              Top territories
            </Badge>
          </Group>

          <Table.ScrollContainer minWidth={760}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Territory</Table.Th>
                  <Table.Th>Region</Table.Th>
                  <Table.Th>Manager</Table.Th>
                  <Table.Th>Shipping</Table.Th>
                  <Table.Th>States</Table.Th>
                  <Table.Th>Leads</Table.Th>
                  <Table.Th>Accounts</Table.Th>
                  <Table.Th>30d Coverage</Table.Th>
                  <Table.Th>90d Stale</Table.Th>
                  <Table.Th>At Risk</Table.Th>
                  <Table.Th>Pipeline</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {workloads.map((item) => (
                  <Table.Tr key={item.territoryId}>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text fw={700}>{item.territoryName}</Text>
                        <Text size="xs" c="dimmed">
                          {item.territoryCode}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>{item.regionName}</Table.Td>
                    <Table.Td>{item.managerName ?? 'Unassigned'}</Table.Td>
                    <Table.Td>{item.shippingCenterName ?? 'Unassigned'}</Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        {item.coveredStates.length > 0 ? item.coveredStates.map((state) => (
                          <Badge key={state} size="xs" variant="light" color="blue">
                            {state}
                          </Badge>
                        )) : <Text size="sm" c="dimmed">No coverage</Text>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{item.activeLeadCount}</Table.Td>
                    <Table.Td>{item.activeAccountCount}</Table.Td>
                    <Table.Td>{item.engaged30DayAccountCount}</Table.Td>
                    <Table.Td>{item.overdue90DayAccountCount}</Table.Td>
                    <Table.Td>{item.atRiskAccountCount}</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        N {item.newLeadCount} · D {item.discoveryLeadCount} · C {item.cisLeadCount} · O {item.onboardingLeadCount}
                      </Text>
                    </Table.Td>
                    <Table.Td>{item.totalWorkloadCount}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Regional rollups</Title>
              <Badge color="blue" variant="light">
                Director view
              </Badge>
            </Group>

            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Region</Table.Th>
                    <Table.Th>Director</Table.Th>
                  <Table.Th>Territories</Table.Th>
                  <Table.Th>Leads</Table.Th>
                  <Table.Th>Accounts</Table.Th>
                  <Table.Th>30d Coverage</Table.Th>
                  <Table.Th>At Risk</Table.Th>
                  <Table.Th>Pipeline</Table.Th>
                  <Table.Th>Coverage</Table.Th>
                </Table.Tr>
              </Table.Thead>
                <Table.Tbody>
                  {regionRollups.map((item) => (
                    <Table.Tr key={item.regionId}>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text fw={700}>{item.regionName}</Text>
                          <Text size="xs" c="dimmed">
                            {item.regionCode}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>{item.directorUserName ?? 'Unassigned'}</Table.Td>
                      <Table.Td>{item.territoryCount}</Table.Td>
                      <Table.Td>{item.activeLeadCount}</Table.Td>
                      <Table.Td>{item.activeAccountCount}</Table.Td>
                      <Table.Td>{item.engaged30DayAccountCount}</Table.Td>
                      <Table.Td>{item.atRiskAccountCount}</Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          N {item.newLeadCount} · D {item.discoveryLeadCount} · C {item.cisLeadCount} · O {item.onboardingLeadCount}
                        </Text>
                      </Table.Td>
                      <Table.Td>{item.coveredStates} states</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Paper>

        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Owner coverage</Title>
              <Badge color="grape" variant="light">
                TM / RD rollups
              </Badge>
            </Group>

            <Table.ScrollContainer minWidth={720}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th>Role</Table.Th>
                  <Table.Th>Territories</Table.Th>
                  <Table.Th>Leads</Table.Th>
                  <Table.Th>Accounts</Table.Th>
                  <Table.Th>30d Coverage</Table.Th>
                  <Table.Th>90d Coverage</Table.Th>
                  <Table.Th>At Risk</Table.Th>
                  <Table.Th>Coverage</Table.Th>
                </Table.Tr>
              </Table.Thead>
                <Table.Tbody>
                  {ownerMetrics.map((item) => (
                    <Table.Tr key={`${item.ownerRole}:${item.ownerUserId ?? item.ownerName}`}>
                      <Table.Td>{item.ownerName}</Table.Td>
                      <Table.Td>{item.ownerRole === 'territory_manager' ? 'TM' : 'RD'}</Table.Td>
                      <Table.Td>{item.territoryCount}</Table.Td>
                      <Table.Td>{item.activeLeadCount}</Table.Td>
                      <Table.Td>{item.activeAccountCount}</Table.Td>
                      <Table.Td>{item.engaged30DayAccountCount}</Table.Td>
                      <Table.Td>{item.engaged90DayAccountCount}</Table.Td>
                      <Table.Td>{item.atRiskAccountCount}</Table.Td>
                      <Table.Td>{item.coveredStates} states</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Stack>
        </Paper>
      </SimpleGrid>

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

function CoverageStat({ label, pct, threshold }: { label: string; pct: number; threshold: number }) {
  const tone: 'teal' | 'orange' = pct >= threshold ? 'teal' : 'orange';
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Group gap={6} align="baseline">
        <Title order={4} c={tone}>
          {pct}
        </Title>
        <Text size="xs" c="dimmed">
          %
        </Text>
      </Group>
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

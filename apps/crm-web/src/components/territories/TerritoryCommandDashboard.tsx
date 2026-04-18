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
  TerritoryDashboardWorkload,
} from '@pulse/contracts';
import {
  Badge,
  Card,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBuildingWarehouse,
  IconMapPin,
  IconRouteSquare,
  IconUsers,
} from '@tabler/icons-react';

export function TerritoryCommandDashboard({
  stats,
  coverage,
  lifecycle,
  pipeline,
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
  alerts: TerritoryDashboardAlert[];
  workloads: TerritoryDashboardWorkload[];
  queue: TerritoryDashboardQueueSummary;
  regionRollups: TerritoryDashboardRegionRollupSummary[];
  ownerMetrics: TerritoryDashboardOwnerMetricSummary[];
}) {
  const cards = [
    { label: 'Regions', value: stats.regions, icon: IconMapPin, color: 'blue' },
    { label: 'Territories', value: stats.territories, icon: IconRouteSquare, color: 'grape' },
    { label: 'Covered States', value: stats.coveredStates, icon: IconUsers, color: 'teal' },
    { label: 'Shipping Centers', value: stats.shippingCenters, icon: IconBuildingWarehouse, color: 'orange' },
  ];

  return (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        {cards.map((card) => (
          <Card key={card.label} withBorder radius="xl" p="lg" className="premium-stat-card">
            <Group gap="xs" mb={6}>
              <ThemeIcon variant="light" color={card.color} radius="sm" size="sm">
                <card.icon size={14} />
              </ThemeIcon>
              <Text size="xs" c="dimmed" fw={600}>
                {card.label}
              </Text>
            </Group>
            <Title order={3}>{card.value}</Title>
          </Card>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={3}>Territory command dashboard</Title>
                <Text c="dimmed" size="sm" mt={4}>
                  Live operational coverage for regions, territories, shipping centers, and lead routing ownership.
                </Text>
              </div>
              <Badge color="blue" variant="light">
                Live data
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Metric label="Active Leads" value={stats.activeLeads} />
              <Metric label="Assigned" value={stats.assignedLeads} />
              <Metric label="Unassigned" value={stats.unassignedLeads} tone={stats.unassignedLeads > 0 ? 'orange' : 'teal'} />
              <Metric label="National TM" value={stats.nationalTmLeads} />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Metric label="Strategic Growth" value={stats.strategicGrowthLeads} />
              <Metric label="Coverage Gaps" value={alerts.length} tone={alerts.length > 0 ? 'orange' : 'teal'} />
              <Metric label="Territories w/ Manager" value={workloads.filter((item) => item.managerName).length} />
              <Metric label="Territories w/ Shipping" value={workloads.filter((item) => item.shippingCenterName).length} />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
              <Metric label="30 Day Coverage %" value={coverage.engaged30DayPercent} tone={coverage.engaged30DayPercent >= 75 ? 'teal' : 'orange'} />
              <Metric label="60 Day Coverage %" value={coverage.engaged60DayPercent} tone={coverage.engaged60DayPercent >= 85 ? 'teal' : 'orange'} />
              <Metric label="90 Day Coverage %" value={coverage.engaged90DayPercent} tone={coverage.engaged90DayPercent >= 90 ? 'teal' : 'orange'} />
              <Metric label="90 Day Stale" value={coverage.overdue90DayCount} tone={coverage.overdue90DayCount > 0 ? 'red' : 'teal'} />
            </SimpleGrid>
          </Stack>
        </Paper>

        <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
          <Stack gap="md">
            <Group gap="sm">
              <ThemeIcon radius="xl" color="orange" variant="light">
                <IconAlertTriangle size={18} />
              </ThemeIcon>
              <div>
                <Title order={4}>Operational signals</Title>
                <Text size="sm" c="dimmed">
                  The territory kernel is live. These signals show where human cleanup is still needed.
                </Text>
              </div>
            </Group>

            {alerts.length > 0 ? (
              <Stack gap="sm">
                {alerts.map((alert) => (
                  <Paper key={alert.label} withBorder radius="lg" p="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={700}>{alert.label}</Text>
                        <Text size="sm" c="dimmed" mt={4}>
                          {alert.detail}
                        </Text>
                      </div>
                      <Badge color={alert.tone} variant="light">
                        Attention
                      </Badge>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                No coverage gaps detected in the current CRM-owned territory dataset.
              </Text>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>

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

      <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Operational queue</Title>
            <Badge color={queue.unassignedLeads + queue.unassignedAccounts > 0 ? 'orange' : 'teal'} variant="light">
              Actionable now
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <Metric label="Unassigned Leads" value={queue.unassignedLeads} tone={queue.unassignedLeads > 0 ? 'orange' : 'teal'} />
            <Metric label="Unassigned Accounts" value={queue.unassignedAccounts} tone={queue.unassignedAccounts > 0 ? 'orange' : 'teal'} />
            <Metric label="SG Leads" value={queue.strategicGrowthLeads} tone="blue" />
            <Metric label="National TM Leads" value={queue.nationalTmLeads} tone="blue" />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            <Metric label="Territories Missing TM" value={queue.territoriesMissingManager} tone={queue.territoriesMissingManager > 0 ? 'orange' : 'teal'} />
            <Metric label="Territories Missing Shipping" value={queue.territoriesMissingShippingCenter} tone={queue.territoriesMissingShippingCenter > 0 ? 'red' : 'teal'} />
            <Metric label="Regions Missing RD" value={queue.regionsMissingDirector} tone={queue.regionsMissingDirector > 0 ? 'blue' : 'teal'} />
          </SimpleGrid>
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

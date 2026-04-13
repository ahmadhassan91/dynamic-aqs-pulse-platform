'use client';

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

export type TerritoryDashboardStats = {
  regions: number;
  territories: number;
  coveredStates: number;
  shippingCenters: number;
  activeLeads: number;
  assignedLeads: number;
  unassignedLeads: number;
  strategicGrowthLeads: number;
  nationalTmLeads: number;
};

export type TerritoryDashboardAlert = {
  label: string;
  detail: string;
  tone: 'orange' | 'red' | 'blue';
};

export type TerritoryDashboardWorkload = {
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  regionName: string;
  managerName?: string;
  shippingCenterName?: string;
  coveredStates: string[];
  leadCount: number;
};

export function TerritoryCommandDashboard({
  stats,
  alerts,
  workloads,
}: {
  stats: TerritoryDashboardStats;
  alerts: TerritoryDashboardAlert[];
  workloads: TerritoryDashboardWorkload[];
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
                    <Table.Td>{item.leadCount}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
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
  tone?: 'blue' | 'teal' | 'orange' | 'grape';
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

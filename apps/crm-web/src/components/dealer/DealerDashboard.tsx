'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { DealerPortalDashboardResponse } from '@pulse/contracts';
import { IconBuildingStore, IconMapPin, IconShieldCheck, IconUsers } from '@tabler/icons-react';

export function DealerDashboard({ dashboard }: { dashboard: DealerPortalDashboardResponse }) {
  const primaryContact = dashboard.contacts.find((contact) => contact.isPrimary) ?? dashboard.contacts[0] ?? null;
  const primaryLocation = dashboard.locations.find((location) => location.isPrimary) ?? dashboard.locations[0] ?? null;

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Dealer Portal</Text>
            <Title order={1}>Dealer dashboard</Title>
            <Text c="dimmed" maw={760}>
              Work from the same Pulse dealer experience the team approved, but with real portal provisioning,
              company user access, contact visibility, and territory context from the production backend.
            </Text>
            <Group gap="xs">
              <Badge size="lg" color={statusColor(dashboard.portalAccount.status)} variant="light">
                {dashboard.portalAccount.status.replace(/_/g, ' ')}
              </Badge>
              <Badge size="lg" color="blue" variant="light">
                {dashboard.portalAccount.portalEligibilityStatus ?? 'unassessed'}
              </Badge>
            </Group>
          </Stack>
          <Group gap="sm">
            <Button component={Link} href="/dealer/account" variant="light">
              Open Account Center
            </Button>
          </Group>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
        <MetricCard
          icon={<IconUsers size={22} />}
          label="Portal Users"
          value={String(dashboard.portalAccount.activePortalUsers)}
          detail={`${dashboard.portalAccount.totalPortalUsers} total provisioned users`}
        />
        <MetricCard
          icon={<IconBuildingStore size={22} />}
          label="Contacts"
          value={String(dashboard.contacts.length)}
          detail={primaryContact ? `Primary: ${primaryContact.displayName}` : 'No contact published yet'}
        />
        <MetricCard
          icon={<IconMapPin size={22} />}
          label="Locations"
          value={String(dashboard.locations.length)}
          detail={primaryLocation ? `Primary: ${primaryLocation.name}` : 'No location published yet'}
        />
        <MetricCard
          icon={<IconShieldCheck size={22} />}
          label="Territory"
          value={dashboard.portalAccount.territoryName ?? 'Pending'}
          detail={dashboard.portalAccount.assignedTmName ?? 'TM not assigned'}
        />
      </SimpleGrid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Company Access Directory</Title>
              <Text size="sm" c="dimmed">
                These are the live dealer portal users provisioned from the Pulse CRM account record.
              </Text>
              {dashboard.companyUsers.length === 0 ? (
                <Alert color="blue" variant="light">
                  Dynamic AQS has not provisioned any active dealer portal users yet.
                </Alert>
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing="sm">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>User</Table.Th>
                        <Table.Th>Email</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Primary Owner</Table.Th>
                        <Table.Th>Last Login</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {dashboard.companyUsers.map((user) => (
                        <Table.Tr key={user.id}>
                          <Table.Td>{user.displayName}</Table.Td>
                          <Table.Td>{user.email}</Table.Td>
                          <Table.Td>
                            <Badge size="sm" color={statusColor(user.status)} variant="light">
                              {user.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{user.isPrimaryOwner ? 'Yes' : 'No'}</Table.Td>
                          <Table.Td>{formatDateTime(user.lastLoginAt)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
            <Stack gap="md">
              <Title order={3}>Account Context</Title>
              <MetadataRow label="Account" value={dashboard.portalAccount.accountDisplayName} />
              <MetadataRow label="Account Number" value={dashboard.portalAccount.accountNumber ?? 'Pending assignment'} />
              <MetadataRow label="Region" value={dashboard.portalAccount.regionName ?? 'Not assigned'} />
              <MetadataRow label="Territory" value={dashboard.portalAccount.territoryName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={dashboard.portalAccount.shippingCenterName ?? 'Not assigned'} />
              <MetadataRow label="TM" value={dashboard.portalAccount.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="RD" value={dashboard.portalAccount.assignedRdName ?? 'Not assigned'} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Contact Directory</Title>
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Contact</Table.Th>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Primary</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.contacts.map((contact) => (
                      <Table.Tr key={contact.id}>
                        <Table.Td>{contact.displayName}</Table.Td>
                        <Table.Td>{contact.title ?? '—'}</Table.Td>
                        <Table.Td>{contact.email ?? '—'}</Table.Td>
                        <Table.Td>{contact.isPrimary ? 'Yes' : 'No'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Location Directory</Title>
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Location</Table.Th>
                      <Table.Th>City</Table.Th>
                      <Table.Th>State</Table.Th>
                      <Table.Th>Primary</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.locations.map((location) => (
                      <Table.Tr key={location.id}>
                        <Table.Td>{location.name}</Table.Td>
                        <Table.Td>{location.city ?? '—'}</Table.Td>
                        <Table.Td>{location.state ?? '—'}</Table.Td>
                        <Table.Td>{location.isPrimary ? 'Yes' : 'No'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card withBorder radius="xl" p="lg" className="premium-stat-card">
      <Stack gap={8}>
        <Group justify="space-between" align="flex-start">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {label}
          </Text>
          <Text c="blue">{icon}</Text>
        </Group>
        <Title order={2}>{value}</Title>
        <Text size="sm" c="dimmed">
          {detail}
        </Text>
      </Stack>
    </Card>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} ta="right" maw={260}>
        {value}
      </Text>
    </Group>
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Never';
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function statusColor(status: string) {
  if (status === 'active') {
    return 'green';
  }

  if (status === 'ready_to_provision') {
    return 'blue';
  }

  if (status === 'suspended') {
    return 'orange';
  }

  if (status === 'deactivated') {
    return 'red';
  }

  return 'gray';
}

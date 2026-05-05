'use client';

import Link from 'next/link';
import { Badge, Button, Card, Grid, Group, Stack, Table, Text, Title } from '@mantine/core';
import type { DealerPortalDashboardResponse } from '@pulse/contracts';

export function DealerAccountCenter({ dashboard }: { dashboard: DealerPortalDashboardResponse }) {
  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Dealer Portal</Text>
            <Title order={1}>Account center</Title>
            <Text c="dimmed" maw={760}>
              Review the live company profile, portal users, contacts, and locations that Dynamic AQS has provisioned
              from the CRM account record.
            </Text>
          </Stack>
          <Button component={Link} href="/dealer/dashboard" variant="default">
            Back To Dashboard
          </Button>
        </Group>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="sm">
              <Title order={3}>Portal Provisioning</Title>
              <MetadataRow label="Status" value={dashboard.portalAccount.status.replace(/_/g, ' ')} badgeColor={statusColor(dashboard.portalAccount.status)} />
              <MetadataRow label="Eligibility" value={dashboard.portalAccount.portalEligibilityStatus ?? 'unassessed'} />
              <MetadataRow label="Provisioned At" value={formatDateTime(dashboard.portalAccount.provisionedAt)} />
              <MetadataRow label="Source Lead" value={dashboard.portalAccount.sourceLeadId ?? 'Not linked'} />
              <MetadataRow label="Notes" value={dashboard.portalAccount.notes ?? 'No setup notes added yet'} />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
            <Stack gap="sm">
              <Title order={3}>Ownership Context</Title>
              <MetadataRow label="Territory" value={dashboard.portalAccount.territoryName ?? 'Not assigned'} />
              <MetadataRow label="Region" value={dashboard.portalAccount.regionName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={dashboard.portalAccount.shippingCenterName ?? 'Not assigned'} />
              <MetadataRow label="Territory Manager" value={dashboard.portalAccount.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="Regional Director" value={dashboard.portalAccount.assignedRdName ?? 'Not assigned'} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder radius="xl" p="lg" className="premium-detail-card">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Portal User Access</Title>
            <Badge size="lg" color="blue" variant="light">
              {dashboard.companyUsers.length} user{dashboard.companyUsers.length === 1 ? '' : 's'}
            </Badge>
          </Group>
          <Table.ScrollContainer minWidth={700}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Email</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Primary Owner</Table.Th>
                  <Table.Th>Activated</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dashboard.companyUsers.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>{user.displayName}</Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>{user.title ?? '—'}</Table.Td>
                    <Table.Td>{formatAccessRole(user.accessRole)}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={statusColor(user.status)} variant="light">
                        {user.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{user.isPrimaryOwner ? 'Yes' : 'No'}</Table.Td>
                    <Table.Td>{formatDateTime(user.activatedAt)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Stack>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Company Contacts</Title>
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Title</Table.Th>
                      <Table.Th>Email</Table.Th>
                      <Table.Th>Phone</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.contacts.map((contact) => (
                      <Table.Tr key={contact.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text>{contact.displayName}</Text>
                            {contact.isPrimary ? (
                              <Badge size="xs" color="green" variant="light">
                                Primary
                              </Badge>
                            ) : null}
                          </Group>
                        </Table.Td>
                        <Table.Td>{contact.title ?? '—'}</Table.Td>
                        <Table.Td>{contact.email ?? '—'}</Table.Td>
                        <Table.Td>{contact.phone ?? '—'}</Table.Td>
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
              <Title order={3}>Company Locations</Title>
              <Table.ScrollContainer minWidth={520}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Location</Table.Th>
                      <Table.Th>City</Table.Th>
                      <Table.Th>State</Table.Th>
                      <Table.Th>Country</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {dashboard.locations.map((location) => (
                      <Table.Tr key={location.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text>{location.name}</Text>
                            {location.isPrimary ? (
                              <Badge size="xs" color="blue" variant="light">
                                Primary
                              </Badge>
                            ) : null}
                          </Group>
                        </Table.Td>
                        <Table.Td>{location.city ?? '—'}</Table.Td>
                        <Table.Td>{location.state ?? '—'}</Table.Td>
                        <Table.Td>{location.countryCode ?? '—'}</Table.Td>
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

function formatAccessRole(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MetadataRow({
  label,
  value,
  badgeColor,
}: {
  label: string;
  value: string;
  badgeColor?: string;
}) {
  return (
    <Group justify="space-between" align="flex-start">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      {badgeColor ? (
        <Badge color={badgeColor} variant="light">
          {value}
        </Badge>
      ) : (
        <Text size="sm" fw={500} ta="right" maw={280}>
          {value}
        </Text>
      )}
    </Group>
  );
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Not recorded';
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

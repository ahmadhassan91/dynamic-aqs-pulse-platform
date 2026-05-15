'use client';

import Link from 'next/link';
import { Alert, Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { DealerPortalAccessRoleKey, DealerPortalDashboardResponse } from '@pulse/contracts';

export function DealerAccountCenter({ dashboard }: { dashboard: DealerPortalDashboardResponse }) {
  const roleProfile = getRoleProfile(dashboard.currentUser.accessRole);
  const isViewer = dashboard.currentUser.accessRole === 'viewer';

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Dealer Portal</Text>
            <Title order={1}>Account center</Title>
            <Text c="dimmed" maw={760}>
              Review your company profile, portal users, contacts, and locations.
            </Text>
            <Group gap="xs">
              <Badge size="lg" color={roleProfile.color} variant="light">
                {roleProfile.label}
              </Badge>
              {isViewer ? (
                <Badge size="lg" color="gray" variant="outline">
                  Read-only
                </Badge>
              ) : null}
            </Group>
          </Stack>
          <Button component={Link} href="/dealer/dashboard" variant="default">
            Back To Dashboard
          </Button>
        </Group>
      </Card>

      <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="eyebrow">Portal Role</Text>
              <Title order={3}>{roleProfile.label}</Title>
            </Stack>
            <Badge color={roleProfile.color} variant="light">
              {roleProfile.badge}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {roleProfile.description}
          </Text>
          <Text size="sm" fw={600}>
            {roleProfile.accountCenterFocus}
          </Text>
        </Stack>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="sm">
              <Title order={3}>Portal Access</Title>
              <MetadataRow label="Status" value={dashboard.portalAccount.status.replace(/_/g, ' ')} badgeColor={statusColor(dashboard.portalAccount.status)} />
              <MetadataRow label="Eligibility" value={dashboard.portalAccount.portalEligibilityStatus ?? 'unassessed'} />
              <MetadataRow label="Set Up At" value={formatDateTime(dashboard.portalAccount.provisionedAt)} />
              <MetadataRow label="Notes" value={dashboard.portalAccount.notes ?? 'No setup notes added yet'} />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
            <Stack gap="sm">
              <Title order={3}>Dynamic AQS Account Team</Title>
              <MetadataRow label="Territory" value={dashboard.portalAccount.territoryName ?? 'Not assigned'} />
              <MetadataRow label="Region" value={dashboard.portalAccount.regionName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={dashboard.portalAccount.shippingCenterName ?? 'Not assigned'} />
              <MetadataRow label="Territory Manager" value={dashboard.portalAccount.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="Regional Director" value={dashboard.portalAccount.assignedRdName ?? 'Not assigned'} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card id="account-health" withBorder radius="xl" p="lg" className="premium-detail-card">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="eyebrow">Account Health</Text>
              <Title order={3}>Connection status</Title>
            </Stack>
            <Badge size="lg" color="orange" variant="light">
              Not connected yet
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" maw={760}>
            Account Health will show payment terms, credit status, invoices, orders, and payment values after the
            approved finance connection is live.
          </Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <AccountHealthRow label="Payment terms" value="Not connected yet" />
            <AccountHealthRow label="Credit status" value="Not connected yet" />
            <AccountHealthRow label="Billing address changes" value="Locked, contact Dynamic AQS" />
            <AccountHealthRow label="Orders, invoices, and payments" value="Coming after finance connection" />
          </SimpleGrid>
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg" className="premium-detail-card">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={3}>Portal User Access</Title>
            <Badge size="lg" color="blue" variant="light">
              {dashboard.companyUsers.length} user{dashboard.companyUsers.length === 1 ? '' : 's'}
            </Badge>
          </Group>
          {dashboard.companyUsers.length === 0 ? (
            <Alert color="blue" variant="light">
              No portal users have been set up for this account yet.
            </Alert>
          ) : (
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
          )}
        </Stack>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Company Contacts</Title>
              {dashboard.contacts.length === 0 ? (
                <Alert color="blue" variant="light">
                  No contacts have been published for this account yet.
                </Alert>
              ) : (
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
              )}
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Company Locations</Title>
              {dashboard.locations.length === 0 ? (
                <Alert color="blue" variant="light">
                  No locations have been published for this account yet.
                </Alert>
              ) : (
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
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

type RoleProfile = {
  label: string;
  badge: string;
  color: string;
  description: string;
  accountCenterFocus: string;
};

function getRoleProfile(role: DealerPortalAccessRoleKey): RoleProfile {
  const profiles: Record<DealerPortalAccessRoleKey, RoleProfile> = {
    admin: {
      label: 'Admin',
      badge: 'User access',
      color: 'blue',
      description: 'Admins use the Account Center to review who can access the dealer portal.',
      accountCenterFocus: 'The portal user access directory is the primary admin surface on this page.',
    },
    purchasing: {
      label: 'Purchasing',
      badge: 'Products and files',
      color: 'green',
      description: 'Purchasing users can review company context here and move back to Products & Files for published catalog materials.',
      accountCenterFocus: 'Future purchasing readiness is visible, but cart and order workflows are not active.',
    },
    accounting: {
      label: 'Accounting',
      badge: 'Account health',
      color: 'orange',
      description: 'Accounting users can inspect Account Health sync status without seeing placeholder finance values.',
      accountCenterFocus: 'Account Health stays clear about which finance details are not connected yet.',
    },
    viewer: {
      label: 'Viewer',
      badge: 'Read-only',
      color: 'gray',
      description: 'Viewers can review company, access, contact, and location details as a read-only reference.',
      accountCenterFocus: 'This role cannot manage users, billing changes, orders, invoices, or payments in the portal.',
    },
  };

  return profiles[role];
}

function formatAccessRole(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function AccountHealthRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      p="md"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
      }}
    >
      <Group justify="space-between" align="flex-start" gap="md">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={700} ta="right" maw={280}>
          {value}
        </Text>
      </Group>
    </Box>
  );
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

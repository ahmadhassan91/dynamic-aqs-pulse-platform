'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Badge, Box, Button, Card, Grid, Group, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import type { DealerPortalAccessRoleKey, DealerPortalDashboardResponse } from '@pulse/contracts';
import { IconBuildingStore, IconCreditCard, IconFileText, IconMapPin, IconShieldCheck, IconUsers } from '@tabler/icons-react';

export function DealerDashboard({ dashboard }: { dashboard: DealerPortalDashboardResponse }) {
  const primaryContact = dashboard.contacts.find((contact) => contact.isPrimary) ?? dashboard.contacts[0] ?? null;
  const primaryLocation = dashboard.locations.find((location) => location.isPrimary) ?? dashboard.locations[0] ?? null;
  const roleProfile = getRoleProfile(dashboard.currentUser.accessRole);
  const canPromoteAccessDirectory = dashboard.currentUser.accessRole === 'admin';
  const canPromoteCatalog = dashboard.currentUser.accessRole === 'purchasing';
  const canPromoteAccountHealth = dashboard.currentUser.accessRole === 'accounting';
  const isViewer = dashboard.currentUser.accessRole === 'viewer';

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
              <Badge size="lg" color={roleProfile.color} variant="light">
                {roleProfile.label}
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
        <Grid.Col span={{ base: 12, lg: 5 }}>
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
                {roleProfile.priority}
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Title order={3}>{roleProfile.sectionTitle}</Title>
                  <Text size="sm" c="dimmed">
                    {roleProfile.sectionDetail}
                  </Text>
                </Stack>
                {roleProfile.link ? (
                  <Button component={Link} href={roleProfile.link.href} variant={roleProfile.link.variant}>
                    {roleProfile.link.label}
                  </Button>
                ) : null}
              </Group>

              {canPromoteAccessDirectory ? (
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  <RoleCallout label="Active users" value={String(dashboard.portalAccount.activePortalUsers)} />
                  <RoleCallout label="Total provisioned" value={String(dashboard.portalAccount.totalPortalUsers)} />
                  <RoleCallout
                    label="Primary owners"
                    value={String(dashboard.companyUsers.filter((user) => user.isPrimaryOwner).length)}
                  />
                </SimpleGrid>
              ) : null}

              {canPromoteCatalog ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <RoleCallout icon={<IconFileText size={18} />} label="Product files" value="Dealer-safe catalog access" />
                  <RoleCallout icon={<IconBuildingStore size={18} />} label="Purchasing readiness" value="ERP commerce gate pending" />
                </SimpleGrid>
              ) : null}

              {canPromoteAccountHealth ? (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  <RoleCallout icon={<IconCreditCard size={18} />} label="Payment terms" value="Pending ERP sync" />
                  <RoleCallout icon={<IconShieldCheck size={18} />} label="Credit status" value="Pending ERP sync" />
                </SimpleGrid>
              ) : null}

              {isViewer ? (
                <Alert color="gray" variant="light">
                  Viewer access is read-only. You can inspect published company, location, contact, and catalog
                  information, but portal administration and finance changes stay with Dynamic AQS.
                </Alert>
              ) : null}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

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
                        <Table.Th>Role</Table.Th>
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
                          <Table.Td>{formatAccessRole(user.accessRole)}</Table.Td>
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

type RoleProfile = {
  label: string;
  badge: string;
  color: string;
  description: string;
  priority: string;
  sectionTitle: string;
  sectionDetail: string;
  link?: {
    href: string;
    label: string;
    variant: 'filled' | 'light' | 'default';
  };
};

function getRoleProfile(role: DealerPortalAccessRoleKey): RoleProfile {
  const profiles: Record<DealerPortalAccessRoleKey, RoleProfile> = {
    admin: {
      label: 'Admin',
      badge: 'User access',
      color: 'blue',
      description: 'Admins can review the company directory and understand who has portal access for this dealer account.',
      priority: 'Start with portal users, access roles, contacts, and account context.',
      sectionTitle: 'Account users and access',
      sectionDetail: 'The access directory is prominent for admins so company user visibility stays clear.',
      link: { href: '/dealer/account', label: 'Review Users', variant: 'filled' },
    },
    purchasing: {
      label: 'Purchasing',
      badge: 'Products and files',
      color: 'green',
      description: 'Purchasing users focus on published products, dealer-visible files, and readiness for future ordering.',
      priority: 'Browse products and files now. Cart and order submission are intentionally not available yet.',
      sectionTitle: 'Products, files, and purchasing readiness',
      sectionDetail: 'Catalog access is available today; commerce actions will wait for the approved ERP-backed gate.',
      link: { href: '/dealer/catalog', label: 'Open Products & Files', variant: 'filled' },
    },
    accounting: {
      label: 'Accounting',
      badge: 'Account health',
      color: 'orange',
      description: 'Accounting users can review account-health readiness while finance records wait for Acumatica sync.',
      priority: 'Account Health shows ERP sync status without displaying unverified finance values.',
      sectionTitle: 'Account Health shell',
      sectionDetail: 'Payment terms, credit status, billing address changes, and transaction history are sync-gated.',
      link: { href: '/dealer/account#account-health', label: 'Open Account Health', variant: 'filled' },
    },
    viewer: {
      label: 'Viewer',
      badge: 'Read-only',
      color: 'gray',
      description: 'Viewers can inspect published dealer portal information without managing users, finance, or orders.',
      priority: 'Use the portal as a read-only reference for company, location, contact, product, and file details.',
      sectionTitle: 'Read-only portal view',
      sectionDetail: 'This role keeps the portal navigable while making the read-only boundary explicit.',
    },
  };

  return profiles[role];
}

function formatAccessRole(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function RoleCallout({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Box
      p="md"
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
      }}
    >
      <Stack gap={4}>
        <Group gap={6}>
          {icon ? <Text c="blue">{icon}</Text> : null}
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {label}
          </Text>
        </Group>
        <Text size="sm" fw={600}>
          {value}
        </Text>
      </Stack>
    </Box>
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

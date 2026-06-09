'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Badge, Box, Button, Card, CopyButton, Grid, Group, Modal, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { DealerPortalAccessRoleKey, DealerPortalDashboardResponse } from '@pulse/contracts';
import { createCurrentDealerPortalUser, updateCurrentDealerPortalUser } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function DealerAccountCenter({ dashboard }: { dashboard: DealerPortalDashboardResponse }) {
  const { auth, apiBaseUrl } = usePulseSession();
  const [currentDashboard, setCurrentDashboard] = useState(dashboard);
  const [inviteOpened, setInviteOpened] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [accessRole, setAccessRole] = useState<Exclude<DealerPortalAccessRoleKey, 'admin'>>('viewer');
  const [notes, setNotes] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [lastInvitePath, setLastInvitePath] = useState<string | null>(null);
  const roleProfile = getRoleProfile(currentDashboard.currentUser.accessRole);
  const isViewer = currentDashboard.currentUser.accessRole === 'viewer';
  const canManageUsers = currentDashboard.currentUser.accessRole === 'admin';

  async function handleInviteUser() {
    if (!auth) return;
    setIsSavingUser(true);
    try {
      const response = await createCurrentDealerPortalUser(apiBaseUrl, auth.tokens.accessToken, {
        firstName,
        lastName,
        email,
        ...(title.trim() ? { title: title.trim() } : {}),
        accessRole,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setCurrentDashboard(response.dashboard);
      setLastInvitePath(response.invitePath);
      setFirstName('');
      setLastName('');
      setEmail('');
      setTitle('');
      setAccessRole('viewer');
      setNotes('');
      setInviteOpened(false);
      notifications.show({
        title: 'Portal user invited',
        message: `${response.user.displayName} can now accept the dealer portal invite.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Invite failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleUserStatus(userId: string, status: 'active' | 'deactivated') {
    if (!auth) return;
    try {
      const response = await updateCurrentDealerPortalUser(apiBaseUrl, auth.tokens.accessToken, userId, { status });
      setCurrentDashboard(response.dashboard);
      notifications.show({
        title: status === 'active' ? 'Portal user access restored' : 'Portal user access paused',
        message: `${response.user.displayName} was updated.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'User update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    }
  }

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Dealer Portal</Text>
            <Title order={1}>Account center</Title>
            <Text c="dimmed" maw={760}>
              Review your company profile, company users, contacts, and locations.
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
              <Title order={3}>Company portal status</Title>
              <MetadataRow label="Status" value={formatPortalStatus(currentDashboard.portalAccount.status)} badgeColor={statusColor(currentDashboard.portalAccount.status)} />
              <MetadataRow label="Active users" value={String(currentDashboard.portalAccount.activePortalUsers)} />
              <MetadataRow label="Total users" value={String(currentDashboard.portalAccount.totalPortalUsers)} />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
            <Stack gap="sm">
              <Title order={3}>Dynamic AQS Account Team</Title>
              <MetadataRow label="Territory" value={currentDashboard.portalAccount.territoryName ?? 'Not assigned'} />
              <MetadataRow label="Region" value={currentDashboard.portalAccount.regionName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={currentDashboard.portalAccount.shippingCenterName ?? 'Not assigned'} />
              <MetadataRow label="Territory Manager" value={currentDashboard.portalAccount.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="Regional Director" value={currentDashboard.portalAccount.assignedRdName ?? 'Not assigned'} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card id="account-health" withBorder radius="xl" p="lg" className="premium-detail-card">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text className="eyebrow">Account Health</Text>
              <Title order={3}>Account health</Title>
            </Stack>
            <Badge size="lg" color="orange" variant="light">
              Profile available
            </Badge>
          </Group>
          <Text size="sm" c="dimmed" maw={760}>
            Profile, users, contacts, locations, products, and files are available now. Contact Dynamic AQS support
            when you need account documents or current account details.
          </Text>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <AccountHealthRow label="Account documents" value="Contact Dynamic AQS support" />
            <AccountHealthRow label="Account status" value="Contact Dynamic AQS for current status" />
            <AccountHealthRow label="Billing address changes" value="Locked, contact Dynamic AQS" />
            <AccountHealthRow label="Need help?" value="Contact Dynamic AQS support" />
          </SimpleGrid>
        </Stack>
      </Card>

      <Card withBorder radius="xl" p="lg" className="premium-detail-card">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>Portal User Access</Title>
              <Text size="sm" c="dimmed">
                Account Access users can invite or pause company users. Dynamic AQS still manages primary owner and company-level access.
              </Text>
            </Stack>
            <Group gap="xs">
              <Badge size="lg" color="blue" variant="light">
                {currentDashboard.companyUsers.length} user{currentDashboard.companyUsers.length === 1 ? '' : 's'}
              </Badge>
              {canManageUsers ? (
                <Button size="sm" onClick={() => setInviteOpened(true)}>
                  Invite User
                </Button>
              ) : null}
            </Group>
          </Group>
          {canManageUsers ? (
            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
              <AccessRuleCard title="You can invite" description="Products & Files, Account Health, and viewer users for this dealer company." />
              <AccessRuleCard title="You can pause" description="Company users when someone leaves or should stop using the portal." />
              <AccessRuleCard title="Dynamic AQS manages" description="Primary owner, company-level access, billing authority, and account-level changes." />
            </SimpleGrid>
          ) : (
            <Alert color="gray" variant="light">
              This page is read-only for your role. Ask your company Account Access user or Dynamic AQS for user access changes.
            </Alert>
          )}
          {lastInvitePath ? (
            <Alert color="green" variant="light" title="Invite link created">
              <Group gap="xs" wrap="nowrap" align="flex-end">
                <TextInput
                  readOnly
                  aria-label="Dealer invite link"
                  value={typeof window !== 'undefined' ? `${window.location.origin}${lastInvitePath}` : lastInvitePath}
                  style={{ flex: 1 }}
                  styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
                />
                <CopyButton value={typeof window !== 'undefined' ? `${window.location.origin}${lastInvitePath}` : lastInvitePath}>
                  {({ copied, copy }) => (
                    <Button color={copied ? 'teal' : 'green'} onClick={copy} style={{ minHeight: 44 }}>
                      {copied ? 'Copied' : 'Copy link'}
                    </Button>
                  )}
                </CopyButton>
              </Group>
            </Alert>
          ) : null}
          {currentDashboard.companyUsers.length === 0 ? (
            <Alert color="blue" variant="light">
              No company users have been set up for this account yet.
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
                  {canManageUsers ? <Table.Th>Actions</Table.Th> : null}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {currentDashboard.companyUsers.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>{user.displayName}</Table.Td>
                    <Table.Td>{user.email}</Table.Td>
                    <Table.Td>{user.title ?? '—'}</Table.Td>
                    <Table.Td>{formatAccessRole(user.accessRole)}</Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={statusColor(user.status)} variant="light">
                        {formatPortalStatus(user.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{user.isPrimaryOwner ? 'Yes' : 'No'}</Table.Td>
                    <Table.Td>{formatDateTime(user.activatedAt)}</Table.Td>
                    {canManageUsers ? (
                      <Table.Td>
                        {getUserActionBlockReason(user, currentDashboard.currentUser.id) ? (
                          <Text size="xs" c="dimmed">{getUserActionBlockReason(user, currentDashboard.currentUser.id)}</Text>
                        ) : user.status === 'active' ? (
                          <Button size="compact-xs" variant="light" color="red" onClick={() => void handleUserStatus(user.id, 'deactivated')}>
                            Pause access
                          </Button>
                        ) : (
                          <Button size="compact-xs" variant="light" color="green" onClick={() => void handleUserStatus(user.id, 'active')}>
                            Restore access
                          </Button>
                        )}
                      </Table.Td>
                    ) : null}
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
              {currentDashboard.contacts.length === 0 ? (
                <Alert color="blue" variant="light">
                  No contacts are available for this account yet.
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
                    {currentDashboard.contacts.map((contact) => (
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
              {currentDashboard.locations.length === 0 ? (
                <Alert color="blue" variant="light">
                  No locations are available for this account yet.
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
                    {currentDashboard.locations.map((location) => (
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
      <Modal opened={inviteOpened} onClose={() => setInviteOpened(false)} title="Invite Portal User" size="lg" centered>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="First name" value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} required />
            <TextInput label="Last name" value={lastName} onChange={(event) => setLastName(event.currentTarget.value)} required />
          </SimpleGrid>
          <TextInput label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} required />
          <TextInput label="Title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
          <Select
            label="Portal role"
            description={roleInviteDescription(accessRole)}
            value={accessRole}
            onChange={(value) => setAccessRole((value as Exclude<DealerPortalAccessRoleKey, 'admin'> | null) ?? 'viewer')}
            data={[
              { value: 'purchasing', label: 'Products & Files' },
              { value: 'accounting', label: 'Account Health' },
              { value: 'viewer', label: 'Viewer' },
            ]}
            allowDeselect={false}
          />
          <Textarea
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            minRows={3}
          />
          <Alert color="blue" variant="light">
            Account Access and primary-owner access is managed by Dynamic AQS. This keeps company access controlled.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setInviteOpened(false)}>Cancel</Button>
            <Button
              onClick={() => void handleInviteUser()}
              loading={isSavingUser}
              disabled={!firstName.trim() || !lastName.trim() || !email.trim()}
            >
              Create Invite
            </Button>
          </Group>
        </Stack>
      </Modal>
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
      label: 'Account Access',
      badge: 'User access',
      color: 'blue',
      description: 'Account Access users use the Account Center to review who can access the dealer portal.',
      accountCenterFocus: 'The portal user access directory is the primary access surface on this page.',
    },
    purchasing: {
      label: 'Products & Files',
      badge: 'Products and files',
      color: 'green',
      description: 'Products and Files users can review company context here and move back to available catalog materials.',
      accountCenterFocus: 'Products and files are the active catalog surface today.',
    },
    accounting: {
      label: 'Account Health',
      badge: 'Account health',
      color: 'orange',
      description: 'Account Health users can inspect company profile and support status.',
      accountCenterFocus: 'Use Account Health for account profile and Dynamic AQS support status.',
    },
    viewer: {
      label: 'Viewer',
      badge: 'Read-only',
      color: 'gray',
      description: 'Viewers can review company, access, contact, and location details as a read-only reference.',
      accountCenterFocus: 'This role cannot manage users or account changes in the portal.',
    },
  };

  return profiles[role];
}

function formatAccessRole(value: string) {
  const labels: Partial<Record<DealerPortalAccessRoleKey, string>> = {
    admin: 'Account Access',
    purchasing: 'Products and Files',
    accounting: 'Account Health',
    viewer: 'Viewer',
  };

  return labels[value as DealerPortalAccessRoleKey] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleInviteDescription(role: Exclude<DealerPortalAccessRoleKey, 'admin'>) {
  switch (role) {
    case 'purchasing':
      return 'Can use available products and files.';
    case 'accounting':
      return 'Can inspect Account Health connection status.';
    case 'viewer':
      return 'Read-only access for company context, contacts, locations, and files.';
  }
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

function AccessRuleCard({ title, description }: { title: string; description: string }) {
  return (
    <Box
      p="md"
      style={{
        border: '1px solid var(--mantine-color-blue-1)',
        background: 'var(--mantine-color-blue-0)',
        borderRadius: 8,
      }}
    >
      <Stack gap={4}>
        <Text size="sm" fw={700}>
          {title}
        </Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Stack>
    </Box>
  );
}

function getUserActionBlockReason(
  user: DealerPortalDashboardResponse['companyUsers'][number],
  currentUserId: string,
) {
  if (user.id === currentUserId) {
    return 'You cannot revoke yourself';
  }

  if (user.isPrimaryOwner) {
    return 'Primary owner: Dynamic AQS managed';
  }

  if (user.accessRole === 'admin') {
    return 'Account Access: Dynamic AQS managed';
  }

  return null;
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

function formatPortalStatus(status: string) {
  if (status === 'active') {
    return 'Active';
  }

  if (status === 'ready_to_provision') {
    return 'Access setup';
  }

  if (status === 'suspended') {
    return 'Paused';
  }

  if (status === 'deactivated') {
    return 'Inactive';
  }

  return status.replace(/_/g, ' ');
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Grid,
  Group,
  Loader,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type {
  AccountDetail,
  DealerPortalAccessRoleKey,
  DealerPortalAccountDetail,
  DealerPortalUserStatusKey,
} from '@pulse/contracts';
import { IconEye, IconKey, IconMail, IconUserPlus } from '@tabler/icons-react';
import { DealerCatalog } from '@/components/dealer/DealerCatalog';
import { canPerformAction } from '@/lib/access';
import {
  createDealerPortalInvite,
  fetchDealerPortalInternalPreview,
  fetchDealerPortalAccountDetail,
  type DealerPortalInternalPreviewResponse,
  provisionDealerPortalUser,
  resetDealerPortalUserPassword,
  updateDealerPortalUserStatus,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { RowActionMenu, WorkbenchAdvancedSection } from '@/components/ui/Workbench';

type Props = {
  account: AccountDetail;
  onProvisioned?: () => void;
};

export function CustomerDealerPortalAccess({ account, onProvisioned }: Props) {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const actorRole = auth?.identity.role ?? null;
  const canManagePortal = actorRole ? canPerformAction(actorRole, 'lead.portal_setup') : false;
  const [portalAccount, setPortalAccount] = useState<DealerPortalAccountDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(account.contacts[0]?.id ?? null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [accessRole, setAccessRole] = useState<DealerPortalAccessRoleKey>('admin');
  const [isPrimaryOwner, setIsPrimaryOwner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewRole, setPreviewRole] = useState<DealerPortalAccessRoleKey>('viewer');
  const [dealerPreview, setDealerPreview] = useState<DealerPortalInternalPreviewResponse | null>(null);
  const [previewTab, setPreviewTab] = useState<'dashboard' | 'catalog'>('dashboard');
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const contactOptions = useMemo(
    () => account.contacts.map((contact) => ({
      value: contact.id,
      label: `${contact.firstName} ${contact.lastName}${contact.email ? ` (${contact.email})` : ''}`,
    })),
    [account.contacts],
  );

  useEffect(() => {
    if (!accessToken || !canManagePortal) {
      return;
    }

    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const detail = await fetchDealerPortalAccountDetail(apiBaseUrl, accessToken, account.id);
        if (!cancelled) {
          setPortalAccount(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [accessToken, account.id, apiBaseUrl, canManagePortal]);

  async function reloadPortalAccount() {
    if (!accessToken || !canManagePortal) {
      return;
    }

    const detail = await fetchDealerPortalAccountDetail(apiBaseUrl, accessToken, account.id);
    setPortalAccount(detail);
  }

  async function handleProvisionUser() {
    if (!accessToken || !canManagePortal) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = await provisionDealerPortalUser(apiBaseUrl, accessToken, account.id, {
        ...(selectedContactId ? { contactId: selectedContactId } : {}),
        ...(!selectedContactId && firstName.trim() ? { firstName } : {}),
        ...(!selectedContactId && lastName.trim() ? { lastName } : {}),
        ...(!selectedContactId && title.trim() ? { title } : {}),
        ...(email.trim() ? { email } : {}),
        accessRole,
        isPrimaryOwner,
      });

      setPortalAccount(response.portalAccount);
      setSuccessMessage(response.invitePath
        ? `Portal user created. Invite link: ${window.location.origin}${response.invitePath}`
        : `Portal user created. Temporary password: ${response.temporaryPassword}`);
      setSelectedContactId(account.contacts[0]?.id ?? null);
      setFirstName('');
      setLastName('');
      setTitle('');
      setEmail('');
      setAccessRole('admin');
      setIsPrimaryOwner(false);
      onProvisioned?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(userId: string, status: DealerPortalUserStatusKey) {
    if (!accessToken) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await updateDealerPortalUserStatus(apiBaseUrl, accessToken, userId, { status });
      setPortalAccount(response.portalAccount);
      setSuccessMessage(`Dealer portal user updated: ${status.replace(/_/g, ' ')}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handlePasswordReset(userId: string) {
    if (!accessToken) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await resetDealerPortalUserPassword(apiBaseUrl, accessToken, userId);
      setSuccessMessage(`Temporary password reset for ${response.email}: ${response.temporaryPassword}`);
      await reloadPortalAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleCreateInvite(userId: string) {
    if (!accessToken) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await createDealerPortalInvite(apiBaseUrl, accessToken, userId);
      setSuccessMessage(`Invite link ready for ${response.user.email}: ${window.location.origin}${response.invitePath}`);
      await reloadPortalAccount();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleLoadDealerPreview() {
    if (!accessToken) {
      return;
    }

    setPreviewErrorMessage(null);
    setDealerPreview(null);
    setIsPreviewLoading(true);

    try {
      const response = await fetchDealerPortalInternalPreview(apiBaseUrl, accessToken, account.id, previewRole);
      setDealerPreview(response);
      setPreviewTab('dashboard');
    } catch (error) {
      setPreviewErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  const sourceLeadStatus = portalAccount?.portalEligibilityStatus ?? 'unassessed';

  if (!canManagePortal) {
    return (
      <Stack gap="lg">
        <Alert color="yellow" variant="light">
          Your role can review account context, but dealer portal provisioning is managed by authorized operations or admin users.
        </Alert>
        <Card withBorder radius="md" p="lg">
          <Stack gap="xs">
            <Title order={4}>Dealer portal access</Title>
            <Text size="sm" c="dimmed">
              Portal user invites, role changes, and internal dealer previews are hidden for this role.
            </Text>
            <MetadataRow label="Account" value={account.displayName} />
            <MetadataRow label="Territory" value={account.territoryName ?? 'Not assigned'} />
            <MetadataRow label="TM" value={account.assignedTmName ?? 'Not assigned'} />
            <MetadataRow label="RD" value={account.assignedRdName ?? 'Not assigned'} />
          </Stack>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}
      {successMessage ? <Alert color="green" variant="light">{successMessage}</Alert> : null}

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Stack gap="xs">
              <Title order={4}>Portal Status</Title>
              <MetadataRow label="Account" value={account.displayName} />
              <MetadataRow label="Provisioning" value={formatProvisioningStatus(portalAccount?.status ?? 'not_started')} />
              <MetadataRow label="Source Lead Readiness" value={formatProvisioningStatus(sourceLeadStatus)} />
              <MetadataRow label="Active Portal Users" value={String(portalAccount?.activePortalUsers ?? 0)} />
              <MetadataRow label="Total Portal Users" value={String(portalAccount?.totalPortalUsers ?? 0)} />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Stack gap="xs">
              <Title order={4}>Account Context</Title>
              <MetadataRow label="Territory" value={portalAccount?.territoryName ?? account.territoryName ?? 'Not assigned'} />
              <MetadataRow label="TM" value={portalAccount?.assignedTmName ?? account.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="RD" value={portalAccount?.assignedRdName ?? account.assignedRdName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={portalAccount?.shippingCenterName ?? account.shippingCenterName ?? 'Not assigned'} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={4}>Preview as Dealer</Title>
              <Text size="sm" c="dimmed">
                Internal-only view for checking what this account can see before dealer users sign in.
              </Text>
            </Stack>
            {isPreviewLoading ? <Loader size="sm" /> : null}
          </Group>

          <Grid align="end">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Select
                label="Preview role"
                data={dealerPortalRoleOptions}
                value={previewRole}
                onChange={(value) => setPreviewRole((value as DealerPortalAccessRoleKey | null) ?? 'viewer')}
                allowDeselect={false}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Group justify="flex-end">
                <Button
                  leftSection={<IconEye size={16} />}
                  onClick={() => void handleLoadDealerPreview()}
                  loading={isPreviewLoading}
                  disabled={!accessToken || !canManagePortal}
                >
                  Preview Portal View
                </Button>
              </Group>
            </Grid.Col>
          </Grid>

          {previewErrorMessage ? (
            <Alert color="red" variant="light">
              {previewErrorMessage}
            </Alert>
          ) : null}

          {dealerPreview ? (
            <Stack gap="md">
              <Alert color="orange" variant="light" icon={<IconEye size={16} />}>
                Internal preview only. This is not a dealer login, does not create a dealer session, and does not change
                account access.
              </Alert>

              <SegmentedControl
                value={previewTab}
                onChange={(value) => setPreviewTab(value as 'dashboard' | 'catalog')}
                data={[
                  { value: 'dashboard', label: 'Dashboard' },
                  { value: 'catalog', label: `Catalog (${dealerPreview.visibleProductCount} products, ${dealerPreview.visibleFileCount} files)` },
                ]}
              />

              {previewTab === 'dashboard' ? (
                <Stack gap="md">
                  <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                    <Card withBorder radius="md" p="md">
                      <Stack gap="xs">
                        <Title order={5}>Account</Title>
                        <MetadataRow label="Name" value={dealerPreview.portalAccount.accountDisplayName} />
                        <MetadataRow label="Account No." value={dealerPreview.portalAccount.accountNumber ?? 'Not assigned'} />
                        <MetadataRow label="Territory" value={dealerPreview.portalAccount.territoryName ?? 'Not assigned'} />
                        <MetadataRow label="TM" value={dealerPreview.portalAccount.assignedTmName ?? 'Not assigned'} />
                        <MetadataRow label="RD" value={dealerPreview.portalAccount.assignedRdName ?? 'Not assigned'} />
                        <MetadataRow label="Portal users" value={`${dealerPreview.portalAccount.activePortalUsers} active / ${dealerPreview.portalAccount.totalPortalUsers} total`} />
                      </Stack>
                    </Card>
                    <Card withBorder radius="md" p="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Title order={5}>Contacts</Title>
                          <Badge variant="light" color={dealerPreview.dashboard.contacts.length ? 'green' : 'yellow'}>
                            {dealerPreview.dashboard.contacts.length}
                          </Badge>
                        </Group>
                        {dealerPreview.dashboard.contacts.length === 0 ? (
                          <Text size="sm" c="dimmed">No contacts on file — dealers see degraded portal experience.</Text>
                        ) : dealerPreview.dashboard.contacts.map((contact) => (
                          <Stack key={contact.id} gap={2}>
                            <Text size="sm" fw={600}>{contact.displayName}{contact.isPrimary ? ' · Primary' : ''}</Text>
                            {contact.title ? <Text size="xs" c="dimmed">{contact.title}</Text> : null}
                            {contact.email ? <Text size="xs" c="dimmed">{contact.email}</Text> : null}
                          </Stack>
                        ))}
                      </Stack>
                    </Card>
                    <Card withBorder radius="md" p="md">
                      <Stack gap="xs">
                        <Group justify="space-between">
                          <Title order={5}>Locations</Title>
                          <Badge variant="light" color={dealerPreview.dashboard.locations.length ? 'green' : 'yellow'}>
                            {dealerPreview.dashboard.locations.length}
                          </Badge>
                        </Group>
                        {dealerPreview.dashboard.locations.length === 0 ? (
                          <Text size="sm" c="dimmed">No locations on file — dealers see degraded portal experience.</Text>
                        ) : dealerPreview.dashboard.locations.map((location) => (
                          <Stack key={location.id} gap={2}>
                            <Text size="sm" fw={600}>{location.name}{location.isPrimary ? ' · Primary' : ''}</Text>
                            {(location.city || location.state) ? (
                              <Text size="xs" c="dimmed">{[location.city, location.state].filter(Boolean).join(', ')}</Text>
                            ) : null}
                          </Stack>
                        ))}
                      </Stack>
                    </Card>
                  </SimpleGrid>
                  {(dealerPreview.dashboard.contacts.length === 0 || dealerPreview.dashboard.locations.length === 0) ? (
                    <Alert color="yellow" title="Profile gaps visible to dealer">
                      {dealerPreview.dashboard.contacts.length === 0 ? 'No contacts — the dealer support panel will show "Dynamic AQS support" as fallback. ' : ''}
                      {dealerPreview.dashboard.locations.length === 0 ? 'No locations — the dealer profile health card will flag this as incomplete.' : ''}
                    </Alert>
                  ) : null}
                </Stack>
              ) : (
                <DealerCatalog catalog={dealerPreview.catalog} />
              )}

              <WorkbenchAdvancedSection
                title="Support diagnostics"
                description="Internal-only membership, rule, and catalog resolution details for troubleshooting."
              >
                <Stack gap="md">
                  <Grid>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Stack gap="xs">
                        <Title order={5}>Dealer Classification</Title>
                        <MetadataRow label="Account" value={dealerPreview.portalAccount.accountDisplayName} />
                        <MetadataRow label="Account Number" value={dealerPreview.portalAccount.accountNumber ?? 'Not assigned'} />
                        <MetadataRow label="Affinity" value={formatGroupAxis(dealerPreview.diagnostics.membershipContext?.affinityGroupSelection, dealerPreview.diagnostics.membershipContext?.affinityGroupName ?? dealerPreview.diagnostics.membershipContext?.affinityGroupCode)} />
                        <MetadataRow label="Ownership / PE" value={formatGroupAxis(dealerPreview.diagnostics.membershipContext?.ownershipGroupSelection, dealerPreview.diagnostics.membershipContext?.ownershipGroupName ?? dealerPreview.diagnostics.membershipContext?.ownershipGroupCode)} />
                        <MetadataRow label="Dealer type" value={formatDisplayValue(dealerPreview.diagnostics.membershipContext?.groupClassification ?? 'unknown')} />
                        <MetadataRow label="Region" value={dealerPreview.diagnostics.membershipContext?.regionName ?? dealerPreview.diagnostics.membershipContext?.regionCode ?? 'Not assigned'} />
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, md: 6 }}>
                      <Stack gap="xs">
                        <Title order={5}>Catalog Decision</Title>
                        <MetadataRow label="Role" value={formatProvisioningStatus(dealerPreview.previewRole)} />
                        <MetadataRow label="Resolved by" value={formatDisplayValue(dealerPreview.diagnostics.catalogResolution.source)} />
                        <MetadataRow label="Rule" value={dealerPreview.diagnostics.catalogResolution.ruleName ?? 'Default eligible catalog'} />
                        <MetadataRow label="Dealer group" value={dealerPreview.catalog.catalogView?.name ?? 'Needs review'} />
                        <MetadataRow label="Visible Products" value={String(dealerPreview.visibleProductCount)} />
                        <MetadataRow label="Visible Files" value={String(dealerPreview.visibleFileCount)} />
                      </Stack>
                    </Grid.Col>
                  </Grid>

                  {dealerPreview.diagnostics.warnings.length ? (
                    <Alert color="yellow" variant="light">
                      {dealerPreview.diagnostics.warnings.join(' ')}
                    </Alert>
                  ) : null}
                </Stack>
              </WorkbenchAdvancedSection>
            </Stack>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Provision Dealer Portal User</Title>
            {isLoading ? <Loader size="sm" /> : null}
          </Group>

          <Select
            label="Use existing contact"
            placeholder="Select an existing contact or leave blank to create one"
            data={contactOptions}
            value={selectedContactId}
            onChange={setSelectedContactId}
            clearable
          />

          {!selectedContactId ? (
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput label="First Name" value={firstName} onChange={(event) => setFirstName(event.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput label="Last Name" value={lastName} onChange={(event) => setLastName(event.currentTarget.value)} />
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput label="Title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
              </Grid.Col>
            </Grid>
          ) : null}

          <TextInput
            label="Portal Login Email"
            placeholder="dealer@company.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
            description="Leave blank to reuse the selected contact email."
          />

          <Select
            label="Portal role"
            data={dealerPortalRoleOptions}
            value={accessRole}
            onChange={(value) => setAccessRole((value as DealerPortalAccessRoleKey | null) ?? 'admin')}
          />

          <Checkbox
            label="Primary owner / main portal contact"
            checked={isPrimaryOwner}
            onChange={(event) => setIsPrimaryOwner(event.currentTarget.checked)}
          />

          <Group justify="flex-end">
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={() => void handleProvisionUser()}
              loading={isSubmitting}
            >
              Create Dealer Portal User
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="lg">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Portal Users</Title>
            <Badge color="blue" variant="light">{portalAccount?.users.length ?? 0} users</Badge>
          </Group>

          {(portalAccount?.users.length ?? 0) === 0 ? (
            <Alert color="blue" variant="light" icon={<IconMail size={16} />}>
              No dealer portal users have been provisioned yet for this account.
            </Alert>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>User</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Invite</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {portalAccount?.users.map((user) => (
                  <Table.Tr key={user.id}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text fw={600}>
                          {user.displayName}
                          {user.isPrimaryOwner ? ' · Primary Owner' : ''}
                        </Text>
                        <Text size="sm" c="dimmed">{user.email}</Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatProvisioningStatus(user.accessRole)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(user.status)} variant="light">
                        {formatProvisioningStatus(user.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm">
                          {user.inviteAcceptedAt ? 'Accepted' : user.inviteExpiresAt ? 'Pending' : 'Not issued'}
                        </Text>
                        {user.inviteExpiresAt && !user.inviteAcceptedAt ? (
                          <Text size="xs" c="dimmed">Expires {formatTimestamp(user.inviteExpiresAt)}</Text>
                        ) : null}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : 'Never'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <RowActionMenu
                        label={`Actions for ${user.displayName}`}
                        items={[
                          user.status !== 'active'
                            ? {
                              id: 'activate',
                              label: 'Activate',
                              onClick: () => void handleStatusChange(user.id, 'active'),
                            }
                            : {
                              id: 'suspend',
                              label: 'Suspend',
                              onClick: () => void handleStatusChange(user.id, 'suspended'),
                            },
                          ...(user.status !== 'deactivated' ? [{
                            id: 'deactivate',
                            label: 'Deactivate',
                            color: 'danger' as const,
                            onClick: () => void handleStatusChange(user.id, 'deactivated'),
                          }] : []),
                          {
                            id: 'reset-password',
                            label: 'Reset password',
                            icon: <IconKey size={14} />,
                            onClick: () => void handlePasswordReset(user.id),
                          },
                          {
                            id: 'invite-link',
                            label: 'Invite link',
                            icon: <IconMail size={14} />,
                            onClick: () => void handleCreateInvite(user.id),
                          },
                        ]}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

const dealerPortalRoleOptions = [
  { value: 'admin', label: 'Admin - manage company access' },
  { value: 'purchasing', label: 'Products & Files - catalog access' },
  { value: 'accounting', label: 'Account Health - account status access' },
  { value: 'viewer', label: 'Viewer - read-only access' },
];

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={500} ta="right">{value}</Text>
    </Group>
  );
}

function formatProvisioningStatus(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDisplayValue(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatGroupAxis(selection: string | undefined, label: string | undefined) {
  if (selection === 'group' || selection === 'GROUP') {
    return label ?? 'Selected group';
  }
  if (selection === 'none' || selection === 'NONE') {
    return 'None / Independent';
  }
  return 'Unknown';
}

function statusColor(status: DealerPortalUserStatusKey) {
  switch (status) {
    case 'active':
      return 'green';
    case 'suspended':
      return 'yellow';
    case 'deactivated':
      return 'red';
  }
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

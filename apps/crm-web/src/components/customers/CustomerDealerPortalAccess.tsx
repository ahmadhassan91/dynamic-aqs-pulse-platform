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
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type {
  AccountDetail,
  DealerPortalAccountDetail,
  DealerPortalUserStatusKey,
} from '@pulse/contracts';
import { IconCheck, IconKey, IconMail, IconUserPlus } from '@tabler/icons-react';
import { canPerformAction } from '@/lib/access';
import {
  fetchDealerPortalAccountDetail,
  provisionDealerPortalUser,
  resetDealerPortalUserPassword,
  updateDealerPortalUserStatus,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

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
  const [isPrimaryOwner, setIsPrimaryOwner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    if (!accessToken) {
      return;
    }

    const detail = await fetchDealerPortalAccountDetail(apiBaseUrl, accessToken, account.id);
    setPortalAccount(detail);
  }

  async function handleProvisionUser() {
    if (!accessToken) {
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
        isPrimaryOwner,
      });

      setPortalAccount(response.portalAccount);
      setSuccessMessage(`Portal user created. Temporary password: ${response.temporaryPassword}`);
      setSelectedContactId(account.contacts[0]?.id ?? null);
      setFirstName('');
      setLastName('');
      setTitle('');
      setEmail('');
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

  const sourceLeadStatus = portalAccount?.portalEligibilityStatus ?? 'unassessed';

  return (
    <Stack gap="lg">
      {!canManagePortal ? (
        <Alert color="yellow" variant="light">
          Your role does not have dealer-portal provisioning access.
        </Alert>
      ) : null}

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
                  <Table.Th>Status</Table.Th>
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
                      <Badge color={statusColor(user.status)} variant="light">
                        {formatProvisioningStatus(user.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : 'Never'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {user.status !== 'active' ? (
                          <Button size="xs" variant="light" onClick={() => void handleStatusChange(user.id, 'active')}>
                            Activate
                          </Button>
                        ) : (
                          <Button size="xs" variant="default" onClick={() => void handleStatusChange(user.id, 'suspended')}>
                            Suspend
                          </Button>
                        )}
                        {user.status !== 'deactivated' ? (
                          <Button size="xs" color="red" variant="light" onClick={() => void handleStatusChange(user.id, 'deactivated')}>
                            Deactivate
                          </Button>
                        ) : null}
                        <Button size="xs" variant="subtle" leftSection={<IconKey size={14} />} onClick={() => void handlePasswordReset(user.id)}>
                          Reset Password
                        </Button>
                      </Group>
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

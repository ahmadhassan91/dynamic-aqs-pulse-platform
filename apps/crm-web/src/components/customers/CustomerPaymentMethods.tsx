'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type {
  AccountPaymentMethodSummary,
  CisPaymentVaultProviderKey,
} from '@pulse/contracts';
import {
  createAccountPaymentMethodRecord,
  fetchAccountPaymentMethods,
  updateAccountPaymentMethodRecord,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { RowActionMenu } from '@/components/ui/Workbench';

const PROVIDER_OPTIONS: Array<{ value: CisPaymentVaultProviderKey; label: string }> = [
  { value: 'ebizcharge', label: 'eBizCharge' },
  { value: 'moneris', label: 'Moneris' },
  { value: 'unknown', label: 'Unknown / Other' },
];

export function CustomerPaymentMethods(
  { accountId, canManage }: { accountId: string; canManage: boolean },
) {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [items, setItems] = useState<AccountPaymentMethodSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpened, setCreateOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [provider, setProvider] = useState<CisPaymentVaultProviderKey>('ebizcharge');
  const [vaultToken, setVaultToken] = useState('');
  const [vaultCustomerRef, setVaultCustomerRef] = useState('');
  const [externalPaymentMethodRef, setExternalPaymentMethodRef] = useState('');
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [authorizationCapturedAt, setAuthorizationCapturedAt] = useState('');
  const [status, setStatus] = useState('active');
  const [isDefault, setIsDefault] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function reload() {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchAccountPaymentMethods(apiBaseUrl, accessToken, accountId);
      setItems(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accessToken, apiBaseUrl, auth]);

  function resetCreateForm() {
    setProvider('ebizcharge');
    setVaultToken('');
    setVaultCustomerRef('');
    setExternalPaymentMethodRef('');
    setLast4('');
    setBrand('');
    setBillingZip('');
    setAuthorizationCapturedAt('');
    setStatus('active');
    setIsDefault(items.length === 0);
    setIsActive(true);
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateOpened(true);
  }

  async function handleCreate() {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    try {
      const input = {
        provider,
        ...(vaultToken.trim() ? { vaultToken: vaultToken.trim() } : {}),
        ...(vaultCustomerRef.trim() ? { vaultCustomerRef: vaultCustomerRef.trim() } : {}),
        ...(externalPaymentMethodRef.trim() ? { externalPaymentMethodRef: externalPaymentMethodRef.trim() } : {}),
        ...(last4.trim() ? { last4: last4.trim() } : {}),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(billingZip.trim() ? { billingZip: billingZip.trim() } : {}),
        ...(authorizationCapturedAt.trim() ? { authorizationCapturedAt: authorizationCapturedAt.trim() } : {}),
        ...(status.trim() ? { status: status.trim() } : {}),
        isDefault,
        isActive,
      };
      const created = await createAccountPaymentMethodRecord(apiBaseUrl, accessToken, accountId, input);
      setItems((current) => reorderPaymentMethods(
        current
          .filter((item) => item.id !== created.id)
          .map((item) => (created.isDefault ? { ...item, isDefault: false } : item))
          .concat(created),
      ));
      setCreateOpened(false);
      notifications.show({
        title: 'Payment method added',
        message: 'The tokenized payment method is now stored against this account.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Payment method add failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetDefault(paymentMethodId: string) {
    if (!auth) {
      return;
    }

    setUpdatingId(paymentMethodId);
    try {
      const updated = await updateAccountPaymentMethodRecord(apiBaseUrl, accessToken, accountId, paymentMethodId, {
        isDefault: true,
      });
      setItems((current) => reorderPaymentMethods(current.map((item) => (
        item.id === updated.id
          ? updated
          : { ...item, isDefault: false }
      ))));
    } catch (error) {
      notifications.show({
        title: 'Default update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleActive(item: AccountPaymentMethodSummary) {
    if (!auth) {
      return;
    }

    setUpdatingId(item.id);
    try {
      const updated = await updateAccountPaymentMethodRecord(apiBaseUrl, accessToken, accountId, item.id, {
        isActive: !item.isActive,
      });
      await reload();
      notifications.show({
        title: updated.isActive ? 'Payment method reactivated' : 'Payment method deactivated',
        message: 'Account billing preferences were updated.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Payment method update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={4}>Tokenized payment methods</Title>
            <Text size="sm" c="dimmed">
              Pulse stores provider references and masked descriptors only. Raw card or bank details stay outside CRM by design.
            </Text>
          </Stack>
          {canManage ? (
            <Button variant="light" onClick={openCreateModal}>
              Add Tokenized Method
            </Button>
          ) : null}
        </Group>
      </Card>

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      {isLoading ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <Card withBorder radius="md" p="lg">
          <Stack gap="xs">
            <Text fw={600}>No tokenized payment methods yet</Text>
            <Text size="sm" c="dimmed">
              Add a vaulted provider reference once finance has captured or approved the hosted payment token outside of Pulse.
            </Text>
          </Stack>
        </Card>
      ) : null}

      {items.map((item) => (
        <Card withBorder radius="md" p="lg" key={item.id}>
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={600}>{formatProvider(item.provider)}</Text>
                {item.last4 ? <Badge color="blue" variant="light">•••• {item.last4}</Badge> : null}
                {item.brand ? <Badge color="grape" variant="light">{item.brand}</Badge> : null}
                {item.isDefault ? <Badge color="green" variant="light">Default</Badge> : null}
                {!item.isActive ? <Badge color="gray" variant="outline">Inactive</Badge> : null}
              </Group>
              <Text size="sm" c="dimmed">
                Source: {item.source === 'cis_promoted' ? 'Promoted from CIS vault reference' : 'Registered manually from tokenized provider data'}
              </Text>
            </Stack>
            {canManage ? (
              <RowActionMenu
                label={`Actions for ${formatProvider(item.provider)} payment method`}
                items={[
                  ...(!item.isDefault && item.isActive ? [{
                    id: 'make-default',
                    label: 'Make default',
                    disabled: updatingId === item.id,
                    onClick: () => void handleSetDefault(item.id),
                  }] : []),
                  {
                    id: item.isActive ? 'deactivate' : 'reactivate',
                    label: item.isActive ? 'Deactivate' : 'Reactivate',
                    color: item.isActive ? 'danger' : 'success',
                    disabled: updatingId === item.id,
                    onClick: () => void handleToggleActive(item),
                  },
                ]}
              />
            ) : null}
          </Group>

          <Group gap="xl" mt="md">
            <Metadata label="Status" value={item.status} />
            <Metadata label="Billing ZIP" value={item.billingZip ?? 'Not recorded'} />
            <Metadata label="External Ref" value={item.externalPaymentMethodRef ?? 'Not recorded'} />
            <Metadata label="Authorized" value={item.authorizationCapturedAt ? formatDateTime(item.authorizationCapturedAt) : 'Not recorded'} />
          </Group>
        </Card>
      ))}

      <Modal opened={createOpened} onClose={() => setCreateOpened(false)} title="Add tokenized payment method" centered size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light">
            Enter provider-issued token references only. Do not paste full card numbers, bank account numbers, or unmasked payment credentials into Pulse.
          </Alert>
          <Select
            label="Provider"
            value={provider}
            onChange={(value) => setProvider((value as CisPaymentVaultProviderKey | null) ?? 'ebizcharge')}
            data={PROVIDER_OPTIONS}
            allowDeselect={false}
          />
          <TextInput
            label="Vault Token"
            value={vaultToken}
            onChange={(event) => setVaultToken(event.currentTarget.value)}
            placeholder="tok_..."
          />
          <TextInput
            label="Vault Customer Reference"
            value={vaultCustomerRef}
            onChange={(event) => setVaultCustomerRef(event.currentTarget.value)}
            placeholder="cust_..."
          />
          <TextInput
            label="External Payment Method Reference"
            value={externalPaymentMethodRef}
            onChange={(event) => setExternalPaymentMethodRef(event.currentTarget.value)}
            placeholder="pm_..."
          />
          <Group grow>
            <TextInput
              label="Last 4"
              value={last4}
              onChange={(event) => setLast4(event.currentTarget.value)}
              placeholder="4242"
              maxLength={4}
            />
            <TextInput
              label="Brand"
              value={brand}
              onChange={(event) => setBrand(event.currentTarget.value)}
              placeholder="Visa"
            />
          </Group>
          <Group grow>
            <TextInput
              label="Billing ZIP"
              value={billingZip}
              onChange={(event) => setBillingZip(event.currentTarget.value)}
            />
            <TextInput
              label="Authorization Captured At"
              value={authorizationCapturedAt}
              onChange={(event) => setAuthorizationCapturedAt(event.currentTarget.value)}
              placeholder="2026-04-17T09:30:00.000Z"
            />
          </Group>
          <TextInput
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value)}
            placeholder="active"
          />
          <Group grow>
            <Switch
              checked={isDefault}
              onChange={(event) => setIsDefault(event.currentTarget.checked)}
              label="Set as default"
            />
            <Switch
              checked={isActive}
              onChange={(event) => setIsActive(event.currentTarget.checked)}
              label="Active"
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCreateOpened(false)}>
              Cancel
            </Button>
            <Button loading={isSaving} onClick={() => void handleCreate()}>
              Save Tokenized Method
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Stack>
  );
}

function reorderPaymentMethods(items: AccountPaymentMethodSummary[]) {
  return [...items].sort((left, right) => {
    if (left.isDefault !== right.isDefault) {
      return left.isDefault ? -1 : 1;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });
}

function formatProvider(value: CisPaymentVaultProviderKey) {
  switch (value) {
    case 'ebizcharge':
      return 'eBizCharge';
    case 'moneris':
      return 'Moneris';
    case 'unknown':
      return 'Unknown';
  }
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

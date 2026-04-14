'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  List,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { AccountDetail } from '@pulse/contracts';
import { updateAccountRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function CustomerOverview(
  { account, onUpdated, canEdit }: { account: AccountDetail; onUpdated: () => Promise<void> | void; canEdit: boolean },
) {
  const { auth, apiBaseUrl } = usePulseSession();
  const [editOpened, setEditOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [legalName, setLegalName] = useState(account.legalName ?? '');
  const [accountType, setAccountType] = useState(account.accountType ?? '');
  const [isActive, setIsActive] = useState(account.isActive);

  const activeLocations = useMemo(
    () => account.locations.filter((location) => location.isActive),
    [account.locations],
  );
  const primaryLocation = activeLocations.find((location) => location.isPrimary) ?? activeLocations[0];

  async function handleSave() {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    try {
      await updateAccountRecord(apiBaseUrl, auth.tokens.accessToken, account.id, {
        displayName,
        legalName: legalName.trim() || null,
        accountType: accountType.trim() || null,
        isActive,
      });
      await onUpdated();
      setEditOpened(false);
      notifications.show({
        title: 'Account updated',
        message: `${displayName} has been updated in Pulse.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Account update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function openEdit() {
    setDisplayName(account.displayName);
    setLegalName(account.legalName ?? '');
    setAccountType(account.accountType ?? '');
    setIsActive(account.isActive);
    setEditOpened(true);
  }

  return (
    <Stack gap="lg">
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="md">
              <Title order={4}>Account Snapshot</Title>
              {canEdit ? (
                <Button size="xs" variant="light" onClick={openEdit}>
                  Edit Account
                </Button>
              ) : null}
            </Group>
            <Stack gap="xs">
              <MetadataRow label="Display Name" value={account.displayName} />
              <MetadataRow label="Legal Name" value={account.legalName ?? 'Not provided'} />
              <MetadataRow label="Account Type" value={account.accountType ?? 'Not classified'} />
              <MetadataRow label="Status" value={account.isActive ? 'Active' : 'Inactive'} />
              <MetadataRow label="Primary Location" value={formatLocation(primaryLocation)} />
            </Stack>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder radius="md" p="lg">
            <Stack gap="xs">
              <Title order={4}>Territory Ownership</Title>
              <MetadataRow label="Territory" value={account.territoryName ?? 'Not assigned'} />
              <MetadataRow label="Region" value={account.regionName ?? 'Not assigned'} />
              <MetadataRow label="Shipping Center" value={account.shippingCenterName ?? 'Not assigned'} />
              <MetadataRow label="TM" value={account.assignedTmName ?? 'Not assigned'} />
              <MetadataRow label="RD" value={account.assignedRdName ?? 'Not assigned'} />
              <MetadataRow label="Assignment Method" value={formatAssignmentMethod(account.territoryAssignmentMethod)} />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={4}>Account Lifecycle</Title>
          {account.sourceLeadId ? (
            <Button component={Link} href={`/leads/${account.sourceLeadId}`} variant="light" size="xs">
              View Source Lead
            </Button>
          ) : null}
        </Group>
        <Group gap="xs" mb="md">
          <Badge color="blue" variant="light">{account.contactCount} Contacts</Badge>
          <Badge color="cyan" variant="light">{account.locationCount} Locations</Badge>
          {account.territoryCode ? <Badge color="grape" variant="light">{account.territoryCode}</Badge> : null}
          {account.shippingCenterCode ? <Badge color="teal" variant="light">{account.shippingCenterCode}</Badge> : null}
        </Group>
        <List spacing="xs" size="sm">
          <List.Item>Customer activation now lives in Pulse from lead conversion through first-order confirmation.</List.Item>
          <List.Item>Account territory was carried from the lead routing decision so downstream views stay aligned.</List.Item>
          <List.Item>Operational account fields can now be maintained here while ERP-backed financial detail stays read-only until the Acumatica boundary is wired.</List.Item>
        </List>
      </Card>

      <Modal opened={editOpened} onClose={() => setEditOpened(false)} title="Edit Account" size="lg" centered>
        <Stack gap="md">
          <TextInput
            label="Display Name"
            value={displayName}
            onChange={(event) => setDisplayName(event.currentTarget.value)}
            required
          />
          <TextInput
            label="Legal Name"
            value={legalName}
            onChange={(event) => setLegalName(event.currentTarget.value)}
          />
          <Select
            label="Account Type"
            value={accountType}
            onChange={(value) => setAccountType(value ?? '')}
            data={[
              { value: 'Dealer', label: 'Dealer' },
              { value: 'Distributor', label: 'Distributor' },
              { value: 'Contractor', label: 'Contractor' },
              { value: 'Independent', label: 'Independent' },
            ]}
            clearable
          />
          <Switch
            checked={isActive}
            onChange={(event) => setIsActive(event.currentTarget.checked)}
            label="Account is active"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpened(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} loading={isSaving} disabled={!displayName.trim()}>
              Save Account
            </Button>
          </Group>
        </Stack>
      </Modal>
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

function formatLocation(location: AccountDetail['locations'][number] | undefined) {
  if (!location) {
    return 'Not provided';
  }

  return [
    location.line1,
    location.city,
    location.state,
    location.postalCode,
    location.countryCode,
  ].filter(Boolean).join(', ') || 'Not provided';
}

function formatAssignmentMethod(value: AccountDetail['territoryAssignmentMethod']) {
  switch (value) {
    case 'default_state':
      return 'Default State';
    case 'manual_override':
      return 'Manual Override';
    case 'system':
      return 'System';
    default:
      return 'Not recorded';
  }
}

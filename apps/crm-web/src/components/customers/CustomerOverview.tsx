'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { AccountDetail, AccountLifecycleStatusKey, BrandLabelReferenceSummary } from '@pulse/contracts';
import { fetchBrandLabels, updateAccountLifecycle, updateAccountRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { WorkbenchMoreMenu } from '@/components/ui/Workbench';

export function CustomerOverview(
  { account, onUpdated, canEdit }: { account: AccountDetail; onUpdated: () => Promise<void> | void; canEdit: boolean },
) {
  const { auth, apiBaseUrl } = usePulseSession();
  const [editOpened, setEditOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [legalName, setLegalName] = useState(account.legalName ?? '');
  const [accountType, setAccountType] = useState(account.accountType ?? '');
  const [brandLabelId, setBrandLabelId] = useState<string | null>(account.brandLabelId ?? null);
  const [brandLabels, setBrandLabels] = useState<BrandLabelReferenceSummary[]>([]);
  const [isActive, setIsActive] = useState(account.isActive);
  const [lifecycleOpened, setLifecycleOpened] = useState(false);
  const [isLifecycleSaving, setIsLifecycleSaving] = useState(false);
  const [nextLifecycleStatus, setNextLifecycleStatus] = useState<AccountLifecycleStatusKey>(account.lifecycleStatus);
  const [lifecycleReasonNote, setLifecycleReasonNote] = useState(account.lifecycleReasonNote ?? '');

  useEffect(() => {
    if (!auth) {
      setBrandLabels([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchBrandLabels(apiBaseUrl, auth.tokens.accessToken);
        if (!cancelled) {
          setBrandLabels(response.items);
        }
      } catch {
        if (!cancelled) {
          setBrandLabels([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  const brandLabelOptions = useMemo(
    () => brandLabels.map((brand) => ({ value: brand.id, label: brand.name })),
    [brandLabels],
  );
  const currentBrandLabel = account.brandLabelName
    ?? brandLabels.find((brand) => brand.id === account.brandLabelId)?.name
    ?? null;

  const activeLocations = useMemo(
    () => account.locations.filter((location) => location.isActive),
    [account.locations],
  );
  const primaryLocation = activeLocations.find((location) => location.isPrimary) ?? activeLocations[0];
  const lifecycleActions = canEdit ? [
    ...(account.lifecycleStatus !== 'at_risk' ? [{
      id: 'mark-at-risk',
      label: 'Mark at risk',
      color: 'warning' as const,
      onClick: () => openLifecycleModal('at_risk'),
    }] : []),
    ...(account.lifecycleStatus !== 'inactive' ? [{
      id: 'mark-inactive',
      label: 'Mark inactive',
      color: 'neutral' as const,
      onClick: () => openLifecycleModal('inactive'),
    }] : []),
    ...(account.lifecycleStatus !== 'churned' ? [{
      id: 'confirm-churn',
      label: 'Confirm churn',
      color: 'danger' as const,
      onClick: () => openLifecycleModal('churned'),
    }] : []),
    ...(account.lifecycleStatus !== 'active' ? [{
      id: 'reactivate',
      label: 'Reactivate',
      color: 'success' as const,
      onClick: () => openLifecycleModal('active'),
    }] : []),
  ] : [];

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
        brandLabelId: brandLabelId ?? null,
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
    setBrandLabelId(account.brandLabelId ?? null);
    setIsActive(account.isActive);
    setEditOpened(true);
  }

  function openLifecycleModal(status: AccountLifecycleStatusKey) {
    setNextLifecycleStatus(status);
    setLifecycleReasonNote(account.lifecycleReasonNote ?? '');
    setLifecycleOpened(true);
  }

  async function handleLifecycleSave() {
    if (!auth) {
      return;
    }

    setIsLifecycleSaving(true);
    try {
      await updateAccountLifecycle(apiBaseUrl, auth.tokens.accessToken, account.id, {
        lifecycleStatus: nextLifecycleStatus,
        lifecycleReasonNote: lifecycleReasonNote.trim() || null,
      });
      await onUpdated();
      setLifecycleOpened(false);
      notifications.show({
        title: 'Lifecycle updated',
        message: `${account.displayName} is now ${formatLifecycle(nextLifecycleStatus)}.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Lifecycle update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsLifecycleSaving(false);
    }
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
              <MetadataRow label="Brand / Private Label" value={currentBrandLabel ?? 'Not assigned'} />
              <MetadataRow label="Lifecycle" value={formatLifecycle(account.lifecycleStatus)} />
              <MetadataRow label="Record Status" value={account.isActive ? 'Active In Pulse' : 'Inactive In Pulse'} />
              <MetadataRow label="Primary Location" value={formatLocation(primaryLocation)} />
              {/* UX-A-008: source lead lineage row */}
              {account.sourceLeadId ? (
                <Group justify="space-between" align="flex-start" gap="md">
                  <Text size="sm" c="dimmed">Source Lead</Text>
                  <Text
                    component={Link}
                    href={`/leads/${account.sourceLeadId}`}
                    size="sm"
                    fw={500}
                    c="blue"
                    style={{ textDecoration: 'none' }}
                  >
                    View converted lead
                  </Text>
                </Group>
              ) : null}
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
          <Group gap="xs">
            <Badge color={lifecycleColor(account.lifecycleStatus)} variant="light">{formatLifecycle(account.lifecycleStatus)}</Badge>
            <WorkbenchMoreMenu label="Lifecycle actions" items={lifecycleActions} />
          </Group>
        </Group>
        <Group gap="xs" mb="md">
          <Badge color="blue" variant="light">{account.contactCount} Contacts</Badge>
          <Badge color="cyan" variant="light">{account.locationCount} Locations</Badge>
          {account.territoryCode ? <Badge color="grape" variant="light">{account.territoryCode}</Badge> : null}
          {account.shippingCenterCode ? <Badge color="teal" variant="light">{account.shippingCenterCode}</Badge> : null}
          {!account.isActive ? <Badge color="gray" variant="outline">Record Inactive</Badge> : null}
        </Group>
        <Stack gap="xs" mb="md">
          <MetadataRow label="Lifecycle Changed" value={formatDate(account.lifecycleStatusChangedAt)} />
          <MetadataRow label="Last Order" value={formatDate(account.lastOrderAt)} />
          <MetadataRow label="Last Engagement" value={formatDate(account.lastEngagementAt)} />
          <MetadataRow label="Lifecycle Note" value={account.lifecycleReasonNote ?? 'Not recorded'} />
        </Stack>
        <List spacing="xs" size="sm">
          <List.Item>Customer activation now lives in Pulse from lead conversion through first-order confirmation.</List.Item>
          <List.Item>Lifecycle state is tracked separately from archive/inactive record status so churn and operating risk stay visible.</List.Item>
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
          <Select
            label="Brand / Private Label"
            placeholder="No brand assigned"
            value={brandLabelId}
            onChange={(value) => setBrandLabelId(value)}
            data={brandLabelOptions}
            clearable
            searchable
          />
          <Switch
            checked={isActive}
            onChange={(event) => setIsActive(event.currentTarget.checked)}
            label="Record is active in Pulse"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpened(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} loading={isSaving} disabled={!displayName.trim()}>
              Save Account
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={lifecycleOpened} onClose={() => setLifecycleOpened(false)} title="Update Account Lifecycle" centered>
        <Stack gap="md">
          <Select
            label="Lifecycle status"
            value={nextLifecycleStatus}
            onChange={(value) => setNextLifecycleStatus((value as AccountLifecycleStatusKey | null) ?? account.lifecycleStatus)}
            data={[
              { value: 'active', label: 'Active' },
              { value: 'at_risk', label: 'At Risk' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'churned', label: 'Churned' },
            ]}
            allowDeselect={false}
          />
          {/* UX-A-003: reason required for at_risk / inactive / churned transitions */}
          <Textarea
            label="Lifecycle note"
            description={
              nextLifecycleStatus === 'at_risk' || nextLifecycleStatus === 'inactive' || nextLifecycleStatus === 'churned'
                ? 'Required — describe the reason for this transition so the follow-up queue shows context.'
                : 'Optional operator context.'
            }
            value={lifecycleReasonNote}
            onChange={(event) => setLifecycleReasonNote(event.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setLifecycleOpened(false)}>Cancel</Button>
            <Button
              onClick={() => void handleLifecycleSave()}
              loading={isLifecycleSaving}
              disabled={
                (nextLifecycleStatus === 'at_risk' || nextLifecycleStatus === 'inactive' || nextLifecycleStatus === 'churned')
                && !lifecycleReasonNote.trim()
              }
            >
              Save Lifecycle
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

function lifecycleColor(status: AccountLifecycleStatusKey) {
  switch (status) {
    case 'active':
      return 'green';
    case 'at_risk':
      return 'yellow';
    case 'inactive':
      return 'gray';
    case 'churned':
      return 'red';
  }
}

function formatLifecycle(status: AccountLifecycleStatusKey) {
  return status === 'at_risk'
    ? 'At Risk'
    : status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not recorded';
  }

  return new Date(value).toLocaleDateString();
}

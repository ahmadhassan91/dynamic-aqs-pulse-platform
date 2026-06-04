'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Paper,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Stepper,
  Switch,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowsShuffle,
  IconBuildingWarehouse,
  IconMapPin,
  IconPlus,
  IconRouteSquare,
} from '@tabler/icons-react';
import type {
  AccountSummary,
  LeadSummary,
  ListTerritoryAssignableUsersResponse,
  RegionSummary,
  ShippingCenterSummary,
  TerritorySummary,
} from '@pulse/contracts';
import {
  bulkReassignAccountsTerritory,
  bulkReassignLeadsTerritory,
  createTerritoryRecord,
  createTerritoryRegion,
  createTerritoryShippingCenter,
  replaceTerritoryCoverage,
  updateTerritoryRecord,
} from '@/lib/pulse-api';
import { RowActionMenu } from '@/components/ui/Workbench';

const BULK_REASON_OPTIONS = [
  { value: 'territory_realignment', label: 'Territory Realignment' },
  { value: 'manual_override', label: 'Manual Override' },
  { value: 'coverage_exception', label: 'Coverage Exception' },
  { value: 'shipping_alignment', label: 'Shipping Alignment' },
  { value: 'data_cleanup', label: 'Data Cleanup' },
] as const;

type TerritoryOpsQueueView = 'accounts' | 'leads' | 'setup';
type TerritorySetupStep = 'region' | 'shipping' | 'territory' | 'review';

const TERRITORY_SETUP_STEPS: Array<{ value: TerritorySetupStep; label: string; description: string }> = [
  { value: 'region', label: 'Region', description: 'Create or confirm the regional container.' },
  { value: 'shipping', label: 'Shipping hub', description: 'Create or confirm the shipping center.' },
  { value: 'territory', label: 'Territory', description: 'Create a territory and assign ownership.' },
  { value: 'review', label: 'Coverage review', description: 'Review or edit live coverage and ownership.' },
];

function formatAccountLifecycle(value: string) {
  return value.replace(/_/g, ' ');
}

function normalizeCoverageTags(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0),
    ),
  );
}

export function TerritoryOperationsPanel({
  apiBaseUrl,
  accessToken,
  regions,
  shippingCenters,
  territories,
  activeAccounts,
  activeLeads,
  assignableUsers,
  canAdminTerritory,
  canReassignTerritory,
  onRefresh,
  onOpenAccountHistory,
  onOpenLeadHistory,
}: {
  apiBaseUrl: string;
  accessToken: string;
  regions: RegionSummary[];
  shippingCenters: ShippingCenterSummary[];
  territories: TerritorySummary[];
  activeAccounts: AccountSummary[];
  activeLeads: LeadSummary[];
  assignableUsers: ListTerritoryAssignableUsersResponse;
  canAdminTerritory: boolean;
  canReassignTerritory: boolean;
  onRefresh: () => void;
  onOpenAccountHistory: (account: AccountSummary) => void;
  onOpenLeadHistory: (lead: LeadSummary) => void;
}) {
  const router = useRouter();
  const [queueView, setQueueView] = useState<TerritoryOpsQueueView>(canReassignTerritory ? 'accounts' : 'setup');
  const [activeSetupStep, setActiveSetupStep] = useState<TerritorySetupStep>('region');
  const [accountSearch, setAccountSearch] = useState('');
  const [sourceTerritoryFilter, setSourceTerritoryFilter] = useState<string | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [bulkTargetTerritoryId, setBulkTargetTerritoryId] = useState('');
  const [bulkAssignedTmUserId, setBulkAssignedTmUserId] = useState('');
  const [bulkAssignedRdUserId, setBulkAssignedRdUserId] = useState('');
  const [bulkReasonCode, setBulkReasonCode] = useState('territory_realignment');
  const [bulkReasonNote, setBulkReasonNote] = useState('');
  const [isSavingBulkTransfer, setIsSavingBulkTransfer] = useState(false);
  const [leadSearch, setLeadSearch] = useState('');
  const [leadTerritoryFilter, setLeadTerritoryFilter] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkLeadTargetTerritoryId, setBulkLeadTargetTerritoryId] = useState('');
  const [bulkLeadAssignedTmUserId, setBulkLeadAssignedTmUserId] = useState('');
  const [bulkLeadAssignedRdUserId, setBulkLeadAssignedRdUserId] = useState('');
  const [bulkLeadReasonCode, setBulkLeadReasonCode] = useState('territory_realignment');
  const [bulkLeadReasonNote, setBulkLeadReasonNote] = useState('');
  const [isSavingBulkLeadTransfer, setIsSavingBulkLeadTransfer] = useState(false);

  const [newRegionCode, setNewRegionCode] = useState('');
  const [newRegionName, setNewRegionName] = useState('');
  const [newRegionDirectorUserId, setNewRegionDirectorUserId] = useState('');
  const [newRegionNotes, setNewRegionNotes] = useState('');
  const [newRegionIsActive, setNewRegionIsActive] = useState(true);
  const [isSavingRegion, setIsSavingRegion] = useState(false);

  const [newShippingCenterCode, setNewShippingCenterCode] = useState('');
  const [newShippingCenterName, setNewShippingCenterName] = useState('');
  const [newShippingCenterCity, setNewShippingCenterCity] = useState('');
  const [newShippingCenterState, setNewShippingCenterState] = useState('');
  const [newShippingCenterCountryCode, setNewShippingCenterCountryCode] = useState('US');
  const [newShippingCenterNotes, setNewShippingCenterNotes] = useState('');
  const [newShippingCenterIsActive, setNewShippingCenterIsActive] = useState(true);
  const [isSavingShippingCenter, setIsSavingShippingCenter] = useState(false);

  const [newTerritoryCode, setNewTerritoryCode] = useState('');
  const [newTerritoryName, setNewTerritoryName] = useState('');
  const [newTerritoryRegionId, setNewTerritoryRegionId] = useState('');
  const [newTerritoryManagerUserId, setNewTerritoryManagerUserId] = useState('');
  const [newTerritoryShippingCenterId, setNewTerritoryShippingCenterId] = useState('');
  const [newTerritoryNotes, setNewTerritoryNotes] = useState('');
  const [newTerritoryCoverage, setNewTerritoryCoverage] = useState<string[]>([]);
  const [newTerritoryIsActive, setNewTerritoryIsActive] = useState(true);
  const [isSavingTerritory, setIsSavingTerritory] = useState(false);

  const [editingTerritoryId, setEditingTerritoryId] = useState('');
  const [editTerritoryName, setEditTerritoryName] = useState('');
  const [editTerritoryRegionId, setEditTerritoryRegionId] = useState('');
  const [editTerritoryManagerUserId, setEditTerritoryManagerUserId] = useState('');
  const [editTerritoryShippingCenterId, setEditTerritoryShippingCenterId] = useState('');
  const [editTerritoryNotes, setEditTerritoryNotes] = useState('');
  const [editTerritoryCoverage, setEditTerritoryCoverage] = useState<string[]>([]);
  const [editTerritoryIsActive, setEditTerritoryIsActive] = useState(true);
  const [isUpdatingTerritory, setIsUpdatingTerritory] = useState(false);

  const queueOptions = useMemo(
    () => [
      ...(canReassignTerritory ? [
        { value: 'accounts', label: `Accounts (${activeAccounts.length})` },
        { value: 'leads', label: `Leads (${activeLeads.length})` },
      ] : []),
      ...(canAdminTerritory ? [{ value: 'setup', label: 'Setup & transfers' }] : []),
    ],
    [activeAccounts.length, activeLeads.length, canAdminTerritory, canReassignTerritory],
  );

  const activeSetupStepIndex = Math.max(
    TERRITORY_SETUP_STEPS.findIndex((step) => step.value === activeSetupStep),
    0,
  );

  useEffect(() => {
    if (queueView === 'setup' && !canAdminTerritory) {
      setQueueView(canReassignTerritory ? 'accounts' : 'setup');
      return;
    }

    if ((queueView === 'accounts' || queueView === 'leads') && !canReassignTerritory) {
      setQueueView(canAdminTerritory ? 'setup' : 'accounts');
    }
  }, [canAdminTerritory, canReassignTerritory, queueView]);

  const territorySelectData = useMemo(
    () =>
      territories
        .filter((territory) => territory.isActive)
        .map((territory) => ({
          value: territory.id,
          label: `${territory.code} · ${territory.name}`,
        })),
    [territories],
  );

  const territoryManagerSelectData = useMemo(
    () =>
      assignableUsers.territoryManagers.map((user) => ({
        value: user.userId,
        label: `${user.displayName} · ${user.email}`,
      })),
    [assignableUsers.territoryManagers],
  );

  const regionalDirectorSelectData = useMemo(
    () =>
      assignableUsers.regionalDirectors.map((user) => ({
        value: user.userId,
        label: `${user.displayName} · ${user.email}`,
      })),
    [assignableUsers.regionalDirectors],
  );

  const regionSelectData = useMemo(
    () =>
      regions.map((region) => ({
        value: region.id,
        label: `${region.code} · ${region.name}`,
      })),
    [regions],
  );

  const shippingCenterSelectData = useMemo(
    () =>
      shippingCenters
        .filter((center) => center.isActive)
        .map((center) => ({
          value: center.id,
          label: `${center.code} · ${center.name}`,
        })),
    [shippingCenters],
  );

  const filteredAccounts = useMemo(() => {
    return activeAccounts.filter((account) => {
      const matchesSearch = !accountSearch
        || account.displayName.toLowerCase().includes(accountSearch.toLowerCase())
        || account.accountType?.toLowerCase().includes(accountSearch.toLowerCase())
        || account.territoryName?.toLowerCase().includes(accountSearch.toLowerCase());
      const matchesSourceTerritory = !sourceTerritoryFilter
        || (sourceTerritoryFilter === 'unassigned'
          ? !account.territoryId
          : account.territoryId === sourceTerritoryFilter);
      return matchesSearch && matchesSourceTerritory;
    });
  }, [accountSearch, activeAccounts, sourceTerritoryFilter]);

  const selectedAccounts = useMemo(
    () => activeAccounts.filter((account) => selectedAccountIds.includes(account.id)),
    [activeAccounts, selectedAccountIds],
  );

  const filteredLeads = useMemo(() => {
    return activeLeads.filter((lead) => {
      const search = leadSearch.toLowerCase();
      const matchesSearch = !search
        || lead.companyName.toLowerCase().includes(search)
        || lead.stage.toLowerCase().includes(search)
        || lead.state?.toLowerCase().includes(search)
        || lead.territoryName?.toLowerCase().includes(search);
      const matchesTerritory = !leadTerritoryFilter
        || (leadTerritoryFilter === 'unassigned'
          ? !lead.territoryId
          : lead.territoryId === leadTerritoryFilter);
      return matchesSearch && matchesTerritory;
    });
  }, [activeLeads, leadSearch, leadTerritoryFilter]);

  const selectedLeads = useMemo(
    () => activeLeads.filter((lead) => selectedLeadIds.includes(lead.id)),
    [activeLeads, selectedLeadIds],
  );

  const visibleSelectedLeadCount = useMemo(
    () => filteredLeads.filter((lead) => selectedLeadIds.includes(lead.id)).length,
    [filteredLeads, selectedLeadIds],
  );

  const visibleSelectedCount = useMemo(
    () => filteredAccounts.filter((account) => selectedAccountIds.includes(account.id)).length,
    [filteredAccounts, selectedAccountIds],
  );

  useEffect(() => {
    if (!editingTerritoryId) {
      return;
    }

    const territory = territories.find((item) => item.id === editingTerritoryId);
    if (!territory) {
      return;
    }

    setEditTerritoryName(territory.name);
    setEditTerritoryRegionId(territory.regionId);
    setEditTerritoryManagerUserId(territory.managerUserId ?? '');
    setEditTerritoryShippingCenterId(territory.shippingCenterId ?? '');
    setEditTerritoryNotes(territory.notes ?? '');
    setEditTerritoryCoverage(territory.coverageStates);
    setEditTerritoryIsActive(territory.isActive);
  }, [editingTerritoryId, territories]);

  function toggleAccountSelection(accountId: string, checked: boolean) {
    setSelectedAccountIds((current) => {
      if (checked) {
        return current.includes(accountId) ? current : [...current, accountId];
      }
      return current.filter((value) => value !== accountId);
    });
  }

  function toggleAllVisibleAccounts(checked: boolean) {
    setSelectedAccountIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredAccounts.map((account) => account.id)]));
      }
      const visibleIds = new Set(filteredAccounts.map((account) => account.id));
      return current.filter((accountId) => !visibleIds.has(accountId));
    });
  }

  function toggleLeadSelection(leadId: string, checked: boolean) {
    setSelectedLeadIds((current) => {
      if (checked) {
        return current.includes(leadId) ? current : [...current, leadId];
      }
      return current.filter((value) => value !== leadId);
    });
  }

  function toggleAllVisibleLeads(checked: boolean) {
    setSelectedLeadIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...filteredLeads.map((lead) => lead.id)]));
      }
      const visibleIds = new Set(filteredLeads.map((lead) => lead.id));
      return current.filter((leadId) => !visibleIds.has(leadId));
    });
  }

  async function handleBulkTransfer() {
    if (!bulkTargetTerritoryId || selectedAccountIds.length === 0) {
      return;
    }

    setIsSavingBulkTransfer(true);
    try {
      const response = await bulkReassignAccountsTerritory(apiBaseUrl, accessToken, {
        accountIds: selectedAccountIds,
        territoryId: bulkTargetTerritoryId,
        assignedTmUserId: bulkAssignedTmUserId || null,
        assignedRdUserId: bulkAssignedRdUserId || null,
        reasonCode: bulkReasonCode,
        ...(bulkReasonNote.trim() ? { reasonNote: bulkReasonNote.trim() } : {}),
      });

      notifications.show({
        title: 'Bulk transfer complete',
        message: `${response.items.length} accounts were reassigned to the selected territory.`,
        color: 'green',
      });

      setSelectedAccountIds([]);
      setBulkTargetTerritoryId('');
      setBulkAssignedTmUserId('');
      setBulkAssignedRdUserId('');
      setBulkReasonCode('territory_realignment');
      setBulkReasonNote('');
      onRefresh();
    } catch (error) {
      notifications.show({
        title: 'Bulk transfer failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingBulkTransfer(false);
    }
  }

  async function handleBulkLeadTransfer() {
    if (!bulkLeadTargetTerritoryId || selectedLeadIds.length === 0) {
      return;
    }

    setIsSavingBulkLeadTransfer(true);
    try {
      const response = await bulkReassignLeadsTerritory(apiBaseUrl, accessToken, {
        leadIds: selectedLeadIds,
        territoryId: bulkLeadTargetTerritoryId,
        assignedTmUserId: bulkLeadAssignedTmUserId || null,
        assignedRdUserId: bulkLeadAssignedRdUserId || null,
        reasonCode: bulkLeadReasonCode,
        ...(bulkLeadReasonNote.trim() ? { reasonNote: bulkLeadReasonNote.trim() } : {}),
      });

      notifications.show({
        title: 'Bulk lead transfer complete',
        message: `${response.items.length} leads were reassigned to the selected territory.`,
        color: 'green',
      });

      setSelectedLeadIds([]);
      setBulkLeadTargetTerritoryId('');
      setBulkLeadAssignedTmUserId('');
      setBulkLeadAssignedRdUserId('');
      setBulkLeadReasonCode('territory_realignment');
      setBulkLeadReasonNote('');
      onRefresh();
    } catch (error) {
      notifications.show({
        title: 'Bulk lead transfer failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingBulkLeadTransfer(false);
    }
  }

  async function handleCreateRegion() {
    if (!newRegionCode.trim() || !newRegionName.trim()) {
      return;
    }

    setIsSavingRegion(true);
    try {
      await createTerritoryRegion(apiBaseUrl, accessToken, {
        code: newRegionCode.trim(),
        name: newRegionName.trim(),
        ...(newRegionDirectorUserId ? { directorUserId: newRegionDirectorUserId } : {}),
        ...(newRegionNotes.trim() ? { notes: newRegionNotes.trim() } : {}),
        isActive: newRegionIsActive,
      });

      notifications.show({
        title: 'Region created',
        message: `${newRegionName.trim()} is now available for territory assignment.`,
        color: 'green',
      });

      setNewRegionCode('');
      setNewRegionName('');
      setNewRegionDirectorUserId('');
      setNewRegionNotes('');
      setNewRegionIsActive(true);
      onRefresh();
    } catch (error) {
      notifications.show({
        title: 'Region creation failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingRegion(false);
    }
  }

  async function handleCreateShippingCenter() {
    if (!newShippingCenterCode.trim() || !newShippingCenterName.trim()) {
      return;
    }

    setIsSavingShippingCenter(true);
    try {
      await createTerritoryShippingCenter(apiBaseUrl, accessToken, {
        code: newShippingCenterCode.trim(),
        name: newShippingCenterName.trim(),
        ...(newShippingCenterCity.trim() ? { city: newShippingCenterCity.trim() } : {}),
        ...(newShippingCenterState.trim() ? { state: newShippingCenterState.trim() } : {}),
        ...(newShippingCenterCountryCode.trim() ? { countryCode: newShippingCenterCountryCode.trim().toUpperCase() } : {}),
        ...(newShippingCenterNotes.trim() ? { notes: newShippingCenterNotes.trim() } : {}),
        isActive: newShippingCenterIsActive,
      });

      notifications.show({
        title: 'Shipping center created',
        message: `${newShippingCenterName.trim()} is now available for territory alignment.`,
        color: 'green',
      });

      setNewShippingCenterCode('');
      setNewShippingCenterName('');
      setNewShippingCenterCity('');
      setNewShippingCenterState('');
      setNewShippingCenterCountryCode('US');
      setNewShippingCenterNotes('');
      setNewShippingCenterIsActive(true);
      onRefresh();
    } catch (error) {
      notifications.show({
        title: 'Shipping center creation failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingShippingCenter(false);
    }
  }

  async function handleCreateTerritory() {
    if (!newTerritoryCode.trim() || !newTerritoryName.trim() || !newTerritoryRegionId) {
      return;
    }

    setIsSavingTerritory(true);
    try {
      const territory = await createTerritoryRecord(apiBaseUrl, accessToken, {
        code: newTerritoryCode.trim(),
        name: newTerritoryName.trim(),
        regionId: newTerritoryRegionId,
        ...(newTerritoryManagerUserId ? { managerUserId: newTerritoryManagerUserId } : {}),
        ...(newTerritoryShippingCenterId ? { shippingCenterId: newTerritoryShippingCenterId } : {}),
        ...(newTerritoryNotes.trim() ? { notes: newTerritoryNotes.trim() } : {}),
        isActive: newTerritoryIsActive,
      });

      const coverage = normalizeCoverageTags(newTerritoryCoverage);
      if (coverage.length > 0) {
        await replaceTerritoryCoverage(apiBaseUrl, accessToken, territory.id, {
          coverage: coverage.map((stateCode) => ({ stateCode })),
        });
      }

      notifications.show({
        title: 'Territory created',
        message: `${newTerritoryName.trim()} is live with ${coverage.length} covered states/provinces.`,
        color: 'green',
      });

      setNewTerritoryCode('');
      setNewTerritoryName('');
      setNewTerritoryRegionId('');
      setNewTerritoryManagerUserId('');
      setNewTerritoryShippingCenterId('');
      setNewTerritoryNotes('');
      setNewTerritoryCoverage([]);
      setNewTerritoryIsActive(true);
      onRefresh();
    } catch (error) {
      notifications.show({
        title: 'Territory creation failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingTerritory(false);
    }
  }

  async function handleUpdateTerritory() {
    if (!editingTerritoryId || !editTerritoryName.trim() || !editTerritoryRegionId) {
      return;
    }

    setIsUpdatingTerritory(true);
    try {
      await updateTerritoryRecord(apiBaseUrl, accessToken, editingTerritoryId, {
        name: editTerritoryName.trim(),
        regionId: editTerritoryRegionId,
        managerUserId: editTerritoryManagerUserId || null,
        shippingCenterId: editTerritoryShippingCenterId || null,
        notes: editTerritoryNotes.trim() || null,
        isActive: editTerritoryIsActive,
      });

      await replaceTerritoryCoverage(apiBaseUrl, accessToken, editingTerritoryId, {
        coverage: normalizeCoverageTags(editTerritoryCoverage).map((stateCode) => ({ stateCode })),
      });

      notifications.show({
        title: 'Territory updated',
        message: 'Ownership, shipping alignment, and covered states were refreshed.',
        color: 'green',
      });

      onRefresh();
    } catch (error) {
      notifications.show({
        title: 'Territory update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsUpdatingTerritory(false);
    }
  }

  return (
    <Stack gap="lg">
      <Alert icon={<IconAlertCircle size={16} />} color="blue" variant="light" radius="xl">
        {canAdminTerritory
          ? 'Use one lane at a time: transfer accounts, transfer leads, or step through territory setup. Every assignment change keeps an audit trail.'
          : 'Use these work queues to rebalance scoped accounts and leads with an audited reassignment. Region, shipping-center, and coverage setup is read-only for this role.'}
      </Alert>

      {queueOptions.length > 1 ? (
        <SegmentedControl
          value={queueView}
          onChange={(value) => setQueueView(value as TerritoryOpsQueueView)}
          data={queueOptions}
          fullWidth
        />
      ) : null}

      {canReassignTerritory ? (
        <Stack gap="lg">
        <Paper
          withBorder
          radius="xl"
          p="lg"
          className="premium-stat-card"
          style={{ display: queueView === 'accounts' ? undefined : 'none' }}
        >
          <Stack gap="lg">
            <Group gap="sm">
              <Paper radius="xl" p="xs" bg="orange.0">
                <IconArrowsShuffle size={18} />
              </Paper>
              <div>
                <Title order={4}>Bulk customer transfer</Title>
                <Text size="sm" c="dimmed">
                  Move multiple active customer accounts to the right territory using one audited operation. Every
                  account still keeps its own assignment history.
                </Text>
              </div>
            </Group>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <TextInput
                label="Search accounts"
                placeholder="Search by account, type, or territory"
                value={accountSearch}
                onChange={(event) => setAccountSearch(event.currentTarget.value)}
              />
              <Select
                label="Current territory"
                placeholder="All territories"
                data={[
                  { value: 'unassigned', label: 'Unassigned' },
                  ...territorySelectData,
                ]}
                value={sourceTerritoryFilter}
                onChange={setSourceTerritoryFilter}
                clearable
                searchable
              />
            </SimpleGrid>

            {selectedAccountIds.length > 0 ? (
              <>
                <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
                  <Select
                    label="Target territory"
                    placeholder="Select target territory"
                    data={territorySelectData}
                    value={bulkTargetTerritoryId}
                    onChange={(value) => setBulkTargetTerritoryId(value ?? '')}
                    searchable
                  />
                  <Select
                    label="Named TM override"
                    placeholder="Use territory default TM"
                    data={territoryManagerSelectData}
                    value={bulkAssignedTmUserId}
                    onChange={(value) => setBulkAssignedTmUserId(value ?? '')}
                    searchable
                    clearable
                  />
                  <Select
                    label="Named RD override"
                    placeholder="Use region default RD"
                    data={regionalDirectorSelectData}
                    value={bulkAssignedRdUserId}
                    onChange={(value) => setBulkAssignedRdUserId(value ?? '')}
                    searchable
                    clearable
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <Select
                    label="Reason"
                    data={BULK_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    value={bulkReasonCode}
                    onChange={(value) => setBulkReasonCode(value ?? 'territory_realignment')}
                  />
                  <Textarea
                    label="Transfer note"
                    placeholder="Add optional context for the mass-transfer audit trail."
                    minRows={2}
                    value={bulkReasonNote}
                    onChange={(event) => setBulkReasonNote(event.currentTarget.value)}
                  />
                </SimpleGrid>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                Select one or more accounts, then choose the target territory and audit reason.
              </Text>
            )}

            <Paper withBorder radius="lg" p="md">
              <Group justify="space-between" mb="sm">
                <Checkbox
                  checked={filteredAccounts.length > 0 && visibleSelectedCount === filteredAccounts.length}
                  indeterminate={visibleSelectedCount > 0 && visibleSelectedCount < filteredAccounts.length}
                  onChange={(event) => toggleAllVisibleAccounts(event.currentTarget.checked)}
                  label={`Select visible accounts (${filteredAccounts.length})`}
                />
                <Badge color={selectedAccounts.length > 0 ? 'blue' : 'gray'} variant="light">
                  {selectedAccounts.length} selected
                </Badge>
              </Group>

              <Table.ScrollContainer minWidth={980}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={48}></Table.Th>
                      <Table.Th>Account</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Current Territory</Table.Th>
                      <Table.Th>Lifecycle</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredAccounts.length > 0 ? (
                      filteredAccounts.map((account) => (
                        <Table.Tr key={account.id}>
                          <Table.Td>
                            <Checkbox
                              checked={selectedAccountIds.includes(account.id)}
                              onChange={(event) => toggleAccountSelection(account.id, event.currentTarget.checked)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text fw={600}>{account.displayName}</Text>
                              <Text size="xs" c="dimmed">
                                {account.assignedTmName ?? 'TM unassigned'} · {account.assignedRdName ?? 'RD unassigned'}
                              </Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>{account.accountType ?? 'Customer'}</Table.Td>
                          <Table.Td>{account.territoryName ?? account.territoryCode ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{formatAccountLifecycle(account.lifecycleStatus)}</Table.Td>
	                          <Table.Td>
	                            <RowActionMenu
	                              items={[
	                                {
	                                  id: 'open-account',
	                                  label: 'Open account',
	                                  onClick: () => router.push(`/customers/${account.id}`),
	                                },
	                                {
	                                  id: 'assignment-history',
	                                  label: 'Assignment history',
	                                  onClick: () => onOpenAccountHistory(account),
	                                },
	                              ]}
	                            />
	                          </Table.Td>
                        </Table.Tr>
                      ))
                    ) : (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text size="sm" c="dimmed" ta="center" py="md">
                            No active customer accounts match the current filters.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            <Group justify="flex-end">
              <Button
                leftSection={<IconArrowsShuffle size={16} />}
                loading={isSavingBulkTransfer}
                disabled={selectedAccountIds.length === 0 || !bulkTargetTerritoryId}
                onClick={() => {
                  void handleBulkTransfer();
                }}
              >
                Transfer selected accounts
              </Button>
            </Group>
          </Stack>
        </Paper>

        <Paper
          withBorder
          radius="xl"
          p="lg"
          className="premium-stat-card"
          style={{ display: queueView === 'leads' ? undefined : 'none' }}
        >
          <Stack gap="lg">
            <Group gap="sm">
              <Paper radius="xl" p="xs" bg="blue.0">
                <IconArrowsShuffle size={18} />
              </Paper>
              <div>
                <Title order={4}>Bulk lead transfer</Title>
                <Text size="sm" c="dimmed">
                  Move multiple active pipeline leads to a target territory or named TM/RD with one audited override.
                </Text>
              </div>
            </Group>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
              <TextInput
                label="Search leads"
                placeholder="Search by company, state, stage, or territory"
                value={leadSearch}
                onChange={(event) => setLeadSearch(event.currentTarget.value)}
              />
              <Select
                label="Current territory"
                placeholder="All territories"
                data={[
                  { value: 'unassigned', label: 'Unassigned' },
                  ...territorySelectData,
                ]}
                value={leadTerritoryFilter}
                onChange={setLeadTerritoryFilter}
                clearable
                searchable
              />
            </SimpleGrid>

            {selectedLeadIds.length > 0 ? (
              <>
                <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
                  <Select
                    label="Target territory"
                    placeholder="Select target territory"
                    data={territorySelectData}
                    value={bulkLeadTargetTerritoryId}
                    onChange={(value) => setBulkLeadTargetTerritoryId(value ?? '')}
                    searchable
                  />
                  <Select
                    label="Named TM override"
                    placeholder="Use territory default TM"
                    data={territoryManagerSelectData}
                    value={bulkLeadAssignedTmUserId}
                    onChange={(value) => setBulkLeadAssignedTmUserId(value ?? '')}
                    searchable
                    clearable
                  />
                  <Select
                    label="Named RD override"
                    placeholder="Use region default RD"
                    data={regionalDirectorSelectData}
                    value={bulkLeadAssignedRdUserId}
                    onChange={(value) => setBulkLeadAssignedRdUserId(value ?? '')}
                    searchable
                    clearable
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
                  <Select
                    label="Reason"
                    data={BULK_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                    value={bulkLeadReasonCode}
                    onChange={(value) => setBulkLeadReasonCode(value ?? 'territory_realignment')}
                  />
                  <Textarea
                    label="Transfer note"
                    placeholder="Add optional context for the lead reassignment audit trail."
                    minRows={2}
                    value={bulkLeadReasonNote}
                    onChange={(event) => setBulkLeadReasonNote(event.currentTarget.value)}
                  />
                </SimpleGrid>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                Select one or more leads, then choose the target territory and audit reason.
              </Text>
            )}

            <Paper withBorder radius="lg" p="md">
              <Group justify="space-between" mb="sm">
                <Checkbox
                  checked={filteredLeads.length > 0 && visibleSelectedLeadCount === filteredLeads.length}
                  indeterminate={visibleSelectedLeadCount > 0 && visibleSelectedLeadCount < filteredLeads.length}
                  onChange={(event) => toggleAllVisibleLeads(event.currentTarget.checked)}
                  label={`Select visible leads (${filteredLeads.length})`}
                />
                <Badge color={selectedLeads.length > 0 ? 'blue' : 'gray'} variant="light">
                  {selectedLeads.length} selected
                </Badge>
              </Group>

              <Table.ScrollContainer minWidth={980}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={48}></Table.Th>
                      <Table.Th>Lead</Table.Th>
                      <Table.Th>Stage</Table.Th>
                      <Table.Th>State</Table.Th>
                      <Table.Th>Current Territory</Table.Th>
                      <Table.Th>Owner</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map((lead) => (
                        <Table.Tr key={lead.id}>
                          <Table.Td>
                            <Checkbox
                              checked={selectedLeadIds.includes(lead.id)}
                              onChange={(event) => toggleLeadSelection(lead.id, event.currentTarget.checked)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600}>{lead.companyName}</Text>
                          </Table.Td>
                          <Table.Td>{lead.stage.replace(/_/g, ' ')}</Table.Td>
                          <Table.Td>{lead.state ?? 'N/A'}</Table.Td>
                          <Table.Td>{lead.territoryName ?? lead.territoryCode ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{lead.assignedTmName ?? lead.assignedRdName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>
                            <RowActionMenu
                              label={`Actions for ${lead.companyName}`}
                              items={[
                                {
                                  id: 'open-lead',
                                  label: 'Open lead',
                                  onClick: () => router.push(`/leads/${lead.id}`),
                                },
                                {
                                  id: 'assignment-history',
                                  label: 'Assignment history',
                                  onClick: () => onOpenLeadHistory(lead),
                                },
                              ]}
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))
                    ) : (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text size="sm" c="dimmed" ta="center" py="md">
                            No active leads match the current filters.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            <Group justify="flex-end">
              <Button
                leftSection={<IconArrowsShuffle size={16} />}
                loading={isSavingBulkLeadTransfer}
                disabled={selectedLeadIds.length === 0 || !bulkLeadTargetTerritoryId}
                onClick={() => {
                  void handleBulkLeadTransfer();
                }}
              >
                Transfer selected leads
              </Button>
            </Group>
          </Stack>
        </Paper>
        </Stack>
      ) : null}

      {canAdminTerritory && queueView === 'setup' ? (
        <Paper withBorder radius="xl" p="lg" className="premium-stat-card" data-testid="territory-setup-stepper">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <Group gap="sm" align="flex-start">
                <Paper radius="xl" p="xs" bg="blue.0">
                  <IconMapPin size={18} />
                </Paper>
                <div>
                  <Title order={4}>Territory setup</Title>
                  <Text size="sm" c="dimmed">
                    Step through setup in order so region, shipping, territory ownership, and coverage review do not compete on one screen.
                  </Text>
                </div>
              </Group>
              <Badge color="blue" variant="light">
                {TERRITORY_SETUP_STEPS[activeSetupStepIndex]?.label ?? 'Setup'}
              </Badge>
            </Group>

            <Stepper
              active={activeSetupStepIndex}
              onStepClick={(index) => setActiveSetupStep(TERRITORY_SETUP_STEPS[index]?.value ?? 'region')}
              allowNextStepsSelect
            >
              {TERRITORY_SETUP_STEPS.map((step) => (
                <Stepper.Step key={step.value} label={step.label} description={step.description} />
              ))}
            </Stepper>

            {activeSetupStep === 'region' ? (
              <Paper withBorder radius="lg" p="md" data-testid="territory-region-step">
                <Stack gap="md">
                  <Group gap="sm">
                    <Paper radius="xl" p="xs" bg="blue.0">
                      <IconMapPin size={18} />
                    </Paper>
                    <div>
                      <Title order={5}>Create region</Title>
                      <Text size="sm" c="dimmed">
                        Stand up a regional container before assigning territories into it.
                      </Text>
                    </div>
                  </Group>
                  <TextInput label="Region code" value={newRegionCode} onChange={(event) => setNewRegionCode(event.currentTarget.value)} />
                  <TextInput label="Region name" value={newRegionName} onChange={(event) => setNewRegionName(event.currentTarget.value)} />
                  <Select
                    label="Regional director"
                    placeholder="Assign later"
                    data={regionalDirectorSelectData}
                    value={newRegionDirectorUserId}
                    onChange={(value) => setNewRegionDirectorUserId(value ?? '')}
                    searchable
                    clearable
                  />
                  <Textarea
                    label="Notes"
                    minRows={2}
                    value={newRegionNotes}
                    onChange={(event) => setNewRegionNotes(event.currentTarget.value)}
                  />
                  <Switch
                    checked={newRegionIsActive}
                    onChange={(event) => setNewRegionIsActive(event.currentTarget.checked)}
                    label="Region is active"
                  />
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Existing regions: {regions.length}
                    </Text>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      loading={isSavingRegion}
                      onClick={() => {
                        void handleCreateRegion();
                      }}
                    >
                      Create region
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            {activeSetupStep === 'shipping' ? (
              <Paper withBorder radius="lg" p="md" data-testid="territory-shipping-center-step">
                <Stack gap="md">
                  <Group gap="sm">
                    <Paper radius="xl" p="xs" bg="grape.0">
                      <IconBuildingWarehouse size={18} />
                    </Paper>
                    <div>
                      <Title order={5}>Create shipping hub</Title>
                      <Text size="sm" c="dimmed">
                        Keep shipping alignment current before reassignments ripple downstream.
                      </Text>
                    </div>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <TextInput
                      label="Hub code"
                      value={newShippingCenterCode}
                      onChange={(event) => setNewShippingCenterCode(event.currentTarget.value)}
                    />
                    <TextInput
                      label="Hub name"
                      value={newShippingCenterName}
                      onChange={(event) => setNewShippingCenterName(event.currentTarget.value)}
                    />
                    <TextInput
                      label="City"
                      value={newShippingCenterCity}
                      onChange={(event) => setNewShippingCenterCity(event.currentTarget.value)}
                    />
                    <TextInput
                      label="State / Province"
                      value={newShippingCenterState}
                      onChange={(event) => setNewShippingCenterState(event.currentTarget.value)}
                    />
                    <TextInput
                      label="Country code"
                      value={newShippingCenterCountryCode}
                      onChange={(event) => setNewShippingCenterCountryCode(event.currentTarget.value)}
                    />
                  </SimpleGrid>
                  <Textarea
                    label="Notes"
                    minRows={2}
                    value={newShippingCenterNotes}
                    onChange={(event) => setNewShippingCenterNotes(event.currentTarget.value)}
                  />
                  <Switch
                    checked={newShippingCenterIsActive}
                    onChange={(event) => setNewShippingCenterIsActive(event.currentTarget.checked)}
                    label="Shipping hub is active"
                  />
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Active shipping hubs: {shippingCenters.filter((center) => center.isActive).length}
                    </Text>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      loading={isSavingShippingCenter}
                      onClick={() => {
                        void handleCreateShippingCenter();
                      }}
                    >
                      Create shipping hub
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            {activeSetupStep === 'territory' ? (
              <Paper withBorder radius="lg" p="md" data-testid="territory-territory-step">
                <Stack gap="md">
                  <Group gap="sm">
                    <Paper radius="xl" p="xs" bg="teal.0">
                      <IconRouteSquare size={18} />
                    </Paper>
                    <div>
                      <Title order={5}>Create territory</Title>
                      <Text size="sm" c="dimmed">
                        Add a territory, then assign ownership, shipping alignment, and covered states.
                      </Text>
                    </div>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <TextInput
                      label="Territory code"
                      value={newTerritoryCode}
                      onChange={(event) => setNewTerritoryCode(event.currentTarget.value)}
                    />
                    <TextInput
                      label="Territory name"
                      value={newTerritoryName}
                      onChange={(event) => setNewTerritoryName(event.currentTarget.value)}
                    />
                    <Select
                      label="Region"
                      placeholder="Select region"
                      data={regionSelectData}
                      value={newTerritoryRegionId}
                      onChange={(value) => setNewTerritoryRegionId(value ?? '')}
                      searchable
                    />
                    <Select
                      label="Territory manager"
                      placeholder="Assign later"
                      data={territoryManagerSelectData}
                      value={newTerritoryManagerUserId}
                      onChange={(value) => setNewTerritoryManagerUserId(value ?? '')}
                      searchable
                      clearable
                    />
                    <Select
                      label="Shipping hub"
                      placeholder="Assign later"
                      data={shippingCenterSelectData}
                      value={newTerritoryShippingCenterId}
                      onChange={(value) => setNewTerritoryShippingCenterId(value ?? '')}
                      searchable
                      clearable
                    />
                  </SimpleGrid>
                  <TagsInput
                    label="Covered states / provinces"
                    placeholder="Add codes like TX, FL, ON"
                    value={newTerritoryCoverage}
                    onChange={(values) => setNewTerritoryCoverage(normalizeCoverageTags(values))}
                    clearable
                  />
                  <Textarea
                    label="Notes"
                    minRows={2}
                    value={newTerritoryNotes}
                    onChange={(event) => setNewTerritoryNotes(event.currentTarget.value)}
                  />
                  <Switch
                    checked={newTerritoryIsActive}
                    onChange={(event) => setNewTerritoryIsActive(event.currentTarget.checked)}
                    label="Territory is active"
                  />
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Existing territories: {territories.length}
                    </Text>
                    <Button
                      leftSection={<IconPlus size={16} />}
                      loading={isSavingTerritory}
                      onClick={() => {
                        void handleCreateTerritory();
                      }}
                    >
                      Create territory
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            {activeSetupStep === 'review' ? (
              <Paper withBorder radius="lg" p="md" data-testid="territory-setup-review-step">
                <Stack gap="md">
                  <Group gap="sm">
                    <Paper radius="xl" p="xs" bg="orange.0">
                      <IconArrowsShuffle size={18} />
                    </Paper>
                    <div>
                      <Title order={5}>Coverage review</Title>
                      <Text size="sm" c="dimmed">
                        Review or edit territory ownership, shipping alignment, status, and covered states.
                      </Text>
                    </div>
                  </Group>
                  <Select
                    label="Territory"
                    placeholder="Select a territory"
                    data={territories.map((territory) => ({
                      value: territory.id,
                      label: `${territory.code} · ${territory.name}`,
                    }))}
                    value={editingTerritoryId}
                    onChange={(value) => setEditingTerritoryId(value ?? '')}
                    searchable
                  />
                  {editingTerritoryId ? (
                    <>
                      <Divider />
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <TextInput
                          label="Territory name"
                          value={editTerritoryName}
                          onChange={(event) => setEditTerritoryName(event.currentTarget.value)}
                        />
                        <Select
                          label="Region"
                          data={regionSelectData}
                          value={editTerritoryRegionId}
                          onChange={(value) => setEditTerritoryRegionId(value ?? '')}
                          searchable
                        />
                        <Select
                          label="Territory manager"
                          placeholder="Assign later"
                          data={territoryManagerSelectData}
                          value={editTerritoryManagerUserId}
                          onChange={(value) => setEditTerritoryManagerUserId(value ?? '')}
                          searchable
                          clearable
                        />
                        <Select
                          label="Shipping hub"
                          placeholder="Assign later"
                          data={shippingCenterSelectData}
                          value={editTerritoryShippingCenterId}
                          onChange={(value) => setEditTerritoryShippingCenterId(value ?? '')}
                          searchable
                          clearable
                        />
                      </SimpleGrid>
                      <TagsInput
                        label="Covered states / provinces"
                        placeholder="Add codes like TX, FL, ON"
                        value={editTerritoryCoverage}
                        onChange={(values) => setEditTerritoryCoverage(normalizeCoverageTags(values))}
                        clearable
                      />
                      <Textarea
                        label="Notes"
                        minRows={2}
                        value={editTerritoryNotes}
                        onChange={(event) => setEditTerritoryNotes(event.currentTarget.value)}
                      />
                      <Switch
                        checked={editTerritoryIsActive}
                        onChange={(event) => setEditTerritoryIsActive(event.currentTarget.checked)}
                        label="Territory is active"
                      />
                      <Group justify="flex-end">
                        <Button
                          loading={isUpdatingTerritory}
                          onClick={() => {
                            void handleUpdateTerritory();
                          }}
                        >
                          Save territory changes
                        </Button>
                      </Group>
                    </>
                  ) : (
                    <Text size="sm" c="dimmed">
                      Pick a territory to review its manager, region, shipping hub, or covered states.
                    </Text>
                  )}
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconClipboardList,
  IconClock,
  IconMailbox,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTruckDelivery,
} from '@tabler/icons-react';
import {
  createConsignmentSiteRecord,
  fetchAccounts,
  fetchConsignmentDashboard,
  fetchConsignmentSites,
  type AccountSummary,
  type ConsignmentDashboardResponse,
  type ConsignmentSiteStatus,
  type ConsignmentSiteSummary,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

const statusOptions: Array<{ value: ConsignmentSiteStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'onboarding_in_progress', label: 'Onboarding In Progress' },
  { value: 'ready_for_warehouse', label: 'Ready For Warehouse' },
  { value: 'warehouse_pending', label: 'Warehouse Pending' },
  { value: 'baseline_pending', label: 'Baseline Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'exiting', label: 'Exiting' },
  { value: 'exited', label: 'Exited' },
];

export function ConsignmentWorkspace() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [dashboard, setDashboard] = useState<ConsignmentDashboardResponse | null>(null);
  const [sites, setSites] = useState<ConsignmentSiteSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsignmentSiteStatus | ''>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    accountId: '',
    name: '',
    warehouseCode: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    notes: '',
  });
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [siteError, setSiteError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setDashboard(null);
      setSites([]);
      setAccounts([]);
      return;
    }

    let cancelled = false;
    const accessToken = auth.tokens.accessToken;

    void (async () => {
      setIsLoadingDashboard(true);
      setDashboardError(null);
      try {
        const response = await fetchConsignmentDashboard(apiBaseUrl, accessToken);
        if (!cancelled) {
          setDashboard(response);
        }
      } catch (error) {
        if (!cancelled) {
          setDashboardError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDashboard(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    if (!auth) {
      setAccounts([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchAccounts(apiBaseUrl, auth.tokens.accessToken, { limit: 200, includeInactive: false });
        if (!cancelled) {
          setAccounts(response.items);
        }
      } catch {
        if (!cancelled) {
          setAccounts([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    if (!auth) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setIsLoadingSites(true);
        setSiteError(null);
        try {
          const response = await fetchConsignmentSites(apiBaseUrl, auth.tokens.accessToken, {
            ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            limit: 75,
          });
          if (!cancelled) {
            setSites(response.items);
          }
        } catch (error) {
          if (!cancelled) {
            setSiteError(error instanceof Error ? error.message : String(error));
          }
        } finally {
          if (!cancelled) {
            setIsLoadingSites(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [apiBaseUrl, auth, searchQuery, statusFilter]);

  const localMetrics = useMemo(() => ({
    activeSites: sites.filter((site) => site.status === 'active').length,
    warehouseReady: sites.filter((site) => site.status === 'ready_for_warehouse').length,
    overdueAudits: sites.filter((site) => site.nextAuditDueAt && new Date(site.nextAuditDueAt).getTime() < Date.now()).length,
    openWorkItems: sites.reduce((total, site) => total + (site.openWorkItemCount ?? 0), 0),
  }), [sites]);

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: account.accountNumber ? `${account.displayName} (${account.accountNumber})` : account.displayName,
  }));

  const handleCreateSite = async () => {
    if (!auth || !createForm.accountId) {
      setSiteError('Choose an account before creating a consignment site.');
      return;
    }

    setIsSavingSite(true);
    setSiteError(null);
    try {
      await createConsignmentSiteRecord(apiBaseUrl, auth.tokens.accessToken, {
        accountId: createForm.accountId,
        ...(createForm.name.trim() ? { name: createForm.name.trim() } : {}),
        ...(createForm.warehouseCode.trim() ? { warehouseCode: createForm.warehouseCode.trim() } : {}),
        ...(createForm.primaryContactName.trim() ? { primaryContactName: createForm.primaryContactName.trim() } : {}),
        ...(createForm.primaryContactEmail.trim() ? { primaryContactEmail: createForm.primaryContactEmail.trim() } : {}),
        ...(createForm.primaryContactPhone.trim() ? { primaryContactPhone: createForm.primaryContactPhone.trim() } : {}),
        ...(createForm.notes.trim() ? { notes: createForm.notes.trim() } : {}),
      });
      const [dashboardResponse, sitesResponse] = await Promise.all([
        fetchConsignmentDashboard(apiBaseUrl, auth.tokens.accessToken),
        fetchConsignmentSites(apiBaseUrl, auth.tokens.accessToken, {
          ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          limit: 75,
        }),
      ]);
      setDashboard(dashboardResponse);
      setSites(sitesResponse.items);
      setCreateForm({ accountId: '', name: '', warehouseCode: '', primaryContactName: '', primaryContactEmail: '', primaryContactPhone: '', notes: '' });
      setIsCreateModalOpen(false);
      notifications.show({ color: 'green', title: 'Consignment site created', message: 'The Pulse consignment site was saved.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSiteError(message);
      notifications.show({ color: 'red', title: 'Create site failed', message });
    } finally {
      setIsSavingSite(false);
    }
  };

  if (!isHydrated) {
    return <Loader color="blue" />;
  }

  if (!auth) {
    return null;
  }

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1}>Consignment Workspace</Title>
            <Text size="sm" c="dimmed">
              Govern customer consignment sites, agreement readiness, ROSE audit timing, reconciliation states, and shared mailbox work.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge color="blue" variant="light">Pulse-owned workflow</Badge>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setIsCreateModalOpen(true)}>
              Create Site
            </Button>
          </Group>
        </Group>
      </Paper>

      <Modal opened={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Consignment Site" size="lg">
        <Stack gap="md">
          <Select
            label="Account"
            placeholder="Search or choose an account"
            data={accountOptions}
            value={createForm.accountId}
            onChange={(value) => setCreateForm((current) => ({ ...current, accountId: value ?? '' }))}
            searchable
            required
          />
          <TextInput
            label="Site name"
            value={createForm.name}
            onChange={(event) => setCreateForm((current) => ({ ...current, name: event.currentTarget.value }))}
            placeholder="Defaults to account name"
          />
          <TextInput
            label="Manual warehouse reference"
            value={createForm.warehouseCode}
            onChange={(event) => setCreateForm((current) => ({ ...current, warehouseCode: event.currentTarget.value }))}
            placeholder="Pulse reference while Acumatica creation is parked"
          />
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput label="Contact name" value={createForm.primaryContactName} onChange={(event) => setCreateForm((current) => ({ ...current, primaryContactName: event.currentTarget.value }))} />
            <TextInput label="Contact email" value={createForm.primaryContactEmail} onChange={(event) => setCreateForm((current) => ({ ...current, primaryContactEmail: event.currentTarget.value }))} />
            <TextInput label="Contact phone" value={createForm.primaryContactPhone} onChange={(event) => setCreateForm((current) => ({ ...current, primaryContactPhone: event.currentTarget.value }))} />
          </SimpleGrid>
          <Textarea label="Notes" value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.currentTarget.value }))} minRows={3} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSite} loading={isSavingSite}>Create Site</Button>
          </Group>
        </Stack>
      </Modal>

      {dashboardError ? (
        <Alert color="red" variant="light">{dashboardError}</Alert>
      ) : null}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <MetricCard label="Active Sites" value={dashboard?.metrics.activeSites ?? localMetrics.activeSites} icon={<IconShieldCheck size={18} />} />
        <MetricCard label="Ready For Warehouse" value={dashboard?.metrics.readyForWarehouseSites ?? localMetrics.warehouseReady} icon={<IconTruckDelivery size={18} />} />
        <MetricCard label="Overdue Audits" value={dashboard?.metrics.overdueAudits ?? localMetrics.overdueAudits} icon={<IconClock size={18} />} />
        <MetricCard label="Mailbox Work" value={dashboard?.metrics.openMailboxWorkItems ?? localMetrics.openWorkItems} icon={<IconMailbox size={18} />} />
      </SimpleGrid>

      <Tabs defaultValue="dashboard">
        <Tabs.List>
          <Tabs.Tab value="dashboard">Dashboard</Tabs.Tab>
          <Tabs.Tab value="sites">Site List</Tabs.Tab>
          <Tabs.Tab value="queue">Mailbox Queue</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dashboard" pt="md">
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Onboarding Pipeline</Title>
              {isLoadingDashboard ? (
                <Loader color="blue" />
              ) : dashboard?.onboardingPipeline.length ? (
                <Stack gap="xs">
                  {dashboard.onboardingPipeline.map((item) => (
                    <MetricRow key={item.stage} label={formatStatus(item.stage)} value={String(item.count)} />
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">No onboarding pipeline rows returned yet.</Text>
              )}
            </Card>
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Audit Due Buckets</Title>
              {isLoadingDashboard ? (
                <Loader color="blue" />
              ) : dashboard?.auditDueBuckets.length ? (
                <Stack gap="xs">
                  {dashboard.auditDueBuckets.map((item) => (
                    <MetricRow key={item.bucket} label={formatStatus(item.bucket)} value={String(item.count)} />
                  ))}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">No ROSE audit bucket data returned yet.</Text>
              )}
            </Card>
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="sites" pt="md">
          <SiteList
            sites={sites}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            isLoading={isLoadingSites}
            errorMessage={siteError}
            onSearchChange={setSearchQuery}
            onStatusChange={setStatusFilter}
          />
        </Tabs.Panel>

        <Tabs.Panel value="queue" pt="md">
          <MailboxQueue dashboard={dashboard} isLoading={isLoadingDashboard} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function SiteList({
  sites,
  searchQuery,
  statusFilter,
  isLoading,
  errorMessage,
  onSearchChange,
  onStatusChange,
}: {
  sites: ConsignmentSiteSummary[];
  searchQuery: string;
  statusFilter: ConsignmentSiteStatus | '';
  isLoading: boolean;
  errorMessage: string | null;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: ConsignmentSiteStatus | '') => void;
}) {
  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="md">
        <Group align="end" grow>
          <TextInput
            label="Search Sites"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Search account, site, territory, or TM"
            leftSection={<IconSearch size={16} />}
          />
          <Select
            label="Status"
            value={statusFilter}
            onChange={(value) => onStatusChange((value as ConsignmentSiteStatus | '') ?? '')}
            data={statusOptions}
            clearable={false}
          />
        </Group>
      </Paper>

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      <Paper withBorder radius="md" p="md">
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader color="blue" />
          </Group>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account / Site</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>TM / RD</Table.Th>
                <Table.Th>Next ROSE</Table.Th>
                <Table.Th>Reconciliation</Table.Th>
                <Table.Th>Warehouse Boundary</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sites.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No consignment sites match the current filters.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : sites.map((site) => (
                <Table.Tr key={site.id}>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text fw={600}>{site.accountName}</Text>
                      <Text size="xs" c="dimmed">{site.locationName ?? 'No site location recorded'}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(site.status)} variant="light">{formatStatus(site.status)}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">{site.ownerTmName ?? 'TM unassigned'}</Text>
                      <Text size="xs" c="dimmed">{site.ownerRdName ?? 'RD unassigned'}</Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>{formatDate(site.nextAuditDueAt)}</Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm">{site.openDiscrepancyCount ? 'Manual variance open' : 'No open variance'}</Text>
                      {(site.openDiscrepancyCount ?? 0) > 0 ? (
                        <Text size="xs" c="red">{site.openDiscrepancyCount} open discrepancies</Text>
                      ) : null}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    {site.acumaticaWarehouseId ? (
                      <Badge color="green" variant="outline">{site.acumaticaWarehouseId}</Badge>
                    ) : (
                      <Badge color="gray" variant="outline">Acumatica pending</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon component={Link} href={`/consignment/${site.id}`} variant="light" color="blue" aria-label={`Open ${site.accountName} consignment site`}>
                      <IconArrowRight size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

function MailboxQueue({ dashboard, isLoading }: { dashboard: ConsignmentDashboardResponse | null; isLoading: boolean }) {
  return (
    <Paper withBorder radius="md" p="md">
      {isLoading ? (
        <Group justify="center" py="xl">
          <Loader color="blue" />
        </Group>
      ) : dashboard?.workQueue.length ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Work Item</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Owner</Table.Th>
              <Table.Th>Due</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dashboard.workQueue.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text fw={600}>{item.subject}</Text>
                    <Text size="xs" c="dimmed">{item.siteName ?? 'Site detail pending'}</Text>
                  </Stack>
                </Table.Td>
                <Table.Td>{item.accountDisplayName}</Table.Td>
                <Table.Td>{item.ownerName ?? 'Unassigned'}</Table.Td>
                <Table.Td>{formatDate(item.dueAt)}</Table.Td>
                <Table.Td><Badge variant="light">{formatStatus(item.status)}</Badge></Table.Td>
                <Table.Td>
                  <ActionIcon component={Link} href={`/consignment/${item.siteId}`} variant="light" color="blue" aria-label={`Open ${item.accountDisplayName} consignment work item`}>
                    <IconArrowRight size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Stack align="center" py="xl" gap="xs">
          <IconClipboardList size={28} />
          <Text size="sm" c="dimmed">No consignment mailbox work items returned yet.</Text>
        </Stack>
      )}
    </Paper>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" c="dimmed">{label}</Text>
          <Text fw={700} size="xl">{value}</Text>
        </Stack>
        {icon}
      </Group>
    </Card>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm">{label}</Text>
      <Badge variant="light">{value}</Badge>
    </Group>
  );
}

export function formatConsignmentDate(value: string | undefined) {
  return formatDate(value);
}

export function formatConsignmentStatus(value: string | undefined) {
  return formatStatus(value ?? 'not_started');
}

export function consignmentStatusColor(value: string | undefined) {
  return statusColor(value);
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusColor(value: string | undefined) {
  switch (value) {
    case 'active':
    case 'completed':
    case 'approved':
    case 'signed':
    case 'current':
    case 'resolved':
      return 'green';
    case 'ready_for_warehouse':
    case 'in_progress':
    case 'open':
      return 'blue';
    case 'warehouse_pending':
    case 'baseline_pending':
    case 'onboarding_in_progress':
    case 'pending':
    case 'parked':
    case 'true_up_confirmed':
      return 'yellow';
    case 'suspended':
    case 'exiting':
    case 'escalated':
    case 'overdue':
      return 'orange';
    case 'exited':
    case 'rejected':
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

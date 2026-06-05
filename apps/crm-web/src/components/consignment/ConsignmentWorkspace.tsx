'use client';

import { useEffect, useMemo, useState } from 'react';
import {
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
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowRight,
  IconClipboardList,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchDetailRail,
  WorkbenchHeader,
  WorkbenchMoreMenu,
  WorkbenchTable,
} from '@/components/ui/Workbench';
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
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

const statusOptions: Array<{ value: ConsignmentSiteStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'onboarding_in_progress', label: 'Onboarding In Progress' },
  { value: 'ready_for_warehouse', label: 'Setup Ready' },
  { value: 'warehouse_pending', label: 'Setup Pending' },
  { value: 'baseline_pending', label: 'Baseline Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'exiting', label: 'Exiting' },
  { value: 'exited', label: 'Exited' },
];

type ConsignmentView = 'next' | 'allSites' | 'reports';

type NextSiteWorkRow = {
  accountName: string;
  detail: string;
  dueAt?: string | undefined;
  id: string;
  ownerName?: string | undefined;
  rank: number;
  secondaryCount: number;
  siteId: string;
  siteName?: string | undefined;
  statusLabel: string;
  summary: string;
  tone: string;
  workType: 'overdue_audit' | 'due_soon_audit' | 'follow_up' | 'site_issue';
};

export function ConsignmentWorkspace() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [dashboard, setDashboard] = useState<ConsignmentDashboardResponse | null>(null);
  const [sites, setSites] = useState<ConsignmentSiteSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConsignmentSiteStatus | ''>('');
  const [activeView, setActiveView] = useState<ConsignmentView>('next');
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
  const canManageConsignment = canPerformAction(auth?.identity.role, 'consignment.manage');

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
      <WorkbenchHeader
        eyebrow="Consignment operations"
        title="Consignment Workspace"
        description="Work due audits, follow-ups, setup confirmations, and site issues first. Reports and all-site search stay in More."
        policyText="Pulse owns site readiness, document evidence, ROSE audits, and follow-up ownership."
        secondaryActions={(
          <WorkbenchMoreMenu
            items={[{
              id: 'next-site-work',
              label: 'Next Site Work',
              description: 'Return to the ranked daily consignment queue.',
              icon: <IconArrowRight size={16} />,
              onClick: () => setActiveView('next'),
            }, ...(canManageConsignment ? [{
              id: 'create-consignment-site',
              label: 'Create Site',
              description: 'Add a new program site when the account is known.',
              icon: <IconPlus size={16} />,
              onClick: () => setIsCreateModalOpen(true),
            }] : []), {
              id: 'all-consignment-sites',
              label: 'All Sites',
              description: 'Search ROSE cadence, readiness, and site ownership.',
              icon: <IconSearch size={16} />,
              onClick: () => setActiveView('allSites'),
            }, {
              id: 'consignment-reports',
              label: 'Reports',
              description: 'Program readiness and ROSE audit rollups.',
              icon: <IconClipboardList size={16} />,
              onClick: () => setActiveView('reports'),
            }]}
          />
        )}
      />

      <Modal opened={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Add Consignment Site" size="lg">
        <Stack gap="md">
          <Select
            label="Account"
            aria-label="Consignment account"
            data-testid="consignment-account-select"
            placeholder="Search or choose an account"
            data={accountOptions}
            value={createForm.accountId}
            onChange={(value) => setCreateForm((current) => ({ ...current, accountId: value ?? '' }))}
            searchable
            required
          />
          <TextInput
            label="Site name"
            aria-label="Consignment site name"
            data-testid="consignment-site-name"
            value={createForm.name}
            onChange={(event) => setCreateForm((current) => ({ ...current, name: event.currentTarget.value }))}
            placeholder="Defaults to account name"
          />
          <WorkbenchAdvancedSection
            title="Advanced setup"
            description="Optional setup notes are available for operations, but they are not required to add the site."
          >
            <TextInput
              label="Setup note"
              aria-label="Setup note"
              data-testid="consignment-warehouse-reference"
              value={createForm.warehouseCode}
              onChange={(event) => setCreateForm((current) => ({ ...current, warehouseCode: event.currentTarget.value }))}
              placeholder="Optional setup note"
            />
          </WorkbenchAdvancedSection>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <TextInput data-testid="consignment-contact-name" label="Contact name" value={createForm.primaryContactName} onChange={(event) => setCreateForm((current) => ({ ...current, primaryContactName: event.currentTarget.value }))} />
            <TextInput data-testid="consignment-contact-email" label="Contact email" value={createForm.primaryContactEmail} onChange={(event) => setCreateForm((current) => ({ ...current, primaryContactEmail: event.currentTarget.value }))} />
            <TextInput data-testid="consignment-contact-phone" label="Contact phone" value={createForm.primaryContactPhone} onChange={(event) => setCreateForm((current) => ({ ...current, primaryContactPhone: event.currentTarget.value }))} />
          </SimpleGrid>
          <Textarea data-testid="consignment-notes" label="Notes" value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.currentTarget.value }))} minRows={3} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button
              data-testid="consignment-create-site-save"
              onClick={handleCreateSite}
              loading={isSavingSite}
              disabled={!createForm.accountId}
            >
              Create Site
            </Button>
          </Group>
        </Stack>
      </Modal>

      {dashboardError ? (
        <Alert color="red" variant="light">{dashboardError}</Alert>
      ) : null}

      {activeView === 'next' ? (
        <NextSiteWorkList
          dashboard={dashboard}
          isLoading={isLoadingDashboard || isLoadingSites}
          sites={sites}
        />
      ) : null}

      {activeView === 'reports' ? (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Overdue audits</Text>
              <Text fw={700} size="xl">{dashboard?.metrics.overdueAudits ?? localMetrics.overdueAudits}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Follow-ups</Text>
              <Text fw={700} size="xl">{dashboard?.metrics.openMailboxWorkItems ?? localMetrics.openWorkItems}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Ready for setup</Text>
              <Text fw={700} size="xl">{dashboard?.metrics.readyForWarehouseSites ?? localMetrics.warehouseReady}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active sites</Text>
              <Text fw={700} size="xl">{dashboard?.metrics.activeSites ?? localMetrics.activeSites}</Text>
            </Card>
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Onboarding Report</Title>
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
              <Title order={4} mb="md">ROSE Audit Report</Title>
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
        </Stack>
      ) : null}

      {activeView === 'allSites' ? (
        <SiteList
          sites={sites}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          isLoading={isLoadingSites}
          errorMessage={siteError}
          onSearchChange={setSearchQuery}
          onStatusChange={setStatusFilter}
        />
      ) : null}
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

      {isLoading ? (
        <Paper withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Paper>
      ) : (
        <WorkbenchTable
          ariaLabel="Consignment sites"
          rows={sites}
          getRowKey={(site) => site.id}
          columns={[
            {
              key: 'site',
              header: 'Account / Site',
              render: (site) => (
                <Stack gap={2}>
                  <Text fw={600}>{site.accountName}</Text>
                  <Text size="xs" c="dimmed">{site.locationName ?? 'No site location recorded'}</Text>
                </Stack>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (site) => <Badge color={statusColor(site.status)} variant="light">{formatStatus(site.status)}</Badge>,
            },
            {
              key: 'team',
              header: 'Team',
              render: (site) => (
                <Stack gap={2}>
                  <Text size="sm">{site.ownerTmName ?? 'TM unassigned'}</Text>
                  <Text size="xs" c="dimmed">{site.ownerRdName ?? 'RD unassigned'}</Text>
                </Stack>
              ),
            },
            {
              key: 'nextRose',
              header: 'Next ROSE',
              render: (site) => formatDate(site.nextAuditDueAt),
            },
            {
              key: 'siteIssue',
              header: 'Site issue',
              render: (site) => (
                <Stack gap={2}>
                  <Text size="sm">{site.openDiscrepancyCount ? 'Needs review' : 'Clear'}</Text>
                  {(site.openDiscrepancyCount ?? 0) > 0 ? (
                    <Text size="xs" c="orange.8">{site.openDiscrepancyCount} issue{site.openDiscrepancyCount === 1 ? '' : 's'} need review</Text>
                  ) : null}
                </Stack>
              ),
            },
          ]}
          rowActions={(site) => [{
            id: 'open-site',
            label: 'Open site',
            icon: <IconArrowRight size={16} />,
            onClick: () => {
              window.location.href = `/consignment/${site.id}`;
            },
          }]}
          emptyState={(
            <EmptyStateMessage
              kind={searchQuery || statusFilter ? 'filtered-out' : 'no-data'}
              title={searchQuery || statusFilter ? 'No sites match these filters' : 'No consignment sites yet'}
              description={searchQuery || statusFilter ? 'Adjust the search or status filter to widen the list.' : 'Add a site when an account is ready for the consignment program.'}
            />
          )}
        />
      )}
    </Stack>
  );
}

function NextSiteWorkList({
  dashboard,
  isLoading,
  sites,
}: {
  dashboard: ConsignmentDashboardResponse | null;
  isLoading: boolean;
  sites: ConsignmentSiteSummary[];
}) {
  const [renderedAt] = useState(() => Date.now());
  const rows = useMemo(() => buildNextSiteWorkRows({ dashboard, renderedAt, sites }), [dashboard, renderedAt, sites]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const selectedWork = rows.find((row) => row.id === selectedWorkId) ?? rows[0] ?? null;

  useEffect(() => {
    if (!rows.length) {
      setSelectedWorkId(null);
      return;
    }

    const firstRow = rows[0];
    if (firstRow && (!selectedWorkId || !rows.some((row) => row.id === selectedWorkId))) {
      setSelectedWorkId(firstRow.id);
    }
  }, [rows, selectedWorkId]);

  if (isLoading) {
    return (
      <Paper withBorder radius="md" p="xl">
        <Group justify="center">
          <Loader color="blue" />
        </Group>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" gap="md">
          <Stack gap={2}>
            <Title order={3}>Next site work</Title>
            <Text size="sm" c="dimmed">
              Ranked due audits, follow-ups, setup confirmations, and site issues. Reports and all sites stay in More.
            </Text>
          </Stack>
          <Badge color={rows.length > 0 ? 'orange' : 'green'} variant="light">
            {rows.length > 0 ? `${rows.length} site${rows.length === 1 ? '' : 's'}` : 'All clear'}
          </Badge>
        </Group>
        <SimpleGrid cols={{ base: 1, xl: rows.length ? 2 : 1 }} spacing="md" verticalSpacing="md">
          <WorkbenchTable<NextSiteWorkRow>
            ariaLabel="Next site work"
            rows={rows}
            getRowKey={(item) => item.id}
            onRowClick={(item) => setSelectedWorkId(item.id)}
            minWidth={640}
            columns={[
              {
                key: 'work',
                header: 'Next work',
                render: (item) => (
                  <Stack gap={2}>
                    <Text fw={700}>{item.summary}</Text>
                    <Text size="xs" c="dimmed">
                      {item.detail}{item.secondaryCount > 0 ? ` · ${item.secondaryCount} more item${item.secondaryCount === 1 ? '' : 's'}` : ''}
                    </Text>
                  </Stack>
                ),
              },
              {
                key: 'site',
                header: 'Account / Site',
                render: (item) => (
                  <Stack gap={2}>
                    <Text size="sm" fw={600}>{item.accountName}</Text>
                    <Text size="xs" c="dimmed">{item.siteName ?? 'Site detail pending'}</Text>
                  </Stack>
                ),
              },
              {
                key: 'owner',
                header: 'Owner',
                render: (item) => item.ownerName ?? 'Unassigned',
              },
              {
                key: 'due',
                header: 'Due',
                render: (item) => formatDate(item.dueAt),
              },
              {
                key: 'status',
                header: 'Status',
                render: (item) => <Badge color={item.tone} variant="light">{item.statusLabel}</Badge>,
              },
            ]}
            rowActions={(item) => [{
              id: 'open-site',
              label: 'Open site',
              icon: <IconArrowRight size={16} />,
              onClick: () => {
                window.location.href = `/consignment/${item.siteId}`;
              },
            }]}
            emptyState={(
              <EmptyStateMessage
                kind="all-clear"
                title="All clear"
                description="No due audits, follow-up work, or site issues need review for this view."
              />
            )}
          />
          {rows.length ? <NextSiteWorkDetailPanel item={selectedWork} /> : null}
        </SimpleGrid>
      </Stack>
    </Paper>
  );
}

function NextSiteWorkDetailPanel({ item }: { item: NextSiteWorkRow | null }) {
  return (
    <WorkbenchDetailRail
      title="Selected site work"
      description="Use this rail to understand the next action before opening the full site record."
      actions={item ? (
        <Button
          size="xs"
          rightSection={<IconArrowRight size={14} />}
          onClick={() => {
            window.location.href = `/consignment/${item.siteId}`;
          }}
        >
          Open site
        </Button>
      ) : null}
    >
      {item ? (
        <Stack gap="md" data-testid="consignment-next-work-detail">
          <Group justify="space-between" align="flex-start" gap="md">
            <Stack gap={2}>
              <Text fw={800}>{item.summary}</Text>
              <Text size="sm" c="dimmed">{item.accountName}</Text>
            </Stack>
            <Badge color={item.tone} variant="light">{item.statusLabel}</Badge>
          </Group>
          <Stack gap="xs">
            <ConsignmentDetailRow label="Site" value={item.siteName ?? 'Site detail pending'} />
            <ConsignmentDetailRow label="Owner" value={item.ownerName ?? 'Unassigned'} />
            <ConsignmentDetailRow label="Due" value={formatDate(item.dueAt)} />
            <ConsignmentDetailRow label="Why it is here" value={item.detail} />
            {item.secondaryCount > 0 ? (
              <ConsignmentDetailRow
                label="Other open work"
                value={`${item.secondaryCount} more item${item.secondaryCount === 1 ? '' : 's'} on this site`}
              />
            ) : null}
          </Stack>
          <Text size="xs" c="dimmed">
            Reports, setup details, and audit history stay inside the site record so the daily queue remains simple.
          </Text>
        </Stack>
      ) : null}
    </WorkbenchDetailRail>
  );
}

function ConsignmentDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" ta="right">{value}</Text>
    </Group>
  );
}

function buildNextSiteWorkRows({
  dashboard,
  renderedAt,
  sites,
}: {
  dashboard: ConsignmentDashboardResponse | null;
  renderedAt: number;
  sites: ConsignmentSiteSummary[];
}) {
  const bySite = new Map<string, NextSiteWorkRow>();
  const upsert = (row: NextSiteWorkRow) => {
    const existing = bySite.get(row.siteId);
    if (!existing || row.rank < existing.rank) {
      bySite.set(row.siteId, {
        ...row,
        secondaryCount: existing ? existing.secondaryCount + 1 : row.secondaryCount,
      });
      return;
    }
    bySite.set(row.siteId, {
      ...existing,
      secondaryCount: existing.secondaryCount + 1,
    });
  };

  for (const site of sites) {
    const dueAt = site.nextAuditDueAt ? new Date(site.nextAuditDueAt).getTime() : null;
    const isOverdue = dueAt !== null && dueAt < renderedAt;
    const isDueSoon = dueAt !== null && dueAt >= renderedAt;

    if (isOverdue || isDueSoon) {
      upsert({
        accountName: site.accountName,
        detail: `${site.ownerTmName ?? 'TM unassigned'} · ${isOverdue ? 'Audit overdue' : 'Audit coming due'}`,
        dueAt: site.nextAuditDueAt,
        id: `audit-${site.id}`,
        ownerName: site.ownerTmName ?? site.ownerRdName ?? undefined,
        rank: isOverdue ? 0 : 1,
        secondaryCount: 0,
        siteId: site.id,
        siteName: site.locationName ?? undefined,
        statusLabel: isOverdue ? 'Audit overdue' : 'Audit due soon',
        summary: isOverdue ? 'Finish overdue ROSE audit' : 'Prepare ROSE audit',
        tone: isOverdue ? 'orange' : 'blue',
        workType: isOverdue ? 'overdue_audit' : 'due_soon_audit',
      });
    }

    if ((site.openDiscrepancyCount ?? 0) > 0 || site.status === 'suspended' || site.status === 'exiting') {
      upsert({
        accountName: site.accountName,
        detail: (site.openDiscrepancyCount ?? 0) > 0 ? `${site.openDiscrepancyCount} site issue${site.openDiscrepancyCount === 1 ? '' : 's'} need review` : formatStatus(site.status),
        id: `issue-${site.id}`,
        ownerName: site.ownerTmName ?? site.ownerRdName ?? undefined,
        rank: 3,
        secondaryCount: 0,
        siteId: site.id,
        siteName: site.locationName ?? undefined,
        statusLabel: 'Site issue',
        summary: 'Review site issue',
        tone: 'orange',
        workType: 'site_issue',
      });
    }
  }

  for (const item of dashboard?.workQueue ?? []) {
    upsert({
      accountName: item.accountDisplayName,
      detail: `${item.ownerName ?? 'Unassigned'} · ${formatConsignmentWorkSubject(item.subject)}`,
      dueAt: item.dueAt,
      id: `follow-up-${item.id}`,
      ownerName: item.ownerName ?? undefined,
      rank: 2,
      secondaryCount: 0,
      siteId: item.siteId,
      siteName: item.siteName ?? undefined,
      statusLabel: formatStatus(item.status),
      summary: formatConsignmentWorkSubject(item.subject),
      tone: item.ownerName ? 'blue' : 'yellow',
      workType: 'follow_up',
    });
  }

  return Array.from(bySite.values()).sort((left, right) => (
    left.rank - right.rank
    || new Date(left.dueAt ?? '9999-12-31').getTime() - new Date(right.dueAt ?? '9999-12-31').getTime()
    || left.accountName.localeCompare(right.accountName)
  ));
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
  const label = consignmentStatusLabel[value];
  if (label) {
    return label;
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatConsignmentWorkSubject(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized.includes('manual variance')
    || normalized.includes('po follow-up')
    || normalized.includes('purchase order')
  ) {
    return 'Site issue needs review';
  }

  if (
    normalized.includes('acumatica')
    || normalized.includes('approved handoff')
    || normalized.includes('warehouse confirmation')
    || normalized.includes('warehouse handoff')
    || normalized.includes('warehouse pending')
    || normalized.includes('warehouse setup')
    || normalized.includes('ready for warehouse')
  ) {
    return 'Site setup needs confirmation';
  }

  return value;
}

const consignmentStatusLabel: Record<string, string> = {
  active: 'Active',
  approved: 'Approved',
  baseline_pending: 'Baseline pending',
  completed: 'Completed',
  current: 'Current',
  error: 'Error',
  escalated: 'Escalated',
  exited: 'Exited',
  exiting: 'Exiting',
  in_progress: 'In progress',
  not_started: 'Not started',
  onboarding_in_progress: 'Onboarding in progress',
  open: 'Open',
  overdue: 'Overdue',
  parked: 'Parked',
  pending: 'Pending',
  ready_for_warehouse: 'Setup ready',
  rejected: 'Rejected',
  resolved: 'Resolved',
  signed: 'Signed',
  suspended: 'Suspended',
  true_up_confirmed: 'Follow-up confirmed',
  warehouse_pending: 'Setup pending',
};

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

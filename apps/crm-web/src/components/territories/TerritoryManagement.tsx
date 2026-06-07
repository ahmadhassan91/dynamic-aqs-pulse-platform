'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconChartBar,
  IconChecklist,
  IconMap,
  IconRefresh,
  IconRouteSquare,
  IconSettings,
} from '@tabler/icons-react';
import type {
  AccountSummary,
  CalendarEventSummary,
  LeadSummary,
  ListTerritoryAssignableUsersResponse,
  RegionSummary,
  ShippingCenterSummary,
  TerritoryDashboardResponse,
  TerritoryAssignmentHistoryEntry,
  TerritoryMapWorkspaceResponse,
  TerritoryPolicySummary,
  TerritorySummary,
} from '@pulse/contracts';
import {
  fetchAccounts,
  fetchCalendarWorkspace,
  fetchLeads,
  fetchTerritoryAssignableUsers,
  fetchTerritoryAssignmentHistory,
  fetchTerritoryPolicy,
  fetchTerritoryRegions,
  fetchTerritoryShippingCenters,
  fetchTerritories,
  reassignAccountTerritory,
  reassignLeadTerritory,
  replaceTerritoryCoverage,
  updateTerritoryRecord,
} from '@/lib/pulse-api';
import { canPerformAction } from '@/lib/access';
import {
  buildTerritoryAssignmentImpactSummary,
  getTerritoryPrototypeTabs,
} from '@/lib/prototype-parity';
import { usePulseSession } from '@/lib/pulse-session';
import { TerritoryCalendarFeed } from './TerritoryCalendarFeed';
import { TerritoryMapLibre } from './TerritoryMapLibre';
import { TerritoryCommandDashboard, type TerritoryNextWorkItem } from './TerritoryCommandDashboard';
import { TerritoryOperationsPanel } from './TerritoryOperationsPanel';
import { RowActionMenu, WorkbenchMoreMenu } from '@/components/ui/Workbench';

type TerritoryTab = 'dashboard' | 'map' | 'list' | 'admin' | 'calendar';
type TerritoryRegistryView = 'territories' | 'regions' | 'gaps' | 'leads' | 'accounts';

function normalizeTerritoryTabParam(value: string | null | undefined): TerritoryTab | null {
  if (value === 'operations') {
    return 'admin';
  }

  if (value === 'dashboard' || value === 'map' || value === 'list' || value === 'admin' || value === 'calendar') {
    return value;
  }

  return null;
}

function buildTerritoryTabHref(pathname: string, tab: TerritoryTab) {
  if (tab === 'dashboard') {
    return pathname;
  }

  return `${pathname}?tab=${tab}`;
}

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
] as const;

const TERRITORY_TAB_ICONS = {
  dashboard: IconChartBar,
  map: IconMap,
  list: IconRouteSquare,
  admin: IconSettings,
  calendar: IconCalendar,
} as const;

const TERRITORY_OVERRIDE_REASON_OPTIONS = [
  { value: 'manual_override', label: 'Manual Override' },
  { value: 'coverage_exception', label: 'Coverage Exception' },
  { value: 'shipping_alignment', label: 'Shipping Alignment' },
  { value: 'lead_request', label: 'Lead Request' },
  { value: 'data_cleanup', label: 'Data Cleanup' },
  { value: 'other', label: 'Other' },
] as const;

export function TerritoryManagement({
  initialTab = 'dashboard',
}: {
  initialTab?: TerritoryTab | 'operations';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [activeTab, setActiveTab] = useState<TerritoryTab>(initialTab === 'operations' ? 'admin' : initialTab);
  const [territoryRegistryView, setTerritoryRegistryView] = useState<TerritoryRegistryView>('territories');
  const [policy, setPolicy] = useState<TerritoryPolicySummary | null>(null);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [shippingCenters, setShippingCenters] = useState<ShippingCenterSummary[]>([]);
  const [territories, setTerritories] = useState<TerritorySummary[]>([]);
  const [dashboard, setDashboard] = useState<TerritoryDashboardResponse | null>(null);
  const [mapWorkspace, setMapWorkspace] = useState<TerritoryMapWorkspaceResponse | null>(null);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<ListTerritoryAssignableUsersResponse>({
    territoryManagers: [],
    regionalDirectors: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [reassignLead, setReassignLead] = useState<LeadSummary | null>(null);
  const [historyLead, setHistoryLead] = useState<LeadSummary | null>(null);
  const [reassignAccount, setReassignAccount] = useState<AccountSummary | null>(null);
  const [historyAccount, setHistoryAccount] = useState<AccountSummary | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<TerritoryAssignmentHistoryEntry[]>([]);
  const [accountAssignmentHistory, setAccountAssignmentHistory] = useState<TerritoryAssignmentHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [accountHistoryError, setAccountHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingAccountHistory, setIsLoadingAccountHistory] = useState(false);
  const [isSavingReassignment, setIsSavingReassignment] = useState(false);
  const [isSavingAccountReassignment, setIsSavingAccountReassignment] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState('');
  const [selectedAssignedTmUserId, setSelectedAssignedTmUserId] = useState('');
  const [selectedAssignedRdUserId, setSelectedAssignedRdUserId] = useState('');
  const [reassignReasonCode, setReassignReasonCode] = useState<string>('manual_override');
  const [reassignReasonNote, setReassignReasonNote] = useState('');
  const [editingAdminTerritoryId, setEditingAdminTerritoryId] = useState('');
  const [adminTerritoryName, setAdminTerritoryName] = useState('');
  const [adminTerritoryRegionId, setAdminTerritoryRegionId] = useState('');
  const [adminTerritoryManagerUserId, setAdminTerritoryManagerUserId] = useState('');
  const [adminTerritoryShippingCenterId, setAdminTerritoryShippingCenterId] = useState('');
  const [adminTerritoryNotes, setAdminTerritoryNotes] = useState('');
  const [adminTerritoryStates, setAdminTerritoryStates] = useState<string[]>([]);
  const [adminTerritoryIsActive, setAdminTerritoryIsActive] = useState(true);
  const [showAllLeads, setShowAllLeads] = useState(false);
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const REGISTRY_PAGE_SIZE = 18;
  const [isSavingAdminTerritory, setIsSavingAdminTerritory] = useState(false);
  const [territoryCalendarItems, setTerritoryCalendarItems] = useState<CalendarEventSummary[]>([]);
  const [isLoadingTerritoryCalendar, setIsLoadingTerritoryCalendar] = useState(false);

  const requestedTab = normalizeTerritoryTabParam(searchParams.get('tab'));

  useEffect(() => {
    const fallbackTab = initialTab === 'operations' ? 'admin' : initialTab;
    const nextTab = requestedTab ?? fallbackTab;
    setActiveTab(nextTab);
  }, [initialTab, requestedTab]);

  useEffect(() => {
    if (!auth) {
      setPolicy(null);
      setRegions([]);
      setShippingCenters([]);
      setTerritories([]);
      setDashboard(null);
      setMapWorkspace(null);
      setLeads([]);
      setAccounts([]);
      setAssignableUsers({
        territoryManagers: [],
        regionalDirectors: [],
      });
      return;
    }

    const accessToken = auth.tokens.accessToken;
    const canViewCustomers = canPerformAction(auth.identity.role, 'customer.view');
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [
          policyResponse,
          regionsResponse,
          shippingCentersResponse,
          territoriesResponse,
          dashboardResponse,
          mapWorkspaceResponse,
          leadsResponse,
          accountsResponse,
          assignableUsersResponse,
        ] = await Promise.all([
          fetchTerritoryPolicy(apiBaseUrl, accessToken),
          fetchTerritoryRegions(apiBaseUrl, accessToken),
          fetchTerritoryShippingCenters(apiBaseUrl, accessToken),
          fetchTerritories(apiBaseUrl, accessToken),
          fetchTerritoryDashboard(apiBaseUrl, accessToken),
          fetchTerritoryMapWorkspace(apiBaseUrl, accessToken),
          fetchLeads(apiBaseUrl, accessToken, { limit: 500 }),
          canViewCustomers
            ? fetchAccounts(apiBaseUrl, accessToken, { limit: 500, includeInactive: false })
            : Promise.resolve({ items: [], total: 0 }),
          fetchTerritoryAssignableUsers(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setPolicy(policyResponse);
        setRegions(regionsResponse.items);
        setShippingCenters(shippingCentersResponse.items);
        setTerritories(territoriesResponse.items);
        setDashboard(dashboardResponse);
        setMapWorkspace(mapWorkspaceResponse);
        setLeads(leadsResponse.items);
        setAccounts(accountsResponse.items);
        setAssignableUsers(assignableUsersResponse);
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

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, refreshNonce]);

  useEffect(() => {
    if (!auth) {
      setTerritoryCalendarItems([]);
      return;
    }

    let cancelled = false;
    const accessToken = auth.tokens.accessToken;

    async function loadTerritoryCalendarFeed() {
      setIsLoadingTerritoryCalendar(true);

      try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 60);

        const response = await fetchCalendarWorkspace(apiBaseUrl, accessToken, {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        if (!cancelled) {
          setTerritoryCalendarItems(response.items);
        }
      } catch {
        if (!cancelled) {
          setTerritoryCalendarItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTerritoryCalendar(false);
        }
      }
    }

    void loadTerritoryCalendarFeed();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, refreshNonce]);

  const activePipelineLeads = useMemo(
    () => leads.filter((lead) => lead.lifecycleStatus === 'active' && lead.stage !== 'customer_active'),
    [leads],
  );
  const canReassignTerritory = auth ? canPerformAction(auth.identity.role, 'territory.reassign') : false;
  const canAdminTerritory = auth ? canPerformAction(auth.identity.role, 'territory.admin') : false;
  const canViewCustomers = auth ? canPerformAction(auth.identity.role, 'customer.view') : false;
  const isReadOnlyTerritoryUser = !canAdminTerritory && !canReassignTerritory;
  const activeAccounts = useMemo(() => accounts.filter((account) => account.isActive), [accounts]);

  const unassignedLeads = useMemo(
    () => activePipelineLeads.filter((lead) => !lead.territoryId),
    [activePipelineLeads],
  );

  const territoryLeadRoster = useMemo(
    () =>
      [...activePipelineLeads].sort((left, right) => {
        if (Boolean(left.territoryId) !== Boolean(right.territoryId)) {
          return left.territoryId ? 1 : -1;
        }

        return left.companyName.localeCompare(right.companyName);
      }),
    [activePipelineLeads],
  );

  const territoryLeadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of activePipelineLeads) {
      if (!lead.territoryId) {
        continue;
      }
      counts.set(lead.territoryId, (counts.get(lead.territoryId) ?? 0) + 1);
    }
    return counts;
  }, [activePipelineLeads]);

  const unassignedAccounts = useMemo(
    () => activeAccounts.filter((account) => !account.territoryId),
    [activeAccounts],
  );

  const territoryAccountRoster = useMemo(
    () =>
      [...activeAccounts].sort((left, right) => {
        if (Boolean(left.territoryId) !== Boolean(right.territoryId)) {
          return left.territoryId ? 1 : -1;
        }

        return left.displayName.localeCompare(right.displayName);
      }),
    [activeAccounts],
  );

  const dashboardData = useMemo(
    () =>
      dashboard ?? {
        stats: {
          regions: regions.length,
          territories: territories.length,
          coveredStates: territories.reduce((sum, territory) => sum + territory.coverageStates.length, 0),
          shippingCenters: shippingCenters.filter((item) => item.isActive).length,
          activeLeads: activePipelineLeads.length,
          activeAccounts: activeAccounts.length,
          assignedLeads: activePipelineLeads.filter((lead) => Boolean(lead.territoryId)).length,
          assignedAccounts: activeAccounts.filter((account) => Boolean(account.territoryId)).length,
          unassignedLeads: unassignedLeads.length,
          unassignedAccounts: unassignedAccounts.length,
          strategicGrowthLeads: activePipelineLeads.filter((lead) => lead.routingTeam === 'strategic_growth').length,
          nationalTmLeads: activePipelineLeads.filter((lead) => lead.routingTeam === 'national_tm').length,
        },
        coverage: {
          eligibleAccountCount: activeAccounts.filter((account) => account.lifecycleStatus === 'active' || account.lifecycleStatus === 'at_risk').length,
          engaged30DayCount: 0,
          engaged60DayCount: 0,
          engaged90DayCount: 0,
          overdue90DayCount: 0,
          engaged30DayPercent: 0,
          engaged60DayPercent: 0,
          engaged90DayPercent: 0,
        },
        lifecycle: {
          activeAccountCount: activeAccounts.filter((account) => account.lifecycleStatus === 'active').length,
          atRiskAccountCount: activeAccounts.filter((account) => account.lifecycleStatus === 'at_risk').length,
          inactiveAccountCount: accounts.filter((account) => account.lifecycleStatus === 'inactive').length,
          churnedAccountCount: accounts.filter((account) => account.lifecycleStatus === 'churned').length,
        },
        pipeline: {
          newLeadCount: activePipelineLeads.filter((lead) => lead.stage === 'new').length,
          discoveryLeadCount: activePipelineLeads.filter((lead) => lead.stage === 'discovery_scheduled' || lead.stage === 'discovery_completed').length,
          cisLeadCount: activePipelineLeads.filter((lead) => lead.stage === 'cis_sent' || lead.stage === 'cis_signed').length,
          onboardingLeadCount: activePipelineLeads.filter((lead) => lead.stage === 'onboarding_completed').length,
        },
        trainingPenetration: {
          totalAccounts: activeAccounts.length,
          trainedAccounts: 0,
          activeProgramsCount: 0,
          penetrationPercent: 0,
        },
        alerts: [],
        workloads: [],
        regionRollups: [],
        ownerMetrics: [],
        queue: {
          unassignedLeads: unassignedLeads.length,
          unassignedAccounts: unassignedAccounts.length,
          strategicGrowthLeads: activePipelineLeads.filter((lead) => lead.routingTeam === 'strategic_growth').length,
          nationalTmLeads: activePipelineLeads.filter((lead) => lead.routingTeam === 'national_tm').length,
          territoriesMissingManager: territories.filter((item) => !item.managerUserName).length,
          territoriesMissingShippingCenter: territories.filter((item) => !item.shippingCenterName).length,
          regionsMissingDirector: regions.filter((item) => !item.directorUserName).length,
        },
        generatedAt: new Date().toISOString(),
      },
    [accounts, activeAccounts, activePipelineLeads, dashboard, regions, shippingCenters, territories, unassignedAccounts.length, unassignedLeads.length],
  );

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

  const prototypeTabs = useMemo(
    () => getTerritoryPrototypeTabs(canAdminTerritory || canReassignTerritory),
    [canAdminTerritory, canReassignTerritory],
  );

  const primaryPrototypeTabs = useMemo(
    () => prototypeTabs.filter((tab) => tab.value === 'dashboard'),
    [prototypeTabs],
  );

  const secondaryPrototypeTabs = useMemo(
    () => prototypeTabs.filter((tab) => tab.value !== 'dashboard'),
    [prototypeTabs],
  );

  const territoryRegistryOptions = useMemo(
    () => [
      { value: 'territories', label: `Territories (${territories.length})` },
      { value: 'regions', label: `Regions (${regions.length})` },
      { value: 'gaps', label: `Assignment gaps (${unassignedLeads.length})` },
      { value: 'leads', label: `Lead ledger (${territoryLeadRoster.length})` },
      ...(canViewCustomers ? [{ value: 'accounts', label: `Account ledger (${territoryAccountRoster.length})` }] : []),
    ],
    [canViewCustomers, regions.length, territories.length, territoryAccountRoster.length, territoryLeadRoster.length, unassignedLeads.length],
  );

  const nextTerritoryWorkItems = useMemo<TerritoryNextWorkItem[]>(() => {
    const maxVisibleItems = 6;
    const leadLimit = canViewCustomers && unassignedAccounts.length > 0
      ? Math.min(3, unassignedLeads.length)
      : Math.min(maxVisibleItems, unassignedLeads.length);
    const leadItems: TerritoryNextWorkItem[] = unassignedLeads.slice(0, leadLimit).map((lead) => ({
      id: `lead:${lead.id}`,
      recordName: lead.companyName,
      recordMeta: lead.sourceSiteName ?? lead.leadSourceName ?? 'Lead',
      gapLabel: 'Lead needs territory',
      locationLabel: lead.state ?? 'State missing',
      ownerLabel: formatRoutingTeam(lead.routingTeam),
      tone: lead.state ? 'orange' : 'red',
      actions: (
        <RowActionMenu
          label={`Actions for ${lead.companyName}`}
          items={[
            {
              id: 'open',
              label: 'Open lead',
              onClick: () => router.push(`/leads/${lead.id}`),
            },
            ...(canReassignTerritory ? [{
              id: 'reassign',
              label: 'Assign territory',
              onClick: () => openReassignmentModal(lead),
            }] : []),
            {
              id: 'history',
              label: 'Assignment history',
              onClick: () => setHistoryLead(lead),
            },
          ]}
        />
      ),
    }));

    const accountLimit = canViewCustomers ? maxVisibleItems - leadItems.length : 0;
    const accountItems: TerritoryNextWorkItem[] = unassignedAccounts.slice(0, accountLimit).map((account) => ({
      id: `account:${account.id}`,
      recordName: account.displayName,
      recordMeta: account.accountType ?? 'Customer',
      gapLabel: 'Account needs territory',
      locationLabel: account.regionName ?? 'No territory',
      ownerLabel: formatAccountLifecycle(account.lifecycleStatus),
      tone: 'orange',
      actions: (
        <RowActionMenu
          label={`Actions for ${account.displayName}`}
          items={[
            {
              id: 'open',
              label: 'Open account',
              onClick: () => router.push(`/customers/${account.id}`),
            },
            ...(canReassignTerritory ? [{
              id: 'reassign',
              label: 'Assign territory',
              onClick: () => openAccountReassignmentModal(account),
            }] : []),
            {
              id: 'history',
              label: 'Assignment history',
              onClick: () => setHistoryAccount(account),
            },
          ]}
        />
      ),
    }));

    return [...leadItems, ...accountItems];
  }, [canReassignTerritory, canViewCustomers, router, unassignedAccounts, unassignedLeads]);

  useEffect(() => {
    if (!canViewCustomers && territoryRegistryView === 'accounts') {
      setTerritoryRegistryView('territories');
    }
  }, [canViewCustomers, territoryRegistryView]);

  function getTerritoryTabLabel(tab: { value: string; label: string }) {
    if (tab.value === 'dashboard') {
      return 'Action Queue';
    }

    if (tab.value === 'admin' && !canAdminTerritory) {
      return 'Work Queues';
    }

    if (tab.value === 'admin') {
      return 'Setup & Transfers';
    }

    if (tab.value === 'list') {
      return 'Territory Registry';
    }

    return tab.label;
  }

  useEffect(() => {
    if (!prototypeTabs.some((tab) => tab.value === activeTab)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, prototypeTabs]);

  const mapPins = useMemo(
    () => mapWorkspace ? [...mapWorkspace.accountPins, ...mapWorkspace.leadPins] : [],
    [mapWorkspace],
  );

  const territoryCalendarFeedItems = useMemo(
    () =>
      territoryCalendarItems
        .filter((item) => item.status === 'scheduled' && new Date(item.startsAt).getTime() >= Date.now())
        .sort((left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime())
        .slice(0, 10),
    [territoryCalendarItems],
  );

  const editingAdminTerritory = useMemo(
    () => territories.find((territory) => territory.id === editingAdminTerritoryId) ?? null,
    [editingAdminTerritoryId, territories],
  );

  const adminImpactSummary = useMemo(
    () => buildTerritoryAssignmentImpactSummary(editingAdminTerritory?.coverageStates ?? [], adminTerritoryStates),
    [adminTerritoryStates, editingAdminTerritory?.coverageStates],
  );

  useEffect(() => {
    if (!editingAdminTerritory) {
      return;
    }

    setAdminTerritoryName(editingAdminTerritory.name);
    setAdminTerritoryRegionId(editingAdminTerritory.regionId);
    setAdminTerritoryManagerUserId(editingAdminTerritory.managerUserId ?? '');
    setAdminTerritoryShippingCenterId(editingAdminTerritory.shippingCenterId ?? '');
    setAdminTerritoryNotes(editingAdminTerritory.notes ?? '');
    setAdminTerritoryStates(editingAdminTerritory.coverageStates);
    setAdminTerritoryIsActive(editingAdminTerritory.isActive);
  }, [editingAdminTerritory]);

  useEffect(() => {
    if (!historyLead || !auth) {
      setAssignmentHistory([]);
      setHistoryError(null);
      return;
    }

    let cancelled = false;
    const accessToken = auth.tokens.accessToken;
    const leadId = historyLead.id;

    async function loadAssignmentHistory() {
      setIsLoadingHistory(true);
      setHistoryError(null);

      try {
        const response = await fetchTerritoryAssignmentHistory(
          apiBaseUrl,
          accessToken,
          'lead',
          leadId,
        );

        if (!cancelled) {
          setAssignmentHistory(response.items);
        }
      } catch (error) {
        if (!cancelled) {
          setHistoryError(error instanceof Error ? error.message : String(error));
          setAssignmentHistory([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadAssignmentHistory();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, historyLead]);

  useEffect(() => {
    if (!historyAccount || !auth) {
      setAccountAssignmentHistory([]);
      setAccountHistoryError(null);
      return;
    }

    let cancelled = false;
    const accessToken = auth.tokens.accessToken;
    const accountId = historyAccount.id;

    async function loadAssignmentHistory() {
      setIsLoadingAccountHistory(true);
      setAccountHistoryError(null);

      try {
        const response = await fetchTerritoryAssignmentHistory(
          apiBaseUrl,
          accessToken,
          'account',
          accountId,
        );

        if (!cancelled) {
          setAccountAssignmentHistory(response.items);
        }
      } catch (error) {
        if (!cancelled) {
          setAccountHistoryError(error instanceof Error ? error.message : String(error));
          setAccountAssignmentHistory([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAccountHistory(false);
        }
      }
    }

    void loadAssignmentHistory();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, historyAccount]);

  function openReassignmentModal(lead: LeadSummary) {
    setReassignLead(lead);
    setSelectedTerritoryId(lead.territoryId ?? '');
    setSelectedAssignedTmUserId(lead.assignedTmUserId ?? '');
    setSelectedAssignedRdUserId(lead.assignedRdUserId ?? '');
    setReassignReasonCode('manual_override');
    setReassignReasonNote('');
  }

  function openAccountReassignmentModal(account: AccountSummary) {
    setReassignAccount(account);
    setSelectedTerritoryId(account.territoryId ?? '');
    setSelectedAssignedTmUserId(account.assignedTmUserId ?? '');
    setSelectedAssignedRdUserId(account.assignedRdUserId ?? '');
    setReassignReasonCode('manual_override');
    setReassignReasonNote('');
  }

  function toggleAdminTerritoryState(stateCode: string) {
    setAdminTerritoryStates((current) => {
      const normalized = stateCode.trim().toUpperCase();
      return current.includes(normalized)
        ? current.filter((value) => value !== normalized)
        : [...current, normalized];
    });
  }

  function openAdminTerritoryModal(territoryId: string) {
    setEditingAdminTerritoryId(territoryId);
  }

  async function handleSaveAdminTerritory() {
    if (!auth || !editingAdminTerritoryId || !adminTerritoryName.trim() || !adminTerritoryRegionId) {
      return;
    }

    setIsSavingAdminTerritory(true);
    try {
      await updateTerritoryRecord(apiBaseUrl, auth.tokens.accessToken, editingAdminTerritoryId, {
        name: adminTerritoryName.trim(),
        regionId: adminTerritoryRegionId,
        managerUserId: adminTerritoryManagerUserId || null,
        shippingCenterId: adminTerritoryShippingCenterId || null,
        notes: adminTerritoryNotes.trim() || null,
        isActive: adminTerritoryIsActive,
      });

      await replaceTerritoryCoverage(apiBaseUrl, auth.tokens.accessToken, editingAdminTerritoryId, {
        coverage: adminImpactSummary.assignedStates.map((stateCode) => ({ stateCode })),
      });

      notifications.show({
        title: 'Territory assignment saved',
        message: 'Map coverage, territory ownership, and state assignment were updated from the admin config view.',
        color: 'green',
      });

      setEditingAdminTerritoryId('');
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      notifications.show({
        title: 'Territory update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingAdminTerritory(false);
    }
  }

  async function handleLeadReassignment() {
    if (!auth || !reassignLead || !selectedTerritoryId) {
      return;
    }

    setIsSavingReassignment(true);

    try {
      const response = await reassignLeadTerritory(apiBaseUrl, auth.tokens.accessToken, reassignLead.id, {
        territoryId: selectedTerritoryId,
        assignedTmUserId: selectedAssignedTmUserId || null,
        assignedRdUserId: selectedAssignedRdUserId || null,
        reasonCode: reassignReasonCode,
        ...(reassignReasonNote.trim() ? { reasonNote: reassignReasonNote.trim() } : {}),
      });

      notifications.show({
        title: 'Lead territory updated',
        message: `${reassignLead.companyName} now routes through ${response.territoryName ?? response.territoryCode ?? 'the selected territory'}${response.assignedTmName ? ` with TM ${response.assignedTmName}` : ''}${response.assignedRdName ? ` and RD ${response.assignedRdName}` : ''}.`,
        color: 'green',
      });

      setReassignLead(null);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      notifications.show({
        title: 'Territory reassignment failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingReassignment(false);
    }
  }

  async function handleAccountReassignment() {
    if (!auth || !reassignAccount || !selectedTerritoryId) {
      return;
    }

    setIsSavingAccountReassignment(true);

    try {
      const response = await reassignAccountTerritory(apiBaseUrl, auth.tokens.accessToken, reassignAccount.id, {
        territoryId: selectedTerritoryId,
        assignedTmUserId: selectedAssignedTmUserId || null,
        assignedRdUserId: selectedAssignedRdUserId || null,
        reasonCode: reassignReasonCode,
        ...(reassignReasonNote.trim() ? { reasonNote: reassignReasonNote.trim() } : {}),
      });

      notifications.show({
        title: 'Account territory updated',
        message: `${reassignAccount.displayName} now aligns to ${response.territoryName ?? response.territoryCode ?? 'the selected territory'}${response.assignedTmName ? ` with TM ${response.assignedTmName}` : ''}${response.assignedRdName ? ` and RD ${response.assignedRdName}` : ''}.`,
        color: 'green',
      });

      setReassignAccount(null);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      notifications.show({
        title: 'Account territory update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingAccountReassignment(false);
    }
  }

  if (!isHydrated || !auth) {
    return null;
  }

  function handleTabChange(value: string | null) {
    const nextTab = normalizeTerritoryTabParam(value) ?? 'dashboard';
    setActiveTab(nextTab);
    router.replace(buildTerritoryTabHref(pathname, nextTab), { scroll: false });
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="xl" p="xl" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start" gap="xl">
          <Stack gap="xs" maw={840}>
            <Title order={1}>Territory Management</Title>
            <Text c="dimmed" size="sm">
              {assignableUsers.territoryManagers.length} Territory Managers • {shippingCenters.filter((item) => item.isActive).length} Shipping Hubs • Scoped territory work from account, lead, training, and consignment state.
            </Text>
            {policy ? (
              <Text c="dimmed" size="xs" mt={4}>
                <Text component="span" fw={600} c="dimmed">Workspace scope:</Text>{' '}
                {canAdminTerritory
                  ? 'Coverage, owner, and shipping-center changes write through the territory kernel.'
                  : 'You are seeing the territories, customers, leads, and history available to your role.'}
              </Text>
            ) : null}
          </Stack>

          <Group gap="sm" align="center">
            <WorkbenchMoreMenu
              items={[
                {
                  id: 'refresh-territory-dashboard',
                  label: isLoading ? 'Refreshing...' : 'Refresh workspace',
                  icon: <IconRefresh size={16} />,
                  disabled: isLoading,
                  onClick: () => setRefreshNonce((value) => value + 1),
                },
                ...((canAdminTerritory || canReassignTerritory) ? [{
                  id: 'setup-transfers',
                  label: 'Setup & transfers',
                  icon: <IconArrowRight size={16} />,
                  onClick: () => handleTabChange('admin'),
                }] : []),
              ]}
            />
          </Group>
        </Group>
      </Paper>

      {errorMessage ? (
        <Alert icon={<IconAlertCircle size={18} />} color="red" radius="xl" variant="light">
          {errorMessage}
        </Alert>
      ) : null}

      <Tabs value={activeTab} onChange={handleTabChange} className="premium-tabs-shell" keepMounted={false}>
        <Tabs.List>
          {primaryPrototypeTabs.map((tab) => {
            const Icon = TERRITORY_TAB_ICONS[tab.value];
            return (
              <Tabs.Tab key={tab.value} value={tab.value} leftSection={<Icon size={16} />}>
                {getTerritoryTabLabel(tab)}
              </Tabs.Tab>
            );
          })}
          <WorkbenchMoreMenu
            label={activeTab !== 'dashboard'
              ? getTerritoryTabLabel(prototypeTabs.find((tab) => tab.value === activeTab) ?? { value: activeTab, label: 'More' })
              : 'More'}
            items={secondaryPrototypeTabs.map((tab) => {
              const Icon = TERRITORY_TAB_ICONS[tab.value];
              return {
                id: `territory-${tab.value}`,
                label: getTerritoryTabLabel(tab),
                icon: <Icon size={14} />,
                onClick: () => handleTabChange(tab.value),
              };
            })}
          />
        </Tabs.List>

        <Tabs.Panel value="dashboard" pt="lg">
          <Stack gap="lg">
            <TerritoryCommandDashboard
              stats={dashboardData.stats}
              coverage={dashboardData.coverage}
              lifecycle={dashboardData.lifecycle}
              pipeline={dashboardData.pipeline}
              trainingPenetration={dashboardData.trainingPenetration}
              alerts={dashboardData.alerts}
              workloads={dashboardData.workloads}
              queue={dashboardData.queue}
              regionRollups={dashboardData.regionRollups}
              ownerMetrics={dashboardData.ownerMetrics}
              nextWorkItems={nextTerritoryWorkItems}
              canManageTerritorySetup={canAdminTerritory}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="map" pt="lg">
          <Stack gap="lg">
            <Paper withBorder radius="xl" p="lg">
              <Stack gap="xs">
                <Group gap="sm">
                  <ThemeIcon radius="xl" color="grape" variant="light">
                    <IconMap size={18} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>Map View</Title>
                    <Text size="sm" c="dimmed">
                      The live territory map now mirrors the approved paper-map style using real territory coverage,
                      manager ownership, shipping hubs, account pins, and lead pins from the production kernel.
                    </Text>
                  </div>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder radius="xl" p="md">
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <Text fw={700}>Live territory coverage map</Text>
                  <Badge color="blue" variant="light">
                    {mapPins.length} map records
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  Current TM ownership, state coverage, shipping hubs, and lead/account clustering all update from the
                  same live territory kernel.
                </Text>
                <Paper withBorder radius="xl" h={640} style={{ overflow: 'hidden' }}>
                  <TerritoryMapLibre
                    coverageEntries={mapWorkspace?.coverageEntries ?? []}
                    pins={mapPins}
                    shippingCenters={mapWorkspace?.shippingCenters ?? []}
                  />
                </Paper>
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="list" pt="lg">
          <Stack gap="lg">
            {isReadOnlyTerritoryUser ? (
              <Alert icon={<IconAlertCircle size={18} />} color="blue" radius="xl" variant="light">
                Territory ownership is read-only for this role. Open records and assignment history from the row menus;
                reassignment and setup changes stay with territory operators.
              </Alert>
            ) : null}

            <Paper withBorder radius="xl" p="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={4}>Territory registry</Title>
                    <Text size="sm" c="dimmed">
                      Choose one operating ledger at a time: territory truth, regional rollups, assignment gaps, leads, or accounts.
                    </Text>
                  </div>
                  <Badge color={territoryRegistryView === 'gaps' && unassignedLeads.length > 0 ? 'orange' : 'blue'} variant="light">
                    {territoryRegistryOptions.find((option) => option.value === territoryRegistryView)?.label ?? 'Territory registry'}
                  </Badge>
                </Group>

                <SegmentedControl
                  value={territoryRegistryView}
                  onChange={(value) => setTerritoryRegistryView(value as TerritoryRegistryView)}
                  data={territoryRegistryOptions}
                  fullWidth
                />

                {territoryRegistryView === 'territories' ? (
                  <Table.ScrollContainer minWidth={880}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Territory</Table.Th>
                          <Table.Th>Owner</Table.Th>
                          <Table.Th>Region</Table.Th>
                          <Table.Th>Coverage</Table.Th>
                          <Table.Th>Work</Table.Th>
                          {canAdminTerritory ? <Table.Th>Actions</Table.Th> : null}
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {territories.map((territory) => (
                          <Table.Tr key={territory.id}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={700}>{territory.name}</Text>
                                <Text size="xs" c="dimmed">
                                  {territory.code}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{territory.managerUserName ?? 'TM unassigned'}</Text>
                                <Text size="xs" c="dimmed">
                                  RD: {territory.directorUserName ?? 'Unassigned'}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>{territory.regionName}</Table.Td>
                            <Table.Td>
                              <Stack gap={4}>
                                <Group gap={6}>
                                  {territory.coverageStates.slice(0, 6).map((state) => (
                                    <Badge key={`${territory.id}-${state}`} size="xs" variant="light" color="grape">
                                      {state}
                                    </Badge>
                                  ))}
                                  {territory.coverageStates.length > 6 ? (
                                    <Badge size="xs" variant="light" color="gray">
                                      +{territory.coverageStates.length - 6}
                                    </Badge>
                                  ) : null}
                                </Group>
                                <Text size="xs" c="dimmed">
                                  Hub: {territory.shippingCenterName ?? 'Unassigned'}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{territoryLeadCounts.get(territory.id) ?? 0} active leads</Text>
                                <Text size="xs" c="dimmed">
                                  {territory.isActive ? 'Active territory' : 'Inactive territory'}
                                </Text>
                              </Stack>
                            </Table.Td>
                            {canAdminTerritory ? (
                              <Table.Td>
                                <RowActionMenu
                                  label={`Actions for ${territory.name}`}
                                  items={[{
                                    id: 'edit-territory',
                                    label: 'Edit territory',
                                    onClick: () => openAdminTerritoryModal(territory.id),
                                  }]}
                                />
                              </Table.Td>
                            ) : null}
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                ) : null}

                {territoryRegistryView === 'regions' ? (
                  <Table.ScrollContainer minWidth={520}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Region</Table.Th>
                          <Table.Th>Director</Table.Th>
                          <Table.Th>Territories</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {regions.map((region) => (
                          <Table.Tr key={region.id}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={700}>{region.name}</Text>
                                <Text size="xs" c="dimmed">
                                  {region.code}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>{region.directorUserName ?? 'Unassigned'}</Table.Td>
                            <Table.Td>{region.territoryCount}</Table.Td>
                            <Table.Td>
                              <Badge color={region.isActive ? 'teal' : 'gray'} variant="light">
                                {region.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                ) : null}

                {territoryRegistryView === 'gaps' ? (
                  unassignedLeads.length > 0 ? (
                    <Table.ScrollContainer minWidth={520}>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Lead</Table.Th>
                            <Table.Th>State</Table.Th>
                            <Table.Th>Routing Team</Table.Th>
                            <Table.Th>Stage</Table.Th>
                            <Table.Th>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {unassignedLeads.map((lead) => (
                            <Table.Tr key={lead.id}>
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text fw={700}>{lead.companyName}</Text>
                                  <Text size="xs" c="dimmed">
                                    {lead.sourceSiteName ?? lead.leadSourceName}
                                  </Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{lead.state ?? 'Missing'}</Table.Td>
                              <Table.Td>{formatRoutingTeam(lead.routingTeam)}</Table.Td>
                              <Table.Td>{formatStageLabel(lead.stage)}</Table.Td>
                              <Table.Td>
                                <RowActionMenu
                                  label={`Actions for ${lead.companyName}`}
                                  items={[
                                    {
                                      id: 'open',
                                      label: 'Open lead',
                                      onClick: () => router.push(`/leads/${lead.id}`),
                                    },
                                    ...(canReassignTerritory ? [{
                                      id: 'reassign',
                                      label: 'Reassign territory',
                                      onClick: () => openReassignmentModal(lead),
                                    }] : []),
                                    {
                                      id: 'history',
                                      label: 'Assignment history',
                                      onClick: () => setHistoryLead(lead),
                                    },
                                  ]}
                                />
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  ) : (
                    <Text size="sm" c="dimmed">
                      There are no active leads waiting for territory assignment right now.
                    </Text>
                  )
                ) : null}

                {territoryRegistryView === 'leads' ? (
                <Table.ScrollContainer minWidth={980}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Lead</Table.Th>
                        <Table.Th>State</Table.Th>
                        <Table.Th>Territory</Table.Th>
                        <Table.Th>Region</Table.Th>
                        <Table.Th>Assignment Method</Table.Th>
                        <Table.Th>Routing Team</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(showAllLeads ? territoryLeadRoster : territoryLeadRoster.slice(0, REGISTRY_PAGE_SIZE)).map((lead) => (
                        <Table.Tr key={lead.id}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text fw={700}>{lead.companyName}</Text>
                              <Text size="xs" c="dimmed">
                                {lead.sourceSiteName ?? lead.leadSourceName}
                              </Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>{lead.state ?? 'Missing'}</Table.Td>
                          <Table.Td>{lead.territoryName ?? lead.territoryCode ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{lead.regionName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{formatAssignmentMethod(lead.territoryAssignmentMethod)}</Table.Td>
                          <Table.Td>{formatRoutingTeam(lead.routingTeam)}</Table.Td>
                          <Table.Td>
                            <RowActionMenu
                              label={`Actions for ${lead.companyName}`}
                              items={[
                                {
                                  id: 'open',
                                  label: 'Open lead',
                                  onClick: () => router.push(`/leads/${lead.id}`),
                                },
                                ...(canReassignTerritory ? [{
                                  id: 'override',
                                  label: 'Override territory',
                                  onClick: () => openReassignmentModal(lead),
                                }] : []),
                                {
                                  id: 'history',
                                  label: 'Assignment history',
                                  onClick: () => setHistoryLead(lead),
                                },
                              ]}
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                      </Table.Tbody>
                    </Table>
                    {!showAllLeads && territoryLeadRoster.length > REGISTRY_PAGE_SIZE ? (
                      <Group justify="center" mt="sm">
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => setShowAllLeads(true)}
                        >
                          Show all {territoryLeadRoster.length} leads
                        </Button>
                      </Group>
                    ) : null}
                  </Table.ScrollContainer>
                ) : null}

                {territoryRegistryView === 'accounts' && canViewCustomers ? (
                  <Table.ScrollContainer minWidth={980}>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Account</Table.Th>
                          <Table.Th>Lifecycle</Table.Th>
                          <Table.Th>Territory</Table.Th>
                          <Table.Th>Region</Table.Th>
                          <Table.Th>Assignment Method</Table.Th>
                          <Table.Th>Shipping</Table.Th>
                          <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {(showAllAccounts ? territoryAccountRoster : territoryAccountRoster.slice(0, REGISTRY_PAGE_SIZE)).map((account) => (
                          <Table.Tr key={account.id}>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={700}>{account.displayName}</Text>
                                <Text size="xs" c="dimmed">
                                  {account.accountType ?? 'Customer'}
                                </Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>{formatAccountLifecycle(account.lifecycleStatus)}</Table.Td>
                            <Table.Td>{account.territoryName ?? account.territoryCode ?? 'Unassigned'}</Table.Td>
                            <Table.Td>{account.regionName ?? 'Unassigned'}</Table.Td>
                            <Table.Td>{formatAssignmentMethod(account.territoryAssignmentMethod)}</Table.Td>
                            <Table.Td>{account.shippingCenterName ?? 'Unassigned'}</Table.Td>
                            <Table.Td>
                                <RowActionMenu
                                  label={`Actions for ${account.displayName}`}
                                  items={[
                                    {
                                      id: 'open',
                                      label: 'Open account',
                                      onClick: () => router.push(`/customers/${account.id}`),
                                    },
                                    ...(canReassignTerritory ? [{
                                      id: 'override',
                                      label: 'Override territory',
                                      onClick: () => openAccountReassignmentModal(account),
                                    }] : []),
                                    {
                                      id: 'history',
                                      label: 'Assignment history',
                                      onClick: () => setHistoryAccount(account),
                                    },
                                  ]}
                                />
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                    {!showAllAccounts && territoryAccountRoster.length > REGISTRY_PAGE_SIZE ? (
                      <Group justify="center" mt="sm">
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => setShowAllAccounts(true)}
                        >
                          Show all {territoryAccountRoster.length} accounts
                        </Button>
                      </Group>
                    ) : null}
                  </Table.ScrollContainer>
                ) : null}
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="admin" pt="lg">
          <Stack gap="lg">
            <Paper withBorder radius="xl" p="lg">
              <Stack gap="xs">
                <Group gap="sm">
                  <ThemeIcon radius="xl" color="blue" variant="light">
                    <IconChecklist size={18} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>{canAdminTerritory ? 'Admin Config' : 'Territory Work Queues'}</Title>
                    <Text size="sm" c="dimmed">
                      {canAdminTerritory
                        ? 'Save updates once the state coverage is correct. Changes write through to map coloring, territory list counts, shipping alignment, and record ownership.'
                        : 'Use this lane for scoped lead and account reassignment work. Region, shipping, and coverage setup remains read-only here.'}
                    </Text>
                  </div>
                </Group>
              </Stack>
            </Paper>

            {(canAdminTerritory || canReassignTerritory) ? (
              <TerritoryOperationsPanel
                apiBaseUrl={apiBaseUrl}
                accessToken={auth.tokens.accessToken}
                regions={regions}
                shippingCenters={shippingCenters}
                territories={territories}
                activeAccounts={activeAccounts}
                activeLeads={activePipelineLeads}
                assignableUsers={assignableUsers}
                canAdminTerritory={canAdminTerritory}
                canReassignTerritory={canReassignTerritory}
                onRefresh={() => setRefreshNonce((value) => value + 1)}
                onOpenAccountHistory={(account) => setHistoryAccount(account)}
                onOpenLeadHistory={(lead) => setHistoryLead(lead)}
              />
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="calendar" pt="lg">
          <TerritoryCalendarFeed
            items={territoryCalendarFeedItems}
            isLoading={isLoadingTerritoryCalendar}
          />
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={Boolean(editingAdminTerritory)}
        onClose={() => setEditingAdminTerritoryId('')}
        title={`${editingAdminTerritory?.managerUserName ?? editingAdminTerritory?.name ?? 'Territory'} — Edit Territory`}
        centered
        size="xl"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Save updates once the state coverage is correct. This change writes through to the map, territory cards,
            shipping alignment, and downstream record ownership.
          </Text>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput
              label="Territory name"
              value={adminTerritoryName}
              onChange={(event) => setAdminTerritoryName(event.currentTarget.value)}
            />
            <Select
              label="Region"
              data={regionSelectData}
              value={adminTerritoryRegionId}
              onChange={(value) => setAdminTerritoryRegionId(value ?? '')}
              searchable
            />
            <Select
              label="Territory Manager"
              placeholder="Unassigned"
              data={territoryManagerSelectData}
              value={adminTerritoryManagerUserId}
              onChange={(value) => setAdminTerritoryManagerUserId(value ?? '')}
              searchable
              clearable
            />
            <Select
              label="Shipping Hub"
              placeholder="Unassigned"
              data={shippingCenterSelectData}
              value={adminTerritoryShippingCenterId}
              onChange={(value) => setAdminTerritoryShippingCenterId(value ?? '')}
              searchable
              clearable
            />
          </SimpleGrid>

          <Textarea
            label="Notes"
            minRows={2}
            value={adminTerritoryNotes}
            onChange={(event) => setAdminTerritoryNotes(event.currentTarget.value)}
          />

          <Paper withBorder radius="lg" p="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text fw={700}>Assigned states ({adminImpactSummary.assignedStates.length})</Text>
                <Badge color="blue" variant="light">
                  Impacted states {adminImpactSummary.impactedStateCount}
                </Badge>
              </Group>

              <SimpleGrid cols={{ base: 4, md: 6 }} spacing="xs">
                {US_STATE_CODES.map((stateCode) => {
                  const isAssigned = adminImpactSummary.assignedStates.includes(stateCode);
                  return (
                    <Button
                      key={stateCode}
                      size="compact-sm"
                      variant={isAssigned ? 'filled' : 'light'}
                      color={isAssigned ? 'blue' : 'gray'}
                      onClick={() => toggleAdminTerritoryState(stateCode)}
                    >
                      {stateCode}
                    </Button>
                  );
                })}
              </SimpleGrid>
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" p="md">
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text fw={700}>Impacted states</Text>
                <Text size="sm" c="dimmed">{adminImpactSummary.impactedStateCount}</Text>
              </Group>
              {adminImpactSummary.addedStates.length > 0 ? (
                <Text size="sm" c="teal.7">
                  Added: {adminImpactSummary.addedStates.join(', ')}
                </Text>
              ) : null}
              {adminImpactSummary.removedStates.length > 0 ? (
                <Text size="sm" c="red.7">
                  Removed: {adminImpactSummary.removedStates.join(', ')}
                </Text>
              ) : null}
              {adminImpactSummary.impactedStateCount === 0 ? (
                <Text size="sm" c="dimmed">
                  No state coverage changes yet.
                </Text>
              ) : null}
            </Stack>
          </Paper>

          <Group justify="flex-end">
            <Button variant="subtle" color="gray" onClick={() => setEditingAdminTerritoryId('')}>
              Cancel
            </Button>
            <Button loading={isSavingAdminTerritory} onClick={() => void handleSaveAdminTerritory()}>
              Save Assignment
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(reassignLead)}
        onClose={() => setReassignLead(null)}
        title="Lead territory override"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Route this lead to the correct territory using the live manual-override path. This writes assignment history
            and updates the operational workspace immediately.
          </Text>
          <Paper withBorder radius="lg" p="md">
            <Stack gap={4}>
              <Text fw={700}>{reassignLead?.companyName}</Text>
              <Text size="sm" c="dimmed">
                {reassignLead?.state ?? 'State missing'} · {reassignLead ? formatRoutingTeam(reassignLead.routingTeam) : '—'}
              </Text>
            </Stack>
          </Paper>
          <Select
            label="Territory"
            placeholder="Select a territory"
            data={territorySelectData}
            value={selectedTerritoryId}
            onChange={(value) => setSelectedTerritoryId(value ?? '')}
            searchable
          />
          <Select
            label="Reason"
            data={TERRITORY_OVERRIDE_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={reassignReasonCode}
            onChange={(value) => setReassignReasonCode(value ?? 'manual_override')}
          />
          <Select
            label="Named Territory Manager Override"
            description="Leave blank to inherit the territory default manager."
            placeholder="Use territory default manager"
            data={territoryManagerSelectData}
            value={selectedAssignedTmUserId}
            onChange={(value) => setSelectedAssignedTmUserId(value ?? '')}
            searchable
            clearable
          />
          <Select
            label="Named Regional Director Override"
            description="Leave blank to inherit the region default director."
            placeholder="Use region default director"
            data={regionalDirectorSelectData}
            value={selectedAssignedRdUserId}
            onChange={(value) => setSelectedAssignedRdUserId(value ?? '')}
            searchable
            clearable
          />
          <Textarea
            label="Note"
            placeholder="Add optional detail for the override history."
            value={reassignReasonNote}
            onChange={(event) => setReassignReasonNote(event.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setReassignLead(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleLeadReassignment();
              }}
              loading={isSavingReassignment}
              disabled={!selectedTerritoryId}
            >
              Save override
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(reassignAccount)}
        onClose={() => setReassignAccount(null)}
        title="Account territory override"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Maintain the live customer territory assignment when account ownership needs to differ from the default
            primary-location rule. This writes history and updates downstream territory views immediately.
          </Text>
          <Paper withBorder radius="lg" p="md">
            <Stack gap={4}>
              <Text fw={700}>{reassignAccount?.displayName}</Text>
              <Text size="sm" c="dimmed">
                {reassignAccount ? formatAccountLifecycle(reassignAccount.lifecycleStatus) : '—'} · {reassignAccount?.territoryName ?? reassignAccount?.territoryCode ?? 'Unassigned'}
              </Text>
            </Stack>
          </Paper>
          <Select
            label="Territory"
            placeholder="Select a territory"
            data={territorySelectData}
            value={selectedTerritoryId}
            onChange={(value) => setSelectedTerritoryId(value ?? '')}
            searchable
          />
          <Select
            label="Reason"
            data={TERRITORY_OVERRIDE_REASON_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
            value={reassignReasonCode}
            onChange={(value) => setReassignReasonCode(value ?? 'manual_override')}
          />
          <Select
            label="Named Territory Manager Override"
            description="Leave blank to inherit the territory default manager."
            placeholder="Use territory default manager"
            data={territoryManagerSelectData}
            value={selectedAssignedTmUserId}
            onChange={(value) => setSelectedAssignedTmUserId(value ?? '')}
            searchable
            clearable
          />
          <Select
            label="Named Regional Director Override"
            description="Leave blank to inherit the region default director."
            placeholder="Use region default director"
            data={regionalDirectorSelectData}
            value={selectedAssignedRdUserId}
            onChange={(value) => setSelectedAssignedRdUserId(value ?? '')}
            searchable
            clearable
          />
          <Textarea
            label="Note"
            placeholder="Add optional detail for the override history."
            value={reassignReasonNote}
            onChange={(event) => setReassignReasonNote(event.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setReassignAccount(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                void handleAccountReassignment();
              }}
              loading={isSavingAccountReassignment}
              disabled={!selectedTerritoryId}
            >
              Save override
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(historyLead)}
        onClose={() => setHistoryLead(null)}
        title="Territory assignment history"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Paper withBorder radius="lg" p="md">
            <Stack gap={4}>
              <Text fw={700}>{historyLead?.companyName}</Text>
              <Text size="sm" c="dimmed">
                {historyLead?.territoryName ?? historyLead?.territoryCode ?? 'Unassigned'} · {historyLead?.state ?? 'State missing'}
              </Text>
            </Stack>
          </Paper>

          {isLoadingHistory ? (
            <Group justify="center" py="lg">
              <Loader size="sm" color="blue" />
            </Group>
          ) : historyError ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {historyError}
            </Alert>
          ) : assignmentHistory.length > 0 ? (
            <Timeline active={Math.max(assignmentHistory.length - 1, 0)} bulletSize={24} lineWidth={2}>
              {assignmentHistory.map((item) => (
                <Timeline.Item
                  key={item.id}
                  title={`${formatAssignmentMethod(item.assignmentMethod)} · ${formatDateLabel(item.changedAt)}`}
                >
                  <Text size="sm" fw={600}>
                    {buildHistoryTransitionLabel(item)}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Changed by {item.changedByUserName ?? 'Pulse CRM'}{item.reasonCode ? ` · ${formatReasonCode(item.reasonCode)}` : ''}
                  </Text>
                  {item.reasonNote ? (
                    <Text size="sm" c="dimmed" mt={4}>
                      {item.reasonNote}
                    </Text>
                  ) : null}
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <Text size="sm" c="dimmed">
              No assignment history has been recorded for this lead yet.
            </Text>
          )}
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(historyAccount)}
        onClose={() => setHistoryAccount(null)}
        title="Account territory assignment history"
        centered
        size="lg"
      >
        <Stack gap="md">
          <Paper withBorder radius="lg" p="md">
            <Stack gap={4}>
              <Text fw={700}>{historyAccount?.displayName}</Text>
              <Text size="sm" c="dimmed">
                {historyAccount?.territoryName ?? historyAccount?.territoryCode ?? 'Unassigned'} · {historyAccount ? formatAccountLifecycle(historyAccount.lifecycleStatus) : 'Lifecycle missing'}
              </Text>
            </Stack>
          </Paper>

          {isLoadingAccountHistory ? (
            <Group justify="center" py="lg">
              <Loader size="sm" color="blue" />
            </Group>
          ) : accountHistoryError ? (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {accountHistoryError}
            </Alert>
          ) : accountAssignmentHistory.length > 0 ? (
            <Timeline active={Math.max(accountAssignmentHistory.length - 1, 0)} bulletSize={24} lineWidth={2}>
              {accountAssignmentHistory.map((item) => (
                <Timeline.Item
                  key={item.id}
                  title={`${formatAssignmentMethod(item.assignmentMethod)} · ${formatDateLabel(item.changedAt)}`}
                >
                  <Text size="sm" fw={600}>
                    {buildHistoryTransitionLabel(item)}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    Changed by {item.changedByUserName ?? 'Pulse CRM'}{item.reasonCode ? ` · ${formatReasonCode(item.reasonCode)}` : ''}
                  </Text>
                  {item.reasonNote ? (
                    <Text size="sm" c="dimmed" mt={4}>
                      {item.reasonNote}
                    </Text>
                  ) : null}
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            <Text size="sm" c="dimmed">
              No assignment history has been recorded for this account yet.
            </Text>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

async function fetchTerritoryDashboard(apiBaseUrl: string, accessToken: string): Promise<TerritoryDashboardResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/territories/dashboard`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = 'Failed to load territory dashboard.';
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // Keep the default message when the response body is not JSON.
    }
    throw new Error(detail);
  }

  return (await response.json()) as TerritoryDashboardResponse;
}

async function fetchTerritoryMapWorkspace(apiBaseUrl: string, accessToken: string): Promise<TerritoryMapWorkspaceResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/territories/map`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = 'Failed to load territory map workspace.';
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // Keep the default message when the response body is not JSON.
    }
    throw new Error(detail);
  }

  return (await response.json()) as TerritoryMapWorkspaceResponse;
}

function MetricMini({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <Paper withBorder radius="lg" p="xs">
      <Stack gap={2}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Paper>
  );
}

function formatRoutingTeam(value: LeadSummary['routingTeam']) {
  return value === 'strategic_growth' ? 'Strategic Growth' : 'National TM';
}

function formatAccountLifecycle(value: AccountSummary['lifecycleStatus']) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStageLabel(value: LeadSummary['stage']) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAssignmentMethod(value: LeadSummary['territoryAssignmentMethod'] | TerritoryAssignmentHistoryEntry['assignmentMethod'] | undefined) {
  if (!value) {
    return 'Unassigned';
  }

  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatReasonCode(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildHistoryTransitionLabel(item: TerritoryAssignmentHistoryEntry) {
  const from = item.previousTerritoryCode ?? 'Unassigned';
  const to = item.nextTerritoryCode ?? 'Unassigned';
  return `${from} → ${to}`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

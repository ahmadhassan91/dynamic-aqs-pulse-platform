'use client';

import Link from 'next/link';
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
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  ThemeIcon,
  Timeline,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBuildingWarehouse,
  IconHistory,
  IconMap,
  IconMapPin,
  IconRefresh,
  IconRouteSquare,
  IconTargetArrow,
  IconUsers,
} from '@tabler/icons-react';
import type {
  LeadSummary,
  ListTerritoryAssignableUsersResponse,
  RegionSummary,
  ShippingCenterSummary,
  TerritoryAssignmentHistoryEntry,
  TerritoryPolicySummary,
  TerritorySummary,
} from '@pulse/contracts';
import {
  fetchLeads,
  fetchTerritoryAssignableUsers,
  fetchTerritoryAssignmentHistory,
  fetchTerritoryPolicy,
  fetchTerritoryRegions,
  fetchTerritoryShippingCenters,
  fetchTerritories,
  reassignLeadTerritory,
} from '@/lib/pulse-api';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import {
  TerritoryCommandDashboard,
  type TerritoryDashboardAlert,
  type TerritoryDashboardWorkload,
} from './TerritoryCommandDashboard';

type TerritoryTab = 'dashboard' | 'map' | 'list';

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
  initialTab?: TerritoryTab;
}) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [activeTab, setActiveTab] = useState<TerritoryTab>(initialTab);
  const [policy, setPolicy] = useState<TerritoryPolicySummary | null>(null);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [shippingCenters, setShippingCenters] = useState<ShippingCenterSummary[]>([]);
  const [territories, setTerritories] = useState<TerritorySummary[]>([]);
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<ListTerritoryAssignableUsersResponse>({
    territoryManagers: [],
    regionalDirectors: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [reassignLead, setReassignLead] = useState<LeadSummary | null>(null);
  const [historyLead, setHistoryLead] = useState<LeadSummary | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<TerritoryAssignmentHistoryEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSavingReassignment, setIsSavingReassignment] = useState(false);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState('');
  const [selectedAssignedTmUserId, setSelectedAssignedTmUserId] = useState('');
  const [selectedAssignedRdUserId, setSelectedAssignedRdUserId] = useState('');
  const [reassignReasonCode, setReassignReasonCode] = useState<string>('manual_override');
  const [reassignReasonNote, setReassignReasonNote] = useState('');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!auth) {
      setPolicy(null);
      setRegions([]);
      setShippingCenters([]);
      setTerritories([]);
      setLeads([]);
      setAssignableUsers({
        territoryManagers: [],
        regionalDirectors: [],
      });
      return;
    }

    const accessToken = auth.tokens.accessToken;
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
          leadsResponse,
          assignableUsersResponse,
        ] = await Promise.all([
          fetchTerritoryPolicy(apiBaseUrl, accessToken),
          fetchTerritoryRegions(apiBaseUrl, accessToken),
          fetchTerritoryShippingCenters(apiBaseUrl, accessToken),
          fetchTerritories(apiBaseUrl, accessToken),
          fetchLeads(apiBaseUrl, accessToken, { limit: 500 }),
          fetchTerritoryAssignableUsers(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setPolicy(policyResponse);
        setRegions(regionsResponse.items);
        setShippingCenters(shippingCentersResponse.items);
        setTerritories(territoriesResponse.items);
        setLeads(leadsResponse.items);
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

  const activePipelineLeads = useMemo(
    () => leads.filter((lead) => lead.lifecycleStatus === 'active' && lead.stage !== 'customer_active'),
    [leads],
  );
  const canReassignTerritory = auth ? canPerformAction(auth.identity.role, 'territory.reassign') : false;

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

  const dashboardAlerts = useMemo<TerritoryDashboardAlert[]>(() => {
    const items: TerritoryDashboardAlert[] = [];

    if (unassignedLeads.length > 0) {
      items.push({
        label: 'Unassigned active leads',
        detail: `${unassignedLeads.length} live leads do not yet have a territory assignment and still need owner alignment.`,
        tone: 'orange',
      });
    }

    const territoriesWithoutManager = territories.filter((item) => !item.managerUserName);
    if (territoriesWithoutManager.length > 0) {
      items.push({
        label: 'Territories missing TM ownership',
        detail: `${territoriesWithoutManager.length} territories do not yet have a named territory manager.`,
        tone: 'orange',
      });
    }

    const territoriesWithoutShipping = territories.filter((item) => !item.shippingCenterName);
    if (territoriesWithoutShipping.length > 0) {
      items.push({
        label: 'Shipping center gaps',
        detail: `${territoriesWithoutShipping.length} territories are missing a linked shipping center.`,
        tone: 'red',
      });
    }

    const regionsWithoutDirector = regions.filter((item) => !item.directorUserName);
    if (regionsWithoutDirector.length > 0) {
      items.push({
        label: 'Regions missing RD ownership',
        detail: `${regionsWithoutDirector.length} regions do not yet have a named regional director.`,
        tone: 'blue',
      });
    }

    return items;
  }, [regions, territories, unassignedLeads]);

  const workloads = useMemo<TerritoryDashboardWorkload[]>(
    () =>
      [...territories]
        .map((territory) => ({
          territoryId: territory.id,
          territoryCode: territory.code,
          territoryName: territory.name,
          regionName: territory.regionName,
          ...(territory.managerUserName ? { managerName: territory.managerUserName } : {}),
          ...(territory.shippingCenterName ? { shippingCenterName: territory.shippingCenterName } : {}),
          coveredStates: territory.coverageStates,
          leadCount: territoryLeadCounts.get(territory.id) ?? 0,
        }))
        .sort((left, right) => right.leadCount - left.leadCount || left.territoryName.localeCompare(right.territoryName))
        .slice(0, 8),
    [territories, territoryLeadCounts],
  );

  const stats = useMemo(
    () => ({
      regions: regions.length,
      territories: territories.length,
      coveredStates: territories.reduce((sum, territory) => sum + territory.coverageStates.length, 0),
      shippingCenters: shippingCenters.filter((item) => item.isActive).length,
      activeLeads: activePipelineLeads.length,
      assignedLeads: activePipelineLeads.filter((lead) => Boolean(lead.territoryId)).length,
      unassignedLeads: unassignedLeads.length,
      strategicGrowthLeads: activePipelineLeads.filter((lead) => lead.routingTeam === 'strategic_growth').length,
      nationalTmLeads: activePipelineLeads.filter((lead) => lead.routingTeam === 'national_tm').length,
    }),
    [activePipelineLeads, regions.length, shippingCenters, territories, unassignedLeads.length],
  );

  const regionSummaries = useMemo(
    () =>
      regions.map((region) => ({
        ...region,
        territories: territories.filter((territory) => territory.regionId === region.id),
      })),
    [regions, territories],
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

  function openReassignmentModal(lead: LeadSummary) {
    setReassignLead(lead);
    setSelectedTerritoryId(lead.territoryId ?? '');
    setSelectedAssignedTmUserId(lead.assignedTmUserId ?? '');
    setSelectedAssignedRdUserId(lead.assignedRdUserId ?? '');
    setReassignReasonCode('manual_override');
    setReassignReasonNote('');
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

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Paper withBorder radius="xl" p="xl" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start" gap="xl">
          <Stack gap="sm" maw={840}>
            <Text size="xs" fw={700} tt="uppercase" c="blue.7" style={{ letterSpacing: '0.12em' }}>
              Pulse CRM / Territory Management
            </Text>
            <Title order={1}>Territory command center</Title>
            <Text c="dimmed" size="lg">
              Manage regional coverage, state-based assignment, shipping-center alignment, and lead ownership using the
              live Pulse territory kernel.
            </Text>
            <Group gap="sm" wrap="wrap">
              <Badge size="lg" radius="xl" color="blue" variant="light">
                {regions.length} regions
              </Badge>
              <Badge size="lg" radius="xl" color="grape" variant="light">
                {territories.length} territories
              </Badge>
              <Badge size="lg" radius="xl" color="orange" variant="light">
                {shippingCenters.length} shipping centers
              </Badge>
              <Badge size="lg" radius="xl" color={unassignedLeads.length > 0 ? 'orange' : 'teal'} variant="light">
                {unassignedLeads.length} unassigned active leads
              </Badge>
            </Group>
          </Stack>

          <Group gap="sm" align="center">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={isLoading}
              onClick={() => setRefreshNonce((value) => value + 1)}
            >
              Refresh workspace
            </Button>
            <Button component={Link} href="/leads/activities" rightSection={<IconArrowRight size={16} />}>
              Open workflow queue
            </Button>
          </Group>
        </Group>
      </Paper>

      {errorMessage ? (
        <Alert icon={<IconAlertCircle size={18} />} color="red" radius="xl" variant="light">
          {errorMessage}
        </Alert>
      ) : null}

      <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
        <Group justify="space-between" align="flex-start" gap="lg">
          <Stack gap={4}>
            <Title order={3}>Coverage policy and assignment posture</Title>
            <Text c="dimmed" size="sm">
              Territory routing stays CRM-owned until the first-order boundary. These policy flags control the live
              assignment kernel the lead module is already using.
            </Text>
          </Stack>
          {policy ? (
            <Group gap="xs" wrap="wrap" justify="flex-end">
              <PolicyBadge
                label="Pre-handoff TM visibility"
                active={policy.preHandoffTmVisibility}
                activeLabel="Visible"
                inactiveLabel="Hidden"
              />
              <PolicyBadge
                label="National TM default"
                active={policy.assignNationalTmLeadsByDefault}
                activeLabel="Enabled"
                inactiveLabel="Disabled"
              />
              <PolicyBadge
                label="Strategic Growth retention"
                active={policy.strategicGrowthRetainsOwnership}
                activeLabel="Retained"
                inactiveLabel="Released"
              />
            </Group>
          ) : null}
        </Group>
      </Paper>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <MetricCard label="Active Pipeline Leads" value={stats.activeLeads} color="blue" />
        <MetricCard
          label="Unassigned Leads"
          value={stats.unassignedLeads}
          color={stats.unassignedLeads > 0 ? 'orange' : 'teal'}
        />
        <MetricCard
          label="Territories With TM"
          value={territories.filter((territory) => territory.managerUserName).length}
          color="grape"
        />
        <MetricCard
          label="Active Shipping Centers"
          value={shippingCenters.filter((center) => center.isActive).length}
          color="orange"
        />
      </SimpleGrid>

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as TerritoryTab) ?? 'dashboard')} className="premium-tabs-shell">
        <Tabs.List>
          <Tabs.Tab value="dashboard" leftSection={<IconTargetArrow size={16} />}>
            Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="map" leftSection={<IconMap size={16} />}>
            Coverage Map
          </Tabs.Tab>
          <Tabs.Tab value="list" leftSection={<IconRouteSquare size={16} />}>
            Territory List
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dashboard" pt="lg">
          <Stack gap="lg">
            <TerritoryCommandDashboard stats={stats} alerts={dashboardAlerts} workloads={workloads} />

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
              <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon radius="xl" color="blue" variant="light">
                      <IconMapPin size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={4}>Regional coverage snapshot</Title>
                      <Text size="sm" c="dimmed">
                        Live regions, TM ownership, and territory spans.
                      </Text>
                    </div>
                  </Group>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    {regionSummaries.map((region) => (
                      <Paper key={region.id} withBorder radius="lg" p="md">
                        <Stack gap="xs">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={700}>{region.name}</Text>
                              <Text size="xs" c="dimmed">
                                {region.code}
                              </Text>
                            </div>
                            <Badge color={region.isActive ? 'teal' : 'gray'} variant="light">
                              {region.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Group>
                          <Text size="sm" c="dimmed">
                            Regional director: {region.directorUserName ?? 'Unassigned'}
                          </Text>
                          <Text size="sm" c="dimmed">
                            Territories: {region.territories.length}
                          </Text>
                          <Group gap={6} wrap="wrap">
                            {region.territories.map((territory) => (
                              <Badge key={territory.id} size="sm" radius="xl" variant="light" color="grape">
                                {territory.code}
                              </Badge>
                            ))}
                          </Group>
                        </Stack>
                      </Paper>
                    ))}
                  </SimpleGrid>
                </Stack>
              </Paper>

              <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon radius="xl" color="orange" variant="light">
                      <IconUsers size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={4}>Lead assignment watchlist</Title>
                      <Text size="sm" c="dimmed">
                        These live leads still need territory ownership cleanup or review.
                      </Text>
                    </div>
                  </Group>
                  {unassignedLeads.length > 0 ? (
                    <Stack gap="sm">
                      {unassignedLeads.slice(0, 6).map((lead) => (
                        <Paper key={lead.id} withBorder radius="lg" p="md">
                          <Group justify="space-between" align="flex-start" gap="md">
                            <div>
                              <Text fw={700}>{lead.companyName}</Text>
                              <Text size="sm" c="dimmed">
                                {lead.state ?? 'State missing'} · {formatRoutingTeam(lead.routingTeam)} · {lead.stage.replace(/_/g, ' ')}
                              </Text>
                            </div>
                            <Stack gap="xs" align="flex-end">
                              <Badge color="orange" variant="light">
                                Needs assignment
                              </Badge>
                              <Group gap="xs">
                                <Button component={Link} href={`/leads/${lead.id}`} variant="subtle" size="xs">
                                  Open lead
                                </Button>
                                {canReassignTerritory ? (
                                  <Button variant="light" size="xs" onClick={() => openReassignmentModal(lead)}>
                                    Assign territory
                                  </Button>
                                ) : null}
                                <Button variant="subtle" size="xs" onClick={() => setHistoryLead(lead)}>
                                  History
                                </Button>
                              </Group>
                            </Stack>
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">
                      All active pipeline leads currently have a territory assignment.
                    </Text>
                  )}
                </Stack>
              </Paper>
            </SimpleGrid>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="map" pt="lg">
          <Stack gap="lg">
            <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
              <Stack gap="xs">
                <Group gap="sm">
                  <ThemeIcon radius="xl" color="grape" variant="light">
                    <IconMap size={18} />
                  </ThemeIcon>
                  <div>
                    <Title order={4}>Coverage atlas</Title>
                    <Text size="sm" c="dimmed">
                      The current production slice uses the live territory kernel to show territory coverage by region,
                      shipping center, and active lead load.
                    </Text>
                  </div>
                </Group>
              </Stack>
            </Paper>

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
              {regionSummaries.map((region) => (
                <Paper key={region.id} withBorder radius="xl" p="lg" className="premium-stat-card">
                  <Stack gap="md">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Title order={4}>{region.name}</Title>
                        <Text size="sm" c="dimmed">
                          Regional director: {region.directorUserName ?? 'Unassigned'}
                        </Text>
                      </div>
                      <Badge color="blue" variant="light">
                        {region.territories.length} territories
                      </Badge>
                    </Group>

                    <Stack gap="sm">
                      {region.territories.map((territory) => (
                        <Paper key={territory.id} withBorder radius="lg" p="md">
                          <Stack gap="xs">
                            <Group justify="space-between" align="flex-start">
                              <div>
                                <Text fw={700}>{territory.name}</Text>
                                <Text size="xs" c="dimmed">
                                  {territory.code}
                                </Text>
                              </div>
                              <Badge color={territory.isActive ? 'teal' : 'gray'} variant="light">
                                {territoryLeadCounts.get(territory.id) ?? 0} active leads
                              </Badge>
                            </Group>

                            <Text size="sm" c="dimmed">
                              TM: {territory.managerUserName ?? 'Unassigned'} · Shipping: {territory.shippingCenterName ?? 'Unassigned'}
                            </Text>
                            <Group gap={6} wrap="wrap">
                              {territory.coverageStates.length > 0 ? territory.coverageStates.map((state) => (
                                <Badge key={`${territory.id}-${state}`} variant="light" size="sm" color="grape">
                                  {state}
                                </Badge>
                              )) : (
                                <Badge variant="light" color="gray">
                                  No covered states
                                </Badge>
                              )}
                            </Group>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </SimpleGrid>

            <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={4}>Shipping center service lanes</Title>
                    <Text size="sm" c="dimmed">
                      Live territory-to-shipping alignment from the territory kernel.
                    </Text>
                  </div>
                  <Badge color="orange" variant="light">
                    {shippingCenters.length} centers
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  {shippingCenters.map((center) => {
                    const servicedTerritories = territories.filter((territory) => territory.shippingCenterId === center.id);
                    return (
                      <Paper key={center.id} withBorder radius="lg" p="md">
                        <Stack gap="xs">
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={700}>{center.name}</Text>
                              <Text size="xs" c="dimmed">
                                {center.code}
                              </Text>
                            </div>
                            <Badge color={center.isActive ? 'teal' : 'gray'} variant="light">
                              {center.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Group>
                          <Text size="sm" c="dimmed">
                            {[center.city, center.state].filter(Boolean).join(', ') || center.countryCode}
                          </Text>
                          <Divider />
                          <Text size="sm" c="dimmed">
                            Territories served: {servicedTerritories.length}
                          </Text>
                          <Group gap={6} wrap="wrap">
                            {servicedTerritories.map((territory) => (
                              <Badge key={territory.id} size="sm" variant="light" color="orange">
                                {territory.code}
                              </Badge>
                            ))}
                          </Group>
                        </Stack>
                      </Paper>
                    );
                  })}
                </SimpleGrid>
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="list" pt="lg">
          <Stack gap="lg">
            <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={4}>Territory registry</Title>
                    <Text size="sm" c="dimmed">
                      Live territory, region, and shipping records in the production kernel.
                    </Text>
                  </div>
                  <Badge color="blue" variant="light">
                    {territories.length} records
                  </Badge>
                </Group>

                <Table.ScrollContainer minWidth={960}>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Territory</Table.Th>
                        <Table.Th>Region</Table.Th>
                        <Table.Th>TM</Table.Th>
                        <Table.Th>RD</Table.Th>
                        <Table.Th>Shipping</Table.Th>
                        <Table.Th>States</Table.Th>
                        <Table.Th>Active Leads</Table.Th>
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
                          <Table.Td>{territory.regionName}</Table.Td>
                          <Table.Td>{territory.managerUserName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{territory.directorUserName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{territory.shippingCenterName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>
                            <Group gap={6}>
                              {territory.coverageStates.map((state) => (
                                <Badge key={`${territory.id}-${state}`} size="xs" variant="light" color="grape">
                                  {state}
                                </Badge>
                              ))}
                            </Group>
                          </Table.Td>
                          <Table.Td>{territoryLeadCounts.get(territory.id) ?? 0}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Stack>
            </Paper>

            <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
              <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon radius="xl" color="blue" variant="light">
                      <IconMapPin size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={4}>Regional registry</Title>
                      <Text size="sm" c="dimmed">
                        Directors and territory counts per region.
                      </Text>
                    </div>
                  </Group>
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
                </Stack>
              </Paper>

              <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon radius="xl" color="orange" variant="light">
                      <IconBuildingWarehouse size={18} />
                    </ThemeIcon>
                    <div>
                      <Title order={4}>Open assignment gaps</Title>
                      <Text size="sm" c="dimmed">
                        Active leads without territory ownership so the team can clean them up quickly.
                      </Text>
                    </div>
                  </Group>

                  {unassignedLeads.length > 0 ? (
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
                                <Group gap="xs" wrap="nowrap">
                                  <Button component={Link} href={`/leads/${lead.id}`} variant="subtle" size="compact-sm">
                                    Open
                                  </Button>
                                  {canReassignTerritory ? (
                                    <Button variant="light" size="compact-sm" onClick={() => openReassignmentModal(lead)}>
                                      Reassign
                                    </Button>
                                  ) : null}
                                  <Button variant="subtle" size="compact-sm" onClick={() => setHistoryLead(lead)}>
                                    History
                                  </Button>
                                </Group>
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
                  )}
                </Stack>
              </Paper>
            </SimpleGrid>

            <Paper withBorder radius="xl" p="lg" className="premium-stat-card">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <div>
                    <Title order={4}>Lead territory roster</Title>
                    <Text size="sm" c="dimmed">
                      Live assignment ledger for active pipeline leads, including manual override controls and history.
                    </Text>
                  </div>
                  <Badge color="grape" variant="light">
                    {territoryLeadRoster.length} active leads
                  </Badge>
                </Group>

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
                      {territoryLeadRoster.slice(0, 18).map((lead) => (
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
                            <Group gap="xs" wrap="nowrap">
                              <Button component={Link} href={`/leads/${lead.id}`} variant="subtle" size="compact-sm">
                                Open
                              </Button>
                              {canReassignTerritory ? (
                                <Button variant="light" size="compact-sm" onClick={() => openReassignmentModal(lead)}>
                                  Override
                                </Button>
                              ) : null}
                              <Button variant="subtle" size="compact-sm" onClick={() => setHistoryLead(lead)}>
                                History
                              </Button>
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Stack>
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

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
    </Stack>
  );
}

function PolicyBadge({
  label,
  active,
  activeLabel,
  inactiveLabel,
}: {
  label: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge size="lg" radius="xl" color={active ? 'teal' : 'gray'} variant="light">
      {label}: {active ? activeLabel : inactiveLabel}
    </Badge>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'blue' | 'teal' | 'orange' | 'grape';
}) {
  return (
    <Paper withBorder radius="xl" p="md" className="premium-stat-card">
      <Stack gap={4}>
        <Text size="xs" fw={600} c="dimmed">
          {label}
        </Text>
        <Title order={3} c={color}>
          {value}
        </Title>
      </Stack>
    </Paper>
  );
}

function formatRoutingTeam(value: LeadSummary['routingTeam']) {
  return value === 'strategic_growth' ? 'Strategic Growth' : 'National TM';
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

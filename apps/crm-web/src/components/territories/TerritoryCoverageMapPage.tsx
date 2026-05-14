'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Grid,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBuildingWarehouse,
  IconMap,
  IconMapPinStar,
  IconRouteSquare,
  IconTargetArrow,
  IconTruck,
  IconUsers,
} from '@tabler/icons-react';
import type {
  TerritoryMapCoverageEntrySummary,
  TerritoryMapPinSummary,
  TerritoryRoutePlanStopSummary,
  TerritoryMapShippingCenterSummary,
  TerritoryMapWorkspaceResponse,
  TrainingSessionSummary,
  TrainingTrainerSummary,
} from '@pulse/contracts';
import {
  checkInTrainingSessionRecord,
  completeTrainingSessionRecord,
  createTrainingSessionRecord,
  fetchTerritoryMapWorkspace,
  fetchTrainingSessions,
  fetchTrainingTrainers,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { TerritoryMapLibre } from './TerritoryMapLibre';

type MapMode = 'coverage' | 'accounts' | 'pipeline' | 'all';

type TerritoryCardSummary = {
  territoryId: string;
  territoryName: string;
  territoryCode: string;
  regionName: string;
  assignedTmName?: string;
  assignedRdName?: string;
  shippingCenterName?: string;
  statesCovered: string[];
  activeAccountCount: number;
  pipelineLeadCount: number;
  unassignedLeadCount: number;
};

const EMPTY_PINS: TerritoryMapPinSummary[] = [];
const EMPTY_SHIPPING_CENTERS: TerritoryMapShippingCenterSummary[] = [];
const EMPTY_COVERAGE_ENTRIES: TerritoryMapCoverageEntrySummary[] = [];
const EMPTY_ROUTE_PLANS: TerritoryMapWorkspaceResponse['routePlans'] = [];

function getStageWeight(stage?: string) {
  switch (stage) {
    case 'onboarding_completed':
      return 5;
    case 'cis_signed':
      return 4;
    case 'cis_sent':
      return 3;
    case 'discovery_completed':
      return 2;
    case 'discovery_scheduled':
      return 1;
    default:
      return 0;
  }
}

function formatStageLabel(stage?: string) {
  if (!stage) {
    return 'Unknown';
  }

  return stage.replace(/_/g, ' ');
}

function formatLifecycleLabel(status?: string) {
  if (!status) {
    return 'Unknown';
  }

  return status.replace(/_/g, ' ');
}

function formatGeoPrecision(value: string) {
  return value.replace(/_/g, ' ');
}

function formatLastTouched(value?: string) {
  if (!value) {
    return 'No recent activity';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No recent activity';
  }

  return date.toLocaleDateString();
}

function formatVisitExecutionLabel(value?: TerritoryRoutePlanStopSummary['visitExecutionState']) {
  switch (value) {
    case 'checked_in':
      return 'Checked in';
    case 'completed':
      return 'Completed';
    case 'not_started':
    default:
      return 'Not started';
  }
}

function getVisitExecutionColor(value?: TerritoryRoutePlanStopSummary['visitExecutionState']) {
  switch (value) {
    case 'checked_in':
      return 'orange';
    case 'completed':
      return 'teal';
    case 'not_started':
    default:
      return 'gray';
  }
}

export function TerritoryCoverageMapPage() {
  const router = useRouter();
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [mapMode, setMapMode] = useState<MapMode>('coverage');
  const [workspace, setWorkspace] = useState<TerritoryMapWorkspaceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [visitAccount, setVisitAccount] = useState<TerritoryMapPinSummary | null>(null);
  const [trainers, setTrainers] = useState<TrainingTrainerSummary[]>([]);
  const [trainerUserId, setTrainerUserId] = useState('');
  const [visitNotes, setVisitNotes] = useState('');
  const [activeVisit, setActiveVisit] = useState<TrainingSessionSummary | null>(null);
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
  const [isStartingVisit, setIsStartingVisit] = useState(false);
  const [isCompletingVisit, setIsCompletingVisit] = useState(false);

  useEffect(() => {
    if (!auth) {
      setWorkspace(null);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetchTerritoryMapWorkspace(apiBaseUrl, accessToken);
        if (!cancelled) {
          setWorkspace(response);
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

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, refreshNonce]);

  useEffect(() => {
    if (!auth || !visitAccount) {
      return;
    }

    const accessToken = auth.tokens.accessToken;
    const currentUserId = auth.identity.userId;
    const accountId = visitAccount.recordId;
    const assignedTmUserId = visitAccount.assignedTmUserId;
    let cancelled = false;

    async function loadVisitContext() {
      setIsLoadingTrainers(true);
      try {
        const [trainerResponse, sessionResponse] = await Promise.all([
          fetchTrainingTrainers(apiBaseUrl, accessToken),
          fetchTrainingSessions(apiBaseUrl, accessToken, {
            accountId,
            includeVisits: true,
            status: 'checked_in',
            limit: 20,
          }),
        ]);
        if (cancelled) {
          return;
        }

        const activeTrainers = trainerResponse.items.filter((entry) => entry.isActive);
        setTrainers(activeTrainers);
        setActiveVisit(sessionResponse.items.find((entry) => entry.activityKind === 'site_visit') ?? null);
        setTrainerUserId((current) => {
          if (current && activeTrainers.some((entry) => entry.userId === current)) {
            return current;
          }
          if (activeTrainers.some((entry) => entry.userId === currentUserId)) {
            return currentUserId;
          }
          if (assignedTmUserId && activeTrainers.some((entry) => entry.userId === assignedTmUserId)) {
            return assignedTmUserId;
          }
          return activeTrainers[0]?.userId ?? '';
        });
      } catch (error) {
        if (!cancelled) {
          notifications.show({
            color: 'red',
            title: 'Unable to load visit context',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingTrainers(false);
        }
      }
    }

    void loadVisitContext();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, visitAccount]);

  const accountPins = workspace?.accountPins ?? EMPTY_PINS;
  const leadPins = workspace?.leadPins ?? EMPTY_PINS;
  const shippingCenters = workspace?.shippingCenters ?? EMPTY_SHIPPING_CENTERS;
  const coverageEntries = workspace?.coverageEntries ?? EMPTY_COVERAGE_ENTRIES;
  const routePlans = workspace?.routePlans ?? EMPTY_ROUTE_PLANS;

  const territorySummaries = useMemo<TerritoryCardSummary[]>(() => {
    const byTerritory = new Map<string, TerritoryCardSummary>();

    coverageEntries.forEach((entry) => {
      if (!byTerritory.has(entry.territoryId)) {
        byTerritory.set(entry.territoryId, {
          territoryId: entry.territoryId,
          territoryName: entry.territoryName,
          territoryCode: entry.territoryCode,
          regionName: entry.regionName,
          statesCovered: [],
          activeAccountCount: 0,
          pipelineLeadCount: 0,
          unassignedLeadCount: 0,
          ...(entry.assignedTmName ? { assignedTmName: entry.assignedTmName } : {}),
          ...(entry.assignedRdName ? { assignedRdName: entry.assignedRdName } : {}),
          ...(entry.shippingCenterName ? { shippingCenterName: entry.shippingCenterName } : {}),
        });
      }

      byTerritory.get(entry.territoryId)?.statesCovered.push(entry.stateCode);
    });

    accountPins.forEach((pin) => {
      if (!pin.territoryId || !byTerritory.has(pin.territoryId)) {
        return;
      }
      byTerritory.get(pin.territoryId)!.activeAccountCount += 1;
    });

    leadPins.forEach((pin) => {
      if (pin.territoryId && byTerritory.has(pin.territoryId)) {
        byTerritory.get(pin.territoryId)!.pipelineLeadCount += 1;
      } else {
        const entry = byTerritory.get('unassigned') ?? {
          territoryId: 'unassigned',
          territoryName: 'Unassigned coverage',
          territoryCode: 'UNASSIGNED',
          regionName: 'Routing gap',
          statesCovered: [],
          activeAccountCount: 0,
          pipelineLeadCount: 0,
          unassignedLeadCount: 0,
        };
        entry.unassignedLeadCount += 1;
        byTerritory.set('unassigned', entry);
      }
    });

    return Array.from(byTerritory.values()).sort((left, right) => {
      const rightScore = right.pipelineLeadCount + right.activeAccountCount + right.statesCovered.length;
      const leftScore = left.pipelineLeadCount + left.activeAccountCount + left.statesCovered.length;
      return rightScore - leftScore || left.territoryName.localeCompare(right.territoryName);
    });
  }, [accountPins, coverageEntries, leadPins]);

  const coverageHighlights = useMemo(() => {
    const liveTerritories = territorySummaries.filter((territory) => territory.territoryId !== 'unassigned');
    return {
      widestCoverage: liveTerritories.slice().sort((left, right) => right.statesCovered.length - left.statesCovered.length)[0],
      busiestPipeline: territorySummaries.slice().sort((left, right) => right.pipelineLeadCount - left.pipelineLeadCount)[0],
      heaviestAccountLoad: liveTerritories.slice().sort((left, right) => right.activeAccountCount - left.activeAccountCount)[0],
    };
  }, [territorySummaries]);

  const overlayPins = useMemo(() => {
    if (mapMode === 'coverage' || mapMode === 'all') {
      return [...accountPins, ...leadPins];
    }
    if (mapMode === 'accounts') {
      return accountPins;
    }
    return leadPins;
  }, [accountPins, leadPins, mapMode]);

  const accountRows = useMemo(
    () =>
      accountPins
        .slice()
        .sort((left, right) => {
          if (left.territoryId !== right.territoryId) {
            return left.territoryName?.localeCompare(right.territoryName ?? '') ?? 0;
          }
          return (right.lastTouchedAt ?? '').localeCompare(left.lastTouchedAt ?? '');
        })
        .slice(0, 12),
    [accountPins],
  );

  const pipelineRows = useMemo(
    () =>
      leadPins
        .slice()
        .sort((left, right) => {
          const rightScore = (right.territoryId ? 0 : 100) + getStageWeight(right.stage);
          const leftScore = (left.territoryId ? 0 : 100) + getStageWeight(left.stage);
          return rightScore - leftScore || (right.lastTouchedAt ?? '').localeCompare(left.lastTouchedAt ?? '');
        })
        .slice(0, 12),
    [leadPins],
  );

  const operatingQueue = useMemo(() => {
    const items = [
      ...leadPins
        .filter((pin) => !pin.territoryId)
        .map((pin) => ({
          id: pin.id,
          label: pin.label,
          owner: pin.assignedTmName ?? 'Routing queue',
          signal: 'Needs territory assignment',
          tone: 'orange',
          detail: `${pin.state ?? 'Unknown state'} · ${formatStageLabel(pin.stage)}`,
        })),
      ...leadPins
        .filter((pin) => pin.stage === 'cis_signed')
        .slice(0, 5)
        .map((pin) => ({
          id: `${pin.id}:cis`,
          label: pin.label,
          owner: pin.assignedTmName ?? 'Sales / BD',
          signal: 'Ready for onboarding handoff',
          tone: 'blue',
          detail: `${pin.territoryName ?? 'Unassigned'} · ${formatStageLabel(pin.stage)}`,
        })),
      ...accountPins
        .filter((pin) => !pin.territoryId)
        .slice(0, 5)
        .map((pin) => ({
          id: `${pin.id}:account`,
          label: pin.label,
          owner: pin.assignedTmName ?? 'Account ops',
          signal: 'Customer missing territory',
          tone: 'grape',
          detail: `${pin.city ?? 'Unknown city'}${pin.state ? `, ${pin.state}` : ''}`,
        })),
    ];

    return items.slice(0, 14);
  }, [accountPins, leadPins]);

  const routeExecutionRows = useMemo(
    () =>
      routePlans
        .flatMap((plan) =>
          plan.stops.map((stop) => ({
            ...stop,
            routePlanId: plan.id,
            routeLabel: plan.territoryName ?? plan.shippingCenterName ?? 'Unassigned route',
          })),
        )
        .filter((stop) => stop.recordType === 'account')
        .sort((left, right) => {
          const statePriority = (value?: TerritoryRoutePlanStopSummary['visitExecutionState']) => {
            if (value === 'checked_in') {
              return 0;
            }
            if (value === 'not_started') {
              return 1;
            }
            return 2;
          };

          return statePriority(left.visitExecutionState) - statePriority(right.visitExecutionState)
            || left.routeLabel.localeCompare(right.routeLabel)
            || left.sequence - right.sequence;
        })
        .slice(0, 10),
    [routePlans],
  );

  const modeConfig = useMemo(
    () => ({
      coverage: {
        title: 'Coverage-only map',
        description:
          'Use this when the focus is ownership coverage, TM / RD alignment, shipping centers, and the live account and lead markers on top of that coverage.',
        badges: [
          `${territorySummaries.filter((territory) => territory.territoryId !== 'unassigned').length} territories`,
          `${new Set(coverageEntries.map((entry) => `${entry.countryCode}:${entry.stateCode}`)).size} covered states`,
          `${shippingCenters.length} shipping centers`,
        ],
      },
      accounts: {
        title: 'Account coverage overlay',
        description:
          'Overlay only active accounts so ops can review customer density, shipping alignment, and account ownership without pipeline noise.',
        badges: [
          `${accountPins.length} active accounts`,
          `${new Set(accountPins.map((pin) => pin.territoryId).filter(Boolean)).size} territories with customers`,
          `${accountPins.filter((pin) => !pin.territoryId).length} customer gaps`,
        ],
      },
      pipeline: {
        title: 'Pipeline territory overlay',
        description:
          'Overlay only open leads so Sales, BD, and territory leadership can review routing, assignment gaps, and stage load by geography.',
        badges: [
          `${leadPins.length} open leads`,
          `${leadPins.filter((pin) => !pin.territoryId).length} unassigned`,
          `${leadPins.filter((pin) => pin.stage === 'cis_signed').length} cis signed`,
        ],
      },
      all: {
        title: 'Combined operating view',
        description:
          'Blend customer and pipeline overlays together when the conversation spans coverage, active dealers, and in-flight lead execution.',
        badges: [
          `${accountPins.length + leadPins.length} mapped records`,
          `${operatingQueue.length} operating signals`,
          `${routeExecutionRows.filter((stop) => stop.visitExecutionState === 'checked_in').length} open visits`,
          `${shippingCenters.filter((center) => center.activeLeadCount > 0 || center.activeAccountCount > 0).length} active hubs`,
        ],
      },
    }),
    [accountPins, coverageEntries, leadPins, operatingQueue.length, routeExecutionRows, shippingCenters, territorySummaries],
  );

  const activeModeConfig = modeConfig[mapMode];

  const kpis = {
    activeAccounts: accountPins.length,
    pipelineLeads: leadPins.length,
    statesCovered: new Set(coverageEntries.map((entry) => `${entry.countryCode}:${entry.stateCode}`)).size,
    shippingCenters: shippingCenters.length,
  };

  const isReady = isHydrated && auth && workspace;

  const handlePinClick = (pin: TerritoryMapPinSummary) => {
    if (pin.recordType === 'account') {
      router.push(`/customers/${pin.recordId}`);
      return;
    }

    router.push(`/leads/${pin.recordId}`);
  };

  const openVisitModal = (account: TerritoryMapPinSummary) => {
    setVisitAccount(account);
    setVisitNotes(`Started from territory map for ${account.territoryName ?? 'unassigned territory'}.`);
    setCheckoutNotes('');
    setActiveVisit(null);
  };

  const openVisitModalFromRouteStop = (stop: TerritoryRoutePlanStopSummary) => {
    openVisitModal({
      id: stop.pinId,
      recordType: 'account',
      recordId: stop.recordId,
      label: stop.label,
      status: stop.status,
      latitude: stop.latitude,
      longitude: stop.longitude,
      geoPrecision: stop.geoPrecision,
      ...(stop.city ? { city: stop.city } : {}),
      ...(stop.state ? { state: stop.state } : {}),
      ...(stop.territoryId ? { territoryId: stop.territoryId } : {}),
      ...(stop.territoryCode ? { territoryCode: stop.territoryCode } : {}),
      ...(stop.territoryName ? { territoryName: stop.territoryName } : {}),
      ...(stop.assignedTmUserId ? { assignedTmUserId: stop.assignedTmUserId } : {}),
      ...(stop.assignedTmName ? { assignedTmName: stop.assignedTmName } : {}),
      ...(stop.assignedRdUserId ? { assignedRdUserId: stop.assignedRdUserId } : {}),
      ...(stop.assignedRdName ? { assignedRdName: stop.assignedRdName } : {}),
      ...(stop.accountType ? { accountType: stop.accountType } : {}),
      ...(stop.lastTouchedAt ? { lastTouchedAt: stop.lastTouchedAt } : {}),
    });
  };

  const handleStartVisit = async () => {
    if (!auth || !visitAccount || !trainerUserId) {
      return;
    }

    setIsStartingVisit(true);
    try {
      const startedAt = new Date();
      const session = await createTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, visitAccount.recordId, {
        trainerUserId,
        activityKind: 'site_visit',
        title: `Territory visit - ${visitAccount.label}`,
        scheduledAt: startedAt.toISOString(),
        durationMinutes: 45,
        attendeeCount: 0,
        notes: visitNotes.trim(),
      });

      await checkInTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, session.id, {
        checkedInAt: startedAt.toISOString(),
        notes: visitNotes.trim(),
      });

      notifications.show({
        color: 'green',
        title: 'Visit started',
        message: `${visitAccount.label} now has an active site visit check-in.`,
      });
      setVisitAccount(null);
      setVisitNotes('');
      setCheckoutNotes('');
      setTrainerUserId('');
      setActiveVisit(null);
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Unable to start visit',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsStartingVisit(false);
    }
  };

  const handleCompleteVisit = async () => {
    if (!auth || !visitAccount || !activeVisit || !checkoutNotes.trim()) {
      return;
    }

    setIsCompletingVisit(true);
    try {
      await completeTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, activeVisit.id, {
        completedAt: new Date().toISOString(),
        durationMinutes: activeVisit.durationMinutes || 45,
        attendeeCount: activeVisit.attendeeCount,
        checkoutNotes: checkoutNotes.trim(),
        completionSummary: `Completed from territory map for ${visitAccount.territoryName ?? 'unassigned territory'}.`,
      });

      notifications.show({
        color: 'green',
        title: 'Visit completed',
        message: `${visitAccount.label} site visit was checked out with notes.`,
      });
      setVisitAccount(null);
      setVisitNotes('');
      setCheckoutNotes('');
      setTrainerUserId('');
      setActiveVisit(null);
      setRefreshNonce((current) => current + 1);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Unable to complete visit',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsCompletingVisit(false);
    }
  };

  return (
    <Stack gap="lg" p="md">
      <Paper withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                  <IconMap size={18} />
                </ThemeIcon>
                <Title order={2} fw={800}>
                  Territory Coverage Map
                </Title>
              </Group>
              <Text c="dimmed" maw={920}>
                Dedicated TM coverage view with color-coded state ownership, shipping hubs, and live account or
                pipeline overlays so managers can review coverage without switching tools.
              </Text>
              <Group gap="xs" wrap="wrap">
                <Badge color="blue" variant="light">
                  Prototype map parity
                </Badge>
                <Badge color="teal" variant="light">
                  Live territory kernel
                </Badge>
                <Badge color="orange" variant="light">
                  Real lead + account overlays
                </Badge>
              </Group>
            </Stack>
            <Group gap="sm">
              <Button
                component={Link}
                href="/territories"
                variant="light"
                leftSection={<IconArrowRight size={14} />}
              >
                Open Territory Dashboard
              </Button>
              <Button component={Link} href="/leads/activities" variant="subtle" color="gray">
                Open Workflow Queue
              </Button>
            </Group>
          </Group>
        </Stack>
      </Paper>

      {isLoading ? (
        <Paper withBorder radius="xl" p="xl" className="premium-stat-card">
          <Group gap="sm" justify="center">
            <Loader size="sm" />
            <Text c="dimmed">Loading live territory map workspace…</Text>
          </Group>
        </Paper>
      ) : null}

      {!auth && isHydrated ? (
        <Alert radius="xl" color="blue" variant="light" title="Sign in required">
          Sign in to load the territory coverage map.
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert radius="xl" color="red" variant="light" title="Map workspace unavailable" icon={<IconAlertCircle size={16} />}>
          {errorMessage}
        </Alert>
      ) : null}

      {isReady ? (
        <>
          <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
            <Paper withBorder radius="xl" p="md" className="premium-stat-card">
              <Group gap="xs" mb={6}>
                <ThemeIcon color="blue" variant="light">
                  <IconUsers size={14} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" fw={600}>
                  Active Accounts
                </Text>
              </Group>
              <Text size="xl" fw={800}>
                {kpis.activeAccounts}
              </Text>
            </Paper>
            <Paper withBorder radius="xl" p="md" className="premium-stat-card">
              <Group gap="xs" mb={6}>
                <ThemeIcon color="teal" variant="light">
                  <IconTruck size={14} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" fw={600}>
                  Leads In Pipeline
                </Text>
              </Group>
              <Text size="xl" fw={800}>
                {kpis.pipelineLeads}
              </Text>
            </Paper>
            <Paper withBorder radius="xl" p="md" className="premium-stat-card">
              <Group gap="xs" mb={6}>
                <ThemeIcon color="violet" variant="light">
                  <IconTargetArrow size={14} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" fw={600}>
                  States Covered
                </Text>
              </Group>
              <Text size="xl" fw={800}>
                {kpis.statesCovered}
              </Text>
            </Paper>
            <Paper withBorder radius="xl" p="md" className="premium-stat-card">
              <Group gap="xs" mb={6}>
                <ThemeIcon color="orange" variant="light">
                  <IconBuildingWarehouse size={14} />
                </ThemeIcon>
                <Text size="xs" c="dimmed" fw={600}>
                  Shipping Centers
                </Text>
              </Group>
              <Text size="xl" fw={800}>
                {kpis.shippingCenters}
              </Text>
            </Paper>
          </SimpleGrid>

          <Grid gutter="lg" align="stretch">
            <Grid.Col span={{ base: 12, xl: 8 }}>
              <Paper withBorder radius="xl" p="md" h="100%">
                <Stack gap="md" h="100%">
                  <Group justify="space-between" align="flex-start" wrap="wrap">
                    <Stack gap={2}>
                      <Text fw={700}>{activeModeConfig.title}</Text>
                      <Text size="sm" c="dimmed">
                        {activeModeConfig.description}
                      </Text>
                    </Stack>
                    <SegmentedControl
                      value={mapMode}
                      onChange={(value) => setMapMode(value as MapMode)}
                      data={[
                        { label: `Coverage (${territorySummaries.length})`, value: 'coverage' },
                        { label: `Accounts (${accountPins.length})`, value: 'accounts' },
                        { label: `Pipeline (${leadPins.length})`, value: 'pipeline' },
                        { label: `All (${accountPins.length + leadPins.length})`, value: 'all' },
                      ]}
                    />
                  </Group>

                  <Paper radius="lg" p="sm" withBorder style={{ background: 'rgba(248, 250, 252, 0.92)' }}>
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                      <Stack gap={2}>
                        <Text size="sm" fw={700}>
                          Mode summary
                        </Text>
                        <Text size="xs" c="dimmed">
                          Switch modes depending on whether the conversation is about ownership coverage, active
                          customers, pipeline load, or the combined operating view.
                        </Text>
                      </Stack>
                      <Group gap="xs" wrap="wrap">
                        {activeModeConfig.badges.map((badge) => (
                          <Badge key={`${mapMode}:${badge}`} color="blue" variant="light">
                            {badge}
                          </Badge>
                        ))}
                      </Group>
                    </Group>
                  </Paper>

                  <Box
                    style={{
                      height: 680,
                      borderRadius: 20,
                      overflow: 'hidden',
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                    }}
                  >
                    <TerritoryMapLibre
                      coverageEntries={coverageEntries}
                      pins={overlayPins}
                      shippingCenters={shippingCenters}
                      showBoundaries
                      showPins={overlayPins.length > 0}
                      onPinClick={handlePinClick}
                    />
                  </Box>

                  <Paper radius="lg" p="sm" withBorder style={{ background: 'rgba(248, 250, 252, 0.9)' }}>
                    <Group gap="lg" wrap="wrap">
                      <Group gap="xs">
                        <Text fw={700}>Legend</Text>
                      </Group>
                      <Group gap={6}>
                        <Box style={{ width: 10, height: 10, borderRadius: 999, background: '#16a34a' }} />
                        <Text size="sm">Active account</Text>
                      </Group>
                      <Group gap={6}>
                        <Box style={{ width: 10, height: 10, borderRadius: 999, background: '#2563eb' }} />
                        <Text size="sm">Assigned pipeline lead</Text>
                      </Group>
                      <Group gap={6}>
                        <Box style={{ width: 10, height: 10, borderRadius: 999, background: '#f97316' }} />
                        <Text size="sm">Unassigned lead</Text>
                      </Group>
                      <Group gap={6}>
                        <Text size="lg">★</Text>
                        <Text size="sm">Shipping hub</Text>
                      </Group>
                    </Group>
                  </Paper>
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 4 }}>
              <Stack gap="lg" h="100%">
                <Paper withBorder radius="xl" p="md">
                  <Stack gap="sm">
                    <Group gap="xs">
                      <ThemeIcon color="teal" variant="light">
                        <IconBuildingWarehouse size={16} />
                      </ThemeIcon>
                      <Text fw={700}>Shipping hubs</Text>
                    </Group>
                    {shippingCenters.map((center) => (
                      <Paper key={center.id} withBorder radius="lg" p="sm">
                        <Group justify="space-between" align="flex-start">
                          <Stack gap={2}>
                            <Text fw={700} size="sm">
                              {center.name}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {[center.city, center.state].filter(Boolean).join(', ') || center.countryCode}
                            </Text>
                            <Text size="xs" c="dimmed">
                              Geo source: {formatGeoPrecision(center.geoPrecision)}
                            </Text>
                          </Stack>
                          <Badge color="teal" variant="light">
                            {center.servicedTerritoryCount} territories
                          </Badge>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                <Paper withBorder radius="xl" p="md" style={{ flex: 1, minHeight: 0 }}>
                  <Stack gap="sm" h="100%">
                    <Group justify="space-between" align="center">
                      <Group gap="xs">
                        <ThemeIcon color="blue" variant="light">
                          <IconMapPinStar size={16} />
                        </ThemeIcon>
                        <Text fw={700}>
                          {mapMode === 'coverage'
                            ? 'Territory coverage by owner'
                            : mapMode === 'accounts'
                              ? 'Active accounts in coverage'
                              : mapMode === 'pipeline'
                                ? 'Pipeline load in coverage'
                                : 'Territory operating queue'}
                        </Text>
                      </Group>
                      <Badge color="gray" variant="light">
                        {mapMode === 'coverage'
                          ? `${territorySummaries.length} records`
                          : mapMode === 'accounts'
                            ? `${accountRows.length} shown`
                            : mapMode === 'pipeline'
                              ? `${pipelineRows.length} shown`
                              : `${operatingQueue.length} items`}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {mapMode === 'coverage'
                        ? 'State ownership, TM/RD alignment, and shipping-center posture from the live territory kernel.'
                        : mapMode === 'accounts'
                          ? 'Customer density and account ownership using the current propagated territory truth.'
                          : mapMode === 'pipeline'
                            ? 'Open leads by geography, assignment gap, and current stage.'
                            : 'Cross-entity signals for routing, onboarding, and downstream territory operations.'}
                    </Text>
                    <Divider />
                    <ScrollArea h={620} offsetScrollbars>
                      {mapMode === 'coverage' ? (
                        <Stack gap="sm">
                          <Paper withBorder radius="lg" p="md" className="premium-subhero-panel">
                            <Stack gap="sm">
                              <Group justify="space-between" align="flex-start">
                                <Stack gap={2}>
                                  <Text size="sm" fw={700}>
                                    Coverage briefing
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    A quick summary of where coverage is widest, where customer load is heaviest, and
                                    where pipeline pressure is concentrated.
                                  </Text>
                                </Stack>
                                <Badge color="blue" variant="light">
                                  Territory overview
                                </Badge>
                              </Group>
                              <SimpleGrid cols={1} spacing="sm">
                                <Paper withBorder radius="lg" p="md" className="premium-stat-card">
                                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    Widest coverage
                                  </Text>
                                  <Text fw={800} size="lg">
                                    {coverageHighlights.widestCoverage?.territoryName ?? '—'}
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    {coverageHighlights.widestCoverage?.statesCovered.length ?? 0} covered states
                                  </Text>
                                </Paper>
                                <Paper withBorder radius="lg" p="md" className="premium-stat-card">
                                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    Heaviest customer load
                                  </Text>
                                  <Text fw={800} size="lg">
                                    {coverageHighlights.heaviestAccountLoad?.territoryName ?? '—'}
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    {coverageHighlights.heaviestAccountLoad?.activeAccountCount ?? 0} active accounts
                                  </Text>
                                </Paper>
                                <Paper withBorder radius="lg" p="md" className="premium-stat-card">
                                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                                    Largest pipeline
                                  </Text>
                                  <Text fw={800} size="lg">
                                    {coverageHighlights.busiestPipeline?.territoryName ?? '—'}
                                  </Text>
                                  <Text size="sm" c="dimmed">
                                    {coverageHighlights.busiestPipeline?.pipelineLeadCount ?? 0} open leads
                                  </Text>
                                </Paper>
                              </SimpleGrid>
                            </Stack>
                          </Paper>

                          {territorySummaries.map((territory) => (
                            <Paper key={territory.territoryId} withBorder radius="lg" p="md">
                              <Stack gap="xs">
                                <Group justify="space-between" align="flex-start">
                                  <Stack gap={0}>
                                    <Text fw={700} size="sm">
                                      {territory.territoryName}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {territory.regionName} · {territory.territoryCode}
                                    </Text>
                                  </Stack>
                                  <Badge color="blue" variant="light">
                                    {territory.statesCovered.length} states
                                  </Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  TM: {territory.assignedTmName ?? 'Unassigned'} · RD: {territory.assignedRdName ?? 'Unassigned'}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Shipping: {territory.shippingCenterName ?? 'Unassigned'}
                                </Text>
                                {territory.statesCovered.length > 0 ? (
                                  <Group gap={6} wrap="wrap">
                                    {territory.statesCovered.map((state) => (
                                      <Badge key={`${territory.territoryId}:${state}`} size="xs" variant="outline" color="gray">
                                        {state}
                                      </Badge>
                                    ))}
                                  </Group>
                                ) : null}
                                <SimpleGrid cols={3} spacing="xs">
                                  <Paper withBorder radius="md" p="xs">
                                    <Text size="xs" c="dimmed">Accounts</Text>
                                    <Text fw={700}>{territory.activeAccountCount}</Text>
                                  </Paper>
                                  <Paper withBorder radius="md" p="xs">
                                    <Text size="xs" c="dimmed">Pipeline</Text>
                                    <Text fw={700}>{territory.pipelineLeadCount}</Text>
                                  </Paper>
                                  <Paper withBorder radius="md" p="xs">
                                    <Text size="xs" c="dimmed">Unassigned</Text>
                                    <Text fw={700}>{territory.unassignedLeadCount}</Text>
                                  </Paper>
                                </SimpleGrid>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : null}

                      {mapMode === 'accounts' ? (
                        <Stack gap="sm">
                          {accountRows.map((account) => (
                            <Paper key={account.id} withBorder radius="lg" p="md">
                              <Stack gap="xs">
                                <Group justify="space-between" align="flex-start">
                                  <Stack gap={0}>
                                    <Text fw={700} size="sm">
                                      {account.label}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {[account.city, account.state].filter(Boolean).join(', ') || account.state || 'Location unavailable'}
                                    </Text>
                                  </Stack>
                                  <Badge color="teal" variant="light">
                                    {account.territoryName ?? 'Unassigned'}
                                  </Badge>
                                </Group>
                                <Group gap="xs" wrap="wrap">
                                  <Badge size="xs" variant="outline" color="gray">
                                    {account.shippingCenterName ?? 'No shipping center'}
                                  </Badge>
                                  <Badge size="xs" variant="outline" color="gray">
                                    {account.accountType ?? 'Account'}
                                  </Badge>
                                  <Badge size="xs" variant="light" color="blue">
                                    {formatGeoPrecision(account.geoPrecision)}
                                  </Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  Last touched {formatLastTouched(account.lastTouchedAt)} · TM {account.assignedTmName ?? 'Unassigned'}
                                </Text>
                                <Group gap="xs">
                                  <Button size="xs" variant="light" onClick={() => openVisitModal(account)}>
                                    Start Visit
                                  </Button>
                                  <Button component={Link} href={`/customers/${account.recordId}`} size="xs" variant="subtle" color="gray">
                                    Open Account
                                  </Button>
                                </Group>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : null}

                      {mapMode === 'pipeline' ? (
                        <Stack gap="sm">
                          {pipelineRows.map((lead) => (
                            <Paper key={lead.id} withBorder radius="lg" p="md">
                              <Stack gap="xs">
                                <Group justify="space-between" align="flex-start">
                                  <Stack gap={0}>
                                    <Text fw={700} size="sm">
                                      {lead.label}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {lead.state ?? 'Unknown state'} · {lead.assignedTmName ?? 'Unassigned TM'}
                                    </Text>
                                  </Stack>
                                  <Badge color={!lead.territoryId ? 'orange' : 'blue'} variant="light">
                                    {!lead.territoryId ? 'Needs assignment' : formatStageLabel(lead.stage)}
                                  </Badge>
                                </Group>
                                <Group gap="xs" wrap="wrap">
                                  <Badge size="xs" variant="outline" color="gray">
                                    {lead.territoryName ?? 'Unassigned territory'}
                                  </Badge>
                                  <Badge size="xs" variant="outline" color="gray">
                                    {formatLifecycleLabel(lead.lifecycleStatus)}
                                  </Badge>
                                  {lead.sourceLabel ? (
                                    <Badge size="xs" variant="light" color="blue">
                                      {lead.sourceLabel}
                                    </Badge>
                                  ) : null}
                                </Group>
                                <Text size="xs" c="dimmed">
                                  Last touched {formatLastTouched(lead.lastTouchedAt)} · Geo source {formatGeoPrecision(lead.geoPrecision)}
                                </Text>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : null}

                      {mapMode === 'all' ? (
                        <Stack gap="sm">
                          <Paper withBorder radius="lg" p="md">
                            <Stack gap="sm">
                              <Group justify="space-between" align="center">
                                <Group gap="xs">
                                  <ThemeIcon color="teal" variant="light" size="sm">
                                    <IconRouteSquare size={14} />
                                  </ThemeIcon>
                                  <Text size="sm" fw={700}>
                                    Route execution
                                  </Text>
                                </Group>
                                <Badge color="teal" variant="light">
                                  {routeExecutionRows.length} stops
                                </Badge>
                              </Group>
                              {routeExecutionRows.length > 0 ? (
                                <Stack gap="xs">
                                  {routeExecutionRows.map((stop) => (
                                    <Paper key={`${stop.routePlanId}:${stop.recordId}`} withBorder radius="md" p="sm">
                                      <Stack gap={6}>
                                        <Group justify="space-between" align="flex-start">
                                          <Stack gap={0}>
                                            <Text fw={700} size="sm">
                                              #{stop.sequence} {stop.label}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                              {stop.routeLabel} · {stop.assignedTmName ?? 'Unassigned TM'}
                                            </Text>
                                          </Stack>
                                          <Badge color={getVisitExecutionColor(stop.visitExecutionState)} variant="light">
                                            {formatVisitExecutionLabel(stop.visitExecutionState)}
                                          </Badge>
                                        </Group>
                                        <Text size="xs" c="dimmed">
                                          {[stop.city, stop.state].filter(Boolean).join(', ') || 'Location unavailable'} · {stop.distanceFromPreviousMiles} mi from previous
                                        </Text>
                                        {stop.lastVisitCompletedAt ? (
                                          <Text size="xs" c="dimmed">
                                            Last completed {formatLastTouched(stop.lastVisitCompletedAt)}
                                            {stop.lastVisitTrainerName ? ` by ${stop.lastVisitTrainerName}` : ''}
                                          </Text>
                                        ) : null}
                                        <Group gap="xs">
                                          <Button size="xs" variant="light" onClick={() => openVisitModalFromRouteStop(stop)}>
                                            {stop.visitExecutionState === 'checked_in' ? 'Complete Visit' : 'Start Visit'}
                                          </Button>
                                          <Button component={Link} href={`/customers/${stop.recordId}`} size="xs" variant="subtle" color="gray">
                                            Open Account
                                          </Button>
                                        </Group>
                                      </Stack>
                                    </Paper>
                                  ))}
                                </Stack>
                              ) : (
                                <Text size="sm" c="dimmed">
                                  No account route stops are visible for the current territory scope.
                                </Text>
                              )}
                            </Stack>
                          </Paper>

                          {operatingQueue.map((item) => (
                            <Paper key={item.id} withBorder radius="lg" p="md">
                              <Stack gap="xs">
                                <Group justify="space-between" align="flex-start">
                                  <Stack gap={0}>
                                    <Text fw={700} size="sm">
                                      {item.label}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {item.owner}
                                    </Text>
                                  </Stack>
                                  <Badge color={item.tone} variant="light">
                                    {item.signal}
                                  </Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                  {item.detail}
                                </Text>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : null}
                    </ScrollArea>
                  </Stack>
                </Paper>
              </Stack>
            </Grid.Col>
          </Grid>
        </>
      ) : null}

      <Modal
        opened={Boolean(visitAccount)}
        onClose={() => setVisitAccount(null)}
        centered
        title={visitAccount ? `Start Visit - ${visitAccount.label}` : 'Start Visit'}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {activeVisit
              ? 'Complete the active site visit using the required checkout notes from the training execution workflow.'
              : 'Create a real site-visit session and check in immediately using the training execution workflow.'}
          </Text>
          {activeVisit ? (
            <Alert color="blue" variant="light" title="Checked-in visit found">
              {activeVisit.title} is currently checked in for {activeVisit.trainerName ?? 'the selected field owner'}.
            </Alert>
          ) : null}
          {!activeVisit ? (
            <>
              <Select
                label="Trainer / field owner"
                placeholder="Select field owner"
                data={trainers.map((entry) => ({
                  value: entry.userId,
                  label: `${entry.displayName}${entry.title ? ` · ${entry.title}` : ''}`,
                }))}
                value={trainerUserId}
                onChange={(value) => setTrainerUserId(value ?? '')}
                searchable
                disabled={isLoadingTrainers || isStartingVisit}
              />
              <Textarea
                label="Visit notes"
                minRows={3}
                value={visitNotes}
                onChange={(event) => setVisitNotes(event.currentTarget.value)}
                disabled={isStartingVisit}
              />
            </>
          ) : (
            <Textarea
              label="Checkout notes"
              minRows={3}
              value={checkoutNotes}
              onChange={(event) => setCheckoutNotes(event.currentTarget.value)}
              disabled={isCompletingVisit}
              required
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setVisitAccount(null)} disabled={isStartingVisit || isCompletingVisit}>
              Cancel
            </Button>
            {activeVisit ? (
              <Button
                onClick={() => void handleCompleteVisit()}
                loading={isCompletingVisit}
                disabled={!checkoutNotes.trim()}
              >
                Complete Visit
              </Button>
            ) : (
              <Button
                onClick={() => void handleStartVisit()}
                loading={isStartingVisit}
                disabled={!trainerUserId || isLoadingTrainers}
              >
                Start Visit
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

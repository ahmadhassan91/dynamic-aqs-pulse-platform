'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Loader,
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
  Tooltip,
} from '@mantine/core';
import { IconCalendarPlus, IconClipboardCheck, IconClockEdit } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import {
  createTrainingCategoryRecord,
  createTrainingTemplateRecord,
  createTrainingTypeRecord,
  fetchTrainingAccounts,
  fetchTrainingCatalog,
  fetchTrainingOverview,
  fetchTrainingSessions,
  fetchTrainingTrainers,
} from '@/lib/pulse-api';
import type {
  CreateTrainingCategoryRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  ListTrainingAccountStatusKey,
  ListTrainingOperationalQueueResponse,
  ListTrainingSessionsResponse,
  ListTrainingSessionStatusKey,
  TrainingCatalogResponse,
  TrainingOperationalCertificationQueueItem,
  TrainingOperationalExceptionQueueItem,
  TrainingOverviewResponse,
  TrainingSessionSummary,
  TrainingTrainerSummary,
} from '@pulse/contracts';
import { TrainingSessionExecutionModal } from './TrainingSessionExecutionModal';
import { TrainingSessionSchedulerModal } from './TrainingSessionSchedulerModal';

type CatalogForms = {
  category: CreateTrainingCategoryRequest;
  trainingType: CreateTrainingTypeRequest;
  template: CreateTrainingTemplateRequest;
};

const DEFAULT_CATEGORY_FORM: CreateTrainingCategoryRequest = {
  kind: 'custom',
  code: '',
  name: '',
  description: '',
};

const DEFAULT_TYPE_FORM: CreateTrainingTypeRequest = {
  categoryId: '',
  code: '',
  name: '',
  description: '',
  family: 'custom',
  deliveryMode: 'custom',
  defaultDurationMinutes: 60,
};

const DEFAULT_TEMPLATE_FORM: CreateTrainingTemplateRequest = {
  trainingTypeId: '',
  code: '',
  title: '',
  description: '',
  proofRequirement: 'attendance_and_notes',
};

function formatDate(value?: string) {
  if (!value) {
    return 'Not set';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Not scheduled';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

async function fetchTrainingOperationalQueue(
  apiBaseUrl: string,
  accessToken: string,
  query: {
    ownerTmUserId?: string;
    ownerRdUserId?: string;
    certificationWindowDays?: number;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.ownerTmUserId) {
    params.set('ownerTmUserId', query.ownerTmUserId);
  }
  if (query.ownerRdUserId) {
    params.set('ownerRdUserId', query.ownerRdUserId);
  }
  if (query.certificationWindowDays) {
    params.set('certificationWindowDays', String(query.certificationWindowDays));
  }

  const response = await fetch(
    `${apiBaseUrl}/api/v1/training/ops${params.toString() ? `?${params.toString()}` : ''}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.error?.message
      || payload?.detail
      || payload?.message
      || `Training ops queue request failed (${response.status})`,
    );
  }

  return response.json() as Promise<ListTrainingOperationalQueueResponse>;
}

function trainingStatusColor(session: TrainingSessionSummary) {
  if (session.executionState === 'checked_in') {
    return 'orange';
  }
  if (session.isOverdue) {
    return 'red';
  }
  if (session.status === 'completed') {
    return 'green';
  }
  if (session.status === 'cancelled') {
    return 'gray';
  }
  if (session.status === 'no_show') {
    return 'yellow';
  }
  return 'blue';
}

function exceptionSeverityColor(severity: TrainingOperationalExceptionQueueItem['severity']) {
  if (severity === 'high') {
    return 'red';
  }
  if (severity === 'medium') {
    return 'orange';
  }
  return 'blue';
}

function certificationQueueColor(item: TrainingOperationalCertificationQueueItem) {
  if (item.daysUntilExpiry < 0 || item.status === 'expired') {
    return 'red';
  }
  if (item.daysUntilExpiry <= 14) {
    return 'orange';
  }
  return 'blue';
}

export function TrainingWorkspace() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<string | null>(initialTab);
  const [overview, setOverview] = useState<TrainingOverviewResponse | null>(null);
  const [catalog, setCatalog] = useState<TrainingCatalogResponse | null>(null);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof fetchTrainingAccounts>> | null>(null);
  const [sessions, setSessions] = useState<ListTrainingSessionsResponse | null>(null);
  const [operationalQueue, setOperationalQueue] = useState<ListTrainingOperationalQueueResponse | null>(null);
  const [trainers, setTrainers] = useState<TrainingTrainerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListTrainingAccountStatusKey>('all');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<ListTrainingSessionStatusKey>('all');
  const [opsTmFilter, setOpsTmFilter] = useState<string | null>(null);
  const [opsRdFilter, setOpsRdFilter] = useState<string | null>(null);
  const [opsCertificationWindowDays, setOpsCertificationWindowDays] = useState<string>('45');
  const [includeVisits, setIncludeVisits] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forms, setForms] = useState<CatalogForms>({
    category: DEFAULT_CATEGORY_FORM,
    trainingType: DEFAULT_TYPE_FORM,
    template: DEFAULT_TEMPLATE_FORM,
  });
  const [schedulerContext, setSchedulerContext] = useState<{
    accountId: string;
    accountName: string;
    existingSession?: TrainingSessionSummary | null;
  } | null>(null);
  const [executionSession, setExecutionSession] = useState<TrainingSessionSummary | null>(null);

  const canManageCatalog = auth ? canPerformAction(auth.identity.role, 'training.catalog_manage') : false;
  const canSchedule = auth ? canPerformAction(auth.identity.role, 'training.schedule') : false;

  const loadWorkspace = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [nextOverview, nextCatalog, nextAccounts, nextSessions, nextTrainers, nextOperationalQueue] = await Promise.all([
        fetchTrainingOverview(apiBaseUrl, accessToken),
        fetchTrainingCatalog(apiBaseUrl, accessToken),
        fetchTrainingAccounts(apiBaseUrl, accessToken, {
          ...(search ? { search } : {}),
          status: statusFilter,
          limit: 100,
        }),
        fetchTrainingSessions(apiBaseUrl, accessToken, {
          status: sessionStatusFilter,
          includeVisits,
          limit: 100,
        }),
        fetchTrainingTrainers(apiBaseUrl, accessToken),
        fetchTrainingOperationalQueue(apiBaseUrl, accessToken, {
          ...(opsTmFilter ? { ownerTmUserId: opsTmFilter } : {}),
          ...(opsRdFilter ? { ownerRdUserId: opsRdFilter } : {}),
          certificationWindowDays: Number(opsCertificationWindowDays || 45),
        }),
      ]);

      setOverview(nextOverview);
      setCatalog(nextCatalog);
      setAccounts(nextAccounts);
      setSessions(nextSessions);
      setTrainers(nextTrainers.items);
      setOperationalQueue(nextOperationalQueue);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [
    accessToken,
    apiBaseUrl,
    auth,
    includeVisits,
    opsCertificationWindowDays,
    opsRdFilter,
    opsTmFilter,
    search,
    sessionStatusFilter,
    statusFilter,
  ]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const categoryOptions = (catalog?.categories ?? []).map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));

  const trainingTypeOptions = (catalog?.trainingTypes ?? []).map((entry) => ({
    value: entry.id,
    label: entry.name,
  }));

  const certificationTrackSummary = useMemo(
    () => (catalog?.trainingTypes ?? []).filter((entry) => entry.isCertificationTrack),
    [catalog],
  );

  const tmFilterOptions = useMemo(() => (
    trainers
      .filter((entry) => entry.roleCode === 'TERRITORY_MANAGER')
      .map((entry) => ({ value: entry.userId, label: entry.displayName }))
  ), [trainers]);

  const rdFilterOptions = useMemo(() => (
    trainers
      .filter((entry) => entry.roleCode === 'REGIONAL_DIRECTOR')
      .map((entry) => ({ value: entry.userId, label: entry.displayName }))
  ), [trainers]);

  const sessionItems = sessions?.items ?? [];

  const handleCategoryCreate = async () => {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createTrainingCategoryRecord(apiBaseUrl, accessToken, forms.category);
      setForms((current) => ({ ...current, category: DEFAULT_CATEGORY_FORM }));
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTypeCreate = async () => {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createTrainingTypeRecord(apiBaseUrl, accessToken, {
        ...forms.trainingType,
        defaultDurationMinutes: Number(forms.trainingType.defaultDurationMinutes || 0),
      });
      setForms((current) => ({ ...current, trainingType: DEFAULT_TYPE_FORM }));
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateCreate = async () => {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      await createTrainingTemplateRecord(apiBaseUrl, accessToken, forms.template);
      setForms((current) => ({ ...current, template: DEFAULT_TEMPLATE_FORM }));
      await loadWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Stack gap="md">
      <Paper shadow="sm" p="md" style={{ background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1}>Training Management</Title>
            <Text size="sm" c="dimmed">
              Manage the Dynamic AQS training catalog, account coverage, certification tracks, scheduled sessions, and follow-up work under the approved Pulse shell.
            </Text>
          </Stack>
          <Group gap="xs">
            {certificationTrackSummary.map((entry) => (
              <Badge key={entry.id} color="violet" variant="light">
                {entry.name}
              </Badge>
            ))}
          </Group>
        </Group>
      </Paper>

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      {isLoading && !overview ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {overview ? (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Accounts tracked</Text>
              <Text fw={700} size="xl">{overview.totalAccountsTracked}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active programs</Text>
              <Text fw={700} size="xl">{overview.activePrograms}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Overdue programs</Text>
              <Text fw={700} size="xl" {...(overview.overduePrograms > 0 ? { c: 'red' as const } : {})}>{overview.overduePrograms}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Scheduled sessions</Text>
              <Text fw={700} size="xl">{overview.scheduledSessions}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Open follow-ups</Text>
              <Text fw={700} size="xl">{overview.openFollowUpTasks}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Certification tracks</Text>
              <Text fw={700} size="xl">{overview.certificationTrackCount}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active certifications</Text>
              <Text fw={700} size="xl">{overview.activeCertificationCount}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Pending certification decisions</Text>
              <Text
                fw={700}
                size="xl"
                {...(overview.pendingCertificationDecisionCount > 0 ? { c: 'orange' as const } : {})}
              >
                {overview.pendingCertificationDecisionCount}
              </Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Execution exceptions</Text>
              <Text
                fw={700}
                size="xl"
                {...(overview.executionExceptionCount > 0 ? { c: 'red' as const } : {})}
              >
                {overview.executionExceptionCount}
              </Text>
            </Card>
          </SimpleGrid>

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="accounts">Accounts &amp; Training</Tabs.Tab>
              <Tabs.Tab value="sessions">Sessions</Tabs.Tab>
              <Tabs.Tab value="ops">Exceptions &amp; Recertification</Tabs.Tab>
              <Tabs.Tab value="catalog">Catalog</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="lg">
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                <Paper withBorder radius="md" p="lg">
                  <Stack gap="sm">
                    <Title order={4}>Current certified tracks</Title>
                    {(catalog?.trainingTypes ?? []).filter((entry) => entry.isCertificationTrack).map((entry) => (
                      <Card key={entry.id} withBorder radius="md" p="md">
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text fw={600}>{entry.name}</Text>
                            <Badge color="violet" variant="light">Certification</Badge>
                          </Group>
                          <Text size="sm" c="dimmed">{entry.description ?? 'No description provided yet.'}</Text>
                        </Stack>
                      </Card>
                    ))}
                  </Stack>
                </Paper>
                <Paper withBorder radius="md" p="lg">
                  <Stack gap="sm">
                    <Title order={4}>Session execution snapshot</Title>
                    <Text size="sm" c="dimmed">
                      Slice B adds real scheduling, rescheduling, completion, no-show handling, and follow-up tasks while keeping Outlook/provider sync parked.
                    </Text>
                    <Divider />
                    <Text size="sm">Scheduled sessions: {sessions?.total ?? 0}</Text>
                    <Text size="sm">Overdue sessions: {sessions?.overdueCount ?? 0}</Text>
                    <Text size="sm">Open follow-up tasks: {sessions?.openFollowUpTaskCount ?? 0}</Text>
                    <Text size="sm">Execution exceptions: {sessions?.executionExceptions.length ?? 0}</Text>
                    <Text size="sm">Available trainers: {trainers.filter((entry) => entry.isActive).length}</Text>
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Tabs.Panel>

            <Tabs.Panel value="accounts" pt="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <TextInput
                    label="Search accounts"
                    placeholder="Search company name"
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                  />
                  <Select
                    label="Coverage filter"
                    value={statusFilter}
                    onChange={(value) => setStatusFilter((value as ListTrainingAccountStatusKey | null) ?? 'all')}
                    data={[
                      { value: 'all', label: 'All accounts' },
                      { value: 'overdue', label: 'Overdue' },
                      { value: 'active_programs', label: 'With active programs' },
                      { value: 'no_programs', label: 'No programs yet' },
                    ]}
                  />
                </Group>

                <Paper withBorder radius="md" p="lg">
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Account</Table.Th>
                        <Table.Th>Territory</Table.Th>
                        <Table.Th>Last Training</Table.Th>
                        <Table.Th>Next Due</Table.Th>
                        <Table.Th>Programs</Table.Th>
                        <Table.Th>Hours</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {(accounts?.items ?? []).length > 0 ? accounts?.items.map((account) => (
                        <Table.Tr key={account.accountId}>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={600}>{account.accountName}</Text>
                              <Text size="sm" c="dimmed">
                                {account.assignedTmName ?? 'No TM assigned'}
                              </Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>{account.territoryName ?? account.regionName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{formatDate(account.lastTrainingAt)}</Table.Td>
                          <Table.Td>{formatDate(account.nextDueAt)}</Table.Td>
                          <Table.Td>
                            <Badge color={account.overdueProgramCount > 0 ? 'red' : 'blue'} variant="light">
                              {account.activeProgramCount} active / {account.overdueProgramCount} overdue
                            </Badge>
                          </Table.Td>
                          <Table.Td>{account.totalTrainingHours.toFixed(1)} hrs</Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              <Button component={Link} href={`/customers/${account.accountId}?tab=training-history`} variant="default" size="xs">
                                Open Account
                              </Button>
                              {canSchedule ? (
                                <Button
                                  size="xs"
                                  leftSection={<IconCalendarPlus size={14} />}
                                  onClick={() => setSchedulerContext({
                                    accountId: account.accountId,
                                    accountName: account.accountName,
                                  })}
                                >
                                  Schedule
                                </Button>
                              ) : null}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      )) : (
                        <Table.Tr>
                          <Table.Td colSpan={8}>
                            <Text c="dimmed">No account training records match the current filters yet.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="sessions" pt="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <Group align="flex-end">
                    <Select
                      label="Session filter"
                      value={sessionStatusFilter}
                      onChange={(value) => setSessionStatusFilter((value as ListTrainingSessionStatusKey | null) ?? 'all')}
                      data={[
                        { value: 'all', label: 'All sessions' },
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'checked_in', label: 'Checked in' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'exceptions', label: 'Execution exceptions' },
                        { value: 'completed', label: 'Completed' },
                        { value: 'cancelled', label: 'Cancelled' },
                        { value: 'no_show', label: 'No show' },
                      ]}
                    />
                    <Checkbox
                      label="Include site visits"
                      checked={includeVisits}
                      onChange={(event) => setIncludeVisits(event.currentTarget.checked)}
                      mb={6}
                    />
                  </Group>
                  <Badge color={sessions?.overdueCount ? 'red' : 'blue'} variant="light">
                    {sessions?.overdueCount ?? 0} overdue
                  </Badge>
                </Group>

                <Paper withBorder radius="md" p="lg">
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Account</Table.Th>
                        <Table.Th>Session</Table.Th>
                        <Table.Th>Trainer</Table.Th>
                        <Table.Th>Scheduled</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Follow-ups</Table.Th>
                        {canSchedule ? <Table.Th>Actions</Table.Th> : null}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sessionItems.length > 0 ? sessionItems.map((session) => (
                        <Table.Tr key={session.id}>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={600}>{session.accountName ?? 'Account'}</Text>
                              <Text size="sm" c="dimmed">{session.programTitle ?? session.trainingTypeName ?? 'Training session'}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text fw={600}>{session.title}</Text>
                              <Text size="sm" c="dimmed">{session.activityKind.replace(/_/g, ' ')}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>{session.trainerName ?? 'Unassigned'}</Table.Td>
                          <Table.Td>{formatDateTime(session.scheduledAt ?? session.completedAt)}</Table.Td>
                          <Table.Td>
                            <Badge color={trainingStatusColor(session)} variant="light">
                              {session.executionState.replace(/_/g, ' ')}
                            </Badge>
                            {session.isCertificationTrack ? (
                              <Badge color="violet" variant="light" ml={6}>
                                {session.certificationOutcome.replace(/_/g, ' ')}
                              </Badge>
                            ) : null}
                          </Table.Td>
                          <Table.Td>{session.openFollowUpTaskCount}</Table.Td>
                          {canSchedule ? (
                            <Table.Td>
                              {session.status === 'scheduled' ? (
                                <Group gap={4} wrap="nowrap">
                                  <Tooltip label="Reschedule">
                                    <ActionIcon
                                      variant="light"
                                      color="blue"
                                      onClick={() => setSchedulerContext({
                                        accountId: session.accountId,
                                        accountName: session.accountName ?? 'Account',
                                        existingSession: session,
                                      })}
                                    >
                                      <IconClockEdit size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Complete / cancel">
                                    <ActionIcon
                                      variant="light"
                                      color="green"
                                      onClick={() => setExecutionSession(session)}
                                    >
                                      <IconClipboardCheck size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              ) : (
                                <Text size="sm" c="dimmed">Logged</Text>
                              )}
                            </Table.Td>
                          ) : null}
                        </Table.Tr>
                      )) : (
                        <Table.Tr>
                          <Table.Td colSpan={canSchedule ? 7 : 6}>
                            <Text c="dimmed">No training sessions match the current filters yet.</Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Paper>

                {sessions && sessions.executionExceptions.length > 0 ? (
                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>Execution exceptions</Title>
                        <Badge color="red" variant="light">{sessions.executionExceptions.length}</Badge>
                      </Group>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Account</Table.Th>
                            <Table.Th>Session</Table.Th>
                            <Table.Th>Issue</Table.Th>
                            <Table.Th>Severity</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {sessions.executionExceptions.map((entry) => (
                            <Table.Tr key={`${entry.sessionId}-${entry.type}`}>
                              <Table.Td>{entry.accountName ?? 'Account'}</Table.Td>
                              <Table.Td>{entry.title}</Table.Td>
                              <Table.Td>{entry.detail}</Table.Td>
                              <Table.Td>
                                <Badge color={entry.severity === 'high' ? 'red' : 'orange'} variant="light">
                                  {entry.severity}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Paper>
                ) : null}
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="ops" pt="lg">
              <Stack gap="md">
                <Group justify="space-between" align="flex-end">
                  <Group align="flex-end">
                    <Select
                      label="Territory manager"
                      placeholder="All TMs"
                      clearable
                      data={tmFilterOptions}
                      value={opsTmFilter}
                      onChange={setOpsTmFilter}
                      searchable
                    />
                    <Select
                      label="Regional director"
                      placeholder="All RDs"
                      clearable
                      data={rdFilterOptions}
                      value={opsRdFilter}
                      onChange={setOpsRdFilter}
                      searchable
                    />
                    <Select
                      label="Expiry window"
                      value={opsCertificationWindowDays}
                      onChange={(value) => setOpsCertificationWindowDays(value ?? '45')}
                      data={[
                        { value: '30', label: 'Next 30 days' },
                        { value: '45', label: 'Next 45 days' },
                        { value: '60', label: 'Next 60 days' },
                        { value: '90', label: 'Next 90 days' },
                      ]}
                    />
                  </Group>
                  <Badge color={(operationalQueue?.summary.unresolvedExecutionExceptionCount ?? 0) > 0 ? 'red' : 'blue'} variant="light">
                    {operationalQueue?.summary.unresolvedExecutionExceptionCount ?? 0} unresolved exceptions
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                  <Card withBorder radius="md" p="md">
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Expiring certifications</Text>
                    <Text fw={700} size="xl">{operationalQueue?.summary.expiringCertificationCount ?? 0}</Text>
                  </Card>
                  <Card withBorder radius="md" p="md">
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Expired certifications</Text>
                    <Text
                      fw={700}
                      size="xl"
                      {...((operationalQueue?.summary.expiredCertificationCount ?? 0) > 0 ? { c: 'red' as const } : {})}
                    >
                      {operationalQueue?.summary.expiredCertificationCount ?? 0}
                    </Text>
                  </Card>
                  <Card withBorder radius="md" p="md">
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Overdue cadence</Text>
                    <Text
                      fw={700}
                      size="xl"
                      {...((operationalQueue?.summary.overdueProgramCount ?? 0) > 0 ? { c: 'orange' as const } : {})}
                    >
                      {operationalQueue?.summary.overdueProgramCount ?? 0}
                    </Text>
                  </Card>
                  <Card withBorder radius="md" p="md">
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Execution exceptions</Text>
                    <Text
                      fw={700}
                      size="xl"
                      {...((operationalQueue?.summary.unresolvedExecutionExceptionCount ?? 0) > 0 ? { c: 'red' as const } : {})}
                    >
                      {operationalQueue?.summary.unresolvedExecutionExceptionCount ?? 0}
                    </Text>
                  </Card>
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, xl: 2 }}>
                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>Expiring certifications</Title>
                        <Badge color="blue" variant="light">{operationalQueue?.expiringCertifications.length ?? 0}</Badge>
                      </Group>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Account</Table.Th>
                            <Table.Th>Certification</Table.Th>
                            <Table.Th>Expires</Table.Th>
                            <Table.Th>Owner</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(operationalQueue?.expiringCertifications ?? []).length > 0 ? operationalQueue?.expiringCertifications.map((item) => (
                            <Table.Tr key={item.certificationId}>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.accountName}</Text>
                                  <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.title}</Text>
                                  <Text size="sm" c="dimmed">{item.trainingTypeName ?? item.trainingTypeCode ?? 'Certification track'}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Text>{formatDate(item.expiresAt)}</Text>
                                  <Badge color={certificationQueueColor(item)} variant="light">
                                    {item.daysUntilExpiry} days
                                  </Badge>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{item.ownerTmName ?? item.ownerRdName ?? 'Unassigned'}</Table.Td>
                            </Table.Tr>
                          )) : (
                            <Table.Tr>
                              <Table.Td colSpan={4}>
                                <Text c="dimmed">No certifications are nearing expiry in the current window.</Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>Expired certifications</Title>
                        <Badge color="red" variant="light">{operationalQueue?.expiredCertifications.length ?? 0}</Badge>
                      </Group>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Account</Table.Th>
                            <Table.Th>Certification</Table.Th>
                            <Table.Th>Expired</Table.Th>
                            <Table.Th>Owner</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(operationalQueue?.expiredCertifications ?? []).length > 0 ? operationalQueue?.expiredCertifications.map((item) => (
                            <Table.Tr key={item.certificationId}>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.accountName}</Text>
                                  <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{item.title}</Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Text>{formatDate(item.expiresAt)}</Text>
                                  <Badge color="red" variant="light">
                                    {Math.abs(item.daysUntilExpiry)} days past due
                                  </Badge>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{item.ownerTmName ?? item.ownerRdName ?? 'Unassigned'}</Table.Td>
                            </Table.Tr>
                          )) : (
                            <Table.Tr>
                              <Table.Td colSpan={4}>
                                <Text c="dimmed">No expired certifications are currently in queue.</Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>Overdue cadence queue</Title>
                        <Badge color="orange" variant="light">{operationalQueue?.overduePrograms.length ?? 0}</Badge>
                      </Group>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Account</Table.Th>
                            <Table.Th>Program</Table.Th>
                            <Table.Th>Next due</Table.Th>
                            <Table.Th>Owner</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(operationalQueue?.overduePrograms ?? []).length > 0 ? operationalQueue?.overduePrograms.map((item) => (
                            <Table.Tr key={item.programId}>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.accountName}</Text>
                                  <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.title}</Text>
                                  <Text size="sm" c="dimmed">{item.trainingTypeName ?? item.trainingTypeCode ?? 'Training program'}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Text>{formatDate(item.nextDueAt)}</Text>
                                  <Badge color="orange" variant="light">
                                    {item.daysOverdue} days overdue
                                  </Badge>
                                </Stack>
                              </Table.Td>
                              <Table.Td>{item.ownerTmName ?? item.ownerRdName ?? 'Unassigned'}</Table.Td>
                            </Table.Tr>
                          )) : (
                            <Table.Tr>
                              <Table.Td colSpan={4}>
                                <Text c="dimmed">No overdue training cadence items are currently in queue.</Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Title order={4}>Execution exceptions</Title>
                        <Badge color="red" variant="light">{operationalQueue?.unresolvedExecutionExceptions.length ?? 0}</Badge>
                      </Group>
                      <Table striped highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Account</Table.Th>
                            <Table.Th>Issue</Table.Th>
                            <Table.Th>Severity</Table.Th>
                            <Table.Th>Action</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {(operationalQueue?.unresolvedExecutionExceptions ?? []).length > 0 ? operationalQueue?.unresolvedExecutionExceptions.map((item) => (
                            <Table.Tr key={`${item.sessionId}-${item.type}`}>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.accountName ?? 'Account'}</Text>
                                  <Text size="sm" c="dimmed">{item.territoryName ?? item.regionName ?? 'Unassigned territory'}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={0}>
                                  <Text fw={600}>{item.title}</Text>
                                  <Text size="sm" c="dimmed">{item.detail}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Badge color={exceptionSeverityColor(item.severity)} variant="light">
                                  {item.severity}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Button component={Link} href={`/customers/${item.accountId}?tab=training-history`} size="xs" variant="default">
                                  Open Account
                                </Button>
                              </Table.Td>
                            </Table.Tr>
                          )) : (
                            <Table.Tr>
                              <Table.Td colSpan={4}>
                                <Text c="dimmed">No unresolved training execution exceptions are currently in queue.</Text>
                              </Table.Td>
                            </Table.Tr>
                          )}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="catalog" pt="lg">
              <Stack gap="md">
                <SimpleGrid cols={{ base: 1, lg: 3 }}>
                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Title order={4}>Add category</Title>
                      <Select
                        label="Kind"
                        data={[
                          { value: 'onboarding', label: 'Onboarding' },
                          { value: 'product', label: 'Product' },
                          { value: 'technical', label: 'Technical' },
                          { value: 'sales', label: 'Sales' },
                          { value: 'compliance', label: 'Compliance' },
                          { value: 'certification', label: 'Certification' },
                          { value: 'custom', label: 'Custom' },
                          { value: 'visit', label: 'Visit' },
                        ]}
                        value={forms.category.kind}
                        disabled={!canManageCatalog}
                        onChange={(value) => setForms((current) => ({
                          ...current,
                          category: {
                            ...current.category,
                            kind: (value as CreateTrainingCategoryRequest['kind'] | null) ?? 'custom',
                          },
                        }))}
                      />
                      <TextInput
                        label="Code"
                        value={forms.category.code}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          category: {
                            ...current.category,
                            code: event.currentTarget.value,
                          },
                        }))}
                      />
                      <TextInput
                        label="Name"
                        value={forms.category.name}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          category: {
                            ...current.category,
                            name: event.currentTarget.value,
                          },
                        }))}
                      />
                      <Textarea
                        label="Description"
                        minRows={2}
                        value={forms.category.description ?? ''}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          category: {
                            ...current.category,
                            description: event.currentTarget.value,
                          },
                        }))}
                      />
                      <Button onClick={() => void handleCategoryCreate()} disabled={!canManageCatalog} loading={isSaving}>
                        Save Category
                      </Button>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Title order={4}>Add training type</Title>
                      <Select
                        label="Category"
                        data={categoryOptions}
                        value={forms.trainingType.categoryId}
                        disabled={!canManageCatalog}
                        onChange={(value) => setForms((current) => ({
                          ...current,
                          trainingType: {
                            ...current.trainingType,
                            categoryId: value ?? '',
                          },
                        }))}
                      />
                      <TextInput
                        label="Code"
                        value={forms.trainingType.code}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          trainingType: {
                            ...current.trainingType,
                            code: event.currentTarget.value,
                          },
                        }))}
                      />
                      <TextInput
                        label="Name"
                        value={forms.trainingType.name}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          trainingType: {
                            ...current.trainingType,
                            name: event.currentTarget.value,
                          },
                        }))}
                      />
                      <Button onClick={() => void handleTypeCreate()} disabled={!canManageCatalog || !forms.trainingType.categoryId} loading={isSaving}>
                        Save Training Type
                      </Button>
                    </Stack>
                  </Paper>

                  <Paper withBorder radius="md" p="lg">
                    <Stack gap="sm">
                      <Title order={4}>Add template</Title>
                      <Select
                        label="Training type"
                        data={trainingTypeOptions}
                        value={forms.template.trainingTypeId}
                        disabled={!canManageCatalog}
                        onChange={(value) => setForms((current) => ({
                          ...current,
                          template: {
                            ...current.template,
                            trainingTypeId: value ?? '',
                          },
                        }))}
                      />
                      <TextInput
                        label="Code"
                        value={forms.template.code}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          template: {
                            ...current.template,
                            code: event.currentTarget.value,
                          },
                        }))}
                      />
                      <TextInput
                        label="Title"
                        value={forms.template.title}
                        disabled={!canManageCatalog}
                        onChange={(event) => setForms((current) => ({
                          ...current,
                          template: {
                            ...current.template,
                            title: event.currentTarget.value,
                          },
                        }))}
                      />
                      <Button onClick={() => void handleTemplateCreate()} disabled={!canManageCatalog || !forms.template.trainingTypeId} loading={isSaving}>
                        Save Template
                      </Button>
                    </Stack>
                  </Paper>
                </SimpleGrid>
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </>
      ) : null}

      {canSchedule && schedulerContext ? (
        <TrainingSessionSchedulerModal
          opened={Boolean(schedulerContext)}
          onClose={() => setSchedulerContext(null)}
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          accountId={schedulerContext.accountId}
          accountName={schedulerContext.accountName}
          catalog={catalog}
          trainers={trainers}
          existingSession={schedulerContext.existingSession ?? null}
          onSaved={loadWorkspace}
        />
      ) : null}

      {canSchedule ? (
        <TrainingSessionExecutionModal
          opened={Boolean(executionSession)}
          onClose={() => setExecutionSession(null)}
          apiBaseUrl={apiBaseUrl}
          accessToken={accessToken}
          session={executionSession}
          trainers={trainers}
          onSaved={loadWorkspace}
        />
      ) : null}
    </Stack>
  );
}

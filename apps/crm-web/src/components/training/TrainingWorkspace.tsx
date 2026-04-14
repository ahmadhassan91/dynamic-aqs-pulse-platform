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
  ListTrainingSessionsResponse,
  ListTrainingSessionStatusKey,
  TrainingCatalogResponse,
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
  const [trainers, setTrainers] = useState<TrainingTrainerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ListTrainingAccountStatusKey>('all');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<ListTrainingSessionStatusKey>('all');
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
      const [nextOverview, nextCatalog, nextAccounts, nextSessions, nextTrainers] = await Promise.all([
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
      ]);

      setOverview(nextOverview);
      setCatalog(nextCatalog);
      setAccounts(nextAccounts);
      setSessions(nextSessions);
      setTrainers(nextTrainers.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, auth, includeVisits, search, sessionStatusFilter, statusFilter]);

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
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }}>
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
          </SimpleGrid>

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="accounts">Accounts &amp; Training</Tabs.Tab>
              <Tabs.Tab value="sessions">Sessions</Tabs.Tab>
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
                        { value: 'overdue', label: 'Overdue' },
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
                            <Badge color={session.isOverdue ? 'red' : session.status === 'completed' ? 'green' : 'blue'} variant="light">
                              {session.status.replace(/_/g, ' ')}
                            </Badge>
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

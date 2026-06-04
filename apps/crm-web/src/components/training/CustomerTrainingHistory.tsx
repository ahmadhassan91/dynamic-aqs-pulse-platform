'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCalendarPlus, IconCheck, IconClockEdit, IconClipboardCheck } from '@tabler/icons-react';
import type {
  AccountTrainingHistoryResponse,
  CreateAccountTrainingProgramRequest,
  ListTrainingSessionsResponse,
  TrainingCatalogResponse,
  TrainingSessionSummary,
  TrainingTrainerSummary,
} from '@pulse/contracts';
import { canPerformAction } from '@/lib/access';
import {
  completeTrainingFollowUpTaskRecord,
  createAccountTrainingProgramRecord,
  fetchAccountTrainingHistory,
  fetchTrainingSessions,
  fetchTrainingTrainers,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { TrainingSessionExecutionModal } from './TrainingSessionExecutionModal';
import { TrainingSessionSchedulerModal } from './TrainingSessionSchedulerModal';

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

export function CustomerTrainingHistory({
  accountId,
  accountName,
  catalog,
}: {
  accountId: string;
  accountName: string;
  catalog: TrainingCatalogResponse | null;
}) {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [history, setHistory] = useState<AccountTrainingHistoryResponse | null>(null);
  const [sessions, setSessions] = useState<ListTrainingSessionsResponse | null>(null);
  const [trainers, setTrainers] = useState<TrainingTrainerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompletingTaskId, setIsCompletingTaskId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState<CreateAccountTrainingProgramRequest>({
    trainingTypeId: '',
    templateId: '',
    notes: '',
  });
  const [schedulerSession, setSchedulerSession] = useState<TrainingSessionSummary | null>(null);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
  const [executionSession, setExecutionSession] = useState<TrainingSessionSummary | null>(null);

  const canSchedule = auth ? canPerformAction(auth.identity.role, 'training.schedule') : false;

  const loadHistory = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [nextHistory, nextSessions, nextTrainers] = await Promise.all([
        fetchAccountTrainingHistory(apiBaseUrl, accessToken, accountId),
        fetchTrainingSessions(apiBaseUrl, accessToken, {
          accountId,
          includeVisits: true,
          status: 'all',
          limit: 50,
        }),
        fetchTrainingTrainers(apiBaseUrl, accessToken),
      ]);
      setHistory(nextHistory);
      setSessions(nextSessions);
      setTrainers(nextTrainers.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, accountId, apiBaseUrl, auth]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const trainingTypeOptions = (catalog?.trainingTypes ?? []).map((entry) => ({
    value: entry.id,
    label: `${entry.name} (${entry.deliveryMode.replace(/_/g, ' ')})`,
  }));

  const templateOptions = (catalog?.templates ?? [])
    .filter((entry) => !programForm.trainingTypeId || entry.trainingTypeId === programForm.trainingTypeId)
    .map((entry) => ({
      value: entry.id,
      label: entry.title,
    }));

  const programOptions = useMemo(
    () => history?.programs ?? [],
    [history],
  );

  const visibleSessions = useMemo(
    () => sessions?.items ?? history?.recentSessions ?? [],
    [history, sessions],
  );

  const scheduledSessions = visibleSessions.filter((session) => session.status === 'scheduled');

  const handleCreateProgram = async () => {
    if (!auth || !programForm.trainingTypeId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createAccountTrainingProgramRecord(apiBaseUrl, accessToken, accountId, {
        ...(programForm.trainingTypeId ? { trainingTypeId: programForm.trainingTypeId } : {}),
        ...(programForm.templateId ? { templateId: programForm.templateId } : {}),
        ...(programForm.notes?.trim() ? { notes: programForm.notes.trim() } : {}),
      });
      setProgramForm({
        trainingTypeId: '',
        templateId: '',
        notes: '',
      });
      await loadHistory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteFollowUpTask = async (taskId: string) => {
    if (!auth) {
      return;
    }

    setIsCompletingTaskId(taskId);
    setErrorMessage(null);
    try {
      await completeTrainingFollowUpTaskRecord(apiBaseUrl, accessToken, taskId, {});
      notifications.show({
        color: 'green',
        title: 'Follow-up completed',
        message: 'The training follow-up task was marked complete.',
      });
      await loadHistory();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCompletingTaskId(null);
    }
  };

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={3}>Training history for {accountName}</Title>
            <Text size="sm" c="dimmed">
              Review overdue coverage, scheduled sessions, certification tracks, and follow-up tasks without leaving the approved customer workflow.
            </Text>
          </Stack>
          <Group gap="xs">
            <Badge color="blue" variant="light">
              {history?.activeProgramCount ?? 0} active programs
            </Badge>
            {canSchedule ? (
              <Button
                leftSection={<IconCalendarPlus size={16} />}
                onClick={() => {
                  setSchedulerSession(null);
                  setIsSchedulerOpen(true);
                }}
              >
                Schedule Session
              </Button>
            ) : null}
          </Group>
        </Group>
      </Paper>

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      {isLoading ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {history ? (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Last training</Text>
              <Text fw={700} size="lg">{formatDate(history.lastTrainingAt)}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Next due</Text>
              <Text fw={700} size="lg">{formatDate(history.nextDueAt)}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Training hours</Text>
              <Text fw={700} size="lg">{history.totalTrainingHours.toFixed(1)} hrs</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Scheduled sessions</Text>
              <Text fw={700} size="lg">{scheduledSessions.length}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Open follow-ups</Text>
              <Text fw={700} size="lg">{history.openFollowUpTasks.length}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Active certifications</Text>
              <Text fw={700} size="lg">{history.certifications.filter((entry) => entry.status === 'active').length}</Text>
            </Card>
            <Card withBorder radius="md" p="md">
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Execution exceptions</Text>
              <Text
                fw={700}
                size="lg"
                {...(history.executionExceptions.length > 0 ? { c: 'red' as const } : {})}
              >
                {history.executionExceptions.length}
              </Text>
            </Card>
          </SimpleGrid>

          {canSchedule ? (
            <Paper withBorder radius="md" p="lg">
              <Stack gap="sm">
                <Title order={4}>Add account training program</Title>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <Select
                    label="Training type"
                    data={trainingTypeOptions}
                    searchable
                    value={programForm.trainingTypeId ?? ''}
                    onChange={(value) => setProgramForm((current) => ({
                      ...current,
                      trainingTypeId: value ?? '',
                      templateId: '',
                    }))}
                  />
                  <Select
                    label="Template"
                    data={templateOptions}
                    searchable
                    disabled={!programForm.trainingTypeId}
                    value={programForm.templateId ?? ''}
                    onChange={(value) => setProgramForm((current) => ({
                      ...current,
                      templateId: value ?? '',
                    }))}
                  />
                </SimpleGrid>
                <Textarea
                  label="Notes"
                  minRows={2}
                  value={programForm.notes ?? ''}
                  onChange={(event) => setProgramForm((current) => ({
                    ...current,
                    notes: event.currentTarget.value,
                  }))}
                />
                <Group justify="flex-end">
                  <Button
                    onClick={() => void handleCreateProgram()}
                    disabled={!programForm.trainingTypeId}
                    loading={isSubmitting}
                  >
                    Add Training Program
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ) : null}

          <Paper withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Title order={4}>Programs</Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Program</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th>Next Due</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.programs.length > 0 ? history.programs.map((program) => (
                    <Table.Tr key={program.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={600}>{program.title}</Text>
                          <Text size="sm" c="dimmed">
                            {program.trainingTypeName ?? 'Custom training program'}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={program.isOverdue ? 'red' : 'blue'} variant="light">
                          {program.status.replace(/_/g, ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{program.ownerTmName ?? program.ownerRdName ?? 'Unassigned'}</Table.Td>
                      <Table.Td>{formatDate(program.nextDueAt)}</Table.Td>
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed">No programs have been added for this account yet.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Title order={4}>Sessions</Title>
                  <Text size="sm" c="dimmed">
                    Schedule, reschedule, complete, or cancel sessions from the real training workflow.
                  </Text>
                </Stack>
                {history.openFollowUpTasks.length > 0 ? (
                  <Badge color="orange" variant="light">
                    {history.openFollowUpTasks.length} open follow-ups
                  </Badge>
                ) : null}
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Session</Table.Th>
                    <Table.Th>Kind</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Hours</Table.Th>
                    {canSchedule ? <Table.Th>Actions</Table.Th> : null}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibleSessions.length > 0 ? visibleSessions.map((session) => (
                    <Table.Tr key={session.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={600}>{session.title}</Text>
                          <Text size="sm" c="dimmed">
                            {session.trainingTypeName ?? session.locationName ?? 'Training activity'}
                          </Text>
                          {session.openFollowUpTaskCount > 0 ? (
                            <Text size="xs" c="orange">
                              {session.openFollowUpTaskCount} open follow-up task{session.openFollowUpTaskCount === 1 ? '' : 's'}
                            </Text>
                          ) : null}
                          {session.fieldActivity.length > 0 ? (
                            <Text size="xs" c="blue">
                              {session.fieldActivity.length} reviewed field note{session.fieldActivity.length === 1 ? '' : 's'}
                            </Text>
                          ) : null}
                        </Stack>
                      </Table.Td>
                      <Table.Td>{session.activityKind.replace(/_/g, ' ')}</Table.Td>
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
                      <Table.Td>{formatDateTime(session.completedAt ?? session.scheduledAt)}</Table.Td>
                      <Table.Td>{session.countsTowardHours ? `${(session.durationMinutes / 60).toFixed(1)} hrs` : 'Visit only'}</Table.Td>
                      {canSchedule ? (
                        <Table.Td>
                          {session.status === 'scheduled' ? (
                            <Group gap={4} wrap="nowrap">
                              <Tooltip label="Reschedule">
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  onClick={() => {
                                    setSchedulerSession(session);
                                    setIsSchedulerOpen(true);
                                  }}
                                >
                                  <IconClockEdit size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Update session">
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
                      <Table.Td colSpan={canSchedule ? 6 : 5}>
                        <Text c="dimmed">No sessions have been logged for this account yet.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="lg">
            <Stack gap="sm">
              <Title order={4}>Open follow-up tasks</Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Task</Table.Th>
                    <Table.Th>Owner</Table.Th>
                    <Table.Th>Due</Table.Th>
                    <Table.Th>Status</Table.Th>
                    {canSchedule ? <Table.Th>Actions</Table.Th> : null}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.openFollowUpTasks.length > 0 ? history.openFollowUpTasks.map((task) => (
                    <Table.Tr key={task.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={600}>{task.title}</Text>
                          <Text size="sm" c="dimmed">{task.description ?? 'No description'}</Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>{task.ownerName ?? 'Unassigned'}</Table.Td>
                      <Table.Td>{formatDateTime(task.dueAt)}</Table.Td>
                      <Table.Td>
                        <Badge color="orange" variant="light">{task.status}</Badge>
                      </Table.Td>
                      {canSchedule ? (
                        <Table.Td>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconCheck size={14} />}
                            loading={isCompletingTaskId === task.id}
                            onClick={() => void handleCompleteFollowUpTask(task.id)}
                          >
                            Complete
                          </Button>
                        </Table.Td>
                      ) : null}
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={canSchedule ? 5 : 4}>
                        <Text c="dimmed">No open follow-up tasks for this account right now.</Text>
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
                <Title order={4}>Certifications</Title>
                <Badge color="violet" variant="light">{history.certifications.length}</Badge>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Certification</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Awarded</Table.Th>
                    <Table.Th>Expires</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.certifications.length > 0 ? history.certifications.map((certification) => (
                    <Table.Tr key={certification.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={600}>{certification.title}</Text>
                          <Text size="sm" c="dimmed">
                            {certification.trainingTypeName ?? certification.trainingTypeCode ?? 'Certification'}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={certification.status === 'active' ? 'green' : certification.status === 'expired' ? 'orange' : 'red'} variant="light">
                          {certification.status.replace(/_/g, ' ')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatDate(certification.awardedAt)}</Table.Td>
                      <Table.Td>{formatDate(certification.expiresAt)}</Table.Td>
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed">No certifications have been recorded for this account yet.</Text>
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
                <Badge color={history.executionExceptions.length > 0 ? 'red' : 'gray'} variant="light">
                  {history.executionExceptions.length}
                </Badge>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Session</Table.Th>
                    <Table.Th>Issue</Table.Th>
                    <Table.Th>Severity</Table.Th>
                    <Table.Th>Scheduled</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.executionExceptions.length > 0 ? history.executionExceptions.map((entry) => (
                    <Table.Tr key={`${entry.sessionId}-${entry.type}`}>
                      <Table.Td>{entry.title}</Table.Td>
                      <Table.Td>{entry.detail}</Table.Td>
                      <Table.Td>
                        <Badge color={entry.severity === 'high' ? 'red' : 'orange'} variant="light">
                          {entry.severity}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{formatDateTime(entry.scheduledAt)}</Table.Td>
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed">No execution exceptions are open for this account right now.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>
        </>
      ) : null}

      {canSchedule ? (
        <>
          <TrainingSessionSchedulerModal
            opened={isSchedulerOpen}
            onClose={() => {
              setIsSchedulerOpen(false);
              setSchedulerSession(null);
            }}
            apiBaseUrl={apiBaseUrl}
            accessToken={accessToken}
            accountId={accountId}
            accountName={accountName}
            catalog={catalog}
            trainers={trainers}
            existingSession={schedulerSession}
            programOptions={programOptions}
            onSaved={loadHistory}
          />
          <TrainingSessionExecutionModal
            opened={Boolean(executionSession)}
            onClose={() => setExecutionSession(null)}
            apiBaseUrl={apiBaseUrl}
            accessToken={accessToken}
            session={executionSession}
            trainers={trainers}
            onSaved={loadHistory}
          />
        </>
      ) : null}
    </Stack>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
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
} from '@mantine/core';
import type {
  AccountTrainingHistoryResponse,
  CreateAccountTrainingProgramRequest,
  TrainingCatalogResponse,
} from '@pulse/contracts';
import { canPerformAction } from '@/lib/access';
import {
  createAccountTrainingProgramRecord,
  fetchAccountTrainingHistory,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [programForm, setProgramForm] = useState<CreateAccountTrainingProgramRequest>({
    trainingTypeId: '',
    templateId: '',
    notes: '',
  });

  const canSchedule = auth ? canPerformAction(auth.identity.role, 'training.schedule') : false;

  const loadHistory = useCallback(async () => {
    if (!auth) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetchAccountTrainingHistory(apiBaseUrl, accessToken, accountId);
      setHistory(response);
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

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={3}>Training history for {accountName}</Title>
            <Text size="sm" c="dimmed">
              Review overdue coverage, active programs, certification tracks, and recent customer-facing training activity.
            </Text>
          </Stack>
          <Badge color="blue" variant="light">
            {history?.activeProgramCount ?? 0} active programs
          </Badge>
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
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">Overdue programs</Text>
              <Text fw={700} size="lg">{history.overdueProgramCount}</Text>
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
              <Title order={4}>Recent sessions</Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Session</Table.Th>
                    <Table.Th>Kind</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Hours</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.recentSessions.length > 0 ? history.recentSessions.map((session) => (
                    <Table.Tr key={session.id}>
                      <Table.Td>
                        <Stack gap={0}>
                          <Text fw={600}>{session.title}</Text>
                          <Text size="sm" c="dimmed">
                            {session.trainingTypeName ?? session.locationName ?? 'Training activity'}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>{session.activityKind.replace(/_/g, ' ')}</Table.Td>
                      <Table.Td>{session.status.replace(/_/g, ' ')}</Table.Td>
                      <Table.Td>{formatDateTime(session.completedAt ?? session.scheduledAt)}</Table.Td>
                      <Table.Td>{session.countsTowardHours ? `${(session.durationMinutes / 60).toFixed(1)} hrs` : 'Visit only'}</Table.Td>
                    </Table.Tr>
                  )) : (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed">No sessions have been logged for this account yet.</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}

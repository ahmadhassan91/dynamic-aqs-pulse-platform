'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Grid,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type {
  AccountTrainingProgramSummary,
  TrainingActivityKindKey,
  TrainingCatalogResponse,
  TrainingSessionSummary,
  TrainingTrainerSummary,
} from '@pulse/contracts';
import {
  createTrainingSessionRecord,
  rescheduleTrainingSessionRecord,
} from '@/lib/pulse-api';

function toLocalDateTimeInput(value?: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string) {
  return new Date(value).toISOString();
}

export function TrainingSessionSchedulerModal({
  opened,
  onClose,
  apiBaseUrl,
  accessToken,
  accountId,
  accountName,
  catalog,
  trainers,
  existingSession,
  programOptions = [],
  mode = 'schedule',
  onSaved,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  accessToken: string;
  accountId: string;
  accountName: string;
  catalog: TrainingCatalogResponse | null;
  trainers: TrainingTrainerSummary[];
  existingSession?: TrainingSessionSummary | null;
  programOptions?: AccountTrainingProgramSummary[];
  mode?: 'schedule' | 'offline';
  onSaved: () => Promise<void> | void;
  onCreated?: (session: TrainingSessionSummary) => void;
}) {
  const [activityKind, setActivityKind] = useState<TrainingActivityKindKey>('training');
  const [trainingTypeId, setTrainingTypeId] = useState('');
  const [programId, setProgramId] = useState('');
  const [trainerUserId, setTrainerUserId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(60);
  const [attendeeCount, setAttendeeCount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }

    const matchingProgram = existingSession?.programId
      ? programOptions.find((entry) => entry.id === existingSession.programId)
      : null;

    setActivityKind(existingSession?.activityKind ?? 'training');
    setTrainingTypeId(existingSession?.trainingTypeId ?? matchingProgram?.trainingTypeId ?? '');
    setProgramId(existingSession?.programId ?? '');
    setTrainerUserId(existingSession?.trainerUserId ?? '');
    setTitle(existingSession?.title ?? '');
    if (mode === 'offline' && !existingSession) {
      const now = new Date();
      const offsetMs = now.getTimezoneOffset() * 60_000;
      setScheduledAt(new Date(now.getTime() - offsetMs).toISOString().slice(0, 16));
    } else {
      setScheduledAt(toLocalDateTimeInput(existingSession?.scheduledAt));
    }
    setDurationMinutes(existingSession?.durationMinutes ?? 60);
    setAttendeeCount(existingSession?.attendeeCount ?? 0);
    setNotes(existingSession?.notes ?? '');
  }, [existingSession, opened, programOptions]);

  const trainingTypeOptions = useMemo(
    () => (catalog?.trainingTypes ?? []).map((entry) => ({
      value: entry.id,
      label: `${entry.name} (${entry.deliveryMode.replace(/_/g, ' ')})`,
    })),
    [catalog],
  );

  const trainerOptions = useMemo(
    () => trainers
      .filter((entry) => entry.isActive)
      .map((entry) => ({
        value: entry.userId,
        label: `${entry.displayName}${entry.title ? ` • ${entry.title}` : ''}`,
      })),
    [trainers],
  );

  const filteredProgramOptions = useMemo(
    () => programOptions.map((entry) => ({
      value: entry.id,
      label: `${entry.title}${entry.nextDueAt ? ` • due ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(entry.nextDueAt))}` : ''}`,
    })),
    [programOptions],
  );

  const selectedTrainingType = useMemo(
    () => (catalog?.trainingTypes ?? []).find((entry) => entry.id === trainingTypeId),
    [catalog, trainingTypeId],
  );

  useEffect(() => {
    if (!existingSession && selectedTrainingType && !title) {
      setTitle(selectedTrainingType.name);
      setDurationMinutes(selectedTrainingType.defaultDurationMinutes);
      setActivityKind(selectedTrainingType.deliveryMode === 'visit' ? 'site_visit' : 'training');
    }
  }, [existingSession, selectedTrainingType, title]);

  const canSubmit = Boolean(
    scheduledAt
    && trainerUserId
    && title.trim()
    && Number(durationMinutes) > 0
    && (existingSession || trainingTypeId || programId),
  );

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    try {
      if (existingSession) {
        await rescheduleTrainingSessionRecord(apiBaseUrl, accessToken, existingSession.id, {
          trainerUserId,
          title: title.trim(),
          scheduledAt: fromLocalDateTimeInput(scheduledAt),
          durationMinutes: Number(durationMinutes),
          attendeeCount: Number(attendeeCount),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        notifications.show({
          color: 'blue',
          title: 'Session rescheduled',
          message: `${title.trim()} was updated for ${accountName}.`,
        });
      } else {
        const createdSession = await createTrainingSessionRecord(apiBaseUrl, accessToken, accountId, {
          ...(programId ? { programId } : {}),
          ...(trainingTypeId ? { trainingTypeId } : {}),
          trainerUserId,
          activityKind,
          title: title.trim(),
          scheduledAt: fromLocalDateTimeInput(scheduledAt),
          durationMinutes: Number(durationMinutes),
          attendeeCount: Number(attendeeCount),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        notifications.show({
          color: 'green',
          title: mode === 'offline' ? 'Session logged' : 'Session scheduled',
          message: mode === 'offline'
            ? `${title.trim()} was recorded for ${accountName}. Open the execution panel to mark it complete.`
            : `${title.trim()} was scheduled for ${accountName}.`,
        });
        onCreated?.(createdSession);
      }

      await onSaved();
      onClose();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: existingSession ? 'Failed to reschedule session' : 'Failed to schedule session',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      title={
        existingSession
          ? `Reschedule Session for ${accountName}`
          : mode === 'offline'
            ? `Log Past Training Session for ${accountName}`
            : `Schedule Training for ${accountName}`
      }
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {mode === 'offline'
            ? 'Record a training session that already happened. Set the date/time to when it actually occurred, then complete the execution record immediately after.'
            : 'Schedule or reschedule account training from the same place the team reviews training history.'}
        </Text>

        {!existingSession ? (
          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Activity kind"
                data={[
                  { value: 'training', label: 'Training Session' },
                  { value: 'site_visit', label: 'Site Visit' },
                ]}
                value={activityKind}
                onChange={(value) => setActivityKind((value as TrainingActivityKindKey | null) ?? 'training')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Account training program"
                placeholder="Optional linked program"
                data={filteredProgramOptions}
                value={programId}
                onChange={(value) => setProgramId(value ?? '')}
                searchable
                clearable
              />
            </Grid.Col>
          </Grid>
        ) : null}

        {!existingSession ? (
          <Select
            label="Training type"
            placeholder="Select training type"
            data={trainingTypeOptions}
            value={trainingTypeId}
            onChange={(value) => setTrainingTypeId(value ?? '')}
            searchable
          />
        ) : (
          <TextInput
            label="Training type"
            value={existingSession.trainingTypeName ?? existingSession.programTitle ?? 'Custom session'}
            readOnly
          />
        )}

        <Grid>
          <Grid.Col span={6}>
            <Select
              label="Trainer"
              placeholder="Select trainer"
              data={trainerOptions}
              value={trainerUserId}
              onChange={(value) => setTrainerUserId(value ?? '')}
              searchable
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput
              label={existingSession ? 'Rescheduled for' : mode === 'offline' ? 'Session occurred at' : 'Scheduled for'}
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <TextInput
              label="Session title"
              value={title}
              onChange={(event) => setTitle(event.currentTarget.value)}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <NumberInput
              label="Duration (mins)"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={setDurationMinutes}
            />
          </Grid.Col>
          <Grid.Col span={3}>
            <NumberInput
              label="Attendees"
              min={0}
              value={attendeeCount}
              onChange={setAttendeeCount}
            />
          </Grid.Col>
        </Grid>

        <Textarea
          label={existingSession ? 'Reschedule notes' : 'Scheduling notes'}
          minRows={3}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />

        <Button onClick={() => void handleSubmit()} loading={isSaving} disabled={!canSubmit}>
          {existingSession ? 'Save Session Changes' : mode === 'offline' ? 'Log Past Session' : 'Schedule Session'}
        </Button>
      </Stack>
    </Modal>
  );
}

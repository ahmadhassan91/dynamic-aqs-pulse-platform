'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
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
  TrainingSessionSummary,
  TrainingTrainerSummary,
  TrainingSessionStatusKey,
} from '@pulse/contracts';
import {
  cancelTrainingSessionRecord,
  completeTrainingSessionRecord,
} from '@/lib/pulse-api';

type SessionActionMode = Extract<TrainingSessionStatusKey, 'completed' | 'cancelled' | 'no_show'>;

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

export function TrainingSessionExecutionModal({
  opened,
  onClose,
  apiBaseUrl,
  accessToken,
  session,
  trainers,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  accessToken: string;
  session: TrainingSessionSummary | null;
  trainers: TrainingTrainerSummary[];
  onSaved: () => Promise<void> | void;
}) {
  const [mode, setMode] = useState<SessionActionMode>('completed');
  const [completedAt, setCompletedAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(60);
  const [attendeeCount, setAttendeeCount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [completionSummary, setCompletionSummary] = useState('');
  const [createFollowUpTask, setCreateFollowUpTask] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDescription, setFollowUpDescription] = useState('');
  const [followUpDueAt, setFollowUpDueAt] = useState('');
  const [followUpOwnerUserId, setFollowUpOwnerUserId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!opened || !session) {
      return;
    }

    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60_000;
    setMode('completed');
    setCompletedAt(new Date(now.getTime() - offsetMs).toISOString().slice(0, 16));
    setDurationMinutes(session.durationMinutes);
    setAttendeeCount(session.attendeeCount);
    setNotes(session.notes ?? '');
    setCompletionSummary(session.completionSummary ?? '');
    setCreateFollowUpTask(false);
    setFollowUpTitle(`Follow-up for ${session.title}`);
    setFollowUpDescription('');
    setFollowUpDueAt('');
    setFollowUpOwnerUserId(session.trainerUserId ?? '');
  }, [opened, session]);

  const trainerOptions = useMemo(
    () => trainers
      .filter((entry) => entry.isActive)
      .map((entry) => ({
        value: entry.userId,
        label: `${entry.displayName}${entry.title ? ` • ${entry.title}` : ''}`,
      })),
    [trainers],
  );

  if (!session) {
    return null;
  }

  const canSubmit = mode === 'completed'
    ? Boolean(completedAt && Number(durationMinutes) > 0)
      && (!createFollowUpTask || followUpTitle.trim())
    : true;

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'completed') {
        await completeTrainingSessionRecord(apiBaseUrl, accessToken, session.id, {
          completedAt: fromLocalDateTimeInput(completedAt),
          durationMinutes: Number(durationMinutes),
          attendeeCount: Number(attendeeCount),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(completionSummary.trim() ? { completionSummary: completionSummary.trim() } : {}),
          ...(createFollowUpTask
            ? {
                createFollowUpTask: {
                  title: followUpTitle.trim(),
                  ...(followUpDescription.trim() ? { description: followUpDescription.trim() } : {}),
                  ...(followUpDueAt ? { dueAt: fromLocalDateTimeInput(followUpDueAt) } : {}),
                  ...(followUpOwnerUserId ? { ownerUserId: followUpOwnerUserId } : {}),
                },
              }
            : {}),
        });
        notifications.show({
          color: 'green',
          title: 'Session completed',
          message: `${session.title} was completed and logged in Pulse.`,
        });
      } else {
        await cancelTrainingSessionRecord(apiBaseUrl, accessToken, session.id, {
          status: mode,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        notifications.show({
          color: mode === 'no_show' ? 'orange' : 'yellow',
          title: mode === 'no_show' ? 'No-show recorded' : 'Session cancelled',
          message: `${session.title} was updated successfully.`,
        });
      }

      await onSaved();
      onClose();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Failed to update session',
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
      title={`Update ${session.title}`}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Complete the training session, mark it as a no-show, or cancel it without leaving the approved Pulse training workflow.
        </Text>

        <Select
          label="Action"
          data={[
            { value: 'completed', label: 'Complete session' },
            { value: 'cancelled', label: 'Cancel session' },
            { value: 'no_show', label: 'Mark as no-show' },
          ]}
          value={mode}
          onChange={(value) => setMode((value as SessionActionMode | null) ?? 'completed')}
        />

        {mode === 'completed' ? (
          <>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Completed at"
                  type="datetime-local"
                  value={completedAt}
                  onChange={(event) => setCompletedAt(event.currentTarget.value)}
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
              label="Completion summary"
              minRows={2}
              value={completionSummary}
              onChange={(event) => setCompletionSummary(event.currentTarget.value)}
            />
          </>
        ) : null}

        <Textarea
          label={mode === 'completed' ? 'Session notes' : 'Reason / notes'}
          minRows={3}
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />

        {mode === 'completed' ? (
          <Stack gap="sm">
            <Checkbox
              label="Create follow-up task"
              checked={createFollowUpTask}
              onChange={(event) => setCreateFollowUpTask(event.currentTarget.checked)}
            />

            {createFollowUpTask ? (
              <>
                <TextInput
                  label="Follow-up title"
                  value={followUpTitle}
                  onChange={(event) => setFollowUpTitle(event.currentTarget.value)}
                />
                <Textarea
                  label="Follow-up description"
                  minRows={2}
                  value={followUpDescription}
                  onChange={(event) => setFollowUpDescription(event.currentTarget.value)}
                />
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Due at"
                      type="datetime-local"
                      value={followUpDueAt}
                      onChange={(event) => setFollowUpDueAt(event.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Select
                      label="Owner"
                      placeholder="Assign to a trainer or manager"
                      data={trainerOptions}
                      value={followUpOwnerUserId}
                      onChange={(value) => setFollowUpOwnerUserId(value ?? '')}
                      searchable
                      clearable
                    />
                  </Grid.Col>
                </Grid>
              </>
            ) : null}
          </Stack>
        ) : null}

        <Button onClick={() => void handleSubmit()} loading={isSaving} disabled={!canSubmit}>
          {mode === 'completed' ? 'Complete Session' : mode === 'no_show' ? 'Save No-show' : 'Cancel Session'}
        </Button>
      </Stack>
    </Modal>
  );
}

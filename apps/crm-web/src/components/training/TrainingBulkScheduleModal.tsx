'use client';

import { useMemo, useState } from 'react';
import { Button, Grid, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { TrainingCatalogResponse, TrainingTrainerSummary } from '@pulse/contracts';
import { createTrainingSessionRecord } from '@/lib/pulse-api';

type AccountRef = { accountId: string; accountName: string };

function fromLocalDateTimeInput(value: string) {
  return new Date(value).toISOString();
}

export function TrainingBulkScheduleModal({
  opened,
  onClose,
  apiBaseUrl,
  accessToken,
  accounts,
  catalog,
  trainers,
  onComplete,
}: {
  opened: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  accessToken: string;
  accounts: AccountRef[];
  catalog: TrainingCatalogResponse | null;
  trainers: TrainingTrainerSummary[];
  onComplete: () => Promise<void> | void;
}) {
  const [trainingTypeId, setTrainingTypeId] = useState('');
  const [trainerUserId, setTrainerUserId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(60);
  const [notes, setNotes] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [progress, setProgress] = useState<{ done: number; errors: string[] } | null>(null);

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

  const selectedType = useMemo(
    () => (catalog?.trainingTypes ?? []).find((t) => t.id === trainingTypeId),
    [catalog, trainingTypeId],
  );

  function handleTypeChange(value: string | null) {
    setTrainingTypeId(value ?? '');
    if (value) {
      const type = (catalog?.trainingTypes ?? []).find((t) => t.id === value);
      if (type) {
        setDurationMinutes(type.defaultDurationMinutes);
      }
    }
  }

  const canSubmit = Boolean(
    trainingTypeId && trainerUserId && scheduledAt && Number(durationMinutes) > 0 && accounts.length > 0,
  );

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    setIsScheduling(true);
    setProgress({ done: 0, errors: [] });
    const errors: string[] = [];
    let done = 0;

    for (const account of accounts) {
      try {
        await createTrainingSessionRecord(apiBaseUrl, accessToken, account.accountId, {
          trainingTypeId,
          trainerUserId,
          title: selectedType?.name ?? 'Training Session',
          scheduledAt: fromLocalDateTimeInput(scheduledAt),
          durationMinutes: Number(durationMinutes),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        done++;
        setProgress({ done, errors: [...errors] });
      } catch (error) {
        const errorMessage = `${account.accountName}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMessage);
        setProgress({ done, errors: [...errors] });
      }
    }

    setIsScheduling(false);

    if (errors.length === 0) {
      notifications.show({
        color: 'green',
        title: 'Bulk schedule complete',
        message: `${done} session${done === 1 ? '' : 's'} scheduled.`,
      });
    } else {
      notifications.show({
        color: 'yellow',
        title: 'Partial completion',
        message: `${done} scheduled, ${errors.length} failed. Check session list for details.`,
      });
    }

    await onComplete();
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      title={`Schedule Training for ${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          All selected accounts will be scheduled for the same session type, trainer, and time.
          Review individual sessions after scheduling to make per-account adjustments.
        </Text>

        <Select
          label="Training type"
          placeholder="Select training type"
          data={trainingTypeOptions}
          value={trainingTypeId}
          onChange={handleTypeChange}
          searchable
        />

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
              label="Scheduled for"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.currentTarget.value)}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <NumberInput
              label="Duration (mins)"
              min={15}
              step={15}
              value={durationMinutes}
              onChange={setDurationMinutes}
            />
          </Grid.Col>
        </Grid>

        <TextInput
          label="Scheduling notes (applies to all sessions)"
          placeholder="Optional — e.g. recertification cycle, batch event"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
        />

        {progress ? (
          <Text size="sm" c={progress.errors.length > 0 ? 'yellow' : 'dimmed'}>
            {progress.done}/{accounts.length} scheduled
            {progress.errors.length > 0 ? ` · ${progress.errors.length} error${progress.errors.length === 1 ? '' : 's'}` : ''}
          </Text>
        ) : null}

        <Button
          onClick={() => void handleSubmit()}
          loading={isScheduling}
          disabled={!canSubmit}
        >
          Schedule {accounts.length} Session{accounts.length === 1 ? '' : 's'}
        </Button>
      </Stack>
    </Modal>
  );
}

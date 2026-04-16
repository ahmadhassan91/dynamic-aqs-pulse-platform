'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Grid,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type {
  LeadSummary,
  TrainingCatalogResponse,
  TrainingTrainerSummary,
  TrainingTypeSummary,
} from '@pulse/contracts';
import type { TrainingAccountSummary } from '@pulse/contracts';
import {
  createTrainingSessionRecord,
  fetchLeads,
  fetchTrainingAccounts,
  fetchTrainingCatalog,
  fetchTrainingTrainers,
  scheduleLeadDiscovery,
} from '@/lib/pulse-api';

type CalendarScheduleMode = 'discovery' | 'training';

function toInitialLocalDateTimeInput(value: Date) {
  const next = new Date(value);
  next.setHours(10, 0, 0, 0);
  const offsetMs = next.getTimezoneOffset() * 60_000;
  return new Date(next.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromLocalDateTimeInput(value: string) {
  return new Date(value).toISOString();
}

function toUserFacingLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'Failed to fetch') {
    return 'Pulse API is unavailable. Make sure the backend is running on localhost:4000 and then reopen the scheduler.';
  }
  if (/cannot access module training/i.test(message) || /training\.schedule/i.test(message)) {
    return 'Your current Pulse role can schedule discovery here, but it does not have training scheduling access. Ask an admin if this role should be allowed to launch training sessions from the centralized calendar.';
  }
  if (/cannot access module leads/i.test(message) || /lead\.intake_manage/i.test(message)) {
    return 'Your current Pulse role can view the centralized calendar, but it does not have lead discovery scheduling access.';
  }

  return message;
}

export function CalendarSchedulerModal({
  opened,
  onClose,
  anchorDate,
  apiBaseUrl,
  accessToken,
  canScheduleDiscovery,
  canScheduleTraining,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  anchorDate: Date | null;
  apiBaseUrl: string;
  accessToken: string;
  canScheduleDiscovery: boolean;
  canScheduleTraining: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [mode, setMode] = useState<CalendarScheduleMode>('discovery');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leadOptions, setLeadOptions] = useState<LeadSummary[]>([]);
  const [trainingAccounts, setTrainingAccounts] = useState<TrainingAccountSummary[]>([]);
  const [trainingCatalog, setTrainingCatalog] = useState<TrainingCatalogResponse | null>(null);
  const [trainers, setTrainers] = useState<TrainingTrainerSummary[]>([]);
  const [leadId, setLeadId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [trainingTypeId, setTrainingTypeId] = useState('');
  const [trainerUserId, setTrainerUserId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(60);
  const [attendeeCount, setAttendeeCount] = useState<number | string>(0);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!opened) {
      return;
    }

    if (!canScheduleDiscovery && canScheduleTraining) {
      setMode('training');
    } else {
      setMode('discovery');
    }
    setScheduledAt(anchorDate ? toInitialLocalDateTimeInput(anchorDate) : '');
    setLeadId('');
    setAccountId('');
    setTrainingTypeId('');
    setTrainerUserId('');
    setTitle('');
    setDurationMinutes(60);
    setAttendeeCount(0);
    setNote('');
    setLoadError(null);

    let cancelled = false;
    setIsLoading(true);

    const jobs: Promise<[LeadSummary[], TrainingAccountSummary[], TrainingCatalogResponse | null, TrainingTrainerSummary[]]> =
      Promise.all([
        canScheduleDiscovery
          ? fetchLeads(apiBaseUrl, accessToken, { lifecycleStatus: 'active', limit: 100 }).then((response) => response.items)
          : Promise.resolve([]),
        canScheduleTraining
          ? fetchTrainingAccounts(apiBaseUrl, accessToken, { limit: 100 }).then((response) => response.items)
          : Promise.resolve([]),
        canScheduleTraining
          ? fetchTrainingCatalog(apiBaseUrl, accessToken)
          : Promise.resolve(null),
        canScheduleTraining
          ? fetchTrainingTrainers(apiBaseUrl, accessToken).then((response) => response.items)
          : Promise.resolve([]),
      ]);

    jobs
      .then(([leadItems, accountItems, catalogResponse, trainerItems]) => {
        if (cancelled) {
          return;
        }

        setLeadOptions(leadItems);
        setTrainingAccounts(accountItems);
        setTrainingCatalog(catalogResponse);
        setTrainers(trainerItems);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setLoadError(toUserFacingLoadError(error));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, anchorDate, apiBaseUrl, canScheduleDiscovery, canScheduleTraining, opened]);

  const trainingTypeOptions = useMemo(
    () => (trainingCatalog?.trainingTypes ?? []).map((entry) => ({
      value: entry.id,
      label: `${entry.name} (${entry.deliveryMode.replace(/_/g, ' ')})`,
    })),
    [trainingCatalog],
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

  const leadSelectOptions = useMemo(
    () => leadOptions.map((entry) => ({
      value: entry.id,
      label: `${entry.companyName} • ${entry.contactDisplayName || entry.email || entry.phone || entry.state || 'Lead'}`,
    })),
    [leadOptions],
  );

  const accountOptions = useMemo(
    () => trainingAccounts.map((entry) => ({
      value: entry.accountId,
      label: `${entry.accountName}${entry.territoryName ? ` • ${entry.territoryName}` : ''}`,
    })),
    [trainingAccounts],
  );

  const selectedTrainingType = useMemo(
    () => (trainingCatalog?.trainingTypes ?? []).find((entry) => entry.id === trainingTypeId),
    [trainingCatalog, trainingTypeId],
  );

  useEffect(() => {
    if (mode !== 'training' || !selectedTrainingType) {
      return;
    }

    if (!title) {
      setTitle(selectedTrainingType.name);
    }
    setDurationMinutes(selectedTrainingType.defaultDurationMinutes);
  }, [mode, selectedTrainingType, title]);

  const canSubmit = mode === 'discovery'
    ? Boolean(leadId && scheduledAt)
    : Boolean(accountId && trainingTypeId && trainerUserId && title.trim() && scheduledAt && Number(durationMinutes) > 0);

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'discovery') {
        await scheduleLeadDiscovery(apiBaseUrl, accessToken, leadId, {
          scheduledAt: fromLocalDateTimeInput(scheduledAt),
          ...(note.trim() ? { note: note.trim() } : {}),
        });

        notifications.show({
          color: 'blue',
          title: 'Discovery scheduled',
          message: 'The lead discovery call was scheduled from the centralized calendar.',
        });
      } else {
        const deliveryMode = selectedTrainingType?.deliveryMode ?? 'virtual';
        const activityKind = deliveryMode === 'visit' || deliveryMode === 'on_site' ? 'site_visit' : 'training';

        await createTrainingSessionRecord(apiBaseUrl, accessToken, accountId, {
          trainingTypeId,
          trainerUserId,
          activityKind,
          title: title.trim(),
          scheduledAt: fromLocalDateTimeInput(scheduledAt),
          durationMinutes: Number(durationMinutes),
          attendeeCount: Number(attendeeCount),
          ...(note.trim() ? { notes: note.trim() } : {}),
        });

        notifications.show({
          color: 'green',
          title: 'Training scheduled',
          message: 'The training session was scheduled from the centralized calendar.',
        });
      }

      await onSaved();
      onClose();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Failed to save calendar schedule',
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
      centered
      size="lg"
      title="Centralized scheduler"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Launch real discovery and training scheduling from the centralized Pulse calendar while keeping the owning
          workflow history intact.
        </Text>

        {loadError ? (
          <Alert color="red">{loadError}</Alert>
        ) : null}

        {(canScheduleDiscovery || canScheduleTraining) ? (
          <SegmentedControl
            value={mode}
            onChange={(value) => setMode(value as CalendarScheduleMode)}
            data={[
              ...(canScheduleDiscovery ? [{ value: 'discovery', label: 'Discovery call' }] : []),
              ...(canScheduleTraining ? [{ value: 'training', label: 'Training session' }] : []),
            ]}
          />
        ) : null}

        {!canScheduleDiscovery && !canScheduleTraining ? (
          <Alert color="yellow">
            Your current Pulse role does not have calendar scheduling permissions for discovery or training workflows.
          </Alert>
        ) : null}

        <TextInput
          label="Scheduled for"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.currentTarget.value)}
          disabled={isLoading}
        />

        {mode === 'discovery' ? (
          <>
            <Select
              label="Lead"
              placeholder="Choose an active lead"
              data={leadSelectOptions}
              value={leadId}
              onChange={(value) => setLeadId(value ?? '')}
              searchable
              disabled={isLoading}
              nothingFoundMessage="No active leads found"
            />
            <Textarea
              label="Schedule note"
              placeholder="Optional discovery note"
              minRows={3}
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              disabled={isLoading}
            />
          </>
        ) : (
          <>
            <Select
              label="Account"
              placeholder="Choose an account"
              data={accountOptions}
              value={accountId}
              onChange={(value) => setAccountId(value ?? '')}
              searchable
              disabled={isLoading}
              nothingFoundMessage="No training accounts found"
            />

            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Training type"
                  placeholder="Select training type"
                  data={trainingTypeOptions}
                  value={trainingTypeId}
                  onChange={(value) => setTrainingTypeId(value ?? '')}
                  searchable
                  disabled={isLoading}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Trainer"
                  placeholder="Select trainer"
                  data={trainerOptions}
                  value={trainerUserId}
                  onChange={(value) => setTrainerUserId(value ?? '')}
                  searchable
                  disabled={isLoading}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={8}>
                <TextInput
                  label="Session title"
                  value={title}
                  onChange={(event) => setTitle(event.currentTarget.value)}
                  disabled={isLoading}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <NumberInput
                  label="Duration (minutes)"
                  value={durationMinutes}
                  min={30}
                  step={15}
                  onChange={setDurationMinutes}
                  disabled={isLoading}
                />
              </Grid.Col>
            </Grid>

            <Grid>
              <Grid.Col span={4}>
                <NumberInput
                  label="Attendees"
                  value={attendeeCount}
                  min={0}
                  step={1}
                  onChange={setAttendeeCount}
                  disabled={isLoading}
                />
              </Grid.Col>
              <Grid.Col span={8}>
                <Textarea
                  label="Session note"
                  placeholder="Optional training note"
                  minRows={3}
                  value={note}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  disabled={isLoading}
                />
              </Grid.Col>
            </Grid>
          </>
        )}

        <Button onClick={() => void handleSubmit()} loading={isSaving} disabled={!canSubmit || isLoading}>
          {mode === 'discovery' ? 'Schedule discovery' : 'Schedule training'}
        </Button>
      </Stack>
    </Modal>
  );
}

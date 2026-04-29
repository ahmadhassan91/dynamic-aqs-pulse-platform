'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  FileInput,
  Grid,
  Group,
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
  TrainingCertificationOutcomeKey,
  TrainingProofDocumentSummary,
  TrainingSessionSummary,
  TrainingTrainerSummary,
  TrainingSessionStatusKey,
} from '@pulse/contracts';
import {
  cancelTrainingSessionRecord,
  checkInTrainingSessionRecord,
  completeTrainingSessionRecord,
  downloadTrainingSessionProofRecord,
  reviewTrainingSessionProofRecord,
  uploadTrainingSessionProofRecord,
} from '@/lib/pulse-api';

type SessionActionMode = 'check_in' | Extract<TrainingSessionStatusKey, 'completed' | 'cancelled' | 'no_show'>;

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

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function downloadBase64File(fileName: string, mimeType: string, contentBase64: string) {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType || 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'training-proof';
  link.click();
  URL.revokeObjectURL(url);
}

function proofReviewBadgeColor(status: TrainingProofDocumentSummary['reviewStatus']) {
  if (status === 'approved') {
    return 'teal';
  }
  if (status === 'rejected') {
    return 'red';
  }
  return 'yellow';
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
  const [checkedInAt, setCheckedInAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | string>(60);
  const [attendeeCount, setAttendeeCount] = useState<number | string>(0);
  const [notes, setNotes] = useState('');
  const [checkoutNotes, setCheckoutNotes] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [proofAttachmentCount, setProofAttachmentCount] = useState<number | string>(0);
  const [proofDocuments, setProofDocuments] = useState<TrainingProofDocumentSummary[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [completionSummary, setCompletionSummary] = useState('');
  const [certificationOutcome, setCertificationOutcome] = useState<TrainingCertificationOutcomeKey>('not_applicable');
  const [certificationTitle, setCertificationTitle] = useState('');
  const [certificationCode, setCertificationCode] = useState('');
  const [certificationExpiresAt, setCertificationExpiresAt] = useState('');
  const [certificationNotes, setCertificationNotes] = useState('');
  const [createFollowUpTask, setCreateFollowUpTask] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDescription, setFollowUpDescription] = useState('');
  const [followUpDueAt, setFollowUpDueAt] = useState('');
  const [followUpOwnerUserId, setFollowUpOwnerUserId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [reviewingProofDocumentId, setReviewingProofDocumentId] = useState<string | null>(null);
  const [downloadingProofDocumentId, setDownloadingProofDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!opened || !session) {
      return;
    }

    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60_000;
    setMode(session.executionState === 'checked_in' ? 'completed' : 'check_in');
    setCheckedInAt(toLocalDateTimeInput(session.checkedInAt ?? new Date(now.getTime() - offsetMs).toISOString()));
    setCompletedAt(new Date(now.getTime() - offsetMs).toISOString().slice(0, 16));
    setDurationMinutes(session.durationMinutes);
    setAttendeeCount(session.attendeeCount);
    setNotes(session.notes ?? '');
    setCheckoutNotes(session.checkoutNotes ?? '');
    setProofNotes(session.proofNotes ?? '');
    setProofAttachmentCount(session.proofAttachmentCount);
    setProofDocuments(session.proofDocuments);
    setProofFiles([]);
    setCompletionSummary(session.completionSummary ?? '');
    setCertificationOutcome(session.isCertificationTrack ? session.certificationOutcome : 'not_applicable');
    setCertificationTitle(session.certifications[0]?.title ?? session.trainingTypeName ?? session.title);
    setCertificationCode(session.certifications[0]?.certificationCode ?? '');
    setCertificationExpiresAt(toLocalDateTimeInput(session.certifications[0]?.expiresAt));
    setCertificationNotes(session.certifications[0]?.notes ?? '');
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

  const canSubmit = mode === 'check_in'
    ? Boolean(checkedInAt)
    : mode === 'completed'
    ? Boolean(completedAt && checkoutNotes.trim() && Number(durationMinutes) > 0)
      && (!createFollowUpTask || followUpTitle.trim())
      : true;

  const handleProofFilesSelected = async (files: File[] | null) => {
    if (!files?.length || !session) {
      setProofFiles([]);
      return;
    }

    setProofFiles(files);
    setIsUploadingProof(true);
    try {
      let latestSession: TrainingSessionSummary | null = null;
      for (const file of files) {
        const response = await uploadTrainingSessionProofRecord(apiBaseUrl, accessToken, session.id, {
          documentType: 'proof_attachment',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: await fileToBase64(file),
        });
        latestSession = response.session;
      }

      if (latestSession) {
        setProofDocuments(latestSession.proofDocuments);
        setProofAttachmentCount(latestSession.proofAttachmentCount);
      }

      notifications.show({
        color: 'blue',
        title: 'Proof uploaded',
        message: `${files.length} proof file${files.length === 1 ? '' : 's'} attached to ${session.title}.`,
      });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Proof upload failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsUploadingProof(false);
      setProofFiles([]);
    }
  };

  const handleReviewProof = async (
    document: TrainingProofDocumentSummary,
    reviewStatus: 'approved' | 'rejected',
  ) => {
    setReviewingProofDocumentId(document.id);
    try {
      const response = await reviewTrainingSessionProofRecord(apiBaseUrl, accessToken, document.id, {
        reviewStatus,
      });
      setProofDocuments(response.session.proofDocuments);
      notifications.show({
        color: reviewStatus === 'approved' ? 'green' : 'orange',
        title: reviewStatus === 'approved' ? 'Proof approved' : 'Proof rejected',
        message: `${document.fileName} was marked ${reviewStatus.replace('_', ' ')}.`,
      });
      await onSaved();
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Proof review failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setReviewingProofDocumentId(null);
    }
  };

  const handleDownloadProof = async (document: TrainingProofDocumentSummary) => {
    setDownloadingProofDocumentId(document.id);
    try {
      const response = await downloadTrainingSessionProofRecord(apiBaseUrl, accessToken, document.id);
      downloadBase64File(response.document.fileName, response.document.mimeType, response.contentBase64);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Proof download failed',
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDownloadingProofDocumentId(null);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'check_in') {
        await checkInTrainingSessionRecord(apiBaseUrl, accessToken, session.id, {
          checkedInAt: fromLocalDateTimeInput(checkedInAt),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        notifications.show({
          color: 'blue',
          title: 'Session checked in',
          message: `${session.title} is now checked in and ready for execution updates.`,
        });
      } else if (mode === 'completed') {
        await completeTrainingSessionRecord(apiBaseUrl, accessToken, session.id, {
          completedAt: fromLocalDateTimeInput(completedAt),
          ...(checkedInAt ? { checkedOutAt: fromLocalDateTimeInput(completedAt) } : {}),
          durationMinutes: Number(durationMinutes),
          attendeeCount: Number(attendeeCount),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          checkoutNotes: checkoutNotes.trim(),
          ...(proofNotes.trim() ? { proofNotes: proofNotes.trim() } : {}),
          ...(Number(proofAttachmentCount) > 0 ? { proofAttachmentCount: Number(proofAttachmentCount) } : { proofAttachmentCount: 0 }),
          ...(completionSummary.trim() ? { completionSummary: completionSummary.trim() } : {}),
          ...(session.isCertificationTrack
            ? {
                certificationOutcome,
                ...(certificationTitle.trim() ? { certificationTitle: certificationTitle.trim() } : {}),
                ...(certificationCode.trim() ? { certificationCode: certificationCode.trim() } : {}),
                ...(certificationExpiresAt ? { certificationExpiresAt: fromLocalDateTimeInput(certificationExpiresAt) } : {}),
                ...(certificationNotes.trim() ? { certificationNotes: certificationNotes.trim() } : {}),
              }
            : {}),
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
          Check in, complete, no-show, or cancel the session without leaving the approved Pulse training workflow.
        </Text>

        <Select
          label="Action"
          data={[
            ...(session.executionState !== 'checked_in' ? [{ value: 'check_in', label: 'Check in session' }] : []),
            { value: 'completed', label: 'Complete session' },
            { value: 'cancelled', label: 'Cancel session' },
            { value: 'no_show', label: 'Mark as no-show' },
          ]}
          value={mode}
          onChange={(value) => setMode((value as SessionActionMode | null) ?? 'completed')}
        />

        {mode === 'check_in' ? (
          <TextInput
            label="Checked in at"
            type="datetime-local"
            value={checkedInAt}
            onChange={(event) => setCheckedInAt(event.currentTarget.value)}
          />
        ) : null}

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

            <Textarea
              label="Checkout notes"
              description="Required for mobile-ready execution and audit history."
              minRows={2}
              value={checkoutNotes}
              onChange={(event) => setCheckoutNotes(event.currentTarget.value)}
            />

            <Grid>
              <Grid.Col span={6}>
                <NumberInput
                  label="Proof attachments"
                  min={0}
                  value={proofAttachmentCount}
                  onChange={setProofAttachmentCount}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Checked in at"
                  type="datetime-local"
                  value={checkedInAt}
                  onChange={(event) => setCheckedInAt(event.currentTarget.value)}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Proof notes"
              minRows={2}
              value={proofNotes}
              onChange={(event) => setProofNotes(event.currentTarget.value)}
            />

            <FileInput
              label="Attach proof files"
              description="Upload trainer proof directly into Pulse before completing the session."
              multiple
              value={proofFiles}
              onChange={(value) => {
                void handleProofFilesSelected(value);
              }}
              disabled={isUploadingProof || isSaving}
              clearable
            />

            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Stored proof documents
              </Text>
              {proofDocuments.length > 0 ? proofDocuments.map((document) => (
                <Group key={document.id} justify="space-between" align="center" gap="sm" wrap="nowrap">
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text size="sm">{document.fileName}</Text>
                      <Badge color={proofReviewBadgeColor(document.reviewStatus)} variant="light">
                        {document.reviewStatus.replace(/_/g, ' ')}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {document.mimeType}
                      {document.reviewedByName ? ` • reviewed by ${document.reviewedByName}` : ''}
                    </Text>
                  </Stack>
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      variant="subtle"
                      loading={downloadingProofDocumentId === document.id}
                      disabled={isSaving || isUploadingProof}
                      onClick={() => void handleDownloadProof(document)}
                    >
                      Download
                    </Button>
                    <Button
                      size="xs"
                      variant="default"
                      loading={reviewingProofDocumentId === document.id}
                      disabled={isSaving || isUploadingProof || document.reviewStatus === 'approved'}
                      onClick={() => void handleReviewProof(document, 'approved')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="light"
                      loading={reviewingProofDocumentId === document.id}
                      disabled={isSaving || isUploadingProof || document.reviewStatus === 'rejected'}
                      onClick={() => void handleReviewProof(document, 'rejected')}
                    >
                      Reject
                    </Button>
                  </Group>
                </Group>
              )) : (
                <Text size="sm" c="dimmed">
                  No proof files uploaded yet.
                </Text>
              )}
            </Stack>

            {session.isCertificationTrack ? (
              <Stack gap="sm">
                <Text size="sm" fw={600}>Certification outcome</Text>
                <Select
                  data={[
                    { value: 'pending_decision', label: 'Pending decision' },
                    { value: 'awarded', label: 'Awarded' },
                    { value: 'not_awarded', label: 'Not awarded' },
                  ]}
                  value={certificationOutcome}
                  onChange={(value) => setCertificationOutcome((value as TrainingCertificationOutcomeKey | null) ?? 'pending_decision')}
                />
                <Grid>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Certification title"
                      value={certificationTitle}
                      onChange={(event) => setCertificationTitle(event.currentTarget.value)}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <TextInput
                      label="Certification code"
                      value={certificationCode}
                      onChange={(event) => setCertificationCode(event.currentTarget.value)}
                    />
                  </Grid.Col>
                </Grid>
                <TextInput
                  label="Certification expires at"
                  type="datetime-local"
                  value={certificationExpiresAt}
                  onChange={(event) => setCertificationExpiresAt(event.currentTarget.value)}
                />
                <Textarea
                  label="Certification notes"
                  minRows={2}
                  value={certificationNotes}
                  onChange={(event) => setCertificationNotes(event.currentTarget.value)}
                />
              </Stack>
            ) : null}
          </>
        ) : null}

        <Textarea
          label={mode === 'completed' ? 'Session notes' : mode === 'check_in' ? 'Check-in notes' : 'Reason / notes'}
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
          {mode === 'check_in'
            ? 'Check In'
            : mode === 'completed'
            ? 'Complete Session'
            : mode === 'no_show'
            ? 'Save No-show'
            : 'Cancel Session'}
        </Button>
      </Stack>
    </Modal>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text, TextInput, Textarea } from '@mantine/core';
import type {
  RevokeTrainingCertificationRequest,
  ResolveTrainingCertificationDecisionRequest,
  TrainingOperationalCertificationQueueItem,
  TrainingOperationalExceptionQueueItem,
} from '@pulse/contracts';

type TrainingCertificationOpsModalProps = {
  opened: boolean;
  mode: 'resolve_decision' | 'revoke_certification';
  onClose: () => void;
  onResolveDecision: (payload: ResolveTrainingCertificationDecisionRequest) => Promise<void>;
  onRevokeCertification: (payload: RevokeTrainingCertificationRequest) => Promise<void>;
  pendingDecision?: TrainingOperationalExceptionQueueItem | null;
  certification?: TrainingOperationalCertificationQueueItem | null;
};

export function TrainingCertificationOpsModal({
  opened,
  mode,
  onClose,
  onResolveDecision,
  onRevokeCertification,
  pendingDecision,
  certification,
}: TrainingCertificationOpsModalProps) {
  const [decisionOutcome, setDecisionOutcome] = useState<ResolveTrainingCertificationDecisionRequest['certificationOutcome']>('awarded');
  const [certificationTitle, setCertificationTitle] = useState('');
  const [certificationCode, setCertificationCode] = useState('');
  const [certificationExpiresAt, setCertificationExpiresAt] = useState('');
  const [certificationNotes, setCertificationNotes] = useState('');
  const [revocationNotes, setRevocationNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // UX-T-001 (FR-TRN-053): require an explicit confirm before a revocation commits.
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  useEffect(() => {
    if (!opened) {
      return;
    }

    setDecisionOutcome('awarded');
    setCertificationTitle(certification?.title ?? '');
    setCertificationCode(certification?.certificationCode ?? '');
    setCertificationExpiresAt('');
    setCertificationNotes('');
    setRevocationNotes('');
    setConfirmingRevoke(false);
  }, [certification, opened]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      if (mode === 'resolve_decision') {
        await onResolveDecision({
          certificationOutcome: decisionOutcome,
          ...(decisionOutcome === 'awarded' && certificationTitle.trim() ? { certificationTitle: certificationTitle.trim() } : {}),
          ...(decisionOutcome === 'awarded' && certificationCode.trim() ? { certificationCode: certificationCode.trim() } : {}),
          ...(decisionOutcome === 'awarded' && certificationExpiresAt.trim() ? { certificationExpiresAt: certificationExpiresAt.trim() } : {}),
          ...(certificationNotes.trim() ? { certificationNotes: certificationNotes.trim() } : {}),
        });
      } else {
        await onRevokeCertification({
          ...(revocationNotes.trim() ? { notes: revocationNotes.trim() } : {}),
        });
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'resolve_decision' ? 'Resolve Certification Decision' : 'Revoke Certification'}
      centered
    >
      <Stack gap="md">
        {mode === 'resolve_decision' ? (
          <>
            <Text size="sm" c="dimmed">
              Finalize the certification decision for the completed training session while preserving the session history already recorded in Pulse.
            </Text>
            <Text size="sm" fw={600}>
              {pendingDecision?.title ?? 'Pending certification decision'}
            </Text>
            <Select
              label="Decision"
              value={decisionOutcome}
              onChange={(value) => setDecisionOutcome((value as ResolveTrainingCertificationDecisionRequest['certificationOutcome'] | null) ?? 'awarded')}
              data={[
                { value: 'awarded', label: 'Award certification' },
                { value: 'not_awarded', label: 'Do not award' },
              ]}
            />
            {decisionOutcome === 'awarded' ? (
              <>
                <TextInput
                  label="Certification title"
                  value={certificationTitle}
                  onChange={(event) => setCertificationTitle(event.currentTarget.value)}
                  placeholder="IAQ Certification Curriculum"
                />
                <TextInput
                  label="Certification code"
                  value={certificationCode}
                  onChange={(event) => setCertificationCode(event.currentTarget.value)}
                  placeholder="IAQ-CERT"
                />
                <TextInput
                  label="Expiration date"
                  value={certificationExpiresAt}
                  onChange={(event) => setCertificationExpiresAt(event.currentTarget.value)}
                  placeholder="2027-12-31"
                />
              </>
            ) : null}
            <Textarea
              label="Decision notes"
              minRows={3}
              value={certificationNotes}
              onChange={(event) => setCertificationNotes(event.currentTarget.value)}
              placeholder="Reasoning or follow-up details"
            />
          </>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Revoke the issued certification while keeping the historical record visible for audit and reporting.
            </Text>
            <Text size="sm" fw={600}>
              {certification?.title ?? 'Certification'}
            </Text>
            <Textarea
              label="Revocation notes"
              minRows={3}
              value={revocationNotes}
              onChange={(event) => setRevocationNotes(event.currentTarget.value)}
              placeholder="Compliance reason or supporting detail"
            />
            {confirmingRevoke ? (
              <Text size="sm" c="red.7" fw={600}>
                This revokes {certification?.title ? `"${certification.title}"` : 'the certification'}. The historical record stays visible for audit, but the active certification is removed. Confirm to proceed.
              </Text>
            ) : null}
          </>
        )}

        <Group justify="flex-end">
          {mode === 'revoke_certification' && confirmingRevoke ? (
            <Button variant="subtle" onClick={() => setConfirmingRevoke(false)} disabled={isSaving}>
              Back
            </Button>
          ) : (
            <Button variant="default" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
          )}
          {mode === 'resolve_decision' ? (
            <Button onClick={() => void handleSubmit()} loading={isSaving}>
              Save Decision
            </Button>
          ) : confirmingRevoke ? (
            <Button color="red" onClick={() => void handleSubmit()} loading={isSaving}>
              Confirm revoke
            </Button>
          ) : (
            <Button color="red" onClick={() => setConfirmingRevoke(true)}>
              Revoke Certification
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

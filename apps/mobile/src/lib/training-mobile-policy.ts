import type { CompleteTrainingSessionRequest, TrainingSessionSummary } from '@pulse/contracts/training';

export type MobileTrainingProofStatus = {
  tone: 'success' | 'error';
  message: string;
};

export type MobileTrainingCompletionInput = {
  attendeeCount: number;
  checkedInAt: string;
  completedAt: string;
  followUpDescription: string;
  followUpEnabled: boolean;
  followUpTitle: string;
  notes: string;
  proofAttachmentCount: number;
  proofNotes: string;
  proofUploadFailed?: boolean;
  saveInProgress?: boolean;
};

export function getTrainingCompletionBlocker(
  session: TrainingSessionSummary | null,
  authPresent: boolean,
  input: Pick<MobileTrainingCompletionInput, 'attendeeCount' | 'followUpDescription' | 'followUpEnabled' | 'followUpTitle' | 'notes' | 'proofNotes' | 'proofUploadFailed' | 'saveInProgress'>,
) {
  if (!session || !authPresent) return 'Select a training session first.';
  if (isTrainingSessionCompleteForPolicy(session)) return 'This session is already completed in CRM.';
  if (input.saveInProgress) return 'CRM save is already in progress.';
  if (!input.notes.trim()) return 'Add a short completion note before saving.';
  if (input.attendeeCount < 1) return 'Enter at least 1 attendee.';
  if (input.proofUploadFailed && !input.proofNotes.trim()) {
    return 'Proof photo was not uploaded. Retry the photo or add proof notes before saving.';
  }
  if (input.followUpEnabled && (!input.followUpTitle.trim() || !input.followUpDescription.trim())) {
    return 'Add both follow-up title and detail, or clear the follow-up task.';
  }
  return null;
}

export function buildTrainingCompleteRequest(session: TrainingSessionSummary, input: MobileTrainingCompletionInput): CompleteTrainingSessionRequest {
  const durationMinutes = Math.max(1, Math.round((new Date(input.completedAt).getTime() - new Date(input.checkedInAt).getTime()) / 60_000) || session.durationMinutes || 1);
  const proofSummary = input.proofAttachmentCount > 0
    ? `${input.proofAttachmentCount} proof file${input.proofAttachmentCount === 1 ? '' : 's'} uploaded from mobile.`
    : 'No mobile proof files uploaded; proof notes captured as text.';
  const shouldCreateFollowUp = input.followUpEnabled && Boolean(input.followUpTitle.trim()) && Boolean(input.followUpDescription.trim());
  return {
    attendeeCount: input.attendeeCount,
    checkedOutAt: input.completedAt,
    completedAt: input.completedAt,
    checkoutNotes: input.notes,
    certificationOutcome: session.isCertificationTrack ? 'pending_decision' : 'not_applicable',
    completionSummary: `Mobile training completed for ${session.accountName ?? 'account'}. ${proofSummary}`,
    durationMinutes,
    notes: input.notes,
    proofAttachmentCount: input.proofAttachmentCount,
    ...(input.proofNotes ? { proofNotes: input.proofNotes } : {}),
    ...(shouldCreateFollowUp ? {
      createFollowUpTask: {
        title: input.followUpTitle.trim(),
        description: input.followUpDescription.trim(),
      },
    } : {}),
  };
}

export function buildProofUploadStatusFromError(error: unknown): MobileTrainingProofStatus {
  const detail = error instanceof Error ? error.message : 'Unable to upload training proof.';
  return {
    tone: 'error',
    message: `Proof photo was not uploaded to CRM and is not saved offline. Retry the photo or add proof notes before saving. ${detail}`,
  };
}

function isTrainingSessionCompleteForPolicy(session: TrainingSessionSummary) {
  return Boolean(session.completedAt || session.executionState === 'completed' || session.status === 'completed');
}

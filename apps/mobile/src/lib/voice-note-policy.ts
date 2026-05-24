import type { CreateMobileVoiceNoteRequest, MobileVoiceNoteSummary } from '@pulse/contracts/mobile-voice-notes';

export type VoiceNoteDraftInput = {
  title?: string;
  transcriptText?: string;
  audioUri?: string | null;
  selectedAccountId?: string | null;
};

export function getVoiceNoteSubmitBlocker(input: VoiceNoteDraftInput) {
  const hasTranscript = Boolean(input.transcriptText?.trim());
  const hasAudio = Boolean(input.audioUri);
  if (!hasTranscript && !hasAudio) {
    return 'Record a note or type a quick transcript before syncing.';
  }
  if (input.transcriptText && input.transcriptText.length > 12_000) {
    return 'Keep the transcript under 12,000 characters for this mobile slice.';
  }
  return null;
}

export function buildVoiceNoteCreateRequest(input: {
  accountId?: string;
  audio?: CreateMobileVoiceNoteRequest['audio'];
  recordedAt: string;
  title?: string;
  transcriptText?: string;
}): CreateMobileVoiceNoteRequest {
  const title = input.title?.trim();
  const transcriptText = input.transcriptText?.trim();
  return {
    contextType: input.accountId ? 'account' : 'general',
    recordedAt: input.recordedAt,
    ...(input.accountId ? { accountId: input.accountId } : {}),
    ...(title ? { title } : {}),
    ...(transcriptText ? { transcriptText } : {}),
    ...(input.audio ? { audio: input.audio } : {}),
  };
}

export function describeVoiceNoteProcessing(status: string, provider?: string) {
  if (status === 'structured') {
    return provider === 'openai'
      ? 'Structured by AI and saved to CRM.'
      : 'Saved to CRM with local structure. Review before using as official notes.';
  }
  if (status === 'failed') {
    return 'Saved to CRM, but structuring failed. Review the raw transcript.';
  }
  return provider === 'disabled'
    ? 'Saved to CRM. AI is disabled, so office review is needed.'
    : 'Saved to CRM and marked for review.';
}

export function describeVoiceNoteReview(note: Pick<MobileVoiceNoteSummary, 'processingStatus' | 'reviewStatus' | 'reviewedByName' | 'reviewedAt' | 'rejectedReason' | 'writebackTarget' | 'llmProvider'>) {
  if (note.reviewStatus === 'approved') {
    const action = describeWritebackTarget(note.writebackTarget);
    return {
      label: 'Approved',
      tone: 'active',
      detail: `Office approved this field note${note.reviewedByName ? ` by ${note.reviewedByName}` : ''}.`,
      nextAction: action ? `${action} is now open in CRM.` : 'No action needed.',
    };
  }
  if (note.reviewStatus === 'rejected') {
    return {
      label: 'Rejected',
      tone: 'lost',
      detail: note.rejectedReason ?? 'Office rejected this field note.',
      nextAction: 'Follow up with the office before using this note.',
    };
  }
  if (note.processingStatus === 'failed') {
    return {
      label: 'Needs Office Review',
      tone: 'review',
      detail: 'CRM saved the note, but structuring failed.',
      nextAction: 'Office should review the raw transcript.',
    };
  }
  return {
    label: 'Needs Office Review',
    tone: 'review',
    detail: describeVoiceNoteProcessing(note.processingStatus, note.llmProvider),
    nextAction: 'Office should approve or reject before this becomes official activity.',
  };
}

export function describeWritebackTarget(writebackTarget: string | undefined) {
  if (!writebackTarget) return undefined;
  if (writebackTarget.startsWith('training_follow_up_task:')) return 'Training follow-up';
  if (writebackTarget.startsWith('consignment_work_item:')) return 'Consignment work item';
  if (writebackTarget === 'training_session') return 'Training activity';
  if (writebackTarget === 'consignment_site') return 'Consignment activity';
  if (writebackTarget === 'account') return 'Account activity';
  if (writebackTarget === 'lead') return 'Lead activity';
  return undefined;
}

export function audioMimeTypeFromUri(uri: string | null | undefined) {
  const normalized = uri?.toLowerCase() ?? '';
  if (normalized.endsWith('.webm')) return 'audio/webm';
  if (normalized.endsWith('.mp3') || normalized.endsWith('.mpeg')) return 'audio/mpeg';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.aac')) return 'audio/aac';
  return 'audio/m4a';
}

export function audioFileNameFromUri(uri: string | null | undefined) {
  const rawName = uri?.split('/').pop()?.split('?')[0]?.trim();
  if (rawName && /\.[a-z0-9]+$/i.test(rawName)) return rawName;
  return `voice-note-${Date.now()}.m4a`;
}

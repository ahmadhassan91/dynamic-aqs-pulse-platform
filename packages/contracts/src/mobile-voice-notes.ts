export const MOBILE_VOICE_NOTE_CONTEXT_TYPES = [
  'general',
  'lead',
  'account',
  'training_session',
  'consignment_site',
  'route_visit',
] as const;

export type MobileVoiceNoteContextTypeKey = (typeof MOBILE_VOICE_NOTE_CONTEXT_TYPES)[number];

export const MOBILE_VOICE_NOTE_PROCESSING_STATUSES = [
  'pending',
  'structured',
  'needs_review',
  'failed',
] as const;

export type MobileVoiceNoteProcessingStatusKey = (typeof MOBILE_VOICE_NOTE_PROCESSING_STATUSES)[number];

export const MOBILE_VOICE_NOTE_REVIEW_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
] as const;

export type MobileVoiceNoteReviewStatusKey = (typeof MOBILE_VOICE_NOTE_REVIEW_STATUSES)[number];

export const MOBILE_VOICE_NOTE_SENTIMENTS = [
  'positive',
  'neutral',
  'concern',
  'urgent',
] as const;

export type MobileVoiceNoteSentimentKey = (typeof MOBILE_VOICE_NOTE_SENTIMENTS)[number];

export type MobileVoiceNoteStructuredData = {
  summary: string;
  nextStep?: string;
  sentiment: MobileVoiceNoteSentimentKey;
  tags: string[];
  followUpDate?: string;
  entities?: {
    accounts?: string[];
    people?: string[];
    products?: string[];
  };
  rawText: string;
  confidence: 'high' | 'medium' | 'low';
};

export type MobileVoiceNoteAudioUpload = {
  fileName: string;
  mimeType: string;
  contentBase64: string;
  durationSeconds?: number;
};

export type CreateMobileVoiceNoteRequest = {
  contextType?: MobileVoiceNoteContextTypeKey;
  leadId?: string;
  accountId?: string;
  trainingSessionId?: string;
  consignmentSiteId?: string;
  routeVisitLocalId?: string;
  title?: string;
  transcriptText?: string;
  audio?: MobileVoiceNoteAudioUpload;
  recordedAt?: string;
};

export type MobileVoiceNoteSummary = {
  id: string;
  createdByUserId?: string;
  createdByName?: string;
  contextType: MobileVoiceNoteContextTypeKey;
  leadId?: string;
  leadName?: string;
  accountId?: string;
  accountName?: string;
  trainingSessionId?: string;
  trainingSessionTitle?: string;
  consignmentSiteId?: string;
  consignmentSiteName?: string;
  routeVisitLocalId?: string;
  title: string;
  rawTranscript?: string;
  structuredSummary?: string;
  structuredNextStep?: string;
  structuredSentiment?: string;
  structuredTags: string[];
  structuredData?: MobileVoiceNoteStructuredData;
  processingStatus: MobileVoiceNoteProcessingStatusKey;
  reviewStatus: MobileVoiceNoteReviewStatusKey;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectedReason?: string;
  writebackCompletedAt?: string;
  writebackTarget?: string;
  llmProvider?: string;
  llmModel?: string;
  llmErrorMessage?: string;
  audioFileName?: string;
  audioMimeType?: string;
  audioSizeBytes?: number;
  durationSeconds?: number;
  crmSyncedAt?: string;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ListMobileVoiceNotesRequest = {
  contextType?: MobileVoiceNoteContextTypeKey;
  processingStatus?: MobileVoiceNoteProcessingStatusKey;
  reviewStatus?: MobileVoiceNoteReviewStatusKey;
  leadId?: string;
  accountId?: string;
  trainingSessionId?: string;
  consignmentSiteId?: string;
  createdByUserId?: string;
  search?: string;
  limit?: number;
};

export type ListMobileVoiceNotesResponse = {
  items: MobileVoiceNoteSummary[];
  total: number;
};

export type ReviewMobileVoiceNoteDecision = 'approve' | 'reject';

export const MOBILE_VOICE_NOTE_REVIEW_ACTIONS = [
  'activity_only',
  'create_training_follow_up',
  'create_consignment_work_item',
] as const;

export type MobileVoiceNoteReviewActionKey = (typeof MOBILE_VOICE_NOTE_REVIEW_ACTIONS)[number];

export const MOBILE_VOICE_NOTE_FOLLOW_UP_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
] as const;

export type MobileVoiceNoteFollowUpPriorityKey = (typeof MOBILE_VOICE_NOTE_FOLLOW_UP_PRIORITIES)[number];

export type ReviewMobileVoiceNoteRequest = {
  decision: ReviewMobileVoiceNoteDecision;
  title?: string;
  rawTranscript?: string;
  structuredSummary?: string;
  structuredNextStep?: string;
  structuredSentiment?: MobileVoiceNoteSentimentKey;
  structuredTags?: string[];
  followUpDate?: string;
  reviewNotes?: string;
  rejectedReason?: string;
  writebackAction?: MobileVoiceNoteReviewActionKey;
  followUpTitle?: string;
  followUpDescription?: string;
  followUpDueAt?: string;
  followUpOwnerUserId?: string;
  followUpPriority?: MobileVoiceNoteFollowUpPriorityKey;
};

export type ListMobileVoiceNoteReviewQueueRequest = ListMobileVoiceNotesRequest;

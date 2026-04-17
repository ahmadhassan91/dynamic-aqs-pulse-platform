export const TRAINING_CATEGORY_KINDS = [
  'onboarding',
  'product',
  'technical',
  'sales',
  'compliance',
  'certification',
  'custom',
  'visit',
] as const;

export type TrainingCategoryKindKey = (typeof TRAINING_CATEGORY_KINDS)[number];

export const TRAINING_CATALOG_FAMILIES = [
  'visit_follow_up',
  'program_foundation',
  'sales_communication',
  'technical_product',
  'management',
  'custom',
] as const;

export type TrainingCatalogFamilyKey = (typeof TRAINING_CATALOG_FAMILIES)[number];

export const TRAINING_DELIVERY_MODES = [
  'visit',
  'on_site',
  'virtual',
  'phone',
  'hybrid',
  'custom',
] as const;

export type TrainingDeliveryModeKey = (typeof TRAINING_DELIVERY_MODES)[number];

export const TRAINING_PROOF_REQUIREMENTS = [
  'notes_only',
  'attendance_and_notes',
  'photo_optional',
  'certificate_required',
] as const;

export type TrainingProofRequirementKey = (typeof TRAINING_PROOF_REQUIREMENTS)[number];

export const ACCOUNT_TRAINING_PROGRAM_STATUSES = [
  'not_started',
  'active',
  'complete',
  'overdue',
  'archived',
] as const;

export type AccountTrainingProgramStatusKey = (typeof ACCOUNT_TRAINING_PROGRAM_STATUSES)[number];

export const TRAINING_SESSION_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type TrainingSessionStatusKey = (typeof TRAINING_SESSION_STATUSES)[number];

export const TRAINING_ACTIVITY_KINDS = [
  'training',
  'site_visit',
] as const;

export type TrainingActivityKindKey = (typeof TRAINING_ACTIVITY_KINDS)[number];

export const TRAINING_CERTIFICATION_OUTCOMES = [
  'not_applicable',
  'pending_decision',
  'awarded',
  'not_awarded',
] as const;

export type TrainingCertificationOutcomeKey = (typeof TRAINING_CERTIFICATION_OUTCOMES)[number];

export const TRAINING_CERTIFICATION_STATUSES = [
  'active',
  'expired',
  'revoked',
] as const;

export type TrainingCertificationStatusKey = (typeof TRAINING_CERTIFICATION_STATUSES)[number];

export const TRAINING_EXECUTION_STATES = [
  'scheduled',
  'checked_in',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type TrainingExecutionStateKey = (typeof TRAINING_EXECUTION_STATES)[number];

export const TRAINING_EXECUTION_EXCEPTION_TYPES = [
  'session_overdue',
  'proof_missing',
  'certification_decision_pending',
] as const;

export type TrainingExecutionExceptionTypeKey = (typeof TRAINING_EXECUTION_EXCEPTION_TYPES)[number];

export const TRAINING_EXECUTION_EXCEPTION_SEVERITIES = [
  'high',
  'medium',
  'low',
] as const;

export type TrainingExecutionExceptionSeverityKey = (typeof TRAINING_EXECUTION_EXCEPTION_SEVERITIES)[number];

export const TRAINING_FOLLOW_UP_TASK_STATUSES = [
  'open',
  'completed',
  'cancelled',
] as const;

export type TrainingFollowUpTaskStatusKey = (typeof TRAINING_FOLLOW_UP_TASK_STATUSES)[number];

export const LIST_TRAINING_ACCOUNT_STATUSES = [
  'all',
  'overdue',
  'active_programs',
  'no_programs',
] as const;

export type ListTrainingAccountStatusKey = (typeof LIST_TRAINING_ACCOUNT_STATUSES)[number];

export const LIST_TRAINING_SESSION_STATUSES = [
  'all',
  'scheduled',
  'checked_in',
  'overdue',
  'exceptions',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type ListTrainingSessionStatusKey = (typeof LIST_TRAINING_SESSION_STATUSES)[number];

export interface TrainingCategorySummary {
  id: string;
  kind: TrainingCategoryKindKey;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  trainingTypeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingTypeSummary {
  id: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  code: string;
  name: string;
  description?: string;
  family: TrainingCatalogFamilyKey;
  deliveryMode: TrainingDeliveryModeKey;
  defaultDurationMinutes: number;
  countsTowardHours: boolean;
  isCustomerFacing: boolean;
  isCertificationTrack: boolean;
  targetSegment?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingTemplateSummary {
  id: string;
  trainingTypeId: string;
  trainingTypeCode: string;
  trainingTypeName: string;
  code: string;
  title: string;
  description?: string;
  prerequisiteSummary?: string;
  materialsSummary?: string;
  proofRequirement: TrainingProofRequirementKey;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCadencePolicySummary {
  id: string;
  trainingTypeId: string;
  trainingTypeCode: string;
  segmentScope?: string;
  cadenceDays: number;
  isRequired: boolean;
  appliesToAllAccounts: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingOverviewResponse {
  totalAccountsTracked: number;
  activePrograms: number;
  overduePrograms: number;
  completedSessions: number;
  scheduledSessions: number;
  openFollowUpTasks: number;
  deliveredTrainingHours: number;
  categoryCount: number;
  trainingTypeCount: number;
  templateCount: number;
  certificationTrackCount: number;
  activeCertificationCount: number;
  pendingCertificationDecisionCount: number;
  executionExceptionCount: number;
}

export interface TrainingCatalogResponse {
  categories: TrainingCategorySummary[];
  trainingTypes: TrainingTypeSummary[];
  templates: TrainingTemplateSummary[];
  cadencePolicies: TrainingCadencePolicySummary[];
}

export interface CreateTrainingCategoryRequest {
  kind: TrainingCategoryKindKey;
  code: string;
  name: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateTrainingTypeRequest {
  categoryId: string;
  code: string;
  name: string;
  description?: string;
  family: TrainingCatalogFamilyKey;
  deliveryMode: TrainingDeliveryModeKey;
  defaultDurationMinutes: number;
  countsTowardHours?: boolean;
  isCustomerFacing?: boolean;
  isCertificationTrack?: boolean;
  targetSegment?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateTrainingTemplateRequest {
  trainingTypeId: string;
  code: string;
  title: string;
  description?: string;
  prerequisiteSummary?: string;
  materialsSummary?: string;
  proofRequirement?: TrainingProofRequirementKey;
  isActive?: boolean;
}

export interface TrainingAccountSummary {
  accountId: string;
  accountName: string;
  businessSegmentCode?: string;
  territoryId?: string;
  territoryName?: string;
  regionName?: string;
  assignedTmName?: string;
  lastTrainingAt?: string;
  nextDueAt?: string;
  totalTrainingHours: number;
  activeProgramCount: number;
  overdueProgramCount: number;
  certificationTrackCount: number;
}

export interface ListTrainingAccountsRequest {
  search?: string;
  status?: ListTrainingAccountStatusKey;
  includeInactive?: boolean;
  limit?: number;
}

export interface ListTrainingAccountsResponse {
  items: TrainingAccountSummary[];
  total: number;
}

export interface AccountTrainingProgramSummary {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  trainingTypeId?: string;
  trainingTypeCode?: string;
  trainingTypeName?: string;
  templateId?: string;
  templateTitle?: string;
  status: AccountTrainingProgramStatusKey;
  cadenceDays?: number;
  isRequired: boolean;
  targetSegment?: string;
  ownerTmUserId?: string;
  ownerTmName?: string;
  ownerRdUserId?: string;
  ownerRdName?: string;
  nextDueAt?: string;
  lastCompletedAt?: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingTrainerSummary {
  userId: string;
  displayName: string;
  email?: string;
  roleCode: string;
  title?: string;
  notes?: string;
  isActive: boolean;
}

export interface TrainingFollowUpTaskSummary {
  id: string;
  sessionId: string;
  accountId: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: TrainingFollowUpTaskStatusKey;
  ownerUserId?: string;
  ownerName?: string;
  createdByUserId?: string;
  createdByName?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingCertificationSummary {
  id: string;
  accountId: string;
  sessionId?: string;
  programId?: string;
  trainingTypeId?: string;
  trainingTypeCode?: string;
  trainingTypeName?: string;
  certificationCode?: string;
  title: string;
  status: TrainingCertificationStatusKey;
  awardedAt: string;
  expiresAt?: string;
  awardedByUserId?: string;
  awardedByName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrainingExecutionExceptionSummary {
  type: TrainingExecutionExceptionTypeKey;
  severity: TrainingExecutionExceptionSeverityKey;
  sessionId: string;
  accountId: string;
  accountName?: string;
  title: string;
  detail: string;
  scheduledAt?: string;
  trainingTypeCode?: string;
}

export interface TrainingOperationalCertificationQueueItem {
  certificationId: string;
  accountId: string;
  accountName: string;
  territoryId?: string;
  territoryName?: string;
  regionName?: string;
  ownerTmUserId?: string;
  ownerTmName?: string;
  ownerRdUserId?: string;
  ownerRdName?: string;
  trainingTypeId?: string;
  trainingTypeCode?: string;
  trainingTypeName?: string;
  certificationCode?: string;
  title: string;
  status: TrainingCertificationStatusKey;
  awardedAt: string;
  expiresAt: string;
  daysUntilExpiry: number;
}

export interface TrainingOperationalCadenceQueueItem {
  programId: string;
  accountId: string;
  accountName: string;
  territoryId?: string;
  territoryName?: string;
  regionName?: string;
  ownerTmUserId?: string;
  ownerTmName?: string;
  ownerRdUserId?: string;
  ownerRdName?: string;
  trainingTypeId?: string;
  trainingTypeCode?: string;
  trainingTypeName?: string;
  title: string;
  nextDueAt: string;
  lastCompletedAt?: string;
  cadenceDays?: number;
  isRequired: boolean;
  daysOverdue: number;
}

export interface TrainingOperationalExceptionQueueItem extends TrainingExecutionExceptionSummary {
  territoryId?: string;
  territoryName?: string;
  regionName?: string;
  ownerTmUserId?: string;
  ownerTmName?: string;
  ownerRdUserId?: string;
  ownerRdName?: string;
  trainerUserId?: string;
  trainerName?: string;
}

export interface ListTrainingOperationalQueueRequest {
  ownerTmUserId?: string;
  ownerRdUserId?: string;
  certificationWindowDays?: number;
  limit?: number;
}

export interface ListTrainingOperationalQueueResponse {
  expiringCertifications: TrainingOperationalCertificationQueueItem[];
  expiredCertifications: TrainingOperationalCertificationQueueItem[];
  overduePrograms: TrainingOperationalCadenceQueueItem[];
  unresolvedExecutionExceptions: TrainingOperationalExceptionQueueItem[];
  summary: {
    expiringCertificationCount: number;
    expiredCertificationCount: number;
    overdueProgramCount: number;
    unresolvedExecutionExceptionCount: number;
  };
}

export interface TrainingComplianceSummary {
  accountsInScope: number;
  accountsWithActivePrograms: number;
  activeCertificationCount: number;
  expiringCertificationCount: number;
  expiredCertificationCount: number;
  revokedCertificationCount: number;
  overdueProgramCount: number;
  unresolvedExecutionExceptionCount: number;
  pendingCertificationDecisionCount: number;
  deliveredTrainingHours: number;
}

export interface TrainingComplianceOwnerRollup {
  ownerUserId: string;
  ownerName: string;
  roleCode: 'TERRITORY_MANAGER' | 'REGIONAL_DIRECTOR';
  accountCount: number;
  activeCertificationCount: number;
  expiringCertificationCount: number;
  expiredCertificationCount: number;
  revokedCertificationCount: number;
  overdueProgramCount: number;
  unresolvedExecutionExceptionCount: number;
  pendingCertificationDecisionCount: number;
  deliveredTrainingHours: number;
}

export interface TrainingComplianceCertificationTrackRollup {
  trainingTypeId?: string;
  trainingTypeCode?: string;
  trainingTypeName?: string;
  activeCertificationCount: number;
  expiringCertificationCount: number;
  expiredCertificationCount: number;
  revokedCertificationCount: number;
}

export interface ListTrainingComplianceReportRequest {
  ownerTmUserId?: string;
  ownerRdUserId?: string;
  certificationWindowDays?: number;
}

export interface ListTrainingComplianceReportResponse {
  summary: TrainingComplianceSummary;
  territoryManagers: TrainingComplianceOwnerRollup[];
  regionalDirectors: TrainingComplianceOwnerRollup[];
  certificationTracks: TrainingComplianceCertificationTrackRollup[];
}

export interface TrainingSessionSummary {
  id: string;
  accountId: string;
  accountName?: string;
  locationId?: string;
  locationName?: string;
  programId?: string;
  programTitle?: string;
  trainingTypeId?: string;
  trainingTypeCode?: string;
  trainingTypeName?: string;
  trainerUserId?: string;
  trainerName?: string;
  activityKind: TrainingActivityKindKey;
  status: TrainingSessionStatusKey;
  executionState: TrainingExecutionStateKey;
  certificationOutcome: TrainingCertificationOutcomeKey;
  isCertificationTrack: boolean;
  title: string;
  scheduledAt?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  completedAt?: string;
  durationMinutes: number;
  attendeeCount: number;
  notes?: string;
  checkoutNotes?: string;
  proofNotes?: string;
  proofAttachmentCount: number;
  proofCapturedAt?: string;
  completionSummary?: string;
  isOverdue: boolean;
  countsTowardHours: boolean;
  openFollowUpTaskCount: number;
  followUpTasks: TrainingFollowUpTaskSummary[];
  certifications: TrainingCertificationSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AccountTrainingHistoryResponse {
  accountId: string;
  accountName: string;
  businessSegmentCode?: string;
  territoryId?: string;
  territoryName?: string;
  regionName?: string;
  assignedTmName?: string;
  lastTrainingAt?: string;
  nextDueAt?: string;
  totalTrainingHours: number;
  activeProgramCount: number;
  overdueProgramCount: number;
  certificationTrackCount: number;
  programs: AccountTrainingProgramSummary[];
  recentSessions: TrainingSessionSummary[];
  openFollowUpTasks: TrainingFollowUpTaskSummary[];
  certifications: TrainingCertificationSummary[];
  executionExceptions: TrainingExecutionExceptionSummary[];
}

export interface CreateAccountTrainingProgramRequest {
  title?: string;
  description?: string;
  trainingTypeId?: string;
  templateId?: string;
  cadenceDays?: number;
  isRequired?: boolean;
  targetSegment?: string;
  notes?: string;
}

export interface ListTrainingTrainersResponse {
  items: TrainingTrainerSummary[];
}

export interface ListTrainingSessionsRequest {
  accountId?: string;
  trainerUserId?: string;
  status?: ListTrainingSessionStatusKey;
  includeVisits?: boolean;
  limit?: number;
}

export interface ListTrainingSessionsResponse {
  items: TrainingSessionSummary[];
  total: number;
  overdueCount: number;
  openFollowUpTaskCount: number;
  executionExceptions: TrainingExecutionExceptionSummary[];
}

export interface CheckInTrainingSessionRequest {
  checkedInAt?: string;
  notes?: string;
}

export interface CreateTrainingSessionRequest {
  programId?: string;
  trainingTypeId?: string;
  locationId?: string;
  trainerUserId: string;
  activityKind?: TrainingActivityKindKey;
  title?: string;
  scheduledAt: string;
  durationMinutes: number;
  attendeeCount?: number;
  notes?: string;
}

export interface UpdateTrainingSessionScheduleRequest {
  trainerUserId?: string;
  locationId?: string;
  title?: string;
  scheduledAt: string;
  durationMinutes?: number;
  attendeeCount?: number;
  notes?: string;
}

export interface CreateTrainingFollowUpTaskRequest {
  title: string;
  description?: string;
  dueAt?: string;
  ownerUserId?: string;
}

export interface CompleteTrainingSessionRequest {
  completedAt?: string;
  checkedOutAt?: string;
  durationMinutes?: number;
  attendeeCount?: number;
  notes?: string;
  checkoutNotes: string;
  proofNotes?: string;
  proofAttachmentCount?: number;
  completionSummary?: string;
  certificationOutcome?: TrainingCertificationOutcomeKey;
  certificationTitle?: string;
  certificationCode?: string;
  certificationExpiresAt?: string;
  certificationNotes?: string;
  createFollowUpTask?: CreateTrainingFollowUpTaskRequest;
}

export interface ResolveTrainingCertificationDecisionRequest {
  certificationOutcome: Extract<TrainingCertificationOutcomeKey, 'awarded' | 'not_awarded'>;
  certificationTitle?: string;
  certificationCode?: string;
  certificationExpiresAt?: string;
  certificationNotes?: string;
}

export interface CancelTrainingSessionRequest {
  status: Extract<TrainingSessionStatusKey, 'cancelled' | 'no_show'>;
  notes?: string;
}

export interface CompleteTrainingFollowUpTaskRequest {
  notes?: string;
}

export interface RevokeTrainingCertificationRequest {
  notes?: string;
}

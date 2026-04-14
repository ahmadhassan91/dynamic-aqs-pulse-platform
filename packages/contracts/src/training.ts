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
  'overdue',
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
  title: string;
  scheduledAt?: string;
  completedAt?: string;
  durationMinutes: number;
  attendeeCount: number;
  notes?: string;
  completionSummary?: string;
  isOverdue: boolean;
  countsTowardHours: boolean;
  openFollowUpTaskCount: number;
  followUpTasks: TrainingFollowUpTaskSummary[];
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
  durationMinutes?: number;
  attendeeCount?: number;
  notes?: string;
  completionSummary?: string;
  createFollowUpTask?: CreateTrainingFollowUpTaskRequest;
}

export interface CancelTrainingSessionRequest {
  status: Extract<TrainingSessionStatusKey, 'cancelled' | 'no_show'>;
  notes?: string;
}

export interface CompleteTrainingFollowUpTaskRequest {
  notes?: string;
}

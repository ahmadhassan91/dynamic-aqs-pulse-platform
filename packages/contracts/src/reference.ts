import type { LeadStageKey } from './leads.js';

export interface ReferenceValueSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceListResponse<TItem> {
  items: TItem[];
}

export interface UpdateReferenceValueRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateLeadSourceRequest {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateAffinityGroupRequest {
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  groupType: AffinityGroupTypeKey;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface UpdateAffinityGroupRequest extends UpdateReferenceValueRequest {
  shortName?: string;
  groupType?: AffinityGroupTypeKey;
  notes?: string;
}

export interface AffinityGroupImportRow {
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  groupType: AffinityGroupTypeKey;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface CreateOwnershipGroupRequest {
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  ownershipType: OwnershipGroupTypeKey;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface UpdateOwnershipGroupRequest extends UpdateReferenceValueRequest {
  shortName?: string;
  ownershipType?: OwnershipGroupTypeKey;
  notes?: string;
}

export interface OwnershipGroupImportRow {
  code: string;
  name: string;
  shortName?: string;
  description?: string;
  ownershipType: OwnershipGroupTypeKey;
  isActive?: boolean;
  sortOrder?: number;
  notes?: string;
}

export interface LeadSourceImportRow {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface LeadStageReferenceSummary extends ReferenceValueSummary {
  stage: LeadStageKey;
  dashboardLabel?: string;
  isTerminal: boolean;
}

export const AFFINITY_GROUP_TYPES = [
  'buying_group',
  'coaching_network',
  'franchise',
  'community',
  'other',
] as const;

export type AffinityGroupTypeKey = (typeof AFFINITY_GROUP_TYPES)[number];

export const OWNERSHIP_GROUP_TYPES = [
  'private_equity',
  'common_owner',
  'franchise_system',
  'other',
] as const;

export type OwnershipGroupTypeKey = (typeof OWNERSHIP_GROUP_TYPES)[number];

export const GROUP_ROSTER_IMPORT_KINDS = [
  'affinity',
  'ownership',
] as const;

export type GroupRosterImportKindKey = (typeof GROUP_ROSTER_IMPORT_KINDS)[number];

export const GROUP_ROSTER_IMPORT_TARGET_FIELDS = [
  'companyName',
  'contactDisplayName',
  'email',
  'phone',
  'state',
  'city',
] as const;

export type GroupRosterImportTargetFieldKey = (typeof GROUP_ROSTER_IMPORT_TARGET_FIELDS)[number];

export const GROUP_ROSTER_IMPORT_ROW_STATUSES = [
  'ready',
  'requires_review',
  'invalid',
  'skipped',
  'applied',
  'failed',
] as const;

export type GroupRosterImportRowStatusKey = (typeof GROUP_ROSTER_IMPORT_ROW_STATUSES)[number];

export const GROUP_ROSTER_IMPORT_RUN_STATUSES = [
  'review_ready',
  'applied',
  'applied_with_errors',
] as const;

export type GroupRosterImportRunStatusKey = (typeof GROUP_ROSTER_IMPORT_RUN_STATUSES)[number];

export const GROUP_ROSTER_IMPORT_ROW_ACTIONS = [
  'apply',
  'skip',
] as const;

export type GroupRosterImportRowActionKey = (typeof GROUP_ROSTER_IMPORT_ROW_ACTIONS)[number];

export const GROUP_ROSTER_MATCH_ENTITY_TYPES = [
  'lead',
  'account',
  'import_row',
] as const;

export type GroupRosterMatchEntityTypeKey = (typeof GROUP_ROSTER_MATCH_ENTITY_TYPES)[number];

export const GROUP_ROSTER_MATCH_CONFIDENCES = [
  'high',
  'medium',
  'low',
] as const;

export type GroupRosterMatchConfidenceKey = (typeof GROUP_ROSTER_MATCH_CONFIDENCES)[number];

export interface AffinityGroupReferenceSummary extends ReferenceValueSummary {
  shortName?: string;
  groupType: AffinityGroupTypeKey;
  notes?: string;
}

export interface OwnershipGroupReferenceSummary extends ReferenceValueSummary {
  shortName?: string;
  ownershipType: OwnershipGroupTypeKey;
  notes?: string;
}

export interface GroupRosterImportTargetFieldOption {
  value: GroupRosterImportTargetFieldKey;
  label: string;
}

export interface GroupRosterImportFilePreviewRequest {
  groupKind: GroupRosterImportKindKey;
  groupId: string;
  fileName: string;
  fileContentBase64: string;
  sheetName?: string;
}

export interface GroupRosterImportColumnPreview {
  sourceHeader: string;
  sampleValue?: string;
  suggestedTargetField?: GroupRosterImportTargetFieldKey;
}

export interface GroupRosterImportPreviewRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface GroupRosterImportFilePreviewResponse {
  fileName: string;
  format: 'csv' | 'xlsx';
  sheetName: string;
  availableSheets: string[];
  totalRows: number;
  targetFieldOptions: GroupRosterImportTargetFieldOption[];
  columns: GroupRosterImportColumnPreview[];
  previewRows: GroupRosterImportPreviewRow[];
}

export interface GroupRosterImportColumnMapping {
  sourceHeader: string;
  targetField?: GroupRosterImportTargetFieldKey;
}

export interface GroupRosterMatchCandidate {
  entityType: GroupRosterMatchEntityTypeKey;
  entityId: string;
  title: string;
  subtitle?: string;
  detail?: string;
  confidence: GroupRosterMatchConfidenceKey;
  matchedSignals: string[];
  conflictReason?: string;
}

export interface GroupRosterImportReviewRow {
  rowNumber: number;
  status: GroupRosterImportRowStatusKey;
  detail: string;
  sourceValues: Record<string, string>;
  candidates: GroupRosterMatchCandidate[];
  selectedEntityId?: string;
}

export interface ReviewGroupRosterImportRequest extends GroupRosterImportFilePreviewRequest {
  batchName?: string;
  sourceLabel?: string;
  sourceVersion?: string;
  effectiveDate?: string;
  mappings: GroupRosterImportColumnMapping[];
}

export interface GroupRosterImportRunDetail {
  runId: string;
  status: GroupRosterImportRunStatusKey;
  groupKind: GroupRosterImportKindKey;
  groupId: string;
  groupCode: string;
  groupName: string;
  fileName: string;
  sheetName: string;
  batchName?: string;
  sourceLabel?: string;
  sourceVersion?: string;
  effectiveDate?: string;
  totalRows: number;
  mappedRows: number;
  readyRowCount: number;
  attentionRowCount: number;
  appliedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  appliedAt?: string;
  rows: GroupRosterImportReviewRow[];
}

export interface ReviewGroupRosterImportResponse extends GroupRosterImportRunDetail {}

export interface GroupRosterImportRowDecision {
  rowNumber: number;
  action: GroupRosterImportRowActionKey;
  targetEntityId?: string;
}

export interface CommitGroupRosterImportRunRequest {
  rowDecisions?: GroupRosterImportRowDecision[];
}

export interface GroupRosterImportAppliedRecord {
  entityType: 'lead' | 'account';
  entityId: string;
  title: string;
}

export interface GroupRosterImportSkippedRow {
  rowNumber: number;
  detail: string;
  action?: GroupRosterImportRowActionKey;
}

export interface GroupRosterImportFileError {
  rowNumber: number;
  detail: string;
}

export interface GroupRosterImportCommitResponse {
  runId: string;
  status: GroupRosterImportRunStatusKey;
  groupKind: GroupRosterImportKindKey;
  groupId: string;
  groupCode: string;
  groupName: string;
  fileName: string;
  sheetName: string;
  batchName?: string;
  sourceLabel?: string;
  sourceVersion?: string;
  effectiveDate?: string;
  totalRows: number;
  mappedRows: number;
  readyRowCount: number;
  attentionRowCount: number;
  appliedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  appliedAt?: string;
  appliedRecords: GroupRosterImportAppliedRecord[];
  skippedRows: GroupRosterImportSkippedRow[];
  errors: GroupRosterImportFileError[];
}

export interface UpdateLeadStageReferenceRequest extends UpdateReferenceValueRequest {
  dashboardLabel?: string;
  isTerminal?: boolean;
}

export interface LeadStageImportRow {
  stage: LeadStageKey;
  name: string;
  dashboardLabel?: string;
  description?: string;
  isActive?: boolean;
  isTerminal?: boolean;
  sortOrder?: number;
}

export interface ReferenceImportRequest<TRow> {
  batchName?: string;
  sourceLabel?: string;
  rows: TRow[];
}

export interface ReferenceImportResponse<TItem> {
  batchName?: string;
  sourceLabel?: string;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  items: TItem[];
}

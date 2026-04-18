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

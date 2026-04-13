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

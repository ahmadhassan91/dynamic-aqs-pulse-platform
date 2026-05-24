export const CONSIGNMENT_SITE_STATUSES = [
  'onboarding_in_progress',
  'ready_for_warehouse',
  'warehouse_pending',
  'baseline_pending',
  'active',
  'suspended',
  'exiting',
  'exited',
] as const;

export type ConsignmentSiteStatusKey = (typeof CONSIGNMENT_SITE_STATUSES)[number];

export const CONSIGNMENT_ACUMATICA_STATUSES = ['not_required', 'parked', 'pending', 'available', 'error'] as const;
export type ConsignmentAcumaticaStatusKey = (typeof CONSIGNMENT_ACUMATICA_STATUSES)[number];

export const CONSIGNMENT_FORM_TYPES = [
  'agreement',
  'blue',
  'rose',
  'purple',
  'sand',
  'return',
  'damage',
  'master_reference',
] as const;

export type ConsignmentFormTypeKey = (typeof CONSIGNMENT_FORM_TYPES)[number];

export const CONSIGNMENT_FORM_STATUSES = [
  'draft',
  'sent',
  'returned',
  'signed',
  'approved',
  'rejected',
  'current',
  'archived',
] as const;

export type ConsignmentFormStatusKey = (typeof CONSIGNMENT_FORM_STATUSES)[number];

export const CONSIGNMENT_AUDIT_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
export type ConsignmentAuditStatusKey = (typeof CONSIGNMENT_AUDIT_STATUSES)[number];

export const CONSIGNMENT_AUDIT_EVIDENCE_PURPOSES = ['general', 'discrepancy'] as const;
export type ConsignmentAuditEvidencePurposeKey = (typeof CONSIGNMENT_AUDIT_EVIDENCE_PURPOSES)[number];

export const CONSIGNMENT_RECONCILIATION_STATUSES = [
  'not_started',
  'open',
  'true_up_confirmed',
  'resolved',
  'escalated',
] as const;

export type ConsignmentReconciliationStatusKey = (typeof CONSIGNMENT_RECONCILIATION_STATUSES)[number];

export interface ConsignmentSiteSummary {
  id: string;
  accountId: string;
  accountName: string;
  locationId?: string;
  locationName?: string;
  locationCity?: string;
  locationState?: string;
  name: string;
  status: ConsignmentSiteStatusKey;
  acumaticaStatus: ConsignmentAcumaticaStatusKey;
  warehouseCode?: string;
  acumaticaWarehouseId?: string;
  acumaticaLastSyncedAt?: string;
  acumaticaLastError?: string;
  ownerTmUserId?: string;
  ownerTmName?: string;
  ownerRdUserId?: string;
  ownerRdName?: string;
  territoryId?: string;
  territoryName?: string;
  regionId?: string;
  regionName?: string;
  shippingCenterId?: string;
  shippingCenterName?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  baselineEstablishedAt?: string;
  lastAuditCompletedAt?: string;
  nextAuditDueAt?: string;
  activeSince?: string;
  exitedAt?: string;
  notes?: string;
  formCounts: Record<ConsignmentFormTypeKey, number>;
  openWorkItemCount: number;
  openDiscrepancyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignmentFormSummary {
  id: string;
  siteId: string;
  formType: ConsignmentFormTypeKey;
  status: ConsignmentFormStatusKey;
  title?: string;
  documentUrl?: string;
  externalRef?: string;
  version: number;
  isCurrent: boolean;
  receivedAt?: string;
  signedAt?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignmentAuditLineSummary {
  id: string;
  sku?: string;
  barcode?: string;
  productName: string;
  expectedQuantity?: number;
  actualQuantity?: number;
  varianceQuantity?: number;
  notes?: string;
}

export interface ConsignmentAuditSummary {
  id: string;
  siteId: string;
  scheduledFor: string;
  startedAt?: string;
  completedAt?: string;
  status: ConsignmentAuditStatusKey;
  reconciliationStatus: ConsignmentReconciliationStatusKey;
  expectedSource: string;
  sourceFreshnessLabel: string;
  notes?: string;
  lines: ConsignmentAuditLineSummary[];
  evidenceCount: number;
  discrepancyEvidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignmentAuditEvidenceSummary {
  id: string;
  auditId: string;
  siteId: string;
  purpose: ConsignmentAuditEvidencePurposeKey;
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  notes?: string;
  uploadedByUserId?: string;
  uploadedByName?: string;
  uploadedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignmentWorkItemSummary {
  id: string;
  siteId: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  assignedToUserId?: string;
  dueAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsignmentSiteDetail extends ConsignmentSiteSummary {
  forms: ConsignmentFormSummary[];
  audits: ConsignmentAuditSummary[];
  workItems: ConsignmentWorkItemSummary[];
}

export interface ListConsignmentSitesRequest {
  search?: string;
  status?: ConsignmentSiteStatusKey;
  readinessState?: ConsignmentSiteStatusKey;
  assignedTmUserId?: string;
  assignedRdUserId?: string;
  includeExited?: boolean;
  includeClosed?: boolean;
  dueWithinDays?: number;
  limit?: number;
}

export interface ListConsignmentSitesResponse {
  items: ConsignmentSiteSummary[];
  total: number;
}

export interface CreateConsignmentSiteRequest {
  accountId: string;
  locationId?: string;
  name?: string;
  warehouseCode?: string;
  ownerTmUserId?: string;
  ownerRdUserId?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  notes?: string;
}

export interface UpdateConsignmentSiteRequest {
  name?: string;
  locationId?: string | null;
  status?: ConsignmentSiteStatusKey;
  warehouseCode?: string | null;
  ownerTmUserId?: string | null;
  ownerRdUserId?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  notes?: string | null;
}

export interface CreateConsignmentFormRequest {
  formType: ConsignmentFormTypeKey;
  status?: ConsignmentFormStatusKey;
  title?: string;
  documentUrl?: string;
  externalRef?: string;
  version?: number;
  isCurrent?: boolean;
  receivedAt?: string;
  signedAt?: string;
  approvedAt?: string;
  notes?: string;
}

export type UpsertConsignmentDocumentRequest = CreateConsignmentFormRequest;

export interface UpdateConsignmentDocumentRequest {
  status?: ConsignmentFormStatusKey;
  title?: string | null;
  documentUrl?: string | null;
  externalRef?: string | null;
  version?: number;
  isCurrent?: boolean;
  receivedAt?: string | null;
  signedAt?: string | null;
  approvedAt?: string | null;
  notes?: string | null;
}

export interface ScheduleConsignmentAuditRequest {
  scheduledFor: string;
  notes?: string;
}

export type CreateConsignmentAuditRequest = ScheduleConsignmentAuditRequest;

export interface UpdateConsignmentAuditRequest {
  scheduledFor?: string;
  status?: ConsignmentAuditStatusKey;
  completedAt?: string | null;
  notes?: string;
  reconciliationStatus?: ConsignmentReconciliationStatusKey;
  lines?: Array<{
    sku?: string;
    barcode?: string;
    productName: string;
    expectedQuantity?: number;
    actualQuantity?: number;
    notes?: string;
  }>;
}

export type CompleteConsignmentAuditRequest = UpdateConsignmentAuditRequest;

export interface UploadConsignmentAuditEvidenceRequest {
  purpose?: ConsignmentAuditEvidencePurposeKey;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  notes?: string;
}

export interface UploadConsignmentAuditEvidenceResponse {
  audit: ConsignmentAuditSummary;
  evidence: ConsignmentAuditEvidenceSummary;
}

export interface ConsignmentReadinessItemSummary {
  code: string;
  label: string;
  status: 'complete' | 'blocked' | 'pending';
  blocking: boolean;
  detail?: string;
}

export interface ConsignmentOperationalQueueRequest {
  status?: ConsignmentSiteStatusKey;
  readinessState?: ConsignmentSiteStatusKey;
  auditStatus?: ConsignmentAuditStatusKey;
  limit?: number;
}

export interface ConsignmentOperationalQueueResponse {
  items: ConsignmentSiteSummary[];
  total: number;
  generatedAt: string;
}

export interface ConsignmentAccountReadModel {
  accountId: string;
  participatesInConsignment: boolean;
  activeSiteCount: number;
  onboardingSiteCount: number;
  exitedSiteCount: number;
  sites: ConsignmentSiteSummary[];
}

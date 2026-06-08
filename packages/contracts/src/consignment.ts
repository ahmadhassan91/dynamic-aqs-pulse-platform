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
  manualBaselineQuantity?: number;
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

export interface ConsignmentDiscrepancyCaseSummary {
  id: string;
  siteId: string;
  auditId?: string;
  status: string;
  poFollowUpStatus: string;
  reasonCode?: string;
  sku?: string;
  productName?: string;
  quantity?: number;
  trueUpConfirmedAt?: string;
  poDueAt?: string;
  externalPoRef?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarkConsignmentPoReceivedRequest {
  receivedAt?: string;
  externalPoRef?: string;
  notes?: string;
}

export const CONSIGNMENT_ADJUSTMENT_STATUSES = ['requested', 'applied', 'rejected', 'cancelled'] as const;
export type ConsignmentAdjustmentStatusKey = (typeof CONSIGNMENT_ADJUSTMENT_STATUSES)[number];

export interface ConsignmentAdjustmentSummary {
  id: string;
  siteId: string;
  documentId?: string;
  status: ConsignmentAdjustmentStatusKey;
  reasonCode?: string;
  currentTotal: number;
  addQuantity: number;
  removeQuantity: number;
  proposedTotal: number;
  appliedAt?: string;
  rejectedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsignmentAdjustmentRequest {
  documentId?: string;
  reasonCode?: string;
  currentTotal: number;
  addQuantity?: number;
  removeQuantity?: number;
  proposedTotal?: number;
  notes?: string;
}

export interface ApplyConsignmentAdjustmentRequest {
  appliedAt?: string;
  notes?: string;
}

export const CONSIGNMENT_EXIT_STATUSES = ['notice_given', 'final_reconciliation', 'closed', 'cancelled'] as const;
export type ConsignmentExitStatusKey = (typeof CONSIGNMENT_EXIT_STATUSES)[number];

export interface ConsignmentExitSummary {
  id: string;
  siteId: string;
  documentId?: string;
  status: ConsignmentExitStatusKey;
  noticeGivenAt: string;
  plannedExitAt?: string;
  finalReconciliationAt?: string;
  returnQuantity?: number;
  retainedQuantity?: number;
  settlementReference?: string;
  closedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StartConsignmentExitRequest {
  documentId?: string;
  noticeGivenAt?: string;
  plannedExitAt?: string;
  notes?: string;
}

export interface CloseConsignmentExitRequest {
  finalReconciliationAt?: string;
  returnQuantity?: number;
  retainedQuantity?: number;
  settlementReference?: string;
  notes?: string;
}

export interface ConsignmentFieldActivityNoteSummary {
  id: string;
  title: string;
  summary?: string;
  nextStep?: string;
  sentiment?: string;
  capturedByName?: string;
  reviewedByName?: string;
  recordedAt: string;
  reviewedAt?: string;
  writebackTarget?: string;
}

export interface ConsignmentSiteDetail extends ConsignmentSiteSummary {
  forms: ConsignmentFormSummary[];
  audits: ConsignmentAuditSummary[];
  workItems: ConsignmentWorkItemSummary[];
  discrepancyCases: ConsignmentDiscrepancyCaseSummary[];
  adjustments: ConsignmentAdjustmentSummary[];
  exits: ConsignmentExitSummary[];
  fieldActivity: ConsignmentFieldActivityNoteSummary[];
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

export const CONSIGNMENT_TRUE_UP_OUTCOMES = ['po_required', 'resolved_no_po', 'write_off'] as const;
export type ConsignmentTrueUpOutcomeKey = (typeof CONSIGNMENT_TRUE_UP_OUTCOMES)[number];

export interface ConfirmConsignmentTrueUpRequest {
  outcome: ConsignmentTrueUpOutcomeKey;
  confirmedAt?: string;
  reasonCode?: string;
  notes?: string;
  externalPoRef?: string;
}

export interface ConfirmConsignmentTrueUpResponse {
  audit: ConsignmentAuditSummary;
  site: ConsignmentSiteDetail;
}

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

// Server-owned dashboard contract.
// The previous shape was assembled client-side from a 200-row sites sample;
// that under-counts at scale and cannot compute time-window KPIs (compliance,
// PO cycle, exit accuracy). This contract is the source of truth for the new
// /api/v1/consignment/dashboard endpoint.
export interface ConsignmentDashboardMetrics {
  // Existing 9 metrics, kept for back-compat with the client-side shape.
  totalSites: number;
  activeSites: number;
  onboardingSites: number;
  readyForWarehouseSites: number;
  auditsDueSoon: number;
  overdueAudits: number;
  openReconciliations: number;
  openPoFollowUps: number;
  openMailboxWorkItems: number;
  // New server-computed KPIs (FR-CSG mapping below). All are non-Acumatica.
  auditComplianceRatePct: number;          // FR-CSG-019/021 lookback 90d
  onTimeFirstBaselinePct: number;          // FR-CSG-006/007 BLUE-within-30d
  overduePoCount: number;                  // FR-CSG-030 (REQUIRED|ESCALATED & poDueAt<now)
  meanPoCycleDays: number | null;          // FR-CSG-029 trueUpConfirmedAt → received, 90d
  exitCompletionRatePct: number | null;    // FR-CSG-008 closed-vs-started over 365d
  // Sixth KPI from PRD §4A.5 ("Inventory value by site") is correctly parked
  // behind Acumatica inventory truth. The contract surfaces the parked flag so
  // the UI can render a parked card instead of a fake number.
  inventoryValueBySiteParked: true;
}

export interface ConsignmentDashboardOnboardingPipelineEntry {
  stage: string;
  count: number;
}

export type ConsignmentDashboardAuditDueBucketKey =
  | 'overdue'
  | 'due_soon'
  | 'scheduled_later'
  | 'unscheduled';

export interface ConsignmentDashboardAuditDueBucket {
  bucket: ConsignmentDashboardAuditDueBucketKey;
  count: number;
}

export interface ConsignmentDashboardWorkQueueEntry {
  id: string;
  siteId: string;
  siteName?: string;
  accountDisplayName: string;
  subject: string;
  status: string;
  ownerName?: string;
  dueAt?: string;
  lastContactAt?: string;
}

// Alert type string union — mirrors the ConsignmentOperationalAlertType DB enum
// so the workspace can pattern-match without importing the Prisma enum directly.
export type ConsignmentOperationalAlertTypeKey =
  | 'AUDIT_DUE_FOURTEEN_DAYS'
  | 'AUDIT_DUE_SEVEN_DAYS'
  | 'AUDIT_DUE_TODAY'
  | 'AUDIT_OVERDUE_SEVEN_DAYS'
  | 'AUDIT_OVERDUE_FOURTEEN_DAYS'
  | 'PO_CLOCK_START'
  | 'PO_CLOCK_THREE_DAYS_REMAINING'
  | 'PO_CLOCK_ONE_DAY_REMAINING'
  | 'PO_OVERDUE_FIVE_DAYS'
  | 'PO_OVERDUE_TEN_DAYS';

// Minimal alert record included in the dashboard response so the workspace can
// surface timed-pressure rows in the Next Site Work queue without a second call.
// Only PENDING alerts are included; DELIVERED / ACKNOWLEDGED / DISMISSED are
// excluded so the queue stays actionable.
export interface ConsignmentPendingAlertEntry {
  id: string;
  siteId: string;
  alertType: ConsignmentOperationalAlertTypeKey;
  triggeredAt: string;
  auditId?: string;
  discrepancyId?: string;
}

export interface ConsignmentDashboardResponse {
  metrics: ConsignmentDashboardMetrics;
  onboardingPipeline: ConsignmentDashboardOnboardingPipelineEntry[];
  auditDueBuckets: ConsignmentDashboardAuditDueBucket[];
  workQueue: ConsignmentDashboardWorkQueueEntry[];
  // PENDING operational alerts scoped to the actor's sites. The workspace feeds
  // these into buildNextSiteWorkRows so PO-clock pressure and specific overdue
  // labels surface in the ranked queue without additional network calls.
  pendingAlerts: ConsignmentPendingAlertEntry[];
  generatedAt: string;
}

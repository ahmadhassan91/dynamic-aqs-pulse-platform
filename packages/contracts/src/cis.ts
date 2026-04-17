export const CIS_PACKAGE_STATUSES = [
  'not_sent',
  'link_sent',
  'draft_in_progress',
  'submitted',
  'review_in_progress',
  'sales_signed_off',
  'finance_pending',
  'finance_approved',
  'finance_declined',
  'completed',
] as const;

export type CisPackageStatusKey = (typeof CIS_PACKAGE_STATUSES)[number];

export const CIS_ENTRY_METHODS = [
  'digital_link',
  'scanned_pdf',
] as const;

export type CisEntryMethodKey = (typeof CIS_ENTRY_METHODS)[number];

export const CIS_PAYMENT_STATUSES = [
  'not_started',
  'vault_pending',
  'vault_complete',
  'not_required',
] as const;

export type CisPaymentStatusKey = (typeof CIS_PAYMENT_STATUSES)[number];

export const CIS_PAYMENT_VAULT_PROVIDERS = [
  'unknown',
  'ebizcharge',
  'moneris',
] as const;

export type CisPaymentVaultProviderKey = (typeof CIS_PAYMENT_VAULT_PROVIDERS)[number];

export const PAYMENT_INTEGRATION_CAPTURE_MODES = [
  'manual_recording',
  'provider_runtime',
] as const;

export type PaymentIntegrationCaptureModeKey = (typeof PAYMENT_INTEGRATION_CAPTURE_MODES)[number];

export const CIS_ESIGN_STATUSES = [
  'not_started',
  'signed',
  'vendor_pending',
] as const;

export type CisEsignStatusKey = (typeof CIS_ESIGN_STATUSES)[number];

export const CIS_PAYMENT_METHODS = [
  'NET_30',
  'ACH',
  'CREDIT_CARD',
] as const;

export type CisPaymentMethodKey = (typeof CIS_PAYMENT_METHODS)[number];

export const CIS_FINANCE_DECISION_STATUSES = [
  'not_submitted',
  'pending',
  'info_requested',
  'approved',
  'conditional',
  'declined',
] as const;

export type CisFinanceDecisionStatusKey = (typeof CIS_FINANCE_DECISION_STATUSES)[number];

export const CIS_PAYMENT_TERMS = [
  'NET_30',
  'NET_60',
  'COD',
  'CUSTOM',
] as const;

export type CisPaymentTermsKey = (typeof CIS_PAYMENT_TERMS)[number];

export const CIS_DOCUMENT_TYPES = [
  'scanned_cis_pdf',
  'resale_certificate',
  'supporting_attachment',
] as const;

export type CisDocumentTypeKey = (typeof CIS_DOCUMENT_TYPES)[number];

export const CIS_PARSE_STATUSES = [
  'queued',
  'parsed',
  'needs_review',
  'failed',
] as const;

export type CisParseStatusKey = (typeof CIS_PARSE_STATUSES)[number];

export interface CisFormDraftInput {
  companyWebsite?: string;
  numOfTechs?: number;
  numOfInstallTechs?: number;
  numOfSalespeopleAdvisors?: number;
  affinityGroupOrFranchise?: string;
  isPrivateEquity?: boolean;
  parentCompanyName?: string;
  primaryContactName?: string;
  primaryContactTitle?: string;
  primaryContactEmail?: string;
  primaryContactCellPhone?: string;
  ownerManagerName?: string;
  ownerManagerTitle?: string;
  ownerManagerEmail?: string;
  ownerManagerCellPhone?: string;
  legalCompanyName?: string;
  physicalAddress?: string;
  physicalCity?: string;
  physicalState?: string;
  physicalZip?: string;
  physicalCountryCode?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountryCode?: string;
  companyPhone?: string;
  typeOfBusiness?: string;
  yearsInBusiness?: number;
  monthsInBusiness?: number;
  orderingContactName?: string;
  orderingContactCellPhone?: string;
  orderingContactEmail?: string;
  apContactName?: string;
  apDirectPhone?: string;
  apEmail?: string;
  paymentMethod?: CisPaymentMethodKey;
  achAuthorized?: boolean;
  cardOnFileAuthorized?: boolean;
  resaleCertificateAttached?: boolean;
  hasSignature?: boolean;
}

export interface CisFormDataRecord extends Omit<CisFormDraftInput, 'hasSignature'> {
  signatureCapturedAt?: string;
  submittedByProspectAt?: string;
  lastSavedAt?: string;
}

export interface CisPackageSummary {
  id: string;
  leadId: string;
  leadCompanyName: string;
  leadContactDisplayName: string;
  status: CisPackageStatusKey;
  entryMethod: CisEntryMethodKey;
  externalLinkExpiresAt?: string;
  externalLinkLastSentAt?: string;
  externalLinkSentCount: number;
  paymentStatus: CisPaymentStatusKey;
  esignStatus: CisEsignStatusKey;
  submittedAt?: string;
  reviewStartedAt?: string;
  salesSignedOffAt?: string;
  financeSubmittedAt?: string;
  financeDecidedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CisPackageEventSummary {
  id: string;
  eventType: string;
  fromStatus?: CisPackageStatusKey;
  toStatus?: CisPackageStatusKey;
  actorUserId?: string;
  actorType: string;
  note?: string;
  occurredAt: string;
}

export interface CisPackageDetail extends CisPackageSummary {
  formData: CisFormDataRecord;
  internalReview?: CisInternalReviewRecord;
  financeDecision?: CisFinanceDecisionRecord;
  paymentVaultReferences: CisPaymentVaultReferenceRecord[];
  events: CisPackageEventSummary[];
}

export interface CisPaymentVaultReferenceRecord {
  id: string;
  provider: CisPaymentVaultProviderKey;
  last4?: string;
  brand?: string;
  authorizationCapturedAt?: string;
  status: string;
  hasVaultToken: boolean;
  hasVaultCustomerRef: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CisInternalReviewRecord {
  reviewStartedByUserId?: string;
  salesReviewNotes?: string;
  salesSignedOffByUserId?: string;
  salesSignedOffAt?: string;
  financeCoverNotes?: string;
}

export interface CisFinanceDecisionRecord {
  status: CisFinanceDecisionStatusKey;
  submittedByUserId?: string;
  submittedAt?: string;
  creditLineAmount?: number;
  paymentTerms?: CisPaymentTermsKey;
  submissionNotes?: string;
  requestedInfoNotes?: string;
  decisionNotes?: string;
  decidedByUserId?: string;
  decidedAt?: string;
}

export interface RequestCisPaymentCaptureRequest {
  note?: string;
}

export interface RecordCisPaymentVaultReferenceRequest {
  provider?: CisPaymentVaultProviderKey;
  vaultToken?: string;
  vaultCustomerRef?: string;
  last4?: string;
  brand?: string;
  authorizationCapturedAt?: string;
  status?: string;
  note?: string;
}

export interface PaymentIntegrationPolicySummary {
  captureMode: PaymentIntegrationCaptureModeKey;
  defaultProvider: CisPaymentVaultProviderKey;
  allowCisCaptureTracking: boolean;
  allowAccountPaymentMethodManagement: boolean;
}

export interface AdminPaymentIntegrationSettingsResponse {
  provider: 'tokenized_payments';
  isConfigured: boolean;
  configurationIssues: string[];
  policy: PaymentIntegrationPolicySummary;
}

export interface UpdateAdminPaymentIntegrationSettingsRequest {
  captureMode?: PaymentIntegrationCaptureModeKey;
  defaultProvider?: CisPaymentVaultProviderKey;
  allowCisCaptureTracking?: boolean;
  allowAccountPaymentMethodManagement?: boolean;
}

export interface CisDocumentRecord {
  id: string;
  cisPackageId: string;
  documentType: CisDocumentTypeKey;
  storageKey: string;
  fileName: string;
  mimeType: string;
  uploadedByUserId?: string;
  uploadedAt: string;
  sha256?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CisParsedDraftRecord {
  id: string;
  cisPackageId: string;
  documentId: string;
  documentFileName: string;
  documentType: CisDocumentTypeKey;
  parserVersion: string;
  parseStatus: CisParseStatusKey;
  rawExtractionText?: string;
  rawStructuredPayload?: Record<string, unknown>;
  fieldConfidenceMap?: Record<string, unknown>;
  safeFieldPayload?: CisFormDraftInput;
  paymentFieldsDetected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListCisParsedDraftsResponse {
  items: CisParsedDraftRecord[];
}

export interface CisLinkIssueRequest {
  recipientEmail?: string;
  note?: string;
}

export interface CisLinkIssueResponse {
  cisPackage: CisPackageSummary;
  publicUrl: string;
  expiresAt: string;
  deliveryMode: 'manual_copy';
  recipientEmail?: string;
}

export interface CisPublicPackage {
  cisPackageId: string;
  leadId: string;
  leadCompanyName: string;
  leadContactDisplayName: string;
  status: CisPackageStatusKey;
  entryMethod: CisEntryMethodKey;
  externalLinkExpiresAt?: string;
  paymentStatus: CisPaymentStatusKey;
  esignStatus: CisEsignStatusKey;
  cardOnFileRequired: boolean;
  formData: CisFormDataRecord;
}

export interface SavePublicCisDraftRequest {
  formData: CisFormDraftInput;
}

export interface SubmitPublicCisRequest {
  formData: CisFormDraftInput;
}

export interface CisReviewSignoffRequest {
  salesReviewNotes?: string;
  financeCoverNotes?: string;
}

export interface CisSubmitToFinanceRequest {
  submissionNotes?: string;
}

export interface CisFinanceDecisionRequest {
  decision: Exclude<CisFinanceDecisionStatusKey, 'not_submitted' | 'pending'>;
  creditLineAmount?: number;
  paymentTerms?: CisPaymentTermsKey;
  decisionNotes?: string;
  requestedInfoNotes?: string;
}

export interface UploadCisScanRequest {
  fileName: string;
  storageKey?: string;
  mimeType?: string;
  sha256?: string;
  parserVersion?: string;
  rawExtractionText?: string;
  rawStructuredPayload?: Record<string, unknown>;
  fieldConfidenceMap?: Record<string, unknown>;
  safeFieldPayload?: CisFormDraftInput;
  paymentFieldsDetected?: boolean;
}

export interface UploadCisScanResponse {
  cisPackage: CisPackageDetail;
  document: CisDocumentRecord;
  parsedDraft: CisParsedDraftRecord;
}

export interface ApplyCisParsedDraftRequest {
  note?: string;
}

export interface ListFinanceQueueRequest {
  decisionStatus?: Exclude<CisFinanceDecisionStatusKey, 'not_submitted'> | 'awaiting_submission';
}

export interface FinanceQueueItem {
  cisPackageId: string;
  leadId: string;
  companyName: string;
  contactDisplayName: string;
  cisStatus: CisPackageStatusKey;
  financeDecisionStatus: CisFinanceDecisionStatusKey | 'awaiting_submission';
  submittedToFinanceAt?: string;
  financeDecidedAt?: string;
  submittedByUserId?: string;
  decidedByUserId?: string;
  cardOnFileAuthorized: boolean;
  paymentMethod?: CisPaymentMethodKey;
  creditLineAmount?: number;
  paymentTerms?: CisPaymentTermsKey;
  slaHoursOpen?: number;
  salesSignedOffAt?: string;
  salesReviewNotes?: string;
  financeCoverNotes?: string;
  decisionNotes?: string;
}

export interface ListFinanceQueueResponse {
  items: FinanceQueueItem[];
  total: number;
}

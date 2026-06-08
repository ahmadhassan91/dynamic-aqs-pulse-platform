import type { CisFinanceDecisionStatusKey } from './cis.js';
import type { TerritoryAssignmentMethodKey } from './territories.js';

export const LEAD_STAGES = [
  'new',
  'discovery_scheduled',
  'discovery_completed',
  'cis_sent',
  'cis_signed',
  'onboarding_completed',
  'customer_active',
] as const;

export type LeadStageKey = (typeof LEAD_STAGES)[number];

export const LEAD_LIFECYCLE_STATUSES = [
  'active',
  'parked',
  'closed',
] as const;

export type LeadLifecycleStatusKey = (typeof LEAD_LIFECYCLE_STATUSES)[number];

export const LEAD_LIFECYCLE_REASON_CODES = [
  'not_interested',
  'no_response',
  'duplicate',
  'disqualified',
  'follow_up_later',
  'other',
] as const;

export type LeadLifecycleReasonCodeKey = (typeof LEAD_LIFECYCLE_REASON_CODES)[number];

export const LEAD_ROUTING_BASES = [
  'service_tech_count',
  'truck_count',
] as const;

export type LeadRoutingBasisKey = (typeof LEAD_ROUTING_BASES)[number];

export const LEAD_ROUTING_TEAMS = [
  'strategic_growth',
  'national_tm',
] as const;

export type LeadRoutingTeamKey = (typeof LEAD_ROUTING_TEAMS)[number];

export const LEAD_CAPTURE_METHODS = [
  'direct_web_form',
  'manual_entry',
  'bulk_import',
  'legacy_import',
] as const;

export type LeadCaptureMethodKey = (typeof LEAD_CAPTURE_METHODS)[number];

export const GROUP_AXIS_SELECTIONS = [
  'unknown',
  'none',
  'group',
] as const;

export type GroupAxisSelectionKey = (typeof GROUP_AXIS_SELECTIONS)[number];

export const GROUP_CLASSIFICATIONS = [
  'independent',
  'affinity_only',
  'ownership_only',
  'hybrid',
] as const;

export type GroupClassificationKey = (typeof GROUP_CLASSIFICATIONS)[number];

export const WEBSITE_LEAD_FORM_TYPES = [
  'homeowner',
  'contractor',
  'both',
] as const;

export type WebsiteLeadFormTypeKey = (typeof WEBSITE_LEAD_FORM_TYPES)[number];

export const WEBSITE_LEAD_TYPES = [
  'homeowner',
  'contractor',
] as const;

export type WebsiteLeadTypeKey = (typeof WEBSITE_LEAD_TYPES)[number];

export const WEBSITE_LEAD_CUSTOMER_STATUSES = [
  'new_customer',
  'existing_customer',
] as const;

export type WebsiteLeadCustomerStatusKey = (typeof WEBSITE_LEAD_CUSTOMER_STATUSES)[number];

export const WEBSITE_LEAD_SUBMISSION_OUTCOMES = [
  'created_new_lead',
  'attached_to_existing_lead',
] as const;

export type WebsiteLeadSubmissionOutcomeKey = (typeof WEBSITE_LEAD_SUBMISSION_OUTCOMES)[number];

export const WEBSITE_LEAD_SUBMISSION_REVIEW_STATUSES = [
  'not_required',
  'pending_review',
  'confirmed_existing',
  'created_new_lead',
  'relinked_existing',
] as const;

export type WebsiteLeadSubmissionReviewStatusKey = (typeof WEBSITE_LEAD_SUBMISSION_REVIEW_STATUSES)[number];

export const WEBSITE_LEAD_CONNECTION_HEALTH_STATUSES = [
  'healthy',
  'warning',
  'blocked',
] as const;

export type WebsiteLeadConnectionHealthStatusKey = (typeof WEBSITE_LEAD_CONNECTION_HEALTH_STATUSES)[number];

export interface WebsiteLeadReadinessCheckSummary {
  key: string;
  label: string;
  status: WebsiteLeadConnectionHealthStatusKey;
  detail?: string;
}

export interface WebsiteLeadReadinessSummary {
  status: WebsiteLeadConnectionHealthStatusKey;
  isActive: boolean;
  hasAllowedOrigins: boolean;
  allowedOriginMatchesSiteUrl: boolean;
  hasRecentSubmission: boolean;
  lastSubmissionAt?: string;
  submissionsLast30Days: number;
  embedReady: boolean;
  issues: string[];
  checks: WebsiteLeadReadinessCheckSummary[];
}

export const LEAD_CONSIGNMENT_INTEREST_STATUSES = [
  'not_discussed',
  'interested',
  'approved',
  'declined',
] as const;

export type LeadConsignmentInterestStatusKey = (typeof LEAD_CONSIGNMENT_INTEREST_STATUSES)[number];

export const LEAD_CONSIGNMENT_ENTRY_TIMINGS = [
  'at_onboarding',
  'later',
] as const;

export type LeadConsignmentEntryTimingKey = (typeof LEAD_CONSIGNMENT_ENTRY_TIMINGS)[number];

export const LEAD_WORKFLOW_QUEUE_VIEWS = [
  'all',
  'urgent',
  'stagnant',
] as const;

export type LeadWorkflowQueueViewKey = (typeof LEAD_WORKFLOW_QUEUE_VIEWS)[number];

export const LEAD_WORKFLOW_ACTION_TYPES = [
  'call',
  'email',
  'task',
] as const;

export type LeadWorkflowActionTypeKey = (typeof LEAD_WORKFLOW_ACTION_TYPES)[number];

export const LEAD_WORKFLOW_URGENCY_LEVELS = [
  'high',
  'medium',
  'low',
] as const;

export type LeadWorkflowUrgencyKey = (typeof LEAD_WORKFLOW_URGENCY_LEVELS)[number];

export const LEAD_OPERATIONAL_ALERT_DELIVERY_MODES = [
  'preview',
  'disabled',
  'microsoft_graph',
] as const;

export type LeadOperationalAlertDeliveryModeKey = (typeof LEAD_OPERATIONAL_ALERT_DELIVERY_MODES)[number];

export const LEAD_OPERATIONAL_ALERT_DELIVERY_PROVIDERS = [
  'preview',
  'disabled',
  'microsoft_graph',
] as const;

export type LeadOperationalAlertDeliveryProviderKey =
  (typeof LEAD_OPERATIONAL_ALERT_DELIVERY_PROVIDERS)[number];

export interface LeadOperationalAlertMicrosoftGraphConfig {
  provider: 'microsoft_graph';
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  fromUser?: string;
  authBaseUrl: string;
  graphBaseUrl: string;
}

export interface LeadOperationalAlertDeliveryConfig {
  mode: LeadOperationalAlertDeliveryModeKey;
  provider: LeadOperationalAlertDeliveryProviderKey;
  microsoftGraph?: LeadOperationalAlertMicrosoftGraphConfig;
}

export interface LeadOperationalAlertDeliveryFailureSummary {
  alertId: string;
  attemptedAt: string;
  recipientName: string;
  recipientEmail?: string;
  subject: string;
  errorMessage?: string;
}

export interface LeadOperationalAlertDeliveryMetrics {
  pendingAlertCount: number;
  failedAlertCount: number;
  retryableFailedAlertCount: number;
  sentAttemptCount: number;
  previewedAttemptCount: number;
  skippedAttemptCount: number;
  failedAttemptCount: number;
  latestFailure?: LeadOperationalAlertDeliveryFailureSummary;
}

export interface AdminLeadOperationalAlertDeliverySettingsResponse {
  provider: 'lead_operational_alerts';
  mode: LeadOperationalAlertDeliveryModeKey;
  deliveryProvider: LeadOperationalAlertDeliveryProviderKey;
  isConfigured: boolean;
  status: 'ready' | 'warning' | 'blocked';
  statusDetail: string;
  configurationIssues: string[];
  metrics: LeadOperationalAlertDeliveryMetrics;
  quietHours: LeadOperationalAlertQuietHoursPolicy;
  recipients: LeadOperationalAlertRecipientSummary[];
  microsoftGraph?: {
    fromUser?: string;
    authBaseUrl: string;
    graphBaseUrl: string;
    tenantConfigured: boolean;
    clientConfigured: boolean;
    clientSecretConfigured: boolean;
  };
}

export interface LeadOperationalAlertQuietHoursPolicy {
  enabled: boolean;
  startLocal: string;
  endLocal: string;
  timeZone: string;
}

export interface LeadOperationalAlertRecipientSummary {
  id: string;
  code: string;
  routingTeam: LeadRoutingTeamKey;
  name: string;
  email?: string;
  roleTitle?: string;
  isActive: boolean;
  sortOrder: number;
  updatedAt: string;
}

export interface UpdateLeadOperationalAlertRecipientRequest {
  name?: string;
  email?: string | null;
  roleTitle?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateLeadOperationalAlertQuietHoursRequest {
  enabled?: boolean;
  startLocal?: string;
  endLocal?: string;
  timeZone?: string;
}

export interface RetryLeadOperationalAlertDeliveriesRequest {
  alertIds?: string[];
  limit?: number;
}

export interface RetryLeadOperationalAlertDeliveriesResponse {
  matchedAlertCount: number;
  retriedAlertCount: number;
  skippedAlertCount: number;
  enqueuedDeliveryCount: number;
  processedAt: string;
}

export interface DeadLetterLeadOperationalAlertDeliveriesRequest {
  alertIds: string[];
  reason: string;
}

export interface DeadLetterLeadOperationalAlertDeliveriesResponse {
  matchedAlertCount: number;
  deadLetteredAlertCount: number;
  skippedAlertCount: number;
  processedAt: string;
}

export const LEAD_READINESS_STATUSES = [
  'not_started',
  'in_progress',
  'blocked',
  'ready',
  'converted',
] as const;

export type LeadReadinessStatusKey = (typeof LEAD_READINESS_STATUSES)[number];

export const ONBOARDING_CHECKLIST_STATUSES = [
  'not_started',
  'in_progress',
  'blocked',
  'completed',
] as const;

export type OnboardingChecklistStatusKey = (typeof ONBOARDING_CHECKLIST_STATUSES)[number];

export const ONBOARDING_CHECKLIST_ITEM_STATUSES = [
  'pending',
  'in_progress',
  'blocked',
  'completed',
  'not_required',
] as const;

export type OnboardingChecklistItemStatusKey = (typeof ONBOARDING_CHECKLIST_ITEM_STATUSES)[number];

export const LEAD_CONTACT_ROLES = [
  'primary',
  'owner_manager',
  'ordering',
  'accounts_payable',
  'technical',
  'other',
] as const;

export type LeadContactRoleKey = (typeof LEAD_CONTACT_ROLES)[number];

export const LEAD_CONTACT_SOURCES = [
  'lead_capture',
  'cis_primary',
  'cis_owner_manager',
  'cis_ordering',
  'cis_accounts_payable',
  'manual',
] as const;

export type LeadContactSourceKey = (typeof LEAD_CONTACT_SOURCES)[number];

export const LEAD_CONVERSION_PREPARATION_STATUSES = [
  'draft',
  'validated',
  'blocked',
  'converted',
] as const;

export type LeadConversionPreparationStatusKey = (typeof LEAD_CONVERSION_PREPARATION_STATUSES)[number];

export const PORTAL_ELIGIBILITY_STATUSES = [
  'unassessed',
  'blocked',
  'ready',
  'provisioned',
] as const;

export type PortalEligibilityStatusKey = (typeof PORTAL_ELIGIBILITY_STATUSES)[number];

export const LEAD_IMPORT_TARGET_FIELDS = [
  'companyName',
  'contactFirstName',
  'contactLastName',
  'contactDisplayName',
  'email',
  'phone',
  'state',
  'countryCode',
  'sourceDetail',
  'leadRating',
  'serviceTechCount',
  'installTechCount',
  'truckCount',
  'salesPersonCount',
  'potentialValueCents',
  'affinityGroupName',
  'ownershipGroupName',
  'privateLabelName',
  'notes',
] as const;

export type LeadImportTargetFieldKey = (typeof LEAD_IMPORT_TARGET_FIELDS)[number];

export const LEAD_IMPORT_REVIEW_ROW_STATUSES = [
  'ready',
  'potential_duplicate',
  'invalid',
  'skipped',
  'imported',
  'failed',
] as const;

export type LeadImportReviewRowStatusKey = (typeof LEAD_IMPORT_REVIEW_ROW_STATUSES)[number];

export const LEAD_IMPORT_RUN_STATUSES = [
  'review_ready',
  'imported',
  'imported_with_errors',
] as const;

export type LeadImportRunStatusKey = (typeof LEAD_IMPORT_RUN_STATUSES)[number];

export const LEAD_IMPORT_DUPLICATE_DECISIONS = [
  'create_new',
  'use_existing',
  'enrich_existing',
  'skip',
] as const;

export type LeadImportDuplicateDecisionKey = (typeof LEAD_IMPORT_DUPLICATE_DECISIONS)[number];

export interface LeadSummary {
  id: string;
  companyName: string;
  contactDisplayName: string;
  email?: string;
  phone?: string;
  state?: string;
  countryCode?: string;
  businessSegmentCode: string;
  leadSourceCode: string;
  leadSourceName: string;
  leadCaptureMethod: LeadCaptureMethodKey;
  leadType?: WebsiteLeadTypeKey;
  sourceDetail?: string;
  sourceSiteId?: string;
  sourceSiteName?: string;
  sourceBrandTag?: string;
  leadRating?: string;
  serviceTechCount: number;
  installTechCount?: number;
  truckCount?: number;
  salesPersonCount?: number;
  potentialValueCents?: number;
  affinityGroupSelection: GroupAxisSelectionKey;
  affinityGroupId?: string;
  affinityGroupCode?: string;
  lifecycleStatus: LeadLifecycleStatusKey;
  lifecycleChangedAt?: string;
  lifecycleReasonCode?: LeadLifecycleReasonCodeKey;
  lifecycleReasonNote?: string;
  affinityGroupName?: string;
  ownershipGroupSelection: GroupAxisSelectionKey;
  ownershipGroupId?: string;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  groupClassification?: GroupClassificationKey;
  privateLabelName?: string;
  stage: LeadStageKey;
  routingBasis: LeadRoutingBasisKey;
  routingThreshold: number;
  routingTeam: LeadRoutingTeamKey;
  leadOwnerName?: string;
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  territoryAssignmentMethod?: TerritoryAssignmentMethodKey;
  territoryAssignedAt?: string;
  initialContactDueAt?: string;
  workflowTask?: LeadWorkflowTaskSummary;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLeadRequest {
  companyName?: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactDisplayName?: string;
  email?: string | null;
  phone?: string | null;
  state?: string | null;
  countryCode?: string | null;
  businessSegmentCode?: string;
  leadSourceCode?: string;
  sourceDetail?: string | null;
  sourceSiteId?: string | null;
  sourceSiteName?: string | null;
  sourceBrandTag?: string | null;
  sourceCampaign?: string | null;
  leadRating?: string | null;
  serviceTechCount?: number;
  installTechCount?: number | null;
  truckCount?: number | null;
  salesPersonCount?: number | null;
  potentialValueCents?: number | null;
  affinityGroupSelection?: GroupAxisSelectionKey;
  affinityGroupCode?: string | null;
  ownershipGroupSelection?: GroupAxisSelectionKey;
  ownershipGroupCode?: string | null;
  privateLabelName?: string | null;
  notes?: string | null;
}

export interface LeadStageEventSummary {
  id: string;
  fromStage?: LeadStageKey;
  toStage: LeadStageKey;
  note?: string;
  actorUserId?: string;
  occurredAt: string;
}

export interface LeadFieldActivityEventSummary {
  id: string;
  title: string;
  summary: string;
  nextStep?: string;
  sentiment?: string;
  tags: string[];
  capturedByName?: string;
  reviewedByName?: string;
  occurredAt: string;
}

export interface LeadReadinessItemSummary {
  id: string;
  code: string;
  label: string;
  ownerRoleCode?: string;
  ownerUserId?: string;
  status: OnboardingChecklistItemStatusKey;
  required: boolean;
  sortOrder: number;
  dueAt?: string;
  completedAt?: string;
  completedByUserId?: string;
  notes?: string;
}

export interface LeadReadinessSummary {
  leadId: string;
  status: LeadReadinessStatusKey;
  checklistStatus: OnboardingChecklistStatusKey;
  checklistGeneratedAt?: string;
  financeApprovedAt?: string;
  priceClassResolvedAt?: string;
  portalAccessGrantedAt?: string;
  firstOrderReadyAt?: string;
  convertedAt?: string;
  blockedReason?: string;
  notes?: string;
  sourceCisPackageId?: string;
  requiredItemCount: number;
  completedRequiredItemCount: number;
  blockingItemCount: number;
}

export interface LeadReadinessDetail {
  summary: LeadReadinessSummary;
  items: LeadReadinessItemSummary[];
  blockers: string[];
}

export interface LeadWorkflowTaskSummary {
  nextAction: string;
  actionType: LeadWorkflowActionTypeKey;
  urgency: LeadWorkflowUrgencyKey;
  colorToken: string;
  reason: string;
  financeDecisionStatus?: CisFinanceDecisionStatusKey;
}

export interface LeadDetail extends LeadSummary {
  contactFirstName?: string;
  contactLastName?: string;
  sourceCampaign?: string;
  leadRating?: string;
  notes?: string;
  initialContactedAt?: string;
  discoveryCallSkipped?: boolean;
  discoveryScheduledAt?: string;
  discoveryCompletedAt?: string;
  discoveryPainPoints?: string[];
  discoveryCurrentIaqSetup?: string;
  discoveryDecisionMaker?: string;
  discoveryBuyingIntent?: string;
  consignmentInterestStatus?: LeadConsignmentInterestStatusKey;
  consignmentEntryTiming?: LeadConsignmentEntryTimingKey;
  discoveryFastTrackReason?: string;
  discoverySummary?: string;
  cisSentAt?: string;
  cisSubmittedAt?: string;
  cisSignedAt?: string;
  onboardingCompletedAt?: string;
  firstOrderAt?: string;
  workflowTask: LeadWorkflowTaskSummary;
  stageHistory: LeadStageEventSummary[];
  fieldActivity: LeadFieldActivityEventSummary[];
  readiness?: LeadReadinessSummary;
}

export interface ListLeadsRequest {
  search?: string;
  stage?: LeadStageKey;
  lifecycleStatus?: LeadLifecycleStatusKey;
  routingTeam?: LeadRoutingTeamKey;
  leadSourceCode?: string;
  /** UX-L-014: filter by affinity group code */
  affinityGroupCode?: string;
  /** UX-L-014: filter by ownership group code */
  ownershipGroupCode?: string;
  /** UX-L-014: filter by territory id */
  territoryId?: string;
  limit?: number;
  /** UX-L-013: zero-based page offset for pagination */
  page?: number;
}

export interface ListLeadsResponse {
  items: LeadSummary[];
  total: number;
}

/** UX-L-010: freeform activity note logged on a lead record */
export interface LogLeadActivityNoteRequest {
  note: string;
  title?: string;
}

export interface LogLeadActivityNoteResponse {
  id: string;
  leadId: string;
  note: string;
  title: string;
  createdByName?: string;
  createdAt: string;
}

export interface ListWebsiteFormLeadsRequest {
  search?: string;
  stage?: LeadStageKey;
  lifecycleStatus?: LeadLifecycleStatusKey;
  sourceSiteId?: string;
  limit?: number;
}

export interface WebsiteFormLeadSummary extends LeadSummary {
  sourceCampaign?: string;
  intakeAgeHours: number;
  activePipeline: boolean;
}

export interface WebsiteFormsSummary {
  activePipelineCount: number;
  convertedCount: number;
  siteCount: number;
  latestLeadAt?: string;
}

export interface ListWebsiteLeadSubmissionsRequest {
  search?: string;
  sourceSiteId?: string;
  outcome?: WebsiteLeadSubmissionOutcomeKey;
  limit?: number;
}

export interface WebsiteLeadSubmissionSummary {
  id: string;
  websiteLeadSiteId?: string;
  siteId?: string;
  siteName?: string;
  brandTag?: string;
  linkedLeadId?: string;
  linkedLeadCompanyName?: string;
  linkedLeadStage?: LeadStageKey;
  linkedLeadLifecycleStatus?: LeadLifecycleStatusKey;
  leadType: WebsiteLeadTypeKey;
  outcome: WebsiteLeadSubmissionOutcomeKey;
  reviewStatus: WebsiteLeadSubmissionReviewStatusKey;
  reviewedByUserId?: string;
  reviewedByDisplayName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  contactDisplayName: string;
  companyName?: string;
  email?: string;
  phone?: string;
  state?: string;
  countryCode?: string;
  serviceTechCount?: number;
  installTechCount?: number;
  truckCount?: number;
  salesPersonCount?: number;
  inquiryTopic?: string;
  referralSource?: string;
  referralDetail?: string;
  createdAt: string;
}

export interface WebsiteLeadSubmissionSummaryRollup {
  duplicateCount: number;
  createdLeadCount: number;
  pendingReviewCount: number;
  resolvedCount: number;
  siteCount: number;
  uniqueLinkedLeadCount: number;
  latestSubmissionAt?: string;
}

export interface ListWebsiteLeadSubmissionsResponse {
  items: WebsiteLeadSubmissionSummary[];
  total: number;
  summary: WebsiteLeadSubmissionSummaryRollup;
}

export const WEBSITE_LEAD_SUBMISSION_RESOLUTION_DECISIONS = [
  'confirm_existing',
  'enrich_existing',
  'relink_existing',
  'create_new_lead',
] as const;

export type WebsiteLeadSubmissionResolutionDecisionKey = (typeof WEBSITE_LEAD_SUBMISSION_RESOLUTION_DECISIONS)[number];

export interface ResolveWebsiteLeadSubmissionRequest {
  decision: WebsiteLeadSubmissionResolutionDecisionKey;
  targetLeadId?: string;
  reviewNote?: string;
}

export interface WebsiteLeadSiteFormConfig {
  headline: string;
  subheadline: string;
  submitButtonLabel: string;
  successTitle: string;
  successMessage: string;
  homeownerInquiryLabel: string;
  contractorInquiryLabel: string;
  messageLabel: string;
  referralSourceLabel: string;
  referralDetailLabel: string;
  marketingConsentLabel: string;
  customerStatusLabel: string;
  homeownerInquiryOptions: string[];
  contractorInquiryOptions: string[];
  referralSourceOptions: string[];
}

export interface WebsiteLeadSiteSummary {
  id: string;
  siteId: string;
  siteName: string;
  url: string;
  allowedOrigins: string[];
  brandTag: string;
  formType: WebsiteLeadFormTypeKey;
  isActive: boolean;
  notes?: string;
  formConfig: WebsiteLeadSiteFormConfig;
  submissionsLast30Days: number;
  linkedLeadsTotal: number;
  activePipelineLeads: number;
  convertedLeads: number;
  conversionRate: number;
  recentSubmissionAt?: string;
  readiness: WebsiteLeadReadinessSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebsiteLeadSiteRequest {
  siteId: string;
  siteName: string;
  url: string;
  allowedOrigins?: string[];
  brandTag: string;
  formType: WebsiteLeadFormTypeKey;
  isActive?: boolean;
  notes?: string;
  formConfig?: Partial<WebsiteLeadSiteFormConfig>;
}

export interface UpdateWebsiteLeadSiteRequest {
  siteName?: string;
  url?: string;
  allowedOrigins?: string[];
  brandTag?: string;
  formType?: WebsiteLeadFormTypeKey;
  isActive?: boolean;
  notes?: string;
  formConfig?: Partial<WebsiteLeadSiteFormConfig>;
}

export interface ListWebsiteLeadSitesResponse {
  items: WebsiteLeadSiteSummary[];
}

export interface WebsiteLeadNotificationRecipientSummary {
  id: string;
  websiteLeadSiteId?: string;
  name: string;
  email: string;
  roleTitle?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebsiteLeadNotificationRecipientRequest {
  websiteLeadSiteId?: string;
  name: string;
  email: string;
  roleTitle?: string;
  isActive?: boolean;
}

export interface UpdateWebsiteLeadNotificationRecipientRequest {
  websiteLeadSiteId?: string | null;
  name?: string;
  email?: string;
  roleTitle?: string;
  isActive?: boolean;
}

export interface ListWebsiteLeadNotificationRecipientsResponse {
  items: WebsiteLeadNotificationRecipientSummary[];
}

export interface PublicWebsiteLeadSite {
  id: string;
  siteId: string;
  siteName: string;
  url: string;
  allowedOrigins: string[];
  brandTag: string;
  formType: WebsiteLeadFormTypeKey;
  formConfig: WebsiteLeadSiteFormConfig;
}

export interface ListWebsiteFormLeadsResponse {
  items: WebsiteFormLeadSummary[];
  total: number;
  summary: WebsiteFormsSummary;
}

export interface ListLeadWorkflowQueueRequest {
  search?: string;
  routingTeam?: LeadRoutingTeamKey;
  view?: LeadWorkflowQueueViewKey;
  limit?: number;
}

export interface LeadWorkflowQueueItem {
  leadId: string;
  companyName: string;
  contactDisplayName: string;
  email?: string;
  phone?: string;
  state?: string;
  leadSourceCode: string;
  leadSourceName: string;
  sourceSiteId?: string;
  sourceSiteName?: string;
  sourceBrandTag?: string;
  lifecycleStatus: LeadLifecycleStatusKey;
  lifecycleChangedAt?: string;
  lifecycleReasonCode?: LeadLifecycleReasonCodeKey;
  lifecycleReasonNote?: string;
  stage: LeadStageKey;
  stageLabel: string;
  routingTeam: LeadRoutingTeamKey;
  leadOwnerName?: string;
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  territoryAssignmentMethod?: TerritoryAssignmentMethodKey;
  territoryAssignedAt?: string;
  nextAction: string;
  actionType: LeadWorkflowActionTypeKey;
  urgency: LeadWorkflowUrgencyKey;
  colorToken: string;
  reason: string;
  daysInStage: number;
  slaRisk: boolean;
  initialContactDueAt?: string;
  hoursUntilInitialContactDue?: number;
  financeDecisionStatus?: CisFinanceDecisionStatusKey;
  createdAt: string;
  updatedAt: string;
}

export interface LeadWorkflowQueueSummary {
  openActionCount: number;
  urgentCount: number;
  stagnantCount: number;
  slaRiskCount: number;
}

export interface ListLeadWorkflowQueueResponse {
  items: LeadWorkflowQueueItem[];
  total: number;
  summary: LeadWorkflowQueueSummary;
}

export interface LeadHistoryFeedActorSummary {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

export interface LeadHistoryFeedEntry {
  id: string;
  leadId: string;
  companyName: string;
  contactDisplayName: string;
  stage: LeadStageKey;
  lifecycleStatus: LeadLifecycleStatusKey;
  title: string;
  summary: string;
  occurredAt: string;
  actor?: LeadHistoryFeedActorSummary;
}

export interface ListLeadHistoryFeedRequest {
  search?: string;
  limit?: number;
}

export interface ListLeadHistoryFeedResponse {
  items: LeadHistoryFeedEntry[];
  total: number;
}

export interface LeadRoutingPolicySummary {
  routingBasis: LeadRoutingBasisKey;
  strategicGrowthMax: number;
  nationalTmMin: number;
  initialContactSlaHours: number;
  initialContactUrgentWindowHours: number;
  initialContactManagerEscalationDelayHours: number;
  initialContactLeadershipEscalationDelayHours: number;
  discoverySchedulingSlaHours: number;
  discoverySchedulingManagerEscalationDelayHours: number;
  cisFollowUpBusinessDays: number;
  cisFollowUpProspectReminderDelayBusinessDays: number;
  cisFollowUpOwnerAlertDelayBusinessDays: number;
  stagnantStageDays: number;
  operationalAlertQuietHours: LeadOperationalAlertQuietHoursPolicy;
  notes?: string;
  updatedAt: string;
}

export interface UpdateLeadRoutingPolicyRequest {
  routingBasis?: LeadRoutingBasisKey;
  strategicGrowthMax?: number;
  initialContactSlaHours?: number;
  initialContactUrgentWindowHours?: number;
  initialContactManagerEscalationDelayHours?: number;
  initialContactLeadershipEscalationDelayHours?: number;
  discoverySchedulingSlaHours?: number;
  discoverySchedulingManagerEscalationDelayHours?: number;
  cisFollowUpBusinessDays?: number;
  cisFollowUpProspectReminderDelayBusinessDays?: number;
  cisFollowUpOwnerAlertDelayBusinessDays?: number;
  stagnantStageDays?: number;
  operationalAlertQuietHours?: UpdateLeadOperationalAlertQuietHoursRequest;
  notes?: string;
}

export interface UpdateLeadLifecycleRequest {
  status: LeadLifecycleStatusKey;
  reasonCode?: LeadLifecycleReasonCodeKey;
  reasonNote?: string;
}

export interface CreateLeadRequest {
  companyName: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactDisplayName?: string;
  email?: string;
  phone?: string;
  state?: string;
  countryCode?: string;
  businessSegmentCode?: string;
  leadSourceCode?: string;
  sourceDetail?: string;
  sourceSiteId?: string;
  sourceSiteName?: string;
  sourceBrandTag?: string;
  sourceCampaign?: string;
  leadRating?: string;
  serviceTechCount: number;
  installTechCount?: number;
  truckCount?: number;
  salesPersonCount?: number;
  potentialValueCents?: number;
  affinityGroupSelection?: GroupAxisSelectionKey;
  affinityGroupId?: string;
  affinityGroupCode?: string;
  affinityGroupName?: string;
  ownershipGroupSelection?: GroupAxisSelectionKey;
  ownershipGroupId?: string;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  privateLabelName?: string;
  leadOwnerName?: string;
  assignedTmName?: string;
  notes?: string;
  duplicateResolution?: {
    decision: 'create_new' | 'enrich_existing';
    reason: string;
    targetEntityId?: string;
  };
}

export interface PreviewLeadDuplicateCandidatesRequest extends CreateLeadRequest {}

export interface PreviewLeadDuplicateCandidatesResponse {
  hasPotentialDuplicate: boolean;
  candidates: LeadImportDuplicateCandidate[];
}

export const LEAD_OCR_CAPTURE_DOCUMENT_TYPES = [
  'business_card',
  'show_badge',
  'handwritten_note',
  'other',
] as const;

export type LeadOcrCaptureDocumentTypeKey = (typeof LEAD_OCR_CAPTURE_DOCUMENT_TYPES)[number];

export const LEAD_OCR_EXTRACTION_MODES = [
  'direct_text',
  'tesseract_ocr',
  'manual_text',
] as const;

export type LeadOcrExtractionModeKey = (typeof LEAD_OCR_EXTRACTION_MODES)[number];

export interface LeadOcrCapturedField<T = string | number> {
  value: T;
  confidence: number;
  source: 'ocr' | 'operator_default';
}

export interface LeadOcrCapturedLeadFields {
  companyName?: LeadOcrCapturedField;
  contactDisplayName?: LeadOcrCapturedField;
  email?: LeadOcrCapturedField;
  phone?: LeadOcrCapturedField;
  state?: LeadOcrCapturedField;
  website?: LeadOcrCapturedField;
  serviceTechCount?: LeadOcrCapturedField<number>;
}

export interface PreviewLeadOcrCaptureRequest {
  documentType?: LeadOcrCaptureDocumentTypeKey;
  fileName?: string;
  mimeType?: string;
  contentBase64?: string;
  rawExtractionText?: string;
  parserVersion?: string;
  serviceTechCountFallback?: number;
}

export interface PreviewLeadOcrCaptureResponse {
  parserVersion: string;
  documentType: LeadOcrCaptureDocumentTypeKey;
  extractionMode: LeadOcrExtractionModeKey;
  rawExtractionText: string;
  averageCharsPerPage?: number;
  pagesProcessed?: number;
  lowConfidence: boolean;
  reviewReasons: string[];
  fields: LeadOcrCapturedLeadFields;
  duplicatePreview: PreviewLeadDuplicateCandidatesResponse;
}

export interface CaptureWebsiteLeadRequest {
  siteId: string;
  leadType: WebsiteLeadTypeKey;
  siteName?: string;
  brandTag?: string;
  campaign?: string;
  formType?: WebsiteLeadFormTypeKey;
  fullName?: string;
  companyName?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactDisplayName?: string;
  email?: string;
  phone?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  customerStatus?: WebsiteLeadCustomerStatusKey;
  marketingConsent?: boolean;
  serviceTechCount?: number;
  installTechCount?: number;
  truckCount?: number;
  salesPersonCount?: number;
  potentialValueCents?: number;
  affinityGroupSelection?: GroupAxisSelectionKey;
  affinityGroupId?: string;
  affinityGroupCode?: string;
  inquiryTopic?: string;
  referralSource?: string;
  referralDetail?: string;
  message?: string;
  affinityGroupName?: string;
  ownershipGroupSelection?: GroupAxisSelectionKey;
  ownershipGroupId?: string;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  privateLabelName?: string;
  notes?: string;
}

export interface CaptureWebsiteLeadResponse extends LeadSummary {
  submissionId: string;
  outcome: WebsiteLeadSubmissionOutcomeKey;
  reviewStatus: WebsiteLeadSubmissionReviewStatusKey;
}

export interface ImportLeadRowInput {
  companyName?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactDisplayName?: string;
  email?: string;
  phone?: string;
  state?: string;
  countryCode?: string;
  sourceDetail?: string;
  leadRating?: string;
  serviceTechCount?: number;
  installTechCount?: number;
  truckCount?: number;
  salesPersonCount?: number;
  potentialValueCents?: number;
  affinityGroupSelection?: GroupAxisSelectionKey;
  affinityGroupCode?: string;
  affinityGroupName?: string;
  ownershipGroupSelection?: GroupAxisSelectionKey;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  privateLabelName?: string;
  notes?: string;
}

export interface ImportLeadsRequest {
  batchName?: string;
  businessSegmentCode?: string;
  leadSourceCode?: string;
  sourceSiteId?: string;
  sourceSiteName?: string;
  sourceBrandTag?: string;
  rows: ImportLeadRowInput[];
}

export interface ImportLeadsError {
  rowIndex: number;
  detail: string;
}

export interface ImportLeadsResponse {
  batchName?: string;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  items: LeadSummary[];
  errors: ImportLeadsError[];
}

export interface TransitionLeadStageRequest {
  toStage: LeadStageKey;
  note?: string;
  /** UX-L-011: BR-L-07 backward stage reason (required when toStage index < fromStage index) */
  backwardReason?: string;
}

export interface LogLeadInitialContactRequest {
  note?: string;
}

export interface ScheduleLeadDiscoveryRequest {
  note?: string;
  scheduledAt?: string;
}

export interface CompleteLeadDiscoveryRequest {
  painPoints?: string[];
  currentIaqSetup?: string;
  decisionMaker?: string;
  buyingIntent?: string;
  consignmentInterestStatus?: LeadConsignmentInterestStatusKey;
  consignmentEntryTiming?: LeadConsignmentEntryTimingKey;
  summary?: string;
  note?: string;
}

export interface SkipLeadDiscoveryRequest extends CompleteLeadDiscoveryRequest {
  fastTrackReason: string;
}

export interface UpdateLeadReadinessItemRequest {
  status?: OnboardingChecklistItemStatusKey;
  ownerRoleCode?: string;
  ownerUserId?: string;
  dueAt?: string;
  notes?: string;
}

export interface LeadReadinessBlockersResponse {
  leadId: string;
  blockers: string[];
}

export interface LeadContactSummary {
  id: string;
  leadId: string;
  role: LeadContactRoleKey;
  source?: LeadContactSourceKey;
  displayName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  isPrimary: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadContactRequest {
  role: LeadContactRoleKey;
  source?: LeadContactSourceKey;
  displayName: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateLeadContactRequest {
  role?: LeadContactRoleKey;
  source?: LeadContactSourceKey;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  notes?: string;
}

export interface LeadAddressSnapshot {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface LeadConversionPreparationRecord {
  leadId: string;
  status: LeadConversionPreparationStatusKey;
  targetAccountName?: string;
  legalCompanyName?: string;
  accountType?: string;
  financeAuthorityMode?: string;
  priceClassCode?: string;
  portalEligibilityStatus: PortalEligibilityStatusKey;
  shippingAddressSnapshot?: LeadAddressSnapshot;
  billingAddressSnapshot?: LeadAddressSnapshot;
  conversionReady: boolean;
  conversionBlockedReason?: string;
  notes?: string;
  validatedAt?: string;
  reviewedAt?: string;
  reviewedByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLeadConversionPreparationRequest {
  targetAccountName?: string;
  legalCompanyName?: string;
  accountType?: string;
  financeAuthorityMode?: string;
  priceClassCode?: string;
  portalEligibilityStatus?: PortalEligibilityStatusKey;
  shippingAddressSnapshot?: LeadAddressSnapshot;
  billingAddressSnapshot?: LeadAddressSnapshot;
  notes?: string;
}

export interface LeadConversionValidationResponse {
  preparation: LeadConversionPreparationRecord;
  blockers: string[];
  ready: boolean;
}

export interface ConvertLeadOnFirstOrderRequest {
  firstOrderConfirmedAt?: string;
  note?: string;
}

export interface ConvertLeadOnFirstOrderResponse {
  leadId: string;
  accountId: string;
  contactIds: string[];
  locationIds: string[];
  convertedAt: string;
}

export interface LeadImportTargetFieldOption {
  value: LeadImportTargetFieldKey;
  label: string;
}

export interface LeadImportFilePreviewRequest {
  fileName: string;
  fileContentBase64: string;
  sheetName?: string;
}

export interface LeadImportColumnPreview {
  sourceHeader: string;
  sampleValue?: string;
  suggestedTargetField?: LeadImportTargetFieldKey;
}

export interface LeadImportPreviewRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface LeadImportFilePreviewResponse {
  fileName: string;
  format: 'csv' | 'xlsx';
  sheetName: string;
  availableSheets: string[];
  totalRows: number;
  targetFieldOptions: LeadImportTargetFieldOption[];
  columns: LeadImportColumnPreview[];
  previewRows: LeadImportPreviewRow[];
}

export interface LeadImportDuplicateCandidate {
  entityType: 'lead' | 'account' | 'import_row';
  entityId: string;
  title: string;
  subtitle?: string;
  detail?: string;
}

export interface LeadImportReviewRow {
  rowNumber: number;
  status: LeadImportReviewRowStatusKey;
  detail: string;
  candidates: LeadImportDuplicateCandidate[];
}

export interface LeadImportColumnMapping {
  sourceHeader: string;
  targetField?: LeadImportTargetFieldKey;
}

export interface LeadImportRowDecision {
  rowNumber: number;
  duplicateDecision: LeadImportDuplicateDecisionKey;
  targetEntityId?: string;
}

export interface ImportLeadFileRequest extends Omit<ImportLeadsRequest, 'rows'> {
  fileName: string;
  fileContentBase64: string;
  sheetName?: string;
  mappings: LeadImportColumnMapping[];
  rowDecisions?: LeadImportRowDecision[];
}

export interface ReviewLeadImportRequest extends Omit<ImportLeadFileRequest, 'rowDecisions'> {}

export interface LeadImportRunDetail {
  runId: string;
  status: LeadImportRunStatusKey;
  fileName: string;
  sheetName: string;
  batchName?: string;
  totalRows: number;
  mappedRows: number;
  readyRowCount: number;
  attentionRowCount: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  committedAt?: string;
  rows: LeadImportReviewRow[];
}

export interface ReviewLeadImportResponse extends LeadImportRunDetail {}

export interface CommitLeadImportRunRequest {
  rowDecisions?: LeadImportRowDecision[];
}

export interface LeadImportFileError {
  rowNumber: number;
  detail: string;
}

export interface LeadImportSkippedRow {
  rowNumber: number;
  detail: string;
  decision?: LeadImportDuplicateDecisionKey;
}

export interface ImportLeadFileResponse {
  runId: string;
  status: LeadImportRunStatusKey;
  fileName: string;
  sheetName: string;
  batchName?: string;
  totalRows: number;
  mappedRows: number;
  readyRowCount: number;
  attentionRowCount: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  committedAt?: string;
  items: LeadSummary[];
  skippedRows: LeadImportSkippedRow[];
  errors: LeadImportFileError[];
}

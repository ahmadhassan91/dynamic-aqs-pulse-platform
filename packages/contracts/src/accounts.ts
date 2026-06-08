import type { CisPaymentVaultProviderKey } from './cis.js';
import type { ConsignmentAccountReadModel } from './consignment.js';
import type { GroupAxisSelectionKey, GroupClassificationKey } from './leads.js';
import type { TerritoryAssignmentMethodKey } from './territories.js';

export const ACCOUNT_LIFECYCLE_STATUSES = [
  'active',
  'at_risk',
  'inactive',
  'churned',
] as const;

export type AccountLifecycleStatusKey = (typeof ACCOUNT_LIFECYCLE_STATUSES)[number];

export interface AccountSummary {
  id: string;
  accountNumber?: string;
  sourceLeadId?: string;
  displayName: string;
  legalName?: string;
  accountType?: string;
  affinityGroupSelection: GroupAxisSelectionKey;
  affinityGroupId?: string;
  affinityGroupCode?: string;
  affinityGroupName?: string;
  ownershipGroupSelection: GroupAxisSelectionKey;
  ownershipGroupId?: string;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  brandLabelId?: string;
  brandLabelName?: string;
  groupClassification?: GroupClassificationKey;
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
  lifecycleStatus: AccountLifecycleStatusKey;
  lifecycleStatusChangedAt?: string;
  lifecycleReasonNote?: string;
  consignment?: ConsignmentAccountReadModel;
  lastOrderAt?: string;
  lastEngagementAt?: string;
  isActive: boolean;
  contactCount: number;
  locationCount: number;
  createdAt: string;
  updatedAt: string;
}

export const ACCOUNT_LOCATION_TYPES = [
  'billing',
  'shipping',
  'both',
  'other',
] as const;

export type AccountLocationTypeKey = (typeof ACCOUNT_LOCATION_TYPES)[number];

export interface AccountLocationSummary {
  id: string;
  locationCode?: string;
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  isPrimary: boolean;
  isActive: boolean;
  /** UX-A-012: billing vs shipping intent (UI label convention — DB column parked pending Q-A-02 schema decision) */
  locationType?: AccountLocationTypeKey;
}

export interface ContactSummary {
  id: string;
  accountId: string;
  locationId?: string;
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  roleCode?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail extends AccountSummary {
  locations: AccountLocationSummary[];
  contacts: ContactSummary[];
  readiness: AccountReadinessSummary;
  activityReview: AccountActivityReviewSummary;
}

export type AccountReadinessLevel = 'ready' | 'needs_attention' | 'parked';

export interface AccountReadinessCheck {
  key: string;
  label: string;
  status: AccountReadinessLevel;
  message: string;
}

export interface AccountReadinessSummary {
  score: number;
  status: AccountReadinessLevel;
  checks: AccountReadinessCheck[];
}

export interface AccountActivityReviewEvent {
  id: string;
  occurredAt: string;
  action: string;
  entityType: string;
  label: string;
  detail: string;
  source: 'pulse_crm' | 'source_lead' | 'dealer_portal' | 'payment_boundary' | 'parked_dependency' | 'field_activity';
  actorName?: string;
}

export interface AccountDocumentBoundary {
  key: string;
  label: string;
  status: 'available' | 'needs_attention' | 'parked';
  detail: string;
  href?: string;
}

export interface AccountActivityReviewSummary {
  recentEvents: AccountActivityReviewEvent[];
  documentBoundaries: AccountDocumentBoundary[];
  parkedDependencies: string[];
}

export interface AccountPaymentMethodSummary {
  id: string;
  accountId: string;
  provider: CisPaymentVaultProviderKey;
  source: 'manual' | 'cis_promoted';
  sourceCisVaultReferenceId?: string;
  externalPaymentMethodRef?: string;
  last4?: string;
  brand?: string;
  billingZip?: string;
  authorizationCapturedAt?: string;
  isDefault: boolean;
  isActive: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAccountPaymentMethodsResponse {
  items: AccountPaymentMethodSummary[];
}

export interface ListAccountsRequest {
  search?: string;
  limit?: number;
  /** UX-A-010: offset-based pagination cursor */
  offset?: number;
  includeInactive?: boolean;
  lifecycleStatus?: AccountLifecycleStatusKey;
}

export interface ListAccountsResponse {
  items: AccountSummary[];
  total: number;
}

export interface CreateAccountRequest {
  displayName: string;
  legalName?: string;
  accountType?: string;
  affinityGroupSelection?: GroupAxisSelectionKey;
  affinityGroupId?: string;
  affinityGroupCode?: string;
  affinityGroupName?: string;
  ownershipGroupSelection?: GroupAxisSelectionKey;
  ownershipGroupId?: string;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  isActive?: boolean;
}

export interface UpdateAccountRequest {
  displayName?: string;
  legalName?: string | null;
  accountType?: string | null;
  affinityGroupSelection?: GroupAxisSelectionKey;
  affinityGroupId?: string | null;
  affinityGroupCode?: string;
  affinityGroupName?: string;
  ownershipGroupSelection?: GroupAxisSelectionKey;
  ownershipGroupId?: string | null;
  ownershipGroupCode?: string;
  ownershipGroupName?: string;
  brandLabelId?: string | null;
  isActive?: boolean;
}

export interface CreateAccountPaymentMethodRequest {
  provider?: CisPaymentVaultProviderKey;
  sourceCisVaultReferenceId?: string;
  vaultToken?: string;
  vaultCustomerRef?: string;
  externalPaymentMethodRef?: string;
  last4?: string;
  brand?: string;
  billingZip?: string;
  authorizationCapturedAt?: string;
  isDefault?: boolean;
  isActive?: boolean;
  status?: string;
}

export interface UpdateAccountPaymentMethodRequest {
  billingZip?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  status?: string;
}

export interface UpdateAccountLifecycleRequest {
  lifecycleStatus: AccountLifecycleStatusKey;
  lifecycleReasonNote?: string | null;
}

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  title?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  roleCode?: string;
  locationId?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  roleCode?: string | null;
  locationId?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
}

export interface CreateAccountLocationRequest {
  locationCode?: string;
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  /** UX-A-012: billing vs shipping intent label */
  locationType?: AccountLocationTypeKey;
}

export interface UpdateAccountLocationRequest {
  locationCode?: string | null;
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
  /** UX-A-012: billing vs shipping intent label */
  locationType?: AccountLocationTypeKey | null;
}

export const DEALER_PORTAL_PROVISIONING_STATUSES = [
  'not_started',
  'ready_to_provision',
  'active',
  'suspended',
  'deactivated',
] as const;

export type DealerPortalProvisioningStatusKey =
  (typeof DEALER_PORTAL_PROVISIONING_STATUSES)[number];

export const DEALER_PORTAL_USER_STATUSES = [
  'active',
  'suspended',
  'deactivated',
] as const;

export type DealerPortalUserStatusKey =
  (typeof DEALER_PORTAL_USER_STATUSES)[number];

export const DEALER_PORTAL_ACCESS_ROLES = [
  'admin',
  'purchasing',
  'accounting',
  'viewer',
] as const;

export type DealerPortalAccessRoleKey =
  (typeof DEALER_PORTAL_ACCESS_ROLES)[number];

export interface DealerPortalUserSummary {
  id: string;
  userId: string;
  accountId: string;
  contactId?: string;
  email: string;
  displayName: string;
  title?: string;
  status: DealerPortalUserStatusKey;
  accessRole: DealerPortalAccessRoleKey;
  isPrimaryOwner: boolean;
  isActive: boolean;
  inviteIssuedAt?: string;
  inviteExpiresAt?: string;
  inviteAcceptedAt?: string;
  lastLoginAt?: string;
  activatedAt?: string;
  suspendedAt?: string;
  deactivatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealerPortalAccountSummary {
  accountId: string;
  accountDisplayName: string;
  accountNumber?: string;
  status: DealerPortalProvisioningStatusKey;
  notes?: string;
  sourceLeadId?: string;
  portalEligibilityStatus?: 'unassessed' | 'blocked' | 'ready' | 'provisioned';
  territoryName?: string;
  regionName?: string;
  shippingCenterName?: string;
  assignedTmName?: string;
  assignedTmEmail?: string;
  assignedRdName?: string;
  assignedRdEmail?: string;
  activePortalUsers: number;
  totalPortalUsers: number;
  createdAt: string;
  updatedAt: string;
  provisionedAt?: string;
}

export interface DealerPortalAccountDetail extends DealerPortalAccountSummary {
  users: DealerPortalUserSummary[];
}

export interface ProvisionDealerPortalUserRequest {
  contactId?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  password?: string;
  accessRole?: DealerPortalAccessRoleKey;
  isPrimaryOwner?: boolean;
  notes?: string;
}

export interface ProvisionDealerPortalUserResponse {
  portalAccount: DealerPortalAccountDetail;
  user: DealerPortalUserSummary;
  temporaryPassword: string;
  inviteToken?: string;
  invitePath?: string;
  createdContactId?: string;
}

export interface UpdateDealerPortalUserStatusRequest {
  status: DealerPortalUserStatusKey;
  notes?: string;
}

export interface UpdateDealerPortalUserStatusResponse {
  portalAccount: DealerPortalAccountDetail;
  user: DealerPortalUserSummary;
}

export interface ResetDealerPortalUserPasswordRequest {
  password?: string;
}

export interface ResetDealerPortalUserPasswordResponse {
  userId: string;
  email: string;
  temporaryPassword: string;
  resetAt: string;
}

export interface CreateDealerPortalInviteResponse {
  user: DealerPortalUserSummary;
  inviteToken: string;
  invitePath: string;
  expiresAt: string;
}

export interface AcceptDealerPortalInviteRequest {
  token: string;
  password: string;
}

export interface AcceptDealerPortalInviteResponse {
  email: string;
  acceptedAt: string;
}

export interface DealerPortalDashboardResponse {
  portalAccount: DealerPortalAccountSummary;
  currentUser: DealerPortalUserSummary;
  companyUsers: DealerPortalUserSummary[];
  contacts: Array<{
    id: string;
    displayName: string;
    title?: string;
    email?: string;
    phone?: string;
    isPrimary: boolean;
  }>;
  locations: Array<{
    id: string;
    name: string;
    city?: string;
    state?: string;
    countryCode?: string;
    isPrimary: boolean;
  }>;
}

export interface DealerPortalCatalogAssetSummary {
  id: string;
  title: string;
  role: string;
  kind: string;
  visibility: 'dealer_portal' | 'public';
  stableSlug: string;
  fileName?: string;
  downloadUrl?: string;
  brandScope?: string;
  regionScope?: string;
}

export interface DealerPortalCatalogProductSummary {
  productId: string;
  presentationId: string;
  sku: string;
  displayName: string;
  shortDescription?: string;
  longDescription?: string;
  specSummary?: string;
  categoryName?: string;
  familyName?: string;
  brandLabel?: string;
  regionScope?: string;
  isFavorite: boolean;
  favoriteCount: number;
  assets: DealerPortalCatalogAssetSummary[];
}

export interface DealerPortalCatalogResponse {
  catalogView?: {
    id: string;
    name: string;
    kind: string;
    resolverLabel?: string;
    regionScope?: string;
    brandLabel?: string;
    snapshotId?: string;
    snapshotVersion?: number;
    snapshotPublishedAt?: string;
  };
  products: DealerPortalCatalogProductSummary[];
  userFavorites: {
    count: number;
    presentationIds: string[];
  };
  warnings: string[];
}

export interface DealerPortalCatalogDiagnostics {
  catalogView?: {
    id: string;
    name: string;
    kind: string;
    resolverLabel?: string;
    regionScope?: string;
    brandLabel?: string;
    resolutionSource: 'rule' | 'default';
    ruleId?: string;
    ruleName?: string;
  };
  selectedPreviewRole: DealerPortalAccessRoleKey;
  visibleProductCount: number;
  visibleFileCount: number;
  warnings: string[];
  productReasons: Array<{
    productId: string;
    presentationId: string;
    sku: string;
    displayName: string;
    dealerSafeFileCount: number;
    reasons: string[];
    warnings: string[];
  }>;
  blockedProductSummary: {
    scanned: boolean;
    reason: string;
  };
}

export interface DealerPortalInternalPreviewResponse {
  previewRole: DealerPortalAccessRoleKey;
  preview: {
    mode: 'internal_preview';
    readOnly: true;
    accountId: string;
    selectedRole: DealerPortalAccessRoleKey;
    actorUserId: string;
    generatedAt: string;
    restrictions: string[];
  };
  portalAccount: DealerPortalAccountSummary;
  dashboard: Omit<DealerPortalDashboardResponse, 'portalAccount' | 'currentUser'>;
  catalog: DealerPortalCatalogResponse;
  visibleProductCount: number;
  visibleFileCount: number;
  generatedAt: string;
  diagnostics: DealerPortalCatalogDiagnostics;
}

export interface DealerPortalFavoriteProductResponse {
  ok: true;
  presentationId: string;
  isFavorite: boolean;
  favoriteCount: number;
}

export interface DealerPortalAssetOpenResponse {
  ok: true;
  assetId: string;
  presentationId: string;
  targetUrl?: string;
  downloadUrl?: string;
}

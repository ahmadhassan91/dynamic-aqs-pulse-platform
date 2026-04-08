export const AUTH_ROLES = [
  'EXECUTIVE',
  'SUPER_ADMIN',
  'SALES_BD_REP',
  'SALES_BD_LEADERSHIP',
  'FINANCE',
  'ADMIN_CSR_OPS',
  'TERRITORY_MANAGER',
  'REGIONAL_DIRECTOR',
  'TRAINING_OPS',
  'DEALER_PORTAL_USER',
] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export const BUSINESS_SEGMENTS = [
  'residential',
  'commercial',
  'distributor',
  'mixed',
  'unknown',
] as const;

export type BusinessSegmentKey = (typeof BUSINESS_SEGMENTS)[number];

export const WORKSPACE_MODULES = [
  'home',
  'calendar',
  'leads',
  'cis',
  'customers',
  'territories',
  'territory_map',
  'training',
  'product_management',
  'dealer_portal',
  'consignment',
  'digital_assets',
  'mobile',
  'communication',
  'reports',
  'admin',
  'notifications',
  'settings',
  'integrations',
] as const;

export type WorkspaceModuleKey = (typeof WORKSPACE_MODULES)[number];

export const WORKSPACE_ACTIONS = [
  'customer.view',
  'customer.create',
  'customer.edit',
  'customer.activity_log',
  'customer.financials_view',
  'contact.view',
  'contact.create',
  'lead.intake_manage',
  'lead.finance_queue_view',
  'lead.finance_decide',
  'lead.portal_setup',
  'lead.consignment_approve',
  'territory.admin',
  'territory.reassign',
  'training.catalog_manage',
  'training.schedule',
  'consignment.manage',
  'consignment.sync',
  'reports.builder',
  'reports.executive',
] as const;

export type WorkspaceActionKey = (typeof WORKSPACE_ACTIONS)[number];

export interface AuthIdentity {
  userId: string;
  role: AuthRole;
  displayName?: string;
  email?: string;
  actorType: 'internal' | 'dealer' | 'service';
  businessSegment?: BusinessSegmentKey;
}

export interface AuthSession {
  sessionId: string;
  subjectId: string;
  role: AuthRole;
  issuedAt: string;
  expiresAt: string;
  refreshExpiresAt?: string;
  tokenVersion: number;
  scopes: WorkspaceModuleKey[];
  businessSegment?: BusinessSegmentKey;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RefreshSessionRequest {
  refreshToken: string;
}

export interface AuthClaims {
  sub: string;
  sid: string;
  role: AuthRole;
  aud: 'pulse';
  iss?: string;
  iat?: number;
  exp?: number;
  seg?: BusinessSegmentKey;
}

export interface PermissionCheck {
  role: AuthRole;
  module: WorkspaceModuleKey;
  action?: WorkspaceActionKey;
}

export const ROLE_DEFAULT_MODULE_ACCESS: Record<AuthRole, readonly WorkspaceModuleKey[]> = {
  EXECUTIVE: WORKSPACE_MODULES,
  SUPER_ADMIN: WORKSPACE_MODULES,
  SALES_BD_REP: ['home', 'calendar', 'leads', 'customers', 'digital_assets', 'communication', 'reports', 'notifications'],
  SALES_BD_LEADERSHIP: ['home', 'calendar', 'leads', 'customers', 'digital_assets', 'communication', 'reports', 'notifications', 'admin'],
  FINANCE: ['home', 'calendar', 'leads', 'customers', 'reports', 'notifications'],
  ADMIN_CSR_OPS: ['home', 'calendar', 'leads', 'cis', 'customers', 'dealer_portal', 'consignment', 'digital_assets', 'reports', 'admin', 'notifications'],
  TERRITORY_MANAGER: ['home', 'calendar', 'customers', 'territories', 'territory_map', 'training', 'consignment', 'mobile', 'communication', 'reports', 'notifications'],
  REGIONAL_DIRECTOR: ['home', 'calendar', 'customers', 'territories', 'territory_map', 'training', 'consignment', 'mobile', 'communication', 'reports', 'notifications', 'settings'],
  TRAINING_OPS: ['home', 'calendar', 'training', 'reports', 'notifications', 'settings'],
  DEALER_PORTAL_USER: ['home', 'calendar', 'dealer_portal', 'notifications'],
};

export const ROLE_DEFAULT_ACTION_ACCESS: Record<AuthRole, readonly WorkspaceActionKey[]> = {
  EXECUTIVE: WORKSPACE_ACTIONS,
  SUPER_ADMIN: WORKSPACE_ACTIONS,
  SALES_BD_REP: ['customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'contact.view', 'contact.create', 'lead.intake_manage', 'reports.builder'],
  SALES_BD_LEADERSHIP: ['customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'contact.view', 'contact.create', 'lead.intake_manage', 'lead.finance_queue_view', 'reports.builder'],
  FINANCE: ['customer.view', 'customer.financials_view', 'contact.view', 'lead.finance_queue_view', 'lead.finance_decide', 'reports.builder'],
  ADMIN_CSR_OPS: ['customer.view', 'customer.create', 'customer.edit', 'contact.view', 'contact.create', 'lead.intake_manage', 'lead.portal_setup', 'lead.consignment_approve', 'consignment.manage', 'consignment.sync', 'reports.builder'],
  TERRITORY_MANAGER: ['customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'contact.view', 'contact.create', 'lead.consignment_approve', 'territory.reassign', 'training.schedule', 'reports.builder'],
  REGIONAL_DIRECTOR: ['customer.view', 'contact.view', 'territory.admin', 'territory.reassign', 'training.schedule', 'reports.builder'],
  TRAINING_OPS: ['training.catalog_manage', 'training.schedule', 'reports.builder'],
  DEALER_PORTAL_USER: [],
};

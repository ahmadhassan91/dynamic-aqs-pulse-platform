import type {
  AuthRole,
  WorkspaceActionKey,
  WorkspaceModuleKey,
} from './auth.js';

export const ADMIN_USER_STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING'] as const;

export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];

export type AdminProviderKey = 'LOCAL' | 'MICROSOFT_ENTRA' | 'DEALER' | 'SERVICE' | 'UNKNOWN';

export interface AdminUserSummary {
  id: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  actorType: 'internal' | 'dealer' | 'service';
  provider: AdminProviderKey;
  status: AdminUserStatus;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
  activeSessionCount: number;
}

export interface ListAdminUsersRequest {
  search?: string;
  role?: AuthRole;
  status?: AdminUserStatus;
  page?: number;
  limit?: number;
}

export interface ListAdminUsersResponse {
  users: AdminUserSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateAdminUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  isActive?: boolean;
  password?: string;
}

export interface CreateAdminUserResponse {
  user: AdminUserSummary;
  temporaryPassword: string;
}

export interface UpdateAdminUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: AuthRole;
  isActive?: boolean;
}

export interface UpdateAdminUserResponse {
  user: AdminUserSummary;
}

export interface ResetAdminUserPasswordRequest {
  password?: string;
}

export interface ResetAdminUserPasswordResponse {
  userId: string;
  email: string;
  temporaryPassword: string;
  resetAt: string;
}

export interface ImportAdminUsersRequest {
  rows: CreateAdminUserRequest[];
}

export interface ImportAdminUsersResponse {
  totalProcessed: number;
  successful: number;
  failed: number;
  users: AdminUserSummary[];
  credentials: Array<{
    email: string;
    temporaryPassword: string;
  }>;
  errors: Array<{
    row: number;
    email?: string;
    message: string;
  }>;
}

export interface AdminRoleAccessSummary {
  role: AuthRole;
  displayName: string;
  summary: string;
  bestFor: string;
  scopeSummary: string;
  modules: WorkspaceModuleKey[];
  actions: WorkspaceActionKey[];
  workspaceHighlights: WorkspaceModuleKey[];
  actionHighlights: WorkspaceActionKey[];
}

export interface AdminRoleAccessCatalogResponse {
  roles: AdminRoleAccessSummary[];
}

export interface AdminActivityEntry {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId?: string;
  actor?: {
    userId: string;
    displayName: string;
    email: string;
    role: AuthRole;
  };
  summary: string;
  metadata?: Record<string, unknown>;
}

export interface ListAdminActivityRequest {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  limit?: number;
}

export interface ListAdminActivityResponse {
  entries: AdminActivityEntry[];
}

export interface AdminOverviewResponse {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  activeSessions: number;
  recentActivity: AdminActivityEntry[];
}

export interface AdminSystemHealthResponse {
  checkedAt: string;
  application: {
    service: string;
    version: string;
    environment: string;
  };
  users: {
    total: number;
    active: number;
    pending: number;
  };
  sessions: {
    active: number;
    revoked: number;
  };
  database: {
    ok: boolean;
    checkedAt: string;
    error?: string;
  };
  queue: {
    ok: boolean;
    checkedAt?: string;
    error?: string;
  };
  workers: {
    startedAt?: string;
    registeredWorkers: number;
  };
  acumatica: {
    ok: boolean;
    checkedAt?: string;
    status?: string;
    error?: string;
  };
}

export interface AdminIntegrationStatus {
  key: string;
  label: string;
  status: 'connected' | 'warning' | 'error';
  health: number;
  lastCheckedAt: string;
  detail: string;
}

export interface AdminIntegrationStatusResponse {
  integrations: AdminIntegrationStatus[];
}

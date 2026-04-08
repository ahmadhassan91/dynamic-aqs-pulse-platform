import {
  AUTH_ROLES,
  ROLE_DEFAULT_ACTION_ACCESS,
  ROLE_DEFAULT_MODULE_ACCESS,
  type AuthRole,
  type PermissionCheck,
  type WorkspaceActionKey,
  type WorkspaceModuleKey,
} from '@pulse/contracts';

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

const ROLE_ALIASES: Record<string, AuthRole> = {
  executive: 'EXECUTIVE',
  super_admin: 'SUPER_ADMIN',
  sales_bd_rep: 'SALES_BD_REP',
  sales_bd_leadership: 'SALES_BD_LEADERSHIP',
  finance: 'FINANCE',
  admin_csr_ops: 'ADMIN_CSR_OPS',
  territory_manager: 'TERRITORY_MANAGER',
  regional_director: 'REGIONAL_DIRECTOR',
  training_ops: 'TRAINING_OPS',
  dealer_portal_user: 'DEALER_PORTAL_USER',
};

function normalizeAlias(input: string) {
  return input.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function normalizeRole(role: string | null | undefined): AuthRole {
  const rawRole = role?.trim();
  if (!rawRole) {
    throw new AuthorizationError('Role is required');
  }

  const normalized = normalizeAlias(rawRole);
  const aliasedRole = ROLE_ALIASES[normalized];
  if (aliasedRole) {
    return aliasedRole;
  }

  if (AUTH_ROLES.includes(rawRole as AuthRole)) {
    return rawRole as AuthRole;
  }

  throw new AuthorizationError(`Unknown role: ${rawRole}`);
}

export function hasRole(userRole: AuthRole, requiredRole: AuthRole): boolean {
  if (userRole === requiredRole) {
    return true;
  }

  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  return requiredRole === 'EXECUTIVE' && userRole === 'EXECUTIVE';
}

export function hasAnyRole(userRole: AuthRole, requiredRoles: readonly AuthRole[]): boolean {
  return requiredRoles.some((requiredRole) => hasRole(userRole, requiredRole));
}

export function canAccessModule(role: AuthRole, module: WorkspaceModuleKey): boolean {
  return ROLE_DEFAULT_MODULE_ACCESS[role].includes(module);
}

export function canPerformAction(role: AuthRole, action: WorkspaceActionKey): boolean {
  return ROLE_DEFAULT_ACTION_ACCESS[role].includes(action);
}

export function assertModuleAccess(role: AuthRole, module: WorkspaceModuleKey, message?: string): void {
  if (!canAccessModule(role, module)) {
    throw new AuthorizationError(message ?? `Role ${role} cannot access module ${module}`);
  }
}

export function assertActionAccess(role: AuthRole, action: WorkspaceActionKey, message?: string): void {
  if (!canPerformAction(role, action)) {
    throw new AuthorizationError(message ?? `Role ${role} cannot perform action ${action}`);
  }
}

export function evaluatePermission(check: PermissionCheck): boolean {
  const moduleAllowed = canAccessModule(check.role, check.module);
  if (!moduleAllowed) {
    return false;
  }

  if (!check.action) {
    return true;
  }

  return canPerformAction(check.role, check.action);
}

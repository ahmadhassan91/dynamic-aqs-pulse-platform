import type { AuthRole, WorkspaceActionKey, WorkspaceModuleKey } from '@pulse/contracts';
import {
  AUTH_ROLE_CATALOG,
  ROLE_DEFAULT_ACTION_ACCESS_CATALOG,
  ROLE_DEFAULT_MODULE_ACCESS_CATALOG,
} from '@/lib/auth-catalog';

export type WorkspaceLandingTarget = {
  href: string;
  label: string;
  module?: WorkspaceModuleKey;
  action?: WorkspaceActionKey;
};

const WORKSPACE_LANDING_TARGETS: readonly WorkspaceLandingTarget[] = [
  { href: '/leads', label: 'Lead Work Queue', module: 'leads' },
  { href: '/leads/import', label: 'Bulk Intake', module: 'leads', action: 'lead.intake_manage' },
  { href: '/leads/forms', label: 'Website Forms', module: 'leads' },
  { href: '/leads/activities', label: 'Workflow Queue', module: 'leads' },
  { href: '/leads/finance', label: 'Finance Queue', module: 'leads', action: 'lead.finance_queue_view' },
  { href: '/customers', label: 'Account Management', module: 'customers' },
  { href: '/consignment', label: 'Consignment Workspace', module: 'consignment' },
  { href: '/training', label: 'Training Management', module: 'training' },
  { href: '/admin', label: 'Administration', module: 'admin' },
  { href: '/admin/users', label: 'User Management', module: 'admin', action: 'admin.user_view' },
  { href: '/admin/roles', label: 'Roles & Permissions', module: 'admin', action: 'admin.role_view' },
  { href: '/admin/activity', label: 'Activity Monitor', module: 'admin', action: 'admin.audit_view' },
  { href: '/dealer/dashboard', label: 'Dealer Dashboard', module: 'dealer_portal' },
] as const;

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

export function normalizeRoleInput(role: string | null | undefined): AuthRole {
  const rawRole = role?.trim();
  if (!rawRole) {
    throw new Error('Role is required');
  }

  const aliasedRole = ROLE_ALIASES[normalizeAlias(rawRole)];
  if (aliasedRole) {
    return aliasedRole;
  }

  if (AUTH_ROLE_CATALOG.includes(rawRole as AuthRole)) {
    return rawRole as AuthRole;
  }

  throw new Error(`Unknown role: ${rawRole}`);
}

function resolveSafeRole(role: AuthRole | string | null | undefined): AuthRole | null {
  if (!role) {
    return null;
  }

  try {
    return normalizeRoleInput(role);
  } catch {
    return null;
  }
}

export function canAccessModule(role: AuthRole | string | null | undefined, module: WorkspaceModuleKey) {
  const normalizedRole = resolveSafeRole(role);
  if (!normalizedRole) {
    return false;
  }

  const moduleCatalog = ROLE_DEFAULT_MODULE_ACCESS_CATALOG ?? {};
  return (moduleCatalog[normalizedRole] ?? []).includes(module);
}

export function canPerformAction(role: AuthRole | string | null | undefined, action: WorkspaceActionKey) {
  const normalizedRole = resolveSafeRole(role);
  if (!normalizedRole) {
    return false;
  }

  const actionCatalog = ROLE_DEFAULT_ACTION_ACCESS_CATALOG ?? {};
  return (actionCatalog[normalizedRole] ?? []).includes(action);
}

export function getAccessibleLandingTargets(role: AuthRole | string | null | undefined) {
  const normalizedRole = resolveSafeRole(role);
  if (!normalizedRole) {
    return [];
  }

  return WORKSPACE_LANDING_TARGETS.filter((target) => {
    if (target.module && !canAccessModule(normalizedRole, target.module)) {
      return false;
    }

    if (target.action && !canPerformAction(normalizedRole, target.action)) {
      return false;
    }

    return true;
  });
}

export function getDefaultWorkspacePath(role: AuthRole | string | null | undefined) {
  const firstTarget = getAccessibleLandingTargets(role)[0];
  return firstTarget?.href ?? '/auth/login';
}

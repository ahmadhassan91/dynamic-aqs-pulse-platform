import type { AuthRole, WorkspaceActionKey, WorkspaceModuleKey } from '@pulse/contracts';

const AUTH_ROLES = [
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
] as const satisfies readonly AuthRole[];

const ROLE_DEFAULT_MODULE_ACCESS: Record<AuthRole, readonly WorkspaceModuleKey[]> = {
  EXECUTIVE: ['home', 'calendar', 'leads', 'cis', 'customers', 'territories', 'territory_map', 'training', 'product_management', 'dealer_portal', 'consignment', 'digital_assets', 'mobile', 'communication', 'reports', 'admin', 'notifications', 'settings', 'integrations'],
  SUPER_ADMIN: ['home', 'calendar', 'leads', 'cis', 'customers', 'territories', 'territory_map', 'training', 'product_management', 'dealer_portal', 'consignment', 'digital_assets', 'mobile', 'communication', 'reports', 'admin', 'notifications', 'settings', 'integrations'],
  SALES_BD_REP: ['home', 'calendar', 'leads', 'cis', 'customers', 'digital_assets', 'communication', 'reports', 'notifications'],
  SALES_BD_LEADERSHIP: ['home', 'calendar', 'leads', 'cis', 'customers', 'digital_assets', 'communication', 'reports', 'notifications', 'admin'],
  FINANCE: ['home', 'calendar', 'leads', 'cis', 'customers', 'reports', 'notifications'],
  ADMIN_CSR_OPS: ['home', 'calendar', 'leads', 'cis', 'customers', 'dealer_portal', 'consignment', 'digital_assets', 'reports', 'admin', 'notifications'],
  TERRITORY_MANAGER: ['home', 'calendar', 'leads', 'customers', 'territories', 'territory_map', 'training', 'consignment', 'mobile', 'communication', 'reports', 'notifications'],
  REGIONAL_DIRECTOR: ['home', 'calendar', 'leads', 'customers', 'territories', 'territory_map', 'training', 'consignment', 'mobile', 'communication', 'reports', 'notifications', 'settings'],
  TRAINING_OPS: ['home', 'calendar', 'training', 'reports', 'notifications', 'settings'],
  DEALER_PORTAL_USER: ['home', 'calendar', 'dealer_portal', 'notifications'],
};

const ROLE_DEFAULT_ACTION_ACCESS: Record<AuthRole, readonly WorkspaceActionKey[]> = {
  EXECUTIVE: ['reference.view', 'reference.manage', 'admin.user_view', 'admin.user_manage', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'admin.integration_view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'customer.financials_view', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.finance_queue_view', 'lead.finance_decide', 'lead.portal_setup', 'lead.consignment_approve', 'territory.admin', 'territory.reassign', 'training.catalog_manage', 'training.schedule', 'consignment.manage', 'consignment.sync', 'reports.builder', 'reports.executive'],
  SUPER_ADMIN: ['reference.view', 'reference.manage', 'admin.user_view', 'admin.user_manage', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'admin.integration_view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'customer.financials_view', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.finance_queue_view', 'lead.finance_decide', 'lead.portal_setup', 'lead.consignment_approve', 'territory.admin', 'territory.reassign', 'training.catalog_manage', 'training.schedule', 'consignment.manage', 'consignment.sync', 'reports.builder', 'reports.executive'],
  SALES_BD_REP: ['reference.view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'reports.builder'],
  SALES_BD_LEADERSHIP: ['reference.view', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.finance_queue_view', 'reports.builder'],
  FINANCE: ['reference.view', 'lead.view', 'customer.view', 'customer.financials_view', 'contact.view', 'location.view', 'lead.finance_queue_view', 'lead.finance_decide', 'reports.builder'],
  ADMIN_CSR_OPS: ['reference.view', 'reference.manage', 'admin.user_view', 'admin.user_manage', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'admin.integration_view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.portal_setup', 'lead.consignment_approve', 'consignment.manage', 'consignment.sync', 'reports.builder'],
  TERRITORY_MANAGER: ['reference.view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.consignment_approve', 'territory.reassign', 'training.schedule', 'reports.builder'],
  REGIONAL_DIRECTOR: ['reference.view', 'lead.view', 'customer.view', 'contact.view', 'location.view', 'territory.admin', 'territory.reassign', 'training.schedule', 'reports.builder'],
  TRAINING_OPS: ['reference.view', 'training.catalog_manage', 'training.schedule', 'reports.builder'],
  DEALER_PORTAL_USER: [],
};

export type WorkspaceLandingTarget = {
  href: string;
  label: string;
  module?: WorkspaceModuleKey;
  action?: WorkspaceActionKey;
};

const WORKSPACE_LANDING_TARGETS: readonly WorkspaceLandingTarget[] = [
  { href: '/leads', label: 'Lead Pipeline', module: 'leads' },
  { href: '/leads/import', label: 'Bulk Intake', module: 'leads', action: 'lead.intake_manage' },
  { href: '/leads/forms', label: 'Website Forms', module: 'leads' },
  { href: '/leads/activities', label: 'Workflow Queue', module: 'leads' },
  { href: '/leads/finance', label: 'Finance Queue', module: 'leads', action: 'lead.finance_queue_view' },
  { href: '/customers', label: 'Account Management', module: 'customers' },
  { href: '/training', label: 'Training Management', module: 'training' },
  { href: '/admin', label: 'Administration', module: 'admin' },
  { href: '/admin/users', label: 'User Management', module: 'admin', action: 'admin.user_view' },
  { href: '/admin/roles', label: 'Roles & Permissions', module: 'admin', action: 'admin.role_view' },
  { href: '/admin/activity', label: 'Activity Monitor', module: 'admin', action: 'admin.audit_view' },
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

  if (AUTH_ROLES.includes(rawRole as AuthRole)) {
    return rawRole as AuthRole;
  }

  throw new Error(`Unknown role: ${rawRole}`);
}

export function canAccessModule(role: AuthRole, module: WorkspaceModuleKey) {
  return (ROLE_DEFAULT_MODULE_ACCESS[role] ?? []).includes(module);
}

export function canPerformAction(role: AuthRole, action: WorkspaceActionKey) {
  return (ROLE_DEFAULT_ACTION_ACCESS[role] ?? []).includes(action);
}

export function getAccessibleLandingTargets(role: AuthRole | null | undefined) {
  if (!role) {
    return [];
  }

  return WORKSPACE_LANDING_TARGETS.filter((target) => {
    if (target.module && !canAccessModule(role, target.module)) {
      return false;
    }

    if (target.action && !canPerformAction(role, target.action)) {
      return false;
    }

    return true;
  });
}

export function getDefaultWorkspacePath(role: AuthRole | null | undefined) {
  const firstTarget = getAccessibleLandingTargets(role)[0];
  return firstTarget?.href ?? '/auth/login';
}

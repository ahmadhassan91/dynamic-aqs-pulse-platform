'use client';

import type {
  AuthRole,
  RoleProfileDefinition,
  WorkspaceActionKey,
  WorkspaceModuleKey,
} from '@pulse/contracts';

// Browser-safe mirror of the role/access catalog.
// The backend remains the source of truth for enforcement, but the frontend
// needs a stable local catalog for navigation, default landing routes, and
// simple role descriptions even when workspace package exports are optimized.
export const AUTH_ROLE_CATALOG = [
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

export const ROLE_PROFILE_CATALOG: Record<AuthRole, RoleProfileDefinition> = {
  EXECUTIVE: {
    displayName: 'Executive',
    summary: 'High-level oversight across pipeline, customers, territories, training, and integrations.',
    bestFor: 'Company leaders who need broad visibility and reporting without working every operational queue themselves.',
    scopeSummary: 'Full cross-module visibility with executive reporting and administrative awareness.',
    workspaceHighlights: ['calendar', 'leads', 'customers', 'territories', 'training', 'reports'],
    actionHighlights: ['reports.executive', 'admin.audit_view', 'admin.integration_view'],
  },
  SUPER_ADMIN: {
    displayName: 'Super Admin',
    summary: 'Full operational and administrative access across the entire Pulse workspace.',
    bestFor: 'Platform owners and implementation leads responsible for setup, rollout, and support.',
    scopeSummary: 'Unrestricted module and action access, including user, integration, territory, and training administration.',
    workspaceHighlights: ['admin', 'calendar', 'leads', 'customers', 'territories', 'training'],
    actionHighlights: ['admin.user_manage', 'admin.integration_manage', 'territory.admin', 'training.catalog_manage'],
  },
  SALES_BD_REP: {
    displayName: 'Sales / BD Rep',
    summary: 'Day-to-day lead and customer handling with intake, follow-up, and account maintenance.',
    bestFor: 'Frontline sales and business development users working active leads and converted customers.',
    scopeSummary: 'Operational access focused on leads, customers, contacts, and locations without admin or finance decisioning.',
    workspaceHighlights: ['calendar', 'leads', 'customers', 'reports'],
    actionHighlights: ['lead.intake_manage', 'customer.edit', 'contact.create'],
  },
  SALES_BD_LEADERSHIP: {
    displayName: 'Sales Leadership',
    summary: 'Lead pipeline oversight with stronger reporting and limited administrative visibility.',
    bestFor: 'Sales leaders who monitor reps, queues, and operating health without becoming full admins.',
    scopeSummary: 'Lead and customer visibility plus queue/reporting access, with audit-level admin read access.',
    workspaceHighlights: ['calendar', 'leads', 'customers', 'reports', 'admin'],
    actionHighlights: ['lead.finance_queue_view', 'admin.audit_view', 'reports.builder'],
  },
  FINANCE: {
    displayName: 'Finance',
    summary: 'Focused access for CIS review, finance queue decisions, and customer financial context.',
    bestFor: 'Finance reviewers and decision makers who should stay out of unrelated operational modules.',
    scopeSummary: 'Read-heavy lead and customer visibility with finance-specific action authority.',
    workspaceHighlights: ['calendar', 'leads', 'customers', 'reports'],
    actionHighlights: ['lead.finance_queue_view', 'lead.finance_decide', 'customer.financials_view'],
  },
  ADMIN_CSR_OPS: {
    displayName: 'Operations Admin',
    summary: 'Central operations profile for intake, customer maintenance, portal setup, and admin support.',
    bestFor: 'CSR and operations staff who keep lead, customer, admin, and dealer setup workflows moving.',
    scopeSummary: 'Broad operational access across lead and customer workflows, without territory or training specialist ownership.',
    workspaceHighlights: ['admin', 'calendar', 'leads', 'customers', 'dealer_portal'],
    actionHighlights: ['admin.user_manage', 'admin.integration_manage', 'lead.portal_setup', 'consignment.manage'],
  },
  TERRITORY_MANAGER: {
    displayName: 'Territory Manager',
    summary: 'Field-facing role for territory ownership, customer coverage, and scheduled training delivery.',
    bestFor: 'Territory owners who work accounts directly and need map, coverage, and training scheduling access.',
    scopeSummary: 'Operational visibility centered on owned coverage, customer maintenance, and reassignment tasks.',
    workspaceHighlights: ['calendar', 'territories', 'territory_map', 'customers', 'training', 'leads'],
    actionHighlights: ['territory.reassign', 'training.schedule', 'customer.edit'],
  },
  REGIONAL_DIRECTOR: {
    displayName: 'Regional Director',
    summary: 'Regional oversight for territory health, staffing, escalation, and training execution.',
    bestFor: 'Regional leaders who supervise TM coverage and step into exceptions or reassignment decisions.',
    scopeSummary: 'Broad visibility across territory, customer, and training workflows with admin-like territory control.',
    workspaceHighlights: ['calendar', 'territories', 'territory_map', 'customers', 'training', 'reports'],
    actionHighlights: ['territory.admin', 'territory.reassign', 'training.schedule'],
  },
  TRAINING_OPS: {
    displayName: 'Training Ops',
    summary: 'Specialist profile for catalog governance, scheduling, certification, and training delivery.',
    bestFor: 'Training coordinators and trainers responsible for program execution and certification records.',
    scopeSummary: 'Training-centered access without broader lead, territory, or admin responsibilities.',
    workspaceHighlights: ['calendar', 'training', 'reports'],
    actionHighlights: ['training.catalog_manage', 'training.schedule'],
  },
  DEALER_PORTAL_USER: {
    displayName: 'Dealer Portal User',
    summary: 'Dealer-facing access limited to portal surfaces and personal calendar visibility.',
    bestFor: 'External dealer users who should only see the dealer portal experience.',
    scopeSummary: 'External-facing, tightly bounded access with no internal CRM administration or operational workflow control.',
    workspaceHighlights: ['dealer_portal', 'calendar'],
    actionHighlights: ['dealer.order_view', 'dealer.order_create', 'dealer.order_submit'],
  },
};

export const ROLE_DEFAULT_MODULE_ACCESS_CATALOG: Record<AuthRole, WorkspaceModuleKey[]> = {
  EXECUTIVE: ['home', 'calendar', 'leads', 'cis', 'customers', 'orders', 'territories', 'territory_map', 'training', 'product_management', 'dealer_portal', 'consignment', 'digital_assets', 'mobile', 'communication', 'reports', 'admin', 'notifications', 'settings', 'integrations'],
  SUPER_ADMIN: ['home', 'calendar', 'leads', 'cis', 'customers', 'orders', 'territories', 'territory_map', 'training', 'product_management', 'dealer_portal', 'consignment', 'digital_assets', 'mobile', 'communication', 'reports', 'admin', 'notifications', 'settings', 'integrations'],
  SALES_BD_REP: ['home', 'calendar', 'leads', 'cis', 'customers', 'orders', 'digital_assets', 'communication', 'reports', 'notifications'],
  SALES_BD_LEADERSHIP: ['home', 'calendar', 'leads', 'cis', 'customers', 'orders', 'product_management', 'digital_assets', 'communication', 'reports', 'notifications', 'admin'],
  FINANCE: ['home', 'calendar', 'leads', 'cis', 'customers', 'reports', 'notifications'],
  ADMIN_CSR_OPS: ['home', 'calendar', 'leads', 'cis', 'customers', 'orders', 'product_management', 'dealer_portal', 'consignment', 'digital_assets', 'reports', 'admin', 'notifications'],
  TERRITORY_MANAGER: ['home', 'calendar', 'leads', 'customers', 'orders', 'territories', 'territory_map', 'training', 'consignment', 'mobile', 'communication', 'reports', 'notifications'],
  REGIONAL_DIRECTOR: ['home', 'calendar', 'leads', 'customers', 'orders', 'territories', 'territory_map', 'training', 'consignment', 'mobile', 'communication', 'reports', 'notifications', 'settings'],
  TRAINING_OPS: ['home', 'calendar', 'training', 'product_management', 'digital_assets', 'reports', 'notifications', 'settings'],
  DEALER_PORTAL_USER: ['home', 'calendar', 'dealer_portal', 'notifications'],
};

export const ROLE_DEFAULT_ACTION_ACCESS_CATALOG: Record<AuthRole, WorkspaceActionKey[]> = {
  EXECUTIVE: ['reference.view', 'admin.user_view', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'admin.integration_view', 'lead.view', 'lead.finance_queue_view', 'customer.view', 'customer.financials_view', 'order.view', 'dealer.order_view', 'contact.view', 'location.view', 'product.view', 'digital_asset.view', 'digital_asset.download', 'digital_asset.usage_view', 'consignment.view', 'reports.builder', 'reports.executive'],
  SUPER_ADMIN: ['reference.view', 'reference.manage', 'admin.user_view', 'admin.user_manage', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'admin.integration_view', 'admin.integration_manage', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'customer.financials_view', 'order.view', 'order.create', 'order.submit', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.finance_queue_view', 'lead.finance_decide', 'lead.portal_setup', 'lead.consignment_approve', 'territory.admin', 'territory.reassign', 'training.catalog_manage', 'training.schedule', 'product.view', 'product.manage', 'product.asset_link', 'product.publish', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'digital_asset.upload', 'digital_asset.edit', 'digital_asset.publish', 'digital_asset.archive', 'digital_asset.sync', 'digital_asset.usage_view', 'consignment.view', 'consignment.audit', 'consignment.document_manage', 'consignment.manage', 'reports.builder', 'reports.executive'],
  SALES_BD_REP: ['reference.view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'order.view', 'order.create', 'order.submit', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'product.view', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'reports.builder'],
  SALES_BD_LEADERSHIP: ['reference.view', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'order.view', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.finance_queue_view', 'product.view', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'digital_asset.usage_view', 'reports.builder'],
  FINANCE: ['reference.view', 'lead.view', 'customer.view', 'customer.financials_view', 'contact.view', 'location.view', 'lead.finance_queue_view', 'lead.finance_decide', 'reports.builder'],
  ADMIN_CSR_OPS: ['reference.view', 'reference.manage', 'admin.user_view', 'admin.user_manage', 'admin.role_view', 'admin.audit_view', 'admin.system_health_view', 'admin.integration_view', 'admin.integration_manage', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'order.view', 'order.create', 'order.submit', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.intake_manage', 'lead.portal_setup', 'lead.consignment_approve', 'product.view', 'product.manage', 'product.asset_link', 'product.publish', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'digital_asset.upload', 'digital_asset.edit', 'digital_asset.publish', 'digital_asset.archive', 'digital_asset.sync', 'digital_asset.usage_view', 'consignment.view', 'consignment.audit', 'consignment.document_manage', 'consignment.manage', 'reports.builder'],
  TERRITORY_MANAGER: ['reference.view', 'lead.view', 'customer.view', 'customer.create', 'customer.edit', 'customer.activity_log', 'order.view', 'order.create', 'order.submit', 'contact.view', 'contact.create', 'location.view', 'location.create', 'lead.consignment_approve', 'territory.reassign', 'training.schedule', 'product.view', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'consignment.view', 'consignment.audit', 'reports.builder'],
  REGIONAL_DIRECTOR: ['reference.view', 'lead.view', 'customer.view', 'order.view', 'contact.view', 'location.view', 'territory.admin', 'territory.reassign', 'training.schedule', 'product.view', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'digital_asset.usage_view', 'consignment.view', 'consignment.audit', 'reports.builder'],
  TRAINING_OPS: ['reference.view', 'training.catalog_manage', 'training.schedule', 'product.view', 'product.asset_link', 'digital_asset.view', 'digital_asset.download', 'digital_asset.share', 'digital_asset.usage_view', 'reports.builder'],
  DEALER_PORTAL_USER: ['dealer.order_view', 'dealer.order_create', 'dealer.order_submit'],
};

function normalizeRoleInput(role: AuthRole | string | null | undefined): AuthRole | null {
  if (!role) {
    return null;
  }

  return AUTH_ROLE_CATALOG.includes(role as AuthRole) ? (role as AuthRole) : null;
}

export function getRoleDisplayName(role: AuthRole | string | null | undefined) {
  const normalizedRole = normalizeRoleInput(role);
  if (!normalizedRole) {
    return 'Unknown role';
  }

  return ROLE_PROFILE_CATALOG[normalizedRole]?.displayName ?? normalizedRole.replace(/_/g, ' ');
}

export function getRoleSummary(role: AuthRole | string | null | undefined) {
  const normalizedRole = normalizeRoleInput(role);
  if (!normalizedRole) {
    return '';
  }

  return ROLE_PROFILE_CATALOG[normalizedRole]?.summary ?? '';
}

export function getRoleScopeSummary(role: AuthRole | string | null | undefined) {
  const normalizedRole = normalizeRoleInput(role);
  if (!normalizedRole) {
    return '';
  }

  return ROLE_PROFILE_CATALOG[normalizedRole]?.scopeSummary ?? '';
}

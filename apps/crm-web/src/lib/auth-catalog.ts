'use client';

import type { AuthRole } from '@pulse/contracts';
import {
  AUTH_ROLES,
  ROLE_DEFAULT_ACTION_ACCESS,
  ROLE_DEFAULT_MODULE_ACCESS,
  ROLE_PROFILE_CATALOG as CONTRACT_ROLE_PROFILE_CATALOG,
} from '@pulse/contracts';

export const AUTH_ROLE_CATALOG = AUTH_ROLES;
export const ROLE_DEFAULT_MODULE_ACCESS_CATALOG = ROLE_DEFAULT_MODULE_ACCESS;
export const ROLE_DEFAULT_ACTION_ACCESS_CATALOG = ROLE_DEFAULT_ACTION_ACCESS;
export const ROLE_PROFILE_CATALOG = CONTRACT_ROLE_PROFILE_CATALOG;

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

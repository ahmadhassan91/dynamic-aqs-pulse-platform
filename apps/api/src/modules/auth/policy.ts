import { normalizeRole } from '@pulse/auth';
import { AuditAction, FeatureFlagState, Prisma, prisma } from '@pulse/db';
import type {
  AdminMicrosoftEntraIntegrationSettingsResponse,
  AuthRole,
  MicrosoftEntraGroupRoleMapping,
  MicrosoftEntraPolicySummary,
  UpdateAdminMicrosoftEntraIntegrationSettingsRequest,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from './types.js';

const ENTRA_POLICY_FLAG_KEY = 'auth.microsoft_entra.access';
const ENTRA_POLICY_FLAG_NAME = 'Microsoft Entra internal access policy';

type StoredMicrosoftEntraPolicy = {
  allowEmailLinking: boolean;
  autoProvisionFromGroups: boolean;
  allowedDomains: string[];
  groupRoleMappings: MicrosoftEntraGroupRoleMapping[];
};

// Fail-closed defaults (hardened 2026-06-22): out of the box, Entra SSO neither links nor auto-provisions
// users, and with no domain allowlist no new identity is admitted (see isEmailAllowedByMicrosoftEntraPolicy).
// An admin must consciously enable linking/provisioning AND approve domains before SSO onboarding works.
const DEFAULT_MICROSOFT_ENTRA_POLICY: StoredMicrosoftEntraPolicy = {
  allowEmailLinking: false,
  autoProvisionFromGroups: false,
  allowedDomains: [],
  groupRoleMappings: [],
};

function toStoredMicrosoftEntraPolicyJson(policy: StoredMicrosoftEntraPolicy): Prisma.InputJsonValue {
  return {
    allowEmailLinking: policy.allowEmailLinking,
    autoProvisionFromGroups: policy.autoProvisionFromGroups,
    allowedDomains: policy.allowedDomains,
    groupRoleMappings: policy.groupRoleMappings.map((entry) => ({
      groupId: entry.groupId,
      role: entry.role,
    })),
  };
}

export async function getMicrosoftEntraAdminSettings(
  config: AppConfig,
): Promise<AdminMicrosoftEntraIntegrationSettingsResponse> {
  const policy = await loadStoredMicrosoftEntraPolicy();
  const configurationIssues = getMicrosoftEntraConfigurationIssues(config);

  return {
    provider: 'microsoft_entra',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(policy, config),
  };
}

export async function updateMicrosoftEntraAdminSettings(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: UpdateAdminMicrosoftEntraIntegrationSettingsRequest,
): Promise<AdminMicrosoftEntraIntegrationSettingsResponse> {
  const current = await loadStoredMicrosoftEntraPolicy();
  const next: StoredMicrosoftEntraPolicy = {
    allowEmailLinking: input.allowEmailLinking ?? current.allowEmailLinking,
    autoProvisionFromGroups: input.autoProvisionFromGroups ?? current.autoProvisionFromGroups,
    allowedDomains: input.allowedDomains ? normalizeDomainList(input.allowedDomains) : current.allowedDomains,
    groupRoleMappings: input.groupRoleMappings ? normalizeGroupRoleMappings(input.groupRoleMappings) : current.groupRoleMappings,
  };

  await prisma.$transaction(async (tx) => {
    await tx.featureFlag.upsert({
      where: { key: ENTRA_POLICY_FLAG_KEY },
      create: {
        key: ENTRA_POLICY_FLAG_KEY,
        name: ENTRA_POLICY_FLAG_NAME,
        description: 'Controls Microsoft Entra access policy, approved domains, and group-to-role mappings for internal Pulse access.',
        state: FeatureFlagState.ON,
        metadata: toStoredMicrosoftEntraPolicyJson(next),
      },
      update: {
        state: FeatureFlagState.ON,
        metadata: toStoredMicrosoftEntraPolicyJson(next),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'microsoft_entra_policy',
        entityId: ENTRA_POLICY_FLAG_KEY,
        sourceSystem: 'pulse',
        afterData: next,
        metadata: {
          provider: 'microsoft_entra',
          operation: 'admin.microsoft_entra_policy.update',
        },
      }),
    });
  });

  const configurationIssues = getMicrosoftEntraConfigurationIssues(config);

  return {
    provider: 'microsoft_entra',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(next, config),
  };
}

export async function getResolvedMicrosoftEntraPolicy(config: AppConfig): Promise<MicrosoftEntraPolicySummary> {
  const stored = await loadStoredMicrosoftEntraPolicy();
  return toPolicySummary(stored, config);
}

export async function listMicrosoftEntraIntegrationStatuses(
  config: AppConfig,
): Promise<Array<{
  key: string;
  label: string;
  status: 'connected' | 'warning' | 'error';
  health: number;
  lastCheckedAt: string;
  detail: string;
}>> {
  const settings = await getMicrosoftEntraAdminSettings(config);
  const checkedAt = new Date().toISOString();
  const hasStoredMappings = settings.policy.groupRoleMappings.length > 0;
  const hasEnvMappings = settings.policy.envGroupRoleMappings.length > 0;
  const isRestricted = settings.policy.allowedDomains.length > 0;

  return [
    {
      key: 'microsoft-entra-auth',
      label: 'Microsoft Entra Auth',
      status: settings.isConfigured
        ? (hasStoredMappings || hasEnvMappings || settings.policy.allowEmailLinking ? 'connected' : 'warning')
        : 'error',
      health: settings.isConfigured
        ? isRestricted ? 90 : 80
        : 20,
      lastCheckedAt: checkedAt,
      detail: settings.isConfigured
        ? [
          settings.policy.allowEmailLinking ? 'Email-linking is enabled.' : 'Email-linking is disabled.',
          settings.policy.autoProvisionFromGroups ? 'Group-based auto-provisioning is enabled.' : 'Group-based auto-provisioning is disabled.',
          isRestricted ? `Restricted to ${settings.policy.allowedDomains.length} approved domains.` : 'No domain restrictions configured.',
          hasStoredMappings || hasEnvMappings
            ? `${settings.policy.effectiveGroupRoleMappings.length} effective group-role mappings available.`
            : 'No group-role mappings configured yet.',
        ].join(' ')
        : `Missing environment setup: ${settings.configurationIssues.join(', ')}.`,
    },
  ];
}

export function getMicrosoftEntraConfigurationIssues(config: AppConfig) {
  const issues: string[] = [];

  if (!config.auth.entra.tenantId) issues.push('MICROSOFT_ENTRA_TENANT_ID');
  if (!config.auth.entra.clientId) issues.push('MICROSOFT_ENTRA_CLIENT_ID');
  if (!config.auth.entra.clientSecret) issues.push('MICROSOFT_ENTRA_CLIENT_SECRET');
  if (!config.auth.entra.redirectUri) issues.push('MICROSOFT_ENTRA_LOGIN_REDIRECT_URI');

  return issues;
}

async function loadStoredMicrosoftEntraPolicy(): Promise<StoredMicrosoftEntraPolicy> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: ENTRA_POLICY_FLAG_KEY },
  });

  return normalizeStoredMicrosoftEntraPolicy(flag?.metadata ?? null);
}

function normalizeStoredMicrosoftEntraPolicy(metadata: unknown): StoredMicrosoftEntraPolicy {
  const raw = (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
    ? metadata as Record<string, unknown>
    : {};

  return {
    allowEmailLinking: parseBoolean(raw.allowEmailLinking, DEFAULT_MICROSOFT_ENTRA_POLICY.allowEmailLinking),
    autoProvisionFromGroups: parseBoolean(raw.autoProvisionFromGroups, DEFAULT_MICROSOFT_ENTRA_POLICY.autoProvisionFromGroups),
    allowedDomains: normalizeDomainList(raw.allowedDomains),
    groupRoleMappings: normalizeGroupRoleMappings(raw.groupRoleMappings),
  };
}

function toPolicySummary(
  policy: StoredMicrosoftEntraPolicy,
  config: AppConfig,
): MicrosoftEntraPolicySummary {
  const envGroupRoleMappings = normalizeEnvGroupRoleMappings(config.auth.entra.groupRoleMap);
  const effectiveGroupRoleMappings = mergeGroupRoleMappings(envGroupRoleMappings, policy.groupRoleMappings);

  return {
    allowEmailLinking: policy.allowEmailLinking,
    autoProvisionFromGroups: policy.autoProvisionFromGroups,
    allowedDomains: policy.allowedDomains,
    groupRoleMappings: policy.groupRoleMappings,
    envGroupRoleMappings,
    effectiveGroupRoleMappings,
  };
}

function normalizeEnvGroupRoleMappings(groupRoleMap: Record<string, string>) {
  return normalizeGroupRoleMappings(
    Object.entries(groupRoleMap).map(([groupId, role]) => ({ groupId, role })),
  );
}

function mergeGroupRoleMappings(
  envMappings: MicrosoftEntraGroupRoleMapping[],
  storedMappings: MicrosoftEntraGroupRoleMapping[],
) {
  const merged = new Map<string, MicrosoftEntraGroupRoleMapping>();

  for (const entry of envMappings) {
    merged.set(entry.groupId.toLowerCase(), entry);
  }

  for (const entry of storedMappings) {
    merged.set(entry.groupId.toLowerCase(), entry);
  }

  return [...merged.values()];
}

function normalizeGroupRoleMappings(input: unknown): MicrosoftEntraGroupRoleMapping[] {
  const rawEntries = Array.isArray(input) ? input : [];
  const mappings = rawEntries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const rawGroupId = 'groupId' in entry ? entry.groupId : null;
    const rawRole = 'role' in entry ? entry.role : null;
    const groupId = typeof rawGroupId === 'string' ? rawGroupId.trim() : '';
    const roleValue = typeof rawRole === 'string' ? rawRole.trim() : '';
    if (!groupId || !roleValue) {
      return [];
    }

    try {
      return [{
        groupId,
        role: normalizeRole(roleValue) as AuthRole,
      }];
    } catch {
      return [];
    }
  });

  const deduped = new Map<string, MicrosoftEntraGroupRoleMapping>();
  for (const entry of mappings) {
    deduped.set(entry.groupId.toLowerCase(), entry);
  }

  return [...deduped.values()];
}

function normalizeDomainList(input: unknown): string[] {
  const values = Array.isArray(input) ? input : [];
  const normalized = values
    .map((value) => typeof value === 'string' ? value.trim().toLowerCase() : '')
    .filter(Boolean);

  return [...new Set(normalized)];
}

function parseBoolean(input: unknown, fallback: boolean) {
  return typeof input === 'boolean' ? input : fallback;
}

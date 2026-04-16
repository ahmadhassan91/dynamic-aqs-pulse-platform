import type {
  AdminCalendarIntegrationSettingsResponse,
  CalendarMeetingProviderKey,
  CalendarOutlookPolicySummary,
  UpdateAdminCalendarIntegrationSettingsRequest,
} from '@pulse/contracts';
import { AuditAction, FeatureFlagState, prisma } from '@pulse/db';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from '../auth/types.js';

const OUTLOOK_POLICY_FLAG_KEY = 'calendar.outlook.sync';
const OUTLOOK_POLICY_FLAG_NAME = 'Outlook calendar sync rollout';

type StoredOutlookPolicy = {
  allowUserConnections: boolean;
  sharedCalendarsEnabled: boolean;
  defaultMeetingProvider: CalendarMeetingProviderKey;
  autoSyncDiscoveryEnabled: boolean;
  autoSyncTrainingEnabled: boolean;
  pilotUserEmails: string[];
};

const DEFAULT_OUTLOOK_POLICY: StoredOutlookPolicy = {
  allowUserConnections: true,
  sharedCalendarsEnabled: false,
  defaultMeetingProvider: 'none',
  autoSyncDiscoveryEnabled: true,
  autoSyncTrainingEnabled: true,
  pilotUserEmails: [],
};

export async function getOutlookCalendarAdminSettings(
  config: AppConfig,
): Promise<AdminCalendarIntegrationSettingsResponse> {
  const policy = await loadStoredOutlookPolicy();
  const configurationIssues = getOutlookConfigurationIssues(config);

  return {
    provider: 'outlook',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(policy, null),
  };
}

export async function updateOutlookCalendarAdminSettings(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: UpdateAdminCalendarIntegrationSettingsRequest,
): Promise<AdminCalendarIntegrationSettingsResponse> {
  const current = await loadStoredOutlookPolicy();
  const next: StoredOutlookPolicy = {
    allowUserConnections: input.allowUserConnections ?? current.allowUserConnections,
    sharedCalendarsEnabled: input.sharedCalendarsEnabled ?? current.sharedCalendarsEnabled,
    defaultMeetingProvider: normalizeMeetingProvider(input.defaultMeetingProvider ?? current.defaultMeetingProvider),
    autoSyncDiscoveryEnabled: input.autoSyncDiscoveryEnabled ?? current.autoSyncDiscoveryEnabled,
    autoSyncTrainingEnabled: input.autoSyncTrainingEnabled ?? current.autoSyncTrainingEnabled,
    pilotUserEmails: input.pilotUserEmails ? normalizeEmailList(input.pilotUserEmails) : current.pilotUserEmails,
  };

  await prisma.$transaction(async (tx) => {
    await tx.featureFlag.upsert({
      where: {
        key: OUTLOOK_POLICY_FLAG_KEY,
      },
      create: {
        key: OUTLOOK_POLICY_FLAG_KEY,
        name: OUTLOOK_POLICY_FLAG_NAME,
        description: 'Controls Outlook mailbox sync rollout and calendar sync behavior for Pulse.',
        state: next.allowUserConnections ? FeatureFlagState.ON : FeatureFlagState.OFF,
        metadata: next,
      },
      update: {
        state: next.allowUserConnections ? FeatureFlagState.ON : FeatureFlagState.OFF,
        metadata: next,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'calendar_integration_policy',
        entityId: OUTLOOK_POLICY_FLAG_KEY,
        sourceSystem: 'pulse',
        afterData: next,
        metadata: {
          provider: 'outlook',
          operation: 'admin.calendar_integration.update',
        },
      }),
    });
  });

  const configurationIssues = getOutlookConfigurationIssues(config);

  return {
    provider: 'outlook',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(next, null),
  };
}

export async function getOutlookPolicySummaryForActor(
  actor: Pick<AuthenticatedActor, 'email'> | null,
  config: AppConfig,
): Promise<{
  isConfigured: boolean;
  configurationIssues: string[];
  availabilityMessage?: string;
  policy: CalendarOutlookPolicySummary;
}> {
  const policy = await loadStoredOutlookPolicy();
  const configurationIssues = getOutlookConfigurationIssues(config);
  const isConfigured = configurationIssues.length === 0;
  const isCurrentUserEligible = isUserEligibleForOutlook(policy, actor?.email ?? null);

  let availabilityMessage: string | undefined;
  if (!isConfigured) {
    availabilityMessage = `Outlook mailbox sync still needs environment setup: ${configurationIssues.join(', ')}.`;
  } else if (!policy.allowUserConnections) {
    availabilityMessage = 'Outlook mailbox sync is currently disabled by an administrator.';
  } else if (!isCurrentUserEligible) {
    availabilityMessage = 'Outlook mailbox sync is in pilot mode for approved users only.';
  }

  return {
    isConfigured,
    configurationIssues,
    ...(availabilityMessage ? { availabilityMessage } : {}),
    policy: toPolicySummary(policy, isCurrentUserEligible),
  };
}

export async function listOutlookIntegrationStatuses(
  config: AppConfig,
): Promise<Array<{
  key: string;
  label: string;
  status: 'connected' | 'warning' | 'error';
  health: number;
  lastCheckedAt: string;
  detail: string;
}>> {
  const settings = await getOutlookCalendarAdminSettings(config);
  const checkedAt = new Date().toISOString();
  const isPilot = settings.policy.allowUserConnections && settings.policy.pilotUserEmails.length > 0;

  return [
    {
      key: 'outlook-calendar',
      label: 'Outlook Calendar',
      status: settings.isConfigured
        ? settings.policy.allowUserConnections
          ? 'connected'
          : 'warning'
        : 'error',
      health: settings.isConfigured
        ? settings.policy.allowUserConnections
          ? isPilot ? 85 : 100
          : 55
        : 20,
      lastCheckedAt: checkedAt,
      detail: settings.isConfigured
        ? settings.policy.allowUserConnections
          ? isPilot
            ? `Connected for pilot rollout users (${settings.policy.pilotUserEmails.length}).`
            : 'Ready for user mailbox connections and event sync.'
          : 'Configured in the environment but currently disabled by admin policy.'
        : `Missing environment setup: ${settings.configurationIssues.join(', ')}.`,
    },
  ];
}

export async function canActorUseOutlookCalendar(
  actor: Pick<AuthenticatedActor, 'email'>,
  config: AppConfig,
): Promise<boolean> {
  const { isConfigured, policy } = await getOutlookPolicySummaryForActor(actor, config);
  return isConfigured && policy.allowUserConnections && policy.isCurrentUserEligible;
}

export async function shouldAutoSyncOutlookEvent(
  actor: Pick<AuthenticatedActor, 'email'>,
  config: AppConfig,
  sourceModule: 'leads' | 'training',
): Promise<boolean> {
  const { isConfigured, policy } = await getOutlookPolicySummaryForActor(actor, config);
  if (!isConfigured || !policy.allowUserConnections || !policy.isCurrentUserEligible) {
    return false;
  }

  if (sourceModule === 'leads') {
    return policy.autoSyncDiscoveryEnabled;
  }

  return policy.autoSyncTrainingEnabled;
}

export function getOutlookConfigurationIssues(config: AppConfig) {
  const issues: string[] = [];

  if (!config.outlookCalendar.tenantId) issues.push('MICROSOFT_ENTRA_TENANT_ID');
  if (!config.outlookCalendar.clientId) issues.push('MICROSOFT_ENTRA_CLIENT_ID');
  if (!config.outlookCalendar.clientSecret) issues.push('MICROSOFT_ENTRA_CLIENT_SECRET');
  if (!config.outlookCalendar.redirectUri) issues.push('MICROSOFT_GRAPH_REDIRECT_URI');
  if (!config.outlookCalendar.encryptionKey) issues.push('APP_ENCRYPTION_KEY');

  return issues;
}

async function loadStoredOutlookPolicy(): Promise<StoredOutlookPolicy> {
  const flag = await prisma.featureFlag.findUnique({
    where: {
      key: OUTLOOK_POLICY_FLAG_KEY,
    },
  });

  return normalizeStoredPolicy(flag?.state ?? null, flag?.metadata ?? null);
}

function normalizeStoredPolicy(
  state: FeatureFlagState | null,
  metadata: unknown,
): StoredOutlookPolicy {
  const raw = (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
    ? metadata as Record<string, unknown>
    : {};

  const allowUserConnections = state
    ? state !== FeatureFlagState.OFF
    : parseBoolean(raw.allowUserConnections, DEFAULT_OUTLOOK_POLICY.allowUserConnections);

  return {
    allowUserConnections,
    sharedCalendarsEnabled: parseBoolean(raw.sharedCalendarsEnabled, DEFAULT_OUTLOOK_POLICY.sharedCalendarsEnabled),
    defaultMeetingProvider: normalizeMeetingProvider(raw.defaultMeetingProvider),
    autoSyncDiscoveryEnabled: parseBoolean(raw.autoSyncDiscoveryEnabled, DEFAULT_OUTLOOK_POLICY.autoSyncDiscoveryEnabled),
    autoSyncTrainingEnabled: parseBoolean(raw.autoSyncTrainingEnabled, DEFAULT_OUTLOOK_POLICY.autoSyncTrainingEnabled),
    pilotUserEmails: normalizeEmailList(raw.pilotUserEmails),
  };
}

function toPolicySummary(
  policy: StoredOutlookPolicy,
  isCurrentUserEligible: boolean | null,
): CalendarOutlookPolicySummary {
  return {
    allowUserConnections: policy.allowUserConnections,
    isCurrentUserEligible: isCurrentUserEligible ?? true,
    sharedCalendarsEnabled: policy.sharedCalendarsEnabled,
    defaultMeetingProvider: policy.defaultMeetingProvider,
    autoSyncDiscoveryEnabled: policy.autoSyncDiscoveryEnabled,
    autoSyncTrainingEnabled: policy.autoSyncTrainingEnabled,
    pilotUserEmails: policy.pilotUserEmails,
  };
}

function isUserEligibleForOutlook(policy: StoredOutlookPolicy, email: string | null) {
  if (!policy.allowUserConnections) {
    return false;
  }

  if (policy.pilotUserEmails.length === 0) {
    return true;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return policy.pilotUserEmails.includes(normalizedEmail);
}

function normalizeMeetingProvider(value: unknown): CalendarMeetingProviderKey {
  return value === 'teams' ? 'teams' : 'none';
}

function normalizeEmailList(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]+/)
      : [];

  return [...new Set(items
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean))];
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return fallback;
}

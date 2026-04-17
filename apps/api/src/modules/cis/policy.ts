import type {
  AdminPaymentIntegrationSettingsResponse,
  CisPaymentVaultProviderKey,
  PaymentIntegrationCaptureModeKey,
  PaymentIntegrationPolicySummary,
  UpdateAdminPaymentIntegrationSettingsRequest,
} from '@pulse/contracts';
import { AuditAction, FeatureFlagState, prisma } from '@pulse/db';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from '../auth/types.js';

const PAYMENT_POLICY_FLAG_KEY = 'payments.tokenized.capture';
const PAYMENT_POLICY_FLAG_NAME = 'Tokenized payment capture rollout';

type StoredPaymentIntegrationPolicy = {
  captureMode: PaymentIntegrationCaptureModeKey;
  defaultProvider: CisPaymentVaultProviderKey;
  allowCisCaptureTracking: boolean;
  allowAccountPaymentMethodManagement: boolean;
};

const DEFAULT_PAYMENT_POLICY: StoredPaymentIntegrationPolicy = {
  captureMode: 'manual_recording',
  defaultProvider: 'unknown',
  allowCisCaptureTracking: true,
  allowAccountPaymentMethodManagement: true,
};

export async function getPaymentIntegrationAdminSettings(config: AppConfig): Promise<AdminPaymentIntegrationSettingsResponse> {
  const policy = await loadStoredPaymentIntegrationPolicy();
  const configurationIssues = getPaymentIntegrationConfigurationIssues(config, policy);

  return {
    provider: 'tokenized_payments',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(policy),
  };
}

export async function updatePaymentIntegrationAdminSettings(
  config: AppConfig,
  actor: AuthenticatedActor,
  input: UpdateAdminPaymentIntegrationSettingsRequest,
): Promise<AdminPaymentIntegrationSettingsResponse> {
  const current = await loadStoredPaymentIntegrationPolicy();
  const next: StoredPaymentIntegrationPolicy = {
    captureMode: normalizeCaptureMode(input.captureMode ?? current.captureMode),
    defaultProvider: normalizeVaultProvider(input.defaultProvider ?? current.defaultProvider),
    allowCisCaptureTracking: parseBoolean(input.allowCisCaptureTracking, current.allowCisCaptureTracking),
    allowAccountPaymentMethodManagement: parseBoolean(
      input.allowAccountPaymentMethodManagement,
      current.allowAccountPaymentMethodManagement,
    ),
  };

  await prisma.$transaction(async (tx) => {
    await tx.featureFlag.upsert({
      where: { key: PAYMENT_POLICY_FLAG_KEY },
      create: {
        key: PAYMENT_POLICY_FLAG_KEY,
        name: PAYMENT_POLICY_FLAG_NAME,
        description: 'Controls manual tokenized payment capture recording and future hosted provider rollout in Pulse.',
        state: next.allowCisCaptureTracking || next.allowAccountPaymentMethodManagement
          ? FeatureFlagState.ON
          : FeatureFlagState.OFF,
        metadata: toStoredPaymentIntegrationPolicyJson(next),
      },
      update: {
        state: next.allowCisCaptureTracking || next.allowAccountPaymentMethodManagement
          ? FeatureFlagState.ON
          : FeatureFlagState.OFF,
        metadata: toStoredPaymentIntegrationPolicyJson(next),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'payment_integration_policy',
        entityId: PAYMENT_POLICY_FLAG_KEY,
        sourceSystem: 'pulse',
        afterData: next,
        metadata: {
          provider: 'tokenized_payments',
          operation: 'admin.payment_integration.update',
        },
      }),
    });
  });

  const configurationIssues = getPaymentIntegrationConfigurationIssues(config, next);

  return {
    provider: 'tokenized_payments',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(next),
  };
}

export async function getResolvedPaymentIntegrationPolicy(): Promise<PaymentIntegrationPolicySummary> {
  const policy = await loadStoredPaymentIntegrationPolicy();
  return toPolicySummary(policy);
}

export async function listPaymentIntegrationStatuses(): Promise<Array<{
  key: string;
  label: string;
  status: 'connected' | 'warning' | 'error';
  health: number;
  lastCheckedAt: string;
  detail: string;
}>> {
  throw new Error('Payment integration statuses require config; call listPaymentIntegrationStatusesForConfig instead.');
}

export async function listPaymentIntegrationStatusesForConfig(config: AppConfig): Promise<Array<{
  key: string;
  label: string;
  status: 'connected' | 'warning' | 'error';
  health: number;
  lastCheckedAt: string;
  detail: string;
}>> {
  const settings = await getPaymentIntegrationAdminSettings(config);
  const checkedAt = new Date().toISOString();
  const captureTrackingEnabled = settings.policy.allowCisCaptureTracking;
  const paymentMethodsEnabled = settings.policy.allowAccountPaymentMethodManagement;

  return [
    {
      key: 'tokenized-payments',
      label: 'Tokenized Payments',
      status: settings.isConfigured
        ? (captureTrackingEnabled || paymentMethodsEnabled ? 'connected' : 'warning')
        : 'warning',
      health: settings.isConfigured
        ? captureTrackingEnabled && paymentMethodsEnabled ? 85 : 65
        : 45,
      lastCheckedAt: checkedAt,
      detail: settings.isConfigured
        ? settings.policy.captureMode === 'manual_recording'
          ? 'Manual hosted-capture recording is enabled. Pulse stores token references and masked payment descriptors only.'
          : settings.policy.defaultProvider === 'moneris'
            ? 'Moneris hosted tokenization runtime is ready for secure CIS capture launches in this environment.'
            : 'Provider runtime mode has been selected and the environment is ready for the chosen adapter.'
        : settings.configurationIssues.join(' '),
    },
  ];
}

async function loadStoredPaymentIntegrationPolicy(): Promise<StoredPaymentIntegrationPolicy> {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: PAYMENT_POLICY_FLAG_KEY },
  });

  return normalizeStoredPaymentIntegrationPolicy(flag?.metadata ?? null);
}

function normalizeStoredPaymentIntegrationPolicy(metadata: unknown): StoredPaymentIntegrationPolicy {
  const raw = (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
    ? metadata as Record<string, unknown>
    : {};

  return {
    captureMode: normalizeCaptureMode(raw.captureMode),
    defaultProvider: normalizeVaultProvider(raw.defaultProvider),
    allowCisCaptureTracking: parseBoolean(raw.allowCisCaptureTracking, DEFAULT_PAYMENT_POLICY.allowCisCaptureTracking),
    allowAccountPaymentMethodManagement: parseBoolean(
      raw.allowAccountPaymentMethodManagement,
      DEFAULT_PAYMENT_POLICY.allowAccountPaymentMethodManagement,
    ),
  };
}

function toStoredPaymentIntegrationPolicyJson(policy: StoredPaymentIntegrationPolicy) {
  return {
    captureMode: policy.captureMode,
    defaultProvider: policy.defaultProvider,
    allowCisCaptureTracking: policy.allowCisCaptureTracking,
    allowAccountPaymentMethodManagement: policy.allowAccountPaymentMethodManagement,
  };
}

function toPolicySummary(policy: StoredPaymentIntegrationPolicy): PaymentIntegrationPolicySummary {
  return {
    captureMode: policy.captureMode,
    defaultProvider: policy.defaultProvider,
    allowCisCaptureTracking: policy.allowCisCaptureTracking,
    allowAccountPaymentMethodManagement: policy.allowAccountPaymentMethodManagement,
  };
}

function getPaymentIntegrationConfigurationIssues(config: AppConfig, policy: StoredPaymentIntegrationPolicy) {
  if (policy.captureMode !== 'provider_runtime') {
    return [];
  }

  if (policy.defaultProvider === 'moneris') {
    const issues: string[] = [];
    if (!config.monerisHostedTokenization.profileId) {
      issues.push('Missing MONERIS_HOSTED_TOKENIZATION_PROFILE_ID for Moneris hosted tokenization.');
    }
    if (!config.monerisHostedTokenization.encryptionKey) {
      issues.push('Missing APP_ENCRYPTION_KEY for Moneris temporary-token protection.');
    }
    return issues;
  }

  if (policy.defaultProvider === 'unknown') {
    return ['Select a supported hosted payment provider before enabling provider runtime.'];
  }

  return ['Hosted provider runtime is not enabled in this environment yet for the selected provider.'];
}

function normalizeCaptureMode(value: unknown): PaymentIntegrationCaptureModeKey {
  return value === 'provider_runtime' ? 'provider_runtime' : 'manual_recording';
}

function normalizeVaultProvider(value: unknown): CisPaymentVaultProviderKey {
  return value === 'ebizcharge' || value === 'moneris' ? value : 'unknown';
}

function parseBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

import type {
  AdminPaymentIntegrationSettingsResponse,
  CisPaymentVaultProviderKey,
  PaymentIntegrationCaptureModeKey,
  PaymentIntegrationPolicySummary,
  UpdateAdminPaymentIntegrationSettingsRequest,
} from '@pulse/contracts';
import { AuditAction, FeatureFlagState, prisma } from '@pulse/db';
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

export async function getPaymentIntegrationAdminSettings(): Promise<AdminPaymentIntegrationSettingsResponse> {
  const policy = await loadStoredPaymentIntegrationPolicy();
  const configurationIssues = getPaymentIntegrationConfigurationIssues(policy);

  return {
    provider: 'tokenized_payments',
    isConfigured: configurationIssues.length === 0,
    configurationIssues,
    policy: toPolicySummary(policy),
  };
}

export async function updatePaymentIntegrationAdminSettings(
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

  const configurationIssues = getPaymentIntegrationConfigurationIssues(next);

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
  const settings = await getPaymentIntegrationAdminSettings();
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
          : 'Provider runtime mode has been selected, but the hosted adapter is not enabled in this environment yet.'
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

function getPaymentIntegrationConfigurationIssues(policy: StoredPaymentIntegrationPolicy) {
  if (policy.captureMode === 'provider_runtime') {
    return ['Hosted provider runtime is not enabled in this environment yet.'];
  }

  return [];
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

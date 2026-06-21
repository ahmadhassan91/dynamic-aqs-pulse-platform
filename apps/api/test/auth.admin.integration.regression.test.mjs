import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let createPulseServer;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let createAdminUser;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ createAdminUser } = await import('../dist/modules/admin/service.js'));
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  process.env.MICROSOFT_ENTRA_TENANT_ID = 'tenant-auth-admin';
  process.env.MICROSOFT_ENTRA_CLIENT_ID = 'client-auth-admin';
  process.env.MICROSOFT_ENTRA_CLIENT_SECRET = 'secret-auth-admin';
  process.env.MICROSOFT_ENTRA_LOGIN_REDIRECT_URI = 'http://localhost:3000/auth/entra/callback';
  process.env.MICROSOFT_ENTRA_LOGIN_SCOPES = 'openid profile email offline_access User.Read';
  process.env.MICROSOFT_ENTRA_GROUP_ROLE_MAP = '';
  delete process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_IFRAME_URL;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_IFRAME_ORIGIN;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_TOKEN_TTL_MINUTES;

  config = loadAppConfig(process.env);
  await resetDatabase(prisma);
  await ensureBootstrapAdminSeeded(config);
});

async function createAdminAuth() {
  return loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );
}

async function createAdminActor() {
  const auth = await createAdminAuth();
  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected a bootstrap admin actor');
  return { auth, actor };
}

test('admin integrations surface Microsoft Entra status and default auth settings', SERIAL, async () => {
  const auth = await createAdminAuth();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const integrationsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(integrationsResponse.status, 200);
    const integrationsPayload = await integrationsResponse.json();
    assert.ok(integrationsPayload.integrations.some((entry) => entry.key === 'microsoft-entra-auth'));

    const settingsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/auth`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(settingsResponse.status, 200);
    const settingsPayload = await settingsResponse.json();
    assert.equal(settingsPayload.provider, 'microsoft_entra');
    assert.equal(settingsPayload.isConfigured, true);
    // Hardened 2026-06-22: Entra SSO defaults are fail-closed (no linking/provisioning, no approved domains)
    // until an admin explicitly configures the policy.
    assert.equal(settingsPayload.policy.allowEmailLinking, false);
    assert.equal(settingsPayload.policy.autoProvisionFromGroups, false);
    assert.deepEqual(settingsPayload.policy.allowedDomains, []);
    assert.deepEqual(settingsPayload.policy.groupRoleMappings, []);
  } finally {
    await runtime.close();
  }
});

test('admin can update Microsoft Entra access policy and persisted settings are reflected in the response', SERIAL, async () => {
  const auth = await createAdminAuth();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/auth`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        allowEmailLinking: false,
        autoProvisionFromGroups: true,
        allowedDomains: ['dynamicaqs.com', 'DYNAMICAQS.COM'],
        groupRoleMappings: [
          { groupId: 'group-rd', role: 'REGIONAL_DIRECTOR' },
          { groupId: 'group-rd', role: 'REGIONAL_DIRECTOR' },
          { groupId: 'group-training', role: 'TRAINING_OPS' },
        ],
      }),
    });

    assert.equal(updateResponse.status, 200);
    const updatePayload = await updateResponse.json();
    assert.equal(updatePayload.policy.allowEmailLinking, false);
    assert.equal(updatePayload.policy.autoProvisionFromGroups, true);
    assert.deepEqual(updatePayload.policy.allowedDomains, ['dynamicaqs.com']);
    assert.deepEqual(updatePayload.policy.groupRoleMappings, [
      { groupId: 'group-rd', role: 'REGIONAL_DIRECTOR' },
      { groupId: 'group-training', role: 'TRAINING_OPS' },
    ]);
    assert.deepEqual(updatePayload.policy.effectiveGroupRoleMappings, [
      { groupId: 'group-rd', role: 'REGIONAL_DIRECTOR' },
      { groupId: 'group-training', role: 'TRAINING_OPS' },
    ]);

    const persistedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/auth`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    const persistedPayload = await persistedResponse.json();
    assert.equal(persistedResponse.status, 200);
    assert.equal(persistedPayload.policy.allowEmailLinking, false);
    assert.deepEqual(persistedPayload.policy.allowedDomains, ['dynamicaqs.com']);
    assert.equal(persistedPayload.policy.groupRoleMappings.length, 2);
  } finally {
    await runtime.close();
  }
});

test('admin integrations surface tokenized payment capture settings and persist payment policy changes', SERIAL, async () => {
  const auth = await createAdminAuth();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const integrationsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(integrationsResponse.status, 200);
    const integrationsPayload = await integrationsResponse.json();
    assert.ok(integrationsPayload.integrations.some((entry) => entry.key === 'tokenized-payments'));

    const settingsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/payments`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(settingsResponse.status, 200);
    const settingsPayload = await settingsResponse.json();
    assert.equal(settingsPayload.provider, 'tokenized_payments');
    assert.equal(settingsPayload.isConfigured, true);
    assert.equal(settingsPayload.policy.captureMode, 'manual_recording');
    assert.equal(settingsPayload.policy.defaultProvider, 'unknown');
    assert.equal(settingsPayload.policy.allowCisCaptureTracking, false);
    assert.equal(settingsPayload.policy.allowAccountPaymentMethodManagement, true);

    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/payments`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        captureMode: 'manual_recording',
        defaultProvider: 'moneris',
        allowCisCaptureTracking: false,
        allowAccountPaymentMethodManagement: true,
      }),
    });

    assert.equal(updateResponse.status, 200);
    const updatePayload = await updateResponse.json();
    assert.equal(updatePayload.policy.captureMode, 'manual_recording');
    assert.equal(updatePayload.policy.defaultProvider, 'moneris');
    assert.equal(updatePayload.policy.allowCisCaptureTracking, false);
    assert.equal(updatePayload.policy.allowAccountPaymentMethodManagement, true);

    const persistedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/payments`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    const persistedPayload = await persistedResponse.json();
    assert.equal(persistedResponse.status, 200);
    assert.equal(persistedPayload.policy.defaultProvider, 'moneris');
    assert.equal(persistedPayload.policy.allowCisCaptureTracking, false);
  } finally {
    await runtime.close();
  }
});

test('admin integrations keep CIS provider runtime parked while account payment methods remain configurable', SERIAL, async () => {
  const auth = await createAdminAuth();
  let runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const missingConfigResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/payments`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        captureMode: 'provider_runtime',
        defaultProvider: 'moneris',
        allowCisCaptureTracking: true,
        allowAccountPaymentMethodManagement: true,
      }),
    });

    assert.equal(missingConfigResponse.status, 200);
    const missingConfigPayload = await missingConfigResponse.json();
    assert.equal(missingConfigPayload.policy.captureMode, 'provider_runtime');
    assert.equal(missingConfigPayload.policy.defaultProvider, 'moneris');
    assert.equal(missingConfigPayload.policy.allowCisCaptureTracking, false);
    assert.equal(missingConfigPayload.isConfigured, false);
    assert.ok(missingConfigPayload.configurationIssues.some((issue) => /parked pending the revised card-capture flow/i.test(issue)));

    const missingStatusesResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    const missingStatusesPayload = await missingStatusesResponse.json();
    const missingPaymentStatus = missingStatusesPayload.integrations.find((entry) => entry.key === 'tokenized-payments');
    assert.ok(missingPaymentStatus);
    assert.match(missingPaymentStatus.detail, /parked pending the revised card-capture flow/i);
  } finally {
    await runtime.close();
  }

  process.env.APP_ENCRYPTION_KEY = 'admin-moneris-runtime-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-admin';
  config = loadAppConfig(process.env);

  runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const readyResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/payments`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        captureMode: 'provider_runtime',
        defaultProvider: 'moneris',
        allowCisCaptureTracking: true,
        allowAccountPaymentMethodManagement: true,
      }),
    });

    assert.equal(readyResponse.status, 200);
    const readyPayload = await readyResponse.json();
    assert.equal(readyPayload.policy.captureMode, 'provider_runtime');
    assert.equal(readyPayload.policy.defaultProvider, 'moneris');
    assert.equal(readyPayload.policy.allowCisCaptureTracking, false);
    assert.equal(readyPayload.isConfigured, false);
    assert.ok(readyPayload.configurationIssues.some((issue) => /parked pending the revised card-capture flow/i.test(issue)));

    const statusResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });
    const statusPayload = await statusResponse.json();
    const paymentStatus = statusPayload.integrations.find((entry) => entry.key === 'tokenized-payments');
    assert.ok(paymentStatus);
    assert.equal(paymentStatus.status, 'warning');
    assert.match(paymentStatus.detail, /parked pending the revised card-capture flow/i);
  } finally {
    await runtime.close();
  }
});

test('admin role catalog exposes simple access-profile summaries for CRM setup', SERIAL, async () => {
  const auth = await createAdminAuth();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/access/roles`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    const operationsAdmin = payload.roles.find((entry) => entry.role === 'ADMIN_CSR_OPS');
    assert.ok(operationsAdmin);
    assert.equal(operationsAdmin.displayName, 'Operations Admin');
    assert.match(operationsAdmin.summary, /central operations/i);
    assert.match(operationsAdmin.scopeSummary, /lead and customer workflows/i);
    assert.ok(Array.isArray(operationsAdmin.workspaceHighlights));
    assert.ok(operationsAdmin.workspaceHighlights.includes('admin'));
    assert.ok(Array.isArray(operationsAdmin.actionHighlights));
    assert.ok(operationsAdmin.actionHighlights.includes('admin.user_manage'));
  } finally {
    await runtime.close();
  }
});

test('forbidden admin routes leave an authorization audit trail for the calling actor', SERIAL, async () => {
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { actor: adminActor } = await createAdminActor();

    await createAdminUser(adminActor, {
      email: 'finance.audit+forbidden@dynamicaqs.com',
      firstName: 'Fiona',
      lastName: 'Audit',
      role: 'FINANCE',
      isActive: true,
      password: 'FinanceAudit!123',
    });

    const financeAuth = await loginWithPassword(
      config,
      {
        email: 'finance.audit+forbidden@dynamicaqs.com',
        password: 'FinanceAudit!123',
      },
      {},
    );

    const port = runtime.server.address().port;

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/users`, {
      headers: {
        authorization: `Bearer ${financeAuth.tokens.accessToken}`,
      },
    });

    assert.equal(response.status, 403);

    const auditEntry = await prisma.auditEntry.findFirst({
      where: {
        entityType: 'AUTHORIZATION_ATTEMPT',
        entityId: '/api/v1/admin/users',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    assert.ok(auditEntry);
    assert.equal(auditEntry.action, 'REJECT');
    assert.equal(auditEntry.actorUserId !== null, true);
    assert.equal(auditEntry.metadata?.module, 'admin');
    assert.equal(auditEntry.metadata?.actionKey, 'admin.user_view');
    assert.equal(auditEntry.metadata?.result, 'access_denied');
    assert.equal(auditEntry.metadata?.actorRole, 'FINANCE');
  } finally {
    await runtime.close();
  }
});

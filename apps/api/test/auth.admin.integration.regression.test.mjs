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
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
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
    assert.equal(settingsPayload.policy.allowEmailLinking, true);
    assert.equal(settingsPayload.policy.autoProvisionFromGroups, true);
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

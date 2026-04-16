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
let ensureReferenceDataSeeded;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  process.env.APP_ENCRYPTION_KEY = 'calendar-admin-test-secret';
  process.env.MICROSOFT_ENTRA_TENANT_ID = 'tenant-calendar-admin';
  process.env.MICROSOFT_ENTRA_CLIENT_ID = 'client-calendar-admin';
  process.env.MICROSOFT_ENTRA_CLIENT_SECRET = 'secret-calendar-admin';
  process.env.MICROSOFT_GRAPH_REDIRECT_URI = 'http://localhost:4000/api/v1/integrations/outlook/callback';
  process.env.MICROSOFT_GRAPH_SCOPES = 'openid profile email offline_access User.Read Calendars.ReadWrite Calendars.ReadWrite.Shared';

  config = loadAppConfig(process.env);
  await resetDatabase(prisma);
  await ensureReferenceDataSeeded();
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

test('admin integrations surface Outlook rollout status and calendar settings', SERIAL, async () => {
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
    assert.ok(integrationsPayload.integrations.some((entry) => entry.key === 'outlook-calendar'));

    const settingsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/calendar`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(settingsResponse.status, 200);
    const settingsPayload = await settingsResponse.json();
    assert.equal(settingsPayload.provider, 'outlook');
    assert.equal(settingsPayload.isConfigured, true);
    assert.equal(settingsPayload.policy.allowUserConnections, true);
    assert.equal(settingsPayload.policy.defaultMeetingProvider, 'none');
    assert.equal(settingsPayload.policy.sharedCalendarsEnabled, false);
  } finally {
    await runtime.close();
  }
});

test('admin calendar settings update changes workspace policy and Outlook availability messaging', SERIAL, async () => {
  const auth = await createAdminAuth();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;

    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/calendar`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        allowUserConnections: false,
        sharedCalendarsEnabled: true,
        defaultMeetingProvider: 'teams',
        autoSyncDiscoveryEnabled: false,
        autoSyncTrainingEnabled: true,
        pilotUserEmails: ['admin@pulse.local'],
      }),
    });

    assert.equal(updateResponse.status, 200);
    const updatePayload = await updateResponse.json();
    assert.equal(updatePayload.policy.allowUserConnections, false);
    assert.equal(updatePayload.policy.defaultMeetingProvider, 'teams');
    assert.equal(updatePayload.policy.sharedCalendarsEnabled, true);

    const calendarResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/calendar/workspace?startDate=2026-06-01T00:00:00.000Z&endDate=2026-06-30T23:59:59.999Z`,
      {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      },
    );

    assert.equal(calendarResponse.status, 200);
    const calendarPayload = await calendarResponse.json();
    assert.equal(calendarPayload.outlookConnection.policy.allowUserConnections, false);
    assert.equal(calendarPayload.outlookConnection.policy.defaultMeetingProvider, 'teams');
    assert.equal(calendarPayload.outlookConnection.policy.sharedCalendarsEnabled, true);
    assert.match(String(calendarPayload.outlookConnection.availabilityMessage), /disabled by an administrator/i);

    const connectResponse = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/connect`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(connectResponse.status, 503);
    const connectPayload = await connectResponse.json();
    assert.match(String(connectPayload.detail), /disabled by an administrator/i);
  } finally {
    await runtime.close();
  }
});

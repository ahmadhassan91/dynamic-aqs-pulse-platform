import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureTrainingSeeded;
let createLead;
const SERIAL = { concurrency: false };

let mockOutlook;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
  } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureTrainingSeeded } = await import('../dist/modules/training/service.js'));

  await prisma.$connect();
});

test.after(async () => {
  if (mockOutlook) {
    await mockOutlook.close();
  }

  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureTrainingSeeded();

  mockOutlook = await createMockOutlookServer();
  process.env.APP_ENCRYPTION_KEY = 'calendar-outlook-test-secret';
  process.env.MICROSOFT_ENTRA_TENANT_ID = 'test-tenant';
  process.env.MICROSOFT_ENTRA_CLIENT_ID = 'test-client-id';
  process.env.MICROSOFT_ENTRA_CLIENT_SECRET = 'test-client-secret';
  process.env.MICROSOFT_GRAPH_REDIRECT_URI = 'http://localhost:4000/api/v1/integrations/outlook/callback';
  process.env.MICROSOFT_GRAPH_SCOPES = 'openid profile email offline_access User.Read Calendars.ReadWrite';
  process.env.MICROSOFT_ENTRA_AUTH_BASE_URL = mockOutlook.baseUrl;
  process.env.MICROSOFT_GRAPH_API_BASE_URL = mockOutlook.baseUrl;

  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);
});

test.afterEach(async () => {
  if (mockOutlook) {
    await mockOutlook.close();
    mockOutlook = null;
  }
});

async function createAdminSession() {
  const auth = await loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected bootstrap admin actor');
  return { actor, auth };
}

test('outlook connect route returns authorization URL and callback stores encrypted mailbox tokens', SERIAL, async () => {
  const { auth } = await createAdminSession();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;
    const connectResponse = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/connect`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(connectResponse.status, 200);
    const connectPayload = await connectResponse.json();
    assert.equal(connectPayload.provider, 'outlook');
    const authUrl = new URL(connectPayload.authorizationUrl);
    const state = authUrl.searchParams.get('state');
    assert.ok(state, 'expected authorization state');

    const callbackResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/integrations/outlook/callback?code=test-auth-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' },
    );

    assert.equal(callbackResponse.status, 302);
    assert.match(callbackResponse.headers.get('location') ?? '', /\/calendar\?outlook=connected/);

    const connection = await prisma.calendarConnection.findFirst({
      where: {
        provider: 'OUTLOOK',
      },
    });

    assert.ok(connection, 'expected saved outlook connection');
    assert.equal(connection.providerEmail, 'trainer@test.local');
    assert.notEqual(connection.accessTokenEncrypted, 'access-token-1');
    assert.notEqual(connection.refreshTokenEncrypted, 'refresh-token-1');
  } finally {
    await runtime.close();
  }
});

test('outlook sync creates event binding and refreshes the token when expired', SERIAL, async () => {
  const { actor, auth } = await createAdminSession();
  const lead = await createLead(actor, {
    companyName: 'Outlook Discovery Dealer',
    serviceTechCount: 3,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-08-01T15:00:00.000Z'),
      discoverySummary: 'Calendar sync regression discovery.',
    },
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;
    const connectPayload = await (
      await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/connect`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      })
    ).json();

    const state = new URL(connectPayload.authorizationUrl).searchParams.get('state');
    assert.ok(state);

    await fetch(
      `http://127.0.0.1:${port}/api/v1/integrations/outlook/callback?code=seed-code&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' },
    );

    const firstSync = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/events/sync`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sourceModule: 'leads',
        sourceRecordId: lead.id,
        eventType: 'discovery_call',
      }),
    });

    assert.equal(firstSync.status, 200);
    const firstPayload = await firstSync.json();
    assert.equal(firstPayload.externalEventId, 'evt-1');
    assert.equal(mockOutlook.eventCreates.length, 1);

    const connection = await prisma.calendarConnection.findFirstOrThrow({
      where: {
        provider: 'OUTLOOK',
      },
    });

    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    const secondSync = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/events/sync`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sourceModule: 'leads',
        sourceRecordId: lead.id,
        eventType: 'discovery_call',
      }),
    });

    assert.equal(secondSync.status, 200);
    assert.equal(mockOutlook.tokenRefreshCount, 1);
    assert.equal(mockOutlook.eventUpdates.length, 1);

    const binding = await prisma.calendarEventBinding.findFirst({
      where: {
        sourceModule: 'leads',
        sourceRecordId: lead.id,
        eventType: 'discovery_call',
      },
    });
    assert.ok(binding, 'expected event binding to be created');
    assert.equal(binding.externalEventId, 'evt-1');
  } finally {
    await runtime.close();
  }
});

test('outlook callback rejects unrecognized state and does not create a connection', SERIAL, async () => {
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;
    const callbackResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/integrations/outlook/callback?code=test-auth-code&state=bad-state`,
      { redirect: 'manual' },
    );

    assert.equal(callbackResponse.status, 302);
    assert.match(callbackResponse.headers.get('location') ?? '', /outlook=error/);

    const count = await prisma.calendarConnection.count();
    assert.equal(count, 0);
  } finally {
    await runtime.close();
  }
});

test('outlook connect route returns 503 when configuration is missing', SERIAL, async () => {
  delete process.env.MICROSOFT_ENTRA_CLIENT_SECRET;
  config = loadAppConfig(process.env);
  await ensureBootstrapAdminSeeded(config);
  const { auth } = await createAdminSession();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const port = runtime.server.address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/connect`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(response.status, 503);
  } finally {
    await runtime.close();
  }
});

async function createMockOutlookServer() {
  const state = {
    tokenRefreshCount: 0,
    eventCreates: [],
    eventUpdates: [],
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const pathname = url.pathname;

    if (pathname.endsWith('/oauth2/v2.0/token') && req.method === 'POST') {
      const bodyText = await readBody(req);
      const body = new URLSearchParams(bodyText);
      const grantType = body.get('grant_type');

      if (grantType === 'refresh_token') {
        state.tokenRefreshCount += 1;
        return json(res, 200, {
          access_token: 'access-token-2',
          refresh_token: 'refresh-token-1',
          expires_in: 3600,
          scope: body.get('scope'),
        });
      }

      return json(res, 200, {
        access_token: 'access-token-1',
        refresh_token: 'refresh-token-1',
        expires_in: 3600,
        scope: body.get('scope'),
      });
    }

    if (pathname === '/me' && req.method === 'GET') {
      return json(res, 200, {
        id: 'outlook-user-1',
        mail: 'trainer@test.local',
        userPrincipalName: 'trainer@test.local',
      });
    }

    if (pathname === '/me/events' && req.method === 'POST') {
      state.eventCreates.push(JSON.parse(await readBody(req)));
      return json(res, 200, {
        id: 'evt-1',
        webLink: 'https://outlook.test/events/evt-1',
      });
    }

    if (pathname === '/me/events/evt-1' && req.method === 'PATCH') {
      state.eventUpdates.push(JSON.parse(await readBody(req)));
      return json(res, 200, {
        id: 'evt-1',
        webLink: 'https://outlook.test/events/evt-1',
      });
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  return {
    get tokenRefreshCount() {
      return state.tokenRefreshCount;
    },
    get eventCreates() {
      return state.eventCreates;
    },
    get eventUpdates() {
      return state.eventUpdates;
    },
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

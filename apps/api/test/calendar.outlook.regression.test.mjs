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
let scheduleLeadDiscovery;
let createTrainingSession;
let rescheduleTrainingSession;
let cancelTrainingSession;
let updateOutlookConnection;
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
    scheduleLeadDiscovery,
  } = await import('../dist/modules/leads/service.js'));

  createLead = ((rawCreateLead) => (actor, input, ...rest) => {
    const hasExplicitClassification = input.affinityGroupSelection !== undefined
      || input.affinityGroupId !== undefined
      || input.affinityGroupCode !== undefined
      || input.affinityGroupName !== undefined
      || input.ownershipGroupSelection !== undefined
      || input.ownershipGroupId !== undefined
      || input.ownershipGroupCode !== undefined
      || input.ownershipGroupName !== undefined;

    return rawCreateLead(actor, hasExplicitClassification
      ? input
      : {
          affinityGroupSelection: 'none',
          ownershipGroupSelection: 'none',
          ...input,
        }, ...rest);
  })(createLead);
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    ensureTrainingSeeded,
    createTrainingSession,
    rescheduleTrainingSession,
    cancelTrainingSession,
  } = await import('../dist/modules/training/service.js'));
  ({ updateOutlookConnection } = await import('../dist/modules/calendar/outlook.js'));

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

async function connectOutlookForRuntime(runtime, auth) {
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

  return { port };
}

async function updateCalendarAdminPolicy(port, auth, input) {
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/integrations/calendar`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${auth.tokens.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  assert.equal(response.status, 200);
  return response.json();
}

async function createTrainingAccountFixture(suffix = 'calendar-sync') {
  const segment = await prisma.businessSegmentRef.findFirst({
    where: { code: 'residential' },
  });

  const tm = await prisma.user.create({
    data: {
      email: `tm-${suffix}@pulse.local`,
      displayName: `TM ${suffix}`,
      roleCode: 'TERRITORY_MANAGER',
    },
  });
  const rd = await prisma.user.create({
    data: {
      email: `rd-${suffix}@pulse.local`,
      displayName: `RD ${suffix}`,
      roleCode: 'REGIONAL_DIRECTOR',
    },
  });
  const trainer = await prisma.user.create({
    data: {
      email: `trainer-${suffix}@pulse.local`,
      displayName: `Trainer ${suffix}`,
      roleCode: 'TRAINING_OPS',
      trainingTrainerProfile: {
        create: {
          isActive: true,
        },
      },
    },
  });

  const account = await prisma.account.create({
    data: {
      displayName: `Calendar Training Account ${suffix}`,
      legalName: `Calendar Training Account ${suffix} LLC`,
      accountType: 'Dealer',
      businessSegmentId: segment?.id ?? null,
      lifecycleStatus: 'ACTIVE',
      isActive: true,
      assignedTmUserId: tm.id,
      assignedRdUserId: rd.id,
    },
  });

  return { account, trainer };
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

test('outlook sync rolls back the orphan Graph event when the binding write fails, so a retry does not duplicate', SERIAL, async () => {
  const { actor, auth } = await createAdminSession();
  const lead = await createLead(actor, {
    companyName: 'Outlook Orphan Dealer',
    serviceTechCount: 3,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-08-01T15:00:00.000Z'),
      discoverySummary: 'Orphan rollback regression discovery.',
    },
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  const originalTransaction = prisma.$transaction.bind(prisma);
  try {
    const { port } = await connectOutlookForRuntime(runtime, auth);

    const syncOnce = () => fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/events/sync`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sourceModule: 'leads', sourceRecordId: lead.id, eventType: 'discovery_call' }),
    });

    // One-shot failure of the binding-persist transaction. Gating on "a Graph event was already created" makes
    // this robust to any earlier transaction in the sync path: only the post-create binding write fails, then
    // the original $transaction is restored so the outer catch can still record lastSyncError.
    prisma.$transaction = (...args) => {
      if (mockOutlook.eventCreates.length > 0) {
        prisma.$transaction = originalTransaction;
        return Promise.reject(new Error('Simulated binding-persist failure'));
      }
      return originalTransaction(...args);
    };

    const firstSync = await syncOnce();
    assert.notEqual(firstSync.status, 200, 'sync must fail when the binding write fails');

    // The Graph event was created, then rolled back (deleted) — no orphan, no binding.
    assert.equal(mockOutlook.eventCreates.length, 1, 'one Graph event created on the first attempt');
    assert.equal(mockOutlook.eventDeletes.length, 1, 'the orphan Graph event must be deleted on binding failure');
    assert.equal(mockOutlook.eventDeletes[0].path, '/me/events/evt-1');
    assert.equal(
      await prisma.calendarEventBinding.count({
        where: { sourceModule: 'leads', sourceRecordId: lead.id, eventType: 'discovery_call' },
      }),
      0,
      'no binding should persist when the transaction failed',
    );

    // Retry: a fresh event is created (NOT a duplicate of the deleted orphan) and bound exactly once.
    const secondSync = await syncOnce();
    assert.equal(secondSync.status, 200);
    const secondPayload = await secondSync.json();
    assert.equal(secondPayload.externalEventId, 'evt-2');
    assert.equal(mockOutlook.eventCreates.length, 2);
    assert.equal(mockOutlook.eventDeletes.length, 1, 'no extra deletes on the successful retry');

    const bindings = await prisma.calendarEventBinding.findMany({
      where: { sourceModule: 'leads', sourceRecordId: lead.id, eventType: 'discovery_call' },
    });
    assert.equal(bindings.length, 1, 'exactly one binding after retry — no duplicate');
    assert.equal(bindings[0].externalEventId, 'evt-2', 'binding points to the live event, not the deleted orphan');
  } finally {
    prisma.$transaction = originalTransaction;
    await runtime.close();
  }
});

test('outlook settings list available calendars and persist target calendar plus meeting preference', SERIAL, async () => {
  const { actor, auth } = await createAdminSession();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = await connectOutlookForRuntime(runtime, auth);
    await updateCalendarAdminPolicy(port, auth, {
      sharedCalendarsEnabled: true,
      pilotUserEmails: ['admin@pulse.local'],
    });

    const calendarsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/calendars`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(calendarsResponse.status, 200);
    const calendarsPayload = await calendarsResponse.json();
    assert.equal(calendarsPayload.items.length, 2);
    assert.equal(calendarsPayload.items[1].id, 'shared-team');

    const settingsResponse = await fetch(`http://127.0.0.1:${port}/api/v1/calendar/outlook/connection`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        targetCalendarId: 'shared-team',
        meetingProvider: 'teams',
      }),
    });

    assert.equal(settingsResponse.status, 200);
    const settingsPayload = await settingsResponse.json();
    assert.equal(settingsPayload.targetCalendarId, 'shared-team');
    assert.equal(settingsPayload.targetCalendarName, 'Shared Sales Calendar');
    assert.equal(settingsPayload.meetingProvider, 'teams');

    const connection = await prisma.calendarConnection.findFirstOrThrow({
      where: { provider: 'OUTLOOK' },
    });
    assert.equal(connection.targetCalendarId, 'shared-team');
    assert.equal(connection.meetingProviderPreference, 'TEAMS');

    await updateOutlookConnection(actor, config, {
      targetCalendarId: null,
      meetingProvider: 'none',
    });

    const resetConnection = await prisma.calendarConnection.findFirstOrThrow({
      where: { provider: 'OUTLOOK' },
    });
    assert.equal(resetConnection.targetCalendarId, null);
    assert.equal(resetConnection.meetingProviderPreference, 'NONE');
  } finally {
    await runtime.close();
  }
});

test('lead discovery scheduling auto-syncs into the selected Outlook calendar with a Teams link', SERIAL, async () => {
  const { actor, auth } = await createAdminSession();
  const lead = await createLead(actor, {
    companyName: 'Outlook Auto Discovery Dealer',
    serviceTechCount: 4,
    state: 'TX',
  });

  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = await connectOutlookForRuntime(runtime, auth);
    await updateCalendarAdminPolicy(port, auth, {
      sharedCalendarsEnabled: true,
      defaultMeetingProvider: 'teams',
      pilotUserEmails: ['admin@pulse.local'],
    });
    await updateOutlookConnection(actor, config, {
      targetCalendarId: 'shared-team',
      meetingProvider: 'teams',
    });

    await scheduleLeadDiscovery(actor, lead.id, { note: 'Auto-sync discovery' }, config);

    assert.equal(mockOutlook.eventCreates.length, 1);
    assert.equal(mockOutlook.eventCreates[0].path, '/me/calendars/shared-team/events');
    assert.equal(mockOutlook.eventCreates[0].body.isOnlineMeeting, true);
    assert.equal(mockOutlook.eventCreates[0].body.onlineMeetingProvider, 'teamsForBusiness');

    const binding = await prisma.calendarEventBinding.findFirstOrThrow({
      where: {
        sourceModule: 'leads',
        sourceRecordId: lead.id,
      },
    });
    assert.equal(binding.targetCalendarId, 'shared-team');
    assert.equal(binding.meetingProvider, 'TEAMS');
    assert.equal(binding.externalMeetingJoinUrl, 'https://teams.test/join/evt-1');
  } finally {
    await runtime.close();
  }
});

test('training session auto-syncs on create and reschedule, then removes the provider event on cancellation', SERIAL, async () => {
  const { actor, auth } = await createAdminSession();
  const runtime = await createPulseServer(config);
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    await connectOutlookForRuntime(runtime, auth);
    await updateOutlookConnection(actor, config, {
      meetingProvider: 'teams',
    });

    const { account, trainer } = await createTrainingAccountFixture();
    const trainingType = await prisma.trainingType.findFirstOrThrow({
      where: { deliveryMode: 'VIRTUAL' },
    });

    const session = await createTrainingSession(actor, account.id, {
      trainerUserId: trainer.id,
      trainingTypeId: trainingType.id,
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 90,
      title: 'Auto Outlook Training',
    }, config);

    assert.equal(mockOutlook.eventCreates.length, 1);
    assert.equal(mockOutlook.eventCreates[0].path, '/me/events');
    assert.equal(mockOutlook.eventCreates[0].body.isOnlineMeeting, true);

    const rescheduled = await rescheduleTrainingSession(actor, session.id, {
      scheduledAt: new Date(Date.now() + 172_800_000).toISOString(),
      title: 'Auto Outlook Training - Rescheduled',
    }, config);

    assert.equal(mockOutlook.eventUpdates.length, 1);
    assert.equal(mockOutlook.eventUpdates[0].path, '/me/events/evt-1');
    assert.equal(rescheduled.title, 'Auto Outlook Training - Rescheduled');

    await cancelTrainingSession(actor, session.id, {
      status: 'cancelled',
      notes: 'Cancelled for regression coverage',
    }, config);

    assert.equal(mockOutlook.eventDeletes.length, 1);
    const bindingCount = await prisma.calendarEventBinding.count({
      where: { sourceModule: 'training', sourceRecordId: session.id },
    });
    assert.equal(bindingCount, 0);
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
    eventDeletes: [],
    nextEventId: 1,
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

    if (pathname === '/me/calendars' && req.method === 'GET') {
      return json(res, 200, {
        value: [
          {
            id: 'primary-calendar',
            name: 'Calendar',
            canEdit: true,
            canShare: true,
            isDefaultCalendar: true,
            owner: {
              name: 'Trainer Test',
              address: 'trainer@test.local',
            },
            allowedOnlineMeetingProviders: ['teamsForBusiness'],
          },
          {
            id: 'shared-team',
            name: 'Shared Sales Calendar',
            canEdit: true,
            canShare: true,
            isDefaultCalendar: false,
            owner: {
              name: 'Sales Team',
              address: 'sales@test.local',
            },
            allowedOnlineMeetingProviders: ['teamsForBusiness'],
          },
        ],
      });
    }

    const createEventMatch = pathname.match(/^\/me(?:\/calendars\/([^/]+))?\/events$/);
    if (createEventMatch && req.method === 'POST') {
      const body = JSON.parse(await readBody(req));
      state.eventCreates.push({
        path: pathname,
        body,
      });
      const eventId = `evt-${state.nextEventId++}`;
      return json(res, 200, {
        id: eventId,
        webLink: `https://outlook.test/events/${eventId}`,
        ...(body.isOnlineMeeting
          ? {
              onlineMeeting: {
                joinUrl: `https://teams.test/join/${eventId}`,
              },
            }
          : {}),
      });
    }

    const updateEventMatch = pathname.match(/^\/me\/events\/([^/]+)$/);
    if (updateEventMatch && req.method === 'PATCH') {
      const body = JSON.parse(await readBody(req));
      const eventId = updateEventMatch[1];
      state.eventUpdates.push({
        path: pathname,
        body,
      });
      return json(res, 200, {
        id: eventId,
        webLink: `https://outlook.test/events/${eventId}`,
        ...(body.isOnlineMeeting
          ? {
              onlineMeeting: {
                joinUrl: `https://teams.test/join/${eventId}`,
              },
            }
          : {}),
      });
    }

    if (updateEventMatch && req.method === 'DELETE') {
      state.eventDeletes.push({
        path: pathname,
      });
      res.statusCode = 204;
      res.end();
      return;
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
    get eventDeletes() {
      return state.eventDeletes;
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

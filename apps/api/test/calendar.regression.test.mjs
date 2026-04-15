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
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureTrainingSeeded;
let createLead;
let createTrainingSession;
let getCalendarWorkspace;
const SERIAL = { concurrency: false };

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
  ({
    ensureTrainingSeeded,
    createTrainingSession,
  } = await import('../dist/modules/training/service.js'));
  ({ getCalendarWorkspace } = await import('../dist/modules/calendar/service.js'));

  config = loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
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
  await ensureBootstrapAdminSeeded(config);
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

function actorWithRole(actor, role) {
  return {
    ...actor,
    role,
  };
}

async function createTrainingAccountFixture(suffix = 'calendar') {
  const segment = await prisma.businessSegmentRef.findFirst({
    where: { code: 'residential' },
  });

  const tm = await prisma.user.create({
    data: {
      email: `tm-${suffix}@pulse.local`,
      displayName: `TM ${suffix}`,
      roleCode: 'TERRITORY_MANAGER',
      trainingTrainerProfile: {
        create: {
          isActive: true,
        },
      },
    },
  });

  const rd = await prisma.user.create({
    data: {
      email: `rd-${suffix}@pulse.local`,
      displayName: `RD ${suffix}`,
      roleCode: 'REGIONAL_DIRECTOR',
    },
  });

  const account = await prisma.account.create({
    data: {
      displayName: `Calendar Account ${suffix}`,
      legalName: `Calendar Account ${suffix} LLC`,
      accountType: 'Dealer',
      businessSegmentId: segment?.id ?? null,
      assignedTmUserId: tm.id,
      assignedRdUserId: rd.id,
      isActive: true,
    },
  });

  return { account, tm, rd };
}

test('calendar workspace route returns centralized discovery and training events', SERIAL, async () => {
  const { actor, auth } = await createAdminSession();

  const lead = await createLead(actor, {
    companyName: 'Calendar Discovery HVAC',
    serviceTechCount: 4,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-06-10T15:00:00.000Z'),
      discoverySummary: 'Discovery scheduled from centralized calendar suite.',
    },
  });

  const fixture = await createTrainingAccountFixture('route');
  const onboardingType = await prisma.trainingType.findUnique({
    where: { code: 'onboarding' },
  });

  assert.ok(onboardingType, 'expected seeded onboarding training type');

  await createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    trainingTypeId: onboardingType.id,
    trainerUserId: fixture.tm.id,
    scheduledAt: '2026-06-12T16:00:00.000Z',
    durationMinutes: 90,
    attendeeCount: 5,
    title: 'Onboarding Web Session',
  });

  const runtime = await createPulseServer(loadAppConfig(process.env));
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const address = runtime.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/calendar/workspace?startDate=2026-06-01T00:00:00.000Z&endDate=2026-06-30T23:59:59.999Z`,
      {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      },
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.summary.totalEvents, 2);
    assert.equal(payload.outlookConnection.isConfigured, false);
    assert.equal(payload.summary.discoveryCallCount, 1);
    assert.equal(payload.summary.virtualTrainingCount, 1);
    assert.equal(payload.items[0].eventType, 'discovery_call');
    assert.equal(payload.items[1].eventType, 'virtual_training');
  } finally {
    await runtime.close();
  }
});

test('calendar workspace classifies completed site visits separately from training', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture('visit');
  const visitType = await prisma.trainingType.findUnique({
    where: { code: 'site_visit' },
  });

  assert.ok(visitType, 'expected seeded site visit type');

  await prisma.trainingSession.create({
    data: {
      accountId: fixture.account.id,
      trainingTypeId: visitType.id,
      trainerUserId: fixture.tm.id,
      activityKind: 'SITE_VISIT',
      status: 'COMPLETED',
      title: 'Quarterly Ride Along',
      completedAt: new Date('2026-07-02T14:00:00.000Z'),
      durationMinutes: 120,
      attendeeCount: 2,
      notes: 'Field visit completed with ride-along notes.',
    },
  });

  const workspace = await getCalendarWorkspace(actor, {
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-31T23:59:59.999Z',
  }, config);

  assert.equal(workspace.summary.onSiteVisitCount, 1);
  assert.equal(workspace.outlookConnection.isConfigured, false);
  assert.equal(workspace.summary.completedCount, 1);
  assert.equal(workspace.items[0]?.eventType, 'on_site_visit');
  assert.equal(workspace.items[0]?.status, 'completed');
});

test('calendar workspace requires auth on the route and rejects oversized ranges', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const runtime = await createPulseServer(loadAppConfig(process.env));
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const address = runtime.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const unauthenticated = await fetch(
      `http://127.0.0.1:${port}/api/v1/calendar/workspace?startDate=2026-06-01T00:00:00.000Z&endDate=2026-06-30T23:59:59.999Z`,
    );

    assert.equal(unauthenticated.status, 401);
  } finally {
    await runtime.close();
  }

  await assert.rejects(
    () =>
      getCalendarWorkspace(actor, {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      }),
    /cannot exceed 180 days/i,
  );
});

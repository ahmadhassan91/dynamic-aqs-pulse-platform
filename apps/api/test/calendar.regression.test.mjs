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
let createAdminUser;
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
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ createAdminUser } = await import('../dist/modules/admin/service.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
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

  const actor = {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Pulse Bootstrap Admin',
  };
  return { actor, auth };
}

async function createScopedActor(role, email, displayName) {
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      roleCode: role,
      userType: 'INTERNAL',
      isActive: true,
    },
  });

  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

async function createInternalRoleSession(role, email) {
  const { actor: adminActor } = await createAdminSession();
  const password = 'CalendarRole!234';

  const created = await createAdminUser(adminActor, {
    email,
    firstName: 'Calendar',
    lastName: 'Ops',
    role,
    password,
    isActive: true,
  });

  const auth = await loginWithPassword(
    config,
    {
      email,
      password: created.temporaryPassword,
    },
    {},
  );

  const actor = {
    userId: created.user.id,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? created.user.displayName,
  };

  return { auth, actor };
}

function actorWithRole(actor, role) {
  return {
    ...actor,
    role,
  };
}

async function createTrainingAccountFixture(suffix = 'calendar') {
  await ensureReferenceDataSeeded();
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

test('calendar workspace returns centralized discovery and training events', SERIAL, async () => {
  const { actor } = await createAdminSession();

  // Relative dates so the scenario never rots: discovery before training, both in the future
  // (createTrainingSession rejects past scheduledAt), and a query window that spans both.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const discoveryAt = new Date(Date.now() + 7 * DAY_MS);
  const trainingAt = new Date(Date.now() + 9 * DAY_MS);
  const windowStart = new Date(Date.now() + 1 * DAY_MS).toISOString();
  const windowEnd = new Date(Date.now() + 20 * DAY_MS).toISOString();

  const lead = await createLead(actor, {
    companyName: 'Calendar Discovery HVAC',
    serviceTechCount: 4,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: discoveryAt,
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
    scheduledAt: trainingAt.toISOString(),
    durationMinutes: 90,
    attendeeCount: 5,
    title: 'Onboarding Web Session',
  });

  const payload = await getCalendarWorkspace(actor, {
    startDate: windowStart,
    endDate: windowEnd,
  }, config);

  assert.equal(payload.summary.totalEvents, 2);
  assert.equal(payload.outlookConnection.isConfigured, false);
  assert.equal(payload.summary.discoveryCallCount, 1);
  assert.equal(payload.summary.virtualTrainingCount, 1);
  assert.equal(payload.items[0].eventType, 'discovery_call');
  assert.equal(payload.items[1].eventType, 'virtual_training');
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

test('calendar workspace only returns event families the actor can access', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const lead = await createLead(actor, {
    companyName: 'Scoped Discovery HVAC',
    serviceTechCount: 4,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-08-10T15:00:00.000Z'),
    },
  });

  const fixture = await createTrainingAccountFixture('scope');
  const onboardingType = await prisma.trainingType.findUnique({
    where: { code: 'onboarding' },
  });

  assert.ok(onboardingType, 'expected seeded onboarding training type');

  await createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    trainingTypeId: onboardingType.id,
    trainerUserId: fixture.tm.id,
    scheduledAt: '2026-08-12T16:00:00.000Z',
    durationMinutes: 90,
    attendeeCount: 5,
    title: 'Scoped Training Session',
  });

  const adminCsrAuth = await createInternalRoleSession('ADMIN_CSR_OPS', 'calendar-admin-csr@pulse.local');
  const trainingOpsAuth = await createInternalRoleSession('TRAINING_OPS', 'calendar-training-ops@pulse.local');

  const adminCsrActor = adminCsrAuth.actor;
  const trainingOpsActor = trainingOpsAuth.actor;

  assert.ok(adminCsrActor, 'expected ADMIN_CSR_OPS actor');
  assert.ok(trainingOpsActor, 'expected TRAINING_OPS actor');

  const adminCsrWorkspace = await getCalendarWorkspace(adminCsrActor, {
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-31T23:59:59.999Z',
  }, config);

  assert.equal(adminCsrWorkspace.summary.discoveryCallCount, 1);
  assert.equal(adminCsrWorkspace.summary.virtualTrainingCount, 0);
  assert.deepEqual(adminCsrWorkspace.items.map((item) => item.eventType), ['discovery_call']);

  const trainingOpsWorkspace = await getCalendarWorkspace(trainingOpsActor, {
    startDate: '2026-08-01T00:00:00.000Z',
    endDate: '2026-08-31T23:59:59.999Z',
  }, config);

  assert.equal(trainingOpsWorkspace.summary.discoveryCallCount, 0);
  assert.equal(trainingOpsWorkspace.summary.virtualTrainingCount, 1);
  assert.deepEqual(trainingOpsWorkspace.items.map((item) => item.eventType), ['virtual_training']);
});

test('calendar workspace emits durable consignment audit events only for consignment-authorized roles', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture('consignment-durable');

  const site = await prisma.consignmentSite.create({
    data: {
      accountId: fixture.account.id,
      name: 'Calendar Durable Consignment Site',
      status: 'ACTIVE',
      acumaticaStatus: 'PARKED',
      warehouseCode: 'CAL-DURABLE',
      baselineEstablishedAt: new Date('2026-05-01T14:00:00.000Z'),
      nextAuditDueAt: new Date('2026-08-01T14:00:00.000Z'),
      ownerTmUserId: fixture.tm.id,
      ownerRdUserId: fixture.rd.id,
      primaryContactName: 'Durable Contact',
      primaryContactEmail: 'durable-consignment@example.test',
      notes: 'Durable site notes should flow into the calendar only through consignment records.',
    },
  });

  const audit = await prisma.consignmentAudit.create({
    data: {
      siteId: site.id,
      scheduledFor: new Date('2026-08-01T14:00:00.000Z'),
      notes: 'Durable ROSE audit scheduled from the consignment audit table.',
    },
  });

  const adminWorkspace = await getCalendarWorkspace(actor, {
    startDate: '2026-07-30T00:00:00.000Z',
    endDate: '2026-08-01T23:59:59.999Z',
  }, config);

  assert.equal(adminWorkspace.summary.consignmentAuditCount, 1);
  assert.equal(adminWorkspace.items[0]?.eventType, 'consignment_audit');
  assert.equal(adminWorkspace.items[0]?.sourceModule, 'consignment');
  assert.equal(adminWorkspace.items[0]?.sourceRecordId, audit.id);
  assert.equal(adminWorkspace.items[0]?.sourcePath, `/consignment/sites/${site.id}`);
  assert.equal(adminWorkspace.items[0]?.accountId, fixture.account.id);
  assert.equal(adminWorkspace.items[0]?.accountName, fixture.account.displayName);
  assert.equal(adminWorkspace.items[0]?.contactName, 'Durable Contact');
  assert.match(adminWorkspace.items[0]?.notes ?? '', /Durable ROSE audit/);

  const trainingOpsAuth = await createInternalRoleSession('TRAINING_OPS', 'calendar-consignment-training-ops@pulse.local');
  const trainingOpsWorkspace = await getCalendarWorkspace(trainingOpsAuth.actor, {
    startDate: '2026-07-30T00:00:00.000Z',
    endDate: '2026-08-01T23:59:59.999Z',
  }, config);

  assert.equal(trainingOpsWorkspace.summary.consignmentAuditCount, 0);
  assert.deepEqual(trainingOpsWorkspace.items.map((item) => item.eventType), []);
});

test('calendar workspace keeps lead-backed consignment audit hints only when no durable site exists', SERIAL, async () => {
  const { actor } = await createAdminSession();

  const lead = await createLead(actor, {
    companyName: 'Consignment Hint HVAC',
    serviceTechCount: 6,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      stage: 'ONBOARDING_COMPLETED',
      onboardingCompletedAt: new Date('2026-05-01T14:00:00.000Z'),
      consignmentInterestStatus: 'APPROVED',
      consignmentEntryTiming: 'AT_ONBOARDING',
      assignedTmName: 'Assigned TM',
    },
  });

  const workspace = await getCalendarWorkspace(actor, {
    startDate: '2026-07-30T00:00:00.000Z',
    endDate: '2026-08-01T23:59:59.999Z',
  }, config);

  assert.equal(workspace.summary.consignmentAuditCount, 1);
  assert.equal(workspace.items[0]?.eventType, 'consignment_audit');
  assert.equal(workspace.items[0]?.sourceModule, 'leads');
  assert.match(workspace.items[0]?.notes ?? '', /Lead-backed consignment audit hint/);
});

test('calendar workspace applies simple territory-owned scope for territory managers', SERIAL, async () => {
  const admin = await createAdminSession();
  await prisma.territoryPolicy.update({
    where: { id: 'default' },
    data: { preHandoffTmVisibility: true },
  });
  const tmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.scope.calendar@pulse.local', 'TM Scoped Calendar');
  const otherTmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.other.calendar@pulse.local', 'TM Other Calendar');
  const rdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.scope.calendar@pulse.local', 'RD Scoped Calendar');

  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const region = await prisma.region.create({
    data: {
      code: 'rg_scope_calendar',
      name: 'Scoped Calendar Region',
      directorUserId: rdActor.userId,
      isActive: true,
    },
  });

  const ownedTerritory = await prisma.territory.create({
    data: {
      code: 'tm_owned_calendar',
      name: 'TM Owned Calendar Territory',
      regionId: region.id,
      managerUserId: tmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const otherTerritory = await prisma.territory.create({
    data: {
      code: 'tm_other_calendar',
      name: 'TM Other Calendar Territory',
      regionId: region.id,
      managerUserId: otherTmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const visibleLead = await createLead(admin.actor, {
    companyName: 'Scoped Calendar Visible Lead',
    serviceTechCount: 3,
    state: 'TX',
  });
  const hiddenLead = await createLead(admin.actor, {
    companyName: 'Scoped Calendar Hidden Lead',
    serviceTechCount: 3,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: visibleLead.id },
    data: {
      territory: {
        connect: {
          id: ownedTerritory.id,
        },
      },
      assignedTmUser: {
        connect: {
          id: tmActor.userId,
        },
      },
      assignedTmName: tmActor.displayName,
      assignedRdUser: {
        connect: {
          id: rdActor.userId,
        },
      },
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-09-10T15:00:00.000Z'),
    },
  });

  await prisma.lead.update({
    where: { id: hiddenLead.id },
    data: {
      territory: {
        connect: {
          id: otherTerritory.id,
        },
      },
      assignedTmUser: {
        connect: {
          id: otherTmActor.userId,
        },
      },
      assignedTmName: otherTmActor.displayName,
      assignedRdUser: {
        connect: {
          id: rdActor.userId,
        },
      },
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-09-11T15:00:00.000Z'),
    },
  });

  const segment = await prisma.businessSegmentRef.findFirst({
    where: { code: 'residential' },
  });
  const account = await prisma.account.create({
    data: {
      displayName: 'Scoped Calendar Training Account',
      legalName: 'Scoped Calendar Training Account LLC',
      accountType: 'Dealer',
      businessSegmentId: segment?.id ?? null,
      territoryId: ownedTerritory.id,
      assignedTmUserId: tmActor.userId,
      assignedRdUserId: rdActor.userId,
      isActive: true,
    },
  });

  const onboardingType = await prisma.trainingType.findUnique({
    where: { code: 'onboarding' },
  });
  assert.ok(onboardingType, 'expected seeded onboarding training type');

  await createTrainingSession({ ...admin.actor, role: 'TRAINING_OPS' }, account.id, {
    trainingTypeId: onboardingType.id,
    trainerUserId: tmActor.userId,
    scheduledAt: '2026-09-12T16:00:00.000Z',
    durationMinutes: 90,
    attendeeCount: 5,
    title: 'Scoped Calendar Training Session',
  });

  const workspace = await getCalendarWorkspace(tmActor, {
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2026-09-30T23:59:59.999Z',
  }, config);

  assert.equal(workspace.summary.totalEvents, 2);
  assert.equal(workspace.summary.discoveryCallCount, 1);
  assert.equal(workspace.summary.virtualTrainingCount, 1);
  assert.deepEqual(
    workspace.items.map((item) => item.title),
    ['Discovery Call — Scoped Calendar Visible Lead', 'Scoped Calendar Training Session'],
  );
});

test('calendar workspace lets regional directors see events across territories in directed regions only', SERIAL, async () => {
  const admin = await createAdminSession();
  const rdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.region.calendar@pulse.local', 'RD Region Calendar');
  const otherRdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.hidden.calendar@pulse.local', 'RD Hidden Calendar');
  const tmOne = await createScopedActor('TERRITORY_MANAGER', 'tm.one.calendar@pulse.local', 'TM One Calendar');
  const tmTwo = await createScopedActor('TERRITORY_MANAGER', 'tm.two.calendar@pulse.local', 'TM Two Calendar');

  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const ownedRegion = await prisma.region.create({
    data: {
      code: 'rg_rd_calendar',
      name: 'RD Calendar Region',
      directorUserId: rdActor.userId,
      isActive: true,
    },
  });

  const hiddenRegion = await prisma.region.create({
    data: {
      code: 'rg_hidden_calendar',
      name: 'Hidden Calendar Region',
      directorUserId: otherRdActor.userId,
      isActive: true,
    },
  });

  const visibleTerritoryOne = await prisma.territory.create({
    data: {
      code: 'rd_calendar_one',
      name: 'RD Calendar One',
      regionId: ownedRegion.id,
      managerUserId: tmOne.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const visibleTerritoryTwo = await prisma.territory.create({
    data: {
      code: 'rd_calendar_two',
      name: 'RD Calendar Two',
      regionId: ownedRegion.id,
      managerUserId: tmTwo.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const hiddenTerritory = await prisma.territory.create({
    data: {
      code: 'rd_calendar_hidden',
      name: 'RD Calendar Hidden',
      regionId: hiddenRegion.id,
      managerUserId: tmTwo.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const firstLead = await createLead(admin.actor, {
    companyName: 'RD Calendar Visible Lead One',
    serviceTechCount: 3,
    state: 'TX',
  });
  const secondLead = await createLead(admin.actor, {
    companyName: 'RD Calendar Visible Lead Two',
    serviceTechCount: 3,
    state: 'TX',
  });
  const hiddenLead = await createLead(admin.actor, {
    companyName: 'RD Calendar Hidden Lead',
    serviceTechCount: 3,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: firstLead.id },
    data: {
      territoryId: visibleTerritoryOne.id,
      assignedTmUserId: tmOne.userId,
      assignedTmName: tmOne.displayName,
      assignedRdUserId: rdActor.userId,
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-10-10T15:00:00.000Z'),
    },
  });

  await prisma.lead.update({
    where: { id: secondLead.id },
    data: {
      territoryId: visibleTerritoryTwo.id,
      assignedTmUserId: tmTwo.userId,
      assignedTmName: tmTwo.displayName,
      assignedRdUserId: rdActor.userId,
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-10-11T15:00:00.000Z'),
    },
  });

  await prisma.lead.update({
    where: { id: hiddenLead.id },
    data: {
      territoryId: hiddenTerritory.id,
      assignedTmUserId: tmTwo.userId,
      assignedTmName: tmTwo.displayName,
      assignedRdUserId: otherRdActor.userId,
      stage: 'DISCOVERY_SCHEDULED',
      discoveryScheduledAt: new Date('2026-10-12T15:00:00.000Z'),
    },
  });

  const workspace = await getCalendarWorkspace(rdActor, {
    startDate: '2026-10-01T00:00:00.000Z',
    endDate: '2026-10-31T23:59:59.999Z',
  }, config);

  assert.equal(workspace.summary.totalEvents, 2);
  assert.equal(workspace.summary.discoveryCallCount, 2);
  assert.deepEqual(
    workspace.items.map((item) => item.title).sort(),
    ['Discovery Call — RD Calendar Visible Lead One', 'Discovery Call — RD Calendar Visible Lead Two'].sort(),
  );
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

test('training routes return 403 for calendar-visible roles without crashing the API runtime', SERIAL, async () => {
  const runtime = await createPulseServer(loadAppConfig(process.env));
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const { auth } = await createInternalRoleSession('ADMIN_CSR_OPS', 'calendar.ops@pulse.local');
    const address = runtime.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const trainingResponse = await fetch(`http://127.0.0.1:${port}/api/v1/training/catalog`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(trainingResponse.status, 403);
    const trainingPayload = await trainingResponse.json();
    assert.match(String(trainingPayload.detail), /cannot access module training/i);

    const calendarResponse = await fetch(
      `http://127.0.0.1:${port}/api/v1/calendar/workspace?startDate=2026-06-01T00:00:00.000Z&endDate=2026-06-30T23:59:59.999Z`,
      {
        headers: {
          authorization: `Bearer ${auth.tokens.accessToken}`,
        },
      },
    );

    assert.equal(calendarResponse.status, 200);
  } finally {
    await runtime.close();
  }
});

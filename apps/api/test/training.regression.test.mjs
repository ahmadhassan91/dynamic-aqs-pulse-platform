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
let ensureTrainingSeeded;
let listTrainingCatalog;
let listTrainingOverview;
let createTrainingCategory;
let createTrainingType;
let createTrainingTemplate;
let listTrainingAccounts;
let listTrainingTrainers;
let listTrainingSessions;
let getAccountTrainingHistory;
let createAccountTrainingProgram;
let createTrainingSession;
let rescheduleTrainingSession;
let completeTrainingSession;
let cancelTrainingSession;
let createTrainingFollowUpTask;
let completeTrainingFollowUpTask;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ createPulseServer } = await import('../dist/server.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureTrainingSeeded,
    listTrainingCatalog,
    listTrainingOverview,
    createTrainingCategory,
    createTrainingType,
    createTrainingTemplate,
    listTrainingAccounts,
    listTrainingTrainers,
    listTrainingSessions,
    getAccountTrainingHistory,
    createAccountTrainingProgram,
    createTrainingSession,
    rescheduleTrainingSession,
    completeTrainingSession,
    cancelTrainingSession,
    createTrainingFollowUpTask,
    completeTrainingFollowUpTask,
  } = await import('../dist/modules/training/service.js'));

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

async function createUser(roleCode, email, displayName, { trainerProfileActive } = {}) {
  return prisma.user.create({
    data: {
      email,
      displayName,
      roleCode,
      ...(trainerProfileActive !== undefined
        ? {
            trainingTrainerProfile: {
              create: {
                isActive: trainerProfileActive,
              },
            },
          }
        : {}),
    },
  });
}

async function createTrainingAccountFixture(actor, suffix = 'training') {
  const tm = await createUser('TERRITORY_MANAGER', `tm-${suffix}@pulse.local`, `TM ${suffix}`);
  const rd = await createUser('REGIONAL_DIRECTOR', `rd-${suffix}@pulse.local`, `RD ${suffix}`);
  const segment = await prisma.businessSegmentRef.findFirst({
    where: { code: 'residential' },
  });

  const account = await prisma.account.create({
    data: {
      displayName: `Training Account ${suffix}`,
      legalName: `Training Account ${suffix} LLC`,
      accountType: 'Dealer',
      businessSegmentId: segment?.id ?? null,
      assignedTmUserId: tm.id,
      assignedRdUserId: rd.id,
      isActive: true,
    },
  });

  return { account, tm, rd };
}

test('training routes are mounted and seed the active certification tracks', SERIAL, async () => {
  const { auth } = await createAdminSession();
  const runtime = await createPulseServer(loadAppConfig(process.env));

  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));

  try {
    const address = runtime.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/training/catalog`, {
      headers: {
        authorization: `Bearer ${auth.tokens.accessToken}`,
      },
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    const codes = payload.trainingTypes.map((entry) => entry.code);
    assert.ok(codes.includes('iaq_certification_curriculum'));
    assert.ok(codes.includes('product_installations'));
  } finally {
    await runtime.close();
  }
});

test('training catalog creation respects permissions and allows training ops to add records', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const tmActor = actorWithRole(actor, 'TERRITORY_MANAGER');
  const trainingOpsActor = actorWithRole(actor, 'TRAINING_OPS');

  await assert.rejects(
    () =>
      createTrainingCategory(tmActor, {
        kind: 'custom',
        code: 'field_only',
        name: 'Field Only',
      }),
    /training\.catalog_manage/i,
  );

  const category = await createTrainingCategory(trainingOpsActor, {
    kind: 'custom',
    code: 'field_custom',
    name: 'Field Custom',
    description: 'Custom territory enablement.',
  });

  const trainingType = await createTrainingType(trainingOpsActor, {
    categoryId: category.id,
    code: 'custom_field_visit',
    name: 'Custom Field Visit',
    family: 'custom',
    deliveryMode: 'visit',
    defaultDurationMinutes: 75,
    countsTowardHours: false,
  });

  const template = await createTrainingTemplate(trainingOpsActor, {
    trainingTypeId: trainingType.id,
    code: 'custom_field_visit_template',
    title: 'Custom Field Visit Template',
  });

  assert.equal(template.trainingTypeId, trainingType.id);
});

test('account training programs inherit owners and default cadence from seeded policy', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture(actor, 'cadence');
  const howAndWhen = await prisma.trainingType.findUnique({
    where: { code: 'how_and_when' },
  });

  assert.ok(howAndWhen, 'expected seeded training type');

  const created = await createAccountTrainingProgram(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    trainingTypeId: howAndWhen.id,
  });

  assert.equal(created.ownerTmUserId, fixture.tm.id);
  assert.equal(created.ownerRdUserId, fixture.rd.id);
  assert.equal(created.cadenceDays, 180);
  assert.equal(created.status, 'active');
});

test('account history counts only formal completed training hours and flags overdue programs', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture(actor, 'history');
  const siteVisitType = await prisma.trainingType.findUnique({ where: { code: 'site_visit' } });
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });

  assert.ok(siteVisitType);
  assert.ok(onboardingType);

  const program = await prisma.accountTrainingProgram.create({
    data: {
      accountId: fixture.account.id,
      trainingTypeId: onboardingType.id,
      title: 'Onboarding',
      status: 'ACTIVE',
      cadenceDays: 30,
      nextDueAt: new Date('2026-01-01T00:00:00.000Z'),
      ownerTmUserId: fixture.tm.id,
      ownerRdUserId: fixture.rd.id,
      startedAt: new Date('2025-12-01T00:00:00.000Z'),
      isRequired: true,
    },
    include: {
      trainingType: true,
      template: true,
      ownerTmUser: { select: { id: true, displayName: true } },
      ownerRdUser: { select: { id: true, displayName: true } },
    },
  });

  await prisma.trainingSession.createMany({
    data: [
      {
        accountId: fixture.account.id,
        programId: program.id,
        trainingTypeId: onboardingType.id,
        trainerUserId: fixture.tm.id,
        activityKind: 'TRAINING',
        status: 'COMPLETED',
        title: 'Onboarding Session',
        completedAt: new Date('2026-04-01T10:00:00.000Z'),
        durationMinutes: 120,
        attendeeCount: 4,
      },
      {
        accountId: fixture.account.id,
        trainingTypeId: siteVisitType.id,
        trainerUserId: fixture.tm.id,
        activityKind: 'SITE_VISIT',
        status: 'COMPLETED',
        title: 'Drop-by Visit',
        completedAt: new Date('2026-04-10T10:00:00.000Z'),
        durationMinutes: 90,
        attendeeCount: 1,
      },
    ],
  });

  const history = await getAccountTrainingHistory(actor, fixture.account.id);
  assert.ok(history);
  assert.equal(history.overdueProgramCount, 1);
  assert.equal(history.totalTrainingHours, 2);
  assert.equal(history.recentSessions.length, 2);
  assert.equal(history.recentSessions[0].activityKind, 'site_visit');
});

test('training account filters surface overdue accounts separately from accounts with no programs', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const overdueFixture = await createTrainingAccountFixture(actor, 'overdue');
  const cleanFixture = await createTrainingAccountFixture(actor, 'clean');
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });

  assert.ok(onboardingType);

  await prisma.accountTrainingProgram.create({
    data: {
      accountId: overdueFixture.account.id,
      trainingTypeId: onboardingType.id,
      title: 'Overdue Onboarding',
      status: 'ACTIVE',
      nextDueAt: new Date('2026-01-01T00:00:00.000Z'),
      startedAt: new Date('2025-12-01T00:00:00.000Z'),
      isRequired: true,
    },
  });

  const overdueOnly = await listTrainingAccounts(actor, { status: 'overdue' });
  const noPrograms = await listTrainingAccounts(actor, { status: 'no_programs' });

  assert.ok(overdueOnly.items.some((entry) => entry.accountId === overdueFixture.account.id));
  assert.ok(!overdueOnly.items.some((entry) => entry.accountId === cleanFixture.account.id));
  assert.ok(noPrograms.items.some((entry) => entry.accountId === cleanFixture.account.id));
  assert.ok(!noPrograms.items.some((entry) => entry.accountId === overdueFixture.account.id));
});

test('training overview surfaces catalog and certification summary after seeding', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const overview = await listTrainingOverview(actor);
  const catalog = await listTrainingCatalog(actor);

  assert.ok(overview.trainingTypeCount >= 20);
  assert.equal(overview.certificationTrackCount, 2);
  assert.ok(catalog.categories.some((entry) => entry.code === 'certification'));
  assert.ok(catalog.trainingTypes.some((entry) => entry.code === 'product_installations'));
});

test('training trainer directory only returns assignable active trainer profiles', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const activeTrainer = await createUser('TERRITORY_MANAGER', 'active-trainer@pulse.local', 'Active Trainer', {
    trainerProfileActive: true,
  });
  await createUser('TRAINING_OPS', 'inactive-trainer@pulse.local', 'Inactive Trainer', {
    trainerProfileActive: false,
  });
  await createUser('EXECUTIVE', 'not-trainer@pulse.local', 'Not A Trainer');

  const response = await listTrainingTrainers(actor);
  assert.ok(response.items.some((entry) => entry.userId === activeTrainer.id));
  assert.ok(!response.items.some((entry) => entry.displayName === 'Inactive Trainer'));
  assert.ok(!response.items.some((entry) => entry.displayName === 'Not A Trainer'));
});

test('training sessions reject ineligible trainers and mismatched programs', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixtureA = await createTrainingAccountFixture(actor, 'session-a');
  const fixtureB = await createTrainingAccountFixture(actor, 'session-b');
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });
  const executive = await createUser('EXECUTIVE', 'exec-session@pulse.local', 'Exec Session');

  assert.ok(onboardingType);

  const foreignProgram = await createAccountTrainingProgram(actorWithRole(actor, 'TRAINING_OPS'), fixtureB.account.id, {
    trainingTypeId: onboardingType.id,
  });

  await assert.rejects(
    () =>
      createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixtureA.account.id, {
        trainingTypeId: onboardingType.id,
        trainerUserId: executive.id,
        scheduledAt: '2026-06-01T10:00:00.000Z',
        durationMinutes: 60,
      }),
    /not eligible/i,
  );

  await assert.rejects(
    () =>
      createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixtureA.account.id, {
        programId: foreignProgram.id,
        trainerUserId: fixtureA.tm.id,
        scheduledAt: '2026-06-01T10:00:00.000Z',
        durationMinutes: 60,
      }),
    /does not belong/i,
  );
});

test('completing a training session advances cadence and creates follow-up tasks', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture(actor, 'complete');
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });

  assert.ok(onboardingType);

  const program = await createAccountTrainingProgram(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    trainingTypeId: onboardingType.id,
  });

  const scheduled = await createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    programId: program.id,
    trainingTypeId: onboardingType.id,
    trainerUserId: fixture.tm.id,
    scheduledAt: '2026-06-15T15:00:00.000Z',
    durationMinutes: 90,
    attendeeCount: 3,
  });

  const completed = await completeTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), scheduled.id, {
    completedAt: '2026-06-15T16:30:00.000Z',
    durationMinutes: 105,
    attendeeCount: 4,
    completionSummary: 'Account completed onboarding certification.',
    createFollowUpTask: {
      title: 'Send post-training recap',
      dueAt: '2026-06-20T12:00:00.000Z',
      ownerUserId: fixture.rd.id,
    },
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.openFollowUpTaskCount, 1);
  assert.equal(completed.followUpTasks[0]?.title, 'Send post-training recap');

  const refreshedProgram = await prisma.accountTrainingProgram.findUnique({
    where: { id: program.id },
  });
  assert.equal(refreshedProgram?.status, 'ACTIVE');
  assert.ok(refreshedProgram?.lastCompletedAt);
  assert.ok(refreshedProgram?.nextDueAt);
});

test('cancelled and no-show sessions remain out of completed program flow', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture(actor, 'cancel');
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });

  assert.ok(onboardingType);

  const program = await createAccountTrainingProgram(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    trainingTypeId: onboardingType.id,
  });

  const scheduled = await createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    programId: program.id,
    trainingTypeId: onboardingType.id,
    trainerUserId: fixture.tm.id,
    scheduledAt: '2026-06-10T15:00:00.000Z',
    durationMinutes: 60,
  });

  const cancelled = await cancelTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), scheduled.id, {
    status: 'no_show',
    notes: 'Dealer team was unavailable.',
  });

  assert.equal(cancelled.status, 'no_show');

  const refreshedProgram = await prisma.accountTrainingProgram.findUnique({
    where: { id: program.id },
  });
  assert.equal(refreshedProgram?.status, 'ACTIVE');
  assert.equal(refreshedProgram?.completedAt, null);
  assert.equal(refreshedProgram?.lastCompletedAt, null);
});

test('training follow-up tasks can be created independently and completed', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture(actor, 'follow-up');
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });

  assert.ok(onboardingType);

  const scheduled = await createTrainingSession(actorWithRole(actor, 'TRAINING_OPS'), fixture.account.id, {
    trainingTypeId: onboardingType.id,
    trainerUserId: fixture.tm.id,
    scheduledAt: '2026-07-01T13:00:00.000Z',
    durationMinutes: 60,
  });

  const task = await createTrainingFollowUpTask(actorWithRole(actor, 'TRAINING_OPS'), scheduled.id, {
    title: 'Confirm next territory visit',
    ownerUserId: fixture.tm.id,
  });

  assert.equal(task.status, 'open');

  const completedTask = await completeTrainingFollowUpTask(actorWithRole(actor, 'TRAINING_OPS'), task.id, {
    notes: 'Visit confirmed with dealer team.',
  });

  assert.equal(completedTask.status, 'completed');
  assert.ok(completedTask.completedAt);
});

test('training session listing supports overdue filtering', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingAccountFixture(actor, 'list');
  const onboardingType = await prisma.trainingType.findUnique({ where: { code: 'onboarding' } });

  assert.ok(onboardingType);

  await prisma.trainingSession.createMany({
    data: [
      {
        accountId: fixture.account.id,
        trainingTypeId: onboardingType.id,
        trainerUserId: fixture.tm.id,
        activityKind: 'TRAINING',
        status: 'SCHEDULED',
        title: 'Overdue session',
        scheduledAt: new Date('2025-01-01T10:00:00.000Z'),
        durationMinutes: 60,
        attendeeCount: 2,
      },
      {
        accountId: fixture.account.id,
        trainingTypeId: onboardingType.id,
        trainerUserId: fixture.tm.id,
        activityKind: 'TRAINING',
        status: 'SCHEDULED',
        title: 'Future session',
        scheduledAt: new Date('2027-01-01T10:00:00.000Z'),
        durationMinutes: 60,
        attendeeCount: 2,
      },
    ],
  });

  const overdueOnly = await listTrainingSessions(actor, {
    accountId: fixture.account.id,
    status: 'overdue',
  });

  assert.equal(overdueOnly.total, 1);
  assert.equal(overdueOnly.items[0]?.title, 'Overdue session');
  assert.equal(overdueOnly.overdueCount, 1);
});

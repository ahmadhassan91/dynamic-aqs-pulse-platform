import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let ensureReferenceDataSeeded;
let ensureTrainingSeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let listTrainingRecertificationQueue;
let getTrainingCoachingWorkload;

const SERIAL = { concurrency: false };
let uniqueFixtureCounter = 0;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureTrainingSeeded,
    listTrainingRecertificationQueue,
    getTrainingCoachingWorkload,
  } = await import('../dist/modules/training/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

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

function actorForUser(user) {
  return {
    userId: user.id,
    sessionId: `training-session-${user.id}`,
    role: user.roleCode,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

async function createUser(roleCode, email, displayName) {
  return prisma.user.create({
    data: {
      email,
      displayName,
      roleCode,
      userType: 'INTERNAL',
      isActive: true,
    },
  });
}

async function createTrainingFixture(suffix = 'training', stateCode = 'TX') {
  uniqueFixtureCounter += 1;
  const token = `${suffix}-${uniqueFixtureCounter}`;
  const tm = await createUser('TERRITORY_MANAGER', `tm-${token}@pulse.local`, `TM ${token}`);
  const rd = await createUser('REGIONAL_DIRECTOR', `rd-${token}@pulse.local`, `RD ${token}`);
  const segment = await prisma.businessSegmentRef.findUniqueOrThrow({ where: { code: 'residential' } });

  const region = await prisma.region.create({
    data: {
      code: `region_${token}`,
      name: `Region ${token}`,
      directorUserId: rd.id,
    },
  });

  const shippingCenter = await prisma.shippingCenter.create({
    data: {
      code: `ship_${token}`,
      name: `Shipping ${token}`,
      city: 'Dallas',
      state: stateCode,
      countryCode: 'US',
      isActive: true,
    },
  });

  const territory = await prisma.territory.create({
    data: {
      code: `territory_${token}`,
      name: `Territory ${token}`,
      regionId: region.id,
      managerUserId: tm.id,
      shippingCenterId: shippingCenter.id,
      isActive: true,
      stateCoverage: {
        create: {
          countryCode: 'US',
          stateCode,
        },
      },
    },
  });

  const account = await prisma.account.create({
    data: {
      displayName: `Training Account ${token}`,
      legalName: `Training Account ${token} LLC`,
      accountType: 'Dealer',
      businessSegmentId: segment.id,
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: tm.id,
      assignedRdUserId: rd.id,
      isActive: true,
      lastEngagementAt: new Date(),
    },
  });

  return { tm, rd, region, territory, shippingCenter, account };
}

test('recertification queue scopes expiring certifications by owner visibility', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const visible = await createTrainingFixture('recert-visible', 'TX');
  const hidden = await createTrainingFixture('recert-hidden', 'FL');
  const certificationType = await prisma.trainingType.findUniqueOrThrow({
    where: { code: 'iaq_certification_curriculum' },
  });

  await prisma.trainingCertificationRecord.createMany({
    data: [
      {
        accountId: visible.account.id,
        trainingTypeId: certificationType.id,
        title: 'Visible Certification',
        status: 'ACTIVE',
        awardedAt: new Date('2026-03-01T09:00:00.000Z'),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      {
        accountId: visible.account.id,
        trainingTypeId: certificationType.id,
        title: 'Future Certification',
        status: 'ACTIVE',
        awardedAt: new Date('2026-03-01T09:00:00.000Z'),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
      {
        accountId: hidden.account.id,
        trainingTypeId: certificationType.id,
        title: 'Hidden Certification',
        status: 'ACTIVE',
        awardedAt: new Date('2026-03-01T09:00:00.000Z'),
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  const adminQueue = await listTrainingRecertificationQueue(actor, {
    windowDays: 30,
  });

  assert.equal(adminQueue.summary.totalDueCount, 2);
  assert.equal(adminQueue.items.length, 2);

  const tmQueue = await listTrainingRecertificationQueue(actorForUser(visible.tm), {
    windowDays: 30,
  });

  assert.equal(tmQueue.summary.totalDueCount, 1);
  assert.equal(tmQueue.items.length, 1);
  assert.equal(tmQueue.items[0]?.accountId, visible.account.id);
  assert.ok(typeof tmQueue.items[0]?.daysUntilExpiry === 'number');
});

test('coaching workload returns upcoming sessions, overdue programs, open follow-ups, and expiring certifications', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const fixture = await createTrainingFixture('coaching');
  const trainer = await createUser('TRAINING_OPS', 'trainer-coaching@pulse.local', 'Training Ops Coach');
  const certificationType = await prisma.trainingType.findUniqueOrThrow({
    where: { code: 'iaq_certification_curriculum' },
  });

  const program = await prisma.accountTrainingProgram.create({
    data: {
      accountId: fixture.account.id,
      trainingTypeId: certificationType.id,
      title: 'IAQ Coaching Program',
      status: 'ACTIVE',
      cadenceDays: 180,
      isRequired: true,
      ownerTmUserId: fixture.tm.id,
      ownerRdUserId: fixture.rd.id,
      startedAt: new Date('2026-01-01T09:00:00.000Z'),
      nextDueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });

  const session = await prisma.trainingSession.create({
    data: {
      accountId: fixture.account.id,
      programId: program.id,
      trainingTypeId: certificationType.id,
      trainerUserId: trainer.id,
      title: 'Coaching Session',
      status: 'SCHEDULED',
      activityKind: 'TRAINING',
      certificationOutcome: 'PENDING_DECISION',
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      durationMinutes: 90,
      attendeeCount: 2,
    },
  });

  await prisma.trainingFollowUpTask.create({
    data: {
      sessionId: session.id,
      accountId: fixture.account.id,
      ownerUserId: fixture.tm.id,
      createdByUserId: actor.userId,
      title: 'Coach next install team',
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.trainingCertificationRecord.create({
    data: {
      accountId: fixture.account.id,
      trainingTypeId: certificationType.id,
      title: 'Expiring Certification',
      status: 'ACTIVE',
      awardedAt: new Date('2026-03-01T09:00:00.000Z'),
      expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
    },
  });

  const workload = await getTrainingCoachingWorkload(actorForUser(fixture.tm));

  assert.equal(workload.summary.upcomingSessionCount, 1);
  assert.equal(workload.summary.overdueProgramCount, 1);
  assert.equal(workload.summary.openFollowUpTaskCount, 1);
  assert.equal(workload.summary.expiringCertificationCount, 1);
  assert.equal(workload.upcomingSessions[0]?.sessionId, session.id);
  assert.equal(workload.overduePrograms[0]?.programId, program.id);
  assert.equal(workload.openFollowUpTasks[0]?.sessionId, session.id);
  assert.equal(workload.expiringCertifications[0]?.accountId, fixture.account.id);
});

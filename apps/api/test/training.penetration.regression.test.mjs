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
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let getTerritoryTrainingPenetration;

const SERIAL = { concurrency: false };
let uniqueFixtureCounter = 0;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureTrainingSeeded, getTerritoryTrainingPenetration } = await import('../dist/modules/training/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
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
  await ensureTerritoryPolicySeeded();
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
  return { actor };
}

function actorForUser(user) {
  return {
    userId: user.id,
    sessionId: `training-penetration-${user.id}`,
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

async function createTerritoryFixture(suffix, stateCode) {
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

  async function createAccount(name, trained) {
    const account = await prisma.account.create({
      data: {
        displayName: `${name} ${token}`,
        legalName: `${name} ${token} LLC`,
        accountType: 'Dealer',
        businessSegmentId: segment.id,
        territoryId: territory.id,
        shippingCenterId: shippingCenter.id,
        assignedTmUserId: tm.id,
        assignedRdUserId: rd.id,
        isActive: true,
      },
    });

    if (trained) {
      const trainingType = await prisma.trainingType.findUniqueOrThrow({ where: { code: 'how_and_when' } });
      await prisma.trainingSession.create({
        data: {
          accountId: account.id,
          trainingTypeId: trainingType.id,
          trainerUserId: tm.id,
          title: `Completed ${name}`,
          status: 'COMPLETED',
          activityKind: 'TRAINING',
          certificationOutcome: 'NOT_APPLICABLE',
          scheduledAt: new Date('2026-03-01T09:00:00.000Z'),
          completedAt: new Date('2026-03-01T10:00:00.000Z'),
          checkedInAt: new Date('2026-03-01T09:00:00.000Z'),
          checkedOutAt: new Date('2026-03-01T10:00:00.000Z'),
          durationMinutes: 60,
          attendeeCount: 3,
          checkoutNotes: 'Completed successfully.',
          proofCapturedAt: new Date('2026-03-01T10:00:00.000Z'),
        },
      });
    }

    return account;
  }

  return { tm, rd, region, territory, createAccount };
}

test('territory training penetration returns scoped percent rollups by territory and region', SERIAL, async () => {
  const { actor } = await createAdminSession();
  const texas = await createTerritoryFixture('penetration-tx', 'TX');
  const florida = await createTerritoryFixture('penetration-fl', 'FL');

  await texas.createAccount('Texas Trained', true);
  await texas.createAccount('Texas Untrained', false);
  await florida.createAccount('Florida Trained', true);

  const adminPenetration = await getTerritoryTrainingPenetration(actor);
  const texasRollup = adminPenetration.territories.find((item) => item.territoryId === texas.territory.id);
  const floridaRollup = adminPenetration.territories.find((item) => item.territoryId === florida.territory.id);

  assert.ok(texasRollup);
  assert.equal(texasRollup.totalAccounts, 2);
  assert.equal(texasRollup.trainedAccounts, 1);
  assert.equal(texasRollup.penetrationPercent, 50);

  assert.ok(floridaRollup);
  assert.equal(floridaRollup.totalAccounts, 1);
  assert.equal(floridaRollup.trainedAccounts, 1);
  assert.equal(floridaRollup.penetrationPercent, 100);

  const tmPenetration = await getTerritoryTrainingPenetration(actorForUser(texas.tm));
  assert.equal(tmPenetration.territories.length, 1);
  assert.equal(tmPenetration.territories[0]?.territoryId, texas.territory.id);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureReferenceDataSeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let getTrainingDashboard;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ getTrainingDashboard } = await import('../dist/modules/reports/service.js'));

  config = configModule.loadAppConfig(process.env);
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
  await ensureBootstrapAdminSeeded(config);
});

async function createAdminActor() {
  const auth = await loginWithPassword(
    config,
    { email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL, password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD },
    {},
  );
  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? 'Pulse Bootstrap Admin',
  };
}

function actorFor(user) {
  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role: user.roleCode,
    actorType: user.userType === 'DEALER' ? 'dealer' : 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

async function seedTraining() {
  const trainerTm = await prisma.user.create({
    data: { email: 'trainer.tm@pulse.local', displayName: 'Trainer TM', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true },
  });
  const region = await prisma.region.create({ data: { code: 'tr_region', name: 'Tr Region' } });
  const territory = await prisma.territory.create({
    data: { code: 'tr_territory', name: 'Tr Territory', regionId: region.id, managerUserId: trainerTm.id },
  });
  const mine = await prisma.account.create({
    data: { displayName: 'TM Trained Account', accountType: 'Dealer', isActive: true, assignedTmUserId: trainerTm.id, territoryId: territory.id },
  });
  const other = await prisma.account.create({
    data: { displayName: 'Out-of-book Account', accountType: 'Dealer', isActive: true },
  });
  const recent = new Date(Date.now() - 7 * 86400000);
  const pastDue = new Date(Date.now() - 14 * 86400000);
  await prisma.trainingSession.createMany({
    data: [
      { accountId: mine.id, trainerUserId: trainerTm.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Mine T1', completedAt: recent, durationMinutes: 90 },
      { accountId: mine.id, trainerUserId: trainerTm.id, activityKind: 'SITE_VISIT', status: 'COMPLETED', title: 'Mine V1', completedAt: recent, durationMinutes: 30 },
      // Same trainer, but at an out-of-book account — account-scoped, so a TM must NOT see it.
      { accountId: other.id, trainerUserId: trainerTm.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Other T1', completedAt: recent, durationMinutes: 60 },
      // SCHEDULED (not completed) — excluded from all completed metrics.
      { accountId: mine.id, trainerUserId: trainerTm.id, activityKind: 'TRAINING', status: 'SCHEDULED', title: 'Mine future' },
    ],
  });
  await prisma.accountTrainingProgram.createMany({
    data: [
      { accountId: mine.id, title: 'Mine program', status: 'ACTIVE', nextDueAt: pastDue },
      { accountId: other.id, title: 'Other program', status: 'ACTIVE', nextDueAt: pastDue },
    ],
  });
  return { trainerTm, mine, other };
}

test('training dashboard aggregates completed-session KPIs for a global actor', SERIAL, async () => {
  const admin = await createAdminActor();
  await seedTraining();

  const dashboard = await getTrainingDashboard(admin);

  assert.equal(dashboard.metrics.completedSessions, 3); // 2 training + 1 site visit (SCHEDULED excluded)
  assert.equal(dashboard.metrics.trainingHours, 2.5); // (90 + 60) / 60
  assert.equal(dashboard.metrics.accountsTrained, 2); // mine + other
  assert.equal(dashboard.metrics.siteVisits, 1);
  assert.equal(dashboard.metrics.overduePrograms, 2);

  const trainerRow = dashboard.byTrainer.find((bucket) => bucket.key === 'Trainer TM');
  assert.ok(trainerRow);
  assert.equal(trainerRow.sessions, 2); // 2 completed trainings (site visit not counted as training)
  assert.equal(trainerRow.hours, 2.5);
  assert.equal(dashboard.overdueAccounts.length, 2);
  assert.equal(typeof dashboard.generatedAt, 'string');
});

test('training dashboard scopes to the actor record scope (TM sees only their book)', SERIAL, async () => {
  const { trainerTm } = await seedTraining();
  const dashboard = await getTrainingDashboard(actorFor(trainerTm));

  // Account-scoped: only the TM's own account's sessions, even though the TM
  // personally delivered the out-of-book session too.
  assert.equal(dashboard.metrics.completedSessions, 2); // Mine T1 + Mine V1
  assert.equal(dashboard.metrics.trainingHours, 1.5); // 90 / 60
  assert.equal(dashboard.metrics.accountsTrained, 1);
  assert.equal(dashboard.metrics.siteVisits, 1);
  assert.equal(dashboard.metrics.overduePrograms, 1);
  assert.deepEqual(dashboard.overdueAccounts.map((row) => row.account), ['TM Trained Account']);
});

test('training dashboard denies a reports role without the training module', SERIAL, async () => {
  // SALES_BD_REP has the reports module but NOT the training module.
  const salesRep = await prisma.user.create({
    data: { email: 'sales.train@pulse.local', displayName: 'Sales Rep', roleCode: 'SALES_BD_REP', userType: 'INTERNAL', isActive: true },
  });
  await assert.rejects(() => getTrainingDashboard(actorFor(salesRep)));

  const dealer = await prisma.user.create({
    data: { email: 'dealer.train@pulse.local', displayName: 'Dealer', roleCode: 'DEALER_PORTAL_USER', userType: 'DEALER', isActive: true },
  });
  await assert.rejects(() => getTrainingDashboard(actorFor(dealer)));
});

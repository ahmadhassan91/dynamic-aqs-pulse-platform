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
let getExecutiveDashboard;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ getExecutiveDashboard } = await import('../dist/modules/reports/service.js'));

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

test('executive dashboard aggregates KPIs + the cross-module exception summary', SERIAL, async () => {
  const admin = await createAdminActor();
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const past = new Date(Date.now() - 14 * 86400000);
  const recent = new Date(Date.now() - 3 * 86400000);

  // Stale lead (active, past initial-contact due, never contacted) -> staleLeads + openLeads.
  await prisma.lead.create({
    data: {
      companyName: 'Exec Stale Lead',
      contactDisplayName: 'Exec Contact',
      businessSegmentId: segment.id,
      leadSourceId: source.id,
      serviceTechCount: 4,
      routingBasisSnapshot: 'SERVICE_TECH_COUNT',
      routingThresholdSnapshot: 5,
      routingTeam: 'STRATEGIC_GROWTH',
      stage: 'NEW',
      lifecycleStatus: 'ACTIVE',
      initialContactDueAt: past,
      initialContactedAt: null,
    },
  });

  const account = await prisma.account.create({
    data: { displayName: 'Exec Account', accountType: 'Dealer', isActive: true },
  });
  // Overdue training program -> overdueTraining.
  await prisma.accountTrainingProgram.create({
    data: { accountId: account.id, title: 'Exec overdue program', status: 'ACTIVE', nextDueAt: past },
  });
  // A completed training session -> trainingsCompleted.
  await prisma.trainingSession.create({
    data: { accountId: account.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Exec training', completedAt: recent, durationMinutes: 60 },
  });
  // Active consignment site overdue for audit -> activeConsignmentSites + overdueAudits.
  const site = await prisma.consignmentSite.create({
    data: { accountId: account.id, name: 'Exec ROSE site', status: 'ACTIVE', nextAuditDueAt: past },
  });
  // Open consignment work item -> openConsignmentWorkItems (COMPLETED is excluded).
  await prisma.consignmentWorkItem.createMany({
    data: [
      { siteId: site.id, type: 'VARIANCE_REVIEW', status: 'OPEN', title: 'Open variance' },
      { siteId: site.id, type: 'EXIT_REVIEW', status: 'COMPLETED', title: 'Closed item' },
    ],
  });

  const dashboard = await getExecutiveDashboard(admin);

  assert.equal(dashboard.metrics.openLeads, 1);
  assert.equal(dashboard.metrics.activeConsignmentSites, 1);
  assert.equal(dashboard.metrics.trainingsCompleted, 1);
  assert.equal(dashboard.exceptions.overdueAudits, 1);
  assert.equal(dashboard.exceptions.overdueTraining, 1);
  assert.equal(dashboard.exceptions.staleLeads, 1);
  assert.equal(dashboard.exceptions.openConsignmentWorkItems, 1); // COMPLETED excluded
  assert.equal(dashboard.metrics.openExceptions, 4);
  assert.equal(typeof dashboard.generatedAt, 'string');
});

test('executive dashboard requires reports.executive (TM and dealer denied)', SERIAL, async () => {
  // TERRITORY_MANAGER has the reports module but NOT reports.executive.
  const tm = await prisma.user.create({
    data: { email: 'tm.exec@pulse.local', displayName: 'Exec TM', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true },
  });
  await assert.rejects(() => getExecutiveDashboard(actorFor(tm)));

  const dealer = await prisma.user.create({
    data: { email: 'dealer.exec@pulse.local', displayName: 'Exec Dealer', roleCode: 'DEALER_PORTAL_USER', userType: 'DEALER', isActive: true },
  });
  await assert.rejects(() => getExecutiveDashboard(actorFor(dealer)));
});

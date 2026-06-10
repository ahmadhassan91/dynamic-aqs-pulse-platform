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
let listReportDefinitions;
let createReportDefinition;
let updateReportDefinition;
let deleteReportDefinition;
let runReportDefinition;
let runAdHocReport;
let createReportSchedule;
let listReportSchedules;
let updateReportSchedule;
let listReportDeliveries;
let processDueReportSchedules;
let computeNextRunAt;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({
    listReportDefinitions,
    createReportDefinition,
    updateReportDefinition,
    deleteReportDefinition,
    runReportDefinition,
    runAdHocReport,
    createReportSchedule,
    listReportSchedules,
    updateReportSchedule,
    listReportDeliveries,
    processDueReportSchedules,
    computeNextRunAt,
  } = await import('../dist/modules/reports/service.js'));

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
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
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

async function createScopedActor(role, email, displayName) {
  const user = await prisma.user.create({
    data: { email, displayName, roleCode: role, userType: 'INTERNAL', isActive: true },
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

test('report definition CRUD respects ownership and visibility', SERIAL, async () => {
  const admin = await createAdminActor();
  const tm = await createScopedActor('TERRITORY_MANAGER', 'tm.reports@pulse.local', 'Reporting TM');

  const created = await createReportDefinition(tm, {
    name: 'My private funnel',
    reportKey: 'lead_funnel',
    config: {},
  });
  assert.equal(created.reportKey, 'lead_funnel');
  assert.equal(created.visibility, 'private');
  assert.equal(created.ownerUserId, tm.userId);

  const shared = await createReportDefinition(admin, {
    name: 'Org coverage',
    reportKey: 'territory_coverage',
    visibility: 'org',
  });

  // TM sees own private + the org-shared definition; admin does not see the TM's private one.
  const tmList = await listReportDefinitions(tm);
  assert.deepEqual(tmList.items.map((item) => item.name).sort(), ['My private funnel', 'Org coverage']);
  const adminList = await listReportDefinitions(admin);
  assert.deepEqual(adminList.items.map((item) => item.name), ['Org coverage']);

  // Non-owner cannot modify; owner can.
  await assert.rejects(() => updateReportDefinition(tm, shared.id, { name: 'hijacked' }));
  const renamed = await updateReportDefinition(tm, created.id, { name: 'My funnel v2', visibility: 'org' });
  assert.equal(renamed.name, 'My funnel v2');
  assert.equal(renamed.visibility, 'org');

  await deleteReportDefinition(tm, created.id);
  const afterDelete = await listReportDefinitions(tm);
  assert.deepEqual(afterDelete.items.map((item) => item.name), ['Org coverage']);

  // Unknown report keys are rejected.
  await assert.rejects(() => createReportDefinition(admin, { name: 'bad', reportKey: 'order_revenue' }));
});

test('lead_funnel and territory_coverage reports run over CRM data', SERIAL, async () => {
  const admin = await createAdminActor();

  const region = await prisma.region.create({ data: { code: 'rep_region', name: 'Report Region' } });
  const tmUser = await prisma.user.create({
    data: { email: 'tm.cov@pulse.local', displayName: 'Cov TM', roleCode: 'TERRITORY_MANAGER' },
  });
  const territory = await prisma.territory.create({
    data: { code: 'rep_territory', name: 'Report Territory', regionId: region.id, managerUserId: tmUser.id },
  });
  await prisma.territoryStateCoverage.createMany({
    data: [
      { territoryId: territory.id, stateCode: 'TX' },
      { territoryId: territory.id, stateCode: 'OK' },
    ],
  });

  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const leadBase = {
    contactDisplayName: 'Funnel Contact',
    businessSegmentId: segment.id,
    leadSourceId: source.id,
    serviceTechCount: 4,
    routingBasisSnapshot: 'SERVICE_TECH_COUNT',
    routingThresholdSnapshot: 5,
    routingTeam: 'STRATEGIC_GROWTH',
  };
  const pastDue = new Date(Date.now() - 86400000);
  await prisma.lead.createMany({
    data: [
      { ...leadBase, companyName: 'Funnel One', stage: 'NEW', sourceSiteName: 'uvresources.com', initialContactDueAt: pastDue },
      { ...leadBase, companyName: 'Funnel Two', stage: 'NEW', sourceSiteName: 'uvresources.com' },
      { ...leadBase, companyName: 'Funnel Three', stage: 'CIS_SENT', sourceDetail: 'Trade show' },
    ],
  });

  const funnel = await runAdHocReport(admin, 'lead_funnel', {});
  assert.equal(funnel.reportKey, 'lead_funnel');
  const newRow = funnel.rows.find((row) => row.stage === 'NEW');
  assert.ok(newRow);
  assert.equal(newRow.leadCount, 2);
  assert.equal(newRow.slaBreaches, 1);
  assert.equal(newRow.topSource, 'uvresources.com');
  const cisRow = funnel.rows.find((row) => row.stage === 'CIS_SENT');
  assert.equal(cisRow.leadCount, 1);

  const coverage = await runAdHocReport(admin, 'territory_coverage', {});
  const territoryRow = coverage.rows.find((row) => row.territory === 'Report Territory');
  assert.ok(territoryRow);
  assert.equal(territoryRow.tm, 'Cov TM');
  assert.equal(territoryRow.states, 'OK, TX');
  assert.equal(territoryRow.stateCount, 2);

  // Saved definition run path returns the same shape.
  const definition = await createReportDefinition(admin, { name: 'Funnel saved', reportKey: 'lead_funnel' });
  const savedRun = await runReportDefinition(admin, definition.id);
  assert.equal(savedRun.rowCount, funnel.rowCount);
});

test('schedules validate input, compute next runs, and deliver when due', SERIAL, async () => {
  const admin = await createAdminActor();
  const definition = await createReportDefinition(admin, {
    name: 'Scheduled funnel',
    reportKey: 'lead_funnel',
    visibility: 'org',
  });

  await assert.rejects(() => createReportSchedule(admin, definition.id, { cadence: 'daily', hourUtc: 30, recipients: ['a@b.co'] }));
  await assert.rejects(() => createReportSchedule(admin, definition.id, { cadence: 'daily', hourUtc: 8, recipients: [] }));
  await assert.rejects(() => createReportSchedule(admin, definition.id, { cadence: 'daily', hourUtc: 8, recipients: ['not-an-email'] }));

  const schedule = await createReportSchedule(admin, definition.id, {
    cadence: 'daily',
    hourUtc: 8,
    recipients: ['currie@dynamicaqs.com', 'don@dynamicaqs.com'],
  });
  assert.equal(schedule.cadence, 'daily');
  assert.deepEqual(schedule.recipients, ['currie@dynamicaqs.com', 'don@dynamicaqs.com']);
  assert.ok(new Date(schedule.nextRunAt) > new Date());

  // Weekly schedules land on Mondays; monthly on the 1st.
  const weekly = computeNextRunAt('weekly', 8, new Date('2026-06-10T12:00:00Z'));
  assert.equal(weekly.getUTCDay(), 1);
  const monthly = computeNextRunAt('monthly', 8, new Date('2026-06-10T12:00:00Z'));
  assert.equal(monthly.getUTCDate(), 1);

  const listed = await listReportSchedules(admin, definition.id);
  assert.equal(listed.items.length, 1);

  // Force the schedule due, run the scan, and confirm a delivery record + advanced nextRunAt.
  await prisma.reportSchedule.update({
    where: { id: schedule.id },
    data: { nextRunAt: new Date(Date.now() - 60_000) },
  });
  const scan = await processDueReportSchedules();
  assert.equal(scan.due, 1);
  assert.equal(scan.sent, 1);
  assert.equal(scan.failed, 0);

  const deliveries = await listReportDeliveries(admin, schedule.id);
  assert.equal(deliveries.items.length, 1);
  assert.equal(deliveries.items[0].status, 'sent');
  assert.match(deliveries.items[0].detail, /currie@dynamicaqs\.com/);

  const after = await prisma.reportSchedule.findUnique({ where: { id: schedule.id } });
  assert.ok(after.nextRunAt > new Date());
  assert.ok(after.lastRunAt);

  // Idempotent: nothing due on the immediate re-scan.
  const rescan = await processDueReportSchedules();
  assert.equal(rescan.due, 0);

  const paused = await updateReportSchedule(admin, schedule.id, { isActive: false });
  assert.equal(paused.isActive, false);
});

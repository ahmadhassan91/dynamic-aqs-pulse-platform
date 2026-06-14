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
  const tm = await createScopedActor('TERRITORY_MANAGER', 'tm.schedule.viewer@pulse.local', 'Schedule Viewer');
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
  const sameOrgDeliveries = await listReportDeliveries(tm, schedule.id);
  assert.equal(sameOrgDeliveries.items.length, 1);

  const after = await prisma.reportSchedule.findUnique({ where: { id: schedule.id } });
  assert.ok(after.nextRunAt > new Date());
  assert.ok(after.lastRunAt);

  // Idempotent: nothing due on the immediate re-scan.
  const rescan = await processDueReportSchedules();
  assert.equal(rescan.due, 0);

  const paused = await updateReportSchedule(admin, schedule.id, { isActive: false });
  assert.equal(paused.isActive, false);

  const privateDefinition = await createReportDefinition(admin, {
    name: 'Private scheduled funnel',
    reportKey: 'lead_funnel',
  });
  const privateSchedule = await createReportSchedule(admin, privateDefinition.id, {
    cadence: 'daily',
    hourUtc: 9,
    recipients: ['private@dynamicaqs.com'],
  });
  await assert.rejects(() => listReportDeliveries(tm, privateSchedule.id), /report schedule not found/i);

  await updateReportDefinition(admin, definition.id, { isActive: false });
  await assert.rejects(() => listReportDeliveries(admin, schedule.id), /report schedule not found/i);
});

test('training_compliance reports overdue programs and last completed training', SERIAL, async () => {
  const admin = await createAdminActor();

  const overdueAccount = await prisma.account.create({
    data: { displayName: 'Overdue Training Dealer', accountType: 'Dealer', isActive: true },
  });
  const currentAccount = await prisma.account.create({
    data: { displayName: 'Current Training Dealer', accountType: 'Dealer', isActive: true },
  });
  const archivedAccount = await prisma.account.create({
    data: { displayName: 'Archived Training Dealer', accountType: 'Dealer', isActive: true },
  });

  const pastDue = new Date(Date.now() - 14 * 86400000);
  const future = new Date(Date.now() + 30 * 86400000);

  await prisma.accountTrainingProgram.create({
    data: { accountId: overdueAccount.id, title: 'Overdue Onboarding', status: 'ACTIVE', nextDueAt: pastDue },
  });
  await prisma.accountTrainingProgram.create({
    data: { accountId: currentAccount.id, title: 'Current Onboarding', status: 'ACTIVE', nextDueAt: future },
  });
  // ARCHIVED (non-ACTIVE) programs must be excluded even though this one is overdue.
  await prisma.accountTrainingProgram.create({
    data: { accountId: archivedAccount.id, title: 'Archived Onboarding', status: 'ARCHIVED', nextDueAt: pastDue },
  });

  // Most-recent completed session drives lastCompletedAt for the overdue account.
  await prisma.trainingSession.createMany({
    data: [
      { accountId: overdueAccount.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Earlier session', completedAt: new Date('2026-02-01T10:00:00.000Z') },
      { accountId: overdueAccount.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Latest session', completedAt: new Date('2026-03-15T10:00:00.000Z') },
      // Incomplete sessions (no completedAt) are ignored by the last-completed rollup.
      { accountId: overdueAccount.id, activityKind: 'TRAINING', status: 'SCHEDULED', title: 'Upcoming session' },
    ],
  });

  const report = await runAdHocReport(admin, 'training_compliance', {});
  assert.equal(report.reportKey, 'training_compliance');
  assert.deepEqual(report.columns.map((column) => column.key), ['account', 'lastCompletedAt', 'nextDueAt', 'overdue']);

  const overdueRow = report.rows.find((row) => row.account === 'Overdue Training Dealer');
  assert.ok(overdueRow);
  assert.equal(overdueRow.overdue, 'Yes');
  assert.equal(overdueRow.lastCompletedAt, '2026-03-15');
  assert.equal(overdueRow.nextDueAt, pastDue.toISOString().slice(0, 10));

  const currentRow = report.rows.find((row) => row.account === 'Current Training Dealer');
  assert.ok(currentRow);
  assert.equal(currentRow.overdue, 'No');
  assert.equal(currentRow.lastCompletedAt, null);

  assert.equal(report.rows.find((row) => row.account === 'Archived Training Dealer'), undefined);
});

test('consignment_audit_status reports overdue ROSE audits and open work items', SERIAL, async () => {
  const admin = await createAdminActor();
  const account = await prisma.account.create({
    data: { displayName: 'Consignment Report Dealer', accountType: 'Dealer', isActive: true },
  });

  const pastDue = new Date(Date.now() - 7 * 86400000);
  const site = await prisma.consignmentSite.create({
    data: { accountId: account.id, name: 'Houston ROSE site', status: 'ACTIVE', nextAuditDueAt: pastDue },
  });

  // Only OPEN/IN_PROGRESS/BLOCKED work items count; COMPLETED/CANCELLED are excluded.
  await prisma.consignmentWorkItem.createMany({
    data: [
      { siteId: site.id, type: 'VARIANCE_REVIEW', status: 'OPEN', title: 'Open variance' },
      { siteId: site.id, type: 'PO_FOLLOW_UP', status: 'IN_PROGRESS', title: 'PO chase' },
      { siteId: site.id, type: 'EXIT_REVIEW', status: 'COMPLETED', title: 'Closed item' },
    ],
  });

  const report = await runAdHocReport(admin, 'consignment_audit_status', {});
  assert.equal(report.reportKey, 'consignment_audit_status');
  const row = report.rows.find((item) => item.site === 'Houston ROSE site');
  assert.ok(row);
  assert.equal(row.account, 'Consignment Report Dealer');
  assert.equal(row.status, 'ACTIVE');
  assert.equal(row.overdue, 'Yes');
  assert.equal(row.openWorkItems, 2);
  assert.equal(row.nextAuditDueAt, pastDue.toISOString().slice(0, 10));
});

test('field_activity counts training sessions and voice notes per field user', SERIAL, async () => {
  const admin = await createAdminActor();
  const account = await prisma.account.create({
    data: { displayName: 'Field Activity Dealer', accountType: 'Dealer', isActive: true },
  });
  const trainer = await prisma.user.create({
    data: { email: 'field.trainer@pulse.local', displayName: 'Field Trainer', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true },
  });
  const noteOnly = await prisma.user.create({
    data: { email: 'field.note@pulse.local', displayName: 'Note Only User', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true },
  });

  await prisma.trainingSession.createMany({
    data: [
      { accountId: account.id, trainerUserId: trainer.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Field session 1' },
      { accountId: account.id, trainerUserId: trainer.id, activityKind: 'TRAINING', status: 'COMPLETED', title: 'Field session 2' },
    ],
  });
  await prisma.mobileVoiceNote.createMany({
    data: [
      { createdByUserId: trainer.id, title: 'Trainer voice note' },
      { createdByUserId: noteOnly.id, title: 'Note-only voice note' },
    ],
  });

  const report = await runAdHocReport(admin, 'field_activity', {});
  assert.equal(report.reportKey, 'field_activity');

  const trainerRow = report.rows.find((row) => row.user === 'Field Trainer');
  assert.ok(trainerRow);
  assert.equal(trainerRow.trainingSessions, 2);
  assert.equal(trainerRow.voiceNotes, 1);

  // A user with only a voice note still appears, with zero sessions.
  const noteRow = report.rows.find((row) => row.user === 'Note Only User');
  assert.ok(noteRow);
  assert.equal(noteRow.trainingSessions, 0);
  assert.equal(noteRow.voiceNotes, 1);

  // The userId filter narrows both session and voice-note counts to a single field user.
  const filtered = await runAdHocReport(admin, 'field_activity', { userId: trainer.id });
  assert.equal(filtered.rows.find((row) => row.user === 'Note Only User'), undefined);
  const filteredTrainer = filtered.rows.find((row) => row.user === 'Field Trainer');
  assert.ok(filteredTrainer);
  assert.equal(filteredTrainer.trainingSessions, 2);
  assert.equal(filteredTrainer.voiceNotes, 1);
});

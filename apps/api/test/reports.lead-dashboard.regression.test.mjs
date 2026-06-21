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
let getLeadDashboard;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ getLeadDashboard } = await import('../dist/modules/reports/service.js'));

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

function actorFor(user) {
  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role: user.roleCode,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

async function seedLeads() {
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const region = await prisma.region.create({ data: { code: 'rpt_dash_region', name: 'Dash Region' } });
  const tmUser = await prisma.user.create({
    data: { email: 'tm.dash@pulse.local', displayName: 'Dash TM', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true },
  });
  const territory = await prisma.territory.create({
    data: { code: 'rpt_dash_territory', name: 'Dash Territory', regionId: region.id, managerUserId: tmUser.id },
  });

  const base = {
    contactDisplayName: 'Dash Contact',
    businessSegmentId: segment.id,
    leadSourceId: source.id,
    serviceTechCount: 4,
    routingBasisSnapshot: 'SERVICE_TECH_COUNT',
    routingThresholdSnapshot: 5,
    routingTeam: 'STRATEGIC_GROWTH',
  };

  // Two leads visible to the TM (MANUAL_OVERRIDE clears the pre-handoff gate) + one for nobody.
  await prisma.lead.createMany({
    data: [
      {
        ...base,
        companyName: 'Dash TM One',
        stage: 'NEW',
        state: 'TX',
        leadType: 'HOMEOWNER',
        assignedTmUserId: tmUser.id,
        territoryId: territory.id,
        territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      },
      {
        ...base,
        companyName: 'Dash TM Two',
        stage: 'CIS_SENT',
        state: 'TX',
        leadType: 'CONTRACTOR',
        assignedTmUserId: tmUser.id,
        territoryId: territory.id,
        territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      },
      {
        ...base,
        companyName: 'Dash Unassigned',
        stage: 'NEW',
        state: 'FL',
        leadType: 'HOMEOWNER',
      },
    ],
  });

  return { tmUser, source };
}

test('lead dashboard aggregates pipeline KPIs for a global-visibility actor', SERIAL, async () => {
  const admin = await createAdminActor();
  const { source } = await seedLeads();

  const dashboard = await getLeadDashboard(admin);

  assert.equal(dashboard.metrics.totalActiveLeads, 3);
  assert.equal(dashboard.metrics.newStageCount, 2);
  assert.equal(dashboard.segmentation.homeowner, 2);
  assert.equal(dashboard.segmentation.contractor, 1);
  assert.equal(dashboard.segmentation.unspecified, 0);

  // byStage covers every stage and sums to the active total.
  assert.equal(dashboard.byStage.length, 7);
  const stageSum = dashboard.byStage.reduce((total, bucket) => total + bucket.count, 0);
  assert.equal(stageSum, 3);
  assert.equal(dashboard.byStage.find((bucket) => bucket.stage === 'new')?.count, 2);
  assert.equal(dashboard.byStage.find((bucket) => bucket.stage === 'cis_sent')?.count, 1);

  // bySource resolves the ref name; byState buckets TX (2) ahead of FL (1).
  const sourceRow = dashboard.bySource.find((bucket) => bucket.key === source.name);
  assert.ok(sourceRow);
  assert.equal(sourceRow.count, 3);
  assert.equal(dashboard.byState[0]?.key, 'TX');
  assert.equal(dashboard.byState[0]?.count, 2);
  assert.equal(typeof dashboard.generatedAt, 'string');
});

test('FR-RPT-027: SLA-at-risk list surfaces overdue uncontacted leads, most overdue first', SERIAL, async () => {
  const admin = await createAdminActor();
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const tmUser = await prisma.user.create({
    data: { email: 'sla.tm@pulse.local', displayName: 'SLA TM', roleCode: 'TERRITORY_MANAGER', userType: 'INTERNAL', isActive: true },
  });
  const base = {
    contactDisplayName: 'SLA Contact',
    businessSegmentId: segment.id,
    leadSourceId: source.id,
    serviceTechCount: 4,
    routingBasisSnapshot: 'SERVICE_TECH_COUNT',
    routingThresholdSnapshot: 5,
    routingTeam: 'STRATEGIC_GROWTH',
    stage: 'NEW',
  };
  const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
  await prisma.lead.create({ data: { ...base, companyName: 'Most Overdue', assignedTmUserId: tmUser.id, initialContactDueAt: tenDaysAgo } });
  await prisma.lead.create({ data: { ...base, companyName: 'Less Overdue', initialContactDueAt: twoDaysAgo } });
  // Already contacted -> not at risk; not yet due -> not at risk.
  await prisma.lead.create({ data: { ...base, companyName: 'Already Contacted', initialContactDueAt: tenDaysAgo, initialContactedAt: new Date() } });
  await prisma.lead.create({ data: { ...base, companyName: 'Not Due Yet', initialContactDueAt: new Date(Date.now() + 5 * 86_400_000) } });

  const dashboard = await getLeadDashboard(admin);
  assert.equal(dashboard.metrics.slaAtRiskCount, 2);
  assert.equal(dashboard.slaAtRisk.length, 2);
  assert.equal(dashboard.slaAtRisk[0].companyName, 'Most Overdue'); // most overdue sorts first
  assert.equal(dashboard.slaAtRisk[0].ownerName, 'SLA TM');
  assert.ok(dashboard.slaAtRisk[0].daysOverdue >= 9);
  assert.equal(dashboard.slaAtRisk[1].companyName, 'Less Overdue');
  assert.equal(dashboard.slaAtRisk[1].ownerName, null); // unassigned
});

test('FR-RPT-022: per-stage aging reports days-in-stage avg/max + stale count', SERIAL, async () => {
  const admin = await createAdminActor();
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const base = {
    contactDisplayName: 'Aging Contact',
    businessSegmentId: segment.id,
    leadSourceId: source.id,
    serviceTechCount: 4,
    routingBasisSnapshot: 'SERVICE_TECH_COUNT',
    routingThresholdSnapshot: 5,
    routingTeam: 'STRATEGIC_GROWTH',
  };
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000 - 3_600_000); // +1h buffer keeps floor() stable
  // NEW anchors on createdAt; CIS_SENT anchors on cisSentAt.
  await prisma.lead.create({ data: { ...base, companyName: 'New Old', stage: 'NEW', createdAt: daysAgo(100) } });
  await prisma.lead.create({ data: { ...base, companyName: 'New Recent', stage: 'NEW', createdAt: daysAgo(10) } });
  await prisma.lead.create({ data: { ...base, companyName: 'CIS Sent', stage: 'CIS_SENT', createdAt: daysAgo(40), cisSentAt: daysAgo(2) } });

  const dashboard = await getLeadDashboard(admin);

  const newBucket = dashboard.byStage.find((b) => b.stage === 'new');
  assert.equal(newBucket.count, 2);
  assert.ok(newBucket.maxDaysInStage >= 99 && newBucket.maxDaysInStage <= 101, `new max=${newBucket.maxDaysInStage}`);
  assert.ok(newBucket.avgDaysInStage >= 50, `new avg=${newBucket.avgDaysInStage}`); // (100 + 10) / 2 = 55
  assert.ok(newBucket.staleCount >= 1); // the 100-day lead exceeds any reasonable stagnant threshold

  const cisBucket = dashboard.byStage.find((b) => b.stage === 'cis_sent');
  assert.equal(cisBucket.count, 1);
  assert.ok(cisBucket.maxDaysInStage >= 1 && cisBucket.maxDaysInStage <= 3, `cis max=${cisBucket.maxDaysInStage}`);

  // Empty stages report zeroes, never undefined.
  const signedBucket = dashboard.byStage.find((b) => b.stage === 'cis_signed');
  assert.equal(signedBucket.count, 0);
  assert.equal(signedBucket.avgDaysInStage, 0);
  assert.equal(signedBucket.maxDaysInStage, 0);
  assert.equal(signedBucket.staleCount, 0);
});

test('lead dashboard scopes counts to the actor record scope (TM sees only their book)', SERIAL, async () => {
  const { tmUser } = await seedLeads();
  const tmDashboard = await getLeadDashboard(actorFor(tmUser));

  // The TM sees their two MANUAL_OVERRIDE leads, not the unassigned one.
  assert.equal(tmDashboard.metrics.totalActiveLeads, 2);
  assert.equal(tmDashboard.segmentation.homeowner, 1);
  assert.equal(tmDashboard.segmentation.contractor, 1);
  assert.equal(tmDashboard.byState.find((bucket) => bucket.key === 'FL'), undefined);
});

test('lead dashboard denies roles without the reports module', SERIAL, async () => {
  const dealer = await prisma.user.create({
    data: { email: 'dealer.dash@pulse.local', displayName: 'Dealer Dash', roleCode: 'DEALER_PORTAL_USER', userType: 'DEALER', isActive: true },
  });
  await assert.rejects(() => getLeadDashboard(actorFor(dealer)));
});

test('lead dashboard denies a reports role that lacks lead.view (TRAINING_OPS)', SERIAL, async () => {
  await seedLeads();
  const trainingOps = await prisma.user.create({
    data: { email: 'trainops.dash@pulse.local', displayName: 'Training Ops', roleCode: 'TRAINING_OPS', userType: 'INTERNAL', isActive: true },
  });
  // TRAINING_OPS has the reports module + global record visibility but NO lead.view —
  // it must be denied lead-record KPIs, not handed org-wide lead data.
  await assert.rejects(() => getLeadDashboard(actorFor(trainingOps)));
});

test('lead dashboard scopes to a Regional Director region with no pre-handoff gate', SERIAL, async () => {
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const rd = await prisma.user.create({
    data: { email: 'rd.dash@pulse.local', displayName: 'Dash RD', roleCode: 'REGIONAL_DIRECTOR', userType: 'INTERNAL', isActive: true },
  });
  const region = await prisma.region.create({ data: { code: 'rd_dash_region', name: 'RD Dash Region', directorUserId: rd.id } });
  const territory = await prisma.territory.create({ data: { code: 'rd_dash_territory', name: 'RD Dash Territory', regionId: region.id } });
  const base = {
    contactDisplayName: 'RD Contact',
    businessSegmentId: segment.id,
    leadSourceId: source.id,
    serviceTechCount: 4,
    routingBasisSnapshot: 'SERVICE_TECH_COUNT',
    routingThresholdSnapshot: 5,
    routingTeam: 'STRATEGIC_GROWTH',
  };
  await prisma.lead.createMany({
    data: [
      // In-region via direct RD assignment, NEW with default routing (no override) —
      // proves the RD branch has NO pre-handoff gate (unlike TM).
      { ...base, companyName: 'RD Direct', stage: 'NEW', state: 'TX', leadType: 'CONTRACTOR', assignedRdUserId: rd.id, territoryId: territory.id, territoryAssignmentMethod: 'DEFAULT_STATE' },
      // In-region via territory -> region -> director.
      { ...base, companyName: 'RD Region Territory', stage: 'NEW', state: 'TX', leadType: 'HOMEOWNER', territoryId: territory.id, territoryAssignmentMethod: 'DEFAULT_STATE' },
      // Out of region, unassigned — must not be seen.
      { ...base, companyName: 'RD Outside', stage: 'NEW', state: 'FL', leadType: 'HOMEOWNER' },
    ],
  });

  const dashboard = await getLeadDashboard(actorFor(rd));
  assert.equal(dashboard.metrics.totalActiveLeads, 2);
  // RD sees raw NEW leads (no pre-handoff gate); both in-region leads are NEW.
  assert.equal(dashboard.byStage.find((bucket) => bucket.stage === 'new')?.count, 2);
  assert.equal(dashboard.byState.find((bucket) => bucket.key === 'FL'), undefined);
});

test('lead dashboard conversion + SLA metrics compute over mixed lifecycle/stage data', SERIAL, async () => {
  const admin = await createAdminActor();
  const segment = await prisma.businessSegmentRef.findFirst();
  const source = await prisma.leadSourceRef.findFirst();
  const past = new Date(Date.now() - 86_400_000);
  const future = new Date(Date.now() + 7 * 86_400_000);
  const base = {
    contactDisplayName: 'Mix Contact',
    businessSegmentId: segment.id,
    leadSourceId: source.id,
    serviceTechCount: 4,
    routingBasisSnapshot: 'SERVICE_TECH_COUNT',
    routingThresholdSnapshot: 5,
    routingTeam: 'STRATEGIC_GROWTH',
  };
  await prisma.lead.createMany({
    data: [
      { ...base, companyName: 'Mix Converted', stage: 'CUSTOMER_ACTIVE', lifecycleStatus: 'ACTIVE' },
      { ...base, companyName: 'Mix Closed', stage: 'NEW', lifecycleStatus: 'CLOSED' },
      { ...base, companyName: 'Mix AtRisk', stage: 'NEW', lifecycleStatus: 'ACTIVE', initialContactDueAt: past, initialContactedAt: null },
      { ...base, companyName: 'Mix Contacted', stage: 'NEW', lifecycleStatus: 'ACTIVE', initialContactDueAt: past, initialContactedAt: past },
      { ...base, companyName: 'Mix Future', stage: 'NEW', lifecycleStatus: 'ACTIVE', initialContactDueAt: future, initialContactedAt: null },
    ],
  });

  const dashboard = await getLeadDashboard(admin);
  // 4 ACTIVE (1 converted + 3 NEW); the CLOSED lead is excluded from active but counted in totalLeads.
  assert.equal(dashboard.metrics.totalActiveLeads, 4);
  assert.equal(dashboard.metrics.totalLeads, 5);
  assert.equal(dashboard.metrics.convertedLeads, 1);
  assert.equal(dashboard.metrics.conversionRatePct, 20); // round(1 / 5 * 100)
  assert.equal(dashboard.metrics.slaAtRiskCount, 1); // only the past-due + never-contacted active lead
});

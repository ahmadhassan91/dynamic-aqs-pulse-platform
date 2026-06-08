import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let createLead;
let listLeads;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    listLeads,
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
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));

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
  await ensureLeadRoutingPolicySeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
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
    displayName: auth.identity.displayName ?? process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Pulse Bootstrap Admin',
  };
}

// UX-L-014: listLeads territoryId filter
test('listLeads filters by territoryId and excludes leads from other territories and unassigned leads', SERIAL, async () => {
  const actor = await createAdminActor();

  // Create a minimal territory record directly so we can set distinct IDs without
  // triggering full coverage-routing side effects.  We need a shippingCenter first.
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const rdUser = await prisma.user.create({
    data: {
      email: 'rd.territory.filter@pulse.local',
      displayName: 'RD Territory Filter',
      roleCode: 'REGIONAL_DIRECTOR',
      userType: 'INTERNAL',
      isActive: true,
    },
  });

  const region = await prisma.region.create({
    data: {
      code: 'rg_territory_filter',
      name: 'Territory Filter Region',
      directorUserId: rdUser.id,
      isActive: true,
    },
  });

  const tmUser = await prisma.user.create({
    data: {
      email: 'tm.territory.filter@pulse.local',
      displayName: 'TM Territory Filter',
      roleCode: 'TERRITORY_MANAGER',
      userType: 'INTERNAL',
      isActive: true,
    },
  });

  const territoryA = await prisma.territory.create({
    data: {
      code: 'territory_filter_a',
      name: 'Territory Filter A',
      regionId: region.id,
      managerUserId: tmUser.id,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const territoryB = await prisma.territory.create({
    data: {
      code: 'territory_filter_b',
      name: 'Territory Filter B',
      regionId: region.id,
      managerUserId: tmUser.id,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  // Create three leads without any state-based territory auto-assignment
  const leadA = await createLead(actor, {
    companyName: 'Territory Filter Lead A',
    serviceTechCount: 2,
  });

  const leadB = await createLead(actor, {
    companyName: 'Territory Filter Lead B',
    serviceTechCount: 3,
  });

  const leadNull = await createLead(actor, {
    companyName: 'Territory Filter Lead Unassigned',
    serviceTechCount: 1,
  });

  // Directly set distinct territoryId values; leave leadNull without a territory
  await prisma.lead.update({
    where: { id: leadA.id },
    data: { territoryId: territoryA.id },
  });

  await prisma.lead.update({
    where: { id: leadB.id },
    data: { territoryId: territoryB.id },
  });

  // Filter by territoryA — should return only leadA
  const resultA = await listLeads(actor, { territoryId: territoryA.id });
  assert.equal(resultA.total, 1, 'expected exactly one lead for territory A');
  assert.equal(resultA.items[0].id, leadA.id, 'expected lead A in results for territory A filter');
  assert.ok(!resultA.items.some((item) => item.id === leadB.id), 'lead B must not appear in territory A results');
  assert.ok(!resultA.items.some((item) => item.id === leadNull.id), 'unassigned lead must not appear in territory A results');

  // Filter by territoryB — should return only leadB
  const resultB = await listLeads(actor, { territoryId: territoryB.id });
  assert.equal(resultB.total, 1, 'expected exactly one lead for territory B');
  assert.equal(resultB.items[0].id, leadB.id, 'expected lead B in results for territory B filter');
  assert.ok(!resultB.items.some((item) => item.id === leadA.id), 'lead A must not appear in territory B results');
  assert.ok(!resultB.items.some((item) => item.id === leadNull.id), 'unassigned lead must not appear in territory B results');

  // No filter — all three active leads are visible to the admin
  const resultAll = await listLeads(actor, {});
  assert.ok(resultAll.total >= 3, 'expected all three leads when no territory filter is applied');
  assert.ok(resultAll.items.some((item) => item.id === leadA.id), 'lead A must appear in unfiltered results');
  assert.ok(resultAll.items.some((item) => item.id === leadB.id), 'lead B must appear in unfiltered results');
  assert.ok(resultAll.items.some((item) => item.id === leadNull.id), 'unassigned lead must appear in unfiltered results');
});

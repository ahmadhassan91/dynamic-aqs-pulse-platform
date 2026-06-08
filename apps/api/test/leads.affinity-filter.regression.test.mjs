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

test('listLeads affinityGroupCode filter returns only leads matching the requested group', SERIAL, async () => {
  const actor = await createAdminActor();

  // Seed three leads: one with NEXSTAR, one with CERTAINPATH, one with no affinity group.
  const nexstarLead = await createLead(actor, {
    companyName: 'Nexstar Member HVAC',
    serviceTechCount: 3,
    state: 'TX',
    affinityGroupCode: 'NEXSTAR',
    affinityGroupSelection: 'group',
    ownershipGroupSelection: 'none',
  });

  const certainPathLead = await createLead(actor, {
    companyName: 'CertainPath Member Cooling',
    serviceTechCount: 4,
    state: 'FL',
    affinityGroupCode: 'CERTAINPATH',
    affinityGroupSelection: 'group',
    ownershipGroupSelection: 'none',
  });

  await createLead(actor, {
    companyName: 'Unaffiliated IAQ Services',
    serviceTechCount: 2,
    state: 'CA',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  // Filter by NEXSTAR — should return only the Nexstar lead.
  const nexstarResults = await listLeads(actor, { affinityGroupCode: 'NEXSTAR' });
  assert.equal(nexstarResults.total, 1, 'expected exactly one NEXSTAR lead');
  assert.equal(nexstarResults.items[0].id, nexstarLead.id);
  assert.equal(nexstarResults.items[0].affinityGroupCode, 'NEXSTAR');

  // Filter by CERTAINPATH — should return only the CertainPath lead.
  const certainPathResults = await listLeads(actor, { affinityGroupCode: 'CERTAINPATH' });
  assert.equal(certainPathResults.total, 1, 'expected exactly one CERTAINPATH lead');
  assert.equal(certainPathResults.items[0].id, certainPathLead.id);
  assert.equal(certainPathResults.items[0].affinityGroupCode, 'CERTAINPATH');
});

test('listLeads affinityGroupCode filter excludes leads with a different group code', SERIAL, async () => {
  const actor = await createAdminActor();

  await createLead(actor, {
    companyName: 'EGIA Member Mechanical',
    serviceTechCount: 5,
    state: 'NV',
    affinityGroupCode: 'EGIA',
    affinityGroupSelection: 'group',
    ownershipGroupSelection: 'none',
  });

  await createLead(actor, {
    companyName: 'Nexstar Air Systems',
    serviceTechCount: 6,
    state: 'TX',
    affinityGroupCode: 'NEXSTAR',
    affinityGroupSelection: 'group',
    ownershipGroupSelection: 'none',
  });

  // Filtering for EGIA must not surface the NEXSTAR lead.
  const egiaResults = await listLeads(actor, { affinityGroupCode: 'EGIA' });
  const ids = egiaResults.items.map((item) => item.id);
  assert.ok(egiaResults.total >= 1, 'expected at least one EGIA result');
  assert.ok(
    egiaResults.items.every((item) => item.affinityGroupCode === 'EGIA'),
    'all returned leads must belong to the EGIA group',
  );

  // Nexstar lead must not appear in EGIA results.
  const nexstarResults = await listLeads(actor, { affinityGroupCode: 'NEXSTAR' });
  const nexstarIds = nexstarResults.items.map((item) => item.id);
  assert.ok(
    !ids.some((id) => nexstarIds.includes(id)),
    'EGIA and NEXSTAR result sets must not overlap',
  );
});

test('listLeads affinityGroupCode filter returns empty when the code is unknown', SERIAL, async () => {
  const actor = await createAdminActor();

  await createLead(actor, {
    companyName: 'Known Group Heating',
    serviceTechCount: 3,
    state: 'TX',
    affinityGroupCode: 'NEXSTAR',
    affinityGroupSelection: 'group',
    ownershipGroupSelection: 'none',
  });

  const results = await listLeads(actor, { affinityGroupCode: 'UNKNOWN_GROUP_XYZ' });
  assert.equal(results.total, 0, 'expected zero results for an unknown affinity group code');
  assert.equal(results.items.length, 0);
});

test('listLeads without affinityGroupCode filter returns all active leads regardless of group', SERIAL, async () => {
  const actor = await createAdminActor();

  const leadA = await createLead(actor, {
    companyName: 'Multi Group Alpha HVAC',
    serviceTechCount: 2,
    state: 'TX',
    affinityGroupCode: 'NEXSTAR',
    affinityGroupSelection: 'group',
    ownershipGroupSelection: 'none',
  });

  const leadB = await createLead(actor, {
    companyName: 'Multi Group Beta Cooling',
    serviceTechCount: 3,
    state: 'FL',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  const results = await listLeads(actor, {});
  const resultIds = results.items.map((item) => item.id);
  assert.ok(resultIds.includes(leadA.id), 'unfiltered list must include NEXSTAR lead');
  assert.ok(resultIds.includes(leadB.id), 'unfiltered list must include lead with no group');
  assert.ok(results.total >= 2);
});

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

test('listLeads ownershipGroupCode filter returns only leads matching the requested group', SERIAL, async () => {
  const actor = await createAdminActor();

  // Seed three leads: one with REDWOOD_SERVICES, one with APOLLO, one with no ownership group.
  const redwoodLead = await createLead(actor, {
    companyName: 'Redwood PE Portfolio HVAC',
    serviceTechCount: 3,
    state: 'TX',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'REDWOOD_SERVICES',
  });

  const apolloLead = await createLead(actor, {
    companyName: 'Apollo PE Portfolio Cooling',
    serviceTechCount: 4,
    state: 'FL',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'APOLLO',
  });

  await createLead(actor, {
    companyName: 'Independent IAQ Services',
    serviceTechCount: 2,
    state: 'CA',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  // Filter by REDWOOD_SERVICES — should return only the Redwood lead.
  const redwoodResults = await listLeads(actor, { ownershipGroupCode: 'REDWOOD_SERVICES' });
  assert.equal(redwoodResults.total, 1, 'expected exactly one REDWOOD_SERVICES lead');
  assert.equal(redwoodResults.items[0].id, redwoodLead.id);
  assert.equal(redwoodResults.items[0].ownershipGroupCode, 'REDWOOD_SERVICES');

  // Filter by APOLLO — should return only the Apollo lead.
  const apolloResults = await listLeads(actor, { ownershipGroupCode: 'APOLLO' });
  assert.equal(apolloResults.total, 1, 'expected exactly one APOLLO lead');
  assert.equal(apolloResults.items[0].id, apolloLead.id);
  assert.equal(apolloResults.items[0].ownershipGroupCode, 'APOLLO');
});

test('listLeads ownershipGroupCode filter excludes leads with a different group code', SERIAL, async () => {
  const actor = await createAdminActor();

  await createLead(actor, {
    companyName: 'Redwood PE Mechanical Services',
    serviceTechCount: 5,
    state: 'NV',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'REDWOOD_SERVICES',
  });

  await createLead(actor, {
    companyName: 'Apollo Air Systems',
    serviceTechCount: 6,
    state: 'TX',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'APOLLO',
  });

  // Filtering for REDWOOD_SERVICES must not surface the APOLLO lead.
  const redwoodResults = await listLeads(actor, { ownershipGroupCode: 'REDWOOD_SERVICES' });
  const redwoodIds = redwoodResults.items.map((item) => item.id);
  assert.ok(redwoodResults.total >= 1, 'expected at least one REDWOOD_SERVICES result');
  assert.ok(
    redwoodResults.items.every((item) => item.ownershipGroupCode === 'REDWOOD_SERVICES'),
    'all returned leads must belong to the REDWOOD_SERVICES group',
  );

  // APOLLO lead must not appear in REDWOOD_SERVICES results.
  const apolloResults = await listLeads(actor, { ownershipGroupCode: 'APOLLO' });
  const apolloIds = apolloResults.items.map((item) => item.id);
  assert.ok(
    !redwoodIds.some((id) => apolloIds.includes(id)),
    'REDWOOD_SERVICES and APOLLO result sets must not overlap',
  );
});

test('listLeads ownershipGroupCode filter returns empty when the code is unknown', SERIAL, async () => {
  const actor = await createAdminActor();

  await createLead(actor, {
    companyName: 'Known Ownership Group Heating',
    serviceTechCount: 3,
    state: 'TX',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'REDWOOD_SERVICES',
  });

  const results = await listLeads(actor, { ownershipGroupCode: 'UNKNOWN_OWNERSHIP_XYZ' });
  assert.equal(results.total, 0, 'expected zero results for an unknown ownership group code');
  assert.equal(results.items.length, 0);
});

test('listLeads without ownershipGroupCode filter returns all active leads regardless of ownership group', SERIAL, async () => {
  const actor = await createAdminActor();

  const leadA = await createLead(actor, {
    companyName: 'PE Ownership Alpha HVAC',
    serviceTechCount: 2,
    state: 'TX',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'group',
    ownershipGroupCode: 'REDWOOD_SERVICES',
  });

  const leadB = await createLead(actor, {
    companyName: 'Independent Beta Cooling',
    serviceTechCount: 3,
    state: 'FL',
    affinityGroupSelection: 'none',
    ownershipGroupSelection: 'none',
  });

  const results = await listLeads(actor, {});
  const resultIds = results.items.map((item) => item.id);
  assert.ok(resultIds.includes(leadA.id), 'unfiltered list must include REDWOOD_SERVICES lead');
  assert.ok(resultIds.includes(leadB.id), 'unfiltered list must include lead with no ownership group');
  assert.ok(results.total >= 2);
});

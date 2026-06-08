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

// UX-L-013: listLeads pagination — page is zero-based; default page size is 50.
// We seed 7 leads and request pages of size 5 to get two disjoint slices.
test('UX-L-013: first and second pages return disjoint slices and total counts all leads', SERIAL, async () => {
  const actor = await createAdminActor();

  const PAGE_SIZE = 5;
  const TOTAL_LEADS = 7;

  // Seed enough leads to overflow a single page.
  const created = [];
  for (let i = 1; i <= TOTAL_LEADS; i++) {
    const lead = await createLead(actor, {
      companyName: `Pagination Test HVAC ${String(i).padStart(2, '0')}`,
      serviceTechCount: i,
      state: 'TX',
    });
    created.push(lead);
  }

  // Fetch page 0 (first page, zero-based).
  const page0 = await listLeads(actor, { limit: PAGE_SIZE, page: 0 });

  assert.equal(page0.total, TOTAL_LEADS, 'total should reflect all seeded leads, not just the current page');
  assert.equal(page0.items.length, PAGE_SIZE, 'first page should contain exactly PAGE_SIZE items');

  // Fetch page 1 (second page, zero-based).
  const page1 = await listLeads(actor, { limit: PAGE_SIZE, page: 1 });

  assert.equal(page1.total, TOTAL_LEADS, 'total on second page should still count all leads');
  assert.equal(page1.items.length, TOTAL_LEADS - PAGE_SIZE, 'second page should contain the remainder');

  // The two pages must be disjoint by id.
  const page0Ids = new Set(page0.items.map((item) => item.id));
  const page1Ids = new Set(page1.items.map((item) => item.id));
  for (const id of page1Ids) {
    assert.ok(!page0Ids.has(id), `lead ${id} appeared on both page 0 and page 1`);
  }

  // Together the two pages must contain every seeded lead exactly once.
  const allPagedIds = new Set([...page0Ids, ...page1Ids]);
  for (const lead of created) {
    assert.ok(allPagedIds.has(lead.id), `created lead ${lead.id} was missing from paginated results`);
  }
});

// UX-L-013: fetching beyond the last page returns an empty items array but the correct total.
test('UX-L-013: requesting a page beyond the last page returns empty items with correct total', SERIAL, async () => {
  const actor = await createAdminActor();

  const PAGE_SIZE = 5;
  const TOTAL_LEADS = 3;

  for (let i = 1; i <= TOTAL_LEADS; i++) {
    await createLead(actor, {
      companyName: `Out Of Range HVAC ${i}`,
      serviceTechCount: i,
      state: 'FL',
    });
  }

  // Page 1 is entirely beyond the 3 seeded leads when page size is 5.
  const beyondLast = await listLeads(actor, { limit: PAGE_SIZE, page: 1 });

  assert.equal(beyondLast.total, TOTAL_LEADS, 'total should still count all leads when page is out of range');
  assert.equal(beyondLast.items.length, 0, 'items should be empty when paging beyond available records');
});

// UX-L-013: omitting the page param behaves the same as page 0.
test('UX-L-013: omitting page param defaults to page 0 and matches an explicit page:0 request', SERIAL, async () => {
  const actor = await createAdminActor();

  const PAGE_SIZE = 5;
  const TOTAL_LEADS = 6;

  for (let i = 1; i <= TOTAL_LEADS; i++) {
    await createLead(actor, {
      companyName: `Default Page HVAC ${i}`,
      serviceTechCount: i,
      state: 'CA',
    });
  }

  const implicit = await listLeads(actor, { limit: PAGE_SIZE });
  const explicit = await listLeads(actor, { limit: PAGE_SIZE, page: 0 });

  assert.equal(implicit.total, TOTAL_LEADS);
  assert.equal(explicit.total, TOTAL_LEADS);
  assert.equal(implicit.items.length, PAGE_SIZE);
  assert.equal(explicit.items.length, PAGE_SIZE);

  const implicitIds = implicit.items.map((item) => item.id);
  const explicitIds = explicit.items.map((item) => item.id);
  assert.deepEqual(implicitIds, explicitIds, 'implicit default page must return same items as explicit page:0');
});

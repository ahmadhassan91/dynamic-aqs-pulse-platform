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
let listAccounts;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ listAccounts } = await import('../dist/modules/accounts/service.js'));
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

async function seedPaginationAccounts() {
  // Create accounts with known displayNames in a predictable sort order.
  // Order by displayName asc then createdAt asc — insert in reverse alpha order
  // so the DB insertion order does not accidentally mask ordering bugs.
  const ddd = await prisma.account.create({
    data: {
      displayName: 'DDD Co',
      legalName: 'DDD Co LLC',
      isActive: true,
    },
  });

  const ccc = await prisma.account.create({
    data: {
      displayName: 'CCC Co',
      legalName: 'CCC Co LLC',
      isActive: true,
    },
  });

  const bbb = await prisma.account.create({
    data: {
      displayName: 'BBB Co',
      legalName: 'BBB Co LLC',
      isActive: true,
    },
  });

  const aaa = await prisma.account.create({
    data: {
      displayName: 'AAA Co',
      legalName: 'AAA Co LLC',
      isActive: true,
    },
  });

  // Expected sort order (displayName asc): AAA Co, BBB Co, CCC Co, DDD Co
  return { aaa, bbb, ccc, ddd };
}

test('listAccounts offset=1 limit=2 skips the first ordered account and returns the next two', SERIAL, async () => {
  const actor = await createAdminActor();
  const { aaa, bbb, ccc } = await seedPaginationAccounts();

  const result = await listAccounts(actor, { offset: 1, limit: 2 });

  assert.equal(result.total, 4, 'total should count all accounts regardless of pagination');
  assert.equal(result.items.length, 2, 'page should contain exactly 2 items');

  // After skipping AAA Co (index 0), the next two are BBB Co then CCC Co
  assert.equal(result.items[0].id, bbb.id, 'first item should be BBB Co (index 1)');
  assert.equal(result.items[0].displayName, 'BBB Co');
  assert.equal(result.items[1].id, ccc.id, 'second item should be CCC Co (index 2)');
  assert.equal(result.items[1].displayName, 'CCC Co');

  // AAA Co must not appear in this page
  const ids = result.items.map((item) => item.id);
  assert.ok(!ids.includes(aaa.id), 'AAA Co must be skipped by offset=1');
});

test('listAccounts offset=0 is equivalent to no offset and returns from the first account', SERIAL, async () => {
  const actor = await createAdminActor();
  const { aaa, bbb } = await seedPaginationAccounts();

  const withZeroOffset = await listAccounts(actor, { offset: 0, limit: 2 });
  const withNoOffset = await listAccounts(actor, { limit: 2 });

  assert.equal(withZeroOffset.total, 4);
  assert.equal(withNoOffset.total, 4);

  // Both should start from AAA Co
  assert.equal(withZeroOffset.items[0].id, aaa.id, 'offset=0 first item should be AAA Co');
  assert.equal(withZeroOffset.items[1].id, bbb.id, 'offset=0 second item should be BBB Co');

  assert.equal(withNoOffset.items[0].id, aaa.id, 'no-offset first item should be AAA Co');
  assert.equal(withNoOffset.items[1].id, bbb.id, 'no-offset second item should be BBB Co');

  assert.deepEqual(
    withZeroOffset.items.map((item) => item.id),
    withNoOffset.items.map((item) => item.id),
    'offset=0 and no offset must return identical item sets',
  );
});

test('listAccounts offset beyond total returns empty items but total still reflects all accounts', SERIAL, async () => {
  const actor = await createAdminActor();
  await seedPaginationAccounts();

  // offset of 100 is well beyond the 4 seeded accounts
  const result = await listAccounts(actor, { offset: 100, limit: 10 });

  assert.equal(result.total, 4, 'total must still count all 4 accounts even when offset exceeds them');
  assert.equal(result.items.length, 0, 'items must be empty when offset is beyond total');
});

test('listAccounts returns accounts in displayName asc then createdAt asc order', SERIAL, async () => {
  const actor = await createAdminActor();
  const { aaa, bbb, ccc, ddd } = await seedPaginationAccounts();

  const result = await listAccounts(actor, { limit: 10 });

  assert.equal(result.total, 4);
  assert.equal(result.items.length, 4);

  // Full page should be ordered: AAA Co, BBB Co, CCC Co, DDD Co
  assert.deepEqual(
    result.items.map((item) => item.id),
    [aaa.id, bbb.id, ccc.id, ddd.id],
    'accounts must be sorted by displayName asc',
  );
});

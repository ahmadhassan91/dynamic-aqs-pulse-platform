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
let createAccountLocation;
let updateAccountLocation;
let getAccountDetail;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead } = await import('../dist/modules/leads/service.js'));

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
  ({
    createAccountLocation,
    updateAccountLocation,
    getAccountDetail,
  } = await import('../dist/modules/accounts/service.js'));
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

test('UX-A-012 (a): create location with locationType billing round-trips correctly without bracket prefix leaking', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Location Type Billing Account',
      legalName: 'Location Type Billing Account LLC',
    },
  });

  const location = await createAccountLocation(actor, account.id, {
    name: 'Head Office',
    city: 'Dallas',
    state: 'TX',
    locationType: 'billing',
    isPrimary: true,
  });

  assert.ok(location.id);

  const detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.locations.length, 1);

  const found = detail.locations.find((loc) => loc.id === location.id);
  assert.ok(found, 'location should be present in account detail');

  // locationType must round-trip as 'billing'
  assert.equal(found.locationType, 'billing');

  // the name exposed on the read model must NOT contain the bracket prefix
  if (found.name !== undefined) {
    assert.doesNotMatch(found.name, /^\[billing\]/i, 'name must not expose [billing] bracket prefix on read');
  }
});

test('UX-A-012 (b): update location locationType to shipping reads back shipping', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Location Type Shipping Account',
      legalName: 'Location Type Shipping Account LLC',
    },
  });

  const location = await createAccountLocation(actor, account.id, {
    name: 'Warehouse',
    city: 'Houston',
    state: 'TX',
    locationType: 'billing',
    isPrimary: true,
  });

  await updateAccountLocation(actor, account.id, location.id, {
    locationType: 'shipping',
  });

  const detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);

  const updated = detail.locations.find((loc) => loc.id === location.id);
  assert.ok(updated, 'updated location should be present in account detail');
  assert.equal(updated.locationType, 'shipping');

  // name must not expose any bracket prefix
  if (updated.name !== undefined) {
    assert.doesNotMatch(updated.name, /^\[shipping\]/i, 'name must not expose [shipping] bracket prefix on read');
    assert.doesNotMatch(updated.name, /^\[billing\]/i, 'name must not expose old [billing] bracket prefix on read');
  }
});

test('UX-A-012 (c): clearing locationType reads back absent or other', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Location Type Clear Account',
      legalName: 'Location Type Clear Account LLC',
    },
  });

  const location = await createAccountLocation(actor, account.id, {
    name: 'Main Site',
    city: 'Austin',
    state: 'TX',
    locationType: 'both',
    isPrimary: true,
  });

  // Passing null for locationType signals a clear
  await updateAccountLocation(actor, account.id, location.id, {
    locationType: null,
  });

  const detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);

  const cleared = detail.locations.find((loc) => loc.id === location.id);
  assert.ok(cleared, 'cleared location should be present in account detail');

  // After clearing the type, the value must be either absent (undefined) or 'other'
  const isAbsentOrOther = cleared.locationType === undefined || cleared.locationType === 'other';
  assert.ok(isAbsentOrOther, `expected locationType to be absent or 'other' after clear, got: ${cleared.locationType}`);

  // Name must not expose any bracket prefix from the old type
  if (cleared.name !== undefined) {
    assert.doesNotMatch(cleared.name, /^\[both\]/i, 'name must not expose old [both] bracket prefix after clear');
  }
});

test('UX-A-012 (d): adding locationType to a plain-name location must not double-prefix on read', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Location Type No Double Prefix Account',
      legalName: 'Location Type No Double Prefix Account LLC',
    },
  });

  // Create with no locationType — plain name
  const location = await createAccountLocation(actor, account.id, {
    name: 'Distribution Center',
    city: 'San Antonio',
    state: 'TX',
    isPrimary: true,
  });

  // Now add a locationType via update
  await updateAccountLocation(actor, account.id, location.id, {
    locationType: 'shipping',
  });

  const detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);

  const updated = detail.locations.find((loc) => loc.id === location.id);
  assert.ok(updated, 'updated location should be present in account detail');
  assert.equal(updated.locationType, 'shipping');

  // Name must expose the plain name without any bracket prefix
  if (updated.name !== undefined) {
    // Must not start with a bracket prefix
    assert.doesNotMatch(updated.name, /^\[shipping\]/i, 'name must not expose [shipping] bracket prefix on read');
    // Must not double-prefix (e.g. '[shipping] [shipping] Distribution Center')
    const prefixCount = (updated.name.match(/\[shipping\]/gi) ?? []).length;
    assert.equal(prefixCount, 0, `expected no [shipping] bracket in read-model name, found ${prefixCount} occurrence(s)`);
  }
});

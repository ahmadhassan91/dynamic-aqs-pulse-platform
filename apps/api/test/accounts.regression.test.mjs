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
let authenticateAccessToken;
let createLead;
let createAccount;
let updateAccount;
let createAccountContact;
let updateAccountContact;
let createAccountLocation;
let updateAccountLocation;
let listAccounts;
let getAccountDetail;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    createAccount,
    updateAccount,
    createAccountContact,
    updateAccountContact,
    createAccountLocation,
    updateAccountLocation,
    listAccounts,
    getAccountDetail,
  } = await import('../dist/modules/accounts/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

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

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected a bootstrap admin actor');
  return actor;
}

test('accounts list and detail expose converted lead territory assignment context', SERIAL, async () => {
  const actor = await createAdminActor();
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const region = await prisma.region.create({
    data: {
      code: 'rg_accounts',
      name: 'Accounts Region',
      directorUserId: actor.userId,
      isActive: true,
    },
  });
  const territory = await prisma.territory.create({
    data: {
      code: 'tx_accounts',
      name: 'Texas Accounts Territory',
      regionId: region.id,
      managerUserId: actor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const lead = await createLead(actor, {
    companyName: 'Account Regression Comfort',
    contactDisplayName: 'Avery Accounts',
    email: 'accounts@regression.test',
    phone: '555-991-0000',
    state: 'TX',
    serviceTechCount: 5,
  });

  const account = await prisma.account.create({
    data: {
      sourceLeadId: lead.id,
      displayName: 'Account Regression Comfort',
      legalName: 'Account Regression Comfort LLC',
      accountType: 'Dealer',
      territoryId: territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date('2026-04-14T09:00:00.000Z'),
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: actor.userId,
      assignedRdUserId: actor.userId,
      isActive: true,
      locations: {
        create: {
          name: 'Primary',
          line1: '455 Market Street',
          city: 'Dallas',
          state: 'TX',
          postalCode: '75201',
          countryCode: 'US',
          isPrimary: true,
        },
      },
      contacts: {
        create: {
          firstName: 'Avery',
          lastName: 'Accounts',
          email: 'accounts@regression.test',
          roleCode: 'primary',
          isPrimary: true,
        },
      },
    },
  });

  const listed = await listAccounts(actor, {
    search: 'Regression Comfort',
  });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].id, account.id);
  assert.equal(listed.items[0].sourceLeadId, lead.id);
  assert.equal(listed.items[0].territoryId, territory.id);
  assert.equal(listed.items[0].territoryCode, 'tx_accounts');
  assert.equal(listed.items[0].regionCode, 'rg_accounts');
  assert.equal(listed.items[0].shippingCenterCode, shippingCenter.code);
  assert.equal(listed.items[0].assignedTmUserId, actor.userId);
  assert.equal(listed.items[0].assignedRdUserId, actor.userId);
  assert.equal(listed.items[0].territoryAssignmentMethod, 'manual_override');

  const detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.id, account.id);
  assert.equal(detail.sourceLeadId, lead.id);
  assert.equal(detail.territoryName, 'Texas Accounts Territory');
  assert.equal(detail.regionName, 'Accounts Region');
  assert.equal(detail.shippingCenterName, shippingCenter.name);
  assert.equal(detail.assignedTmName, actor.displayName);
  assert.equal(detail.assignedRdName, actor.displayName);
  assert.equal(detail.contacts.length, 1);
  assert.equal(detail.locations.length, 1);
});

test('direct customer creation is reserved for super admin or migration workflows', SERIAL, async () => {
  const actor = await createAdminActor();

  await assert.rejects(
    createAccount(
      {
        ...actor,
        role: 'SALES_BD_REP',
      },
      {
        displayName: 'Should Not Create',
      },
    ),
    /reserved for bootstrap or migration workflows/i,
  );

  const created = await createAccount(actor, {
    displayName: 'Migration Seed Account',
    legalName: 'Migration Seed Account LLC',
    accountType: 'Dealer',
  });

  assert.equal(created.displayName, 'Migration Seed Account');
});

test('account contact maintenance supports primary reassignment and soft deactivation', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Contact Maintenance Account',
      legalName: 'Contact Maintenance Account LLC',
    },
  });

  const primary = await createAccountContact(actor, account.id, {
    firstName: 'Avery',
    lastName: 'Primary',
    email: 'avery@example.com',
    roleCode: 'Primary',
    isPrimary: true,
  });

  const secondary = await createAccountContact(actor, account.id, {
    firstName: 'Jordan',
    lastName: 'Backup',
    email: 'jordan@example.com',
    roleCode: 'Ordering',
  });

  await updateAccountContact(actor, account.id, secondary.id, {
    isPrimary: true,
    roleCode: 'Owner/GM',
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const updatedPrimary = detail.contacts.find((contact) => contact.id === secondary.id);
  const demotedPrimary = detail.contacts.find((contact) => contact.id === primary.id);
  assert.equal(updatedPrimary?.isPrimary, true);
  assert.equal(updatedPrimary?.roleCode, 'Owner/GM');
  assert.equal(demotedPrimary?.isPrimary, false);

  await updateAccountContact(actor, account.id, secondary.id, {
    isActive: false,
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const reactivatedPrimary = detail.contacts.find((contact) => contact.id === primary.id);
  const inactiveContact = detail.contacts.find((contact) => contact.id === secondary.id);
  assert.equal(reactivatedPrimary?.isPrimary, true);
  assert.equal(inactiveContact?.isActive, false);
});

test('account location maintenance supports primary switching and deactivation fallback', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Location Maintenance Account',
      legalName: 'Location Maintenance Account LLC',
    },
  });

  const primary = await createAccountLocation(actor, account.id, {
    name: 'Dallas',
    line1: '100 Main Street',
    city: 'Dallas',
    state: 'TX',
    isPrimary: true,
  });

  const secondary = await createAccountLocation(actor, account.id, {
    name: 'Fort Worth',
    line1: '200 Commerce Street',
    city: 'Fort Worth',
    state: 'TX',
  });

  await updateAccountLocation(actor, account.id, secondary.id, {
    isPrimary: true,
    postalCode: '76102',
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const nextPrimary = detail.locations.find((location) => location.id === secondary.id);
  const oldPrimary = detail.locations.find((location) => location.id === primary.id);
  assert.equal(nextPrimary?.isPrimary, true);
  assert.equal(nextPrimary?.postalCode, '76102');
  assert.equal(oldPrimary?.isPrimary, false);

  await updateAccountLocation(actor, account.id, secondary.id, {
    isActive: false,
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const fallbackPrimary = detail.locations.find((location) => location.id === primary.id);
  const inactiveLocation = detail.locations.find((location) => location.id === secondary.id);
  assert.equal(fallbackPrimary?.isPrimary, true);
  assert.equal(inactiveLocation?.isActive, false);
});

test('account summary updates are editable through the governed maintenance path', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Editable Account',
      legalName: 'Editable Account LLC',
      accountType: 'Dealer',
      isActive: true,
    },
  });

  const updated = await updateAccount(actor, account.id, {
    displayName: 'Editable Account Updated',
    legalName: null,
    accountType: 'Distributor',
    isActive: false,
  });

  assert.equal(updated.displayName, 'Editable Account Updated');
  assert.equal(updated.accountType, 'Distributor');
  assert.equal(updated.isActive, false);

  const detail = await getAccountDetail(actor, account.id);
  assert.equal(detail?.legalName, undefined);
});

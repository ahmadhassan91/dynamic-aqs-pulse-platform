import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let getDealerPortalAccount;
let provisionDealerPortalUser;
let updateDealerPortalUserStatus;
let resetDealerPortalUserPassword;
let getCurrentDealerPortalDashboard;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    getDealerPortalAccount,
    provisionDealerPortalUser,
    updateDealerPortalUserStatus,
    resetDealerPortalUserPassword,
    getCurrentDealerPortalDashboard,
  } = await import('../dist/modules/dealer-portal/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

  config = loadAppConfig(process.env);
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

async function seedPortalReadyAccount(actor, options = {}) {
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });
  const region = await prisma.region.create({
    data: {
      code: options.regionCode ?? 'dealer_region',
      name: options.regionName ?? 'Dealer Region',
      directorUserId: actor.userId,
      isActive: true,
    },
  });
  const territory = await prisma.territory.create({
    data: {
      code: options.territoryCode ?? 'dealer_territory',
      name: options.territoryName ?? 'Dealer Territory',
      regionId: region.id,
      managerUserId: actor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const account = await prisma.account.create({
    data: {
      accountNumber: options.accountNumber ?? 'DLR-1001',
      displayName: options.companyName ?? 'Dealer Portal Comfort',
      legalName: options.legalName ?? 'Dealer Portal Comfort LLC',
      accountType: 'Dealer',
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: actor.userId,
      assignedRdUserId: actor.userId,
      isActive: options.isActive ?? true,
      contacts: {
        create: {
          firstName: 'Dana',
          lastName: 'Dealer',
          email: options.email ?? 'dealer@portal.test',
          title: 'Owner',
          isPrimary: true,
          isActive: true,
        },
      },
      locations: {
        create: {
          name: 'Main Office',
          city: 'Dallas',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
          isActive: true,
        },
      },
    },
    include: {
      contacts: true,
    },
  });

  return {
    account,
    contact: account.contacts[0],
    territory,
    region,
    shippingCenter,
  };
}

test('dealer portal provisioning creates membership and dealer dashboard context', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor);

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    isPrimaryOwner: true,
  });

  assert.equal(provisioned.portalAccount.status, 'active');
  assert.equal(provisioned.portalAccount.accountId, fixture.account.id);
  assert.equal(provisioned.portalAccount.activePortalUsers, 1);
  assert.equal(provisioned.user.email, fixture.contact.email);
  assert.equal(provisioned.user.isPrimaryOwner, true);
  assert.ok(provisioned.temporaryPassword);

  const detail = await getDealerPortalAccount(actor, fixture.account.id);
  assert.ok(detail);
  assert.equal(detail.accountId, fixture.account.id);
  assert.equal(detail.territoryName, fixture.territory.name);
  assert.equal(detail.regionName, fixture.region.name);
  assert.equal(detail.shippingCenterName, fixture.shippingCenter.name);
  assert.equal(detail.users.length, 1);

  const dealerAuth = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);
  assert.ok(dealerActor);
  assert.equal(dealerActor.role, 'DEALER_PORTAL_USER');

  const dashboard = await getCurrentDealerPortalDashboard(dealerActor);
  assert.equal(dashboard.portalAccount.accountId, fixture.account.id);
  assert.equal(dashboard.currentUser.email, fixture.contact.email);
  assert.equal(dashboard.companyUsers.length, 1);
  assert.equal(dashboard.contacts.length, 1);
  assert.equal(dashboard.locations.length, 1);
});

test('inactive accounts cannot be provisioned for dealer portal access', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Inactive Dealer Comfort',
    email: 'inactive@portal.test',
    isActive: false,
  });

  await assert.rejects(
    () =>
      provisionDealerPortalUser(actor, fixture.account.id, {
        contactId: fixture.contact.id,
      }),
    /Inactive accounts cannot receive dealer portal access/i,
  );
});

test('suspending a dealer portal user revokes active sessions', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Suspend Dealer Comfort',
    email: 'suspend@portal.test',
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
  });

  const dealerAuth = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );
  assert.ok(dealerAuth.tokens.accessToken);

  const updated = await updateDealerPortalUserStatus(actor, provisioned.user.id, {
    status: 'suspended',
  });
  assert.equal(updated.user.status, 'suspended');
  assert.equal(updated.portalAccount.status, 'suspended');

  const revokedSessions = await prisma.session.findMany({
    where: {
      userId: provisioned.user.userId,
      revokedAt: { not: null },
    },
  });
  assert.ok(revokedSessions.length >= 1);
});

test('password reset revokes prior sessions and rotates login secret', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Reset Dealer Comfort',
    email: 'reset@portal.test',
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
  });

  await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );

  const reset = await resetDealerPortalUserPassword(actor, provisioned.user.id, {});
  assert.equal(reset.email, fixture.contact.email);
  assert.ok(reset.temporaryPassword);

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: fixture.contact.email,
          password: provisioned.temporaryPassword,
        },
        {},
      ),
    /Invalid email or password/i,
  );

  const nextLogin = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: reset.temporaryPassword,
    },
    {},
  );
  assert.ok(nextLogin.tokens.accessToken);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let createAdminUser;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({
    ensureBootstrapAdminSeeded,
    loginWithPassword,
    authenticateAccessToken,
  } = await import('../dist/modules/auth/service.js'));
  ({
    createAdminUser,
  } = await import('../dist/modules/admin/service.js'));

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

  return {
    actor,
    auth,
  };
}

// UX-AD-011 (a): actorType='dealer' → created user is DEALER kind
test('createAdminUser with actorType dealer creates a DEALER user', async () => {
  const { actor } = await createAdminActor();

  const created = await createAdminUser(actor, {
    email: 'dealer.user@partnerdealer.com',
    firstName: 'Dale',
    lastName: 'Dealer',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
    actorType: 'dealer',
  });

  // Response summary should reflect 'dealer'
  assert.equal(created.user.actorType, 'dealer', 'response actorType should be "dealer"');
  assert.ok(created.temporaryPassword, 'expected a temporaryPassword');

  // Verify the database row has userType === 'DEALER'
  const dbUser = await prisma.user.findUnique({
    where: { id: created.user.id },
    select: { userType: true },
  });
  assert.ok(dbUser, 'user should exist in the database');
  assert.equal(dbUser.userType, 'DEALER', 'DB userType should be DEALER');
});

// UX-AD-011 (b): no actorType → defaults to INTERNAL
test('createAdminUser without actorType defaults to INTERNAL user', async () => {
  const { actor } = await createAdminActor();

  const created = await createAdminUser(actor, {
    email: 'internal.ops@dynamicaqs.com',
    firstName: 'Ian',
    lastName: 'Internal',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
  });

  // Response summary should reflect 'internal'
  assert.equal(created.user.actorType, 'internal', 'response actorType should be "internal"');
  assert.ok(created.temporaryPassword, 'expected a temporaryPassword');

  // Verify the database row has userType === 'INTERNAL'
  const dbUser = await prisma.user.findUnique({
    where: { id: created.user.id },
    select: { userType: true },
  });
  assert.ok(dbUser, 'user should exist in the database');
  assert.equal(dbUser.userType, 'INTERNAL', 'DB userType should be INTERNAL');
});

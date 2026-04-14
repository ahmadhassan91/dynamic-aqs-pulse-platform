import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let refreshSession;
let getCurrentSession;
let authenticateAccessToken;
let logoutCurrentSession;
let listAdminUsers;
let createAdminUser;
let updateAdminUser;
let resetAdminUserPassword;
let importAdminUsers;
let listAdminRoleAccess;
let listAdminActivity;
let getAdminOverview;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({
    ensureBootstrapAdminSeeded,
    loginWithPassword,
    refreshSession,
    getCurrentSession,
    authenticateAccessToken,
    logoutCurrentSession,
  } = await import('../dist/modules/auth/service.js'));
  ({
    listAdminUsers,
    createAdminUser,
    updateAdminUser,
    resetAdminUserPassword,
    importAdminUsers,
    listAdminRoleAccess,
    listAdminActivity,
    getAdminOverview,
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

test('auth and admin regression suite', async () => {
  const { actor, auth } = await createAdminActor();

  const currentSession = await getCurrentSession(auth.tokens.accessToken);
  assert.ok(currentSession);
  assert.equal(currentSession.identity.email, process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL);

  const refreshed = await refreshSession(config, {
    refreshToken: auth.tokens.refreshToken,
  });

  assert.notEqual(refreshed.tokens.accessToken, auth.tokens.accessToken);

  const refreshedActor = await authenticateAccessToken(refreshed.tokens.accessToken);
  assert.ok(refreshedActor);
  assert.equal(refreshedActor.email, process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL);

  const created = await createAdminUser(actor, {
    email: 'ops.manager@dynamicaqs.com',
    firstName: 'Olivia',
    lastName: 'Manager',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
  });

  assert.equal(created.user.email, 'ops.manager@dynamicaqs.com');
  assert.equal(created.user.role, 'ADMIN_CSR_OPS');
  assert.ok(created.temporaryPassword);

  const updated = await updateAdminUser(actor, created.user.id, {
    email: 'olive.manager@dynamicaqs.com',
    firstName: 'Olive',
    role: 'SALES_BD_LEADERSHIP',
    isActive: false,
  });

  assert.equal(updated.user.displayName, 'Olive Manager');
  assert.equal(updated.user.role, 'SALES_BD_LEADERSHIP');
  assert.equal(updated.user.status, 'INACTIVE');
  assert.equal(updated.user.email, 'olive.manager@dynamicaqs.com');

  const users = await listAdminUsers({
    search: 'olive',
    role: 'SALES_BD_LEADERSHIP',
  });
  assert.equal(users.total, 1);
  assert.equal(users.users[0]?.id, created.user.id);

  const financeUser = await createAdminUser(actor, {
    email: 'finance.approver@dynamicaqs.com',
    firstName: 'Finley',
    lastName: 'Approver',
    role: 'FINANCE',
    isActive: true,
    password: 'OriginalPass!123',
  });

  const initialFinanceAuth = await loginWithPassword(
    config,
    {
      email: financeUser.user.email,
      password: 'OriginalPass!123',
    },
    {},
  );

  const reset = await resetAdminUserPassword(actor, financeUser.user.id, {});
  assert.equal(reset.email, financeUser.user.email);
  assert.ok(reset.temporaryPassword);

  await assert.rejects(
    () => authenticateAccessToken(initialFinanceAuth.tokens.accessToken),
    /Session has been revoked/i,
  );

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: financeUser.user.email,
          password: 'OriginalPass!123',
        },
        {},
      ),
    /Invalid email or password/i,
  );

  const nextFinanceAuth = await loginWithPassword(
    config,
    {
      email: financeUser.user.email,
      password: reset.temporaryPassword,
    },
    {},
  );

  const nextFinanceActor = await authenticateAccessToken(nextFinanceAuth.tokens.accessToken);
  assert.ok(nextFinanceActor);
  assert.equal(nextFinanceActor.email, financeUser.user.email);

  const roleCatalog = await listAdminRoleAccess();
  assert.ok(roleCatalog.roles.some((entry) => entry.role === 'SUPER_ADMIN'));
  assert.ok(roleCatalog.roles.some((entry) => entry.role === 'FINANCE'));

  const imported = await importAdminUsers(actor, {
    rows: [
      {
        email: 'tm.one@dynamicaqs.com',
        firstName: 'Taylor',
        lastName: 'Manager',
        role: 'TERRITORY_MANAGER',
        isActive: true,
      },
      {
        email: 'tm.one@dynamicaqs.com',
        firstName: 'Duplicate',
        lastName: 'Manager',
        role: 'TERRITORY_MANAGER',
        isActive: true,
      },
      {
        email: 'rd.one@dynamicaqs.com',
        firstName: 'Riley',
        lastName: 'Director',
        role: 'REGIONAL_DIRECTOR',
        isActive: true,
      },
    ],
  });

  assert.equal(imported.totalProcessed, 3);
  assert.equal(imported.successful, 2);
  assert.equal(imported.failed, 1);
  assert.equal(imported.credentials.length, 2);
  assert.equal(imported.errors[0]?.email, 'tm.one@dynamicaqs.com');

  const activity = await listAdminActivity({
    entityType: 'USER',
    limit: 20,
  });

  assert.ok(activity.entries.some((entry) => entry.action === 'CREATE'));
  assert.ok(activity.entries.some((entry) => entry.action === 'UPDATE'));

  const overview = await getAdminOverview();
  assert.equal(overview.totalUsers, 5);
  assert.equal(overview.activeUsers, 4);
  assert.equal(overview.pendingUsers, 2);
  assert.ok(overview.activeSessions >= 2);
  assert.ok(overview.recentActivity.length > 0);

  const logoutResult = await logoutCurrentSession(refreshed.tokens.accessToken);
  assert.ok(logoutResult);

  await assert.rejects(
    () => authenticateAccessToken(refreshed.tokens.accessToken),
    /Session has been revoked/i,
  );

  await assert.rejects(
    () =>
      refreshSession(config, {
        refreshToken: refreshed.tokens.refreshToken,
      }),
    /Session has been revoked/i,
  );
});

test('inactive users lose both access-token and refresh-token validity', async () => {
  const { actor } = await createAdminActor();

  const createdUser = await createAdminUser(actor, {
    email: 'field.ops@dynamicaqs.com',
    firstName: 'Field',
    lastName: 'Ops',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
    password: 'FieldOps!123',
  });

  const activeAuth = await loginWithPassword(
    config,
    {
      email: createdUser.user.email,
      password: 'FieldOps!123',
    },
    {},
  );

  await updateAdminUser(actor, createdUser.user.id, {
    isActive: false,
  });

  await assert.rejects(
    () => authenticateAccessToken(activeAuth.tokens.accessToken),
    /User is inactive/i,
  );

  await assert.rejects(
    () =>
      refreshSession(config, {
        refreshToken: activeAuth.tokens.refreshToken,
      }),
    /User is inactive/i,
  );

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: createdUser.user.email,
          password: 'FieldOps!123',
        },
        {},
      ),
    /User is inactive/i,
  );
});

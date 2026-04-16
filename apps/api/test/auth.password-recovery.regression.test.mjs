import assert from 'node:assert/strict';
import test from 'node:test';
import { IdentityProvider, UserKind } from '@pulse/db';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let requestPasswordReset;
let resetPassword;
let createAdminUser;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({
    ensureBootstrapAdminSeeded,
    loginWithPassword,
    authenticateAccessToken,
    requestPasswordReset,
    resetPassword,
  } = await import('../dist/modules/auth/service.js'));
  ({ createAdminUser } = await import('../dist/modules/admin/service.js'));
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  config = loadAppConfig(process.env);
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
  assert.ok(actor, 'expected bootstrap admin actor');
  return actor;
}

test('local users can request preview reset links and complete password reset with session revocation', async () => {
  const actor = await createAdminActor();

  const created = await createAdminUser(actor, {
    email: 'local.reset@dynamicaqs.com',
    firstName: 'Local',
    lastName: 'Reset',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
    password: 'OriginalPass!123',
  });

  const originalAuth = await loginWithPassword(
    config,
    {
      email: created.user.email,
      password: 'OriginalPass!123',
    },
    {},
  );

  const requested = await requestPasswordReset(
    config,
    {
      email: created.user.email,
    },
    {
      ipAddress: '127.0.0.1',
      userAgent: 'auth-password-recovery-test',
    },
  );

  assert.equal(requested.accepted, true);
  assert.equal(requested.delivery, 'preview');
  assert.ok(requested.previewToken);
  assert.ok(requested.previewResetUrl?.includes('/auth/reset-password?token='));

  const completed = await resetPassword(
    config,
    {
      token: requested.previewToken,
      newPassword: 'UpdatedPass!123',
    },
    {
      ipAddress: '127.0.0.1',
      userAgent: 'auth-password-recovery-test',
    },
  );

  assert.equal(completed.success, true);
  assert.equal(completed.email, created.user.email);

  await assert.rejects(
    () => authenticateAccessToken(originalAuth.tokens.accessToken),
    /Session has been revoked/i,
  );

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: created.user.email,
          password: 'OriginalPass!123',
        },
        {},
      ),
    /Invalid email or password/i,
  );

  const nextAuth = await loginWithPassword(
    config,
    {
      email: created.user.email,
      password: 'UpdatedPass!123',
    },
    {},
  );

  const nextActor = await authenticateAccessToken(nextAuth.tokens.accessToken);
  assert.ok(nextActor);
  assert.equal(nextActor.email, created.user.email);

  await assert.rejects(
    () =>
      resetPassword(
        config,
        {
          token: requested.previewToken,
          newPassword: 'UpdatedPass!456',
        },
        {},
      ),
    /invalid or has expired/i,
  );

  const resetAudits = await prisma.auditEntry.findMany({
    where: {
      entityType: 'PASSWORD_RESET',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  assert.ok(resetAudits.some((entry) => entry.action === 'CREATE'));
  assert.ok(resetAudits.some((entry) => entry.action === 'UPDATE'));
  assert.ok(resetAudits.some((entry) => entry.action === 'REJECT'));
});

test('denied password login and suppressed recovery requests are audited cleanly', async () => {
  const actor = await createAdminActor();

  const created = await createAdminUser(actor, {
    email: 'inactive.local@dynamicaqs.com',
    firstName: 'Inactive',
    lastName: 'Local',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
    password: 'InactivePass!123',
  });

  await prisma.user.update({
    where: { id: created.user.id },
    data: { isActive: false },
  });

  await prisma.user.create({
    data: {
      email: 'entra.only@dynamicaqs.com',
      displayName: 'Entra Only',
      roleCode: 'ADMIN_CSR_OPS',
      userType: UserKind.INTERNAL,
      isActive: true,
      identities: {
        create: {
          provider: IdentityProvider.MICROSOFT_ENTRA,
          providerSubject: 'entra-only-subject',
          loginEmail: 'entra.only@dynamicaqs.com',
          isPrimary: true,
        },
      },
    },
  });

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: 'missing.user@dynamicaqs.com',
          password: 'BadPass!123',
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'auth-denied-test',
        },
      ),
    /Invalid email or password/i,
  );

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: created.user.email,
          password: 'InactivePass!123',
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'auth-denied-test',
        },
      ),
    /User is inactive/i,
  );

  const entraRecovery = await requestPasswordReset(
    config,
    {
      email: 'entra.only@dynamicaqs.com',
    },
    {
      ipAddress: '127.0.0.1',
      userAgent: 'auth-denied-test',
    },
  );
  assert.equal(entraRecovery.delivery, 'suppressed');

  const unknownRecovery = await requestPasswordReset(
    config,
    {
      email: 'unknown@dynamicaqs.com',
    },
    {
      ipAddress: '127.0.0.1',
      userAgent: 'auth-denied-test',
    },
  );
  assert.equal(unknownRecovery.delivery, 'suppressed');

  const authAttempts = await prisma.auditEntry.findMany({
    where: {
      entityType: 'AUTH_ATTEMPT',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  assert.ok(
    authAttempts.some((entry) => {
      const metadata = entry.metadata;
      return metadata
        && typeof metadata === 'object'
        && metadata.result === 'rejected_invalid_credentials';
    }),
  );
  assert.ok(
    authAttempts.some((entry) => {
      const metadata = entry.metadata;
      return metadata
        && typeof metadata === 'object'
        && metadata.result === 'rejected_inactive_user';
    }),
  );

  const passwordResetAudits = await prisma.auditEntry.findMany({
    where: {
      entityType: 'PASSWORD_RESET',
      action: 'CREATE',
    },
  });

  assert.ok(
    passwordResetAudits.some((entry) => {
      const metadata = entry.metadata;
      return metadata
        && typeof metadata === 'object'
        && metadata.result === 'suppressed_unknown_or_non_local';
    }),
  );
});

test('expired password reset tokens are rejected and audited as expired', async () => {
  const actor = await createAdminActor();

  const created = await createAdminUser(actor, {
    email: 'expired.reset@dynamicaqs.com',
    firstName: 'Expired',
    lastName: 'Reset',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
    password: 'ExpiredPass!123',
  });

  const requested = await requestPasswordReset(
    config,
    {
      email: created.user.email,
    },
    {
      ipAddress: '127.0.0.1',
      userAgent: 'auth-expired-reset-test',
    },
  );

  assert.equal(requested.delivery, 'preview');
  assert.ok(requested.previewToken);

  await prisma.passwordResetToken.updateMany({
    where: {
      userId: created.user.id,
      usedAt: null,
    },
    data: {
      expiresAt: new Date(Date.now() - 60_000),
    },
  });

  await assert.rejects(
    () =>
      resetPassword(
        config,
        {
          token: requested.previewToken,
          newPassword: 'ExpiredPass!456',
        },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'auth-expired-reset-test',
        },
      ),
    /invalid or has expired/i,
  );

  const expiredAudit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'PASSWORD_RESET',
      action: 'REJECT',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const metadata = expiredAudit?.metadata;
  assert.ok(metadata && typeof metadata === 'object');
  assert.equal(metadata.result, 'reset_rejected_expired_token');
});

test('preview-disabled recovery still accepts the request but withholds reset delivery details', async () => {
  const actor = await createAdminActor();

  const created = await createAdminUser(actor, {
    email: 'no-preview.reset@dynamicaqs.com',
    firstName: 'No',
    lastName: 'Preview',
    role: 'ADMIN_CSR_OPS',
    isActive: true,
    password: 'PreviewPass!123',
  });

  const noPreviewConfig = loadAppConfig({
    ...process.env,
    AUTH_PASSWORD_RECOVERY_PREVIEW_ENABLED: 'false',
  });

  const requested = await requestPasswordReset(
    noPreviewConfig,
    {
      email: created.user.email,
    },
    {
      ipAddress: '127.0.0.1',
      userAgent: 'auth-no-preview-test',
    },
  );

  assert.equal(requested.accepted, true);
  assert.equal(requested.delivery, 'unavailable');
  assert.match(requested.message, /not enabled in this environment yet/i);
  assert.equal(requested.previewToken, undefined);
  assert.equal(requested.previewResetUrl, undefined);

  const storedToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: created.user.id,
      usedAt: null,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  assert.equal(storedToken, null);

  const createAudit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'PASSWORD_RESET',
      action: 'CREATE',
      actorUserId: created.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const metadata = createAudit?.metadata;
  assert.ok(metadata && typeof metadata === 'object');
  assert.equal(metadata.result, 'delivery_unavailable');
});

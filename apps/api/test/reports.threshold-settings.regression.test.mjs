import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let getReportingThresholdSettings;
let updateReportingThresholdSettings;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ getReportingThresholdSettings, updateReportingThresholdSettings } = await import('../dist/modules/reports/service.js'));
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

async function adminActor() {
  const auth = await loginWithPassword(
    config,
    { email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL, password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD },
    {},
  );
  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? 'Admin',
  };
}

function actorFor(user) {
  return { userId: user.id, sessionId: `t-${user.id}`, role: user.roleCode, actorType: 'internal', email: user.email, displayName: user.displayName };
}

test('FR-RPT-003: reporting thresholds default to 365 days and are admin-configurable + persisted + audited', SERIAL, async () => {
  const admin = await adminActor();

  const initial = await getReportingThresholdSettings(admin);
  assert.equal(initial.settings.activeAccountWindowDays, 365);

  const updated = await updateReportingThresholdSettings(admin, { activeAccountWindowDays: 180 });
  assert.equal(updated.settings.activeAccountWindowDays, 180);

  const reread = await getReportingThresholdSettings(admin);
  assert.equal(reread.settings.activeAccountWindowDays, 180);

  const audit = await prisma.auditEntry.findFirst({ where: { entityType: 'reporting_threshold_settings' } });
  assert.ok(audit, 'expected an audit entry for the threshold change');
});

test('FR-RPT-003: a non-admin (EXECUTIVE) can read but cannot update thresholds', SERIAL, async () => {
  const exec = await prisma.user.create({ data: { email: 'exec.thresh@pulse.local', displayName: 'Exec', roleCode: 'EXECUTIVE', userType: 'INTERNAL', isActive: true } });
  const execActor = actorFor(exec);

  // EXECUTIVE has the reports module -> read allowed.
  const read = await getReportingThresholdSettings(execActor);
  assert.equal(read.settings.activeAccountWindowDays, 365);

  // EXECUTIVE lacks admin.integration_manage (RBAC hardening) -> update rejected.
  await assert.rejects(() => updateReportingThresholdSettings(execActor, { activeAccountWindowDays: 90 }));
});

test('FR-RPT-003: invalid window values are rejected', SERIAL, async () => {
  const admin = await adminActor();
  await assert.rejects(() => updateReportingThresholdSettings(admin, { activeAccountWindowDays: 0 }));
  await assert.rejects(() => updateReportingThresholdSettings(admin, { activeAccountWindowDays: -5 }));
});

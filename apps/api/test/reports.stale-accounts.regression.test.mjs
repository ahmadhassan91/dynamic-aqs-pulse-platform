import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let getStaleAccountsReport;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({ getStaleAccountsReport } = await import('../dist/modules/reports/service.js'));
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

test('FR-RPT-039: stale-accounts lists accounts with no engagement in the active-account window', SERIAL, async () => {
  const admin = await adminActor();
  const daysAgo = (n) => new Date(Date.now() - n * 86_400_000);

  await prisma.account.create({ data: { displayName: 'Stale Old', isActive: true, lastEngagementAt: daysAgo(400) } });
  await prisma.account.create({ data: { displayName: 'Never Engaged', isActive: true, lastEngagementAt: null } });
  await prisma.account.create({ data: { displayName: 'Recently Engaged', isActive: true, lastEngagementAt: daysAgo(10) } });
  await prisma.account.create({ data: { displayName: 'Inactive Old', isActive: false, lastEngagementAt: daysAgo(500) } });

  const report = await getStaleAccountsReport(admin);

  assert.equal(report.windowDays, 365);
  assert.equal(report.total, 2);

  const names = report.items.map((item) => item.name);
  assert.ok(names.includes('Stale Old'));
  assert.ok(names.includes('Never Engaged'));
  assert.ok(!names.includes('Recently Engaged'), 'recently engaged is not stale');
  assert.ok(!names.includes('Inactive Old'), 'inactive accounts are excluded');

  // Never-engaged sorts first (nulls first).
  assert.equal(report.items[0].name, 'Never Engaged');
  assert.equal(report.items[0].lastEngagementAt, null);
  assert.equal(report.items[0].daysSinceEngagement, null);

  const staleOld = report.items.find((item) => item.name === 'Stale Old');
  assert.ok(staleOld.daysSinceEngagement >= 399);
});

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../../..');
const seedScript = path.join(repoRoot, 'scripts/seed-uat-readiness.mjs');

let prisma;
let config;
let loadAppConfig;
let loginWithPassword;
let authenticateAccessToken;
let getCurrentDealerPortalCatalog;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ getCurrentDealerPortalCatalog } = await import('../dist/modules/dealer-portal/service.js'));

  config = loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test('dependency-free UAT seed creates usable personas and dealer-visible catalog state', async () => {
  await resetDatabase(prisma);

  execFileSync(process.execPath, [seedScript], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'pipe',
  });

  const [
    dealerAccountCount,
    dealerUserCount,
    activeRuleSet,
    activeSnapshots,
    publishedPresentations,
    publishedInclusions,
    trainingSessions,
  ] = await Promise.all([
    prisma.account.count({ where: { accountNumber: { startsWith: 'UAT-' }, isActive: true } }),
    prisma.dealerPortalUser.count({ where: { status: 'ACTIVE', account: { accountNumber: { startsWith: 'UAT-' } } } }),
    prisma.catalogRuleSet.findFirst({ where: { code: 'UAT_DEALER_CATALOG_RULES', status: 'ACTIVE', isActive: true }, include: { rules: true } }),
    prisma.dealerCatalogSnapshot.findMany({ where: { dealerCatalogView: { code: { startsWith: 'UAT_' } }, isActive: true }, orderBy: { version: 'desc' } }),
    prisma.productPresentation.count({ where: { baseProduct: { sku: { startsWith: 'UAT-' } }, publishStatus: 'PUBLISHED', readyForDealerPortal: true } }),
    prisma.catalogInclusion.count({ where: { presentation: { baseProduct: { sku: { startsWith: 'UAT-' } } }, publishStatus: 'PUBLISHED', isVisible: true } }),
    prisma.trainingSession.count({ where: { title: 'UAT IAQ Certification Visit', status: 'SCHEDULED' } }),
  ]);

  assert.equal(dealerAccountCount, 4);
  assert.equal(dealerUserCount, 4);
  assert.ok(activeRuleSet, 'expected active UAT catalog rule set');
  assert.equal(activeRuleSet.rules.length, 5);
  assert.equal(activeSnapshots.length, 4);
  assert.equal(publishedPresentations, 2);
  assert.equal(publishedInclusions, 6);
  assert.equal(trainingSessions, 1);

  const nexstarCatalog = await loginAndLoadCatalog('owner+nexstar@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(nexstarCatalog.catalogView.kind, 'affinity');
  assert.equal(nexstarCatalog.catalogView.name, 'UAT Nexstar Dealer Catalog');
  assert.deepEqual(nexstarCatalog.products.map((product) => product.sku), ['UAT-IAQ-100']);
  assert.ok(nexstarCatalog.products[0].assets.length >= 1);

  const peCatalog = await loginAndLoadCatalog('owner+redwood@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(peCatalog.catalogView.kind, 'ownership');
  assert.equal(peCatalog.catalogView.name, 'UAT Redwood PE Dealer Catalog');
  assert.deepEqual(peCatalog.products.map((product) => product.sku), ['UAT-IAQ-100']);

  const independentCatalog = await loginAndLoadCatalog('owner+independent@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(independentCatalog.catalogView.kind, 'independent');
  assert.deepEqual(independentCatalog.products.map((product) => product.sku), ['UAT-FLTR-200', 'UAT-IAQ-100']);

  const hybridCatalog = await loginAndLoadCatalog('owner+hybrid@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(hybridCatalog.products.length, 0);
  assert.match(hybridCatalog.warnings.join(' '), /affinity group and an ownership\/PE group|catalog view/i);
});

async function loginAndLoadCatalog(email, password) {
  const auth = await loginWithPassword(config, { email, password }, {});
  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, `expected authenticated actor for ${email}`);
  return getCurrentDealerPortalCatalog(actor);
}

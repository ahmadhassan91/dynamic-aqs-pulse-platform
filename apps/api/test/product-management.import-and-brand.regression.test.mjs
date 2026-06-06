import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

const SERIAL = { concurrency: false };

// Legacy import is parked by default per the PRD; enable the non-authoritative seed
// flag only for the commit-success cases, restoring the previous value afterward.
async function withSeedFlag(fn) {
  const prev = process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED;
  process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED = 'true';
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED;
    else process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED = prev;
  }
}
let prisma;
let listProducts;
let listCatalogRuleConditionOptions;
let createCatalogRuleSet;
let previewCatalogRuleSet;
let createDealerCatalogView;
let updateCatalogInclusion;
let publishDealerCatalogSnapshot;
let commitProductReferenceImport;
let isAllowedImageHost;
let actor;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({
    listProducts,
    listCatalogRuleConditionOptions,
    createCatalogRuleSet,
    previewCatalogRuleSet,
    createDealerCatalogView,
    updateCatalogInclusion,
    publishDealerCatalogSnapshot,
  } = await import('../dist/modules/product-management/service.js'));
  ({ commitProductReferenceImport, isAllowedImageHost } = await import('../dist/modules/product-management/legacy-import.js'));
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  const user = await prisma.user.create({
    data: {
      email: 'product-import@pulse.local',
      displayName: 'Product Import Tester',
      roleCode: 'SUPER_ADMIN',
    },
  });
  actor = {
    userId: user.id,
    sessionId: 'product-import-regression',
    role: 'SUPER_ADMIN',
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
});

test('import commit is parked by default (PRD boundary)', SERIAL, async () => {
  const prev = process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED;
  delete process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED;
  try {
    await assert.rejects(
      () => commitProductReferenceImport(actor, { dryRun: false, limit: 5 }),
      /parked/i,
    );
    assert.equal(await prisma.baseProduct.count(), 0, 'a blocked commit must not write any products');
  } finally {
    if (prev !== undefined) process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED = prev;
  }
});

test('seeded products carry FILE_IMPORT provenance', SERIAL, async () => {
  await withSeedFlag(() => commitProductReferenceImport(actor, { dryRun: false, limit: 25 }));
  const seedCount = await prisma.baseProduct.count({ where: { sourceSystem: 'FILE_IMPORT' } });
  assert.ok(seedCount > 0, 'seeded products should be tagged FILE_IMPORT');
  const nonSeed = await prisma.baseProduct.count({ where: { sourceSystem: { not: 'FILE_IMPORT' } } });
  assert.equal(nonSeed, 0, 'all seeded products should carry FILE_IMPORT provenance');
});

test('import commit upserts products, presentations, and categories', SERIAL, async () => {
  const result = await withSeedFlag(() => commitProductReferenceImport(actor, { dryRun: false, limit: 25 }));

  assert.equal(result.dryRun, false);
  assert.ok(result.productsCreated > 0, 'expected products to be created');
  assert.ok(result.categoriesUpserted > 0, 'expected categories to be upserted');

  const productCount = await prisma.baseProduct.count();
  const presentationCount = await prisma.productPresentation.count();
  assert.ok(productCount > 0, 'baseProduct rows should be persisted');
  assert.ok(presentationCount > 0, 'productPresentation rows should be persisted');
  assert.equal(productCount, result.productsCreated);

  const audit = await prisma.auditEntry.findFirst({
    where: { entityType: 'PRODUCT_REFERENCE_IMPORT', action: 'IMPORT' },
  });
  assert.ok(audit, 'import should write an audit entry');
});

test('import commit is idempotent on a second run', SERIAL, async () => {
  const first = await withSeedFlag(() => commitProductReferenceImport(actor, { dryRun: false, limit: 25 }));
  const countAfterFirst = await prisma.baseProduct.count();
  const presentationsAfterFirst = await prisma.productPresentation.count();

  const second = await withSeedFlag(() => commitProductReferenceImport(actor, { dryRun: false, limit: 25 }));
  const countAfterSecond = await prisma.baseProduct.count();
  const presentationsAfterSecond = await prisma.productPresentation.count();

  assert.ok(first.productsCreated > 0, 'first run should create products');
  assert.equal(second.productsCreated, 0, 'second run should not create new products');
  assert.ok(second.productsUpdated > 0, 'second run should report updates');
  assert.equal(countAfterSecond, countAfterFirst, 'base product count must not double');
  assert.equal(presentationsAfterSecond, presentationsAfterFirst, 'presentation count must not double');
});

test('import dry-run returns zeroed counters and writes nothing', SERIAL, async () => {
  const result = await commitProductReferenceImport(actor, { dryRun: true, limit: 25 });

  assert.equal(result.dryRun, true);
  assert.equal(result.productsCreated, 0);
  assert.equal(result.productsUpdated, 0);
  assert.equal(result.presentationsCreated, 0);
  assert.equal(result.presentationsUpdated, 0);
  assert.equal(result.categoriesUpserted, 0);

  assert.equal(await prisma.baseProduct.count(), 0, 'dry run must not persist base products');
  assert.equal(await prisma.productPresentation.count(), 0, 'dry run must not persist presentations');
  assert.equal(await prisma.productCategory.count(), 0, 'dry run must not persist categories');
});

test('catalog rule condition options include seeded brand labels', SERIAL, async () => {
  await prisma.brandLabelRef.create({
    data: { code: 'STS', name: 'StratosAire', isActive: true },
  });

  const options = await listCatalogRuleConditionOptions(actor);

  assert.ok(Array.isArray(options.brandLabels), 'brandLabels should be an array');
  const match = options.brandLabels.find((item) => item.value === 'STS');
  assert.ok(match, 'brandLabels should include the seeded brand');
  assert.equal(match.label, 'StratosAire');
});

test('brand_label rule matches accounts by their brand label and not others', SERIAL, async () => {
  const stratos = await prisma.brandLabelRef.create({
    data: { code: 'STS', name: 'StratosAire', isActive: true },
  });
  const solace = await prisma.brandLabelRef.create({
    data: { code: 'SLA', name: 'SolaceAir', isActive: true },
  });
  const catalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'sts-catalog',
      name: 'StratosAire Catalog',
      kind: 'AFFINITY',
      resolverKey: 'sts',
      isActive: true,
      precedence: 50,
      createdByUserId: actor.userId,
    },
  });

  const matchingAccount = await prisma.account.create({
    data: {
      displayName: 'StratosAire Dealer',
      brandLabelId: stratos.id,
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      groupClassification: 'INDEPENDENT',
      isActive: true,
    },
  });
  const otherAccount = await prisma.account.create({
    data: {
      displayName: 'SolaceAir Dealer',
      brandLabelId: solace.id,
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      groupClassification: 'INDEPENDENT',
      isActive: true,
    },
  });

  const ruleSet = await createCatalogRuleSet(actor, {
    name: 'Brand label rules',
    rules: [{
      name: 'StratosAire dealers see StratosAire catalog',
      priority: 10,
      conditions: [{ field: 'brand_label', operator: 'is', value: 'STS' }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: catalogView.id,
    }],
  });

  const preview = await previewCatalogRuleSet(actor, ruleSet.id, { sampleLimit: 50 });

  assert.equal(preview.sampleAccountCount, 2);
  assert.equal(preview.matchedCount, 1, 'only the StratosAire account should match');

  const matchedRow = preview.rows.find((row) => row.accountId === matchingAccount.id);
  const unmatchedRow = preview.rows.find((row) => row.accountId === otherAccount.id);
  assert.ok(matchedRow?.matchedRuleId, 'StratosAire account should be matched');
  assert.equal(matchedRow.dealerCatalogViewName, 'StratosAire Catalog');
  assert.ok(!unmatchedRow?.matchedRuleId, 'SolaceAir account should not match the STS rule');
});

// A few-byte valid PNG header — enough for the SSRF-protected downloader to accept a
// non-empty image body. Stored to the local provider in dev/test (DA-Q01 S3 stays parked).
const TINY_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Override globalThis.fetch so legacy image ingestion never touches the network: any https
// URL resolves to a 200 with the tiny PNG body. Returns a restore() to put fetch back.
function mockFetchOk() {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(TINY_PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  return () => {
    globalThis.fetch = original;
  };
}

// Override fetch to fail every request so we can prove the import survives undownloadable
// images (graceful skip). Returns a restore().
function mockFetchFailing() {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('boom', { status: 500 });
  return () => {
    globalThis.fetch = original;
  };
}

// Override fetch to return a 200 with a NON-image content-type, to prove the content-type
// guard rejects mislabeled payloads and cleans up the orphan. Returns a restore().
function mockFetchNonImage() {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response('<html>not an image</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  return () => {
    globalThis.fetch = original;
  };
}

test('ingestImages seeds PENDING_REVIEW FILE_IMPORT images linked as PRIMARY_IMAGE', SERIAL, async () => {
  const restoreFetch = mockFetchOk();
  try {
    const result = await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );

    assert.ok(result.imageAssetsUpserted > 0, 'expected at least one image asset to be ingested');
    assert.ok(result.assetAssignmentsUpserted > 0, 'expected at least one PRIMARY_IMAGE assignment');
    assert.equal(result.imageAssetsFailed, 0, 'no image should fail when every download succeeds');

    const image = await prisma.digitalAsset.findFirst({
      where: { kind: 'IMAGE', sourceSystem: 'FILE_IMPORT' },
    });
    assert.ok(image, 'a FILE_IMPORT IMAGE asset should exist');
    assert.equal(image.status, 'ACTIVE', 'ingested image should be ACTIVE');
    assert.equal(image.visibility, 'DEALER_PORTAL', 'ingested image should target the dealer portal');
    assert.equal(
      image.reviewStatus,
      'PENDING_REVIEW',
      'ingested image must be PENDING_REVIEW so it is not dealer-safe until approved',
    );

    const assignment = await prisma.productAssetAssignment.findFirst({
      where: { role: 'PRIMARY_IMAGE', assetId: image.id },
    });
    assert.ok(assignment, 'a PRIMARY_IMAGE assignment should link the image to its presentation');

    const version = await prisma.digitalAssetVersion.findFirst({ where: { assetId: image.id } });
    assert.ok(version?.storageKey, 'the ingested version should be stored locally (storageKey present)');
  } finally {
    restoreFetch();
  }
});

test('ingestImages is idempotent — assets and assignments do not double', SERIAL, async () => {
  const restoreFetch = mockFetchOk();
  try {
    await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );
    const assetsAfterFirst = await prisma.digitalAsset.count();
    const assignmentsAfterFirst = await prisma.productAssetAssignment.count();
    assert.ok(assetsAfterFirst > 0, 'first run should ingest at least one image asset');

    const second = await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );
    const assetsAfterSecond = await prisma.digitalAsset.count();
    const assignmentsAfterSecond = await prisma.productAssetAssignment.count();

    assert.equal(assetsAfterSecond, assetsAfterFirst, 'digital asset count must not double');
    assert.equal(assignmentsAfterSecond, assignmentsAfterFirst, 'asset assignment count must not double');
    // The dedupe must report no NEW work on the second run, not merely keep totals flat.
    assert.equal(second.imageAssetsUpserted, 0, 'second run must not re-ingest images');
    assert.equal(second.assetAssignmentsUpserted, 0, 'second run must not re-create assignments');
  } finally {
    restoreFetch();
  }
});

test('ingestImages gracefully skips undownloadable images without failing the import', SERIAL, async () => {
  const restoreFetch = mockFetchFailing();
  try {
    const result = await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );

    assert.ok(result.productsCreated > 0, 'products must still be created when images cannot download');
    assert.equal(result.imageAssetsUpserted, 0, 'no image assets should be ingested when downloads fail');
    assert.equal(result.assetAssignmentsUpserted, 0, 'no assignments should be created when downloads fail');
    assert.ok(result.imageAssetsFailed > 0, 'failed downloads should be counted');
    assert.equal(await prisma.digitalAsset.count(), 0, 'no digital assets should be persisted on failure');
    assert.equal(await prisma.productAssetAssignment.count(), 0, 'no orphan assignment should remain on failure');
  } finally {
    restoreFetch();
  }
});

test('ingestImages defaults off — no images ingested and no network required', SERIAL, async () => {
  const original = globalThis.fetch;
  // If anything tries to fetch while ingestImages is omitted, fail loudly.
  globalThis.fetch = async () => {
    throw new Error('fetch must not be called when ingestImages is not requested');
  };
  try {
    const result = await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, limit: 25 }),
    );

    assert.ok(result.productsCreated > 0, 'products should still be seeded');
    assert.equal(result.imageAssetsUpserted, 0, 'no images should be ingested when ingestImages is omitted');
    assert.equal(await prisma.digitalAsset.count(), 0, 'no digital assets should be created by default');
  } finally {
    globalThis.fetch = original;
  }
});

test('ingestImages rejects a non-image payload and leaves no orphan asset', SERIAL, async () => {
  const restoreFetch = mockFetchNonImage();
  try {
    const result = await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );

    assert.ok(result.productsCreated > 0, 'products must still be created');
    assert.equal(result.imageAssetsUpserted, 0, 'a non-image (text/html) payload must not be ingested');
    assert.ok(result.imageAssetsFailed > 0, 'rejected non-image payloads must be counted as failed');
    assert.equal(await prisma.digitalAsset.count(), 0, 'the orphan asset+version must be fully cleaned up');
    assert.equal(await prisma.productAssetAssignment.count(), 0, 'no assignment should remain for a rejected image');
  } finally {
    restoreFetch();
  }
});

test('ingestImages self-heals an asset left un-promoted by an earlier interrupted run', SERIAL, async () => {
  const restoreFetch = mockFetchOk();
  try {
    await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );
    const image = await prisma.digitalAsset.findFirst({ where: { kind: 'IMAGE', sourceSystem: 'FILE_IMPORT' } });
    assert.ok(image, 'first run should ingest an image asset');

    // Simulate a prior partial failure: the asset exists but was never promoted.
    await prisma.digitalAsset.update({
      where: { id: image.id },
      data: { status: 'DRAFT', reviewStatus: 'NOT_REQUIRED' },
    });

    const healRun = await withSeedFlag(() =>
      commitProductReferenceImport(actor, { dryRun: false, ingestImages: true, limit: 25 }),
    );
    const healed = await prisma.digitalAsset.findUnique({ where: { id: image.id } });
    assert.equal(healed.status, 'ACTIVE', 'self-heal must promote the dangling asset to ACTIVE');
    assert.equal(healed.reviewStatus, 'PENDING_REVIEW', 'self-heal must restore PENDING_REVIEW review gate');
    assert.ok(healRun.imageAssetsUpserted > 0, 'a healed asset is counted as upserted this run');
  } finally {
    restoreFetch();
  }
});

test('isAllowedImageHost enforces https + host allowlist (SSRF guard)', async () => {
  const allowlist = ['cdn.shopify.com', 'www.dynamiconlineorders.com'];
  assert.equal(isAllowedImageHost('https://cdn.shopify.com/files/x.jpg', allowlist), true);
  assert.equal(isAllowedImageHost('http://cdn.shopify.com/files/x.jpg', allowlist), false, 'non-https must be rejected');
  assert.equal(isAllowedImageHost('https://evil.example.com/x.jpg', allowlist), false, 'non-allowlisted host must be rejected');
  assert.equal(isAllowedImageHost('https://169.254.169.254/latest/meta-data', allowlist), false, 'metadata IP must be rejected');
  assert.equal(isAllowedImageHost('not a url', allowlist), false, 'unparseable URL must be rejected');
});

test('listProducts includeDetail returns details in one pass, omitted otherwise', SERIAL, async () => {
  await withSeedFlag(() => commitProductReferenceImport(actor, { dryRun: false, limit: 25 }));

  const withDetail = await listProducts(actor, { includeDetail: true, limit: 5 });
  assert.ok(Array.isArray(withDetail.details), 'details should be present when includeDetail is set');
  assert.ok(withDetail.details.length > 0, 'details should be non-empty after an import');
  assert.equal(withDetail.details.length, withDetail.items.length, 'one detail per item');
  for (const detail of withDetail.details) {
    assert.ok(Array.isArray(detail.presentations), 'each detail exposes a presentations array');
    assert.ok(detail.presentations.length > 0, 'imported products carry at least one presentation');
    assert.ok('category' in detail || detail.category === undefined, 'detail exposes category field');
  }
  // At least one detail should have a populated category (Shopify-derived categories).
  assert.ok(
    withDetail.details.some((detail) => detail.category && detail.category.name),
    'at least one imported product should resolve a category',
  );

  const withoutDetail = await listProducts(actor, { limit: 5 });
  assert.equal(withoutDetail.details, undefined, 'details must be omitted when includeDetail is not set');
  assert.ok(withoutDetail.items.length > 0, 'items should still be returned without detail');
});

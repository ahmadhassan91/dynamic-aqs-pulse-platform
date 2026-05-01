import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

const SERIAL = { concurrency: false };
let prisma;
let getProductDetail;
let runProductPublishValidation;
let unlinkProductAsset;
let actor;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ getProductDetail, runProductPublishValidation } = await import('../dist/modules/product-management/service.js'));
  ({ unlinkProductAsset } = await import('../dist/modules/digital-assets/service.js'));
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  const user = await prisma.user.create({
    data: {
      email: 'product-assets@pulse.local',
      displayName: 'Product Assets Tester',
      roleCode: 'SUPER_ADMIN',
    },
  });
  actor = {
    userId: user.id,
    sessionId: 'product-assets-regression',
    role: 'SUPER_ADMIN',
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
});

test('product detail groups assigned assets by role', SERIAL, async () => {
  const fixture = await seedProductFixture();
  await prisma.productAssetAssignment.createMany({
    data: [
      {
        presentationId: fixture.presentation.id,
        assetId: fixture.primaryImage.id,
        role: 'PRIMARY_IMAGE',
        sortOrder: 1,
        isRequired: true,
      },
      {
        presentationId: fixture.presentation.id,
        assetId: fixture.brochure.id,
        role: 'BROCHURE',
        sortOrder: 2,
      },
    ],
  });

  const detail = await getProductDetail(actor, fixture.product.id);

  assert.equal(detail.assetAssignments.length, 2);
  assert.equal(detail.assignedAssetsByRole.primary_image.length, 1);
  assert.equal(detail.assignedAssetsByRole.primary_image[0].assetId, fixture.primaryImage.id);
  assert.equal(detail.assignedAssetsByRole.brochure.length, 1);
  assert.equal(detail.assignedAssetsByRole.spec_sheet.length, 0);
});

test('publish validation blocks missing primary image and warns on expected missing document roles', SERIAL, async () => {
  const fixture = await seedProductFixture();
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: fixture.presentation.id,
      assetId: fixture.brochure.id,
      role: 'BROCHURE',
      sortOrder: 1,
    },
  });

  const result = await runProductPublishValidation(actor, fixture.presentation.id);
  const statusByCode = Object.fromEntries(result.checks.map((check) => [check.checkCode, check.status]));

  assert.equal(result.status, 'blocked');
  assert.equal(statusByCode.primary_image, 'blocked');
  assert.equal(statusByCode.spec_sheet, 'warning');
  assert.equal(statusByCode.install_guide, 'warning');
  assert.equal(statusByCode.brochure, 'pass');
});

test('publish validation accepts matching active dealer-visible assets for expected roles', SERIAL, async () => {
  const fixture = await seedProductFixture();
  await prisma.productAssetAssignment.createMany({
    data: [
      { presentationId: fixture.presentation.id, assetId: fixture.primaryImage.id, role: 'PRIMARY_IMAGE', isRequired: true },
      { presentationId: fixture.presentation.id, assetId: fixture.specSheet.id, role: 'SPEC_SHEET' },
      { presentationId: fixture.presentation.id, assetId: fixture.installGuide.id, role: 'INSTALL_GUIDE' },
      { presentationId: fixture.presentation.id, assetId: fixture.brochure.id, role: 'BROCHURE' },
    ],
  });

  const result = await runProductPublishValidation(actor, fixture.presentation.id);
  const statusByCode = Object.fromEntries(result.checks.map((check) => [check.checkCode, check.status]));

  assert.equal(result.status, 'pass');
  assert.equal(statusByCode.primary_image, 'pass');
  assert.equal(statusByCode.spec_sheet, 'pass');
  assert.equal(statusByCode.install_guide, 'pass');
  assert.equal(statusByCode.brochure, 'pass');
});

test('product asset assignments can be unlinked with audit trail', SERIAL, async () => {
  const fixture = await seedProductFixture();
  const assignment = await prisma.productAssetAssignment.create({
    data: {
      presentationId: fixture.presentation.id,
      assetId: fixture.primaryImage.id,
      role: 'PRIMARY_IMAGE',
    },
  });

  const result = await unlinkProductAsset(actor, assignment.id);

  assert.equal(result.id, assignment.id);
  assert.equal(await prisma.productAssetAssignment.count({ where: { id: assignment.id } }), 0);
  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'PRODUCT_ASSET_ASSIGNMENT',
      entityId: assignment.id,
      action: 'DELETE',
    },
  });
  assert.ok(audit);
});

async function seedProductFixture() {
  const category = await prisma.productCategory.create({
    data: {
      code: 'iaq',
      name: 'IAQ',
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: `SKU-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      productName: 'Whole Home IAQ System',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
      categoryId: category.id,
      isDealerVisible: true,
    },
  });
  const presentation = await prisma.productPresentation.create({
    data: {
      baseProductId: product.id,
      displayName: 'Whole Home IAQ System',
      shortDescription: 'Dealer-ready indoor air quality system.',
      businessSegment: 'RESIDENTIAL',
    },
  });
  await prisma.catalogInclusion.create({
    data: {
      presentationId: presentation.id,
      dealerGroupType: 'all_dealers',
      isVisible: true,
      publishStatus: 'READY_FOR_REVIEW',
    },
  });

  const primaryImage = await createAsset('primary-image', 'Primary product image', 'IMAGE');
  const specSheet = await createAsset('spec-sheet', 'Specification sheet', 'DOCUMENT');
  const installGuide = await createAsset('install-guide', 'Install guide', 'DOCUMENT');
  const brochure = await createAsset('brochure', 'Dealer brochure', 'DOCUMENT');
  return { category, product, presentation, primaryImage, specSheet, installGuide, brochure };
}

function createAsset(slugSuffix, title, kind) {
  return prisma.digitalAsset.create({
    data: {
      stableSlug: `${slugSuffix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      kind,
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
      audience: 'dealer',
    },
  });
}

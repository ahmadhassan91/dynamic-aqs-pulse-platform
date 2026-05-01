import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

const SERIAL = { concurrency: false };
let prisma;
let createCatalogInclusion;
let createProductCategory;
let createProductFamily;
let getProductDetail;
let listProductFamilies;
let runProductPublishValidation;
let updateCatalogInclusion;
let updateProductCategory;
let updateProductFamily;
let updateProductPresentation;
let unlinkProductAsset;
let actor;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({
    createCatalogInclusion,
    createProductCategory,
    createProductFamily,
    getProductDetail,
    listProductFamilies,
    runProductPublishValidation,
    updateCatalogInclusion,
    updateProductCategory,
    updateProductFamily,
    updateProductPresentation,
  } = await import('../dist/modules/product-management/service.js'));
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

test('product categories can be updated with audit trail', SERIAL, async () => {
  const parent = await createProductCategory(actor, {
    code: 'indoor-air',
    name: 'Indoor Air',
    categoryType: 'equipment',
    sortOrder: 10,
  });
  const category = await createProductCategory(actor, {
    code: 'filters',
    name: 'Filters',
    parentId: parent.id,
    regionScope: 'us',
  });

  const updated = await updateProductCategory(actor, category.id, {
    name: 'Replacement Filters',
    description: 'Dealer-facing replacement filter catalog group.',
    isActive: false,
    sortOrder: 25,
  });

  assert.equal(updated.name, 'Replacement Filters');
  assert.equal(updated.parentId, parent.id);
  assert.equal(updated.description, 'Dealer-facing replacement filter catalog group.');
  assert.equal(updated.isActive, false);
  assert.equal(updated.sortOrder, 25);
  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'PRODUCT_CATEGORY',
      entityId: category.id,
      action: 'UPDATE',
    },
  });
  assert.ok(audit);
});

test('product families can be created and updated with audit trail', SERIAL, async () => {
  const family = await createProductFamily(actor, {
    code: 'iaq-systems',
    name: 'IAQ Systems',
    description: 'Indoor air quality equipment family.',
    sortOrder: 15,
  });

  const updated = await updateProductFamily(actor, family.id, {
    name: 'Indoor Air Quality Systems',
    description: null,
    isActive: false,
    sortOrder: 5,
  });

  assert.equal(updated.name, 'Indoor Air Quality Systems');
  assert.equal(updated.description, undefined);
  assert.equal(updated.isActive, false);
  assert.equal(updated.sortOrder, 5);
  const families = await listProductFamilies(actor);
  assert.equal(families.items.length, 1);
  assert.equal(families.items[0].id, family.id);
  const audits = await prisma.auditEntry.findMany({
    where: { entityType: 'PRODUCT_FAMILY', entityId: family.id },
  });
  assert.equal(audits.filter((entry) => entry.action === 'CREATE').length, 1);
  assert.equal(audits.filter((entry) => entry.action === 'UPDATE').length, 1);
});

test('product presentation can be updated with audit trail', SERIAL, async () => {
  const fixture = await seedProductFixture();

  const updated = await updateProductPresentation(actor, fixture.presentation.id, {
    displayName: 'Dealer Ready IAQ System',
    shortDescription: 'Updated dealer short copy.',
    longDescription: 'Updated long-form dealer portal content.',
    specSummary: 'Updated specs.',
    regionScope: 'US',
    brandLabel: 'Dynamic',
    publishStatus: 'ready_for_review',
  });

  assert.equal(updated.displayName, 'Dealer Ready IAQ System');
  assert.equal(updated.publishStatus, 'ready_for_review');
  const detail = await getProductDetail(actor, fixture.product.id);
  assert.equal(detail.presentations[0].shortDescription, 'Updated dealer short copy.');
  assert.equal(detail.presentations[0].brandLabel, 'Dynamic');
  const audit = await prisma.auditEntry.findFirst({
    where: { entityType: 'PRODUCT_PRESENTATION', entityId: fixture.presentation.id, action: 'UPDATE' },
  });
  assert.ok(audit);
  assert.equal(audit.metadata.sourceOfTruth, 'pulse_presentation_fields_only');
});

test('catalog inclusions can be created and updated with audit trail', SERIAL, async () => {
  const fixture = await seedProductFixture();
  await prisma.catalogInclusion.deleteMany({ where: { presentationId: fixture.presentation.id } });

  let validation = await runProductPublishValidation(actor, fixture.presentation.id);
  assert.equal(Object.fromEntries(validation.checks.map((check) => [check.checkCode, check.status])).visibility, 'blocked');

  const created = await createCatalogInclusion(actor, {
    presentationId: fixture.presentation.id,
    regionScope: 'US',
    brandLabel: 'Dynamic',
    notes: 'Initial scoped rule',
  });
  assert.equal(created.dealerGroupType, 'all_dealers');
  assert.equal(created.isVisible, true);
  assert.equal(created.publishStatus, 'draft');

  const updated = await updateCatalogInclusion(actor, created.id, {
    dealerGroupType: 'ownership_group',
    dealerGroupId: 'grp-001',
    regionScope: 'CA',
    brandLabel: 'Private Label',
    isVisible: false,
    publishStatus: 'blocked',
    notes: null,
  });
  assert.equal(updated.dealerGroupType, 'ownership_group');
  assert.equal(updated.dealerGroupId, 'grp-001');
  assert.equal(updated.isVisible, false);
  assert.equal(updated.publishStatus, 'blocked');
  assert.equal(updated.notes, undefined);

  validation = await runProductPublishValidation(actor, fixture.presentation.id);
  assert.equal(Object.fromEntries(validation.checks.map((check) => [check.checkCode, check.status])).visibility, 'blocked');
  await updateCatalogInclusion(actor, created.id, { isVisible: true, publishStatus: 'ready_for_review' });
  validation = await runProductPublishValidation(actor, fixture.presentation.id);
  assert.equal(Object.fromEntries(validation.checks.map((check) => [check.checkCode, check.status])).visibility, 'pass');

  const audits = await prisma.auditEntry.findMany({ where: { entityType: 'CATALOG_INCLUSION', entityId: created.id } });
  assert.equal(audits.filter((entry) => entry.action === 'CREATE').length, 1);
  assert.equal(audits.filter((entry) => entry.action === 'UPDATE').length, 2);
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

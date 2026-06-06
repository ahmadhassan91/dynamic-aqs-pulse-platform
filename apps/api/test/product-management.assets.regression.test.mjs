import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

const SERIAL = { concurrency: false };
let prisma;
let activateCatalogRuleSet;
let createCatalogRuleSet;
let createCatalogInclusion;
let createDealerCatalogView;
let createProductCategory;
let createProductFamily;
let getProductDetail;
let listCatalogRuleConditionOptions;
let listDealerCatalogViews;
let listCatalogRuleSets;
let listProductFamilies;
let previewCatalogRuleSet;
let publishDealerCatalogSnapshot;
let runProductPublishValidation;
let updateCatalogRuleSet;
let updateCatalogInclusion;
let updateDealerCatalogView;
let updateProductCategory;
let updateProductFamily;
let updateProductPresentation;
let unlinkProductAsset;
let commitProductReferenceImport;
let actor;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({
    activateCatalogRuleSet,
    createCatalogRuleSet,
    createCatalogInclusion,
    createDealerCatalogView,
    createProductCategory,
    createProductFamily,
    getProductDetail,
    listCatalogRuleConditionOptions,
    listCatalogRuleSets,
    listDealerCatalogViews,
    listProductFamilies,
    previewCatalogRuleSet,
    publishDealerCatalogSnapshot,
    runProductPublishValidation,
    updateCatalogRuleSet,
    updateCatalogInclusion,
    updateDealerCatalogView,
    updateProductCategory,
    updateProductFamily,
    updateProductPresentation,
  } = await import('../dist/modules/product-management/service.js'));
  ({ commitProductReferenceImport } = await import('../dist/modules/product-management/legacy-import.js'));
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

test('dealer catalog views are governed separately from product categories and families', SERIAL, async () => {
  const standardView = await createDealerCatalogView(actor, {
    name: 'Standard US Dealer Catalog',
    kind: 'standard',
    regionScope: 'US',
    isDefault: true,
    precedence: 100,
  });
  const ownershipView = await createDealerCatalogView(actor, {
    name: 'Redwood Ownership Catalog',
    kind: 'ownership',
    resolverKey: 'redwood',
    resolverLabel: 'Redwood / Apollo',
    precedence: 40,
  });

  const updated = await updateDealerCatalogView(actor, ownershipView.id, {
    description: 'Ownership/PE overlay for catalog visibility only. Pricing remains ERP price class driven.',
    isActive: false,
  });

  assert.equal(standardView.kind, 'standard');
  assert.equal(standardView.regionScope, 'US');
  assert.equal(updated.kind, 'ownership');
  assert.equal(updated.resolverKey, 'redwood');
  assert.equal(updated.isActive, false);

  const activeViews = await listDealerCatalogViews(actor, { isActive: true });
  assert.equal(activeViews.items.length, 1);
  assert.equal(activeViews.items[0].id, standardView.id);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'DEALER_CATALOG_VIEW',
      entityId: ownershipView.id,
      action: 'UPDATE',
    },
  });
  assert.ok(audit);
});

test('catalog inclusion links to an explicit dealer catalog view', SERIAL, async () => {
  const fixture = await seedProductFixture();
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Nexstar Dealer Catalog',
    kind: 'affinity',
    resolverKey: 'nexstar',
    resolverLabel: 'Nexstar',
    precedence: 50,
  });

  const inclusion = await createCatalogInclusion(actor, {
    presentationId: fixture.presentation.id,
    dealerCatalogViewId: catalogView.id,
    dealerGroupType: 'affinity_group',
    dealerGroupId: 'nexstar',
    isVisible: true,
    publishStatus: 'ready_for_review',
  });

  assert.equal(inclusion.dealerCatalogViewId, catalogView.id);

  const detail = await getProductDetail(actor, fixture.product.id);
  const linked = detail.inclusions.find((item) => item.id === inclusion.id);
  assert.equal(linked.dealerCatalogView.name, 'Nexstar Dealer Catalog');
  assert.equal(linked.dealerCatalogView.kind, 'affinity');
});

test('catalog rule sets preview and activate simple dealer catalog rules', SERIAL, async () => {
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Nexstar Dealer Catalog',
    kind: 'affinity',
    resolverKey: 'nexstar',
    resolverLabel: 'Nexstar',
    precedence: 50,
  });
  await seedAccountClassificationFixture({ affinityCode: 'nexstar' });
  const fixture = await seedProductFixture();
  await prisma.productPresentation.update({
    where: { id: fixture.presentation.id },
    data: { readyForDealerPortal: true },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: fixture.presentation.id,
      assetId: fixture.primaryImage.id,
      role: 'PRIMARY_IMAGE',
      isRequired: true,
    },
  });
  await createCatalogInclusion(actor, {
    presentationId: fixture.presentation.id,
    dealerCatalogViewId: catalogView.id,
    isVisible: true,
    publishStatus: 'ready_for_review',
  });

  const ruleSet = await createCatalogRuleSet(actor, {
    name: 'Dealer Catalog Rules',
    rules: [{
      name: 'Nexstar dealers see Nexstar catalog',
      priority: 10,
      conditions: [{ field: 'affinity_group', operator: 'is', value: 'nexstar' }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: catalogView.id,
    }],
  });

  const preview = await previewCatalogRuleSet(actor, ruleSet.id, { sampleLimit: 10 });
  assert.equal(preview.sampleAccountCount, 1);
  assert.equal(preview.matchedCount, 1);
  assert.equal(preview.rows[0].dealerCatalogViewName, 'Nexstar Dealer Catalog');
  assert.equal(preview.catalogViewImpacts[0].visibleProductCount, 1);
  assert.equal(preview.catalogViewImpacts[0].readyProductCount, 1);
  assert.equal(preview.catalogViewImpacts[0].linkedFileCount, 1);

  const activated = await activateCatalogRuleSet(actor, ruleSet.id);
  assert.equal(activated.activeRuleSet.status, 'active');
  assert.equal(activated.activeRuleSet.isActive, true);
  const listed = await listCatalogRuleSets(actor);
  assert.equal(listed.items.filter((item) => item.isActive).length, 1);
});

test('catalog rule activation retires previous active rule set', SERIAL, async () => {
  const independentView = await createDealerCatalogView(actor, {
    name: 'Independent Dealer Catalog',
    kind: 'independent',
    precedence: 80,
  });
  const standardView = await createDealerCatalogView(actor, {
    name: 'Standard Dealer Catalog',
    kind: 'standard',
    precedence: 100,
  });

  const first = await createCatalogRuleSet(actor, {
    name: 'Independent first rules',
    rules: [{
      name: 'Independent dealers',
      conditions: [{ field: 'independent', operator: 'is', value: true }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: independentView.id,
    }],
  });
  await activateCatalogRuleSet(actor, first.id);

  const second = await createCatalogRuleSet(actor, {
    name: 'Standard rules',
    rules: [{
      name: 'Any account',
      conditions: [{ field: 'affinity_group', operator: 'is_any' }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: standardView.id,
    }],
  });
  const activated = await activateCatalogRuleSet(actor, second.id);

  assert.deepEqual(activated.retiredRuleSetIds, [first.id]);
  const ruleSets = await listCatalogRuleSets(actor);
  assert.equal(ruleSets.items.find((item) => item.id === first.id).status, 'retired');
  assert.equal(ruleSets.items.find((item) => item.id === second.id).status, 'active');
});

test('catalog rule activation validates every active account, not only preview sample', SERIAL, async () => {
  const affinityGroup = await prisma.affinityGroupRef.create({
    data: {
      code: 'nexstar',
      name: 'Nexstar',
      groupType: 'BUYING_GROUP',
    },
  });
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Nexstar Dealer Catalog',
    kind: 'affinity',
    resolverKey: 'nexstar',
    resolverLabel: 'Nexstar',
    precedence: 50,
  });

  await prisma.account.createMany({
    data: Array.from({ length: 100 }, (_, index) => ({
      displayName: `Matched Nexstar Account ${index + 1}`,
      affinityGroupSelection: 'GROUP',
      affinityGroupId: affinityGroup.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
      isActive: true,
    })),
  });
  await prisma.account.create({
    data: {
      displayName: 'Unmatched Independent Account',
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      groupClassification: 'INDEPENDENT',
      isActive: true,
    },
  });

  const ruleSet = await createCatalogRuleSet(actor, {
    name: 'Nexstar only rules',
    rules: [{
      name: 'Nexstar dealers',
      conditions: [{ field: 'affinity_group', operator: 'is', value: 'nexstar' }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: catalogView.id,
    }],
  });

  const preview = await previewCatalogRuleSet(actor, ruleSet.id, { sampleLimit: 100 });
  assert.equal(preview.sampleAccountCount, 100);

  await assert.rejects(
    () => activateCatalogRuleSet(actor, ruleSet.id),
    /Preview must be clean before publishing: 1 unmatched/,
  );
});

test('catalog rule preview surfaces review requirements instead of guessing', SERIAL, async () => {
  await seedAccountClassificationFixture({ affinityCode: 'nexstar', ownershipCode: 'redwood' });
  const ruleSet = await createCatalogRuleSet(actor, {
    name: 'Hybrid review rules',
    rules: [{
      name: 'Hybrid ownership needs review',
      priority: 5,
      conditions: [{ field: 'ownership_group', operator: 'is', value: 'redwood' }],
      resultAction: 'require_review',
      requireReviewReason: 'Ownership and affinity both apply. Confirm catalog view.',
    }],
  });

  const preview = await previewCatalogRuleSet(actor, ruleSet.id, { sampleLimit: 10 });

  assert.equal(preview.matchedCount, 1);
  assert.equal(preview.reviewRequiredCount, 1);
  assert.equal(preview.rows[0].resultAction, 'require_review');
  assert.match(preview.rows[0].warning, /Ownership and affinity/);
  await activateCatalogRuleSet(actor, ruleSet.id).then(
    () => assert.fail('Expected review-required preview to block activation'),
    (error) => assert.match(error.message, /Preview must be clean/),
  );

  await updateCatalogRuleSet(actor, ruleSet.id, {
    rules: [{
      name: 'Incomplete rule',
      conditions: [{ field: 'affinity_group', operator: 'is_any' }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: null,
    }],
  }).then(
    () => assert.fail('Expected missing catalog view to be rejected'),
    (error) => assert.match(error.message, /Dealer Catalog View/),
  );
});

test('catalog rule options are active approved values and brand-label conditions resolve', SERIAL, async () => {
  await prisma.affinityGroupRef.createMany({
    data: [
      { code: 'nexstar', name: 'Nexstar', groupType: 'BUYING_GROUP', isActive: true },
      { code: 'retired_affinity', name: 'Retired Affinity', groupType: 'OTHER', isActive: false },
    ],
  });
  await prisma.ownershipGroupRef.createMany({
    data: [
      { code: 'redwood', name: 'Redwood / Apollo', ownershipType: 'PRIVATE_EQUITY', isActive: true },
      { code: 'old_owner', name: 'Old Owner', ownershipType: 'OTHER', isActive: false },
    ],
  });
  await prisma.brandLabelRef.createMany({
    data: [
      { code: 'STS', name: 'StratosAire', isActive: true },
      { code: 'retired_brand', name: 'Retired Brand', isActive: false },
    ],
  });
  await prisma.region.createMany({
    data: [
      { code: 'south', name: 'South', isActive: true },
      { code: 'retired_region', name: 'Retired Region', isActive: false },
    ],
  });
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Nexstar Dealer Catalog',
    kind: 'affinity',
    resolverKey: 'nexstar',
    resolverLabel: 'Nexstar',
  });

  const options = await listCatalogRuleConditionOptions(actor);

  assert.deepEqual(options.affinityGroups.map((item) => item.value), ['nexstar']);
  assert.deepEqual(options.ownershipGroups.map((item) => item.value), ['redwood']);
  assert.deepEqual(options.brandLabels.map((item) => item.value), ['STS']);
  assert.deepEqual(options.regions.map((item) => item.value), ['south']);
  assert.equal(options.dealerCatalogViews[0].value, catalogView.id);

  const ruleSet = await createCatalogRuleSet(actor, {
    name: 'Brand rules now active',
    rules: [{
      name: 'Brand match resolves',
      conditions: [{ field: 'brand_label', operator: 'is', value: 'STS' }],
      resultAction: 'assign_catalog_view',
      dealerCatalogViewId: catalogView.id,
    }],
  });
  assert.equal(ruleSet.rules[0].conditions[0].field, 'brand_label');
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

test('catalog publish is blocked until products have dealer-safe files', SERIAL, async () => {
  const fixture = await seedProductFixture();
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Safe Publish Catalog',
    kind: 'standard',
    isDefault: true,
  });
  const inclusion = await prisma.catalogInclusion.findFirst({ where: { presentationId: fixture.presentation.id } });
  await updateCatalogInclusion(actor, inclusion.id, {
    dealerCatalogViewId: catalogView.id,
    isVisible: true,
    publishStatus: 'published',
  });
  await prisma.productPresentation.update({
    where: { id: fixture.presentation.id },
    data: { publishStatus: 'PUBLISHED', readyForDealerPortal: true },
  });

  await assert.rejects(
    () => publishDealerCatalogSnapshot(actor, catalogView.id, { notes: 'should block missing files' }),
    /at least one approved dealer-safe file/i,
  );

  await prisma.productAssetAssignment.create({
    data: {
      presentationId: fixture.presentation.id,
      assetId: fixture.primaryImage.id,
      role: 'PRIMARY_IMAGE',
      isRequired: true,
    },
  });
  const snapshot = await publishDealerCatalogSnapshot(actor, catalogView.id, { notes: 'ready after image' });
  assert.equal(snapshot.productCount, 1);
  assert.equal(snapshot.fileCount, 1);
});

test('catalog publish is blocked when a product is a legacy CSV seed (FILE_IMPORT)', SERIAL, async () => {
  const fixture = await seedProductFixture();
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Seed Block Catalog',
    kind: 'standard',
    isDefault: true,
  });
  const inclusion = await prisma.catalogInclusion.findFirst({ where: { presentationId: fixture.presentation.id } });
  await updateCatalogInclusion(actor, inclusion.id, {
    dealerCatalogViewId: catalogView.id,
    isVisible: true,
    publishStatus: 'published',
  });
  await prisma.productPresentation.update({
    where: { id: fixture.presentation.id },
    data: { publishStatus: 'PUBLISHED', readyForDealerPortal: true },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: fixture.presentation.id,
      assetId: fixture.primaryImage.id,
      role: 'PRIMARY_IMAGE',
      isRequired: true,
    },
  });
  // Product is otherwise fully publishable; mark it as a legacy CSV seed — publish must now be blocked (PRD boundary).
  await prisma.baseProduct.update({ where: { id: fixture.product.id }, data: { sourceSystem: 'FILE_IMPORT' } });

  await assert.rejects(
    () => publishDealerCatalogSnapshot(actor, catalogView.id, { notes: 'should block legacy seed' }),
    /legacy-seed|reconciled|FILE_IMPORT|parked/i,
  );
});

test('catalog publish excludes a product whose only image is PENDING_REVIEW', SERIAL, async () => {
  // Guards isDealerVisibleSnapshotAsset: a PENDING_REVIEW image must NOT count as a
  // dealer-safe file, so a product whose only asset is pending review cannot be published.
  const fixture = await seedProductFixture();
  const catalogView = await createDealerCatalogView(actor, {
    name: 'Pending Review Catalog',
    kind: 'standard',
    isDefault: true,
  });
  const inclusion = await prisma.catalogInclusion.findFirst({ where: { presentationId: fixture.presentation.id } });
  await updateCatalogInclusion(actor, inclusion.id, {
    dealerCatalogViewId: catalogView.id,
    isVisible: true,
    publishStatus: 'published',
  });
  await prisma.productPresentation.update({
    where: { id: fixture.presentation.id },
    data: { publishStatus: 'PUBLISHED', readyForDealerPortal: true },
  });
  const pendingImage = await prisma.digitalAsset.create({
    data: {
      stableSlug: `pending-review-${Date.now()}`,
      title: 'Pending review image',
      kind: 'IMAGE',
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'PENDING_REVIEW',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
      audience: 'dealer',
    },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: fixture.presentation.id,
      assetId: pendingImage.id,
      role: 'PRIMARY_IMAGE',
      isRequired: true,
    },
  });

  // The product is PULSE (not FILE_IMPORT), so the rejection is specifically because the
  // PENDING_REVIEW image is not a dealer-safe file — proving the review gate holds.
  await assert.rejects(
    () => publishDealerCatalogSnapshot(actor, catalogView.id, { notes: 'pending-review image is not dealer-safe' }),
    /at least one approved dealer-safe file/i,
  );
});

test('product reference import commits products and presentations when seed flag is enabled', SERIAL, async () => {
  const dryRun = await commitProductReferenceImport(actor, { dryRun: true, limit: 5 });
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.productsCreated, 0);

  const prev = process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED;
  process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED = 'true';
  try {
    const committed = await commitProductReferenceImport(actor, { dryRun: false, limit: 5 });
    assert.equal(committed.dryRun, false);
    assert.ok(committed.productsCreated + committed.productsUpdated > 0);
    assert.ok(committed.presentationsCreated + committed.presentationsUpdated >= 0);
  } finally {
    if (prev === undefined) delete process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED;
    else process.env.PULSE_ALLOW_LEGACY_PRODUCT_SEED = prev;
  }
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

async function seedAccountClassificationFixture({ affinityCode, ownershipCode }) {
  const affinityGroup = affinityCode ? await prisma.affinityGroupRef.create({
    data: {
      code: affinityCode,
      name: affinityCode === 'nexstar' ? 'Nexstar' : affinityCode,
      groupType: 'BUYING_GROUP',
    },
  }) : null;
  const ownershipGroup = ownershipCode ? await prisma.ownershipGroupRef.create({
    data: {
      code: ownershipCode,
      name: ownershipCode === 'redwood' ? 'Redwood / Apollo' : ownershipCode,
      ownershipType: 'PRIVATE_EQUITY',
    },
  }) : null;

  return prisma.account.create({
    data: {
      displayName: ownershipGroup ? 'Hybrid Dealer Account' : 'Nexstar Dealer Account',
      affinityGroupSelection: affinityGroup ? 'GROUP' : 'NONE',
      affinityGroupId: affinityGroup?.id,
      ownershipGroupSelection: ownershipGroup ? 'GROUP' : 'NONE',
      ownershipGroupId: ownershipGroup?.id,
      groupClassification: affinityGroup && ownershipGroup ? 'HYBRID' : affinityGroup ? 'AFFINITY_ONLY' : ownershipGroup ? 'OWNERSHIP_ONLY' : 'INDEPENDENT',
    },
  });
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

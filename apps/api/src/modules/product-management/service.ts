import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
  CatalogRuleResultAction,
  CatalogRuleSetStatus,
  DealerCatalogSnapshotStatus,
  DealerCatalogViewKind,
  DigitalAssetKind,
  DigitalAssetReviewStatus,
  DigitalAssetStatus,
  DigitalAssetVisibility,
  ProductAssetRole,
  ProductLifecycleStatus,
  ProductPublishStatus,
  ProductReadinessStatus,
  ProductSourceSystem,
  prisma,
} from '@pulse/db';
import {
  CATALOG_RULE_CONDITION_FIELDS,
  CATALOG_RULE_CONDITION_OPERATORS,
  CATALOG_RULE_RESULT_ACTIONS,
} from '@pulse/contracts/product-management';
import type {
  BaseProductSummary,
  CatalogRuleConditionInput,
  CatalogRuleCatalogViewImpact,
  CatalogRuleConditionOptionsResponse,
  CatalogRuleDraftInput,
  CatalogRulePreviewRow,
  CatalogRulePreviewResponse,
  CatalogRuleSetSummary,
  CatalogInclusionSummary,
  CreateCatalogRuleSetRequest,
  CreateDealerCatalogViewRequest,
  CreateDealerCatalogSnapshotRequest,
  CreateProductCategoryRequest,
  CreateProductFamilyRequest,
  DealerCatalogViewSummary,
  DealerCatalogSnapshotSummary,
  DealerCatalogSnapshotCompareResponse,
  ListDealerCatalogViewsRequest,
  ListProductsRequest,
  ListProductsResponse,
  ProductCategorySummary,
  ProductDetail,
  ProductAssetLinkSummary,
  ProductFamilySummary,
  ProductPresentationSummary,
  ProductPublishValidationResponse,
  UpdateCatalogRuleSetRequest,
  UpdateProductCategoryRequest,
  UpdateDealerCatalogViewRequest,
  UpdateProductFamilyRequest,
  UpdateProductPresentationRequest,
  UpsertCatalogInclusionRequest,
  RollbackDealerCatalogSnapshotRequest,
} from '@pulse/contracts/product-management';
import { PRODUCT_ASSET_ROLES } from '@pulse/contracts/digital-assets';
import { buildAuditEntryData } from '../../utils/audit.js';
import type { AuthenticatedActor } from '../auth/types.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const PRODUCT_INCLUDE = {
  category: true,
  family: true,
  presentations: {
    include: {
      inclusions: { include: { dealerCatalogView: true } },
      readinessChecks: { orderBy: [{ createdAt: 'desc' as const }] },
      assetAssignments: {
        include: {
          asset: true,
          assetVersion: true,
        },
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
      },
    },
    orderBy: [{ updatedAt: 'desc' as const }],
  },
};

const CATALOG_RULE_SET_INCLUDE = {
  rules: {
    include: { dealerCatalogView: true },
    orderBy: [{ priority: 'asc' as const }, { createdAt: 'asc' as const }],
  },
};

export async function listProducts(actor: AuthenticatedActor, input: ListProductsRequest = {}): Promise<ListProductsResponse> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const where = buildProductWhere(input);
  const [items, total] = await Promise.all([
    prisma.baseProduct.findMany({
      where,
      include: input.includeDetail ? PRODUCT_INCLUDE : { category: true, family: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: clampLimit(input.limit),
    }),
    prisma.baseProduct.count({ where }),
  ]);
  if (input.includeDetail) {
    return {
      items: items.map(mapBaseProduct),
      total,
      details: items.map(mapProductDetail),
    };
  }
  return { items: items.map(mapBaseProduct), total };
}

export async function getProductDetail(actor: AuthenticatedActor, productId: string): Promise<ProductDetail | null> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const product = await prisma.baseProduct.findUnique({
    where: { id: productId },
    include: PRODUCT_INCLUDE,
  });
  return product ? mapProductDetail(product) : null;
}

export async function listProductCategories(actor: AuthenticatedActor): Promise<{ items: ProductCategorySummary[] }> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const items = await prisma.productCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  return { items: items.map(mapCategory) };
}

export async function createProductCategory(actor: AuthenticatedActor, input: CreateProductCategoryRequest): Promise<ProductCategorySummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  if (!input.code?.trim()) throw new Error('code is required');
  if (!input.name?.trim()) throw new Error('name is required');
  const category = await prisma.productCategory.create({
    data: {
      code: input.code.trim(),
      name: input.name.trim(),
      parentId: cleanNullable(input.parentId),
      description: cleanNullable(input.description),
      categoryType: cleanNullable(input.categoryType),
      regionScope: cleanNullable(input.regionScope),
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 100,
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'PRODUCT_CATEGORY',
      entityId: category.id,
      afterData: category,
    }),
  });
  return mapCategory(category);
}

export async function listProductFamilies(actor: AuthenticatedActor): Promise<{ items: ProductFamilySummary[] }> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const items = await prisma.productFamily.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  return { items: items.map(mapFamily) };
}

export async function listDealerCatalogViews(actor: AuthenticatedActor, input: ListDealerCatalogViewsRequest = {}): Promise<{ items: DealerCatalogViewSummary[] }> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const where: any = {};
  if (input.kind) where.kind = toDealerCatalogViewKind(input.kind);
  if (input.isActive !== undefined) where.isActive = input.isActive;
  if (input.search?.trim()) {
    const contains = input.search.trim();
    where.OR = [
      { code: { contains, mode: 'insensitive' } },
      { name: { contains, mode: 'insensitive' } },
      { resolverKey: { contains, mode: 'insensitive' } },
      { resolverLabel: { contains, mode: 'insensitive' } },
      { regionScope: { contains, mode: 'insensitive' } },
      { brandLabel: { contains, mode: 'insensitive' } },
    ];
  }
  const items = await prisma.dealerCatalogView.findMany({
    where,
    include: {
      catalogSnapshots: {
        where: { isActive: true },
        include: { items: true },
        orderBy: [{ version: 'desc' }],
        take: 1,
      },
    },
    orderBy: [{ precedence: 'asc' }, { name: 'asc' }],
  });
  return { items: items.map(mapDealerCatalogView) };
}

export async function createDealerCatalogView(actor: AuthenticatedActor, input: CreateDealerCatalogViewRequest): Promise<DealerCatalogViewSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  if (!input.name?.trim()) throw new Error('name is required');
  const kind = toDealerCatalogViewKind(input.kind);
  const code = input.code?.trim() || buildDealerCatalogViewCode({
    kind,
    resolverKey: cleanNullable(input.resolverKey),
    regionScope: cleanNullable(input.regionScope),
    brandLabel: cleanNullable(input.brandLabel),
    name: input.name,
  });
  const catalogView = await prisma.dealerCatalogView.create({
    data: buildDealerCatalogViewData(actor.userId, code, kind, input),
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'DEALER_CATALOG_VIEW',
      entityId: catalogView.id,
      afterData: catalogView,
      metadata: { sourceOfTruth: 'pulse_catalog_view_governance' },
    }),
  });
  return mapDealerCatalogView(catalogView);
}

export async function updateDealerCatalogView(actor: AuthenticatedActor, catalogViewId: string, input: UpdateDealerCatalogViewRequest): Promise<DealerCatalogViewSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const before = await prisma.dealerCatalogView.findUnique({ where: { id: catalogViewId } });
  if (!before) throw new Error('Dealer catalog view not found');
  const updated = await prisma.dealerCatalogView.update({
    where: { id: catalogViewId },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() || before.code } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() || before.name } : {}),
      ...(input.kind !== undefined ? { kind: toDealerCatalogViewKind(input.kind) } : {}),
      ...(input.resolverKey !== undefined ? { resolverKey: cleanNullable(input.resolverKey) } : {}),
      ...(input.resolverLabel !== undefined ? { resolverLabel: cleanNullable(input.resolverLabel) } : {}),
      ...(input.regionScope !== undefined ? { regionScope: cleanNullable(input.regionScope) } : {}),
      ...(input.brandLabel !== undefined ? { brandLabel: cleanNullable(input.brandLabel) } : {}),
      ...(input.description !== undefined ? { description: cleanNullable(input.description) } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.precedence !== undefined ? { precedence: input.precedence } : {}),
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'DEALER_CATALOG_VIEW',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
      metadata: { sourceOfTruth: 'pulse_catalog_view_governance' },
    }),
  });
  return mapDealerCatalogView(updated);
}

export async function listDealerCatalogSnapshots(actor: AuthenticatedActor, catalogViewId: string): Promise<{ items: DealerCatalogSnapshotSummary[] }> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  await assertDealerCatalogViewExists(catalogViewId);
  const items = await prisma.dealerCatalogSnapshot.findMany({
    where: { dealerCatalogViewId: catalogViewId },
    include: { items: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] } },
    orderBy: [{ version: 'desc' }],
  });
  return { items: items.map((snapshot) => mapDealerCatalogSnapshot(snapshot, { includeItems: true })) };
}

export async function compareDealerCatalogSnapshot(actor: AuthenticatedActor, catalogViewId: string): Promise<DealerCatalogSnapshotCompareResponse> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const catalogView = await assertDealerCatalogViewExists(catalogViewId);
  const [currentItems, activeSnapshot] = await Promise.all([
    buildCatalogSnapshotItems(catalogView),
    prisma.dealerCatalogSnapshot.findFirst({
      where: { dealerCatalogViewId: catalogView.id, isActive: true },
      include: { items: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] } },
      orderBy: [{ version: 'desc' }],
    }),
  ]);

  const currentByPresentationId = new Map(currentItems.map((item) => [item.presentationId, item]));
  const publishedItems = activeSnapshot?.items ?? [];
  const publishedByPresentationId = new Map(publishedItems.map((item) => [item.presentationId, item]));
  const added = currentItems
    .filter((item) => !publishedByPresentationId.has(item.presentationId))
    .map((item) => mapSnapshotCompareItem(item));
  const removed = publishedItems
    .filter((item) => !currentByPresentationId.has(item.presentationId))
    .map((item) => mapSnapshotCompareItem(undefined, item));
  const changed: DealerCatalogSnapshotCompareResponse['changed'] = [];
  let unchangedCount = 0;

  for (const current of currentItems) {
    const published = publishedByPresentationId.get(current.presentationId);
    if (!published) continue;
    const changes = listSnapshotItemChanges(current, published);
    if (changes.length) {
      changed.push(mapSnapshotCompareItem(current, published, changes));
    } else {
      unchangedCount += 1;
    }
  }

  const currentFileCount = currentItems.reduce((total, item) => total + item.assetCount, 0);
  const publishedFileCount = publishedItems.reduce((total, item) => total + item.assetCount, 0);
  const warnings: string[] = [];
  if (!activeSnapshot) warnings.push('No published version exists yet. Publishing will create the first dealer-visible catalog version.');
  if (currentItems.length === 0) warnings.push('Current catalog view has no ready published products. Review product readiness and visibility before publishing.');
  if (currentItems.some((item) => item.assetCount === 0)) warnings.push('One or more current products has no dealer-safe files.');

  return {
    catalogViewId: catalogView.id,
    activeSnapshot: activeSnapshot ? mapDealerCatalogSnapshot(activeSnapshot, { includeItems: true }) : undefined,
    currentProductCount: currentItems.length,
    currentFileCount,
    publishedProductCount: publishedItems.length,
    publishedFileCount,
    added,
    removed,
    changed,
    unchangedCount,
    warnings,
  };
}

export async function publishDealerCatalogSnapshot(
  actor: AuthenticatedActor,
  catalogViewId: string,
  input: CreateDealerCatalogSnapshotRequest = {},
): Promise<DealerCatalogSnapshotSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.publish');
  const catalogView = await assertDealerCatalogViewExists(catalogViewId);
  const snapshotItems = await buildCatalogSnapshotItems(catalogView);
  const fileCount = snapshotItems.reduce((total, item) => total + item.assetCount, 0);
  if (!snapshotItems.length) {
    throw new Error('This catalog view has no ready dealer products. Review product readiness and visibility before publishing.');
  }
  if (snapshotItems.some((item) => item.assetCount === 0)) {
    throw new Error('Every dealer-visible product needs at least one approved dealer-safe file before publishing.');
  }
  // PRD parked boundary: legacy CSV-seeded products (sourceSystem FILE_IMPORT) must not
  // become dealer-facing catalog truth before Acumatica reconciliation. Block publish if
  // any are present — they must be reconciled (re-sourced via Acumatica) first.
  const seedProducts = await prisma.baseProduct.findMany({
    where: { id: { in: snapshotItems.map((item) => item.baseProductId) }, sourceSystem: ProductSourceSystem.FILE_IMPORT },
    select: { sku: true },
  });
  if (seedProducts.length) {
    throw new Error(
      `Cannot publish: ${seedProducts.length} product(s) are legacy-seed imports not yet reconciled with Acumatica `
      + `(e.g. ${seedProducts.slice(0, 5).map((product) => product.sku).join(', ')}). `
      + 'Per the Product Management PRD, legacy CSV data must not become dealer-facing catalog truth before Acumatica mappings are certified.',
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const latest = await tx.dealerCatalogSnapshot.findFirst({
      where: { dealerCatalogViewId: catalogView.id },
      orderBy: [{ version: 'desc' }],
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    await tx.dealerCatalogSnapshot.updateMany({
      where: { dealerCatalogViewId: catalogView.id, isActive: true },
      data: { isActive: false, status: DealerCatalogSnapshotStatus.ARCHIVED },
    });
    const snapshot = await tx.dealerCatalogSnapshot.create({
      data: {
        dealerCatalogViewId: catalogView.id,
        version,
        status: DealerCatalogSnapshotStatus.ACTIVE,
        isActive: true,
        productCount: snapshotItems.length,
        fileCount,
        publishedByUserId: actor.userId,
        notes: cleanNullable(input.notes),
        items: {
          create: snapshotItems.map((item, index) => ({
            dealerCatalogViewId: catalogView.id,
            presentationId: item.presentationId,
            baseProductId: item.baseProductId,
            sku: item.sku,
            displayName: item.displayName,
            assetCount: item.assetCount,
            assetVersionPayload: item.assetVersionPayload,
            sortOrder: index + 1,
          })),
        },
      },
      include: { items: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] } },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.APPROVE,
        entityType: 'DEALER_CATALOG_SNAPSHOT',
        entityId: snapshot.id,
        afterData: snapshot,
        metadata: {
          dealerCatalogViewId: catalogView.id,
          version,
          productCount: snapshot.productCount,
          fileCount: snapshot.fileCount,
        },
      }),
    });
    return snapshot;
  });

  return mapDealerCatalogSnapshot(created, { includeItems: true });
}

export async function rollbackDealerCatalogSnapshot(
  actor: AuthenticatedActor,
  catalogViewId: string,
  snapshotId: string,
  input: RollbackDealerCatalogSnapshotRequest = {},
): Promise<DealerCatalogSnapshotSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.publish');
  const catalogView = await assertDealerCatalogViewExists(catalogViewId);
  const source = await prisma.dealerCatalogSnapshot.findFirst({
    where: { id: snapshotId, dealerCatalogViewId: catalogView.id },
    include: { items: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] } },
  });
  if (!source) throw new Error('Dealer catalog snapshot not found');

  const created = await prisma.$transaction(async (tx) => {
    const latest = await tx.dealerCatalogSnapshot.findFirst({
      where: { dealerCatalogViewId: catalogView.id },
      orderBy: [{ version: 'desc' }],
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    await tx.dealerCatalogSnapshot.updateMany({
      where: { dealerCatalogViewId: catalogView.id, isActive: true },
      data: { isActive: false, status: DealerCatalogSnapshotStatus.ARCHIVED },
    });
    const snapshot = await tx.dealerCatalogSnapshot.create({
      data: {
        dealerCatalogViewId: catalogView.id,
        version,
        status: DealerCatalogSnapshotStatus.ACTIVE,
        isActive: true,
        productCount: source.productCount,
        fileCount: source.fileCount,
        publishedByUserId: actor.userId,
        rollbackOfSnapshotId: source.id,
        notes: cleanNullable(input.notes) ?? `Rollback to v${source.version}`,
        items: {
          create: source.items.map((item) => ({
            dealerCatalogViewId: catalogView.id,
            presentationId: item.presentationId,
            baseProductId: item.baseProductId,
            sku: item.sku,
            displayName: item.displayName,
            assetCount: item.assetCount,
            assetVersionPayload: item.assetVersionPayload as any,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: { items: { orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }] } },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'DEALER_CATALOG_SNAPSHOT',
        entityId: snapshot.id,
        beforeData: source,
        afterData: snapshot,
        metadata: {
          dealerCatalogViewId: catalogView.id,
          rollbackOfSnapshotId: source.id,
          version,
        },
      }),
    });
    return snapshot;
  });

  return mapDealerCatalogSnapshot(created, { includeItems: true });
}

export async function listCatalogRuleSets(actor: AuthenticatedActor): Promise<{ items: CatalogRuleSetSummary[] }> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const items = await prisma.catalogRuleSet.findMany({
    include: CATALOG_RULE_SET_INCLUDE,
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });
  return { items: items.map(mapCatalogRuleSet) };
}

export async function listCatalogRuleConditionOptions(actor: AuthenticatedActor): Promise<CatalogRuleConditionOptionsResponse> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const [affinityGroups, ownershipGroups, brandLabels, regions, dealerCatalogViews] = await Promise.all([
    prisma.affinityGroupRef.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.ownershipGroupRef.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.brandLabelRef.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.region.findMany({
      where: { isActive: true },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.dealerCatalogView.findMany({
      where: { isActive: true },
      orderBy: [{ precedence: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return {
    affinityGroups: affinityGroups.map((item) => ({
      value: item.code,
      label: item.name,
      helper: item.shortName ?? item.code,
    })),
    ownershipGroups: ownershipGroups.map((item) => ({
      value: item.code,
      label: item.name,
      helper: item.shortName ?? item.code,
    })),
    brandLabels: brandLabels.map((item) => ({
      value: item.code,
      label: item.name,
      helper: item.code,
    })),
    regions: regions.map((item) => ({
      value: item.code,
      label: item.name,
      helper: item.code,
    })),
    dealerCatalogViews: dealerCatalogViews.map((item) => ({
      value: item.id,
      label: item.name,
      helper: item.kind.toLowerCase().replace(/_/g, ' '),
    })),
  };
}

export async function createCatalogRuleSet(actor: AuthenticatedActor, input: CreateCatalogRuleSetRequest): Promise<CatalogRuleSetSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  if (!input.name?.trim()) throw new Error('name is required');
  const rules = await normalizeCatalogRuleDrafts(input.rules ?? []);
  const code = input.code?.trim() || `catalog-rules-${slugify(input.name)}-${Date.now().toString(36)}`;
  const created = await prisma.catalogRuleSet.create({
    data: {
      code,
      name: input.name.trim(),
      description: cleanNullable(input.description),
      status: CatalogRuleSetStatus.DRAFT,
      isActive: false,
      createdByUserId: actor.userId,
      rules: {
        create: rules.map((rule) => ({
          name: rule.name,
          description: rule.description,
          priority: rule.priority,
          conditions: rule.conditions as any,
          resultAction: rule.resultAction,
          dealerCatalogViewId: rule.dealerCatalogViewId,
          requireReviewReason: rule.requireReviewReason,
          isEnabled: rule.isEnabled,
        })),
      },
    },
    include: CATALOG_RULE_SET_INCLUDE,
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'CATALOG_RULE_SET',
      entityId: created.id,
      afterData: created,
      metadata: { sourceOfTruth: 'pulse_catalog_rules_admin' },
    }),
  });
  return mapCatalogRuleSet(created);
}

export async function updateCatalogRuleSet(actor: AuthenticatedActor, ruleSetId: string, input: UpdateCatalogRuleSetRequest): Promise<CatalogRuleSetSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const before = await prisma.catalogRuleSet.findUnique({ where: { id: ruleSetId }, include: CATALOG_RULE_SET_INCLUDE });
  if (!before) throw new Error('Catalog rule set not found');
  if (before.status === CatalogRuleSetStatus.ACTIVE) throw new Error('Active catalog rules must be retired by activating a new draft');
  const rules = input.rules !== undefined ? await normalizeCatalogRuleDrafts(input.rules) : undefined;
  const updated = await prisma.$transaction(async (tx) => {
    if (rules) {
      await tx.catalogRule.deleteMany({ where: { ruleSetId } });
    }
    return tx.catalogRuleSet.update({
      where: { id: ruleSetId },
      data: {
        ...(input.code !== undefined ? { code: input.code.trim() || before.code } : {}),
        ...(input.name !== undefined ? { name: input.name.trim() || before.name } : {}),
        ...(input.description !== undefined ? { description: cleanNullable(input.description) } : {}),
        ...(rules ? {
          rules: {
            create: rules.map((rule) => ({
              name: rule.name,
              description: rule.description,
              priority: rule.priority,
              conditions: rule.conditions as any,
              resultAction: rule.resultAction,
              dealerCatalogViewId: rule.dealerCatalogViewId,
              requireReviewReason: rule.requireReviewReason,
              isEnabled: rule.isEnabled,
            })),
          },
        } : {}),
      },
      include: CATALOG_RULE_SET_INCLUDE,
    });
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'CATALOG_RULE_SET',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
      metadata: { sourceOfTruth: 'pulse_catalog_rules_admin' },
    }),
  });
  return mapCatalogRuleSet(updated);
}

export async function previewCatalogRuleSet(
  actor: AuthenticatedActor,
  ruleSetId: string,
  input: { rules?: CatalogRuleDraftInput[]; sampleLimit?: number } = {},
): Promise<CatalogRulePreviewResponse> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const ruleSet = await prisma.catalogRuleSet.findUnique({ where: { id: ruleSetId }, include: CATALOG_RULE_SET_INCLUDE });
  if (!ruleSet) throw new Error('Catalog rule set not found');
  return evaluateCatalogRuleSetPreview(ruleSet, input);
}

export async function activateCatalogRuleSet(actor: AuthenticatedActor, ruleSetId: string) {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.publish');
  const before = await prisma.catalogRuleSet.findUnique({ where: { id: ruleSetId }, include: CATALOG_RULE_SET_INCLUDE });
  if (!before) throw new Error('Catalog rule set not found');
  if (!before.rules.length) throw new Error('Add at least one catalog rule before publishing');
  const invalidRule = before.rules.find((rule: any) => rule.isEnabled && rule.resultAction === CatalogRuleResultAction.ASSIGN_CATALOG_VIEW && (!rule.dealerCatalogView || !rule.dealerCatalogView.isActive));
  if (invalidRule) throw new Error(`Rule "${invalidRule.name}" must point to an active Dealer Catalog View before publishing`);
  const preview = await evaluateCatalogRuleSetPreview(before, { includeAllAccounts: true });
  if (preview.unmatchedCount > 0 || preview.reviewRequiredCount > 0) {
    throw new Error(`Preview must be clean before publishing: ${preview.unmatchedCount} unmatched and ${preview.reviewRequiredCount} need review.`);
  }
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const retired = await tx.catalogRuleSet.findMany({ where: { isActive: true, id: { not: ruleSetId } }, select: { id: true } });
    await tx.catalogRuleSet.updateMany({
      where: { isActive: true, id: { not: ruleSetId } },
      data: {
        status: CatalogRuleSetStatus.RETIRED,
        isActive: false,
        retiredAt: now,
        retiredByUserId: actor.userId,
      },
    });
    const activeRuleSet = await tx.catalogRuleSet.update({
      where: { id: ruleSetId },
      data: {
        status: CatalogRuleSetStatus.ACTIVE,
        isActive: true,
        activatedAt: now,
        activatedByUserId: actor.userId,
        retiredAt: null,
        retiredByUserId: null,
      },
      include: CATALOG_RULE_SET_INCLUDE,
    });
    return { activeRuleSet, retiredRuleSetIds: retired.map((item) => item.id) };
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.APPROVE,
      entityType: 'CATALOG_RULE_SET',
      entityId: result.activeRuleSet.id,
      beforeData: before,
      afterData: result.activeRuleSet,
      metadata: { retiredRuleSetIds: result.retiredRuleSetIds, sourceOfTruth: 'pulse_catalog_rules_admin' },
    }),
  });
  return {
    activeRuleSet: mapCatalogRuleSet(result.activeRuleSet),
    retiredRuleSetIds: result.retiredRuleSetIds,
  };
}

export async function createProductFamily(actor: AuthenticatedActor, input: CreateProductFamilyRequest): Promise<ProductFamilySummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  if (!input.code?.trim()) throw new Error('code is required');
  if (!input.name?.trim()) throw new Error('name is required');
  const family = await prisma.productFamily.create({
    data: {
      code: input.code.trim(),
      name: input.name.trim(),
      description: cleanNullable(input.description),
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 100,
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'PRODUCT_FAMILY',
      entityId: family.id,
      afterData: family,
    }),
  });
  return mapFamily(family);
}

export async function updateProductFamily(actor: AuthenticatedActor, familyId: string, input: UpdateProductFamilyRequest): Promise<ProductFamilySummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const before = await prisma.productFamily.findUnique({ where: { id: familyId } });
  if (!before) throw new Error('Product family not found');
  const updated = await prisma.productFamily.update({
    where: { id: familyId },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() || before.code } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() || before.name } : {}),
      ...(input.description !== undefined ? { description: cleanNullable(input.description) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'PRODUCT_FAMILY',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
      metadata: { sourceOfTruth: 'pulse_family_governance' },
    }),
  });
  return mapFamily(updated);
}

export async function updateProductCategory(actor: AuthenticatedActor, categoryId: string, input: UpdateProductCategoryRequest): Promise<ProductCategorySummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const before = await prisma.productCategory.findUnique({ where: { id: categoryId } });
  if (!before) throw new Error('Product category not found');
  if (input.parentId && input.parentId === categoryId) throw new Error('Product category cannot be its own parent');
  const updated = await prisma.productCategory.update({
    where: { id: categoryId },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() || before.code } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() || before.name } : {}),
      ...(input.parentId !== undefined ? { parentId: cleanNullable(input.parentId) } : {}),
      ...(input.description !== undefined ? { description: cleanNullable(input.description) } : {}),
      ...(input.categoryType !== undefined ? { categoryType: cleanNullable(input.categoryType) } : {}),
      ...(input.regionScope !== undefined ? { regionScope: cleanNullable(input.regionScope) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'PRODUCT_CATEGORY',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
      metadata: { sourceOfTruth: 'pulse_category_governance' },
    }),
  });
  return mapCategory(updated);
}

export async function updateProductPresentation(
  actor: AuthenticatedActor,
  presentationId: string,
  input: UpdateProductPresentationRequest,
): Promise<ProductPresentationSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const before = await prisma.productPresentation.findUnique({ where: { id: presentationId } });
  if (!before) throw new Error('Product presentation not found');
  const nextPublishStatus = input.publishStatus !== undefined ? toProductPublishStatus(input.publishStatus) : undefined;
  const approvalData = nextPublishStatus === ProductPublishStatus.APPROVED || nextPublishStatus === ProductPublishStatus.PUBLISHED
    ? { approvedByUserId: actor.userId, approvedAt: before.approvedAt ?? new Date() }
    : {};
  const publishData = nextPublishStatus === ProductPublishStatus.PUBLISHED
    ? { publishedAt: before.publishedAt ?? new Date(), readyForDealerPortal: true }
    : {};
  const updated = await prisma.productPresentation.update({
    where: { id: presentationId },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName.trim() || before.displayName } : {}),
      ...(input.shortDescription !== undefined ? { shortDescription: cleanNullable(input.shortDescription) } : {}),
      ...(input.longDescription !== undefined ? { longDescription: cleanNullable(input.longDescription) } : {}),
      ...(input.specSummary !== undefined ? { specSummary: cleanNullable(input.specSummary) } : {}),
      ...(input.regionScope !== undefined ? { regionScope: cleanNullable(input.regionScope) } : {}),
      ...(input.brandLabel !== undefined ? { brandLabel: cleanNullable(input.brandLabel) } : {}),
      ...(nextPublishStatus !== undefined ? { publishStatus: nextPublishStatus } : {}),
      ...approvalData,
      ...publishData,
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'PRODUCT_PRESENTATION',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
      metadata: { sourceOfTruth: 'pulse_presentation_fields_only' },
    }),
  });
  return mapPresentation(updated);
}

export async function createCatalogInclusion(actor: AuthenticatedActor, input: UpsertCatalogInclusionRequest): Promise<CatalogInclusionSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  if (!input.presentationId?.trim()) throw new Error('presentationId is required');
  const presentation = await prisma.productPresentation.findUnique({ where: { id: input.presentationId } });
  if (!presentation) throw new Error('Product presentation not found');
  const dealerCatalogViewId = await resolveDealerCatalogViewId(actor, input);
  const inclusion = await prisma.catalogInclusion.create({
    data: {
      presentationId: input.presentationId,
      dealerCatalogViewId,
      dealerGroupType: input.dealerGroupType?.trim() || 'all_dealers',
      dealerGroupId: cleanNullable(input.dealerGroupId),
      regionScope: cleanNullable(input.regionScope),
      brandLabel: cleanNullable(input.brandLabel),
      isVisible: input.isVisible ?? true,
      publishStatus: input.publishStatus ? toProductPublishStatus(input.publishStatus) : ProductPublishStatus.DRAFT,
      effectiveFrom: parseDateOrNull(input.effectiveFrom),
      effectiveTo: parseDateOrNull(input.effectiveTo),
      notes: cleanNullable(input.notes),
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'CATALOG_INCLUSION',
      entityId: inclusion.id,
      afterData: inclusion,
      metadata: { presentationId: input.presentationId },
    }),
  });
  return mapCatalogInclusion(inclusion);
}

export async function updateCatalogInclusion(actor: AuthenticatedActor, inclusionId: string, input: UpsertCatalogInclusionRequest): Promise<CatalogInclusionSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.manage');
  const before = await prisma.catalogInclusion.findUnique({ where: { id: inclusionId } });
  if (!before) throw new Error('Catalog inclusion not found');
  const dealerCatalogViewId = input.dealerCatalogViewId !== undefined
    ? cleanNullable(input.dealerCatalogViewId)
    : input.dealerGroupType !== undefined || input.dealerGroupId !== undefined || input.regionScope !== undefined || input.brandLabel !== undefined
      ? await resolveDealerCatalogViewId(actor, {
          ...input,
          dealerGroupType: input.dealerGroupType ?? before.dealerGroupType,
          dealerGroupId: input.dealerGroupId !== undefined ? input.dealerGroupId : before.dealerGroupId,
          regionScope: input.regionScope !== undefined ? input.regionScope : before.regionScope,
          brandLabel: input.brandLabel !== undefined ? input.brandLabel : before.brandLabel,
        })
      : undefined;
  const updated = await prisma.catalogInclusion.update({
    where: { id: inclusionId },
    data: {
      ...(dealerCatalogViewId !== undefined ? { dealerCatalogViewId } : {}),
      ...(input.dealerGroupType !== undefined ? { dealerGroupType: input.dealerGroupType.trim() || before.dealerGroupType } : {}),
      ...(input.dealerGroupId !== undefined ? { dealerGroupId: cleanNullable(input.dealerGroupId) } : {}),
      ...(input.regionScope !== undefined ? { regionScope: cleanNullable(input.regionScope) } : {}),
      ...(input.brandLabel !== undefined ? { brandLabel: cleanNullable(input.brandLabel) } : {}),
      ...(input.isVisible !== undefined ? { isVisible: input.isVisible } : {}),
      ...(input.publishStatus !== undefined ? { publishStatus: toProductPublishStatus(input.publishStatus) } : {}),
      ...(input.effectiveFrom !== undefined ? { effectiveFrom: parseDateOrNull(input.effectiveFrom) } : {}),
      ...(input.effectiveTo !== undefined ? { effectiveTo: parseDateOrNull(input.effectiveTo) } : {}),
      ...(input.notes !== undefined ? { notes: cleanNullable(input.notes) } : {}),
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'CATALOG_INCLUSION',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
      metadata: { presentationId: updated.presentationId },
    }),
  });
  return mapCatalogInclusion(updated);
}

export async function runProductPublishValidation(actor: AuthenticatedActor, presentationId: string): Promise<ProductPublishValidationResponse> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.publish');
  const presentation = await prisma.productPresentation.findUnique({
    where: { id: presentationId },
    include: {
      baseProduct: { include: { category: true, family: true } },
      inclusions: true,
      assetAssignments: { include: { asset: true } },
    },
  });
  if (!presentation) throw new Error('Product presentation not found');

  const checks = [
    buildCheck(presentation.baseProduct.categoryId ? 'PASS' : 'BLOCKED', 'category', 'Category assigned', 'Product must have a governed Pulse category before portal publish.'),
    buildCheck(presentation.displayName.trim() && presentation.shortDescription?.trim() ? 'PASS' : 'BLOCKED', 'content', 'Dealer content complete', 'Display name and short description are required.'),
    buildAssetReadinessCheck(presentation.assetAssignments, ProductAssetRole.PRIMARY_IMAGE, [DigitalAssetKind.IMAGE], 'BLOCKED', 'Primary image attached', 'A dealer-visible product needs an active, approved, dealer-visible primary image.'),
    buildAssetReadinessCheck(presentation.assetAssignments, ProductAssetRole.SPEC_SHEET, [DigitalAssetKind.DOCUMENT], 'WARNING', 'Spec sheet attached', 'A spec sheet is expected for dealer portal product detail.'),
    buildAssetReadinessCheck(presentation.assetAssignments, ProductAssetRole.INSTALL_GUIDE, [DigitalAssetKind.DOCUMENT], 'WARNING', 'Install guide attached', 'An install guide is expected for dealer portal readiness.'),
    buildAssetReadinessCheck(presentation.assetAssignments, ProductAssetRole.BROCHURE, [DigitalAssetKind.DOCUMENT, DigitalAssetKind.PRESENTATION], 'WARNING', 'Brochure attached', 'A brochure is expected for dealer-facing product support.'),
    buildCheck(hasBrandScopedAssetMismatch(presentation) ? 'BLOCKED' : 'PASS', 'asset_brand_scope', 'Asset brand scope aligned', 'One or more linked assets has a brand scope that does not match the product presentation brand.'),
    buildCheck(hasRegionScopedAssetMismatch(presentation) ? 'WARNING' : 'PASS', 'asset_region_scope', 'Asset region scope aligned', 'One or more linked assets has a region scope that differs from the product presentation region.'),
    buildCheck(presentation.inclusions.some((inclusion) => inclusion.isVisible) ? 'PASS' : 'BLOCKED', 'visibility', 'Dealer visibility defined', 'At least one visible catalog inclusion is required.'),
  ] as const;
  await prisma.$transaction(async (tx) => {
    await tx.productPublishCheck.deleteMany({ where: { presentationId } });
    await tx.productPublishCheck.createMany({
      data: checks.map((check) => ({
        presentationId,
        checkCode: check.checkCode,
        checkName: check.checkName,
        status: toReadinessStatus(check.status),
        message: check.message,
      })),
    });
  });
  const saved = await prisma.productPublishCheck.findMany({ where: { presentationId }, orderBy: [{ createdAt: 'desc' }] });
  const status = saved.some((check) => check.status === ProductReadinessStatus.BLOCKED) ? 'blocked' : saved.some((check) => check.status === ProductReadinessStatus.WARNING) ? 'warning' : 'pass';
  return {
    presentationId,
    status,
    checks: saved.map((check) => ({
      id: check.id,
      presentationId: check.presentationId,
      checkCode: check.checkCode,
      checkName: check.checkName,
      status: lower(check.status),
      ...(check.message ? { message: check.message } : {}),
      createdAt: check.createdAt.toISOString(),
    })),
  };
}

async function assertDealerCatalogViewExists(catalogViewId: string) {
  const catalogView = await prisma.dealerCatalogView.findUnique({ where: { id: catalogViewId } });
  if (!catalogView) throw new Error('Dealer catalog view not found');
  return catalogView;
}

async function buildCatalogSnapshotItems(catalogView: { id: string; brandLabel?: string | null; regionScope?: string | null }) {
  const now = new Date();
  const presentations = await prisma.productPresentation.findMany({
    where: {
      publishStatus: ProductPublishStatus.PUBLISHED,
      readyForDealerPortal: true,
      baseProduct: {
        lifecycleStatus: ProductLifecycleStatus.ACTIVE,
        isSellable: true,
        isDealerVisible: true,
      },
      inclusions: {
        some: {
          dealerCatalogViewId: catalogView.id,
          isVisible: true,
          publishStatus: ProductPublishStatus.PUBLISHED,
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
          AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
        },
      },
    },
    include: {
      baseProduct: true,
      assetAssignments: {
        include: {
          asset: {
            include: {
              versions: {
                where: { isCurrent: true },
                take: 1,
              },
            },
          },
          assetVersion: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ displayName: 'asc' }],
  });

  return presentations.map((presentation: any) => {
    const assets = presentation.assetAssignments
      .filter((assignment: any) => isDealerVisibleSnapshotAsset(assignment, catalogView))
      .map((assignment: any) => {
        const version = assignment.assetVersion ?? assignment.asset.versions?.[0] ?? null;
        return compact({
          assignmentId: assignment.id,
          assetId: assignment.assetId,
          assetVersionId: version?.id ?? assignment.assetVersionId ?? undefined,
          role: lower(assignment.role),
          title: assignment.asset.title,
          stableSlug: assignment.asset.stableSlug,
          kind: lower(assignment.asset.kind),
          fileName: version?.fileName ?? assignment.asset.legacyFileName ?? undefined,
        });
      });
    return {
      presentationId: presentation.id,
      baseProductId: presentation.baseProductId,
      sku: presentation.baseProduct.sku,
      displayName: presentation.displayName,
      assetCount: assets.length,
      assetVersionPayload: assets,
    };
  });
}

function isDealerVisibleSnapshotAsset(assignment: any, catalogView: { kind?: DealerCatalogViewKind | null; resolverKey?: string | null; brandLabel?: string | null; regionScope?: string | null }) {
  const asset = assignment.asset;
  if (!asset || asset.status !== DigitalAssetStatus.ACTIVE) return false;
  if (asset.visibility !== DigitalAssetVisibility.DEALER_PORTAL && asset.visibility !== DigitalAssetVisibility.PUBLIC) return false;
  if (asset.reviewStatus !== DigitalAssetReviewStatus.APPROVED && asset.reviewStatus !== DigitalAssetReviewStatus.NOT_REQUIRED) return false;
  if (asset.brandScope && catalogView.brandLabel && asset.brandScope !== catalogView.brandLabel) return false;
  if (asset.regionScope && catalogView.regionScope && asset.regionScope !== catalogView.regionScope) return false;
  if (assignment.brandLabel && assignment.brandLabel !== catalogView.brandLabel) return false;
  if (assignment.regionScope && assignment.regionScope !== catalogView.regionScope) return false;
  if (!doesAssignmentMatchCatalogView(assignment, catalogView)) return false;
  return true;
}

function doesAssignmentMatchCatalogView(
  assignment: { dealerGroupType?: string | null; dealerGroupId?: string | null },
  catalogView: { kind?: DealerCatalogViewKind | null; resolverKey?: string | null },
) {
  const type = assignment.dealerGroupType?.trim().toLowerCase();
  const id = assignment.dealerGroupId?.trim().toLowerCase();
  if (!type || type === 'all_dealers' || type === 'standard') return true;
  const expectedKind = dealerCatalogViewKindFromLegacyType(type);
  if (catalogView.kind && expectedKind !== catalogView.kind) return false;
  if (id && (catalogView.resolverKey ?? '').trim().toLowerCase() !== id) return false;
  return true;
}

function buildProductWhere(input: ListProductsRequest) {
  const where: any = {};
  if (input.search?.trim()) {
    const contains = input.search.trim();
    where.OR = [
      { sku: { contains, mode: 'insensitive' } },
      { productName: { contains, mode: 'insensitive' } },
      { acumaticaInventoryId: { contains, mode: 'insensitive' } },
      { presentations: { some: { displayName: { contains, mode: 'insensitive' } } } },
    ];
  }
  if (input.categoryId) where.categoryId = input.categoryId;
  if (input.familyId) where.familyId = input.familyId;
  if (input.sourceSystem) where.sourceSystem = toProductSourceSystem(input.sourceSystem);
  if (input.publishStatus) where.presentations = { some: { publishStatus: toProductPublishStatus(input.publishStatus) } };
  if (input.regionScope) where.presentations = { some: { ...(where.presentations?.some ?? {}), regionScope: input.regionScope } };
  if (input.brandLabel) where.presentations = { some: { ...(where.presentations?.some ?? {}), brandLabel: input.brandLabel } };
  return where;
}

function mapProductDetail(product: any): ProductDetail {
  const presentations = product.presentations.map(mapPresentation);
  const assetAssignments = product.presentations.flatMap((presentation: any) => presentation.assetAssignments.map(mapProductAssetLink));
  return {
    ...mapBaseProduct(product),
    presentations,
    inclusions: product.presentations.flatMap((presentation: any) => presentation.inclusions.map(mapCatalogInclusion)),
    readinessChecks: product.presentations.flatMap((presentation: any) => presentation.readinessChecks.map((check: any) => ({
      id: check.id,
      presentationId: check.presentationId,
      checkCode: check.checkCode,
      checkName: check.checkName,
      status: lower(check.status),
      message: check.message ?? undefined,
      createdAt: check.createdAt.toISOString(),
    }))),
    assetAssignments,
    assignedAssetsByRole: groupAssetsByRole(assetAssignments),
  };
}

function mapCatalogInclusion(inclusion: any): CatalogInclusionSummary {
  return compact({
    id: inclusion.id,
    presentationId: inclusion.presentationId,
    dealerCatalogViewId: inclusion.dealerCatalogViewId ?? undefined,
    dealerCatalogView: inclusion.dealerCatalogView ? mapDealerCatalogView(inclusion.dealerCatalogView) : undefined,
    dealerGroupType: inclusion.dealerGroupType,
    dealerGroupId: inclusion.dealerGroupId ?? undefined,
    regionScope: inclusion.regionScope ?? undefined,
    brandLabel: inclusion.brandLabel ?? undefined,
    isVisible: inclusion.isVisible,
    publishStatus: lower(inclusion.publishStatus),
    effectiveFrom: inclusion.effectiveFrom?.toISOString(),
    effectiveTo: inclusion.effectiveTo?.toISOString(),
    notes: inclusion.notes ?? undefined,
  }) as CatalogInclusionSummary;
}

function mapDealerCatalogView(catalogView: any): DealerCatalogViewSummary {
  return {
    id: catalogView.id,
    code: catalogView.code,
    name: catalogView.name,
    kind: lower(catalogView.kind),
    resolverKey: catalogView.resolverKey ?? undefined,
    resolverLabel: catalogView.resolverLabel ?? undefined,
    regionScope: catalogView.regionScope ?? undefined,
    brandLabel: catalogView.brandLabel ?? undefined,
    description: catalogView.description ?? undefined,
    isDefault: catalogView.isDefault,
    isActive: catalogView.isActive,
    precedence: catalogView.precedence,
    sourceSystem: lower(catalogView.sourceSystem),
    sourceOfTruthSystem: lower(catalogView.sourceOfTruthSystem),
    activeSnapshot: catalogView.catalogSnapshots?.[0] ? mapDealerCatalogSnapshot(catalogView.catalogSnapshots[0]) : undefined,
    createdAt: catalogView.createdAt.toISOString(),
    updatedAt: catalogView.updatedAt.toISOString(),
  };
}

function mapDealerCatalogSnapshot(snapshot: any, options: { includeItems?: boolean } = {}): DealerCatalogSnapshotSummary {
  return compact({
    id: snapshot.id,
    dealerCatalogViewId: snapshot.dealerCatalogViewId,
    version: snapshot.version,
    status: lower(snapshot.status),
    isActive: snapshot.isActive,
    productCount: snapshot.productCount,
    fileCount: snapshot.fileCount,
    publishedByUserId: snapshot.publishedByUserId ?? undefined,
    publishedAt: snapshot.publishedAt.toISOString(),
    rollbackOfSnapshotId: snapshot.rollbackOfSnapshotId ?? undefined,
    notes: snapshot.notes ?? undefined,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
    items: options.includeItems ? (snapshot.items ?? []).map((item: any) => {
      const assets = Array.isArray(item.assetVersionPayload) ? item.assetVersionPayload : [];
      return {
        id: item.id,
        presentationId: item.presentationId,
        baseProductId: item.baseProductId,
        sku: item.sku,
        displayName: item.displayName,
        assetCount: item.assetCount,
        assets,
      };
    }) : undefined,
  }) as DealerCatalogSnapshotSummary;
}

function mapSnapshotCompareItem(
  current?: Awaited<ReturnType<typeof buildCatalogSnapshotItems>>[number],
  published?: { presentationId: string; sku: string; displayName: string; assetCount: number; assetVersionPayload?: unknown },
  changes: string[] = [],
) {
  return {
    presentationId: current?.presentationId ?? published?.presentationId ?? '',
    sku: current?.sku ?? published?.sku ?? '',
    displayName: current?.displayName ?? published?.displayName ?? '',
    publishedSku: published?.sku,
    publishedDisplayName: published?.displayName,
    currentFileCount: current?.assetCount ?? 0,
    publishedFileCount: published?.assetCount ?? 0,
    changes,
  };
}

function listSnapshotItemChanges(
  current: Awaited<ReturnType<typeof buildCatalogSnapshotItems>>[number],
  published: { sku: string; displayName: string; assetCount: number; assetVersionPayload?: unknown },
) {
  const changes: string[] = [];
  if (current.sku !== published.sku) changes.push('SKU changed');
  if (current.displayName !== published.displayName) changes.push('Display name changed');
  if (current.assetCount !== published.assetCount) changes.push('File count changed');
  const currentAssetIds = new Set((Array.isArray(current.assetVersionPayload) ? current.assetVersionPayload : []).map((asset: any) => asset.assetId).filter(Boolean));
  const publishedAssetIds = new Set((Array.isArray(published.assetVersionPayload) ? published.assetVersionPayload : []).map((asset: any) => asset.assetId).filter(Boolean));
  if (currentAssetIds.size !== publishedAssetIds.size || [...currentAssetIds].some((assetId) => !publishedAssetIds.has(assetId))) {
    changes.push('Dealer-safe files changed');
  }
  return changes;
}

function mapCatalogRuleSet(ruleSet: any): CatalogRuleSetSummary {
  return {
    id: ruleSet.id,
    code: ruleSet.code,
    name: ruleSet.name,
    description: ruleSet.description ?? undefined,
    status: lower(ruleSet.status),
    isActive: ruleSet.isActive,
    version: ruleSet.version,
    activatedAt: ruleSet.activatedAt?.toISOString(),
    retiredAt: ruleSet.retiredAt?.toISOString(),
    createdAt: ruleSet.createdAt.toISOString(),
    updatedAt: ruleSet.updatedAt.toISOString(),
    rules: (ruleSet.rules ?? []).map(mapCatalogRule),
  };
}

function mapCatalogRule(rule: any) {
  return {
    id: rule.id,
    ruleSetId: rule.ruleSetId,
    name: rule.name,
    description: rule.description ?? undefined,
    priority: rule.priority,
    conditions: normalizeConditionArray(rule.conditions),
    resultAction: lower(rule.resultAction),
    dealerCatalogViewId: rule.dealerCatalogViewId ?? undefined,
    dealerCatalogView: rule.dealerCatalogView ? mapDealerCatalogView(rule.dealerCatalogView) : undefined,
    requireReviewReason: rule.requireReviewReason ?? undefined,
    isEnabled: rule.isEnabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

function mapProductAssetLink(assignment: any): ProductAssetLinkSummary {
  const asset = assignment.asset;
  return {
    id: assignment.id,
    presentationId: assignment.presentationId,
    assetId: assignment.assetId,
    assetVersionId: assignment.assetVersionId ?? undefined,
    role: lower(assignment.role),
    title: asset.title,
    stableSlug: asset.stableSlug,
    kind: lower(asset.kind),
    status: lower(asset.status),
    visibility: lower(asset.visibility),
    reviewStatus: lower(asset.reviewStatus),
    brandScope: asset.brandScope ?? undefined,
    regionScope: asset.regionScope ?? undefined,
    legacyUrl: asset.legacyUrl ?? assignment.assetVersion?.externalUrl ?? undefined,
    sortOrder: assignment.sortOrder,
    isRequired: assignment.isRequired,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}

function mapBaseProduct(product: any): BaseProductSummary {
  return compact({
    id: product.id,
    sku: product.sku,
    acumaticaInventoryId: product.acumaticaInventoryId ?? undefined,
    acumaticaItemClass: product.acumaticaItemClass ?? undefined,
    uom: product.uom ?? undefined,
    itemStatus: product.itemStatus ?? undefined,
    productName: product.productName,
    lifecycleStatus: lower(product.lifecycleStatus),
    sourceSystem: lower(product.sourceSystem),
    sourceOfTruthSystem: lower(product.sourceOfTruthSystem),
    category: product.category ? mapCategory(product.category) : undefined,
    family: product.family ? mapFamily(product.family) : undefined,
    isSellable: product.isSellable,
    isDealerVisible: product.isDealerVisible,
    acumaticaLastSyncedAt: product.acumaticaLastSyncedAt?.toISOString(),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  }) as BaseProductSummary;
}

function mapFamily(family: any): ProductFamilySummary {
  return {
    id: family.id,
    code: family.code,
    name: family.name,
    description: family.description ?? undefined,
    isActive: family.isActive,
    sortOrder: family.sortOrder,
  };
}

function mapCategory(category: any): ProductCategorySummary {
  return {
    id: category.id,
    code: category.code,
    name: category.name,
    parentId: category.parentId ?? undefined,
    description: category.description ?? undefined,
    categoryType: category.categoryType ?? undefined,
    regionScope: category.regionScope ?? undefined,
    isActive: category.isActive,
    sortOrder: category.sortOrder,
  };
}

function mapPresentation(presentation: any): ProductPresentationSummary {
  return {
    id: presentation.id,
    baseProductId: presentation.baseProductId,
    displayName: presentation.displayName,
    shortDescription: presentation.shortDescription ?? undefined,
    longDescription: presentation.longDescription ?? undefined,
    specSummary: presentation.specSummary ?? undefined,
    regionScope: presentation.regionScope ?? undefined,
    brandLabel: presentation.brandLabel ?? undefined,
    businessSegment: lower(presentation.businessSegment),
    publishStatus: lower(presentation.publishStatus),
    readyForDealerPortal: presentation.readyForDealerPortal,
    approvedAt: presentation.approvedAt?.toISOString(),
    publishedAt: presentation.publishedAt?.toISOString(),
    createdAt: presentation.createdAt.toISOString(),
    updatedAt: presentation.updatedAt.toISOString(),
  };
}

function buildCheck(status: 'PASS' | 'WARNING' | 'BLOCKED', checkCode: string, checkName: string, message: string) {
  return { status, checkCode, checkName, message };
}

function buildAssetReadinessCheck(
  assignments: Array<{ role: ProductAssetRole; asset: { kind: DigitalAssetKind; status: DigitalAssetStatus; visibility: DigitalAssetVisibility; reviewStatus: DigitalAssetReviewStatus } }>,
  role: ProductAssetRole,
  expectedKinds: DigitalAssetKind[],
  missingStatus: 'WARNING' | 'BLOCKED',
  checkName: string,
  missingMessage: string,
) {
  const roleAssignments = assignments.filter((assignment) => assignment.role === role);
  const checkCode = lower(role);
  if (!roleAssignments.length) {
    return buildCheck(missingStatus, checkCode, checkName, missingMessage);
  }
  const matchingAssignment = roleAssignments.find((assignment) => {
    const asset = assignment.asset;
    return expectedKinds.includes(asset.kind)
      && asset.status === DigitalAssetStatus.ACTIVE
      && (asset.visibility === DigitalAssetVisibility.DEALER_PORTAL || asset.visibility === DigitalAssetVisibility.PUBLIC)
      && (asset.reviewStatus === DigitalAssetReviewStatus.APPROVED || asset.reviewStatus === DigitalAssetReviewStatus.NOT_REQUIRED);
  });
  return matchingAssignment
    ? buildCheck('PASS', checkCode, checkName, `${checkName} is ready.`)
    : buildCheck('BLOCKED', checkCode, checkName, `Assigned ${lower(role).replace(/_/g, ' ')} must use an expected asset kind and be active, approved, and dealer-visible.`);
}

function groupAssetsByRole(assignments: ProductAssetLinkSummary[]) {
  const grouped = PRODUCT_ASSET_ROLES.reduce(
    (accumulator, role) => ({ ...accumulator, [role]: [] }),
    {} as Record<ProductAssetLinkSummary['role'], ProductAssetLinkSummary[]>,
  );
  for (const assignment of assignments) {
    grouped[assignment.role].push(assignment);
  }
  return grouped;
}

function hasBrandScopedAssetMismatch(presentation: any) {
  if (!presentation.brandLabel) return false;
  return presentation.assetAssignments.some((assignment: any) => assignment.asset?.brandScope && assignment.asset.brandScope !== presentation.brandLabel);
}

function hasRegionScopedAssetMismatch(presentation: any) {
  if (!presentation.regionScope) return false;
  return presentation.assetAssignments.some((assignment: any) => assignment.asset?.regionScope && assignment.asset.regionScope !== presentation.regionScope);
}

async function normalizeCatalogRuleDrafts(rules: CatalogRuleDraftInput[]) {
  if (rules.length > 50) throw new Error('Catalog rule set cannot contain more than 50 rules');
  const normalized = rules.map((rule, index) => {
    if (!rule.name?.trim()) throw new Error('Every catalog rule needs a name');
    const resultAction = toCatalogRuleResultAction(rule.resultAction);
    const dealerCatalogViewId = cleanNullable(rule.dealerCatalogViewId);
    if (resultAction === CatalogRuleResultAction.ASSIGN_CATALOG_VIEW && !dealerCatalogViewId) {
      throw new Error(`Rule "${rule.name}" needs a Dealer Catalog View`);
    }
    const conditions = normalizeConditionArray(rule.conditions);
    if (!conditions.length) throw new Error(`Rule "${rule.name}" needs at least one condition`);
    return {
      id: rule.id,
      name: rule.name.trim(),
      description: cleanNullable(rule.description),
      priority: Number.isFinite(rule.priority) ? Number(rule.priority) : (index + 1) * 10,
      conditions,
      resultAction,
      dealerCatalogViewId,
      requireReviewReason: cleanNullable(rule.requireReviewReason),
      isEnabled: rule.isEnabled ?? true,
    };
  });
  const catalogViewIds = [...new Set(normalized.map((rule) => rule.dealerCatalogViewId).filter(Boolean))] as string[];
  if (catalogViewIds.length) {
    const existingCount = await prisma.dealerCatalogView.count({ where: { id: { in: catalogViewIds }, isActive: true } });
    if (existingCount !== catalogViewIds.length) throw new Error('Every catalog rule must point to an active Dealer Catalog View');
  }
  return normalized;
}

async function evaluateCatalogRuleSetPreview(
  ruleSet: any,
  input: { rules?: CatalogRuleDraftInput[]; sampleLimit?: number; includeAllAccounts?: boolean } = {},
): Promise<CatalogRulePreviewResponse> {
  const draftRules = (input.rules ? await normalizeCatalogRuleDrafts(input.rules) : ruleSet.rules.map((rule: any) => normalizeStoredCatalogRule(rule))) as Array<ReturnType<typeof normalizeStoredCatalogRule>>;
  const rules = draftRules.filter((rule) => rule.isEnabled).sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name));
  const catalogViewsById = new Map(
    (await prisma.dealerCatalogView.findMany({
      where: { id: { in: [...new Set(rules.map((rule) => rule.dealerCatalogViewId).filter(Boolean))] as string[] } },
    })).map((view) => [view.id, view]),
  );
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    include: {
      affinityGroup: true,
      ownershipGroup: true,
      brandLabel: true,
      territory: { include: { region: true } },
      dealerPortalAccount: true,
      sourceLead: { include: { conversionPreparation: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    ...(input.includeAllAccounts ? {} : { take: clampPreviewLimit(input.sampleLimit) }),
  });
  const rows = accounts.map((account: any) => {
    const matchedRule = rules.find((rule) => catalogRuleMatchesAccount(rule.conditions, account));
    if (!matchedRule) {
      return buildPreviewRow(account, { warning: 'No rule matched. Account will need the default catalog or manual review.' });
    }
    if (matchedRule.resultAction === CatalogRuleResultAction.REQUIRE_REVIEW) {
      return buildPreviewRow(account, {
        matchedRule,
        warning: matchedRule.requireReviewReason ?? 'Needs review before publishing.',
      });
    }
    const dealerCatalogView = matchedRule.dealerCatalogViewId
      ? (ruleSet.rules.find((rule: any) => rule.dealerCatalogViewId === matchedRule.dealerCatalogViewId)?.dealerCatalogView ?? catalogViewsById.get(matchedRule.dealerCatalogViewId))
      : null;
    return buildPreviewRow(account, { matchedRule, dealerCatalogView });
  });
  const reviewRequiredCount = rows.filter((row) => row.resultAction === 'require_review' || Boolean(row.warning)).length;
  const catalogViewImpacts = await buildCatalogViewImpacts(rows);
  return {
    ruleSetId: ruleSet.id,
    sampleAccountCount: rows.length,
    matchedCount: rows.filter((row) => row.matchedRuleId).length,
    reviewRequiredCount,
    unmatchedCount: rows.filter((row) => !row.matchedRuleId).length,
    rows,
    catalogViewImpacts,
    warnings: buildPreviewWarnings(rules, rows),
  };
}

function normalizeStoredCatalogRule(rule: any) {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description ?? null,
    priority: rule.priority,
    conditions: normalizeConditionArray(rule.conditions),
    resultAction: rule.resultAction as CatalogRuleResultAction,
    dealerCatalogViewId: rule.dealerCatalogViewId ?? null,
    requireReviewReason: rule.requireReviewReason ?? null,
    isEnabled: rule.isEnabled,
  };
}

async function buildCatalogViewImpacts(rows: CatalogRulePreviewRow[]): Promise<CatalogRuleCatalogViewImpact[]> {
  const matchedCatalogViews = [...new Map(
    rows.flatMap((row) => row.dealerCatalogViewId && row.dealerCatalogViewName
      ? [[row.dealerCatalogViewId, { id: row.dealerCatalogViewId, name: row.dealerCatalogViewName }] as const]
      : []),
  ).values()];
  if (!matchedCatalogViews.length) return [];
  const impacts = await Promise.all(matchedCatalogViews.map(async (catalogView) => {
    const presentationIds = await prisma.catalogInclusion.findMany({
      where: {
        dealerCatalogViewId: catalogView.id,
        isVisible: true,
      },
      select: { presentationId: true },
      distinct: ['presentationId'],
    });
    const ids = presentationIds.map((item) => item.presentationId);
    const [visibleProductCount, readyProductCount, linkedFileCount] = ids.length ? await Promise.all([
      prisma.productPresentation.count({ where: { id: { in: ids } } }),
      prisma.productPresentation.count({ where: { id: { in: ids }, readyForDealerPortal: true } }),
      prisma.productAssetAssignment.count({ where: { presentationId: { in: ids } } }),
    ]) : [0, 0, 0];
    return {
      dealerCatalogViewId: catalogView.id,
      dealerCatalogViewName: catalogView.name,
      matchedAccountCount: rows.filter((item) => item.dealerCatalogViewId === catalogView.id).length,
      visibleProductCount,
      readyProductCount,
      linkedFileCount,
      missingSetupCount: Math.max(visibleProductCount - readyProductCount, 0),
    };
  }));
  return impacts.sort((left, right) => right.matchedAccountCount - left.matchedAccountCount || left.dealerCatalogViewName.localeCompare(right.dealerCatalogViewName));
}

function normalizeConditionArray(value: unknown): CatalogRuleConditionInput[] {
  if (!Array.isArray(value)) return [];
  return value.map((condition) => {
    const item = condition as Partial<CatalogRuleConditionInput>;
    if (!CATALOG_RULE_CONDITION_FIELDS.includes(item.field as any)) throw new Error('Catalog rule condition has an unsupported field');
    if (!CATALOG_RULE_CONDITION_OPERATORS.includes(item.operator as any)) throw new Error('Catalog rule condition has an unsupported operator');
    if (!['is_any', 'is_empty', 'is_not_empty'].includes(String(item.operator)) && (item.value === undefined || item.value === null || String(item.value).trim() === '')) {
      throw new Error('Catalog rule conditions using "is" or "is not" need a selected value');
    }
    return {
      field: item.field as CatalogRuleConditionInput['field'],
      operator: item.operator as CatalogRuleConditionInput['operator'],
      ...(item.value !== undefined ? { value: item.value } : {}),
    };
  });
}

function catalogRuleMatchesAccount(conditions: CatalogRuleConditionInput[], account: any) {
  return conditions.every((condition) => conditionMatchesAccount(condition, account));
}

function conditionMatchesAccount(condition: CatalogRuleConditionInput, account: any) {
  const actualValue = readAccountConditionValue(condition.field, account);
  if (condition.operator === 'is_empty') return actualValue === undefined || actualValue === null || actualValue === '';
  if (condition.operator === 'is_not_empty') return actualValue !== undefined && actualValue !== null && actualValue !== '';
  if (condition.operator === 'is_any') return true;
  const expected = String(condition.value ?? '').trim().toLowerCase();
  const actual = String(actualValue ?? '').trim().toLowerCase();
  if (condition.operator === 'is_not') return actual !== expected;
  return actual === expected;
}

function readAccountConditionValue(field: CatalogRuleConditionInput['field'], account: any) {
  if (field === 'affinity_group') return account.affinityGroup?.code ?? account.affinityGroup?.name ?? '';
  if (field === 'ownership_group') return account.ownershipGroup?.code ?? account.ownershipGroup?.name ?? '';
  if (field === 'brand_label') return account.brandLabel?.code ?? account.brandLabel?.name ?? '';
  if (field === 'independent') return account.groupClassification === 'INDEPENDENT' || (account.affinityGroupSelection === 'NONE' && account.ownershipGroupSelection === 'NONE');
  if (field === 'region') return account.territory?.region?.code ?? account.territory?.region?.name ?? '';
  if (field === 'portal_eligible') {
    const sourceStatus = account.sourceLead?.conversionPreparation?.portalEligibilityStatus;
    const persistedStatus = account.dealerPortalAccount?.status;
    return sourceStatus === 'READY'
      || sourceStatus === 'PROVISIONED'
      || persistedStatus === 'ACTIVE'
      || persistedStatus === 'READY_TO_PROVISION';
  }
  return '';
}

function buildPreviewRow(
  account: any,
  options: {
    matchedRule?: ReturnType<typeof normalizeStoredCatalogRule>;
    dealerCatalogView?: any;
    warning?: string;
  },
): CatalogRulePreviewRow {
  return compact({
    accountId: account.id,
    accountName: account.displayName,
    classification: account.groupClassification ?? undefined,
    affinityGroup: account.affinityGroup?.name ?? account.affinityGroup?.code ?? undefined,
    ownershipGroup: account.ownershipGroup?.name ?? account.ownershipGroup?.code ?? undefined,
    region: account.territory?.region?.name ?? account.territory?.region?.code ?? undefined,
    portalEligible: readAccountConditionValue('portal_eligible', account),
    matchedRuleId: options.matchedRule?.id ?? (options.matchedRule ? 'draft' : undefined),
    matchedRuleName: options.matchedRule?.name,
    resultAction: options.matchedRule ? lower(options.matchedRule.resultAction) : undefined,
    dealerCatalogViewId: options.dealerCatalogView?.id ?? options.matchedRule?.dealerCatalogViewId ?? undefined,
    dealerCatalogViewName: options.dealerCatalogView?.name ?? undefined,
    ...(options.warning ? { warning: options.warning } : {}),
  }) as CatalogRulePreviewRow;
}

function buildPreviewWarnings(rules: ReturnType<typeof normalizeStoredCatalogRule>[], rows: CatalogRulePreviewResponse['rows']) {
  const warnings: string[] = [];
  if (!rules.length) warnings.push('Add at least one enabled rule before publishing.');
  if (rows.some((row) => !row.matchedRuleId)) warnings.push('Some sampled accounts did not match any rule.');
  if (rows.some((row) => row.resultAction === 'require_review')) warnings.push('Some sampled accounts require review before publish.');
  return warnings;
}

function clampPreviewLimit(limit?: number) {
  return Math.min(Math.max(limit ?? 25, 1), 100);
}

function clampLimit(limit?: number) {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function cleanNullable(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function parseDateOrNull(value: string | null | undefined) {
  const cleaned = cleanNullable(value);
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

async function resolveDealerCatalogViewId(actor: AuthenticatedActor, input: UpsertCatalogInclusionRequest) {
  const explicitId = cleanNullable(input.dealerCatalogViewId);
  if (explicitId) {
    const existing = await prisma.dealerCatalogView.findUnique({ where: { id: explicitId } });
    if (!existing) throw new Error('Dealer catalog view not found');
    return existing.id;
  }
  const kind = dealerCatalogViewKindFromLegacyType(input.dealerGroupType);
  const resolverKey = cleanNullable(input.dealerGroupId);
  const regionScope = cleanNullable(input.regionScope);
  const brandLabel = cleanNullable(input.brandLabel);
  const name = buildDealerCatalogViewName(kind, resolverKey, regionScope, brandLabel);
  const code = buildDealerCatalogViewCode({ kind, resolverKey, regionScope, brandLabel, name });
  const catalogView = await prisma.dealerCatalogView.upsert({
    where: { code },
    create: {
      code,
      name,
      kind,
      resolverKey,
      resolverLabel: resolverKey,
      regionScope,
      brandLabel,
      description: 'Auto-created from product catalog visibility rule. Review and rename if needed.',
      isDefault: kind === DealerCatalogViewKind.STANDARD && !resolverKey && !regionScope && !brandLabel,
      isActive: true,
      precedence: defaultCatalogViewPrecedence(kind),
      sourceSystem: ProductSourceSystem.PULSE,
      sourceOfTruthSystem: ProductSourceSystem.PULSE,
      provenance: {
        createdFrom: 'catalog_inclusion',
        legacyDealerGroupType: input.dealerGroupType ?? 'all_dealers',
      },
      createdByUserId: actor.userId,
    },
    update: {
      resolverLabel: resolverKey,
      regionScope,
      brandLabel,
      isActive: true,
    },
  });
  return catalogView.id;
}

function buildDealerCatalogViewData(
  actorUserId: string,
  code: string,
  kind: DealerCatalogViewKind,
  input: CreateDealerCatalogViewRequest,
) {
  return {
    code,
    name: input.name.trim(),
    kind,
    resolverKey: cleanNullable(input.resolverKey),
    resolverLabel: cleanNullable(input.resolverLabel),
    regionScope: cleanNullable(input.regionScope),
    brandLabel: cleanNullable(input.brandLabel),
    description: cleanNullable(input.description),
    isDefault: input.isDefault ?? false,
    isActive: input.isActive ?? true,
    precedence: input.precedence ?? defaultCatalogViewPrecedence(kind),
    sourceSystem: ProductSourceSystem.PULSE,
    sourceOfTruthSystem: ProductSourceSystem.PULSE,
    provenance: { source: 'manual_catalog_view_governance' },
    createdByUserId: actorUserId,
  };
}

function dealerCatalogViewKindFromLegacyType(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'affinity_group') return DealerCatalogViewKind.AFFINITY;
  if (normalized === 'ownership_group') return DealerCatalogViewKind.OWNERSHIP;
  if (normalized === 'independent') return DealerCatalogViewKind.INDEPENDENT;
  if (normalized === 'region') return DealerCatalogViewKind.REGION;
  if (normalized === 'brand') return DealerCatalogViewKind.BRAND;
  if (normalized === 'private_label') return DealerCatalogViewKind.PRIVATE_LABEL;
  if (normalized === 'account_override') return DealerCatalogViewKind.ACCOUNT_OVERRIDE;
  return DealerCatalogViewKind.STANDARD;
}

function toDealerCatalogViewKind(value: string) {
  return value.toUpperCase() as DealerCatalogViewKind;
}

function buildDealerCatalogViewCode(input: {
  kind: DealerCatalogViewKind;
  resolverKey?: string | null;
  regionScope?: string | null;
  brandLabel?: string | null;
  name?: string | null;
}) {
  return [
    'catalog',
    lower(input.kind),
    input.resolverKey,
    input.regionScope,
    input.brandLabel,
    input.name && !input.resolverKey && !input.regionScope && !input.brandLabel ? input.name : undefined,
  ]
    .filter(Boolean)
    .map((part) => slugify(String(part)))
    .join('-')
    .slice(0, 140);
}

function buildDealerCatalogViewName(kind: DealerCatalogViewKind, resolverKey: string | null, regionScope: string | null, brandLabel: string | null) {
  if (kind === DealerCatalogViewKind.STANDARD && !resolverKey && !regionScope && !brandLabel) return 'Standard Dealer Catalog';
  const prefix = {
    [DealerCatalogViewKind.STANDARD]: 'Standard',
    [DealerCatalogViewKind.AFFINITY]: 'Affinity',
    [DealerCatalogViewKind.OWNERSHIP]: 'Ownership / PE',
    [DealerCatalogViewKind.INDEPENDENT]: 'Independent',
    [DealerCatalogViewKind.REGION]: 'Regional',
    [DealerCatalogViewKind.BRAND]: 'Brand',
    [DealerCatalogViewKind.PRIVATE_LABEL]: 'Private-label',
    [DealerCatalogViewKind.ACCOUNT_OVERRIDE]: 'Account override',
  }[kind];
  return `${prefix} Catalog${resolverKey ? `: ${resolverKey}` : ''}${regionScope ? ` (${regionScope})` : ''}${brandLabel ? ` - ${brandLabel}` : ''}`;
}

function defaultCatalogViewPrecedence(kind: DealerCatalogViewKind) {
  if (kind === DealerCatalogViewKind.ACCOUNT_OVERRIDE) return 10;
  if (kind === DealerCatalogViewKind.PRIVATE_LABEL) return 20;
  if (kind === DealerCatalogViewKind.BRAND) return 30;
  if (kind === DealerCatalogViewKind.OWNERSHIP) return 40;
  if (kind === DealerCatalogViewKind.AFFINITY) return 50;
  if (kind === DealerCatalogViewKind.REGION) return 70;
  if (kind === DealerCatalogViewKind.INDEPENDENT) return 80;
  return 100;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)) as T;
}

function lower<T extends string>(value: T) {
  return value.toLowerCase() as any;
}

function toProductPublishStatus(value: string) {
  return value.toUpperCase() as ProductPublishStatus;
}

function toProductSourceSystem(value: string) {
  return value.toUpperCase() as ProductSourceSystem;
}

function toReadinessStatus(value: string) {
  return value.toUpperCase() as ProductReadinessStatus;
}

function toCatalogRuleResultAction(value: string) {
  if (!CATALOG_RULE_RESULT_ACTIONS.includes(value as any)) throw new Error('Catalog rule result action is not supported');
  return value.toUpperCase() as CatalogRuleResultAction;
}

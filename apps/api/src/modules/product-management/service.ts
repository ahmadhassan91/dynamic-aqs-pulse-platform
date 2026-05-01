import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
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
import type {
  BaseProductSummary,
  CatalogInclusionSummary,
  CreateProductCategoryRequest,
  CreateProductFamilyRequest,
  ListProductsRequest,
  ListProductsResponse,
  ProductCategorySummary,
  ProductDetail,
  ProductAssetLinkSummary,
  ProductFamilySummary,
  ProductPresentationSummary,
  ProductPublishValidationResponse,
  UpdateProductCategoryRequest,
  UpdateProductFamilyRequest,
  UpdateProductPresentationRequest,
  UpsertCatalogInclusionRequest,
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
      inclusions: true,
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

export async function listProducts(actor: AuthenticatedActor, input: ListProductsRequest = {}): Promise<ListProductsResponse> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.view');
  const where = buildProductWhere(input);
  const [items, total] = await Promise.all([
    prisma.baseProduct.findMany({
      where,
      include: { category: true, family: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: clampLimit(input.limit),
    }),
    prisma.baseProduct.count({ where }),
  ]);
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
  const inclusion = await prisma.catalogInclusion.create({
    data: {
      presentationId: input.presentationId,
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
  const updated = await prisma.catalogInclusion.update({
    where: { id: inclusionId },
    data: {
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
  return {
    id: inclusion.id,
    presentationId: inclusion.presentationId,
    dealerGroupType: inclusion.dealerGroupType,
    dealerGroupId: inclusion.dealerGroupId ?? undefined,
    regionScope: inclusion.regionScope ?? undefined,
    brandLabel: inclusion.brandLabel ?? undefined,
    isVisible: inclusion.isVisible,
    publishStatus: lower(inclusion.publishStatus),
    effectiveFrom: inclusion.effectiveFrom?.toISOString(),
    effectiveTo: inclusion.effectiveTo?.toISOString(),
    notes: inclusion.notes ?? undefined,
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

import type { BusinessSegmentKey } from './auth.js';
import type { ProductAssetRoleKey } from './digital-assets.js';

export const PRODUCT_LIFECYCLE_STATUSES = ['draft', 'active', 'discontinued', 'archived'] as const;
export type ProductLifecycleStatusKey = (typeof PRODUCT_LIFECYCLE_STATUSES)[number];

export const PRODUCT_PUBLISH_STATUSES = ['draft', 'ready_for_review', 'approved', 'published', 'blocked', 'archived'] as const;
export type ProductPublishStatusKey = (typeof PRODUCT_PUBLISH_STATUSES)[number];

export const PRODUCT_SOURCE_SYSTEMS = ['acumatica', 'pulse', 'shopify', 'widen', 'file_import', 'manual'] as const;
export type ProductSourceSystemKey = (typeof PRODUCT_SOURCE_SYSTEMS)[number];

export const PRODUCT_READINESS_STATUSES = ['pass', 'warning', 'blocked'] as const;
export type ProductReadinessStatusKey = (typeof PRODUCT_READINESS_STATUSES)[number];

export const DEALER_CATALOG_VIEW_KINDS = ['standard', 'affinity', 'ownership', 'independent', 'region', 'brand', 'private_label', 'account_override'] as const;
export type DealerCatalogViewKindKey = (typeof DEALER_CATALOG_VIEW_KINDS)[number];

export const CATALOG_RULE_SET_STATUSES = ['draft', 'active', 'retired'] as const;
export type CatalogRuleSetStatusKey = (typeof CATALOG_RULE_SET_STATUSES)[number];

export const CATALOG_RULE_RESULT_ACTIONS = ['assign_catalog_view', 'require_review'] as const;
export type CatalogRuleResultActionKey = (typeof CATALOG_RULE_RESULT_ACTIONS)[number];

export const CATALOG_RULE_CONDITION_FIELDS = ['affinity_group', 'ownership_group', 'independent', 'region', 'brand_label', 'portal_eligible'] as const;
export type CatalogRuleConditionFieldKey = (typeof CATALOG_RULE_CONDITION_FIELDS)[number];

export const CATALOG_RULE_CONDITION_OPERATORS = ['is', 'is_not', 'is_any', 'is_empty', 'is_not_empty'] as const;
export type CatalogRuleConditionOperatorKey = (typeof CATALOG_RULE_CONDITION_OPERATORS)[number];

export interface ProductCategorySummary {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  description?: string;
  categoryType?: string;
  regionScope?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface ProductFamilySummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BaseProductSummary {
  id: string;
  sku: string;
  acumaticaInventoryId?: string;
  acumaticaItemClass?: string;
  uom?: string;
  itemStatus?: string;
  productName: string;
  lifecycleStatus: ProductLifecycleStatusKey;
  sourceSystem: ProductSourceSystemKey;
  sourceOfTruthSystem: ProductSourceSystemKey;
  category?: ProductCategorySummary;
  family?: ProductFamilySummary;
  isSellable: boolean;
  isDealerVisible: boolean;
  acumaticaLastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductPresentationSummary {
  id: string;
  baseProductId: string;
  displayName: string;
  shortDescription?: string;
  longDescription?: string;
  specSummary?: string;
  regionScope?: string;
  brandLabel?: string;
  businessSegment: BusinessSegmentKey;
  publishStatus: ProductPublishStatusKey;
  readyForDealerPortal: boolean;
  approvedAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogInclusionSummary {
  id: string;
  presentationId: string;
  dealerCatalogViewId?: string;
  dealerCatalogView?: DealerCatalogViewSummary;
  dealerGroupType: string;
  dealerGroupId?: string;
  regionScope?: string;
  brandLabel?: string;
  isVisible: boolean;
  publishStatus: ProductPublishStatusKey;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface DealerCatalogViewSummary {
  id: string;
  code: string;
  name: string;
  kind: DealerCatalogViewKindKey;
  resolverKey?: string;
  resolverLabel?: string;
  regionScope?: string;
  brandLabel?: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
  precedence: number;
  sourceSystem: ProductSourceSystemKey;
  sourceOfTruthSystem: ProductSourceSystemKey;
  activeSnapshot?: DealerCatalogSnapshotSummary | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface DealerCatalogSnapshotAssetSummary {
  assignmentId: string;
  assetId: string;
  assetVersionId?: string;
  role: ProductAssetRoleKey;
  title: string;
  stableSlug: string;
  kind: string;
  fileName?: string;
}

export interface DealerCatalogSnapshotItemSummary {
  id: string;
  presentationId: string;
  baseProductId: string;
  sku: string;
  displayName: string;
  assetCount: number;
  assets: DealerCatalogSnapshotAssetSummary[];
}

export interface DealerCatalogSnapshotSummary {
  id: string;
  dealerCatalogViewId: string;
  version: number;
  status: 'active' | 'archived';
  isActive: boolean;
  productCount: number;
  fileCount: number;
  publishedByUserId?: string;
  publishedAt: string;
  rollbackOfSnapshotId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items?: DealerCatalogSnapshotItemSummary[];
}

export interface CreateDealerCatalogSnapshotRequest {
  notes?: string | null;
}

export interface RollbackDealerCatalogSnapshotRequest {
  notes?: string | null;
}

export interface CatalogRuleConditionInput {
  field: CatalogRuleConditionFieldKey;
  operator: CatalogRuleConditionOperatorKey;
  value?: string | boolean | null;
}

export interface CatalogRuleDraftInput {
  id?: string;
  name: string;
  description?: string | null;
  priority?: number;
  conditions: CatalogRuleConditionInput[];
  resultAction: CatalogRuleResultActionKey;
  dealerCatalogViewId?: string | null;
  requireReviewReason?: string | null;
  isEnabled?: boolean;
}

export interface CatalogRuleSummary {
  id: string;
  ruleSetId: string;
  name: string;
  description?: string;
  priority: number;
  conditions: CatalogRuleConditionInput[];
  resultAction: CatalogRuleResultActionKey;
  dealerCatalogViewId?: string;
  dealerCatalogView?: DealerCatalogViewSummary;
  requireReviewReason?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogRuleSetSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: CatalogRuleSetStatusKey;
  isActive: boolean;
  version: number;
  activatedAt?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
  rules: CatalogRuleSummary[];
}

export interface CreateCatalogRuleSetRequest {
  code?: string;
  name: string;
  description?: string | null;
  rules?: CatalogRuleDraftInput[];
}

export interface UpdateCatalogRuleSetRequest {
  code?: string;
  name?: string;
  description?: string | null;
  rules?: CatalogRuleDraftInput[];
}

export interface CatalogRulePreviewRequest {
  rules?: CatalogRuleDraftInput[];
  sampleLimit?: number;
}

export interface CatalogRulePreviewRow {
  accountId: string;
  accountName: string;
  classification?: string;
  affinityGroup?: string;
  ownershipGroup?: string;
  region?: string;
  portalEligible: boolean;
  matchedRuleId?: string;
  matchedRuleName?: string;
  resultAction?: CatalogRuleResultActionKey;
  dealerCatalogViewId?: string;
  dealerCatalogViewName?: string;
  warning?: string;
}

export interface CatalogRuleCatalogViewImpact {
  dealerCatalogViewId: string;
  dealerCatalogViewName: string;
  matchedAccountCount: number;
  visibleProductCount: number;
  readyProductCount: number;
  linkedFileCount: number;
  missingSetupCount: number;
}

export interface CatalogRulePreviewResponse {
  ruleSetId?: string;
  sampleAccountCount: number;
  matchedCount: number;
  reviewRequiredCount: number;
  unmatchedCount: number;
  rows: CatalogRulePreviewRow[];
  catalogViewImpacts: CatalogRuleCatalogViewImpact[];
  warnings: string[];
}

export interface ActivateCatalogRuleSetResponse {
  activeRuleSet: CatalogRuleSetSummary;
  retiredRuleSetIds: string[];
}

export interface ProductReadinessCheckSummary {
  id: string;
  presentationId: string;
  checkCode: string;
  checkName: string;
  status: ProductReadinessStatusKey;
  message?: string;
  createdAt: string;
}

export interface ProductAssetLinkSummary {
  id: string;
  presentationId: string;
  assetId: string;
  assetVersionId?: string;
  role: ProductAssetRoleKey;
  title: string;
  stableSlug: string;
  kind: string;
  status: string;
  visibility: string;
  reviewStatus: string;
  brandScope?: string;
  regionScope?: string;
  legacyUrl?: string;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductDetail extends BaseProductSummary {
  presentations: ProductPresentationSummary[];
  inclusions: CatalogInclusionSummary[];
  readinessChecks: ProductReadinessCheckSummary[];
  assetAssignments: ProductAssetLinkSummary[];
  assignedAssetsByRole: Partial<Record<ProductAssetRoleKey, ProductAssetLinkSummary[]>>;
}

export interface ListProductsRequest {
  search?: string;
  categoryId?: string;
  familyId?: string;
  publishStatus?: ProductPublishStatusKey;
  regionScope?: string;
  brandLabel?: string;
  sourceSystem?: ProductSourceSystemKey;
  limit?: number;
}

export interface ListProductsResponse {
  items: BaseProductSummary[];
  total: number;
}

export interface CreateProductCategoryRequest {
  code: string;
  name: string;
  parentId?: string | null;
  description?: string | null;
  categoryType?: string | null;
  regionScope?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateProductCategoryRequest {
  code?: string;
  name?: string;
  parentId?: string | null;
  description?: string | null;
  categoryType?: string | null;
  regionScope?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateProductFamilyRequest {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateProductFamilyRequest {
  code?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateProductPresentationRequest {
  displayName?: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  specSummary?: string | null;
  regionScope?: string | null;
  brandLabel?: string | null;
  publishStatus?: ProductPublishStatusKey;
}

export interface UpsertCatalogInclusionRequest {
  presentationId?: string;
  dealerCatalogViewId?: string | null;
  dealerGroupType?: string;
  dealerGroupId?: string | null;
  regionScope?: string | null;
  brandLabel?: string | null;
  isVisible?: boolean;
  publishStatus?: ProductPublishStatusKey;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  notes?: string | null;
}

export interface ListDealerCatalogViewsRequest {
  kind?: DealerCatalogViewKindKey;
  isActive?: boolean;
  search?: string;
}

export interface CreateDealerCatalogViewRequest {
  code?: string;
  name: string;
  kind: DealerCatalogViewKindKey;
  resolverKey?: string | null;
  resolverLabel?: string | null;
  regionScope?: string | null;
  brandLabel?: string | null;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  precedence?: number;
}

export interface UpdateDealerCatalogViewRequest {
  code?: string;
  name?: string;
  kind?: DealerCatalogViewKindKey;
  resolverKey?: string | null;
  resolverLabel?: string | null;
  regionScope?: string | null;
  brandLabel?: string | null;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
  precedence?: number;
}

export interface ProductPublishValidationResponse {
  presentationId: string;
  status: ProductReadinessStatusKey;
  checks: ProductReadinessCheckSummary[];
}

export const PRODUCT_REFERENCE_IMPORT_SOURCES = ['meetings_curated_csv'] as const;
export type ProductReferenceImportSourceKey = (typeof PRODUCT_REFERENCE_IMPORT_SOURCES)[number];

export interface ProductReferenceImportPreviewRequest {
  source?: ProductReferenceImportSourceKey;
  limit?: number;
}

export interface ProductReferenceImportSummary {
  source: ProductReferenceImportSourceKey;
  acumaticaRows: number;
  shopifyRows: number;
  uniqueSkus: number;
  candidateCategories: number;
  imageAssets: number;
  skippedRows: number;
  warnings: string[];
}

export interface ProductReferenceImportPreviewResponse extends ProductReferenceImportSummary {
  sampleProducts: Array<{
    sku: string;
    name: string;
    sourceSystems: ProductSourceSystemKey[];
    categoryName?: string;
    regionScope?: string;
    imageUrl?: string;
  }>;
}

export interface CommitProductReferenceImportRequest extends ProductReferenceImportPreviewRequest {
  dryRun?: boolean;
}

export interface CommitProductReferenceImportResponse extends ProductReferenceImportSummary {
  dryRun: boolean;
  productsCreated: number;
  productsUpdated: number;
  presentationsCreated: number;
  presentationsUpdated: number;
  categoriesUpserted: number;
  imageAssetsUpserted: number;
  assetAssignmentsUpserted: number;
}

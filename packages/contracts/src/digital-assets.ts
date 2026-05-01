export const DIGITAL_ASSET_KINDS = ['image', 'document', 'video', 'logo', 'presentation', 'other'] as const;
export type DigitalAssetKindKey = (typeof DIGITAL_ASSET_KINDS)[number];

export const DIGITAL_ASSET_STATUSES = ['draft', 'active', 'needs_review', 'archived', 'expired'] as const;
export type DigitalAssetStatusKey = (typeof DIGITAL_ASSET_STATUSES)[number];

export const DIGITAL_ASSET_VISIBILITIES = ['internal_only', 'dealer_portal', 'public'] as const;
export type DigitalAssetVisibilityKey = (typeof DIGITAL_ASSET_VISIBILITIES)[number];

export const DIGITAL_ASSET_REVIEW_STATUSES = ['not_required', 'pending_review', 'approved', 'rejected'] as const;
export type DigitalAssetReviewStatusKey = (typeof DIGITAL_ASSET_REVIEW_STATUSES)[number];

export const DIGITAL_ASSET_SOURCE_SYSTEMS = ['acumatica', 'pulse', 'shopify', 'widen', 'file_import', 'manual'] as const;
export type DigitalAssetSourceSystemKey = (typeof DIGITAL_ASSET_SOURCE_SYSTEMS)[number];

export const PRODUCT_ASSET_ROLES = [
  'primary_image',
  'gallery_image',
  'spec_sheet',
  'install_guide',
  'brochure',
  'safety_data',
  'video',
  'training',
  'other',
] as const;
export type ProductAssetRoleKey = (typeof PRODUCT_ASSET_ROLES)[number];

export interface DigitalAssetVersionSummary {
  id: string;
  assetId: string;
  versionNumber: number;
  storageKey?: string;
  externalUrl?: string;
  publicUrl?: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  sha256?: string;
  sourceVersionId?: string;
  sourceDownloadUrl?: string;
  legacyRenditionName?: string;
  legacyMetadata?: Record<string, unknown>;
  rawSourcePayload?: Record<string, unknown>;
  isCurrent: boolean;
  createdAt: string;
}

export interface DigitalAssetSummary {
  id: string;
  stableSlug: string;
  title: string;
  description?: string;
  kind: DigitalAssetKindKey;
  status: DigitalAssetStatusKey;
  visibility: DigitalAssetVisibilityKey;
  reviewStatus: DigitalAssetReviewStatusKey;
  sourceSystem: DigitalAssetSourceSystemKey;
  sourceOfTruthSystem: DigitalAssetSourceSystemKey;
  audience: string;
  brandScope?: string;
  regionScope?: string;
  dealerGroupType?: string;
  dealerGroupId?: string;
  widenAssetId?: string;
  legacyUrl?: string;
  legacyFileName?: string;
  legacyFolderPath?: string;
  legacyCreatedAt?: string;
  legacyUpdatedAt?: string;
  legacyPublishedAt?: string;
  migratedAt?: string;
  migrationBatchId?: string;
  legacyMetadata?: Record<string, unknown>;
  rawSourcePayload?: Record<string, unknown>;
  currentVersionId?: string;
  currentVersion?: DigitalAssetVersionSummary;
  versionCount: number;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalAssetDetail extends DigitalAssetSummary {
  versions: DigitalAssetVersionSummary[];
  legacyMetadataFields?: DigitalAssetLegacyMetadataSummary[];
  migrationIssues?: DigitalAssetMigrationIssueSummary[];
}

export interface DigitalAssetMigrationBatchSummary {
  id: string;
  sourceSystem: DigitalAssetSourceSystemKey;
  batchCode: string;
  sourceExportName?: string;
  sourceExportedAt?: string;
  status: string;
  sourceRecordCount: number;
  createdAssetCount: number;
  updatedAssetCount: number;
  skippedRecordCount: number;
  errorCount: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalAssetLegacyMetadataSummary {
  id: string;
  assetId: string;
  sourceSystem: DigitalAssetSourceSystemKey;
  fieldKey: string;
  fieldLabel?: string;
  fieldValue?: string;
  fieldValueJson?: unknown;
  valueType?: string;
  isSearchable: boolean;
}

export interface DigitalAssetMigrationIssueSummary {
  id: string;
  batchId?: string;
  assetId?: string;
  sourceSystem: DigitalAssetSourceSystemKey;
  externalAssetId?: string;
  severity: string;
  issueCode: string;
  message: string;
  sourceRowNumber?: number;
  resolvedAt?: string;
  createdAt: string;
}

export interface ProductAssetAssignmentSummary {
  id: string;
  presentationId: string;
  assetId: string;
  assetVersionId?: string;
  role: ProductAssetRoleKey;
  dealerGroupType?: string;
  dealerGroupId?: string;
  brandLabel?: string;
  regionScope?: string;
  sortOrder: number;
  isRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalAssetCollectionSummary {
  id: string;
  code: string;
  name: string;
  description?: string;
  visibility: DigitalAssetVisibilityKey;
  brandScope?: string;
  regionScope?: string;
  dealerGroupType?: string;
  dealerGroupId?: string;
  isActive: boolean;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DigitalAssetCollectionItemSummary {
  id: string;
  collectionId: string;
  assetId: string;
  sortOrder: number;
  asset?: DigitalAssetSummary;
  createdAt: string;
}

export interface ListDigitalAssetCollectionsResponse {
  items: DigitalAssetCollectionSummary[];
  total: number;
}

export interface CreateDigitalAssetCollectionRequest {
  code: string;
  name: string;
  description?: string | null;
  visibility?: DigitalAssetVisibilityKey;
  brandScope?: string | null;
  regionScope?: string | null;
  dealerGroupType?: string | null;
  dealerGroupId?: string | null;
  isActive?: boolean;
}

export interface UpdateDigitalAssetCollectionRequest {
  code?: string;
  name?: string;
  description?: string | null;
  visibility?: DigitalAssetVisibilityKey;
  brandScope?: string | null;
  regionScope?: string | null;
  dealerGroupType?: string | null;
  dealerGroupId?: string | null;
  isActive?: boolean;
}

export interface UpsertDigitalAssetCollectionItemRequest {
  assetId: string;
  sortOrder?: number;
}

export interface ListDigitalAssetsRequest {
  search?: string;
  kind?: DigitalAssetKindKey;
  status?: DigitalAssetStatusKey;
  visibility?: DigitalAssetVisibilityKey;
  brandScope?: string;
  regionScope?: string;
  dealerGroupId?: string;
  sourceSystem?: DigitalAssetSourceSystemKey;
  limit?: number;
}

export interface ListDigitalAssetsResponse {
  items: DigitalAssetSummary[];
  total: number;
}

export interface CreateDigitalAssetRequest {
  stableSlug?: string | undefined;
  title: string;
  description?: string | null;
  kind: DigitalAssetKindKey;
  visibility?: DigitalAssetVisibilityKey;
  audience?: string;
  brandScope?: string | null;
  regionScope?: string | null;
  dealerGroupType?: string | null;
  dealerGroupId?: string | null;
  sourceSystem?: DigitalAssetSourceSystemKey;
  widenAssetId?: string | null;
  legacyUrl?: string | null;
  legacyFileName?: string | null;
  legacyFolderPath?: string | null;
  legacyCreatedAt?: string | null;
  legacyUpdatedAt?: string | null;
  legacyPublishedAt?: string | null;
  migratedAt?: string | null;
  migrationBatchId?: string | null;
  legacyMetadata?: Record<string, unknown> | null;
  rawSourcePayload?: Record<string, unknown> | null;
  initialVersion?: CreateDigitalAssetVersionRequest | null;
}

export interface CreateDigitalAssetVersionRequest {
  storageKey?: string | null;
  externalUrl?: string | null;
  fileBase64?: string | null;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  sourceVersionId?: string | null;
  sourceDownloadUrl?: string | null;
  ingestSourceDownload?: boolean;
  legacyRenditionName?: string | null;
  legacyMetadata?: Record<string, unknown> | null;
  rawSourcePayload?: Record<string, unknown> | null;
  makeCurrent?: boolean;
}

export interface UpdateDigitalAssetRequest {
  title?: string;
  description?: string | null;
  status?: DigitalAssetStatusKey;
  visibility?: DigitalAssetVisibilityKey;
  reviewStatus?: DigitalAssetReviewStatusKey;
  audience?: string;
  brandScope?: string | null;
  regionScope?: string | null;
  dealerGroupType?: string | null;
  dealerGroupId?: string | null;
}

export interface CreateProductAssetAssignmentRequest {
  presentationId: string;
  assetId: string;
  assetVersionId?: string | null;
  role: ProductAssetRoleKey;
  dealerGroupType?: string | null;
  dealerGroupId?: string | null;
  brandLabel?: string | null;
  regionScope?: string | null;
  sortOrder?: number;
  isRequired?: boolean;
}

export interface WidenManifestRow {
  [key: string]: unknown;
}

export interface WidenManifestImportRequest {
  rows?: WidenManifestRow[];
  manifestPath?: string;
  sourceExportName?: string;
  sourceExportedAt?: string | null;
  batchCode?: string;
  notes?: string | null;
  limit?: number;
  dryRun?: boolean;
}

export interface WidenManifestRowIssue {
  rowNumber: number;
  externalAssetId?: string;
  severity: 'warning' | 'error';
  issueCode: string;
  message: string;
}

export interface WidenManifestRowPreview {
  rowNumber: number;
  externalAssetId?: string;
  title?: string;
  fileName?: string;
  legacyUrl?: string;
  kind: DigitalAssetKindKey;
  status: 'ready' | 'invalid';
  issues: WidenManifestRowIssue[];
}

export interface WidenManifestImportSummary {
  sourceSystem: 'widen';
  sourceExportName?: string;
  sourceRecordCount: number;
  validRowCount: number;
  invalidRowCount: number;
  warningCount: number;
  errorCount: number;
  duplicateExternalAssetCount: number;
}

export interface WidenManifestPreviewResponse extends WidenManifestImportSummary {
  sampleRows: WidenManifestRowPreview[];
  warnings: string[];
}

export interface CommitWidenManifestImportResponse extends WidenManifestImportSummary {
  dryRun: boolean;
  batch: DigitalAssetMigrationBatchSummary | null;
  assetsCreated: number;
  assetsUpdated: number;
  versionsCreated: number;
  aliasesUpserted: number;
  metadataFieldsUpserted: number;
  issuesCreated: number;
  skippedRows: number;
  warnings: string[];
}

export interface ListWidenManifestImportRunsResponse {
  items: DigitalAssetMigrationBatchSummary[];
  total: number;
}

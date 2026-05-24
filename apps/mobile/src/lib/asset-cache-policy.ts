import type { DigitalAssetSummary } from '@pulse/contracts/digital-assets';

export function toDisplaySafeMobileAssetCacheItem(asset: DigitalAssetSummary): DigitalAssetSummary {
  return {
    id: asset.id,
    stableSlug: asset.stableSlug,
    title: asset.title,
    ...(asset.description ? { description: asset.description } : {}),
    kind: asset.kind,
    status: asset.status,
    visibility: asset.visibility,
    reviewStatus: asset.reviewStatus,
    sourceSystem: asset.sourceSystem,
    sourceOfTruthSystem: asset.sourceOfTruthSystem,
    audience: asset.audience,
    ...(asset.brandScope ? { brandScope: asset.brandScope } : {}),
    ...(asset.regionScope ? { regionScope: asset.regionScope } : {}),
    ...(asset.widenAssetId ? { widenAssetId: asset.widenAssetId } : {}),
    ...(asset.legacyFileName ? { legacyFileName: asset.legacyFileName } : {}),
    ...(asset.currentVersionId ? { currentVersionId: asset.currentVersionId } : {}),
    ...(asset.currentVersion ? {
      currentVersion: {
        id: asset.currentVersion.id,
        assetId: asset.currentVersion.assetId,
        versionNumber: asset.currentVersion.versionNumber,
        fileName: asset.currentVersion.fileName,
        ...(asset.currentVersion.mimeType ? { mimeType: asset.currentVersion.mimeType } : {}),
        ...(asset.currentVersion.sizeBytes !== undefined ? { sizeBytes: asset.currentVersion.sizeBytes } : {}),
        isCurrent: asset.currentVersion.isCurrent,
        createdAt: asset.currentVersion.createdAt,
      },
    } : {}),
    versionCount: asset.versionCount,
    ...(asset.productUsageCount !== undefined ? { productUsageCount: asset.productUsageCount } : {}),
    ...(asset.activeShareLinkCount !== undefined ? { activeShareLinkCount: asset.activeShareLinkCount } : {}),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

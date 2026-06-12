import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AuditAction,
  DigitalAssetKind,
  DigitalAssetReviewStatus,
  DigitalAssetStatus,
  DigitalAssetVisibility,
  ProductAssetRole,
  Prisma,
  ProductSourceSystem,
  prisma,
} from '@pulse/db';
import type {
  CommitWidenManifestImportResponse,
  CreateDigitalAssetCollectionRequest,
  CreateDigitalAssetRequest,
  CreateDigitalAssetShareLinkRequest,
  CreateDigitalAssetVersionRequest,
  CreateProductAssetAssignmentRequest,
  DigitalAssetCollectionItemSummary,
  DigitalAssetCollectionSummary,
  DigitalAssetDetail,
  DigitalAssetProductUsageSummary,
  DigitalAssetShareLinkSummary,
  DigitalAssetSummary,
  DigitalAssetVersionSummary,
  ListDigitalAssetCollectionsResponse,
  ListDigitalAssetsRequest,
  ListDigitalAssetsResponse,
  ListWidenManifestImportRunsResponse,
  ProductAssetAssignmentSummary,
  RevokeDigitalAssetShareLinkResponse,
  UpdateDigitalAssetCollectionRequest,
  UpdateDigitalAssetRequest,
  UpsertDigitalAssetCollectionItemRequest,
  WidenManifestImportSummary,
  WidenManifestImportRequest,
  WidenManifestPreviewResponse,
  WidenManifestRowIssue,
  WidenManifestRowPreview,
} from '@pulse/contracts/digital-assets';
import { loadAppConfig } from '@pulse/config';
import { buildAuditEntryData } from '../../utils/audit.js';
import { JSON_SIZE_LIMITS, toBoundedJsonValue } from '../../utils/json.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildPublicAssetUrl, storeDigitalAssetObject } from './storage.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_MANIFEST_LIMIT = 1_000;
const MAX_MANIFEST_LIMIT = 10_000;
const DEFAULT_WIDEN_SOURCE_DOWNLOAD_LIMIT = 25;
const MAX_WIDEN_SOURCE_DOWNLOAD_LIMIT = 200;
const MAX_SOURCE_DOWNLOAD_INGEST_BYTES = 100 * 1024 * 1024;
const DEFAULT_SHARE_EXPIRY_DAYS = 30;
const MAX_SHARE_EXPIRY_DAYS = 365;

export async function listDigitalAssets(actor: AuthenticatedActor, input: ListDigitalAssetsRequest = {}): Promise<ListDigitalAssetsResponse> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.view');
  const where = buildAssetWhere(input);
  const [items, total] = await Promise.all([
    prisma.digitalAsset.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: clampLimit(input.limit),
      include: {
        versions: { where: { isCurrent: true }, orderBy: [{ versionNumber: 'desc' }], take: 1 },
        shareLinks: { orderBy: [{ createdAt: 'desc' }], take: 25 },
        _count: { select: { versions: true, productAssignments: true, shareLinks: true } },
      },
    }),
    prisma.digitalAsset.count({ where }),
  ]);
  return { items: items.map(mapAsset), total };
}

export async function getDigitalAssetDetail(actor: AuthenticatedActor, assetId: string): Promise<DigitalAssetDetail | null> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.view');
  const asset = await prisma.digitalAsset.findUnique({
    where: { id: assetId },
    include: {
      versions: { orderBy: [{ versionNumber: 'desc' }] },
      shareLinks: { orderBy: [{ createdAt: 'desc' }], take: 25 },
      productAssignments: {
        include: {
          presentation: {
            include: {
              baseProduct: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      },
      legacyMetadataFields: { orderBy: [{ fieldKey: 'asc' }, { fieldValue: 'asc' }] },
      migrationIssues: { orderBy: [{ createdAt: 'desc' }], take: 50 },
      _count: { select: { versions: true } },
    },
  });
  return asset ? {
    ...mapAsset(asset),
    versions: asset.versions.map(mapVersion),
    productUsages: asset.productAssignments.map(mapProductUsage),
    shareLinks: asset.shareLinks.map(mapShareLink),
    legacyMetadataFields: asset.legacyMetadataFields.map(mapLegacyMetadata),
    migrationIssues: asset.migrationIssues.map(mapMigrationIssue),
  } : null;
}

export async function createDigitalAsset(actor: AuthenticatedActor, input: CreateDigitalAssetRequest): Promise<DigitalAssetDetail> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.upload');
  if (!input.title?.trim()) throw new Error('title is required');
  const assetId = await prisma.$transaction(async (tx) => {
    const asset = await tx.digitalAsset.create({
      data: {
        stableSlug: input.stableSlug?.trim() || slugify(input.title),
        title: input.title.trim(),
        description: cleanNullable(input.description),
        kind: toAssetKind(input.kind),
        visibility: input.visibility ? toAssetVisibility(input.visibility) : DigitalAssetVisibility.INTERNAL_ONLY,
        audience: input.audience?.trim() || 'internal',
        brandScope: cleanNullable(input.brandScope),
        regionScope: cleanNullable(input.regionScope),
        dealerGroupType: cleanNullable(input.dealerGroupType),
        dealerGroupId: cleanNullable(input.dealerGroupId),
        sourceSystem: input.sourceSystem ? toSourceSystem(input.sourceSystem) : ProductSourceSystem.MANUAL,
        widenAssetId: cleanNullable(input.widenAssetId),
        legacyUrl: cleanNullable(input.legacyUrl),
        legacyFileName: cleanNullable(input.legacyFileName),
        legacyFolderPath: cleanNullable(input.legacyFolderPath),
        legacyCreatedAt: parseDateOrNull(input.legacyCreatedAt),
        legacyUpdatedAt: parseDateOrNull(input.legacyUpdatedAt),
        legacyPublishedAt: parseDateOrNull(input.legacyPublishedAt),
        migratedAt: parseDateOrNull(input.migratedAt),
        migrationBatchId: cleanNullable(input.migrationBatchId),
        ...(input.legacyMetadata ? { legacyMetadata: input.legacyMetadata as Prisma.InputJsonValue } : {}),
        ...(input.rawSourcePayload ? { rawSourcePayload: input.rawSourcePayload as Prisma.InputJsonValue } : {}),
        createdByUserId: actor.userId,
      },
    });
    await tx.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.CREATE, entityType: 'DIGITAL_ASSET', entityId: asset.id, afterData: asset }) });

    if (input.initialVersion) {
      const version = await createDigitalAssetVersionRow(tx, actor.userId, asset.id, 1, input.initialVersion, true);
      await tx.digitalAsset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });
      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: 'DIGITAL_ASSET_VERSION',
          entityId: version.id,
          afterData: version,
          metadata: { assetId: asset.id, versionNumber: version.versionNumber, createdWithAsset: true },
        }),
      });
    }

    return asset.id;
  });
  const detail = await getDigitalAssetDetail(actor, assetId);
  if (!detail) throw new Error('Digital asset not found after create');
  return detail;
}

export async function updateDigitalAsset(actor: AuthenticatedActor, assetId: string, input: UpdateDigitalAssetRequest): Promise<DigitalAssetSummary> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.edit');
  const before = await prisma.digitalAsset.findUnique({ where: { id: assetId } });
  if (!before) throw new Error('Digital asset not found');
  const nextReviewStatus = input.reviewStatus !== undefined ? toReviewStatus(input.reviewStatus) : undefined;
  const reviewData = nextReviewStatus === DigitalAssetReviewStatus.APPROVED
    ? { approvedByUserId: actor.userId, approvedAt: before.approvedAt ?? new Date() }
    : nextReviewStatus !== undefined
      ? { approvedByUserId: null, approvedAt: null }
      : {};
  const updated = await prisma.digitalAsset.update({
    where: { id: assetId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() || before.title } : {}),
      ...(input.description !== undefined ? { description: cleanNullable(input.description) } : {}),
      ...(input.status !== undefined ? { status: toAssetStatus(input.status) } : {}),
      ...(input.visibility !== undefined ? { visibility: toAssetVisibility(input.visibility) } : {}),
      ...(nextReviewStatus !== undefined ? { reviewStatus: nextReviewStatus } : {}),
      ...(input.audience !== undefined ? { audience: input.audience.trim() || before.audience } : {}),
      ...(input.brandScope !== undefined ? { brandScope: cleanNullable(input.brandScope) } : {}),
      ...(input.regionScope !== undefined ? { regionScope: cleanNullable(input.regionScope) } : {}),
      ...(input.dealerGroupType !== undefined ? { dealerGroupType: cleanNullable(input.dealerGroupType) } : {}),
      ...(input.dealerGroupId !== undefined ? { dealerGroupId: cleanNullable(input.dealerGroupId) } : {}),
      ...reviewData,
    },
  });
  await prisma.auditEntry.create({ data: buildAuditEntryData({ actorUserId: actor.userId, action: AuditAction.UPDATE, entityType: 'DIGITAL_ASSET', entityId: assetId, beforeData: before, afterData: updated }) });
  return mapAsset(updated);
}

export async function listDigitalAssetCollections(actor: AuthenticatedActor): Promise<ListDigitalAssetCollectionsResponse> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.view');
  const [items, total] = await Promise.all([
    prisma.digitalAssetCollection.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: { _count: { select: { items: true } } },
    }),
    prisma.digitalAssetCollection.count(),
  ]);
  return { items: items.map(mapCollection), total };
}

export async function createDigitalAssetCollection(actor: AuthenticatedActor, input: CreateDigitalAssetCollectionRequest): Promise<DigitalAssetCollectionSummary> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.edit');
  if (!input.code?.trim()) throw new Error('code is required');
  if (!input.name?.trim()) throw new Error('name is required');
  const collection = await prisma.digitalAssetCollection.create({
    data: {
      code: input.code.trim(),
      name: input.name.trim(),
      description: cleanNullable(input.description),
      visibility: input.visibility ? toAssetVisibility(input.visibility) : DigitalAssetVisibility.INTERNAL_ONLY,
      brandScope: cleanNullable(input.brandScope),
      regionScope: cleanNullable(input.regionScope),
      dealerGroupType: cleanNullable(input.dealerGroupType),
      dealerGroupId: cleanNullable(input.dealerGroupId),
      isActive: input.isActive ?? true,
    },
    include: { _count: { select: { items: true } } },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'DIGITAL_ASSET_COLLECTION',
      entityId: collection.id,
      afterData: collection,
    }),
  });
  return mapCollection(collection);
}

export async function updateDigitalAssetCollection(actor: AuthenticatedActor, collectionId: string, input: UpdateDigitalAssetCollectionRequest): Promise<DigitalAssetCollectionSummary> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.edit');
  const before = await prisma.digitalAssetCollection.findUnique({ where: { id: collectionId } });
  if (!before) throw new Error('Digital asset collection not found');
  const updated = await prisma.digitalAssetCollection.update({
    where: { id: collectionId },
    data: {
      ...(input.code !== undefined ? { code: input.code.trim() || before.code } : {}),
      ...(input.name !== undefined ? { name: input.name.trim() || before.name } : {}),
      ...(input.description !== undefined ? { description: cleanNullable(input.description) } : {}),
      ...(input.visibility !== undefined ? { visibility: toAssetVisibility(input.visibility) } : {}),
      ...(input.brandScope !== undefined ? { brandScope: cleanNullable(input.brandScope) } : {}),
      ...(input.regionScope !== undefined ? { regionScope: cleanNullable(input.regionScope) } : {}),
      ...(input.dealerGroupType !== undefined ? { dealerGroupType: cleanNullable(input.dealerGroupType) } : {}),
      ...(input.dealerGroupId !== undefined ? { dealerGroupId: cleanNullable(input.dealerGroupId) } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { _count: { select: { items: true } } },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'DIGITAL_ASSET_COLLECTION',
      entityId: updated.id,
      beforeData: before,
      afterData: updated,
    }),
  });
  return mapCollection(updated);
}

export async function upsertDigitalAssetCollectionItem(actor: AuthenticatedActor, collectionId: string, input: UpsertDigitalAssetCollectionItemRequest): Promise<DigitalAssetCollectionItemSummary> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.edit');
  const [collection, asset] = await Promise.all([
    prisma.digitalAssetCollection.findUnique({ where: { id: collectionId } }),
    prisma.digitalAsset.findUnique({ where: { id: input.assetId } }),
  ]);
  if (!collection) throw new Error('Digital asset collection not found');
  if (!asset) throw new Error('Digital asset not found');
  const item = await prisma.digitalAssetCollectionItem.upsert({
    where: { collectionId_assetId: { collectionId, assetId: input.assetId } },
    create: { collectionId, assetId: input.assetId, sortOrder: input.sortOrder ?? 100 },
    update: { sortOrder: input.sortOrder ?? 100 },
    include: { asset: { include: { versions: { where: { isCurrent: true }, take: 1 }, _count: { select: { versions: true } } } } },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'DIGITAL_ASSET_COLLECTION',
      entityId: collectionId,
      metadata: { operation: 'collection.item_upsert', assetId: input.assetId },
      afterData: item,
    }),
  });
  return mapCollectionItem(item);
}

export async function removeDigitalAssetCollectionItem(actor: AuthenticatedActor, collectionId: string, assetId: string): Promise<{ collectionId: string; assetId: string; removed: boolean }> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.edit');
  const collection = await prisma.digitalAssetCollection.findUnique({ where: { id: collectionId } });
  if (!collection) throw new Error('Digital asset collection not found');
  const deleted = await prisma.digitalAssetCollectionItem.deleteMany({ where: { collectionId, assetId } });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'DIGITAL_ASSET_COLLECTION',
      entityId: collectionId,
      metadata: { operation: 'collection.item_remove', assetId, removed: deleted.count > 0 },
    }),
  });
  return { collectionId, assetId, removed: deleted.count > 0 };
}

export async function createDigitalAssetVersion(actor: AuthenticatedActor, assetId: string, input: CreateDigitalAssetVersionRequest): Promise<DigitalAssetDetail> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.upload');
  const asset = await prisma.digitalAsset.findUnique({ where: { id: assetId }, select: { id: true } });
  if (!asset) throw new Error('Digital asset not found');
  const nextVersion = ((await prisma.digitalAssetVersion.aggregate({ where: { assetId }, _max: { versionNumber: true } }))._max.versionNumber ?? 0) + 1;
  const preparedInput = await prepareDigitalAssetVersionInput(assetId, nextVersion, input);
  await prisma.$transaction(async (tx) => {
    if (input.makeCurrent !== false) {
      await tx.digitalAssetVersion.updateMany({ where: { assetId }, data: { isCurrent: false } });
    }
    const version = await createDigitalAssetVersionRow(tx, actor.userId, assetId, nextVersion, preparedInput, input.makeCurrent !== false);
    if (input.makeCurrent !== false) {
      await tx.digitalAsset.update({ where: { id: assetId }, data: { currentVersionId: version.id } });
    }
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: 'DIGITAL_ASSET_VERSION',
        entityId: version.id,
        afterData: version,
        metadata: {
          assetId,
          versionNumber: version.versionNumber,
          madeCurrent: input.makeCurrent !== false,
        },
      }),
    });
  });
  const detail = await getDigitalAssetDetail(actor, assetId);
  if (!detail) throw new Error('Digital asset not found after version create');
  return detail;
}

export async function createDigitalAssetShareLink(
  actor: AuthenticatedActor,
  assetId: string,
  input: CreateDigitalAssetShareLinkRequest = {},
): Promise<DigitalAssetShareLinkSummary> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.share');
  const asset = await prisma.digitalAsset.findUnique({
    where: { id: assetId },
    include: { versions: { orderBy: [{ versionNumber: 'desc' }] } },
  });
  if (!asset) throw new Error('Digital asset not found');
  if (asset.status === DigitalAssetStatus.ARCHIVED || asset.status === DigitalAssetStatus.EXPIRED) {
    throw new Error('Archived or expired assets cannot be shared');
  }
  if (asset.visibility === DigitalAssetVisibility.INTERNAL_ONLY) {
    throw new Error('Only dealer portal or public assets can be shared externally');
  }
  if (asset.reviewStatus !== DigitalAssetReviewStatus.APPROVED && asset.reviewStatus !== DigitalAssetReviewStatus.NOT_REQUIRED) {
    throw new Error('Asset must be approved before it can be shared externally');
  }

  const version = resolveShareVersion(asset.versions, input.assetVersionId);
  const targetUrl = mapVersion(version).publicUrl;
  if (!targetUrl) throw new Error('Asset version does not have a shareable URL');
  const token = createShareToken();
  const tokenHash = hashShareToken(token);
  const shareUrl = buildAssetShareUrl(token);
  const expiresAt = resolveShareExpiry(input);
  const shareLink = await prisma.digitalAssetShareLink.create({
    data: {
      assetId: asset.id,
      assetVersionId: version.id,
      tokenHash,
      shareUrl,
      recipientType: cleanNullable(input.recipientType) ?? 'prospect',
      recipientName: cleanNullable(input.recipientName),
      recipientEmail: cleanNullable(input.recipientEmail),
      contextType: cleanNullable(input.contextType),
      contextId: cleanNullable(input.contextId),
      expiresAt,
      note: cleanNullable(input.note),
      createdByUserId: actor.userId,
    },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: 'DIGITAL_ASSET_SHARE_LINK',
      entityId: shareLink.id,
      afterData: shareLink,
      metadata: { assetId: asset.id, assetVersionId: version.id, targetUrl },
    }),
  });
  return mapShareLink({ ...shareLink, assetVersion: version });
}

export async function revokeDigitalAssetShareLink(
  actor: AuthenticatedActor,
  shareLinkId: string,
): Promise<RevokeDigitalAssetShareLinkResponse> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.share');
  const before = await prisma.digitalAssetShareLink.findUnique({ where: { id: shareLinkId } });
  if (!before) throw new Error('Digital asset share link not found');
  const revokedAt = before.revokedAt ?? new Date();
  const updated = await prisma.digitalAssetShareLink.update({
    where: { id: shareLinkId },
    data: { revokedAt },
  });
  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'DIGITAL_ASSET_SHARE_LINK',
      entityId: shareLinkId,
      beforeData: before,
      afterData: updated,
    }),
  });
  return { id: shareLinkId, revoked: true, revokedAt: revokedAt.toISOString() };
}

export async function resolveDigitalAssetShareLink(token: string) {
  const tokenHash = hashShareToken(token);
  const shareLink = await prisma.digitalAssetShareLink.findUnique({
    where: { tokenHash },
    include: {
      asset: true,
      assetVersion: true,
    },
  });
  if (!shareLink) throw new Error('Digital asset share link not found');
  if (shareLink.revokedAt) throw new Error('Digital asset share link has been revoked');
  if (shareLink.expiresAt && shareLink.expiresAt.getTime() < Date.now()) {
    throw new Error('Digital asset share link has expired');
  }
  const version = shareLink.assetVersion
    ?? await prisma.digitalAssetVersion.findFirst({ where: { assetId: shareLink.assetId, isCurrent: true } });
  if (!version) throw new Error('Shared asset version is no longer available');
  const targetUrl = mapVersion(version).publicUrl;
  if (!targetUrl) throw new Error('Shared asset version does not have a public URL');
  await prisma.digitalAssetShareLink.update({
    where: { id: shareLink.id },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  });
  return { targetUrl };
}

async function createDigitalAssetVersionRow(
  tx: any,
  actorUserId: string,
  assetId: string,
  versionNumber: number,
  input: CreateDigitalAssetVersionRequest,
  isCurrent: boolean,
) {
  if (!input.fileName?.trim()) throw new Error('fileName is required');
  if (!input.storageKey?.trim() && !input.externalUrl?.trim() && !input.fileBase64?.trim()) throw new Error('storageKey, externalUrl, or fileBase64 is required');
  return tx.digitalAssetVersion.create({
    data: {
      assetId,
      versionNumber,
      storageKey: cleanNullable(input.storageKey),
      externalUrl: cleanNullable(input.externalUrl),
      fileName: input.fileName.trim(),
      mimeType: cleanNullable(input.mimeType),
      sizeBytes: input.sizeBytes ?? null,
      sha256: cleanNullable(input.sha256),
      sourceVersionId: cleanNullable(input.sourceVersionId),
      sourceDownloadUrl: cleanNullable(input.sourceDownloadUrl),
      legacyRenditionName: cleanNullable(input.legacyRenditionName),
      ...(input.legacyMetadata ? { legacyMetadata: input.legacyMetadata as Prisma.InputJsonValue } : {}),
      ...(input.rawSourcePayload ? { rawSourcePayload: input.rawSourcePayload as Prisma.InputJsonValue } : {}),
      isCurrent,
      createdByUserId: actorUserId,
    },
  });
}

async function prepareDigitalAssetVersionInput(
  assetId: string,
  versionNumber: number,
  input: CreateDigitalAssetVersionRequest,
): Promise<CreateDigitalAssetVersionRequest> {
  const config = loadAppConfig();
  if (input.ingestSourceDownload && !input.fileBase64?.trim()) {
    if (!input.sourceDownloadUrl?.trim()) throw new Error('sourceDownloadUrl is required when ingestSourceDownload is true');
    const downloaded = await downloadSourceAsset(input.sourceDownloadUrl);
    const mimeType = input.mimeType ?? downloaded.mimeType;
    const fileBase64 = downloaded.buffer.toString('base64');
    const stored = await storeDigitalAssetObject(config, {
      assetId,
      versionNumber,
      fileName: input.fileName,
      mimeType,
      fileBase64,
    });

    return {
      ...input,
      storageKey: stored.storageKey,
      externalUrl: null,
      mimeType: mimeType ?? null,
      sizeBytes: stored.sizeBytes,
      sha256: stored.sha256,
      fileBase64: null,
    };
  }

  if (!input.fileBase64?.trim()) {
    return input;
  }

  const stored = await storeDigitalAssetObject(config, {
    assetId,
    versionNumber,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileBase64: input.fileBase64,
  });

  return {
    ...input,
    storageKey: stored.storageKey,
    sizeBytes: stored.sizeBytes,
    sha256: stored.sha256,
    fileBase64: null,
  };
}

async function downloadSourceAsset(sourceDownloadUrl: string) {
  const sourceUrl = new URL(sourceDownloadUrl.trim());
  if (sourceUrl.protocol !== 'https:') {
    throw new Error('sourceDownloadUrl ingestion requires an https URL');
  }
  assertSafeSourceDownloadHost(sourceUrl.hostname);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 60_000);
  try {
    const response = await fetch(sourceUrl, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`sourceDownloadUrl returned HTTP ${response.status}`);
    }
    // A declared Content-Length over the cap is rejected up front, but it is never
    // trusted: a missing/zero header (server-controlled chunked encoding) must NOT mean
    // "unlimited". We stream the body and abort the moment cumulative bytes exceed the cap,
    // so a malicious/misbehaving endpoint cannot OOM the process with an unbounded body.
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_SOURCE_DOWNLOAD_INGEST_BYTES) {
      throw new Error('sourceDownloadUrl payload is too large for asset ingestion');
    }
    const buffer = await readBodyWithCap(response, MAX_SOURCE_DOWNLOAD_INGEST_BYTES, abortController);
    if (!buffer.byteLength) {
      throw new Error('sourceDownloadUrl payload is empty');
    }
    return {
      buffer,
      mimeType: response.headers.get('content-type')?.split(';')[0] ?? undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// Streams a fetch Response body, enforcing a hard byte cap as chunks arrive (never trusts
// Content-Length, never buffers an unbounded body). Aborts the request if the cap is hit.
async function readBodyWithCap(response: Response, maxBytes: number, abortController: AbortController): Promise<Buffer> {
  const body = response.body;
  if (!body) {
    const fallback = Buffer.from(await response.arrayBuffer());
    if (fallback.byteLength > maxBytes) {
      throw new Error('sourceDownloadUrl payload is too large for asset ingestion');
    }
    return fallback;
  }
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.byteLength) {
        total += value.byteLength;
        if (total > maxBytes) {
          try { abortController.abort(); } catch { /* already aborted */ }
          throw new Error('sourceDownloadUrl payload is too large for asset ingestion');
        }
        chunks.push(Buffer.from(value));
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* reader already released */ }
  }
  return Buffer.concat(chunks);
}

function assertSafeSourceDownloadHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    throw new Error('sourceDownloadUrl ingestion cannot target local hosts');
  }
  if (!isIP(normalized)) return;
  if (
    normalized.startsWith('10.')
    || normalized.startsWith('127.')
    || normalized.startsWith('169.254.')
    || normalized.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    || normalized === '::1'
    || normalized.toLowerCase().startsWith('fc')
    || normalized.toLowerCase().startsWith('fd')
  ) {
    throw new Error('sourceDownloadUrl ingestion cannot target private network addresses');
  }
}

export async function assignProductAsset(actor: AuthenticatedActor, input: CreateProductAssetAssignmentRequest): Promise<ProductAssetAssignmentSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.asset_link');
  const assignment = await prisma.$transaction(async (tx) => {
    const assetVersionId = cleanNullable(input.assetVersionId);
    if (assetVersionId) {
      const version = await tx.digitalAssetVersion.findUnique({ where: { id: assetVersionId } });
      if (!version) throw new Error('Digital asset version not found');
      if (version.assetId !== input.assetId) throw new Error('Digital asset version does not belong to the selected asset');
    }
    const existing = await tx.productAssetAssignment.findFirst({
      where: {
        presentationId: input.presentationId,
        assetId: input.assetId,
        role: toAssetRole(input.role),
        dealerGroupType: cleanNullable(input.dealerGroupType),
        dealerGroupId: cleanNullable(input.dealerGroupId),
        brandLabel: cleanNullable(input.brandLabel),
        regionScope: cleanNullable(input.regionScope),
      },
    });
    const saved = existing
      ? await tx.productAssetAssignment.update({
          where: { id: existing.id },
          data: {
            assetVersionId,
            sortOrder: input.sortOrder ?? existing.sortOrder,
            isRequired: input.isRequired ?? existing.isRequired,
          },
        })
      : await tx.productAssetAssignment.create({
          data: {
            presentationId: input.presentationId,
            assetId: input.assetId,
            assetVersionId,
            role: toAssetRole(input.role),
            dealerGroupType: cleanNullable(input.dealerGroupType),
            dealerGroupId: cleanNullable(input.dealerGroupId),
            brandLabel: cleanNullable(input.brandLabel),
            regionScope: cleanNullable(input.regionScope),
            sortOrder: input.sortOrder ?? 100,
            isRequired: input.isRequired ?? false,
          },
        });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: 'PRODUCT_ASSET_ASSIGNMENT',
        entityId: saved.id,
        ...(existing ? { beforeData: existing } : {}),
        afterData: saved,
      }),
    });
    return saved;
  });
  return mapAssignment(assignment);
}

export async function unlinkProductAsset(actor: AuthenticatedActor, assignmentId: string): Promise<ProductAssetAssignmentSummary> {
  assertModuleAccess(actor.role, 'product_management');
  assertActionAccess(actor.role, 'product.asset_link');
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.productAssetAssignment.findUnique({ where: { id: assignmentId } });
    if (!existing) throw new Error('Product asset assignment not found');
    await tx.productAssetAssignment.delete({ where: { id: assignmentId } });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.DELETE,
        entityType: 'PRODUCT_ASSET_ASSIGNMENT',
        entityId: existing.id,
        beforeData: existing,
      }),
    });
    return existing;
  });
  return mapAssignment(deleted);
}

export async function previewWidenManifestImport(
  actor: AuthenticatedActor,
  input: WidenManifestImportRequest = {},
): Promise<WidenManifestPreviewResponse> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.sync');
  const context = await loadWidenManifestRows(input);
  return {
    ...summarizeWidenCandidates(context),
    sampleRows: context.candidates.slice(0, 50).map(toWidenRowPreview),
    warnings: context.warnings,
  };
}

export async function commitWidenManifestImport(
  actor: AuthenticatedActor,
  input: WidenManifestImportRequest = {},
): Promise<CommitWidenManifestImportResponse> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.sync');
  const context = await loadWidenManifestRows(input);
  if (!context.rows.length && !input.dryRun) {
    throw new Error('Widen manifest rows are required before committing an import run');
  }
  const summary = summarizeWidenCandidates(context);
  if (input.dryRun) {
    return {
      ...summary,
      dryRun: true,
      batch: null,
      assetsCreated: 0,
      assetsUpdated: 0,
      versionsCreated: 0,
      aliasesUpserted: 0,
      metadataFieldsUpserted: 0,
      issuesCreated: 0,
      sourceDownloadsIngested: 0,
      sourceDownloadFailures: 0,
      skippedRows: summary.invalidRowCount,
      warnings: context.warnings,
    };
  }

  const counters = {
    assetsCreated: 0,
    assetsUpdated: 0,
    versionsCreated: 0,
    aliasesUpserted: 0,
    metadataFieldsUpserted: 0,
    issuesCreated: 0,
    sourceDownloadsIngested: 0,
    sourceDownloadFailures: 0,
    skippedRows: summary.invalidRowCount,
  };
  let batchRow: any = null;
  const sourceIngestionTargets: WidenSourceIngestionTarget[] = [];

  await prisma.$transaction(async (tx) => {
    const batch = await tx.digitalAssetMigrationBatch.create({
      data: {
        sourceSystem: ProductSourceSystem.WIDEN,
        batchCode: cleanNullable(input.batchCode) ?? `widen-${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${shortHash(JSON.stringify(context.rows))}-${randomUUID().slice(0, 8)}`,
        sourceExportName: cleanNullable(input.sourceExportName) ?? context.sourceExportName ?? null,
        sourceExportedAt: parseDateOrNull(input.sourceExportedAt),
        status: summary.errorCount > 0 ? 'imported_with_issues' : 'imported',
        sourceRecordCount: summary.sourceRecordCount,
        skippedRecordCount: summary.invalidRowCount,
        errorCount: summary.errorCount,
        importedByUserId: actor.userId,
        notes: cleanNullable(input.notes),
        rawManifest: boundedJson(context.rows, 'Widen raw manifest', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
        startedAt: new Date(),
      },
    });

    for (const candidate of context.candidates) {
      if (!candidate.isValid) {
        await createWidenIssues(tx, candidate, batch.id, undefined);
        counters.issuesCreated += candidate.issues.length;
        continue;
      }

      const existing = await tx.digitalAsset.findUnique({ where: { stableSlug: candidate.stableSlug } });
      const asset = await tx.digitalAsset.upsert({
        where: { stableSlug: candidate.stableSlug },
        create: {
          stableSlug: candidate.stableSlug,
          title: candidate.title,
          description: candidate.description,
          kind: candidate.kind,
          status: DigitalAssetStatus.NEEDS_REVIEW,
          visibility: DigitalAssetVisibility.INTERNAL_ONLY,
          reviewStatus: DigitalAssetReviewStatus.PENDING_REVIEW,
          sourceSystem: ProductSourceSystem.WIDEN,
          sourceOfTruthSystem: ProductSourceSystem.WIDEN,
          audience: candidate.audience,
          brandScope: candidate.brandScope,
          regionScope: candidate.regionScope,
          dealerGroupType: candidate.dealerGroupType,
          dealerGroupId: candidate.dealerGroupId,
          widenAssetId: candidate.externalAssetId,
          legacyUrl: candidate.legacyUrl,
          legacyFileName: candidate.fileName,
          legacyFolderPath: candidate.folderPath,
          legacyCreatedAt: candidate.createdAt,
          legacyUpdatedAt: candidate.updatedAt,
          legacyPublishedAt: candidate.publishedAt,
          migratedAt: new Date(),
          migrationBatchId: batch.id,
          legacyMetadata: boundedJson(candidate.metadata, 'Widen legacy metadata', JSON_SIZE_LIMITS.migrationSnapshotMetadataBytes),
          rawSourcePayload: boundedJson(candidate.rawRow, 'Widen raw source row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
          createdByUserId: actor.userId,
        },
        update: {
          title: candidate.title,
          description: candidate.description,
          kind: candidate.kind,
          sourceSystem: ProductSourceSystem.WIDEN,
          sourceOfTruthSystem: ProductSourceSystem.WIDEN,
          audience: candidate.audience,
          brandScope: candidate.brandScope,
          regionScope: candidate.regionScope,
          dealerGroupType: candidate.dealerGroupType,
          dealerGroupId: candidate.dealerGroupId,
          widenAssetId: candidate.externalAssetId,
          legacyUrl: candidate.legacyUrl,
          legacyFileName: candidate.fileName,
          legacyFolderPath: candidate.folderPath,
          legacyCreatedAt: candidate.createdAt,
          legacyUpdatedAt: candidate.updatedAt,
          legacyPublishedAt: candidate.publishedAt,
          migratedAt: new Date(),
          migrationBatchId: batch.id,
          legacyMetadata: boundedJson(candidate.metadata, 'Widen legacy metadata', JSON_SIZE_LIMITS.migrationSnapshotMetadataBytes),
          rawSourcePayload: boundedJson(candidate.rawRow, 'Widen raw source row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
        },
      });
      if (existing) counters.assetsUpdated += 1;
      else counters.assetsCreated += 1;

      if (candidate.versionUrl || candidate.fileName) {
        const existingVersion = candidate.sourceVersionId
          ? await tx.digitalAssetVersion.findFirst({ where: { assetId: asset.id, sourceVersionId: candidate.sourceVersionId } })
          : candidate.versionUrl
            ? await tx.digitalAssetVersion.findFirst({ where: { assetId: asset.id, externalUrl: candidate.versionUrl } })
            : null;
        if (!existingVersion) {
          await tx.digitalAssetVersion.updateMany({ where: { assetId: asset.id }, data: { isCurrent: false } });
          const nextVersion = (await tx.digitalAssetVersion.aggregate({ where: { assetId: asset.id }, _max: { versionNumber: true } }))._max.versionNumber ?? 0;
          const version = await tx.digitalAssetVersion.create({
            data: {
              assetId: asset.id,
              versionNumber: nextVersion + 1,
              externalUrl: candidate.versionUrl,
              fileName: candidate.fileName ?? `${candidate.stableSlug}.asset`,
              mimeType: candidate.mimeType,
              sizeBytes: candidate.sizeBytes,
              sha256: candidate.sha256,
              sourceVersionId: candidate.sourceVersionId,
              sourceDownloadUrl: candidate.downloadUrl,
              legacyRenditionName: candidate.renditionName,
              legacyMetadata: boundedJson(candidate.metadata, 'Widen version metadata', JSON_SIZE_LIMITS.migrationSnapshotMetadataBytes),
              rawSourcePayload: boundedJson(candidate.rawRow, 'Widen version raw source row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
              isCurrent: true,
              createdByUserId: actor.userId,
            },
          });
          await tx.digitalAsset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });
          counters.versionsCreated += 1;
          if (candidate.downloadUrl) {
            sourceIngestionTargets.push(toWidenSourceIngestionTarget(candidate, batch.id, asset.id, version));
          }
        } else if (candidate.downloadUrl && !existingVersion.storageKey) {
          sourceIngestionTargets.push(toWidenSourceIngestionTarget(candidate, batch.id, asset.id, existingVersion));
        }
      }

      if (candidate.legacyUrl) {
        await tx.digitalAssetMigrationAlias.upsert({
          where: { sourceSystem_legacyUrl: { sourceSystem: ProductSourceSystem.WIDEN, legacyUrl: candidate.legacyUrl } },
          create: {
            assetId: asset.id,
            sourceSystem: ProductSourceSystem.WIDEN,
            externalAssetId: candidate.externalAssetId,
            externalVersionId: candidate.sourceVersionId,
            legacyUrl: candidate.legacyUrl,
            legacyPath: candidate.folderPath,
            legacyEmbedCode: candidate.embedCode,
            redirectStatus: 'pending',
            rawSourcePayload: boundedJson(candidate.rawRow, 'Widen alias raw source row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
          },
          update: {
            assetId: asset.id,
            externalAssetId: candidate.externalAssetId,
            externalVersionId: candidate.sourceVersionId,
            legacyPath: candidate.folderPath,
            legacyEmbedCode: candidate.embedCode,
            rawSourcePayload: boundedJson(candidate.rawRow, 'Widen alias raw source row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
          },
        });
        counters.aliasesUpserted += 1;
      }

      for (const field of candidate.metadataFields) {
        await tx.digitalAssetLegacyMetadata.upsert({
          where: {
            assetId_sourceSystem_fieldKey_fieldValue: {
              assetId: asset.id,
              sourceSystem: ProductSourceSystem.WIDEN,
              fieldKey: field.fieldKey,
              fieldValue: field.fieldValue,
            },
          },
          create: {
            assetId: asset.id,
            sourceSystem: ProductSourceSystem.WIDEN,
            fieldKey: field.fieldKey,
            fieldLabel: field.fieldLabel,
            fieldValue: field.fieldValue,
            valueType: field.valueType,
            isSearchable: true,
          },
          update: {
            fieldLabel: field.fieldLabel,
            valueType: field.valueType,
            isSearchable: true,
          },
        });
        counters.metadataFieldsUpserted += 1;
      }

      await createWidenIssues(tx, candidate, batch.id, asset.id);
      counters.issuesCreated += candidate.issues.length;
    }

    batchRow = await tx.digitalAssetMigrationBatch.update({
      where: { id: batch.id },
      data: {
        createdAssetCount: counters.assetsCreated,
        updatedAssetCount: counters.assetsUpdated,
        skippedRecordCount: counters.skippedRows,
        errorCount: summary.errorCount,
        completedAt: new Date(),
      },
    });
    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.IMPORT,
        entityType: 'DIGITAL_ASSET_MIGRATION_BATCH',
        entityId: batch.id,
        sourceSystem: 'widen',
        afterData: {
          batchId: batch.id,
          ...summary,
          ...counters,
        },
      }),
    });
  }, { timeout: 60_000 });

  if (input.ingestSourceDownloads) {
    const limit = clampWidenSourceDownloadLimit(input.maxSourceDownloads);
    const limitedTargets = sourceIngestionTargets.slice(0, limit);
    if (sourceIngestionTargets.length > limit) {
      context.warnings.push(`Widen source download ingestion limited to ${limit} files for this run.`);
    }
    for (const target of limitedTargets) {
      const ingested = await ingestWidenSourceDownload(actor, target);
      if (ingested) counters.sourceDownloadsIngested += 1;
      else {
        counters.sourceDownloadFailures += 1;
        counters.issuesCreated += 1;
      }
    }
    if (counters.sourceDownloadFailures > 0 && batchRow?.id) {
      batchRow = await prisma.digitalAssetMigrationBatch.update({
        where: { id: batchRow.id },
        data: { status: 'imported_with_issues' },
      });
    }
  }

  return {
    ...summary,
    dryRun: false,
    batch: batchRow ? mapMigrationBatch(batchRow) : null,
    ...counters,
    warnings: context.warnings,
  };
}

export async function listWidenManifestImportRuns(
  actor: AuthenticatedActor,
  input: { limit?: number } = {},
): Promise<ListWidenManifestImportRunsResponse> {
  assertModuleAccess(actor.role, 'digital_assets');
  assertActionAccess(actor.role, 'digital_asset.sync');
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 50);
  const where = { sourceSystem: ProductSourceSystem.WIDEN };
  const [batches, total] = await Promise.all([
    prisma.digitalAssetMigrationBatch.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    }),
    prisma.digitalAssetMigrationBatch.count({ where }),
  ]);
  return { items: batches.map(mapMigrationBatch), total };
}

type WidenManifestCandidate = {
  rowNumber: number;
  rawRow: Record<string, unknown>;
  stableSlug: string;
  externalAssetId: string | null;
  sourceVersionId: string | null;
  title: string;
  description: string | null;
  fileName: string | null;
  kind: DigitalAssetKind;
  audience: string;
  brandScope: string | null;
  regionScope: string | null;
  dealerGroupType: string | null;
  dealerGroupId: string | null;
  legacyUrl: string | null;
  versionUrl: string | null;
  downloadUrl: string | null;
  folderPath: string | null;
  embedCode: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  renditionName: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  publishedAt: Date | null;
  metadata: Record<string, unknown>;
  metadataFields: Array<{ fieldKey: string; fieldLabel: string; fieldValue: string; valueType: string }>;
  issues: WidenManifestRowIssue[];
  isValid: boolean;
};

type WidenManifestContext = {
  rows: Record<string, unknown>[];
  candidates: WidenManifestCandidate[];
  warnings: string[];
  sourceExportName: string | null;
};

type WidenSourceIngestionTarget = {
  batchId: string;
  assetId: string;
  versionId: string;
  versionNumber: number;
  fileName: string;
  mimeType: string | null;
  sourceDownloadUrl: string;
  externalAssetId: string | null;
  rowNumber: number;
  rawRow: Record<string, unknown>;
};

// Confine caller-supplied manifest paths to a dedicated subdirectory of the configured storage
// root. Without this an admin-tier actor could pass an absolute path or `../` traversal and read
// any file the API process can reach (env files, secrets, /etc/passwd). Mirrors the containment
// check in storage.ts.
const WIDEN_MANIFEST_SUBDIR = 'widen-manifests';

function resolveManifestPathWithinRoot(manifestPath: string): string {
  const config = loadAppConfig();
  const baseDir = path.resolve(config.storage.rootDir, WIDEN_MANIFEST_SUBDIR);
  // Strip any leading separators so an absolute input is treated as relative to the base.
  const relative = manifestPath.replace(/^[/\\]+/, '');
  const targetPath = path.resolve(baseDir, relative);
  if (targetPath !== baseDir && !targetPath.startsWith(baseDir + path.sep)) {
    throw new Error('Widen manifest path resolved outside the configured manifest directory');
  }
  return targetPath;
}

async function loadWidenManifestRows(input: WidenManifestImportRequest): Promise<WidenManifestContext> {
  const limit = clampManifestLimit(input.limit);
  const warnings: string[] = [];
  let rows = Array.isArray(input.rows) ? input.rows : undefined;
  let sourceExportName = cleanNullable(input.sourceExportName);

  if (!rows && cleanNullable(input.manifestPath)) {
    const manifestPath = cleanNullable(input.manifestPath) as string;
    const safePath = resolveManifestPathWithinRoot(manifestPath);
    const manifest = await readFile(safePath, 'utf8');
    rows = parseManifestContent(manifest);
    sourceExportName = sourceExportName ?? safePath.split(path.sep).pop() ?? null;
  }

  if (!rows) {
    warnings.push('No Widen manifest rows were supplied. Upload/export mapping is parked until a curated Widen manifest is available.');
    rows = [];
  }

  const normalizedRows = rows.slice(0, limit).map((row) => normalizeManifestRow(row));
  if (rows.length > limit) warnings.push(`Manifest row count exceeded limit; previewing first ${limit} rows.`);
  const candidates = buildWidenCandidates(normalizedRows);
  return { rows: normalizedRows, candidates, warnings, sourceExportName };
}

function parseManifestContent(input: string): Record<string, unknown>[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error('Widen manifest JSON must be an array of rows');
    return parsed.map((row) => normalizeManifestRow(row));
  }
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const rows = parsed.rows ?? parsed.assets ?? parsed.items;
    if (!Array.isArray(rows)) throw new Error('Widen manifest JSON must include rows, assets, or items array');
    return rows.map((row: unknown) => normalizeManifestRow(row));
  }
  const parsedRows = parseCsv(trimmed);
  const headers = parsedRows[0]?.map((header) => header.trim()) ?? [];
  return parsedRows.slice(1).map((row) => toRecord(headers, row));
}

function buildWidenCandidates(rows: Record<string, unknown>[]): WidenManifestCandidate[] {
  const seenExternalIds = new Set<string>();
  const duplicateExternalIds = new Set<string>();
  for (const row of rows) {
    const externalAssetId = pickString(row, ['assetId', 'asset_id', 'id', 'widenAssetId', 'widen_asset_id', 'widen_id', 'source_asset_id', 'externalAssetId', 'external_asset_id']);
    if (!externalAssetId) continue;
    if (seenExternalIds.has(externalAssetId)) duplicateExternalIds.add(externalAssetId);
    seenExternalIds.add(externalAssetId);
  }

  return rows.map((row, index) => {
    const rowNumber = index + 1;
    const externalAssetId = pickString(row, ['assetId', 'asset_id', 'id', 'widenAssetId', 'widen_asset_id', 'widen_id', 'source_asset_id', 'externalAssetId', 'external_asset_id']) ?? null;
    const sourceVersionId = pickString(row, ['versionId', 'version_id', 'externalVersionId', 'external_version_id', 'assetVersionId', 'asset_version_id']) ?? null;
    const fileName = pickString(row, ['fileName', 'filename', 'file_name', 'originalFilename', 'original_file_name', 'name']);
    const title = pickString(row, ['title', 'name', 'assetTitle', 'asset_title']) ?? fileName ?? externalAssetId ?? `Widen asset ${rowNumber}`;
    const legacyUrl = pickString(row, ['legacyUrl', 'legacy_url', 'widenUrl', 'widen_url', 'sourceUrl', 'source_url', 'url', 'assetUrl', 'asset_url', 'shareUrl', 'share_url', 'directUrl', 'direct_url']);
    const downloadUrl = pickString(row, ['downloadUrl', 'download_url', 'sourceDownloadUrl', 'source_download_url', 'directUrl', 'direct_url']);
    const versionUrl = pickString(row, ['externalUrl', 'external_url', 'fileUrl', 'file_url', 'downloadUrl', 'download_url', 'directUrl', 'direct_url', 'url']) ?? legacyUrl;
    const mimeType = pickString(row, ['mimeType', 'mime_type', 'contentType', 'content_type']);
    const folderPath = pickString(row, ['folderPath', 'folder_path', 'path', 'legacyPath', 'legacy_path']);
    const metadata = extractWidenMetadata(row);
    const issues: WidenManifestRowIssue[] = [];
    if (!externalAssetId && !legacyUrl) {
      issues.push({ rowNumber, severity: 'error', issueCode: 'missing_identity', message: 'Row requires a Widen asset id or legacy URL.' });
    }
    if (!fileName && !legacyUrl && !versionUrl) {
      const issue: WidenManifestRowIssue = { rowNumber, severity: 'warning', issueCode: 'missing_file_reference', message: 'Row has no filename or URL for a version reference.' };
      if (externalAssetId) issue.externalAssetId = externalAssetId;
      issues.push(issue);
    }
    if (externalAssetId && duplicateExternalIds.has(externalAssetId)) {
      issues.push({ rowNumber, externalAssetId, severity: 'warning', issueCode: 'duplicate_external_asset_id', message: 'Manifest contains more than one row for this Widen asset id.' });
    }

    return {
      rowNumber,
      rawRow: row,
      stableSlug: `widen-${slugify(externalAssetId ?? legacyUrl ?? title)}`.slice(0, 180),
      externalAssetId,
      sourceVersionId,
      title,
      description: pickString(row, ['description', 'assetDescription', 'asset_description']) ?? null,
      fileName: fileName ?? null,
      kind: inferWidenAssetKind(mimeType, fileName, legacyUrl),
      audience: pickString(row, ['audience']) ?? 'internal',
      brandScope: pickString(row, ['brandScope', 'brand', 'brand_scope']) ?? null,
      regionScope: pickString(row, ['regionScope', 'region', 'market', 'region_scope']) ?? null,
      dealerGroupType: pickString(row, ['dealerGroupType', 'dealer_group_type']) ?? null,
      dealerGroupId: pickString(row, ['dealerGroupId', 'dealer_group_id']) ?? null,
      legacyUrl: legacyUrl ?? null,
      versionUrl: versionUrl ?? null,
      downloadUrl: downloadUrl ?? null,
      folderPath: folderPath ?? null,
      embedCode: pickString(row, ['embedCode', 'embed_code']) ?? null,
      mimeType: mimeType ?? null,
      sizeBytes: pickNumber(row, ['sizeBytes', 'size_bytes', 'fileSize', 'file_size']),
      sha256: pickString(row, ['sha256', 'sha', 'checksum']) ?? null,
      renditionName: pickString(row, ['renditionName', 'rendition_name']) ?? null,
      createdAt: parseDateOrNull(pickString(row, ['createdAt', 'created_at', 'dateCreated', 'date_created'])),
      updatedAt: parseDateOrNull(pickString(row, ['updatedAt', 'updated_at', 'lastUpdated', 'last_updated'])),
      publishedAt: parseDateOrNull(pickString(row, ['publishedAt', 'published_at', 'datePublished', 'date_published'])),
      metadata,
      metadataFields: toMetadataFields(metadata),
      issues,
      isValid: !issues.some((issue) => issue.severity === 'error'),
    };
  });
}

function summarizeWidenCandidates(context: WidenManifestContext): WidenManifestImportSummary {
  const errorCount = context.candidates.reduce((total, candidate) => total + candidate.issues.filter((issue) => issue.severity === 'error').length, 0);
  const warningCount = context.candidates.reduce((total, candidate) => total + candidate.issues.filter((issue) => issue.severity === 'warning').length, 0);
  const duplicateExternalAssetCount = new Set(
    context.candidates.flatMap((candidate) => candidate.issues.some((issue) => issue.issueCode === 'duplicate_external_asset_id') && candidate.externalAssetId ? [candidate.externalAssetId] : []),
  ).size;
  const summary: WidenManifestImportSummary = {
    sourceSystem: 'widen' as const,
    sourceRecordCount: context.rows.length,
    validRowCount: context.candidates.filter((candidate) => candidate.isValid).length,
    invalidRowCount: context.candidates.filter((candidate) => !candidate.isValid).length,
    warningCount,
    errorCount,
    duplicateExternalAssetCount,
    downloadableSourceCount: context.candidates.filter((candidate) => candidate.isValid && Boolean(candidate.downloadUrl)).length,
  };
  if (context.sourceExportName) summary.sourceExportName = context.sourceExportName;
  return summary;
}

function toWidenSourceIngestionTarget(
  candidate: WidenManifestCandidate,
  batchId: string,
  assetId: string,
  version: { id: string; versionNumber: number; fileName: string; mimeType: string | null },
): WidenSourceIngestionTarget {
  return {
    batchId,
    assetId,
    versionId: version.id,
    versionNumber: version.versionNumber,
    fileName: version.fileName,
    mimeType: version.mimeType,
    sourceDownloadUrl: candidate.downloadUrl as string,
    externalAssetId: candidate.externalAssetId,
    rowNumber: candidate.rowNumber,
    rawRow: candidate.rawRow,
  };
}

async function ingestWidenSourceDownload(actor: AuthenticatedActor, target: WidenSourceIngestionTarget) {
  try {
    const downloaded = await downloadSourceAsset(target.sourceDownloadUrl);
    const stored = await storeDigitalAssetObject(loadAppConfig(), {
      assetId: target.assetId,
      versionNumber: target.versionNumber,
      fileName: target.fileName,
      mimeType: target.mimeType ?? downloaded.mimeType ?? null,
      fileBase64: downloaded.buffer.toString('base64'),
    });
    const before = await prisma.digitalAssetVersion.findUnique({ where: { id: target.versionId } });
    const updated = await prisma.digitalAssetVersion.update({
      where: { id: target.versionId },
      data: {
        storageKey: stored.storageKey,
        externalUrl: null,
        mimeType: target.mimeType ?? downloaded.mimeType ?? null,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
      },
    });
    await prisma.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: 'DIGITAL_ASSET_VERSION',
        entityId: target.versionId,
        beforeData: before ?? undefined,
        afterData: updated,
        sourceSystem: 'widen',
        metadata: { assetId: target.assetId, batchId: target.batchId, sourceDownloadIngested: true },
      }),
    });
    return true;
  } catch (error) {
    await prisma.digitalAssetMigrationIssue.create({
      data: {
        batchId: target.batchId,
        assetId: target.assetId,
        sourceSystem: ProductSourceSystem.WIDEN,
        externalAssetId: target.externalAssetId,
        severity: 'warning',
        issueCode: 'source_download_ingest_failed',
        message: `Widen source download could not be copied into managed storage: ${error instanceof Error ? error.message : 'unknown error'}`,
        sourceRowNumber: target.rowNumber,
        rawSourcePayload: boundedJson(target.rawRow, 'Widen source download issue raw row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
      },
    });
    return false;
  }
}

function toWidenRowPreview(candidate: WidenManifestCandidate): WidenManifestRowPreview {
  const preview: WidenManifestRowPreview = {
    rowNumber: candidate.rowNumber,
    title: candidate.title,
    kind: lower(candidate.kind),
    status: candidate.isValid ? 'ready' : 'invalid',
    issues: candidate.issues,
  };
  if (candidate.externalAssetId) preview.externalAssetId = candidate.externalAssetId;
  if (candidate.fileName) preview.fileName = candidate.fileName;
  if (candidate.legacyUrl) preview.legacyUrl = candidate.legacyUrl;
  return preview;
}

async function createWidenIssues(tx: any, candidate: WidenManifestCandidate, batchId: string, assetId: string | undefined) {
  for (const issue of candidate.issues) {
    await tx.digitalAssetMigrationIssue.create({
      data: {
        batchId,
        assetId,
        sourceSystem: ProductSourceSystem.WIDEN,
        externalAssetId: candidate.externalAssetId,
        severity: issue.severity,
        issueCode: issue.issueCode,
        message: issue.message,
        sourceRowNumber: candidate.rowNumber,
        rawSourcePayload: boundedJson(candidate.rawRow, 'Widen issue raw source row', JSON_SIZE_LIMITS.migrationSnapshotRawPayloadBytes),
      },
    });
  }
}

function buildAssetWhere(input: ListDigitalAssetsRequest) {
  const where: any = {};
  if (input.search?.trim()) {
    const contains = input.search.trim();
    where.OR = [
      { title: { contains, mode: 'insensitive' } },
      { description: { contains, mode: 'insensitive' } },
      { stableSlug: { contains, mode: 'insensitive' } },
      { widenAssetId: { contains, mode: 'insensitive' } },
      { legacyFileName: { contains, mode: 'insensitive' } },
      { legacyFolderPath: { contains, mode: 'insensitive' } },
      { legacyMetadataFields: { some: { fieldValue: { contains, mode: 'insensitive' }, isSearchable: true } } },
    ];
  }
  if (input.kind) where.kind = toAssetKind(input.kind);
  if (input.status) where.status = toAssetStatus(input.status);
  if (input.visibility) where.visibility = toAssetVisibility(input.visibility);
  if (input.brandScope) where.brandScope = input.brandScope;
  if (input.regionScope) where.regionScope = input.regionScope;
  if (input.dealerGroupId) where.dealerGroupId = input.dealerGroupId;
  if (input.sourceSystem) where.sourceSystem = toSourceSystem(input.sourceSystem);
  return where;
}

function mapAsset(asset: any): DigitalAssetSummary {
  const summary: DigitalAssetSummary = {
    id: asset.id,
    stableSlug: asset.stableSlug,
    title: asset.title,
    description: asset.description ?? undefined,
    kind: lower(asset.kind),
    status: lower(asset.status),
    visibility: lower(asset.visibility),
    reviewStatus: lower(asset.reviewStatus),
    sourceSystem: lower(asset.sourceSystem),
    sourceOfTruthSystem: lower(asset.sourceOfTruthSystem),
    audience: asset.audience,
    brandScope: asset.brandScope ?? undefined,
    regionScope: asset.regionScope ?? undefined,
    dealerGroupType: asset.dealerGroupType ?? undefined,
    dealerGroupId: asset.dealerGroupId ?? undefined,
    widenAssetId: asset.widenAssetId ?? undefined,
    legacyUrl: asset.legacyUrl ?? undefined,
    legacyFileName: asset.legacyFileName ?? undefined,
    legacyFolderPath: asset.legacyFolderPath ?? undefined,
    legacyCreatedAt: asset.legacyCreatedAt?.toISOString(),
    legacyUpdatedAt: asset.legacyUpdatedAt?.toISOString(),
    legacyPublishedAt: asset.legacyPublishedAt?.toISOString(),
    migratedAt: asset.migratedAt?.toISOString(),
    migrationBatchId: asset.migrationBatchId ?? undefined,
    currentVersionId: asset.currentVersionId ?? undefined,
    versionCount: asset._count?.versions ?? (Array.isArray(asset.versions) ? asset.versions.length : 0),
    approvedAt: asset.approvedAt?.toISOString(),
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
  const shareLinks = Array.isArray(asset.shareLinks) ? asset.shareLinks : [];
  const activeShareLinks = shareLinks.filter((shareLink: any) => !shareLink.revokedAt && (!shareLink.expiresAt || shareLink.expiresAt.getTime() >= Date.now()));
  const lastSharedAt = shareLinks[0]?.createdAt;
  const lastAccessedAt = shareLinks
    .map((shareLink: any) => shareLink.lastAccessedAt)
    .filter(Boolean)
    .sort((first: Date, second: Date) => second.getTime() - first.getTime())[0];
  summary.productUsageCount = asset._count?.productAssignments ?? (Array.isArray(asset.productAssignments) ? asset.productAssignments.length : 0);
  summary.activeShareLinkCount = activeShareLinks.length;
  summary.totalShareLinkAccessCount = shareLinks.reduce((total: number, shareLink: any) => total + (shareLink.accessCount ?? 0), 0);
  if (lastSharedAt) summary.lastSharedAt = lastSharedAt.toISOString();
  if (lastAccessedAt) summary.lastAccessedAt = lastAccessedAt.toISOString();
  const currentVersion = Array.isArray(asset.versions)
    ? asset.versions.find((version: any) => version.id === asset.currentVersionId) ?? asset.versions.find((version: any) => version.isCurrent)
    : undefined;
  if (currentVersion) summary.currentVersion = mapVersion(currentVersion);
  const legacyMetadata = objectJson(asset.legacyMetadata);
  if (legacyMetadata) summary.legacyMetadata = legacyMetadata;
  const rawSourcePayload = objectJson(asset.rawSourcePayload);
  if (rawSourcePayload) summary.rawSourcePayload = rawSourcePayload;
  return summary;
}

function mapCollection(collection: any): DigitalAssetCollectionSummary {
  return {
    id: collection.id,
    code: collection.code,
    name: collection.name,
    description: collection.description ?? undefined,
    visibility: lower(collection.visibility),
    brandScope: collection.brandScope ?? undefined,
    regionScope: collection.regionScope ?? undefined,
    dealerGroupType: collection.dealerGroupType ?? undefined,
    dealerGroupId: collection.dealerGroupId ?? undefined,
    isActive: collection.isActive,
    itemCount: collection._count?.items ?? (Array.isArray(collection.items) ? collection.items.length : undefined),
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

function mapCollectionItem(item: any): DigitalAssetCollectionItemSummary {
  const summary: DigitalAssetCollectionItemSummary = {
    id: item.id,
    collectionId: item.collectionId,
    assetId: item.assetId,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
  };
  if (item.asset) summary.asset = mapAsset(item.asset);
  return summary;
}

function mapVersion(version: any) {
  const config = loadAppConfig();
  const summary: DigitalAssetVersionSummary = {
    id: version.id,
    assetId: version.assetId,
    versionNumber: version.versionNumber,
    storageKey: version.storageKey ?? undefined,
    externalUrl: version.externalUrl ?? undefined,
    publicUrl: version.externalUrl ?? buildPublicAssetUrl(config, version.storageKey),
    fileName: version.fileName,
    mimeType: version.mimeType ?? undefined,
    sizeBytes: version.sizeBytes ?? undefined,
    sha256: version.sha256 ?? undefined,
    sourceVersionId: version.sourceVersionId ?? undefined,
    sourceDownloadUrl: version.sourceDownloadUrl ?? undefined,
    legacyRenditionName: version.legacyRenditionName ?? undefined,
    isCurrent: version.isCurrent,
    createdAt: version.createdAt.toISOString(),
  };
  const legacyMetadata = objectJson(version.legacyMetadata);
  if (legacyMetadata) summary.legacyMetadata = legacyMetadata;
  const rawSourcePayload = objectJson(version.rawSourcePayload);
  if (rawSourcePayload) summary.rawSourcePayload = rawSourcePayload;
  return summary;
}

function mapLegacyMetadata(field: any) {
  return {
    id: field.id,
    assetId: field.assetId,
    sourceSystem: lower(field.sourceSystem),
    fieldKey: field.fieldKey,
    fieldLabel: field.fieldLabel ?? undefined,
    fieldValue: field.fieldValue ?? undefined,
    fieldValueJson: field.fieldValueJson ?? undefined,
    valueType: field.valueType ?? undefined,
    isSearchable: field.isSearchable,
  };
}

function mapMigrationIssue(issue: any) {
  return {
    id: issue.id,
    batchId: issue.batchId ?? undefined,
    assetId: issue.assetId ?? undefined,
    sourceSystem: lower(issue.sourceSystem),
    externalAssetId: issue.externalAssetId ?? undefined,
    severity: issue.severity,
    issueCode: issue.issueCode,
    message: issue.message,
    sourceRowNumber: issue.sourceRowNumber ?? undefined,
    resolvedAt: issue.resolvedAt?.toISOString(),
    createdAt: issue.createdAt.toISOString(),
  };
}

function mapShareLink(shareLink: any): DigitalAssetShareLinkSummary {
  const summary: DigitalAssetShareLinkSummary = {
    id: shareLink.id,
    assetId: shareLink.assetId,
    shareUrl: shareLink.shareUrl,
    recipientType: shareLink.recipientType,
    accessCount: shareLink.accessCount,
    createdAt: shareLink.createdAt.toISOString(),
    updatedAt: shareLink.updatedAt.toISOString(),
  };
  if (shareLink.assetVersionId) summary.assetVersionId = shareLink.assetVersionId;
  if (shareLink.assetVersion) {
    const targetUrl = mapVersion(shareLink.assetVersion).publicUrl;
    if (targetUrl) summary.targetUrl = targetUrl;
  }
  if (shareLink.recipientName) summary.recipientName = shareLink.recipientName;
  if (shareLink.recipientEmail) summary.recipientEmail = shareLink.recipientEmail;
  if (shareLink.contextType) summary.contextType = shareLink.contextType;
  if (shareLink.contextId) summary.contextId = shareLink.contextId;
  if (shareLink.expiresAt) summary.expiresAt = shareLink.expiresAt.toISOString();
  if (shareLink.revokedAt) summary.revokedAt = shareLink.revokedAt.toISOString();
  if (shareLink.lastAccessedAt) summary.lastAccessedAt = shareLink.lastAccessedAt.toISOString();
  if (shareLink.note) summary.note = shareLink.note;
  if (shareLink.createdByUserId) summary.createdByUserId = shareLink.createdByUserId;
  return summary;
}

function mapProductUsage(assignment: any): DigitalAssetProductUsageSummary {
  return {
    id: assignment.id,
    presentationId: assignment.presentationId,
    productId: assignment.presentation.baseProductId,
    productSku: assignment.presentation.baseProduct.sku,
    productName: assignment.presentation.baseProduct.productName,
    presentationName: assignment.presentation.displayName,
    assetId: assignment.assetId,
    assetVersionId: assignment.assetVersionId ?? undefined,
    role: lower(assignment.role),
    dealerGroupType: assignment.dealerGroupType ?? undefined,
    dealerGroupId: assignment.dealerGroupId ?? undefined,
    brandLabel: assignment.brandLabel ?? undefined,
    regionScope: assignment.regionScope ?? undefined,
    sortOrder: assignment.sortOrder,
    isRequired: assignment.isRequired,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}

function mapAssignment(assignment: any): ProductAssetAssignmentSummary {
  return {
    id: assignment.id,
    presentationId: assignment.presentationId,
    assetId: assignment.assetId,
    assetVersionId: assignment.assetVersionId ?? undefined,
    role: lower(assignment.role),
    dealerGroupType: assignment.dealerGroupType ?? undefined,
    dealerGroupId: assignment.dealerGroupId ?? undefined,
    brandLabel: assignment.brandLabel ?? undefined,
    regionScope: assignment.regionScope ?? undefined,
    sortOrder: assignment.sortOrder,
    isRequired: assignment.isRequired,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
  };
}

function mapMigrationBatch(batch: any) {
  return {
    id: batch.id,
    sourceSystem: lower(batch.sourceSystem),
    batchCode: batch.batchCode,
    sourceExportName: batch.sourceExportName ?? undefined,
    sourceExportedAt: batch.sourceExportedAt?.toISOString(),
    status: batch.status,
    sourceRecordCount: batch.sourceRecordCount,
    createdAssetCount: batch.createdAssetCount,
    updatedAssetCount: batch.updatedAssetCount,
    skippedRecordCount: batch.skippedRecordCount,
    errorCount: batch.errorCount,
    startedAt: batch.startedAt?.toISOString(),
    completedAt: batch.completedAt?.toISOString(),
    createdAt: batch.createdAt.toISOString(),
    updatedAt: batch.updatedAt.toISOString(),
  };
}

function normalizeManifestRow(row: unknown): Record<string, unknown> {
  return row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : {};
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string') {
      const cleaned = value.trim();
      if (cleaned) return cleaned;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
}

function pickNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/,/g, '').trim());
      if (Number.isFinite(parsed)) return Math.trunc(parsed);
    }
  }
  return null;
}

function extractWidenMetadata(row: Record<string, unknown>) {
  const metadata: Record<string, unknown> = {};
  const nested = row.metadata;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    Object.assign(metadata, nested);
  }
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('metadata.') || key.startsWith('metadata_') || key.startsWith('field_')) {
      metadata[key.replace(/^metadata[._]/, '').replace(/^field_/, '')] = value;
    }
  }
  return metadata;
}

function toMetadataFields(metadata: Record<string, unknown>) {
  const fields: Array<{ fieldKey: string; fieldLabel: string; fieldValue: string; valueType: string }> = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const entry of values) {
      const fieldValue = typeof entry === 'string' ? entry.trim() : typeof entry === 'number' || typeof entry === 'boolean' ? String(entry) : undefined;
      if (!fieldValue) continue;
      fields.push({
        fieldKey: key.slice(0, 120),
        fieldLabel: titleize(key),
        fieldValue: fieldValue.slice(0, 500),
        valueType: Array.isArray(value) ? 'array' : typeof entry,
      });
    }
  }
  return fields;
}

function inferWidenAssetKind(mimeType: string | undefined, fileName: string | undefined, url: string | undefined) {
  const value = `${mimeType ?? ''} ${fileName ?? ''} ${url ?? ''}`.toLowerCase();
  if (value.includes('image/') || /\.(jpg|jpeg|png|gif|webp|tif|tiff)(\?|$)/.test(value)) return DigitalAssetKind.IMAGE;
  if (value.includes('video/') || /\.(mp4|mov|webm|avi)(\?|$)/.test(value)) return DigitalAssetKind.VIDEO;
  if (value.includes('presentation') || /\.(ppt|pptx|key)(\?|$)/.test(value)) return DigitalAssetKind.PRESENTATION;
  if (value.includes('pdf') || /\.(pdf|doc|docx|xls|xlsx)(\?|$)/.test(value)) return DigitalAssetKind.DOCUMENT;
  return DigitalAssetKind.OTHER;
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function toRecord(headers: string[], row: string[]) {
  const record: Record<string, unknown> = {};
  headers.forEach((header, index) => {
    if (header) record[header] = row[index];
  });
  return record;
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || randomUUID();
}

function clampLimit(limit?: number) {
  return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

function clampManifestLimit(limit?: number) {
  return Math.min(Math.max(limit ?? DEFAULT_MANIFEST_LIMIT, 1), MAX_MANIFEST_LIMIT);
}

function clampWidenSourceDownloadLimit(limit?: number) {
  return Math.min(Math.max(limit ?? DEFAULT_WIDEN_SOURCE_DOWNLOAD_LIMIT, 1), MAX_WIDEN_SOURCE_DOWNLOAD_LIMIT);
}

function resolveShareVersion(versions: any[], assetVersionId: string | null | undefined) {
  const cleanedVersionId = cleanNullable(assetVersionId);
  const version = cleanedVersionId
    ? versions.find((item) => item.id === cleanedVersionId)
    : versions.find((item) => item.isCurrent) ?? versions[0];
  if (!version) throw new Error('Asset must have a version before it can be shared');
  if (cleanedVersionId && !version) throw new Error('Digital asset version not found');
  return version;
}

function resolveShareExpiry(input: CreateDigitalAssetShareLinkRequest) {
  if (input.expiresAt !== undefined) return parseDateOrNull(input.expiresAt);
  const days = Math.min(Math.max(input.expiresInDays ?? DEFAULT_SHARE_EXPIRY_DAYS, 1), MAX_SHARE_EXPIRY_DAYS);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function createShareToken() {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, '');
}

function hashShareToken(token: string) {
  const cleaned = token.trim();
  if (!cleaned) throw new Error('Share token is required');
  return createHash('sha256').update(cleaned).digest('hex');
}

function buildAssetShareUrl(token: string) {
  const config = loadAppConfig();
  return `${config.web.publicBaseUrl.replace(/\/+$/, '')}/api/v1/digital-assets/shares/${token}`;
}

function cleanNullable(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function parseDateOrNull(value: string | null | undefined) {
  const cleaned = value?.trim();
  if (!cleaned) return null;
  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function objectJson(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function lower<T extends string>(value: T) {
  return value.toLowerCase() as any;
}

function titleize(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function boundedJson(value: unknown, field: string, maxBytes: number) {
  return toBoundedJsonValue(value, { field, maxBytes });
}

function toAssetKind(value: string) {
  return value.toUpperCase() as DigitalAssetKind;
}

function toAssetStatus(value: string) {
  return value.toUpperCase() as DigitalAssetStatus;
}

function toAssetVisibility(value: string) {
  return value.toUpperCase() as DigitalAssetVisibility;
}

function toReviewStatus(value: string) {
  return value.toUpperCase() as DigitalAssetReviewStatus;
}

function toSourceSystem(value: string) {
  return value.toUpperCase() as ProductSourceSystem;
}

function toAssetRole(value: string) {
  return value.toUpperCase() as ProductAssetRole;
}

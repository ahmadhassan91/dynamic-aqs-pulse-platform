import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let service;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  service = await import('../dist/modules/digital-assets/service.js');
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

async function createActor(role, suffix) {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase().replaceAll('_', '-')}-${suffix}@pulse.local`,
      displayName: `${role} ${suffix}`,
      roleCode: role,
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

test('asset create and versioning maintain current pointer, detail contract, and audit trail', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-versioning');

  const created = await service.createDigitalAsset(actor, {
    title: 'Dealer brochure',
    kind: 'document',
    visibility: 'dealer_portal',
    audience: 'dealer',
    brandScope: 'Dynamic',
    initialVersion: {
      storageKey: 'digital-assets/dealer-brochure/v1.pdf',
      fileName: 'dealer-brochure-v1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12345,
      sha256: 'hash-v1',
    },
  });

  assert.equal(created.versionCount, 1);
  assert.equal(created.versions.length, 1);
  assert.equal(created.currentVersionId, created.versions[0].id);
  assert.equal(created.currentVersion?.versionNumber, 1);

  const updated = await service.createDigitalAssetVersion(actor, created.id, {
    storageKey: 'digital-assets/dealer-brochure/v2.pdf',
    fileName: 'dealer-brochure-v2.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 23456,
    sha256: 'hash-v2',
  });

  assert.equal(updated.versionCount, 2);
  assert.equal(updated.versions.map((version) => version.versionNumber).join(','), '2,1');
  assert.equal(updated.currentVersion?.versionNumber, 2);

  const listed = await service.listDigitalAssets(actor, { search: 'brochure' });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].versionCount, 2);
  assert.equal(listed.items[0].currentVersion?.fileName, 'dealer-brochure-v2.pdf');

  const detail = await service.getDigitalAssetDetail(actor, created.id);
  assert.equal(detail.versionCount, 2);
  assert.equal(detail.currentVersion?.sha256, 'hash-v2');

  const audits = await prisma.auditEntry.findMany({
    where: {
      entityType: { in: ['DIGITAL_ASSET', 'DIGITAL_ASSET_VERSION'] },
    },
    orderBy: [{ createdAt: 'asc' }],
  });
  assert.equal(audits.filter((entry) => entry.entityType === 'DIGITAL_ASSET').length, 1);
  assert.equal(audits.filter((entry) => entry.entityType === 'DIGITAL_ASSET_VERSION').length, 2);
});

test('asset version creation requires upload permission', SERIAL, async () => {
  const admin = await createActor('ADMIN_CSR_OPS', 'asset-upload');
  const reader = await createActor('SALES_BD_REP', 'asset-readonly');
  const created = await service.createDigitalAsset(admin, {
    title: 'Readonly denied asset',
    kind: 'image',
  });

  await assert.rejects(
    () => service.createDigitalAssetVersion(reader, created.id, {
      storageKey: 'digital-assets/readonly/v1.jpg',
      fileName: 'readonly-v1.jpg',
    }),
    /cannot perform action digital_asset\.upload/i,
  );
});

test('asset metadata and review governance can be updated with audit trail', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-governance');
  const reader = await createActor('SALES_BD_REP', 'asset-governance-denied');
  const created = await service.createDigitalAsset(actor, {
    title: 'Pending asset',
    kind: 'image',
    visibility: 'internal_only',
    audience: 'internal',
  });

  await assert.rejects(
    () => service.updateDigitalAsset(reader, created.id, { title: 'Denied update' }),
    /cannot perform action digital_asset\.edit/i,
  );

  const updated = await service.updateDigitalAsset(actor, created.id, {
    title: 'Approved dealer asset',
    description: 'Approved for dealer portal.',
    status: 'active',
    visibility: 'dealer_portal',
    reviewStatus: 'approved',
    audience: 'dealer',
    brandScope: 'Dynamic',
    regionScope: 'US',
    dealerGroupType: 'all_dealers',
    dealerGroupId: 'dealer-group-1',
  });

  assert.equal(updated.title, 'Approved dealer asset');
  assert.equal(updated.status, 'active');
  assert.equal(updated.visibility, 'dealer_portal');
  assert.equal(updated.reviewStatus, 'approved');
  assert.ok(updated.approvedAt);
  assert.equal(updated.dealerGroupId, 'dealer-group-1');
  const listed = await service.listDigitalAssets(actor, {
    status: 'active',
    visibility: 'dealer_portal',
    brandScope: 'Dynamic',
    regionScope: 'US',
    dealerGroupId: 'dealer-group-1',
  });
  assert.equal(listed.total, 1);
  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'DIGITAL_ASSET',
      entityId: created.id,
      action: 'UPDATE',
    },
  });
  assert.ok(audit);
});

test('asset collections can be governed and manage asset membership', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-collections');
  const asset = await service.createDigitalAsset(actor, {
    title: 'Collection asset',
    kind: 'image',
    visibility: 'dealer_portal',
  });

  const collection = await service.createDigitalAssetCollection(actor, {
    code: 'dealer-gallery',
    name: 'Dealer Gallery',
    visibility: 'dealer_portal',
    brandScope: 'Dynamic',
  });
  assert.equal(collection.itemCount, 0);

  const item = await service.upsertDigitalAssetCollectionItem(actor, collection.id, {
    assetId: asset.id,
    sortOrder: 10,
  });
  assert.equal(item.assetId, asset.id);
  assert.equal(item.asset.title, 'Collection asset');

  const updated = await service.updateDigitalAssetCollection(actor, collection.id, {
    name: 'Dealer Product Gallery',
    isActive: false,
    dealerGroupType: 'all_dealers',
  });
  assert.equal(updated.name, 'Dealer Product Gallery');
  assert.equal(updated.itemCount, 1);
  assert.equal(updated.isActive, false);

  const listed = await service.listDigitalAssetCollections(actor);
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].itemCount, 1);

  const removed = await service.removeDigitalAssetCollectionItem(actor, collection.id, asset.id);
  assert.equal(removed.removed, true);
  const relisted = await service.listDigitalAssetCollections(actor);
  assert.equal(relisted.items[0].itemCount, 0);
  const audits = await prisma.auditEntry.findMany({
    where: {
      entityType: 'DIGITAL_ASSET_COLLECTION',
      entityId: collection.id,
    },
  });
  assert.ok(audits.length >= 4);
});

test('asset version upload persists file payload through configured storage adapter', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-storage');
  const created = await service.createDigitalAsset(actor, {
    title: 'Storage backed asset',
    kind: 'document',
    visibility: 'dealer_portal',
  });

  const updated = await service.createDigitalAssetVersion(actor, created.id, {
    fileBase64: Buffer.from('Pulse asset payload').toString('base64'),
    fileName: 'asset payload.txt',
    mimeType: 'text/plain',
  });

  assert.equal(updated.versionCount, 1);
  assert.match(updated.currentVersion.storageKey, new RegExp(`digital-assets/${created.id}/v1/asset-payload.txt`));
  assert.equal(updated.currentVersion.sizeBytes, 19);
  assert.equal(updated.currentVersion.sha256, 'fffdca0c7d573cb222000050f8244f1fe9d7ca8dfe6c692ee844267e5c754f9a');

  const stored = await readFile(path.join(process.env.APP_STORAGE_ROOT_DIR, updated.currentVersion.storageKey), 'utf8');
  assert.equal(stored, 'Pulse asset payload');
});

test('asset version can ingest a Widen source download URL into managed storage', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-source-ingest');
  const created = await service.createDigitalAsset(actor, {
    title: 'Widen managed copy',
    kind: 'document',
    sourceSystem: 'widen',
    legacyUrl: 'https://assets.example.test/share/widen-managed-copy',
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), 'https://assets.example.test/download/widen-managed-copy.pdf');
    return new Response(Buffer.from('Legacy Widen bytes'), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(Buffer.byteLength('Legacy Widen bytes')),
      },
    });
  };

  try {
    const updated = await service.createDigitalAssetVersion(actor, created.id, {
      fileName: 'widen-managed-copy.pdf',
      sourceDownloadUrl: 'https://assets.example.test/download/widen-managed-copy.pdf',
      ingestSourceDownload: true,
    });

    assert.equal(updated.currentVersion.sourceDownloadUrl, 'https://assets.example.test/download/widen-managed-copy.pdf');
    assert.equal(updated.currentVersion.mimeType, 'application/pdf');
    assert.match(updated.currentVersion.storageKey, new RegExp(`digital-assets/${created.id}/v1/widen-managed-copy.pdf`));
    const stored = await readFile(path.join(process.env.APP_STORAGE_ROOT_DIR, updated.currentVersion.storageKey), 'utf8');
    assert.equal(stored, 'Legacy Widen bytes');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Widen manifest import can copy source downloads into managed storage and trace failures', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'widen-bulk-source-ingest');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target === 'https://assets.example.test/download/widen-bulk-copy.pdf') {
      return new Response(Buffer.from('Bulk Widen bytes'), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(Buffer.byteLength('Bulk Widen bytes')),
        },
      });
    }
    if (target === 'https://assets.example.test/download/widen-bulk-fail.pdf') {
      return new Response('missing', { status: 502 });
    }
    throw new Error(`Unexpected fetch URL ${target}`);
  };

  try {
    const response = await service.commitWidenManifestImport(actor, {
      sourceExportName: 'widen-bulk-export.csv',
      ingestSourceDownloads: true,
      rows: [
        {
          assetId: 'widen-bulk-copy',
          title: 'Bulk copied asset',
          fileName: 'widen bulk copy.pdf',
          downloadUrl: 'https://assets.example.test/download/widen-bulk-copy.pdf',
          legacyUrl: 'https://assets.example.test/share/widen-bulk-copy',
          mimeType: 'application/pdf',
        },
        {
          assetId: 'widen-bulk-fail',
          title: 'Bulk failed asset',
          fileName: 'widen bulk fail.pdf',
          downloadUrl: 'https://assets.example.test/download/widen-bulk-fail.pdf',
          legacyUrl: 'https://assets.example.test/share/widen-bulk-fail',
          mimeType: 'application/pdf',
        },
      ],
    });

    assert.equal(response.downloadableSourceCount, 2);
    assert.equal(response.sourceDownloadsIngested, 1);
    assert.equal(response.sourceDownloadFailures, 1);
    assert.equal(response.issuesCreated, 1);
    assert.equal(response.batch.status, 'imported_with_issues');

    const copiedVersion = await prisma.digitalAssetVersion.findFirst({
      where: { sourceDownloadUrl: 'https://assets.example.test/download/widen-bulk-copy.pdf' },
    });
    assert.ok(copiedVersion);
    assert.equal(copiedVersion.externalUrl, null);
    assert.equal(copiedVersion.mimeType, 'application/pdf');
    assert.match(copiedVersion.storageKey, /digital-assets\/.+\/v1\/widen-bulk-copy\.pdf/);
    const stored = await readFile(path.join(process.env.APP_STORAGE_ROOT_DIR, copiedVersion.storageKey), 'utf8');
    assert.equal(stored, 'Bulk Widen bytes');

    const failedIssue = await prisma.digitalAssetMigrationIssue.findFirst({
      where: { issueCode: 'source_download_ingest_failed' },
    });
    assert.ok(failedIssue);
    assert.equal(failedIssue.externalAssetId, 'widen-bulk-fail');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('asset share links can be created, resolved, counted, and revoked', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-share-link');
  const created = await service.createDigitalAsset(actor, {
    title: 'Shareable brochure',
    kind: 'document',
    visibility: 'dealer_portal',
    audience: 'dealer',
    initialVersion: {
      externalUrl: 'https://cdn.example.test/assets/shareable-brochure.pdf',
      fileName: 'shareable-brochure.pdf',
      mimeType: 'application/pdf',
    },
  });

  const share = await service.createDigitalAssetShareLink(actor, created.id, {
    recipientType: 'prospect',
    recipientName: 'Jane Prospect',
    recipientEmail: 'jane@example.test',
    contextType: 'lead',
    contextId: 'lead-123',
    expiresInDays: 7,
    note: 'Proposal follow-up',
  });

  assert.equal(share.assetId, created.id);
  assert.equal(share.recipientEmail, 'jane@example.test');
  assert.match(share.shareUrl, /\/api\/v1\/digital-assets\/shares\//);
  const token = share.shareUrl.split('/').pop();
  const resolved = await service.resolveDigitalAssetShareLink(token);
  assert.equal(resolved.targetUrl, 'https://cdn.example.test/assets/shareable-brochure.pdf');

  const stored = await prisma.digitalAssetShareLink.findUnique({ where: { id: share.id } });
  assert.equal(stored.accessCount, 1);
  assert.ok(stored.lastAccessedAt);

  const revoked = await service.revokeDigitalAssetShareLink(actor, share.id);
  assert.equal(revoked.revoked, true);
  await assert.rejects(
    () => service.resolveDigitalAssetShareLink(token),
    /revoked/i,
  );

  const audits = await prisma.auditEntry.findMany({
    where: { entityType: 'DIGITAL_ASSET_SHARE_LINK', entityId: share.id },
  });
  assert.equal(audits.length, 2);
});

test('asset detail and library expose product and share usage summaries', SERIAL, async () => {
  const actor = await createActor('ADMIN_CSR_OPS', 'asset-usage-summary');
  const created = await service.createDigitalAsset(actor, {
    title: 'Usage tracked brochure',
    kind: 'document',
    visibility: 'dealer_portal',
    audience: 'dealer',
    initialVersion: {
      externalUrl: 'https://cdn.example.test/assets/usage-tracked-brochure.pdf',
      fileName: 'usage-tracked-brochure.pdf',
      mimeType: 'application/pdf',
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'USAGE-TRACKED',
      productName: 'Usage Tracked Product',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
    },
  });
  const presentation = await prisma.productPresentation.create({
    data: {
      baseProductId: product.id,
      displayName: 'Usage Tracked Product',
      shortDescription: 'Product with usage-tracked collateral.',
      businessSegment: 'RESIDENTIAL',
    },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: presentation.id,
      assetId: created.id,
      assetVersionId: created.currentVersionId,
      role: 'BROCHURE',
      brandLabel: 'Dynamic',
      regionScope: 'US',
    },
  });
  const share = await service.createDigitalAssetShareLink(actor, created.id, {
    recipientType: 'customer',
    recipientEmail: 'customer@example.test',
    expiresInDays: 10,
  });
  const token = share.shareUrl.split('/').pop();
  await service.resolveDigitalAssetShareLink(token);

  const detail = await service.getDigitalAssetDetail(actor, created.id);
  assert.equal(detail.productUsageCount, 1);
  assert.equal(detail.activeShareLinkCount, 1);
  assert.equal(detail.totalShareLinkAccessCount, 1);
  assert.equal(detail.productUsages.length, 1);
  assert.equal(detail.productUsages[0].productSku, 'USAGE-TRACKED');
  assert.equal(detail.productUsages[0].role, 'brochure');

  const listed = await service.listDigitalAssets(actor, { search: 'Usage tracked', limit: 10 });
  assert.equal(listed.items[0].productUsageCount, 1);
  assert.equal(listed.items[0].activeShareLinkCount, 1);
  assert.equal(listed.items[0].totalShareLinkAccessCount, 1);
});

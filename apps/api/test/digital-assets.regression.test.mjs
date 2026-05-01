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

import assert from 'node:assert/strict';
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

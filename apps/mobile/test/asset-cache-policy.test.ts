import test from 'node:test';
import assert from 'node:assert/strict';
import type { DigitalAssetSummary } from '@pulse/contracts/digital-assets';
import { toDisplaySafeMobileAssetCacheItem } from '../src/lib/asset-cache-policy.ts';

test('mobile asset cache strips URLs and raw legacy/source payloads', () => {
  const cached = toDisplaySafeMobileAssetCacheItem({
    activeShareLinkCount: 1,
    audience: 'dealer',
    createdAt: '2026-05-24T00:00:00.000Z',
    currentVersion: {
      assetId: 'asset-1',
      createdAt: '2026-05-24T00:00:00.000Z',
      externalUrl: 'https://widen.example.com/file.pdf',
      fileName: 'brochure.pdf',
      id: 'version-1',
      isCurrent: true,
      mimeType: 'application/pdf',
      publicUrl: 'https://cdn.example.com/file.pdf',
      sizeBytes: 1000,
      storageKey: 'private/file.pdf',
      versionNumber: 1,
    },
    currentVersionId: 'version-1',
    id: 'asset-1',
    kind: 'document',
    legacyFileName: 'legacy.pdf',
    legacyMetadata: { private: true },
    legacyUrl: 'https://legacy.example.com/file.pdf',
    rawSourcePayload: { secret: true },
    reviewStatus: 'approved',
    sourceOfTruthSystem: 'pulse',
    sourceSystem: 'widen',
    stableSlug: 'brochure',
    status: 'active',
    title: 'Brochure',
    updatedAt: '2026-05-24T00:00:00.000Z',
    versionCount: 1,
    visibility: 'dealer_portal',
  } as unknown as DigitalAssetSummary & { currentVersion: DigitalAssetSummary['currentVersion'] & { storageKey: string } });

  const serialized = JSON.stringify(cached);

  assert.equal(cached.currentVersion?.fileName, 'brochure.pdf');
  assert.equal(cached.currentVersion?.mimeType, 'application/pdf');
  assert.equal(serialized.includes('externalUrl'), false);
  assert.equal(serialized.includes('publicUrl'), false);
  assert.equal(serialized.includes('storageKey'), false);
  assert.equal(serialized.includes('legacyUrl'), false);
  assert.equal(serialized.includes('legacyMetadata'), false);
  assert.equal(serialized.includes('rawSourcePayload'), false);
});

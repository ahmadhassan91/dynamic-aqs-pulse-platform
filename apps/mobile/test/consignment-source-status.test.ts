import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSIGNMENT_SOURCE_STATE_META,
  deriveConsignmentSourceState,
} from '../src/lib/consignment-source-status.ts';

const now = new Date('2026-06-20T12:00:00.000Z');

test('parked when acumaticaStatus is parked', () => {
  assert.equal(deriveConsignmentSourceState({ acumaticaStatus: 'parked', now }), 'parked');
});

test('parked when sourceFreshnessLabel mentions parked', () => {
  assert.equal(deriveConsignmentSourceState({ sourceFreshnessLabel: 'acumatica_parked', now }), 'parked');
});

test('fresh when available and synced within the threshold', () => {
  assert.equal(
    deriveConsignmentSourceState({ acumaticaStatus: 'available', acumaticaLastSyncedAt: '2026-06-20T06:00:00.000Z', now }),
    'fresh',
  );
});

test('stale when available but synced beyond the threshold', () => {
  assert.equal(
    deriveConsignmentSourceState({ acumaticaStatus: 'available', acumaticaLastSyncedAt: '2026-06-18T06:00:00.000Z', now }),
    'stale',
  );
});

test('stale when available but never synced', () => {
  assert.equal(deriveConsignmentSourceState({ acumaticaStatus: 'available', now }), 'stale');
});

test('stale when the sync timestamp is unparseable (NaN guard, not silently fresh)', () => {
  assert.equal(deriveConsignmentSourceState({ acumaticaStatus: 'available', acumaticaLastSyncedAt: 'not-a-date', now }), 'stale');
  assert.equal(deriveConsignmentSourceState({ acumaticaStatus: 'available', acumaticaLastSyncedAt: '', now }), 'stale');
});

test('threshold boundary: age exactly == staleAfter stays fresh (strict >)', () => {
  const syncedExactlyAtThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  assert.equal(
    deriveConsignmentSourceState({ acumaticaStatus: 'available', acumaticaLastSyncedAt: syncedExactlyAtThreshold, now }),
    'fresh',
  );
});

test('manual when expectedSource indicates manual/import/seed', () => {
  assert.equal(deriveConsignmentSourceState({ acumaticaStatus: 'pending', expectedSource: 'manual_or_imported', now }), 'manual');
});

test('unknown fallback', () => {
  assert.equal(deriveConsignmentSourceState({ acumaticaStatus: 'pending', now }), 'unknown');
});

test('every state has a non-empty label, tone, and guidance', () => {
  for (const state of ['parked', 'stale', 'fresh', 'manual', 'unknown'] as const) {
    const meta = CONSIGNMENT_SOURCE_STATE_META[state];
    assert.ok(meta.label.length > 0 && meta.tone.length > 0 && meta.guidance.length > 0);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getMobileSyncUatGuidance, type MobileSyncUatSummaryInput } from '../src/lib/mobile-sync-uat-guidance.ts';

function summary(input: Partial<MobileSyncUatSummaryInput> = {}): MobileSyncUatSummaryInput {
  return {
    unsynced: 0,
    retryable: 0,
    readyToRetry: 0,
    needsReview: 0,
    signInAgain: 0,
    savedOnPhone: 0,
    syncing: 0,
    storageAvailable: true,
    storageHydrated: true,
    ...input,
  };
}

test('blocks field users from trusting drafts before phone storage is hydrated', () => {
  const guidance = getMobileSyncUatGuidance(summary({ storageHydrated: false }));

  assert.equal(guidance.title, 'Hold for a moment');
  assert.equal(guidance.tone, 'warning');
  assert.match(guidance.detail, /draft store is still opening/i);
});

test('warns users to keep the app open when durable storage is unavailable', () => {
  const guidance = getMobileSyncUatGuidance(summary({ storageAvailable: false, unsynced: 1 }));

  assert.equal(guidance.title, 'Keep the app open');
  assert.equal(guidance.tone, 'blocked');
  assert.match(guidance.detail, /not confirmed durable draft storage/i);
});

test('prioritizes sign-in and office review above blind retry', () => {
  assert.equal(getMobileSyncUatGuidance(summary({ retryable: 2, signInAgain: 1 })).title, 'Sign in again first');
  assert.equal(getMobileSyncUatGuidance(summary({ retryable: 2, needsReview: 1 })).title, 'Office review needed');
});

test('guides retryable and clean queues with simple next actions', () => {
  const retry = getMobileSyncUatGuidance(summary({ readyToRetry: 2, retryable: 2 }));
  const clear = getMobileSyncUatGuidance(summary());

  assert.equal(retry.title, 'Ready to send');
  assert.equal(retry.action, 'Retry ready updates');
  assert.equal(clear.title, 'All clear');
  assert.equal(clear.tone, 'ready');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getMobileDraftReviewState, isMobileDraftReviewRetryable, type MobileDraftReviewInput } from '../src/lib/mobile-draft-review-policy.ts';

function draft(input: Partial<MobileDraftReviewInput>): MobileDraftReviewInput {
  return {
    status: 'pending',
    ...input,
  };
}

test('categorizes pending drafts as saved on phone and retryable', () => {
  const review = getMobileDraftReviewState(draft({ status: 'pending' }));

  assert.equal(review.category, 'saved_on_phone');
  assert.equal(review.label, 'Saved on phone');
  assert.equal(review.canRetry, true);
  assert.equal(isMobileDraftReviewRetryable(draft({ status: 'pending' })), true);
});

test('categorizes retryable network failures as ready to retry', () => {
  const input = draft({
    status: 'failed',
    error: {
      kind: 'network',
      message: 'Network connection failed.',
      retryable: true,
    },
  });
  const review = getMobileDraftReviewState(input);

  assert.equal(review.category, 'ready_to_retry');
  assert.equal(review.label, 'Ready to retry');
  assert.equal(review.canRetry, true);
});

test('categorizes auth failures as sign in again and not retryable', () => {
  const input = draft({
    status: 'failed',
    error: {
      kind: 'auth',
      message: 'CRM needs a fresh sign-in.',
      retryable: false,
      statusCode: 401,
    },
  });
  const review = getMobileDraftReviewState(input);

  assert.equal(review.category, 'sign_in_again');
  assert.equal(review.label, 'Sign in again');
  assert.equal(review.needsAuth, true);
  assert.equal(review.canRetry, false);
  assert.equal(isMobileDraftReviewRetryable(input), false);
});

test('categorizes validation and conflict failures as review-only', () => {
  for (const input of [
    draft({
      status: 'failed',
      error: {
        kind: 'validation',
        message: 'CRM rejected the payload.',
        retryable: false,
        statusCode: 422,
      },
    }),
    draft({
      status: 'conflict',
      error: {
        kind: 'conflict',
        message: 'CRM has a newer record.',
        retryable: false,
        statusCode: 409,
      },
    }),
  ]) {
    const review = getMobileDraftReviewState(input);

    assert.equal(review.category, 'needs_review');
    assert.equal(review.label, 'Needs review');
    assert.equal(review.canRetry, false);
    assert.equal(isMobileDraftReviewRetryable(input), false);
  }
});

test('caps repeated blind retries after three attempts', () => {
  const input = draft({
    status: 'failed',
    retryCount: 3,
    error: {
      kind: 'server',
      message: 'CRM temporarily unavailable.',
      retryable: true,
      statusCode: 503,
    },
  });
  const review = getMobileDraftReviewState(input);

  assert.equal(review.category, 'needs_review');
  assert.equal(review.canRetry, false);
  assert.equal(isMobileDraftReviewRetryable(input), false);
});

test('categorizes syncing and synced drafts as non-retryable terminal/current states', () => {
  assert.equal(getMobileDraftReviewState(draft({ status: 'syncing' })).category, 'sending');
  assert.equal(getMobileDraftReviewState(draft({ status: 'synced' })).category, 'crm_saved');
  assert.equal(isMobileDraftReviewRetryable(draft({ status: 'syncing' })), false);
  assert.equal(isMobileDraftReviewRetryable(draft({ status: 'synced' })), false);
});

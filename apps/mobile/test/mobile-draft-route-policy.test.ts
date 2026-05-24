import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshRouteVisitCreateRequestForRetry } from '../src/lib/mobile-draft-route-policy.ts';

test('refreshes stale route visit scheduledAt before retry', () => {
  const now = new Date('2026-05-24T12:00:00.000Z');
  const request = {
    durationMinutes: 45,
    scheduledAt: '2026-05-24T11:00:00.000Z',
    trainerUserId: 'user-tm',
  };

  const refreshed = refreshRouteVisitCreateRequestForRetry(request, now);

  assert.equal(refreshed.scheduledAt, '2026-05-24T12:00:30.000Z');
});

test('keeps future route visit scheduledAt during retry', () => {
  const request = {
    durationMinutes: 45,
    scheduledAt: '2026-05-24T12:05:00.000Z',
    trainerUserId: 'user-tm',
  };

  const refreshed = refreshRouteVisitCreateRequestForRetry(request, new Date('2026-05-24T12:00:00.000Z'));

  assert.equal(refreshed, request);
});

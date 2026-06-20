import test from 'node:test';
import assert from 'node:assert/strict';
import { canNavigateWithPrecision, describeGeoPrecision } from '../src/lib/geo-precision.ts';

test('city_state pins are navigable but flagged approximate', () => {
  const info = describeGeoPrecision('city_state');
  assert.equal(info.canNavigate, true);
  assert.equal(info.isApproximate, true);
  assert.equal(canNavigateWithPrecision('city_state'), true);
});

test('state_fallback pins are too coarse to navigate', () => {
  const info = describeGeoPrecision('state_fallback');
  assert.equal(info.canNavigate, false);
  assert.equal(info.isApproximate, true);
  assert.equal(canNavigateWithPrecision('state_fallback'), false);
});

test('unknown precision stays approximate-but-navigable (no navigation regression)', () => {
  const info = describeGeoPrecision(undefined);
  assert.equal(info.isApproximate, true);
  assert.equal(canNavigateWithPrecision(undefined), true);
  assert.equal(canNavigateWithPrecision(null), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMiles,
  optimizeRouteOrder,
  roundMiles,
  routeLegMiles,
  routeTotalMiles,
  suggestedAccountIdsFromRoutePlans,
} from '../src/lib/route-planning.ts';

test('haversineMiles: one degree of latitude is ~69 miles; same point is 0', () => {
  assert.ok(Math.abs(haversineMiles({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 }) - 69.09) < 0.1);
  assert.equal(haversineMiles({ latitude: 30.2672, longitude: -97.7431 }, { latitude: 30.2672, longitude: -97.7431 }), 0);
});

test('haversineMiles: Austin → Dallas is ~182 miles straight-line', () => {
  const miles = haversineMiles({ latitude: 30.2672, longitude: -97.7431 }, { latitude: 32.7767, longitude: -96.797 });
  assert.ok(miles > 180 && miles < 195, `expected ~182, got ${miles}`);
});

test('routeLegMiles: first leg is null, subsequent legs are positive', () => {
  const legs = routeLegMiles([
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 0, longitude: 2 },
  ]);
  assert.equal(legs[0], null);
  assert.ok((legs[1] ?? 0) > 0);
  assert.ok((legs[2] ?? 0) > 0);
});

test('routeLegMiles / routeTotalMiles: legs touching an unlocated (null) stop are null and excluded', () => {
  const legs = routeLegMiles([{ latitude: 0, longitude: 0 }, null, { latitude: 0, longitude: 2 }]);
  assert.deepEqual(legs, [null, null, null]);
  assert.equal(routeTotalMiles([{ latitude: 0, longitude: 0 }, null, { latitude: 0, longitude: 2 }]), 0);
});

test('routeTotalMiles sums consecutive legs; <2 stops is 0', () => {
  assert.equal(routeTotalMiles([]), 0);
  assert.equal(routeTotalMiles([{ latitude: 0, longitude: 0 }]), 0);
  const total = routeTotalMiles([
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 0, longitude: 2 },
  ]);
  assert.ok(Math.abs(total - 2 * 69.09) < 0.5);
});

test('optimizeRouteOrder: nearest-neighbour from an origin reorders to A,B,C', () => {
  const ordered = optimizeRouteOrder(
    [
      { id: 'C', latitude: 0, longitude: 5 },
      { id: 'A', latitude: 0, longitude: 0 },
      { id: 'B', latitude: 0, longitude: 1 },
    ],
    { latitude: 0, longitude: -1 },
  );
  assert.deepEqual(ordered.map((s) => s.id), ['A', 'B', 'C']);
});

test('optimizeRouteOrder: <2 stops returns a copy unchanged', () => {
  assert.deepEqual(optimizeRouteOrder([]), []);
  const one = [{ id: 'X', latitude: 1, longitude: 2 }];
  const out = optimizeRouteOrder(one);
  assert.deepEqual(out, one);
  assert.notEqual(out, one); // new array (copy)
});

test('optimizeRouteOrder: no origin uses centroid and returns a permutation of all stops', () => {
  const input = [
    { id: 'A', latitude: 0, longitude: 0 },
    { id: 'B', latitude: 0, longitude: 1 },
    { id: 'C', latitude: 0, longitude: 5 },
  ];
  const out = optimizeRouteOrder(input);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((s) => s.id).sort(), ['A', 'B', 'C']);
});

test('roundMiles rounds to one decimal', () => {
  assert.equal(roundMiles(69.09123), 69.1);
  assert.equal(roundMiles(0), 0);
});

test('suggestedAccountIdsFromRoutePlans: account-only, de-duped, first-seen order across plans', () => {
  const ids = suggestedAccountIdsFromRoutePlans([
    { stops: [
      { recordType: 'account', recordId: 'a1' },
      { recordType: 'lead', recordId: 'l1' },
      { recordType: 'account', recordId: 'a2' },
    ] },
    { stops: [
      { recordType: 'account', recordId: 'a2' }, // duplicate across plans
      { recordType: 'account', recordId: 'a3' },
    ] },
  ]);
  assert.deepEqual(ids, ['a1', 'a2', 'a3']);
});

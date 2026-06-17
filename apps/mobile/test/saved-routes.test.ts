import test from 'node:test';
import assert from 'node:assert/strict';
import {
  capSavedRoutes,
  duplicateSavedRoute,
  isSavedRoute,
  parseSavedRoutes,
  removeSavedRoute,
  upsertSavedRoute,
  type SavedRoute,
} from '../src/lib/saved-routes.ts';

const route = (over: Partial<SavedRoute> = {}): SavedRoute => ({
  id: 'r1',
  name: 'Monday loop',
  stopIds: ['a1', 'a2'],
  dwellByStopId: { a1: 30, a2: 45 },
  startMinutes: 480,
  createdAt: '2026-06-16T08:00:00.000Z',
  updatedAt: '2026-06-16T08:00:00.000Z',
  ...over,
});

test('isSavedRoute accepts a well-formed route and rejects malformed shapes', () => {
  assert.equal(isSavedRoute(route()), true);
  assert.equal(isSavedRoute(null), false);
  assert.equal(isSavedRoute({ ...route(), stopIds: 'a1' }), false);
  assert.equal(isSavedRoute({ ...route(), stopIds: ['a1', 2] }), false);
  assert.equal(isSavedRoute({ ...route(), dwellByStopId: [] }), false); // array is not a record
  assert.equal(isSavedRoute({ ...route(), startMinutes: 'x' }), false);
  assert.equal(isSavedRoute({ ...route(), startMinutes: Number.NaN }), false);
  // dwell values must be finite numbers — a corrupt entry must not slip through and NaN-poison the ETA math
  assert.equal(isSavedRoute({ ...route(), dwellByStopId: { a1: '30' } }), false);
  assert.equal(isSavedRoute({ ...route(), dwellByStopId: { a1: null } }), false);
  assert.equal(isSavedRoute({ ...route(), dwellByStopId: { a1: Number.NaN } }), false);
});

test('capSavedRoutes keeps the most-recently-updated N in original order; under the cap is unchanged', () => {
  const list = [
    route({ id: 'r1', updatedAt: '2026-06-10T00:00:00.000Z' }),
    route({ id: 'r2', updatedAt: '2026-06-14T00:00:00.000Z' }),
    route({ id: 'r3', updatedAt: '2026-06-12T00:00:00.000Z' }),
  ];
  assert.equal(capSavedRoutes(list, 5), list); // under cap → unchanged reference
  // cap to 2 → drop the oldest-updated (r1), keep r2/r3 in their original order
  assert.deepEqual(capSavedRoutes(list, 2).map((r) => r.id), ['r2', 'r3']);
});

test('parseSavedRoutes is defensive: bad JSON, non-array, and corrupt entries never throw', () => {
  assert.deepEqual(parseSavedRoutes('not json'), []);
  assert.deepEqual(parseSavedRoutes('{"id":"r1"}'), []); // object, not array
  assert.deepEqual(parseSavedRoutes(JSON.stringify([route(), { id: 'bad' }])), [route()]); // drops corrupt
  assert.deepEqual(parseSavedRoutes(JSON.stringify([route()])), [route()]);
});

test('upsertSavedRoute inserts a new route and replaces an existing one by id', () => {
  const list = [route()];
  const added = upsertSavedRoute(list, route({ id: 'r2', name: 'North trip' }));
  assert.deepEqual(added.map((r) => r.id), ['r1', 'r2']);
  const replaced = upsertSavedRoute(added, route({ id: 'r1', name: 'Renamed' }));
  assert.equal(replaced.length, 2);
  assert.equal(replaced.find((r) => r.id === 'r1')?.name, 'Renamed');
});

test('removeSavedRoute drops only the matching id', () => {
  const list = [route(), route({ id: 'r2' })];
  assert.deepEqual(removeSavedRoute(list, 'r1').map((r) => r.id), ['r2']);
  assert.deepEqual(removeSavedRoute(list, 'missing').map((r) => r.id), ['r1', 'r2']);
});

test('duplicateSavedRoute copies under a new id/name/timestamp; source is untouched; missing id is a no-op', () => {
  const list = [route()];
  const dup = duplicateSavedRoute(list, 'r1', 'r1-copy', 'Monday loop copy', '2026-06-17T00:00:00.000Z');
  assert.equal(dup.length, 2);
  const copy = dup[1]!;
  assert.equal(copy.id, 'r1-copy');
  assert.equal(copy.name, 'Monday loop copy');
  assert.equal(copy.createdAt, '2026-06-17T00:00:00.000Z');
  assert.deepEqual(copy.stopIds, ['a1', 'a2']); // plan carried over
  assert.deepEqual(dup[0], route()); // source unchanged
  assert.deepEqual(duplicateSavedRoute(list, 'missing', 'x', 'y', 'z'), list);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { addStop, moveStop, removeStop, toggleStop } from '../src/lib/route-selection.ts';

test('addStop appends a new id and is a no-op (same reference) for a duplicate', () => {
  const list = ['a', 'b'];
  assert.deepEqual(addStop(list, 'c'), ['a', 'b', 'c']);
  assert.equal(addStop(list, 'a'), list); // already present → unchanged reference
});

test('removeStop drops only the matching id', () => {
  assert.deepEqual(removeStop(['a', 'b', 'c'], 'b'), ['a', 'c']);
  assert.deepEqual(removeStop(['a'], 'missing'), ['a']);
});

test('toggleStop adds when absent and removes when present', () => {
  assert.deepEqual(toggleStop(['a', 'b'], 'c'), ['a', 'b', 'c']);
  assert.deepEqual(toggleStop(['a', 'b'], 'a'), ['b']);
});

test('moveStop swaps with the neighbour in the given direction', () => {
  assert.deepEqual(moveStop(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']); // up
  assert.deepEqual(moveStop(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b']); // down
});

test('moveStop is a no-op (same reference) at the bounds or for a bad index', () => {
  const list = ['a', 'b', 'c'];
  assert.equal(moveStop(list, 0, -1), list); // first up
  assert.equal(moveStop(list, 2, 1), list); // last down
  assert.equal(moveStop(list, 5, -1), list); // out of range
});

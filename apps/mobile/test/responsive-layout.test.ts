import test from 'node:test';
import assert from 'node:assert/strict';
import { RESPONSIVE_BREAKPOINTS, deriveResponsiveLayout } from '../src/lib/responsive-layout.ts';

test('phones are single-column and uncapped (content fills width)', () => {
  const l = deriveResponsiveLayout(390);
  assert.equal(l.isTablet, false);
  assert.equal(l.isWide, false);
  assert.equal(l.columns, 1);
  assert.equal(l.contentMaxWidth, 390);
});

test('tablet width caps the content column and goes two-column', () => {
  const l = deriveResponsiveLayout(768);
  assert.equal(l.isTablet, true);
  assert.equal(l.isWide, false);
  assert.equal(l.columns, 2);
  assert.equal(l.contentMaxWidth, 760);
});

test('wide (landscape iPad) caps wider and goes three-column', () => {
  const l = deriveResponsiveLayout(1366);
  assert.equal(l.isWide, true);
  assert.equal(l.columns, 3);
  assert.equal(l.contentMaxWidth, 1040);
});

test('breakpoint boundaries are inclusive', () => {
  assert.equal(deriveResponsiveLayout(RESPONSIVE_BREAKPOINTS.tablet).isTablet, true);
  assert.equal(deriveResponsiveLayout(RESPONSIVE_BREAKPOINTS.tablet - 1).isTablet, false);
  assert.equal(deriveResponsiveLayout(RESPONSIVE_BREAKPOINTS.wide).isWide, true);
});

test('unknown/zero width is safe (single column, sensible default cap)', () => {
  const l = deriveResponsiveLayout(0);
  assert.equal(l.columns, 1);
  assert.equal(l.contentMaxWidth, 720);
});

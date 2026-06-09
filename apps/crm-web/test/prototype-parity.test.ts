import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTerritoryAssignmentImpactSummary,
  getCalendarPrototypeFilterOptions,
  getCalendarPrototypeViewOptions,
  getTerritoryNavigationLinks,
  getTerritoryPrototypeTabs,
  resolvePaperMapTerritoryStyle,
} from '../src/lib/prototype-parity.ts';

test('territory prototype tabs include admin config and calendar for admin users', () => {
  assert.deepEqual(getTerritoryPrototypeTabs(true), [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'map', label: 'Map View' },
    { value: 'list', label: 'Territory List' },
    { value: 'admin', label: 'Admin Config' },
    { value: 'calendar', label: 'Calendar' },
  ]);
});

test('territory prototype tabs hide admin config when the actor cannot administer territories', () => {
  assert.deepEqual(getTerritoryPrototypeTabs(false), [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'map', label: 'Map View' },
    { value: 'list', label: 'Territory List' },
    { value: 'calendar', label: 'Calendar' },
  ]);
});

test('territory sub-navigation matches the approved prototype labels', () => {
  assert.deepEqual(getTerritoryNavigationLinks(), [
    { label: 'Territory Hub', link: '/territories?tab=dashboard' },
    { label: 'Territory Map', link: '/territories?tab=map' },
    { label: 'Account List', link: '/territories?tab=list' },
  ]);
});

test('territory assignment impact summary tracks added and removed states like the prototype modal', () => {
  assert.deepEqual(
    buildTerritoryAssignmentImpactSummary(['CA', 'NV', 'AZ'], ['NV', 'UT', 'CA']),
    {
      assignedStates: ['CA', 'NV', 'UT'],
      addedStates: ['UT'],
      removedStates: ['AZ'],
      impactedStateCount: 2,
    },
  );
});

test('paper-map territory style resolves known manager colors and shipping hub labels', () => {
  assert.deepEqual(
    resolvePaperMapTerritoryStyle({
      managerName: 'John Baranzelli',
      shippingCenterName: 'Nevada Shipping',
    }),
    {
      color: '#F3EA3D',
      hubLabel: 'NV HUB',
      shippingLabel: 'Nevada Shipping',
    },
  );

  assert.deepEqual(
    resolvePaperMapTerritoryStyle({
      managerName: 'Don Hearn',
      shippingCenterName: 'New Jersey Shipping',
    }),
    {
      color: '#1778B7',
      hubLabel: 'NJ HUB',
      shippingLabel: 'New Jersey Shipping',
    },
  );
});

test('non-roster managers get a deterministic palette color (dynamic, not hardcoded by name)', () => {
  const first = resolvePaperMapTerritoryStyle({ managerName: 'New Field TM', colorKey: 'tm-user-123' });
  const repeat = resolvePaperMapTerritoryStyle({ managerName: 'New Field TM', colorKey: 'tm-user-123' });
  assert.match(first.color, /^#[0-9A-Fa-f]{6}$/);
  assert.equal(first.color, repeat.color); // deterministic for the same stable id -> stable color
  // the printed-map roster still overrides the dynamic fallback (parity preserved for known TMs)
  assert.equal(
    resolvePaperMapTerritoryStyle({ managerName: 'Don Hearn', colorKey: 'tm-user-123' }).color,
    '#1778B7',
  );
});

test('calendar prototype options keep day week month and list available in the live shell', () => {
  assert.deepEqual(getCalendarPrototypeViewOptions(), [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'list', label: 'List' },
  ]);
});

test('calendar prototype filters preserve the approved event-family wording', () => {
  assert.deepEqual(getCalendarPrototypeFilterOptions(), [
    { value: 'all', label: 'All Events' },
    { value: 'discovery', label: 'Discovery Calls' },
    { value: 'training', label: 'Training Sessions' },
    { value: 'visits', label: 'Site Visits' },
    { value: 'audits', label: 'Audits' },
  ]);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTerritoryAssignmentImpactSummary,
  getCalendarPrototypeViewOptions,
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

test('calendar prototype options keep day week month and list available in the live shell', () => {
  assert.deepEqual(getCalendarPrototypeViewOptions(), [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'list', label: 'List' },
  ]);
});

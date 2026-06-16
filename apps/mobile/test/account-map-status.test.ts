import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_MAP_STATUS_META,
  ACCOUNT_MAP_STATUS_ORDER,
  accountAddressKey,
  buildConsignmentSignalMap,
  deriveAccountMapStatus,
} from '../src/lib/account-map-status.ts';

const base = { lifecycleStatus: 'active' as const };

test('inactive / churned accounts map to inactive', () => {
  assert.equal(deriveAccountMapStatus({ ...base, lifecycleStatus: 'inactive' }), 'inactive');
  assert.equal(deriveAccountMapStatus({ ...base, lifecycleStatus: 'churned' }), 'inactive');
});

test('onboarding consignment takes precedence over a last order', () => {
  assert.equal(
    deriveAccountMapStatus({ ...base, lastOrderAt: '2026-01-01', consignment: { onboardingSiteCount: 1 } as never }),
    'onboarding',
  );
});

test('active account with a last order is sold', () => {
  assert.equal(deriveAccountMapStatus({ ...base, lastOrderAt: '2026-01-01' }), 'sold');
});

test('grouped (non-independent) account with no order is a member', () => {
  assert.equal(deriveAccountMapStatus({ ...base, groupClassification: 'affinity_only' }), 'member');
  assert.equal(deriveAccountMapStatus({ ...base, groupClassification: 'independent' }), 'active');
});

test('default active account maps to active', () => {
  assert.equal(deriveAccountMapStatus(base), 'active');
});

test('every status has hex color metadata', () => {
  for (const status of ACCOUNT_MAP_STATUS_ORDER) {
    assert.match(ACCOUNT_MAP_STATUS_META[status].color, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('an active consignment account maps to consignment / consignment_overdue ahead of sold', () => {
  const activeConsignmentSold = { ...base, lastOrderAt: '2026-01-01', consignment: { activeSiteCount: 1, onboardingSiteCount: 0 } as never };
  assert.equal(deriveAccountMapStatus(activeConsignmentSold), 'consignment');
  assert.equal(deriveAccountMapStatus(activeConsignmentSold, { isOverdue: false }), 'consignment');
  assert.equal(deriveAccountMapStatus(activeConsignmentSold, { isOverdue: true }), 'consignment_overdue');
});

test('an overdue signal is ignored unless the account has ACTIVE consignment sites', () => {
  // onboarding-only account: the overdue flag must not promote it to consignment_overdue
  assert.equal(
    deriveAccountMapStatus({ ...base, consignment: { activeSiteCount: 0, onboardingSiteCount: 1 } as never }, { isOverdue: true }),
    'onboarding',
  );
  // no consignment participation at all → existing derivation, signal ignored
  assert.equal(deriveAccountMapStatus({ ...base, lastOrderAt: '2026-01-01' }, { isOverdue: true }), 'sold');
});

test('inactive / churned take precedence over active consignment', () => {
  const consignment = { activeSiteCount: 2, onboardingSiteCount: 0 } as never;
  assert.equal(deriveAccountMapStatus({ ...base, lifecycleStatus: 'inactive', consignment }, { isOverdue: true }), 'inactive');
  assert.equal(deriveAccountMapStatus({ ...base, lifecycleStatus: 'churned', consignment }, { isOverdue: true }), 'inactive');
});

test('buildConsignmentSignalMap flags overdue only for ACTIVE sites; skips onboarding/suspended/exited', () => {
  const now = new Date('2026-06-16T00:00:00.000Z');
  const signals = buildConsignmentSignalMap(
    [
      { accountId: 'a1', status: 'active', nextAuditDueAt: '2026-05-01T00:00:00.000Z' }, // overdue active
      { accountId: 'a2', status: 'active', nextAuditDueAt: '2026-12-01T00:00:00.000Z' }, // future active
      { accountId: 'a2', status: 'active' }, // no due date
      { accountId: 'a3', status: 'onboarding_in_progress', nextAuditDueAt: '2026-01-01T00:00:00.000Z' }, // skipped (not active)
      { accountId: 'a4', status: 'exited', nextAuditDueAt: '2026-01-01T00:00:00.000Z' }, // skipped (not active)
      { accountId: 'a5', status: 'suspended', nextAuditDueAt: '2026-01-01T00:00:00.000Z' }, // skipped: overdue colour is active-only (the gate would discard it anyway)
    ],
    now,
  );
  assert.deepEqual(signals.get('a1'), { isOverdue: true });
  assert.equal(signals.get('a2'), undefined); // not overdue → absent
  assert.equal(signals.get('a3'), undefined);
  assert.equal(signals.get('a4'), undefined);
  assert.equal(signals.get('a5'), undefined);
});

test('buildConsignmentSignalMap overdue is order-independent and respects the boundary + empty', () => {
  const now = new Date('2026-06-16T00:00:00.000Z');
  // an overdue site seen AFTER a non-overdue site for the same account still flags overdue
  const ordered = buildConsignmentSignalMap(
    [
      { accountId: 'x', status: 'active', nextAuditDueAt: '2026-12-01T00:00:00.000Z' },
      { accountId: 'x', status: 'active', nextAuditDueAt: '2026-05-01T00:00:00.000Z' },
    ],
    now,
  );
  assert.deepEqual(ordered.get('x'), { isOverdue: true });
  // exactly == now is NOT overdue (strict <, matching countOverdueRoseSites)
  assert.equal(
    buildConsignmentSignalMap([{ accountId: 'b', status: 'active', nextAuditDueAt: '2026-06-16T00:00:00.000Z' }], now).get('b'),
    undefined,
  );
  assert.equal(buildConsignmentSignalMap([], now).size, 0);
});

test('accountAddressKey joins available parts and is null when empty', () => {
  assert.equal(accountAddressKey({ city: 'Austin', state: 'TX', postalCode: '78701' }), 'Austin, TX, 78701');
  assert.equal(accountAddressKey({ state: 'TX' }), 'TX');
  assert.equal(accountAddressKey({}), null);
  assert.equal(accountAddressKey({ city: '  ', state: '' }), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_MAP_STATUS_META,
  accountAddressKey,
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
  for (const status of ['sold', 'active', 'member', 'onboarding', 'inactive'] as const) {
    assert.match(ACCOUNT_MAP_STATUS_META[status].color, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('accountAddressKey joins available parts and is null when empty', () => {
  assert.equal(accountAddressKey({ city: 'Austin', state: 'TX', postalCode: '78701' }), 'Austin, TX, 78701');
  assert.equal(accountAddressKey({ state: 'TX' }), 'TX');
  assert.equal(accountAddressKey({}), null);
  assert.equal(accountAddressKey({ city: '  ', state: '' }), null);
});

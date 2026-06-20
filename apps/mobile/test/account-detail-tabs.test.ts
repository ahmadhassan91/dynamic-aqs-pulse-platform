import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_DETAIL_TABS,
  isConsignmentTabEnabled,
  resolveAccountConsignmentSites,
} from '../src/lib/account-detail-tabs.ts';

test('ACCOUNT_DETAIL_TABS lists the four FR-MOB-036 tabs in order', () => {
  assert.deepEqual(ACCOUNT_DETAIL_TABS.map((t) => t.key), ['overview', 'sales', 'consignment', 'history']);
});

test('resolveAccountConsignmentSites filters strictly by accountId', () => {
  const sites = [
    { accountId: 'a', name: '1' },
    { accountId: 'b', name: '2' },
    { accountId: 'a', name: '3' },
  ];
  assert.deepEqual(resolveAccountConsignmentSites(sites, 'a').map((s) => s.name), ['1', '3']);
  assert.deepEqual(resolveAccountConsignmentSites(sites, 'z'), []);
  assert.deepEqual(resolveAccountConsignmentSites(null, 'a'), []);
  assert.deepEqual(resolveAccountConsignmentSites(undefined, 'a'), []);
});

test('isConsignmentTabEnabled reflects whether the account has sites', () => {
  assert.equal(isConsignmentTabEnabled([{ accountId: 'a' }]), true);
  assert.equal(isConsignmentTabEnabled([]), false);
  assert.equal(isConsignmentTabEnabled(null), false);
  assert.equal(isConsignmentTabEnabled(undefined), false);
});

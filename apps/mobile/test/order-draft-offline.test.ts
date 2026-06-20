import test from 'node:test';
import assert from 'node:assert/strict';
import { addLine, buildCreateOrderDraftRequest, buildUpdateOrderDraftRequest, createEmptyOrderDraftForm } from '../src/lib/order-draft-form.ts';
import { buildOrderDraftOfflinePayload } from '../src/lib/order-draft-offline.ts';

function formWithLine() {
  let state = createEmptyOrderDraftForm('acct-1');
  state = addLine(state, { key: 'a', productName: 'Coil Cleaner', quantity: 2, lineNote: 'Blue label' });
  return state;
}

test('buildOrderDraftOfflinePayload makes a CREATE payload when there is no draft id', () => {
  const request = buildCreateOrderDraftRequest(formWithLine());
  const payload = buildOrderDraftOfflinePayload({ request, currentDraftId: undefined, accountId: 'acct-1', accountName: 'Acme' });
  assert.equal(payload.kind, 'order_draft');
  assert.equal(payload.isUpdate, false);
  assert.equal(payload.draftId, undefined);
  assert.equal(payload.accountId, 'acct-1');
  assert.equal(payload.accountName, 'Acme');
  assert.equal(payload.request.lines?.length, 1);
  assert.equal(payload.request.lines?.[0]?.lineNote, 'Blue label');
  // a create request carries the accountId; an update request does not
  assert.equal((payload.request as { accountId?: string }).accountId, 'acct-1');
});

test('buildOrderDraftOfflinePayload makes an UPDATE payload when a draft id exists', () => {
  const request = buildUpdateOrderDraftRequest(formWithLine());
  const payload = buildOrderDraftOfflinePayload({ request, currentDraftId: 'draft-9', accountId: 'acct-1', accountName: 'Acme' });
  assert.equal(payload.isUpdate, true);
  assert.equal(payload.draftId, 'draft-9');
  assert.equal(payload.request.lines?.length, 1);
  assert.equal(payload.request.lines?.[0]?.lineNote, 'Blue label');
});

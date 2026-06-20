import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_LINE_QUANTITY,
  addLine,
  adjustLineQuantity,
  buildCreateOrderDraftRequest,
  buildUpdateOrderDraftRequest,
  canSubmitOrderDraft,
  clampQuantity,
  createEmptyOrderDraftForm,
  estimatedSubtotalCents,
  getOrderDraftSubmitBlocker,
  isPricingEstimated,
  makeLineKey,
  orderDraftDetailToFormState,
  removeLine,
  setLineQuantity,
  setShipToLocation,
  totalLineUnits,
  updateLine,
  type OrderDraftLineDraft,
} from '../src/lib/order-draft-form.ts';

function line(overrides: Partial<OrderDraftLineDraft> = {}): OrderDraftLineDraft {
  return { key: 'line-1', productName: 'Coil Cleaner', quantity: 1, ...overrides };
}

test('createEmptyOrderDraftForm starts with the account and empty lines', () => {
  const state = createEmptyOrderDraftForm('acct-1');
  assert.equal(state.accountId, 'acct-1');
  assert.deepEqual(state.lines, []);
  assert.equal(state.customerPoNumber, '');
  assert.equal(state.notes, '');
  assert.equal(state.shipToLocationId, undefined);
});

test('clampQuantity floors at 1, caps at MAX, rounds, and survives NaN', () => {
  assert.equal(clampQuantity(0), 1);
  assert.equal(clampQuantity(-5), 1);
  assert.equal(clampQuantity(3.4), 3);
  assert.equal(clampQuantity(3.6), 4);
  assert.equal(clampQuantity(Number.NaN), 1);
  assert.equal(clampQuantity(MAX_LINE_QUANTITY + 10), MAX_LINE_QUANTITY);
});

test('addLine appends and clamps quantity; removeLine and updateLine target by key', () => {
  let state = createEmptyOrderDraftForm('acct-1');
  state = addLine(state, line({ key: 'a', quantity: 0 }));
  state = addLine(state, line({ key: 'b', productName: 'Filter', quantity: 2 }));
  assert.equal(state.lines.length, 2);
  assert.equal(state.lines[0]!.quantity, 1, 'quantity 0 clamps to 1 on add');

  state = updateLine(state, 'b', { productName: 'Filter XL' });
  assert.equal(state.lines[1]!.productName, 'Filter XL');
  assert.equal(state.lines[0]!.productName, 'Coil Cleaner', 'other lines untouched');

  state = removeLine(state, 'a');
  assert.equal(state.lines.length, 1);
  assert.equal(state.lines[0]!.key, 'b');
});

test('setLineQuantity and adjustLineQuantity clamp and ignore unknown keys', () => {
  let state = addLine(createEmptyOrderDraftForm('acct-1'), line({ key: 'a', quantity: 5 }));
  state = adjustLineQuantity(state, 'a', -2);
  assert.equal(state.lines[0]!.quantity, 3);
  state = adjustLineQuantity(state, 'a', -10);
  assert.equal(state.lines[0]!.quantity, 1, 'cannot go below 1');
  state = setLineQuantity(state, 'a', 12);
  assert.equal(state.lines[0]!.quantity, 12);
  const unchanged = adjustLineQuantity(state, 'missing', 5);
  assert.equal(unchanged, state, 'unknown key returns same state reference');
});

test('pricing derivations: estimated subtotal, pricing flag, total units', () => {
  const lines = [
    line({ key: 'a', quantity: 3, unitPriceCents: 1250 }),
    line({ key: 'b', quantity: 5 }), // no price
  ];
  assert.equal(estimatedSubtotalCents(lines), 3750);
  assert.equal(isPricingEstimated(lines), true);
  assert.equal(totalLineUnits(lines), 8);
  assert.equal(estimatedSubtotalCents([line({ quantity: 4 })]), 0);
  assert.equal(isPricingEstimated([line({ quantity: 4 })]), false);
});

test('submit blocker enforces account, at least one line, names, and positive quantities', () => {
  assert.equal(getOrderDraftSubmitBlocker(createEmptyOrderDraftForm('')), 'Missing account');
  assert.equal(getOrderDraftSubmitBlocker(createEmptyOrderDraftForm('acct-1')), 'Add at least one product line');

  const blankName = addLine(createEmptyOrderDraftForm('acct-1'), line({ productName: '   ' }));
  assert.equal(getOrderDraftSubmitBlocker(blankName), 'Every line needs a product name');

  const okState = addLine(createEmptyOrderDraftForm('acct-1'), line({ productName: 'Coil Cleaner', quantity: 2 }));
  assert.equal(getOrderDraftSubmitBlocker(okState), null);
  assert.equal(canSubmitOrderDraft(okState), true);
});

test('buildCreateOrderDraftRequest maps lines, trims, and omits empty optionals', () => {
  let state = createEmptyOrderDraftForm('acct-1');
  state = { ...state, customerPoNumber: '  PO-9 ', notes: '   ' };
  state = addLine(state, line({ key: 'a', baseProductId: 'p1', sku: ' SKU-1 ', productName: ' Coil Cleaner ', unitOfMeasure: 'CS', quantity: 3 }));
  state = addLine(state, line({ key: 'b', productName: 'Custom item', quantity: 1, lineNote: ' urgent ' }));

  const request = buildCreateOrderDraftRequest(state);
  assert.equal(request.accountId, 'acct-1');
  assert.equal(request.customerPoNumber, 'PO-9');
  assert.equal(request.notes, undefined, 'whitespace-only notes are omitted');
  assert.equal(request.shipToLocationId, undefined);
  assert.equal(request.lines?.length, 2);
  assert.deepEqual(request.lines?.[0], { productName: 'Coil Cleaner', quantity: 3, baseProductId: 'p1', sku: 'SKU-1', unitOfMeasure: 'CS' });
  assert.deepEqual(request.lines?.[1], { productName: 'Custom item', quantity: 1, lineNote: 'urgent' });
});

test('setShipToLocation sets the id, and clears it to truly absent when emptied', () => {
  const base = createEmptyOrderDraftForm('acct-1');
  const withShipTo = setShipToLocation(base, 'loc-1');
  assert.equal(withShipTo.shipToLocationId, 'loc-1');
  const cleared = setShipToLocation(withShipTo, undefined);
  assert.equal(cleared.shipToLocationId, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(cleared, 'shipToLocationId'), false, 'key is absent, not present-and-undefined');
});

test('buildUpdateOrderDraftRequest nulls emptied fields and replaces lines', () => {
  let state = createEmptyOrderDraftForm('acct-1');
  state = addLine(state, line({ key: 'a', productName: 'Coil Cleaner', quantity: 2 }));
  const request = buildUpdateOrderDraftRequest(state);
  assert.equal(request.customerPoNumber, null);
  assert.equal(request.notes, null);
  assert.equal(request.shipToLocationId, null);
  assert.equal(request.lines?.length, 1);

  const withShipTo = buildUpdateOrderDraftRequest({ ...state, shipToLocationId: 'loc-1', customerPoNumber: 'PO-1' });
  assert.equal(withShipTo.shipToLocationId, 'loc-1');
  assert.equal(withShipTo.customerPoNumber, 'PO-1');
});

test('orderDraftDetailToFormState round-trips a server detail into editable form state', () => {
  const state = orderDraftDetailToFormState({
    id: 'd1',
    accountId: 'acct-9',
    source: 'internal_on_behalf',
    status: 'draft',
    currencyCode: 'USD',
    subtotalCents: 0,
    lineCount: 1,
    pricingEstimated: false,
    createdAt: '2026-06-19T00:00:00.000Z',
    updatedAt: '2026-06-19T00:00:00.000Z',
    shipToLocationId: 'loc-2',
    customerPoNumber: 'PO-77',
    lines: [
      { id: 'l1', productName: 'Coil Cleaner', quantity: 4, baseProductId: 'p1', sku: 'SKU-1', position: 0 },
    ],
  });
  assert.equal(state.accountId, 'acct-9');
  assert.equal(state.shipToLocationId, 'loc-2');
  assert.equal(state.customerPoNumber, 'PO-77');
  assert.equal(state.notes, '');
  assert.equal(state.lines.length, 1);
  assert.equal(state.lines[0]!.key, makeLineKey('l1'));
  assert.equal(state.lines[0]!.baseProductId, 'p1');
  assert.equal(state.lines[0]!.quantity, 4);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let listOrderDrafts;
let getOrderDraftDetail;
let createOrderDraft;
let updateOrderDraft;
let submitOrderDraft;
let cancelOrderDraft;
let fulfillOrderDraft;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  const configModule = await import('../dist/config.js');
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
  ({
    listOrderDrafts,
    getOrderDraftDetail,
    createOrderDraft,
    updateOrderDraft,
    submitOrderDraft,
    cancelOrderDraft,
    fulfillOrderDraft,
  } = await import('../dist/modules/orders/service.js'));

  config = configModule.loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  await ensureBootstrapAdminSeeded(config);
});

async function createAdminActor() {
  const auth = await loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );

  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? 'Pulse Bootstrap Admin',
  };
}

async function createScopedActor(role, email, displayName) {
  const user = await prisma.user.create({
    data: { email, displayName, roleCode: role, userType: 'INTERNAL', isActive: true },
  });
  return {
    userId: user.id,
    sessionId: `test-${user.id}`,
    role,
    actorType: 'internal',
    email: user.email,
    displayName: user.displayName,
  };
}

async function createAccountRow(overrides = {}) {
  return prisma.account.create({
    data: {
      displayName: overrides.displayName ?? 'Order Test Account',
      isActive: true,
      ...overrides,
    },
  });
}

async function createProductRow(sku, overrides = {}) {
  return prisma.baseProduct.create({
    data: {
      sku,
      productName: overrides.productName ?? 'Coil Cleaner',
      uom: overrides.uom ?? 'EA',
      ...overrides,
    },
  });
}

test('creates an order draft on behalf of an account with line snapshots and estimated pricing', SERIAL, async () => {
  const actor = await createAdminActor();
  const account = await createAccountRow({ displayName: 'Harbor HVAC' });
  const product = await createProductRow('SKU-COIL-1', { productName: 'Coil Cleaner', uom: 'CS' });

  const created = await createOrderDraft(actor, {
    accountId: account.id,
    customerPoNumber: 'PO-1001',
    notes: 'Spring restock',
    lines: [
      { baseProductId: product.id, quantity: 3, unitPriceCents: 1250 },
      { productName: 'Misc fitting', quantity: 5 },
    ],
  });

  assert.equal(created.accountId, account.id);
  assert.equal(created.accountName, 'Harbor HVAC');
  assert.equal(created.status, 'draft');
  assert.equal(created.currencyCode, 'USD');
  assert.equal(created.lineCount, 2);
  assert.equal(created.subtotalCents, 3750);
  assert.equal(created.pricingEstimated, true);
  assert.equal(created.customerPoNumber, 'PO-1001');
  assert.equal(created.createdByName, actor.displayName);
  assert.equal(created.lines.length, 2);

  const [priced, freeText] = created.lines;
  assert.equal(priced.baseProductId, product.id);
  assert.equal(priced.sku, 'SKU-COIL-1');
  assert.equal(priced.productName, 'Coil Cleaner');
  assert.equal(priced.unitOfMeasure, 'CS');
  assert.equal(priced.quantity, 3);
  assert.equal(priced.unitPriceCents, 1250);
  assert.equal(priced.lineSubtotalCents, 3750);
  assert.equal(priced.position, 0);

  assert.equal(freeText.baseProductId, undefined);
  assert.equal(freeText.productName, 'Misc fitting');
  assert.equal(freeText.unitPriceCents, undefined);
  assert.equal(freeText.lineSubtotalCents, undefined);
  assert.equal(freeText.position, 1);

  const auditCount = await prisma.auditEntry.count({ where: { entityType: 'ORDER_DRAFT', entityId: created.id } });
  assert.equal(auditCount, 1);
});

test('lists and fetches order drafts, filters by account and status', SERIAL, async () => {
  const actor = await createAdminActor();
  const accountA = await createAccountRow({ displayName: 'Account A' });
  const accountB = await createAccountRow({ displayName: 'Account B' });
  const product = await createProductRow('SKU-A');

  const draftA = await createOrderDraft(actor, { accountId: accountA.id, lines: [{ baseProductId: product.id, quantity: 1 }] });
  const draftB = await createOrderDraft(actor, { accountId: accountB.id, lines: [{ baseProductId: product.id, quantity: 2 }] });
  await submitOrderDraft(actor, draftB.id);

  const all = await listOrderDrafts(actor, {});
  assert.equal(all.total, 2);

  const onlyA = await listOrderDrafts(actor, { accountId: accountA.id });
  assert.equal(onlyA.total, 1);
  assert.equal(onlyA.items[0].id, draftA.id);

  const submitted = await listOrderDrafts(actor, { status: 'submitted' });
  assert.equal(submitted.total, 1);
  assert.equal(submitted.items[0].id, draftB.id);

  const detail = await getOrderDraftDetail(actor, draftA.id);
  assert.ok(detail);
  assert.equal(detail.id, draftA.id);
  assert.equal(detail.lines.length, 1);

  const missing = await getOrderDraftDetail(actor, '00000000-0000-0000-0000-000000000000');
  assert.equal(missing, null);
});

test('updates a draft by replacing lines and recomputes totals; blocks edits after submit', SERIAL, async () => {
  const actor = await createAdminActor();
  const account = await createAccountRow();
  const product = await createProductRow('SKU-UPD');

  const draft = await createOrderDraft(actor, {
    accountId: account.id,
    lines: [{ baseProductId: product.id, quantity: 1, unitPriceCents: 100 }],
  });
  assert.equal(draft.subtotalCents, 100);

  const updated = await updateOrderDraft(actor, draft.id, {
    notes: 'revised',
    lines: [
      { baseProductId: product.id, quantity: 2, unitPriceCents: 250 },
      { productName: 'Add-on', quantity: 1, unitPriceCents: 500 },
    ],
  });
  assert.equal(updated.notes, 'revised');
  assert.equal(updated.lineCount, 2);
  assert.equal(updated.subtotalCents, 1000);

  const stored = await prisma.orderDraftLine.count({ where: { orderDraftId: draft.id } });
  assert.equal(stored, 2, 'old lines should be replaced, not appended');

  await submitOrderDraft(actor, draft.id);
  await assert.rejects(
    () => updateOrderDraft(actor, draft.id, { notes: 'too late' }),
    /Only draft orders can be edited/,
  );
});

test('submit requires at least one line and records the submitter', SERIAL, async () => {
  const actor = await createAdminActor();
  const account = await createAccountRow();
  const product = await createProductRow('SKU-SUB');

  const empty = await createOrderDraft(actor, { accountId: account.id });
  await assert.rejects(() => submitOrderDraft(actor, empty.id), /at least one line/);

  await updateOrderDraft(actor, empty.id, { lines: [{ baseProductId: product.id, quantity: 1 }] });
  const submitted = await submitOrderDraft(actor, empty.id, { referenceCode: 'REF-9' });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.referenceCode, 'REF-9');
  assert.equal(submitted.submittedByName, actor.displayName);
  assert.ok(submitted.submittedAt);
});

test('cancel and fulfill transitions enforce status guards', SERIAL, async () => {
  const actor = await createAdminActor();
  const account = await createAccountRow();
  const product = await createProductRow('SKU-TR');

  // Fulfill only from submitted.
  const draft = await createOrderDraft(actor, { accountId: account.id, lines: [{ baseProductId: product.id, quantity: 1 }] });
  await assert.rejects(() => fulfillOrderDraft(actor, draft.id), /Only submitted orders can be marked fulfilled/);
  await submitOrderDraft(actor, draft.id);
  const fulfilled = await fulfillOrderDraft(actor, draft.id);
  assert.equal(fulfilled.status, 'fulfilled');
  assert.ok(fulfilled.fulfilledAt);
  await assert.rejects(() => fulfillOrderDraft(actor, draft.id), /Only submitted orders/);
  await assert.rejects(() => cancelOrderDraft(actor, draft.id), /Cannot cancel an order in status fulfilled/);

  // Cancel from draft.
  const draft2 = await createOrderDraft(actor, { accountId: account.id, lines: [{ baseProductId: product.id, quantity: 1 }] });
  const cancelled = await cancelOrderDraft(actor, draft2.id, { cancelReason: 'duplicate' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelReason, 'duplicate');
  assert.ok(cancelled.cancelledAt);
});

test('territory manager only sees and creates drafts for accounts in their book', SERIAL, async () => {
  const admin = await createAdminActor();
  const tm = await createScopedActor('TERRITORY_MANAGER', 'tm-orders@test.local', 'TM Orders');
  const other = await createScopedActor('TERRITORY_MANAGER', 'tm-other@test.local', 'TM Other');

  const mine = await createAccountRow({ displayName: 'My Book', assignedTmUserId: tm.userId });
  const theirs = await createAccountRow({ displayName: 'Their Book', assignedTmUserId: other.userId });
  const product = await createProductRow('SKU-SCOPE');

  const created = await createOrderDraft(tm, { accountId: mine.id, lines: [{ baseProductId: product.id, quantity: 1 }] });
  assert.equal(created.accountId, mine.id);

  await assert.rejects(
    () => createOrderDraft(tm, { accountId: theirs.id, lines: [{ baseProductId: product.id, quantity: 1 }] }),
    /Account not found/,
  );

  // Admin creates a draft on the out-of-book account; the TM must not see it.
  const hidden = await createOrderDraft(admin, { accountId: theirs.id, lines: [{ baseProductId: product.id, quantity: 1 }] });
  const tmList = await listOrderDrafts(tm, {});
  assert.equal(tmList.total, 1);
  assert.equal(tmList.items[0].id, created.id);
  assert.equal(await getOrderDraftDetail(tm, hidden.id), null);
});

test('rejects access for roles without the orders module', SERIAL, async () => {
  const trainingActor = await createScopedActor('TRAINING_OPS', 'training-orders@test.local', 'Training Ops');
  await assert.rejects(
    () => listOrderDrafts(trainingActor, {}),
    (error) => error.name === 'AuthorizationError',
  );
});

test('validates line quantity, unknown products, and ship-to ownership', SERIAL, async () => {
  const actor = await createAdminActor();
  const account = await createAccountRow();
  const otherAccount = await createAccountRow({ displayName: 'Other' });
  const product = await createProductRow('SKU-VAL');
  const otherLocation = await prisma.accountLocation.create({
    data: { accountId: otherAccount.id, name: 'Other Dock', isPrimary: true },
  });

  await assert.rejects(
    () => createOrderDraft(actor, { accountId: account.id, lines: [{ baseProductId: product.id, quantity: 0 }] }),
    /quantity must be a positive integer/,
  );

  await assert.rejects(
    () => createOrderDraft(actor, { accountId: account.id, lines: [{ baseProductId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] }),
    /unknown product/,
  );

  await assert.rejects(
    () => createOrderDraft(actor, { accountId: account.id, shipToLocationId: otherLocation.id, lines: [{ baseProductId: product.id, quantity: 1 }] }),
    /Ship-to location does not belong to this account/,
  );

  await assert.rejects(
    () => createOrderDraft(actor, { accountId: account.id, lines: [{ baseProductId: product.id, quantity: 2_000_000 }] }),
    /quantity must be a positive integer no greater than/,
  );

  await assert.rejects(
    () => createOrderDraft(actor, {
      accountId: account.id,
      lines: [{ baseProductId: product.id, quantity: 1000, unitPriceCents: 100_000_000 }],
    }),
    /Order subtotal exceeds the maximum supported amount/,
  );
});

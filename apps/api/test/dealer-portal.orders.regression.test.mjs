import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let authenticateAccessToken;
let provisionDealerPortalUser;
let getCurrentDealerPortalCart;
let addCurrentDealerPortalCartItem;
let submitCurrentDealerPortalOrder;
let getCurrentDealerPortalOrders;
let getCurrentDealerPortalOrder;
let listOrderDrafts;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    provisionDealerPortalUser,
    getCurrentDealerPortalCart,
    addCurrentDealerPortalCartItem,
    submitCurrentDealerPortalOrder,
    getCurrentDealerPortalOrders,
    getCurrentDealerPortalOrder,
  } = await import('../dist/modules/dealer-portal/service.js'));
  ({ listOrderDrafts } = await import('../dist/modules/orders/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

  config = loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
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

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected a bootstrap admin actor');
  return actor;
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

// Seed a dealer-portal-ready account with a default catalog view that exposes a single published,
// dealer-ready presentation so add-to-cart re-validates against a live visible catalog item. Mirrors
// dealer-portal.regression.test.mjs seeding patterns. Returns the fixture + the visible presentation.
async function seedPortalReadyAccountWithCatalog(actor, options = {}) {
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });
  const region = await prisma.region.create({
    data: {
      code: options.regionCode ?? 'dealer_region',
      name: options.regionName ?? 'Dealer Region',
      directorUserId: actor.userId,
      isActive: true,
    },
  });
  const territory = await prisma.territory.create({
    data: {
      code: options.territoryCode ?? 'dealer_territory',
      name: options.territoryName ?? 'Dealer Territory',
      regionId: region.id,
      managerUserId: actor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const account = await prisma.account.create({
    data: {
      accountNumber: options.accountNumber ?? 'DLR-1001',
      displayName: options.companyName ?? 'Order Dealer Comfort',
      legalName: options.legalName ?? 'Order Dealer Comfort LLC',
      accountType: 'Dealer',
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: actor.userId,
      assignedRdUserId: actor.userId,
      isActive: options.isActive ?? true,
      contacts: {
        create: {
          firstName: 'Dana',
          lastName: 'Dealer',
          email: options.email ?? 'order-dealer@portal.test',
          title: 'Owner',
          isPrimary: true,
          isActive: true,
        },
      },
      locations: {
        create: {
          name: 'Main Office',
          city: 'Dallas',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
          isActive: true,
        },
      },
    },
    include: {
      contacts: true,
      locations: true,
    },
  });

  // The default catalog view is resolved globally (lowest precedence/name) — it is NOT per-account.
  // Pass a shared `catalogView` to seed multiple accounts against the SAME default view, mirroring
  // how the resolver actually picks the single active default.
  const catalogView = options.catalogView ?? await prisma.dealerCatalogView.create({
    data: {
      code: options.catalogViewCode ?? 'order-standard-dealer-test',
      name: options.catalogViewName ?? 'Order Standard Dealer Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 10,
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: options.sku ?? 'ORD-100',
      productName: options.productName ?? 'Orderable Air Cleaner',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      uom: 'EA',
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const presentation = await prisma.productPresentation.create({
    data: {
      baseProductId: product.id,
      displayName: options.presentationName ?? 'Dealer Orderable Air Cleaner',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  await prisma.catalogInclusion.create({
    data: {
      presentationId: presentation.id,
      dealerCatalogViewId: catalogView.id,
      dealerGroupType: 'all_dealers',
      isVisible: true,
      publishStatus: 'PUBLISHED',
    },
  });

  return {
    account,
    contact: account.contacts[0],
    location: account.locations[0],
    territory,
    region,
    shippingCenter,
    catalogView,
    product,
    presentation,
  };
}

async function provisionDealerActor(actor, fixture, accessRole = 'purchasing') {
  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole,
  });
  const dealerAuth = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);
  assert.ok(dealerActor, 'expected a dealer portal actor');
  assert.equal(dealerActor.role, 'DEALER_PORTAL_USER');
  return { provisioned, dealerActor };
}

test('dealer adds a catalog item to their cart and the cart reflects it', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccountWithCatalog(actor, {
    companyName: 'Add To Cart Dealer Comfort',
    email: 'add-to-cart@portal.test',
  });
  const { dealerActor } = await provisionDealerActor(actor, fixture);

  const empty = await getCurrentDealerPortalCart(dealerActor);
  assert.equal(empty.lineCount, 0);
  assert.equal(empty.lines.length, 0);
  assert.equal(empty.totalUnits, 0);

  const cart = await addCurrentDealerPortalCartItem(dealerActor, {
    presentationId: fixture.presentation.id,
    quantity: 3,
  });
  assert.equal(cart.lineCount, 1);
  assert.equal(cart.lines.length, 1);
  assert.equal(cart.totalUnits, 3);
  assert.equal(cart.lines[0].baseProductId, fixture.product.id);
  assert.equal(cart.lines[0].sku, 'ORD-100');
  assert.equal(cart.lines[0].quantity, 3);
  assert.equal(cart.lines[0].position, 0);
  // No price anywhere in the dealer cart line.
  assert.ok(!('unitPriceCents' in cart.lines[0]), 'cart line must not carry a unit price');
  assert.ok(!('lineSubtotalCents' in cart.lines[0]), 'cart line must not carry a subtotal');

  // Adding the same product again merges onto the existing line (idempotent per product).
  const merged = await addCurrentDealerPortalCartItem(dealerActor, {
    presentationId: fixture.presentation.id,
    quantity: 2,
  });
  assert.equal(merged.lineCount, 1);
  assert.equal(merged.lines[0].quantity, 5);
  assert.equal(merged.totalUnits, 5);

  // The persistent cart is a single DRAFT OrderDraft, source DEALER_SELF_SERVICE, scoped to the
  // dealer's own account, created by the dealer user — no pricing stored.
  const drafts = await prisma.orderDraft.findMany({
    where: { accountId: fixture.account.id },
  });
  assert.equal(drafts.length, 1);
  const draft = drafts[0];
  assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.source, 'DEALER_SELF_SERVICE');
  assert.equal(draft.accountId, fixture.account.id);
  assert.equal(draft.createdByUserId, dealerActor.userId);
  assert.equal(draft.subtotalCents, 0);
  assert.equal(draft.pricingEstimated, false);

  const storedLine = await prisma.orderDraftLine.findFirst({ where: { orderDraftId: draft.id } });
  assert.ok(storedLine);
  assert.equal(storedLine.quantity, 5);
  assert.equal(storedLine.unitPriceCents, null);
});

test('submit requires a PO number and at least one cart line', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccountWithCatalog(actor, {
    companyName: 'Submit Guard Dealer Comfort',
    email: 'submit-guard@portal.test',
  });
  const { dealerActor } = await provisionDealerActor(actor, fixture);

  // Empty cart: submitting with a PO still fails because there are no lines.
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(dealerActor, { poNumber: 'PO-EMPTY' }),
    /at least one product to your cart/i,
  );

  await addCurrentDealerPortalCartItem(dealerActor, {
    presentationId: fixture.presentation.id,
    quantity: 1,
  });

  // Cart has a line but the PO number is empty / whitespace.
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(dealerActor, { poNumber: '' }),
    /purchase order \(PO\) number is required/i,
  );
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(dealerActor, { poNumber: '   ' }),
    /purchase order \(PO\) number is required/i,
  );
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(dealerActor, {}),
    /purchase order \(PO\) number is required/i,
  );

  // The cart is untouched by the rejected submits (still a single DRAFT with one line).
  const cart = await getCurrentDealerPortalCart(dealerActor);
  assert.equal(cart.lineCount, 1);
  const drafts = await prisma.orderDraft.findMany({ where: { accountId: fixture.account.id } });
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].status, 'DRAFT');
});

test('submit advances the cart to SUBMITTED, lists it, and surfaces it in the internal triage queue', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccountWithCatalog(actor, {
    companyName: 'Triage Dealer Comfort',
    email: 'triage@portal.test',
  });
  const { dealerActor } = await provisionDealerActor(actor, fixture);

  await addCurrentDealerPortalCartItem(dealerActor, {
    presentationId: fixture.presentation.id,
    quantity: 4,
  });

  // No completed orders before submit.
  const before = await getCurrentDealerPortalOrders(dealerActor);
  assert.equal(before.total, 0);
  assert.equal(before.items.length, 0);

  const submitted = await submitCurrentDealerPortalOrder(dealerActor, {
    poNumber: 'PO-TRIAGE-1',
    shipToLocationId: fixture.location.id,
    notes: 'Spring restock',
  });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.customerPoNumber, 'PO-TRIAGE-1');
  assert.equal(submitted.shipToLocationId, fixture.location.id);
  assert.equal(submitted.lineCount, 1);
  assert.equal(submitted.notes, 'Spring restock');
  assert.ok(submitted.submittedAt);

  // The underlying OrderDraft is now SUBMITTED, source stays DEALER_SELF_SERVICE, submitter recorded.
  const draft = await prisma.orderDraft.findUniqueOrThrow({ where: { id: submitted.id } });
  assert.equal(draft.status, 'SUBMITTED');
  assert.equal(draft.source, 'DEALER_SELF_SERVICE');
  assert.equal(draft.submittedByUserId, dealerActor.userId);
  assert.ok(draft.submittedAt);

  // It now appears in the dealer's completed-orders list and detail.
  const orders = await getCurrentDealerPortalOrders(dealerActor);
  assert.equal(orders.total, 1);
  assert.equal(orders.items.length, 1);
  assert.equal(orders.items[0].id, submitted.id);
  assert.equal(orders.items[0].status, 'submitted');
  assert.equal(orders.items[0].customerPoNumber, 'PO-TRIAGE-1');

  const detail = await getCurrentDealerPortalOrder(dealerActor, submitted.id);
  assert.ok(detail);
  assert.equal(detail.id, submitted.id);
  assert.equal(detail.lines.length, 1);
  assert.equal(detail.lines[0].sku, 'ORD-100');

  // Submitting drains the cart: a fresh cart is a new empty DRAFT.
  const cartAfter = await getCurrentDealerPortalCart(dealerActor);
  assert.equal(cartAfter.lineCount, 0);
  assert.notEqual(cartAfter.updatedAt, undefined);

  // It surfaces in the back-office /orders triage queue via the source filter (internal staff view).
  // The triage queue is submitted dealer orders; the source-only filter also includes the fresh empty
  // DRAFT cart re-created by getCurrentDealerPortalCart above, so the queue itself filters to submitted.
  const triage = await listOrderDrafts(actor, { source: 'dealer_self_service', status: 'submitted' });
  assert.equal(triage.total, 1);
  assert.equal(triage.items[0].id, submitted.id);
  assert.equal(triage.items[0].source, 'dealer_self_service');
  assert.equal(triage.items[0].status, 'submitted');
  assert.equal(triage.items[0].accountId, fixture.account.id);

  // The submitted dealer order is also present in the unfiltered source view (alongside the new cart).
  const allDealerSource = await listOrderDrafts(actor, { source: 'dealer_self_service' });
  assert.ok(allDealerSource.items.some((item) => item.id === submitted.id && item.source === 'dealer_self_service'));

  // The other source value does not pick up the dealer order.
  const internalSourceOnly = await listOrderDrafts(actor, { source: 'internal_on_behalf' });
  assert.equal(internalSourceOnly.total, 0);
});

test('account scoping isolates dealers from other accounts orders and ship-to locations', SERIAL, async () => {
  const actor = await createAdminActor();
  // Two dealer accounts that share the single global default catalog view. Account scope is enforced
  // by OrderDraft ownership (accountId + portal user), NOT by catalog visibility — both dealers can
  // see the shared catalog, but each can only read/write their OWN orders.
  const fixtureA = await seedPortalReadyAccountWithCatalog(actor, {
    companyName: 'Scope A Dealer Comfort',
    email: 'scope-a@portal.test',
    accountNumber: 'DLR-A',
    regionCode: 'scope_a_region',
    territoryCode: 'scope_a_territory',
    sku: 'SCOPE-A-100',
  });
  const fixtureB = await seedPortalReadyAccountWithCatalog(actor, {
    companyName: 'Scope B Dealer Comfort',
    email: 'scope-b@portal.test',
    accountNumber: 'DLR-B',
    regionCode: 'scope_b_region',
    territoryCode: 'scope_b_territory',
    sku: 'SCOPE-B-100',
    catalogView: fixtureA.catalogView,
  });
  const { dealerActor: dealerA } = await provisionDealerActor(actor, fixtureA);
  const { dealerActor: dealerB } = await provisionDealerActor(actor, fixtureB);

  // Dealer A submits an order for their own account.
  await addCurrentDealerPortalCartItem(dealerA, { presentationId: fixtureA.presentation.id, quantity: 1 });
  const orderA = await submitCurrentDealerPortalOrder(dealerA, { poNumber: 'PO-SCOPE-A' });
  assert.equal(orderA.status, 'submitted');

  // Dealer B cannot see or fetch dealer A's order — order list/detail is scoped to B's account only.
  const ordersForB = await getCurrentDealerPortalOrders(dealerB);
  assert.equal(ordersForB.total, 0);
  assert.equal(ordersForB.items.length, 0);
  assert.equal(await getCurrentDealerPortalOrder(dealerB, orderA.id), null);

  // Dealer A still sees their own order, confirming the isolation is per-account, not global.
  const ordersForA = await getCurrentDealerPortalOrders(dealerA);
  assert.equal(ordersForA.total, 1);
  assert.equal(ordersForA.items[0].id, orderA.id);

  // The submitted order's underlying OrderDraft is bound to A's account, not B's.
  const draftA = await prisma.orderDraft.findUniqueOrThrow({ where: { id: orderA.id } });
  assert.equal(draftA.accountId, fixtureA.account.id);
  assert.notEqual(draftA.accountId, fixtureB.account.id);

  // A ship-to location belonging to ANOTHER account is rejected on submit (derived from the portal
  // user's own account, never trusted from client input).
  await addCurrentDealerPortalCartItem(dealerB, { presentationId: fixtureB.presentation.id, quantity: 1 });
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(dealerB, {
      poNumber: 'PO-SCOPE-B',
      shipToLocationId: fixtureA.location.id,
    }),
    /Ship-to location does not belong to this dealer account/i,
  );

  // Dealer B can submit with their OWN ship-to location and the order is scoped to B's account.
  const orderB = await submitCurrentDealerPortalOrder(dealerB, {
    poNumber: 'PO-SCOPE-B',
    shipToLocationId: fixtureB.location.id,
  });
  assert.equal(orderB.status, 'submitted');
  assert.equal(orderB.shipToLocationId, fixtureB.location.id);
  const draftB = await prisma.orderDraft.findUniqueOrThrow({ where: { id: orderB.id } });
  assert.equal(draftB.accountId, fixtureB.account.id);
});

test('RBAC denies actors without dealer.order_* and read-only dealer roles cannot place orders', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccountWithCatalog(actor, {
    companyName: 'RBAC Dealer Comfort',
    email: 'rbac@portal.test',
  });

  // A territory manager has no dealer_portal module / dealer.order_* actions: every dealer order
  // entrypoint must throw an AuthorizationError.
  const tm = await createScopedActor('TERRITORY_MANAGER', 'tm-dealer-orders@test.local', 'TM Dealer Orders');
  await assert.rejects(
    () => getCurrentDealerPortalCart(tm),
    (error) => error.name === 'AuthorizationError',
  );
  await assert.rejects(
    () => addCurrentDealerPortalCartItem(tm, { presentationId: fixture.presentation.id, quantity: 1 }),
    (error) => error.name === 'AuthorizationError',
  );
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(tm, { poNumber: 'PO-TM' }),
    (error) => error.name === 'AuthorizationError',
  );
  await assert.rejects(
    () => getCurrentDealerPortalOrders(tm),
    (error) => error.name === 'AuthorizationError',
  );

  // A VIEWER-access dealer passes the module + view gates but is blocked from write operations by the
  // in-account ADMIN/PURCHASING gate (cannot add to cart or submit).
  const { dealerActor: viewer } = await provisionDealerActor(actor, fixture, 'viewer');

  // Viewer CAN read their (empty) cart and order list — order_view is granted to all dealers.
  const viewerCart = await getCurrentDealerPortalCart(viewer);
  assert.equal(viewerCart.lineCount, 0);
  const viewerOrders = await getCurrentDealerPortalOrders(viewer);
  assert.equal(viewerOrders.total, 0);

  // But cannot place orders.
  await assert.rejects(
    () => addCurrentDealerPortalCartItem(viewer, { presentationId: fixture.presentation.id, quantity: 1 }),
    /role cannot place orders/i,
  );
  await assert.rejects(
    () => submitCurrentDealerPortalOrder(viewer, { poNumber: 'PO-VIEWER' }),
    /role cannot place orders/i,
  );
});

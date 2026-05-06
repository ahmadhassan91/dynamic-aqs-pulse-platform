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
let getDealerPortalAccount;
let getDealerPortalInternalPreview;
let provisionDealerPortalUser;
let updateDealerPortalUserStatus;
let resetDealerPortalUserPassword;
let getCurrentDealerPortalDashboard;
let getCurrentDealerPortalCatalog;
let favoriteCurrentDealerPortalProduct;
let unfavoriteCurrentDealerPortalProduct;
let recordCurrentDealerPortalAssetOpen;
let createDealerPortalInvite;
let acceptDealerPortalInvite;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    getDealerPortalAccount,
    getDealerPortalInternalPreview,
    provisionDealerPortalUser,
    updateDealerPortalUserStatus,
    resetDealerPortalUserPassword,
    getCurrentDealerPortalDashboard,
    getCurrentDealerPortalCatalog,
    favoriteCurrentDealerPortalProduct,
    unfavoriteCurrentDealerPortalProduct,
    recordCurrentDealerPortalAssetOpen,
    createDealerPortalInvite,
    acceptDealerPortalInvite,
  } = await import('../dist/modules/dealer-portal/service.js'));
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

function actorWithRole(actor, role, actorType = actor.actorType) {
  return {
    ...actor,
    role,
    actorType,
  };
}

async function seedPortalReadyAccount(actor, options = {}) {
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
      displayName: options.companyName ?? 'Dealer Portal Comfort',
      legalName: options.legalName ?? 'Dealer Portal Comfort LLC',
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
          email: options.email ?? 'dealer@portal.test',
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
    },
  });

  return {
    account,
    contact: account.contacts[0],
    territory,
    region,
    shippingCenter,
  };
}

test('dealer portal provisioning creates membership and dealer dashboard context', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor);

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
    isPrimaryOwner: true,
  });

  assert.equal(provisioned.portalAccount.status, 'active');
  assert.equal(provisioned.portalAccount.accountId, fixture.account.id);
  assert.equal(provisioned.portalAccount.activePortalUsers, 1);
  assert.equal(provisioned.user.email, fixture.contact.email);
  assert.equal(provisioned.user.accessRole, 'purchasing');
  assert.equal(provisioned.user.isPrimaryOwner, true);
  assert.ok(provisioned.temporaryPassword);
  assert.ok(provisioned.inviteToken);
  assert.ok(provisioned.invitePath.startsWith('/dealer/accept-invite?token='));

  const detail = await getDealerPortalAccount(actor, fixture.account.id);
  assert.ok(detail);
  assert.equal(detail.accountId, fixture.account.id);
  assert.equal(detail.territoryName, fixture.territory.name);
  assert.equal(detail.regionName, fixture.region.name);
  assert.equal(detail.shippingCenterName, fixture.shippingCenter.name);
  assert.equal(detail.users.length, 1);

  const dealerAuth = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);
  assert.ok(dealerActor);
  assert.equal(dealerActor.role, 'DEALER_PORTAL_USER');

  const dashboard = await getCurrentDealerPortalDashboard(dealerActor);
  assert.equal(dashboard.portalAccount.accountId, fixture.account.id);
  assert.equal(dashboard.currentUser.email, fixture.contact.email);
  assert.equal(dashboard.currentUser.accessRole, 'purchasing');
  assert.equal(dashboard.companyUsers.length, 1);
  assert.equal(dashboard.contacts.length, 1);
  assert.equal(dashboard.locations.length, 1);
});

test('dealer portal invite token lets dealer set first password once', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Invite Dealer Comfort',
    email: 'invite@portal.test',
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'admin',
  });
  const invite = await createDealerPortalInvite(actor, provisioned.user.id);
  assert.equal(invite.user.email, fixture.contact.email);
  assert.ok(invite.inviteToken);
  assert.ok(invite.invitePath.includes(encodeURIComponent(invite.inviteToken)));

  const accepted = await acceptDealerPortalInvite({
    token: invite.inviteToken,
    password: 'DealerInvite123!',
  });
  assert.equal(accepted.email, fixture.contact.email);

  await assert.rejects(
    () =>
      acceptDealerPortalInvite({
        token: invite.inviteToken,
        password: 'DealerInvite123!',
      }),
    /invalid or has expired/i,
  );

  const dealerAuth = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: 'DealerInvite123!',
    },
    {},
  );
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);
  const dashboard = await getCurrentDealerPortalDashboard(dealerActor);
  assert.equal(dashboard.currentUser.email, fixture.contact.email);
  assert.ok(dashboard.currentUser.inviteAcceptedAt);
});

test('dealer portal catalog exposes only published dealer-ready products and files', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Catalog Dealer Comfort',
    email: 'catalog@portal.test',
  });

  const catalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'standard-dealer-test',
      name: 'Standard Dealer Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 10,
    },
  });
  const category = await prisma.productCategory.create({
    data: {
      code: 'air-cleaners',
      name: 'Air Cleaners',
      isActive: true,
      sortOrder: 10,
    },
  });
  const family = await prisma.productFamily.create({
    data: {
      code: 'media-air-cleaners',
      name: 'Media Air Cleaners',
      isActive: true,
      sortOrder: 10,
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'FM1-112',
      productName: 'Fixed Mount Air Cleaner',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      categoryId: category.id,
      familyId: family.id,
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const presentation = await prisma.productPresentation.create({
    data: {
      baseProductId: product.id,
      displayName: 'Dealer Fixed Mount Air Cleaner',
      shortDescription: 'Published dealer catalog item.',
      specSummary: '12 inch cabinet',
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
  const asset = await prisma.digitalAsset.create({
    data: {
      stableSlug: 'dealer-fixed-mount-air-cleaner-spec',
      title: 'Fixed Mount Spec Sheet',
      kind: 'DOCUMENT',
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      audience: 'dealer',
      legacyFileName: 'fixed-mount-spec.pdf',
      versions: {
        create: {
          versionNumber: 1,
          externalUrl: 'https://assets.example.test/fixed-mount-spec.pdf',
          fileName: 'fixed-mount-spec.pdf',
          isCurrent: true,
        },
      },
    },
    include: {
      versions: true,
    },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: presentation.id,
      assetId: asset.id,
      assetVersionId: asset.versions[0].id,
      role: 'SPEC_SHEET',
      isRequired: true,
      sortOrder: 10,
    },
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'viewer',
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

  const catalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(catalog.catalogView.name, 'Standard Dealer Catalog');
  assert.equal(catalog.products.length, 1);
  assert.equal(catalog.products[0].sku, 'FM1-112');
  assert.equal(catalog.products[0].categoryName, 'Air Cleaners');
  assert.equal(catalog.products[0].isFavorite, false);
  assert.equal(catalog.products[0].favoriteCount, 0);
  assert.equal(catalog.userFavorites.count, 0);
  assert.equal(catalog.products[0].assets.length, 1);
  assert.equal(catalog.products[0].assets[0].title, 'Fixed Mount Spec Sheet');
  assert.equal(catalog.products[0].assets[0].downloadUrl, 'https://assets.example.test/fixed-mount-spec.pdf');

  const favorite = await favoriteCurrentDealerPortalProduct(dealerActor, presentation.id);
  assert.equal(favorite.ok, true);
  assert.equal(favorite.presentationId, presentation.id);
  assert.equal(favorite.isFavorite, true);
  assert.equal(favorite.favoriteCount, 1);

  const favoritedCatalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(favoritedCatalog.products[0].isFavorite, true);
  assert.equal(favoritedCatalog.products[0].favoriteCount, 1);
  assert.deepEqual(favoritedCatalog.userFavorites.presentationIds, [presentation.id]);

  const assetOpen = await recordCurrentDealerPortalAssetOpen(dealerActor, asset.id);
  assert.equal(assetOpen.ok, true);
  assert.equal(assetOpen.assetId, asset.id);
  assert.equal(assetOpen.presentationId, presentation.id);
  assert.equal(assetOpen.targetUrl, 'https://assets.example.test/fixed-mount-spec.pdf');
  assert.equal(assetOpen.downloadUrl, 'https://assets.example.test/fixed-mount-spec.pdf');

  const assetAudit = await prisma.auditEntry.findFirst({
    where: {
      actorUserId: dealerActor.userId,
      action: 'EXPORT',
      entityType: 'DEALER_PORTAL_CATALOG_ASSET',
      entityId: asset.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  assert.ok(assetAudit);
  assert.equal(assetAudit.metadata.operation, 'dealer_portal.asset_open');
  assert.equal(assetAudit.metadata.presentationId, presentation.id);

  const unfavorite = await unfavoriteCurrentDealerPortalProduct(dealerActor, presentation.id);
  assert.equal(unfavorite.ok, true);
  assert.equal(unfavorite.isFavorite, false);
  assert.equal(unfavorite.favoriteCount, 0);

  const unfavoritedCatalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(unfavoritedCatalog.products[0].isFavorite, false);
  assert.equal(unfavoritedCatalog.products[0].favoriteCount, 0);
  assert.equal(unfavoritedCatalog.userFavorites.count, 0);
});

test('dealer portal internal preview returns visibility diagnostics for the selected account and role', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Preview Dealer Comfort',
    email: 'preview-catalog@portal.test',
  });

  const catalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'preview-standard-dealer-test',
      name: 'Preview Standard Dealer Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 10,
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'PV-100',
      productName: 'Preview Visible Product',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const presentation = await prisma.productPresentation.create({
    data: {
      baseProductId: product.id,
      displayName: 'Preview Visible Product',
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
  const asset = await prisma.digitalAsset.create({
    data: {
      stableSlug: 'preview-visible-product-spec',
      title: 'Preview Spec Sheet',
      kind: 'DOCUMENT',
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      audience: 'dealer',
      versions: {
        create: {
          versionNumber: 1,
          externalUrl: 'https://assets.example.test/preview-spec.pdf',
          fileName: 'preview-spec.pdf',
          isCurrent: true,
        },
      },
    },
    include: {
      versions: true,
    },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: presentation.id,
      assetId: asset.id,
      assetVersionId: asset.versions[0].id,
      role: 'SPEC_SHEET',
      sortOrder: 10,
    },
  });

  const preview = await getDealerPortalInternalPreview(actor, fixture.account.id, 'viewer');

  assert.equal(preview.preview.mode, 'internal_preview');
  assert.equal(preview.preview.readOnly, true);
  assert.equal(preview.preview.selectedRole, 'viewer');
  assert.equal(preview.preview.accountId, fixture.account.id);
  assert.equal(preview.portalAccount.accountId, fixture.account.id);
  assert.equal(preview.dashboard.companyUsers.length, 0);
  assert.equal(preview.dashboard.contacts.length, 1);
  assert.ok(!('currentUser' in preview.dashboard), 'preview must not fabricate a dealer currentUser');
  assert.equal(preview.catalog.catalogView.name, 'Preview Standard Dealer Catalog');
  assert.equal(preview.catalog.products.length, 1);
  assert.equal(preview.catalog.products[0].sku, 'PV-100');
  assert.equal(preview.catalog.products[0].assets.length, 1);
  assert.equal(preview.catalog.userFavorites.count, 0);
  assert.deepEqual(preview.catalog.userFavorites.presentationIds, []);
  assert.equal(preview.previewRole, 'viewer');
  assert.equal(preview.visibleProductCount, 1);
  assert.equal(preview.visibleFileCount, 1);
  assert.equal(preview.diagnostics.catalogView.id, catalogView.id);
  assert.equal(preview.diagnostics.catalogView.resolutionSource, 'default');
  assert.equal(preview.diagnostics.selectedPreviewRole, 'viewer');
  assert.equal(preview.diagnostics.visibleProductCount, 1);
  assert.equal(preview.diagnostics.visibleFileCount, 1);
  assert.equal(preview.diagnostics.productReasons[0].dealerSafeFileCount, 1);
  assert.equal(preview.diagnostics.blockedProductSummary.scanned, false);
  assert.ok(!('pricing' in preview.catalog.products[0]), 'preview catalog must not include pricing data');
  assert.ok(!('orders' in preview), 'preview must not include order data');
  assert.ok(!('invoices' in preview), 'preview must not include invoice data');
  assert.ok(!('payments' in preview), 'preview must not include payment data');
  assert.ok(!('credit' in preview), 'preview must not include credit enforcement data');

  const audit = await prisma.auditEntry.findFirst({
    where: {
      actorUserId: actor.userId,
      action: 'EXPORT',
      entityType: 'DEALER_PORTAL_INTERNAL_PREVIEW',
      entityId: fixture.account.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  assert.ok(audit);
  assert.equal(audit.metadata.operation, 'dealer_portal.internal_preview');
  assert.equal(audit.metadata.selectedRole, 'viewer');

  await assert.rejects(
    () => getDealerPortalInternalPreview(actorWithRole(actor, 'DEALER_PORTAL_USER', 'dealer'), fixture.account.id, 'viewer'),
    /cannot perform action|only available to internal staff/i,
  );
  await assert.rejects(
    () => getDealerPortalInternalPreview(actorWithRole(actor, 'SALES_BD_REP'), fixture.account.id, 'viewer'),
    /cannot access module|cannot perform action/i,
  );
});

test('inactive accounts cannot be provisioned for dealer portal access', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Inactive Dealer Comfort',
    email: 'inactive@portal.test',
    isActive: false,
  });

  await assert.rejects(
    () =>
      provisionDealerPortalUser(actor, fixture.account.id, {
        contactId: fixture.contact.id,
      }),
    /Inactive accounts cannot receive dealer portal access/i,
  );
});

test('suspending a dealer portal user revokes active sessions', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Suspend Dealer Comfort',
    email: 'suspend@portal.test',
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
  });

  const dealerAuth = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );
  assert.ok(dealerAuth.tokens.accessToken);

  const updated = await updateDealerPortalUserStatus(actor, provisioned.user.id, {
    status: 'suspended',
  });
  assert.equal(updated.user.status, 'suspended');
  assert.equal(updated.portalAccount.status, 'suspended');

  const revokedSessions = await prisma.session.findMany({
    where: {
      userId: provisioned.user.userId,
      revokedAt: { not: null },
    },
  });
  assert.ok(revokedSessions.length >= 1);
});

test('password reset revokes prior sessions and rotates login secret', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Reset Dealer Comfort',
    email: 'reset@portal.test',
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
  });

  await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: provisioned.temporaryPassword,
    },
    {},
  );

  const reset = await resetDealerPortalUserPassword(actor, provisioned.user.id, {});
  assert.equal(reset.email, fixture.contact.email);
  assert.ok(reset.temporaryPassword);

  await assert.rejects(
    () =>
      loginWithPassword(
        config,
        {
          email: fixture.contact.email,
          password: provisioned.temporaryPassword,
        },
        {},
      ),
    /Invalid email or password/i,
  );

  const nextLogin = await loginWithPassword(
    config,
    {
      email: fixture.contact.email,
      password: reset.temporaryPassword,
    },
    {},
  );
  assert.ok(nextLogin.tokens.accessToken);
});

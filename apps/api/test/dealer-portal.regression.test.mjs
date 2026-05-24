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
let createCurrentDealerPortalUser;
let updateCurrentDealerPortalUser;

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
    createCurrentDealerPortalUser,
    updateCurrentDealerPortalUser,
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

test('dealer portal admins can invite and revoke non-admin company users only', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Self Admin Dealer Comfort',
    email: 'self-admin@portal.test',
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'admin',
    isPrimaryOwner: true,
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

  const created = await createCurrentDealerPortalUser(dealerActor, {
    firstName: 'Pat',
    lastName: 'Purchaser',
    title: 'Purchasing Lead',
    email: 'pat.purchaser@portal.test',
    accessRole: 'purchasing',
  });
  assert.equal(created.user.email, 'pat.purchaser@portal.test');
  assert.equal(created.user.accessRole, 'purchasing');
  assert.ok(created.invitePath.includes(encodeURIComponent(created.inviteToken)));
  assert.equal(created.dashboard.companyUsers.length, 2);

  await assert.rejects(
    () => createCurrentDealerPortalUser(dealerActor, {
      firstName: 'Annie',
      lastName: 'Admin',
      email: 'annie.admin@portal.test',
      accessRole: 'admin',
    }),
    /cannot create additional admin users/i,
  );

  await assert.rejects(
    () => updateCurrentDealerPortalUser(dealerActor, provisioned.user.id, {
      status: 'deactivated',
    }),
    /cannot deactivate their own portal access/i,
  );

  const revoked = await updateCurrentDealerPortalUser(dealerActor, created.user.id, {
    status: 'deactivated',
  });
  assert.equal(revoked.user.status, 'deactivated');
  assert.equal(revoked.dashboard.companyUsers.find((user) => user.id === created.user.id)?.status, 'deactivated');

  const reactivated = await updateCurrentDealerPortalUser(dealerActor, created.user.id, {
    status: 'active',
  });
  assert.equal(reactivated.user.status, 'active');
});

test('non-admin dealer portal users cannot manage company portal users', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Self Admin Denied Dealer Comfort',
    email: 'self-admin-denied@portal.test',
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

  await assert.rejects(
    () => createCurrentDealerPortalUser(dealerActor, {
      firstName: 'Vic',
      lastName: 'Viewer',
      email: 'viewer.invite@portal.test',
      accessRole: 'viewer',
    }),
    /Only dealer portal admins can manage company portal users/i,
  );
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
  const pendingAsset = await prisma.digitalAsset.create({
    data: {
      stableSlug: 'dealer-fixed-mount-air-cleaner-pending',
      title: 'Pending Dealer Spec Sheet',
      kind: 'DOCUMENT',
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'PENDING_REVIEW',
      audience: 'dealer',
      legacyFileName: 'pending-spec.pdf',
      versions: {
        create: {
          versionNumber: 1,
          externalUrl: 'https://assets.example.test/pending-spec.pdf',
          fileName: 'pending-spec.pdf',
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
      assetId: pendingAsset.id,
      assetVersionId: pendingAsset.versions[0].id,
      role: 'SPEC_SHEET',
      sortOrder: 20,
    },
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
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
  assert.equal(catalog.products[0].assets.some((item) => item.title === 'Pending Dealer Spec Sheet'), false);

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

  await assert.rejects(
    () => recordCurrentDealerPortalAssetOpen(dealerActor, pendingAsset.id),
    /not visible in the current dealer catalog/i,
  );

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
  assert.equal(assetAudit.metadata.dealerPortalAccessRole, 'purchasing');
  assert.equal(assetAudit.metadata.catalogViewId, catalogView.id);
  assert.equal(assetAudit.metadata.catalogViewName, 'Standard Dealer Catalog');
  assert.equal(assetAudit.metadata.assetVisibility, 'dealer_portal');
  assert.equal(assetAudit.metadata.deliveryOutcome, 'url_opened');
  assert.equal(assetAudit.metadata.visibilitySource.source, 'dealer_catalog_view_assignment');

  const unfavorite = await unfavoriteCurrentDealerPortalProduct(dealerActor, presentation.id);
  assert.equal(unfavorite.ok, true);
  assert.equal(unfavorite.isFavorite, false);
  assert.equal(unfavorite.favoriteCount, 0);

  const unfavoritedCatalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(unfavoritedCatalog.products[0].isFavorite, false);
  assert.equal(unfavoritedCatalog.products[0].favoriteCount, 0);
  assert.equal(unfavoritedCatalog.userFavorites.count, 0);
});

test('dealer portal catalog resolves active membership rules before default catalog', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Affinity Dealer Comfort',
    email: 'affinity-catalog@portal.test',
  });
  const affinityGroup = await prisma.affinityGroupRef.create({
    data: {
      code: 'nexstar',
      name: 'Nexstar',
      groupType: 'BUYING_GROUP',
      isActive: true,
    },
  });
  await prisma.account.update({
    where: { id: fixture.account.id },
    data: {
      affinityGroupSelection: 'GROUP',
      affinityGroupId: affinityGroup.id,
      ownershipGroupSelection: 'NONE',
      groupClassification: 'AFFINITY_ONLY',
    },
  });

  const defaultCatalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'membership-default-test',
      name: 'Default Dealer Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 90,
    },
  });
  const affinityCatalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'membership-nexstar-test',
      name: 'Nexstar Dealer Catalog',
      kind: 'AFFINITY',
      resolverKey: 'nexstar',
      resolverLabel: 'Nexstar',
      isDefault: false,
      isActive: true,
      precedence: 10,
    },
  });
  await prisma.catalogRuleSet.create({
    data: {
      code: 'membership-rule-set-test',
      name: 'Membership Rule Set',
      status: 'ACTIVE',
      isActive: true,
      activatedAt: new Date(),
      rules: {
        create: [{
          name: 'Nexstar dealers see Nexstar catalog',
          priority: 10,
          conditions: [{ field: 'affinity_group', operator: 'is', value: 'nexstar' }],
          resultAction: 'ASSIGN_CATALOG_VIEW',
          dealerCatalogViewId: affinityCatalogView.id,
          isEnabled: true,
        }],
      },
    },
  });

  const defaultProduct = await prisma.baseProduct.create({
    data: {
      sku: 'DEF-100',
      productName: 'Default Only Product',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const defaultPresentation = await prisma.productPresentation.create({
    data: {
      baseProductId: defaultProduct.id,
      displayName: 'Default Only Product',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  await prisma.catalogInclusion.create({
    data: {
      presentationId: defaultPresentation.id,
      dealerCatalogViewId: defaultCatalogView.id,
      dealerGroupType: 'standard',
      isVisible: true,
      publishStatus: 'PUBLISHED',
    },
  });
  const affinityProduct = await prisma.baseProduct.create({
    data: {
      sku: 'NEX-100',
      productName: 'Nexstar Visible Product',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const affinityPresentation = await prisma.productPresentation.create({
    data: {
      baseProductId: affinityProduct.id,
      displayName: 'Nexstar Visible Product',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  await prisma.catalogInclusion.create({
    data: {
      presentationId: affinityPresentation.id,
      dealerCatalogViewId: affinityCatalogView.id,
      dealerGroupType: 'affinity',
      isVisible: true,
      publishStatus: 'PUBLISHED',
    },
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
  });
  const dealerAuth = await loginWithPassword(config, {
    email: fixture.contact.email,
    password: provisioned.temporaryPassword,
  }, {});
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);

  const catalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(catalog.catalogView.name, 'Nexstar Dealer Catalog');
  assert.equal(catalog.catalogView.kind, 'affinity');
  assert.deepEqual(catalog.products.map((product) => product.sku), ['NEX-100']);

  const preview = await getDealerPortalInternalPreview(actor, fixture.account.id, 'viewer');
  assert.equal(preview.diagnostics.catalogResolution.source, 'rule');
  assert.equal(preview.diagnostics.catalogResolution.ruleName, 'Nexstar dealers see Nexstar catalog');
  assert.equal(preview.diagnostics.membershipContext.affinityGroupName, 'Nexstar');
  assert.equal(preview.diagnostics.membershipContext.independent, false);
});

test('dealer portal review rules block default catalog fallback for ambiguous memberships', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Hybrid Review Dealer Comfort',
    email: 'hybrid-review@portal.test',
  });
  const affinityGroup = await prisma.affinityGroupRef.create({
    data: {
      code: 'nexstar-hybrid',
      name: 'Nexstar Hybrid',
      groupType: 'BUYING_GROUP',
      isActive: true,
    },
  });
  const ownershipGroup = await prisma.ownershipGroupRef.create({
    data: {
      code: 'redwood',
      name: 'Redwood / Apollo',
      ownershipType: 'PRIVATE_EQUITY',
      isActive: true,
    },
  });
  await prisma.account.update({
    where: { id: fixture.account.id },
    data: {
      affinityGroupSelection: 'GROUP',
      affinityGroupId: affinityGroup.id,
      ownershipGroupSelection: 'GROUP',
      ownershipGroupId: ownershipGroup.id,
      groupClassification: 'HYBRID',
    },
  });
  const defaultCatalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'hybrid-default-test',
      name: 'Default Dealer Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 90,
    },
  });
  await prisma.catalogRuleSet.create({
    data: {
      code: 'hybrid-review-rule-set-test',
      name: 'Hybrid Review Rule Set',
      status: 'ACTIVE',
      isActive: true,
      activatedAt: new Date(),
      rules: {
        create: [{
          name: 'Ownership group needs catalog review',
          priority: 5,
          conditions: [{ field: 'ownership_group', operator: 'is', value: 'redwood' }],
          resultAction: 'REQUIRE_REVIEW',
          requireReviewReason: 'Ownership and affinity both apply. Confirm the dealer catalog before publishing.',
          isEnabled: true,
        }],
      },
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'FALLBACK-100',
      productName: 'Fallback Product Must Not Leak',
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
      displayName: 'Fallback Product Must Not Leak',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  await prisma.catalogInclusion.create({
    data: {
      presentationId: presentation.id,
      dealerCatalogViewId: defaultCatalogView.id,
      dealerGroupType: 'standard',
      isVisible: true,
      publishStatus: 'PUBLISHED',
    },
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
  });
  const dealerAuth = await loginWithPassword(config, {
    email: fixture.contact.email,
    password: provisioned.temporaryPassword,
  }, {});
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);

  const catalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(catalog.catalogView, undefined);
  assert.equal(catalog.products.length, 0);

  const preview = await getDealerPortalInternalPreview(actor, fixture.account.id, 'viewer');
  assert.equal(preview.diagnostics.catalogResolution.source, 'review');
  assert.equal(preview.diagnostics.catalogResolution.ruleName, 'Ownership group needs catalog review');
  assert.match(preview.diagnostics.warnings.join(' '), /Confirm the dealer catalog/);
  assert.equal(preview.visibleProductCount, 0);
});

test('read-only dealer portal roles cannot mutate product favorites', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Read Only Dealer Comfort',
    email: 'readonly@portal.test',
  });

  const catalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'readonly-standard-dealer-test',
      name: 'Read Only Standard Dealer Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 10,
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'RO-100',
      productName: 'Read Only Visible Product',
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
      displayName: 'Read Only Visible Product',
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
  assert.equal(catalog.products.length, 1);
  await assert.rejects(
    () => favoriteCurrentDealerPortalProduct(dealerActor, presentation.id),
    /cannot save catalog favorites/i,
  );
});

test('portal eligible catalog rules honor manually provisioned dealer portal accounts', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Manual Portal Eligible Dealer',
    email: 'manual-portal-eligible@portal.test',
  });

  const portalCatalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'portal-eligible-runtime-test',
      name: 'Portal Eligible Runtime Catalog',
      kind: 'STANDARD',
      isDefault: false,
      isActive: true,
      precedence: 5,
    },
  });
  await prisma.catalogRuleSet.create({
    data: {
      code: 'portal-eligible-runtime-rule-set',
      name: 'Portal Eligible Runtime Rules',
      status: 'ACTIVE',
      isActive: true,
      activatedAt: new Date(),
      rules: {
        create: [{
          name: 'Portal eligible dealers see runtime catalog',
          priority: 1,
          conditions: [{ field: 'portal_eligible', operator: 'is', value: true }],
          resultAction: 'ASSIGN_CATALOG_VIEW',
          dealerCatalogViewId: portalCatalogView.id,
          isEnabled: true,
        }],
      },
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'PORTAL-ELIGIBLE-100',
      productName: 'Portal Eligible Runtime Product',
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
      displayName: 'Portal Eligible Runtime Product',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  await prisma.catalogInclusion.create({
    data: {
      presentationId: presentation.id,
      dealerCatalogViewId: portalCatalogView.id,
      dealerGroupType: 'all_dealers',
      isVisible: true,
      publishStatus: 'PUBLISHED',
    },
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
  });
  const dealerAuth = await loginWithPassword(config, {
    email: fixture.contact.email,
    password: provisioned.temporaryPassword,
  }, {});
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);

  const catalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.equal(catalog.catalogView.name, 'Portal Eligible Runtime Catalog');
  assert.deepEqual(catalog.products.map((item) => item.sku), ['PORTAL-ELIGIBLE-100']);
});

test('active catalog snapshots gate direct favorite and asset-open access', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Snapshot Gate Dealer Comfort',
    email: 'snapshot-gate@portal.test',
  });

  const catalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'snapshot-gate-standard-test',
      name: 'Snapshot Gate Standard Catalog',
      kind: 'STANDARD',
      isDefault: true,
      isActive: true,
      precedence: 10,
    },
  });
  const visibleProduct = await prisma.baseProduct.create({
    data: {
      sku: 'SNAP-100',
      productName: 'Snapshot Product',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const leakedProduct = await prisma.baseProduct.create({
    data: {
      sku: 'SNAP-LIVE-ONLY',
      productName: 'Live Only Product',
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'ACUMATICA',
      isSellable: true,
      isDealerVisible: true,
    },
  });
  const visiblePresentation = await prisma.productPresentation.create({
    data: {
      baseProductId: visibleProduct.id,
      displayName: 'Snapshot Product',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  const liveOnlyPresentation = await prisma.productPresentation.create({
    data: {
      baseProductId: leakedProduct.id,
      displayName: 'Live Only Product',
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      publishedAt: new Date(),
    },
  });
  await prisma.catalogInclusion.createMany({
    data: [
      {
        presentationId: visiblePresentation.id,
        dealerCatalogViewId: catalogView.id,
        dealerGroupType: 'all_dealers',
        isVisible: true,
        publishStatus: 'PUBLISHED',
      },
      {
        presentationId: liveOnlyPresentation.id,
        dealerCatalogViewId: catalogView.id,
        dealerGroupType: 'all_dealers',
        isVisible: true,
        publishStatus: 'PUBLISHED',
      },
    ],
  });
  const liveOnlyAsset = await prisma.digitalAsset.create({
    data: {
      stableSlug: 'snapshot-live-only-spec',
      title: 'Live Only Spec',
      kind: 'DOCUMENT',
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      audience: 'dealer',
      versions: {
        create: {
          versionNumber: 1,
          externalUrl: 'https://assets.example.test/live-only.pdf',
          fileName: 'live-only.pdf',
          isCurrent: true,
        },
      },
    },
    include: { versions: true },
  });
  await prisma.productAssetAssignment.create({
    data: {
      presentationId: liveOnlyPresentation.id,
      assetId: liveOnlyAsset.id,
      assetVersionId: liveOnlyAsset.versions[0].id,
      role: 'SPEC_SHEET',
    },
  });
  await prisma.dealerCatalogSnapshot.create({
    data: {
      dealerCatalogViewId: catalogView.id,
      version: 1,
      status: 'ACTIVE',
      isActive: true,
      productCount: 1,
      fileCount: 0,
      publishedByUserId: actor.userId,
      items: {
        create: {
          dealerCatalogViewId: catalogView.id,
          presentationId: visiblePresentation.id,
          baseProductId: visibleProduct.id,
          sku: 'SNAP-100',
          displayName: 'Snapshot Product',
          assetCount: 0,
          assetVersionPayload: [],
          sortOrder: 10,
        },
      },
    },
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
  });
  const dealerAuth = await loginWithPassword(config, {
    email: fixture.contact.email,
    password: provisioned.temporaryPassword,
  }, {});
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);

  const catalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.deepEqual(catalog.products.map((product) => product.sku), ['SNAP-100']);
  await assert.rejects(
    () => favoriteCurrentDealerPortalProduct(dealerActor, liveOnlyPresentation.id),
    /active dealer catalog snapshot|not visible in the current dealer catalog/i,
  );
  await assert.rejects(
    () => recordCurrentDealerPortalAssetOpen(dealerActor, liveOnlyAsset.id),
    /active dealer catalog snapshot|not visible in the current dealer catalog/i,
  );
});

test('dealer portal file visibility enforces assignment brand region and catalog view scopes', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await seedPortalReadyAccount(actor, {
    companyName: 'Scoped Asset Dealer Comfort',
    email: 'scoped-assets@portal.test',
  });

  const catalogView = await prisma.dealerCatalogView.create({
    data: {
      code: 'scoped-asset-catalog-test',
      name: 'Scoped Asset Catalog',
      kind: 'STANDARD',
      regionScope: 'US',
      brandLabel: 'Dynamic',
      isDefault: true,
      isActive: true,
      precedence: 10,
    },
  });
  const product = await prisma.baseProduct.create({
    data: {
      sku: 'SCOPE-100',
      productName: 'Scoped Product',
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
      displayName: 'Scoped Product',
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
  const createAsset = (slug, title) => prisma.digitalAsset.create({
    data: {
      stableSlug: slug,
      title,
      kind: 'DOCUMENT',
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      audience: 'dealer',
      versions: {
        create: {
          versionNumber: 1,
          externalUrl: `https://assets.example.test/${slug}.pdf`,
          fileName: `${slug}.pdf`,
          isCurrent: true,
        },
      },
    },
    include: { versions: true },
  });
  const visibleAsset = await createAsset('scope-visible', 'Visible Scoped Spec');
  const brandMismatch = await createAsset('scope-brand-mismatch', 'Wrong Brand Spec');
  const regionMismatch = await createAsset('scope-region-mismatch', 'Wrong Region Spec');
  const groupMismatch = await createAsset('scope-group-mismatch', 'Wrong Catalog View Spec');
  await prisma.productAssetAssignment.createMany({
    data: [
      {
        presentationId: presentation.id,
        assetId: visibleAsset.id,
        assetVersionId: visibleAsset.versions[0].id,
        role: 'SPEC_SHEET',
        brandLabel: 'Dynamic',
        regionScope: 'US',
        dealerGroupType: 'all_dealers',
        sortOrder: 10,
      },
      {
        presentationId: presentation.id,
        assetId: brandMismatch.id,
        assetVersionId: brandMismatch.versions[0].id,
        role: 'SPEC_SHEET',
        brandLabel: 'Private Label',
        regionScope: 'US',
        dealerGroupType: 'all_dealers',
        sortOrder: 20,
      },
      {
        presentationId: presentation.id,
        assetId: regionMismatch.id,
        assetVersionId: regionMismatch.versions[0].id,
        role: 'SPEC_SHEET',
        brandLabel: 'Dynamic',
        regionScope: 'CA',
        dealerGroupType: 'all_dealers',
        sortOrder: 30,
      },
      {
        presentationId: presentation.id,
        assetId: groupMismatch.id,
        assetVersionId: groupMismatch.versions[0].id,
        role: 'SPEC_SHEET',
        brandLabel: 'Dynamic',
        regionScope: 'US',
        dealerGroupType: 'affinity_group',
        dealerGroupId: 'nexstar',
        sortOrder: 40,
      },
    ],
  });

  const provisioned = await provisionDealerPortalUser(actor, fixture.account.id, {
    contactId: fixture.contact.id,
    accessRole: 'purchasing',
  });
  const dealerAuth = await loginWithPassword(config, {
    email: fixture.contact.email,
    password: provisioned.temporaryPassword,
  }, {});
  const dealerActor = await authenticateAccessToken(dealerAuth.tokens.accessToken);

  const catalog = await getCurrentDealerPortalCatalog(dealerActor);
  assert.deepEqual(catalog.products[0].assets.map((asset) => asset.title), ['Visible Scoped Spec']);
  await assert.rejects(
    () => recordCurrentDealerPortalAssetOpen(dealerActor, brandMismatch.id),
    /not visible in the current dealer catalog/i,
  );
  await assert.rejects(
    () => recordCurrentDealerPortalAssetOpen(dealerActor, regionMismatch.id),
    /not visible in the current dealer catalog/i,
  );
  await assert.rejects(
    () => recordCurrentDealerPortalAssetOpen(dealerActor, groupMismatch.id),
    /not visible in the current dealer catalog/i,
  );
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

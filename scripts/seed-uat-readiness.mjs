#!/usr/bin/env node

import { randomBytes, scryptSync } from 'node:crypto';
import { prisma } from '../packages/db/dist/index.js';

const now = new Date();

const actorEmail = process.env.UAT_SEED_ACTOR_EMAIL ?? 'uat.seed@pulse.local';
const internalPassword = process.env.UAT_INTERNAL_PASSWORD ?? 'PulseUatInternal123!';
const dealerPassword = process.env.UAT_DEALER_PASSWORD ?? 'PulseUatDealer123!';

async function main() {
  const actor = await prisma.user.upsert({
    where: { email: actorEmail },
    update: {
      displayName: 'Pulse UAT Seed Operator',
      roleCode: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      email: actorEmail,
      displayName: 'Pulse UAT Seed Operator',
      roleCode: 'SUPER_ADMIN',
      userType: 'INTERNAL',
      isActive: true,
    },
  });
  await ensureLocalIdentity(actor.id, actor.email, internalPassword);

  const [tm, rd] = await Promise.all([
    upsertUser('tammy.tm@pulse.local', 'Tammy Territory Manager', 'TERRITORY_MANAGER'),
    upsertUser('riley.rd@pulse.local', 'Riley Regional Director', 'REGIONAL_DIRECTOR'),
  ]);
  await Promise.all([
    ensureLocalIdentity(tm.id, tm.email, internalPassword),
    ensureLocalIdentity(rd.id, rd.email, internalPassword),
  ]);

  const shippingCenter = await prisma.shippingCenter.upsert({
    where: { code: 'UAT_DALLAS' },
    update: { name: 'UAT Dallas Shipping Center', city: 'Dallas', state: 'TX', countryCode: 'US', isActive: true },
    create: { code: 'UAT_DALLAS', name: 'UAT Dallas Shipping Center', city: 'Dallas', state: 'TX', countryCode: 'US', isActive: true },
  });

  const region = await prisma.region.upsert({
    where: { code: 'UAT_SOUTH' },
    update: { name: 'UAT South Region', directorUserId: rd.id, isActive: true },
    create: { code: 'UAT_SOUTH', name: 'UAT South Region', directorUserId: rd.id, isActive: true },
  });

  const territory = await prisma.territory.upsert({
    where: { code: 'UAT_TX_NORTH' },
    update: {
      name: 'UAT North Texas Territory',
      regionId: region.id,
      managerUserId: tm.id,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
    create: {
      code: 'UAT_TX_NORTH',
      name: 'UAT North Texas Territory',
      regionId: region.id,
      managerUserId: tm.id,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const affinity = await prisma.affinityGroupRef.upsert({
    where: { code: 'UAT_NEXSTAR' },
    update: { name: 'UAT Nexstar', groupType: 'BUYING_GROUP', isActive: true },
    create: { code: 'UAT_NEXSTAR', name: 'UAT Nexstar', groupType: 'BUYING_GROUP', isActive: true },
  });
  const ownership = await prisma.ownershipGroupRef.upsert({
    where: { code: 'UAT_REDWOOD_PE' },
    update: { name: 'UAT Redwood PE', ownershipType: 'PRIVATE_EQUITY', isActive: true },
    create: { code: 'UAT_REDWOOD_PE', name: 'UAT Redwood PE', ownershipType: 'PRIVATE_EQUITY', isActive: true },
  });

  const accounts = await Promise.all([
    upsertAccount({
      accountNumber: 'UAT-AFF-1001',
      displayName: 'UAT Nexstar Comfort',
      groupClassification: 'AFFINITY_ONLY',
      affinityGroupId: affinity.id,
      ownershipGroupId: null,
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      tmId: tm.id,
      rdId: rd.id,
      contactEmail: 'owner+nexstar@pulse-uat.local',
    }),
    upsertAccount({
      accountNumber: 'UAT-PE-1002',
      displayName: 'UAT Redwood HVAC',
      groupClassification: 'OWNERSHIP_ONLY',
      affinityGroupId: null,
      ownershipGroupId: ownership.id,
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      tmId: tm.id,
      rdId: rd.id,
      contactEmail: 'owner+redwood@pulse-uat.local',
    }),
    upsertAccount({
      accountNumber: 'UAT-HYB-1003',
      displayName: 'UAT Hybrid Dealer',
      groupClassification: 'HYBRID',
      affinityGroupId: affinity.id,
      ownershipGroupId: ownership.id,
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      tmId: tm.id,
      rdId: rd.id,
      contactEmail: 'owner+hybrid@pulse-uat.local',
    }),
    upsertAccount({
      accountNumber: 'UAT-IND-1004',
      displayName: 'UAT Independent Air',
      groupClassification: 'INDEPENDENT',
      affinityGroupId: null,
      ownershipGroupId: null,
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      tmId: tm.id,
      rdId: rd.id,
      contactEmail: 'owner+independent@pulse-uat.local',
    }),
  ]);

  const category = await prisma.productCategory.upsert({
    where: { code: 'UAT_IAQ' },
    update: { name: 'UAT IAQ Products', categoryType: 'product_line', regionScope: 'ALL_REGIONS', isActive: true },
    create: { code: 'UAT_IAQ', name: 'UAT IAQ Products', categoryType: 'product_line', regionScope: 'ALL_REGIONS', isActive: true },
  });
  const family = await prisma.productFamily.upsert({
    where: { code: 'UAT_WHOLE_HOME_IAQ' },
    update: { name: 'UAT Whole Home IAQ', isActive: true },
    create: { code: 'UAT_WHOLE_HOME_IAQ', name: 'UAT Whole Home IAQ', isActive: true },
  });

  const catalogViews = await Promise.all([
    upsertCatalogView('UAT_STANDARD_US', 'UAT Standard US Dealer Catalog', 'STANDARD', null, null, 'COUNTRY_US', null, true, 100, actor.id),
    upsertCatalogView('UAT_NEXSTAR', 'UAT Nexstar Dealer Catalog', 'AFFINITY', 'UAT_NEXSTAR', 'UAT Nexstar', 'COUNTRY_US', null, false, 50, actor.id),
    upsertCatalogView('UAT_REDWOOD_PE', 'UAT Redwood PE Dealer Catalog', 'OWNERSHIP', 'UAT_REDWOOD_PE', 'UAT Redwood PE', 'COUNTRY_US', null, false, 40, actor.id),
    upsertCatalogView('UAT_INDEPENDENT', 'UAT Independent Dealer Catalog', 'INDEPENDENT', 'independent', 'Independent dealers', 'COUNTRY_US', null, false, 80, actor.id),
  ]);
  await seedCatalogRules(catalogViews, actor.id);

  const products = await Promise.all([
    upsertProduct({
      sku: 'UAT-IAQ-100',
      productName: 'UAT Whole Home IAQ System',
      categoryId: category.id,
      familyId: family.id,
      presentationName: 'UAT Whole Home IAQ System',
      shortDescription: 'Dealer-ready indoor air quality system for UAT catalog validation.',
      catalogViewIds: catalogViews.map((view) => view.id),
      createdByUserId: actor.id,
    }),
    upsertProduct({
      sku: 'UAT-FLTR-200',
      productName: 'UAT Replacement Filter Kit',
      categoryId: category.id,
      familyId: family.id,
      presentationName: 'UAT Replacement Filter Kit',
      shortDescription: 'Recurring replacement filter kit for UAT dealer portal validation.',
      catalogViewIds: [catalogViews[0].id, catalogViews[3].id],
      createdByUserId: actor.id,
    }),
  ]);

  const assets = await Promise.all([
    upsertAsset('uat-iaq-primary-image', 'UAT IAQ Primary Image', 'IMAGE', 'uat-iaq-primary.jpg', 'image/jpeg', actor.id),
    upsertAsset('uat-iaq-spec-sheet', 'UAT IAQ Spec Sheet', 'DOCUMENT', 'uat-iaq-spec.pdf', 'application/pdf', actor.id),
    upsertAsset('uat-filter-brochure', 'UAT Filter Brochure', 'DOCUMENT', 'uat-filter-brochure.pdf', 'application/pdf', actor.id),
  ]);

  await linkAsset(products[0].presentation.id, assets[0].asset.id, assets[0].version.id, 'PRIMARY_IMAGE', true);
  await linkAsset(products[0].presentation.id, assets[1].asset.id, assets[1].version.id, 'SPEC_SHEET', false);
  await linkAsset(products[1].presentation.id, assets[2].asset.id, assets[2].version.id, 'BROCHURE', false);

  await Promise.all(catalogViews.map((catalogView) => publishSeedCatalogSnapshot(catalogView.id, actor.id)));

  await Promise.all(accounts.map((account) => prisma.dealerPortalAccount.upsert({
    where: { accountId: account.id },
    update: { status: 'ACTIVE', provisionedAt: now, notes: 'UAT-ready dealer portal account seeded without Acumatica dependency.' },
    create: { accountId: account.id, status: 'ACTIVE', provisionedAt: now, notes: 'UAT-ready dealer portal account seeded without Acumatica dependency.' },
  })));

  await Promise.all(accounts.map((account) => upsertDealerPortalUser(account, actor.id)));
  await seedTrainingScenario(accounts[0], tm.id, rd.id, actor.id);

  console.log(`Seeded dependency-free UAT data: ${accounts.length} dealer accounts, ${catalogViews.length} catalog views, ${products.length} products, ${assets.length} assets.`);
  console.log(`UAT internal personas: ${actor.email}, ${tm.email}, ${rd.email} / password ${internalPassword}`);
  console.log(`UAT dealer personas: owner+nexstar@pulse-uat.local, owner+redwood@pulse-uat.local, owner+hybrid@pulse-uat.local, owner+independent@pulse-uat.local / password ${dealerPassword}`);
}

async function upsertUser(email, displayName, roleCode) {
  return prisma.user.upsert({
    where: { email },
    update: { displayName, roleCode, userType: 'INTERNAL', isActive: true },
    create: { email, displayName, roleCode, userType: 'INTERNAL', isActive: true },
  });
}

async function ensureLocalIdentity(userId, email, password) {
  return prisma.userIdentity.upsert({
    where: {
      provider_loginEmail: {
        provider: 'LOCAL',
        loginEmail: email,
      },
    },
    update: {
      userId,
      providerSubject: email,
      passwordHash: hashSecret(password),
      isPrimary: true,
    },
    create: {
      userId,
      provider: 'LOCAL',
      providerSubject: email,
      loginEmail: email,
      passwordHash: hashSecret(password),
      isPrimary: true,
    },
  });
}

async function upsertAccount(input) {
  const account = await prisma.account.upsert({
    where: { accountNumber: input.accountNumber },
    update: {
      displayName: input.displayName,
      accountType: 'Dealer',
      affinityGroupSelection: input.affinityGroupId ? 'GROUP' : 'NONE',
      affinityGroupId: input.affinityGroupId,
      ownershipGroupSelection: input.ownershipGroupId ? 'GROUP' : 'NONE',
      ownershipGroupId: input.ownershipGroupId,
      groupClassification: input.groupClassification,
      territoryId: input.territoryId,
      shippingCenterId: input.shippingCenterId,
      assignedTmUserId: input.tmId,
      assignedRdUserId: input.rdId,
      isActive: true,
    },
    create: {
      accountNumber: input.accountNumber,
      displayName: input.displayName,
      legalName: `${input.displayName} LLC`,
      accountType: 'Dealer',
      affinityGroupSelection: input.affinityGroupId ? 'GROUP' : 'NONE',
      affinityGroupId: input.affinityGroupId,
      ownershipGroupSelection: input.ownershipGroupId ? 'GROUP' : 'NONE',
      ownershipGroupId: input.ownershipGroupId,
      groupClassification: input.groupClassification,
      territoryId: input.territoryId,
      shippingCenterId: input.shippingCenterId,
      assignedTmUserId: input.tmId,
      assignedRdUserId: input.rdId,
      isActive: true,
    },
  });

  const existingContact = await prisma.contact.findFirst({ where: { accountId: account.id, email: input.contactEmail } });
  if (existingContact) {
    await prisma.contact.update({
      where: { id: existingContact.id },
      data: { firstName: 'UAT', lastName: 'Owner', title: 'Owner', isPrimary: true, isActive: true },
    });
  } else {
    await prisma.contact.create({
      data: {
        accountId: account.id,
        firstName: 'UAT',
        lastName: 'Owner',
        title: 'Owner',
        email: input.contactEmail,
        isPrimary: true,
        isActive: true,
      },
    });
  }

  const location = await prisma.accountLocation.findFirst({ where: { accountId: account.id, isPrimary: true } });
  if (location) {
    await prisma.accountLocation.update({ where: { id: location.id }, data: { name: 'UAT Main Office', city: 'Dallas', state: 'TX', countryCode: 'US', isActive: true } });
  } else {
    await prisma.accountLocation.create({ data: { accountId: account.id, name: 'UAT Main Office', city: 'Dallas', state: 'TX', countryCode: 'US', isPrimary: true, isActive: true } });
  }

  return account;
}

async function upsertCatalogView(code, name, kind, resolverKey, resolverLabel, regionScope, brandLabel, isDefault, precedence, createdByUserId) {
  return prisma.dealerCatalogView.upsert({
    where: { code },
    update: { name, kind, resolverKey, resolverLabel, regionScope, brandLabel, isDefault, isActive: true, precedence },
    create: { code, name, kind, resolverKey, resolverLabel, regionScope, brandLabel, isDefault, isActive: true, precedence, createdByUserId },
  });
}

async function upsertProduct(input) {
  const product = await prisma.baseProduct.upsert({
    where: { sku: input.sku },
    update: {
      productName: input.productName,
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
      categoryId: input.categoryId,
      familyId: input.familyId,
      isSellable: true,
      isDealerVisible: true,
    },
    create: {
      sku: input.sku,
      productName: input.productName,
      lifecycleStatus: 'ACTIVE',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
      categoryId: input.categoryId,
      familyId: input.familyId,
      isSellable: true,
      isDealerVisible: true,
      createdByUserId: input.createdByUserId,
    },
  });

  let presentation = await prisma.productPresentation.findFirst({ where: { baseProductId: product.id } });
  if (presentation) {
    presentation = await prisma.productPresentation.update({
      where: { id: presentation.id },
      data: {
        displayName: input.presentationName,
        shortDescription: input.shortDescription,
        publishStatus: 'PUBLISHED',
        readyForDealerPortal: true,
        approvedByUserId: input.createdByUserId,
        approvedAt: now,
        publishedAt: now,
      },
    });
  } else {
    presentation = await prisma.productPresentation.create({
      data: {
        baseProductId: product.id,
        displayName: input.presentationName,
        shortDescription: input.shortDescription,
        publishStatus: 'PUBLISHED',
        readyForDealerPortal: true,
        approvedByUserId: input.createdByUserId,
        approvedAt: now,
        publishedAt: now,
      },
    });
  }

  for (const catalogViewId of input.catalogViewIds) {
    const existing = await prisma.catalogInclusion.findFirst({ where: { presentationId: presentation.id, dealerCatalogViewId: catalogViewId } });
    const data = {
      presentationId: presentation.id,
      dealerCatalogViewId: catalogViewId,
      dealerGroupType: 'dealer_catalog_view',
      isVisible: true,
      publishStatus: 'PUBLISHED',
    };
    if (existing) {
      await prisma.catalogInclusion.update({ where: { id: existing.id }, data });
    } else {
      await prisma.catalogInclusion.create({ data });
    }
  }

  return { product, presentation, catalogViewIds: input.catalogViewIds };
}

async function seedCatalogRules(catalogViews, actorUserId) {
  const [standardView, affinityView, ownershipView, independentView] = catalogViews;
  const existing = await prisma.catalogRuleSet.findUnique({ where: { code: 'UAT_DEALER_CATALOG_RULES' } });
  if (existing) {
    await prisma.catalogRule.deleteMany({ where: { ruleSetId: existing.id } });
  }

  await prisma.catalogRuleSet.upsert({
    where: { code: 'UAT_DEALER_CATALOG_RULES' },
    update: {
      name: 'UAT Dealer Catalog Rules',
      description: 'Dependency-free UAT rules for affinity, PE/ownership, independent, and hybrid review scenarios.',
      status: 'ACTIVE',
      isActive: true,
      version: 1,
      activatedAt: now,
      activatedByUserId: actorUserId,
      retiredAt: null,
      retiredByUserId: null,
      rules: {
        create: buildSeedCatalogRules(standardView, affinityView, ownershipView, independentView),
      },
    },
    create: {
      code: 'UAT_DEALER_CATALOG_RULES',
      name: 'UAT Dealer Catalog Rules',
      description: 'Dependency-free UAT rules for affinity, PE/ownership, independent, and hybrid review scenarios.',
      status: 'ACTIVE',
      isActive: true,
      version: 1,
      activatedAt: now,
      activatedByUserId: actorUserId,
      createdByUserId: actorUserId,
      rules: {
        create: buildSeedCatalogRules(standardView, affinityView, ownershipView, independentView),
      },
    },
  });
}

function buildSeedCatalogRules(standardView, affinityView, ownershipView, independentView) {
  return [
    {
      name: 'Hybrid dealers require catalog review',
      priority: 5,
      conditions: [
        { field: 'affinity_group', operator: 'is_not_empty' },
        { field: 'ownership_group', operator: 'is_not_empty' },
      ],
      resultAction: 'REQUIRE_REVIEW',
      requireReviewReason: 'This dealer belongs to both an affinity group and an ownership/PE group. Confirm the correct catalog before dealer-facing publish.',
      isEnabled: true,
    },
    {
      name: 'UAT Nexstar dealers see Nexstar catalog',
      priority: 20,
      conditions: [{ field: 'affinity_group', operator: 'is', value: 'UAT_NEXSTAR' }],
      resultAction: 'ASSIGN_CATALOG_VIEW',
      dealerCatalogViewId: affinityView.id,
      isEnabled: true,
    },
    {
      name: 'UAT Redwood PE dealers see PE catalog',
      priority: 30,
      conditions: [{ field: 'ownership_group', operator: 'is', value: 'UAT_REDWOOD_PE' }],
      resultAction: 'ASSIGN_CATALOG_VIEW',
      dealerCatalogViewId: ownershipView.id,
      isEnabled: true,
    },
    {
      name: 'UAT independent dealers see independent catalog',
      priority: 40,
      conditions: [{ field: 'independent', operator: 'is', value: true }],
      resultAction: 'ASSIGN_CATALOG_VIEW',
      dealerCatalogViewId: independentView.id,
      isEnabled: true,
    },
    {
      name: 'UAT default dealer catalog fallback',
      priority: 100,
      conditions: [{ field: 'affinity_group', operator: 'is_any' }],
      resultAction: 'ASSIGN_CATALOG_VIEW',
      dealerCatalogViewId: standardView.id,
      isEnabled: true,
    },
  ];
}

async function upsertAsset(stableSlug, title, kind, fileName, mimeType, createdByUserId) {
  const asset = await prisma.digitalAsset.upsert({
    where: { stableSlug },
    update: {
      title,
      kind,
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      audience: 'dealer',
    },
    create: {
      stableSlug,
      title,
      kind,
      status: 'ACTIVE',
      visibility: 'DEALER_PORTAL',
      reviewStatus: 'APPROVED',
      sourceSystem: 'PULSE',
      sourceOfTruthSystem: 'PULSE',
      audience: 'dealer',
      createdByUserId,
      approvedByUserId: createdByUserId,
      approvedAt: now,
    },
  });

  const existingVersion = await prisma.digitalAssetVersion.findFirst({ where: { assetId: asset.id, versionNumber: 1 } });
  const version = existingVersion
    ? await prisma.digitalAssetVersion.update({
      where: { id: existingVersion.id },
      data: { fileName, mimeType, externalUrl: `https://assets.example.invalid/${stableSlug}/${fileName}`, isCurrent: true },
    })
    : await prisma.digitalAssetVersion.create({
      data: {
        assetId: asset.id,
        versionNumber: 1,
        fileName,
        mimeType,
        externalUrl: `https://assets.example.invalid/${stableSlug}/${fileName}`,
        isCurrent: true,
        createdByUserId,
      },
    });

  await prisma.digitalAsset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });
  return { asset, version };
}

async function linkAsset(presentationId, assetId, assetVersionId, role, isRequired) {
  const existing = await prisma.productAssetAssignment.findFirst({ where: { presentationId, assetId, role } });
  const data = { presentationId, assetId, assetVersionId, role, isRequired, sortOrder: isRequired ? 1 : 10 };
  if (existing) {
    return prisma.productAssetAssignment.update({ where: { id: existing.id }, data });
  }
  return prisma.productAssetAssignment.create({ data });
}

async function publishSeedCatalogSnapshot(dealerCatalogViewId, actorUserId) {
  const catalogView = await prisma.dealerCatalogView.findUniqueOrThrow({ where: { id: dealerCatalogViewId } });
  const presentations = await prisma.productPresentation.findMany({
    where: {
      publishStatus: 'PUBLISHED',
      readyForDealerPortal: true,
      baseProduct: {
        lifecycleStatus: 'ACTIVE',
        isSellable: true,
        isDealerVisible: true,
      },
      inclusions: {
        some: {
          dealerCatalogViewId,
          isVisible: true,
          publishStatus: 'PUBLISHED',
          OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
          AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] }],
        },
      },
    },
    include: {
      baseProduct: true,
      assetAssignments: {
        include: {
          asset: {
            include: {
              versions: {
                where: { isCurrent: true },
                take: 1,
              },
            },
          },
          assetVersion: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ displayName: 'asc' }],
  });

  const latest = await prisma.dealerCatalogSnapshot.findFirst({
    where: { dealerCatalogViewId },
    orderBy: [{ version: 'desc' }],
  });
  const version = (latest?.version ?? 0) + 1;
  const items = presentations.map((presentation, index) => {
    const assets = presentation.assetAssignments
      .filter((assignment) => isDealerVisibleSnapshotAsset(assignment, catalogView))
      .map((assignment) => {
        const versionRecord = assignment.assetVersion ?? assignment.asset.versions?.[0] ?? null;
        return {
          assignmentId: assignment.id,
          assetId: assignment.assetId,
          assetVersionId: versionRecord?.id ?? assignment.assetVersionId,
          role: assignment.role.toLowerCase(),
          title: assignment.asset.title,
          stableSlug: assignment.asset.stableSlug,
          kind: assignment.asset.kind.toLowerCase(),
          fileName: versionRecord?.fileName ?? assignment.asset.legacyFileName,
          externalUrl: versionRecord?.externalUrl ?? assignment.asset.legacyUrl,
        };
      });
    return {
      dealerCatalogViewId,
      presentationId: presentation.id,
      baseProductId: presentation.baseProductId,
      sku: presentation.baseProduct.sku,
      displayName: presentation.displayName,
      assetCount: assets.length,
      assetVersionPayload: assets,
      sortOrder: index + 1,
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.dealerCatalogSnapshot.updateMany({
      where: { dealerCatalogViewId, isActive: true },
      data: { isActive: false, status: 'ARCHIVED' },
    });
    await tx.dealerCatalogSnapshot.create({
      data: {
        dealerCatalogViewId,
        version,
        status: 'ACTIVE',
        isActive: true,
        productCount: items.length,
        fileCount: items.reduce((total, item) => total + item.assetCount, 0),
        publishedByUserId: actorUserId,
        publishedAt: now,
        notes: 'Dependency-free UAT snapshot generated by seed:uat.',
        items: {
          create: items,
        },
      },
    });
  });
}

function isDealerVisibleSnapshotAsset(assignment, catalogView) {
  const asset = assignment.asset;
  if (!asset || asset.status !== 'ACTIVE') return false;
  if (asset.visibility !== 'DEALER_PORTAL' && asset.visibility !== 'PUBLIC') return false;
  if (asset.reviewStatus !== 'APPROVED' && asset.reviewStatus !== 'NOT_REQUIRED') return false;
  if (asset.brandScope && catalogView.brandLabel && asset.brandScope !== catalogView.brandLabel) return false;
  if (asset.regionScope && catalogView.regionScope && asset.regionScope !== catalogView.regionScope) return false;
  return true;
}

async function upsertDealerPortalUser(account, actorUserId) {
  const contact = await prisma.contact.findFirst({
    where: { accountId: account.id, isPrimary: true },
    orderBy: [{ createdAt: 'asc' }],
  });
  const email = contact?.email ?? `${account.accountNumber.toLowerCase()}@pulse-uat.local`;
  const displayName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : `${account.displayName} Portal User`;
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      displayName,
      roleCode: 'DEALER_PORTAL_USER',
      userType: 'DEALER',
      isActive: true,
    },
    create: {
      email,
      displayName,
      roleCode: 'DEALER_PORTAL_USER',
      userType: 'DEALER',
      isActive: true,
    },
  });
  await ensureLocalIdentity(user.id, email, dealerPassword);
  return prisma.dealerPortalUser.upsert({
    where: { userId: user.id },
    update: {
      accountId: account.id,
      contactId: contact?.id ?? null,
      createdByUserId: actorUserId,
      status: 'ACTIVE',
      accessRole: 'ADMIN',
      isPrimaryOwner: true,
      activatedAt: now,
      suspendedAt: null,
      deactivatedAt: null,
      notes: 'UAT dealer login seeded without Acumatica dependency.',
    },
    create: {
      accountId: account.id,
      contactId: contact?.id ?? null,
      userId: user.id,
      createdByUserId: actorUserId,
      status: 'ACTIVE',
      accessRole: 'ADMIN',
      isPrimaryOwner: true,
      activatedAt: now,
      notes: 'UAT dealer login seeded without Acumatica dependency.',
    },
  });
}

async function seedTrainingScenario(account, tmUserId, rdUserId, actorUserId) {
  const category = await prisma.trainingCategory.upsert({
    where: { code: 'UAT_FIELD_EXECUTION' },
    update: {
      kind: 'CERTIFICATION',
      name: 'UAT Field Execution',
      isActive: true,
    },
    create: {
      code: 'UAT_FIELD_EXECUTION',
      kind: 'CERTIFICATION',
      name: 'UAT Field Execution',
      description: 'Dependency-free UAT training category for TM/RD field execution.',
      sortOrder: 10,
      isActive: true,
    },
  });
  const trainingType = await prisma.trainingType.upsert({
    where: { code: 'uat_iaq_field_certification' },
    update: {
      categoryId: category.id,
      name: 'UAT IAQ Field Certification',
      family: 'TECHNICAL_PRODUCT',
      deliveryMode: 'ON_SITE',
      defaultDurationMinutes: 90,
      countsTowardHours: true,
      isCustomerFacing: true,
      isCertificationTrack: true,
      isActive: true,
    },
    create: {
      categoryId: category.id,
      code: 'uat_iaq_field_certification',
      name: 'UAT IAQ Field Certification',
      description: 'Seeded certification session for mobile field UAT.',
      family: 'TECHNICAL_PRODUCT',
      deliveryMode: 'ON_SITE',
      defaultDurationMinutes: 90,
      countsTowardHours: true,
      isCustomerFacing: true,
      isCertificationTrack: true,
      sortOrder: 10,
      isActive: true,
    },
  });
  const programData = {
    title: 'UAT IAQ Certification Program',
    ownerTmUserId: tmUserId,
    ownerRdUserId: rdUserId,
    status: 'ACTIVE',
    isRequired: true,
    nextDueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
  const existingProgram = await prisma.accountTrainingProgram.findFirst({
    where: { accountId: account.id, trainingTypeId: trainingType.id },
  });
  const program = existingProgram
    ? await prisma.accountTrainingProgram.update({
      where: { id: existingProgram.id },
      data: programData,
    })
    : await prisma.accountTrainingProgram.create({
      data: {
        accountId: account.id,
        trainingTypeId: trainingType.id,
        createdByUserId: actorUserId,
        ownerTmUserId: tmUserId,
        ownerRdUserId: rdUserId,
        title: 'UAT IAQ Certification Program',
        description: 'Seeded dependency-free program for Dynamic AQS UAT.',
        status: 'ACTIVE',
        cadenceDays: 365,
        isRequired: true,
        nextDueAt: programData.nextDueAt,
        startedAt: now,
      },
    });
  const location = await prisma.accountLocation.findFirst({ where: { accountId: account.id, isPrimary: true } });
  const existing = await prisma.trainingSession.findFirst({
    where: { accountId: account.id, programId: program.id, title: 'UAT IAQ Certification Visit' },
  });
  const data = {
    accountId: account.id,
    locationId: location?.id ?? null,
    programId: program.id,
    trainingTypeId: trainingType.id,
    trainerUserId: tmUserId,
    activityKind: 'TRAINING',
    status: 'SCHEDULED',
    certificationOutcome: 'PENDING_DECISION',
    title: 'UAT IAQ Certification Visit',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    durationMinutes: 90,
    attendeeCount: 4,
    notes: 'Seeded training session for mobile and web UAT.',
  };
  if (existing) {
    return prisma.trainingSession.update({ where: { id: existing.id }, data });
  }
  return prisma.trainingSession.create({ data });
}

function hashSecret(secret) {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(secret, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

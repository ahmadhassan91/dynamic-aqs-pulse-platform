import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let ensureReferenceDataSeeded;
let ensureLeadRoutingPolicySeeded;
let ensureWebsiteLeadConfigSeeded;
let ensureTerritoryPolicySeeded;
let ensureBootstrapAdminSeeded;
let loginWithPassword;
let createLead;
let createAccount;
let updateAccount;
let updateAccountLifecycle;
let createAccountContact;
let updateAccountContact;
let createAccountLocation;
let updateAccountLocation;
let listAccountPaymentMethods;
let createAccountPaymentMethod;
let updateAccountPaymentMethod;
let listAccounts;
let getAccountDetail;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead } = await import('../dist/modules/leads/service.js'));

  createLead = ((rawCreateLead) => (actor, input, ...rest) => {
    const hasExplicitClassification = input.affinityGroupSelection !== undefined
      || input.affinityGroupId !== undefined
      || input.affinityGroupCode !== undefined
      || input.affinityGroupName !== undefined
      || input.ownershipGroupSelection !== undefined
      || input.ownershipGroupId !== undefined
      || input.ownershipGroupCode !== undefined
      || input.ownershipGroupName !== undefined;

    return rawCreateLead(actor, hasExplicitClassification
      ? input
      : {
          affinityGroupSelection: 'none',
          ownershipGroupSelection: 'none',
          ...input,
        }, ...rest);
  })(createLead);
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({
    createAccount,
    updateAccount,
    updateAccountLifecycle,
    createAccountContact,
    updateAccountContact,
    createAccountLocation,
    updateAccountLocation,
    listAccountPaymentMethods,
    createAccountPaymentMethod,
    updateAccountPaymentMethod,
    listAccounts,
    getAccountDetail,
  } = await import('../dist/modules/accounts/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));

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

  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Pulse Bootstrap Admin',
  };
}

async function createScopedActor(role, email, displayName) {
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      roleCode: role,
      userType: 'INTERNAL',
      isActive: true,
    },
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

test('accounts list and detail expose converted lead territory assignment context', SERIAL, async () => {
  const actor = await createAdminActor();
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const region = await prisma.region.create({
    data: {
      code: 'rg_accounts',
      name: 'Accounts Region',
      directorUserId: actor.userId,
      isActive: true,
    },
  });
  const territory = await prisma.territory.create({
    data: {
      code: 'tx_accounts',
      name: 'Texas Accounts Territory',
      regionId: region.id,
      managerUserId: actor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const lead = await createLead(actor, {
    companyName: 'Account Regression Comfort',
    contactDisplayName: 'Avery Accounts',
    email: 'accounts@regression.test',
    phone: '555-991-0000',
    state: 'TX',
    serviceTechCount: 5,
  });

  const account = await prisma.account.create({
    data: {
      sourceLeadId: lead.id,
      displayName: 'Account Regression Comfort',
      legalName: 'Account Regression Comfort LLC',
      accountType: 'Dealer',
      territoryId: territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date('2026-04-14T09:00:00.000Z'),
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: actor.userId,
      assignedRdUserId: actor.userId,
      isActive: true,
      locations: {
        create: {
          name: 'Primary',
          line1: '455 Market Street',
          city: 'Dallas',
          state: 'TX',
          postalCode: '75201',
          countryCode: 'US',
          isPrimary: true,
        },
      },
      contacts: {
        create: {
          firstName: 'Avery',
          lastName: 'Accounts',
          email: 'accounts@regression.test',
          roleCode: 'primary',
          isPrimary: true,
        },
      },
    },
  });

  const listed = await listAccounts(actor, {
    search: 'Regression Comfort',
  });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].id, account.id);
  assert.equal(listed.items[0].sourceLeadId, lead.id);
  assert.equal(listed.items[0].territoryId, territory.id);
  assert.equal(listed.items[0].territoryCode, 'tx_accounts');
  assert.equal(listed.items[0].regionCode, 'rg_accounts');
  assert.equal(listed.items[0].shippingCenterCode, shippingCenter.code);
  assert.equal(listed.items[0].assignedTmUserId, actor.userId);
  assert.equal(listed.items[0].assignedRdUserId, actor.userId);
  assert.equal(listed.items[0].territoryAssignmentMethod, 'manual_override');

  const detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  assert.equal(detail.id, account.id);
  assert.equal(detail.sourceLeadId, lead.id);
  assert.equal(detail.territoryName, 'Texas Accounts Territory');
  assert.equal(detail.regionName, 'Accounts Region');
  assert.equal(detail.shippingCenterName, shippingCenter.name);
  assert.equal(detail.assignedTmName, actor.displayName);
  assert.equal(detail.assignedRdName, actor.displayName);
  assert.equal(detail.contacts.length, 1);
  assert.equal(detail.locations.length, 1);
});

test('account detail exposes CRM-owned readiness checks without ERP assumptions', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Readiness Dealer',
    contactDisplayName: 'Riley Readiness',
    email: 'readiness@example.com',
    phone: '555-310-1000',
    state: 'TX',
    serviceTechCount: 6,
  });
  const region = await prisma.region.create({
    data: {
      code: 'rg_account_readiness',
      name: 'Account Readiness Region',
      isActive: true,
    },
  });
  const tmUser = await prisma.user.create({
    data: {
      email: 'tm.account.readiness@pulse.local',
      displayName: 'TM Account Readiness',
      roleCode: 'TERRITORY_MANAGER',
      isActive: true,
    },
  });
  const rdUser = await prisma.user.create({
    data: {
      email: 'rd.account.readiness@pulse.local',
      displayName: 'RD Account Readiness',
      roleCode: 'REGIONAL_DIRECTOR',
      isActive: true,
    },
  });
  const territory = await prisma.territory.create({
    data: {
      code: 'territory_account_readiness',
      name: 'Account Readiness Territory',
      regionId: region.id,
      managerUserId: tmUser.id,
      isActive: true,
    },
  });
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  const readyAccount = await prisma.account.create({
    data: {
      sourceLeadId: lead.id,
      displayName: 'Readiness Dealer',
      legalName: 'Readiness Dealer LLC',
      accountType: 'Dealer',
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      groupClassification: 'INDEPENDENT',
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: tmUser.id,
      assignedRdUserId: rdUser.id,
      lastEngagementAt: new Date(),
      contacts: {
        create: {
          firstName: 'Riley',
          lastName: 'Readiness',
          email: 'readiness@example.com',
          isPrimary: true,
          isActive: true,
        },
      },
      locations: {
        create: {
          city: 'Dallas',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
          isActive: true,
        },
      },
    },
  });
  const incompleteAccount = await prisma.account.create({
    data: {
      displayName: 'Incomplete Readiness Dealer',
      affinityGroupSelection: 'UNKNOWN',
      ownershipGroupSelection: 'UNKNOWN',
      isActive: true,
    },
  });

  const readyDetail = await getAccountDetail(actor, readyAccount.id);
  assert.equal(readyDetail.readiness.status, 'ready');
  assert.equal(readyDetail.readiness.score, 100);
  assert.equal(readyDetail.readiness.checks.find((check) => check.key === 'dealer_membership')?.status, 'ready');
  assert.equal(readyDetail.activityReview.documentBoundaries.find((boundary) => boundary.key === 'source_lead')?.status, 'available');
  assert.equal(readyDetail.activityReview.documentBoundaries.find((boundary) => boundary.key === 'erp_documents')?.status, 'parked');
  assert.match(
    readyDetail.activityReview.parkedDependencies.join(' '),
    /Acumatica access and mappings are certified/i,
  );
  assert.ok(readyDetail.activityReview.recentEvents.some((event) => event.source === 'source_lead'));
  assert.match(
    readyDetail.readiness.checks.find((check) => check.key === 'source_lineage')?.message ?? '',
    /source lead is linked/i,
  );

  const incompleteDetail = await getAccountDetail(actor, incompleteAccount.id);
  assert.equal(incompleteDetail.readiness.status, 'parked');
  assert.equal(incompleteDetail.readiness.checks.find((check) => check.key === 'territory')?.status, 'needs_attention');
  assert.equal(incompleteDetail.readiness.checks.find((check) => check.key === 'erp_activity')?.status, 'parked');
});

test('direct customer creation is reserved for super admin or migration workflows', SERIAL, async () => {
  const actor = await createAdminActor();

  await assert.rejects(
    createAccount(
      {
        ...actor,
        role: 'SALES_BD_REP',
      },
      {
        displayName: 'Should Not Create',
      },
    ),
    /reserved for bootstrap or migration workflows/i,
  );

  const created = await createAccount(actor, {
    displayName: 'Migration Seed Account',
    legalName: 'Migration Seed Account LLC',
    accountType: 'Dealer',
  });

  assert.equal(created.displayName, 'Migration Seed Account');
});

test('territory-scoped customer visibility stays simple for territory managers', SERIAL, async () => {
  const adminActor = await createAdminActor();
  const tmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.scope.accounts@pulse.local', 'TM Scoped');
  const otherTmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.other.accounts@pulse.local', 'TM Other');
  const rdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.scope.accounts@pulse.local', 'RD Scoped');

  const region = await prisma.region.create({
    data: {
      code: 'rg_scope_accounts',
      name: 'Scoped Accounts Region',
      directorUserId: rdActor.userId,
      isActive: true,
    },
  });

  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const ownedTerritory = await prisma.territory.create({
    data: {
      code: 'tm_owned_accounts',
      name: 'TM Owned Accounts Territory',
      regionId: region.id,
      managerUserId: tmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const otherTerritory = await prisma.territory.create({
    data: {
      code: 'tm_other_accounts',
      name: 'TM Other Accounts Territory',
      regionId: region.id,
      managerUserId: otherTmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const visibleAccount = await prisma.account.create({
    data: {
      displayName: 'Scoped Visible Dealer',
      legalName: 'Scoped Visible Dealer LLC',
      territoryId: ownedTerritory.id,
      assignedTmUserId: tmActor.userId,
      assignedRdUserId: rdActor.userId,
      isActive: true,
    },
  });

  const hiddenAccount = await prisma.account.create({
    data: {
      displayName: 'Scoped Hidden Dealer',
      legalName: 'Scoped Hidden Dealer LLC',
      territoryId: otherTerritory.id,
      assignedTmUserId: otherTmActor.userId,
      assignedRdUserId: rdActor.userId,
      isActive: true,
    },
  });

  const visibleList = await listAccounts(tmActor, {});
  assert.equal(visibleList.total, 1);
  assert.deepEqual(visibleList.items.map((item) => item.id), [visibleAccount.id]);

  const visibleDetail = await getAccountDetail(tmActor, visibleAccount.id);
  assert.ok(visibleDetail);
  assert.equal(visibleDetail.id, visibleAccount.id);

  const hiddenDetail = await getAccountDetail(tmActor, hiddenAccount.id);
  assert.equal(hiddenDetail, null);

  const adminList = await listAccounts(adminActor, {});
  assert.equal(adminList.total, 2);
});

test('regional directors can see accounts across territories in regions they direct', SERIAL, async () => {
  const adminActor = await createAdminActor();
  const tmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.rd.accounts@pulse.local', 'TM RD Accounts');
  const otherTmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.rd.other.accounts@pulse.local', 'TM Other RD Accounts');
  const rdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.region.accounts@pulse.local', 'RD Region Accounts');
  const outsideRdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.outside.accounts@pulse.local', 'RD Outside Accounts');

  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const ownedRegion = await prisma.region.create({
    data: {
      code: 'rg_rd_accounts',
      name: 'RD Accounts Region',
      directorUserId: rdActor.userId,
      isActive: true,
    },
  });

  const outsideRegion = await prisma.region.create({
    data: {
      code: 'rg_outside_accounts',
      name: 'Outside Accounts Region',
      directorUserId: outsideRdActor.userId,
      isActive: true,
    },
  });

  const firstTerritory = await prisma.territory.create({
    data: {
      code: 'rd_accounts_one',
      name: 'RD Accounts One',
      regionId: ownedRegion.id,
      managerUserId: tmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const secondTerritory = await prisma.territory.create({
    data: {
      code: 'rd_accounts_two',
      name: 'RD Accounts Two',
      regionId: ownedRegion.id,
      managerUserId: otherTmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const hiddenTerritory = await prisma.territory.create({
    data: {
      code: 'rd_accounts_hidden',
      name: 'RD Accounts Hidden',
      regionId: outsideRegion.id,
      managerUserId: otherTmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const firstVisible = await prisma.account.create({
    data: {
      displayName: 'RD Visible Dealer One',
      legalName: 'RD Visible Dealer One LLC',
      territoryId: firstTerritory.id,
      assignedTmUserId: tmActor.userId,
      assignedRdUserId: rdActor.userId,
      isActive: true,
    },
  });

  const secondVisible = await prisma.account.create({
    data: {
      displayName: 'RD Visible Dealer Two',
      legalName: 'RD Visible Dealer Two LLC',
      territoryId: secondTerritory.id,
      assignedTmUserId: otherTmActor.userId,
      assignedRdUserId: rdActor.userId,
      isActive: true,
    },
  });

  await prisma.account.create({
    data: {
      displayName: 'RD Hidden Dealer',
      legalName: 'RD Hidden Dealer LLC',
      territoryId: hiddenTerritory.id,
      assignedTmUserId: otherTmActor.userId,
      assignedRdUserId: outsideRdActor.userId,
      isActive: true,
    },
  });

  const rdList = await listAccounts(rdActor, {});
  assert.equal(rdList.total, 2);
  assert.deepEqual(
    rdList.items.map((item) => item.id).sort(),
    [firstVisible.id, secondVisible.id].sort(),
  );

  const firstDetail = await getAccountDetail(rdActor, firstVisible.id);
  const secondDetail = await getAccountDetail(rdActor, secondVisible.id);
  assert.ok(firstDetail);
  assert.ok(secondDetail);
});

test('account contact maintenance supports primary reassignment and soft deactivation', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Contact Maintenance Account',
      legalName: 'Contact Maintenance Account LLC',
    },
  });

  const primary = await createAccountContact(actor, account.id, {
    firstName: 'Avery',
    lastName: 'Primary',
    email: 'avery@example.com',
    roleCode: 'Primary',
    isPrimary: true,
  });

  const secondary = await createAccountContact(actor, account.id, {
    firstName: 'Jordan',
    lastName: 'Backup',
    email: 'jordan@example.com',
    roleCode: 'Ordering',
  });

  await updateAccountContact(actor, account.id, secondary.id, {
    isPrimary: true,
    roleCode: 'Owner/GM',
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const updatedPrimary = detail.contacts.find((contact) => contact.id === secondary.id);
  const demotedPrimary = detail.contacts.find((contact) => contact.id === primary.id);
  assert.equal(updatedPrimary?.isPrimary, true);
  assert.equal(updatedPrimary?.roleCode, 'Owner/GM');
  assert.equal(demotedPrimary?.isPrimary, false);

  await updateAccountContact(actor, account.id, secondary.id, {
    isActive: false,
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const reactivatedPrimary = detail.contacts.find((contact) => contact.id === primary.id);
  const inactiveContact = detail.contacts.find((contact) => contact.id === secondary.id);
  assert.equal(reactivatedPrimary?.isPrimary, true);
  assert.equal(inactiveContact?.isActive, false);
});

test('account location maintenance supports primary switching and deactivation fallback', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Location Maintenance Account',
      legalName: 'Location Maintenance Account LLC',
    },
  });

  const primary = await createAccountLocation(actor, account.id, {
    name: 'Dallas',
    line1: '100 Main Street',
    city: 'Dallas',
    state: 'TX',
    isPrimary: true,
  });

  const secondary = await createAccountLocation(actor, account.id, {
    name: 'Fort Worth',
    line1: '200 Commerce Street',
    city: 'Fort Worth',
    state: 'TX',
  });

  await updateAccountLocation(actor, account.id, secondary.id, {
    isPrimary: true,
    postalCode: '76102',
  });

  let detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const nextPrimary = detail.locations.find((location) => location.id === secondary.id);
  const oldPrimary = detail.locations.find((location) => location.id === primary.id);
  assert.equal(nextPrimary?.isPrimary, true);
  assert.equal(nextPrimary?.postalCode, '76102');
  assert.equal(oldPrimary?.isPrimary, false);

  await updateAccountLocation(actor, account.id, secondary.id, {
    isActive: false,
  });

  detail = await getAccountDetail(actor, account.id);
  assert.ok(detail);
  const fallbackPrimary = detail.locations.find((location) => location.id === primary.id);
  const inactiveLocation = detail.locations.find((location) => location.id === secondary.id);
  assert.equal(fallbackPrimary?.isPrimary, true);
  assert.equal(inactiveLocation?.isActive, false);
});

test('account summary updates are editable through the governed maintenance path', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Editable Account',
      legalName: 'Editable Account LLC',
      accountType: 'Dealer',
      isActive: true,
    },
  });

  const updated = await updateAccount(actor, account.id, {
    displayName: 'Editable Account Updated',
    legalName: null,
    accountType: 'Distributor',
    isActive: false,
  });

  assert.equal(updated.displayName, 'Editable Account Updated');
  assert.equal(updated.accountType, 'Distributor');
  assert.equal(updated.isActive, false);

  const detail = await getAccountDetail(actor, account.id);
  assert.equal(detail?.legalName, undefined);
});

test('partial account membership updates preserve the opposite axis before deriving classification', SERIAL, async () => {
  const actor = await createAdminActor();
  const affinityGroup = await prisma.affinityGroupRef.create({
    data: {
      code: 'ACCT_NEXSTAR',
      name: 'Account Nexstar',
      groupType: 'BUYING_GROUP',
      isActive: true,
    },
  });
  const ownershipGroup = await prisma.ownershipGroupRef.create({
    data: {
      code: 'ACCT_REDWOOD',
      name: 'Account Redwood',
      ownershipType: 'PRIVATE_EQUITY',
      isActive: true,
    },
  });
  const account = await prisma.account.create({
    data: {
      displayName: 'Hybrid Editable Account',
      legalName: 'Hybrid Editable Account LLC',
      accountType: 'Dealer',
      affinityGroupSelection: 'GROUP',
      affinityGroupId: affinityGroup.id,
      ownershipGroupSelection: 'GROUP',
      ownershipGroupId: ownershipGroup.id,
      groupClassification: 'HYBRID',
      isActive: true,
    },
  });

  const updated = await updateAccount(actor, account.id, {
    affinityGroupSelection: 'none',
  });

  assert.equal(updated.affinityGroupSelection, 'none');
  assert.equal(updated.ownershipGroupSelection, 'group');
  assert.equal(updated.ownershipGroupName, 'Account Redwood');
  assert.equal(updated.groupClassification, 'ownership_only');
});

test('account lifecycle states are filterable and governed with transition rules', SERIAL, async () => {
  const actor = await createAdminActor();

  const account = await prisma.account.create({
    data: {
      displayName: 'Lifecycle Account',
      legalName: 'Lifecycle Account LLC',
      lifecycleStatus: 'ACTIVE',
      lifecycleStatusChangedAt: new Date('2026-04-15T10:00:00.000Z'),
      isActive: true,
    },
  });

  await assert.rejects(
    updateAccountLifecycle(actor, account.id, {
      lifecycleStatus: 'churned',
    }),
    /transition is not allowed/i,
  );

  const atRisk = await updateAccountLifecycle(actor, account.id, {
    lifecycleStatus: 'at_risk',
    lifecycleReasonNote: 'Ordering cadence has slowed.',
  });
  assert.equal(atRisk.lifecycleStatus, 'at_risk');
  assert.equal(atRisk.isActive, true);

  const filtered = await listAccounts(actor, {
    lifecycleStatus: 'at_risk',
  });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0]?.id, account.id);

  const inactive = await updateAccountLifecycle(actor, account.id, {
    lifecycleStatus: 'inactive',
    lifecycleReasonNote: 'No recent orders.',
  });
  assert.equal(inactive.lifecycleStatus, 'inactive');
  assert.equal(inactive.isActive, false);

  await assert.rejects(
    updateAccountLifecycle(actor, account.id, {
      lifecycleStatus: 'churned',
    }),
    /required before an account can be marked as churned/i,
  );

  const churned = await updateAccountLifecycle(actor, account.id, {
    lifecycleStatus: 'churned',
    lifecycleReasonNote: 'Dealer exited the program.',
  });
  assert.equal(churned.lifecycleStatus, 'churned');
  assert.equal(churned.isActive, false);

  const reactivated = await updateAccountLifecycle(actor, account.id, {
    lifecycleStatus: 'active',
    lifecycleReasonNote: 'New order confirmed.',
  });
  assert.equal(reactivated.lifecycleStatus, 'active');
  assert.equal(reactivated.isActive, true);

  const archived = await updateAccount(actor, account.id, {
    isActive: false,
  });
  assert.equal(archived.lifecycleStatus, 'active');
  assert.equal(archived.isActive, false);
});

test('finance roles can register and promote tokenized account payment methods without exposing raw payment data', SERIAL, async () => {
  const adminActor = await createAdminActor();
  const financeActor = await createScopedActor('FINANCE', 'finance.account.methods@pulse.local', 'Finance Methods');
  const salesActor = await createScopedActor('SALES_BD_REP', 'sales.account.methods@pulse.local', 'Sales Methods');

  const lead = await createLead(adminActor, {
    companyName: 'Vault Promote Dealer',
    contactDisplayName: 'Vault Promote Contact',
    email: 'vault.promote@example.com',
    phone: '555-555-1010',
    serviceTechCount: 4,
    state: 'TX',
  });

  const account = await prisma.account.create({
    data: {
      sourceLeadId: lead.id,
      displayName: 'Vault Promote Dealer',
      legalName: 'Vault Promote Dealer LLC',
      isActive: true,
    },
  });

  const cisPackage = await prisma.cisPackage.create({
    data: {
      leadId: lead.id,
      status: 'FINANCE_APPROVED',
      entryMethod: 'DIGITAL_LINK',
      paymentStatus: 'VAULT_COMPLETE',
      esignStatus: 'SIGNED',
    },
  });

  const sourceVault = await prisma.cisPaymentVaultReference.create({
    data: {
      cisPackageId: cisPackage.id,
      provider: 'EBIZCHARGE',
      vaultToken: 'tok_cis_promote',
      vaultCustomerRef: 'cust_cis_promote',
      last4: '4242',
      brand: 'Visa',
      authorizationCapturedAt: new Date('2026-04-17T09:30:00.000Z'),
      status: 'vault_complete',
    },
  });

  await assert.rejects(
    () => listAccountPaymentMethods(salesActor, account.id),
    /customer\.financials_view/i,
  );

  const manualMethod = await createAccountPaymentMethod(financeActor, account.id, {
    provider: 'moneris',
    vaultToken: 'tok_manual_account',
    vaultCustomerRef: 'cust_manual_account',
    externalPaymentMethodRef: 'pm_manual_account',
    last4: '1111',
    brand: 'Mastercard',
    billingZip: '75001',
    authorizationCapturedAt: '2026-04-17T10:00:00.000Z',
    status: 'active',
    isDefault: true,
  });

  assert.equal(manualMethod.provider, 'moneris');
  assert.equal(manualMethod.last4, '1111');
  assert.equal(manualMethod.source, 'manual');

  const promotedMethod = await createAccountPaymentMethod(financeActor, account.id, {
    sourceCisVaultReferenceId: sourceVault.id,
    externalPaymentMethodRef: 'pm_promoted_account',
    billingZip: '75002',
    status: 'active',
    isDefault: true,
  });

  assert.equal(promotedMethod.provider, 'ebizcharge');
  assert.equal(promotedMethod.last4, '4242');
  assert.equal(promotedMethod.source, 'cis_promoted');
  assert.equal(promotedMethod.sourceCisVaultReferenceId, sourceVault.id);
  assert.equal(promotedMethod.isDefault, true);

  const promotedAgain = await createAccountPaymentMethod(financeActor, account.id, {
    sourceCisVaultReferenceId: sourceVault.id,
    billingZip: '75003',
    status: 'active',
    isDefault: true,
  });
  assert.equal(promotedAgain.id, promotedMethod.id);
  assert.equal(promotedAgain.billingZip, '75003');

  let paymentMethods = await listAccountPaymentMethods(financeActor, account.id);
  assert.ok(paymentMethods);
  assert.equal(paymentMethods.items.length, 2);
  assert.equal(paymentMethods.items[0]?.id, promotedMethod.id);
  assert.equal(paymentMethods.items[0]?.isDefault, true);
  assert.equal(paymentMethods.items[1]?.id, manualMethod.id);
  assert.equal(paymentMethods.items[1]?.isDefault, false);

  await assert.rejects(
    () => createAccountPaymentMethod(salesActor, account.id, {
      provider: 'ebizcharge',
      vaultToken: 'tok_forbidden',
      status: 'active',
    }),
    /customer\.financials_manage/i,
  );

  const deactivatedPromoted = await updateAccountPaymentMethod(financeActor, account.id, promotedMethod.id, {
    isActive: false,
  });
  assert.equal(deactivatedPromoted.isActive, false);

  paymentMethods = await listAccountPaymentMethods(financeActor, account.id);
  assert.ok(paymentMethods);
  const nextDefault = paymentMethods.items.find((item) => item.isDefault);
  assert.equal(nextDefault?.id, manualMethod.id);
});

test('updateAccount assigns, clears, and validates brand / private label', SERIAL, async () => {
  const actor = await createAdminActor();

  const brand = await prisma.brandLabelRef.create({
    data: {
      code: 'currie_brand_regression',
      name: 'Currie Regression Brand',
      isActive: true,
      sortOrder: 10,
    },
  });

  const account = await prisma.account.create({
    data: {
      displayName: 'Brand Label Regression Dealer',
      accountType: 'Dealer',
      affinityGroupSelection: 'NONE',
      ownershipGroupSelection: 'NONE',
      isActive: true,
    },
  });

  // Assign a brand label and confirm it persists on the read model.
  const assigned = await updateAccount(actor, account.id, {
    brandLabelId: brand.id,
  });
  assert.equal(assigned.brandLabelId, brand.id);
  assert.equal(assigned.brandLabelName, brand.name);

  const persisted = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(persisted.brandLabelId, brand.id);

  const detail = await getAccountDetail(actor, account.id);
  assert.equal(detail.brandLabelId, brand.id);
  assert.equal(detail.brandLabelName, brand.name);

  // Clearing to null removes the brand assignment.
  const cleared = await updateAccount(actor, account.id, {
    brandLabelId: null,
  });
  assert.equal(cleared.brandLabelId, undefined);
  assert.equal(cleared.brandLabelName, undefined);

  const clearedRecord = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(clearedRecord.brandLabelId, null);

  // An unknown brand label id is rejected.
  await assert.rejects(
    () => updateAccount(actor, account.id, {
      brandLabelId: '00000000-0000-0000-0000-000000000000',
    }),
    /brand label not found/i,
  );
});

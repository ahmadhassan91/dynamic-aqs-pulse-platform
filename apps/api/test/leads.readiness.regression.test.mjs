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
let authenticateAccessToken;
let createLead;
let issueCisLink;
let savePublicCisDraft;
let submitPublicCis;
let reviewAndSignOffCis;
let submitCisToFinance;
let recordFinanceDecision;
let getLeadReadiness;
let generateLeadReadinessChecklist;
let updateLeadReadinessItem;
let importLeadContactsFromCis;
let getLeadConversionPreparation;
let updateLeadConversionPreparation;
let validateLeadConversionPreparation;
let convertLeadOnFirstOrder;

const SERIAL = { concurrency: false };
const MANUAL_REQUIRED_CODES = new Set([
  'affinity_group_validated',
  'ownership_group_validated',
  'welcome_email_sent',
  'training_session_1_scheduled',
  'training_session_2_completed',
  'training_session_3_completed',
  'account_readiness_verified',
]);

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
    getLeadReadiness,
    generateLeadReadinessChecklist,
    updateLeadReadinessItem,
    importLeadContactsFromCis,
    getLeadConversionPreparation,
    updateLeadConversionPreparation,
    validateLeadConversionPreparation,
    convertLeadOnFirstOrder,
  } = await import('../dist/modules/leads/readiness.js'));
  ({
    issueCisLink,
    savePublicCisDraft,
    submitPublicCis,
    reviewAndSignOffCis,
    submitCisToFinance,
    recordFinanceDecision,
  } = await import('../dist/modules/cis/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));

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

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, 'expected a bootstrap admin actor');
  return actor;
}

function extractPublicToken(publicUrl) {
  const token = new URL(publicUrl).pathname.split('/').filter(Boolean).at(-1);
  assert.ok(token, 'expected a public CIS token');
  return token;
}

function buildCompleteCisFormData(overrides = {}) {
  return {
    companyWebsite: 'https://evergreencomfort.example.com',
    numOfTechs: 7,
    numOfInstallTechs: 2,
    numOfSalespeopleAdvisors: 1,
    affinityGroupOrFranchise: 'AireServ',
    isPrivateEquity: false,
    parentCompanyName: 'Franchise Group',
    primaryContactName: 'Jordan Mills',
    primaryContactTitle: 'Owner',
    primaryContactEmail: 'jordan.mills@example.com',
    primaryContactCellPhone: '555-000-1111',
    ownerManagerName: 'Jordan Mills',
    ownerManagerTitle: 'Owner',
    ownerManagerEmail: 'jordan.mills@example.com',
    ownerManagerCellPhone: '555-000-1111',
    legalCompanyName: 'Evergreen Comfort LLC',
    physicalAddress: '455 Market Street',
    physicalCity: 'Dallas',
    physicalState: 'TX',
    physicalZip: '75201',
    physicalCountryCode: 'US',
    billingAddress: '455 Market Street',
    billingCity: 'Dallas',
    billingState: 'TX',
    billingZip: '75201',
    billingCountryCode: 'US',
    companyPhone: '555-000-9999',
    typeOfBusiness: 'LLC',
    yearsInBusiness: 4,
    monthsInBusiness: 3,
    orderingContactName: 'Jordan Mills',
    orderingContactCellPhone: '555-000-1111',
    orderingContactEmail: 'ordering@example.com',
    apContactName: 'Dana Accounts',
    apDirectPhone: '555-000-2222',
    apEmail: 'ap@example.com',
    paymentMethod: 'NET_30',
    cardOnFileAuthorized: true,
    resaleCertificateAttached: true,
    hasSignature: true,
    ...overrides,
  };
}

async function createFinanceReviewedLead(actor, decision = 'approved') {
  const uniqueSuffix = `${decision}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `jordan.mills+${uniqueSuffix}@example.com`;
  const phone = `555-${decision === 'approved' ? '200' : '300'}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const lead = await createLead(actor, {
    companyName: `Evergreen Comfort ${decision}`,
    contactDisplayName: 'Jordan Mills',
    email,
    phone,
    state: 'TX',
    serviceTechCount: 7,
    affinityGroupSelection: 'group',
    affinityGroupCode: 'AIRESERV',
    ownershipGroupSelection: 'none',
  });

  const issued = await issueCisLink(actor, lead.id, {
    recipientEmail: email,
    note: 'Regression issue',
  }, config);
  const token = extractPublicToken(issued.publicUrl);

  await savePublicCisDraft(token, {
    formData: buildCompleteCisFormData({
      paymentMethod: 'NET_30',
      hasSignature: false,
      cardOnFileAuthorized: false,
    }),
  });

  await submitPublicCis(token, {
    formData: buildCompleteCisFormData(),
  });

  await reviewAndSignOffCis(actor, issued.cisPackage.id, {
    salesReviewNotes: 'Sales reviewed the CIS package.',
    financeCoverNotes: 'Ready for finance queue.',
  });

  await submitCisToFinance(actor, issued.cisPackage.id, {
    submissionNotes: 'Regression finance submission.',
  });

  if (decision === 'approved') {
    await recordFinanceDecision(actor, issued.cisPackage.id, {
      decision: 'approved',
      creditLineAmount: 15000,
      paymentTerms: 'NET_30',
      decisionNotes: 'Approved for onboarding.',
    });
  } else if (decision === 'conditional') {
    await recordFinanceDecision(actor, issued.cisPackage.id, {
      decision: 'conditional',
      requestedInfoNotes: 'Need finance follow-through confirmation.',
    });
  } else {
    throw new Error(`Unsupported finance decision for test helper: ${decision}`);
  }

  return {
    lead,
    cisPackageId: issued.cisPackage.id,
  };
}

async function completeManualChecklistItems(actor, leadId) {
  const readiness = await getLeadReadiness(actor, leadId);
  assert.ok(readiness, 'expected readiness detail');

  for (const item of readiness.items) {
    if (!item.required) {
      continue;
    }
    if (!MANUAL_REQUIRED_CODES.has(item.code)) {
      continue;
    }

    await updateLeadReadinessItem(actor, leadId, item.id, {
      status: 'completed',
      notes: `Completed in regression suite for ${item.code}.`,
    });
  }
}

test('lead readiness and conversion regression suite', SERIAL, async () => {
  const actor = await createAdminActor();

  const preFinanceLead = await createLead(actor, {
    companyName: 'Pre Finance HVAC',
    contactDisplayName: 'Alex Driver',
    email: 'alex.driver@example.com',
    phone: '555-100-0000',
    state: 'TX',
    serviceTechCount: 4,
  });

  await assert.rejects(
    () => generateLeadReadinessChecklist(actor, preFinanceLead.id),
    /finance approval or conditional approval/i,
  );

  const conditionalFixture = await createFinanceReviewedLead(actor, 'conditional');
  const conditionalFirst = await generateLeadReadinessChecklist(actor, conditionalFixture.lead.id);
  const conditionalSecond = await generateLeadReadinessChecklist(actor, conditionalFixture.lead.id);

  assert.equal(conditionalFirst.items.length, 12);
  assert.equal(conditionalSecond.items.length, 12);
  assert.ok(conditionalSecond.blockers.some((blocker) => blocker.includes('Finance approval is conditional')));

  const conditionalChecklistCount = await prisma.onboardingChecklist.count({
    where: { leadId: conditionalFixture.lead.id },
  });
  const conditionalItemCount = await prisma.onboardingChecklistItem.count({
    where: {
      checklist: {
        leadId: conditionalFixture.lead.id,
      },
    },
  });
  assert.equal(conditionalChecklistCount, 1);
  assert.equal(conditionalItemCount, 12);

  const readyFixture = await createFinanceReviewedLead(actor, 'approved');
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });
  const region = await prisma.region.create({
    data: {
      code: 'rg_conversion',
      name: 'Conversion Region',
      directorUserId: actor.userId,
      isActive: true,
    },
  });
  const territory = await prisma.territory.create({
    data: {
      code: 'tx_conversion',
      name: 'Texas Conversion Territory',
      regionId: region.id,
      managerUserId: actor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });
  await prisma.lead.update({
    where: { id: readyFixture.lead.id },
    data: {
      territoryId: territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date('2026-04-13T09:30:00.000Z'),
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: actor.userId,
      assignedRdUserId: actor.userId,
    },
  });
  await generateLeadReadinessChecklist(actor, readyFixture.lead.id);

  const firstImport = await importLeadContactsFromCis(actor, readyFixture.lead.id);
  const secondImport = await importLeadContactsFromCis(actor, readyFixture.lead.id);
  assert.equal(secondImport.length, firstImport.length);
  assert.equal(new Set(secondImport.map((contact) => contact.role)).size, secondImport.length);

  const initialPrep = await getLeadConversionPreparation(actor, readyFixture.lead.id);
  assert.ok(initialPrep);
  assert.equal(initialPrep.portalEligibilityStatus, 'unassessed');

  const incompleteValidation = await validateLeadConversionPreparation(actor, readyFixture.lead.id);
  assert.equal(incompleteValidation.ready, false);
  assert.ok(incompleteValidation.blockers.some((blocker) => blocker.includes('Price class is not assigned')));

  const updatedPrep = await updateLeadConversionPreparation(actor, readyFixture.lead.id, {
    priceClassCode: 'NET30-DEALER',
    portalEligibilityStatus: 'provisioned',
    shippingAddressSnapshot: {
      name: 'Evergreen Comfort Main',
      line1: '455 Market Street',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75201',
      countryCode: 'US',
    },
    billingAddressSnapshot: {
      name: 'Billing',
      line1: '455 Market Street',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75201',
      countryCode: 'US',
    },
    notes: 'Prepared for first-order conversion.',
  });

  assert.equal(updatedPrep.portalEligibilityStatus, 'provisioned');
  assert.equal(updatedPrep.priceClassCode, 'NET30-DEALER');

  await completeManualChecklistItems(actor, readyFixture.lead.id);

  const readyValidation = await validateLeadConversionPreparation(actor, readyFixture.lead.id);
  assert.equal(readyValidation.ready, true);
  assert.deepEqual(readyValidation.blockers, []);

  const readyReadiness = await getLeadReadiness(actor, readyFixture.lead.id);
  assert.ok(readyReadiness);
  assert.equal(readyReadiness.summary.status, 'ready');
  assert.equal(readyReadiness.summary.checklistStatus, 'completed');

  await assert.rejects(
    () => convertLeadOnFirstOrder(actor, readyFixture.lead.id, {}),
    /firstOrderConfirmedAt is required/i,
  );

  const converted = await convertLeadOnFirstOrder(actor, readyFixture.lead.id, {
    firstOrderConfirmedAt: '2026-04-13T10:00:00.000Z',
    note: 'First dealer order confirmed.',
  });

  assert.equal(converted.leadId, readyFixture.lead.id);
  assert.ok(converted.accountId);
  assert.ok(converted.contactIds.length >= 1);
  assert.ok(converted.locationIds.length >= 1);

  const convertedAccount = await prisma.account.findUniqueOrThrow({
    where: { id: converted.accountId },
  });
  assert.equal(convertedAccount.sourceLeadId, readyFixture.lead.id);
  assert.equal(convertedAccount.territoryId, territory.id);
  assert.equal(convertedAccount.shippingCenterId, shippingCenter.id);
  assert.equal(convertedAccount.assignedTmUserId, actor.userId);
  assert.equal(convertedAccount.assignedRdUserId, actor.userId);
  assert.equal(convertedAccount.territoryAssignmentMethod, 'MANUAL_OVERRIDE');
  assert.equal(convertedAccount.lifecycleStatus, 'ACTIVE');
  assert.ok(convertedAccount.lifecycleStatusChangedAt);
  assert.ok(convertedAccount.lastOrderAt);
  assert.ok(convertedAccount.territoryAssignedAt);

  const convertedReadiness = await getLeadReadiness(actor, readyFixture.lead.id);
  assert.ok(convertedReadiness);
  assert.equal(convertedReadiness.summary.status, 'converted');

  await assert.rejects(
    () => convertLeadOnFirstOrder(actor, readyFixture.lead.id, {
      firstOrderConfirmedAt: '2026-04-13T10:05:00.000Z',
    }),
    /already been converted/i,
  );
});

test('conditional finance approval keeps conversion blocked even after checklist completion', SERIAL, async () => {
  const actor = await createAdminActor();
  const fixture = await createFinanceReviewedLead(actor, 'conditional');

  await generateLeadReadinessChecklist(actor, fixture.lead.id);
  await importLeadContactsFromCis(actor, fixture.lead.id);

  await updateLeadConversionPreparation(actor, fixture.lead.id, {
    priceClassCode: 'NET30-CONDITIONAL',
    portalEligibilityStatus: 'provisioned',
    shippingAddressSnapshot: {
      name: 'Conditional Main',
      line1: '455 Market Street',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75201',
      countryCode: 'US',
    },
    billingAddressSnapshot: {
      name: 'Conditional Billing',
      line1: '455 Market Street',
      city: 'Dallas',
      state: 'TX',
      postalCode: '75201',
      countryCode: 'US',
    },
    notes: 'Conditional finance follow-through still pending.',
  });

  await completeManualChecklistItems(actor, fixture.lead.id);

  const readiness = await getLeadReadiness(actor, fixture.lead.id);
  assert.ok(readiness);
  assert.equal(readiness.summary.checklistStatus, 'blocked');
  assert.equal(readiness.summary.status, 'blocked');
  assert.ok(readiness.blockers.some((blocker) => blocker.includes('Finance approval is conditional')));

  const validation = await validateLeadConversionPreparation(actor, fixture.lead.id);
  assert.equal(validation.ready, false);
  assert.ok(validation.blockers.some((blocker) => blocker.includes('Finance approval is conditional')));

  await assert.rejects(
    () => convertLeadOnFirstOrder(actor, fixture.lead.id, {
      firstOrderConfirmedAt: '2026-04-13T10:00:00.000Z',
    }),
    /Finance approval is conditional and still requires follow-through/i,
  );
});

async function buildReadyToConvertLead(actor) {
  const readyFixture = await createFinanceReviewedLead(actor, 'approved');
  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  const region = await prisma.region.create({
    data: { code: 'rg_ord_p5', name: 'ORD-P5 Region', directorUserId: actor.userId, isActive: true },
  });
  const territory = await prisma.territory.create({
    data: {
      code: 'tx_ord_p5',
      name: 'ORD-P5 Territory',
      regionId: region.id,
      managerUserId: actor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });
  await prisma.lead.update({
    where: { id: readyFixture.lead.id },
    data: {
      territoryId: territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date('2026-04-13T09:30:00.000Z'),
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: actor.userId,
      assignedRdUserId: actor.userId,
    },
  });
  await generateLeadReadinessChecklist(actor, readyFixture.lead.id);
  await importLeadContactsFromCis(actor, readyFixture.lead.id);
  await updateLeadConversionPreparation(actor, readyFixture.lead.id, {
    priceClassCode: 'NET30-DEALER',
    portalEligibilityStatus: 'provisioned',
    shippingAddressSnapshot: { name: 'Main', line1: '455 Market Street', city: 'Dallas', state: 'TX', postalCode: '75201', countryCode: 'US' },
    billingAddressSnapshot: { name: 'Billing', line1: '455 Market Street', city: 'Dallas', state: 'TX', postalCode: '75201', countryCode: 'US' },
    notes: 'ORD-P5 ready lead.',
  });
  await completeManualChecklistItems(actor, readyFixture.lead.id);
  const readiness = await getLeadReadiness(actor, readyFixture.lead.id);
  assert.equal(readiness.summary.status, 'ready');
  return readyFixture.lead;
}

test('ORD-P5: order auto first-order signal flag derives the conversion date without manual entry', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await buildReadyToConvertLead(actor);

  // Flag OFF (default) — conversion still requires a manually entered first-order date.
  await assert.rejects(
    () => convertLeadOnFirstOrder(actor, lead.id, {}, { autoFirstOrderSignal: false }),
    /firstOrderConfirmedAt is required/i,
  );

  // Flag ON — the conversion moment supplies the first-order timestamp.
  const before = Date.now();
  const converted = await convertLeadOnFirstOrder(actor, lead.id, {}, { autoFirstOrderSignal: true });
  assert.ok(converted.accountId);

  const updatedLead = await prisma.lead.findUniqueOrThrow({
    where: { id: lead.id },
    select: { stage: true, firstOrderAt: true },
  });
  assert.equal(updatedLead.stage, 'CUSTOMER_ACTIVE');
  assert.ok(updatedLead.firstOrderAt, 'firstOrderAt should be derived');
  const derivedMs = new Date(updatedLead.firstOrderAt).getTime();
  assert.ok(derivedMs >= before - 2000 && derivedMs <= Date.now() + 2000, `derived ~ now, got ${updatedLead.firstOrderAt}`);

  const account = await prisma.account.findUniqueOrThrow({
    where: { id: converted.accountId },
    select: { sourceLeadId: true },
  });
  assert.equal(account.sourceLeadId, lead.id);
});

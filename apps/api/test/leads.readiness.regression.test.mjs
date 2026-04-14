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
  const lead = await createLead(actor, {
    companyName: 'Evergreen Comfort',
    contactDisplayName: 'Jordan Mills',
    email: 'jordan.mills@example.com',
    phone: '555-000-1111',
    state: 'TX',
    serviceTechCount: 7,
    affinityGroupName: 'AireServ',
    ownershipGroupName: 'Franchise Group',
  });

  const issued = await issueCisLink(actor, lead.id, {
    recipientEmail: 'jordan.mills@example.com',
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

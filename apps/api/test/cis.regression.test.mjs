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
let createAdminUser;
let createLead;
let issueCisLink;
let getCisPackageDetail;
let getPublicCisPackage;
let savePublicCisDraft;
let submitPublicCis;
let reviewAndSignOffCis;
let submitCisToFinance;
let listFinanceQueue;
let recordFinanceDecision;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ createAdminUser } = await import('../dist/modules/admin/service.js'));
  ({
    issueCisLink,
    getCisPackageDetail,
    getPublicCisPackage,
    savePublicCisDraft,
    submitPublicCis,
    reviewAndSignOffCis,
    submitCisToFinance,
    listFinanceQueue,
    recordFinanceDecision,
  } = await import('../dist/modules/cis/service.js'));

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

async function createBootstrapAdminContext() {
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

  return { actor, auth };
}

async function createRoleActor(adminActor, role, email, password) {
  await createAdminUser(adminActor, {
    email,
    firstName: role.split('_')[0],
    lastName: 'Regression',
    role,
    isActive: true,
    password,
  });

  const auth = await loginWithPassword(
    config,
    {
      email,
      password,
    },
    {},
  );

  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, `expected actor for ${role}`);
  return { actor, auth };
}

function extractPublicToken(publicUrl) {
  return publicUrl.split('/').pop();
}

function buildValidSubmissionForm(overrides = {}) {
  return {
    primaryContactName: 'Jordan Smith',
    primaryContactEmail: 'jordan.smith@example.com',
    primaryContactCellPhone: '555-111-2222',
    legalCompanyName: 'Jordan HVAC LLC',
    physicalAddress: '100 Main St',
    physicalCity: 'Dallas',
    physicalState: 'TX',
    physicalZip: '75001',
    companyPhone: '555-333-4444',
    typeOfBusiness: 'LLC',
    paymentMethod: 'ACH',
    cardOnFileAuthorized: true,
    achAuthorized: true,
    hasSignature: true,
    ...overrides,
  };
}

async function createLeadWithCis(adminActor, companyName) {
  const lead = await createLead(adminActor, {
    companyName,
    contactDisplayName: `${companyName} Contact`,
    email: `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`,
    phone: '555-900-1000',
    serviceTechCount: 4,
    state: 'TX',
  });

  const issued = await issueCisLink(adminActor, lead.id, {}, config);
  const token = extractPublicToken(issued.publicUrl);

  assert.ok(token, 'expected public cis token');

  return {
    lead,
    cisPackageId: issued.cisPackage.id,
    token,
    issued,
  };
}

async function createSubmittedPackage(adminActor, companyName, formOverrides = {}) {
  const fixture = await createLeadWithCis(adminActor, companyName);
  const submitted = await submitPublicCis(fixture.token, {
    formData: buildValidSubmissionForm(formOverrides),
  });

  assert.equal(submitted.status, 'submitted');

  return fixture;
}

async function createFinancePendingPackage(adminActor, salesActor, companyName, formOverrides = {}) {
  const fixture = await createSubmittedPackage(adminActor, companyName, formOverrides);

  await reviewAndSignOffCis(salesActor, fixture.cisPackageId, {
    salesReviewNotes: 'Reviewed and ready for finance.',
    financeCoverNotes: 'Submit for standard decisioning.',
  });

  const detail = await submitCisToFinance(salesActor, fixture.cisPackageId, {
    submissionNotes: 'Finance queue regression handoff.',
  });

  assert.equal(detail.status, 'finance_pending');

  return fixture;
}

test('cis and finance regression suite', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    adminActor,
    'SALES_BD_REP',
    'sales.rep+cis-suite@dynamicaqs.com',
    'SalesSuite!123',
  );
  const { actor: financeActor } = await createRoleActor(
    adminActor,
    'FINANCE',
    'finance.user+cis-suite@dynamicaqs.com',
    'FinanceSuite!123',
  );

  const resendLead = await createLead(adminActor, {
    companyName: 'Resend Mechanical',
    contactDisplayName: 'Resend Mechanical Contact',
    email: 'resend@example.com',
    phone: '555-101-2020',
    serviceTechCount: 3,
    state: 'TX',
  });

  const firstLink = await issueCisLink(adminActor, resendLead.id, { recipientEmail: 'finance@resend.example.com' }, config);
  const secondLink = await issueCisLink(adminActor, resendLead.id, { note: 'Resend after customer follow-up.' }, config);
  assert.equal(secondLink.cisPackage.id, firstLink.cisPackage.id);
  assert.notEqual(secondLink.publicUrl, firstLink.publicUrl);

  const resendPackages = await prisma.cisPackage.findMany({
    where: { leadId: resendLead.id },
    include: { events: true },
  });
  assert.equal(resendPackages.length, 1);
  assert.equal(resendPackages[0].externalLinkSentCount, 2);
  assert.ok(resendPackages[0].events.some((event) => event.eventType === 'link_sent'));
  assert.ok(resendPackages[0].events.some((event) => event.eventType === 'link_resent'));

  const resendDetail = await getCisPackageDetail(adminActor, firstLink.cisPackage.id);
  assert.ok(resendDetail);
  assert.equal(resendDetail.externalLinkSentCount, 2);

  const draftFixture = await createLeadWithCis(adminActor, 'Draft Merge HVAC');
  const firstDraft = await savePublicCisDraft(draftFixture.token, {
    formData: {
      legalCompanyName: 'Draft Merge HVAC LLC',
      primaryContactName: 'Taylor Draft',
      primaryContactEmail: 'taylor.draft@example.com',
    },
  });
  assert.equal(firstDraft.status, 'draft_in_progress');

  const secondDraft = await savePublicCisDraft(draftFixture.token, {
    formData: {
      companyPhone: '555-333-0000',
      paymentMethod: 'ACH',
      achAuthorized: true,
    },
  });
  assert.equal(secondDraft.formData.legalCompanyName, 'Draft Merge HVAC LLC');
  assert.equal(secondDraft.formData.primaryContactEmail, 'taylor.draft@example.com');
  assert.equal(secondDraft.formData.companyPhone, '555-333-0000');
  assert.equal(secondDraft.formData.paymentMethod, 'ACH');

  const storedDraft = await getPublicCisPackage(draftFixture.token);
  assert.ok(storedDraft);
  assert.equal(storedDraft.formData.primaryContactName, 'Taylor Draft');

  const validationFixture = await createLeadWithCis(adminActor, 'Validation Industrial Air');
  await assert.rejects(
    () =>
      submitPublicCis(validationFixture.token, {
        formData: {
          primaryContactName: 'Validation Contact',
          primaryContactEmail: 'validation-contact@example.com',
          primaryContactCellPhone: '555-100-2000',
          legalCompanyName: 'Validation Industrial Air LLC',
          physicalCity: 'Austin',
          physicalState: 'TX',
          physicalZip: '73301',
          companyPhone: '555-000-0000',
          typeOfBusiness: 'LLC',
          cardOnFileAuthorized: true,
          paymentMethod: 'ACH',
          hasSignature: true,
        },
      }),
    /physicalAddress is required/i,
  );
  await assert.rejects(
    () =>
      submitPublicCis(validationFixture.token, {
        formData: buildValidSubmissionForm({
          primaryContactEmail: 'invalid-email',
        }),
      }),
    /primaryContactEmail must be a valid email/i,
  );

  const submitted = await submitPublicCis(validationFixture.token, {
    formData: buildValidSubmissionForm(),
  });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.paymentStatus, 'vault_pending');
  assert.equal(submitted.esignStatus, 'signed');

  await assert.rejects(
    () => savePublicCisDraft(validationFixture.token, { formData: { companyPhone: '555-000-0000' } }),
    /can no longer be edited/i,
  );
  await assert.rejects(
    () => submitPublicCis(validationFixture.token, { formData: buildValidSubmissionForm({ companyPhone: '555-999-9999' }) }),
    /can no longer be submitted/i,
  );

  const validationLead = await prisma.lead.findUniqueOrThrow({
    where: { id: validationFixture.lead.id },
  });
  assert.ok(validationLead.cisSubmittedAt);

  const financeGateFixture = await createSubmittedPackage(adminActor, 'Finance Gate Heating');
  await assert.rejects(
    () => submitCisToFinance(salesActor, financeGateFixture.cisPackageId, { submissionNotes: 'Submitting too early.' }),
    /must be Sales\/BD signed off/i,
  );

  await reviewAndSignOffCis(salesActor, financeGateFixture.cisPackageId, {
    salesReviewNotes: 'Ready after review.',
  });
  await prisma.cisFormData.update({
    where: { cisPackageId: financeGateFixture.cisPackageId },
    data: { cardOnFileAuthorized: false },
  });
  await assert.rejects(
    () => submitCisToFinance(salesActor, financeGateFixture.cisPackageId, { submissionNotes: 'Card-on-file missing.' }),
    /Card-on-file authorization is required/i,
  );
  await prisma.cisFormData.update({
    where: { cisPackageId: financeGateFixture.cisPackageId },
    data: { cardOnFileAuthorized: true },
  });

  const queued = await submitCisToFinance(salesActor, financeGateFixture.cisPackageId, {
    submissionNotes: 'Finance-ready after signoff.',
  });
  assert.equal(queued.status, 'finance_pending');
  assert.equal(queued.financeDecision?.status, 'pending');

  const branchFixture = await createFinancePendingPackage(adminActor, salesActor, 'Branching Cooling');
  const requestedInfo = await recordFinanceDecision(financeActor, branchFixture.cisPackageId, {
    decision: 'info_requested',
    requestedInfoNotes: 'Need clarification on AP contact ownership.',
  });
  assert.equal(requestedInfo.financeDecision?.status, 'info_requested');

  let queue = await listFinanceQueue(financeActor, { decisionStatus: 'info_requested' });
  assert.equal(queue.total, 1);
  assert.equal(queue.items[0]?.cisPackageId, branchFixture.cisPackageId);

  const resubmitted = await submitCisToFinance(salesActor, branchFixture.cisPackageId, {
    submissionNotes: 'Added requested AP notes.',
  });
  assert.equal(resubmitted.financeDecision?.status, 'pending');
  assert.equal(resubmitted.financeDecision?.requestedInfoNotes, undefined);

  const conditional = await recordFinanceDecision(financeActor, branchFixture.cisPackageId, {
    decision: 'conditional',
    decisionNotes: 'Approve once resale certificate is attached.',
  });
  assert.equal(conditional.financeDecision?.status, 'conditional');

  queue = await listFinanceQueue(financeActor, { decisionStatus: 'conditional' });
  assert.equal(queue.total, 1);
  assert.equal(queue.items[0]?.financeDecisionStatus, 'conditional');

  await assert.rejects(
    () => recordFinanceDecision(financeActor, branchFixture.cisPackageId, { decision: 'approved', paymentTerms: 'NET_30' }),
    /creditLineAmount is required/i,
  );

  const approved = await recordFinanceDecision(financeActor, branchFixture.cisPackageId, {
    decision: 'approved',
    creditLineAmount: 10000,
    paymentTerms: 'NET_30',
    decisionNotes: 'Approved for standard onboarding.',
  });
  assert.equal(approved.status, 'finance_approved');
  assert.equal(approved.financeDecision?.status, 'approved');

  queue = await listFinanceQueue(financeActor, { decisionStatus: 'approved' });
  assert.equal(queue.total, 1);
  assert.equal(queue.items[0]?.cisPackageId, branchFixture.cisPackageId);

  const declineFixture = await createFinancePendingPackage(adminActor, salesActor, 'Decline Queue Air');
  await assert.rejects(
    () => listFinanceQueue(salesActor, {}),
    /cannot perform action lead\.finance_queue_view/i,
  );
  await assert.rejects(
    () => recordFinanceDecision(financeActor, declineFixture.cisPackageId, { decision: 'declined' }),
    /decisionNotes is required/i,
  );

  const declined = await recordFinanceDecision(financeActor, declineFixture.cisPackageId, {
    decision: 'declined',
    decisionNotes: 'Declined due to incomplete financial history.',
  });
  assert.equal(declined.status, 'finance_declined');

  const declinedQueue = await listFinanceQueue(financeActor, { decisionStatus: 'declined' });
  assert.equal(declinedQueue.total, 1);
  assert.equal(declinedQueue.items[0]?.cisPackageId, declineFixture.cisPackageId);

  const awaitingQueue = await listFinanceQueue(financeActor, { decisionStatus: 'awaiting_submission' });
  assert.equal(awaitingQueue.total, 0);
});

test('only finance roles can record finance decisions on queued CIS packages', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    adminActor,
    'SALES_BD_REP',
    'sales.rep+cis-denial@dynamicaqs.com',
    'SalesDenial!123',
  );
  const { actor: financeActor } = await createRoleActor(
    adminActor,
    'FINANCE',
    'finance.user+cis-denial@dynamicaqs.com',
    'FinanceDenial!123',
  );

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Finance Role Gate');

  await assert.rejects(
    () =>
      recordFinanceDecision(salesActor, fixture.cisPackageId, {
        decision: 'approved',
        creditLineAmount: 7500,
        paymentTerms: 'NET_30',
        decisionNotes: 'Sales should not be able to approve finance.',
      }),
    /cannot perform action lead\.finance_decide/i,
  );

  const approved = await recordFinanceDecision(financeActor, fixture.cisPackageId, {
    decision: 'approved',
    creditLineAmount: 7500,
    paymentTerms: 'NET_30',
    decisionNotes: 'Finance role approved the package.',
  });

  assert.equal(approved.status, 'finance_approved');
  assert.equal(approved.financeDecision?.status, 'approved');
});

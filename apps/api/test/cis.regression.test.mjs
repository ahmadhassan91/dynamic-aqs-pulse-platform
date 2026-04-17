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
let uploadLeadCisScan;
let listCisParsedDrafts;
let applyCisParsedDraft;
let requestCisPaymentCapture;
let recordCisPaymentVaultReference;
let startMonerisHostedPaymentCapture;
let recordMonerisHostedCaptureResult;
let updatePaymentIntegrationAdminSettings;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ loadAppConfig } = configModule);
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));
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
    uploadLeadCisScan,
    listCisParsedDrafts,
    applyCisParsedDraft,
    requestCisPaymentCapture,
    recordCisPaymentVaultReference,
    startMonerisHostedPaymentCapture,
    recordMonerisHostedCaptureResult,
  } = await import('../dist/modules/cis/service.js'));
  ({ updatePaymentIntegrationAdminSettings } = await import('../dist/modules/cis/policy.js'));

  config = loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test.beforeEach(async () => {
  delete process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_IFRAME_URL;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_IFRAME_ORIGIN;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_TOKEN_TTL_MINUTES;
  await resetDatabase(prisma);
  config = loadAppConfig(process.env);
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

  return {
    actor: {
      userId: auth.identity.userId,
      sessionId: auth.session.sessionId,
      role: auth.identity.role,
      actorType: auth.identity.actorType,
      email: auth.identity.email,
      displayName: auth.identity.displayName ?? process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Pulse Bootstrap Admin',
    },
    auth,
  };
}

async function createRoleActor(role, email) {
  const user = await prisma.user.create({
    data: {
      email,
      displayName: `${role.split('_')[0]} Regression`,
      roleCode: role,
      userType: 'INTERNAL',
      isActive: true,
    },
  });

  return {
    actor: {
      userId: user.id,
      sessionId: `test-${user.id}`,
      role,
      actorType: 'internal',
      email: user.email,
      displayName: user.displayName,
    },
    auth: null,
  };
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
  await ensureTerritoryPolicySeeded();

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
    'SALES_BD_REP',
    'sales.rep+cis-suite@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-suite@dynamicaqs.com',
  );
  const { actor: leadershipActor } = await createRoleActor(
    'SALES_BD_LEADERSHIP',
    'sales.leadership+cis-suite@dynamicaqs.com',
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

  const scannedLead = await createLead(adminActor, {
    companyName: 'Scanned Package HVAC',
    contactDisplayName: 'Scanned Package Contact',
    email: 'scanned.package@example.com',
    phone: '555-212-3232',
    serviceTechCount: 6,
    state: 'FL',
  });

  const scannedUpload = await uploadLeadCisScan(adminActor, scannedLead.id, {
    fileName: 'scanned-cis.pdf',
    parserVersion: 'ocr-regression-v1',
    rawExtractionText: 'Primary contact Taylor Parse, legal company Scanned Package HVAC LLC.',
    safeFieldPayload: {
      legalCompanyName: 'Scanned Package HVAC LLC',
      primaryContactName: 'Taylor Parse',
      primaryContactEmail: 'taylor.parse@example.com',
      paymentMethod: 'CREDIT_CARD',
      cardOnFileAuthorized: true,
      achAuthorized: true,
    },
  });

  assert.equal(scannedUpload.cisPackage.entryMethod, 'scanned_pdf');
  assert.equal(scannedUpload.cisPackage.status, 'review_in_progress');
  assert.equal(scannedUpload.parsedDraft.parseStatus, 'needs_review');
  assert.equal(scannedUpload.parsedDraft.paymentFieldsDetected, true);
  assert.equal(scannedUpload.parsedDraft.safeFieldPayload?.legalCompanyName, 'Scanned Package HVAC LLC');
  assert.equal(scannedUpload.parsedDraft.safeFieldPayload?.paymentMethod, undefined);
  assert.equal(scannedUpload.parsedDraft.safeFieldPayload?.cardOnFileAuthorized, undefined);

  const scannedLeadAfterUpload = await prisma.lead.findUnique({
    where: { id: scannedLead.id },
  });
  assert.equal(scannedLeadAfterUpload?.stage, 'CIS_SENT');
  assert.ok(scannedLeadAfterUpload?.cisSentAt);
  assert.ok(scannedLeadAfterUpload?.cisSubmittedAt);

  const listedDrafts = await listCisParsedDrafts(adminActor, scannedUpload.cisPackage.id);
  assert.equal(listedDrafts.items.length, 1);
  assert.equal(listedDrafts.items[0].documentFileName, 'scanned-cis.pdf');

  await assert.rejects(
    applyCisParsedDraft(financeActor, scannedUpload.cisPackage.id, scannedUpload.parsedDraft.id, {}),
    /lead\.intake_manage/,
  );

  const appliedScanned = await applyCisParsedDraft(adminActor, scannedUpload.cisPackage.id, scannedUpload.parsedDraft.id, {
    note: 'Reviewed OCR fallback draft.',
  });

  assert.equal(appliedScanned.formData.legalCompanyName, 'Scanned Package HVAC LLC');
  assert.equal(appliedScanned.formData.primaryContactName, 'Taylor Parse');
  assert.equal(appliedScanned.formData.primaryContactEmail, 'taylor.parse@example.com');
  assert.equal(appliedScanned.formData.paymentMethod, undefined);
  assert.equal(appliedScanned.formData.cardOnFileAuthorized, undefined);

  const storedParsedDraft = await prisma.cisParsedDraft.findUnique({
    where: { id: scannedUpload.parsedDraft.id },
  });
  assert.equal(storedParsedDraft?.parseStatus, 'PARSED');

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
  assert.equal(queue.items[0]?.creditLineAmount, 10000);
  assert.equal(queue.items[0]?.paymentTerms, 'NET_30');

  const leadershipQueue = await listFinanceQueue(leadershipActor, { decisionStatus: 'approved' });
  assert.equal(leadershipQueue.total, 1);
  assert.equal(leadershipQueue.items[0]?.cisPackageId, branchFixture.cisPackageId);
  assert.equal(leadershipQueue.items[0]?.creditLineAmount, undefined);
  assert.equal(leadershipQueue.items[0]?.paymentTerms, undefined);

  const leadershipDetail = await getCisPackageDetail(leadershipActor, branchFixture.cisPackageId);
  assert.ok(leadershipDetail);
  assert.equal(leadershipDetail.financeDecision?.creditLineAmount, undefined);
  assert.equal(leadershipDetail.financeDecision?.paymentTerms, undefined);

  const financeDetail = await getCisPackageDetail(financeActor, branchFixture.cisPackageId);
  assert.ok(financeDetail);
  assert.equal(financeDetail.financeDecision?.creditLineAmount, 10000);
  assert.equal(financeDetail.financeDecision?.paymentTerms, 'NET_30');

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
    'SALES_BD_REP',
    'sales.rep+cis-denial@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-denial@dynamicaqs.com',
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

test('finance can request hosted capture and record a tokenized vault reference on a CIS package', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-payment@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-payment@dynamicaqs.com',
  );

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Vault Capture Heating', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const captureRequested = await requestCisPaymentCapture(financeActor, fixture.cisPackageId, {
    note: 'Hosted token capture requested by finance.',
  });

  assert.equal(captureRequested.paymentStatus, 'vault_pending');
  assert.ok(captureRequested.events.some((event) => event.eventType === 'payment_capture_requested'));

  const vaulted = await recordCisPaymentVaultReference(financeActor, fixture.cisPackageId, {
    provider: 'ebizcharge',
    vaultToken: 'tok-regression-123',
    vaultCustomerRef: 'cust-regression-789',
    last4: '4242',
    brand: 'Visa',
    status: 'vaulted',
    note: 'Finance recorded hosted vault token.',
  });

  assert.equal(vaulted.paymentStatus, 'vault_complete');
  assert.equal(vaulted.paymentVaultReferences.length, 1);
  assert.equal(vaulted.paymentVaultReferences[0].provider, 'ebizcharge');
  assert.equal(vaulted.paymentVaultReferences[0].last4, '4242');
  assert.ok(vaulted.events.some((event) => event.eventType === 'payment_vault_recorded'));
});

test('non-finance actors cannot record CIS payment vault references', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-payment-denied@dynamicaqs.com',
  );

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Denied Vault Mechanical', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  await assert.rejects(
    () => recordCisPaymentVaultReference(salesActor, fixture.cisPackageId, {
      provider: 'moneris',
      vaultCustomerRef: 'customer-only-ref',
      status: 'vaulted',
    }),
    /cannot perform action lead\.finance_decide/i,
  );
});

test('finance can launch Moneris hosted capture without creating a permanent vault reference', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-regression-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-regression';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-launch@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-launch@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Launch Heating', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const launched = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Launch secure Moneris hosted tokenization.',
  });

  assert.equal(launched.cisPackage.paymentStatus, 'vault_pending');
  assert.equal(launched.attempt.provider, 'moneris');
  assert.equal(launched.attempt.status, 'launched');
  assert.equal(launched.cisPackage.paymentCaptureAttempts.length, 1);
  assert.match(launched.launch.iframeUrl, /mpg1t\.moneris\.io/);
  assert.match(launched.launch.iframeUrl, /id=moneris-profile-regression/);
  assert.equal(launched.launch.iframeOrigin, 'https://mpg1t.moneris.io');

  const storedAttempts = await prisma.cisPaymentCaptureAttempt.findMany({
    where: { cisPackageId: fixture.cisPackageId },
  });
  assert.equal(storedAttempts.length, 1);
  assert.equal(storedAttempts[0]?.status, 'LAUNCHED');
  assert.equal(storedAttempts[0]?.provider, 'MONERIS');
  assert.equal(storedAttempts[0]?.providerProfileId, 'moneris-profile-regression');

  const vaultReferenceCount = await prisma.cisPaymentVaultReference.count({
    where: { cisPackageId: fixture.cisPackageId },
  });
  assert.equal(vaultReferenceCount, 0);
});

test('Moneris hosted capture launch is blocked when provider runtime is selected without Moneris config', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-missing@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-missing@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Missing Config Air', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  await assert.rejects(
    () =>
      startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
        note: 'Launch should fail without Moneris config.',
      }),
    /MONERIS_HOSTED_TOKENIZATION_PROFILE_ID/i,
  );
});

test('Moneris hosted capture launch is blocked when payment integration remains manual-recording only', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-manual-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-manual';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-manual@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-manual@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'manual_recording',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Manual Guard', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  await assert.rejects(
    () =>
      startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
        note: 'Should be blocked while runtime remains manual-only.',
      }),
    /manual hosted-capture recording/i,
  );
});

test('finance can record Moneris tokenization success without prematurely creating a permanent vault reference', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-success-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-success';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-success@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-success@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Success Cooling', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const launched = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Hosted launch before token response.',
  });

  const completed = await recordMonerisHostedCaptureResult(
    financeActor,
    config,
    fixture.cisPackageId,
    launched.attempt.id,
    {
      responseCode: '001',
      temporaryToken: 'moneris-temp-token-123',
      bin: '424242',
      note: 'Moneris tokenization completed successfully.',
    },
  );

  assert.equal(completed.attempt.status, 'token_received');
  assert.equal(completed.attempt.hasTemporaryToken, true);
  assert.equal(completed.attempt.providerResultCode, '001');
  assert.equal(completed.attempt.bin, '424242');
  assert.equal(completed.cisPackage.paymentStatus, 'vault_pending');
  assert.equal(completed.cisPackage.paymentVaultReferences.length, 0);
  assert.ok(completed.cisPackage.events.some((event) => event.eventType === 'payment_capture_token_received'));

  const storedAttempt = await prisma.cisPaymentCaptureAttempt.findUniqueOrThrow({
    where: { id: launched.attempt.id },
  });
  assert.equal(storedAttempt.status, 'TOKEN_RECEIVED');
  assert.ok(storedAttempt.temporaryTokenEncrypted);
  assert.equal(storedAttempt.providerResultCode, '001');
  assert.equal(storedAttempt.providerBin, '424242');
});

test('finance can record Moneris tokenization failure details and non-finance actors are denied', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-failure-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-failure';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-failure@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-failure@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Failure Cooling', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  await assert.rejects(
    () =>
      startMonerisHostedPaymentCapture(salesActor, config, fixture.cisPackageId, {
        note: 'Sales should not be able to launch hosted capture.',
      }),
    /cannot perform action lead\.finance_decide/i,
  );

  const launched = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Launch hosted capture before failure response.',
  });

  await assert.rejects(
    () =>
      recordMonerisHostedCaptureResult(salesActor, config, fixture.cisPackageId, launched.attempt.id, {
        responseCode: '940',
        errorMessage: 'Invalid profile configuration',
      }),
    /cannot perform action lead\.finance_decide/i,
  );

  const failed = await recordMonerisHostedCaptureResult(
    financeActor,
    config,
    fixture.cisPackageId,
    launched.attempt.id,
    {
      responseCode: '940',
      errorMessage: 'Invalid profile configuration',
      note: 'Capture failed in hosted frame.',
    },
  );

  assert.equal(failed.attempt.status, 'failed');
  assert.equal(failed.attempt.hasTemporaryToken, false);
  assert.equal(failed.attempt.providerResultCode, '940');
  assert.equal(failed.attempt.providerErrorMessage, 'Invalid profile configuration');
  assert.ok(failed.cisPackage.events.some((event) => event.eventType === 'payment_capture_failed'));
});

test('starting a fresh Moneris hosted capture expires stale attempts before launching a replacement', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-expire-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-expire';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-expire@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-expire@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Expire Cooling', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const firstLaunch = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Initial hosted capture launch.',
  });

  await prisma.cisPaymentCaptureAttempt.update({
    where: { id: firstLaunch.attempt.id },
    data: {
      expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  });

  const replacementLaunch = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Replacement hosted capture launch.',
  });

  const detail = await getCisPackageDetail(financeActor, fixture.cisPackageId);
  assert.ok(detail);
  assert.equal(replacementLaunch.attempt.status, 'launched');
  assert.ok(detail.paymentCaptureAttempts.some((attempt) => attempt.id === firstLaunch.attempt.id && attempt.status === 'expired'));
  assert.ok(detail.paymentCaptureAttempts.some((attempt) => attempt.id === replacementLaunch.attempt.id && attempt.status === 'launched'));
});

test('finance can finalize a successful Moneris hosted capture into a permanent CIS vault reference', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-finalize-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-finalize';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-finalize@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-finalize@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Finalize Cooling', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const launched = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Launch before provider finalization.',
  });

  await recordMonerisHostedCaptureResult(financeActor, config, fixture.cisPackageId, launched.attempt.id, {
    responseCode: '001',
    temporaryToken: 'moneris-temp-token-finalize',
    note: 'Temporary token received.',
  });

  const finalized = await recordCisPaymentVaultReference(financeActor, fixture.cisPackageId, {
    sourceCaptureAttemptId: launched.attempt.id,
    vaultToken: 'moneris-permanent-vault-token',
    vaultCustomerRef: 'moneris-customer-123',
    last4: '4242',
    brand: 'Visa',
    status: 'vaulted',
    note: 'Finalized into a permanent Moneris vault record.',
  });

  assert.equal(finalized.paymentStatus, 'vault_complete');
  assert.equal(finalized.paymentVaultReferences.length, 1);
  assert.equal(finalized.paymentVaultReferences[0]?.provider, 'moneris');
  assert.equal(finalized.paymentVaultReferences[0]?.sourceCaptureAttemptId, launched.attempt.id);
  assert.equal(finalized.paymentCaptureAttempts.find((attempt) => attempt.id === launched.attempt.id)?.status, 'consumed');
});

test('finance cannot finalize a Moneris capture attempt into a vault reference until a tokenized result exists', SERIAL, async () => {
  process.env.APP_ENCRYPTION_KEY = 'cis-moneris-guard-key';
  process.env.MONERIS_HOSTED_TOKENIZATION_PROFILE_ID = 'moneris-profile-guard';
  config = loadAppConfig(process.env);

  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-moneris-guard@dynamicaqs.com',
  );
  const { actor: financeActor } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-moneris-guard@dynamicaqs.com',
  );

  await updatePaymentIntegrationAdminSettings(config, adminActor, {
    captureMode: 'provider_runtime',
    defaultProvider: 'moneris',
    allowCisCaptureTracking: true,
    allowAccountPaymentMethodManagement: true,
  });

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Moneris Guard Cooling', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const launched = await startMonerisHostedPaymentCapture(financeActor, config, fixture.cisPackageId, {
    note: 'Launch without final tokenized result.',
  });

  await assert.rejects(
    () =>
      recordCisPaymentVaultReference(financeActor, fixture.cisPackageId, {
        sourceCaptureAttemptId: launched.attempt.id,
        vaultToken: 'should-not-save',
        status: 'vaulted',
      }),
    /must have a tokenized result/i,
  );
});

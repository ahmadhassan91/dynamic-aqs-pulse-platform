import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let config;
let loadAppConfig;
let handleCisRoutes;
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

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ loadAppConfig } = configModule);
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
  } = await import('../dist/modules/cis/service.js'));
  ({ handleCisRoutes } = await import('../dist/modules/cis/http.js'));

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
  delete process.env.MONERIS_HOSTED_TOKENIZATION_CLEANUP_INTERVAL_MINUTES;
  delete process.env.MONERIS_HOSTED_TOKENIZATION_CALLBACK_SECRET;
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
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

  const lead = await createLead(adminActor, {
    companyName,
    contactDisplayName: `${companyName} Contact`,
    email: `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${uniqueSuffix}@example.com`,
    phone: `555-${String(Date.now()).slice(-7)}`,
    serviceTechCount: 4,
    state: 'TX',
    affinityGroupSelection: 'NONE',
    ownershipGroupSelection: 'NONE',
    duplicateResolution: {
      decision: 'create_new',
      reason: 'CIS regression fixture creates an isolated package for this test case.',
    },
  });

  // FR-CIS-005: a CIS can only be issued once discovery is complete (now server-enforced) — advance the fixture.
  await prisma.lead.update({ where: { id: lead.id }, data: { stage: 'DISCOVERY_COMPLETED', discoveryCompletedAt: new Date() } });

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

async function startRuntimeServer(runtime) {
  await new Promise((resolve) => runtime.server.listen(0, '127.0.0.1', resolve));
  const address = runtime.server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected runtime server to bind to a TCP port');
  }
  return address.port;
}

async function startCisRouteHarness(config, queue) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const handled = await handleCisRoutes(req, res, url, { config, queue });
    if (handled === false) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'NOT_FOUND' }));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected CIS route harness to bind to a TCP port');
  }

  return {
    port: address.port,
    close: async () => {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve(undefined))));
    },
  };
}

async function waitFor(check, timeoutMs = 5_000, intervalMs = 100) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition did not become true within ${timeoutMs}ms`);
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

  await prisma.lead.update({ where: { id: resendLead.id }, data: { stage: 'DISCOVERY_COMPLETED', discoveryCompletedAt: new Date() } });

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

test('FR-CIS-005: a CIS link cannot be issued before discovery is completed (server-enforced)', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const lead = await createLead(adminActor, {
    companyName: 'Pre-Discovery HVAC',
    contactDisplayName: 'Pre-Discovery Contact',
    email: 'pre.discovery@example.com',
    phone: '555-303-4040',
    serviceTechCount: 3,
    state: 'TX',
  });

  // NEW-stage lead (no discovery) -> issuing a CIS is rejected server-side, not just hidden in the UI.
  await assert.rejects(() => issueCisLink(adminActor, lead.id, {}, config), /discovery is completed/i);

  // Once discovery is complete, issuance succeeds.
  await prisma.lead.update({ where: { id: lead.id }, data: { stage: 'DISCOVERY_COMPLETED', discoveryCompletedAt: new Date() } });
  const issued = await issueCisLink(adminActor, lead.id, {}, config);
  assert.ok(issued.cisPackage?.id, 'expected a CIS package once discovery is complete');
});

test('NFR-CIS-03 / BR-CIS-03: the public CIS form rejects a pasted payment card number', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const fixture = await createLeadWithCis(adminActor, 'PCI Guard HVAC');

  // A PAN pasted into any free-text field must be refused, not persisted.
  await assert.rejects(
    () =>
      submitPublicCis(fixture.token, {
        formData: buildValidSubmissionForm({ legalCompanyName: 'Jordan HVAC LLC 4111 1111 1111 1111' }),
      }),
    /payment card data/i,
  );

  // A clean form still submits.
  const submitted = await submitPublicCis(fixture.token, { formData: buildValidSubmissionForm() });
  assert.equal(submitted.status, 'submitted');
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

test('CIS no longer mounts provider card-capture routes after the April 20 scope change', SERIAL, async () => {
  const { actor: adminActor } = await createBootstrapAdminContext();
  const { actor: salesActor } = await createRoleActor(
    'SALES_BD_REP',
    'sales.rep+cis-provider-routes-parked@dynamicaqs.com',
  );
  const { actor: financeActor, accessToken } = await createRoleActor(
    'FINANCE',
    'finance.user+cis-provider-routes-parked@dynamicaqs.com',
  );

  const fixture = await createFinancePendingPackage(adminActor, salesActor, 'Provider Routes Parked', {
    paymentMethod: 'CREDIT_CARD',
    cardOnFileAuthorized: true,
    achAuthorized: false,
  });

  const detail = await getCisPackageDetail(financeActor, fixture.cisPackageId);
  assert.equal(detail.paymentStatus, 'vault_pending');
  assert.equal(detail.paymentCaptureAttempts.length, 0);
  assert.equal(detail.paymentVaultReferences.length, 0);

  const harness = await startCisRouteHarness(config, {
    register() {},
    async start() {},
    async stop() {},
    async status() {
      return {
        ok: true,
        state: 'running',
        runtime: 'pg-boss',
        schema: 'pgboss',
        deadLetterQueue: 'pulse.dead-letter',
        registeredQueues: 0,
        registeredWorkers: 0,
        queueStats: [],
      };
    },
    async enqueue() {
      throw new Error('CIS provider capture routes should not enqueue jobs while parked');
    },
  });

  try {
    const parkedRoutes = [
      [`/api/v1/cis/${fixture.cisPackageId}/request-payment-capture`, {}],
      [`/api/v1/cis/${fixture.cisPackageId}/payment-vault-reference`, { vaultCustomerRef: 'cust-parked' }],
      [`/api/v1/cis/${fixture.cisPackageId}/moneris-hosted-capture/start`, {}],
      [`/api/v1/cis/${fixture.cisPackageId}/payment-capture-attempts/attempt-parked/moneris-result`, {}],
      [`/api/v1/cis/${fixture.cisPackageId}/payment-capture-attempts/attempt-parked/moneris-cancel`, {}],
      [`/api/v1/cis/${fixture.cisPackageId}/payment-capture-attempts/attempt-parked/moneris-callback`, {}],
    ];

    for (const [route, body] of parkedRoutes) {
      const response = await fetch(`http://127.0.0.1:${harness.port}${route}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 404);
    }
  } finally {
    await harness.close();
  }
});

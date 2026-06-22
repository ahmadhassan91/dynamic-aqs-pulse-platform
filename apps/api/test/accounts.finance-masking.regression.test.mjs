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
let submitPublicCis;
let getCisPackageDetail;
let listAccountPaymentMethods;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead } = await import('../dist/modules/leads/service.js'));
  ({
    issueCisLink,
    submitPublicCis,
    getCisPackageDetail,
  } = await import('../dist/modules/cis/service.js'));
  ({ listAccountPaymentMethods } = await import('../dist/modules/accounts/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
  ({ ensureBootstrapAdminSeeded, loginWithPassword } = await import('../dist/modules/auth/service.js'));

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

async function createBootstrapAdminActor() {
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

async function createRoleActor(role, email, displayName) {
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

async function seedFinancialVisibilityFixture(adminActor, territoryManagerActor, regionalDirectorActor) {
  const region = await prisma.region.create({
    data: {
      code: 'finance_masking_region',
      name: 'Finance Masking Region',
      directorUserId: regionalDirectorActor.userId,
      isActive: true,
    },
  });

  const territory = await prisma.territory.create({
    data: {
      code: 'finance_masking_territory',
      name: 'Finance Masking Territory',
      regionId: region.id,
      managerUserId: territoryManagerActor.userId,
      isActive: true,
    },
  });

  const lead = await createLead(adminActor, {
    companyName: 'Finance Mask Dealer',
    contactDisplayName: 'Finance Mask Contact',
    email: 'finance.mask@example.com',
    phone: '555-888-1000',
    serviceTechCount: 5,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      territoryId: territory.id,
      assignedTmUserId: territoryManagerActor.userId,
      assignedRdUserId: regionalDirectorActor.userId,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      // FR-CIS-005: discovery must be complete before a CIS can be issued.
      stage: 'DISCOVERY_COMPLETED',
      discoveryCompletedAt: new Date(),
    },
  });

  const issued = await issueCisLink(adminActor, lead.id, {}, config);
  const token = extractPublicToken(issued.publicUrl);
  assert.ok(token, 'expected public CIS token');

  const submitted = await submitPublicCis(token, {
    formData: buildValidSubmissionForm({
      orderingContactName: 'Ordering Contact',
      orderingContactCellPhone: '555-700-1000',
      orderingContactEmail: 'ordering@example.com',
      apContactName: 'AP Owner',
      apDirectPhone: '555-700-2000',
      apEmail: 'ap@example.com',
    }),
  });
  assert.equal(submitted.status, 'submitted');

  await prisma.cisPackage.update({
    where: { id: issued.cisPackage.id },
    data: {
      status: 'FINANCE_APPROVED',
      financeSubmittedAt: new Date('2026-04-18T08:00:00.000Z'),
      financeDecidedAt: new Date('2026-04-18T09:00:00.000Z'),
      paymentStatus: 'VAULT_COMPLETE',
    },
  });

  await prisma.cisFinanceDecision.create({
    data: {
      cisPackageId: issued.cisPackage.id,
      status: 'APPROVED',
      submittedByUserId: adminActor.userId,
      submittedAt: new Date('2026-04-18T08:00:00.000Z'),
      creditLineAmountCents: 2500000,
      paymentTerms: 'NET_30',
      submissionNotes: 'Finance submission notes',
      decisionNotes: 'Finance approved for standard onboarding',
      decidedByUserId: adminActor.userId,
      decidedAt: new Date('2026-04-18T09:00:00.000Z'),
    },
  });

  const captureAttempt = await prisma.cisPaymentCaptureAttempt.create({
    data: {
      cisPackageId: issued.cisPackage.id,
      provider: 'MONERIS',
      status: 'TOKEN_RECEIVED',
      providerProfileId: 'profile_finance_mask',
      launchedByUserId: adminActor.userId,
      completedByUserId: adminActor.userId,
      temporaryTokenEncrypted: 'encrypted_temp_token',
      providerResultCode: '001',
      providerErrorMessage: 'Gateway response should stay finance-only',
      providerBin: '424242',
      launchedAt: new Date('2026-04-18T08:15:00.000Z'),
      completedAt: new Date('2026-04-18T08:16:00.000Z'),
      expiresAt: new Date('2026-04-18T09:15:00.000Z'),
    },
  });

  const vaultReference = await prisma.cisPaymentVaultReference.create({
    data: {
      cisPackageId: issued.cisPackage.id,
      sourceCaptureAttemptId: captureAttempt.id,
      provider: 'MONERIS',
      vaultToken: 'tok_finance_mask',
      vaultCustomerRef: 'cust_finance_mask',
      last4: '4242',
      brand: 'Visa',
      authorizationCapturedAt: new Date('2026-04-18T08:16:00.000Z'),
      status: 'vault_complete',
    },
  });

  const account = await prisma.account.create({
    data: {
      sourceLeadId: lead.id,
      displayName: 'Finance Mask Dealer',
      legalName: 'Finance Mask Dealer LLC',
      territoryId: territory.id,
      territoryAssignmentMethod: 'MANUAL_OVERRIDE',
      territoryAssignedAt: new Date('2026-04-18T09:30:00.000Z'),
      assignedTmUserId: territoryManagerActor.userId,
      assignedRdUserId: regionalDirectorActor.userId,
      isActive: true,
    },
  });

  await prisma.accountPaymentVaultReference.create({
    data: {
      accountId: account.id,
      sourceCisVaultReferenceId: vaultReference.id,
      provider: 'MONERIS',
      vaultToken: 'tok_account_mask',
      vaultCustomerRef: 'cust_account_mask',
      externalPaymentMethodRef: 'pm_account_mask',
      last4: '4242',
      brand: 'Visa',
      billingZip: '75001',
      authorizationCapturedAt: new Date('2026-04-18T08:17:00.000Z'),
      isDefault: true,
      isActive: true,
      status: 'active',
    },
  });

  return {
    leadId: lead.id,
    cisPackageId: issued.cisPackage.id,
    accountId: account.id,
  };
}

test('customer financial visibility masks CIS finance fields for non-finance CIS roles and preserves them for finance-enabled roles', SERIAL, async () => {
  const superAdminActor = await createBootstrapAdminActor();
  const territoryManagerActor = await createRoleActor('TERRITORY_MANAGER', 'tm.finance.mask@pulse.local', 'TM Finance Mask');
  const regionalDirectorActor = await createRoleActor('REGIONAL_DIRECTOR', 'rd.finance.mask@pulse.local', 'RD Finance Mask');
  const leadershipActor = await createRoleActor('SALES_BD_LEADERSHIP', 'leadership.finance.mask@pulse.local', 'Leadership Mask');
  const opsActor = await createRoleActor('ADMIN_CSR_OPS', 'ops.finance.mask@pulse.local', 'Ops Mask');
  const financeActor = await createRoleActor('FINANCE', 'finance.mask@pulse.local', 'Finance Mask');
  const executiveActor = await createRoleActor('EXECUTIVE', 'executive.mask@pulse.local', 'Executive Mask');

  const fixture = await seedFinancialVisibilityFixture(superAdminActor, territoryManagerActor, regionalDirectorActor);

  const leadershipDetail = await getCisPackageDetail(leadershipActor, fixture.cisPackageId);
  assert.ok(leadershipDetail);
  assert.equal(leadershipDetail.formData.apContactName, undefined);
  assert.equal(leadershipDetail.formData.apDirectPhone, undefined);
  assert.equal(leadershipDetail.formData.apEmail, undefined);
  assert.equal(leadershipDetail.formData.paymentMethod, undefined);
  assert.equal(leadershipDetail.formData.achAuthorized, undefined);
  assert.equal(leadershipDetail.formData.cardOnFileAuthorized, undefined);
  assert.equal(leadershipDetail.financeDecision?.creditLineAmount, undefined);
  assert.equal(leadershipDetail.financeDecision?.paymentTerms, undefined);
  assert.equal(leadershipDetail.paymentCaptureAttempts[0]?.providerProfileId, undefined);
  assert.equal(leadershipDetail.paymentCaptureAttempts[0]?.providerResultCode, undefined);
  assert.equal(leadershipDetail.paymentCaptureAttempts[0]?.providerErrorMessage, undefined);
  assert.equal(leadershipDetail.paymentCaptureAttempts[0]?.bin, undefined);
  assert.equal(leadershipDetail.paymentCaptureAttempts[0]?.hasTemporaryToken, false);
  assert.equal(leadershipDetail.paymentVaultReferences[0]?.sourceCaptureAttemptId, undefined);
  assert.equal(leadershipDetail.paymentVaultReferences[0]?.last4, undefined);
  assert.equal(leadershipDetail.paymentVaultReferences[0]?.brand, undefined);
  assert.equal(leadershipDetail.paymentVaultReferences[0]?.authorizationCapturedAt, undefined);
  assert.equal(leadershipDetail.paymentVaultReferences[0]?.hasVaultToken, false);
  assert.equal(leadershipDetail.paymentVaultReferences[0]?.hasVaultCustomerRef, false);

  const opsDetail = await getCisPackageDetail(opsActor, fixture.cisPackageId);
  assert.ok(opsDetail);
  assert.equal(opsDetail.formData.apEmail, undefined);
  assert.equal(opsDetail.financeDecision?.creditLineAmount, undefined);
  assert.equal(opsDetail.paymentCaptureAttempts[0]?.hasTemporaryToken, false);
  assert.equal(opsDetail.paymentVaultReferences[0]?.hasVaultToken, false);

  const financeDetail = await getCisPackageDetail(financeActor, fixture.cisPackageId);
  assert.ok(financeDetail);
  assert.equal(financeDetail.formData.apContactName, 'AP Owner');
  assert.equal(financeDetail.formData.apDirectPhone, '555-700-2000');
  assert.equal(financeDetail.formData.apEmail, 'ap@example.com');
  assert.equal(financeDetail.formData.paymentMethod, 'ACH');
  assert.equal(financeDetail.formData.achAuthorized, true);
  assert.equal(financeDetail.formData.cardOnFileAuthorized, true);
  assert.equal(financeDetail.financeDecision?.creditLineAmount, 25000);
  assert.equal(financeDetail.financeDecision?.paymentTerms, 'NET_30');
  assert.equal(financeDetail.paymentCaptureAttempts[0]?.providerProfileId, 'profile_finance_mask');
  assert.equal(financeDetail.paymentCaptureAttempts[0]?.providerResultCode, '001');
  assert.equal(financeDetail.paymentCaptureAttempts[0]?.providerErrorMessage, 'Gateway response should stay finance-only');
  assert.equal(financeDetail.paymentCaptureAttempts[0]?.bin, '424242');
  assert.equal(financeDetail.paymentCaptureAttempts[0]?.hasTemporaryToken, true);
  assert.equal(financeDetail.paymentVaultReferences[0]?.sourceCaptureAttemptId, financeDetail.paymentCaptureAttempts[0]?.id);
  assert.equal(financeDetail.paymentVaultReferences[0]?.last4, '4242');
  assert.equal(financeDetail.paymentVaultReferences[0]?.brand, 'Visa');
  assert.equal(financeDetail.paymentVaultReferences[0]?.hasVaultToken, true);
  assert.equal(financeDetail.paymentVaultReferences[0]?.hasVaultCustomerRef, true);

  const executiveDetail = await getCisPackageDetail(executiveActor, fixture.cisPackageId);
  assert.ok(executiveDetail);
  assert.equal(executiveDetail.formData.apEmail, 'ap@example.com');
  assert.equal(executiveDetail.financeDecision?.creditLineAmount, 25000);
  assert.equal(executiveDetail.paymentCaptureAttempts[0]?.hasTemporaryToken, true);
  assert.equal(executiveDetail.paymentVaultReferences[0]?.hasVaultToken, true);

  const superAdminDetail = await getCisPackageDetail(superAdminActor, fixture.cisPackageId);
  assert.ok(superAdminDetail);
  assert.equal(superAdminDetail.formData.apEmail, 'ap@example.com');
  assert.equal(superAdminDetail.financeDecision?.creditLineAmount, 25000);
  assert.equal(superAdminDetail.paymentCaptureAttempts[0]?.hasTemporaryToken, true);
  assert.equal(superAdminDetail.paymentVaultReferences[0]?.hasVaultToken, true);

  await assert.rejects(
    () => listAccountPaymentMethods(territoryManagerActor, fixture.accountId),
    /customer\.financials_view/i,
  );
  await assert.rejects(
    () => listAccountPaymentMethods(regionalDirectorActor, fixture.accountId),
    /customer\.financials_view/i,
  );

  const financeMethods = await listAccountPaymentMethods(financeActor, fixture.accountId);
  assert.ok(financeMethods);
  assert.equal(financeMethods.items.length, 1);
  assert.equal(financeMethods.items[0]?.externalPaymentMethodRef, 'pm_account_mask');
  assert.equal(financeMethods.items[0]?.last4, '4242');

  const executiveMethods = await listAccountPaymentMethods(executiveActor, fixture.accountId);
  assert.ok(executiveMethods);
  assert.equal(executiveMethods.items[0]?.last4, '4242');

  const superAdminMethods = await listAccountPaymentMethods(superAdminActor, fixture.accountId);
  assert.ok(superAdminMethods);
  assert.equal(superAdminMethods.items[0]?.last4, '4242');
});

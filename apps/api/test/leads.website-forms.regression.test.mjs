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
let listWebsiteLeadSites;
let createWebsiteLeadSite;
let updateWebsiteLeadSite;
let listWebsiteLeadNotificationRecipients;
let createWebsiteLeadNotificationRecipient;
let updateWebsiteLeadNotificationRecipient;
let getPublicWebsiteLeadSite;
let captureWebsiteLead;
let listWebsiteFormLeads;
let listWebsiteLeadSubmissions;
let resolveWebsiteLeadSubmission;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    listWebsiteLeadSites,
    createWebsiteLeadSite,
    updateWebsiteLeadSite,
    listWebsiteLeadNotificationRecipients,
    createWebsiteLeadNotificationRecipient,
    updateWebsiteLeadNotificationRecipient,
    getPublicWebsiteLeadSite,
    captureWebsiteLead,
    listWebsiteFormLeads,
    listWebsiteLeadSubmissions,
    resolveWebsiteLeadSubmission,
  } = await import('../dist/modules/leads/service.js'));
  ({ ensureTerritoryPolicySeeded } = await import('../dist/modules/territories/service.js'));
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

test('seeded website sites expose active public form configuration', SERIAL, async () => {
  const actor = await createAdminActor();
  const siteList = await listWebsiteLeadSites(actor);

  assert.equal(siteList.items.length, 16);
  assert.equal(siteList.items.filter((site) => site.isActive).length, 14);

  const solaceAir = await getPublicWebsiteLeadSite('solace-air');
  assert.equal(solaceAir.siteId, 'solace-air');
  assert.equal(solaceAir.formType, 'both');

  await assert.rejects(() => getPublicWebsiteLeadSite('eco-air'), /not available/i);
});

test('public website capture rejects lead types outside the configured form mode', SERIAL, async () => {
  await assert.rejects(
    () =>
      captureWebsiteLead({
        siteId: 'purairx',
        leadType: 'homeowner',
        fullName: 'Jamie North',
        email: 'jamie.north@example.com',
        phone: '555-111-2222',
        state: 'TX',
      }),
    /not configured for the selected lead type/i,
  );
});

test('duplicate website submissions attach to the existing lead instead of creating a second one', SERIAL, async () => {
  const firstLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Casey Lane',
    companyName: 'Fresh Air Pros',
    email: 'casey@freshairpros.com',
    phone: '555-333-4444',
    state: 'TX',
    serviceTechCount: 4,
    inquiryTopic: 'IAQ evaluation',
    referralSource: 'Trade show',
    message: 'Interested in indoor air quality add-ons.',
  });

  const secondLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Casey Lane',
    companyName: 'Fresh Air Pros',
    email: 'casey@freshairpros.com',
    phone: '555-333-4444',
    state: 'TX',
    serviceTechCount: 5,
    inquiryTopic: 'Follow-up request',
    referralSource: 'Trade show',
    message: 'Submitting again after talking with the team.',
  });

  assert.equal(secondLead.id, firstLead.id);

  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: firstLead.id },
  });
  assert.equal(lead.sourceSiteId, 'solace-air');
  assert.equal(lead.sourceBrandTag, 'SLA');
  assert.equal(lead.leadType, 'CONTRACTOR');

  const submissions = await prisma.websiteLeadSubmission.findMany({
    where: {
      linkedLeadId: firstLead.id,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  assert.equal(submissions.length, 2);
  assert.equal(submissions[0].outcome, 'CREATED_NEW_LEAD');
  assert.equal(submissions[0].reviewStatus, 'NOT_REQUIRED');
  assert.equal(submissions[1].outcome, 'ATTACHED_TO_EXISTING_LEAD');
  assert.equal(submissions[1].reviewStatus, 'PENDING_REVIEW');
  assert.equal(submissions[1].serviceTechCount, 5);
});

test('repeat-submission review lists duplicate website submissions newest first', SERIAL, async () => {
  const actor = await createAdminActor();
  const firstLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Chris Vale',
    companyName: 'Air Current',
    email: 'ops@aircurrent.com',
    phone: '555-100-2000',
    state: 'TX',
    serviceTechCount: 4,
    inquiryTopic: 'Filter program',
    referralSource: 'Website',
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Chris Vale',
    companyName: 'Air Current',
    email: 'ops@aircurrent.com',
    phone: '555-100-2000',
    state: 'TX',
    serviceTechCount: 5,
    inquiryTopic: 'Training help',
    referralSource: 'Website',
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Chris Vale',
    companyName: 'Air Current',
    email: 'ops@aircurrent.com',
    phone: '555-100-2000',
    state: 'TX',
    serviceTechCount: 6,
    inquiryTopic: 'Second follow-up',
    referralSource: 'Trade show',
  });

  const duplicates = await listWebsiteLeadSubmissions(actor, {
    outcome: 'attached_to_existing_lead',
  });

  assert.equal(duplicates.total, 2);
  assert.equal(duplicates.summary.duplicateCount, 2);
  assert.equal(duplicates.summary.createdLeadCount, 1);
  assert.equal(duplicates.summary.pendingReviewCount, 2);
  assert.equal(duplicates.summary.resolvedCount, 0);
  assert.equal(duplicates.summary.uniqueLinkedLeadCount, 1);
  assert.equal(duplicates.items[0].linkedLeadId, firstLead.id);
  assert.equal(duplicates.items[0].reviewStatus, 'pending_review');
  assert.equal(duplicates.items[0].inquiryTopic, 'Second follow-up');
  assert.equal(duplicates.items[1].reviewStatus, 'pending_review');
  assert.equal(duplicates.items[1].inquiryTopic, 'Training help');
});

test('duplicate review can confirm an existing lead and safely handle repeated confirmation', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Morgan Confirm',
    companyName: 'Confirm Comfort',
    email: 'confirm@comfort.test',
    phone: '555-901-0000',
    state: 'TX',
    serviceTechCount: 4,
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Morgan Confirm',
    companyName: 'Confirm Comfort',
    email: 'confirm@comfort.test',
    phone: '555-901-0000',
    state: 'TX',
    serviceTechCount: 5,
    inquiryTopic: 'Second request',
  });

  const before = await listWebsiteLeadSubmissions(actor, {
    search: 'Confirm Comfort',
    outcome: 'attached_to_existing_lead',
  });
  assert.equal(before.items.length, 1);
  assert.equal(before.items[0].reviewStatus, 'pending_review');

  const resolved = await resolveWebsiteLeadSubmission(actor, before.items[0].id, {
    decision: 'confirm_existing',
    reviewNote: 'Confirmed the existing lead is still in flight.',
  });
  assert.equal(resolved.linkedLeadId, lead.id);
  assert.equal(resolved.reviewStatus, 'confirmed_existing');
  assert.equal(resolved.reviewedByUserId, actor.userId);
  assert.match(resolved.reviewNote ?? '', /existing lead/i);

  const repeated = await resolveWebsiteLeadSubmission(actor, before.items[0].id, {
    decision: 'confirm_existing',
  });
  assert.equal(repeated.reviewStatus, 'confirmed_existing');
  assert.equal(repeated.linkedLeadId, lead.id);

  const after = await listWebsiteLeadSubmissions(actor, {
    search: 'Confirm Comfort',
    outcome: 'attached_to_existing_lead',
  });
  assert.equal(after.summary.pendingReviewCount, 0);
  assert.equal(after.summary.resolvedCount, 1);
  assert.equal(after.items[0].reviewStatus, 'confirmed_existing');
});

test('duplicate review can create a fresh lead from an immutable website submission snapshot', SERIAL, async () => {
  const actor = await createAdminActor();
  const originalLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Taylor Snapshot',
    companyName: 'Snapshot Comfort',
    email: 'snapshot@comfort.test',
    phone: '555-902-0000',
    state: 'Ontario',
    streetAddress: '44 King Street',
    city: 'Toronto',
    postalCode: 'M5H 2N2',
    customerStatus: 'existing_customer',
    serviceTechCount: 4,
    inquiryTopic: 'Initial request',
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Taylor Snapshot',
    companyName: 'Snapshot Comfort',
    email: 'snapshot@comfort.test',
    phone: '555-902-0000',
    state: 'Ontario',
    streetAddress: '44 King Street',
    city: 'Toronto',
    postalCode: 'M5H 2N2',
    customerStatus: 'existing_customer',
    serviceTechCount: 7,
    inquiryTopic: 'Create a second tracked lead',
  });

  const before = await listWebsiteLeadSubmissions(actor, {
    search: 'Snapshot Comfort',
    outcome: 'attached_to_existing_lead',
  });
  assert.equal(before.items.length, 1);

  const resolved = await resolveWebsiteLeadSubmission(actor, before.items[0].id, {
    decision: 'create_new_lead',
    reviewNote: 'Keep the repeat website request as its own lead.',
  });
  assert.equal(resolved.reviewStatus, 'created_new_lead');
  assert.notEqual(resolved.linkedLeadId, originalLead.id);

  const leads = await prisma.lead.findMany({
    where: { email: 'snapshot@comfort.test' },
    orderBy: { createdAt: 'asc' },
  });
  assert.equal(leads.length, 2);

  const createdLeadExtension = await prisma.leadExtension.findUniqueOrThrow({
    where: { leadId: resolved.linkedLeadId },
  });
  assert.deepEqual(createdLeadExtension.sourceMetadata, {
    captureChannel: 'branded_website',
    inquiryTopic: 'Create a second tracked lead',
    customerStatus: 'existing_customer',
    submittedAddress: {
      line1: '44 King Street',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5H 2N2',
      countryCode: 'CA',
    },
  });

  const after = await listWebsiteLeadSubmissions(actor, {
    search: 'Snapshot Comfort',
    outcome: 'attached_to_existing_lead',
  });
  assert.equal(after.summary.pendingReviewCount, 0);
  assert.equal(after.summary.resolvedCount, 1);
  assert.equal(after.items[0].linkedLeadId, resolved.linkedLeadId);
});

test('duplicate review can relink a repeat submission to another active in-flight lead', SERIAL, async () => {
  const actor = await createAdminActor();
  const originalLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Riley Relink',
    companyName: 'Relink Comfort',
    email: 'relink@comfort.test',
    phone: '555-903-0000',
    state: 'TX',
    serviceTechCount: 4,
  });

  const targetLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Riley Relink',
    companyName: 'Relink Comfort West',
    email: 'relink.ops@comfort.test',
    phone: '555-903-9999',
    state: 'TX',
    serviceTechCount: 6,
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Riley Relink',
    companyName: 'Relink Comfort',
    email: 'relink@comfort.test',
    phone: '555-903-0000',
    state: 'TX',
    serviceTechCount: 5,
    inquiryTopic: 'Route this to the later in-flight lead',
  });

  const before = await listWebsiteLeadSubmissions(actor, {
    search: 'Relink Comfort',
    outcome: 'attached_to_existing_lead',
  });
  assert.equal(before.items.length, 1);
  assert.equal(before.items[0].linkedLeadId, originalLead.id);
  assert.equal(before.items[0].reviewStatus, 'pending_review');

  const resolved = await resolveWebsiteLeadSubmission(actor, before.items[0].id, {
    decision: 'relink_existing',
    targetLeadId: targetLead.id,
    reviewNote: 'Ops linked this repeat form to the more recent in-flight lead.',
  });

  assert.equal(resolved.linkedLeadId, targetLead.id);
  assert.equal(resolved.reviewStatus, 'relinked_existing');
  assert.equal(resolved.reviewedByUserId, actor.userId);
  assert.match(resolved.reviewNote ?? '', /more recent/i);

  const oldLeadAudit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'LEAD',
      entityId: originalLead.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  assert.ok(oldLeadAudit);
  assert.equal(oldLeadAudit.afterData.duplicateSubmissionReview.relinkedAway, true);

  await assert.rejects(
    () => resolveWebsiteLeadSubmission(actor, before.items[0].id, {
      decision: 'relink_existing',
      targetLeadId: originalLead.id,
    }),
    /already been resolved/i,
  );
});

test('duplicate review rejects relink targets that are already customer-active', SERIAL, async () => {
  const actor = await createAdminActor();
  const originalLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Rory Guard',
    companyName: 'Guard Comfort',
    email: 'guard@comfort.test',
    phone: '555-904-0000',
    state: 'TX',
    serviceTechCount: 4,
  });

  const customerActiveLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Rory Guard',
    companyName: 'Guard Comfort Active',
    email: 'guard.active@comfort.test',
    phone: '555-904-9999',
    state: 'TX',
    serviceTechCount: 7,
  });

  await prisma.lead.update({
    where: { id: customerActiveLead.id },
    data: {
      stage: 'CUSTOMER_ACTIVE',
      lifecycleStatus: 'ACTIVE',
    },
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Rory Guard',
    companyName: 'Guard Comfort',
    email: 'guard@comfort.test',
    phone: '555-904-0000',
    state: 'TX',
    serviceTechCount: 5,
  });

  const before = await listWebsiteLeadSubmissions(actor, {
    search: 'Guard Comfort',
    outcome: 'attached_to_existing_lead',
  });
  assert.equal(before.items.length, 1);
  assert.equal(before.items[0].linkedLeadId, originalLead.id);

  await assert.rejects(
    () => resolveWebsiteLeadSubmission(actor, before.items[0].id, {
      decision: 'relink_existing',
      targetLeadId: customerActiveLead.id,
    }),
    /active in-flight leads/i,
  );
});

test('website duplicate matching ignores customer-active and closed leads', SERIAL, async () => {
  const activeLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Jordan Park',
    companyName: 'North Valley Air',
    email: 'team@northvalleyair.com',
    phone: '555-222-3333',
    state: 'TX',
    serviceTechCount: 3,
  });

  await prisma.lead.update({
    where: { id: activeLead.id },
    data: {
      stage: 'CUSTOMER_ACTIVE',
      lifecycleStatus: 'ACTIVE',
    },
  });

  const newLeadAfterCustomerActive = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Jordan Park',
    companyName: 'North Valley Air',
    email: 'team@northvalleyair.com',
    phone: '555-222-3333',
    state: 'TX',
    serviceTechCount: 4,
  });

  assert.notEqual(newLeadAfterCustomerActive.id, activeLead.id);

  await prisma.lead.update({
    where: { id: newLeadAfterCustomerActive.id },
    data: {
      lifecycleStatus: 'CLOSED',
      lifecycleChangedAt: new Date(),
      lifecycleReasonCode: 'no_response',
    },
  });

  const newLeadAfterClosed = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Jordan Park',
    companyName: 'North Valley Air',
    email: 'team@northvalleyair.com',
    phone: '555-222-3333',
    state: 'TX',
    serviceTechCount: 5,
  });

  assert.notEqual(newLeadAfterClosed.id, newLeadAfterCustomerActive.id);

  const leads = await prisma.lead.findMany({
    where: {
      email: 'team@northvalleyair.com',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  assert.equal(leads.length, 3);

  const submissions = await prisma.websiteLeadSubmission.findMany({
    where: {
      email: 'team@northvalleyair.com',
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  assert.deepEqual(
    submissions.map((submission) => submission.outcome),
    ['CREATED_NEW_LEAD', 'CREATED_NEW_LEAD', 'CREATED_NEW_LEAD'],
  );
});

test('website-form lead lists keep parked and closed records out of the active intake view by default', SERIAL, async () => {
  const actor = await createAdminActor();
  const activeLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Robin Active',
    companyName: 'Active Comfort',
    email: 'active@comfort.test',
    phone: '555-100-1000',
    state: 'TX',
    serviceTechCount: 4,
  });
  const parkedLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Parker Hold',
    companyName: 'Hold Comfort',
    email: 'hold@comfort.test',
    phone: '555-100-2000',
    state: 'TX',
    serviceTechCount: 3,
  });
  const closedLead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Cora Archive',
    companyName: 'Archive Comfort',
    email: 'archive@comfort.test',
    phone: '555-100-3000',
    state: 'TX',
    serviceTechCount: 2,
  });

  await prisma.lead.update({
    where: { id: parkedLead.id },
    data: {
      lifecycleStatus: 'PARKED',
      lifecycleChangedAt: new Date(),
      lifecycleReasonCode: 'follow_up_later',
      lifecycleReasonNote: 'Waiting for next trade show season.',
    },
  });
  await prisma.lead.update({
    where: { id: closedLead.id },
    data: {
      lifecycleStatus: 'CLOSED',
      lifecycleChangedAt: new Date(),
      lifecycleReasonCode: 'no_response',
      lifecycleReasonNote: 'No response after website follow-up.',
    },
  });

  const activeView = await listWebsiteFormLeads(actor, {});
  const parkedView = await listWebsiteFormLeads(actor, { lifecycleStatus: 'parked' });
  const closedView = await listWebsiteFormLeads(actor, { lifecycleStatus: 'closed' });

  assert.deepEqual(activeView.items.map((item) => item.id), [activeLead.id]);
  assert.deepEqual(parkedView.items.map((item) => item.id), [parkedLead.id]);
  assert.deepEqual(closedView.items.map((item) => item.id), [closedLead.id]);
});

test('website lead submission review keeps duplicate history visible after a linked lead is archived', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Chris Review',
    companyName: 'Review Comfort',
    email: 'review@comfort.test',
    phone: '555-888-0000',
    state: 'TX',
    serviceTechCount: 4,
    inquiryTopic: 'First request',
  });

  await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Chris Review',
    companyName: 'Review Comfort',
    email: 'review@comfort.test',
    phone: '555-888-0000',
    state: 'TX',
    serviceTechCount: 5,
    inquiryTopic: 'Duplicate follow-up',
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      lifecycleStatus: 'CLOSED',
      lifecycleChangedAt: new Date(),
      lifecycleReasonCode: 'follow_up_later',
      lifecycleReasonNote: 'Closed after duplicate review handoff.',
    },
  });

  const submissions = await listWebsiteLeadSubmissions(actor, {
    search: 'Review Comfort',
    outcome: 'attached_to_existing_lead',
  });

  assert.equal(submissions.items.length, 1);
  assert.equal(submissions.items[0].linkedLeadId, lead.id);
  assert.equal(submissions.items[0].linkedLeadLifecycleStatus, 'closed');
  assert.equal(submissions.items[0].outcome, 'attached_to_existing_lead');
});

test('native website forms preserve explicit address and customer-intake metadata', SERIAL, async () => {
  const lead = await captureWebsiteLead({
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Morgan Reyes',
    companyName: 'Northline Comfort',
    email: 'morgan@northlinecomfort.com',
    phone: '555-777-8888',
    streetAddress: '455 Market Street',
    city: 'Toronto',
    state: 'Ontario',
    postalCode: 'M5V 2L9',
    customerStatus: 'existing_customer',
    serviceTechCount: 6,
    inquiryTopic: 'Training and onboarding',
    referralSource: 'Dealer referral',
    referralDetail: 'Regional distributor',
  });

  const extension = await prisma.leadExtension.findUniqueOrThrow({
    where: { leadId: lead.id },
  });
  const submission = await prisma.websiteLeadSubmission.findFirstOrThrow({
    where: { linkedLeadId: lead.id },
  });

  assert.deepEqual(extension.sourceMetadata, {
    captureChannel: 'branded_website',
    inquiryTopic: 'Training and onboarding',
    referralSource: 'Dealer referral',
    referralDetail: 'Regional distributor',
    customerStatus: 'existing_customer',
    submittedAddress: {
      line1: '455 Market Street',
      city: 'Toronto',
      state: 'ON',
      postalCode: 'M5V 2L9',
      countryCode: 'CA',
    },
  });

  assert.equal(submission.state, 'ON');
  assert.equal(submission.countryCode, 'CA');
  assert.deepEqual(submission.payload, {
    siteId: 'solace-air',
    leadType: 'contractor',
    fullName: 'Morgan Reyes',
    companyName: 'Northline Comfort',
    email: 'morgan@northlinecomfort.com',
    phone: '555-777-8888',
    streetAddress: '455 Market Street',
    city: 'Toronto',
    state: 'Ontario',
    postalCode: 'M5V 2L9',
    customerStatus: 'existing_customer',
    serviceTechCount: 6,
    inquiryTopic: 'Training and onboarding',
    referralSource: 'Dealer referral',
    referralDetail: 'Regional distributor',
  });
});

test('admin users can manage website sites and notification recipients through the service layer', SERIAL, async () => {
  const actor = await createAdminActor();

  const createdSite = await createWebsiteLeadSite(actor, {
    siteId: 'healthy-air-lab',
    siteName: 'HealthyAirLab.com',
    url: 'https://healthyairlab.com/contact-us',
    brandTag: 'HAL',
    formType: 'contractor',
    isActive: true,
    notes: 'Regression-created site',
  });

  assert.equal(createdSite.siteId, 'healthy-air-lab');
  assert.equal(createdSite.formType, 'contractor');

  const updatedSite = await updateWebsiteLeadSite(actor, createdSite.id, {
    isActive: false,
    formType: 'both',
    notes: 'Updated during regression',
  });

  assert.equal(updatedSite.isActive, false);
  assert.equal(updatedSite.formType, 'both');

  const createdRecipient = await createWebsiteLeadNotificationRecipient(actor, {
    websiteLeadSiteId: createdSite.id,
    name: 'Taylor Ops',
    email: 'taylor.ops@example.com',
    roleTitle: 'Lead Ops',
    isActive: true,
  });

  assert.equal(createdRecipient.email, 'taylor.ops@example.com');
  assert.equal(createdRecipient.websiteLeadSiteId, createdSite.id);

  const updatedRecipient = await updateWebsiteLeadNotificationRecipient(actor, createdRecipient.id, {
    isActive: false,
    roleTitle: 'Lead Ops Escalation',
  });

  assert.equal(updatedRecipient.isActive, false);
  assert.equal(updatedRecipient.roleTitle, 'Lead Ops Escalation');

  const siteList = await listWebsiteLeadSites(actor);
  assert.ok(siteList.items.some((site) => site.siteId === 'healthy-air-lab' && site.formType === 'both'));

  const recipientList = await listWebsiteLeadNotificationRecipients(actor);
  assert.ok(
    recipientList.items.some(
      (recipient) =>
        recipient.email === 'taylor.ops@example.com'
        && recipient.websiteLeadSiteId === createdSite.id
        && recipient.isActive === false,
    ),
  );
});

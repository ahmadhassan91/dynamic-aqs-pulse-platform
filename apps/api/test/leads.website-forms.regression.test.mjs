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
  } = await import('../dist/modules/leads/service.js'));
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

test('seeded website sites expose active public form configuration', async () => {
  const actor = await createAdminActor();
  const siteList = await listWebsiteLeadSites(actor);

  assert.equal(siteList.items.length, 16);
  assert.equal(siteList.items.filter((site) => site.isActive).length, 14);

  const solaceAir = await getPublicWebsiteLeadSite('solace-air');
  assert.equal(solaceAir.siteId, 'solace-air');
  assert.equal(solaceAir.formType, 'both');

  await assert.rejects(() => getPublicWebsiteLeadSite('eco-air'), /not available/i);
});

test('public website capture rejects lead types outside the configured form mode', async () => {
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

test('duplicate website submissions attach to the existing lead instead of creating a second one', async () => {
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
  assert.equal(submissions[1].outcome, 'ATTACHED_TO_EXISTING_LEAD');
  assert.equal(submissions[1].serviceTechCount, 5);
});

test('native website forms preserve explicit address and customer-intake metadata', async () => {
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

test('admin users can manage website sites and notification recipients through the service layer', async () => {
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

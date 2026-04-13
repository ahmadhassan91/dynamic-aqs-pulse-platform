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
let createLead;
let getLeadDetail;
let scheduleLeadDiscovery;
let completeLeadDiscovery;
let skipLeadDiscovery;
let transitionLeadStage;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({ ensureLeadRoutingPolicySeeded, ensureWebsiteLeadConfigSeeded, createLead, getLeadDetail, scheduleLeadDiscovery, completeLeadDiscovery, skipLeadDiscovery, transitionLeadStage } = await import('../dist/modules/leads/service.js'));
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

test('manual intake normalizes approved regions and preserves marketing metadata', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Northern Air Partners',
    contactDisplayName: 'Jamie North',
    email: 'jamie.north@example.com',
    phone: '555-111-2222',
    state: 'Ontario',
    sourceCampaign: 'digital_ad',
    leadRating: 'warm',
    serviceTechCount: 3,
    notes: 'Imported from approved master-sheet flow.',
  });

  assert.equal(lead.state, 'ON');
  assert.equal(lead.countryCode, 'CA');

  const detail = await getLeadDetail(actor, lead.id);
  assert.ok(detail);
  assert.equal(detail.sourceCampaign, 'digital_ad');
  assert.equal(detail.leadRating, 'warm');
});

test('manual intake rejects unsupported state or province values', SERIAL, async () => {
  const actor = await createAdminActor();

  await assert.rejects(
    () =>
      createLead(actor, {
        companyName: 'Unsupported Region HVAC',
        serviceTechCount: 2,
        state: 'Atlantis',
      }),
    /State\/Province must be a valid US state or Canadian province/i,
  );
});

test('discovery scheduling and completion enforce summary rules', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Discovery Ready IAQ',
    serviceTechCount: 4,
    state: 'Texas',
  });

  const scheduled = await scheduleLeadDiscovery(actor, lead.id, {
    note: 'Discovery booked for tomorrow.',
  });

  assert.equal(scheduled.stage, 'discovery_scheduled');
  assert.ok(scheduled.discoveryScheduledAt);

  await assert.rejects(
    () =>
      scheduleLeadDiscovery(actor, lead.id, {
        note: 'Attempt to schedule twice.',
      }),
    /only be scheduled while the lead is in the New Lead stage/i,
  );

  await assert.rejects(
    () =>
      completeLeadDiscovery(actor, lead.id, {
        summary: 'Too short',
      }),
    /at least 10 characters/i,
  );

  const completed = await completeLeadDiscovery(actor, lead.id, {
    summary: 'Customer is aligned on IAQ add-ons and ready for CIS.',
    painPoints: ['Dust / Allergies'],
    currentIaqSetup: 'Portable purifier only',
    decisionMaker: 'Owner',
    buyingIntent: 'Ready this quarter',
    consignmentInterestStatus: 'not_discussed',
    note: 'Discovery fully captured.',
  });

  assert.equal(completed.stage, 'discovery_completed');
  assert.equal(Boolean(completed.discoveryCallSkipped), false);
  assert.equal(completed.discoverySummary, 'Customer is aligned on IAQ add-ons and ready for CIS.');
});

test('discovery fast-track requires an explicit reason and preserves it on the lead', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Fast Track Mechanical',
    serviceTechCount: 2,
    state: 'TX',
  });

  await assert.rejects(
    () =>
      skipLeadDiscovery(actor, lead.id, {
        note: 'Skipping without reason should fail.',
      }),
    /fast-track reason is required/i,
  );

  const skipped = await skipLeadDiscovery(actor, lead.id, {
    fastTrackReason: 'Existing relationship with Dynamic AQS leadership.',
    note: 'Approved fast-track path.',
  });

  assert.equal(skipped.stage, 'discovery_completed');
  assert.equal(skipped.discoveryCallSkipped, true);
  assert.equal(skipped.discoveryFastTrackReason, 'Existing relationship with Dynamic AQS leadership.');
});

test('cis signing transition stamps submission and signature timestamps', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'CIS Transition HVAC',
    serviceTechCount: 5,
    state: 'FL',
  });

  const sent = await transitionLeadStage(actor, lead.id, {
    toStage: 'cis_sent',
    note: 'CIS sent from regression suite.',
  });

  assert.equal(sent.stage, 'cis_sent');
  assert.ok(sent.cisSentAt);

  const signed = await transitionLeadStage(actor, lead.id, {
    toStage: 'cis_signed',
    note: 'Signed package received.',
  });

  assert.equal(signed.stage, 'cis_signed');
  assert.ok(signed.cisSentAt);
  assert.ok(signed.cisSubmittedAt);
  assert.ok(signed.cisSignedAt);
});

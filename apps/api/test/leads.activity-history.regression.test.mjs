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
let getLeadDetail;
let listLeads;
let listLeadHistoryFeed;
let listLeadWorkflowQueue;
let logLeadInitialContact;
let scheduleLeadDiscovery;
let completeLeadDiscovery;
let updateLeadLifecycle;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    getLeadDetail,
    listLeads,
    listLeadHistoryFeed,
    listLeadWorkflowQueue,
    logLeadInitialContact,
    scheduleLeadDiscovery,
    completeLeadDiscovery,
    updateLeadLifecycle,
  } = await import('../dist/modules/leads/service.js'));

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

test('lead history feed shows newest events first and supports searching by lifecycle reason text', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Evergreen IAQ',
    contactDisplayName: 'Sam Rivera',
    email: 'sam@evergreeniaq.com',
    serviceTechCount: 4,
    state: 'TX',
  });

  await logLeadInitialContact(actor, lead.id, {
    note: 'Initial outreach completed from history regression.',
  });
  await scheduleLeadDiscovery(actor, lead.id, {
    scheduledAt: new Date(Date.now() + 24 * 3600000).toISOString(),
    note: 'Discovery booked for tomorrow morning.',
  });
  await completeLeadDiscovery(actor, lead.id, {
    summary: 'Discovery completed and the lead is ready for CIS.',
    buyingIntent: 'immediate',
    decisionMaker: 'Owner',
  });
  await updateLeadLifecycle(actor, lead.id, {
    status: 'parked',
    reasonCode: 'follow_up_later',
    reasonNote: 'Waiting for summer season budget approval.',
  });
  await updateLeadLifecycle(actor, lead.id, {
    status: 'active',
  });

  const fullFeed = await listLeadHistoryFeed(actor, { limit: 10 });
  assert.ok(fullFeed.items.length >= 5, 'expected the lead history feed to include the major workflow events');
  assert.equal(fullFeed.items[0].leadId, lead.id);
  assert.equal(fullFeed.items[0].title, 'Lead Reopened');
  assert.equal(fullFeed.items[0].actor?.email, process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL);
  assert.match(fullFeed.items[1].summary, /summer season budget approval/i);

  const seasonalSearch = await listLeadHistoryFeed(actor, {
    search: 'summer season budget approval',
    limit: 10,
  });

  assert.equal(seasonalSearch.items.length, 1);
  assert.equal(seasonalSearch.items[0].title, 'Lead Parked');
  assert.match(seasonalSearch.items[0].summary, /Follow Up Later: Waiting for summer season budget approval\./i);
});

test('parked and closed leads remain accessible in detail with lifecycle-specific next actions', SERIAL, async () => {
  const actor = await createAdminActor();
  const parkedLead = await createLead(actor, {
    companyName: 'Seasonal Comfort Group',
    contactDisplayName: 'Jamie Park',
    serviceTechCount: 3,
    state: 'CA',
  });
  const closedLead = await createLead(actor, {
    companyName: 'Quiet Valley Air',
    contactDisplayName: 'Drew Close',
    serviceTechCount: 2,
    state: 'NV',
  });

  await updateLeadLifecycle(actor, parkedLead.id, {
    status: 'parked',
    reasonCode: 'follow_up_later',
    reasonNote: 'Pause until fall roster review.',
  });
  await updateLeadLifecycle(actor, closedLead.id, {
    status: 'closed',
    reasonCode: 'not_interested',
    reasonNote: 'Prospect declined the offer.',
  });

  const parkedDetail = await getLeadDetail(actor, parkedLead.id);
  const closedDetail = await getLeadDetail(actor, closedLead.id);

  assert.ok(parkedDetail);
  assert.ok(closedDetail);
  assert.equal(parkedDetail.lifecycleStatus, 'parked');
  assert.equal(parkedDetail.workflowTask.nextAction, 'Resume Lead');
  assert.equal(parkedDetail.lifecycleReasonNote, 'Pause until fall roster review.');
  assert.equal(parkedDetail.stage, 'new');

  assert.equal(closedDetail.lifecycleStatus, 'closed');
  assert.equal(closedDetail.workflowTask.nextAction, 'Reopen Lead');
  assert.equal(closedDetail.lifecycleReasonCode, 'not_interested');
  assert.equal(closedDetail.stage, 'new');
});

test('archived lifecycle filters stay out of the active queue and only appear when explicitly requested', SERIAL, async () => {
  const actor = await createAdminActor();
  const activeLead = await createLead(actor, {
    companyName: 'Open Queue Services',
    contactDisplayName: 'Avery Active',
    serviceTechCount: 5,
    state: 'TX',
  });
  const parkedLead = await createLead(actor, {
    companyName: 'Parked Queue Services',
    contactDisplayName: 'Parker Pause',
    serviceTechCount: 5,
    state: 'TX',
  });
  const closedLead = await createLead(actor, {
    companyName: 'Closed Queue Services',
    contactDisplayName: 'Cora Closed',
    serviceTechCount: 5,
    state: 'TX',
  });

  const overdueTimestamp = new Date(Date.now() - (3 * 24 * 3600000));
  await prisma.lead.updateMany({
    where: {
      id: {
        in: [activeLead.id, parkedLead.id, closedLead.id],
      },
    },
    data: {
      initialContactDueAt: null,
      createdAt: overdueTimestamp,
      updatedAt: overdueTimestamp,
    },
  });

  await updateLeadLifecycle(actor, parkedLead.id, {
    status: 'parked',
    reasonCode: 'follow_up_later',
    reasonNote: 'Pause this opportunity for a later season.',
  });
  await updateLeadLifecycle(actor, closedLead.id, {
    status: 'closed',
    reasonCode: 'no_response',
    reasonNote: 'No response after repeated outreach.',
  });

  const activeList = await listLeads(actor, {});
  const parkedList = await listLeads(actor, { lifecycleStatus: 'parked' });
  const closedList = await listLeads(actor, { lifecycleStatus: 'closed' });
  const queue = await listLeadWorkflowQueue(actor, {});

  assert.deepEqual(activeList.items.map((item) => item.id), [activeLead.id]);
  assert.deepEqual(parkedList.items.map((item) => item.id), [parkedLead.id]);
  assert.deepEqual(closedList.items.map((item) => item.id), [closedLead.id]);

  assert.deepEqual(queue.items.map((item) => item.leadId), [activeLead.id]);
  assert.equal(queue.summary.openActionCount, 1);
  assert.equal(queue.summary.urgentCount, 1);
  assert.equal(queue.summary.slaRiskCount, 1);
  assert.equal(queue.summary.stagnantCount, 0);
});

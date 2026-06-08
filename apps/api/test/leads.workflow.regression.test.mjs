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
let createLead;
let listLeads;
let getLeadDetail;
let getLeadRoutingPolicy;
let previewLeadDuplicateCandidates;
let previewLeadOcrCapture;
let listLeadWorkflowQueue;
let scheduleLeadDiscovery;
let completeLeadDiscovery;
let skipLeadDiscovery;
let transitionLeadStage;
let updateLeadLifecycle;
let updateLeadRoutingPolicy;
let logLeadInitialContact;
const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));

  const configModule = await import('../dist/config.js');
  ({ ensureReferenceDataSeeded } = await import('../dist/modules/reference/service.js'));
  ({
    ensureLeadRoutingPolicySeeded,
    ensureWebsiteLeadConfigSeeded,
    createLead,
    listLeads,
    getLeadDetail,
    getLeadRoutingPolicy,
    previewLeadDuplicateCandidates,
    listLeadWorkflowQueue,
    logLeadInitialContact,
    scheduleLeadDiscovery,
    completeLeadDiscovery,
    skipLeadDiscovery,
    transitionLeadStage,
    updateLeadLifecycle,
    updateLeadRoutingPolicy,
  } = await import('../dist/modules/leads/service.js'));
  ({ previewLeadOcrCapture } = await import('../dist/modules/leads/ocr.js'));

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

  return {
    userId: auth.identity.userId,
    sessionId: auth.session.sessionId,
    role: auth.identity.role,
    actorType: auth.identity.actorType,
    email: auth.identity.email,
    displayName: auth.identity.displayName ?? process.env.AUTH_BOOTSTRAP_ADMIN_DISPLAY_NAME ?? 'Pulse Bootstrap Admin',
  };
}

async function createScopedActor(role, email, displayName) {
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

function subtractBusinessDays(value, businessDays) {
  const result = new Date(value.getTime());
  let remaining = businessDays;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return result;
}

test('lead routing policy defaults are PRD-backed and new leads inherit the initial contact due date', SERIAL, async () => {
  const actor = await createAdminActor();
  const policy = await getLeadRoutingPolicy(actor);

  assert.equal(policy.initialContactSlaHours, 24);
  assert.equal(policy.discoverySchedulingSlaHours, 72);
  assert.equal(policy.cisFollowUpBusinessDays, 5);
  assert.equal(policy.stagnantStageDays, 7);

  const lead = await createLead(actor, {
    companyName: 'PRD Default Timing HVAC',
    serviceTechCount: 3,
    state: 'TX',
  });

  assert.ok(lead.initialContactDueAt, 'expected an initial contact due date');
  const hoursUntilDue = Math.round((new Date(lead.initialContactDueAt).getTime() - new Date(lead.createdAt).getTime()) / 3600000);
  assert.equal(hoursUntilDue, 24);
});

test('workflow queue falls back to the live SLA policy when historical leads are missing initial contact due dates', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Historical Lead Timing Backfill',
    serviceTechCount: 2,
    state: 'TX',
  });

  const twentySixHoursAgo = new Date(Date.now() - (26 * 3600000));
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      initialContactDueAt: null,
      createdAt: twentySixHoursAgo,
    },
  });

  const queue = await listLeadWorkflowQueue(actor, {});
  const item = queue.items.find((entry) => entry.leadId === lead.id);

  assert.ok(item, 'expected historical lead in workflow queue');
  assert.equal(item.urgency, 'high');
  assert.equal(item.slaRisk, true);
  assert.match(item.reason, /24-hour initial contact SLA is overdue/i);
});

test('discovery scheduling SLA becomes the next queue priority after initial contact is logged', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Discovery Scheduling Priority',
    serviceTechCount: 4,
    state: 'FL',
  });

  await logLeadInitialContact(actor, lead.id, {
    note: 'Initial outreach completed from workflow suite.',
  });

  const eightyHoursAgo = new Date(Date.now() - (80 * 3600000));
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      initialContactedAt: eightyHoursAgo,
      updatedAt: eightyHoursAgo,
    },
  });

  const queue = await listLeadWorkflowQueue(actor, {});
  const item = queue.items.find((entry) => entry.leadId === lead.id);

  assert.ok(item, 'expected lead in workflow queue');
  assert.equal(item.nextAction, 'Schedule Discovery Call');
  assert.equal(item.urgency, 'high');
  assert.match(item.reason, /Discovery scheduling is overdue/i);
});

test('discovery scheduling preserves an explicitly chosen future slot', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Calendar Scheduled Discovery',
    serviceTechCount: 2,
    state: 'TX',
  });

  const chosenSlot = new Date(Date.now() + (48 * 3600000)).toISOString();
  const detail = await scheduleLeadDiscovery(actor, lead.id, {
    scheduledAt: chosenSlot,
    note: 'Scheduled from centralized calendar launcher.',
  });

  assert.equal(detail.stage, 'discovery_scheduled');
  assert.ok(detail.discoveryScheduledAt, 'expected scheduled discovery datetime');
  assert.equal(new Date(detail.discoveryScheduledAt).toISOString(), chosenSlot);
});

test('routing policy updates change queue stale thresholds and CIS follow-up timing', SERIAL, async () => {
  const actor = await createAdminActor();

  const updatedPolicy = await updateLeadRoutingPolicy(actor, {
    stagnantStageDays: 3,
    cisFollowUpBusinessDays: 4,
    cisFollowUpProspectReminderDelayBusinessDays: 2,
    cisFollowUpOwnerAlertDelayBusinessDays: 4,
  });

  assert.equal(updatedPolicy.stagnantStageDays, 3);
  assert.equal(updatedPolicy.cisFollowUpBusinessDays, 4);

  const staleLead = await createLead(actor, {
    companyName: 'Stale Queue Threshold HVAC',
    serviceTechCount: 1,
    state: 'CA',
  });

  await prisma.lead.update({
    where: { id: staleLead.id },
    data: {
      createdAt: new Date(Date.now() - (5 * 24 * 3600000)),
    },
  });

  const cisLead = await createLead(actor, {
    companyName: 'CIS Reminder Window Heating',
    serviceTechCount: 6,
    state: 'NV',
  });

  await transitionLeadStage(actor, cisLead.id, {
    toStage: 'cis_sent',
    note: 'CIS issued from workflow timing regression.',
  });

  const threeBusinessDaysAgo = subtractBusinessDays(new Date(), 3);
  await prisma.lead.update({
    where: { id: cisLead.id },
    data: {
      cisSentAt: threeBusinessDaysAgo,
      cisSubmittedAt: null,
    },
  });

  const stagnantView = await listLeadWorkflowQueue(actor, { view: 'stagnant' });
  assert.ok(stagnantView.items.some((entry) => entry.leadId === staleLead.id), 'expected lead to be stale once threshold is lowered');

  const queue = await listLeadWorkflowQueue(actor, {});
  const cisItem = queue.items.find((entry) => entry.leadId === cisLead.id);
  assert.ok(cisItem, 'expected CIS follow-up lead in queue');
  assert.equal(cisItem.nextAction, 'Follow Up CIS');
  assert.equal(cisItem.urgency, 'medium');
  assert.match(cisItem.reason, /reminder window is open/i);
});

test('manual intake previews and blocks duplicate leads unless create-new is explicitly acknowledged', SERIAL, async () => {
  const actor = await createAdminActor();
  const original = await createLead(actor, {
    companyName: 'Duplicate Guard HVAC',
    contactDisplayName: 'Jordan Repeat',
    email: 'jordan.repeat@example.com',
    phone: '555-818-1000',
    state: 'TX',
    serviceTechCount: 4,
  });

  const duplicateInput = {
    companyName: 'Duplicate Guard HVAC',
    contactDisplayName: 'Jordan Repeat',
    email: 'jordan.repeat@example.com',
    phone: '555-818-1000',
    state: 'TX',
    serviceTechCount: 5,
  };

  const preview = await previewLeadDuplicateCandidates(actor, duplicateInput);
  assert.equal(preview.hasPotentialDuplicate, true);
  assert.equal(preview.candidates.length, 1);
  assert.equal(preview.candidates[0].entityType, 'lead');
  assert.equal(preview.candidates[0].entityId, original.id);

  await assert.rejects(
    () => createLead(actor, duplicateInput),
    /Potential duplicate found/i,
  );
  assert.equal(await prisma.lead.count({ where: { email: 'jordan.repeat@example.com' } }), 1);

  const acknowledged = await createLead(actor, {
    ...duplicateInput,
    email: 'jordan.repeat.manual-new@example.com',
    duplicateResolution: {
      decision: 'create_new',
      reason: 'Confirmed a separate branch collected at a trade show.',
    },
  });
  assert.notEqual(acknowledged.id, original.id);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'LEAD',
      entityId: acknowledged.id,
      action: 'CREATE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  assert.ok(audit, 'expected manual duplicate override audit entry');
  assert.equal(audit.metadata.manualDuplicateResolution.decision, 'create_new');
  assert.match(audit.metadata.manualDuplicateResolution.reason, /separate branch/i);
});

test('manual duplicate intake can enrich an existing lead without creating a new record', SERIAL, async () => {
  const actor = await createAdminActor();
  const original = await createLead(actor, {
    companyName: 'Duplicate Enrich HVAC',
    contactDisplayName: 'Morgan Merge',
    email: 'morgan.merge@example.com',
    state: 'TX',
    serviceTechCount: 3,
  });

  const enriched = await createLead(actor, {
    companyName: 'Duplicate Enrich HVAC',
    contactDisplayName: 'Morgan Merge',
    email: 'morgan.merge@example.com',
    phone: '555-882-4400',
    state: 'TX',
    serviceTechCount: 7,
    sourceCampaign: 'Trade show badge scan',
    notes: 'Captured from handwritten business card at Expo.',
    duplicateResolution: {
      decision: 'enrich_existing',
      targetEntityId: original.id,
      reason: 'Same contact; fill missing card fields only.',
    },
  });

  assert.equal(enriched.id, original.id);
  assert.equal(await prisma.lead.count({ where: { email: 'morgan.merge@example.com' } }), 1);

  const detail = await getLeadDetail(actor, original.id);
  assert.equal(detail.phone, '555-882-4400');
  assert.equal(detail.sourceCampaign, 'Trade show badge scan');
  assert.match(detail.notes ?? '', /Duplicate intake note/i);
  assert.equal(detail.serviceTechCount, 3, 'enrichment must not overwrite routed service-tech truth');

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'LEAD',
      entityId: original.id,
      action: 'UPDATE',
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  assert.ok(audit, 'expected duplicate enrichment audit entry');
  assert.equal(audit.metadata.workflowAction, 'duplicate_enrich_existing');
  assert.equal(audit.metadata.duplicateResolution.decision, 'enrich_existing');
  assert.equal(audit.metadata.duplicateResolution.targetEntityId, original.id);
  assert.deepEqual(audit.afterData.phone, '555-882-4400');
});

test('lead OCR preview extracts handwritten-style contact text and surfaces duplicate candidates before create', SERIAL, async () => {
  const actor = await createAdminActor();
  const existing = await createLead(actor, {
    companyName: 'Show Floor IAQ',
    contactDisplayName: 'Maya Rivera',
    email: 'maya.rivera@example.com',
    phone: '555-418-8123',
    state: 'TX',
    serviceTechCount: 4,
  });

  const preview = await previewLeadOcrCapture(actor, {
    documentType: 'business_card',
    rawExtractionText: [
      'Show Floor IAQ',
      'Maya Rivera',
      'maya.rivera@example.com',
      '555-418-8123',
      'Austin, TX',
      'Handwritten note: interested in IAQ training',
    ].join('\n'),
    serviceTechCountFallback: 1,
  });

  assert.equal(preview.extractionMode, 'manual_text');
  assert.equal(preview.fields.companyName?.value, 'Show Floor IAQ');
  assert.equal(preview.fields.contactDisplayName?.value, 'Maya Rivera');
  assert.equal(preview.fields.email?.value, 'maya.rivera@example.com');
  assert.equal(preview.fields.phone?.value, '555-418-8123');
  assert.equal(preview.fields.state?.value, 'TX');
  assert.equal(preview.fields.serviceTechCount?.source, 'operator_default');
  assert.equal(preview.duplicatePreview.hasPotentialDuplicate, true);
  assert.ok(preview.duplicatePreview.candidates.some((candidate) => candidate.entityId === existing.id));
  assert.ok(preview.reviewReasons.some((reason) => /duplicate/i.test(reason)));
});

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

test('territory-scoped lead visibility stays simple for territory managers', SERIAL, async () => {
  const adminActor = await createAdminActor();
  await prisma.territoryPolicy.update({
    where: { id: 'default' },
    data: { preHandoffTmVisibility: true },
  });
  const tmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.scope.leads@pulse.local', 'TM Scoped');
  const otherTmActor = await createScopedActor('TERRITORY_MANAGER', 'tm.other.leads@pulse.local', 'TM Other');
  const rdActor = await createScopedActor('REGIONAL_DIRECTOR', 'rd.scope.leads@pulse.local', 'RD Scoped');

  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const region = await prisma.region.create({
    data: {
      code: 'rg_scope_leads',
      name: 'Scoped Leads Region',
      directorUserId: rdActor.userId,
      isActive: true,
    },
  });

  const ownedTerritory = await prisma.territory.create({
    data: {
      code: 'tm_owned_leads',
      name: 'TM Owned Leads Territory',
      regionId: region.id,
      managerUserId: tmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const otherTerritory = await prisma.territory.create({
    data: {
      code: 'tm_other_leads',
      name: 'TM Other Leads Territory',
      regionId: region.id,
      managerUserId: otherTmActor.userId,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const visibleLead = await createLead(adminActor, {
    companyName: 'Scoped Visible Lead',
    serviceTechCount: 4,
    state: 'TX',
  });

  const hiddenLead = await createLead(adminActor, {
    companyName: 'Scoped Hidden Lead',
    serviceTechCount: 4,
    state: 'TX',
  });

  await prisma.lead.update({
    where: { id: visibleLead.id },
    data: {
      territory: {
        connect: {
          id: ownedTerritory.id,
        },
      },
      assignedTmUser: {
        connect: {
          id: tmActor.userId,
        },
      },
      assignedTmName: tmActor.displayName,
      assignedRdUser: {
        connect: {
          id: rdActor.userId,
        },
      },
    },
  });

  await prisma.lead.update({
    where: { id: hiddenLead.id },
    data: {
      territory: {
        connect: {
          id: otherTerritory.id,
        },
      },
      assignedTmUser: {
        connect: {
          id: otherTmActor.userId,
        },
      },
      assignedTmName: otherTmActor.displayName,
      assignedRdUser: {
        connect: {
          id: rdActor.userId,
        },
      },
    },
  });

  const tmVisibleLeads = await listLeads(tmActor, {});
  assert.equal(tmVisibleLeads.total, 1);
  assert.deepEqual(tmVisibleLeads.items.map((item) => item.id), [visibleLead.id]);

  const tmVisibleDetail = await getLeadDetail(tmActor, visibleLead.id);
  assert.ok(tmVisibleDetail);
  assert.equal(tmVisibleDetail.id, visibleLead.id);

  const tmHiddenDetail = await getLeadDetail(tmActor, hiddenLead.id);
  assert.equal(tmHiddenDetail, null);

  const tmWorkflowQueue = await listLeadWorkflowQueue(tmActor, {});
  assert.ok(tmWorkflowQueue.items.some((item) => item.leadId === visibleLead.id), 'visible lead should appear in scoped TM workflow queue');
  assert.ok(!tmWorkflowQueue.items.some((item) => item.leadId === hiddenLead.id), 'hidden lead must not appear in scoped TM workflow queue');
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

test('backward stage transitions require a governed reason (BR-L-07) and persist it', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Backward Transition HVAC',
    serviceTechCount: 4,
    state: 'TX',
  });

  const sent = await transitionLeadStage(actor, lead.id, {
    toStage: 'cis_sent',
    note: 'CIS sent from regression suite.',
  });
  assert.equal(sent.stage, 'cis_sent');

  // Hard gate: a backward transition without a reason is rejected.
  await assert.rejects(
    () => transitionLeadStage(actor, lead.id, { toStage: 'discovery_completed' }),
    /reason is required to move a lead to an earlier stage/i,
  );

  // The lead must not have moved when the gate rejected the transition.
  const afterReject = await getLeadDetail(actor, lead.id);
  assert.equal(afterReject.stage, 'cis_sent');

  // With a reason the backward transition succeeds and the reason is persisted.
  const moved = await transitionLeadStage(actor, lead.id, {
    toStage: 'discovery_completed',
    backwardReason: 'Customer paused; re-qualifying discovery.',
  });
  assert.equal(moved.stage, 'discovery_completed');

  const event = await prisma.leadStageEvent.findFirst({
    where: { leadId: lead.id, toStage: 'DISCOVERY_COMPLETED' },
    orderBy: { occurredAt: 'desc' },
  });
  assert.ok(event, 'expected a stage event for the backward transition');
  assert.equal(event.metadata?.isBackwardTransition, true);
  assert.equal(event.metadata?.backwardReason, 'Customer paused; re-qualifying discovery.');
});

test('closing a lead as not interested removes it from the active workflow queue and preserves history fields', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Dormant Follow-Up Heating',
    serviceTechCount: 2,
    state: 'TX',
  });

  const queueBefore = await listLeadWorkflowQueue(actor, {});
  assert.ok(queueBefore.items.some((item) => item.leadId === lead.id), 'expected active lead in workflow queue');

  const closed = await updateLeadLifecycle(actor, lead.id, {
    status: 'closed',
    reasonCode: 'not_interested',
    reasonNote: 'Prospect declined the program this quarter.',
  });

  assert.equal(closed.lifecycleStatus, 'closed');
  assert.equal(closed.lifecycleReasonCode, 'not_interested');
  assert.equal(closed.lifecycleReasonNote, 'Prospect declined the program this quarter.');
  assert.ok(closed.lifecycleChangedAt);

  const queueAfter = await listLeadWorkflowQueue(actor, {});
  assert.ok(!queueAfter.items.some((item) => item.leadId === lead.id), 'closed lead should be removed from the active queue');
});

test('reopening a parked lead keeps its stage intact and restores workflow queue visibility', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Seasonal Follow-Up Cooling',
    serviceTechCount: 4,
    state: 'Florida',
  });

  const discovered = await skipLeadDiscovery(actor, lead.id, {
    fastTrackReason: 'Existing trusted relationship.',
    summary: 'Fast-tracked directly into CIS readiness.',
  });

  assert.equal(discovered.stage, 'discovery_completed');

  const parked = await updateLeadLifecycle(actor, lead.id, {
    status: 'parked',
    reasonCode: 'follow_up_later',
    reasonNote: 'Prospect asked to reconnect after peak season.',
  });

  assert.equal(parked.lifecycleStatus, 'parked');
  assert.equal(parked.stage, 'discovery_completed');

  const reopened = await updateLeadLifecycle(actor, lead.id, {
    status: 'active',
  });

  assert.equal(reopened.lifecycleStatus, 'active');
  assert.equal(reopened.stage, 'discovery_completed');
  assert.equal(reopened.lifecycleReasonCode, undefined);

  const queueAfter = await listLeadWorkflowQueue(actor, {});
  assert.ok(queueAfter.items.some((item) => item.leadId === lead.id), 'reopened lead should return to the active queue');
});

test('customer active records cannot be parked or closed through lead lifecycle controls', SERIAL, async () => {
  const actor = await createAdminActor();
  const lead = await createLead(actor, {
    companyName: 'Already Activated IAQ',
    serviceTechCount: 6,
    state: 'CA',
  });

  await transitionLeadStage(actor, lead.id, {
    toStage: 'customer_active',
    note: 'Regression-only direct activation.',
  });

  await assert.rejects(
    () =>
      updateLeadLifecycle(actor, lead.id, {
        status: 'closed',
        reasonCode: 'duplicate',
      }),
    /Customer Active records cannot be parked or closed/i,
  );
});

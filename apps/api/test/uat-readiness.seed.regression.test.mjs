import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, '../../..');
const seedScript = path.join(repoRoot, 'scripts/seed-uat-readiness.mjs');

let prisma;
let config;
let loadAppConfig;
let loginWithPassword;
let authenticateAccessToken;
let getCurrentDealerPortalCatalog;
let getLeadDetail;
let getAccountDetail;
let listTrainingSessions;
let getConsignmentSiteDetail;
let updateConsignmentAudit;
let listMobileVoiceNoteReviewQueue;
let reviewMobileVoiceNote;

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  ({ loadAppConfig } = await import('../dist/config.js'));
  ({ loginWithPassword, authenticateAccessToken } = await import('../dist/modules/auth/service.js'));
  ({ getCurrentDealerPortalCatalog } = await import('../dist/modules/dealer-portal/service.js'));
  ({ getLeadDetail } = await import('../dist/modules/leads/service.js'));
  ({ getAccountDetail } = await import('../dist/modules/accounts/service.js'));
  ({ listTrainingSessions } = await import('../dist/modules/training/service.js'));
  ({ getConsignmentSiteDetail, updateConsignmentAudit } = await import('../dist/modules/consignment/service.js'));
  ({ listMobileVoiceNoteReviewQueue, reviewMobileVoiceNote } = await import('../dist/modules/mobile-voice-notes/service.js'));

  config = loadAppConfig(process.env);
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
});

test('dependency-free UAT seed creates usable personas and dealer-visible catalog state', async () => {
  await resetDatabase(prisma);

  execFileSync(process.execPath, [seedScript], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'pipe',
  });

  const [
    dealerAccountCount,
    dealerUserCount,
    activeRuleSet,
    activeSnapshots,
    publishedPresentations,
    publishedInclusions,
    trainingSessions,
    pendingFieldNotes,
  ] = await Promise.all([
    prisma.account.count({ where: { accountNumber: { startsWith: 'UAT-' }, isActive: true } }),
    prisma.dealerPortalUser.count({ where: { status: 'ACTIVE', account: { accountNumber: { startsWith: 'UAT-' } } } }),
    prisma.catalogRuleSet.findFirst({ where: { code: 'UAT_DEALER_CATALOG_RULES', status: 'ACTIVE', isActive: true }, include: { rules: true } }),
    prisma.dealerCatalogSnapshot.findMany({ where: { dealerCatalogView: { code: { startsWith: 'UAT_' } }, isActive: true }, orderBy: { version: 'desc' } }),
    prisma.productPresentation.count({ where: { baseProduct: { sku: { startsWith: 'UAT-' } }, publishStatus: 'PUBLISHED', readyForDealerPortal: true } }),
    prisma.catalogInclusion.count({ where: { presentation: { baseProduct: { sku: { startsWith: 'UAT-' } } }, publishStatus: 'PUBLISHED', isVisible: true } }),
    prisma.trainingSession.count({ where: { title: 'UAT IAQ Certification Visit', status: 'SCHEDULED' } }),
    prisma.mobileVoiceNote.count({ where: { title: { startsWith: 'UAT Field Day' }, reviewStatus: 'PENDING_REVIEW' } }),
  ]);

  assert.equal(dealerAccountCount, 4);
  assert.equal(dealerUserCount, 4);
  assert.ok(activeRuleSet, 'expected active UAT catalog rule set');
  assert.equal(activeRuleSet.rules.length, 5);
  assert.equal(activeSnapshots.length, 4);
  assert.equal(publishedPresentations, 2);
  assert.equal(publishedInclusions, 6);
  assert.equal(trainingSessions, 1);
  assert.equal(pendingFieldNotes, 4);

  const fieldAccount = await prisma.account.findUniqueOrThrow({
    where: { accountNumber: 'UAT-AFF-1001' },
    include: { sourceLead: true },
  });
  assert.ok(fieldAccount.sourceLeadId, 'expected seeded account to retain source-lead lineage');
  assert.equal(fieldAccount.sourceLead?.companyName, 'UAT Nexstar Comfort Field Lead');
  assert.equal(fieldAccount.sourceLead?.routingTeam, 'NATIONAL_TM');
  assert.equal(fieldAccount.sourceLead?.consignmentInterestStatus, 'INTERESTED');

  const consignmentSite = await prisma.consignmentSite.findFirstOrThrow({
    where: { accountId: fieldAccount.id, name: 'UAT Main Showroom Consignment' },
    include: {
      forms: true,
      audits: { include: { lines: true }, orderBy: { scheduledFor: 'asc' } },
    },
  });
  assert.equal(consignmentSite.status, 'ACTIVE');
  assert.equal(consignmentSite.acumaticaStatus, 'PARKED');
  assert.ok(consignmentSite.forms.some((form) => form.formType === 'AGREEMENT' && form.status === 'SIGNED'));
  assert.ok(consignmentSite.forms.some((form) => form.formType === 'BLUE' && form.status === 'SIGNED'));
  assert.ok(consignmentSite.forms.some((form) => form.formType === 'ROSE' && form.status === 'CURRENT'));
  assert.equal(consignmentSite.audits.length, 1);
  assert.equal(consignmentSite.audits[0].sourceFreshnessLabel, 'acumatica_parked');
  assert.equal(consignmentSite.audits[0].lines.length, 2);

  const nexstarCatalog = await loginAndLoadCatalog('owner+nexstar@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(nexstarCatalog.catalogView.kind, 'affinity');
  assert.equal(nexstarCatalog.catalogView.name, 'UAT Nexstar Dealer Catalog');
  assert.deepEqual(nexstarCatalog.products.map((product) => product.sku), ['UAT-IAQ-100']);
  assert.ok(nexstarCatalog.products[0].assets.length >= 1);

  const peCatalog = await loginAndLoadCatalog('owner+redwood@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(peCatalog.catalogView.kind, 'ownership');
  assert.equal(peCatalog.catalogView.name, 'UAT Redwood PE Dealer Catalog');
  assert.deepEqual(peCatalog.products.map((product) => product.sku), ['UAT-IAQ-100']);

  const independentCatalog = await loginAndLoadCatalog('owner+independent@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(independentCatalog.catalogView.kind, 'independent');
  assert.deepEqual(independentCatalog.products.map((product) => product.sku), ['UAT-FLTR-200', 'UAT-IAQ-100']);

  const hybridCatalog = await loginAndLoadCatalog('owner+hybrid@pulse-uat.local', 'PulseUatDealer123!');
  assert.equal(hybridCatalog.products.length, 0);
  assert.match(hybridCatalog.warnings.join(' '), /affinity group and an ownership\/PE group|catalog view/i);

  const reviewer = await loginInternal('uat.seed@pulse.local', 'PulseUatInternal123!');
  const queue = await listMobileVoiceNoteReviewQueue(reviewer, {
    reviewStatus: 'pending_review',
    limit: 10,
  });
  const fieldDayQueue = queue.items.filter((note) => note.title.startsWith('UAT Field Day'));
  assert.equal(fieldDayQueue.length, 4);

  const leadNote = requireQueuedNote(fieldDayQueue, 'UAT Field Day Lead Note');
  const reviewedLeadNote = await reviewMobileVoiceNote(reviewer, leadNote.id, {
    decision: 'approve',
    structuredSummary: 'Lead needs a fast IAQ quote follow-up before tomorrow afternoon.',
    structuredNextStep: 'Confirm quote owner and update the lead after review.',
    structuredSentiment: 'positive',
    structuredTags: ['lead-follow-up', 'quote', 'uat-field-day'],
    reviewNotes: 'Approved for lead activity.',
  });
  assert.equal(reviewedLeadNote.writebackTarget, 'lead');
  const leadDetail = await getLeadDetail(reviewer, fieldAccount.sourceLeadId);
  assert.ok(leadDetail?.fieldActivity.some((note) => /fast IAQ quote/i.test(note.summary)));

  const accountNote = requireQueuedNote(fieldDayQueue, 'UAT Field Day Account Note');
  const reviewedAccountNote = await reviewMobileVoiceNote(reviewer, accountNote.id, {
    decision: 'approve',
    structuredSummary: 'Owner confirmed contact data and requested dealer portal access to the IAQ spec sheet.',
    structuredNextStep: 'Confirm dealer portal access and attach the note to the account.',
    structuredSentiment: 'positive',
    structuredTags: ['account-visit', 'dealer-portal', 'uat-field-day'],
    reviewNotes: 'Approved for account activity.',
  });
  assert.equal(reviewedAccountNote.writebackTarget, 'account');
  const accountDetail = await getAccountDetail(reviewer, fieldAccount.id);
  assert.ok(accountDetail?.activityReview.recentEvents.some((event) => event.source === 'field_activity' && /dealer portal access/i.test(event.detail)));
  assert.ok(accountDetail?.activityReview.recentEvents.some((event) => event.source === 'source_lead'));

  const trainingNote = requireQueuedNote(fieldDayQueue, 'UAT Field Day Training Note');
  const reviewedTrainingNote = await reviewMobileVoiceNote(reviewer, trainingNote.id, {
    decision: 'approve',
    structuredSummary: 'IAQ certification had four attendees; two technicians need filter replacement coaching.',
    structuredNextStep: 'Create a training follow-up for filter replacement coaching.',
    structuredSentiment: 'neutral',
    structuredTags: ['training', 'coaching', 'uat-field-day'],
    writebackAction: 'create_training_follow_up',
    followUpTitle: 'Coach technicians on IAQ filter replacement',
    followUpDueAt: '2026-06-05T15:00:00.000Z',
    reviewNotes: 'Approved and converted to a training follow-up.',
  });
  assert.match(reviewedTrainingNote.writebackTarget ?? '', /^training_follow_up_task:/);
  const trainingReadModel = await listTrainingSessions(reviewer, {
    accountId: fieldAccount.id,
    limit: 20,
  });
  const seededTrainingSession = trainingReadModel.items.find((session) => session.title === 'UAT IAQ Certification Visit');
  assert.ok(seededTrainingSession?.followUpTasks.some((task) => task.title === 'Coach technicians on IAQ filter replacement'));
  assert.ok(seededTrainingSession?.fieldActivity.some((note) => /filter replacement coaching/i.test(note.summary ?? '')));

  const consignmentNote = requireQueuedNote(fieldDayQueue, 'UAT Field Day Consignment Note');
  const reviewedConsignmentNote = await reviewMobileVoiceNote(reviewer, consignmentNote.id, {
    decision: 'approve',
    structuredSummary: 'ROSE shelf count appears short by one IAQ unit; manual work item needed while Acumatica inventory is parked.',
    structuredNextStep: 'Create a consignment work item for variance follow-up.',
    structuredSentiment: 'concern',
    structuredTags: ['consignment', 'rose-audit', 'uat-field-day'],
    writebackAction: 'create_consignment_work_item',
    followUpTitle: 'Review UAT ROSE IAQ shelf variance',
    followUpPriority: 'high',
    reviewNotes: 'Approved and converted to a manual consignment work item.',
  });
  assert.match(reviewedConsignmentNote.writebackTarget ?? '', /^consignment_work_item:/);
  let consignmentDetail = await getConsignmentSiteDetail(reviewer, consignmentSite.id);
  assert.ok(consignmentDetail?.workItems.some((item) => item.type === 'field_note_follow_up' && item.title === 'Review UAT ROSE IAQ shelf variance'));
  assert.ok(consignmentDetail?.fieldActivity.some((note) => /manual work item/i.test(note.summary ?? '')));

  const completedRoseAudit = await updateConsignmentAudit(reviewer, consignmentSite.audits[0].id, {
    status: 'completed',
    completedAt: '2026-06-04T16:00:00.000Z',
    notes: 'UAT ROSE audit completed with one manual variance; Acumatica PO creation remains parked.',
    lines: [
      {
        sku: 'UAT-IAQ-100',
        productName: 'UAT Whole Home IAQ System',
        expectedQuantity: 2,
        actualQuantity: 1,
        notes: 'One unit short on seeded manual count.',
      },
      {
        sku: 'UAT-FLTR-200',
        productName: 'UAT Replacement Filter Kit',
        expectedQuantity: 6,
        actualQuantity: 6,
      },
    ],
  });
  assert.equal(completedRoseAudit.status, 'completed');
  assert.equal(completedRoseAudit.reconciliationStatus, 'open');
  consignmentDetail = await getConsignmentSiteDetail(reviewer, consignmentSite.id);
  assert.ok(consignmentDetail?.workItems.some((item) => item.type === 'po_follow_up' && /manual PO follow-up/i.test(item.notes ?? '')));
});

async function loginAndLoadCatalog(email, password) {
  const auth = await loginWithPassword(config, { email, password }, {});
  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, `expected authenticated actor for ${email}`);
  return getCurrentDealerPortalCatalog(actor);
}

async function loginInternal(email, password) {
  const auth = await loginWithPassword(config, { email, password }, {});
  const actor = await authenticateAccessToken(auth.tokens.accessToken);
  assert.ok(actor, `expected authenticated actor for ${email}`);
  return actor;
}

function requireQueuedNote(notes, title) {
  const note = notes.find((item) => item.title === title);
  assert.ok(note, `expected queued voice note ${title}`);
  return note;
}

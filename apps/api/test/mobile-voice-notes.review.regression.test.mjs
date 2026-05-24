import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppConfig } from '@pulse/config';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let voiceNotes;
let accounts;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  voiceNotes = await import('../dist/modules/mobile-voice-notes/service.js');
  accounts = await import('../dist/modules/accounts/service.js');
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

test('office reviewer approves account voice note and writes account activity', SERIAL, async () => {
  const tm = await createActor('TERRITORY_MANAGER', 'tm');
  const reviewer = await createActor('SUPER_ADMIN', 'reviewer');
  const account = await prisma.account.create({
    data: {
      displayName: 'Field Review Dealer',
      lifecycleStatus: 'ACTIVE',
      isActive: true,
      assignedTmUserId: tm.userId,
    },
  });
  const config = loadAppConfig({ ...process.env, PULSE_VOICE_NOTES_AI_PROVIDER: 'disabled' });

  const note = await voiceNotes.createMobileVoiceNote(config, tm, {
    accountId: account.id,
    transcriptText: 'Dealer asked for a follow up quote on two IAQ demo units.',
    title: 'Dealer visit',
  });

  const mobileList = await voiceNotes.listMobileVoiceNotes(tm, {});
  assert.equal(mobileList.total, 1);
  assert.equal(mobileList.items[0].reviewStatus, 'pending_review');

  const queue = await voiceNotes.listMobileVoiceNoteReviewQueue(reviewer, { reviewStatus: 'pending_review' });
  assert.equal(queue.total, 1);
  assert.equal(queue.items[0].id, note.id);

  const reviewed = await voiceNotes.reviewMobileVoiceNote(reviewer, note.id, {
    decision: 'approve',
    structuredSummary: 'Dealer requested a quote for two IAQ demo units.',
    structuredNextStep: 'Send quote and confirm homeowner event timing.',
    structuredSentiment: 'positive',
    structuredTags: ['account', 'quote', 'follow-up'],
    reviewNotes: 'Good account follow-up.',
  });

  assert.equal(reviewed.reviewStatus, 'approved');
  assert.equal(reviewed.writebackTarget, 'account');
  assert.ok(reviewed.writebackCompletedAt);
  assert.equal(reviewed.reviewedByName, 'SUPER_ADMIN reviewer');

  const voiceAudit = await prisma.auditEntry.findFirst({
    where: { entityType: 'MOBILE_VOICE_NOTE', entityId: note.id, action: 'APPROVE' },
  });
  assert.ok(voiceAudit);

  const accountAudit = await prisma.auditEntry.findFirst({
    where: { entityType: 'ACCOUNT', entityId: account.id, action: 'UPDATE' },
  });
  assert.equal(accountAudit?.metadata.workflowAction, 'mobile_voice_note_approved');
  assert.equal(accountAudit?.metadata.sourceVoiceNoteId, note.id);

  const detail = await accounts.getAccountDetail(reviewer, account.id);
  assert.ok(detail?.activityReview.recentEvents.some((event) => event.source === 'field_activity' && /quote/i.test(event.detail)));
});

test('office reviewer rejects voice note without target writeback', SERIAL, async () => {
  const tm = await createActor('TERRITORY_MANAGER', 'reject-tm');
  const reviewer = await createActor('SUPER_ADMIN', 'reject-reviewer');
  const config = loadAppConfig({ ...process.env, PULSE_VOICE_NOTES_AI_PROVIDER: 'disabled' });

  const note = await voiceNotes.createMobileVoiceNote(config, tm, {
    transcriptText: 'Duplicate general note from the same visit.',
  });

  await assert.rejects(
    () => voiceNotes.reviewMobileVoiceNote(reviewer, note.id, { decision: 'reject' }),
    /requires a review note/i,
  );

  const rejected = await voiceNotes.reviewMobileVoiceNote(reviewer, note.id, {
    decision: 'reject',
    rejectedReason: 'Duplicate field note.',
  });
  assert.equal(rejected.reviewStatus, 'rejected');
  assert.equal(rejected.rejectedReason, 'Duplicate field note.');
  assert.equal(rejected.writebackTarget, undefined);

  const targetAuditCount = await prisma.auditEntry.count({
    where: { metadata: { path: ['sourceVoiceNoteId'], equals: note.id } },
  });
  assert.equal(targetAuditCount, 0);
});

test('office reviewer creates training follow-up from approved training voice note', SERIAL, async () => {
  const tm = await createActor('TERRITORY_MANAGER', 'training-tm');
  const reviewer = await createActor('TRAINING_OPS', 'training-reviewer');
  const account = await prisma.account.create({
    data: {
      displayName: 'Training Field Dealer',
      lifecycleStatus: 'ACTIVE',
      isActive: true,
      assignedTmUserId: tm.userId,
    },
  });
  const session = await prisma.trainingSession.create({
    data: {
      accountId: account.id,
      trainerUserId: tm.userId,
      title: 'IAQ install coaching',
      scheduledAt: new Date('2026-06-01T14:00:00.000Z'),
      notes: 'Seeded for mobile voice-note review.',
    },
  });
  const config = loadAppConfig({ ...process.env, PULSE_VOICE_NOTES_AI_PROVIDER: 'disabled' });

  const note = await voiceNotes.createMobileVoiceNote(config, tm, {
    trainingSessionId: session.id,
    transcriptText: 'Dealer needs a follow up session for UV install objections.',
    title: 'Training follow up',
  });

  const queue = await voiceNotes.listMobileVoiceNoteReviewQueue(reviewer, {
    reviewStatus: 'pending_review',
    trainingSessionId: session.id,
  });
  assert.equal(queue.total, 1);

  const reviewed = await voiceNotes.reviewMobileVoiceNote(reviewer, note.id, {
    decision: 'approve',
    structuredSummary: 'Dealer needs reinforcement on UV install objection handling.',
    structuredNextStep: 'Schedule a follow-up coaching call.',
    structuredSentiment: 'concern',
    writebackAction: 'create_training_follow_up',
    followUpTitle: 'Schedule UV install coaching follow-up',
    followUpDueAt: '2026-06-05T15:00:00.000Z',
    reviewNotes: 'Create a training follow-up task.',
  });

  assert.equal(reviewed.reviewStatus, 'approved');
  assert.match(reviewed.writebackTarget ?? '', /^training_follow_up_task:/);

  const task = await prisma.trainingFollowUpTask.findFirst({
    where: { sessionId: session.id },
  });
  assert.equal(task?.title, 'Schedule UV install coaching follow-up');
  assert.equal(task?.createdByUserId, reviewer.userId);

  const taskAudit = await prisma.auditEntry.findFirst({
    where: { entityType: 'TRAINING_FOLLOW_UP_TASK', entityId: task?.id },
  });
  assert.equal(taskAudit?.metadata.sourceVoiceNoteId, note.id);
  assert.equal(taskAudit?.metadata.acumaticaBoundary, 'not_an_acumatica_writeback');
});

test('office reviewer creates consignment work item from approved consignment voice note', SERIAL, async () => {
  const tm = await createActor('TERRITORY_MANAGER', 'consignment-tm');
  const reviewer = await createActor('ADMIN_CSR_OPS', 'consignment-reviewer');
  const account = await prisma.account.create({
    data: {
      displayName: 'Consignment Field Dealer',
      lifecycleStatus: 'ACTIVE',
      isActive: true,
      assignedTmUserId: tm.userId,
    },
  });
  const site = await prisma.consignmentSite.create({
    data: {
      accountId: account.id,
      name: 'Main Showroom Consignment',
      ownerTmUserId: tm.userId,
      status: 'ACTIVE',
      acumaticaStatus: 'PARKED',
    },
  });
  const config = loadAppConfig({ ...process.env, PULSE_VOICE_NOTES_AI_PROVIDER: 'disabled' });

  const note = await voiceNotes.createMobileVoiceNote(config, tm, {
    consignmentSiteId: site.id,
    transcriptText: 'Display unit has cracked grille. Ask office to review replacement next week.',
    title: 'Consignment display issue',
  });

  const reviewed = await voiceNotes.reviewMobileVoiceNote(reviewer, note.id, {
    decision: 'approve',
    structuredSummary: 'Display unit has a cracked grille at the consignment site.',
    structuredNextStep: 'Review replacement plan with the dealer.',
    structuredSentiment: 'urgent',
    writebackAction: 'create_consignment_work_item',
    followUpTitle: 'Review cracked display unit replacement',
    followUpPriority: 'urgent',
    reviewNotes: 'Create manual consignment field follow-up. Acumatica remains parked.',
  });

  assert.equal(reviewed.reviewStatus, 'approved');
  assert.match(reviewed.writebackTarget ?? '', /^consignment_work_item:/);

  const workItem = await prisma.consignmentWorkItem.findFirst({
    where: { siteId: site.id, type: 'FIELD_NOTE_FOLLOW_UP' },
  });
  assert.equal(workItem?.title, 'Review cracked display unit replacement');
  assert.equal(workItem?.priority, 'urgent');
  assert.equal(workItem?.assignedToUserId, tm.userId);

  const workItemAudit = await prisma.auditEntry.findFirst({
    where: { entityType: 'CONSIGNMENT_WORK_ITEM', entityId: workItem?.id },
  });
  assert.equal(workItemAudit?.metadata.sourceVoiceNoteId, note.id);
  assert.equal(workItemAudit?.metadata.acumaticaBoundary, 'manual_pulse_work_item_only');
});

async function createActor(role, suffix) {
  const user = await prisma.user.create({
    data: {
      email: `${role.toLowerCase().replaceAll('_', '-')}-${suffix}@pulse.local`,
      displayName: `${role} ${suffix}`,
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

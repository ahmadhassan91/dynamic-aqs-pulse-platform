import assert from 'node:assert/strict';
import test from 'node:test';
import { loadAppConfig } from '@pulse/config';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from './support/runtime.mjs';

applyTestEnvironment();
ensureTestDatabaseReady();

let prisma;
let service;

const SERIAL = { concurrency: false };

test.before(async () => {
  ({ prisma } = await import('@pulse/db'));
  service = await import('../dist/modules/mobile-voice-notes/service.js');
  await prisma.$connect();
});

test.after(async () => {
  if (prisma) await prisma.$disconnect();
});

test.beforeEach(async () => {
  await resetDatabase(prisma);
});

test('mobile voice note stores raw transcript, structured review data, account context, and audit trail', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'voice-note');
  const account = await prisma.account.create({
    data: {
      displayName: 'UAT Voice Dealer',
      lifecycleStatus: 'ACTIVE',
      isActive: true,
    },
  });
  const config = loadAppConfig({ ...process.env, PULSE_VOICE_NOTES_AI_PROVIDER: 'disabled' });

  const note = await service.createMobileVoiceNote(config, actor, {
    accountId: account.id,
    transcriptText: 'Great visit with UAT Voice Dealer. Follow up next week with a quote for the Dynamic unit.',
    title: 'Dealer visit recap',
  });

  assert.equal(note.accountId, account.id);
  assert.equal(note.accountName, 'UAT Voice Dealer');
  assert.equal(note.contextType, 'account');
  assert.equal(note.processingStatus, 'needs_review');
  assert.equal(note.llmProvider, 'disabled');
  assert.match(note.structuredSummary ?? '', /Great visit/);
  assert.ok(note.structuredTags.includes('account'));
  assert.ok(note.structuredTags.includes('follow-up'));
  assert.ok(note.crmSyncedAt);

  const listed = await service.listMobileVoiceNotes(actor, { accountId: account.id });
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].id, note.id);

  const audit = await prisma.auditEntry.findFirst({
    where: {
      entityType: 'MOBILE_VOICE_NOTE',
      entityId: note.id,
      action: 'CREATE',
    },
  });
  assert.ok(audit);
  assert.equal(audit.metadata.coreWritebackPolicy, 'parked_until_dynamic_confirms_review_rules');
});

test('audio-only voice note stores the file and keeps transcription reviewable when AI is disabled', SERIAL, async () => {
  const actor = await createActor('SUPER_ADMIN', 'voice-audio');
  const config = loadAppConfig({ ...process.env, PULSE_VOICE_NOTES_AI_PROVIDER: 'disabled' });

  const note = await service.createMobileVoiceNote(config, actor, {
    audio: {
      contentBase64: Buffer.from('audio fixture').toString('base64'),
      fileName: 'field-note.m4a',
      mimeType: 'audio/m4a',
      durationSeconds: 12,
    },
  });

  assert.equal(note.contextType, 'general');
  assert.equal(note.processingStatus, 'needs_review');
  assert.equal(note.audioFileName, 'field-note.m4a');
  assert.equal(note.audioMimeType, 'audio/m4a');
  assert.equal(note.audioSizeBytes, Buffer.byteLength('audio fixture'));
  assert.equal(note.durationSeconds, 12);
  assert.match(note.llmErrorMessage ?? '', /no transcript/i);
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

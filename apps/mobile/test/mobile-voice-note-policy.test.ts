import test from 'node:test';
import assert from 'node:assert/strict';
import { audioMimeTypeFromUri, buildVoiceNoteCreateRequest, describeVoiceNoteProcessing, describeVoiceNoteReview, getVoiceNoteSubmitBlocker } from '../src/lib/voice-note-policy.ts';

test('blocks empty voice-note syncs before creating CRM noise', () => {
  assert.match(getVoiceNoteSubmitBlocker({ transcriptText: '', audioUri: null }) ?? '', /Record a note/);
  assert.equal(getVoiceNoteSubmitBlocker({ transcriptText: 'Dealer asked for follow-up.', audioUri: null }), null);
  assert.equal(getVoiceNoteSubmitBlocker({ transcriptText: '', audioUri: 'file:///note.m4a' }), null);
});

test('builds account-scoped voice note requests without leaking empty fields', () => {
  const request = buildVoiceNoteCreateRequest({
    accountId: 'account-1',
    recordedAt: '2026-05-24T12:00:00.000Z',
    title: ' Dealer recap ',
    transcriptText: ' Follow up with quote. ',
  });

  assert.deepEqual(request, {
    accountId: 'account-1',
    contextType: 'account',
    recordedAt: '2026-05-24T12:00:00.000Z',
    title: 'Dealer recap',
    transcriptText: 'Follow up with quote.',
  });

  assert.deepEqual(buildVoiceNoteCreateRequest({
    recordedAt: '2026-05-24T12:00:00.000Z',
    transcriptText: 'General reminder.',
  }), {
    contextType: 'general',
    recordedAt: '2026-05-24T12:00:00.000Z',
    transcriptText: 'General reminder.',
  });
});

test('maps audio mime types and review copy for field users', () => {
  assert.equal(audioMimeTypeFromUri('file:///recording.webm'), 'audio/webm');
  assert.equal(audioMimeTypeFromUri('file:///recording.m4a'), 'audio/m4a');
  assert.match(describeVoiceNoteProcessing('structured', 'openai'), /Structured by AI/);
  assert.match(describeVoiceNoteProcessing('needs_review', 'disabled'), /office review/i);
});

test('separates AI processing health from office review status', () => {
  assert.equal(describeVoiceNoteReview({
    processingStatus: 'structured',
    reviewStatus: 'pending_review',
    llmProvider: 'openai',
  }).label, 'Needs Office Review');

  const approved = describeVoiceNoteReview({
    processingStatus: 'structured',
    reviewStatus: 'approved',
    reviewedByName: 'Ops Lead',
    reviewedAt: '2026-05-24T12:00:00.000Z',
  });
  assert.equal(approved.label, 'Approved');
  assert.match(approved.detail, /Ops Lead/);

  const rejected = describeVoiceNoteReview({
    processingStatus: 'structured',
    reviewStatus: 'rejected',
    rejectedReason: 'Duplicate note.',
  });
  assert.equal(rejected.label, 'Rejected');
  assert.match(rejected.nextAction, /office/i);
});

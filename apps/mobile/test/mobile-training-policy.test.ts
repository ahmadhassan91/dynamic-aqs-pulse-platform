import test from 'node:test';
import assert from 'node:assert/strict';
import type { TrainingSessionSummary } from '@pulse/contracts/training';
import { buildProofUploadStatusFromError, buildTrainingCompleteRequest, getTrainingCompletionBlocker } from '../src/lib/training-mobile-policy.ts';

test('blocks enabled follow-up with missing title or detail', () => {
  const session = trainingSession();

  assert.match(getTrainingCompletionBlocker(session, true, {
    attendeeCount: 1,
    followUpDescription: 'Call next week',
    followUpEnabled: true,
    followUpTitle: '',
    notes: 'Completed.',
    proofNotes: '',
  }) ?? '', /both follow-up/);

  assert.match(getTrainingCompletionBlocker(session, true, {
    attendeeCount: 1,
    followUpDescription: '',
    followUpEnabled: true,
    followUpTitle: 'Call dealer',
    notes: 'Completed.',
    proofNotes: '',
  }) ?? '', /both follow-up/);
});

test('blocks failed proof upload unless proof notes explain the gap', () => {
  const session = trainingSession();

  assert.match(getTrainingCompletionBlocker(session, true, {
    attendeeCount: 1,
    followUpDescription: '',
    followUpEnabled: false,
    followUpTitle: '',
    notes: 'Completed.',
    proofNotes: '',
    proofUploadFailed: true,
  }) ?? '', /Proof photo/);

  assert.equal(getTrainingCompletionBlocker(session, true, {
    attendeeCount: 1,
    followUpDescription: '',
    followUpEnabled: false,
    followUpTitle: '',
    notes: 'Completed.',
    proofNotes: 'Roster retained by office.',
    proofUploadFailed: true,
  }), null);
});

test('builds follow-up task only when explicitly enabled and complete', () => {
  const request = buildTrainingCompleteRequest(trainingSession(), {
    attendeeCount: 2,
    checkedInAt: '2026-05-24T12:00:00.000Z',
    completedAt: '2026-05-24T12:30:00.000Z',
    followUpDescription: 'Send certificate list',
    followUpEnabled: true,
    followUpTitle: 'Certificate follow-up',
    notes: 'Covered install basics.',
    proofAttachmentCount: 1,
    proofNotes: 'Photo uploaded.',
  });

  assert.deepEqual(request.createFollowUpTask, {
    title: 'Certificate follow-up',
    description: 'Send certificate list',
  });

  const skipped = buildTrainingCompleteRequest(trainingSession(), {
    attendeeCount: 2,
    checkedInAt: '2026-05-24T12:00:00.000Z',
    completedAt: '2026-05-24T12:30:00.000Z',
    followUpDescription: 'Should not create',
    followUpEnabled: false,
    followUpTitle: 'Hidden task',
    notes: 'Covered install basics.',
    proofAttachmentCount: 0,
    proofNotes: '',
  });

  assert.equal(skipped.createFollowUpTask, undefined);
});

test('formats failed proof upload as not saved offline', () => {
  const status = buildProofUploadStatusFromError(new Error('Network failed'));

  assert.equal(status.tone, 'error');
  assert.match(status.message, /not uploaded to CRM/);
  assert.match(status.message, /not saved offline/);
});

function trainingSession(): TrainingSessionSummary {
  return {
    accountId: 'account-1',
    accountName: 'UAT Dealer',
    activityKind: 'training',
    attendeeCount: 1,
    createdAt: '2026-05-24T00:00:00.000Z',
    durationMinutes: 30,
    executionState: 'scheduled',
    id: 'session-1',
    isCertificationTrack: false,
    isOverdue: false,
    proofAttachmentCount: 0,
    scheduledAt: '2026-05-24T12:00:00.000Z',
    status: 'scheduled',
    title: 'UAT Training',
    updatedAt: '2026-05-24T00:00:00.000Z',
  } as TrainingSessionSummary;
}

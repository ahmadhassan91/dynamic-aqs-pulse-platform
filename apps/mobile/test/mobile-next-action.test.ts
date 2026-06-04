import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileNextActionState, type MobileNextActionDraftInput } from '../src/lib/mobile-next-action.ts';

test('keeps a checked-in route visit as the top field action', () => {
  const state = buildMobileNextActionState({
    drafts: [
      draft({
        id: 'route-1',
        payload: { kind: 'route_visit', stage: 'checked_in', accountName: 'UAT Dealer' },
        status: 'pending',
      }),
      draft({ id: 'draft-1', status: 'pending' }),
    ],
    queueSummary: { urgentCount: 1, slaRiskCount: 1 },
    workflowQueueItems: [{ companyName: 'Urgent Lead', nextAction: 'Call now', urgency: 'high', slaRisk: true }],
  });

  assert.equal(state.primary.kind, 'route_checkout');
  assert.equal(state.primary.targetHref, '/route');
  assert.match(state.primary.detail, /UAT Dealer/);
});

test('sync review blocks blind field work when CRM needs office review', () => {
  const state = buildMobileNextActionState({
    drafts: [
      draft({
        error: { kind: 'conflict', message: 'CRM record changed', retryable: false },
        id: 'conflict-1',
        status: 'conflict',
      }),
    ],
    queueSummary: { urgentCount: 1, slaRiskCount: 0 },
    workflowQueueItems: [{ companyName: 'Urgent Lead', nextAction: 'Call now', urgency: 'high' }],
  });

  assert.equal(state.primary.kind, 'sync_review');
  assert.equal(state.syncAction.kind, 'sync_review');
  assert.match(state.primary.title, /review/i);
  assert.match(state.primary.detail, /Dynamic confirms/i);
});

test('urgent leads outrank generic phone-saved drafts and ROSE audits', () => {
  const state = buildMobileNextActionState({
    consignmentSites: [{ accountName: 'ROSE Dealer', nextAuditDueAt: '2026-06-03T00:00:00.000Z' }],
    drafts: [draft({ id: 'pending-1', status: 'pending' })],
    queueSummary: { urgentCount: 2, slaRiskCount: 0 },
    workflowQueueItems: [{ companyName: 'Priority Dealer', nextAction: 'Call before noon', urgency: 'high' }],
  });

  assert.equal(state.primary.kind, 'lead_urgent');
  assert.equal(state.primary.targetHref, '/leads');
  assert.match(state.primary.detail, /Priority Dealer/);
});

test('falls back to a simple route plan when no alerts are present', () => {
  const state = buildMobileNextActionState({});

  assert.equal(state.primary.kind, 'route_plan');
  assert.equal(state.primary.targetHref, '/route');
  assert.equal(state.alerts.length, 0);
  assert.equal(state.badgeCount, 0);
});

test('badge count is produced by the shared ranked alert model', () => {
  const state = buildMobileNextActionState({
    consignmentWorkItems: [{ accountName: 'Work Dealer', openDiscrepancyCount: 1, openWorkItemCount: 2 }],
    draftSummary: {
      needsReview: 0,
      readyToRetry: 1,
      retryable: 1,
      savedOnPhone: 1,
      signInAgain: 0,
      storageAvailable: true,
      storageHydrated: true,
      syncing: 0,
      unsynced: 1,
    },
    queueSummary: { urgentCount: 1, slaRiskCount: 1 },
  });

  assert.equal(state.alerts.some((action) => action.kind === 'sync_retry'), true);
  assert.equal(state.alerts.some((action) => action.kind === 'lead_urgent'), true);
  assert.equal(state.alerts.some((action) => action.kind === 'lead_sla'), true);
  assert.equal(state.alerts.some((action) => action.kind === 'consignment_work'), true);
  assert.equal(state.badgeCount, 5);
});

test('blocking storage state still creates a visible notification badge', () => {
  const state = buildMobileNextActionState({
    draftSummary: {
      needsReview: 0,
      readyToRetry: 0,
      retryable: 0,
      savedOnPhone: 0,
      signInAgain: 0,
      storageAvailable: false,
      storageHydrated: true,
      syncing: 0,
      unsynced: 0,
    },
  });

  assert.equal(state.primary.kind, 'sync_review');
  assert.equal(state.badgeCount, 1);
});

test('ranks supplied training and voice-note signals without claiming they are globally fetched', () => {
  const training = buildMobileNextActionState({ trainingDueCount: 2 });
  const voice = buildMobileNextActionState({ voiceNoteReviewCount: 3 });

  assert.equal(training.primary.kind, 'training_due');
  assert.equal(training.primary.targetHref, '/training');
  assert.equal(voice.primary.kind, 'voice_note_review');
  assert.equal(voice.primary.targetHref, '/voice-notes');
});

function draft(input: Partial<MobileNextActionDraftInput>): MobileNextActionDraftInput {
  return {
    id: 'draft',
    payload: { kind: 'consignment_rose_audit' },
    status: 'pending',
    updatedAt: '2026-06-01T12:00:00.000Z',
    ...input,
  };
}

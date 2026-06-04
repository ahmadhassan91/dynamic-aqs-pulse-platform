import { getMobileDraftReviewState, type MobileDraftReviewInput } from './mobile-draft-review-policy.ts';
import { getMobileSyncUatGuidance, type MobileSyncUatSummaryInput } from './mobile-sync-uat-guidance.ts';

export type MobileNextActionKind =
  | 'route_checkout'
  | 'sync_review'
  | 'sync_retry'
  | 'lead_urgent'
  | 'lead_sla'
  | 'training_due'
  | 'consignment_due'
  | 'consignment_work'
  | 'voice_note_review'
  | 'route_plan'
  | 'all_clear';

export type MobileNextActionTone = 'active' | 'danger' | 'pending' | 'review' | 'warning';

export type MobileNextActionTarget =
  | '/sync-status'
  | '/route'
  | '/leads'
  | '/training'
  | '/consignment'
  | '/voice-notes'
  | '/more';

export type MobileNextAction = {
  id: string;
  kind: MobileNextActionKind;
  title: string;
  detail: string;
  actionLabel: string;
  targetHref: MobileNextActionTarget;
  tone: MobileNextActionTone;
  priority: number;
  badgeCount?: number;
  count?: number;
  sourceLabel?: string;
};

export type MobileNextActionState = {
  primary: MobileNextAction;
  alerts: MobileNextAction[];
  syncAction: MobileNextAction;
  badgeCount: number;
};

export type MobileNextActionDraftInput = MobileDraftReviewInput & {
  id: string;
  kind?: string;
  title?: string;
  updatedAt?: string;
  payload?: {
    kind?: string;
    stage?: string;
    accountName?: string;
    sessionTitle?: string;
  };
};

export type MobileNextActionLeadQueueItemInput = {
  leadId?: string;
  companyName?: string;
  nextAction?: string;
  urgency?: 'high' | 'medium' | 'low' | string;
  reason?: string;
  slaRisk?: boolean;
};

export type MobileNextActionLeadQueueSummaryInput = {
  openActionCount?: number;
  urgentCount?: number;
  stagnantCount?: number;
  slaRiskCount?: number;
};

export type MobileNextActionConsignmentSiteInput = {
  id?: string;
  accountName?: string;
  nextAuditDueAt?: string;
  openWorkItemCount?: number;
  openDiscrepancyCount?: number;
};

export type BuildMobileNextActionInput = {
  consignmentSites?: MobileNextActionConsignmentSiteInput[];
  consignmentWorkItems?: MobileNextActionConsignmentSiteInput[];
  draftSummary?: MobileSyncUatSummaryInput;
  drafts?: MobileNextActionDraftInput[];
  queueSummary?: MobileNextActionLeadQueueSummaryInput | null;
  trainingDueCount?: number;
  voiceNoteReviewCount?: number;
  workflowQueueItems?: MobileNextActionLeadQueueItemInput[];
};

const cleanRoutePlanAction: MobileNextAction = {
  id: 'route-plan',
  kind: 'route_plan',
  title: 'Plan the next stop',
  detail: 'No urgent CRM action is blocking this session. Open Route when you are ready to visit the next account.',
  actionLabel: 'Open route',
  targetHref: '/route',
  tone: 'active',
  priority: 10,
  sourceLabel: 'field day',
};

export function buildMobileNextActionState(input: BuildMobileNextActionInput): MobileNextActionState {
  const syncAction = buildSyncAction(input.drafts ?? [], input.draftSummary);
  const actions: MobileNextAction[] = [
    ...buildRouteActions(input.drafts ?? []),
    syncAction,
    ...buildLeadActions(input.workflowQueueItems ?? [], input.queueSummary),
    ...buildTrainingActions(input.trainingDueCount ?? 0),
    ...buildConsignmentActions(input.consignmentSites ?? [], input.consignmentWorkItems ?? []),
    ...buildVoiceNoteActions(input.voiceNoteReviewCount ?? 0),
  ].filter((action) => action.kind !== 'all_clear');

  const actionable = actions.filter((action) => action.priority > 0).sort(sortActions);
  const primary = actionable[0] ?? cleanRoutePlanAction;
  const alerts = actionable.filter((action) => action.kind !== 'route_plan');
  const badgeCount = alerts.reduce((total, action) => total + (action.badgeCount ?? (action.count && action.count > 0 ? 1 : 0)), 0);

  return {
    alerts,
    badgeCount,
    primary,
    syncAction,
  };
}

function buildRouteActions(drafts: MobileNextActionDraftInput[]) {
  const checkedInRoutes = drafts
    .filter((draft) => draft.status !== 'synced')
    .filter((draft) => draft.payload?.kind === 'route_visit' || draft.kind === 'route_visit')
    .filter((draft) => draft.payload?.stage === 'checked_in')
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime());

  const draft = checkedInRoutes[0];
  if (!draft) return [];

  const accountName = draft.payload?.accountName ?? 'the current account';
  return [{
    id: `route-checkout-${draft.id}`,
    kind: 'route_checkout',
    title: 'Finish current visit',
    detail: `${accountName} is checked in on this phone. Check out or save the visit before starting another stop.`,
    actionLabel: 'Open route',
    targetHref: '/route',
    tone: 'danger',
    priority: 1000,
    badgeCount: checkedInRoutes.length,
    count: checkedInRoutes.length,
    sourceLabel: 'route',
  } satisfies MobileNextAction];
}

function buildSyncAction(drafts: MobileNextActionDraftInput[], summaryInput?: MobileSyncUatSummaryInput): MobileNextAction {
  const summary = summaryInput ?? summarizeDraftsForSync(drafts);
  const guidance = getMobileSyncUatGuidance(summary);
  const isBlocking = !summary.storageHydrated || !summary.storageAvailable || summary.signInAgain > 0 || summary.needsReview > 0;
  const hasPhoneOnlyWork = summary.unsynced > 0 || summary.retryable > 0 || summary.readyToRetry > 0 || summary.syncing > 0;
  const issueCount = Math.max(
    isBlocking ? 1 : 0,
    summary.signInAgain,
    summary.needsReview,
    summary.readyToRetry,
    summary.retryable,
    summary.savedOnPhone,
    summary.unsynced,
    summary.syncing,
  );

  if (!isBlocking && !hasPhoneOnlyWork) {
    return {
      id: 'sync-clear',
      kind: 'all_clear',
      title: guidance.title,
      detail: guidance.detail,
      actionLabel: guidance.action,
      targetHref: '/sync-status',
      tone: 'active',
      priority: 0,
      sourceLabel: 'sync',
    };
  }

  return {
    id: 'sync-review',
    kind: isBlocking ? 'sync_review' : 'sync_retry',
    title: guidance.title,
    detail: guidance.detail,
    actionLabel: guidance.action === 'Continue field work' ? 'Open sync status' : guidance.action,
    targetHref: '/sync-status',
    tone: guidance.tone === 'blocked' || guidance.tone === 'review' ? 'danger' : 'warning',
    priority: isBlocking ? 930 : 360,
    badgeCount: issueCount,
    count: issueCount,
    sourceLabel: 'phone sync',
  };
}

function buildLeadActions(workflowQueueItems: MobileNextActionLeadQueueItemInput[], summary?: MobileNextActionLeadQueueSummaryInput | null) {
  const urgentItems = workflowQueueItems.filter((item) => item.urgency === 'high');
  const slaItems = workflowQueueItems.filter((item) => item.slaRisk);
  const urgentCount = summary?.urgentCount ?? urgentItems.length;
  const slaRiskCount = summary?.slaRiskCount ?? slaItems.length;
  const actions: MobileNextAction[] = [];

  if (urgentCount > 0) {
    const item = urgentItems[0] ?? workflowQueueItems[0];
    actions.push({
      id: 'lead-urgent',
      kind: 'lead_urgent',
      title: 'Handle urgent lead',
      detail: item?.companyName
        ? `${item.companyName}: ${item.nextAction ?? item.reason ?? 'Open the lead workflow item.'}`
        : `${urgentCount} lead workflow item${urgentCount === 1 ? '' : 's'} need attention.`,
      actionLabel: 'Open leads',
      targetHref: '/leads',
      tone: 'danger',
      priority: 820,
      badgeCount: urgentCount,
      count: urgentCount,
      sourceLabel: 'lead workflow',
    });
  }

  if (slaRiskCount > 0) {
    const item = slaItems[0] ?? workflowQueueItems.find((queueItem) => queueItem.slaRisk);
    actions.push({
      id: 'lead-sla',
      kind: 'lead_sla',
      title: 'Protect lead SLA',
      detail: item?.companyName
        ? `${item.companyName} has follow-up risk. ${item.nextAction ?? item.reason ?? 'Review the lead before it stalls.'}`
        : `${slaRiskCount} lead follow-up item${slaRiskCount === 1 ? ' is' : 's are'} at risk.`,
      actionLabel: 'Review leads',
      targetHref: '/leads',
      tone: 'warning',
      priority: 760,
      badgeCount: slaRiskCount,
      count: slaRiskCount,
      sourceLabel: 'lead SLA',
    });
  }

  return actions;
}

function buildTrainingActions(trainingDueCount: number) {
  if (trainingDueCount <= 0) return [];
  return [{
    id: 'training-due',
    kind: 'training_due',
    title: 'Finish training work',
    detail: `${trainingDueCount} training session${trainingDueCount === 1 ? ' is' : 's are'} ready for field execution or follow-up.`,
    actionLabel: 'Open training',
    targetHref: '/training',
    tone: 'warning',
    priority: 650,
    badgeCount: trainingDueCount,
    count: trainingDueCount,
    sourceLabel: 'training',
  } satisfies MobileNextAction];
}

function buildConsignmentActions(consignmentSites: MobileNextActionConsignmentSiteInput[], consignmentWorkItems: MobileNextActionConsignmentSiteInput[]) {
  const dueSites = consignmentSites.filter((site) => site.nextAuditDueAt);
  const workCount = consignmentWorkItems.reduce((total, site) => total + Math.max(site.openWorkItemCount ?? 0, 1), 0);
  const discrepancyCount = consignmentWorkItems.reduce((total, site) => total + (site.openDiscrepancyCount ?? 0), 0);
  const actions: MobileNextAction[] = [];

  if (dueSites.length > 0) {
    const site = dueSites[0];
    if (!site) return actions;
    actions.push({
      id: 'consignment-due',
      kind: 'consignment_due',
      title: 'Complete ROSE audit',
      detail: `${site.accountName ?? 'A consignment site'} has a ROSE audit due. Verify counts manually if expected count context is unavailable.`,
      actionLabel: 'Open consignment',
      targetHref: '/consignment',
      tone: 'warning',
      priority: 560,
      badgeCount: dueSites.length,
      count: dueSites.length,
      sourceLabel: 'ROSE',
    });
  }

  if (workCount > 0 || discrepancyCount > 0) {
    actions.push({
      id: 'consignment-work',
      kind: 'consignment_work',
      title: 'Review consignment work',
      detail: `${workCount} open item${workCount === 1 ? '' : 's'}${discrepancyCount ? `, including ${discrepancyCount} discrepancy case${discrepancyCount === 1 ? '' : 's'}` : ''}.`,
      actionLabel: 'Open consignment',
      targetHref: '/consignment',
      tone: discrepancyCount > 0 ? 'danger' : 'warning',
      priority: discrepancyCount > 0 ? 540 : 500,
      badgeCount: Math.max(workCount, discrepancyCount),
      count: Math.max(workCount, discrepancyCount),
      sourceLabel: 'consignment',
    });
  }

  return actions;
}

function buildVoiceNoteActions(voiceNoteReviewCount: number) {
  if (voiceNoteReviewCount <= 0) return [];
  return [{
    id: 'voice-note-review',
    kind: 'voice_note_review',
    title: 'Review voice notes',
    detail: `${voiceNoteReviewCount} structured note${voiceNoteReviewCount === 1 ? ' needs' : 's need'} review before CRM writeback.`,
    actionLabel: 'Open voice notes',
    targetHref: '/voice-notes',
    tone: 'review',
    priority: 440,
    badgeCount: voiceNoteReviewCount,
    count: voiceNoteReviewCount,
    sourceLabel: 'voice notes',
  } satisfies MobileNextAction];
}

function summarizeDraftsForSync(drafts: MobileNextActionDraftInput[]): MobileSyncUatSummaryInput {
  const summary: MobileSyncUatSummaryInput = {
    needsReview: 0,
    readyToRetry: 0,
    retryable: 0,
    savedOnPhone: 0,
    signInAgain: 0,
    storageAvailable: true,
    storageHydrated: true,
    syncing: 0,
    unsynced: 0,
  };

  for (const draft of drafts) {
    if (draft.status !== 'synced') summary.unsynced += 1;
    const review = getMobileDraftReviewState(draft);
    if (review.canRetry) summary.retryable += 1;
    if (review.category === 'ready_to_retry') summary.readyToRetry += 1;
    if (review.category === 'needs_review') summary.needsReview += 1;
    if (review.category === 'saved_on_phone') summary.savedOnPhone += 1;
    if (review.category === 'sending') summary.syncing += 1;
    if (review.category === 'sign_in_again') summary.signInAgain += 1;
  }

  return summary;
}

function sortActions(left: MobileNextAction, right: MobileNextAction) {
  if (right.priority !== left.priority) return right.priority - left.priority;
  return left.title.localeCompare(right.title);
}

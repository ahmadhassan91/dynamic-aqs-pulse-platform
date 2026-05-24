export type MobileDraftReviewStatus = 'pending' | 'syncing' | 'failed' | 'conflict' | 'synced';
export type MobileDraftReviewErrorKind = 'storage' | 'network' | 'server' | 'conflict' | 'validation' | 'auth' | 'unknown';

export type MobileDraftReviewInput = {
  status: MobileDraftReviewStatus;
  errorMessage?: string;
  retryCount?: number;
  error?: {
    kind: MobileDraftReviewErrorKind;
    message: string;
    statusCode?: number;
    retryable: boolean;
  };
};

export type MobileDraftReviewCategory = 'ready_to_retry' | 'needs_review' | 'sign_in_again' | 'saved_on_phone' | 'sending' | 'crm_saved';

export type MobileDraftReviewState = {
  category: MobileDraftReviewCategory;
  label: string;
  detail: string;
  canRetry: boolean;
  needsAuth: boolean;
  tone: 'success' | 'pending' | 'warning' | 'conflict';
};

export function getMobileDraftReviewState(draft: MobileDraftReviewInput): MobileDraftReviewState {
  if (draft.status === 'synced') {
    return {
      category: 'crm_saved',
      label: 'CRM saved',
      detail: 'This update has been accepted by CRM.',
      canRetry: false,
      needsAuth: false,
      tone: 'success',
    };
  }
  if (draft.status === 'syncing') {
    return {
      category: 'sending',
      label: 'Sending',
      detail: 'This update is being sent to CRM. Keep the app open until the status changes.',
      canRetry: false,
      needsAuth: false,
      tone: 'pending',
    };
  }
  if (isMobileDraftAuthFailure(draft)) {
    return {
      category: 'sign_in_again',
      label: 'Sign in again',
      detail: draft.error?.message ?? draft.errorMessage ?? 'CRM needs a fresh sign-in before this update can retry.',
      canRetry: false,
      needsAuth: true,
      tone: 'warning',
    };
  }
  if (draft.status === 'conflict' || draft.error?.kind === 'conflict' || draft.error?.kind === 'validation') {
    return {
      category: 'needs_review',
      label: 'Needs review',
      detail: draft.error?.message ?? draft.errorMessage ?? 'CRM needs this update reviewed before retrying.',
      canRetry: false,
      needsAuth: false,
      tone: 'conflict',
    };
  }
  if (draft.status === 'failed') {
    if (isMobileDraftReviewRetryable(draft)) {
      return {
        category: 'ready_to_retry',
        label: 'Ready to retry',
        detail: draft.error?.message ?? draft.errorMessage ?? 'CRM did not save this update yet. Retry when the connection is steady.',
        canRetry: true,
        needsAuth: false,
        tone: 'warning',
      };
    }
    return {
      category: 'needs_review',
      label: 'Needs review',
      detail: draft.error?.message ?? draft.errorMessage ?? 'CRM did not accept this update. Review it before retrying.',
      canRetry: false,
      needsAuth: false,
      tone: 'conflict',
    };
  }
  return {
    category: 'saved_on_phone',
    label: 'Saved on phone',
    detail: 'This update is protected on this phone and can retry when CRM is reachable.',
    canRetry: true,
    needsAuth: false,
    tone: 'pending',
  };
}

export function isMobileDraftReviewRetryable(draft: MobileDraftReviewInput) {
  if (draft.status === 'synced' || draft.status === 'syncing' || draft.status === 'conflict') return false;
  if (isMobileDraftAuthFailure(draft)) return false;
  if ((draft.retryCount ?? 0) >= 3) return false;
  return draft.error?.retryable ?? true;
}

export function isMobileDraftAuthFailure(draft: MobileDraftReviewInput) {
  return draft.error?.kind === 'auth' || draft.error?.statusCode === 401 || draft.error?.statusCode === 403;
}

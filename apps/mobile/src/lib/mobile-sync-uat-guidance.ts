export type MobileSyncUatSummaryInput = {
  unsynced: number;
  retryable: number;
  readyToRetry: number;
  needsReview: number;
  signInAgain: number;
  savedOnPhone: number;
  syncing: number;
  storageAvailable: boolean;
  storageHydrated: boolean;
};

export type MobileSyncUatGuidance = {
  title: string;
  detail: string;
  action: string;
  tone: 'ready' | 'review' | 'warning' | 'blocked';
};

export function getMobileSyncUatGuidance(summary: MobileSyncUatSummaryInput): MobileSyncUatGuidance {
  if (!summary.storageHydrated) {
    return {
      title: 'Hold for a moment',
      detail: 'The phone draft store is still opening. Keep the app open before starting new offline work.',
      action: 'Wait for phone storage',
      tone: 'warning',
    };
  }

  if (!summary.storageAvailable) {
    return {
      title: 'Keep the app open',
      detail: 'This device has not confirmed durable draft storage. Retry CRM saves before signing out or closing the app.',
      action: 'Retry before leaving',
      tone: 'blocked',
    };
  }

  if (summary.signInAgain > 0) {
    return {
      title: 'Sign in again first',
      detail: `${summary.signInAgain} update${summary.signInAgain === 1 ? ' needs' : 's need'} a fresh CRM session before retrying.`,
      action: 'Refresh session',
      tone: 'blocked',
    };
  }

  if (summary.needsReview > 0) {
    return {
      title: 'Office review needed',
      detail: `${summary.needsReview} phone-saved update${summary.needsReview === 1 ? ' has' : 's have'} a conflict or validation issue. Keep the copy until Dynamic confirms the CRM record.`,
      action: 'Review with office',
      tone: 'review',
    };
  }

  if (summary.readyToRetry > 0 || summary.retryable > 0) {
    const count = Math.max(summary.readyToRetry, summary.retryable);
    return {
      title: 'Ready to send',
      detail: `${count} update${count === 1 ? ' is' : 's are'} saved on this phone and can retry when the signal is steady.`,
      action: 'Retry ready updates',
      tone: 'warning',
    };
  }

  if (summary.syncing > 0) {
    return {
      title: 'Sending to CRM',
      detail: `${summary.syncing} update${summary.syncing === 1 ? ' is' : 's are'} sending now. Keep the app open until the status changes.`,
      action: 'Keep app open',
      tone: 'warning',
    };
  }

  if (summary.savedOnPhone > 0 || summary.unsynced > 0) {
    const count = Math.max(summary.savedOnPhone, summary.unsynced);
    return {
      title: 'Saved on phone',
      detail: `${count} update${count === 1 ? ' is' : 's are'} protected on this phone but not visible in CRM yet.`,
      action: 'Retry when online',
      tone: 'warning',
    };
  }

  return {
    title: 'All clear',
    detail: 'There are no phone-only updates waiting for CRM.',
    action: 'Continue field work',
    tone: 'ready',
  };
}

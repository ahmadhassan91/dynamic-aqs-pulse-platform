import type { LeadDetail } from '@pulse/contracts/leads';

/**
 * FR-MOB-060 — tap-to-call with optional per-call auto-logging.
 *
 * When a field user taps "Call" on a lead, offer to log the call as the lead's
 * initial-contact disposition — but only when it is meaningful: the lead has a phone
 * number and its initial contact has not already been recorded. This keeps the auto-log
 * OPTIONAL (the dialer always opens regardless) and avoids re-prompting reps to log an
 * initial contact that is already on record.
 */
export function shouldOfferCallLog(
  lead: Pick<LeadDetail, 'phone' | 'initialContactedAt'>,
): boolean {
  return Boolean(lead.phone) && !lead.initialContactedAt;
}

export interface CallDispositionPrompt {
  title: string;
  message: string;
}

export function buildCallDispositionPrompt(contactDisplayName: string): CallDispositionPrompt {
  return {
    title: 'Log this call?',
    message: `Record a call disposition against ${contactDisplayName}?`,
  };
}

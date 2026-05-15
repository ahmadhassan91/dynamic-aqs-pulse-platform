import { useSyncExternalStore } from 'react';
import type { UpdateConsignmentAuditRequest } from '@pulse/contracts/consignment';
import { updateConsignmentAudit } from '@/lib/api';

export type MobileDraftKind = 'consignment_rose_audit' | 'route_visit';
export type MobileDraftStatus = 'pending' | 'syncing' | 'failed' | 'synced';

export type MobileDraft = {
  id: string;
  kind: MobileDraftKind;
  status: MobileDraftStatus;
  title: string;
  detail: string;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
  payload: ConsignmentRoseAuditDraftPayload | RouteVisitDraftPayload;
};

export type ConsignmentRoseAuditDraftPayload = {
  kind: 'consignment_rose_audit';
  auditId: string;
  siteId: string;
  accountName: string;
  request: UpdateConsignmentAuditRequest;
};

export type RouteVisitDraftPayload = {
  kind: 'route_visit';
  accountId: string;
  accountName: string;
  checkedInAt: string;
  checkedOutAt: string;
  notes: string;
  latitude?: number;
  longitude?: number;
};

const draftQueueKey = 'pulse.mobile.draftQueue.v1';
const listeners = new Set<() => void>();
let cachedRawDrafts: string | null | undefined;
let cachedDrafts: MobileDraft[] = [];

export function useMobileDraftQueue() {
  return useSyncExternalStore(subscribeDrafts, loadDrafts, loadDrafts);
}

export function loadDrafts(): MobileDraft[] {
  const value = globalThis.localStorage?.getItem(draftQueueKey);
  if (value === cachedRawDrafts) return cachedDrafts;
  if (!value) {
    cachedRawDrafts = value;
    cachedDrafts = [];
    return cachedDrafts;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      cachedRawDrafts = value;
      cachedDrafts = [];
      return cachedDrafts;
    }
    cachedRawDrafts = value;
    cachedDrafts = parsed.filter(isMobileDraft);
    return cachedDrafts;
  } catch {
    cachedRawDrafts = value;
    cachedDrafts = [];
    return cachedDrafts;
  }
}

export function enqueueDraft(input: Omit<MobileDraft, 'createdAt' | 'id' | 'status' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const draft: MobileDraft = {
    ...input,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  saveDrafts([draft, ...loadDrafts()]);
  return draft;
}

export function clearSyncedDrafts() {
  saveDrafts(loadDrafts().filter((draft) => draft.status !== 'synced'));
}

export async function retryPendingDrafts(apiBaseUrl: string, accessToken: string) {
  const drafts = loadDrafts();
  for (const draft of drafts) {
    if (draft.status === 'synced') continue;
    await retryDraft(apiBaseUrl, accessToken, draft.id);
  }
  return loadDrafts();
}

export async function retryDraft(apiBaseUrl: string, accessToken: string, draftId: string) {
  const drafts = updateDraft(draftId, {
    status: 'syncing',
    lastAttemptAt: new Date().toISOString(),
  });
  const draft = drafts.find((item) => item.id === draftId);
  if (!draft) return null;

  try {
    if (draft.payload.kind === 'consignment_rose_audit') {
      await updateConsignmentAudit(apiBaseUrl, accessToken, draft.payload.auditId, draft.payload.request);
    } else {
      throw new Error('Route visit backend sync is not enabled yet. Draft remains local until the field visit API is approved.');
    }
    return updateDraft(draftId, {
      status: 'synced',
      updatedAt: new Date().toISOString(),
    }).find((item) => item.id === draftId) ?? null;
  } catch (error) {
    return updateDraft(draftId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Draft sync failed.',
      updatedAt: new Date().toISOString(),
    }).find((item) => item.id === draftId) ?? null;
  }
}

function subscribeDrafts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function updateDraft(draftId: string, patch: Partial<MobileDraft>) {
  const next = loadDrafts().map((draft) => {
    if (draft.id !== draftId) return draft;
    const updated = { ...draft, ...patch };
    if (patch.status === 'syncing') {
      delete updated.errorMessage;
    }
    return updated;
  });
  saveDrafts(next);
  return next;
}

function saveDrafts(drafts: MobileDraft[]) {
  const serialized = JSON.stringify(drafts);
  cachedRawDrafts = serialized;
  cachedDrafts = drafts;
  globalThis.localStorage?.setItem(draftQueueKey, serialized);
  for (const listener of listeners) listener();
}

function isMobileDraft(value: unknown): value is MobileDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MobileDraft>;
  return Boolean(candidate.id && candidate.kind && candidate.status && candidate.title && candidate.payload);
}

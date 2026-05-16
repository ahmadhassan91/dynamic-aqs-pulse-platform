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

export type RoseEvidenceMetadata = {
  id: string;
  fileName: string;
  mimeType: string;
  purpose: 'general' | 'discrepancy';
  capturedAt: string;
  byteSize?: number;
};

export type RoseAttestationMetadata = {
  attestedByName: string;
  attestedAt: string;
  textVersion: 'rose-field-v1';
};

export type ConsignmentRoseAuditDraftPayload = {
  kind: 'consignment_rose_audit';
  auditId: string;
  siteId: string;
  accountName: string;
  request: UpdateConsignmentAuditRequest;
  evidence?: {
    items: RoseEvidenceMetadata[];
    mediaUploadStatus: 'parked_until_backend_endpoint';
  };
  attestation?: RoseAttestationMetadata;
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
  const sanitizedDraft = sanitizeDraft(draft);
  saveDrafts([sanitizedDraft, ...loadDrafts()].slice(0, 20));
  return sanitizedDraft;
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
  if (serialized.length > 100_000) {
    throw new Error('Too many offline drafts on this device. Retry or clear synced drafts before saving more.');
  }
  cachedRawDrafts = serialized;
  cachedDrafts = drafts;
  globalThis.localStorage?.setItem(draftQueueKey, serialized);
  for (const listener of listeners) listener();
}

function sanitizeDraft(draft: MobileDraft): MobileDraft {
  const serialized = JSON.stringify(draft);
  const blockedKeyPattern = /"(?:base64|contentBase64|blob|fileUri|previewUri|localUri|signatureImage|imageData)"\s*:/i;
  if (blockedKeyPattern.test(serialized)) {
    throw new Error('Media files are not stored in offline drafts yet. Save text evidence only and retry when CRM media upload is approved.');
  }
  if (serialized.length > 16_000) {
    throw new Error('This offline draft is too large. Shorten notes before saving.');
  }
  if (draft.payload.kind === 'consignment_rose_audit') {
    const request = { ...draft.payload.request };
    if (request.notes) {
      request.notes = request.notes.slice(0, 1000);
    }
    return {
      ...draft,
      title: 'ROSE audit draft',
      detail: 'Draft on this device until CRM accepts the audit. Media upload remains parked.',
      payload: {
        ...draft.payload,
        accountName: 'Consignment site',
        request,
      },
    };
  }
  return {
    ...draft,
    title: 'Route visit draft',
    detail: 'Draft on this device until the CRM field visit API is approved.',
    payload: {
      ...draft.payload,
      accountName: 'Field account',
      notes: draft.payload.notes.slice(0, 1000),
    },
  };
}

function isMobileDraft(value: unknown): value is MobileDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MobileDraft>;
  return Boolean(candidate.id && candidate.kind && candidate.status && candidate.title && candidate.payload);
}

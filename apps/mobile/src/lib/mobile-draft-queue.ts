import { useSyncExternalStore } from 'react';
import type { UpdateConsignmentAuditRequest } from '@pulse/contracts/consignment';
import type { CheckInTrainingSessionRequest, CompleteTrainingSessionRequest, CreateTrainingSessionRequest } from '@pulse/contracts/training';
import { checkInTrainingSessionRecord, completeTrainingSessionRecord, createTrainingSessionRecord, updateConsignmentAudit } from '@/lib/api';

export type MobileDraftKind = 'consignment_rose_audit' | 'route_visit' | 'training_session';
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
  payload: ConsignmentRoseAuditDraftPayload | RouteVisitDraftPayload | TrainingSessionDraftPayload;
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
  sessionId?: string;
  checkedInAt: string;
  checkedOutAt: string;
  notes: string;
  latitude?: number;
  longitude?: number;
  createRequest?: CreateTrainingSessionRequest;
  checkInRequest?: CheckInTrainingSessionRequest;
  completeRequest?: CompleteTrainingSessionRequest;
};

export type TrainingSessionDraftPayload = {
  kind: 'training_session';
  sessionId: string;
  accountId: string;
  accountName: string;
  sessionTitle: string;
  checkedInAt?: string;
  notes: string;
  attendeeCount: number;
  proofNotes?: string;
  completeRequest: CompleteTrainingSessionRequest;
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
    cachedDrafts = parsed.filter(isMobileDraft).filter(isDraftFresh);
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

export function clearDraft(draftId: string) {
  saveDrafts(loadDrafts().filter((draft) => draft.id !== draftId));
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
  const draft = loadDrafts().find((item) => item.id === draftId);
  if (!draft) return null;

  updateDraft(draftId, {
    status: 'syncing',
    lastAttemptAt: new Date().toISOString(),
  });

  try {
    if (draft.payload.kind === 'consignment_rose_audit') {
      await updateConsignmentAudit(apiBaseUrl, accessToken, draft.payload.auditId, draft.payload.request);
    } else if (draft.payload.kind === 'route_visit' && draft.payload.completeRequest) {
      let sessionId = draft.payload.sessionId;
      if (!sessionId) {
        if (!draft.payload.createRequest || !draft.payload.checkInRequest) {
          throw new Error('This route visit was saved before CRM visit sync was available. Keep it for reference or discard it after office review.');
        }
        const created = await createTrainingSessionRecord(apiBaseUrl, accessToken, draft.payload.accountId, draft.payload.createRequest);
        sessionId = created.id;
        updateDraft(draftId, {
          payload: {
            ...draft.payload,
            sessionId,
          },
          updatedAt: new Date().toISOString(),
        });
        await checkInTrainingSessionRecord(apiBaseUrl, accessToken, sessionId, draft.payload.checkInRequest);
      }
      await completeTrainingSessionRecord(apiBaseUrl, accessToken, sessionId, draft.payload.completeRequest);
    } else if (draft.payload.kind === 'training_session') {
      await completeTrainingSessionRecord(apiBaseUrl, accessToken, draft.payload.sessionId, draft.payload.completeRequest);
    } else {
      throw new Error('This draft cannot be retried with the current mobile sync contract.');
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
  const redactedDraft = redactEvidenceFileNames(draft);
  const serialized = JSON.stringify(redactedDraft);
  const blockedKeyPattern = /"(?:base64|contentBase64|blob|file|fileUri|previewUri|localUri|uri|photo|image|attachment|document|signatureImage|imageData|storageKey)"\s*:/i;
  if (blockedKeyPattern.test(serialized)) {
    throw new Error('Media files are not stored in offline drafts yet. Save text evidence only and retry when CRM media upload is approved.');
  }
  if (serialized.length > 16_000) {
    throw new Error('This offline draft is too large. Shorten notes before saving.');
  }
  if (redactedDraft.payload.kind === 'consignment_rose_audit') {
    const request = { ...redactedDraft.payload.request };
    if (request.notes) {
      request.notes = request.notes.slice(0, 1000);
    }
    return {
      ...redactedDraft,
      title: 'ROSE audit draft',
      detail: 'Draft on this device until CRM accepts the audit. Media upload remains parked.',
      payload: {
        ...redactedDraft.payload,
        accountName: 'Consignment site',
        request,
      },
    };
  }
  if (redactedDraft.payload.kind === 'training_session') {
    const completeRequest: CompleteTrainingSessionRequest = {
      ...redactedDraft.payload.completeRequest,
      checkoutNotes: redactedDraft.payload.completeRequest.checkoutNotes.slice(0, 1000),
      proofAttachmentCount: 0,
      ...(redactedDraft.payload.completeRequest.notes ? { notes: redactedDraft.payload.completeRequest.notes.slice(0, 1000) } : {}),
      ...(redactedDraft.payload.completeRequest.proofNotes ? { proofNotes: redactedDraft.payload.completeRequest.proofNotes.slice(0, 1000) } : {}),
    };
    return {
      ...redactedDraft,
      title: 'Training session draft',
      detail: 'Draft on this device until CRM accepts the training completion.',
      payload: {
        ...redactedDraft.payload,
        accountName: 'Training account',
        notes: redactedDraft.payload.notes.slice(0, 1000),
        ...(redactedDraft.payload.proofNotes ? { proofNotes: redactedDraft.payload.proofNotes.slice(0, 1000) } : {}),
        completeRequest,
      },
    };
  }
  return {
    ...redactedDraft,
    title: 'Route visit draft',
    detail: 'Draft on this device until CRM accepts the route visit.',
    payload: {
      ...redactedDraft.payload,
      accountName: 'Field account',
      notes: redactedDraft.payload.notes.slice(0, 1000),
    },
  };
}

function redactEvidenceFileNames(draft: MobileDraft): MobileDraft {
  if (draft.payload.kind !== 'consignment_rose_audit' || !draft.payload.evidence) return draft;
  return {
    ...draft,
    payload: {
      ...draft.payload,
      evidence: {
        ...draft.payload.evidence,
        items: draft.payload.evidence.items.map((item, index) => ({
          ...item,
          fileName: `rose-evidence-${index + 1}.${extensionFromMimeType(item.mimeType)}`,
        })),
      },
    },
  };
}

function extensionFromMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function isDraftFresh(draft: MobileDraft) {
  const ageMs = Date.now() - new Date(draft.createdAt).getTime();
  const maxAgeMs = draft.payload.kind === 'route_visit' || draft.payload.kind === 'training_session' ? 72 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return Number.isFinite(ageMs) && ageMs <= maxAgeMs;
}

function isMobileDraft(value: unknown): value is MobileDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MobileDraft>;
  return Boolean(candidate.id && candidate.kind && candidate.status && candidate.title && candidate.payload);
}

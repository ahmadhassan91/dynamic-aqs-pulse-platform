import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { UpdateConsignmentAuditRequest } from '@pulse/contracts/consignment';
import type { CheckInTrainingSessionRequest, CompleteTrainingSessionRequest, CreateTrainingSessionRequest } from '@pulse/contracts/training';
import { PulseApiError, checkInTrainingSessionRecord, completeTrainingSessionRecord, createTrainingSessionRecord, updateConsignmentAudit } from '@/lib/api';
import { refreshRouteVisitCreateRequestForRetry } from '@/lib/mobile-draft-route-policy';
import { getMobileDraftReviewState, isMobileDraftReviewRetryable, type MobileDraftReviewCategory, type MobileDraftReviewState } from '@/lib/mobile-draft-review-policy';

export type MobileDraftKind = 'consignment_rose_audit' | 'route_visit' | 'training_session';
export type MobileDraftStatus = 'pending' | 'syncing' | 'failed' | 'conflict' | 'synced';

export type MobileDraftErrorKind = 'storage' | 'network' | 'server' | 'conflict' | 'validation' | 'auth' | 'unknown';

export type MobileDraftErrorMetadata = {
  kind: MobileDraftErrorKind;
  message: string;
  occurredAt: string;
  statusCode?: number;
  retryable: boolean;
};

export type MobileDraftQueueSummary = {
  total: number;
  pending: number;
  syncing: number;
  failed: number;
  conflict: number;
  synced: number;
  unsynced: number;
  retryable: number;
  readyToRetry: number;
  needsReview: number;
  signInAgain: number;
  savedOnPhone: number;
  storageAvailable: boolean;
  storageHydrated: boolean;
  storageErrorMessage?: string;
};

export { getMobileDraftReviewState, type MobileDraftReviewCategory, type MobileDraftReviewState } from '@/lib/mobile-draft-review-policy';

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
  error?: MobileDraftErrorMetadata;
  retryCount?: number;
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
    mediaUploadStatus: 'parked_until_backend_endpoint' | 'crm_upload_available_metadata_only_when_offline';
  };
  attestation?: RoseAttestationMetadata;
};

export type RouteVisitDraftPayload = {
  kind: 'route_visit';
  localVisitId?: string;
  stage?: 'checked_in' | 'completed';
  accountId: string;
  accountName: string;
  sessionId?: string | undefined;
  checkedInAt: string;
  checkedOutAt?: string;
  notes: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
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
let memoryDrafts: MobileDraft[] = [];
let storageAvailable = true;
let storageHydrated = Platform.OS === 'web';
let storageErrorMessage: string | undefined;

export function useMobileDraftQueue() {
  return useSyncExternalStore(subscribeDrafts, loadDrafts, loadDrafts);
}

export function loadDrafts(): MobileDraft[] {
  const value = readStoredDrafts();
  if (value === undefined) {
    cachedDrafts = memoryDrafts;
    return cachedDrafts;
  }
  if (value === cachedRawDrafts) return cachedDrafts;
  if (!value) {
    cachedRawDrafts = value;
    cachedDrafts = [];
    memoryDrafts = cachedDrafts;
    return cachedDrafts;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      cachedRawDrafts = value;
      cachedDrafts = [];
      memoryDrafts = cachedDrafts;
      return cachedDrafts;
    }
    cachedRawDrafts = value;
    cachedDrafts = parsed.map((draft) => normalizeDraft(draft, { resetSyncing: true })).filter(isMobileDraft).filter(isDraftFresh);
    memoryDrafts = cachedDrafts;
    return cachedDrafts;
  } catch {
    cachedRawDrafts = value;
    storageErrorMessage = 'Offline draft storage could not be read. Showing the last drafts kept in memory.';
    cachedDrafts = memoryDrafts;
    return cachedDrafts;
  }
}

export async function hydrateMobileDraftStorage() {
  if (Platform.OS === 'web') {
    loadDrafts();
    storageHydrated = true;
    return cachedDrafts;
  }
  try {
    const value = await SecureStore.getItemAsync(draftQueueKey);
    storageAvailable = true;
    storageHydrated = true;
    storageErrorMessage = undefined;
    applyStoredDrafts(value);
  } catch (error) {
    storageAvailable = false;
    storageHydrated = false;
    storageErrorMessage = formatStorageError(error);
    cachedDrafts = memoryDrafts;
  }
  for (const listener of listeners) listener();
  return cachedDrafts;
}

export function enqueueDraft(input: Omit<MobileDraft, 'createdAt' | 'id' | 'status' | 'updatedAt'>) {
  const sanitizedDraft = buildQueuedDraft(input);
  saveDrafts([sanitizedDraft, ...loadDrafts()].slice(0, 20));
  return sanitizedDraft;
}

export async function enqueueDraftDurably(input: Omit<MobileDraft, 'createdAt' | 'id' | 'status' | 'updatedAt'>) {
  const sanitizedDraft = buildQueuedDraft(input);
  await saveDraftsDurably([sanitizedDraft, ...loadDrafts()].slice(0, 20));
  return sanitizedDraft;
}

export async function upsertRouteVisitDraftDurably(input: Omit<MobileDraft, 'createdAt' | 'id' | 'status' | 'updatedAt'> & { payload: RouteVisitDraftPayload }) {
  const localVisitId = input.payload.localVisitId;
  if (!localVisitId) return enqueueDraftDurably(input);
  const drafts = loadDrafts();
  const existing = drafts.find((draft) => draft.payload.kind === 'route_visit' && draft.payload.localVisitId === localVisitId && draft.status !== 'synced');
  if (!existing) return enqueueDraftDurably(input);
  const now = new Date().toISOString();
  const updated = sanitizeDraft({
    ...existing,
    detail: input.detail,
    kind: input.kind,
    payload: {
      ...existing.payload,
      ...input.payload,
    },
    status: 'pending',
    title: input.title,
    updatedAt: now,
  });
  await saveDraftsDurably([updated, ...drafts.filter((draft) => draft.id !== existing.id)].slice(0, 20));
  return updated;
}

function buildQueuedDraft(input: Omit<MobileDraft, 'createdAt' | 'id' | 'status' | 'updatedAt'>) {
  const now = new Date().toISOString();
  const draft: MobileDraft = {
    ...input,
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    retryCount: 0,
  };
  return sanitizeDraft(draft);
}

export function describeDraftSaveFailure(error?: unknown) {
  if (!error) {
    return {
      detail: 'Draft saved on this device. Retry from Sync Status when CRM is reachable.',
      message: 'Draft on phone. Retry from Sync Status when CRM is reachable.',
    };
  }

  const metadata = buildDraftErrorMetadata(error);
  if (metadata.kind === 'conflict' || metadata.kind === 'validation') {
    return {
      detail: `Draft saved on this device. CRM reported a conflict/review condition: ${metadata.message}`,
      message: 'Draft on phone. CRM needs review before retrying from Sync Status.',
    };
  }
  if (metadata.statusCode === 401 || metadata.statusCode === 403) {
    return {
      detail: `Draft saved on this device. Sign in again, then retry from Sync Status. Last CRM message: ${metadata.message}`,
      message: 'Draft on phone. Sign in again, then retry from Sync Status.',
    };
  }
  if (metadata.retryable) {
    return {
      detail: `Draft saved on this device. Retry from Sync Status when CRM is reachable. Last CRM message: ${metadata.message}`,
      message: 'Draft on phone. Retry from Sync Status when CRM is reachable.',
    };
  }
  return {
    detail: `Draft saved on this device. Review in Sync Status before retrying. Last CRM message: ${metadata.message}`,
    message: 'Draft on phone. Review in Sync Status before retrying.',
  };
}

export function clearSyncedDrafts() {
  saveDrafts(loadDrafts().filter((draft) => draft.status !== 'synced'));
}

export function clearDraft(draftId: string) {
  saveDrafts(loadDrafts().filter((draft) => draft.id !== draftId));
}

export function clearRouteVisitDraft(localVisitId: string) {
  saveDrafts(loadDrafts().filter((draft) => draft.payload.kind !== 'route_visit' || draft.payload.localVisitId !== localVisitId));
}

export function getLatestCheckedInRouteVisitDraft() {
  return loadDrafts()
    .filter((draft): draft is MobileDraft & { payload: RouteVisitDraftPayload } => draft.payload.kind === 'route_visit')
    .filter((draft) => draft.status !== 'synced' && (draft.payload.stage ?? 'completed') === 'checked_in')
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null;
}

export async function retryPendingDrafts(apiBaseUrl: string, accessToken: string) {
  const drafts = loadDrafts();
  for (const draft of drafts) {
    if (!isDraftRetryable(draft)) continue;
    await retryDraft(apiBaseUrl, accessToken, draft.id);
  }
  return loadDrafts();
}

export async function retryDraft(apiBaseUrl: string, accessToken: string, draftId: string) {
  const draft = loadDrafts().find((item) => item.id === draftId);
  if (!draft) return null;
  if (draft.status === 'syncing' || draft.status === 'synced') return draft;

  const attemptAt = new Date().toISOString();
  updateDraft(draftId, {
    status: 'syncing',
    lastAttemptAt: attemptAt,
    retryCount: (draft.retryCount ?? 0) + 1,
  });

  try {
    if (draft.payload.kind === 'consignment_rose_audit') {
      await updateConsignmentAudit(apiBaseUrl, accessToken, draft.payload.auditId, draft.payload.request);
    } else if (draft.payload.kind === 'route_visit') {
      let sessionId = draft.payload.sessionId;
      if (!sessionId) {
        if (!draft.payload.createRequest || !draft.payload.checkInRequest) {
          throw new Error('This route visit was saved before CRM visit sync was available. Keep it for reference or discard it after office review.');
        }
        const createRequest = refreshRouteVisitCreateRequestForRetry(draft.payload.createRequest);
        const created = await createTrainingSessionRecord(apiBaseUrl, accessToken, draft.payload.accountId, createRequest);
        sessionId = created.id;
        updateDraft(draftId, {
          payload: {
            ...draft.payload,
            createRequest,
            sessionId,
          },
          updatedAt: new Date().toISOString(),
        });
        await checkInTrainingSessionRecord(apiBaseUrl, accessToken, sessionId, draft.payload.checkInRequest);
      }
      if (!draft.payload.completeRequest) {
        return updateDraft(draftId, {
          payload: {
            ...draft.payload,
            sessionId,
            stage: 'checked_in',
          },
          updatedAt: new Date().toISOString(),
        }).find((item) => item.id === draftId) ?? null;
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
    const metadata = buildDraftErrorMetadata(error);
    return updateDraft(draftId, {
      status: metadata.kind === 'conflict' ? 'conflict' : 'failed',
      error: metadata,
      errorMessage: formatDraftErrorMessage(metadata),
      updatedAt: new Date().toISOString(),
    }).find((item) => item.id === draftId) ?? null;
  }
}

export function summarizeMobileDraftQueue(drafts: MobileDraft[] = loadDrafts()): MobileDraftQueueSummary {
  const summary: MobileDraftQueueSummary = {
    total: drafts.length,
    pending: 0,
    syncing: 0,
    failed: 0,
    conflict: 0,
    synced: 0,
    unsynced: 0,
    retryable: 0,
    readyToRetry: 0,
    needsReview: 0,
    signInAgain: 0,
    savedOnPhone: 0,
    storageAvailable,
    storageHydrated,
    ...(storageErrorMessage ? { storageErrorMessage } : {}),
  };
  for (const draft of drafts) {
    summary[draft.status] += 1;
    if (draft.status !== 'synced') summary.unsynced += 1;
    const review = getMobileDraftReviewState(draft);
    if (review.canRetry) summary.retryable += 1;
    if (review.category === 'ready_to_retry') summary.readyToRetry += 1;
    if (review.category === 'needs_review') summary.needsReview += 1;
    if (review.category === 'sign_in_again') summary.signInAgain += 1;
    if (review.category === 'saved_on_phone') summary.savedOnPhone += 1;
  }
  return summary;
}

export function summarizeMobileDraftStatus(draft: MobileDraft) {
  return getMobileDraftReviewState(draft);
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
    const updated = normalizeDraft({ ...draft, ...patch, updatedAt: patch.updatedAt ?? new Date().toISOString() });
    if (patch.status === 'syncing') return markDraftSyncing(updated);
    if (patch.status === 'synced') return markDraftSynced(updated);
    return updated;
  });
  saveDrafts(next);
  return next;
}

function saveDrafts(drafts: MobileDraft[]) {
  saveDraftsInMemory(drafts);
  void persistDrafts().catch(() => {
    for (const listener of listeners) listener();
  });
  for (const listener of listeners) listener();
}

async function saveDraftsDurably(drafts: MobileDraft[]) {
  saveDraftsInMemory(drafts);
  await persistDrafts();
  for (const listener of listeners) listener();
}

function saveDraftsInMemory(drafts: MobileDraft[]) {
  const normalizedDrafts = drafts.map((draft) => normalizeDraft(draft));
  const serialized = JSON.stringify(normalizedDrafts);
  if (serialized.length > 100_000) {
    throw new Error('Too many offline drafts on this device. Retry or clear synced drafts before saving more.');
  }
  memoryDrafts = normalizedDrafts;
  cachedDrafts = normalizedDrafts;
  cachedRawDrafts = serialized;
}

async function persistDrafts() {
  const serialized = cachedRawDrafts ?? JSON.stringify(cachedDrafts);
  if (Platform.OS === 'web') {
    try {
      const storage = globalThis.localStorage;
      if (!storage) {
        storageAvailable = false;
        storageErrorMessage = 'Offline draft storage is not available in this runtime. Drafts are kept in memory for this session.';
      } else {
        storage.setItem(draftQueueKey, serialized);
        storageAvailable = true;
        storageHydrated = true;
        storageErrorMessage = undefined;
      }
    } catch (error) {
      storageAvailable = false;
      storageErrorMessage = formatStorageError(error);
      cachedRawDrafts = undefined;
      throw error;
    }
  } else {
    try {
      await SecureStore.setItemAsync(draftQueueKey, serialized);
      storageAvailable = true;
      storageHydrated = true;
      storageErrorMessage = undefined;
    } catch (error) {
      storageAvailable = false;
      storageErrorMessage = formatStorageError(error);
      throw error;
    }
  }
}

function readStoredDrafts() {
  if (Platform.OS !== 'web') {
    if (!storageHydrated) {
      storageErrorMessage = 'Offline draft storage is still loading. Drafts are temporarily kept in memory until the phone store is ready.';
      return undefined;
    }
    return cachedRawDrafts ?? null;
  }
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      storageAvailable = false;
      storageErrorMessage = 'Offline draft storage is not available in this runtime. Drafts are kept in memory for this session.';
      return undefined;
    }
    const value = storage.getItem(draftQueueKey);
    storageAvailable = true;
    storageErrorMessage = undefined;
    return value;
  } catch (error) {
    storageAvailable = false;
    storageErrorMessage = formatStorageError(error);
    return undefined;
  }
}

function applyStoredDrafts(value: string | null) {
  if (!value) {
    cachedRawDrafts = value;
    cachedDrafts = [];
    memoryDrafts = cachedDrafts;
    return;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    cachedRawDrafts = value;
    cachedDrafts = Array.isArray(parsed)
      ? parsed.map((draft) => normalizeDraft(draft, { resetSyncing: true })).filter(isMobileDraft).filter(isDraftFresh)
      : [];
    memoryDrafts = cachedDrafts;
  } catch {
    storageErrorMessage = 'Offline draft storage could not be read. Showing the last drafts kept in memory.';
    cachedRawDrafts = undefined;
    cachedDrafts = memoryDrafts;
  }
}

function markDraftSyncing(draft: MobileDraft): MobileDraft {
  const { error, errorMessage, ...cleanDraft } = draft;
  return {
    ...cleanDraft,
    status: 'syncing',
  };
}

function markDraftSynced(draft: MobileDraft): MobileDraft {
  const { error, errorMessage, ...cleanDraft } = draft;
  return {
    ...cleanDraft,
    status: 'synced',
  };
}

function normalizeDraft(value: unknown, options: { resetSyncing?: boolean } = {}): MobileDraft {
  if (!value || typeof value !== 'object') return value as MobileDraft;
  const draft = value as MobileDraft;
  const status = isMobileDraftStatus(draft.status) ? draft.status : 'pending';
  return {
    ...draft,
    status: options.resetSyncing && status === 'syncing' ? 'pending' : status,
    retryCount: typeof draft.retryCount === 'number' && Number.isFinite(draft.retryCount) ? draft.retryCount : 0,
    ...(draft.error ? { error: draft.error } : draft.errorMessage ? { error: buildDraftErrorMetadata(draft.errorMessage) } : {}),
  };
}

function isMobileDraftStatus(value: unknown): value is MobileDraftStatus {
  return value === 'pending' || value === 'syncing' || value === 'failed' || value === 'conflict' || value === 'synced';
}

function isDraftRetryable(draft: MobileDraft) {
  return isMobileDraftReviewRetryable(draft);
}

function buildDraftErrorMetadata(error: unknown): MobileDraftErrorMetadata {
  const occurredAt = new Date().toISOString();
  if (error instanceof PulseApiError) {
    const kind = classifyHttpError(error.status);
    return {
      kind,
      message: error.message || defaultErrorMessage(kind),
      occurredAt,
      statusCode: error.status,
      retryable: kind === 'network' || kind === 'server',
    };
  }
  if (typeof error === 'string') {
    return {
      kind: 'unknown',
      message: error,
      occurredAt,
      retryable: true,
    };
  }
  if (error instanceof TypeError) {
    return {
      kind: 'network',
      message: error.message || 'Network connection failed while syncing this draft.',
      occurredAt,
      retryable: true,
    };
  }
  if (error instanceof Error) {
    return {
      kind: 'validation',
      message: error.message || 'Draft sync failed.',
      occurredAt,
      retryable: false,
    };
  }
  return {
    kind: 'unknown',
    message: 'Draft sync failed.',
    occurredAt,
    retryable: true,
  };
}

function classifyHttpError(statusCode: number): MobileDraftErrorKind {
  if (statusCode === 401 || statusCode === 403) return 'auth';
  if (statusCode === 409 || statusCode === 412 || statusCode === 423) return 'conflict';
  if (statusCode === 400 || statusCode === 404 || statusCode === 422) return 'validation';
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) return 'server';
  return 'unknown';
}

function defaultErrorMessage(kind: MobileDraftErrorKind) {
  if (kind === 'auth') return 'CRM needs a fresh sign-in before this update can retry.';
  if (kind === 'conflict') return 'CRM reported a conflict. Review this draft before retrying.';
  if (kind === 'server') return 'CRM is not ready to accept this draft. Retry when the connection is stable.';
  if (kind === 'network') return 'Network connection failed while syncing this draft.';
  return 'Draft sync failed.';
}

function formatDraftErrorMessage(metadata: MobileDraftErrorMetadata) {
  if (metadata.kind === 'auth') return `Sign in again. Draft kept on this device. ${metadata.message}`;
  if (metadata.kind === 'conflict') return `Conflict/review needed. Draft kept on this device. ${metadata.message}`;
  if (metadata.kind === 'validation') return `Review needed. Draft kept on this device. ${metadata.message}`;
  if (metadata.retryable) return `Retry needed. Draft kept on this device. ${metadata.message}`;
  return `Draft kept on this device. ${metadata.message}`;
}

function formatStorageError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown storage error';
  return `Offline draft storage failed: ${message}`;
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
      detail: redactedDraft.detail || 'Draft on this device until CRM accepts the audit. Photo bytes are not stored offline.',
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
      detail: redactedDraft.detail || 'Draft on this device until CRM accepts the training completion.',
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
    detail: redactedDraft.detail || ((redactedDraft.payload.stage ?? 'completed') === 'checked_in' ? 'Checked-in visit saved on this device. Complete the visit or retry CRM check-in from Sync Status.' : 'Draft on this device until CRM accepts the route visit.'),
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

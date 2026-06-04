import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import type { CompleteTrainingSessionRequest, TrainingSessionSummary } from '@pulse/contracts/training';
import { checkInTrainingSessionRecord, completeTrainingSessionRecord, fetchTrainingSessions, uploadTrainingSessionProofRecord } from '@/lib/api';
import { extensionFromMimeType, mimeTypeFromFileName, uriToBase64 } from '@/lib/media';
import { describeDraftSaveFailure, enqueueDraftDurably } from '@/lib/mobile-draft-queue';
import {
  buildProofUploadStatusFromError,
  buildTrainingCompleteRequest,
  getTrainingCompletionBlocker,
  isMobileActionableTrainingSession,
  isTrainingSessionCompleteForPolicy,
  type MobileTrainingProofStatus,
} from '@/lib/training-mobile-policy';
import { useSession } from '@/providers/session-provider';

export type TrainingSaveState = 'idle' | 'checking_in' | 'uploading_proof' | 'completing';

export const maxMobileProofFiles = 3;
export const maxMobileProofFileBytes = 4_000_000;

export function useTrainingExecution() {
  const { apiBaseUrl, auth } = useSession();
  const [sessions, setSessions] = useState<TrainingSessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDescription, setFollowUpDescription] = useState('');
  const [saveState, setSaveState] = useState<TrainingSaveState>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [proofStatus, setProofStatus] = useState<MobileTrainingProofStatus | null>(null);

  const selectedSession = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null;
  const selectedProofCount = selectedSession?.proofAttachmentCount ?? 0;

  const metrics = useMemo(() => {
    return {
      checkedIn: sessions.filter((session) => Boolean(session.checkedInAt) && !session.completedAt).length,
      overdue: sessions.filter((session) => session.isOverdue).length,
      scheduled: sessions.filter((session) => !session.completedAt).length,
    };
  }, [sessions]);

  const loadSessions = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchTrainingSessions(apiBaseUrl, auth.tokens.accessToken, {
        includeVisits: false,
        limit: 30,
        status: 'all',
      });
      const trainingItems = response.items
        .filter(isMobileActionableTrainingSession)
        .sort(compareTrainingSessions);
      setSessions(trainingItems);
      setSelectedId((current) => current && trainingItems.some((session) => session.id === current) ? current : trainingItems[0]?.id ?? null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load training sessions.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSession) return;
    setAttendeeCount(String(Math.max(1, selectedSession.attendeeCount || 1)));
    setNotes(selectedSession.checkoutNotes ?? selectedSession.notes ?? '');
    setProofNotes(selectedSession.proofNotes ?? '');
    setFollowUpEnabled(false);
    setFollowUpTitle('');
    setFollowUpDescription('');
    setSyncMessage(null);
    setProofStatus(null);
  }, [selectedSession?.id]);

  const replaceSession = useCallback((next: TrainingSessionSummary) => {
    setSessions((items) => {
      const updated = items.map((item) => item.id === next.id ? next : item).filter((item) => !isTrainingSessionCompleted(item));
      setSelectedId(isTrainingSessionCompleted(next) ? updated[0]?.id ?? null : next.id);
      return updated;
    });
  }, []);

  const checkIn = useCallback(async () => {
    if (!auth || !selectedSession || isTrainingSessionCompleted(selectedSession)) return;
    const checkedInAt = selectedSession.checkedInAt ?? new Date().toISOString();
    setSaveState('checking_in');
    setSyncMessage(null);
    try {
      const updated = await checkInTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, selectedSession.id, {
        checkedInAt,
        notes: 'Mobile training check-in.',
      });
      replaceSession(updated);
      setSyncMessage('CRM checked in');
      if (Platform.OS === 'ios') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to check in to CRM.');
    } finally {
      setSaveState('idle');
    }
  }, [apiBaseUrl, auth, replaceSession, selectedSession]);

  const pickProofImage = useCallback(async (useCamera: boolean) => {
    if (!auth || !selectedSession || isTrainingSessionCompleted(selectedSession) || saveState !== 'idle') return;
    if (selectedProofCount >= maxMobileProofFiles) {
      setProofStatus({ tone: 'error', message: `Mobile proof is capped at ${maxMobileProofFiles} files for this session.` });
      return;
    }

    setSaveState('uploading_proof');
    setErrorMessage(null);
    setSyncMessage(null);
    setProofStatus(null);
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Camera access is required to capture training proof.');
        }
      }

      const picked = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.78, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.78, base64: true });

      if (picked.canceled || !picked.assets[0]) {
        setSaveState('idle');
        return;
      }

      const asset = picked.assets[0];
      const mimeType = asset.mimeType ?? mimeTypeFromFileName(asset.fileName ?? '');
      if (!mimeType.startsWith('image/')) {
        throw new Error('Training proof upload currently accepts photos only.');
      }
      if (asset.fileSize && asset.fileSize > maxMobileProofFileBytes) {
        throw new Error('Training proof photo is too large. Choose an image under 4 MB.');
      }

      const contentBase64 = asset.base64 ?? await uriToBase64(asset.uri);
      if (estimatedBase64Bytes(contentBase64) > maxMobileProofFileBytes) {
        throw new Error('Training proof photo is too large. Choose an image under 4 MB.');
      }

      const fileName = asset.fileName ?? `training-proof-${Date.now()}.${extensionFromMimeType(mimeType)}`;
      const response = await uploadTrainingSessionProofRecord(apiBaseUrl, auth.tokens.accessToken, selectedSession.id, {
        documentType: 'photo',
        fileName,
        mimeType,
        contentBase64,
      });
      replaceSession(response.session);
      setProofStatus({ tone: 'success', message: `${response.document.fileName} uploaded for review.` });
      if (Platform.OS === 'ios') await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setProofStatus(buildProofUploadStatusFromError(error));
    } finally {
      setSaveState('idle');
    }
  }, [apiBaseUrl, auth, replaceSession, saveState, selectedProofCount, selectedSession]);

  const complete = useCallback(async () => {
    if (!selectedSession || !auth || saveState !== 'idle') return;
    const blocker = getTrainingCompletionBlocker(selectedSession, Boolean(auth), {
      attendeeCount: attendeeCountValue(attendeeCount),
      followUpDescription,
      followUpEnabled,
      followUpTitle,
      notes,
      proofNotes,
      proofUploadFailed: proofStatus?.tone === 'error',
      saveInProgress: false,
    });
    if (blocker) {
      setErrorMessage(blocker);
      return;
    }
    const completedAt = new Date().toISOString();
    const checkedInAt = selectedSession.checkedInAt ?? completedAt;
    const request = buildTrainingCompleteRequest(selectedSession, {
      attendeeCount: attendeeCountValue(attendeeCount),
      checkedInAt,
      completedAt,
      followUpEnabled,
      followUpDescription: followUpDescription.trim(),
      followUpTitle: followUpTitle.trim(),
      notes: notes.trim(),
      proofAttachmentCount: selectedProofCount,
      proofNotes: proofNotes.trim(),
      proofUploadFailed: proofStatus?.tone === 'error',
    });

    setSaveState('completing');
    setSyncMessage(null);
    try {
      const updated = await completeTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, selectedSession.id, request);
      replaceSession(updated);
      setSyncMessage('CRM saved');
      if (Platform.OS === 'ios') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      try {
        await enqueueTrainingDraft(selectedSession, checkedInAt, request, error);
        setSyncMessage(describeDraftSaveFailure(error).message);
      } catch (draftError) {
        setErrorMessage(draftError instanceof Error ? `Training not saved yet: ${draftError.message}` : 'Training not saved yet. Your entries are still on screen; shorten notes and try again.');
      }
    } finally {
      setSaveState('idle');
    }
  }, [apiBaseUrl, attendeeCount, auth, followUpDescription, followUpEnabled, followUpTitle, notes, proofNotes, proofStatus?.tone, replaceSession, saveState, selectedProofCount, selectedSession]);

  const clearFollowUp = useCallback(() => {
    setFollowUpEnabled(false);
    setFollowUpTitle('');
    setFollowUpDescription('');
  }, []);

  const completionBlocker = useMemo(() => {
    return getTrainingCompletionBlocker(selectedSession, Boolean(auth), {
      attendeeCount: attendeeCountValue(attendeeCount),
      followUpDescription,
      followUpEnabled,
      followUpTitle,
      notes,
      proofNotes,
      proofUploadFailed: proofStatus?.tone === 'error',
      saveInProgress: saveState !== 'idle',
    });
  }, [attendeeCount, auth, followUpDescription, followUpEnabled, followUpTitle, notes, proofNotes, proofStatus?.tone, saveState, selectedSession]);

  return {
    attendeeCount,
    canComplete: !completionBlocker,
    checkIn,
    clearFollowUp,
    complete,
    completionBlocker,
    errorMessage,
    followUpDescription,
    followUpEnabled,
    followUpTitle,
    isLoading,
    loadSessions,
    metrics,
    notes,
    pickProofImage,
    proofStatus,
    proofNotes,
    saveState,
    selectedProofCount,
    selectedSession,
    selectSession: setSelectedId,
    sessions,
    setAttendeeCount,
    setFollowUpDescription,
    setFollowUpEnabled,
    setFollowUpTitle,
    setNotes,
    setProofNotes,
    syncMessage,
  };
}

async function enqueueTrainingDraft(session: TrainingSessionSummary, checkedInAt: string, completeRequest: CompleteTrainingSessionRequest, error?: unknown) {
  const failureCopy = describeDraftSaveFailure(error);
  await enqueueDraftDurably({
    kind: 'training_session',
    title: `Training: ${session.title}`,
    detail: failureCopy.detail,
    payload: {
      kind: 'training_session',
      accountId: session.accountId,
      accountName: session.accountName ?? 'Training account',
      attendeeCount: completeRequest.attendeeCount ?? 0,
      checkedInAt,
      completeRequest,
      notes: completeRequest.notes ?? completeRequest.checkoutNotes,
      sessionId: session.id,
      sessionTitle: session.title,
      ...(completeRequest.proofNotes ? { proofNotes: completeRequest.proofNotes } : {}),
    },
  });
}

function attendeeCountValue(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function estimatedBase64Bytes(value: string) {
  const normalized = value.trim().replace(/\s+/g, '');
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function compareTrainingSessions(left: TrainingSessionSummary, right: TrainingSessionSummary) {
  if (left.completedAt && !right.completedAt) return 1;
  if (!left.completedAt && right.completedAt) return -1;
  const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime;
}

export function isTrainingSessionCompleted(session: TrainingSessionSummary) {
  return isTrainingSessionCompleteForPolicy(session);
}

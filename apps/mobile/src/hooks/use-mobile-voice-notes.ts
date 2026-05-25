import { useCallback, useEffect, useMemo, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import type { LeadSummary, LeadWorkflowQueueItem } from '@pulse/contracts/leads';
import type { MobileVoiceNoteSummary } from '@pulse/contracts/mobile-voice-notes';
import type { TrainingSessionSummary } from '@pulse/contracts/training';
import { createMobileVoiceNote, fetchMobileVoiceNotes, fetchTrainingSessions } from '@/lib/api';
import { uriToBase64 } from '@/lib/media';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useMobileDraftQueue, type MobileDraft, type RouteVisitDraftPayload } from '@/lib/mobile-draft-queue';
import { audioFileNameFromUri, audioMimeTypeFromUri, buildVoiceNoteCreateRequest, getVoiceNoteSubmitBlocker, type VoiceNoteContextSelection } from '@/lib/voice-note-policy';
import { useSession } from '@/providers/session-provider';

export type VoiceNoteContextOption = VoiceNoteContextSelection & {
  key: string;
  label: string;
  detail?: string;
};

const generalContextOption: VoiceNoteContextOption = {
  key: 'general',
  label: 'General',
  type: 'general',
};

export function useMobileVoiceNoteContexts(limit = 12) {
  const { accounts, consignmentSites, errorMessage: fieldError, isLoading: isLoadingFieldData, leads, reload, workflowQueueItems } = useFieldData(limit);
  const { apiBaseUrl, auth } = useSession();
  const drafts = useMobileDraftQueue();
  const [trainingSessions, setTrainingSessions] = useState<TrainingSessionSummary[]>([]);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [isLoadingTraining, setIsLoadingTraining] = useState(false);

  const loadTrainingSessions = useCallback(async () => {
    if (!auth) {
      setTrainingSessions([]);
      return;
    }
    setIsLoadingTraining(true);
    setTrainingError(null);
    try {
      const response = await fetchTrainingSessions(apiBaseUrl, auth.tokens.accessToken, {
        includeVisits: false,
        limit,
        status: 'all',
      });
      setTrainingSessions(response.items
        .filter((session) => session.activityKind === 'training')
        .filter((session) => !['cancelled', 'no_show'].includes(session.status)));
    } catch (error) {
      setTrainingError(error instanceof Error ? error.message : 'Unable to load training sessions for voice notes.');
    } finally {
      setIsLoadingTraining(false);
    }
  }, [apiBaseUrl, auth, limit]);

  useEffect(() => {
    void loadTrainingSessions();
  }, [loadTrainingSessions]);

  const contextOptions = useMemo(() => {
    return [
      generalContextOption,
      ...leadContextOptions(leads, workflowQueueItems).slice(0, 6),
      ...accountContextOptions(accounts).slice(0, 8),
      ...trainingContextOptions(trainingSessions).slice(0, 5),
      ...consignmentContextOptions(consignmentSites).slice(0, 5),
      ...routeVisitContextOptions(drafts).slice(0, 3),
    ];
  }, [accounts, consignmentSites, drafts, leads, trainingSessions, workflowQueueItems]);

  const refresh = useCallback(() => {
    void reload();
    void loadTrainingSessions();
  }, [loadTrainingSessions, reload]);

  return {
    contextOptions,
    errorMessage: fieldError ?? trainingError,
    isLoading: isLoadingFieldData || isLoadingTraining,
    refresh,
  };
}

export function useMobileVoiceNotes() {
  const { apiBaseUrl, auth } = useSession();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState<MobileVoiceNoteSummary[]>([]);
  const [savedNote, setSavedNote] = useState<MobileVoiceNoteSummary | null>(null);

  const durationSeconds = useMemo(
    () => Math.max(0, Math.round((recorderState.durationMillis ?? 0) / 1000)),
    [recorderState.durationMillis],
  );

  const loadNotes = useCallback(async () => {
    if (!auth) return;
    setIsLoadingNotes(true);
    setErrorMessage(null);
    try {
      const response = await fetchMobileVoiceNotes(apiBaseUrl, auth.tokens.accessToken, { limit: 20 });
      setNotes(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load voice notes.');
    } finally {
      setIsLoadingNotes(false);
    }
  }, [apiBaseUrl, auth]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setSavedNote(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setErrorMessage('Microphone permission is required to record a voice note.');
      return;
    }
    setAudioUri(null);
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    setErrorMessage(null);
    await recorder.stop();
    const uri = recorder.uri ?? recorder.getStatus().url;
    if (!uri) {
      setErrorMessage('Recording stopped, but the audio file was not available.');
      return;
    }
    setAudioUri(uri);
  }, [recorder]);

  const clearRecording = useCallback(() => {
    setAudioUri(null);
    setSavedNote(null);
    setErrorMessage(null);
  }, []);

  const submitVoiceNote = useCallback(async (input: {
    context?: VoiceNoteContextSelection;
    title?: string;
    transcriptText?: string;
    selectedAccountId?: string | null;
  }) => {
    if (!auth) {
      setErrorMessage('Sign in before syncing voice notes.');
      return null;
    }
    const draftInput = {
      audioUri,
      ...(input.context !== undefined ? { context: input.context } : {}),
      ...(input.transcriptText !== undefined ? { transcriptText: input.transcriptText } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.selectedAccountId !== undefined ? { selectedAccountId: input.selectedAccountId } : {}),
    };
    const blocker = getVoiceNoteSubmitBlocker(draftInput);
    if (blocker) {
      setErrorMessage(blocker);
      return null;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const audioDurationSeconds = durationSeconds || undefined;
      const audio = audioUri ? {
        contentBase64: await uriToBase64(audioUri),
        fileName: audioFileNameFromUri(audioUri),
        mimeType: audioMimeTypeFromUri(audioUri),
        ...(audioDurationSeconds ? { durationSeconds: audioDurationSeconds } : {}),
      } : undefined;
      const request = buildVoiceNoteCreateRequest({
        ...(input.context ? { context: input.context } : {}),
        recordedAt: new Date().toISOString(),
        ...(input.selectedAccountId ? { accountId: input.selectedAccountId } : {}),
        ...(audio ? { audio } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.transcriptText !== undefined ? { transcriptText: input.transcriptText } : {}),
      });
      const saved = await createMobileVoiceNote(apiBaseUrl, auth.tokens.accessToken, request);
      setSavedNote(saved);
      setAudioUri(null);
      setNotes((current) => [saved, ...current.filter((note) => note.id !== saved.id)].slice(0, 20));
      return saved;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not sync voice note to CRM.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [apiBaseUrl, audioUri, auth, durationSeconds]);

  return {
    audioUri,
    clearRecording,
    durationSeconds,
    errorMessage,
    isLoadingNotes,
    isRecording: recorderState.isRecording,
    isSubmitting,
    loadNotes,
    notes,
    savedNote,
    startRecording,
    stopRecording,
    submitVoiceNote,
  };
}

function leadContextOptions(leads: LeadSummary[], workflowQueueItems: LeadWorkflowQueueItem[]): VoiceNoteContextOption[] {
  const options: VoiceNoteContextOption[] = [];
  const seen = new Set<string>();
  for (const lead of leads) {
    seen.add(lead.id);
    options.push({
      id: lead.id,
      key: `lead:${lead.id}`,
      label: `Lead: ${shortContextLabel(lead.companyName)}`,
      ...contextDetail(lead.contactDisplayName || lead.leadSourceName),
      type: 'lead',
    });
  }
  for (const item of workflowQueueItems) {
    if (seen.has(item.leadId)) continue;
    seen.add(item.leadId);
    options.push({
      id: item.leadId,
      key: `lead:${item.leadId}`,
      label: `Lead: ${shortContextLabel(item.companyName)}`,
      ...contextDetail(item.contactDisplayName || item.nextAction),
      type: 'lead',
    });
  }
  return options;
}

function accountContextOptions(accounts: AccountSummary[]): VoiceNoteContextOption[] {
  return accounts.map((account) => ({
    id: account.id,
    key: `account:${account.id}`,
    label: `Account: ${shortContextLabel(account.displayName)}`,
    ...contextDetail(account.territoryName ?? account.regionName),
    type: 'account',
  }));
}

function trainingContextOptions(sessions: TrainingSessionSummary[]): VoiceNoteContextOption[] {
  return sessions.map((session) => ({
    id: session.id,
    key: `training_session:${session.id}`,
    label: `Training: ${shortContextLabel(session.title)}`,
    ...contextDetail(session.accountName),
    type: 'training_session',
  }));
}

function consignmentContextOptions(sites: ConsignmentSiteSummary[]): VoiceNoteContextOption[] {
  return sites.map((site) => ({
    id: site.id,
    key: `consignment_site:${site.id}`,
    label: `Consignment: ${shortContextLabel(site.accountName)}`,
    ...contextDetail(site.name),
    type: 'consignment_site',
  }));
}

function routeVisitContextOptions(drafts: MobileDraft[]): VoiceNoteContextOption[] {
  return [...drafts]
    .filter(isRouteVisitDraft)
    .filter((draft) => draft.status !== 'synced')
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .map((draft) => {
      const localVisitId = draft.payload.localVisitId ?? draft.id;
      return {
        id: localVisitId,
        key: `route_visit:${localVisitId}`,
        label: `Route: ${shortContextLabel(draft.payload.accountName)}`,
        ...contextDetail(draft.payload.stage === 'checked_in' ? 'Checked in' : 'Saved visit'),
        type: 'route_visit',
      };
    });
}

function isRouteVisitDraft(draft: MobileDraft): draft is MobileDraft & { payload: RouteVisitDraftPayload } {
  return draft.payload.kind === 'route_visit';
}

function contextDetail(detail: string | undefined) {
  const normalized = detail?.trim();
  return normalized ? { detail: normalized } : {};
}

function shortContextLabel(value: string, maxLength = 24) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

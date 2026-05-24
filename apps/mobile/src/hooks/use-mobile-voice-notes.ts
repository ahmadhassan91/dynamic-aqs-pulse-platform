import { useCallback, useMemo, useState } from 'react';
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import type { MobileVoiceNoteSummary } from '@pulse/contracts/mobile-voice-notes';
import { createMobileVoiceNote, fetchMobileVoiceNotes } from '@/lib/api';
import { uriToBase64 } from '@/lib/media';
import { audioFileNameFromUri, audioMimeTypeFromUri, buildVoiceNoteCreateRequest, getVoiceNoteSubmitBlocker } from '@/lib/voice-note-policy';
import { useSession } from '@/providers/session-provider';

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

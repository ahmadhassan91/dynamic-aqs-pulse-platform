import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MobileVoiceNoteSummary } from '@pulse/contracts/mobile-voice-notes';
import {
  Card,
  EmptyState,
  ErrorState,
  Field,
  HeroCard,
  LoadingState,
  NativeIcon,
  Pill,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '@/components/native-kit';
import { useMobileVoiceNoteContexts, useMobileVoiceNotes, type VoiceNoteContextOption } from '@/hooks/use-mobile-voice-notes';
import { describeVoiceNoteReview, parseVoiceNotePresetContext } from '@/lib/voice-note-policy';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

const fallbackContextOption: VoiceNoteContextOption = {
  key: 'general',
  label: 'General',
  type: 'general',
};

export default function VoiceNotesScreen() {
  const { palette: colors } = useTheme();
  // FR-MOB-059: when opened from a lead (deep link), pre-scope the capture to that lead.
  const params = useLocalSearchParams<{ presetContextType?: string; presetContextId?: string; presetContextLabel?: string }>();
  const presetContext = useMemo(
    () => parseVoiceNotePresetContext({
      presetContextType: params.presetContextType,
      presetContextId: params.presetContextId,
      presetContextLabel: params.presetContextLabel,
    }),
    [params.presetContextType, params.presetContextId, params.presetContextLabel],
  );
  const { contextOptions, errorMessage: contextError, isLoading: isLoadingContexts } = useMobileVoiceNoteContexts(12);
  const [selectedContextKey, setSelectedContextKey] = useState(() => presetContext?.key ?? 'general');
  const [title, setTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const voiceNotes = useMobileVoiceNotes();
  const screenError = voiceNotes.errorMessage ?? contextError;

  // Surface the deep-linked lead context even when it isn't in the hook's capped list.
  const resolvedOptions = useMemo<VoiceNoteContextOption[]>(
    () => (presetContext && !contextOptions.some((option) => option.key === presetContext.key)
      ? [presetContext, ...contextOptions]
      : contextOptions),
    [presetContext, contextOptions],
  );

  useEffect(() => {
    void voiceNotes.loadNotes();
  }, [voiceNotes.loadNotes]);

  useEffect(() => {
    if (resolvedOptions.some((option) => option.key === selectedContextKey)) return;
    setSelectedContextKey('general');
  }, [resolvedOptions, selectedContextKey]);

  const selectedContext = resolvedOptions.find((option) => option.key === selectedContextKey) ?? resolvedOptions[0] ?? fallbackContextOption;

  const submit = async () => {
    const saved = await voiceNotes.submitVoiceNote({
      context: selectedContext,
      title,
      transcriptText,
    });
    if (saved) {
      setTitle('');
      setTranscriptText('');
    }
  };

  return (
    <Screen>
      <HeroCard title="Voice Notes" eyebrow="Field capture" icon={{ name: 'mic.circle.fill', fallback: 'V' }}>
        <Text selectable style={{ ...typography.callout, color: '#DBEAFE' }}>
          Record or type one field update, attach the right context, then send it to CRM for office review.
        </Text>
      </HeroCard>

      {screenError ? <ErrorState message={screenError} /> : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              Capture note
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              Next: record or type the update for {selectedContext.detail ? `${selectedContext.label} · ${selectedContext.detail}` : selectedContext.label}.
            </Text>
          </View>
          <Pill label={voiceNotes.isRecording ? 'recording' : voiceNotes.audioUri ? 'ready' : 'idle'} tone={voiceNotes.isRecording ? 'warning' : voiceNotes.audioUri ? 'ready' : 'pending'} />
        </View>

        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
          <View
            style={{
              width: 116,
              height: 116,
              borderRadius: 58,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: voiceNotes.isRecording ? colors.dangerSoft : colors.primarySoft,
              borderWidth: 1,
              borderColor: voiceNotes.isRecording ? colors.danger : colors.primary,
            }}
          >
            <NativeIcon name={voiceNotes.isRecording ? 'stop.fill' : 'mic.fill'} fallback={voiceNotes.isRecording ? 'S' : 'M'} color={voiceNotes.isRecording ? colors.danger : colors.primary} size={34} />
          </View>
          <Text selectable style={{ ...typography.largeTitle, color: colors.text, fontVariant: ['tabular-nums'] }}>
            {formatDuration(voiceNotes.durationSeconds)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            {voiceNotes.isRecording ? (
              <PrimaryButton label="Stop" icon={{ name: 'stop.fill', fallback: 'S' }} onPress={() => void voiceNotes.stopRecording()} />
            ) : (
              <PrimaryButton label={voiceNotes.audioUri ? 'Record again' : 'Record'} icon={{ name: 'mic.fill', fallback: 'M' }} onPress={() => void voiceNotes.startRecording()} disabled={voiceNotes.isSubmitting} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <SecondaryButton label="Clear" icon={{ name: 'xmark', fallback: 'X' }} onPress={voiceNotes.clearRecording} disabled={voiceNotes.isRecording || voiceNotes.isSubmitting} />
          </View>
        </View>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          Keep the app open while sending. Background upload, push reminders, and deep links remain parked for this mobile slice.
        </Text>
      </Card>

      <SectionTitle title="CRM context" detail="Choose the record the office team should review first. Leave General only when the note is not tied to a customer or visit." />
      {isLoadingContexts ? <LoadingState label="Loading CRM contexts..." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {resolvedOptions.map((option) => (
          <ContextChip
            key={option.key}
            label={option.label}
            selected={selectedContext.key === option.key}
            onPress={() => setSelectedContextKey(option.key)}
          />
        ))}
      </View>

      <Card>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Dealer follow-up, training recap..." />
        <Field
          label="Transcript or quick note"
          value={transcriptText}
          onChangeText={setTranscriptText}
          placeholder="Type a backup note or short summary before sync."
          multiline
          textAlignVertical="top"
          style={{ minHeight: 116 }}
        />
        <PrimaryButton
          label={voiceNotes.isSubmitting ? 'Sending...' : 'Sync for office review'}
          icon={{ name: 'arrow.up.doc.fill', fallback: 'Sync' }}
          disabled={voiceNotes.isSubmitting || voiceNotes.isRecording}
          onPress={() => void submit()}
        />
      </Card>

      {voiceNotes.savedNote ? <SavedNoteCard note={voiceNotes.savedNote} /> : null}

      <SectionTitle title="Recent voice notes" detail="Use the review label to see whether the office has approved the note or needs more detail." />
      {voiceNotes.isLoadingNotes ? <LoadingState label="Loading voice notes..." /> : null}
      <View style={{ gap: spacing.md }}>
        {voiceNotes.notes.map((note) => <VoiceNoteCard key={note.id} note={note} />)}
        {!voiceNotes.notes.length && !voiceNotes.isLoadingNotes ? (
          <EmptyState title="No synced voice notes yet" detail="Record or type a note above, choose a context, then sync it for office review." />
        ) : null}
      </View>
    </Screen>
  );
}

function ContextChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <Text selectable={false} style={{ ...typography.callout, color: selected ? colors.primary : colors.text, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SavedNoteCard({ note }: { note: MobileVoiceNoteSummary }) {
  const { palette: colors } = useTheme();
  const review = describeVoiceNoteReview(note);
  return (
    <Card style={{ borderColor: colors.success, backgroundColor: '#F0FDF4' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Synced to CRM
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            {review.detail}
          </Text>
          <Text selectable style={{ ...typography.caption, color: colors.muted }}>
            {review.nextAction}
          </Text>
        </View>
        <Pill label={review.label} tone={review.tone} />
      </View>
      {note.structuredSummary ? (
        <Text selectable style={{ ...typography.body, color: colors.text }}>
          {note.structuredSummary}
        </Text>
      ) : null}
      {note.structuredNextStep ? (
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          Next: {note.structuredNextStep}
        </Text>
      ) : null}
    </Card>
  );
}

function VoiceNoteCard({ note }: { note: MobileVoiceNoteSummary }) {
  const { palette: colors } = useTheme();
  const review = describeVoiceNoteReview(note);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {note.title}
          </Text>
          <Text selectable style={{ ...typography.caption, color: colors.muted }}>
            {[voiceNoteContextLabel(note), formatDateTime(note.recordedAt)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Pill label={review.label} tone={review.tone} />
      </View>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {review.nextAction}
      </Text>
      {note.structuredSummary ? (
        <Text selectable style={{ ...typography.callout, color: colors.text }}>
          {note.structuredSummary}
        </Text>
      ) : null}
      {note.structuredTags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {note.structuredTags.slice(0, 5).map((tag) => <Pill key={tag} label={tag} tone="pending" />)}
        </View>
      ) : null}
    </Card>
  );
}

function voiceNoteContextLabel(note: MobileVoiceNoteSummary) {
  if (note.leadName) return note.leadName;
  if (note.accountName) return note.accountName;
  if (note.trainingSessionTitle) return note.trainingSessionTitle;
  if (note.consignmentSiteName) return note.consignmentSiteName;
  if (note.contextType === 'route_visit') return 'Route visit';
  return 'General';
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

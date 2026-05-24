import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
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
import { useFieldData } from '@/hooks/use-mobile-data';
import { useMobileVoiceNotes } from '@/hooks/use-mobile-voice-notes';
import { describeVoiceNoteReview } from '@/lib/voice-note-policy';
import { colors, radius, spacing, typography } from '@/theme';

export default function VoiceNotesScreen() {
  const { accounts } = useFieldData(12);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const voiceNotes = useMobileVoiceNotes();

  useEffect(() => {
    void voiceNotes.loadNotes();
  }, [voiceNotes.loadNotes]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

  const submit = async () => {
    const saved = await voiceNotes.submitVoiceNote({
      selectedAccountId,
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
          Speak or type the visit note, attach it to an account, then sync it into Pulse CRM for review.
        </Text>
      </HeroCard>

      {voiceNotes.errorMessage ? <ErrorState message={voiceNotes.errorMessage} /> : null}

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              Capture note
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {selectedAccount ? selectedAccount.displayName : 'General CRM note'}
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
      </Card>

      <SectionTitle title="CRM context" detail="Attach the note where the office team will look first." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <ContextChip label="General" selected={!selectedAccountId} onPress={() => setSelectedAccountId(null)} />
        {accounts.slice(0, 8).map((account) => (
          <ContextChip
            key={account.id}
            label={shortAccountLabel(account)}
            selected={selectedAccountId === account.id}
            onPress={() => setSelectedAccountId(account.id)}
          />
        ))}
      </View>

      <Card>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Dealer follow-up, training recap..." />
        <Field
          label="Transcript or quick note"
          value={transcriptText}
          onChangeText={setTranscriptText}
          placeholder="Type a backup note or edit the transcript before sync."
          multiline
          textAlignVertical="top"
          style={{ minHeight: 116 }}
        />
        <PrimaryButton
          label={voiceNotes.isSubmitting ? 'Syncing...' : 'Structure & sync'}
          icon={{ name: 'arrow.up.doc.fill', fallback: 'Sync' }}
          disabled={voiceNotes.isSubmitting || voiceNotes.isRecording}
          onPress={() => void submit()}
        />
      </Card>

      {voiceNotes.savedNote ? <SavedNoteCard note={voiceNotes.savedNote} /> : null}

      <SectionTitle title="Recent voice notes" detail="Notes created from this device session." />
      {voiceNotes.isLoadingNotes ? <LoadingState label="Loading voice notes..." /> : null}
      <View style={{ gap: spacing.md }}>
        {voiceNotes.notes.map((note) => <VoiceNoteCard key={note.id} note={note} />)}
        {!voiceNotes.notes.length && !voiceNotes.isLoadingNotes ? (
          <EmptyState title="No voice notes yet" detail="Captured notes will appear here after CRM sync." />
        ) : null}
      </View>
    </Screen>
  );
}

function ContextChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
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
  const review = describeVoiceNoteReview(note);
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {note.title}
          </Text>
          <Text selectable style={{ ...typography.caption, color: colors.muted }}>
            {[note.accountName, formatDateTime(note.recordedAt)].filter(Boolean).join(' · ')}
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

function shortAccountLabel(account: AccountSummary) {
  return account.displayName.length > 22 ? `${account.displayName.slice(0, 21)}...` : account.displayName;
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

import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { CompleteTrainingSessionRequest, TrainingSessionSummary } from '@pulse/contracts/training';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { checkInTrainingSessionRecord, completeTrainingSessionRecord, fetchTrainingSessions } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { enqueueDraft } from '@/lib/mobile-draft-queue';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

type SaveState = 'idle' | 'checking_in' | 'completing';

export default function TrainingExecutionScreen() {
  const { apiBaseUrl, auth } = useSession();
  const [sessions, setSessions] = useState<TrainingSessionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [attendeeCount, setAttendeeCount] = useState('1');
  const [notes, setNotes] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDescription, setFollowUpDescription] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const selectedSession = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null;

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
        .filter((session) => session.activityKind === 'training')
        .filter((session) => !['cancelled', 'no_show'].includes(session.status))
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
    setFollowUpTitle('');
    setFollowUpDescription('');
    setSyncMessage(null);
  }, [selectedSession?.id]);

  async function handleCheckIn() {
    if (!auth || !selectedSession || isSessionCompleted(selectedSession)) return;
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
  }

  async function handleComplete() {
    if (!selectedSession || !auth || !notes.trim()) return;
    const completedAt = new Date().toISOString();
    const checkedInAt = selectedSession.checkedInAt ?? completedAt;
    const request = buildCompleteRequest(selectedSession, {
      attendeeCount: attendeeCountValue(attendeeCount),
      checkedInAt,
      completedAt,
      followUpDescription: followUpDescription.trim(),
      followUpTitle: followUpTitle.trim(),
      notes: notes.trim(),
      proofNotes: proofNotes.trim(),
    });

    setSaveState('completing');
    setSyncMessage(null);
    try {
      const updated = await completeTrainingSessionRecord(apiBaseUrl, auth.tokens.accessToken, selectedSession.id, request);
      replaceSession(updated);
      setSyncMessage('CRM saved');
      if (Platform.OS === 'ios') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      enqueueTrainingDraft(selectedSession, checkedInAt, request, error);
      setSyncMessage('Draft on phone. Retry from Sync Status when CRM is reachable.');
    } finally {
      setSaveState('idle');
    }
  }

  function replaceSession(next: TrainingSessionSummary) {
    setSessions((items) => items.map((item) => item.id === next.id ? next : item));
    setSelectedId(next.id);
  }

  const canComplete = Boolean(selectedSession && auth && notes.trim() && attendeeCountValue(attendeeCount) >= 0 && saveState === 'idle' && !isSessionCompleted(selectedSession));

  return (
    <>
      <Stack.Screen options={{ title: 'Training', headerShown: true }} />
      <Screen>
        <HeroCard title="Training" eyebrow="Field execution" icon={{ name: 'graduationcap.fill', fallback: 'T' }}>
          <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
            Check in, capture attendee notes, create follow-ups, and save the completed session back to CRM.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <MiniMetric label="Open" value={String(metrics.scheduled)} />
            <MiniMetric label="Checked in" value={String(metrics.checkedIn)} />
            <MiniMetric label="Overdue" value={String(metrics.overdue)} />
          </View>
        </HeroCard>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {syncMessage ? <StatusCard message={syncMessage} tone={syncMessage.includes('Draft') ? 'warning' : 'success'} /> : null}
        {isLoading ? <LoadingState label="Loading scheduled training..." /> : null}

        <SectionTitle title="Scheduled work" detail="Only formal training sessions show here. Route visits stay separate for reporting." />
        <View style={{ gap: spacing.md }}>
          {sessions.map((session) => (
            <TrainingSessionCard
              key={session.id}
              isSelected={session.id === selectedSession?.id}
              onPress={() => setSelectedId(session.id)}
              session={session}
            />
          ))}
          {!sessions.length && !isLoading ? <EmptyState title="No training sessions loaded" detail="Refresh after CRM has scheduled training for this user or territory." /> : null}
        </View>

        {selectedSession ? (
          <>
            <SectionTitle title="Complete session" detail="Keep it short enough for a field visit, but enough for the office team to trust the record." />
            <Card style={{ gap: spacing.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                    {selectedSession.title}
                  </Text>
                  <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                    {selectedSession.accountName ?? 'Account pending'} · {formatDateTime(selectedSession.scheduledAt)}
                  </Text>
                </View>
                <Pill label={selectedSession.executionState} tone={selectedSession.executionState} />
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <FieldChip label="Type" value={selectedSession.trainingTypeName ?? selectedSession.programTitle ?? 'Training'} />
                <FieldChip label="Trainer" value={selectedSession.trainerName ?? 'Assigned user'} />
                <FieldChip label="Cert" value={selectedSession.isCertificationTrack ? humanize(selectedSession.certificationOutcome) : 'not applicable'} />
              </View>

              <PrimaryButton
                disabled={Boolean(selectedSession.checkedInAt) || isSessionCompleted(selectedSession) || saveState !== 'idle'}
                icon={{ name: 'location.fill', fallback: 'In' }}
                label={selectedSession.checkedInAt ? 'Checked in' : saveState === 'checking_in' ? 'Checking in...' : 'Check in'}
                onPress={() => void handleCheckIn()}
              />

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
                    Attendees
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={setAttendeeCount}
                    placeholder="0"
                    placeholderTextColor={colors.subtle}
                    value={attendeeCount}
                    style={inputStyle}
                  />
                </View>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
                    Proof files
                  </Text>
                  <View style={[inputStyle, { justifyContent: 'center' }]}>
                    <Text selectable style={{ ...typography.body, color: colors.subtle }}>
                      Parked
                    </Text>
                  </View>
                </View>
              </View>

              <LabeledTextArea
                label="Completion notes"
                onChangeText={setNotes}
                placeholder="Topics covered, dealer questions, attendee readiness, next action..."
                value={notes}
              />
              <LabeledTextArea
                label="Proof notes"
                onChangeText={setProofNotes}
                placeholder="Photos or certificates captured outside the app for now..."
                value={proofNotes}
              />
              <LabeledTextArea
                label="Follow-up task"
                onChangeText={setFollowUpTitle}
                placeholder="Optional task title"
                value={followUpTitle}
              />
              {followUpTitle.trim() ? (
                <LabeledTextArea
                  label="Follow-up detail"
                  onChangeText={setFollowUpDescription}
                  placeholder="What should the office or field team do next?"
                  value={followUpDescription}
                />
              ) : null}

              <PrimaryButton
                disabled={!canComplete}
                icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }}
                label={saveState === 'completing' ? 'Saving training...' : 'Complete training'}
                onPress={() => void handleComplete()}
              />
            </Card>
          </>
        ) : null}

        <SecondaryButton label="Refresh training" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void loadSessions()} />
      </Screen>
    </>
  );
}

function TrainingSessionCard({ isSelected, onPress, session }: { isSelected: boolean; onPress: () => void; session: TrainingSessionSummary }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.76 : 1,
      })}
    >
      <Card style={{ borderColor: isSelected ? colors.primary : colors.border }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: session.isOverdue ? colors.warningSoft : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <NativeIcon name="person.3.fill" fallback="T" color={session.isOverdue ? colors.warning : colors.primary} size={17} />
          </View>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              {session.title}
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {session.accountName ?? 'Account pending'} · {formatDateTime(session.scheduledAt)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              <Pill label={session.executionState} tone={session.executionState} />
              {session.openFollowUpTaskCount ? <Pill label={`${session.openFollowUpTaskCount} follow-up`} tone="pending" /> : null}
              {session.proofAttachmentCount ? <Pill label={`${session.proofAttachmentCount} proof`} tone="active" /> : null}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function LabeledTextArea({ label, onChangeText, placeholder, value }: { label: string; onChangeText: (value: string) => void; placeholder: string; value: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <TextInput
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        value={value}
        style={[inputStyle, { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

function StatusCard({ message, tone }: { message: string; tone: 'success' | 'warning' }) {
  return (
    <Card style={{ borderColor: tone === 'success' ? '#B7E4C7' : '#FACC15', backgroundColor: tone === 'success' ? '#F3FFF7' : colors.warningSoft }}>
      <Text selectable style={{ ...typography.subtitle, color: tone === 'success' ? colors.success : colors.warning }}>
        {message}
      </Text>
    </Card>
  );
}

function FieldChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderRadius: radius.full, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', padding: spacing.md, gap: 2, borderCurve: 'continuous' }}>
      <Text selectable style={{ ...typography.caption, color: '#BFDBFE', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.textInverse, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function buildCompleteRequest(session: TrainingSessionSummary, input: {
  attendeeCount: number;
  checkedInAt: string;
  completedAt: string;
  followUpDescription: string;
  followUpTitle: string;
  notes: string;
  proofNotes: string;
}): CompleteTrainingSessionRequest {
  const durationMinutes = Math.max(1, Math.round((new Date(input.completedAt).getTime() - new Date(input.checkedInAt).getTime()) / 60_000) || session.durationMinutes || 1);
  return {
    attendeeCount: input.attendeeCount,
    checkedOutAt: input.completedAt,
    completedAt: input.completedAt,
    checkoutNotes: input.notes,
    certificationOutcome: session.isCertificationTrack ? 'pending_decision' : 'not_applicable',
    completionSummary: `Mobile training completed for ${session.accountName ?? 'account'}. Proof media upload remains parked; proof notes captured as text.`,
    durationMinutes,
    notes: input.notes,
    proofAttachmentCount: 0,
    ...(input.proofNotes ? { proofNotes: input.proofNotes } : {}),
    ...(input.followUpTitle ? {
      createFollowUpTask: {
        title: input.followUpTitle,
        ...(input.followUpDescription ? { description: input.followUpDescription } : {}),
      },
    } : {}),
  };
}

function enqueueTrainingDraft(session: TrainingSessionSummary, checkedInAt: string, completeRequest: CompleteTrainingSessionRequest, error?: unknown) {
  enqueueDraft({
    kind: 'training_session',
    title: `Training: ${session.title}`,
    detail: error instanceof Error ? `CRM sync failed: ${error.message}` : 'Draft on this device until CRM accepts the training completion.',
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

function compareTrainingSessions(left: TrainingSessionSummary, right: TrainingSessionSummary) {
  if (left.completedAt && !right.completedAt) return 1;
  if (!left.completedAt && right.completedAt) return -1;
  const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
  return leftTime - rightTime;
}

function isSessionCompleted(session: TrainingSessionSummary) {
  return Boolean(session.completedAt || session.executionState === 'completed' || session.status === 'completed');
}

const inputStyle = {
  minHeight: 48,
  borderRadius: radius.lg,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.md,
  color: colors.text,
  borderCurve: 'continuous' as const,
  ...typography.body,
};

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { TrainingSessionSummary } from '@pulse/contracts/training';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { formatDateTime, humanize } from '@/lib/format';
import { isTrainingSessionCompleted, maxMobileProofFiles, useTrainingExecution } from '@/hooks/use-training-execution';
import { radius, spacing, typography } from '@/theme';
import type { Palette } from '@/theme';
import { useTheme } from '@/providers/theme-provider';

type TrainingExecutionStep = 'check_in' | 'details' | 'proof' | 'follow_up' | 'submit';

export default function TrainingExecutionScreen() {
  const { palette: colors } = useTheme();
  const inputStyle = makeInputStyle(colors);
  const training = useTrainingExecution();
  const {
    attendeeCount,
    canComplete,
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
    selectSession,
    sessions,
    setAttendeeCount,
    setFollowUpDescription,
    setFollowUpEnabled,
    setFollowUpTitle,
    setNotes,
    setProofNotes,
    syncMessage,
  } = training;
  const [currentStep, setCurrentStep] = useState<TrainingExecutionStep>('check_in');

  useEffect(() => {
    if (!selectedSession) {
      setCurrentStep('check_in');
      return;
    }
    setCurrentStep(selectedSession.checkedInAt || isTrainingSessionCompleted(selectedSession) ? 'details' : 'check_in');
  }, [selectedSession?.checkedInAt, selectedSession?.id, selectedSession?.status]);

  const attendeeTotal = Number.parseInt(attendeeCount, 10);
  const detailsReady = Number.isFinite(attendeeTotal) && attendeeTotal > 0 && notes.trim().length > 0;

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
              onPress={() => selectSession(session.id)}
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

              <TrainingStepPills currentStep={currentStep} />

              {currentStep === 'check_in' ? (
                <StepPanel title="Step 1 of 5" detail="Check in when you are with the dealer. Completion fields open after this step.">
                  <PrimaryButton
                    disabled={Boolean(selectedSession.checkedInAt) || isTrainingSessionCompleted(selectedSession) || saveState !== 'idle'}
                    icon={{ name: 'location.fill', fallback: 'In' }}
                    label={selectedSession.checkedInAt ? 'Checked in' : saveState === 'checking_in' ? 'Checking in...' : 'Check in'}
                    onPress={() => void checkIn()}
                  />
                  {selectedSession.checkedInAt ? <PrimaryButton label="Continue" icon={{ name: 'arrow.right.circle.fill', fallback: 'Go' }} onPress={() => setCurrentStep('details')} /> : null}
                </StepPanel>
              ) : null}

              {currentStep === 'details' ? (
                <StepPanel title="Step 2 of 5" detail="Record who attended and the short office-ready completion note.">
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
                        selectTextOnFocus
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
                          {selectedProofCount}/{maxMobileProofFiles}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <LabeledTextArea
                    label="Completion notes"
                    onChangeText={setNotes}
                    placeholder="Topics covered, dealer questions, attendee readiness, next action..."
                    helper="Required. Keep it simple: what happened and what the office should know."
                    value={notes}
                  />
                  <StepNav
                    back={() => setCurrentStep('check_in')}
                    next={() => setCurrentStep('proof')}
                    nextDisabled={!detailsReady}
                    nextHelp={!detailsReady ? 'Add attendee count and completion notes to continue.' : undefined}
                  />
                </StepPanel>
              ) : null}

              {currentStep === 'proof' ? (
                <StepPanel title="Step 3 of 5" detail="Add optional proof photos or explain where proof is kept. Photos upload directly to CRM when available.">
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <SecondaryButton
                          disabled={selectedProofCount >= maxMobileProofFiles || isTrainingSessionCompleted(selectedSession) || saveState !== 'idle'}
                          icon={{ name: 'camera.fill', fallback: 'C' }}
                          label={saveState === 'uploading_proof' ? 'Uploading...' : 'Camera'}
                          onPress={() => void pickProofImage(true)}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <SecondaryButton
                          disabled={selectedProofCount >= maxMobileProofFiles || isTrainingSessionCompleted(selectedSession) || saveState !== 'idle'}
                          icon={{ name: 'photo.on.rectangle.angled', fallback: 'G' }}
                          label="Gallery"
                          onPress={() => void pickProofImage(false)}
                        />
                      </View>
                    </View>
                    <Text selectable style={{ ...typography.caption, color: colors.muted }}>
                      Optional photo proof uploads directly to CRM. Limit {maxMobileProofFiles} images, 4 MB each.
                    </Text>
                    {proofStatus ? (
                      <Text selectable style={{ ...typography.caption, color: proofStatus.tone === 'success' ? colors.success : colors.warning }}>
                        {proofStatus.message}
                      </Text>
                    ) : null}
                  </View>
                  <LabeledTextArea
                    label="Proof notes"
                    onChangeText={setProofNotes}
                    placeholder="Roster names, certificate context, or what the proof photo shows..."
                    helper="Optional. Add context for uploaded proof photos or note external proof kept outside the app."
                    value={proofNotes}
                  />
                  <StepNav back={() => setCurrentStep('details')} next={() => setCurrentStep('follow_up')} />
                </StepPanel>
              ) : null}

              {currentStep === 'follow_up' ? (
                <StepPanel title="Step 4 of 5" detail="Create a follow-up only if someone needs to do something after this session.">
                  <FollowUpPanel
                    description={followUpDescription}
                    enabled={followUpEnabled}
                    onClear={clearFollowUp}
                    onDescriptionChange={setFollowUpDescription}
                    onEnable={() => setFollowUpEnabled(true)}
                    onTitleChange={setFollowUpTitle}
                    title={followUpTitle}
                  />
                  <StepNav back={() => setCurrentStep('proof')} next={() => setCurrentStep('submit')} />
                </StepPanel>
              ) : null}

              {currentStep === 'submit' ? (
                <StepPanel title="Step 5 of 5" detail="Review the save boundary, then send the completed session to CRM.">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <FieldChip label="Attendees" value={attendeeCount || '0'} />
                    <FieldChip label="Proof" value={`${selectedProofCount}/${maxMobileProofFiles}`} />
                    <FieldChip label="Follow-up" value={followUpEnabled ? 'yes' : 'no'} />
                  </View>
                  <PrimaryButton
                    disabled={!canComplete}
                    icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }}
                    label={saveState === 'completing' ? 'Saving training...' : 'Complete training'}
                    onPress={() => void complete()}
                  />
                  {completionBlocker ? (
                    <Text selectable style={{ ...typography.caption, color: colors.muted, textAlign: 'center' }}>
                      {completionBlocker}
                    </Text>
                  ) : null}
                  <SecondaryButton label="Back to follow-up" icon={{ name: 'chevron.left', fallback: 'Back' }} onPress={() => setCurrentStep('follow_up')} />
                </StepPanel>
              ) : null}
            </Card>
          </>
        ) : null}

        <SecondaryButton label="Refresh training" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void loadSessions()} />
      </Screen>
    </>
  );
}

function TrainingStepPills({ currentStep }: { currentStep: TrainingExecutionStep }) {
  const steps: Array<{ key: TrainingExecutionStep; label: string }> = [
    { key: 'check_in', label: 'Check in' },
    { key: 'details', label: 'Details' },
    { key: 'proof', label: 'Proof' },
    { key: 'follow_up', label: 'Follow-up' },
    { key: 'submit', label: 'Submit' },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {steps.map((step) => <Pill key={step.key} label={step.label} tone={step.key === currentStep ? 'active' : 'pending'} />)}
    </View>
  );
}

function StepPanel({ children, detail, title }: { children: ReactNode; detail: string; title: string }) {
  const { palette: colors } = useTheme();
  return (
    <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
      <View style={{ gap: spacing.xs }}>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
          {title}
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          {detail}
        </Text>
      </View>
      {children}
    </Card>
  );
}

function StepNav({
  back,
  next,
  nextDisabled,
  nextHelp,
}: {
  back: () => void;
  next: () => void;
  nextDisabled?: boolean | undefined;
  nextHelp?: string | undefined;
}) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Back" icon={{ name: 'chevron.left', fallback: 'Back' }} onPress={back} />
        </View>
        <View style={{ flex: 1 }}>
          <PrimaryButton disabled={Boolean(nextDisabled)} label="Continue" icon={{ name: 'arrow.right.circle.fill', fallback: 'Go' }} onPress={next} />
        </View>
      </View>
      {nextHelp ? (
        <Text selectable style={{ ...typography.caption, color: colors.muted, textAlign: 'center' }}>
          {nextHelp}
        </Text>
      ) : null}
    </View>
  );
}

function TrainingSessionCard({ isSelected, onPress, session }: { isSelected: boolean; onPress: () => void; session: TrainingSessionSummary }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={session.title}
      accessibilityState={{ selected: isSelected }}
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

function FollowUpPanel({
  description,
  enabled,
  onClear,
  onDescriptionChange,
  onEnable,
  onTitleChange,
  title,
}: {
  description: string;
  enabled: boolean;
  onClear: () => void;
  onDescriptionChange: (value: string) => void;
  onEnable: () => void;
  onTitleChange: (value: string) => void;
  title: string;
}) {
  const { palette: colors } = useTheme();
  if (!enabled) {
    return (
      <SecondaryButton
        label="Add follow-up task"
        icon={{ name: 'plus.circle.fill', fallback: '+' }}
        onPress={onEnable}
      />
    );
  }

  return (
    <View style={{ gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Follow-up task
          </Text>
          <Text selectable style={{ ...typography.caption, color: colors.muted }}>
            Optional. Add this only when someone needs to do something after the session.
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear follow-up task" onPress={onClear} style={{ paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ ...typography.caption, color: colors.primary, fontWeight: '800' }}>Clear</Text>
        </Pressable>
      </View>
      <LabeledTextArea
        label="Task title"
        onChangeText={onTitleChange}
        placeholder="Example: Send recap to dealer"
        value={title}
      />
      <LabeledTextArea
        label="Task detail"
        onChangeText={onDescriptionChange}
        placeholder="What should the office or field team do next?"
        helper={title.trim() ? 'Required when a task title is entered.' : 'Add a title first, or clear this task.'}
        value={description}
      />
    </View>
  );
}

function LabeledTextArea({
  helper,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  helper?: string;
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const { palette: colors } = useTheme();
  const inputStyle = makeInputStyle(colors);
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
      {helper ? (
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

function StatusCard({ message, tone }: { message: string; tone: 'success' | 'warning' }) {
  const { palette: colors } = useTheme();
  return (
    <Card style={{ borderColor: tone === 'success' ? '#B7E4C7' : '#FACC15', backgroundColor: tone === 'success' ? '#F3FFF7' : colors.warningSoft }}>
      <Text selectable style={{ ...typography.subtitle, color: tone === 'success' ? colors.success : colors.warning }}>
        {message}
      </Text>
    </Card>
  );
}

function FieldChip({ label, value }: { label: string; value: string }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.full, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  const { palette: colors } = useTheme();
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

function makeInputStyle(colors: Palette) {
  return {
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
}

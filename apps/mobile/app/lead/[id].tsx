import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { LeadDetail } from '@pulse/contracts/leads';
import { LEAD_STAGES } from '@pulse/contracts/leads';
import { Card, ErrorState, LoadingState, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { fetchLeadDetail, logLeadInitialContact, transitionLeadStage } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { MOBILE_ADVANCEABLE_STAGES } from '@/lib/lead-stage-policy';
import { buildCallDispositionPrompt, shouldOfferCallLog } from '@/lib/call-disposition-policy';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiBaseUrl, auth } = useSession();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // UX-M-005 — call disposition panel state
  const [showDisposition, setShowDisposition] = useState(false);
  const [dispositionNote, setDispositionNote] = useState('');
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [callLogMessage, setCallLogMessage] = useState<string | null>(null);
  const [callLogError, setCallLogError] = useState<string | null>(null);

  // UX-M-005 — stage change panel state
  const [showStageChange, setShowStageChange] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [stageNote, setStageNote] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [stageMessage, setStageMessage] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !id) return;
    setIsLoading(true);
    setErrorMessage(null);
    void fetchLeadDetail(apiBaseUrl, auth.tokens.accessToken, id)
      .then(setLead)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load lead.'))
      .finally(() => setIsLoading(false));
  }, [apiBaseUrl, auth, id]);

  async function handleLogCall() {
    if (!auth || !id) return;
    setIsLoggingCall(true);
    setCallLogError(null);
    setCallLogMessage(null);
    try {
      const updated = await logLeadInitialContact(apiBaseUrl, auth.tokens.accessToken, id, {
        ...(dispositionNote.trim() ? { note: dispositionNote.trim() } : {}),
      });
      setLead(updated);
      setCallLogMessage('Call disposition logged to CRM.');
      setDispositionNote('');
      setShowDisposition(false);
    } catch (error) {
      setCallLogError(error instanceof Error ? error.message : 'Could not log call disposition.');
    } finally {
      setIsLoggingCall(false);
    }
  }

  function handleCallPress() {
    if (!lead?.phone) return;
    void Linking.openURL(`tel:${lead.phone}`);
    // FR-MOB-060: optional per-call auto-log — only offered when the call would record a
    // not-yet-logged initial contact; the dialer opens regardless of the choice.
    if (!shouldOfferCallLog(lead)) return;
    const prompt = buildCallDispositionPrompt(lead.contactDisplayName);
    Alert.alert(prompt.title, prompt.message, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Log call placed', onPress: () => void handleLogCall() },
    ]);
  }

  async function handleStageChange() {
    if (!auth || !id || !selectedStage) return;
    setIsTransitioning(true);
    setStageError(null);
    setStageMessage(null);
    try {
      const updated = await transitionLeadStage(apiBaseUrl, auth.tokens.accessToken, id, {
        toStage: selectedStage as (typeof LEAD_STAGES)[number],
        ...(stageNote.trim() ? { note: stageNote.trim() } : {}),
      });
      setLead(updated);
      setStageMessage(`Stage updated to "${humanize(selectedStage)}".`);
      setSelectedStage(null);
      setStageNote('');
      setShowStageChange(false);
    } catch (error) {
      setStageError(error instanceof Error ? error.message : 'Could not update lead stage.');
    } finally {
      setIsTransitioning(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: lead?.companyName ?? 'Lead Detail', headerShown: true }} />
      <Screen>
        {isLoading ? <LoadingState label="Loading lead..." /> : null}
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {lead ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.sm }}>
                  <Text selectable style={{ ...typography.title, color: colors.text }}>
                    {lead.companyName}
                  </Text>
                  <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                    {lead.contactDisplayName}
                  </Text>
                </View>
                <Pill label={humanize(lead.stage)} tone={lead.stage} />
              </View>
            </Card>

            <SectionTitle title="Next action" />
            <Card>
              <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                {lead.workflowTask.nextAction}
              </Text>
              <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                {lead.workflowTask.reason}
              </Text>
              <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
                Initial contact due: {formatDateTime(lead.initialContactDueAt)}
              </Text>
            </Card>

            <SectionTitle title="Contact" />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Action label="Call" disabled={!lead.phone} onPress={handleCallPress} />
              <Action label="Email" disabled={!lead.email} onPress={() => void Linking.openURL(`mailto:${lead.email}`)} />
            </View>

            {/* UX-M-005 — Field actions */}
            <SectionTitle title="Field actions" detail="Log a call disposition or advance the lead stage after an on-site interaction." />

            {callLogMessage ? (
              <Card style={{ borderColor: colors.success, backgroundColor: colors.successSoft }}>
                <Text selectable style={{ ...typography.callout, color: colors.success }}>
                  {callLogMessage}
                </Text>
              </Card>
            ) : null}
            {stageMessage ? (
              <Card style={{ borderColor: colors.success, backgroundColor: colors.successSoft }}>
                <Text selectable style={{ ...typography.callout, color: colors.success }}>
                  {stageMessage}
                </Text>
              </Card>
            ) : null}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={showDisposition ? 'Cancel' : 'Log call'}
                  icon={{ name: 'phone.fill', fallback: 'Ph' }}
                  onPress={() => {
                    setShowDisposition((prev) => !prev);
                    setShowStageChange(false);
                    setCallLogError(null);
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label={showStageChange ? 'Cancel' : 'Stage change'}
                  icon={{ name: 'arrow.right.circle.fill', fallback: 'St' }}
                  onPress={() => {
                    setShowStageChange((prev) => !prev);
                    setShowDisposition(false);
                    setStageError(null);
                  }}
                />
              </View>
            </View>

            {/* FR-MOB-059: capture a voice note pre-scoped to this lead (reuses the Voice Notes screen). */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  label="Voice note"
                  icon={{ name: 'mic.fill', fallback: 'V' }}
                  onPress={() => router.push({
                    pathname: '/voice-notes',
                    params: { presetContextType: 'lead', presetContextId: id, presetContextLabel: lead.companyName },
                  })}
                />
              </View>
            </View>

            {showDisposition ? (
              <Card>
                <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                  Log call disposition
                </Text>
                <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                  Records the initial contact against this lead in CRM.
                </Text>
                <TextInput
                  value={dispositionNote}
                  onChangeText={setDispositionNote}
                  multiline
                  placeholder="Optional: call outcome or follow-up note..."
                  placeholderTextColor={colors.subtle}
                  style={{
                    minHeight: 80,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    padding: spacing.md,
                    textAlignVertical: 'top',
                    color: colors.text,
                    ...typography.body,
                  }}
                />
                {callLogError ? (
                  <Text selectable style={{ ...typography.callout, color: colors.danger }}>
                    {callLogError}
                  </Text>
                ) : null}
                <PrimaryButton
                  label={isLoggingCall ? 'Logging...' : 'Log call to CRM'}
                  disabled={isLoggingCall}
                  icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }}
                  onPress={() => void handleLogCall()}
                />
              </Card>
            ) : null}

            {showStageChange ? (
              <Card>
                <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                  Advance stage
                </Text>
                <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                  Move this lead to the next stage in CRM. Back-office stage changes (onboarding, customer active) must go through the web app.
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {MOBILE_ADVANCEABLE_STAGES.filter((stage) => stage !== lead.stage).map((stage) => (
                    <Pressable
                      key={stage}
                      onPress={() => setSelectedStage((prev) => (prev === stage ? null : stage))}
                      style={({ pressed }) => ({
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: selectedStage === stage ? colors.primary : colors.border,
                        backgroundColor: selectedStage === stage ? colors.primarySoft : colors.surface,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <Text
                        style={{
                          ...typography.callout,
                          color: selectedStage === stage ? colors.primary : colors.text,
                          fontWeight: selectedStage === stage ? '700' : '500',
                        }}
                      >
                        {humanize(stage)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {selectedStage ? (
                  <TextInput
                    value={stageNote}
                    onChangeText={setStageNote}
                    multiline
                    placeholder="Optional: reason or follow-up note..."
                    placeholderTextColor={colors.subtle}
                    style={{
                      minHeight: 72,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surface,
                      padding: spacing.md,
                      textAlignVertical: 'top',
                      color: colors.text,
                      ...typography.body,
                    }}
                  />
                ) : null}
                {stageError ? (
                  <Text selectable style={{ ...typography.callout, color: colors.danger }}>
                    {stageError}
                  </Text>
                ) : null}
                <PrimaryButton
                  label={isTransitioning ? 'Updating...' : 'Save stage change'}
                  disabled={!selectedStage || isTransitioning}
                  icon={{ name: 'arrow.right.circle.fill', fallback: 'Go' }}
                  onPress={() => void handleStageChange()}
                />
              </Card>
            ) : null}

            <SectionTitle title="Field context" />
            <Card>
              <Row label="Owner" value={lead.leadOwnerName ?? lead.assignedTmName ?? 'Unassigned'} />
              <Row label="Territory" value={lead.territoryName ?? 'Not assigned'} />
              <Row label="Affinity" value={lead.affinityGroupName ?? 'None'} />
              <Row label="Ownership / PE" value={lead.ownershipGroupName ?? 'None'} />
              <Row label="Notes" value={lead.notes ?? 'No notes yet'} />
            </Card>
          </>
        ) : null}
      </Screen>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.text }}>
        {value}
      </Text>
    </View>
  );
}

function Action({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        borderRadius: radius.md,
        backgroundColor: disabled ? colors.border : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.86 : 1,
      })}
    >
      <Text style={{ ...typography.callout, color: disabled ? colors.subtle : colors.white, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

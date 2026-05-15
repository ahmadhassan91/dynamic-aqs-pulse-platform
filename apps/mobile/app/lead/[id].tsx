import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import type { LeadDetail } from '@pulse/contracts/leads';
import { Card, ErrorState, LoadingState, Pill, Screen, SectionTitle } from '@/components/native-kit';
import { fetchLeadDetail } from '@/lib/api';
import { formatDateTime, humanize } from '@/lib/format';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiBaseUrl, auth } = useSession();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !id) return;
    setIsLoading(true);
    setErrorMessage(null);
    void fetchLeadDetail(apiBaseUrl, auth.tokens.accessToken, id)
      .then(setLead)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load lead.'))
      .finally(() => setIsLoading(false));
  }, [apiBaseUrl, auth, id]);

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
              <Action label="Call" disabled={!lead.phone} onPress={() => void Linking.openURL(`tel:${lead.phone}`)} />
              <Action label="Email" disabled={!lead.email} onPress={() => void Linking.openURL(`mailto:${lead.email}`)} />
            </View>

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

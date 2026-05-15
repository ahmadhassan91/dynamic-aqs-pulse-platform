import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { AccountDetail } from '@pulse/contracts/accounts';
import { Card, ErrorState, LoadingState, Pill, Screen, SectionTitle } from '@/components/native-kit';
import { fetchAccountDetail } from '@/lib/api';
import { formatDate, initials } from '@/lib/format';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiBaseUrl, auth } = useSession();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !id) return;
    setIsLoading(true);
    setErrorMessage(null);
    void fetchAccountDetail(apiBaseUrl, auth.tokens.accessToken, id)
      .then(setAccount)
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load account.'))
      .finally(() => setIsLoading(false));
  }, [apiBaseUrl, auth, id]);

  return (
    <>
      <Stack.Screen options={{ title: account?.displayName ?? 'Account Detail', headerShown: true }} />
      <Screen>
        {isLoading ? <LoadingState label="Loading account..." /> : null}
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {account ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.full,
                    backgroundColor: colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primaryDeep, fontSize: 18, fontWeight: '800' }}>{initials(account.displayName)}</Text>
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text selectable style={{ ...typography.title, color: colors.text }}>
                    {account.displayName}
                  </Text>
                  <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                    {account.accountNumber ?? 'Account number pending'}
                  </Text>
                </View>
                <Pill label={account.lifecycleStatus} tone={account.lifecycleStatus} />
              </View>
            </Card>

            <SectionTitle title="Field ownership" />
            <Card>
              <Row label="Territory" value={account.territoryName ?? 'Not assigned'} />
              <Row label="Region" value={account.regionName ?? 'Not assigned'} />
              <Row label="TM" value={account.assignedTmName ?? 'Unassigned'} />
              <Row label="RD" value={account.assignedRdName ?? 'Unassigned'} />
              <Row label="Shipping center" value={account.shippingCenterName ?? 'Not assigned'} />
            </Card>

            <SectionTitle title="Dealer context" />
            <Card>
              <Row label="Affinity" value={account.affinityGroupName ?? 'None'} />
              <Row label="Ownership / PE" value={account.ownershipGroupName ?? 'None'} />
              <Row label="Classification" value={account.groupClassification ?? 'Independent/none'} />
              <Row label="Last engagement" value={formatDate(account.lastEngagementAt)} />
            </Card>

            <SectionTitle title="Contacts" detail={`${account.contacts.length} contact${account.contacts.length === 1 ? '' : 's'} on file`} />
            <Card>
              {account.contacts.slice(0, 4).map((contact) => (
                <Row key={contact.id} label={`${contact.firstName} ${contact.lastName}`} value={contact.email ?? contact.phone ?? contact.mobilePhone ?? 'No direct contact'} />
              ))}
              {!account.contacts.length ? <Row label="No contacts" value="Add contact management in the account slice." /> : null}
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

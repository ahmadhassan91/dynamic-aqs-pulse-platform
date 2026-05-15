import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { AccountCard } from '@/components/account-card';
import { EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from '@/components/native-kit';
import { useFieldData } from '@/hooks/use-mobile-data';
import { colors, radius, spacing, typography } from '@/theme';

export default function AccountsScreen() {
  const { accounts, errorMessage, isLoading } = useFieldData(50);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((account) => [account.displayName, account.accountNumber, account.territoryName, account.assignedTmName, account.affinityGroupName, account.ownershipGroupName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [accounts, query]);

  return (
    <Screen>
      <SectionTitle title="Accounts" detail="Field-safe account list for route planning, training, consignment, and dealer portal follow-up." />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search account, territory, TM, group..."
        placeholderTextColor={colors.subtle}
        style={{
          minHeight: 48,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md,
          ...typography.body,
        }}
      />
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading accounts..." /> : null}
      <View style={{ gap: spacing.md }}>
        {filtered.map((account) => <AccountCard key={account.id} account={account} />)}
      </View>
      {!filtered.length && !isLoading ? (
        <EmptyState title="No accounts found" detail="Try another search or confirm customer visibility for this role." />
      ) : null}
    </Screen>
  );
}

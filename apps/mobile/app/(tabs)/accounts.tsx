import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { AccountCard } from '@/components/account-card';
import { EmptyState, ErrorState, HeroCard, ListScreen, LoadingState, SearchField } from '@/components/native-kit';
import { useFieldData } from '@/hooks/use-mobile-data';
import { typography } from '@/theme';

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

  const header = (
    <>
      <HeroCard title="Accounts" eyebrow="Field book" icon={{ name: 'building.2.fill', fallback: 'A' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Field-safe account list for planning visits, training work, consignment checks, and dealer portal support.
        </Text>
      </HeroCard>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search account, territory, TM, group..."
      />
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading accounts..." /> : null}
    </>
  );

  return (
    <ListScreen
      data={filtered}
      keyExtractor={(account) => account.id}
      renderItem={(account) => <AccountCard account={account} />}
      header={header}
      empty={!filtered.length && !isLoading
        ? <EmptyState title="No accounts found" detail="Try another search or confirm customer visibility for this role." />
        : null}
    />
  );
}

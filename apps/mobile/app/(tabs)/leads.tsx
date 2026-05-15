import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { LeadCard } from '@/components/lead-card';
import { EmptyState, ErrorState, HeroCard, LoadingState, Screen, SearchField } from '@/components/native-kit';
import { useFieldData } from '@/hooks/use-mobile-data';
import { spacing, typography } from '@/theme';

export default function LeadsScreen() {
  const { errorMessage, isLoading, leads } = useFieldData(50);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return leads;
    return leads.filter((lead) => [lead.companyName, lead.contactDisplayName, lead.email, lead.phone, lead.leadSourceName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [leads, query]);

  return (
    <Screen>
      <HeroCard title="Lead inbox" eyebrow="Follow-up queue" icon={{ name: 'person.crop.circle.badge.plus', fallback: 'L' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Mobile-first working list for new field activity, urgent response, and business-card capture.
        </Text>
      </HeroCard>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search company, contact, source..."
      />
      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {isLoading ? <LoadingState label="Loading leads..." /> : null}
      <View style={{ gap: spacing.md }}>
        {filtered.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
      </View>
      {!filtered.length && !isLoading ? (
        <EmptyState title="No leads found" detail="Try another search or confirm this role has lead visibility." />
      ) : null}
    </Screen>
  );
}

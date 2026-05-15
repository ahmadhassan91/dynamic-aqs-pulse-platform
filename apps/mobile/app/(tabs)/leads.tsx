import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { LeadCard } from '@/components/lead-card';
import { EmptyState, ErrorState, LoadingState, Screen, SectionTitle } from '@/components/native-kit';
import { useFieldData } from '@/hooks/use-mobile-data';
import { colors, radius, spacing, typography } from '@/theme';

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
      <SectionTitle title="Lead inbox" detail="Mobile-first working list for new field activity and follow-up." />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search company, contact, source..."
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
      {isLoading ? <LoadingState label="Loading leads..." /> : null}
      <View style={{ gap: spacing.md }}>
        {filtered.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
      </View>
      {!filtered.length && !isLoading ? (
        <EmptyState title="No leads found" detail="Try another search or confirm this role has lead visibility." />
      ) : null}
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        OCR card/badge capture is the next native slice and is intentionally not simulated here.
      </Text>
    </Screen>
  );
}

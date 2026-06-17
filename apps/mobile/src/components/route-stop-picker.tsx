import { useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import { Field, NativeIcon } from '@/components/native-kit';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

// RTE-P3: pick accounts to add to the route. A searchable bottom-sheet over the accounts not already
// in the route; tapping one adds it and keeps the sheet open for multi-add.
export function RouteStopPicker({
  visible,
  accounts,
  onAdd,
  onClose,
}: {
  visible: boolean;
  accounts: AccountSummary[];
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const { palette: colors } = useTheme();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const base = query ? accounts.filter((account) => account.displayName.toLowerCase().includes(query)) : accounts;
    return base.slice(0, 50);
  }, [accounts, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.subtitle, color: colors.text }}>Add stops</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Done adding stops" onPress={onClose} hitSlop={10}>
              <NativeIcon name="xmark.circle.fill" fallback="Close" color={colors.subtle} size={22} />
            </Pressable>
          </View>
          <Field label="Search accounts" value={search} onChangeText={setSearch} placeholder="Account name..." autoCorrect={false} />
          {filtered.length === 0 ? (
            <Text style={{ ...typography.callout, color: colors.muted, paddingVertical: spacing.md }}>
              {accounts.length === 0 ? 'Every loaded account is already on the route.' : 'No accounts match that search.'}
            </Text>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(account) => account.id}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${item.displayName} to route`}
                  onPress={() => onAdd(item.id)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingVertical: spacing.sm, opacity: pressed ? 0.7 : 1 })}
                >
                  <NativeIcon name="plus.circle.fill" fallback="Add" color={colors.primary} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, color: colors.text }}>{item.displayName}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>
                      {item.territoryName ?? item.regionName ?? 'No territory assigned'}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

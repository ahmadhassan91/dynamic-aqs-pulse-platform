import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { OrderProductOption, SearchOrderProductsRequest } from '@pulse/contracts/orders';
import { NativeIcon, SearchField } from '@/components/native-kit';
import { fetchOrderProducts } from '@/lib/api';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

// ORD-P4: a bottom-sheet catalog search for adding product lines to an order draft.
// Reads the published BaseProduct catalog (TM has product.view). Selecting a product
// hands its SKU/name/uom snapshot back to the order form.
export function ProductPickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (product: OrderProductOption) => void;
}) {
  const { palette: colors } = useTheme();
  const { apiBaseUrl, auth } = useSession();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<OrderProductOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the query each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setSearch('');
    }
  }, [visible]);

  // Debounced catalog search (also runs once on open with an empty term to show recent items).
  useEffect(() => {
    if (!visible || !auth) {
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      setIsLoading(true);
      setError(null);
      const query: SearchOrderProductsRequest = { limit: 25 };
      const term = search.trim();
      if (term) {
        query.search = term;
      }
      fetchOrderProducts(apiBaseUrl, auth.tokens.accessToken, query)
        .then((response) => {
          if (!cancelled) {
            setResults(response.items);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Could not load products.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoading(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [visible, search, apiBaseUrl, auth]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss product search"
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing.lg,
            gap: spacing.md,
            maxHeight: '80%',
          }}
        >
          <Text style={{ ...typography.subtitle, color: colors.text }}>Add a product</Text>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Search catalog by name or SKU"
            autoCorrect={false}
            autoCapitalize="none"
          />

          {isLoading ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          {error ? (
            <Text style={{ ...typography.callout, color: colors.danger }}>{error}</Text>
          ) : null}

          {!isLoading && !error && results.length === 0 ? (
            <Text style={{ ...typography.callout, color: colors.muted, paddingVertical: spacing.md }}>
              No products found. Try a different search, or add a custom line instead.
            </Text>
          ) : null}

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            <View style={{ gap: spacing.sm }}>
              {results.map((product) => (
                <Pressable
                  key={product.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${product.productName}`}
                  onPress={() => {
                    onSelect(product);
                    onClose();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    minHeight: 56,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ ...typography.callout, color: colors.text, fontFamily: 'Inter_700Bold' }}>
                      {product.productName}
                    </Text>
                    <Text numberOfLines={1} style={{ ...typography.caption, color: colors.muted }}>
                      {product.sku}
                      {product.unitOfMeasure ? ` · ${product.unitOfMeasure}` : ''}
                    </Text>
                  </View>
                  <NativeIcon name="plus.circle.fill" fallback="+" color={colors.primary} size={22} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

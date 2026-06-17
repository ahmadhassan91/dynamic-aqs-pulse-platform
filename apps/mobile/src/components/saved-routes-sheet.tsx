import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { Field, NativeIcon, PrimaryButton } from '@/components/native-kit';
import type { SavedRoute } from '@/lib/saved-routes';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

// RTE-P6: save / load / duplicate / delete named routes. A bottom-sheet over the current route — save
// the current plan under a name, then load/duplicate/delete any saved route.
export function SavedRoutesSheet({
  visible,
  savedRoutes,
  canSaveCurrent,
  onSaveCurrent,
  onLoad,
  onDuplicate,
  onDelete,
  onClose,
}: {
  visible: boolean;
  savedRoutes: SavedRoute[];
  canSaveCurrent: boolean;
  onSaveCurrent: (name: string) => void;
  onLoad: (route: SavedRoute) => void;
  onDuplicate: (route: SavedRoute) => void;
  onDelete: (route: SavedRoute) => void;
  onClose: () => void;
}) {
  const { palette: colors } = useTheme();
  const [name, setName] = useState('');

  function saveCurrent() {
    const trimmed = name.trim();
    if (!trimmed || !canSaveCurrent) return;
    onSaveCurrent(trimmed);
    setName('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ ...typography.subtitle, color: colors.text }}>Saved routes</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close saved routes" onPress={onClose} hitSlop={10}>
              <NativeIcon name="xmark.circle.fill" fallback="Close" color={colors.subtle} size={22} />
            </Pressable>
          </View>

          <View style={{ gap: spacing.sm }}>
            <Field
              label="Save current route as"
              value={name}
              onChangeText={setName}
              placeholder={canSaveCurrent ? 'e.g. Monday north loop' : 'Add stops to the route first'}
              editable={canSaveCurrent}
              accessibilityState={{ disabled: !canSaveCurrent }}
              accessibilityHint={canSaveCurrent ? undefined : 'Add stops to the route before saving'}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={saveCurrent}
            />
            <PrimaryButton label="Save route" icon={{ name: 'plus.circle.fill', fallback: 'Save' }} disabled={!canSaveCurrent || name.trim().length === 0} onPress={saveCurrent} />
          </View>

          {savedRoutes.length === 0 ? (
            <Text style={{ ...typography.callout, color: colors.muted, paddingVertical: spacing.sm }}>
              No saved routes yet. Build a route, name it above, and save it to reuse later.
            </Text>
          ) : (
            <FlatList
              data={savedRoutes}
              keyExtractor={(route) => route.id}
              keyboardShouldPersistTaps="handled"
              style={{ flexGrow: 0 }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
              renderItem={({ item }) => (
                <View style={{ paddingVertical: spacing.sm, gap: spacing.sm }}>
                  <View>
                    <Text style={{ ...typography.body, color: colors.text }}>{item.name}</Text>
                    <Text style={{ ...typography.caption, color: colors.muted }}>
                      {item.stopIds.length} stop{item.stopIds.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <SavedRouteAction icon="arrow.down.circle.fill" label={`Load ${item.name}`} text="Load" onPress={() => onLoad(item)} />
                    <SavedRouteAction icon="doc.on.doc.fill" label={`Duplicate ${item.name}`} text="Duplicate" onPress={() => onDuplicate(item)} />
                    <SavedRouteAction icon="trash.fill" label={`Delete ${item.name}`} text="Delete" tone="danger" onPress={() => onDelete(item)} />
                  </View>
                </View>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SavedRouteAction({ icon, label, text, onPress, tone }: { icon: string; label: string; text: string; onPress: () => void; tone?: 'danger' }) {
  const { palette: colors } = useTheme();
  const color = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.6 : 1 })}
    >
      <NativeIcon name={icon} fallback={text} color={color} size={16} />
      <Text style={{ ...typography.caption, color, fontWeight: '800' }}>{text}</Text>
    </Pressable>
  );
}

import { useRef } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { NativeIcon } from '@/components/native-kit';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

// RTE-P7: long-press a map marker to act on that account — open it, add/remove it from the route
// (the map↔route bridge), or hand off to navigation. A small bottom sheet; visible when account != null.
export function MarkerActionSheet({
  account,
  inRoute,
  canNavigate,
  onOpen,
  onToggleRoute,
  onNavigate,
  onClose,
}: {
  account: { id: string; displayName: string } | null;
  inRoute: boolean;
  canNavigate: boolean;
  onOpen: () => void;
  onToggleRoute: () => void;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const { palette: colors } = useTheme();
  // Retain the last account name so the title doesn't flash a fallback during the dismiss slide-out
  // (account becomes null before the modal finishes animating closed).
  const lastNameRef = useRef('Account');
  if (account) lastNameRef.current = account.displayName;
  const displayName = account?.displayName ?? lastNameRef.current;

  return (
    <Modal visible={account !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss marker actions"
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.subtitle, color: colors.text }} numberOfLines={1}>
            {displayName}
          </Text>

          <MarkerAction icon="doc.text.magnifyingglass" label={`Open ${account?.displayName ?? 'account'}`} text="Open account" onPress={onOpen} />
          <MarkerAction
            icon={inRoute ? 'xmark.circle.fill' : 'plus.circle.fill'}
            label={inRoute ? `Remove ${account?.displayName ?? 'account'} from route` : `Add ${account?.displayName ?? 'account'} to route`}
            text={inRoute ? 'Remove from route' : 'Add to route'}
            onPress={onToggleRoute}
          />
          {canNavigate ? (
            <MarkerAction icon="location.north.fill" label={`Navigate to ${account?.displayName ?? 'account'}`} text="Navigate" onPress={onNavigate} />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MarkerAction({ icon, label, text, onPress }: { icon: string; label: string; text: string; onPress: () => void }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfacePressed : colors.surface })}
    >
      <NativeIcon name={icon} fallback={text} color={colors.primary} size={20} />
      <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{text}</Text>
    </Pressable>
  );
}

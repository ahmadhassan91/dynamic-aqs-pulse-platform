import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { NAV_PROVIDERS, type NavProvider, type NavTarget } from '@/lib/external-nav';
import { loadLastNavProvider, openNav, saveLastNavProvider } from '@/lib/nav-launch';
import { NativeIcon } from '@/components/native-kit';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

// RTE-P2: a bottom-sheet chooser for the external nav handoff. Renders when `target` is non-null; the
// last-used provider floats to the top and is labelled. native-kit has no sheet primitive, so this is a
// small transparent Modal.
export function NavigateSheet({ target, onClose }: { target: NavTarget | null; onClose: () => void }) {
  const { palette: colors } = useTheme();
  const [last, setLast] = useState<NavProvider | null>(null);
  const launchingRef = useRef(false);

  useEffect(() => {
    if (target) {
      launchingRef.current = false; // a fresh target re-arms the chooser
      void loadLastNavProvider().then(setLast);
    }
  }, [target]);

  function choose(provider: NavProvider) {
    if (!target || launchingRef.current) return; // ignore a second tap mid-launch
    launchingRef.current = true;
    const chosenTarget = target;
    void saveLastNavProvider(provider); // persisted now; the next open re-sorts via the effect (no jump-while-animating)
    onClose(); // dismiss first so a slow OS hand-off never leaves the sheet stuck open
    void openNav(provider, chosenTarget);
  }

  const providers = useMemo(
    () => [...NAV_PROVIDERS].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0)),
    [last],
  );

  return (
    <Modal visible={target !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss navigation options"
        onPress={onClose}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}
      >
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
          <Text style={{ ...typography.subtitle, color: colors.text }}>Navigate with</Text>
          <Text style={{ ...typography.caption, color: colors.muted }}>
            {target?.label ?? 'Open turn-by-turn directions in your maps app.'}
          </Text>
          {providers.map((provider) => (
            <Pressable
              key={provider.id}
              accessibilityRole="button"
              accessibilityLabel={`Navigate with ${provider.label}${provider.id === last ? ', last used' : ''}`}
              onPress={() => choose(provider.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                minHeight: 52,
                paddingHorizontal: spacing.md,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfacePressed : colors.surface,
              })}
            >
              <NativeIcon name={provider.icon} fallback={provider.fallback} color={colors.primary} size={20} />
              <Text style={{ ...typography.body, color: colors.text, flex: 1 }}>{provider.label}</Text>
              {provider.id === last ? <Text style={{ ...typography.caption, color: colors.muted }}>Last used</Text> : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

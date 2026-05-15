import { Text, View } from 'react-native';
import { Card, Pill, Screen, SectionTitle } from '@/components/native-kit';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export default function SyncScreen() {
  const { apiBaseUrl, auth, refresh } = useSession();

  return (
    <Screen>
      <SectionTitle title="Sync status" detail="Foundation for offline field execution. The queue is visible now; durable offline writes come in the native execution slice." />

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
              Connected session
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.muted }}>
              {auth?.identity.email ?? 'No active identity'}
            </Text>
          </View>
          <Pill label="online" tone="active" />
        </View>
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          API: {apiBaseUrl}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
          Pending mobile queue
        </Text>
        <Text selectable style={{ ...typography.largeTitle, color: colors.text, fontVariant: ['tabular-nums'] }}>
          0
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          Check-in/out, visit notes, OCR media, and consignment audit writes will use this queue in the next slices.
        </Text>
      </Card>

      <Card style={{ backgroundColor: colors.surfaceMuted }}>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }} onPress={() => void refresh()}>
          Refresh Session
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          Tap the title above to validate the token and update role/session metadata.
        </Text>
      </Card>
    </Screen>
  );
}

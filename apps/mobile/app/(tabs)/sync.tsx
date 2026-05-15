import { Text, View } from 'react-native';
import { Card, HeroCard, Pill, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export default function SyncScreen() {
  const { apiBaseUrl, auth, refresh } = useSession();

  return (
    <Screen>
      <HeroCard title="Sync status" eyebrow="Mobile reliability" icon={{ name: 'arrow.triangle.2.circlepath', fallback: 'S' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Session health and offline queue visibility for field execution.
        </Text>
      </HeroCard>

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

      <SectionTitle title="Session tools" />
      <SecondaryButton label="Refresh session" icon={{ name: 'arrow.clockwise.circle.fill', fallback: 'R' }} onPress={() => void refresh()} />
    </Screen>
  );
}

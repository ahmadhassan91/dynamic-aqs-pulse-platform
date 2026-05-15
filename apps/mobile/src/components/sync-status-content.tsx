import { Text, View } from 'react-native';
import { Card, HeroCard, Pill, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { clearSyncedDrafts, retryPendingDrafts, useMobileDraftQueue } from '@/lib/mobile-draft-queue';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export function SyncStatusContent() {
  const { apiBaseUrl, auth, refresh } = useSession();
  const drafts = useMobileDraftQueue();
  const pendingDrafts = drafts.filter((draft) => draft.status !== 'synced');
  const syncedDrafts = drafts.filter((draft) => draft.status === 'synced');
  const roseDrafts = pendingDrafts.filter((draft) => draft.kind === 'consignment_rose_audit').length;
  const routeDrafts = pendingDrafts.filter((draft) => draft.kind === 'route_visit').length;

  return (
    <Screen>
      <HeroCard title="Sync status" eyebrow="Mobile reliability" icon={{ name: 'arrow.triangle.2.circlepath', fallback: 'S' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          See what is already in CRM and what is still saved only on this phone.
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
          CRM connection: {apiBaseUrl}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
          Offline drafts
        </Text>
        <Text selectable style={{ ...typography.largeTitle, color: colors.text, fontVariant: ['tabular-nums'] }}>
          {pendingDrafts.length}
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          These updates stay on this device until CRM accepts them. ROSE audits can retry now; route visits remain parked until the field visit API is approved.
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          ROSE audits: {roseDrafts} · Route visits: {routeDrafts}
        </Text>
      </Card>

      {drafts.length ? (
        <View style={{ gap: spacing.md }}>
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                    {draft.title}
                  </Text>
                  <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                    {draft.detail}
                  </Text>
                  {draft.errorMessage ? (
                    <Text selectable style={{ ...typography.caption, color: colors.warning }}>
                      {draft.errorMessage}
                    </Text>
                  ) : null}
                </View>
                <Pill
                  label={draft.status === 'synced' ? 'CRM saved' : draft.status === 'syncing' ? 'Sending' : draft.status === 'failed' ? 'Needs retry' : 'Draft on phone'}
                  tone={draft.status === 'synced' ? 'active' : draft.status === 'failed' ? 'review' : 'pending'}
                />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <SectionTitle title="Session tools" />
      <SecondaryButton label="Refresh session" icon={{ name: 'arrow.clockwise.circle.fill', fallback: 'R' }} onPress={() => void refresh()} />
      <SecondaryButton
        label="Retry drafts"
        icon={{ name: 'arrow.up.arrow.down.circle.fill', fallback: 'Sync' }}
        onPress={() => {
          if (!auth) return;
          void retryPendingDrafts(apiBaseUrl, auth.tokens.accessToken);
        }}
      />
      <SecondaryButton label={`Clear synced (${syncedDrafts.length})`} icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }} onPress={clearSyncedDrafts} />
    </Screen>
  );
}

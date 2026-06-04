import { Stack, router } from 'expo-router';
import { Text, View } from 'react-native';
import { MobileNextActionCard } from '@/components/mobile-next-action-card';
import { EmptyState, ErrorState, HeroCard, LoadingState, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { useMobileNextActions } from '@/hooks/use-mobile-next-actions';
import type { MobileNextAction } from '@/lib/mobile-next-action';
import { spacing, typography } from '@/theme';

export default function NotificationsScreen() {
  const { fieldData, nextActions } = useMobileNextActions();
  const { errorMessage, isLoading, reload } = fieldData;
  const otherAlerts = nextActions.alerts.filter((action) => action.id !== nextActions.primary.id).slice(0, 8);

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications', headerShown: true }} />
      <Screen>
        <HeroCard title="Notifications" eyebrow="Field signals" icon={{ name: 'bell.fill', fallback: 'N' }}>
          <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
            One ranked list for lead urgency, route work, ROSE audits, and phone-saved updates.
          </Text>
        </HeroCard>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {isLoading ? <LoadingState label="Refreshing CRM signals..." /> : null}

        <SectionTitle title="Top action" detail="This uses the same field-day ranking model as Today and Sync Status." />
        <MobileNextActionCard action={nextActions.primary} onPress={openNextAction} />

        {otherAlerts.length ? (
          <View style={{ gap: spacing.md }}>
            <SectionTitle title="Other signals" detail="Review these after the top action, or open the related workspace directly." />
            {otherAlerts.map((action) => (
              <MobileNextActionCard key={action.id} action={action} eyebrow={action.count ? `${action.count} item${action.count === 1 ? '' : 's'}` : 'Signal'} onPress={openNextAction} />
            ))}
          </View>
        ) : (
          <EmptyState title="No other urgent alerts" detail="Lead, ROSE, route, and phone-sync signals are clear behind the top action." />
        )}

        <SectionTitle title="Tools" detail="Refresh CRM signals or open Sync Status for draft-level retry and review controls." />
        <SecondaryButton label="Refresh signals" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />
        <SecondaryButton label="Open sync status" icon={{ name: 'arrow.triangle.2.circlepath', fallback: 'S' }} onPress={() => router.push('/sync-status')} />
      </Screen>
    </>
  );
}

function openNextAction(action: MobileNextAction) {
  router.push(action.targetHref as never);
}

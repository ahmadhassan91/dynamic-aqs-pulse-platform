import { Stack, router } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { formatDate } from '@/lib/format';
import { useFieldData } from '@/hooks/use-mobile-data';
import { colors, radius, spacing, typography } from '@/theme';

export default function NotificationsScreen() {
  const { consignmentSites, consignmentWorkItems, errorMessage, isLoading, queueSummary, reload } = useFieldData(20);
  const leadAlerts = queueSummary?.urgentCount ?? 0;
  const slaAlerts = queueSummary?.slaRiskCount ?? 0;
  const dueConsignmentSites = consignmentSites.filter((site) => site.nextAuditDueAt);
  const hasAlerts = leadAlerts > 0 || slaAlerts > 0 || dueConsignmentSites.length > 0 || consignmentWorkItems.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications', headerShown: true }} />
      <Screen>
        <HeroCard title="Notifications" eyebrow="CRM sync" icon={{ name: 'bell.fill', fallback: 'N' }}>
          <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
            Live CRM signals for lead urgency, SLA risk, consignment audit work, and sync health.
          </Text>
        </HeroCard>

        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {isLoading ? <LoadingState label="Refreshing CRM signals..." /> : null}

        {hasAlerts ? (
          <View style={{ gap: spacing.md }}>
            {leadAlerts > 0 ? <NotificationCard title="Urgent lead actions" detail={`${leadAlerts} lead workflow item${leadAlerts === 1 ? '' : 's'} need attention.`} tone="danger" action="Open leads" onPress={() => router.push('/(tabs)/leads')} /> : null}
            {slaAlerts > 0 ? <NotificationCard title="SLA risk" detail={`${slaAlerts} lead follow-up item${slaAlerts === 1 ? ' is' : 's are'} at risk.`} tone="warning" action="Review leads" onPress={() => router.push('/(tabs)/leads')} /> : null}
            {dueConsignmentSites.slice(0, 4).map((site) => (
              <NotificationCard
                key={site.id}
                title={`ROSE audit: ${site.accountName}`}
                detail={`Next audit due ${formatDate(site.nextAuditDueAt)}. ${site.acumaticaStatus === 'available' ? 'Acumatica context available.' : 'Acumatica inventory truth is parked/stale; verify manually.'}`}
                tone={site.acumaticaStatus === 'available' ? 'active' : 'warning'}
                action="Open consignment"
                onPress={() => router.push('/(tabs)/consignment')}
              />
            ))}
            {consignmentWorkItems.slice(0, 3).map((site) => (
              <NotificationCard
                key={`work-${site.id}`}
                title={`Consignment work: ${site.accountName}`}
                detail={`${site.openWorkItemCount} open item${site.openWorkItemCount === 1 ? '' : 's'} and ${site.openDiscrepancyCount} discrepancy case${site.openDiscrepancyCount === 1 ? '' : 's'}.`}
                tone="warning"
                action="Open queue"
                onPress={() => router.push('/(tabs)/consignment')}
              />
            ))}
          </View>
        ) : (
          <EmptyState title="No urgent CRM alerts" detail="Lead, consignment, and sync signals are clear for this mobile session." />
        )}

        <SectionTitle title="Sync status" detail="Push notifications and offline conflict resolution are still parked; this screen reflects live CRM pulls from the current session." />
        <SecondaryButton label="Refresh signals" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />
        <SecondaryButton label="Open sync detail" icon={{ name: 'arrow.triangle.2.circlepath', fallback: 'S' }} onPress={() => router.push('/(tabs)/sync')} />
      </Screen>
    </>
  );
}

function NotificationCard({
  action,
  detail,
  onPress,
  title,
  tone,
}: {
  action: string;
  detail: string;
  onPress: () => void;
  title: string;
  tone: 'active' | 'danger' | 'warning';
}) {
  const palette = tone === 'danger'
    ? { bg: colors.dangerSoft, fg: colors.danger, icon: 'exclamationmark.triangle.fill' }
    : tone === 'warning'
      ? { bg: colors.warningSoft, fg: colors.warning, icon: 'clock.badge.exclamationmark.fill' }
      : { bg: colors.successSoft, fg: colors.success, icon: 'checkmark.circle.fill' };
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ width: 42, height: 42, borderRadius: radius.full, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
          <NativeIcon name={palette.icon} fallback="!" color={palette.fg} size={18} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {title}
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            {detail}
          </Text>
          <Text onPress={onPress} style={{ ...typography.callout, color: colors.primary, fontWeight: '800' }}>
            {action}
          </Text>
        </View>
      </View>
    </Card>
  );
}

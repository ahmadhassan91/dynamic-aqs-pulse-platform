import { Stack, router } from 'expo-router';
import { Text, View } from 'react-native';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, MetricCard, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { useRdDashboard } from '@/hooks/use-rd-dashboard';
import { isRdDashboardRole } from '@/lib/rd-dashboard-metrics';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { spacing, typography } from '@/theme';

// FR-MOB-058 — Regional Director rollup. Assembled from the RD-scoped lead + training dashboards and
// the consignment sites the field already fetches (server enforces record scope). Revenue is parked.
export default function RdDashboardScreen() {
  const { auth } = useSession();
  const { palette: colors } = useTheme();
  const { summary, isLoading, errorMessage, reload } = useRdDashboard();
  const allowed = isRdDashboardRole(auth?.identity.role);

  return (
    <>
      <Stack.Screen options={{ title: 'Director overview', headerShown: true }} />
      <Screen>
        <HeroCard title="Director overview" eyebrow="Regional rollup" icon={{ name: 'building.2.fill', fallback: 'RD' }}>
          <Text selectable style={{ ...typography.callout, color: '#DBEAFE' }}>
            Pipeline, training, and consignment exceptions across your region — scoped to your book.
          </Text>
        </HeroCard>

        {!allowed ? (
          <EmptyState title="Director view" detail="This rollup is for Regional Directors and executives." />
        ) : (
          <>
            {errorMessage ? <ErrorState message={errorMessage} /> : null}
            {isLoading && !summary ? <LoadingState label="Loading director overview..." /> : null}

            {summary ? (
              <>
                <SectionTitle title="Pipeline & training" detail="Role-scoped KPIs from the reporting service." />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  <MetricCard label="Open leads" value={String(summary.openLeads)} detail={`${summary.newLeads} new`} />
                  <MetricCard label="Conversion" value={`${summary.conversionRatePct}%`} detail="Lead to account" />
                  <MetricCard label="Trainings (90d)" value={String(summary.trainingsCompleted)} detail={`${summary.trainingHours} hrs`} />
                  <MetricCard
                    label="Open exceptions"
                    value={String(summary.openExceptions)}
                    detail={summary.openExceptions > 0 ? 'Needs attention' : 'All clear'}
                    {...(summary.openExceptions > 0 ? { badge: 'danger' as const } : {})}
                  />
                </View>

                <SectionTitle title="Cross-module exceptions" detail="What needs director attention across the region." />
                <Card>
                  <ExceptionRow label="Stale leads" detail="Past initial-contact SLA, not yet contacted" value={summary.staleLeads} />
                  <ExceptionRow label="Overdue training" detail="Active programs past due" value={summary.overdueTraining} />
                  <ExceptionRow label="Overdue ROSE audits" detail="Consignment sites past their next audit" value={summary.overdueAudits} />
                  <ExceptionRow label="Open consignment work" detail="Variance / PO / exit items still open" value={summary.openConsignmentWorkItems} />
                </Card>

                <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
                  <Text selectable style={{ ...typography.caption, color: colors.muted }}>
                    Revenue and financial KPIs stay parked until the Acumatica feed is approved — this view covers the CRM activity layer so the numbers are trustworthy.
                  </Text>
                </Card>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  <View style={{ flexBasis: '47%', flexGrow: 1 }}>
                    <SecondaryButton label="Lead inbox" icon={{ name: 'person.crop.circle.badge.plus', fallback: 'L' }} onPress={() => router.push('/leads')} />
                  </View>
                  <View style={{ flexBasis: '47%', flexGrow: 1 }}>
                    <SecondaryButton label="ROSE audits" icon={{ name: 'shippingbox.fill', fallback: 'C' }} onPress={() => router.push('/consignment')} />
                  </View>
                </View>

                <SecondaryButton label="Refresh" icon={{ name: 'arrow.clockwise', fallback: 'R' }} onPress={() => void reload()} />
              </>
            ) : null}
          </>
        )}
      </Screen>
    </>
  );
}

function ExceptionRow({ detail, label, value }: { detail: string; label: string; value: number }) {
  const { palette: colors } = useTheme();
  const valueColor = value > 0 ? colors.warning : colors.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={{ ...typography.callout, color: colors.text, fontWeight: '700' }}>
          {label}
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          {detail}
        </Text>
      </View>
      <Text selectable style={{ ...typography.title, color: valueColor, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

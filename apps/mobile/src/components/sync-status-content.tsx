import { Text, View } from 'react-native';
import type { UpdateConsignmentAuditRequest } from '@pulse/contracts/consignment';
import { Card, HeroCard, Pill, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { clearDraft, clearSyncedDrafts, retryPendingDrafts, useMobileDraftQueue } from '@/lib/mobile-draft-queue';
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
          These updates stay on this device until CRM accepts them. ROSE audits can retry now; route visits stay local until the field visit API is approved.
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          ROSE audits: {roseDrafts} · Route visits: {routeDrafts}
        </Text>
      </Card>

      {drafts.length ? (
        <View style={{ gap: spacing.md }}>
          {drafts.map((draft) => (
            <View key={draft.id} style={{ gap: spacing.sm }}>
              <Card>
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
                    {draft.payload.kind === 'consignment_rose_audit' && draft.payload.attestation ? (
                      <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
                        Attested by {draft.payload.attestation.attestedByName}. Evidence photos: {draft.payload.evidence?.items.length ?? 0}; media upload parked.
                      </Text>
                    ) : null}
                    {draft.payload.kind === 'consignment_rose_audit' ? (
                      <RoseDraftSummary draft={draft} />
                    ) : null}
                    {draft.payload.kind === 'route_visit' ? (
                      <RouteDraftSummary draft={draft} />
                    ) : null}
                  </View>
                  <Pill
                    label={draft.payload.kind === 'route_visit' && draft.status !== 'synced' ? 'Local only' : draft.status === 'synced' ? 'CRM saved' : draft.status === 'syncing' ? 'Sending' : draft.status === 'failed' ? 'Needs retry' : 'Draft on phone'}
                    tone={draft.status === 'synced' ? 'active' : draft.status === 'failed' ? 'review' : 'pending'}
                  />
                </View>
              </Card>
              {draft.status !== 'syncing' ? (
                <SecondaryButton label="Discard local draft" icon={{ name: 'trash.fill', fallback: 'Del' }} onPress={() => clearDraft(draft.id)} />
              ) : null}
            </View>
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

function RoseDraftSummary({ draft }: { draft: ReturnType<typeof useMobileDraftQueue>[number] }) {
  const lines = draft.payload.kind === 'consignment_rose_audit' ? draft.payload.request.lines ?? [] : [];
  const summary = summarizeRoseDraftLines(lines);
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <DraftMetric label="Lines" value={String(lines.length)} />
        <DraftMetric label="Actual" value={formatQuantity(summary.actualTotal)} />
        <DraftMetric label="Variance" value={summary.hasExpected ? formatSignedQuantity(summary.varianceTotal) : 'No expected'} tone={summary.varianceTotal === 0 ? 'normal' : 'warning'} />
      </View>
      {lines.slice(0, 4).map((line, index) => {
        const variance = line.actualQuantity !== undefined && line.expectedQuantity !== undefined ? line.actualQuantity - line.expectedQuantity : null;
        return (
          <View key={`${line.sku ?? line.productName}-${index}`} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 2 }}>
            <Text selectable style={{ ...typography.caption, color: colors.text, fontWeight: '800' }}>
              {line.productName}
            </Text>
            <Text selectable style={{ ...typography.caption, color: colors.muted }}>
              {[line.sku ? `SKU ${line.sku}` : null, line.barcode ? `Barcode ${line.barcode}` : null].filter(Boolean).join(' · ') || 'No SKU/barcode'}
            </Text>
            <Text selectable style={{ ...typography.caption, color: variance && variance !== 0 ? colors.warning : colors.subtle }}>
              Expected {formatQuantity(line.expectedQuantity)} · Actual {formatQuantity(line.actualQuantity)} · Variance {variance === null ? 'Not available' : formatSignedQuantity(variance)}
            </Text>
          </View>
        );
      })}
      {lines.length > 4 ? (
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          {lines.length - 4} more line{lines.length - 4 === 1 ? '' : 's'} saved in the draft.
        </Text>
      ) : null}
    </View>
  );
}

function RouteDraftSummary({ draft }: { draft: ReturnType<typeof useMobileDraftQueue>[number] }) {
  if (draft.payload.kind !== 'route_visit') return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
        Route visit API is parked, so this item stays local and will not retry yet.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <DraftMetric label="Check in" value={formatShortTime(draft.payload.checkedInAt)} />
        <DraftMetric label="Check out" value={formatShortTime(draft.payload.checkedOutAt)} />
        <DraftMetric label="GPS" value={draft.payload.latitude !== undefined && draft.payload.longitude !== undefined ? 'Captured' : 'Timed only'} />
      </View>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {draft.payload.notes}
      </Text>
    </View>
  );
}

function DraftMetric({ label, tone = 'normal', value }: { label: string; tone?: 'normal' | 'warning'; value: string }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: tone === 'warning' ? colors.warningSoft : colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text selectable style={{ ...typography.caption, color: tone === 'warning' ? colors.warning : colors.muted }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function summarizeRoseDraftLines(lines: NonNullable<UpdateConsignmentAuditRequest['lines']>) {
  let actualTotal = 0;
  let varianceTotal = 0;
  let hasExpected = false;
  if (!Array.isArray(lines)) return { actualTotal, varianceTotal, hasExpected };
  for (const line of lines) {
    if (typeof line.actualQuantity === 'number') actualTotal += line.actualQuantity;
    if (typeof line.expectedQuantity === 'number') {
      hasExpected = true;
      if (typeof line.actualQuantity === 'number') varianceTotal += line.actualQuantity - line.expectedQuantity;
    }
  }
  return { actualTotal, varianceTotal, hasExpected };
}

function formatQuantity(value: number | undefined) {
  if (value === undefined) return 'Not set';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatSignedQuantity(value: number) {
  if (value === 0) return '0';
  const formatted = Number.isInteger(value) ? String(Math.abs(value)) : Math.abs(value).toFixed(2);
  return `${value > 0 ? '+' : '-'}${formatted}`;
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

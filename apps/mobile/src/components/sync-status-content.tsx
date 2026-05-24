import { Text, View } from 'react-native';
import type { UpdateConsignmentAuditRequest } from '@pulse/contracts/consignment';
import { Card, HeroCard, Pill, Screen, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { clearDraft, clearSyncedDrafts, getMobileDraftReviewState, retryDraft, retryPendingDrafts, summarizeMobileDraftQueue, summarizeMobileDraftStatus, useMobileDraftQueue, type MobileDraft } from '@/lib/mobile-draft-queue';
import { useSession } from '@/providers/session-provider';
import { colors, spacing, typography } from '@/theme';

export function SyncStatusContent() {
  const { apiBaseUrl, auth, refresh } = useSession();
  const drafts = useMobileDraftQueue();
  const summary = summarizeMobileDraftQueue(drafts);
  const pendingDrafts = drafts.filter((draft) => draft.status !== 'synced');
  const syncedDrafts = drafts.filter((draft) => draft.status === 'synced');
  const sendingDrafts = drafts.filter((draft) => draft.status === 'syncing');
  const failedDrafts = drafts.filter((draft) => draft.status === 'failed');
  const conflictDrafts = drafts.filter((draft) => draft.status === 'conflict');
  const roseDrafts = pendingDrafts.filter((draft) => draft.kind === 'consignment_rose_audit').length;
  const routeDrafts = pendingDrafts.filter((draft) => draft.kind === 'route_visit').length;
  const trainingDrafts = pendingDrafts.filter((draft) => draft.kind === 'training_session').length;
  const canRetry = Boolean(auth);

  return (
    <Screen>
      <HeroCard title="Sync status" eyebrow="Mobile reliability" icon={{ name: 'arrow.triangle.2.circlepath', fallback: 'S' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Check which field updates are saved only on this phone, which ones reached CRM, and which ones need review before the next retry.
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
          <Pill label={auth ? 'signed in' : 'not signed in'} tone={auth ? 'active' : 'review'} />
        </View>
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          CRM connection: {apiBaseUrl}
        </Text>
      </Card>

      <Card>
        <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
          Saved only on this phone
        </Text>
        <Text selectable style={{ ...typography.largeTitle, color: colors.text, fontVariant: ['tabular-nums'] }}>
          {summary.unsynced}
        </Text>
        <Text selectable style={{ ...typography.callout, color: colors.muted }}>
          These updates are protected on this device, but they are not visible to CRM users until CRM saves them.
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          Saved on phone: {summary.savedOnPhone} · Ready to retry: {summary.readyToRetry} · Sign in again: {summary.signInAgain} · Needs review: {summary.needsReview} · Sending: {sendingDrafts.length} · CRM saved: {syncedDrafts.length}
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          Failed drafts: {failedDrafts.length} · Conflict drafts: {conflictDrafts.length}
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
          ROSE audits: {roseDrafts} · Route visits: {routeDrafts} · Training: {trainingDrafts}
        </Text>
        <Text selectable style={{ ...typography.caption, color: summary.storageHydrated ? colors.subtle : colors.warning }}>
          Phone storage: {summary.storageHydrated ? 'Ready' : 'Loading'}
        </Text>
      </Card>

      {!summary.storageHydrated ? (
        <Card style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Phone storage is starting
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            The app is opening the encrypted phone draft store. New work stays on screen until storage confirms it is ready.
          </Text>
        </Card>
      ) : null}

      {summary.storageHydrated && !summary.storageAvailable ? (
        <Card style={{ backgroundColor: colors.warningSoft, borderColor: '#F8D37A' }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.warning }}>
            Draft storage warning
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.text }}>
            Drafts are being kept for this app session, but this device could not confirm durable phone storage. Keep the app open, retry when the connection is stable, and avoid signing out until CRM saves the work.
          </Text>
          {summary.storageErrorMessage ? (
            <Text selectable style={{ ...typography.caption, color: colors.muted }}>
              {friendlyErrorMessage(summary.storageErrorMessage)}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {drafts.length ? (
        <View style={{ gap: spacing.md }}>
          {drafts.map((draft) => {
            const status = summarizeMobileDraftStatus(draft);
            const review = getMobileDraftReviewState(draft);
            const canRetryThisDraft = review.canRetry;
            return (
            <View key={draft.id} style={{ gap: spacing.sm }}>
              <Card {...(draft.status === 'failed' || draft.status === 'conflict' ? { style: { borderColor: colors.warning } } : {})}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                      {draft.title}
                    </Text>
                    <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                      {displayDraftDetail(draft)}
                    </Text>
                    <Text selectable style={{ ...typography.caption, color: draft.status === 'failed' ? colors.warning : colors.subtle }}>
                      {draftStatusHelp(draft)}
                    </Text>
                    <Text selectable style={{ ...typography.caption, color: review.category === 'sign_in_again' || review.category === 'needs_review' ? colors.warning : colors.subtle }}>
                      {review.detail}
                    </Text>
                    {draft.errorMessage ? (
                      <Text selectable style={{ ...typography.caption, color: colors.warning }}>
                        {friendlyErrorMessage(draft.errorMessage)}
                      </Text>
                    ) : null}
                    {draft.payload.kind === 'consignment_rose_audit' && draft.payload.attestation ? (
                      <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
                        Attested by {draft.payload.attestation.attestedByName}. Photos noted: {draft.payload.evidence?.items.length ?? 0}; offline drafts keep photo metadata only until CRM accepts the upload.
                      </Text>
                    ) : null}
                    <DraftReviewMeta draft={draft} />
                    {draft.payload.kind === 'consignment_rose_audit' ? (
                      <RoseDraftSummary draft={draft} />
                    ) : null}
                    {draft.payload.kind === 'route_visit' ? (
                      <RouteDraftSummary draft={draft} />
                    ) : null}
                    {draft.payload.kind === 'training_session' ? (
                      <TrainingDraftSummary draft={draft} />
                    ) : null}
                  </View>
                  <Pill
                    label={status.label}
                    tone={status.tone === 'success' ? 'active' : status.tone === 'warning' || status.tone === 'conflict' ? 'review' : 'pending'}
                  />
                </View>
              </Card>
              {draft.status === 'failed' || draft.status === 'conflict' ? <ConflictGuidance {...(draft.errorMessage ? { message: draft.errorMessage } : {})} /> : null}
              {review.category === 'sign_in_again' ? <SignInGuidance /> : null}
              {draft.status !== 'syncing' ? (
                <View style={{ gap: spacing.sm }}>
                  {draft.status !== 'synced' ? (
                    <SecondaryButton
                      disabled={!canRetry || !canRetryThisDraft}
                      label={!canRetry || review.category === 'sign_in_again' ? 'Sign in to retry' : canRetryThisDraft ? 'Retry this update' : 'Review before retry'}
                      icon={{ name: 'arrow.clockwise.circle.fill', fallback: 'Retry' }}
                      onPress={() => {
                        if (!auth || !canRetryThisDraft) return;
                        void retryDraft(apiBaseUrl, auth.tokens.accessToken, draft.id);
                      }}
                    />
                  ) : null}
                  <SecondaryButton
                    label={draft.status === 'synced' ? 'Remove saved copy from phone' : 'Discard phone copy'}
                    icon={{ name: 'trash.fill', fallback: 'Del' }}
                    onPress={() => clearDraft(draft.id)}
                  />
                </View>
              ) : null}
            </View>
          );
          })}
        </View>
      ) : null}

      <SectionTitle title="Session tools" />
      <SecondaryButton label="Refresh session" icon={{ name: 'arrow.clockwise.circle.fill', fallback: 'R' }} onPress={() => void refresh()} />
      <SecondaryButton
        disabled={!canRetry || summary.retryable === 0}
        label={canRetry ? `Retry ready updates (${summary.retryable})` : 'Sign in to retry updates'}
        icon={{ name: 'arrow.up.arrow.down.circle.fill', fallback: 'Sync' }}
        onPress={() => {
          if (!auth) return;
          void retryPendingDrafts(apiBaseUrl, auth.tokens.accessToken);
        }}
      />
      <SecondaryButton disabled={syncedDrafts.length === 0} label={`Remove CRM-saved copies (${syncedDrafts.length})`} icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }} onPress={clearSyncedDrafts} />
    </Screen>
  );
}

function DraftReviewMeta({ draft }: { draft: MobileDraft }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <DraftMetric label="Saved" value={formatShortDateTime(draft.createdAt)} />
      <DraftMetric label="Updated" value={formatShortDateTime(draft.updatedAt)} />
      {draft.lastAttemptAt ? <DraftMetric label="Last tried" value={formatShortDateTime(draft.lastAttemptAt)} tone={draft.status === 'failed' ? 'warning' : 'normal'} /> : null}
    </View>
  );
}

function ConflictGuidance({ message }: { message?: string }) {
  const conflict = isConflictLike(message);
  return (
    <Card style={{ backgroundColor: conflict ? colors.warningSoft : colors.surfaceMuted, borderColor: conflict ? '#F8D37A' : colors.border }}>
      <Text selectable style={{ ...typography.subtitle, color: conflict ? colors.warning : colors.text }}>
        {conflict ? 'Review before discarding' : 'What to do next'}
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.text }}>
        {conflict
          ? 'CRM may already have a newer or completed version of this work. Compare the phone copy with CRM or your RD before retrying. Discard the phone copy only after the right CRM record is confirmed.'
          : 'Retry when the connection is steady. If it still fails, keep this phone copy for review and only discard it after the update is captured another way.'}
      </Text>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        Draft review is shown here. Editing saved phone drafts is not supported by the current queue, so make corrections in the original workflow and then remove this copy after review.
      </Text>
    </Card>
  );
}

function SignInGuidance() {
  return (
    <Card style={{ backgroundColor: colors.warningSoft, borderColor: '#F8D37A' }}>
      <Text selectable style={{ ...typography.subtitle, color: colors.warning }}>
        Sign in again before retrying
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.text }}>
        CRM rejected the last retry because the session was expired or not allowed. Refresh the session or sign in again, then retry this phone copy.
      </Text>
    </Card>
  );
}

function RoseDraftSummary({ draft }: { draft: MobileDraft }) {
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

function RouteDraftSummary({ draft }: { draft: MobileDraft }) {
  if (draft.payload.kind !== 'route_visit') return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
        {(draft.payload.stage ?? 'completed') === 'checked_in'
          ? 'Checked-in route visit is saved on this phone. Finish checkout in the Route tab or retry CRM check-in.'
          : 'Route visit will retry with the visit time, notes, and location status saved on this phone.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <DraftMetric label="Check in" value={formatShortTime(draft.payload.checkedInAt)} />
        <DraftMetric label="Check out" value={draft.payload.checkedOutAt ? formatShortTime(draft.payload.checkedOutAt) : 'Not yet'} />
        <DraftMetric label="GPS" value={draft.payload.latitude !== undefined && draft.payload.longitude !== undefined ? 'Captured' : 'Timed only'} />
      </View>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {draft.payload.notes}
      </Text>
    </View>
  );
}

function TrainingDraftSummary({ draft }: { draft: MobileDraft }) {
  if (draft.payload.kind !== 'training_session') return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle }}>
        Training completion will retry with notes, attendee count, proof notes, and any follow-up request saved on this phone.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <DraftMetric label="Attendees" value={String(draft.payload.attendeeCount)} />
        <DraftMetric label="Checked in" value={draft.payload.checkedInAt ? formatShortTime(draft.payload.checkedInAt) : 'Not set'} />
        <DraftMetric label="Proof" value={draft.payload.proofNotes ? 'Noted' : 'Notes only'} />
      </View>
      <Text selectable style={{ ...typography.caption, color: colors.text, fontWeight: '800' }}>
        {draft.payload.sessionTitle}
      </Text>
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

function draftStatusHelp(draft: MobileDraft) {
  const review = getMobileDraftReviewState(draft);
  if (draft.status === 'synced') return 'CRM accepted this update. You can remove the phone copy when you are done reviewing it.';
  if (draft.status === 'syncing') return 'Sending now. Keep the app open until the status changes.';
  if (review.category === 'sign_in_again') return 'Sign in again before retrying this phone copy.';
  if (review.category === 'needs_review') return 'CRM needs this update reviewed before retry. Keep the phone copy until the right CRM record is confirmed.';
  if (review.category === 'ready_to_retry') return 'CRM did not save this update yet. It is ready to retry when the signal is steady.';
  return 'Saved on this phone only. Retry when the signal is steady so CRM users can see it.';
}

function displayDraftDetail(draft: MobileDraft) {
  if (draft.status === 'synced') return 'CRM saved this update. A review copy remains on this phone.';
  if (draft.status === 'failed') return 'This phone copy is still available for review because CRM did not save it.';
  return draft.detail
    .replace(/^CRM sync failed:\s*/i, 'CRM did not save it yet: ')
    .replace(/Draft on this device/i, 'Saved on this phone')
    .replace(/Media upload remains parked/i, 'Photo upload waits for CRM connectivity');
}

function friendlyErrorMessage(message: string) {
  return message
    .replace(/^CRM sync failed:\s*/i, 'CRM did not save it yet: ')
    .replace(/backend endpoint/gi, 'approved photo upload')
    .replace(/mobile sync contract/gi, 'mobile retry setup');
}

function isConflictLike(message?: string) {
  if (!message) return false;
  return /409|conflict|already|newer|stale|completed|changed/i.test(message);
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

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

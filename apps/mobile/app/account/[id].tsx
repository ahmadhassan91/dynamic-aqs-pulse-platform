import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import type { AccountDetail } from '@pulse/contracts/accounts';
import type { OrderDraftSummary } from '@pulse/contracts/orders';
import type { ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import type { AccountTrainingHistoryResponse } from '@pulse/contracts/training';
import { Card, ErrorState, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle, SegmentedTabs } from '@/components/native-kit';
import { createMobileVoiceNote, fetchAccountDetail, fetchAccountOrderDrafts, fetchAccountTrainingHistory, fetchConsignmentSites } from '@/lib/api';
import { formatDate, humanize, initials } from '@/lib/format';
import { formatGroupClassification } from '@/lib/account-map-status';
import { buildMailtoUrl, buildTelUrl, chooseCallNumber } from '@/lib/contact-link';
import { ACCOUNT_DETAIL_TABS, isConsignmentTabEnabled, resolveAccountConsignmentSites, type AccountDetailTabKey } from '@/lib/account-detail-tabs';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

export default function AccountDetailScreen() {
  const { palette: colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { apiBaseUrl, auth } = useSession();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [trainingHistory, setTrainingHistory] = useState<AccountTrainingHistoryResponse | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<OrderDraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AccountDetailTabKey>('overview');
  const [consignmentSites, setConsignmentSites] = useState<ConsignmentSiteSummary[]>([]);

  // UX-M-006 — quick visit-log action
  const [showVisitLog, setShowVisitLog] = useState(false);
  const [visitNote, setVisitNote] = useState('');
  const [isLoggingVisit, setIsLoggingVisit] = useState(false);
  const [visitLogMessage, setVisitLogMessage] = useState<string | null>(null);
  const [visitLogError, setVisitLogError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !id) return;
    setIsLoading(true);
    setErrorMessage(null);
    void Promise.allSettled([
      fetchAccountDetail(apiBaseUrl, auth.tokens.accessToken, id),
      fetchAccountTrainingHistory(apiBaseUrl, auth.tokens.accessToken, id),
    ])
      .then(([accountResponse, trainingResponse]) => {
        if (accountResponse.status === 'fulfilled') setAccount(accountResponse.value);
        if (trainingResponse.status === 'fulfilled') setTrainingHistory(trainingResponse.value);
        const failures = [
          accountResponse.status === 'rejected' ? 'account' : null,
          trainingResponse.status === 'rejected' ? 'training' : null,
        ].filter(Boolean);
        if (failures.length) setErrorMessage(`Unable to load ${failures.join(' and ')} context.`);
      })
      .catch((error) => setErrorMessage(error instanceof Error ? error.message : 'Unable to load account.'))
      .finally(() => setIsLoading(false));
  }, [apiBaseUrl, auth, id]);

  // Refresh the order-drafts list whenever the screen regains focus (e.g. after returning
  // from the order-draft capture screen) so a just-created/submitted/cancelled order shows.
  useFocusEffect(
    useCallback(() => {
      if (!auth || !id) return;
      let cancelled = false;
      void fetchAccountOrderDrafts(apiBaseUrl, auth.tokens.accessToken, { accountId: id, limit: 5 })
        .then((response) => {
          if (!cancelled) setOrderDrafts(response.items);
        })
        .catch(() => {
          // Non-blocking: keep the last-known list if this refresh fails.
        });
      return () => {
        cancelled = true;
      };
    }, [apiBaseUrl, auth, id]),
  );

  // FR-MOB-036 — load this account's consignment sites. The list endpoint has no accountId filter, so
  // narrow by the account's display name (server-side search) and still filter by id client-side
  // (resolveAccountConsignmentSites) to drop name collisions — this keeps the page limit from ever
  // hiding the account's sites. Non-blocking: a failure just leaves the Consignment tab disabled.
  const accountSearchName = account?.displayName;
  useEffect(() => {
    if (!auth || !id) return;
    let cancelled = false;
    void fetchConsignmentSites(apiBaseUrl, auth.tokens.accessToken, {
      includeExited: false,
      limit: 200,
      ...(accountSearchName ? { search: accountSearchName } : {}),
    })
      .then((response) => {
        if (!cancelled) setConsignmentSites(response.items);
      })
      .catch(() => {
        // Non-blocking: Consignment tab stays disabled if this fails.
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, id, accountSearchName]);

  async function handleLogVisit() {
    if (!auth || !id || !visitNote.trim()) return;
    setIsLoggingVisit(true);
    setVisitLogError(null);
    setVisitLogMessage(null);
    try {
      await createMobileVoiceNote(apiBaseUrl, auth.tokens.accessToken, {
        contextType: 'route_visit',
        accountId: id,
        title: `Visit: ${account?.displayName ?? 'Account visit'}`,
        transcriptText: visitNote.trim(),
        recordedAt: new Date().toISOString(),
      });
      setVisitLogMessage('Visit note logged to CRM for office review.');
      setVisitNote('');
      setShowVisitLog(false);
    } catch (error) {
      setVisitLogError(error instanceof Error ? error.message : 'Could not log visit note.');
    } finally {
      setIsLoggingVisit(false);
    }
  }

  const accountConsignmentSites = resolveAccountConsignmentSites(consignmentSites, id ?? '');
  const accountTabs = ACCOUNT_DETAIL_TABS.map((tab) =>
    tab.key === 'consignment' ? { ...tab, disabled: !isConsignmentTabEnabled(accountConsignmentSites) } : tab,
  );

  return (
    <>
      <Stack.Screen options={{ title: account?.displayName ?? 'Account Detail', headerShown: true }} />
      <Screen>
        {isLoading ? <LoadingState label="Loading account..." /> : null}
        {errorMessage ? <ErrorState message={errorMessage} /> : null}
        {account ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.full,
                    backgroundColor: colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primaryDeep, fontSize: 18, fontWeight: '800' }}>{initials(account.displayName)}</Text>
                </View>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text selectable style={{ ...typography.title, color: colors.text }}>
                    {account.displayName}
                  </Text>
                  <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                    {account.accountNumber ?? 'Account number pending'}
                  </Text>
                </View>
                <Pill label={account.lifecycleStatus} tone={account.lifecycleStatus} />
              </View>
            </Card>

            <SegmentedTabs tabs={accountTabs} value={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' ? (
              <>
            {/* UX-M-006 — Quick visit-log action */}
            <SectionTitle title="Visit log" detail="Log a quick note from this visit. The note goes to CRM for office review." />

            {visitLogMessage ? (
              <Card style={{ borderColor: colors.success, backgroundColor: colors.successSoft }}>
                <Text selectable style={{ ...typography.callout, color: colors.success }}>
                  {visitLogMessage}
                </Text>
              </Card>
            ) : null}

            {showVisitLog ? (
              <Card>
                <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                  Account visit note
                </Text>
                <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                  Describe the visit interaction, key observations, or next steps. This note syncs to CRM for office review.
                </Text>
                <TextInput
                  value={visitNote}
                  onChangeText={setVisitNote}
                  multiline
                  placeholder="What happened on this visit? Key contacts, observations, follow-ups..."
                  placeholderTextColor={colors.subtle}
                  style={{
                    minHeight: 100,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    padding: spacing.md,
                    textAlignVertical: 'top',
                    color: colors.text,
                    ...typography.body,
                  }}
                />
                {visitLogError ? (
                  <Text selectable style={{ ...typography.callout, color: colors.danger }}>
                    {visitLogError}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      label="Cancel"
                      icon={{ name: 'xmark.circle', fallback: 'X' }}
                      onPress={() => {
                        setShowVisitLog(false);
                        setVisitNote('');
                        setVisitLogError(null);
                      }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      label={isLoggingVisit ? 'Saving...' : 'Log to CRM'}
                      disabled={!visitNote.trim() || isLoggingVisit}
                      icon={{ name: 'checkmark.circle.fill', fallback: 'OK' }}
                      onPress={() => void handleLogVisit()}
                    />
                  </View>
                </View>
              </Card>
            ) : (
              <SecondaryButton
                label="Log visit note"
                icon={{ name: 'pencil.and.list.clipboard', fallback: 'Log' }}
                onPress={() => setShowVisitLog(true)}
              />
            )}
              </>
            ) : null}

            {activeTab === 'sales' ? (
              <>
            {/* ORD-P4 — order-on-behalf entry point */}
            <SectionTitle title="Order drafts" detail="Place an order for this account. It goes to the office to finalize pricing and place in Acumatica." />
            <Card>
              {orderDrafts.length === 0 ? (
                <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                  No orders yet for this account.
                </Text>
              ) : (
                orderDrafts.map((draft) => (
                  <Pressable
                    key={draft.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open order with ${draft.lineCount} line${draft.lineCount === 1 ? '' : 's'}`}
                    onPress={() => router.push({ pathname: '/order-draft', params: { accountId: id, accountName: account.displayName, draftId: draft.id } })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ ...typography.callout, color: colors.text }}>
                        {draft.lineCount} line{draft.lineCount === 1 ? '' : 's'}{draft.customerPoNumber ? ` · PO ${draft.customerPoNumber}` : ''}
                      </Text>
                      <Text style={{ ...typography.caption, color: colors.muted }}>Updated {formatDate(draft.updatedAt)}</Text>
                    </View>
                    <Pill label={draft.status} tone={draft.status} />
                  </Pressable>
                ))
              )}
              <SecondaryButton
                label="New order"
                icon={{ name: 'cart.fill.badge.plus', fallback: 'New' }}
                onPress={() => router.push({ pathname: '/order-draft', params: { accountId: id, accountName: account.displayName } })}
              />
            </Card>

            <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
              <Text selectable style={{ ...typography.caption, color: colors.muted }}>
                Sales totals (YTD / last year) and invoice history stay parked until the Acumatica feed is approved. Orders placed above flow to the office to finalize pricing in Acumatica.
              </Text>
            </Card>
              </>
            ) : null}

            {activeTab === 'overview' ? (
              <>
            <SectionTitle title="Field ownership" />
            <Card>
              <Row label="Territory" value={account.territoryName ?? 'Not assigned'} />
              <Row label="Region" value={account.regionName ?? 'Not assigned'} />
              <Row label="TM" value={account.assignedTmName ?? 'Unassigned'} />
              <Row label="RD" value={account.assignedRdName ?? 'Unassigned'} />
              <Row label="Shipping center" value={account.shippingCenterName ?? 'Not assigned'} />
            </Card>

            <SectionTitle title="Dealer context" />
            <Card>
              <Row label="Affinity" value={account.affinityGroupName ?? 'None'} />
              <Row label="Ownership / PE" value={account.ownershipGroupName ?? 'None'} />
              <Row label="Classification" value={formatGroupClassification(account.groupClassification) ?? 'Independent/none'} />
              <Row label="Last engagement" value={formatDate(account.lastEngagementAt)} />
            </Card>

            <SectionTitle title="Contacts" detail={`${account.contacts.length} contact${account.contacts.length === 1 ? '' : 's'} on file`} />
            <Card>
              {account.contacts.slice(0, 4).map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
              {!account.contacts.length ? <Row label="No contacts" value="Add contact management in the account slice." /> : null}
            </Card>
              </>
            ) : null}

            {activeTab === 'consignment' ? (
              <>
            <SectionTitle title="Consignment" detail={`${accountConsignmentSites.length} site${accountConsignmentSites.length === 1 ? '' : 's'} for this account`} />
            {accountConsignmentSites.length ? (
              accountConsignmentSites.map((site) => <AccountConsignmentCard key={site.id} site={site} />)
            ) : (
              <Card>
                <Text selectable style={{ ...typography.callout, color: colors.muted }}>
                  No consignment sites are linked to this account.
                </Text>
              </Card>
            )}
            <SecondaryButton label="Open ROSE audits" icon={{ name: 'shippingbox.fill', fallback: 'C' }} onPress={() => router.push('/consignment')} />
              </>
            ) : null}

            {activeTab === 'history' ? (
              <>
            <SectionTitle title="Training" detail="Field-ready training context for upcoming mobile execution." />
            <Card>
              {trainingHistory ? (
                <>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <MiniStat label="Programs" value={String(trainingHistory.activeProgramCount)} />
                    <MiniStat label="Overdue" value={String(trainingHistory.overdueProgramCount)} tone={trainingHistory.overdueProgramCount ? 'warning' : 'normal'} />
                    <MiniStat label="Cert tracks" value={String(trainingHistory.certificationTrackCount)} />
                  </View>
                  <Row label="Last training" value={formatDate(trainingHistory.lastTrainingAt)} />
                  <Row label="Next due" value={formatDate(trainingHistory.nextDueAt)} />
                  {trainingHistory.recentSessions.slice(0, 3).map((session) => (
                    <View key={session.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 2 }}>
                      <Text selectable style={{ ...typography.callout, color: colors.text, fontWeight: '800' }}>
                        {session.title}
                      </Text>
                      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
                        {session.activityKind === 'site_visit' ? 'Site visit' : 'Training'} · {session.executionState.replace(/_/g, ' ')} · {formatDate(session.completedAt ?? session.scheduledAt)}
                      </Text>
                    </View>
                  ))}
                  {!trainingHistory.recentSessions.length ? <Row label="Recent sessions" value="No training or visit history yet." /> : null}
                  <SecondaryButton label="Open training" icon={{ name: 'graduationcap.fill', fallback: 'T' }} onPress={() => router.push('/training')} />
                </>
              ) : (
                <Row label="Training context" value="Not available for this session." />
              )}
            </Card>
              </>
            ) : null}
          </>
        ) : null}
      </Screen>
    </>
  );
}

function MiniStat({ label, tone = 'normal', value }: { label: string; tone?: 'normal' | 'warning'; value: string }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 95, borderRadius: radius.lg, backgroundColor: tone === 'warning' ? colors.warningSoft : colors.surfaceMuted, padding: spacing.md, gap: 2 }}>
      <Text selectable style={{ ...typography.caption, color: tone === 'warning' ? colors.warning : colors.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ ...typography.subtitle, color: colors.text, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

// FR-MOB-035 — per-contact tap-to-call / tap-to-email. URL building is in the pure contact-link
// helper (unit-tested); here we only fire Linking.openURL when the helper returns a usable URL.
function ContactRow({ contact }: { contact: AccountDetail['contacts'][number] }) {
  const { palette: colors } = useTheme();
  const telUrl = buildTelUrl(chooseCallNumber(contact));
  const mailUrl = buildMailtoUrl(contact.email);
  const subtitle = contact.email ?? chooseCallNumber(contact) ?? 'No direct contact';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable style={{ ...typography.callout, color: colors.text, fontWeight: '700' }}>
          {contact.firstName} {contact.lastName}
        </Text>
        <Text selectable style={{ ...typography.caption, color: colors.muted }}>
          {subtitle}
        </Text>
      </View>
      <ContactAction
        label={`Call ${contact.firstName} ${contact.lastName}`}
        icon="phone.fill"
        disabled={!telUrl}
        onPress={() => {
          if (telUrl) void Linking.openURL(telUrl);
        }}
      />
      <ContactAction
        label={`Email ${contact.firstName} ${contact.lastName}`}
        icon="envelope.fill"
        disabled={!mailUrl}
        onPress={() => {
          if (mailUrl) void Linking.openURL(mailUrl);
        }}
      />
    </View>
  );
}

function ContactAction({ disabled, icon, label, onPress }: { disabled: boolean; icon: string; label: string; onPress: () => void }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 42,
        height: 42,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled ? colors.surfaceMuted : colors.primarySoft,
        opacity: disabled ? 0.55 : 1,
        borderCurve: 'continuous',
      }}
    >
      <NativeIcon name={icon} color={disabled ? colors.subtle : colors.primaryDeep} size={18} />
    </Pressable>
  );
}

// FR-MOB-036 — compact per-site consignment summary on the account's Consignment tab.
function AccountConsignmentCard({ site }: { site: ConsignmentSiteSummary }) {
  const { palette: colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {site.name}
          </Text>
          <Text selectable style={{ ...typography.caption, color: colors.muted }}>
            {site.territoryName ?? site.locationName ?? 'Territory pending'}
          </Text>
        </View>
        <Pill label={humanize(site.status)} tone={site.status} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <MiniStat label="Open work" value={String(site.openWorkItemCount)} tone={site.openWorkItemCount > 0 ? 'warning' : 'normal'} />
        <MiniStat label="Discrepancies" value={String(site.openDiscrepancyCount)} tone={site.openDiscrepancyCount > 0 ? 'warning' : 'normal'} />
      </View>
      <Row label="Last audit" value={formatDate(site.lastAuditCompletedAt)} />
      <Row label="Next audit" value={formatDate(site.nextAuditDueAt)} />
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text selectable style={{ ...typography.caption, color: colors.subtle, textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ ...typography.callout, color: colors.text }}>
        {value}
      </Text>
    </View>
  );
}

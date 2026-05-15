import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type { ConsignmentAuditSummary, ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SearchField, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { fetchConsignmentSiteDetail, updateConsignmentAudit } from '@/lib/api';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

export default function ConsignmentScreen() {
  const { apiBaseUrl, auth } = useSession();
  const { consignmentSites, consignmentWorkItems, errorMessage, isLoading, reload } = useFieldData(50);
  const [query, setQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<ConsignmentSiteSummary | null>(null);
  const [activeAudit, setActiveAudit] = useState<ConsignmentAuditSummary | null>(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const filteredSites = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const ordered = [...consignmentSites].sort((left, right) => {
      const leftDue = left.nextAuditDueAt ? new Date(left.nextAuditDueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDue = right.nextAuditDueAt ? new Date(right.nextAuditDueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftDue - rightDue;
    });
    if (!needle) return ordered;
    return ordered.filter((site) => [
      site.accountName,
      site.name,
      site.warehouseCode,
      site.ownerTmName,
      site.territoryName,
      site.regionName,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)));
  }, [consignmentSites, query]);

  async function openRoseAudit(site: ConsignmentSiteSummary) {
    if (!auth) return;
    setAuditError(null);
    setAuditMessage(null);
    setSelectedSite(site);
    setActiveAudit(null);
    setNotes('');
    setActualQuantity('');
    try {
      const detail = await fetchConsignmentSiteDetail(apiBaseUrl, auth.tokens.accessToken, site.id);
      const audit = detail.audits.find((item) => item.status === 'scheduled' || item.status === 'in_progress') ?? detail.audits[0] ?? null;
      setActiveAudit(audit);
      if (!audit) {
        setAuditError('No ROSE audit is scheduled for this site yet. Schedule it in CRM before field execution.');
      }
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Unable to load consignment audit.');
    }
  }

  async function submitRoseAudit() {
    if (!auth || !activeAudit || !notes.trim()) return;
    const quantity = Number(actualQuantity);
    const quantityIsValid = Number.isFinite(quantity) && quantity >= 0;
    setIsSubmitting(true);
    setAuditError(null);
    setAuditMessage(null);
    try {
      await updateConsignmentAudit(apiBaseUrl, auth.tokens.accessToken, activeAudit.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        reconciliationStatus: quantityIsValid ? 'true_up_confirmed' : 'open',
        notes: notes.trim(),
        lines: [
          ({
            productName: 'Mobile ROSE field count',
            ...(quantityIsValid ? { actualQuantity: quantity } : {}),
            notes: notes.trim(),
          }),
        ],
      });
      setAuditMessage('ROSE audit submitted to CRM. Any variance/PO follow-up remains in the consignment work queue.');
      setSelectedSite(null);
      setActiveAudit(null);
      setNotes('');
      setActualQuantity('');
      await reload();
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Unable to submit ROSE audit.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <HeroCard title="Consignment" eyebrow="ROSE field audit" icon={{ name: 'shippingbox.fill', fallback: 'C' }}>
        <Text selectable style={{ ...typography.callout, color: '#D7E7FF' }}>
          Mobile queue for on-site ROSE audits, due sites, manual counts, and CRM-synced follow-up.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <MiniMetric label="Due sites" value={String(consignmentSites.length)} />
          <MiniMetric label="Work" value={String(consignmentWorkItems.length)} />
        </View>
      </HeroCard>

      <SearchField value={query} onChangeText={setQuery} placeholder="Search site, account, TM, territory..." />

      {errorMessage ? <ErrorState message={errorMessage} /> : null}
      {auditError ? <ErrorState message={auditError} /> : null}
      {isLoading ? <LoadingState label="Loading consignment CRM queue..." /> : null}
      {auditMessage ? (
        <Card style={{ borderColor: '#B7E4C7', backgroundColor: '#F3FFF7' }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.success }}>
            Synced
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.text }}>
            {auditMessage}
          </Text>
        </Card>
      ) : null}

      {selectedSite ? (
        <RoseAuditCard
          actualQuantity={actualQuantity}
          audit={activeAudit}
          isSubmitting={isSubmitting}
          notes={notes}
          onActualQuantityChange={setActualQuantity}
          onCancel={() => {
            setSelectedSite(null);
            setActiveAudit(null);
            setNotes('');
            setActualQuantity('');
          }}
          onNotesChange={setNotes}
          onSubmit={() => void submitRoseAudit()}
          site={selectedSite}
        />
      ) : null}

      <SectionTitle title="Audit queue" detail="Due and active sites come from CRM. Expected inventory remains Acumatica-dependent when source freshness is parked or stale." />
      <View style={{ gap: spacing.md }}>
        {filteredSites.map((site) => (
          <ConsignmentSiteCard key={site.id} site={site} onOpen={() => void openRoseAudit(site)} />
        ))}
      </View>

      {!filteredSites.length && !isLoading ? (
        <EmptyState title="No consignment sites" detail="No due or visible consignment sites were returned for this mobile session." />
      ) : null}

      <SectionTitle title="CRM sync boundary" />
      <Card style={{ backgroundColor: colors.surfaceMuted }}>
        <Text selectable style={{ ...typography.callout, color: colors.text }}>
          Mobile is synced with Pulse CRM for sites, audit due dates, work items, and audit submission. Acumatica warehouse creation, authoritative expected inventory, PO posting, and final financial reconciliation stay parked until access and mappings are approved.
        </Text>
      </Card>
    </Screen>
  );
}

function ConsignmentSiteCard({ onOpen, site }: { onOpen: () => void; site: ConsignmentSiteSummary }) {
  const acumaticaTone = site.acumaticaStatus === 'available' ? 'active' : 'review';
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {site.accountName}
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            {site.name} · {site.territoryName ?? site.regionName ?? 'No territory'}
          </Text>
        </View>
        <Pill label={humanize(site.status)} tone={site.status} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <FieldChip label="Next ROSE" value={formatDate(site.nextAuditDueAt)} />
        <FieldChip label="TM" value={site.ownerTmName ?? 'Unassigned'} />
        <FieldChip label="Warehouse" value={site.warehouseCode ?? site.acumaticaWarehouseId ?? 'Pending'} />
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'center' }}>
        <Pill label={`Acumatica ${humanize(site.acumaticaStatus)}`} tone={acumaticaTone} />
        <SecondaryButton label="Start ROSE" icon={{ name: 'checklist', fallback: 'R' }} onPress={onOpen} />
      </View>
    </Card>
  );
}

function RoseAuditCard({
  actualQuantity,
  audit,
  isSubmitting,
  notes,
  onActualQuantityChange,
  onCancel,
  onNotesChange,
  onSubmit,
  site,
}: {
  actualQuantity: string;
  audit: ConsignmentAuditSummary | null;
  isSubmitting: boolean;
  notes: string;
  onActualQuantityChange: (value: string) => void;
  onCancel: () => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  site: ConsignmentSiteSummary;
}) {
  return (
    <Card style={{ borderColor: colors.primarySoft }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.caption, color: colors.primary, textTransform: 'uppercase' }}>
            ROSE audit
          </Text>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            {site.accountName}
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            {audit ? `Scheduled ${formatDateTime(audit.scheduledFor)}` : 'No scheduled audit loaded'}
          </Text>
        </View>
        <NativeIcon name="doc.text.viewfinder" fallback="R" color={colors.primary} size={22} />
      </View>

      {audit ? (
        <>
          <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
            <Text selectable style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
              Expected inventory source
            </Text>
            <Text selectable style={{ ...typography.callout, color: colors.text }}>
              {audit.expectedSource} · {audit.sourceFreshnessLabel}
            </Text>
            <Text selectable style={{ ...typography.caption, color: colors.warning }}>
              Verify manually when Acumatica source is parked/stale.
            </Text>
          </Card>
          <TextInput
            value={actualQuantity}
            onChangeText={onActualQuantityChange}
            keyboardType="numeric"
            placeholder="Actual count total"
            placeholderTextColor={colors.subtle}
            style={{
              minHeight: 48,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.md,
              color: colors.text,
              ...typography.body,
            }}
          />
          <TextInput
            value={notes}
            onChangeText={onNotesChange}
            multiline
            placeholder="Count notes, missing items, PO follow-up, photos taken..."
            placeholderTextColor={colors.subtle}
            style={{
              minHeight: 112,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: spacing.md,
              color: colors.text,
              textAlignVertical: 'top',
              ...typography.body,
            }}
          />
          <PrimaryButton label={isSubmitting ? 'Submitting...' : 'Submit ROSE to CRM'} disabled={isSubmitting || !notes.trim()} icon={{ name: 'paperplane.fill', fallback: 'Go' }} onPress={onSubmit} />
        </>
      ) : null}
      <SecondaryButton label="Cancel" icon={{ name: 'xmark.circle.fill', fallback: 'X' }} onPress={onCancel} />
    </Card>
  );
}

function FieldChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ borderRadius: radius.full, backgroundColor: colors.surfaceMuted, paddingHorizontal: 10, paddingVertical: 7 }}>
      <Text selectable style={{ ...typography.caption, color: colors.muted }}>
        {label}: {value}
      </Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', padding: spacing.md, gap: 2, borderCurve: 'continuous' }}>
      <Text selectable style={{ ...typography.caption, color: '#BFDBFE', textTransform: 'uppercase' }}>
        {label}
      </Text>
      <Text selectable style={{ fontSize: 24, lineHeight: 29, fontWeight: '800', color: colors.textInverse, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

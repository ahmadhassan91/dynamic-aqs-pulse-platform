import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ConsignmentAuditSummary, ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SearchField, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { fetchConsignmentSiteDetail, updateConsignmentAudit } from '@/lib/api';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import { enqueueDraft, type RoseAttestationMetadata, type RoseEvidenceMetadata } from '@/lib/mobile-draft-queue';
import { mimeTypeFromFileName } from '@/lib/media';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { colors, radius, spacing, typography } from '@/theme';

type RoseEvidenceItem = RoseEvidenceMetadata & {
  previewUri?: string;
};

export default function ConsignmentScreen() {
  const { apiBaseUrl, auth } = useSession();
  const { consignmentSites, consignmentWorkItems, errorMessage, isLoading, reload } = useFieldData(50);
  const [query, setQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<ConsignmentSiteSummary | null>(null);
  const [activeAudit, setActiveAudit] = useState<ConsignmentAuditSummary | null>(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceItems, setEvidenceItems] = useState<RoseEvidenceItem[]>([]);
  const [attestedByName, setAttestedByName] = useState('');
  const [isAttested, setIsAttested] = useState(false);
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
    setEvidenceItems([]);
    setAttestedByName('');
    setIsAttested(false);
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
    if (!auth || !activeAudit || !notes.trim() || !attestedByName.trim() || !isAttested || !isValidRoseCount(actualQuantity)) return;
    const quantity = Number(actualQuantity);
    const quantityIsValid = Number.isFinite(quantity) && quantity >= 0;
    const completedAt = new Date().toISOString();
    const evidenceMetadata = evidenceItems.map(({ previewUri, ...item }) => item);
    const attestation: RoseAttestationMetadata = {
      attestedByName: attestedByName.trim(),
      attestedAt: completedAt,
      textVersion: 'rose-field-v1',
    };
    const notesWithEvidence = buildRoseAuditNotes(notes.trim(), attestation, evidenceMetadata);
    setIsSubmitting(true);
    setAuditError(null);
    setAuditMessage(null);
    const request = {
        status: 'completed',
        completedAt,
        reconciliationStatus: quantityIsValid ? 'true_up_confirmed' : 'open',
        notes: notesWithEvidence,
        lines: [
          ({
            productName: 'Mobile ROSE field count',
            ...(quantityIsValid ? { actualQuantity: quantity } : {}),
            notes: notesWithEvidence,
          }),
        ],
      } satisfies Parameters<typeof updateConsignmentAudit>[3];

    try {
      await updateConsignmentAudit(apiBaseUrl, auth.tokens.accessToken, activeAudit.id, request);
      setAuditMessage('ROSE audit submitted to CRM. Any variance/PO follow-up remains in the consignment work queue.');
      setSelectedSite(null);
      setActiveAudit(null);
      setNotes('');
      setActualQuantity('');
      setEvidenceItems([]);
      setAttestedByName('');
      setIsAttested(false);
      await reload();
    } catch (error) {
      enqueueDraft({
        kind: 'consignment_rose_audit',
        title: `ROSE audit: ${selectedSite?.accountName ?? 'Consignment site'}`,
        detail: 'Saved as a draft on this device because CRM sync was unavailable.',
        payload: {
          kind: 'consignment_rose_audit',
          auditId: activeAudit.id,
          siteId: activeAudit.siteId,
          accountName: selectedSite?.accountName ?? 'Consignment site',
          request,
          evidence: {
            items: evidenceMetadata,
            mediaUploadStatus: 'parked_until_backend_endpoint',
          },
          attestation,
        },
      });
      setAuditMessage('Saved as a draft on this device. Retry from Sync when CRM is reachable.');
      setSelectedSite(null);
      setActiveAudit(null);
      setNotes('');
      setActualQuantity('');
      setEvidenceItems([]);
      setAttestedByName('');
      setIsAttested(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addRoseEvidence(useCamera: boolean) {
    setAuditError(null);
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Camera access is required to add ROSE evidence.');
        }
      }

      const picked = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.65, base64: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.65, base64: false });

      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const fileName = asset.fileName ?? `rose-evidence-${Date.now()}.jpg`;
      setEvidenceItems((items) => [
        ...items,
        {
          id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileName,
          mimeType: asset.mimeType ?? mimeTypeFromFileName(fileName),
          purpose: 'general',
          capturedAt: new Date().toISOString(),
          ...(asset.fileSize !== undefined ? { byteSize: asset.fileSize } : {}),
          previewUri: asset.uri,
        },
      ]);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Unable to add ROSE evidence.');
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
            {auditMessage.startsWith('Saved as a draft') ? 'Draft on phone' : 'CRM saved'}
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.text }}>
            {auditMessage}
          </Text>
        </Card>
      ) : null}

      {selectedSite ? (
        <RoseAuditCard
          actualQuantity={actualQuantity}
          attestedByName={attestedByName}
          audit={activeAudit}
          evidenceItems={evidenceItems}
          isAttested={isAttested}
          isSubmitting={isSubmitting}
          notes={notes}
          onAddEvidence={(useCamera) => void addRoseEvidence(useCamera)}
          onActualQuantityChange={setActualQuantity}
          onAttestedByNameChange={setAttestedByName}
          onCancel={() => {
            setSelectedSite(null);
            setActiveAudit(null);
            setNotes('');
            setActualQuantity('');
            setEvidenceItems([]);
            setAttestedByName('');
            setIsAttested(false);
          }}
          onRemoveEvidence={(id) => setEvidenceItems((items) => items.filter((item) => item.id !== id))}
          onToggleAttestation={() => setIsAttested((value) => !value)}
          onToggleEvidencePurpose={(id) => setEvidenceItems((items) => items.map((item) => item.id === id ? { ...item, purpose: item.purpose === 'general' ? 'discrepancy' : 'general' } : item))}
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
  attestedByName,
  audit,
  evidenceItems,
  isAttested,
  isSubmitting,
  notes,
  onAddEvidence,
  onActualQuantityChange,
  onAttestedByNameChange,
  onCancel,
  onRemoveEvidence,
  onToggleAttestation,
  onToggleEvidencePurpose,
  onNotesChange,
  onSubmit,
  site,
}: {
  actualQuantity: string;
  attestedByName: string;
  audit: ConsignmentAuditSummary | null;
  evidenceItems: RoseEvidenceItem[];
  isAttested: boolean;
  isSubmitting: boolean;
  notes: string;
  onAddEvidence: (useCamera: boolean) => void;
  onActualQuantityChange: (value: string) => void;
  onAttestedByNameChange: (value: string) => void;
  onCancel: () => void;
  onRemoveEvidence: (id: string) => void;
  onToggleAttestation: () => void;
  onToggleEvidencePurpose: (id: string) => void;
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
            placeholder="Actual count total required"
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
          <EvidenceCaptureSection
            evidenceItems={evidenceItems}
            onAddEvidence={onAddEvidence}
            onRemoveEvidence={onRemoveEvidence}
            onToggleEvidencePurpose={onToggleEvidencePurpose}
          />
          <Text selectable style={{ ...typography.caption, color: colors.warning }}>
            Photos are preview-only in this slice. CRM receives evidence metadata in notes; media upload is parked until the backend evidence endpoint is approved.
          </Text>
          <AttestationSection
            attestedByName={attestedByName}
            isAttested={isAttested}
            onAttestedByNameChange={onAttestedByNameChange}
            onToggleAttestation={onToggleAttestation}
          />
          <PrimaryButton label={isSubmitting ? 'Submitting...' : 'Submit ROSE to CRM'} disabled={isSubmitting || !notes.trim() || !attestedByName.trim() || !isAttested || !isValidRoseCount(actualQuantity)} icon={{ name: 'paperplane.fill', fallback: 'Go' }} onPress={onSubmit} />
        </>
      ) : null}
      <SecondaryButton label="Cancel" icon={{ name: 'xmark.circle.fill', fallback: 'X' }} onPress={onCancel} />
    </Card>
  );
}

function EvidenceCaptureSection({
  evidenceItems,
  onAddEvidence,
  onRemoveEvidence,
  onToggleEvidencePurpose,
}: {
  evidenceItems: RoseEvidenceItem[];
  onAddEvidence: (useCamera: boolean) => void;
  onRemoveEvidence: (id: string) => void;
  onToggleEvidencePurpose: (id: string) => void;
}) {
  return (
    <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Evidence
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            Add photos for the audit record. Media upload is parked; metadata and attestation stay with the ROSE draft.
          </Text>
        </View>
        <Pill label={`${evidenceItems.length} photo${evidenceItems.length === 1 ? '' : 's'}`} tone={evidenceItems.length ? 'active' : 'pending'} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Camera" icon={{ name: 'camera.fill', fallback: 'C' }} onPress={() => onAddEvidence(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Gallery" icon={{ name: 'photo.on.rectangle.angled', fallback: 'G' }} onPress={() => onAddEvidence(false)} />
        </View>
      </View>

      {evidenceItems.map((item) => (
        <View key={item.id} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
          {item.previewUri ? <Image source={{ uri: item.previewUri }} style={{ width: 54, height: 54, borderRadius: radius.md, backgroundColor: colors.border }} contentFit="cover" /> : null}
          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable style={{ ...typography.callout, color: colors.text, fontWeight: '800' }}>
              {item.fileName}
            </Text>
            <Text selectable style={{ ...typography.caption, color: colors.muted }}>
              {item.purpose === 'discrepancy' ? 'Discrepancy evidence' : 'General audit evidence'}
            </Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text onPress={() => onToggleEvidencePurpose(item.id)} style={{ ...typography.caption, color: colors.primary, fontWeight: '800' }}>
              {item.purpose === 'discrepancy' ? 'General' : 'Discrepancy'}
            </Text>
            <Text onPress={() => onRemoveEvidence(item.id)} style={{ ...typography.caption, color: colors.danger, fontWeight: '800' }}>
              Remove
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

function AttestationSection({
  attestedByName,
  isAttested,
  onAttestedByNameChange,
  onToggleAttestation,
}: {
  attestedByName: string;
  isAttested: boolean;
  onAttestedByNameChange: (value: string) => void;
  onToggleAttestation: () => void;
}) {
  return (
    <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
      <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
        Attestation
      </Text>
      <TextInput
        value={attestedByName}
        onChangeText={onAttestedByNameChange}
        placeholder="Your name"
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
      <Pressable onPress={onToggleAttestation} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ width: 26, height: 26, borderRadius: radius.sm, borderWidth: 1, borderColor: isAttested ? colors.primary : colors.border, backgroundColor: isAttested ? colors.primary : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          {isAttested ? <NativeIcon name="checkmark" fallback="OK" color={colors.white} size={14} /> : null}
        </View>
        <Text selectable style={{ ...typography.callout, color: colors.text, flex: 1 }}>
          I completed this on-site ROSE audit and verified the count to the best of my knowledge.
        </Text>
      </Pressable>
    </Card>
  );
}

function buildRoseAuditNotes(notes: string, attestation: RoseAttestationMetadata, evidenceItems: RoseEvidenceMetadata[]) {
  const evidenceSummary = evidenceItems.length
    ? `${evidenceItems.length} photo metadata item${evidenceItems.length === 1 ? '' : 's'} captured (${evidenceItems.filter((item) => item.purpose === 'discrepancy').length} discrepancy). Media upload parked until backend evidence endpoint is approved.`
    : 'No photos attached. Media upload parked until backend evidence endpoint is approved.';
  return [
    notes,
    `TM attestation: ${attestation.attestedByName} at ${formatDateTime(attestation.attestedAt)}.`,
    evidenceSummary,
  ].join('\n\n');
}

function isValidRoseCount(value: string) {
  const count = Number(value);
  return value.trim().length > 0 && Number.isFinite(count) && count >= 0;
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

import { Image } from 'expo-image';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ConsignmentAuditSummary, ConsignmentSiteSummary } from '@pulse/contracts/consignment';
import { Card, EmptyState, ErrorState, HeroCard, LoadingState, NativeIcon, Pill, PrimaryButton, Screen, SearchField, SecondaryButton, SectionTitle } from '@/components/native-kit';
import { formatDate, formatDateTime, humanize } from '@/lib/format';
import {
  areRoseLineCountsValid,
  formatQuantity,
  formatSignedQuantity,
  isValidRoseCount,
  parseRoseQuantity,
  summarizeVariance,
  useConsignmentRoseAudit,
  type RoseEvidenceItem,
  type RoseLineCount,
  type RoseVarianceSummary,
} from '@/hooks/use-consignment-rose-audit';
import { colors, radius, spacing, typography } from '@/theme';

export default function ConsignmentScreen() {
  const {
    activeAudit,
    addRoseEvidence,
    attestedByName,
    auditError,
    auditMessage,
    closeAudit,
    consignmentSites,
    consignmentWorkItems,
    errorMessage,
    evidenceItems,
    filteredSites,
    isAttested,
    isLoading,
    isSubmitting,
    lineCounts,
    notes,
    openRoseAudit,
    query,
    selectedSite,
    setAttestedByName,
    setEvidenceItems,
    setIsAttested,
    setLineCounts,
    setNotes,
    setQuery,
    submitRoseAudit,
  } = useConsignmentRoseAudit();

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
            {auditMessage.startsWith('Draft on phone') ? 'Draft on phone' : 'CRM saved'}
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.text }}>
            {auditMessage}
          </Text>
        </Card>
      ) : null}

      {selectedSite ? (
        <RoseAuditCard
          attestedByName={attestedByName}
          audit={activeAudit}
          evidenceItems={evidenceItems}
          isAttested={isAttested}
          isSubmitting={isSubmitting}
          lineCounts={lineCounts}
          notes={notes}
          onAddEvidence={(useCamera) => void addRoseEvidence(useCamera)}
          onAttestedByNameChange={setAttestedByName}
          onCancel={closeAudit}
          onRemoveEvidence={(id) => setEvidenceItems((items) => items.filter((item) => item.id !== id))}
          onLineActualQuantityChange={(lineId, value) => setLineCounts((items) => items.map((item) => item.lineId === lineId ? { ...item, actualQuantity: value } : item))}
          onLineNotesChange={(lineId, value) => setLineCounts((items) => items.map((item) => item.lineId === lineId ? { ...item, notes: value } : item))}
          onToggleAttestation={() => setIsAttested((value) => !value)}
          onToggleEvidencePurpose={(id) => setEvidenceItems((items) => items.map((item) => item.id === id ? { ...item, purpose: item.purpose === 'general' ? 'discrepancy' : 'general' } : item))}
          onNotesChange={setNotes}
          onSubmit={() => void submitRoseAudit()}
          site={selectedSite}
        />
      ) : null}

      <SectionTitle title="Audit queue" detail="Due and active sites come from CRM. Expected quantities may be missing or stale until Acumatica data is available." />
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
          Mobile sends the ROSE audit, counts, notes, and evidence to Pulse CRM. Inventory values from Acumatica may be unavailable or stale; PO posting and finance reconciliation happen outside the mobile app until those integrations are approved.
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
  attestedByName,
  audit,
  evidenceItems,
  isAttested,
  isSubmitting,
  lineCounts,
  notes,
  onAddEvidence,
  onAttestedByNameChange,
  onCancel,
  onLineActualQuantityChange,
  onLineNotesChange,
  onRemoveEvidence,
  onToggleAttestation,
  onToggleEvidencePurpose,
  onNotesChange,
  onSubmit,
  site,
}: {
  attestedByName: string;
  audit: ConsignmentAuditSummary | null;
  evidenceItems: RoseEvidenceItem[];
  isAttested: boolean;
  isSubmitting: boolean;
  lineCounts: RoseLineCount[];
  notes: string;
  onAddEvidence: (useCamera: boolean) => void;
  onAttestedByNameChange: (value: string) => void;
  onCancel: () => void;
  onLineActualQuantityChange: (lineId: string, value: string) => void;
  onLineNotesChange: (lineId: string, value: string) => void;
  onRemoveEvidence: (id: string) => void;
  onToggleAttestation: () => void;
  onToggleEvidencePurpose: (id: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  site: ConsignmentSiteSummary;
}) {
  const varianceSummary = summarizeVariance(lineCounts);
  const submitBlocker = getRoseSubmitBlocker({ attestedByName, isAttested, isSubmitting, lineCounts, notes });
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
          <RoseLineCountSection
            lineCounts={lineCounts}
            onActualQuantityChange={onLineActualQuantityChange}
            onNotesChange={onLineNotesChange}
            varianceSummary={varianceSummary}
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
            disabled={isSubmitting}
            evidenceItems={evidenceItems}
            onAddEvidence={onAddEvidence}
            onRemoveEvidence={onRemoveEvidence}
            onToggleEvidencePurpose={onToggleEvidencePurpose}
          />
          <Text selectable style={{ ...typography.caption, color: colors.warning }}>
            Photos upload with the audit when CRM is reachable. Offline drafts keep counts, notes, attestation, and photo metadata only.
          </Text>
          <AttestationSection
            attestedByName={attestedByName}
            isAttested={isAttested}
            onAttestedByNameChange={onAttestedByNameChange}
            onToggleAttestation={onToggleAttestation}
          />
          {submitBlocker ? (
            <Text selectable style={{ ...typography.caption, color: colors.warning }}>
              {submitBlocker}
            </Text>
          ) : null}
          <PrimaryButton label={isSubmitting ? 'Submitting...' : 'Submit ROSE to CRM'} disabled={Boolean(submitBlocker)} icon={{ name: 'paperplane.fill', fallback: 'Go' }} onPress={onSubmit} />
        </>
      ) : null}
      <SecondaryButton label="Cancel" icon={{ name: 'xmark.circle.fill', fallback: 'X' }} onPress={onCancel} />
    </Card>
  );
}

function RoseLineCountSection({
  lineCounts,
  onActualQuantityChange,
  onNotesChange,
  varianceSummary,
}: {
  lineCounts: RoseLineCount[];
  onActualQuantityChange: (lineId: string, value: string) => void;
  onNotesChange: (lineId: string, value: string) => void;
  varianceSummary: RoseVarianceSummary;
}) {
  return (
    <Card style={{ backgroundColor: colors.surfaceMuted, boxShadow: 'none' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
            Count items
          </Text>
          <Text selectable style={{ ...typography.callout, color: colors.muted }}>
            Enter what is physically on site. Variance is previewed before the audit is sent.
          </Text>
        </View>
        <Pill label={varianceSummary.hasVariance ? 'Variance' : 'Balanced'} tone={varianceSummary.hasVariance ? 'review' : 'active'} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <FieldChip label="Expected" value={formatQuantity(varianceSummary.expectedTotal)} />
        <FieldChip label="Actual" value={formatQuantity(varianceSummary.actualTotal)} />
        <FieldChip label="Variance" value={formatSignedQuantity(varianceSummary.varianceTotal)} />
      </View>

      {lineCounts.map((line, index) => {
        const actual = parseRoseQuantity(line.actualQuantity);
        const variance = actual !== null && line.expectedQuantity !== undefined ? actual - line.expectedQuantity : null;
        return (
          <Card key={line.lineId} style={{ backgroundColor: colors.surface, boxShadow: 'none' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={{ ...typography.subtitle, color: colors.text }}>
                  {line.productName || `ROSE item ${index + 1}`}
                </Text>
                <Text selectable style={{ ...typography.caption, color: colors.muted }}>
                  {[line.sku ? `SKU ${line.sku}` : null, line.barcode ? `Barcode ${line.barcode}` : null].filter(Boolean).join(' · ') || 'No SKU/barcode'}
                </Text>
              </View>
              <Pill label={variance === null ? 'Count needed' : variance === 0 ? 'OK' : formatSignedQuantity(variance)} tone={variance === null ? 'pending' : variance === 0 ? 'active' : 'review'} />
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Text selectable style={{ ...typography.caption, color: colors.subtle, textTransform: 'uppercase' }}>
                  Expected
                </Text>
                <Text selectable style={{ ...typography.title, color: colors.text, fontVariant: ['tabular-nums'] }}>
                  {formatQuantity(line.expectedQuantity)}
                </Text>
              </View>
              <View style={{ flex: 1.4, gap: spacing.xs }}>
                <Text selectable style={{ ...typography.caption, color: colors.subtle, textTransform: 'uppercase' }}>
                  Actual count
                </Text>
                <TextInput
                  value={line.actualQuantity}
                  onChangeText={(value) => onActualQuantityChange(line.lineId, value)}
                  keyboardType="numeric"
                  placeholder="Required"
                  placeholderTextColor={colors.subtle}
                  style={{
                    minHeight: 48,
                    borderRadius: radius.lg,
                    borderWidth: 1,
                    borderColor: isValidRoseCount(line.actualQuantity) ? colors.border : colors.warning,
                    backgroundColor: colors.surface,
                    paddingHorizontal: spacing.md,
                    color: colors.text,
                    ...typography.body,
                  }}
                />
              </View>
            </View>

            {variance !== null && variance !== 0 ? (
              <Text selectable style={{ ...typography.caption, color: colors.warning }}>
                Variance preview: {formatSignedQuantity(variance)}. Add a note if a PO, transfer, or discrepancy follow-up is needed.
              </Text>
            ) : null}

            <TextInput
              value={line.notes}
              onChangeText={(value) => onNotesChange(line.lineId, value)}
              placeholder="Optional item note"
              placeholderTextColor={colors.subtle}
              style={{
                minHeight: 46,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                paddingHorizontal: spacing.md,
                color: colors.text,
                ...typography.body,
              }}
            />
          </Card>
        );
      })}
    </Card>
  );
}

function EvidenceCaptureSection({
  disabled,
  evidenceItems,
  onAddEvidence,
  onRemoveEvidence,
  onToggleEvidencePurpose,
}: {
  disabled: boolean;
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
            Add up to three photos. They upload to CRM with the audit; if the app is offline, counts and photo metadata stay in the phone draft.
          </Text>
        </View>
        <Pill label={`${evidenceItems.length} photo${evidenceItems.length === 1 ? '' : 's'}`} tone={evidenceItems.length ? 'active' : 'pending'} />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Camera" disabled={disabled} icon={{ name: 'camera.fill', fallback: 'C' }} onPress={() => onAddEvidence(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <SecondaryButton label="Gallery" disabled={disabled} icon={{ name: 'photo.on.rectangle.angled', fallback: 'G' }} onPress={() => onAddEvidence(false)} />
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
              {item.purpose === 'discrepancy' ? 'Discrepancy evidence' : 'General audit evidence'} · {item.uploadStatus === 'crm_saved' ? 'Uploaded to CRM' : 'Ready to upload'}
            </Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text onPress={disabled ? undefined : () => onToggleEvidencePurpose(item.id)} style={{ ...typography.caption, color: disabled ? colors.subtle : colors.primary, fontWeight: '800' }}>
              {item.purpose === 'discrepancy' ? 'General' : 'Discrepancy'}
            </Text>
            <Text onPress={disabled ? undefined : () => onRemoveEvidence(item.id)} style={{ ...typography.caption, color: disabled ? colors.subtle : colors.danger, fontWeight: '800' }}>
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

function getRoseSubmitBlocker(input: {
  attestedByName: string;
  isAttested: boolean;
  isSubmitting: boolean;
  lineCounts: RoseLineCount[];
  notes: string;
}) {
  if (input.isSubmitting) return 'Sending audit to CRM. Keep this screen open until it finishes.';
  if (!areRoseLineCountsValid(input.lineCounts)) return 'Enter an actual count for every ROSE item.';
  if (!input.notes.trim()) return 'Add a short audit note before submitting.';
  if (!input.attestedByName.trim()) return 'Enter your name for the audit attestation.';
  if (!input.isAttested) return 'Confirm the on-site attestation before submitting.';
  return null;
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

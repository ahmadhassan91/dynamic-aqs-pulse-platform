import * as ImagePicker from 'expo-image-picker';
import { useMemo, useRef, useState } from 'react';
import type { ConsignmentAuditLineSummary, ConsignmentAuditSummary, ConsignmentSiteSummary, UpdateConsignmentAuditRequest } from '@pulse/contracts/consignment';
import { fetchConsignmentSiteDetail, updateConsignmentAudit, uploadConsignmentAuditEvidenceRecord } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { describeDraftSaveFailure, enqueueDraftDurably, type RoseAttestationMetadata, type RoseEvidenceMetadata } from '@/lib/mobile-draft-queue';
import { mimeTypeFromFileName, uriToBase64 } from '@/lib/media';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';

export type RoseEvidenceItem = RoseEvidenceMetadata & {
  contentBase64?: string;
  previewUri?: string;
  crmEvidenceId?: string;
  uploadStatus?: 'crm_saved' | 'metadata_only';
};

export type RoseLineCount = {
  lineId: string;
  sku?: string;
  barcode?: string;
  productName: string;
  expectedQuantity?: number;
  actualQuantity: string;
  notes: string;
};

export type RoseVarianceSummary = {
  expectedTotal: number | undefined;
  actualTotal: number;
  varianceTotal: number;
  hasVariance: boolean;
  countedLineCount: number;
  varianceLineCount: number;
};

export const maxRoseEvidenceFiles = 3;
export const maxRoseEvidenceFileBytes = 4_000_000;

export function useConsignmentRoseAudit() {
  const { apiBaseUrl, auth } = useSession();
  const { consignmentSites, consignmentWorkItems, errorMessage, isLoading, reload } = useFieldData(50);
  const [query, setQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState<ConsignmentSiteSummary | null>(null);
  const [activeAudit, setActiveAudit] = useState<ConsignmentAuditSummary | null>(null);
  const [lineCounts, setLineCounts] = useState<RoseLineCount[]>([]);
  const [notes, setNotes] = useState('');
  const [evidenceItems, setEvidenceItems] = useState<RoseEvidenceItem[]>([]);
  const [attestedByName, setAttestedByName] = useState('');
  const [isAttested, setIsAttested] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditMessage, setAuditMessage] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const auditLoadRequestId = useRef(0);

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
    const requestId = auditLoadRequestId.current + 1;
    auditLoadRequestId.current = requestId;
    resetAuditFields();
    setAuditError(null);
    setAuditMessage(null);
    setSelectedSite(site);
    try {
      const detail = await fetchConsignmentSiteDetail(apiBaseUrl, auth.tokens.accessToken, site.id);
      if (auditLoadRequestId.current !== requestId) return;
      const audit = detail.audits.find((item) => item.status === 'scheduled' || item.status === 'in_progress') ?? null;
      setActiveAudit(audit);
      setLineCounts(buildRoseLineCounts(audit?.lines ?? []));
      if (!audit) {
        setAuditError('No scheduled or in-progress ROSE audit is available for this site. Schedule a fresh audit in CRM before field execution.');
      }
    } catch (error) {
      if (auditLoadRequestId.current !== requestId) return;
      setAuditError(error instanceof Error ? error.message : 'Unable to load consignment audit.');
    }
  }

  async function submitRoseAudit() {
    if (!auth || !activeAudit || !notes.trim() || !attestedByName.trim() || !isAttested || !areRoseLineCountsValid(lineCounts)) return;
    const completedAt = new Date().toISOString();
    const localEvidenceMetadata = evidenceItems.map(toRoseEvidenceMetadata);
    const attestation: RoseAttestationMetadata = {
      attestedByName: attestedByName.trim(),
      attestedAt: completedAt,
      textVersion: 'rose-field-v1',
    };
    const submittedLines = buildSubmittedLines(lineCounts);
    const varianceSummary = summarizeVariance(lineCounts);
    const buildRequest = (metadata: RoseEvidenceMetadata[]): UpdateConsignmentAuditRequest => ({
      status: 'completed',
      completedAt,
      reconciliationStatus: varianceSummary.hasVariance ? 'open' : 'true_up_confirmed',
      notes: buildRoseAuditNotes(notes.trim(), attestation, metadata, varianceSummary),
      lines: submittedLines,
    }) satisfies Parameters<typeof updateConsignmentAudit>[3];
    const offlineRequest = buildRequest(localEvidenceMetadata);
    setIsSubmitting(true);
    setAuditError(null);
    setAuditMessage(null);

    try {
      const uploadedEvidenceItems = await uploadRoseEvidenceItems(activeAudit.id, evidenceItems);
      const evidenceMetadata = uploadedEvidenceItems.map(toRoseEvidenceMetadata);
      const request = buildRequest(evidenceMetadata);
      await updateConsignmentAudit(apiBaseUrl, auth.tokens.accessToken, activeAudit.id, request);
      setAuditMessage('ROSE audit submitted to CRM. Any discrepancy follow-up remains in the consignment work queue.');
      closeAudit();
      await reload();
    } catch (error) {
      try {
        const failureCopy = describeDraftSaveFailure(error);
        await enqueueDraftDurably({
          kind: 'consignment_rose_audit',
          title: `ROSE audit: ${selectedSite?.accountName ?? 'Consignment site'}`,
          detail: failureCopy.detail,
          payload: {
            kind: 'consignment_rose_audit',
            auditId: activeAudit.id,
            siteId: activeAudit.siteId,
            accountName: selectedSite?.accountName ?? 'Consignment site',
            request: offlineRequest,
            evidence: { items: localEvidenceMetadata, mediaUploadStatus: 'crm_upload_available_metadata_only_when_offline' },
            attestation,
          },
        });
        setAuditMessage(failureCopy.message);
        closeAudit();
      } catch (draftError) {
        setAuditError(draftError instanceof Error ? `ROSE audit not saved yet: ${draftError.message}` : 'ROSE audit not saved yet. Your entries are still on screen; shorten notes and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addRoseEvidence(useCamera: boolean) {
    setAuditError(null);
    if (evidenceItems.length >= maxRoseEvidenceFiles) {
      setAuditError(`ROSE evidence is capped at ${maxRoseEvidenceFiles} photos for this mobile audit.`);
      return;
    }
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          throw new Error('Camera access is required to add ROSE evidence.');
        }
      }

      const picked = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.65, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.65, base64: true });

      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const fileName = asset.fileName ?? `rose-evidence-${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? mimeTypeFromFileName(fileName);
      const contentBase64 = asset.base64 ?? await uriToBase64(asset.uri);
      if (!mimeType.startsWith('image/')) {
        throw new Error('ROSE evidence upload currently accepts photos only.');
      }
      if (asset.fileSize && asset.fileSize > maxRoseEvidenceFileBytes) {
        throw new Error('ROSE evidence photo is too large. Choose an image under 4 MB.');
      }
      if (estimatedBase64Bytes(contentBase64) > maxRoseEvidenceFileBytes) {
        throw new Error('ROSE evidence photo is too large. Choose an image under 4 MB.');
      }

      setEvidenceItems((items) => [...items, {
        id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName,
        mimeType,
        purpose: 'general',
        capturedAt: new Date().toISOString(),
        ...(asset.fileSize !== undefined ? { byteSize: asset.fileSize } : {}),
        contentBase64,
        uploadStatus: 'metadata_only',
        previewUri: asset.uri,
      }]);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : 'Unable to add ROSE evidence.');
    }
  }

  async function uploadRoseEvidenceItems(auditId: string, items: RoseEvidenceItem[]) {
    if (!auth) return items;
    const uploaded: RoseEvidenceItem[] = [];
    for (const item of items) {
      if (item.crmEvidenceId || !item.contentBase64) {
        uploaded.push(item);
        continue;
      }
      const response = await uploadConsignmentAuditEvidenceRecord(apiBaseUrl, auth.tokens.accessToken, auditId, {
        purpose: item.purpose,
        fileName: item.fileName,
        mimeType: item.mimeType,
        contentBase64: item.contentBase64,
      });
      uploaded.push({ ...item, crmEvidenceId: response.evidence.id, uploadStatus: 'crm_saved' });
      setActiveAudit(response.audit);
    }
    setEvidenceItems(uploaded);
    if (uploaded.some((item) => item.uploadStatus === 'crm_saved')) {
      const uploadedCount = uploaded.filter((item) => item.uploadStatus === 'crm_saved').length;
      setAuditMessage(`${uploadedCount} evidence photo${uploadedCount === 1 ? '' : 's'} uploaded to CRM.`);
    }
    return uploaded;
  }

  function closeAudit() {
    auditLoadRequestId.current += 1;
    setSelectedSite(null);
    resetAuditFields();
  }

  function resetAuditFields() {
    setActiveAudit(null);
    setNotes('');
    setLineCounts([]);
    setEvidenceItems([]);
    setAttestedByName('');
    setIsAttested(false);
  }

  return {
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
  };
}

export function buildRoseLineCounts(lines: ConsignmentAuditLineSummary[]): RoseLineCount[] {
  if (!lines.length) {
    return [{
      lineId: 'mobile-field-count',
      productName: 'Manual ROSE field count',
      actualQuantity: '',
      notes: '',
    }];
  }
  return lines.map((line, index) => ({
    lineId: line.id || `line-${index + 1}`,
    ...(line.sku ? { sku: line.sku } : {}),
    ...(line.barcode ? { barcode: line.barcode } : {}),
    productName: line.productName || `ROSE item ${index + 1}`,
    ...(line.expectedQuantity !== undefined ? { expectedQuantity: line.expectedQuantity } : {}),
    actualQuantity: line.actualQuantity !== undefined ? String(line.actualQuantity) : '',
    notes: line.notes ?? '',
  }));
}

export function buildSubmittedLines(lineCounts: RoseLineCount[]) {
  return lineCounts.map((line) => {
    const actualQuantity = parseRoseQuantity(line.actualQuantity);
    return {
      ...(line.sku ? { sku: line.sku } : {}),
      ...(line.barcode ? { barcode: line.barcode } : {}),
      productName: line.productName,
      ...(line.expectedQuantity !== undefined ? { expectedQuantity: line.expectedQuantity } : {}),
      ...(actualQuantity !== null ? { actualQuantity } : {}),
      ...(line.notes.trim() ? { notes: line.notes.trim() } : {}),
    };
  });
}

export function summarizeVariance(lineCounts: RoseLineCount[]): RoseVarianceSummary {
  let expectedTotal = 0;
  let hasExpected = false;
  let actualTotal = 0;
  let varianceTotal = 0;
  let hasVariance = false;
  let countedLineCount = 0;
  let varianceLineCount = 0;

  for (const line of lineCounts) {
    if (line.expectedQuantity !== undefined) {
      hasExpected = true;
      expectedTotal += line.expectedQuantity;
    }
    const actual = parseRoseQuantity(line.actualQuantity);
    if (actual === null) continue;
    countedLineCount += 1;
    actualTotal += actual;
    if (line.expectedQuantity !== undefined) {
      const variance = actual - line.expectedQuantity;
      varianceTotal += variance;
      if (variance !== 0) {
        hasVariance = true;
        varianceLineCount += 1;
      }
    }
  }

  return {
    expectedTotal: hasExpected ? expectedTotal : undefined,
    actualTotal,
    varianceTotal: hasExpected ? varianceTotal : 0,
    hasVariance,
    countedLineCount,
    varianceLineCount,
  };
}

export function areRoseLineCountsValid(lineCounts: RoseLineCount[]) {
  return lineCounts.length > 0 && lineCounts.every((line) => isValidRoseCount(line.actualQuantity));
}

export function parseRoseQuantity(value: string) {
  if (!isValidRoseCount(value)) return null;
  return Number.parseInt(value.trim(), 10);
}

export function buildRoseAuditNotes(notes: string, attestation: RoseAttestationMetadata, evidenceItems: RoseEvidenceMetadata[], varianceSummary: RoseVarianceSummary) {
  const evidenceSummary = evidenceItems.length
    ? `${evidenceItems.length} photo evidence item${evidenceItems.length === 1 ? '' : 's'} captured (${evidenceItems.filter((item) => item.purpose === 'discrepancy').length} discrepancy). CRM evidence upload runs before audit submission; offline drafts preserve metadata only until encrypted media storage is added.`
    : 'No photos attached.';
  const varianceLine = varianceSummary.expectedTotal === undefined
    ? `ROSE count summary: ${formatQuantity(varianceSummary.actualTotal)} counted across ${varianceSummary.countedLineCount} line${varianceSummary.countedLineCount === 1 ? '' : 's'}; expected quantities are parked until the office source is available.`
    : `ROSE count summary: expected ${formatQuantity(varianceSummary.expectedTotal)}, actual ${formatQuantity(varianceSummary.actualTotal)}, variance ${formatSignedQuantity(varianceSummary.varianceTotal)} across ${varianceSummary.varianceLineCount} variance line${varianceSummary.varianceLineCount === 1 ? '' : 's'}.`;
  return [
    notes,
    varianceLine,
    `TM attestation: ${attestation.attestedByName} at ${formatDateTime(attestation.attestedAt)}.`,
    evidenceSummary,
  ].join('\n\n');
}

export function toRoseEvidenceMetadata(item: RoseEvidenceItem): RoseEvidenceMetadata {
  return {
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    purpose: item.purpose,
    capturedAt: item.capturedAt,
    ...(item.byteSize !== undefined ? { byteSize: item.byteSize } : {}),
  };
}

export function estimatedBase64Bytes(contentBase64: string) {
  const normalized = contentBase64.trim();
  if (!normalized) return 0;
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function isValidRoseCount(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const count = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(count) && count >= 0;
}

export function formatQuantity(value: number | undefined) {
  if (value === undefined) return 'Not set';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function formatSignedQuantity(value: number) {
  if (value === 0) return '0';
  const formatted = Number.isInteger(value) ? String(Math.abs(value)) : Math.abs(value).toFixed(2);
  return `${value > 0 ? '+' : '-'}${formatted}`;
}

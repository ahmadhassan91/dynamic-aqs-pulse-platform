'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchHeader,
  WorkbenchMoreMenu,
} from '@/components/ui/Workbench';
import {
  applyConsignmentAdjustmentRecord,
  closeConsignmentExitRecord,
  confirmConsignmentTrueUpRecord,
  createConsignmentAdjustmentRecord,
  fetchConsignmentReadinessItems,
  fetchConsignmentSiteDetail,
  markConsignmentPoReceivedRecord,
  scheduleConsignmentAuditRecord,
  startConsignmentExitRecord,
  updateConsignmentAuditRecord,
  updateConsignmentSiteRecord,
  upsertConsignmentFormRecord,
  type ConsignmentReadinessItemSummary,
  type ConsignmentSiteDetail as ConsignmentSiteDetailRecord,
} from '@/lib/pulse-api';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import { consignmentStatusColor, formatConsignmentDate, formatConsignmentStatus } from './ConsignmentWorkspace';

const formTypeLabel: Record<string, string> = {
  agreement: 'Agreement form',
  blue: 'BLUE - Initial Verification',
  rose: 'ROSE - 90-day Reconciliation',
  purple: 'PURPLE - Inventory Adjustment',
  sand: 'SAND - Program Exit',
  return: 'Return evidence',
  damage: 'Damage evidence',
  master_reference: 'Master reference',
};

// UX-CSG-003: Mantine color per form / audit type
const formTypeColor: Record<string, string> = {
  agreement: 'green',
  blue: 'blue',
  rose: 'pink',
  purple: 'grape',
  sand: 'yellow',
  return: 'orange',
  damage: 'red',
  master_reference: 'gray',
};

const trueUpOutcomeOptions = [
  { value: 'po_required', label: 'Start PO follow-up clock' },
  { value: 'resolved_no_po', label: 'Resolve without PO follow-up' },
  { value: 'write_off', label: 'Close as write-off / waived PO' },
];

const trueUpReasonOptions = [
  { value: 'confirmed_consumed', label: 'Confirmed consumed by customer' },
  { value: 'open_po_reviewed', label: 'Open PO reviewed' },
  { value: 'in_transit_explained', label: 'In-transit / receipt timing explained it' },
  { value: 'found_on_site', label: 'Inventory found on site' },
  { value: 'baseline_correction', label: 'Baseline correction' },
  { value: 'missing_write_off', label: 'Missing / write-off review' },
];

export function ConsignmentSiteDetail({ siteId }: { siteId: string }) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  // UX-CSG-004: auto-expand evidence section when navigated with ?evidence=1
  const searchParams = useSearchParams();
  const openEvidence = searchParams.get('evidence') === '1';
  const [site, setSite] = useState<ConsignmentSiteDetailRecord | null>(null);
  const [readinessItems, setReadinessItems] = useState<ConsignmentReadinessItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [isFinishAuditModalOpen, setIsFinishAuditModalOpen] = useState(false);
  const [isTrueUpModalOpen, setIsTrueUpModalOpen] = useState(false);
  const [isSiteEditModalOpen, setIsSiteEditModalOpen] = useState(false);
  const [isScheduleRoseModalOpen, setIsScheduleRoseModalOpen] = useState(false);
  const [isPurpleModalOpen, setIsPurpleModalOpen] = useState(false);
  const [isSandModalOpen, setIsSandModalOpen] = useState(false);
  const [siteEditForm, setSiteEditForm] = useState({
    name: '',
    warehouseCode: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    notes: '',
  });
  const [scheduleRoseForm, setScheduleRoseForm] = useState({
    scheduledFor: '',
    notes: 'Scheduled from Pulse consignment workspace.',
  });
  const [roseLineForm, setRoseLineForm] = useState({
    productName: '',
    sku: '',
    expectedQuantity: '1',
    actualQuantity: '0',
    notes: '',
  });
  const [purpleForm, setPurpleForm] = useState({
    currentTotal: '',
    addQuantity: '0',
    removeQuantity: '0',
    proposedTotal: '',
    reasonCode: 'baseline_correction',
    notes: '',
  });
  const [sandForm, setSandForm] = useState({
    plannedExitAt: '',
    returnQuantity: '0',
    retainedQuantity: '0',
    settlementReference: '',
    notes: '',
  });
  const [trueUpForm, setTrueUpForm] = useState({
    outcome: 'po_required',
    reasonCode: 'confirmed_consumed',
    externalPoRef: '',
    notes: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setSite(null);
      setReadinessItems([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [response, readiness] = await Promise.all([
          fetchConsignmentSiteDetail(apiBaseUrl, auth.tokens.accessToken, siteId),
          fetchConsignmentReadinessItems(apiBaseUrl, auth.tokens.accessToken, siteId),
        ]);
        if (!cancelled) {
          setSite(response);
          setReadinessItems(readiness.items);
          setSiteEditForm(siteToEditForm(response));
          setScheduleRoseForm({ scheduledFor: toDatetimeLocal(addDays(new Date(), 7)), notes: 'Scheduled from Pulse consignment workspace.' });
          setPurpleForm((current) => ({
            ...current,
            currentTotal: String(response.manualBaselineQuantity ?? ''),
            proposedTotal: String(response.manualBaselineQuantity ?? ''),
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, siteId]);

  const reloadSite = async () => {
    if (!auth) {
      return;
    }

    const [nextSite, readiness] = await Promise.all([
      fetchConsignmentSiteDetail(apiBaseUrl, auth.tokens.accessToken, siteId),
      fetchConsignmentReadinessItems(apiBaseUrl, auth.tokens.accessToken, siteId),
    ]);
    setSite(nextSite);
    setReadinessItems(readiness.items);
    setSiteEditForm(siteToEditForm(nextSite));
  };

  const runWorkflowAction = async (actionKey: string, action: () => Promise<void>, successMessage: string) => {
    setSavingAction(actionKey);
    setErrorMessage(null);
    try {
      await action();
      await reloadSite();
      notifications.show({ color: 'green', title: 'Consignment updated', message: successMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setErrorMessage(message);
      notifications.show({ color: 'red', title: 'Consignment action failed', message });
    } finally {
      setSavingAction(null);
    }
  };

  const addSignedAgreement = () => runWorkflowAction(
    'agreement',
    async () => {
      if (!auth) return;
      await upsertConsignmentFormRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        formType: 'agreement',
        status: 'signed',
        title: 'Program Agreement',
        signedAt: new Date().toISOString(),
      });
    },
    'Agreement evidence was saved.',
  );

  const addBaselineForm = () => runWorkflowAction(
    'blue',
    async () => {
      if (!auth) return;
      await upsertConsignmentFormRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        formType: 'blue',
        status: 'signed',
        title: 'BLUE - Initial Verification',
        signedAt: new Date().toISOString(),
      });
    },
    'BLUE initial verification was saved and ROSE cadence was recalculated.',
  );

  const activateSite = () => runWorkflowAction(
    'activate',
    async () => {
      if (!auth) return;
      const warehouseCode = site?.warehouseCode?.trim();
      if (!warehouseCode) {
        throw new Error('Add a real warehouse reference before activating this consignment site.');
      }
      await updateConsignmentSiteRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        status: 'active',
      });
    },
    'The site is active with its recorded warehouse reference.',
  );

  const saveSiteDetails = () => runWorkflowAction(
    'site-edit',
    async () => {
      if (!auth) return;
      await updateConsignmentSiteRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        name: siteEditForm.name,
        warehouseCode: siteEditForm.warehouseCode,
        primaryContactName: siteEditForm.primaryContactName,
        primaryContactEmail: siteEditForm.primaryContactEmail,
        primaryContactPhone: siteEditForm.primaryContactPhone,
        notes: siteEditForm.notes,
      });
      setIsSiteEditModalOpen(false);
    },
    'Site details were updated.',
  );

  const scheduleRose = () => runWorkflowAction(
    'schedule-rose',
    async () => {
      if (!auth) return;
      const scheduledFor = scheduleRoseForm.scheduledFor ? new Date(scheduleRoseForm.scheduledFor) : null;
      if (!scheduledFor || Number.isNaN(scheduledFor.getTime())) {
        throw new Error('Choose a valid ROSE audit date.');
      }
      await scheduleConsignmentAuditRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        scheduledFor: scheduledFor.toISOString(),
        notes: scheduleRoseForm.notes,
      });
      setIsScheduleRoseModalOpen(false);
    },
    'ROSE audit was scheduled.',
  );

  const completeRose = (mode: 'no_issue' | 'site_issue') => runWorkflowAction(
    'complete-rose',
    async () => {
      if (!auth || !site) return;
      const audit = site.audits.find((item) => item.status === 'scheduled' || item.status === 'in_progress');
      if (!audit) {
        throw new Error('Schedule a ROSE audit before completing one.');
      }
      await updateConsignmentAuditRecord(apiBaseUrl, auth.tokens.accessToken, audit.id, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        notes: mode === 'site_issue'
          ? 'Completed from Pulse consignment workspace with variance for true-up review.'
          : 'Completed from Pulse consignment workspace with no site issue logged.',
        ...(mode === 'site_issue' ? {
          lines: [
            {
              ...(roseLineForm.sku.trim() ? { sku: roseLineForm.sku.trim() } : {}),
              productName: requireTrimmed(roseLineForm.productName, 'Product name'),
              expectedQuantity: parseUiInteger(roseLineForm.expectedQuantity, 'Expected quantity'),
              actualQuantity: parseUiInteger(roseLineForm.actualQuantity, 'Actual quantity'),
              ...(roseLineForm.notes.trim() ? { notes: roseLineForm.notes.trim() } : {}),
            },
          ],
        } : {}),
      });
      setIsFinishAuditModalOpen(false);
    },
    mode === 'site_issue'
      ? 'ROSE audit was completed and true-up review was opened.'
      : 'ROSE audit was completed with no site issue.',
  );

  const createPurpleAdjustment = () => runWorkflowAction(
    'purple-create',
    async () => {
      if (!auth) return;
      await createConsignmentAdjustmentRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        currentTotal: parseUiInteger(purpleForm.currentTotal, 'Current total'),
        addQuantity: parseUiInteger(purpleForm.addQuantity || '0', 'Add quantity'),
        removeQuantity: parseUiInteger(purpleForm.removeQuantity || '0', 'Remove quantity'),
        ...(purpleForm.proposedTotal.trim() ? { proposedTotal: parseUiInteger(purpleForm.proposedTotal, 'Proposed total') } : {}),
        reasonCode: purpleForm.reasonCode,
        ...(purpleForm.notes.trim() ? { notes: purpleForm.notes.trim() } : {}),
      });
      setIsPurpleModalOpen(false);
    },
    'PURPLE adjustment was recorded for review.',
  );

  const applyPurpleAdjustment = (adjustmentId: string) => runWorkflowAction(
    `purple-apply-${adjustmentId}`,
    async () => {
      if (!auth) return;
      await applyConsignmentAdjustmentRecord(apiBaseUrl, auth.tokens.accessToken, adjustmentId, {
        appliedAt: new Date().toISOString(),
        notes: 'Approved from Pulse consignment workspace.',
      });
    },
    'PURPLE adjustment was applied to the Pulse manual baseline.',
  );

  const startSandExit = () => runWorkflowAction(
    'sand-start',
    async () => {
      if (!auth) return;
      await startConsignmentExitRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        noticeGivenAt: new Date().toISOString(),
        ...(sandForm.plannedExitAt ? { plannedExitAt: new Date(sandForm.plannedExitAt).toISOString() } : {}),
        ...(sandForm.notes.trim() ? { notes: sandForm.notes.trim() } : {}),
      });
      setIsSandModalOpen(false);
    },
    'SAND exit workflow was opened.',
  );

  const closeSandExit = (exitId: string) => runWorkflowAction(
    `sand-close-${exitId}`,
    async () => {
      if (!auth) return;
      await closeConsignmentExitRecord(apiBaseUrl, auth.tokens.accessToken, exitId, {
        finalReconciliationAt: new Date().toISOString(),
        returnQuantity: parseUiInteger(sandForm.returnQuantity || '0', 'Return quantity'),
        retainedQuantity: parseUiInteger(sandForm.retainedQuantity || '0', 'Retained quantity'),
        ...(sandForm.settlementReference.trim() ? { settlementReference: sandForm.settlementReference.trim() } : {}),
        ...(sandForm.notes.trim() ? { notes: sandForm.notes.trim() } : {}),
      });
      setIsSandModalOpen(false);
    },
    'SAND exit was closed and the site was marked exited.',
  );

  const markPoReceived = (discrepancyId: string, externalPoRef?: string) => runWorkflowAction(
    `po-received-${discrepancyId}`,
    async () => {
      if (!auth) return;
      await markConsignmentPoReceivedRecord(apiBaseUrl, auth.tokens.accessToken, discrepancyId, {
        receivedAt: new Date().toISOString(),
        ...(externalPoRef ? { externalPoRef } : {}),
        notes: 'Marked received from Pulse consignment workspace.',
      });
    },
    'PO follow-up was marked received.',
  );

  const hasSignedAgreement = Boolean(site?.forms.some((form) => form.formType === 'agreement' && form.status === 'signed'));
  const hasBaselineForm = Boolean(site?.forms.some((form) => form.formType === 'blue' && form.status === 'signed'));
  const isSiteActive = Boolean(site && (site.status === 'active' || site.activeSince));
  const hasOpenRoseAudit = Boolean(site?.audits.some((audit) => audit.status === 'scheduled' || audit.status === 'in_progress'));
  const openSandExit = site?.exits.find((item) => item.status !== 'closed' && item.status !== 'cancelled');
  const trueUpAudit = site?.audits.find((audit) => (
    audit.status === 'completed'
    && audit.reconciliationStatus === 'open'
    && audit.lines.some((line) => (line.varianceQuantity ?? 0) !== 0)
  ));
  const hasEvidenceHistory = Boolean(site && (site.forms.length || site.audits.length || site.fieldActivity.length || site.workItems.length || site.discrepancyCases.length || site.adjustments.length || site.exits.length));
  const incompleteReadinessCount = readinessItems.filter((item) => item.status !== 'complete').length;
  const readinessSummary = readinessItems.length
    ? `${readinessItems.length - incompleteReadinessCount} of ${readinessItems.length} checks complete`
    : 'Readiness checks are not available for this site.';
  const blockedReadinessCount = readinessItems.filter((item) => item.status === 'blocked').length;
  const canAuditConsignment = canPerformAction(auth?.identity.role, 'consignment.audit');
  const canManageConsignment = canPerformAction(auth?.identity.role, 'consignment.manage');
  const canManageConsignmentDocuments = canPerformAction(auth?.identity.role, 'consignment.document_manage');

  const confirmTrueUp = () => runWorkflowAction(
    'true-up',
    async () => {
      if (!auth || !trueUpAudit) return;
      await confirmConsignmentTrueUpRecord(apiBaseUrl, auth.tokens.accessToken, trueUpAudit.id, {
        outcome: trueUpForm.outcome as 'po_required' | 'resolved_no_po' | 'write_off',
        confirmedAt: new Date().toISOString(),
        reasonCode: trueUpForm.reasonCode,
        ...(trueUpForm.externalPoRef.trim() ? { externalPoRef: trueUpForm.externalPoRef.trim() } : {}),
        ...(trueUpForm.notes.trim() ? { notes: trueUpForm.notes.trim() } : {}),
      });
      setIsTrueUpModalOpen(false);
    },
    trueUpForm.outcome === 'po_required'
      ? 'True-up confirmed. PO follow-up clock is now running.'
      : 'True-up review was closed without starting a PO clock.',
  );

  const workflowActions = site ? [
    ...(!hasSignedAgreement && canManageConsignmentDocuments ? [{
      id: 'agreement',
      label: 'Add Agreement',
      description: 'Save signed program agreement evidence.',
      onClick: addSignedAgreement,
      isLoading: savingAction === 'agreement',
    }] : []),
    ...(hasSignedAgreement && !hasBaselineForm && canManageConsignmentDocuments ? [{
      id: 'blue',
      label: 'Confirm baseline',
      description: 'Save baseline evidence and recalculate cadence checks.',
      onClick: addBaselineForm,
      isLoading: savingAction === 'blue',
    }] : []),
    ...(hasSignedAgreement && hasBaselineForm && !isSiteActive && canManageConsignment ? [{
      id: 'activate',
      label: 'Mark Active',
      description: 'Activate the Pulse consignment site once setup confirmation is available.',
      onClick: activateSite,
      isLoading: savingAction === 'activate',
    }] : []),
    ...(trueUpAudit && canManageConsignment ? [{
      id: 'true-up',
      label: 'Review true-up',
      description: 'Review variance against open POs, in-transit items, and receipt timing before starting any PO clock.',
      onClick: () => setIsTrueUpModalOpen(true),
      isLoading: savingAction === 'true-up',
    }] : []),
    ...(isSiteActive && !hasOpenRoseAudit && canAuditConsignment ? [{
      id: 'schedule-rose',
      label: 'Schedule ROSE',
      description: 'Create the next 90-day ROSE audit workflow record.',
      onClick: () => setIsScheduleRoseModalOpen(true),
      isLoading: savingAction === 'schedule-rose',
    }] : []),
    ...(hasOpenRoseAudit && canAuditConsignment ? [{
      id: 'complete-rose',
      label: 'Finish ROSE audit',
      description: 'Close the scheduled audit and open true-up review when variance needs back-office review.',
      onClick: () => setIsFinishAuditModalOpen(true),
      isLoading: savingAction === 'complete-rose',
    }] : []),
    ...(canManageConsignmentDocuments ? [{
      id: 'purple',
      label: 'Record PURPLE',
      description: 'Open a manual baseline adjustment review without posting Acumatica inventory.',
      onClick: () => setIsPurpleModalOpen(true),
      isLoading: savingAction === 'purple-create',
    }] : []),
    ...(canManageConsignment ? [{
      id: 'sand',
      label: openSandExit ? 'Finish SAND exit' : 'Start SAND exit',
      description: openSandExit ? 'Record final reconciliation and close the exit.' : 'Begin program exit tracking for this site.',
      onClick: () => setIsSandModalOpen(true),
      isLoading: savingAction === 'sand-start' || Boolean(openSandExit && savingAction === `sand-close-${openSandExit.id}`),
    }] : []),
    ...(canManageConsignment ? [{
      id: 'site-edit',
      label: 'Edit site setup',
      description: 'Update site contact and warehouse setup references.',
      onClick: () => setIsSiteEditModalOpen(true),
      isLoading: savingAction === 'site-edit',
    }] : []),
  ] : [];

  const primaryWorkflowAction = (() => {
    if (!site || site.status === 'exited') {
      return null;
    }

    return workflowActions[0] ?? null;
  })();
  const secondaryWorkflowActions = workflowActions.filter((action) => action.id !== primaryWorkflowAction?.id);

  if (!isHydrated) {
    return <Loader color="blue" />;
  }

  if (!auth) {
    return null;
  }

  return (
    <Stack gap="md">
      <WorkbenchHeader
        eyebrow="Consignment site"
        title={site?.accountName ?? 'Consignment Site'}
        description={site ? `Next step is based on site state and readiness. ${readinessSummary}.` : 'Review ROSE cadence, readiness, and workflow actions before opening evidence history.'}
        policyText={site?.status === 'ready_for_warehouse' ? 'Site setup needs confirmation.' : undefined}
        primaryAction={primaryWorkflowAction ? (
          <Button onClick={primaryWorkflowAction.onClick} loading={primaryWorkflowAction.isLoading} disabled={Boolean(savingAction)}>
            {primaryWorkflowAction.label}
          </Button>
        ) : null}
        secondaryActions={(
          <Group gap="xs">
            <Text component={Link} href="/consignment" size="sm" c="blue" fw={600}>
              Back to sites
            </Text>
            {secondaryWorkflowActions.length ? (
              <WorkbenchMoreMenu
                items={secondaryWorkflowActions
                  .map((action) => ({
                  id: action.id,
                  label: action.label,
                  description: action.description,
                  disabled: Boolean(savingAction),
                  onClick: action.onClick,
                }))}
              />
            ) : null}
            {site ? (
              <Badge color={consignmentStatusColor(site.status)} variant="light">
                {formatConsignmentStatus(site.status)}
              </Badge>
            ) : null}
          </Group>
        )}
      />

      <Modal opened={isFinishAuditModalOpen} onClose={() => setIsFinishAuditModalOpen(false)} title="Finish ROSE audit" size="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Choose whether this ROSE audit finished cleanly or needs back-office true-up review. If it needs review, enter the actual counted line that created the variance.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Product name" value={roseLineForm.productName} onChange={(event) => setRoseLineForm((current) => ({ ...current, productName: event.currentTarget.value }))} />
            <TextInput label="SKU" value={roseLineForm.sku} onChange={(event) => setRoseLineForm((current) => ({ ...current, sku: event.currentTarget.value }))} />
            <TextInput label="Expected quantity" value={roseLineForm.expectedQuantity} onChange={(event) => setRoseLineForm((current) => ({ ...current, expectedQuantity: event.currentTarget.value }))} />
            <TextInput label="Actual quantity" value={roseLineForm.actualQuantity} onChange={(event) => setRoseLineForm((current) => ({ ...current, actualQuantity: event.currentTarget.value }))} />
          </SimpleGrid>
          <Textarea label="Line notes" minRows={2} value={roseLineForm.notes} onChange={(event) => setRoseLineForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsFinishAuditModalOpen(false)} disabled={Boolean(savingAction)}>
              Cancel
            </Button>
            <Button
              variant="light"
              onClick={() => completeRose('no_issue')}
              loading={savingAction === 'complete-rose'}
            >
              No issue
            </Button>
            <Button
              color="orange"
              onClick={() => completeRose('site_issue')}
              loading={savingAction === 'complete-rose'}
            >
              Needs true-up
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isTrueUpModalOpen} onClose={() => setIsTrueUpModalOpen(false)} title="True-up review" size="lg">
        <Stack gap="md">
          <Alert color="blue" variant="light">
            Check open POs, in-transit product, transfer/receipt timing, and known replenishment before starting the 5-business-day PO clock.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Select
              label="True-up outcome"
              data={trueUpOutcomeOptions}
              value={trueUpForm.outcome}
              onChange={(value) => setTrueUpForm((current) => ({ ...current, outcome: value ?? current.outcome }))}
              required
            />
            <Select
              label="Reason"
              data={trueUpReasonOptions}
              value={trueUpForm.reasonCode}
              onChange={(value) => setTrueUpForm((current) => ({ ...current, reasonCode: value ?? current.reasonCode }))}
              required
            />
          </SimpleGrid>
          {trueUpForm.outcome === 'po_required' ? (
            <TextInput
              label="Customer PO reference"
              description="Optional for now. Acumatica PO/order posting remains parked until endpoint certification."
              value={trueUpForm.externalPoRef}
              onChange={(event) => setTrueUpForm((current) => ({ ...current, externalPoRef: event.currentTarget.value }))}
              placeholder="Optional external PO/reference"
            />
          ) : null}
          <Textarea
            label="Review notes"
            minRows={3}
            value={trueUpForm.notes}
            onChange={(event) => setTrueUpForm((current) => ({ ...current, notes: event.currentTarget.value }))}
            placeholder="Example: reviewed open PO and receipt timing; remaining shortage confirmed consumed."
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsTrueUpModalOpen(false)} disabled={Boolean(savingAction)}>
              Cancel
            </Button>
            <Button onClick={confirmTrueUp} loading={savingAction === 'true-up'}>
              Save true-up
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isSiteEditModalOpen} onClose={() => setIsSiteEditModalOpen(false)} title="Edit site setup" size="lg">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Site name" value={siteEditForm.name} onChange={(event) => setSiteEditForm((current) => ({ ...current, name: event.currentTarget.value }))} />
            <TextInput label="Warehouse reference" value={siteEditForm.warehouseCode} onChange={(event) => setSiteEditForm((current) => ({ ...current, warehouseCode: event.currentTarget.value }))} />
            <TextInput label="Contact name" value={siteEditForm.primaryContactName} onChange={(event) => setSiteEditForm((current) => ({ ...current, primaryContactName: event.currentTarget.value }))} />
            <TextInput label="Contact email" value={siteEditForm.primaryContactEmail} onChange={(event) => setSiteEditForm((current) => ({ ...current, primaryContactEmail: event.currentTarget.value }))} />
            <TextInput label="Contact phone" value={siteEditForm.primaryContactPhone} onChange={(event) => setSiteEditForm((current) => ({ ...current, primaryContactPhone: event.currentTarget.value }))} />
          </SimpleGrid>
          <Textarea label="Notes" minRows={3} value={siteEditForm.notes} onChange={(event) => setSiteEditForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsSiteEditModalOpen(false)} disabled={Boolean(savingAction)}>Cancel</Button>
            <Button onClick={saveSiteDetails} loading={savingAction === 'site-edit'}>Save site</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isScheduleRoseModalOpen} onClose={() => setIsScheduleRoseModalOpen(false)} title="Schedule ROSE audit" size="md">
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Date"
              type="date"
              value={splitLocalDateTimeInput(scheduleRoseForm.scheduledFor).date}
              onChange={(event) => setScheduleRoseForm((current) => ({
                ...current,
                scheduledFor: mergeLocalDateTimeInput(
                  current.scheduledFor,
                  event.currentTarget.value,
                  splitLocalDateTimeInput(current.scheduledFor).time,
                ),
              }))}
              required
            />
            <TextInput
              label="Time"
              type="time"
              step={60}
              value={splitLocalDateTimeInput(scheduleRoseForm.scheduledFor).time}
              onChange={(event) => setScheduleRoseForm((current) => ({
                ...current,
                scheduledFor: mergeLocalDateTimeInput(
                  current.scheduledFor,
                  splitLocalDateTimeInput(current.scheduledFor).date,
                  event.currentTarget.value,
                ),
              }))}
              required
            />
          </SimpleGrid>
          <Textarea label="Notes" minRows={3} value={scheduleRoseForm.notes} onChange={(event) => setScheduleRoseForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsScheduleRoseModalOpen(false)} disabled={Boolean(savingAction)}>Cancel</Button>
            <Button onClick={scheduleRose} loading={savingAction === 'schedule-rose'}>Schedule</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isPurpleModalOpen} onClose={() => setIsPurpleModalOpen(false)} title="Record PURPLE adjustment" size="lg">
        <Stack gap="md">
          <Alert color="violet" variant="light">
            This updates the Pulse manual baseline after approval only. Acumatica inventory adjustment posting stays parked.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Current total" value={purpleForm.currentTotal} onChange={(event) => setPurpleForm((current) => ({ ...current, currentTotal: event.currentTarget.value }))} required />
            <TextInput label="Proposed total" value={purpleForm.proposedTotal} onChange={(event) => setPurpleForm((current) => ({ ...current, proposedTotal: event.currentTarget.value }))} />
            <TextInput label="Add quantity" value={purpleForm.addQuantity} onChange={(event) => setPurpleForm((current) => ({ ...current, addQuantity: event.currentTarget.value }))} />
            <TextInput label="Remove quantity" value={purpleForm.removeQuantity} onChange={(event) => setPurpleForm((current) => ({ ...current, removeQuantity: event.currentTarget.value }))} />
          </SimpleGrid>
          <Select
            label="Reason"
            data={trueUpReasonOptions}
            value={purpleForm.reasonCode}
            onChange={(value) => setPurpleForm((current) => ({ ...current, reasonCode: value ?? current.reasonCode }))}
          />
          <Textarea label="Adjustment notes" minRows={3} value={purpleForm.notes} onChange={(event) => setPurpleForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsPurpleModalOpen(false)} disabled={Boolean(savingAction)}>Cancel</Button>
            <Button onClick={createPurpleAdjustment} loading={savingAction === 'purple-create'}>Record adjustment</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={isSandModalOpen} onClose={() => setIsSandModalOpen(false)} title={openSandExit ? 'Finish SAND exit' : 'Start SAND exit'} size="lg">
        <Stack gap="md">
          <Alert color="yellow" variant="light">
            Pulse tracks notice, final reconciliation, return/retain quantities, and settlement reference. Finance and Acumatica settlement posting remain parked.
          </Alert>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {!openSandExit ? (
              <TextInput label="Planned exit date" type="datetime-local" value={sandForm.plannedExitAt} onChange={(event) => setSandForm((current) => ({ ...current, plannedExitAt: event.currentTarget.value }))} />
            ) : null}
            {openSandExit ? (
              <>
                <TextInput label="Return quantity" value={sandForm.returnQuantity} onChange={(event) => setSandForm((current) => ({ ...current, returnQuantity: event.currentTarget.value }))} />
                <TextInput label="Retained quantity" value={sandForm.retainedQuantity} onChange={(event) => setSandForm((current) => ({ ...current, retainedQuantity: event.currentTarget.value }))} />
                <TextInput label="Settlement reference" value={sandForm.settlementReference} onChange={(event) => setSandForm((current) => ({ ...current, settlementReference: event.currentTarget.value }))} />
              </>
            ) : null}
          </SimpleGrid>
          <Textarea label="Notes" minRows={3} value={sandForm.notes} onChange={(event) => setSandForm((current) => ({ ...current, notes: event.currentTarget.value }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsSandModalOpen(false)} disabled={Boolean(savingAction)}>Cancel</Button>
            {openSandExit ? (
              <Button onClick={() => closeSandExit(openSandExit.id)} loading={savingAction === `sand-close-${openSandExit.id}`}>Close exit</Button>
            ) : (
              <Button onClick={startSandExit} loading={savingAction === 'sand-start'}>Start exit</Button>
            )}
          </Group>
        </Stack>
      </Modal>

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      {isLoading ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {site ? (
        <Stack gap="md" data-testid="consignment-site-detail">
          <Card withBorder radius="md" p="lg" data-testid="consignment-current-site-work">
            <Group justify="space-between" align="flex-start" mb="md">
              <Stack gap={4}>
                <Text fw={800} size="lg">Current site work</Text>
                <Text size="sm" c="dimmed">
                  {primaryWorkflowAction
                    ? primaryWorkflowAction.description
                    : 'No site workflow action is currently open.'}
                </Text>
              </Stack>
              <Badge color={consignmentStatusColor(site.status)} variant="light">
                {formatConsignmentStatus(site.status)}
              </Badge>
            </Group>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
              <MetadataRow label="Readiness" value={readinessSummary} />
              <MetadataRow label="Blocked checks" value={String(blockedReadinessCount)} />
              <MetadataRow label="Open work" value={String(site.openWorkItemCount ?? 0)} />
              <MetadataRow label="Open discrepancies" value={String(site.openDiscrepancyCount ?? 0)} />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mt="lg">
              <MetadataRow
                label="Account"
                value={site.accountId ? (
                  <Text component={Link} href={`/customers/${site.accountId}`} size="sm" ta="right" c="blue" fw={600}>
                    View account
                  </Text>
                ) : 'No linked account'}
              />
              <MetadataRow label="Site" value={site.name} />
              <MetadataRow label="Location" value={site.locationName ?? 'No location recorded'} />
              <MetadataRow label="Primary Contact" value={site.primaryContactName ?? 'No contact recorded'} />
              <MetadataRow label="Territory" value={site.territoryName ?? 'Not assigned'} />
              <MetadataRow label="TM" value={site.ownerTmName ?? 'Not assigned'} />
              <MetadataRow label="RD" value={site.ownerRdName ?? 'Not assigned'} />
              <MetadataRow label="Warehouse reference" value={site.warehouseCode ?? 'Not recorded'} />
              <MetadataRow label="Pulse manual baseline" value={site.manualBaselineQuantity !== undefined ? String(site.manualBaselineQuantity) : 'Not recorded'} />
            </SimpleGrid>
          </Card>

          {/* UX-CSG-004: defaultExpanded when navigated with ?evidence=1 from site list */}
          <WorkbenchAdvancedSection
            title="Site details and evidence"
            description="Open for ROSE cadence, readiness checks, form counts, documents, audit history, and reviewed field notes."
            defaultExpanded={openEvidence}
          >
            <SimpleGrid cols={{ base: 1, lg: 3 }} mb="md">
              <Card withBorder radius="md" p="md">
                <Title order={5} mb="sm">ROSE cadence</Title>
                <Stack gap="xs">
                  <MetadataRow label="Next ROSE audit" value={formatConsignmentDate(site.nextAuditDueAt)} />
                  <MetadataRow label="Last Audit" value={formatConsignmentDate(site.lastAuditCompletedAt)} />
                  <MetadataRow label="Open Work Items" value={String(site.openWorkItemCount ?? 0)} />
                  <MetadataRow label="Open Discrepancies" value={String(site.openDiscrepancyCount ?? 0)} />
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md">
                <Title order={5} mb="sm">Readiness</Title>
                <Stack gap="xs">
                  {readinessItems.map((item) => (
                    <ReadinessRow key={item.code} item={item} />
                  ))}
                  {readinessItems.length === 0 ? (
                    <Text size="sm" c="dimmed">Readiness checks are not available for this site.</Text>
                  ) : null}
                </Stack>
              </Card>

              <Card withBorder radius="md" p="md">
                <Title order={5} mb="sm">Program evidence</Title>
                <Stack gap="xs">
                  <MetadataRow label="Agreement forms" value={String(site.formCounts.agreement ?? 0)} />
                  <MetadataRow label="BLUE forms" value={String(site.formCounts.blue ?? 0)} />
                  <MetadataRow label="ROSE forms" value={String(site.formCounts.rose ?? 0)} />
                  <MetadataRow label="PURPLE forms" value={String(site.formCounts.purple ?? 0)} />
                  <MetadataRow label="SAND forms" value={String(site.formCounts.sand ?? 0)} />
                  <MetadataRow label="Setup note" value={site.acumaticaWarehouseId ? site.acumaticaWarehouseId : 'Site setup needs confirmation'} />
                </Stack>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, lg: 2 }} mb="md">
              <Card withBorder radius="md" p="lg">
                <Title order={4} mb="md">Work Items</Title>
                {site.workItems.length ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Work</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Due</Table.Th>
                        {/* UX-CSG-006: entity quick-links column */}
                        <Table.Th>Quick links</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {site.workItems.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text size="sm" fw={700}>{item.title}</Text>
                              <Text size="xs" c="dimmed">{formatConsignmentStatus(item.type)}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td><Badge variant="light">{formatConsignmentStatus(item.status)}</Badge></Table.Td>
                          <Table.Td>{formatConsignmentDate(item.dueAt)}</Table.Td>
                          {/* UX-CSG-006: quick-links to site, audit history, PO cases, and forms */}
                          <Table.Td>
                            <Group gap={4} wrap="wrap">
                              <Text
                                component={Link}
                                href={`/consignment/${item.siteId}`}
                                size="xs"
                                c="blue"
                                fw={600}
                              >
                                Site
                              </Text>
                              {item.type === 'rose_audit' || item.type === 'audit' ? (
                                <Text
                                  component={Link}
                                  href={`/consignment/${item.siteId}?evidence=1`}
                                  size="xs"
                                  c="blue"
                                  fw={600}
                                >
                                  Audit
                                </Text>
                              ) : null}
                              {item.type === 'po_follow_up' || item.type === 'discrepancy' ? (
                                <Text
                                  component={Link}
                                  href={`/consignment/${item.siteId}?evidence=1`}
                                  size="xs"
                                  c="blue"
                                  fw={600}
                                >
                                  PO / Discrepancy
                                </Text>
                              ) : null}
                              {item.type === 'form' || item.type === 'document' ? (
                                <Text
                                  component={Link}
                                  href={`/consignment/${item.siteId}?evidence=1`}
                                  size="xs"
                                  c="blue"
                                  fw={600}
                                >
                                  Form
                                </Text>
                              ) : null}
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">No work items are open or recent for this site.</Text>
                )}
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={4} mb="md">Discrepancy Cases</Title>
                {site.discrepancyCases.length ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Case</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>PO</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {site.discrepancyCases.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text size="sm" fw={700}>{item.productName ?? item.reasonCode ?? 'ROSE variance'}</Text>
                              <Text size="xs" c="dimmed">{item.quantity !== undefined ? `Quantity ${item.quantity}` : item.notes ?? 'No quantity recorded'}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td><Badge variant="light">{formatConsignmentStatus(item.status)}</Badge></Table.Td>
                          <Table.Td>{formatConsignmentStatus(item.poFollowUpStatus)}</Table.Td>
                          <Table.Td>
                            {item.status === 'po_required' || item.poFollowUpStatus === 'required' ? (
                              <Button size="xs" variant="light" onClick={() => markPoReceived(item.id, item.externalPoRef)} loading={savingAction === `po-received-${item.id}`}>
                                Mark received
                              </Button>
                            ) : null}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">No discrepancy cases have been opened.</Text>
                )}
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={4} mb="md">PURPLE Adjustments</Title>
                {site.adjustments.length ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Adjustment</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {site.adjustments.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td>
                            <Stack gap={2}>
                              <Text size="sm" fw={700}>{item.currentTotal} to {item.proposedTotal}</Text>
                              <Text size="xs" c="dimmed">Add {item.addQuantity} / remove {item.removeQuantity}</Text>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Badge variant="light">{formatConsignmentStatus(item.status)}</Badge>
                              {/* UX-CSG-005: pending Acumatica sync indicator on applied adjustments */}
                              {item.status === 'applied' ? (
                                <Badge color="gray" variant="light">Pending Acumatica</Badge>
                              ) : null}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            {item.status === 'requested' && canManageConsignment ? (
                              <Button size="xs" variant="light" onClick={() => applyPurpleAdjustment(item.id)} loading={savingAction === `purple-apply-${item.id}`}>
                                Apply
                              </Button>
                            ) : null}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">No PURPLE adjustments have been recorded.</Text>
                )}
              </Card>

              <Card withBorder radius="md" p="lg">
                <Title order={4} mb="md">SAND Exits</Title>
                {site.exits.length ? (
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Notice</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Closed</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {site.exits.map((item) => (
                        <Table.Tr key={item.id}>
                          <Table.Td>{formatConsignmentDate(item.noticeGivenAt)}</Table.Td>
                          <Table.Td><Badge variant="light">{formatConsignmentStatus(item.status)}</Badge></Table.Td>
                          <Table.Td>{formatConsignmentDate(item.closedAt)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                ) : (
                  <Text size="sm" c="dimmed">No SAND exit workflow has been opened.</Text>
                )}
              </Card>
            </SimpleGrid>

            {hasEvidenceHistory ? (
              <SimpleGrid cols={{ base: 1, lg: 2 }}>
                {site.forms.length ? (
                  <Card withBorder radius="md" p="lg">
                    <Title order={4} mb="md">Documents</Title>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Document</Table.Th>
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th></Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {site.forms.map((document) => (
                          <Table.Tr key={document.id}>
                            <Table.Td>{document.title ?? document.formType}</Table.Td>
                            {/* UX-CSG-003: color-coded form type badge */}
                            <Table.Td>
                              <Badge variant="light" color={formTypeColor[document.formType] ?? 'gray'}>
                                {formatConsignmentFormType(document.formType)}
                              </Badge>
                            </Table.Td>
                            <Table.Td><Badge variant="light">{formatConsignmentStatus(document.status)}</Badge></Table.Td>
                            <Table.Td>
                              {document.documentUrl ? (
                                <Button
                                  component="a"
                                  href={document.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  size="xs"
                                  variant="light"
                                >
                                  View
                                </Button>
                              ) : (
                                <Text size="xs" c="dimmed">No file</Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card>
                ) : null}

                {site.audits.length ? (
                  <Card withBorder radius="md" p="lg">
                    <Title order={4} mb="md">Audit History</Title>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Scheduled</Table.Th>
                          {/* UX-CSG-003: audit type column */}
                          <Table.Th>Type</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Site issue</Table.Th>
                          <Table.Th>Completed</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {site.audits.map((audit) => (
                          <Table.Tr key={audit.id}>
                            <Table.Td>{formatConsignmentDate(audit.scheduledFor)}</Table.Td>
                            {/* UX-CSG-003: all site audits are ROSE (90-day reconciliation) */}
                            <Table.Td><Badge variant="light" color="pink">ROSE</Badge></Table.Td>
                            <Table.Td><Badge variant="light">{formatConsignmentStatus(audit.status)}</Badge></Table.Td>
                            <Table.Td>{formatSiteIssueStatus(audit.reconciliationStatus)}</Table.Td>
                            <Table.Td>{formatConsignmentDate(audit.completedAt)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card>
                ) : null}

                {site.fieldActivity.length ? (
                  <Card withBorder radius="md" p="lg">
                    <Title order={4} mb="md">Reviewed Field Notes</Title>
                    <Stack gap="sm">
                      {site.fieldActivity.map((note) => (
                        <Paper key={note.id} withBorder radius="md" p="sm">
                          <Group justify="space-between" align="flex-start">
                            <Stack gap={2}>
                              <Text fw={700}>{note.summary ?? note.title}</Text>
                              {note.nextStep ? <Text size="sm" c="dimmed">{note.nextStep}</Text> : null}
                              <Text size="xs" c="dimmed">
                                Captured by {note.capturedByName ?? 'field user'} · Reviewed {formatConsignmentDate(note.reviewedAt)}
                              </Text>
                            </Stack>
                            {note.writebackTarget?.startsWith('consignment_work_item:') ? (
                              <Badge color="green" variant="light">Work item opened</Badge>
                            ) : (
                              <Badge color="blue" variant="light">Activity saved</Badge>
                            )}
                          </Group>
                        </Paper>
                      ))}
                    </Stack>
                  </Card>
                ) : null}
              </SimpleGrid>
            ) : (
              <EmptyStateMessage
                kind="all-clear"
                title="No evidence history yet"
                description="Documents, ROSE audits, and reviewed field notes will appear here after the first Pulse workflow action is saved."
              />
            )}
          </WorkbenchAdvancedSection>
        </Stack>
      ) : null}
    </Stack>
  );
}

function MetadataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Text size="sm" c="dimmed">{label}</Text>
      {typeof value === 'string' ? <Text size="sm" ta="right">{value}</Text> : value}
    </Group>
  );
}

function ReadinessRow({ item }: { item: ConsignmentReadinessItemSummary }) {
  const color = item.status === 'complete' ? 'green' : item.status === 'blocked' ? 'red' : 'yellow';

  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Stack gap={2}>
        <Text size="sm" fw={600}>{item.label}</Text>
        {item.detail ? <Text size="xs" c="dimmed">{item.detail}</Text> : null}
      </Stack>
      <Badge color={color} variant="light">{formatConsignmentStatus(item.status)}</Badge>
    </Group>
  );
}

function formatSiteIssueStatus(value: string | undefined) {
  switch (value) {
    case 'not_started':
      return 'Not reviewed';
    case 'open':
      return 'Needs review';
    case 'true_up_confirmed':
      return 'Follow-up confirmed';
    case 'resolved':
      return 'Resolved';
    case 'escalated':
      return 'Escalated';
    default:
      return formatConsignmentStatus(value);
  }
}

function formatConsignmentFormType(value: string) {
  if (value in formTypeLabel) {
    return formTypeLabel[value];
  }

  return value.replace(/_/g, ' ');
}

function siteToEditForm(site: ConsignmentSiteDetailRecord) {
  return {
    name: site.name ?? '',
    warehouseCode: site.warehouseCode ?? '',
    primaryContactName: site.primaryContactName ?? '',
    primaryContactEmail: site.primaryContactEmail ?? '',
    primaryContactPhone: site.primaryContactPhone ?? '',
    notes: site.notes ?? '',
  };
}

function parseUiInteger(value: string, label: string) {
  const normalized = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }
  return normalized;
}

function requireTrimmed(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
}

function toDatetimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

function splitLocalDateTimeInput(value: string) {
  const [date = '', time = ''] = value.split('T');
  return { date, time };
}

function mergeLocalDateTimeInput(currentValue: string, date: string, time: string) {
  const current = splitLocalDateTimeInput(currentValue);
  const nextDate = date || current.date;
  const nextTime = time || current.time;
  if (!nextDate) {
    return '';
  }
  if (!nextTime) {
    return `${nextDate}T00:00`;
  }
  return `${nextDate}T${nextTime}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

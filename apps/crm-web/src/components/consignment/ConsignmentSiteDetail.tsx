'use client';

import Link from 'next/link';
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
  confirmConsignmentTrueUpRecord,
  fetchConsignmentReadinessItems,
  fetchConsignmentSiteDetail,
  scheduleConsignmentAuditRecord,
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
  const [site, setSite] = useState<ConsignmentSiteDetailRecord | null>(null);
  const [readinessItems, setReadinessItems] = useState<ConsignmentReadinessItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [isFinishAuditModalOpen, setIsFinishAuditModalOpen] = useState(false);
  const [isTrueUpModalOpen, setIsTrueUpModalOpen] = useState(false);
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
      await updateConsignmentSiteRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        status: 'active',
        warehouseCode: site?.warehouseCode ?? `MANUAL-${siteId.slice(0, 8).toUpperCase()}`,
      });
    },
    'The site is active with a warehouse setup note.',
  );

  const scheduleRose = () => runWorkflowAction(
    'schedule-rose',
    async () => {
      if (!auth) return;
      await scheduleConsignmentAuditRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        scheduledFor: addDays(new Date(), 7).toISOString(),
        notes: 'Scheduled from Pulse consignment workspace.',
      });
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
              sku: 'MANUAL-VARIANCE',
              productName: 'Consignment site issue',
              expectedQuantity: 1,
              actualQuantity: 0,
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

  const hasSignedAgreement = Boolean(site?.forms.some((form) => form.formType === 'agreement' && form.status === 'signed'));
  const hasBaselineForm = Boolean(site?.forms.some((form) => form.formType === 'blue' && form.status === 'signed'));
  const isSiteActive = Boolean(site && (site.status === 'active' || site.activeSince));
  const hasOpenRoseAudit = Boolean(site?.audits.some((audit) => audit.status === 'scheduled' || audit.status === 'in_progress'));
  const trueUpAudit = site?.audits.find((audit) => (
    audit.status === 'completed'
    && audit.reconciliationStatus === 'open'
    && audit.lines.some((line) => (line.varianceQuantity ?? 0) !== 0)
  ));
  const hasEvidenceHistory = Boolean(site && (site.forms.length || site.audits.length || site.fieldActivity.length));
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
      onClick: scheduleRose,
      isLoading: savingAction === 'schedule-rose',
    }] : []),
    ...(hasOpenRoseAudit && canAuditConsignment ? [{
      id: 'complete-rose',
      label: 'Finish ROSE audit',
      description: 'Close the scheduled audit and open true-up review when variance needs back-office review.',
      onClick: () => setIsFinishAuditModalOpen(true),
      isLoading: savingAction === 'complete-rose',
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

      <Modal opened={isFinishAuditModalOpen} onClose={() => setIsFinishAuditModalOpen(false)} title="Finish ROSE audit" size="sm">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Choose whether this ROSE audit finished cleanly or needs back-office true-up review.
          </Text>
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
            </SimpleGrid>
          </Card>

          <WorkbenchAdvancedSection
            title="Site details and evidence"
            description="Open for ROSE cadence, readiness checks, form counts, documents, audit history, and reviewed field notes."
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
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {site.forms.map((document) => (
                          <Table.Tr key={document.id}>
                            <Table.Td>{document.title ?? document.formType}</Table.Td>
                            <Table.Td>{formatConsignmentFormType(document.formType)}</Table.Td>
                            <Table.Td><Badge variant="light">{formatConsignmentStatus(document.status)}</Badge></Table.Td>
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
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Site issue</Table.Th>
                          <Table.Th>Completed</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {site.audits.map((audit) => (
                          <Table.Tr key={audit.id}>
                            <Table.Td>{formatConsignmentDate(audit.scheduledFor)}</Table.Td>
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

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

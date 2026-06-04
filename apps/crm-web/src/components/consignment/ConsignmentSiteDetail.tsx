'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
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
  fetchConsignmentReadinessItems,
  fetchConsignmentSiteDetail,
  scheduleConsignmentAuditRecord,
  updateConsignmentAuditRecord,
  updateConsignmentSiteRecord,
  upsertConsignmentFormRecord,
  type ConsignmentReadinessItemSummary,
  type ConsignmentSiteDetail as ConsignmentSiteDetailRecord,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { consignmentStatusColor, formatConsignmentDate, formatConsignmentStatus } from './ConsignmentWorkspace';

export function ConsignmentSiteDetail({ siteId }: { siteId: string }) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [site, setSite] = useState<ConsignmentSiteDetailRecord | null>(null);
  const [readinessItems, setReadinessItems] = useState<ConsignmentReadinessItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [isFinishAuditModalOpen, setIsFinishAuditModalOpen] = useState(false);
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

  const addBlueBaseline = () => runWorkflowAction(
    'blue',
    async () => {
      if (!auth) return;
      await upsertConsignmentFormRecord(apiBaseUrl, auth.tokens.accessToken, siteId, {
        formType: 'blue',
        status: 'signed',
        title: 'BLUE Baseline',
        signedAt: new Date().toISOString(),
      });
    },
    'BLUE baseline was saved and the ROSE cadence was recalculated.',
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
          ? 'Completed from Pulse consignment workspace with site issue follow-up.'
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
      ? 'ROSE audit was completed and site issue follow-up was opened.'
      : 'ROSE audit was completed with no site issue.',
  );

  const hasSignedAgreement = Boolean(site?.forms.some((form) => form.formType === 'agreement' && form.status === 'signed'));
  const hasBlueBaseline = Boolean(site?.forms.some((form) => form.formType === 'blue' && form.status === 'signed'));
  const hasOpenRoseAudit = Boolean(site?.audits.some((audit) => audit.status === 'scheduled' || audit.status === 'in_progress'));
  const hasEvidenceHistory = Boolean(site && (site.forms.length || site.audits.length || site.fieldActivity.length));
  const incompleteReadinessCount = readinessItems.filter((item) => item.status !== 'complete').length;
  const readinessSummary = readinessItems.length
    ? `${readinessItems.length - incompleteReadinessCount} of ${readinessItems.length} checks complete`
    : 'Readiness checks are not available for this site.';
  const blockedReadinessCount = readinessItems.filter((item) => item.status === 'blocked').length;

  const workflowActions = site ? [
    {
      id: 'agreement',
      label: 'Add Agreement',
      description: 'Save signed program agreement evidence.',
      onClick: addSignedAgreement,
      isLoading: savingAction === 'agreement',
    },
    {
      id: 'blue',
      label: 'Confirm baseline',
      description: 'Save initial verification evidence and recalculate ROSE cadence.',
      onClick: addBlueBaseline,
      isLoading: savingAction === 'blue',
    },
    {
      id: 'activate',
      label: 'Mark Active',
      description: 'Activate the Pulse consignment site with the available setup note.',
      onClick: activateSite,
      isLoading: savingAction === 'activate',
    },
    {
      id: 'schedule-rose',
      label: 'Schedule ROSE',
      description: 'Create the next ROSE audit workflow record.',
      onClick: scheduleRose,
      isLoading: savingAction === 'schedule-rose',
    },
    {
      id: 'complete-rose',
      label: 'Finish audit',
      description: 'Close the scheduled audit and open site issue follow-up when needed.',
      onClick: () => setIsFinishAuditModalOpen(true),
      isLoading: savingAction === 'complete-rose',
      disabled: !hasOpenRoseAudit,
    },
  ] : [];

  const primaryWorkflowAction = (() => {
    if (!site || site.status === 'exited') {
      return null;
    }

    if (site.status === 'active') {
      return workflowActions.find((action) => action.id === (hasOpenRoseAudit ? 'complete-rose' : 'schedule-rose')) ?? null;
    }

    if (!hasSignedAgreement) {
      return workflowActions.find((action) => action.id === 'agreement') ?? null;
    }

    if (!hasBlueBaseline) {
      return workflowActions.find((action) => action.id === 'blue') ?? null;
    }

    return workflowActions.find((action) => action.id === 'activate') ?? null;
  })();

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
          <Button onClick={primaryWorkflowAction.onClick} loading={primaryWorkflowAction.isLoading} disabled={Boolean(primaryWorkflowAction.disabled)}>
            {primaryWorkflowAction.label}
          </Button>
        ) : null}
        secondaryActions={(
          <Group gap="xs">
            <Button component={Link} href="/consignment" variant="default">
              Back To Sites
            </Button>
            {site?.accountId ? (
              <Button component={Link} href={`/customers/${site.accountId}`} variant="light">
                View Account
              </Button>
            ) : null}
            <WorkbenchMoreMenu
              items={workflowActions
                .filter((action) => action.id !== primaryWorkflowAction?.id)
                .map((action) => ({
                  id: action.id,
                  label: action.label,
                  description: action.description,
                  disabled: action.disabled || Boolean(savingAction),
                  onClick: action.onClick,
                }))}
            />
            {site ? (
              <Badge color={consignmentStatusColor(site.status)} variant="light">
                {formatConsignmentStatus(site.status)}
              </Badge>
            ) : null}
          </Group>
        )}
      />

      <Modal opened={isFinishAuditModalOpen} onClose={() => setIsFinishAuditModalOpen(false)} title="Finish audit" size="sm">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Choose whether this ROSE audit finished cleanly or needs a site issue follow-up.
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
              Log site issue
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
                <Title order={4}>Current site work</Title>
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
          </Card>

          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder radius="md" p="lg" data-testid="consignment-site-snapshot">
              <Title order={4} mb="md">Site Snapshot</Title>
              <Stack gap="xs">
                <MetadataRow label="Site" value={site.name} />
                <MetadataRow label="Location" value={site.locationName ?? 'No location recorded'} />
                <MetadataRow label="Primary Contact" value={site.primaryContactName ?? 'No contact recorded'} />
                <MetadataRow label="Territory" value={site.territoryName ?? 'Not assigned'} />
                <MetadataRow label="TM" value={site.ownerTmName ?? 'Not assigned'} />
                <MetadataRow label="RD" value={site.ownerRdName ?? 'Not assigned'} />
              </Stack>
            </Card>

            <WorkbenchAdvancedSection
              title="ROSE and work metrics"
              description="Cadence and open-work counts stay available without leading the daily site review."
            >
              <Stack gap="xs">
                <MetadataRow label="Next ROSE Audit" value={formatConsignmentDate(site.nextAuditDueAt)} />
                <MetadataRow label="Last Audit" value={formatConsignmentDate(site.lastAuditCompletedAt)} />
                <MetadataRow label="Open Work Items" value={String(site.openWorkItemCount ?? 0)} />
                <MetadataRow label="Open Discrepancies" value={String(site.openDiscrepancyCount ?? 0)} />
              </Stack>
            </WorkbenchAdvancedSection>
          </SimpleGrid>

          <WorkbenchAdvancedSection
            title="Readiness checks"
            description="Open the full checklist when the current site action is blocked or needs setup review."
          >
            <Stack gap="xs">
              {readinessItems.map((item) => (
                <ReadinessRow key={item.code} item={item} />
              ))}
              {readinessItems.length === 0 ? (
                <Text size="sm" c="dimmed">Readiness checks are not available for this site.</Text>
              ) : null}
            </Stack>
          </WorkbenchAdvancedSection>

          <WorkbenchAdvancedSection
            title="Setup and documents"
            description="Form counts and setup notes remain available without leading the daily site review."
          >
            <Stack gap="xs">
              <MetadataRow label="Agreement Forms" value={String(site.formCounts.agreement ?? 0)} />
              <MetadataRow label="BLUE Forms" value={String(site.formCounts.blue ?? 0)} />
              <MetadataRow label="ROSE Forms" value={String(site.formCounts.rose ?? 0)} />
              <MetadataRow label="PURPLE Forms" value={String(site.formCounts.purple ?? 0)} />
              <MetadataRow label="SAND Forms" value={String(site.formCounts.sand ?? 0)} />
              <MetadataRow label="Setup note" value={site.acumaticaWarehouseId ? site.acumaticaWarehouseId : 'Site setup needs confirmation'} />
            </Stack>
          </WorkbenchAdvancedSection>

          <WorkbenchAdvancedSection
            title="Documents, audit history, and reviewed field notes"
            description="Evidence and traceability stay one click away after the operator workflow actions."
          >
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
                            <Table.Td>{formatConsignmentStatus(document.formType)}</Table.Td>
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

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" gap="md">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" ta="right">{value}</Text>
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

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

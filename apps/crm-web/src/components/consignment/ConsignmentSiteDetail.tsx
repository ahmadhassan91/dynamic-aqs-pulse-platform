'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
    'The site is active with a manual warehouse reference.',
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

  const completeRose = () => runWorkflowAction(
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
        notes: 'Completed from Pulse consignment workspace with manual variance capture.',
        lines: [
          {
            sku: 'MANUAL-VARIANCE',
            productName: 'Manual consignment variance',
            expectedQuantity: 1,
            actualQuantity: 0,
          },
        ],
      });
    },
    'ROSE audit was completed and variance follow-up was opened.',
  );

  if (!isHydrated) {
    return <Loader color="blue" />;
  }

  if (!auth) {
    return null;
  }

  const breadcrumbItems = [
    { title: 'Consignment', href: '/consignment' },
    { title: site?.accountName ?? 'Site Detail', href: `/consignment/${siteId}` },
  ].map((item) => (
    <Anchor component={Link} href={item.href} key={item.href} size="sm">
      {item.title}
    </Anchor>
  ));

  return (
    <Stack gap="md">
      <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>

      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1}>{site?.accountName ?? 'Consignment Site'}</Title>
            <Text size="sm" c="dimmed">
              Site readiness, ROSE cadence, documents, manual variance review, and ERP handoff items that are waiting on Acumatica access.
            </Text>
            {site ? (
              <Group gap="xs">
                <Badge color={consignmentStatusColor(site.status)} variant="light">
                  {formatConsignmentStatus(site.status)}
                </Badge>
                <Badge color={site.acumaticaWarehouseId ? 'green' : 'gray'} variant="outline">
                  {site.acumaticaWarehouseId ?? 'Acumatica warehouse pending'}
                </Badge>
              </Group>
            ) : null}
          </Stack>
          <Group gap="xs">
            <Button component={Link} href="/consignment" variant="default">
              Back To Sites
            </Button>
            {site?.accountId ? (
              <Button component={Link} href={`/customers/${site.accountId}`} variant="light">
                View Account
              </Button>
            ) : null}
          </Group>
        </Group>
      </Paper>

      {errorMessage ? <Alert color="red" variant="light">{errorMessage}</Alert> : null}

      {isLoading ? (
        <Card withBorder radius="md" p="xl">
          <Group justify="center">
            <Loader color="blue" />
          </Group>
        </Card>
      ) : null}

      {site ? (
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }}>
            <SummaryCard label="Next ROSE Audit" value={formatConsignmentDate(site.nextAuditDueAt)} />
            <SummaryCard label="Last Audit" value={formatConsignmentDate(site.lastAuditCompletedAt)} />
            <SummaryCard label="Open Work Items" value={String(site.openWorkItemCount ?? 0)} />
            <SummaryCard label="Open Discrepancies" value={String(site.openDiscrepancyCount ?? 0)} />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder radius="md" p="lg">
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

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Workflow Boundary</Title>
              <Stack gap="xs">
                <MetadataRow label="Agreement Forms" value={String(site.formCounts.agreement ?? 0)} />
                <MetadataRow label="BLUE Forms" value={String(site.formCounts.blue ?? 0)} />
                <MetadataRow label="ROSE Forms" value={String(site.formCounts.rose ?? 0)} />
                <MetadataRow label="PURPLE Forms" value={String(site.formCounts.purple ?? 0)} />
                <MetadataRow label="SAND Forms" value={String(site.formCounts.sand ?? 0)} />
                <MetadataRow label="Warehouse Handoff" value={site.acumaticaWarehouseId ? site.acumaticaWarehouseId : 'Parked until Acumatica creates or confirms the warehouse'} />
              </Stack>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Activation Readiness</Title>
              <Stack gap="xs">
                {readinessItems.map((item) => (
                  <ReadinessRow key={item.code} item={item} />
                ))}
                {readinessItems.length === 0 ? (
                  <Text size="sm" c="dimmed">Readiness checks are not available for this site.</Text>
                ) : null}
              </Stack>
            </Card>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Workflow Actions</Title>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Button variant="light" onClick={addSignedAgreement} loading={savingAction === 'agreement'}>
                  Add Agreement
                </Button>
                <Button variant="light" onClick={addBlueBaseline} loading={savingAction === 'blue'}>
                  Add BLUE
                </Button>
                <Button variant="light" onClick={activateSite} loading={savingAction === 'activate'}>
                  Mark Active
                </Button>
                <Button variant="light" onClick={scheduleRose} loading={savingAction === 'schedule-rose'}>
                  Schedule ROSE
                </Button>
                <Button variant="light" onClick={completeRose} loading={savingAction === 'complete-rose'}>
                  Complete ROSE
                </Button>
              </SimpleGrid>
              <Text size="xs" c="dimmed" mt="sm">
                Acumatica warehouse and PO creation remain parked; these actions persist Pulse workflow evidence only.
              </Text>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Documents</Title>
              {site.forms.length ? (
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
              ) : (
                <Text size="sm" c="dimmed">No consignment documents returned yet.</Text>
              )}
            </Card>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Audit History</Title>
              {site.audits.length ? (
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Scheduled</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Reconciliation</Table.Th>
                      <Table.Th>Completed</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {site.audits.map((audit) => (
                      <Table.Tr key={audit.id}>
                        <Table.Td>{formatConsignmentDate(audit.scheduledFor)}</Table.Td>
                        <Table.Td><Badge variant="light">{formatConsignmentStatus(audit.status)}</Badge></Table.Td>
                        <Table.Td>{formatConsignmentStatus(audit.reconciliationStatus)}</Table.Td>
                        <Table.Td>{formatConsignmentDate(audit.completedAt)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : (
                <Text size="sm" c="dimmed">No ROSE audit history returned yet.</Text>
              )}
            </Card>

            <Card withBorder radius="md" p="lg">
              <Title order={4} mb="md">Reviewed Field Notes</Title>
              {site.fieldActivity.length ? (
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
              ) : (
                <Text size="sm" c="dimmed">No reviewed mobile field notes are linked to this site yet.</Text>
              )}
            </Card>
          </SimpleGrid>
        </Stack>
      ) : null}
    </Stack>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap={2}>
        <Text size="xs" tt="uppercase" c="dimmed">{label}</Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Card>
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

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

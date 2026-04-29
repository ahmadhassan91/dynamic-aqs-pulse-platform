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
import { fetchConsignmentSiteDetail, type ConsignmentSiteDetail as ConsignmentSiteDetailRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { consignmentStatusColor, formatConsignmentDate, formatConsignmentStatus } from './ConsignmentWorkspace';

export function ConsignmentSiteDetail({ siteId }: { siteId: string }) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [site, setSite] = useState<ConsignmentSiteDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setSite(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchConsignmentSiteDetail(apiBaseUrl, auth.tokens.accessToken, siteId);
        if (!cancelled) {
          setSite(response);
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
              Site readiness, ROSE cadence, documents, manual variance handling, and the parked Acumatica handoff boundary.
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

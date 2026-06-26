'use client';

import Link from 'next/link';
import { Alert, Anchor, Button, Card, Group, Loader, Menu, SimpleGrid, Stack, Text } from '@mantine/core';
import {
  IconActivity,
  IconAlertTriangle,
  IconDownload,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import { useLeadDashboard } from '@/lib/use-lead-dashboard';
import { EmptyStateMessage, WorkbenchMetricStrip, WorkbenchTable } from '@/components/ui/Workbench';
import { ReportChart } from './ReportChart';
import { downloadTableCsv, downloadTableExcel, downloadTablePdf, type ExportColumn } from '@/lib/report-export';

/**
 * Lead dashboard for the Reporting Home — a role-scoped pipeline snapshot over
 * CRM-native lead data (no Acumatica/revenue). KPI cards + a stage funnel chart
 * (bar/line/area toggle) + per-stage aging + source/state breakdowns.
 */
export function LeadDashboard() {
  const { dashboard, isLoading, errorMessage } = useLeadDashboard();

  if (isLoading && !dashboard) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (errorMessage) {
    return (
      <Alert color="red" variant="light" title="Could not load the lead dashboard">
        {errorMessage}
      </Alert>
    );
  }

  if (!dashboard) {
    return (
      <EmptyStateMessage
        title="No lead data yet"
        description="Leads appear here as they are captured and routed."
        kind="no-data"
      />
    );
  }

  const { metrics, segmentation, byStage, bySource, byState, slaAtRisk } = dashboard;

  const slaExportColumns: ExportColumn[] = [
    { key: 'companyName', label: 'Company' },
    { key: 'stage', label: 'Stage' },
    { key: 'ownerName', label: 'Owner' },
    { key: 'daysOverdue', label: 'Days overdue' },
  ];
  const slaExportRows = slaAtRisk.map((row) => ({
    companyName: row.companyName,
    stage: row.stage.replace(/_/g, ' '),
    ownerName: row.ownerName ?? 'Unassigned',
    daysOverdue: row.daysOverdue,
  }));

  return (
    <Stack gap="lg">
      <WorkbenchMetricStrip
        columns={{ base: 1, sm: 2, lg: 4 }}
        metrics={[
          {
            label: 'Active leads',
            value: metrics.totalActiveLeads,
            icon: <IconUsers size={20} />,
            helper: 'In your pipeline',
            href: '/leads',
          },
          {
            label: 'New (unworked)',
            value: metrics.newStageCount,
            tone: metrics.newStageCount > 0 ? 'brand' : 'neutral',
            icon: <IconActivity size={20} />,
            href: '/leads',
          },
          {
            label: 'SLA at risk',
            value: metrics.slaAtRiskCount,
            tone: metrics.slaAtRiskCount > 0 ? 'danger' : 'success',
            icon: <IconAlertTriangle size={20} />,
            helper: 'Past initial-contact due',
            href: '/leads',
          },
          {
            label: 'Conversion rate',
            value: `${metrics.conversionRatePct}%`,
            tone: 'success',
            icon: <IconUserCheck size={20} />,
            helper: `${metrics.convertedLeads} of ${metrics.totalLeads} converted`,
            href: '/leads',
          },
        ]}
      />

      {slaAtRisk.length > 0 ? (
        <Card withBorder radius="lg" padding="lg">
          <Group justify="space-between" mb="md">
            <Text fw={700}>SLA at risk — needs contact now</Text>
            <Group gap="sm">
              <Text size="sm" c="dimmed">
                {slaAtRisk.length} lead{slaAtRisk.length === 1 ? '' : 's'} past initial-contact due
              </Text>
              <Menu shadow="md" width={150} position="bottom-end">
                <Menu.Target>
                  <Button size="compact-xs" variant="light" leftSection={<IconDownload size={14} />}>
                    Export
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item onClick={() => downloadTableCsv(slaExportColumns, slaExportRows, 'Lead SLA at risk')}>CSV</Menu.Item>
                  <Menu.Item onClick={() => downloadTableExcel(slaExportColumns, slaExportRows, 'Lead SLA at risk')}>Excel</Menu.Item>
                  <Menu.Item
                    onClick={() => {
                      void downloadTablePdf(slaExportColumns, slaExportRows, 'Lead SLA at risk');
                    }}
                  >
                    PDF
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
          <WorkbenchTable
            withContainer={false}
            pageSize={0}
            ariaLabel="Leads past initial-contact SLA"
            rows={slaAtRisk}
            getRowKey={(row) => row.leadId}
            columns={[
              {
                key: 'company',
                header: 'Company',
                render: (row) => (
                  <Anchor component={Link} href={`/leads/${row.leadId}`} size="sm">
                    {row.companyName}
                  </Anchor>
                ),
              },
              { key: 'stage', header: 'Stage', render: (row) => row.stage.replace(/_/g, ' ') },
              { key: 'owner', header: 'Owner', render: (row) => row.ownerName ?? 'Unassigned' },
              { key: 'overdue', header: 'Days overdue', align: 'right', render: (row) => row.daysOverdue },
            ]}
          />
        </Card>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="lg" padding="lg">
          <Text fw={700} mb="md">
            Pipeline by stage
          </Text>
          {byStage.length === 0 ? (
            <EmptyStateMessage title="No stage data" kind="no-data" />
          ) : (
            <Stack gap="sm">
              <ReportChart
                data={byStage}
                dataKey="label"
                series={[{ name: 'count', label: 'Leads', color: 'blue.6' }]}
                height={220}
              />
              <Stack gap={4}>
                {byStage.filter((bucket) => bucket.count > 0).map((bucket) => (
                  <Group key={bucket.stage} justify="space-between" wrap="nowrap">
                    <Text size="xs" c="dimmed">{bucket.label}</Text>
                    <Text size="xs" c={bucket.staleCount > 0 ? 'orange.7' : 'dimmed'}>
                      avg {bucket.avgDaysInStage}d · max {bucket.maxDaysInStage}d{bucket.staleCount > 0 ? ` · ${bucket.staleCount} stale` : ''}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
          )}
        </Card>

        <Card withBorder radius="lg" padding="lg">
          <Text fw={700} mb="md">
            Lead segmentation
          </Text>
          <WorkbenchMetricStrip
            columns={{ base: 1, sm: 3 }}
            metrics={[
              { label: 'Homeowner', value: segmentation.homeowner },
              { label: 'Contractor', value: segmentation.contractor },
              { label: 'Unspecified', value: segmentation.unspecified, tone: 'neutral' },
            ]}
          />
          <Text size="xs" c="dimmed" mt="md">
            Recent intake (last 30 days): <strong>{metrics.intakeLast30Days}</strong>
          </Text>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="lg" padding="lg">
          <Text fw={700} mb="md">
            Top sources
          </Text>
          <WorkbenchTable
            withContainer={false}
            pageSize={0}
            ariaLabel="Leads by source"
            rows={bySource}
            getRowKey={(row) => row.key}
            emptyState={<EmptyStateMessage title="No source data" kind="no-data" />}
            columns={[
              { key: 'source', header: 'Source', render: (row) => row.key },
              { key: 'count', header: 'Leads', align: 'right', render: (row) => row.count },
            ]}
          />
        </Card>

        <Card withBorder radius="lg" padding="lg">
          <Text fw={700} mb="md">
            Top states
          </Text>
          <WorkbenchTable
            withContainer={false}
            pageSize={0}
            ariaLabel="Leads by state"
            rows={byState}
            getRowKey={(row) => row.key}
            emptyState={<EmptyStateMessage title="No state data" kind="no-data" />}
            columns={[
              { key: 'state', header: 'State', render: (row) => row.key },
              { key: 'count', header: 'Leads', align: 'right', render: (row) => row.count },
            ]}
          />
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

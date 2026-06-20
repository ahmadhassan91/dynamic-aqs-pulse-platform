'use client';

import { Alert, Group, Loader, Stack } from '@mantine/core';
import { IconAlertTriangle, IconBuildingWarehouse, IconSchool, IconUsers } from '@tabler/icons-react';
import { useExecutiveDashboard } from '@/lib/use-executive-dashboard';
import { EmptyStateMessage, WorkbenchAttentionLane, WorkbenchMetricStrip } from '@/components/ui/Workbench';

/**
 * Executive overview for the Reporting Home (reports.executive gate). Org-wide
 * CRM-native KPIs + a cross-module exception summary. Revenue/financial KPIs are
 * parked on Acumatica and intentionally excluded (noted inline). No chart library.
 */
export function ExecutiveDashboard() {
  const { dashboard, isLoading, errorMessage } = useExecutiveDashboard();

  if (isLoading && !dashboard) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (errorMessage) {
    return (
      <Alert color="red" variant="light" title="Could not load the executive dashboard">
        {errorMessage}
      </Alert>
    );
  }

  if (!dashboard) {
    return <EmptyStateMessage title="No data yet" kind="no-data" />;
  }

  const { metrics, exceptions, windowDays } = dashboard;

  return (
    <Stack gap="lg">
      <WorkbenchMetricStrip
        columns={{ base: 1, sm: 2, lg: 4 }}
        metrics={[
          { label: 'Open leads', value: metrics.openLeads, icon: <IconUsers size={20} />, helper: 'Active pipeline' },
          { label: 'Active consignment sites', value: metrics.activeConsignmentSites, icon: <IconBuildingWarehouse size={20} /> },
          { label: 'Trainings completed', value: metrics.trainingsCompleted, icon: <IconSchool size={20} />, helper: `Last ${windowDays} days` },
          {
            label: 'Open exceptions',
            value: metrics.openExceptions,
            tone: metrics.openExceptions > 0 ? 'danger' : 'success',
            icon: <IconAlertTriangle size={20} />,
          },
        ]}
      />

      <WorkbenchAttentionLane
        title="Cross-module exceptions"
        description="Everything that needs leadership attention across modules, in one place."
        items={[
          { id: 'audits', title: 'Overdue ROSE audits', description: 'Active consignment sites past their next audit date', count: exceptions.overdueAudits, tone: 'warning' },
          { id: 'training', title: 'Overdue training', description: 'Active training programs past due', count: exceptions.overdueTraining, tone: 'warning' },
          { id: 'leads', title: 'Stale leads', description: 'Past initial-contact SLA, not yet contacted', count: exceptions.staleLeads, tone: 'danger' },
          { id: 'consignment', title: 'Open consignment work items', description: 'Variance / PO / exit items still open', count: exceptions.openConsignmentWorkItems, tone: 'warning' },
        ]}
        emptyState="All clear — no open cross-module exceptions."
      />

      <Alert color="gray" variant="light" title="Revenue & financial KPIs arrive with the ERP feed">
        YTD revenue, YoY, goal-vs-actual and account spend stay parked until the Acumatica integration is
        approved — this view covers the CRM activity layer so the numbers here are always trustworthy.
      </Alert>
    </Stack>
  );
}

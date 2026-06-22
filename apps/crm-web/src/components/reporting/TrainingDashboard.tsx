'use client';

import { Alert, Card, Group, Loader, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconClockHour4, IconSchool, IconUsers } from '@tabler/icons-react';
import { useTrainingDashboard } from '@/lib/use-training-dashboard';
import { EmptyStateMessage, WorkbenchMetricStrip, WorkbenchTable } from '@/components/ui/Workbench';
import { ReportChart } from './ReportChart';

/**
 * Training dashboard for the Reporting Home — a role-scoped view over CRM-native
 * training data (no Acumatica). KPI cards + hours-by-trainer + by-type breakdowns
 * + an overdue-program list. Dependency-free (no chart library).
 */
export function TrainingDashboard() {
  const { dashboard, isLoading, errorMessage } = useTrainingDashboard();

  if (isLoading && !dashboard) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (errorMessage) {
    return (
      <Alert color="red" variant="light" title="Could not load the training dashboard">
        {errorMessage}
      </Alert>
    );
  }

  if (!dashboard) {
    return (
      <EmptyStateMessage
        title="No training data yet"
        description="Training sessions appear here as they are completed."
        kind="no-data"
      />
    );
  }

  const { metrics, byType, byTrainer, overdueAccounts, windowDays } = dashboard;

  return (
    <Stack gap="lg">
      <WorkbenchMetricStrip
        columns={{ base: 1, sm: 2, lg: 4 }}
        metrics={[
          {
            label: 'Completed sessions',
            value: metrics.completedSessions,
            icon: <IconSchool size={20} />,
            helper: `Last ${windowDays} days`,
            href: '/training',
          },
          {
            label: 'Training hours',
            value: metrics.trainingHours,
            icon: <IconClockHour4 size={20} />,
            helper: `${metrics.siteVisits} site visit${metrics.siteVisits === 1 ? '' : 's'}`,
            href: '/training',
          },
          {
            label: 'Accounts trained',
            value: metrics.accountsTrained,
            icon: <IconUsers size={20} />,
            href: '/training',
          },
          {
            label: 'Overdue programs',
            value: metrics.overduePrograms,
            tone: metrics.overduePrograms > 0 ? 'danger' : 'success',
            icon: <IconAlertTriangle size={20} />,
            href: '/training',
          },
        ]}
      />

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Card withBorder radius="lg" padding="lg">
          <Text fw={700} mb="md">
            Hours by trainer
          </Text>
          {byTrainer.length > 0 ? (
            <ReportChart
              data={byTrainer}
              dataKey="key"
              series={[{ name: 'hours', label: 'Hours', color: 'teal.6' }]}
              height={200}
            />
          ) : null}
          <WorkbenchTable
            withContainer={false}
            pageSize={0}
            ariaLabel="Training hours by trainer"
            rows={byTrainer}
            getRowKey={(row) => row.key}
            emptyState={<EmptyStateMessage title="No completed trainings" kind="no-data" />}
            columns={[
              { key: 'trainer', header: 'Trainer', render: (row) => row.key },
              { key: 'sessions', header: 'Sessions', align: 'right', render: (row) => row.sessions },
              { key: 'hours', header: 'Hours', align: 'right', render: (row) => row.hours },
            ]}
          />
        </Card>

        <Card withBorder radius="lg" padding="lg">
          <Text fw={700} mb="md">
            By training type
          </Text>
          {byType.length > 0 ? (
            <ReportChart
              data={byType}
              dataKey="key"
              series={[{ name: 'sessions', label: 'Sessions', color: 'blue.6' }]}
              height={200}
            />
          ) : null}
          <WorkbenchTable
            withContainer={false}
            pageSize={0}
            ariaLabel="Sessions by training type"
            rows={byType}
            getRowKey={(row) => row.key}
            emptyState={<EmptyStateMessage title="No completed sessions" kind="no-data" />}
            columns={[
              { key: 'type', header: 'Type', render: (row) => row.key },
              { key: 'sessions', header: 'Sessions', align: 'right', render: (row) => row.sessions },
              { key: 'hours', header: 'Hours', align: 'right', render: (row) => row.hours },
            ]}
          />
        </Card>
      </SimpleGrid>

      <Card withBorder radius="lg" padding="lg">
        <Text fw={700} mb="md">
          Overdue training programs
        </Text>
        <WorkbenchTable
          withContainer={false}
          pageSize={0}
          ariaLabel="Overdue training programs"
          rows={overdueAccounts}
          getRowKey={(row) => row.account}
          emptyState={(
            <EmptyStateMessage
              title="No overdue training"
              description="Every active training program is on schedule."
              kind="all-clear"
            />
          )}
          columns={[
            { key: 'account', header: 'Account', render: (row) => row.account },
            { key: 'days', header: 'Days overdue', align: 'right', render: (row) => row.daysOverdue },
            { key: 'due', header: 'Was due', render: (row) => (row.nextDueAt ? new Date(row.nextDueAt).toLocaleDateString() : '—') },
          ]}
        />
      </Card>
    </Stack>
  );
}

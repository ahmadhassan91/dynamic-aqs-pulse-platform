'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { AdminIntegrationStatusResponse } from '@pulse/contracts';
import type { AdminConsignmentAlertDeliverySettingsResponse } from '@/lib/pulse-api-ext-admin-consignment';

export function ConsignmentAlertDeliveryPanel({
  settings,
  statuses,
}: {
  settings: AdminConsignmentAlertDeliverySettingsResponse | null;
  statuses: AdminIntegrationStatusResponse | null;
}) {
  const alertStatuses = (statuses?.integrations ?? []).filter(
    (entry) => entry.key === 'consignment-operational-alerts',
  );
  const metrics = settings?.metrics;

  return (
    <Stack gap="md">
      {alertStatuses.length > 0 ? (
        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
          {alertStatuses.map((integration) => (
            <Card key={integration.key} withBorder radius="lg" p="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Title order={4}>{integration.label}</Title>
                  <Badge
                    color={
                      integration.status === 'connected'
                        ? 'green'
                        : integration.status === 'warning'
                          ? 'yellow'
                          : 'red'
                    }
                    variant="light"
                  >
                    {integration.status}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">
                  {integration.detail}
                </Text>
                <Text size="xs" c="dimmed">
                  Health: {integration.health}% / Checked {new Date(integration.lastCheckedAt).toLocaleString()}
                </Text>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      ) : null}

      {settings && settings.configurationIssues.length > 0 ? (
        <Alert color={settings.status === 'blocked' ? 'red' : 'yellow'}>
          Consignment alert delivery setup needs attention: {settings.configurationIssues.join(', ')}
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>Consignment alert delivery</Title>
              <Text size="sm" c="dimmed">
                Monitor operational consignment alerts (audit due, PO clock, overdue escalations). The scanner persists
                alerts in-app. Email delivery requires Microsoft Graph credential certification.
              </Text>
            </Stack>
            <Badge
              color={
                settings?.status === 'ready'
                  ? 'green'
                  : settings?.status === 'warning'
                    ? 'yellow'
                    : 'red'
              }
              variant="light"
            >
              {settings?.mode ?? 'loading'}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
            <MetricCard label="Pending alerts" value={metrics?.pendingAlertCount ?? 0} />
            <MetricCard
              label="Failed alerts"
              value={metrics?.failedAlertCount ?? 0}
              tone={(metrics?.failedAlertCount ?? 0) > 0 ? 'red' : 'gray'}
            />
            <MetricCard
              label="Retryable failures"
              value={metrics?.retryableFailedAlertCount ?? 0}
              tone={(metrics?.retryableFailedAlertCount ?? 0) > 0 ? 'yellow' : 'gray'}
            />
            <MetricCard label="Sent attempts" value={metrics?.sentAttemptCount ?? 0} />
          </SimpleGrid>

          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Th>Provider</Table.Th>
                <Table.Td>{settings?.deliveryProvider ?? 'unknown'}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Previewed</Table.Th>
                <Table.Td>{metrics?.previewedAttemptCount ?? 0}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Skipped</Table.Th>
                <Table.Td>{metrics?.skippedAttemptCount ?? 0}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th>Provider failures</Table.Th>
                <Table.Td>{metrics?.failedAttemptCount ?? 0}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {settings?.integrationNote ? (
            <Alert color="blue" variant="light">
              <Text size="sm">{settings.integrationNote}</Text>
            </Alert>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}

function MetricCard({
  label,
  value,
  tone = 'blue',
}: {
  label: string;
  value: number;
  tone?: 'blue' | 'gray' | 'red' | 'yellow';
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" tt="uppercase">
          {label}
        </Text>
        <Title order={3}>
          <Badge color={tone} variant="light" size="lg">
            {value}
          </Badge>
        </Title>
      </Stack>
    </Card>
  );
}

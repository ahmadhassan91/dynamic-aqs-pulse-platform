'use client';

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import type {
  AdminIntegrationStatusResponse,
  AdminLeadOperationalAlertDeliverySettingsResponse,
} from '@pulse/contracts';

export function AdminLeadAlertDeliveryPanel({
  settings,
  statuses,
  canManage,
  isSaving,
  onRetryFailed,
  onDeadLetterLatestFailure,
  onQuietHoursChange,
  onRecipientChange,
}: {
  settings: AdminLeadOperationalAlertDeliverySettingsResponse | null;
  statuses: AdminIntegrationStatusResponse | null;
  canManage: boolean;
  isSaving: boolean;
  onRetryFailed: () => void | Promise<void>;
  onDeadLetterLatestFailure: (reason: string) => void | Promise<void>;
  onQuietHoursChange: (input: { enabled?: boolean; startLocal?: string; endLocal?: string; timeZone?: string }) => void | Promise<void>;
  onRecipientChange: (
    recipientId: string,
    input: { name?: string; email?: string | null; roleTitle?: string | null; isActive?: boolean; sortOrder?: number },
  ) => void | Promise<void>;
}) {
  const alertStatuses = (statuses?.integrations ?? []).filter((entry) => entry.key === 'lead-operational-alerts');
  const metrics = settings?.metrics;
  const [deadLetterReason, setDeadLetterReason] = useState('');
  const canRetry = canManage && !isSaving && (metrics?.retryableFailedAlertCount ?? 0) > 0;
  const canDeadLetter = canManage && !isSaving && Boolean(metrics?.latestFailure) && deadLetterReason.trim().length > 0;

  return (
    <Stack gap="md">
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

      {settings && settings.configurationIssues.length > 0 ? (
        <Alert color={settings.status === 'blocked' ? 'red' : 'yellow'}>
          Lead alert delivery setup needs attention: {settings.configurationIssues.join(', ')}
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>Lead alert delivery</Title>
              <Text size="sm" c="dimmed">
                Monitor operational lead alerts, provider readiness, and failed sends that need retry review.
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
            <MetricCard label="Failed alerts" value={metrics?.failedAlertCount ?? 0} tone={(metrics?.failedAlertCount ?? 0) > 0 ? 'red' : 'gray'} />
            <MetricCard label="Retryable failures" value={metrics?.retryableFailedAlertCount ?? 0} tone={(metrics?.retryableFailedAlertCount ?? 0) > 0 ? 'yellow' : 'gray'} />
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
              {settings?.microsoftGraph ? (
                <Table.Tr>
                  <Table.Th>Graph sender</Table.Th>
                  <Table.Td>{settings.microsoftGraph.fromUser ?? 'Not configured'}</Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Title order={4}>Quiet hours</Title>
                  <Text size="sm" c="dimmed">
                    Hold new lead alert scans during the configured local window.
                  </Text>
                </Stack>
                <Switch
                  label="Enabled"
                  checked={settings?.quietHours.enabled ?? false}
                  disabled={!canManage || !settings || isSaving}
                  onChange={(event) => {
                    void onQuietHoursChange({ enabled: event.currentTarget.checked });
                  }}
                />
              </Group>
              <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
                <TextInput
                  label="Start"
                  key={`quiet-start-${settings?.quietHours.startLocal ?? 'empty'}`}
                  defaultValue={settings?.quietHours.startLocal ?? ''}
                  disabled={!canManage || !settings || isSaving}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (/^\d{2}:\d{2}$/.test(value)) {
                      void onQuietHoursChange({ startLocal: value });
                    }
                  }}
                />
                <TextInput
                  label="End"
                  key={`quiet-end-${settings?.quietHours.endLocal ?? 'empty'}`}
                  defaultValue={settings?.quietHours.endLocal ?? ''}
                  disabled={!canManage || !settings || isSaving}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    if (/^\d{2}:\d{2}$/.test(value)) {
                      void onQuietHoursChange({ endLocal: value });
                    }
                  }}
                />
                <TextInput
                  label="Time zone"
                  key={`quiet-tz-${settings?.quietHours.timeZone ?? 'empty'}`}
                  defaultValue={settings?.quietHours.timeZone ?? ''}
                  disabled={!canManage || !settings || isSaving}
                  onChange={(event) => {
                    const value = event.currentTarget.value.trim();
                    if (value.includes('/')) {
                      void onQuietHoursChange({ timeZone: value });
                    }
                  }}
                />
              </SimpleGrid>
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Title order={4}>Recipient governance</Title>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(settings?.recipients ?? []).map((recipient) => (
                    <Table.Tr key={recipient.id}>
                      <Table.Td>
                        <Text size="sm">{recipient.name}</Text>
                        <Text size="xs" c="dimmed">{recipient.routingTeam}</Text>
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          key={`${recipient.id}-${recipient.updatedAt}`}
                          defaultValue={recipient.email ?? ''}
                          disabled={!canManage || isSaving}
                          onBlur={(event) => {
                            const value = event.currentTarget.value.trim();
                            if (value !== (recipient.email ?? '')) {
                              void onRecipientChange(recipient.id, { email: value || null });
                            }
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{recipient.roleTitle ?? 'Unassigned'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Switch
                          checked={recipient.isActive}
                          disabled={!canManage || isSaving}
                          onChange={(event) => {
                            void onRecipientChange(recipient.id, { isActive: event.currentTarget.checked });
                          }}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          </Card>

          {metrics?.latestFailure ? (
            <Alert color="yellow">
              <Stack gap="xs">
                <Text size="sm">
                  Latest failure: {metrics.latestFailure.recipientName}
                  {metrics.latestFailure.recipientEmail ? ` <${metrics.latestFailure.recipientEmail}>` : ''} on{' '}
                  {new Date(metrics.latestFailure.attemptedAt).toLocaleString()}
                  {metrics.latestFailure.errorMessage ? ` - ${metrics.latestFailure.errorMessage}` : ''}
                </Text>
                <Textarea
                  label="Dead-letter reason"
                  value={deadLetterReason}
                  onChange={(event) => setDeadLetterReason(event.currentTarget.value)}
                  minRows={2}
                  disabled={!canManage || isSaving}
                />
                <Group justify="flex-end">
                  <Button
                    variant="light"
                    color="blue"
                    disabled={!canRetry}
                    loading={isSaving}
                    onClick={() => {
                      void onRetryFailed();
                    }}
                  >
                    Retry failed alerts
                  </Button>
                  <Button
                    variant="light"
                    color="yellow"
                    disabled={!canDeadLetter}
                    loading={isSaving}
                    onClick={() => {
                      void onDeadLetterLatestFailure(deadLetterReason.trim());
                      setDeadLetterReason('');
                    }}
                  >
                    Mark latest as skipped
                  </Button>
                </Group>
              </Stack>
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

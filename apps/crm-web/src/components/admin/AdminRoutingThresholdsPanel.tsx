'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import type { AdminRoutingThresholdsResponse } from '@/lib/pulse-api-ext-admin-consignment';

export function AdminRoutingThresholdsPanel({
  settings,
  isLoading,
  error,
  canManage,
}: {
  settings: AdminRoutingThresholdsResponse | null;
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
}) {
  return (
    <Stack gap="md">
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-start" mb="md">
          <Stack gap={4}>
            <Title order={3}>Routing thresholds & SLA timers</Title>
            <Text size="sm" c="dimmed">
              System-wide thresholds for lead assignment SLAs, follow-up overdue windows, PO clock duration, and
              audit cadence. Changes to these values affect all territories.
            </Text>
          </Stack>
          <Badge color="yellow" variant="light">Read-only (parked)</Badge>
        </Group>

        <Alert color="yellow" mb="md">
          Threshold write mutations are parked — no backend CRUD endpoint exists yet. These values reflect
          the system defaults. To change them, a backend endpoint at{' '}
          <Text component="span" ff="monospace" size="sm">PATCH /api/v1/admin/routing-thresholds</Text>{' '}
          needs to be added to apps/api/src/modules/admin/http.ts.
        </Alert>

        {error ? (
          <Alert color="red" mb="md">{error}</Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Stack gap={2}>
                <Text fw={600} size="sm">Lead assignment SLA</Text>
                <Text size="xs" c="dimmed">Hours from intake to first TM assignment before SLA breach</Text>
              </Stack>
              <NumberInput
                value={settings?.leadAssignmentSlaHours ?? 24}
                suffix=" hours"
                disabled={!canManage || isLoading || true}
                min={1}
                max={168}
              />
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Stack gap={2}>
                <Text fw={600} size="sm">Overdue follow-up window</Text>
                <Text size="xs" c="dimmed">Days before an unresolved follow-up is flagged overdue</Text>
              </Stack>
              <NumberInput
                value={settings?.overdueFollowUpDays ?? 7}
                suffix=" days"
                disabled={!canManage || isLoading || true}
                min={1}
                max={30}
              />
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Stack gap={2}>
                <Text fw={600} size="sm">Consignment PO clock</Text>
                <Text size="xs" c="dimmed">Business days from true-up confirmation to PO deadline (FR-CSG-030)</Text>
              </Stack>
              <NumberInput
                value={settings?.poClockBusinessDays ?? 5}
                suffix=" business days"
                disabled={!canManage || isLoading || true}
                min={1}
                max={30}
              />
            </Stack>
          </Card>

          <Card withBorder radius="md" p="md">
            <Stack gap="sm">
              <Stack gap={2}>
                <Text fw={600} size="sm">ROSE audit cadence</Text>
                <Text size="xs" c="dimmed">Days between scheduled ROSE audits (FR-CSG-019)</Text>
              </Stack>
              <NumberInput
                value={settings?.auditOverdueDays ?? 90}
                suffix=" days"
                disabled={!canManage || isLoading || true}
                min={30}
                max={365}
              />
            </Stack>
          </Card>
        </SimpleGrid>
      </Card>
    </Stack>
  );
}

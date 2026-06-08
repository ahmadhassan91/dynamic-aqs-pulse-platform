'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { EmptyStateMessage } from '@/components/ui/Workbench';
import type { AdminFeatureFlagSummary } from '@/lib/pulse-api-ext-admin-consignment';

export function AdminFeatureFlagsPanel({
  flags,
  isLoading,
  error,
  canManage,
}: {
  flags: AdminFeatureFlagSummary[];
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
}) {
  return (
    <Stack gap="md">
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-start" mb="md">
          <Stack gap={4}>
            <Title order={3}>Feature flags</Title>
            <Text size="sm" c="dimmed">
              Toggle experimental features, beta modules, or gated capabilities. Changes take effect on the
              next page load for each user.
            </Text>
          </Stack>
          <Badge color="yellow" variant="light">Read-only (parked)</Badge>
        </Group>

        <Alert color="yellow" mb="md">
          Feature flag toggle mutations are parked — no backend CRUD endpoint exists yet. To enable writes,
          add a{' '}
          <Text component="span" ff="monospace" size="sm">PATCH /api/v1/admin/feature-flags/:key</Text>{' '}
          endpoint to apps/api/src/modules/admin/http.ts and persist flags via a FeatureFlag Prisma model.
        </Alert>

        {error ? (
          <Alert color="red" mb="md">{error}</Alert>
        ) : null}

        {flags.length === 0 ? (
          <EmptyStateMessage
            kind="no-data"
            title="No feature flags configured"
            description="Feature flags will appear here once the backend endpoint and flag model are added."
          />
        ) : (
          <Stack gap="sm">
            {flags.map((flag) => (
              <Card key={flag.key} withBorder radius="md" p="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Group gap="xs">
                      <Text fw={600} size="sm">{flag.label}</Text>
                      <Badge variant="light" color="gray" size="xs">
                        {flag.scope}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed">{flag.description}</Text>
                    <Text size="xs" c="dimmed">
                      Last changed: {new Date(flag.updatedAt).toLocaleString()}
                    </Text>
                  </Stack>
                  <Switch
                    checked={flag.enabled}
                    disabled={!canManage || isLoading}
                    label={flag.enabled ? 'Enabled' : 'Disabled'}
                    onChange={() => {
                      // PARKED: toggle mutation requires backend endpoint
                    }}
                  />
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}

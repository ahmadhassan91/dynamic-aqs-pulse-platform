'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import type { AdminSystemSettingsResponse } from '@/lib/pulse-api-ext-admin-consignment';

export function AdminSystemSettingsPanel({
  settings,
  isLoading,
  error,
  canManage,
}: {
  settings: AdminSystemSettingsResponse | null;
  isLoading: boolean;
  error: string | null;
  canManage: boolean;
}) {
  return (
    <Stack gap="md">
      <Card withBorder radius="lg" p="md">
        <Group justify="space-between" align="flex-start" mb="md">
          <Stack gap={4}>
            <Title order={3}>System settings</Title>
            <Text size="sm" c="dimmed">
              Company identity, default timezone, currency, and logo configuration. These values propagate
              to PDF exports, email footers, and the dealer portal header.
            </Text>
          </Stack>
          <Badge color="yellow" variant="light">Read-only (parked)</Badge>
        </Group>

        <Alert color="yellow" mb="md">
          System settings writes are parked — no backend CRUD endpoint exists yet. These values show the
          current defaults. To enable mutation, a backend endpoint at{' '}
          <Text component="span" ff="monospace" size="sm">PATCH /api/v1/admin/system-settings</Text>{' '}
          needs to be added to apps/api/src/modules/admin/http.ts.
        </Alert>

        {error ? (
          <Alert color="red" mb="md">{error}</Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Company name"
            description="Displayed in email headers, exports, and the Pulse nav bar"
            value={settings?.companyName ?? ''}
            disabled={!canManage || isLoading || true}
            readOnly
          />
          <TextInput
            label="Logo URL"
            description="HTTPS URL to the company logo (PNG or SVG, max 512 KB)"
            value={settings?.logoUrl ?? ''}
            placeholder="Not configured"
            disabled={!canManage || isLoading || true}
            readOnly
          />
          <TextInput
            label="Default timezone"
            description="IANA timezone identifier used for quiet-hour windows and report timestamps"
            value={settings?.timezone ?? ''}
            disabled={!canManage || isLoading || true}
            readOnly
          />
          <TextInput
            label="Currency"
            description="ISO 4217 currency code used for financial displays and exports"
            value={settings?.currency ?? ''}
            disabled={!canManage || isLoading || true}
            readOnly
          />
        </SimpleGrid>

        {settings?.updatedAt ? (
          <Text size="xs" c="dimmed" mt="md">
            Last updated: {new Date(settings.updatedAt).toLocaleString()}
          </Text>
        ) : null}
      </Card>
    </Stack>
  );
}

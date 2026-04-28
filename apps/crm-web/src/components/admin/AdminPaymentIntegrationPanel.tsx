'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type {
  AdminIntegrationStatusResponse,
  AdminPaymentIntegrationSettingsResponse,
  CisPaymentVaultProviderKey,
  PaymentIntegrationCaptureModeKey,
} from '@pulse/contracts';

export function AdminPaymentIntegrationPanel({
  settings,
  statuses,
  canManage,
  isSaving,
  onSave,
}: {
  settings: AdminPaymentIntegrationSettingsResponse | null;
  statuses: AdminIntegrationStatusResponse | null;
  canManage: boolean;
  isSaving: boolean;
  onSave: (values: {
    captureMode: PaymentIntegrationCaptureModeKey;
    defaultProvider: CisPaymentVaultProviderKey;
    allowCisCaptureTracking: boolean;
    allowAccountPaymentMethodManagement: boolean;
  }) => void | Promise<void>;
}) {
  const policy = settings?.policy;
  const paymentStatuses = (statuses?.integrations ?? []).filter((entry) => entry.key === 'tokenized-payments');

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {paymentStatuses.map((integration) => (
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
                Health: {integration.health}% • Checked {new Date(integration.lastCheckedAt).toLocaleString()}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      {settings && !settings.isConfigured ? (
        <Alert color="yellow">
          Hosted provider runtime is still parked for this environment. Pulse can keep recording tokenized capture outcomes manually while we finish the real provider adapter.
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>Payment integration settings</Title>
              <Text size="sm" c="dimmed">
                Keep account payment references PCI-safe while CIS card capture stays parked until Dynamic AQS confirms the revised capture flow.
              </Text>
            </Stack>
            <Badge color={settings?.isConfigured ? 'green' : 'yellow'} variant="light">
              {settings?.policy.captureMode === 'provider_runtime'
                ? 'CIS runtime parked'
                : settings?.isConfigured ? 'Manual lane ready' : 'Manual lane needs setup'}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Select
              label="Capture mode"
              description="CIS-hosted provider runtime is parked. Account payment-method management remains available separately."
              value={policy?.captureMode ?? 'manual_recording'}
              disabled={!canManage || !settings}
              data={[
                { value: 'manual_recording', label: 'CIS card capture parked' },
                { value: 'provider_runtime', label: 'Provider runtime (parked)' },
              ]}
              onChange={(value) => {
                if (!policy || !value) {
                  return;
                }

                void onSave({
                  captureMode: value as PaymentIntegrationCaptureModeKey,
                  defaultProvider: policy.defaultProvider,
                  allowCisCaptureTracking: policy.allowCisCaptureTracking,
                  allowAccountPaymentMethodManagement: policy.allowAccountPaymentMethodManagement,
                });
              }}
            />

            <Select
              label="Default provider"
              description="Used for account payment-method planning only until CIS card capture is re-approved."
              value={policy?.defaultProvider ?? 'unknown'}
              disabled={!canManage || !settings}
              data={[
                { value: 'unknown', label: 'Not locked yet' },
                { value: 'ebizcharge', label: 'eBizCharge' },
                { value: 'moneris', label: 'Moneris' },
              ]}
              onChange={(value) => {
                if (!policy || !value) {
                  return;
                }

                void onSave({
                  captureMode: policy.captureMode,
                  defaultProvider: value as CisPaymentVaultProviderKey,
                  allowCisCaptureTracking: policy.allowCisCaptureTracking,
                  allowAccountPaymentMethodManagement: policy.allowAccountPaymentMethodManagement,
                });
              }}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Switch
              label="CIS card capture tracking"
              description="Parked after the April 20 scope change. Pulse will not launch or record eBizCharge/Moneris capture from CIS."
              checked={false}
              disabled
            />

            <Switch
              label="Allow account payment method management"
              description="Keeps account-level tokenized payment methods available to finance and customer-financials workflows."
              checked={policy?.allowAccountPaymentMethodManagement ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  captureMode: policy.captureMode,
                  defaultProvider: policy.defaultProvider,
                  allowCisCaptureTracking: policy.allowCisCaptureTracking,
                  allowAccountPaymentMethodManagement: event.currentTarget.checked,
                });
              }}
            />
          </SimpleGrid>

          {!canManage ? (
            <Alert color="blue">
              You can review payment integration health here, but changing rollout settings requires integration management permission.
            </Alert>
          ) : null}

          {isSaving ? (
            <Text size="sm" c="dimmed">
              Saving payment integration settings...
            </Text>
          ) : null}
        </Stack>
      </Card>

      <Card withBorder radius="lg" p="md">
        <Stack gap="sm">
          <Title order={4}>Operational notes</Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Control</Table.Th>
                <Table.Th>Current value</Table.Th>
                <Table.Th>Effect</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Capture mode</Table.Td>
                <Table.Td>{policy?.captureMode === 'provider_runtime' ? 'Provider runtime' : 'Manual recording'}</Table.Td>
                <Table.Td>
                  {policy?.captureMode === 'provider_runtime'
                    ? 'Provider runtime is parked for CIS until the revised card-capture flow is approved.'
                    : 'CIS card capture stays outside Pulse; account payment methods are handled separately.'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Default provider</Table.Td>
                <Table.Td>{policy?.defaultProvider ?? 'unknown'}</Table.Td>
                <Table.Td>Used as the default operator choice for manual recording and future runtime rollout planning.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>CIS capture tracking</Table.Td>
                <Table.Td>{policy?.allowCisCaptureTracking ? 'Enabled' : 'Disabled'}</Table.Td>
                <Table.Td>Disabled while Dynamic AQS changes the CIS card-capture flow.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Account payment methods</Table.Td>
                <Table.Td>{policy?.allowAccountPaymentMethodManagement ? 'Enabled' : 'Disabled'}</Table.Td>
                <Table.Td>Controls whether tokenized account payment methods remain manageable in customer financial workflows.</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}

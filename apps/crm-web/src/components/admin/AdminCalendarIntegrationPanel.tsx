'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  Title,
} from '@mantine/core';
import type {
  AdminCalendarIntegrationSettingsResponse,
  AdminIntegrationStatusResponse,
  CalendarMeetingProviderKey,
} from '@pulse/contracts';

export function AdminCalendarIntegrationPanel({
  settings,
  statuses,
  canManage,
  isSaving,
  onSave,
}: {
  settings: AdminCalendarIntegrationSettingsResponse | null;
  statuses: AdminIntegrationStatusResponse | null;
  canManage: boolean;
  isSaving: boolean;
  onSave: (values: {
    allowUserConnections: boolean;
    sharedCalendarsEnabled: boolean;
    defaultMeetingProvider: CalendarMeetingProviderKey;
    autoSyncDiscoveryEnabled: boolean;
    autoSyncTrainingEnabled: boolean;
    pilotUserEmails: string[];
  }) => void | Promise<void>;
}) {
  const policy = settings?.policy;
  const calendarStatuses = (statuses?.integrations ?? []).filter((entry) => entry.key === 'outlook-calendar');

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {calendarStatuses.map((integration) => (
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
          Outlook mailbox sync still needs environment setup before users can connect. Missing keys:
          {' '}
          {settings.configurationIssues.join(', ')}
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>Calendar integration settings</Title>
              <Text size="sm" c="dimmed">
                Control Outlook rollout, pilot user access, shared calendar behavior, and default sync behavior for the centralized Pulse calendar.
              </Text>
            </Stack>
            <Badge color={settings?.isConfigured ? 'green' : 'yellow'} variant="light">
              {settings?.isConfigured ? 'Provider ready' : 'Provider setup pending'}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Switch
              label="Allow user Outlook connections"
              description="When off, users can still use the centralized calendar but cannot connect Outlook mailboxes."
              checked={policy?.allowUserConnections ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowUserConnections: event.currentTarget.checked,
                  sharedCalendarsEnabled: policy.sharedCalendarsEnabled,
                  defaultMeetingProvider: policy.defaultMeetingProvider,
                  autoSyncDiscoveryEnabled: policy.autoSyncDiscoveryEnabled,
                  autoSyncTrainingEnabled: policy.autoSyncTrainingEnabled,
                  pilotUserEmails: policy.pilotUserEmails,
                });
              }}
            />
            <Switch
              label="Allow shared calendars"
              description="When off, Outlook sync is limited to the user’s primary/owned calendars."
              checked={policy?.sharedCalendarsEnabled ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowUserConnections: policy.allowUserConnections,
                  sharedCalendarsEnabled: event.currentTarget.checked,
                  defaultMeetingProvider: policy.defaultMeetingProvider,
                  autoSyncDiscoveryEnabled: policy.autoSyncDiscoveryEnabled,
                  autoSyncTrainingEnabled: policy.autoSyncTrainingEnabled,
                  pilotUserEmails: policy.pilotUserEmails,
                });
              }}
            />
            <Switch
              label="Auto-sync discovery scheduling"
              description="Push lead discovery schedule changes to Outlook automatically."
              checked={policy?.autoSyncDiscoveryEnabled ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowUserConnections: policy.allowUserConnections,
                  sharedCalendarsEnabled: policy.sharedCalendarsEnabled,
                  defaultMeetingProvider: policy.defaultMeetingProvider,
                  autoSyncDiscoveryEnabled: event.currentTarget.checked,
                  autoSyncTrainingEnabled: policy.autoSyncTrainingEnabled,
                  pilotUserEmails: policy.pilotUserEmails,
                });
              }}
            />
            <Switch
              label="Auto-sync training scheduling"
              description="Push training session create/reschedule/cancel actions to Outlook automatically."
              checked={policy?.autoSyncTrainingEnabled ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowUserConnections: policy.allowUserConnections,
                  sharedCalendarsEnabled: policy.sharedCalendarsEnabled,
                  defaultMeetingProvider: policy.defaultMeetingProvider,
                  autoSyncDiscoveryEnabled: policy.autoSyncDiscoveryEnabled,
                  autoSyncTrainingEnabled: event.currentTarget.checked,
                  pilotUserEmails: policy.pilotUserEmails,
                });
              }}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Select
              label="Default meeting provider"
              description="Applied when a user first connects Outlook or resets back to environment defaults."
              value={policy?.defaultMeetingProvider ?? 'none'}
              disabled={!canManage || !settings}
              data={[
                { value: 'none', label: 'No auto meeting link' },
                { value: 'teams', label: 'Microsoft Teams' },
              ]}
              onChange={(value) => {
                if (!policy || !value) {
                  return;
                }

                void onSave({
                  allowUserConnections: policy.allowUserConnections,
                  sharedCalendarsEnabled: policy.sharedCalendarsEnabled,
                  defaultMeetingProvider: value as CalendarMeetingProviderKey,
                  autoSyncDiscoveryEnabled: policy.autoSyncDiscoveryEnabled,
                  autoSyncTrainingEnabled: policy.autoSyncTrainingEnabled,
                  pilotUserEmails: policy.pilotUserEmails,
                });
              }}
            />

            <TagsInput
              label="Pilot user emails"
              description="Leave blank for open rollout. Add one or more internal emails to restrict Outlook sync to a pilot group."
              value={policy?.pilotUserEmails ?? []}
              disabled={!canManage || !settings}
              onChange={(value) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowUserConnections: policy.allowUserConnections,
                  sharedCalendarsEnabled: policy.sharedCalendarsEnabled,
                  defaultMeetingProvider: policy.defaultMeetingProvider,
                  autoSyncDiscoveryEnabled: policy.autoSyncDiscoveryEnabled,
                  autoSyncTrainingEnabled: policy.autoSyncTrainingEnabled,
                  pilotUserEmails: value,
                });
              }}
            />
          </SimpleGrid>

          {!canManage ? (
            <Alert color="blue">
              You can review integration health here, but changing rollout settings requires calendar integration management permission.
            </Alert>
          ) : null}

          {isSaving ? (
            <Text size="sm" c="dimmed">
              Saving calendar integration settings...
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
                <Table.Td>Connection rollout</Table.Td>
                <Table.Td>{policy?.allowUserConnections ? 'Enabled' : 'Disabled'}</Table.Td>
                <Table.Td>Controls whether users can connect Outlook from the centralized calendar.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Pilot scope</Table.Td>
                <Table.Td>{policy?.pilotUserEmails.length ? `${policy?.pilotUserEmails.length} users` : 'Open rollout'}</Table.Td>
                <Table.Td>Restricts connection eligibility without affecting Microsoft sign-in itself.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Shared calendars</Table.Td>
                <Table.Td>{policy?.sharedCalendarsEnabled ? 'Allowed' : 'Owned/default only'}</Table.Td>
                <Table.Td>Controls whether non-primary editable Outlook calendars can be selected.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Default meeting provider</Table.Td>
                <Table.Td>{policy?.defaultMeetingProvider === 'teams' ? 'Teams' : 'None'}</Table.Td>
                <Table.Td>Sets the default remote meeting preference for newly connected Outlook calendars.</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}

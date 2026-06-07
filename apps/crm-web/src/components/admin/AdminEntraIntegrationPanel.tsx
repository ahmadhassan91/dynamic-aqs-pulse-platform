'use client';

import { useState } from 'react';
import {
  ActionIcon,
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
  TextInput,
  Title,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import type {
  AdminIntegrationStatusResponse,
  AdminMicrosoftEntraIntegrationSettingsResponse,
  AuthRole,
} from '@pulse/contracts';

const ROLE_OPTIONS: AuthRole[] = [
  'SUPER_ADMIN',
  'EXECUTIVE',
  'SALES_BD_LEADERSHIP',
  'FINANCE',
  'ADMIN_CSR_OPS',
  'REGIONAL_DIRECTOR',
  'TERRITORY_MANAGER',
  'TRAINING_OPS',
  'SALES_BD_REP',
];

function formatRoleLabel(role: AuthRole) {
  return role.replace(/_/g, ' ');
}

export function AdminEntraIntegrationPanel({
  settings,
  statuses,
  canManage,
  isSaving,
  onSave,
}: {
  settings: AdminMicrosoftEntraIntegrationSettingsResponse | null;
  statuses: AdminIntegrationStatusResponse | null;
  canManage: boolean;
  isSaving: boolean;
  onSave: (values: {
    allowEmailLinking: boolean;
    autoProvisionFromGroups: boolean;
    allowedDomains: string[];
    groupRoleMappings: Array<{ groupId: string; role: AuthRole }>;
  }) => void | Promise<void>;
}) {
  const authStatuses = (statuses?.integrations ?? []).filter((entry) => entry.key === 'microsoft-entra-auth');
  const policy = settings?.policy;
  const [newGroupId, setNewGroupId] = useState('');
  const [newRole, setNewRole] = useState<AuthRole | ''>('');

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="md">
        {authStatuses.map((integration) => (
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
          Microsoft Entra SSO still needs environment setup before internal users can sign in. Missing keys:
          {' '}
          {settings.configurationIssues.join(', ')}
        </Alert>
      ) : null}

      <Card withBorder radius="lg" p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Title order={3}>Microsoft Entra access settings</Title>
              <Text size="sm" c="dimmed">
                Control how internal Microsoft sign-in is approved, whether existing Pulse users can link by email,
                and which Entra groups may auto-provision internal access.
              </Text>
            </Stack>
            <Badge color={settings?.isConfigured ? 'green' : 'yellow'} variant="light">
              {settings?.isConfigured ? 'Provider ready' : 'Provider setup pending'}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Switch
              label="Allow email linking"
              description="When on, an existing internal Pulse user can link by matching Microsoft email even without a group mapping."
              checked={policy?.allowEmailLinking ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowEmailLinking: event.currentTarget.checked,
                  autoProvisionFromGroups: policy.autoProvisionFromGroups,
                  allowedDomains: policy.allowedDomains,
                  groupRoleMappings: policy.groupRoleMappings,
                });
              }}
            />

            <Switch
              label="Allow group-based auto-provisioning"
              description="When on, approved Entra groups can create internal Pulse users automatically."
              checked={policy?.autoProvisionFromGroups ?? false}
              disabled={!canManage || !settings}
              onChange={(event) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowEmailLinking: policy.allowEmailLinking,
                  autoProvisionFromGroups: event.currentTarget.checked,
                  allowedDomains: policy.allowedDomains,
                  groupRoleMappings: policy.groupRoleMappings,
                });
              }}
            />
          </SimpleGrid>

          <TagsInput
            label="Allowed email domains"
            description="Leave blank for no domain restriction. Example: dynamicaqs.com"
            value={policy?.allowedDomains ?? []}
            disabled={!canManage || !settings}
            onChange={(value) => {
              if (!policy) {
                return;
              }

              void onSave({
                allowEmailLinking: policy.allowEmailLinking,
                autoProvisionFromGroups: policy.autoProvisionFromGroups,
                allowedDomains: value,
                groupRoleMappings: policy.groupRoleMappings,
              });
            }}
          />

          <Stack gap="sm">
            <div>
              <Text size="sm" fw={500}>Group-role mappings</Text>
              <Text size="xs" c="dimmed">
                Map each Microsoft Entra group ID to a Pulse internal role. Each entry takes effect immediately on save.
              </Text>
            </div>

            {(policy?.groupRoleMappings.length ?? 0) > 0 ? (
              <Table withColumnBorders withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Group ID</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th w={52}></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {policy?.groupRoleMappings.map((entry) => (
                    <Table.Tr key={`${entry.groupId}-${entry.role}`}>
                      <Table.Td>
                        <Text ff="monospace" size="sm">{entry.groupId}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatRoleLabel(entry.role)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          disabled={!canManage || !policy}
                          aria-label={`Remove mapping for ${entry.groupId}`}
                          onClick={() => {
                            if (!policy) {
                              return;
                            }

                            void onSave({
                              allowEmailLinking: policy.allowEmailLinking,
                              autoProvisionFromGroups: policy.autoProvisionFromGroups,
                              allowedDomains: policy.allowedDomains,
                              groupRoleMappings: policy.groupRoleMappings.filter(
                                (m) => !(m.groupId === entry.groupId && m.role === entry.role),
                              ),
                            });
                          }}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text size="sm" c="dimmed">No admin-managed group mappings yet.</Text>
            )}

            {canManage && settings ? (
              <Group align="flex-end" gap="xs">
                <TextInput
                  label="Group ID"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={newGroupId}
                  onChange={(event) => setNewGroupId(event.currentTarget.value)}
                  style={{ flex: 2 }}
                  styles={{ input: { fontFamily: 'monospace' } }}
                />
                <Select
                  label="Role"
                  placeholder="Select role"
                  data={ROLE_OPTIONS.map((role) => ({ value: role, label: formatRoleLabel(role) }))}
                  value={newRole || null}
                  onChange={(value) => setNewRole((value as AuthRole | null) ?? '')}
                  style={{ flex: 1 }}
                />
                <Button
                  leftSection={<IconPlus size={14} />}
                  disabled={!newGroupId.trim() || !newRole || !policy || isSaving}
                  onClick={() => {
                    if (!newGroupId.trim() || !newRole || !policy) {
                      return;
                    }

                    const deduped = new Map(
                      policy.groupRoleMappings.map((m) => [m.groupId.toLowerCase(), m]),
                    );
                    deduped.set(newGroupId.trim().toLowerCase(), { groupId: newGroupId.trim(), role: newRole });
                    void onSave({
                      allowEmailLinking: policy.allowEmailLinking,
                      autoProvisionFromGroups: policy.autoProvisionFromGroups,
                      allowedDomains: policy.allowedDomains,
                      groupRoleMappings: [...deduped.values()],
                    });
                    setNewGroupId('');
                    setNewRole('');
                  }}
                >
                  Add mapping
                </Button>
              </Group>
            ) : null}
          </Stack>

          {!canManage ? (
            <Alert color="blue">
              You can review Microsoft Entra status here, but changing access policy requires integration management permission.
            </Alert>
          ) : null}

          {isSaving ? (
            <Text size="sm" c="dimmed">
              Saving Microsoft Entra access settings...
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
                <Table.Td>Email linking</Table.Td>
                <Table.Td>{policy?.allowEmailLinking ? 'Enabled' : 'Disabled'}</Table.Td>
                <Table.Td>Controls whether a pre-created Pulse user can link by Microsoft email alone.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Auto-provision from groups</Table.Td>
                <Table.Td>{policy?.autoProvisionFromGroups ? 'Enabled' : 'Disabled'}</Table.Td>
                <Table.Td>Controls whether approved Entra groups can create internal Pulse users automatically.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Allowed domains</Table.Td>
                <Table.Td>{policy?.allowedDomains.length ? policy.allowedDomains.join(', ') : 'Open'}</Table.Td>
                <Table.Td>Restricts new links and auto-provisioning to approved email domains.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Stored mappings</Table.Td>
                <Table.Td>{policy?.groupRoleMappings.length ?? 0}</Table.Td>
                <Table.Td>Admin-managed group mappings are merged with env defaults into one effective role map.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Env mappings</Table.Td>
                <Table.Td>{policy?.envGroupRoleMappings.length ?? 0}</Table.Td>
                <Table.Td>Env mappings remain supported as a safe fallback and are still visible here for auditability.</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Effective mappings</Table.Td>
                <Table.Td>{policy?.effectiveGroupRoleMappings.length ?? 0}</Table.Td>
                <Table.Td>Effective mappings are the merged values the runtime actually uses during Microsoft sign-in.</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {(policy?.effectiveGroupRoleMappings.length ?? 0) > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Group ID</Table.Th>
                  <Table.Th>Role</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {policy?.effectiveGroupRoleMappings.map((entry) => (
                  <Table.Tr key={`${entry.groupId}-${entry.role}`}>
                    <Table.Td>
                      <Text ff="monospace" size="sm">{entry.groupId}</Text>
                    </Table.Td>
                    <Table.Td>{formatRoleLabel(entry.role)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Alert color="yellow">
              No Microsoft Entra group-role mappings are configured yet. Right now, internal Microsoft sign-in falls back to approved email linking only.
            </Alert>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

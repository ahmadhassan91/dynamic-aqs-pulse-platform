'use client';

import {
  Alert,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
  Title,
} from '@mantine/core';
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

function toMappingTags(settings: AdminMicrosoftEntraIntegrationSettingsResponse | null) {
  return (settings?.policy.groupRoleMappings ?? []).map((entry) => `${entry.groupId}=${entry.role}`);
}

function fromMappingTags(values: string[]) {
  const mappings = values.flatMap((value) => {
    const [groupId, role] = value.split('=').map((entry) => entry?.trim());
    if (!groupId || !role || !ROLE_OPTIONS.includes(role as AuthRole)) {
      return [];
    }

    return [{
      groupId,
      role: role as AuthRole,
    }];
  });

  const deduped = new Map<string, { groupId: string; role: AuthRole }>();
  for (const entry of mappings) {
    deduped.set(entry.groupId.toLowerCase(), entry);
  }

  return [...deduped.values()];
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

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
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

            <TagsInput
              label="Stored group-role mappings"
              description="Use groupId=ROLE, for example: 11111111-2222-3333-4444-555555555555=SUPER_ADMIN"
              value={toMappingTags(settings)}
              disabled={!canManage || !settings}
              onChange={(value) => {
                if (!policy) {
                  return;
                }

                void onSave({
                  allowEmailLinking: policy.allowEmailLinking,
                  autoProvisionFromGroups: policy.autoProvisionFromGroups,
                  allowedDomains: policy.allowedDomains,
                  groupRoleMappings: fromMappingTags(value),
                });
              }}
            />
          </SimpleGrid>

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

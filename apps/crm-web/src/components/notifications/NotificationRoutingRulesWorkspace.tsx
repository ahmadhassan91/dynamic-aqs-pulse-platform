'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Container, Group, Loader, Select, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type {
  NotificationRoutingRecipientTypeKey,
  NotificationRoutingRuleSummary,
  UserNotificationCategoryKey,
} from '@pulse/contracts/notifications';
import { createNotificationRoutingRuleRecord, deleteNotificationRoutingRuleRecord, fetchNotificationRoutingRules } from '@/lib/pulse-api';
import { canAccessModule } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

// Dropdown options derived from the contract TYPES (not the imported const values): those value imports resolve
// `undefined` inside this route's Turbopack chunk (the same bundler quirk fixed in NotificationsWorkspace), which
// crashed this page on the deployed build. The Records are keyed by the contract types, so adding/removing a value
// in the contract is a compile error here — no drift.
const CATEGORY_LABELS: Record<UserNotificationCategoryKey, string> = {
  lead: 'Lead',
  consignment: 'Consignment',
  training: 'Training',
  order: 'Order',
  account: 'Account',
  system: 'System',
};
const CATEGORY_OPTIONS = (Object.keys(CATEGORY_LABELS) as UserNotificationCategoryKey[]).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));
const RECIPIENT_TYPE_LABELS: Record<NotificationRoutingRecipientTypeKey, string> = {
  role: 'Role',
  user: 'User',
};
const RECIPIENT_TYPE_OPTIONS = (Object.keys(RECIPIENT_TYPE_LABELS) as NotificationRoutingRecipientTypeKey[]).map((value) => ({
  value,
  label: RECIPIENT_TYPE_LABELS[value],
}));

// FR-NOTIF-005 (GAP-N1) — admin UI for the routing rules ("determine who gets it"). The API is admin-gated
// server-side; this page additionally hides the controls from non-admins.
export function NotificationRoutingRulesWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const canManage = auth ? canAccessModule(auth.identity.role, 'admin') : false;

  const [rules, setRules] = useState<NotificationRoutingRuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState<UserNotificationCategoryKey>('lead');
  const [eventType, setEventType] = useState('');
  const [recipientType, setRecipientType] = useState<NotificationRoutingRecipientTypeKey>('role');
  const [recipientRoleCode, setRecipientRoleCode] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await fetchNotificationRoutingRules(apiBaseUrl, auth.tokens.accessToken);
      setRules(response.rules);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    if (!auth || !canManage) {
      setLoading(false);
      return;
    }
    void load();
  }, [auth, canManage, load]);

  if (!canManage) {
    return (
      <Container size="sm" py="lg">
        <Alert color="yellow" variant="light" title="Admins only">
          Notification routing rules are managed by administrators.
        </Alert>
      </Container>
    );
  }

  const handleCreate = async () => {
    if (!auth) return;
    if (recipientType === 'role' && !recipientRoleCode.trim()) {
      setError('Enter a role code for a role rule.');
      return;
    }
    if (recipientType === 'user' && !recipientUserId.trim()) {
      setError('Enter a user id for a user rule.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createNotificationRoutingRuleRecord(apiBaseUrl, auth.tokens.accessToken, {
        category,
        ...(eventType.trim() ? { eventType: eventType.trim() } : {}),
        recipientType,
        ...(recipientType === 'role' ? { recipientRoleCode: recipientRoleCode.trim() } : {}),
        ...(recipientType === 'user' ? { recipientUserId: recipientUserId.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setEventType('');
      setRecipientRoleCode('');
      setRecipientUserId('');
      setNote('');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!auth) return;
    try {
      await deleteNotificationRoutingRuleRecord(apiBaseUrl, auth.tokens.accessToken, ruleId);
      setRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
    }
  };

  return (
    <Container size="md" py="lg">
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={3}>Notification routing</Title>
          <Text c="dimmed" size="sm">
            Route a category (or a specific event) to extra recipients by role or user, beyond the default entity owners. These rules apply on top of who already gets a notification.
          </Text>
        </Stack>

        {error ? <Alert color="red" variant="light">{error}</Alert> : null}

        <Card withBorder radius="md" p="md">
          <Stack gap="sm">
            <Text fw={600} size="sm">Add a rule</Text>
            <Group grow align="flex-end">
              <Select
                label="Category"
                value={category}
                onChange={(value) => setCategory((value as UserNotificationCategoryKey | null) ?? 'lead')}
                data={CATEGORY_OPTIONS}
              />
              <TextInput label="Event type (optional)" placeholder="All events in category" value={eventType} onChange={(event) => setEventType(event.currentTarget.value)} />
              <Select
                label="Recipient type"
                value={recipientType}
                onChange={(value) => setRecipientType((value as NotificationRoutingRecipientTypeKey | null) ?? 'role')}
                data={RECIPIENT_TYPE_OPTIONS}
              />
            </Group>
            <Group grow align="flex-end">
              {recipientType === 'role' ? (
                <TextInput label="Role code" placeholder="e.g. REGIONAL_DIRECTOR" value={recipientRoleCode} onChange={(event) => setRecipientRoleCode(event.currentTarget.value)} />
              ) : (
                <TextInput label="User id" placeholder="User UUID" value={recipientUserId} onChange={(event) => setRecipientUserId(event.currentTarget.value)} />
              )}
              <TextInput label="Note (optional)" value={note} onChange={(event) => setNote(event.currentTarget.value)} />
            </Group>
            <Group justify="flex-end">
              <Button onClick={() => void handleCreate()} loading={saving}>Add rule</Button>
            </Group>
          </Stack>
        </Card>

        <Card withBorder radius="md" p={0}>
          {loading ? (
            <Group justify="center" p="xl"><Loader /></Group>
          ) : rules.length === 0 ? (
            <Text c="dimmed" size="sm" ta="center" p="xl">No routing rules yet. Default entity owners still receive their notifications.</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Event</Table.Th>
                  <Table.Th>Recipient</Table.Th>
                  <Table.Th>Note</Table.Th>
                  <Table.Th aria-label="Actions" />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rules.map((rule) => (
                  <Table.Tr key={rule.id}>
                    <Table.Td><Badge variant="light">{rule.category}</Badge></Table.Td>
                    <Table.Td>{rule.eventType ?? 'All events'}</Table.Td>
                    <Table.Td>{rule.recipientType === 'role' ? `Role: ${rule.recipientRoleCode}` : `User: ${rule.recipientUserId}`}</Table.Td>
                    <Table.Td>{rule.note ?? ''}</Table.Td>
                    <Table.Td>
                      <Tooltip label="Delete rule">
                        <ActionIcon color="red" variant="subtle" aria-label="Delete rule" onClick={() => void handleDelete(rule.id)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </Stack>
    </Container>
  );
}

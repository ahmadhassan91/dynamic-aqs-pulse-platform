'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionIcon, Badge, Box, Button, Card, Container, Group, Loader, SegmentedControl, Select, Stack, Text, Title, Tooltip } from '@mantine/core';
import { IconArchive, IconCheck, IconExternalLink } from '@tabler/icons-react';
import { USER_NOTIFICATION_CATEGORIES, type UserNotificationCategoryKey, type UserNotificationSummary } from '@pulse/contracts/notifications';
import { archiveNotificationRecord, fetchNotifications, markNotificationsReadRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

const PAGE = 25;
type StatusFilter = 'all' | 'unread' | 'archived';

function resolveDeepLink(type?: string, id?: string): string | null {
  if (!type || !id) return null;
  switch (type) {
    case 'lead':
      return `/leads/${id}`;
    case 'account':
    case 'customer':
      return `/customers/${id}`;
    case 'consignment':
    case 'consignment_site':
      return '/consignment';
    case 'order':
    case 'order_draft':
      return '/orders';
    case 'training':
      return '/training';
    default:
      return null;
  }
}

function severityColor(severity: UserNotificationSummary['severity']): string {
  if (severity === 'critical') return 'red';
  if (severity === 'warning') return 'yellow';
  return 'blue';
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function NotificationsWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<UserNotificationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(async (offset: number, replace: boolean) => {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await fetchNotifications(apiBaseUrl, auth.tokens.accessToken, {
        status,
        ...(category ? { category } : {}),
        limit: PAGE,
        offset,
      });
      setTotal(response.total);
      setItems((current) => (replace ? response.items : [...current, ...response.items]));
    } catch {
      // Non-blocking; the page keeps what it already has.
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, auth, status, category]);

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage]);

  const handleOpen = async (notification: UserNotificationSummary) => {
    if (!auth) return;
    if (!notification.isRead) {
      try {
        await markNotificationsReadRecord(apiBaseUrl, auth.tokens.accessToken, { ids: [notification.id] });
      } catch {
        // ignore
      }
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)));
    }
    const href = resolveDeepLink(notification.deepLinkType, notification.deepLinkId);
    if (href) router.push(href);
  };

  const handleMarkRead = async (id: string) => {
    if (!auth) return;
    try {
      await markNotificationsReadRecord(apiBaseUrl, auth.tokens.accessToken, { ids: [id] });
    } catch {
      return;
    }
    setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const handleArchive = async (id: string) => {
    if (!auth) return;
    try {
      await archiveNotificationRecord(apiBaseUrl, auth.tokens.accessToken, id);
    } catch {
      return;
    }
    if (status === 'archived') {
      setItems((current) => current.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
    } else {
      setItems((current) => current.filter((item) => item.id !== id));
      setTotal((value) => Math.max(0, value - 1));
    }
  };

  const handleMarkAllRead = async () => {
    if (!auth) return;
    try {
      await markNotificationsReadRecord(apiBaseUrl, auth.tokens.accessToken, { all: true });
    } catch {
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
  };

  return (
    <Container size="md" py="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Stack gap={2}>
            <Title order={3}>Notifications</Title>
            <Text c="dimmed" size="sm">{total} {status === 'unread' ? 'unread' : status === 'archived' ? 'archived' : 'total'}</Text>
          </Stack>
          <Button variant="light" size="xs" leftSection={<IconCheck size={14} />} onClick={() => void handleMarkAllRead()}>
            Mark all read
          </Button>
        </Group>

        <Group gap="sm">
          <SegmentedControl
            value={status}
            onChange={(value) => setStatus(value as StatusFilter)}
            data={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <Select
            placeholder="All categories"
            clearable
            value={category}
            onChange={setCategory}
            data={USER_NOTIFICATION_CATEGORIES.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))}
            w={200}
          />
        </Group>

        <Card withBorder radius="md" p={0}>
          <Stack gap={0}>
            {items.map((notification) => (
              <Group key={notification.id} justify="space-between" wrap="nowrap" align="flex-start" px="md" py="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)', backgroundColor: notification.isRead ? undefined : 'var(--mantine-color-blue-light)' }}>
                <Box style={{ flex: 1, minWidth: 0, cursor: resolveDeepLink(notification.deepLinkType, notification.deepLinkId) ? 'pointer' : 'default' }} onClick={() => void handleOpen(notification)}>
                  <Group gap="xs" wrap="nowrap" align="center">
                    <Badge color={severityColor(notification.severity)} variant="light" size="xs">{notification.category}</Badge>
                    <Text size="sm" fw={notification.isRead ? 500 : 700} lineClamp={1}>{notification.title}</Text>
                  </Group>
                  {notification.body ? <Text size="xs" c="dimmed" lineClamp={2} mt={2}>{notification.body}</Text> : null}
                  <Text size="xs" c="dimmed" mt={2}>{formatWhen(notification.createdAt)}</Text>
                </Box>
                <Group gap={4} wrap="nowrap">
                  {resolveDeepLink(notification.deepLinkType, notification.deepLinkId) ? (
                    <Tooltip label="Open record"><ActionIcon variant="subtle" size="sm" aria-label="Open record" onClick={() => void handleOpen(notification)}><IconExternalLink size={15} /></ActionIcon></Tooltip>
                  ) : null}
                  {!notification.isRead ? (
                    <Tooltip label="Mark read"><ActionIcon variant="subtle" size="sm" aria-label="Mark read" onClick={() => void handleMarkRead(notification.id)}><IconCheck size={15} /></ActionIcon></Tooltip>
                  ) : null}
                  {status !== 'archived' ? (
                    <Tooltip label="Archive"><ActionIcon variant="subtle" size="sm" aria-label="Archive" onClick={() => void handleArchive(notification.id)}><IconArchive size={15} /></ActionIcon></Tooltip>
                  ) : null}
                </Group>
              </Group>
            ))}
            {!loading && items.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" p="xl">No notifications{status === 'unread' ? ' to read' : ''}.</Text>
            ) : null}
            {loading ? <Group justify="center" p="md"><Loader size="sm" /></Group> : null}
          </Stack>
        </Card>

        {items.length < total ? (
          <Group justify="center">
            <Button variant="default" size="xs" loading={loading} onClick={() => void fetchPage(items.length, false)}>
              Load more
            </Button>
          </Group>
        ) : null}
      </Stack>
    </Container>
  );
}

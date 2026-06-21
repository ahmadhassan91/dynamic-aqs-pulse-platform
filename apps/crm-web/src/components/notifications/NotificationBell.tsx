'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionIcon, Box, Button, Group, Indicator, Loader, Menu, ScrollArea, Stack, Text } from '@mantine/core';
import { IconBell, IconCheck } from '@tabler/icons-react';
import type { UserNotificationSummary } from '@pulse/contracts/notifications';
import { fetchNotifications, fetchUnreadNotificationCount, markNotificationsReadRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

const POLL_MS = 60_000;

// FR-NOTIF-011 — deep-link routing from a notification to its source record.
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

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

export function NotificationBell() {
  const { apiBaseUrl, auth } = usePulseSession();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<UserNotificationSummary[]>([]);
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    if (!auth) return;
    try {
      const response = await fetchUnreadNotificationCount(apiBaseUrl, auth.tokens.accessToken);
      setUnreadCount(response.unreadCount);
    } catch {
      // Non-blocking: the bell silently keeps its last count if the poll fails.
    }
  }, [apiBaseUrl, auth]);

  const loadList = useCallback(async () => {
    if (!auth) return;
    setLoading(true);
    try {
      const response = await fetchNotifications(apiBaseUrl, auth.tokens.accessToken, { status: 'all', limit: 15 });
      setItems(response.items);
      setUnreadCount(response.unreadCount);
    } catch {
      // Non-blocking.
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    if (!auth) return undefined;
    void refreshCount();
    const handle = setInterval(() => {
      void refreshCount();
    }, POLL_MS);
    return () => clearInterval(handle);
  }, [auth, refreshCount]);

  if (!auth) {
    return null;
  }

  const accessToken = auth.tokens.accessToken;

  const handleOpenChange = (next: boolean) => {
    setOpened(next);
    if (next) {
      void loadList();
    }
  };

  const handleItemClick = async (notification: UserNotificationSummary) => {
    if (!notification.isRead) {
      try {
        await markNotificationsReadRecord(apiBaseUrl, accessToken, { ids: [notification.id] });
      } catch {
        // Non-blocking; navigation still proceeds.
      }
    }
    const href = resolveDeepLink(notification.deepLinkType, notification.deepLinkId);
    setOpened(false);
    void loadList();
    if (href) {
      router.push(href);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsReadRecord(apiBaseUrl, accessToken, { all: true });
    } catch {
      // Non-blocking.
    }
    await loadList();
  };

  return (
    <Menu width={380} position="bottom-end" opened={opened} onChange={handleOpenChange} withinPortal closeOnItemClick={false}>
      <Menu.Target>
        <Indicator color="red" size={16} label={unreadCount > 9 ? '9+' : unreadCount} disabled={unreadCount === 0} offset={4}>
          <ActionIcon variant="default" size="lg" aria-label={unreadCount ? `Notifications (${unreadCount} unread)` : 'Notifications'}>
            <IconBell size={18} />
          </ActionIcon>
        </Indicator>
      </Menu.Target>
      <Menu.Dropdown>
        <Group justify="space-between" px="sm" py="xs">
          <Text fw={700} size="sm">Notifications</Text>
          <Button size="compact-xs" variant="subtle" leftSection={<IconCheck size={14} />} onClick={() => void handleMarkAllRead()} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        </Group>
        <Menu.Divider />
        {loading ? (
          <Group justify="center" p="md"><Loader size="sm" /></Group>
        ) : items.length === 0 ? (
          <Text c="dimmed" size="sm" ta="center" p="md">You&apos;re all caught up.</Text>
        ) : (
          <ScrollArea.Autosize mah={420}>
            <Stack gap={0}>
              {items.map((notification) => (
                <Box
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void handleItemClick(notification)}
                  px="sm"
                  py="xs"
                  style={{ cursor: 'pointer', backgroundColor: notification.isRead ? undefined : 'var(--mantine-color-blue-light)' }}
                >
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    <Box
                      w={8}
                      h={8}
                      mt={6}
                      style={{ borderRadius: '50%', flexShrink: 0, backgroundColor: `var(--mantine-color-${severityColor(notification.severity)}-6)` }}
                    />
                    <Box style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={notification.isRead ? 500 : 700} lineClamp={1}>{notification.title}</Text>
                      {notification.body ? <Text size="xs" c="dimmed" lineClamp={2}>{notification.body}</Text> : null}
                      <Text size="xs" c="dimmed">{relativeTime(notification.createdAt)}</Text>
                    </Box>
                  </Group>
                </Box>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
        <Menu.Divider />
        <Button
          variant="subtle"
          size="compact-xs"
          fullWidth
          onClick={() => {
            setOpened(false);
            router.push('/settings/notifications');
          }}
        >
          Notification settings
        </Button>
      </Menu.Dropdown>
    </Menu>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Anchor, Card, Container, Group, Loader, Stack, Switch, Text, Title } from '@mantine/core';
import type { UserNotificationCategoryKey, UserNotificationPreferenceSummary } from '@pulse/contracts/notifications';
import { fetchNotificationPreferences, updateNotificationPreferenceRecord } from '@/lib/pulse-api';
import { canAccessModule } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

const CATEGORY_META: Record<UserNotificationCategoryKey, { label: string; description: string }> = {
  lead: { label: 'Leads', description: 'New lead assignments and SLA / handoff escalations.' },
  consignment: { label: 'Consignment', description: 'ROSE audit due/overdue and missing-PO escalations.' },
  training: { label: 'Training', description: 'Training due, certification, and coaching.' },
  order: { label: 'Orders', description: 'Order status and back-office triage updates.' },
  account: { label: 'Accounts', description: 'Account changes, credit-hold, and payment alerts.' },
  system: { label: 'System', description: 'General Pulse system notices.' },
};

export function NotificationPreferencesWorkspace() {
  const { apiBaseUrl, auth } = usePulseSession();
  const canManageRouting = auth ? canAccessModule(auth.identity.role, 'admin') : false;
  const [preferences, setPreferences] = useState<UserNotificationPreferenceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState<UserNotificationCategoryKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetchNotificationPreferences(apiBaseUrl, auth.tokens.accessToken);
        if (!cancelled) setPreferences(response.preferences);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  const handleToggle = async (category: UserNotificationCategoryKey, inAppEnabled: boolean) => {
    if (!auth) return;
    setSavingCategory(category);
    setError(null);
    setPreferences((current) => current.map((pref) => (pref.category === category ? { ...pref, inAppEnabled } : pref)));
    try {
      const response = await updateNotificationPreferenceRecord(apiBaseUrl, auth.tokens.accessToken, { category, inAppEnabled });
      setPreferences(response.preferences);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
      setPreferences((current) => current.map((pref) => (pref.category === category ? { ...pref, inAppEnabled: !inAppEnabled } : pref)));
    } finally {
      setSavingCategory(null);
    }
  };

  return (
    <Container size="sm" py="lg">
      <Stack gap="md">
        <Stack gap={2}>
          <Title order={3}>Notification preferences</Title>
          <Text c="dimmed" size="sm">
            Choose which in-app notifications you receive. Turning a category off hides new notifications of that type from your bell.
          </Text>
        </Stack>
        {error ? <Alert color="red" variant="light">{error}</Alert> : null}
        {loading ? (
          <Group justify="center" p="xl"><Loader /></Group>
        ) : (
          <Card withBorder radius="md" p="md">
            <Stack gap="md">
              {preferences.map((pref) => {
                const meta = CATEGORY_META[pref.category] ?? { label: pref.category, description: '' };
                return (
                  <Group key={pref.category} justify="space-between" wrap="nowrap" align="flex-start">
                    <Stack gap={0} style={{ flex: 1 }}>
                      <Text fw={600} size="sm">{meta.label}</Text>
                      <Text c="dimmed" size="xs">{meta.description}</Text>
                    </Stack>
                    <Switch
                      checked={pref.inAppEnabled}
                      disabled={savingCategory === pref.category}
                      onChange={(event) => void handleToggle(pref.category, event.currentTarget.checked)}
                      aria-label={`${meta.label} notifications`}
                    />
                  </Group>
                );
              })}
            </Stack>
          </Card>
        )}
        {canManageRouting ? (
          <Anchor component={Link} href="/settings/notifications/routing" size="sm">
            Manage notification routing rules (admin)
          </Anchor>
        ) : null}
      </Stack>
    </Container>
  );
}

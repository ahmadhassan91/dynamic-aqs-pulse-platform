'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Anchor, Badge, Card, Group, Loader, Table, Text } from '@mantine/core';
import type { StaleAccountItem } from '@pulse/contracts';
import { fetchStaleAccountsReportApi } from '@/lib/pulse-api-ext-reports';
import { usePulseSession } from '@/lib/pulse-session';

// FR-RPT-039 / FR-RPT-015: accounts with no tracked engagement within the active-account window.
// Record-scoped server-side; the caller gates visibility on customer.view.
export function StaleAccountsCard() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [items, setItems] = useState<StaleAccountItem[]>([]);
  const [total, setTotal] = useState(0);
  const [windowDays, setWindowDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await fetchStaleAccountsReportApi(apiBaseUrl, accessToken);
      setItems(response.items);
      setTotal(response.total);
      setWindowDays(response.windowDays);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="sm">
        <Text fw={700}>Neglected accounts</Text>
        {loading ? <Loader size="xs" /> : <Text size="sm" c="dimmed">{total} with no engagement in {windowDays}d</Text>}
      </Group>
      {error ? <Alert color="red" variant="light">{error}</Alert> : null}
      {!loading && !error && items.length === 0 ? (
        <Text size="sm" c="dimmed">Every account in your book has tracked engagement within the window.</Text>
      ) : null}
      {items.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Account</Table.Th>
              <Table.Th>Owner</Table.Th>
              <Table.Th>Last engagement</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.accountId}>
                <Table.Td>
                  <Anchor component={Link} href={`/customers/${item.accountId}`} size="sm">{item.name}</Anchor>
                </Table.Td>
                <Table.Td>{item.ownerName ?? 'Unassigned'}</Table.Td>
                <Table.Td>
                  {item.daysSinceEngagement === null
                    ? <Badge color="red" variant="light">Never</Badge>
                    : `${item.daysSinceEngagement}d ago`}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}
      <Text size="xs" c="dimmed" mt="sm">
        Engagement = a completed training/visit, a field voice note, or a ROSE audit. Email/phone touches aren&rsquo;t tracked yet.
      </Text>
    </Card>
  );
}

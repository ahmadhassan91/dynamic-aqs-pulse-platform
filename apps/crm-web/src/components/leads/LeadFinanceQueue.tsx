'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Paper, Select, Stack, Table, Text, Title } from '@mantine/core';
import type { FinanceQueueItem } from '@pulse/contracts';
import { fetchFinanceQueue } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function LeadFinanceQueue() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [decisionFilter, setDecisionFilter] = useState<string>('pending');
  const [items, setItems] = useState<FinanceQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setItems([]);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadQueue() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchFinanceQueue(apiBaseUrl, accessToken, {
          ...(decisionFilter ? { decisionStatus: decisionFilter as never } : {}),
        });
        if (!cancelled) {
          setItems(response.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, decisionFilter]);

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <Stack gap="lg">
      <Paper shadow="sm" p="lg" radius="xl" className="premium-hero-panel">
        <Stack gap="xs">
          <Title order={1}>Finance Queue</Title>
          <Text size="sm" c="dimmed">
            Review CIS packages that are waiting for finance submission or decision inside the live production workflow.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
        <Select
          label="Decision status"
          value={decisionFilter}
          onChange={(value) => setDecisionFilter(value ?? 'pending')}
          data={[
            { value: 'awaiting_submission', label: 'Awaiting submission' },
            { value: 'pending', label: 'Pending decision' },
            { value: 'info_requested', label: 'Info requested' },
            { value: 'approved', label: 'Approved' },
            { value: 'conditional', label: 'Conditional' },
            { value: 'declined', label: 'Declined' },
          ]}
          maw={280}
        />
      </Paper>

      {error ? (
        <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
          <Text c="red">{error}</Text>
        </Paper>
      ) : null}

      <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel">
        <Table.ScrollContainer minWidth={980}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Company</Table.Th>
                <Table.Th>Contact</Table.Th>
                <Table.Th>CIS status</Table.Th>
                <Table.Th>Finance status</Table.Th>
                <Table.Th>Payment method</Table.Th>
                <Table.Th>Submitted</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.cisPackageId}>
                  <Table.Td fw={600}>{item.companyName}</Table.Td>
                  <Table.Td>{item.contactDisplayName}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue">{item.cisStatus}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="grape">{item.financeDecisionStatus}</Badge>
                  </Table.Td>
                  <Table.Td>{item.paymentMethod ?? '—'}</Table.Td>
                  <Table.Td>{item.submittedToFinanceAt ? formatDateTimeLabel(item.submittedToFinanceAt) : '—'}</Table.Td>
                  <Table.Td>
                    <Button component={Link} href={`/leads/${item.leadId}`} size="xs" variant="light">
                      Open Lead
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>

        {!isLoading && items.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">
            No finance queue records match this filter right now.
          </Text>
        ) : null}
      </Paper>
    </Stack>
  );
}

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

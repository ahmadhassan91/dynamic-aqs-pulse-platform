'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { DealerPortalOrderSummary, OrderDraftStatusKey } from '@pulse/contracts';
import { IconClipboardList } from '@tabler/icons-react';

export interface DealerOrderHistoryProps {
  orders: DealerPortalOrderSummary[];
  isLoading: boolean;
  error: string | null;
}

export function DealerOrderHistory({ orders, isLoading, error }: DealerOrderHistoryProps) {
  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Self-Service Ordering</Text>
            <Title order={1}>Your Orders</Title>
            <Text c="dimmed" maw={760}>
              Track the orders you have submitted to Dynamic AQS. Pricing and fulfillment are confirmed by the
              back-office team.
            </Text>
          </Stack>
          <Badge size="xl" color="blue" variant="light">
            {orders.length} order{orders.length === 1 ? '' : 's'}
          </Badge>
        </Group>
      </Card>

      {error ? (
        <Alert color="red" variant="light" radius="lg">
          {error}
        </Alert>
      ) : null}

      {isLoading && orders.length === 0 ? (
        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Center>
            <Stack gap="xs" align="center">
              <Loader color="blue" />
              <Text size="sm" c="dimmed">
                Loading your orders...
              </Text>
            </Stack>
          </Center>
        </Card>
      ) : orders.length === 0 ? (
        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Stack gap="xs" align="center">
            <IconClipboardList size={36} />
            <Title order={3}>No orders yet</Title>
            <Text c="dimmed" ta="center" maw={620}>
              Orders you submit from your cart will appear here.
            </Text>
            <Button variant="light" color="blue" component="a" href="/dealer/cart">
              Go to cart
            </Button>
          </Stack>
        </Card>
      ) : (
        <Card withBorder radius="xl" p="lg" className="premium-detail-card">
          <Table.ScrollContainer minWidth={640}>
            <Table verticalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>PO number</Table.Th>
                  <Table.Th>Lines</Table.Th>
                  <Table.Th>Submitted</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {orders.map((order) => (
                  <Table.Tr key={order.id}>
                    <Table.Td>
                      <Badge color={statusColor(order.status)} variant="light">
                        {formatStatus(order.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{order.customerPoNumber ?? '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{order.lineCount}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatDate(order.submittedAt ?? order.createdAt)}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
    </Stack>
  );
}

function statusColor(status: OrderDraftStatusKey) {
  switch (status) {
    case 'submitted':
      return 'blue';
    case 'fulfilled':
      return 'green';
    case 'cancelled':
      return 'red';
    case 'draft':
    default:
      return 'gray';
  }
}

function formatStatus(status: OrderDraftStatusKey) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

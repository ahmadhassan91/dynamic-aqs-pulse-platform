'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import type {
  OrderDraftDetail,
  OrderDraftStatusKey,
  OrderDraftSummary,
  OrderSourceKey,
} from '@pulse/contracts';
import { WorkbenchHeader } from '@/components/ui/Workbench';
import { canPerformAction } from '@/lib/access';
import {
  cancelOrderTriageDraft,
  fetchOrderTriageDetail,
  fetchOrderTriageQueue,
  fulfillOrderTriageDraft,
} from '@/lib/pulse-api-ext-orders';
import { usePulseSession } from '@/lib/pulse-session';

// Defined locally rather than imported as a runtime value: crm-web's tsconfig maps
// @pulse/contracts to its dist .d.ts files, so importing the ORDER_DRAFT_STATUSES const
// resolves to the type declaration (undefined at runtime, in dev and prod). Types above
// still import correctly.
const ORDER_DRAFT_STATUSES: readonly OrderDraftStatusKey[] = ['draft', 'submitted', 'fulfilled', 'cancelled'];

const STATUS_OPTIONS = ORDER_DRAFT_STATUSES.map((status) => ({
  value: status,
  label: status.charAt(0).toUpperCase() + status.slice(1),
}));

const STATUS_COLOR: Record<OrderDraftStatusKey, string> = {
  draft: 'gray',
  submitted: 'blue',
  fulfilled: 'teal',
  cancelled: 'red',
};

// Where the order originated: a dealer self-serving via the portal, or an internal
// rep/CSR/TM keying it on the account's behalf.
const SOURCE_BADGE: Record<OrderSourceKey, { label: string; color: string }> = {
  dealer_self_service: { label: 'Dealer', color: 'grape' },
  internal_on_behalf: { label: 'On behalf', color: 'gray' },
};

// 'all' is a UI-only sentinel meaning "no source filter" — never sent to the API.
const SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'dealer_self_service', label: 'Dealer' },
  { value: 'internal_on_behalf', label: 'On behalf' },
];

function formatDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OrderTriageQueue() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [statusFilter, setStatusFilter] = useState<OrderDraftStatusKey>('submitted');
  const [sourceFilter, setSourceFilter] = useState<OrderSourceKey | 'all'>('all');
  const [items, setItems] = useState<OrderDraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [reviewTarget, setReviewTarget] = useState<OrderDraftSummary | null>(null);
  const [detail, setDetail] = useState<OrderDraftDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isActing, setIsActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const role = auth?.identity.role;
  // Fulfill and cancel are both back-office finalize actions on a submitted order — one gate.
  const canTriage = canPerformAction(role, 'order.submit');

  useEffect(() => {
    if (!auth) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const accessToken = auth.tokens.accessToken;
    setIsLoading(true);
    setError(null);
    setActionSuccess(null);
    fetchOrderTriageQueue(apiBaseUrl, accessToken, {
      status: statusFilter,
      ...(sourceFilter !== 'all' ? { source: sourceFilter } : {}),
      limit: 100,
    })
      .then((response) => {
        if (!cancelled) setItems(response.items);
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, statusFilter, sourceFilter]);

  async function reloadQueue() {
    if (!auth) return;
    const response = await fetchOrderTriageQueue(apiBaseUrl, auth.tokens.accessToken, {
      status: statusFilter,
      ...(sourceFilter !== 'all' ? { source: sourceFilter } : {}),
      limit: 100,
    });
    setItems(response.items);
  }

  function openReview(item: OrderDraftSummary) {
    if (!auth) return;
    setReviewTarget(item);
    setDetail(null);
    setShowCancelForm(false);
    setCancelReason('');
    setActionError(null);
    setActionSuccess(null);
    setDetailLoading(true);
    fetchOrderTriageDetail(apiBaseUrl, auth.tokens.accessToken, item.id)
      .then((response) => setDetail(response))
      .catch((detailError) => setActionError(detailError instanceof Error ? detailError.message : String(detailError)))
      .finally(() => setDetailLoading(false));
  }

  function closeReview() {
    setReviewTarget(null);
    setDetail(null);
    setShowCancelForm(false);
    setCancelReason('');
    setActionError(null);
  }

  async function runFulfill() {
    if (!auth || !reviewTarget) return;
    setIsActing(true);
    setActionError(null);
    try {
      await fulfillOrderTriageDraft(apiBaseUrl, auth.tokens.accessToken, reviewTarget.id);
      setActionSuccess(`Order marked fulfilled for ${reviewTarget.accountName ?? 'account'}.`);
      closeReview();
      await reloadQueue();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActing(false);
    }
  }

  async function runCancel() {
    if (!auth || !reviewTarget) return;
    setIsActing(true);
    setActionError(null);
    try {
      const reason = cancelReason.trim();
      await cancelOrderTriageDraft(apiBaseUrl, auth.tokens.accessToken, reviewTarget.id, reason ? { cancelReason: reason } : {});
      setActionSuccess(`Order cancelled for ${reviewTarget.accountName ?? 'account'}.`);
      closeReview();
      await reloadQueue();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsActing(false);
    }
  }

  if (!isHydrated || !auth) {
    return null;
  }

  const reviewIsSubmitted = detail?.status === 'submitted';

  return (
    <Stack gap="md">
      <WorkbenchHeader
        title="Order Triage"
        description="Review orders submitted on behalf of accounts, then key them into Acumatica. Mark fulfilled once placed, or cancel with a reason. Pulse does not place the order — this queue is the office hand-off."
      />

      <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
        <Group gap="md" align="flex-end">
          <Select
            label="Status"
            value={statusFilter}
            onChange={(value) => setStatusFilter((value as OrderDraftStatusKey) ?? 'submitted')}
            data={STATUS_OPTIONS}
            allowDeselect={false}
            disabled={isActing}
            w={220}
          />
          <Select
            label="Source"
            value={sourceFilter}
            onChange={(value) => setSourceFilter((value as OrderSourceKey | 'all') ?? 'all')}
            data={SOURCE_FILTER_OPTIONS}
            allowDeselect={false}
            disabled={isActing}
            w={220}
          />
        </Group>
      </Paper>

      {error ? (
        <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
          <Text c="red">{error}</Text>
        </Paper>
      ) : null}

      {actionSuccess ? (
        <Alert color="teal" icon={<IconCheck size={16} />} withCloseButton onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      ) : null}

      <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel">
        <Table.ScrollContainer minWidth={920}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Account</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Lines</Table.Th>
                <Table.Th>Customer PO</Table.Th>
                <Table.Th>Submitted</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>{item.accountName ?? item.accountId}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={SOURCE_BADGE[item.source].color}>
                      {SOURCE_BADGE[item.source].label}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{item.lineCount}</Table.Td>
                  <Table.Td>{item.customerPoNumber ?? '—'}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDateTime(item.submittedAt)}</Text>
                    {item.submittedByName ? <Text size="xs" c="dimmed">by {item.submittedByName}</Text> : null}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={STATUS_COLOR[item.status]}>{item.status}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" onClick={() => openReview(item)}>Review</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {!isLoading && items.length === 0 ? (
          <Text size="sm" c="dimmed" p="md">No orders match this filter right now.</Text>
        ) : null}
        {isLoading ? (
          <Group justify="center" p="md"><Loader size="sm" /></Group>
        ) : null}
      </Paper>

      <Modal opened={reviewTarget !== null} onClose={closeReview} title="Review order" size="lg">
        {detailLoading ? (
          <Group justify="center" p="lg"><Loader size="sm" /></Group>
        ) : null}

        {actionError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} mb="md">{actionError}</Alert>
        ) : null}

        {detail ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>{detail.accountName ?? detail.accountId}</Text>
              <Badge variant="light" color={STATUS_COLOR[detail.status]}>{detail.status}</Badge>
            </Group>
            {detail.customerPoNumber ? <Text size="sm" c="dimmed">Customer PO: {detail.customerPoNumber}</Text> : null}
            {detail.submittedByName ? <Text size="sm" c="dimmed">Submitted by {detail.submittedByName} · {formatDateTime(detail.submittedAt)}</Text> : null}

            <Table verticalSpacing="xs" withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th ta="right">Qty</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detail.lines.map((line) => (
                  <Table.Tr key={line.id}>
                    <Table.Td>{line.productName}</Table.Td>
                    <Table.Td>{line.sku ?? '—'}</Table.Td>
                    <Table.Td ta="right">{line.quantity}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {detail.pricingEstimated ? (
              <Text size="xs" c="dimmed">Estimated subtotal {formatCents(detail.subtotalCents)} — non-authoritative; Acumatica sets final pricing.</Text>
            ) : (
              <Text size="xs" c="dimmed">No pricing captured in the field — the office sets pricing when keying the order.</Text>
            )}

            {detail.notes ? (
              <Paper withBorder p="sm" radius="md">
                <Text size="xs" c="dimmed" tt="uppercase">Notes for the office</Text>
                <Text size="sm">{detail.notes}</Text>
              </Paper>
            ) : null}

            {reviewIsSubmitted && showCancelForm ? (
              <Textarea
                label="Cancellation reason (optional)"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.currentTarget.value)}
                disabled={isActing}
                autosize
                minRows={2}
              />
            ) : null}

            {reviewIsSubmitted ? (
              <Group justify="flex-end" mt="sm">
                <Button variant="default" onClick={closeReview} disabled={isActing}>Close</Button>
                {canTriage ? (
                  showCancelForm ? (
                    <Button color="red" loading={isActing} onClick={() => void runCancel()}>Confirm cancellation</Button>
                  ) : (
                    <Button color="red" variant="light" disabled={isActing} onClick={() => setShowCancelForm(true)}>Cancel order</Button>
                  )
                ) : null}
                {canTriage && !showCancelForm ? (
                  <Button color="teal" loading={isActing} onClick={() => void runFulfill()}>Mark fulfilled</Button>
                ) : null}
              </Group>
            ) : (
              <Group justify="flex-end" mt="sm">
                <Button variant="default" onClick={closeReview}>Close</Button>
              </Group>
            )}
          </Stack>
        ) : null}
      </Modal>
    </Stack>
  );
}

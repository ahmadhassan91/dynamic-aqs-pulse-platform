'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import type {
  DealerPortalCartLine,
  DealerPortalCartResponse,
  DealerPortalDashboardResponse,
  UpdateDealerPortalCartItemRequest,
} from '@pulse/contracts';
import { IconInfoCircle, IconShoppingCart, IconTrash } from '@tabler/icons-react';

export interface DealerCartProps {
  cart: DealerPortalCartResponse | null;
  dashboard?: DealerPortalDashboardResponse | null;
  isLoading: boolean;
  error: string | null;
  updateItem: (lineId: string, patch: UpdateDealerPortalCartItemRequest) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  submit: (req: { poNumber: string; shipToLocationId?: string; notes?: string }) => Promise<unknown>;
}

export function DealerCart({ cart, dashboard, isLoading, error, updateItem, removeItem, submit }: DealerCartProps) {
  const router = useRouter();
  const [poNumber, setPoNumber] = useState('');
  const [shipToLocationId, setShipToLocationId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Ship-to comes ONLY from the dealer's own account locations (dashboard payload). If the
  // dashboard is unavailable, ship-to is omitted gracefully — never sourced from client input.
  const locationOptions = useMemo(
    () =>
      (dashboard?.locations ?? []).map((location) => ({
        value: location.id,
        label: buildLocationLabel(location),
      })),
    [dashboard?.locations],
  );

  const lines = cart?.lines ?? [];
  const lineCount = cart?.lineCount ?? lines.length;
  const hasLines = lineCount > 0;
  const trimmedPo = poNumber.trim();
  // Required on submit: a non-empty PO number AND >=1 line.
  const canSubmit = trimmedPo.length > 0 && hasLines && !isSubmitting;

  const handleQuantityChange = async (line: DealerPortalCartLine, nextQuantity: number | string) => {
    const quantity = typeof nextQuantity === 'number' ? nextQuantity : Number.parseInt(nextQuantity, 10);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity === line.quantity) {
      return;
    }

    setPendingLineId(line.id);
    try {
      await updateItem(line.id, { quantity });
    } finally {
      setPendingLineId(null);
    }
  };

  const handleRemove = async (line: DealerPortalCartLine) => {
    setPendingLineId(line.id);
    try {
      await removeItem(line.id);
    } finally {
      setPendingLineId(null);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Re-validation of every cart line against the live catalog, ship-to ownership, and the
      // parked credit-hold seam all happen server-side; the client only forwards intent.
      await submit({
        poNumber: trimmedPo,
        ...(shipToLocationId ? { shipToLocationId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      router.push('/dealer/orders');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Self-Service Ordering</Text>
            <Title order={1}>Your Cart</Title>
            <Text c="dimmed" maw={760}>
              Review the products you want to order, add a purchase order number, and submit. Your order routes to the
              Dynamic AQS back-office team for confirmation.
            </Text>
          </Stack>
          <Badge size="xl" color="blue" variant="light">
            {lineCount} line{lineCount === 1 ? '' : 's'}
          </Badge>
        </Group>
      </Card>

      <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} radius="lg">
        Pricing confirmed by back-office. Prices, taxes, and shipping are finalized by Dynamic AQS after you submit — no
        pricing is shown or captured here.
      </Alert>

      {error ? (
        <Alert color="red" variant="light" radius="lg">
          {error}
        </Alert>
      ) : null}

      {isLoading && !cart ? (
        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Center>
            <Stack gap="xs" align="center">
              <Loader color="blue" />
              <Text size="sm" c="dimmed">
                Loading your cart...
              </Text>
            </Stack>
          </Center>
        </Card>
      ) : !hasLines ? (
        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Stack gap="xs" align="center">
            <IconShoppingCart size={36} />
            <Title order={3}>Your cart is empty</Title>
            <Text c="dimmed" ta="center" maw={620}>
              Browse Products and Files and use Add to cart to start an order.
            </Text>
            <Button variant="light" color="blue" onClick={() => router.push('/dealer/catalog')}>
              Browse products
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Cart items</Title>
              {lines.map((line) => {
                const isPending = pendingLineId === line.id;
                return (
                  <Group key={line.id} justify="space-between" align="flex-start" wrap="nowrap">
                    <Stack gap={2} style={{ flex: 1 }}>
                      <Text fw={600}>{line.productName}</Text>
                      {line.sku ? (
                        <Text size="xs" c="dimmed">
                          SKU {line.sku}
                          {line.unitOfMeasure ? ` / ${line.unitOfMeasure}` : ''}
                        </Text>
                      ) : null}
                      {line.lineNote ? (
                        <Text size="xs" c="dimmed">
                          {line.lineNote}
                        </Text>
                      ) : null}
                    </Stack>
                    <Group gap="sm" wrap="nowrap" align="center">
                      <NumberInput
                        aria-label={`Quantity for ${line.productName}`}
                        value={line.quantity}
                        min={1}
                        step={1}
                        clampBehavior="strict"
                        allowDecimal={false}
                        allowNegative={false}
                        disabled={isPending}
                        w={96}
                        onChange={(value) => {
                          void handleQuantityChange(line, value);
                        }}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        aria-label={`Remove ${line.productName}`}
                        loading={isPending}
                        onClick={() => {
                          void handleRemove(line);
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          </Card>

          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Stack gap="md">
              <Title order={3}>Order details</Title>
              <TextInput
                label="Purchase order number"
                placeholder="Enter your PO number"
                required
                value={poNumber}
                onChange={(event) => setPoNumber(event.currentTarget.value)}
              />
              {locationOptions.length > 0 ? (
                <Select
                  label="Ship to"
                  placeholder="Select a location"
                  data={locationOptions}
                  value={shipToLocationId}
                  onChange={setShipToLocationId}
                  clearable
                  searchable
                />
              ) : null}
              <Textarea
                label="Order notes"
                placeholder="Add any notes for the back-office team (optional)"
                value={notes}
                onChange={(event) => setNotes(event.currentTarget.value)}
                autosize
                minRows={2}
              />

              {submitError ? (
                <Alert color="red" variant="light" radius="lg">
                  {submitError}
                </Alert>
              ) : null}

              <Group justify="flex-end">
                <Button
                  leftSection={<IconShoppingCart size={16} />}
                  disabled={!canSubmit}
                  loading={isSubmitting}
                  onClick={() => {
                    void handleSubmit();
                  }}
                >
                  Submit order
                </Button>
              </Group>
              {!trimmedPo ? (
                <Text size="xs" c="dimmed" ta="right">
                  A purchase order number is required to submit.
                </Text>
              ) : null}
            </Stack>
          </Card>
        </>
      )}
    </Stack>
  );
}

function buildLocationLabel(location: {
  name: string;
  city?: string;
  state?: string;
  isPrimary: boolean;
}) {
  const place = [location.city, location.state].filter(Boolean).join(', ');
  const base = place ? `${location.name} (${place})` : location.name;
  return location.isPrimary ? `${base} - Primary` : base;
}

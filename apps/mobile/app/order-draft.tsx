import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AccountDetail } from '@pulse/contracts/accounts';
import type { CreateOrderDraftRequest, OrderDraftStatusKey, OrderProductOption, UpdateOrderDraftRequest } from '@pulse/contracts/orders';
import {
  Card,
  ErrorState,
  Field,
  LoadingState,
  NativeIcon,
  Pill,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
} from '@/components/native-kit';
import { ProductPickerSheet } from '@/components/product-picker-sheet';
import {
  cancelOrderDraft,
  createOrderDraft,
  fetchAccountDetail,
  fetchOrderDraft,
  submitOrderDraft,
  updateOrderDraft,
} from '@/lib/api';
import {
  addLine,
  adjustLineQuantity,
  buildCreateOrderDraftRequest,
  buildUpdateOrderDraftRequest,
  createEmptyOrderDraftForm,
  getOrderDraftSubmitBlocker,
  makeLineKey,
  orderDraftDetailToFormState,
  removeLine,
  setShipToLocation,
  totalLineUnits,
  updateLine,
  type OrderDraftFormState,
  type OrderDraftLineDraft,
} from '@/lib/order-draft-form';
import { buildOrderDraftOfflinePayload } from '@/lib/order-draft-offline';
import { describeDraftSaveFailure, enqueueDraftDurably } from '@/lib/mobile-draft-queue';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

type SavingMode = 'save' | 'submit' | 'cancel' | null;

export default function OrderDraftScreen() {
  const { palette: colors } = useTheme();
  const { apiBaseUrl, auth } = useSession();
  const params = useLocalSearchParams<{ accountId?: string; accountName?: string; draftId?: string }>();
  const accountId = params.accountId ?? '';

  const [form, setForm] = useState<OrderDraftFormState>(() => createEmptyOrderDraftForm(accountId));
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | undefined>(params.draftId);
  // FR-MOB-047 — a stable per-attempt idempotency key for the CREATE: reused across the online attempt
  // and any offline replay so a create whose response was lost dedupes server-side instead of duplicating.
  const [idempotencyKey] = useState(() => `idmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  const [status, setStatus] = useState<OrderDraftStatusKey>('draft');
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<SavingMode>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lineKeyCounter = useRef(0);
  const inFlight = useRef(false);
  function nextKey() {
    lineKeyCounter.current += 1;
    return makeLineKey(`new-${lineKeyCounter.current}`);
  }

  useEffect(() => {
    if (!auth || !accountId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);
    const token = auth.tokens.accessToken;
    Promise.all([
      fetchAccountDetail(apiBaseUrl, token, accountId),
      params.draftId ? fetchOrderDraft(apiBaseUrl, token, params.draftId) : Promise.resolve(null),
    ])
      .then(([accountDetail, draft]) => {
        if (cancelled) return;
        setAccount(accountDetail);
        if (draft) {
          setForm(orderDraftDetailToFormState(draft));
          setStatus(draft.status);
          setCurrentDraftId(draft.id);
        }
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load the order.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, accountId, params.draftId]);

  const readOnly = status !== 'draft';
  const accountName = account?.displayName ?? params.accountName ?? 'Account';
  const submitBlocker = getOrderDraftSubmitBlocker(form);

  function handleSelectProduct(product: OrderProductOption) {
    setForm((current) => {
      const existing = current.lines.find((candidate) => candidate.baseProductId === product.id);
      if (existing) {
        return adjustLineQuantity(current, existing.key, 1);
      }
      const draft: OrderDraftLineDraft = { key: nextKey(), productName: product.productName, quantity: 1 };
      if (product.id) draft.baseProductId = product.id;
      if (product.sku) draft.sku = product.sku;
      if (product.unitOfMeasure) draft.unitOfMeasure = product.unitOfMeasure;
      return addLine(current, draft);
    });
    setMessage(null);
  }

  function handleAddCustomLine() {
    setForm((current) => addLine(current, { key: nextKey(), productName: '', quantity: 1 }));
    setMessage(null);
  }

  async function handlePersist(mode: 'save' | 'submit') {
    // useRef guard blocks synchronous re-entry (double-tap / Save-then-Submit) before the
    // `saving` state commits — a useState flag alone wouldn't.
    if (inFlight.current || !auth || !accountId) return;
    const snapshot = form;
    const blocker = getOrderDraftSubmitBlocker(snapshot);
    if (mode === 'submit' && blocker) {
      setErrorMessage(blocker);
      return;
    }
    inFlight.current = true;
    setSaving(mode);
    setErrorMessage(null);
    setMessage(null);
    // Build the request once so the online attempt and any offline replay are identical. The CREATE
    // carries a stable idempotencyKey so a lost-response replay dedupes server-side (no duplicate draft).
    const request: CreateOrderDraftRequest | UpdateOrderDraftRequest = currentDraftId
      ? buildUpdateOrderDraftRequest(snapshot)
      : { ...buildCreateOrderDraftRequest(snapshot), idempotencyKey };
    try {
      const token = auth.tokens.accessToken;
      const detail = currentDraftId
        ? await updateOrderDraft(apiBaseUrl, token, currentDraftId, request as UpdateOrderDraftRequest)
        : await createOrderDraft(apiBaseUrl, token, request as CreateOrderDraftRequest);
      // Commit the persisted draft to state BEFORE any dependent call, so a submit failure
      // can't strand an untracked draft and a retry updates it instead of creating a duplicate.
      setCurrentDraftId(detail.id);
      setForm(orderDraftDetailToFormState(detail));
      if (mode === 'submit') {
        await submitOrderDraft(apiBaseUrl, token, detail.id);
        router.back();
        return;
      }
      setMessage('Draft saved to CRM. The office finalizes pricing and places the order.');
    } catch (error) {
      // FR-MOB-047 — offline parity: persist the order on-device so the work is never lost, then let
      // Sync Status replay it when CRM is reachable. (A submit still needs a server-side draft first,
      // so an offline submit syncs the draft and the office/online submit completes it.) The CREATE's
      // idempotencyKey makes the replay safe: if the original create reached the server but its response
      // was lost, the server returns that draft on retry instead of creating a duplicate.
      try {
        await enqueueDraftDurably({
          kind: 'order_draft',
          title: 'Order draft',
          detail: '',
          payload: buildOrderDraftOfflinePayload({
            request,
            currentDraftId,
            accountId,
            accountName,
          }),
        });
        const failure = describeDraftSaveFailure(error);
        setMessage(mode === 'submit' ? `${failure.message} Submit once it syncs.` : failure.message);
        setErrorMessage(null);
      } catch {
        setErrorMessage(error instanceof Error ? error.message : 'Could not save the order.');
      }
    } finally {
      inFlight.current = false;
      setSaving(null);
    }
  }

  async function handleCancelOrder() {
    if (inFlight.current || !auth || !currentDraftId) return;
    inFlight.current = true;
    setSaving('cancel');
    setErrorMessage(null);
    try {
      await cancelOrderDraft(apiBaseUrl, auth.tokens.accessToken, currentDraftId);
      router.back();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not cancel the order.');
      inFlight.current = false;
      setSaving(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: currentDraftId ? 'Order draft' : 'New order', headerShown: true }} />
      <Screen>
        {isLoading ? <LoadingState label="Loading order..." /> : null}
        {errorMessage ? <ErrorState message={errorMessage} /> : null}

        {!isLoading && !accountId ? (
          <ErrorState message="No account was provided for this order." />
        ) : null}

        {!isLoading && accountId ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>Order on behalf of</Text>
                  <Text selectable style={{ ...typography.title, color: colors.text }}>{accountName}</Text>
                </View>
                <Pill label={status} tone={status} />
              </View>
              <Text style={{ ...typography.caption, color: colors.muted }}>
                Captures the order intent for the office. Final pricing, tax, and placement happen in Acumatica.
              </Text>
            </Card>

            {message ? (
              <Card style={{ borderColor: colors.success, backgroundColor: colors.successSoft }}>
                <Text style={{ ...typography.callout, color: colors.success }}>{message}</Text>
              </Card>
            ) : null}

            {readOnly ? (
              <Card style={{ borderColor: colors.border }}>
                <Text style={{ ...typography.callout, color: colors.muted }}>
                  This order is {status} and can no longer be edited.
                </Text>
              </Card>
            ) : null}

            <SectionTitle title="Products" detail={`${form.lines.length} line${form.lines.length === 1 ? '' : 's'} · ${totalLineUnits(form.lines)} unit${totalLineUnits(form.lines) === 1 ? '' : 's'}`} />
            <Card>
              {form.lines.length === 0 ? (
                <Text style={{ ...typography.callout, color: colors.muted }}>No products yet. Add from the catalog or a custom line.</Text>
              ) : null}
              {form.lines.map((line, index) => (
                <View
                  key={line.key}
                  style={{
                    gap: spacing.sm,
                    paddingTop: index === 0 ? 0 : spacing.sm,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: colors.border,
                  }}
                >
                  {line.baseProductId ? (
                    <View style={{ gap: 2 }}>
                      <Text style={{ ...typography.callout, color: colors.text, fontFamily: 'Inter_700Bold' }}>{line.productName}</Text>
                      {line.sku ? (
                        <Text style={{ ...typography.caption, color: colors.muted }}>
                          {line.sku}{line.unitOfMeasure ? ` · ${line.unitOfMeasure}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  ) : (
                    <Field
                      label="Custom item"
                      value={line.productName}
                      editable={!readOnly}
                      onChangeText={(text) => setForm((current) => updateLine(current, line.key, { productName: text }))}
                      placeholder="Describe the item"
                    />
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Stepper
                      value={line.quantity}
                      disabled={readOnly}
                      onDecrement={() => setForm((current) => adjustLineQuantity(current, line.key, -1))}
                      onIncrement={() => setForm((current) => adjustLineQuantity(current, line.key, 1))}
                    />
                    {!readOnly ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${line.productName || 'line'}`}
                        onPress={() => setForm((current) => removeLine(current, line.key))}
                        style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                      >
                        <NativeIcon name="trash" fallback="Remove" color={colors.danger} size={18} />
                        <Text style={{ ...typography.caption, color: colors.danger }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {!readOnly || line.lineNote ? (
                    <Field
                      label="Line note"
                      value={line.lineNote ?? ''}
                      editable={!readOnly}
                      onChangeText={(text) => setForm((current) => updateLine(current, line.key, { lineNote: text }))}
                      placeholder="Optional note for this line (size, finish, special instructions)"
                    />
                  ) : null}
                </View>
              ))}
            </Card>

            {!readOnly ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton label="Add product" icon={{ name: 'plus.circle.fill', fallback: '+' }} onPress={() => setPickerVisible(true)} />
                </View>
                <View style={{ flex: 1 }}>
                  <SecondaryButton label="Custom line" icon={{ name: 'square.and.pencil', fallback: '+' }} onPress={handleAddCustomLine} />
                </View>
              </View>
            ) : null}

            {!readOnly && account?.locations?.length ? (
              <>
                <SectionTitle title="Ship to" detail="Optional — pick a location for this order." />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {account.locations.map((location) => {
                    const selected = form.shipToLocationId === location.id;
                    const label = location.name || [location.city, location.state].filter(Boolean).join(', ') || 'Location';
                    return (
                      <Pressable
                        key={location.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Ship to ${label}`}
                        onPress={() => setForm((current) => setShipToLocation(current, selected ? undefined : location.id))}
                        style={{
                          paddingHorizontal: spacing.md,
                          minHeight: 40,
                          justifyContent: 'center',
                          borderRadius: radius.full,
                          borderWidth: 1,
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primarySoft : colors.surface,
                        }}
                      >
                        <Text style={{ ...typography.caption, color: selected ? colors.primaryDeep : colors.muted }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {!readOnly ? (
              <>
                <SectionTitle title="Details" />
                <Card>
                  <Field
                    label="Customer PO number"
                    value={form.customerPoNumber}
                    onChangeText={(text) => setForm((current) => ({ ...current, customerPoNumber: text }))}
                    placeholder="Optional"
                    autoCapitalize="characters"
                  />
                  <Field
                    label="Notes for the office"
                    value={form.notes}
                    onChangeText={(text) => setForm((current) => ({ ...current, notes: text }))}
                    placeholder="Anything the office should know before placing this order"
                    multiline
                    textAlignVertical="top"
                    style={{ minHeight: 96 }}
                  />
                </Card>
              </>
            ) : null}

            {!readOnly && submitBlocker ? (
              <Text style={{ ...typography.caption, color: colors.muted }}>{submitBlocker} before submitting.</Text>
            ) : null}

            {!readOnly ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <SecondaryButton
                    label={saving === 'save' ? 'Saving...' : 'Save draft'}
                    icon={{ name: 'tray.and.arrow.down.fill', fallback: 'Save' }}
                    disabled={saving !== null || form.lines.length === 0}
                    onPress={() => void handlePersist('save')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton
                    label={saving === 'submit' ? 'Submitting...' : 'Submit order'}
                    icon={{ name: 'paperplane.fill', fallback: 'Submit' }}
                    disabled={saving !== null || submitBlocker !== null}
                    onPress={() => void handlePersist('submit')}
                  />
                </View>
              </View>
            ) : null}

            {status === 'submitted' ? (
              <SecondaryButton
                label={saving === 'cancel' ? 'Cancelling...' : 'Cancel this order'}
                icon={{ name: 'xmark.circle', fallback: 'Cancel' }}
                disabled={saving !== null}
                onPress={() => void handleCancelOrder()}
              />
            ) : null}
          </>
        ) : null}
      </Screen>

      <ProductPickerSheet visible={pickerVisible} onClose={() => setPickerVisible(false)} onSelect={handleSelectProduct} />
    </>
  );
}

function Stepper({
  value,
  disabled = false,
  onDecrement,
  onIncrement,
}: {
  value: number;
  disabled?: boolean;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const { palette: colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <StepperButton icon="minus.circle.fill" label="Decrease quantity" disabled={disabled} onPress={onDecrement} />
      <Text style={{ ...typography.subtitle, color: colors.text, minWidth: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <StepperButton icon="plus.circle.fill" label="Increase quantity" disabled={disabled} onPress={onIncrement} />
    </View>
  );
}

function StepperButton({ icon, label, disabled, onPress }: { icon: string; label: string; disabled?: boolean; onPress: () => void }) {
  const { palette: colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
    >
      <NativeIcon name={icon} fallback={label} color={disabled ? colors.subtle : colors.primary} size={28} />
    </Pressable>
  );
}

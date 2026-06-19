// Pure, framework-free state + logic for the mobile "order on behalf" capture screen
// (ORD-P4 / FR-MOB-047). The screen (app/order-draft.tsx) holds this as React state and
// delegates every mutation/derivation here so the rules stay unit-testable. Pricing is
// Acumatica's truth — unitPriceCents is an optional estimate and the screen does not
// surface it; the office finalizes pricing when keying the order into the ERP.

import type {
  CreateOrderDraftRequest,
  OrderDraftDetail,
  OrderDraftLineInput,
  UpdateOrderDraftRequest,
} from '@pulse/contracts/orders';

export const MIN_LINE_QUANTITY = 1;
export const MAX_LINE_QUANTITY = 1_000_000;

export interface OrderDraftLineDraft {
  key: string;
  baseProductId?: string;
  sku?: string;
  productName: string;
  unitOfMeasure?: string;
  quantity: number;
  unitPriceCents?: number;
  lineNote?: string;
}

export interface OrderDraftFormState {
  accountId: string;
  shipToLocationId?: string;
  customerPoNumber: string;
  notes: string;
  lines: OrderDraftLineDraft[];
}

export function createEmptyOrderDraftForm(accountId: string): OrderDraftFormState {
  return { accountId, customerPoNumber: '', notes: '', lines: [] };
}

export function makeLineKey(seed: string | number): string {
  return `line-${seed}`;
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_LINE_QUANTITY;
  }
  const rounded = Math.round(value);
  if (rounded < MIN_LINE_QUANTITY) {
    return MIN_LINE_QUANTITY;
  }
  if (rounded > MAX_LINE_QUANTITY) {
    return MAX_LINE_QUANTITY;
  }
  return rounded;
}

export function addLine(state: OrderDraftFormState, line: OrderDraftLineDraft): OrderDraftFormState {
  return { ...state, lines: [...state.lines, { ...line, quantity: clampQuantity(line.quantity) }] };
}

export function removeLine(state: OrderDraftFormState, key: string): OrderDraftFormState {
  return { ...state, lines: state.lines.filter((line) => line.key !== key) };
}

export function updateLine(
  state: OrderDraftFormState,
  key: string,
  patch: Partial<Omit<OrderDraftLineDraft, 'key'>>,
): OrderDraftFormState {
  return {
    ...state,
    lines: state.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
  };
}

export function setLineQuantity(state: OrderDraftFormState, key: string, quantity: number): OrderDraftFormState {
  return updateLine(state, key, { quantity: clampQuantity(quantity) });
}

export function adjustLineQuantity(state: OrderDraftFormState, key: string, delta: number): OrderDraftFormState {
  const line = state.lines.find((candidate) => candidate.key === key);
  if (!line) {
    return state;
  }
  return setLineQuantity(state, key, line.quantity + delta);
}

// Sets or clears the optional ship-to. Rebuilt without the key when cleared so the field
// stays truly absent (exactOptionalPropertyTypes) rather than present-and-undefined.
export function setShipToLocation(state: OrderDraftFormState, locationId: string | undefined): OrderDraftFormState {
  const next: OrderDraftFormState = {
    accountId: state.accountId,
    customerPoNumber: state.customerPoNumber,
    notes: state.notes,
    lines: state.lines,
  };
  if (locationId) {
    next.shipToLocationId = locationId;
  }
  return next;
}

export function lineSubtotalCents(line: OrderDraftLineDraft): number | undefined {
  if (line.unitPriceCents === undefined) {
    return undefined;
  }
  return line.unitPriceCents * line.quantity;
}

export function estimatedSubtotalCents(lines: OrderDraftLineDraft[]): number {
  return lines.reduce(
    (sum, line) => sum + (line.unitPriceCents === undefined ? 0 : line.unitPriceCents * line.quantity),
    0,
  );
}

export function isPricingEstimated(lines: OrderDraftLineDraft[]): boolean {
  return lines.some((line) => line.unitPriceCents !== undefined);
}

export function totalLineUnits(lines: OrderDraftLineDraft[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

// Submit guard for the screen. Intentionally STRICTER than the server: it requires a
// non-empty productName on EVERY line, whereas the server allows an empty name when a
// baseProductId resolves to a catalog product. Stricter-client is safe (never lets through
// what the server rejects). Like the server, it needs >=1 line and positive-int quantities.
export function getOrderDraftSubmitBlocker(state: OrderDraftFormState): string | null {
  if (!state.accountId) {
    return 'Missing account';
  }
  if (state.lines.length === 0) {
    return 'Add at least one product line';
  }
  for (const line of state.lines) {
    if (!line.productName.trim()) {
      return 'Every line needs a product name';
    }
    if (!Number.isInteger(line.quantity) || line.quantity < MIN_LINE_QUANTITY) {
      return 'Every line needs a quantity of at least 1';
    }
  }
  return null;
}

export function canSubmitOrderDraft(state: OrderDraftFormState): boolean {
  return getOrderDraftSubmitBlocker(state) === null;
}

function toLineInput(line: OrderDraftLineDraft): OrderDraftLineInput {
  const input: OrderDraftLineInput = {
    productName: line.productName.trim(),
    quantity: line.quantity,
  };
  if (line.baseProductId) {
    input.baseProductId = line.baseProductId;
  }
  const sku = line.sku?.trim();
  if (sku) {
    input.sku = sku;
  }
  const unitOfMeasure = line.unitOfMeasure?.trim();
  if (unitOfMeasure) {
    input.unitOfMeasure = unitOfMeasure;
  }
  if (line.unitPriceCents !== undefined) {
    input.unitPriceCents = line.unitPriceCents;
  }
  const lineNote = line.lineNote?.trim();
  if (lineNote) {
    input.lineNote = lineNote;
  }
  return input;
}

export function buildCreateOrderDraftRequest(state: OrderDraftFormState): CreateOrderDraftRequest {
  const request: CreateOrderDraftRequest = {
    accountId: state.accountId,
    lines: state.lines.map(toLineInput),
  };
  if (state.shipToLocationId) {
    request.shipToLocationId = state.shipToLocationId;
  }
  const customerPoNumber = state.customerPoNumber.trim();
  if (customerPoNumber) {
    request.customerPoNumber = customerPoNumber;
  }
  const notes = state.notes.trim();
  if (notes) {
    request.notes = notes;
  }
  return request;
}

// Update sends nullable/clearable fields explicitly as null when emptied, and replaces the
// full line set (the server treats a provided `lines` array as a full replacement).
export function buildUpdateOrderDraftRequest(state: OrderDraftFormState): UpdateOrderDraftRequest {
  return {
    shipToLocationId: state.shipToLocationId ?? null,
    customerPoNumber: state.customerPoNumber.trim() || null,
    notes: state.notes.trim() || null,
    lines: state.lines.map(toLineInput),
  };
}

export function orderDraftDetailToFormState(detail: OrderDraftDetail): OrderDraftFormState {
  const state: OrderDraftFormState = {
    accountId: detail.accountId,
    customerPoNumber: detail.customerPoNumber ?? '',
    notes: detail.notes ?? '',
    lines: detail.lines.map((line, index) => {
      const draft: OrderDraftLineDraft = {
        key: makeLineKey(line.id || index),
        productName: line.productName,
        quantity: line.quantity,
      };
      if (line.baseProductId) {
        draft.baseProductId = line.baseProductId;
      }
      if (line.sku) {
        draft.sku = line.sku;
      }
      if (line.unitOfMeasure) {
        draft.unitOfMeasure = line.unitOfMeasure;
      }
      if (line.unitPriceCents !== undefined) {
        draft.unitPriceCents = line.unitPriceCents;
      }
      if (line.lineNote) {
        draft.lineNote = line.lineNote;
      }
      return draft;
    }),
  };
  if (detail.shipToLocationId) {
    state.shipToLocationId = detail.shipToLocationId;
  }
  return state;
}

// Order-on-behalf (FR-MOB-047): a CRM-owned "order intent" captured by a TM/CSR
// for an account. Pulse owns the DRAFT/SUBMITTED authoring + back-office triage;
// authoritative pricing and ERP order placement remain with Acumatica. Money is
// integer cents and `subtotalCents` is a best-effort estimate (BaseProduct carries
// no price) — never treat it as the authoritative order total.

export const ORDER_DRAFT_STATUSES = [
  'draft',
  'submitted',
  'fulfilled',
  'cancelled',
] as const;

export type OrderDraftStatusKey = (typeof ORDER_DRAFT_STATUSES)[number];

// Origin of the order: internal rep/CSR/TM on behalf of an account, or a dealer placing
// it for their own account via the dealer portal. Both share the OrderDraft lifecycle.
export const ORDER_SOURCES = [
  'internal_on_behalf',
  'dealer_self_service',
] as const;

export type OrderSourceKey = (typeof ORDER_SOURCES)[number];

export interface OrderDraftLineSummary {
  id: string;
  baseProductId?: string;
  sku?: string;
  productName: string;
  unitOfMeasure?: string;
  quantity: number;
  /** Optional TM estimate; authoritative price comes from Acumatica. */
  unitPriceCents?: number;
  /** quantity × unitPriceCents when a unit price is known. */
  lineSubtotalCents?: number;
  lineNote?: string;
  position: number;
}

export interface OrderDraftSummary {
  id: string;
  accountId: string;
  accountName?: string;
  shipToLocationId?: string;
  status: OrderDraftStatusKey;
  source: OrderSourceKey;
  referenceCode?: string;
  customerPoNumber?: string;
  notes?: string;
  currencyCode: string;
  /** Best-effort estimate from line snapshots; not authoritative (Acumatica prices). */
  subtotalCents: number;
  lineCount: number;
  /** True when at least one line carried an estimated unit price. */
  pricingEstimated: boolean;
  createdByUserId?: string;
  createdByName?: string;
  submittedAt?: string;
  submittedByUserId?: string;
  submittedByName?: string;
  fulfilledAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderDraftDetail extends OrderDraftSummary {
  lines: OrderDraftLineSummary[];
}

export interface OrderDraftLineInput {
  baseProductId?: string;
  sku?: string;
  /** Required when baseProductId is omitted (free-text line). */
  productName?: string;
  unitOfMeasure?: string;
  quantity: number;
  unitPriceCents?: number;
  lineNote?: string;
}

export interface ListOrderDraftsRequest {
  accountId?: string;
  status?: OrderDraftStatusKey;
  source?: OrderSourceKey;
  /** Matches referenceCode / customerPoNumber / account display name. */
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListOrderDraftsResponse {
  items: OrderDraftSummary[];
  total: number;
}

export interface CreateOrderDraftRequest {
  accountId: string;
  shipToLocationId?: string;
  notes?: string;
  customerPoNumber?: string;
  referenceCode?: string;
  currencyCode?: string;
  lines?: OrderDraftLineInput[];
  /**
   * Optional client-supplied idempotency key. Replaying a create with the same key (per actor) returns
   * the existing draft instead of creating a duplicate — closes the FR-MOB-047 offline-retry
   * lost-response window where a create committed server-side but its response never reached the client.
   */
  idempotencyKey?: string;
}

export interface UpdateOrderDraftRequest {
  shipToLocationId?: string | null;
  notes?: string | null;
  customerPoNumber?: string | null;
  referenceCode?: string | null;
  currencyCode?: string;
  /** When provided, replaces the full set of lines. */
  lines?: OrderDraftLineInput[];
}

export interface SubmitOrderDraftRequest {
  referenceCode?: string;
  notes?: string;
}

export interface CancelOrderDraftRequest {
  cancelReason?: string;
}

// Lightweight catalog search for the order-line picker. Lives under the orders module
// (gated on order.create) so an on-behalf author can search products without being granted
// the full product_management workspace.
export interface OrderProductOption {
  id: string;
  sku: string;
  productName: string;
  unitOfMeasure?: string;
}

export interface SearchOrderProductsRequest {
  search?: string;
  limit?: number;
}

export interface SearchOrderProductsResponse {
  items: OrderProductOption[];
}

import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import { AuditAction, OrderDraftStatus, Prisma, prisma } from '@pulse/db';
import type {
  CancelOrderDraftRequest,
  CreateOrderDraftRequest,
  ListOrderDraftsRequest,
  ListOrderDraftsResponse,
  OrderDraftDetail,
  OrderDraftLineInput,
  OrderDraftLineSummary,
  OrderDraftStatusKey,
  OrderDraftSummary,
  OrderProductOption,
  SearchOrderProductsRequest,
  SearchOrderProductsResponse,
  SubmitOrderDraftRequest,
  UpdateOrderDraftRequest,
} from '@pulse/contracts/orders';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAccountRecordScope, buildOrderDraftRecordScope } from '../auth/visibility.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const ORDER_DRAFT_ENTITY_TYPE = 'ORDER_DRAFT';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_LINES = 200;
const MAX_QUANTITY = 1_000_000;
const MAX_UNIT_PRICE_CENTS = 100_000_000; // $1,000,000 per unit ceiling
const MAX_SUBTOTAL_CENTS = 2_147_483_647; // PostgreSQL INT4 max — the subtotalCents column bound

const ORDER_DRAFT_INCLUDE = {
  account: { select: { displayName: true } },
  createdBy: { select: { displayName: true } },
  submittedBy: { select: { displayName: true } },
  lines: { orderBy: { position: 'asc' } },
} satisfies Prisma.OrderDraftInclude;

type OrderDraftWithRelations = Prisma.OrderDraftGetPayload<{ include: typeof ORDER_DRAFT_INCLUDE }>;
type OrderDraftLineRecord = OrderDraftWithRelations['lines'][number];

export async function listOrderDrafts(
  actor: AuthenticatedActor,
  query: ListOrderDraftsRequest = {},
): Promise<ListOrderDraftsResponse> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.view');

  const limit = normalizeLimit(query.limit);
  const offset = normalizeOffset(query.offset);
  const scopeWhere = buildOrderDraftRecordScope(actor);

  const where: Prisma.OrderDraftWhereInput = {};
  if (query.accountId) {
    where.accountId = query.accountId;
  }
  if (query.status) {
    where.status = toOrderDraftStatusEnum(query.status);
  }
  const search = query.search?.trim();
  if (search) {
    where.OR = [
      { referenceCode: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { customerPoNumber: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { account: { is: { displayName: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
    ];
  }

  const finalWhere = scopeWhere ? { AND: [scopeWhere, where] } : where;

  const [items, total] = await Promise.all([
    prisma.orderDraft.findMany({
      where: finalWhere,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      ...(offset !== undefined ? { skip: offset } : {}),
      include: ORDER_DRAFT_INCLUDE,
    }),
    prisma.orderDraft.count({ where: finalWhere }),
  ]);

  return {
    items: items.map((draft) => toOrderDraftSummary(draft)),
    total,
  };
}

// Catalog search that feeds the order-line picker. Gated on order.create (not the
// product_management module) so on-behalf authors can find products without the full
// product-management workspace grant. Returns only sellable products.
export async function searchOrderableProducts(
  actor: AuthenticatedActor,
  query: SearchOrderProductsRequest = {},
): Promise<SearchOrderProductsResponse> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.create');

  const limit = normalizeLimit(query.limit);
  const search = query.search?.trim();
  const where: Prisma.BaseProductWhereInput = { isSellable: true };
  if (search) {
    where.OR = [
      { productName: { contains: search, mode: Prisma.QueryMode.insensitive } },
      { sku: { contains: search, mode: Prisma.QueryMode.insensitive } },
    ];
  }

  const products = await prisma.baseProduct.findMany({
    where,
    orderBy: [{ productName: 'asc' }],
    take: limit,
    select: { id: true, sku: true, productName: true, uom: true },
  });

  return {
    items: products.map((product) => {
      const option: OrderProductOption = {
        id: product.id,
        sku: product.sku,
        productName: product.productName,
      };
      if (product.uom) {
        option.unitOfMeasure = product.uom;
      }
      return option;
    }),
  };
}

export async function getOrderDraftDetail(
  actor: AuthenticatedActor,
  orderDraftId: string,
): Promise<OrderDraftDetail | null> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.view');

  const draft = await findScopedOrderDraft(actor, orderDraftId);
  return draft ? toOrderDraftDetail(draft) : null;
}

export async function createOrderDraft(
  actor: AuthenticatedActor,
  input: CreateOrderDraftRequest,
): Promise<OrderDraftDetail> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.create');

  const accountId = input.accountId?.trim();
  if (!accountId) {
    throw new Error('accountId is required');
  }
  await assertAccountInScope(actor, accountId);

  const shipToLocationId = optionalTrimmed(input.shipToLocationId);
  if (shipToLocationId) {
    await assertShipToBelongsToAccount(accountId, shipToLocationId);
  }

  const { lineData, subtotalCents, pricingEstimated } = await buildLineCreateData(input.lines ?? []);
  const currencyCode = normalizeCurrency(input.currencyCode);
  const notes = optionalTrimmed(input.notes);
  const customerPoNumber = optionalTrimmed(input.customerPoNumber);
  const referenceCode = optionalTrimmed(input.referenceCode);

  const created = await prisma.$transaction(async (tx) => {
    const draft = await tx.orderDraft.create({
      data: {
        account: { connect: { id: accountId } },
        createdBy: { connect: { id: actor.userId } },
        currencyCode,
        subtotalCents,
        lineCount: lineData.length,
        pricingEstimated,
        ...(shipToLocationId ? { shipToLocation: { connect: { id: shipToLocationId } } } : {}),
        ...(notes ? { notes } : {}),
        ...(customerPoNumber ? { customerPoNumber } : {}),
        ...(referenceCode ? { referenceCode } : {}),
        ...(lineData.length ? { lines: { create: lineData } } : {}),
      },
      include: ORDER_DRAFT_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: ORDER_DRAFT_ENTITY_TYPE,
        entityId: draft.id,
        metadata: { sessionId: actor.sessionId, actorRole: actor.role, actorType: actor.actorType },
        afterData: {
          accountId: draft.accountId,
          status: draft.status,
          lineCount: draft.lineCount,
          subtotalCents: draft.subtotalCents,
        },
      }),
    });

    return draft;
  });

  return toOrderDraftDetail(created);
}

export async function updateOrderDraft(
  actor: AuthenticatedActor,
  orderDraftId: string,
  input: UpdateOrderDraftRequest,
): Promise<OrderDraftDetail> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.create');

  const existing = await findScopedOrderDraft(actor, orderDraftId);
  if (!existing) {
    throw new Error(`Order draft not found: ${orderDraftId}`);
  }
  if (existing.status !== OrderDraftStatus.DRAFT) {
    throw new Error(`Only draft orders can be edited (current status: ${toOrderDraftStatusKey(existing.status)})`);
  }

  const data: Prisma.OrderDraftUpdateInput = {};
  if (input.shipToLocationId !== undefined) {
    const shipToLocationId = optionalTrimmed(input.shipToLocationId);
    if (!shipToLocationId) {
      data.shipToLocation = { disconnect: true };
    } else {
      await assertShipToBelongsToAccount(existing.accountId, shipToLocationId);
      data.shipToLocation = { connect: { id: shipToLocationId } };
    }
  }
  if (input.notes !== undefined) {
    data.notes = normalizeNullableText(input.notes);
  }
  if (input.customerPoNumber !== undefined) {
    data.customerPoNumber = normalizeNullableText(input.customerPoNumber);
  }
  if (input.referenceCode !== undefined) {
    data.referenceCode = normalizeNullableText(input.referenceCode);
  }
  if (input.currencyCode !== undefined) {
    data.currencyCode = normalizeCurrency(input.currencyCode);
  }

  let replaceLines = false;
  let lineData: Prisma.OrderDraftLineCreateWithoutOrderDraftInput[] = [];
  if (input.lines !== undefined) {
    replaceLines = true;
    const computed = await buildLineCreateData(input.lines);
    lineData = computed.lineData;
    data.subtotalCents = computed.subtotalCents;
    data.lineCount = computed.lineData.length;
    data.pricingEstimated = computed.pricingEstimated;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (replaceLines) {
      await tx.orderDraftLine.deleteMany({ where: { orderDraftId } });
    }
    const draft = await tx.orderDraft.update({
      where: { id: orderDraftId },
      data: {
        ...data,
        ...(replaceLines && lineData.length ? { lines: { create: lineData } } : {}),
      },
      include: ORDER_DRAFT_INCLUDE,
    });

    // Capture every mutated field in the audit trail, not just line totals.
    const beforeData: Record<string, unknown> = { lineCount: existing.lineCount, subtotalCents: existing.subtotalCents };
    const afterData: Record<string, unknown> = { lineCount: draft.lineCount, subtotalCents: draft.subtotalCents };
    if (input.shipToLocationId !== undefined) {
      beforeData.shipToLocationId = existing.shipToLocationId;
      afterData.shipToLocationId = draft.shipToLocationId;
    }
    if (input.notes !== undefined) {
      beforeData.notes = existing.notes;
      afterData.notes = draft.notes;
    }
    if (input.customerPoNumber !== undefined) {
      beforeData.customerPoNumber = existing.customerPoNumber;
      afterData.customerPoNumber = draft.customerPoNumber;
    }
    if (input.referenceCode !== undefined) {
      beforeData.referenceCode = existing.referenceCode;
      afterData.referenceCode = draft.referenceCode;
    }
    if (input.currencyCode !== undefined) {
      beforeData.currencyCode = existing.currencyCode;
      afterData.currencyCode = draft.currencyCode;
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ORDER_DRAFT_ENTITY_TYPE,
        entityId: draft.id,
        metadata: { sessionId: actor.sessionId, actorRole: actor.role, actorType: actor.actorType, linesReplaced: replaceLines },
        beforeData,
        afterData,
      }),
    });

    return draft;
  });

  return toOrderDraftDetail(updated);
}

export async function submitOrderDraft(
  actor: AuthenticatedActor,
  orderDraftId: string,
  input: SubmitOrderDraftRequest = {},
): Promise<OrderDraftDetail> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.submit');

  const existing = await findScopedOrderDraft(actor, orderDraftId);
  if (!existing) {
    throw new Error(`Order draft not found: ${orderDraftId}`);
  }
  if (existing.status !== OrderDraftStatus.DRAFT) {
    throw new Error(`Only draft orders can be submitted (current status: ${toOrderDraftStatusKey(existing.status)})`);
  }
  if (existing.lineCount < 1) {
    throw new Error('An order draft must have at least one line before it can be submitted');
  }

  const referenceCode = optionalTrimmed(input.referenceCode);
  const notes = optionalTrimmed(input.notes);

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic guard: only advance if the row is still DRAFT, so a concurrent submit
    // cannot double-write submittedBy/submittedAt. The pre-check above gives the
    // clean status message for the common, non-racing case.
    const result = await tx.orderDraft.updateMany({
      where: { id: orderDraftId, status: OrderDraftStatus.DRAFT },
      data: {
        status: OrderDraftStatus.SUBMITTED,
        submittedAt: new Date(),
        submittedByUserId: actor.userId,
        ...(referenceCode ? { referenceCode } : {}),
        ...(notes ? { notes } : {}),
      },
    });
    if (result.count === 0) {
      throw new Error('Order draft was updated concurrently; reload and try again');
    }
    const draft = await tx.orderDraft.findUniqueOrThrow({ where: { id: orderDraftId }, include: ORDER_DRAFT_INCLUDE });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ORDER_DRAFT_ENTITY_TYPE,
        entityId: draft.id,
        metadata: { sessionId: actor.sessionId, actorRole: actor.role, actorType: actor.actorType, transition: 'submit' },
        beforeData: { status: existing.status },
        afterData: { status: draft.status },
      }),
    });

    return draft;
  });

  return toOrderDraftDetail(updated);
}

export async function cancelOrderDraft(
  actor: AuthenticatedActor,
  orderDraftId: string,
  input: CancelOrderDraftRequest = {},
): Promise<OrderDraftDetail> {
  assertModuleAccess(actor.role, 'orders');
  // Cancel is the "abandon" side of authoring, so it deliberately reuses order.create
  // (whoever can author/edit a draft can abandon it) rather than introducing a separate
  // order.cancel action. submit/fulfill (forward advancement) use order.submit.
  assertActionAccess(actor.role, 'order.create');

  const existing = await findScopedOrderDraft(actor, orderDraftId);
  if (!existing) {
    throw new Error(`Order draft not found: ${orderDraftId}`);
  }
  if (existing.status === OrderDraftStatus.CANCELLED || existing.status === OrderDraftStatus.FULFILLED) {
    throw new Error(`Cannot cancel an order in status ${toOrderDraftStatusKey(existing.status)}`);
  }

  const cancelReason = optionalTrimmed(input.cancelReason);

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic guard: only cancel from a non-terminal status (a concurrent fulfill
    // must not be silently overwritten with CANCELLED).
    const result = await tx.orderDraft.updateMany({
      where: { id: orderDraftId, status: { in: [OrderDraftStatus.DRAFT, OrderDraftStatus.SUBMITTED] } },
      data: {
        status: OrderDraftStatus.CANCELLED,
        cancelledAt: new Date(),
        ...(cancelReason ? { cancelReason } : {}),
      },
    });
    if (result.count === 0) {
      throw new Error('Order draft was updated concurrently; reload and try again');
    }
    const draft = await tx.orderDraft.findUniqueOrThrow({ where: { id: orderDraftId }, include: ORDER_DRAFT_INCLUDE });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ORDER_DRAFT_ENTITY_TYPE,
        entityId: draft.id,
        metadata: { sessionId: actor.sessionId, actorRole: actor.role, actorType: actor.actorType, transition: 'cancel' },
        beforeData: { status: existing.status },
        afterData: { status: draft.status },
      }),
    });

    return draft;
  });

  return toOrderDraftDetail(updated);
}

// FULFILLED is the manual stand-in for the Acumatica order boundary. Once a real
// Acumatica order event is wired (the convertLeadOnFirstOrder / first-order seam),
// that confirmation would advance the draft instead of this back-office action.
export async function fulfillOrderDraft(
  actor: AuthenticatedActor,
  orderDraftId: string,
): Promise<OrderDraftDetail> {
  assertModuleAccess(actor.role, 'orders');
  assertActionAccess(actor.role, 'order.submit');

  const existing = await findScopedOrderDraft(actor, orderDraftId);
  if (!existing) {
    throw new Error(`Order draft not found: ${orderDraftId}`);
  }
  if (existing.status !== OrderDraftStatus.SUBMITTED) {
    throw new Error(`Only submitted orders can be marked fulfilled (current status: ${toOrderDraftStatusKey(existing.status)})`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic guard: only fulfill from SUBMITTED (a concurrent cancel must win-or-lose
    // deterministically, never both apply).
    const result = await tx.orderDraft.updateMany({
      where: { id: orderDraftId, status: OrderDraftStatus.SUBMITTED },
      data: {
        status: OrderDraftStatus.FULFILLED,
        fulfilledAt: new Date(),
      },
    });
    if (result.count === 0) {
      throw new Error('Order draft was updated concurrently; reload and try again');
    }
    const draft = await tx.orderDraft.findUniqueOrThrow({ where: { id: orderDraftId }, include: ORDER_DRAFT_INCLUDE });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: ORDER_DRAFT_ENTITY_TYPE,
        entityId: draft.id,
        metadata: { sessionId: actor.sessionId, actorRole: actor.role, actorType: actor.actorType, transition: 'fulfill' },
        beforeData: { status: existing.status },
        afterData: { status: draft.status },
      }),
    });

    return draft;
  });

  return toOrderDraftDetail(updated);
}

async function findScopedOrderDraft(actor: AuthenticatedActor, orderDraftId: string) {
  const scopeWhere = buildOrderDraftRecordScope(actor);
  return prisma.orderDraft.findFirst({
    where: scopeWhere ? { AND: [scopeWhere, { id: orderDraftId }] } : { id: orderDraftId },
    include: ORDER_DRAFT_INCLUDE,
  });
}

async function assertAccountInScope(actor: AuthenticatedActor, accountId: string): Promise<void> {
  const scopeWhere = buildAccountRecordScope(actor);
  const account = await prisma.account.findFirst({
    where: scopeWhere ? { AND: [scopeWhere, { id: accountId }] } : { id: accountId },
    select: { id: true },
  });
  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }
}

async function assertShipToBelongsToAccount(accountId: string, shipToLocationId: string): Promise<void> {
  const location = await prisma.accountLocation.findFirst({
    where: { id: shipToLocationId, accountId },
    select: { id: true },
  });
  if (!location) {
    throw new Error('Ship-to location does not belong to this account');
  }
}

async function buildLineCreateData(lines: OrderDraftLineInput[]): Promise<{
  lineData: Prisma.OrderDraftLineCreateWithoutOrderDraftInput[];
  subtotalCents: number;
  pricingEstimated: boolean;
}> {
  if (lines.length === 0) {
    return { lineData: [], subtotalCents: 0, pricingEstimated: false };
  }
  if (lines.length > MAX_LINES) {
    throw new Error(`An order draft cannot exceed ${MAX_LINES} lines`);
  }

  const productIds = Array.from(
    new Set(lines.map((line) => line.baseProductId).filter((id): id is string => Boolean(id))),
  );
  const products = productIds.length
    ? await prisma.baseProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sku: true, productName: true, uom: true },
      })
    : [];
  const productById = new Map(products.map((product) => [product.id, product]));

  let subtotalCents = 0;
  let pricingEstimated = false;
  const lineData: Prisma.OrderDraftLineCreateWithoutOrderDraftInput[] = [];

  lines.forEach((line, index) => {
    const quantity = line.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new Error(`Line ${index + 1}: quantity must be a positive integer no greater than ${MAX_QUANTITY}`);
    }

    const product = line.baseProductId ? productById.get(line.baseProductId) : undefined;
    if (line.baseProductId && !product) {
      throw new Error(`Line ${index + 1}: unknown product ${line.baseProductId}`);
    }

    const productName = (optionalTrimmed(line.productName) ?? product?.productName)?.trim();
    if (!productName) {
      throw new Error(`Line ${index + 1}: productName is required when no product is selected`);
    }

    let unitPriceCents: number | undefined;
    if (line.unitPriceCents !== undefined && line.unitPriceCents !== null) {
      if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0 || line.unitPriceCents > MAX_UNIT_PRICE_CENTS) {
        throw new Error(`Line ${index + 1}: unitPriceCents must be an integer between 0 and ${MAX_UNIT_PRICE_CENTS}`);
      }
      unitPriceCents = line.unitPriceCents;
      subtotalCents += unitPriceCents * quantity;
      if (subtotalCents > MAX_SUBTOTAL_CENTS) {
        throw new Error('Order subtotal exceeds the maximum supported amount');
      }
      pricingEstimated = true;
    }

    const sku = optionalTrimmed(line.sku) ?? product?.sku ?? undefined;
    const unitOfMeasure = optionalTrimmed(line.unitOfMeasure) ?? product?.uom ?? undefined;
    const lineNote = optionalTrimmed(line.lineNote);

    const data: Prisma.OrderDraftLineCreateWithoutOrderDraftInput = {
      productName,
      quantity,
      position: index,
    };
    if (line.baseProductId) {
      data.baseProduct = { connect: { id: line.baseProductId } };
    }
    if (sku) {
      data.sku = sku;
    }
    if (unitOfMeasure) {
      data.unitOfMeasure = unitOfMeasure;
    }
    if (unitPriceCents !== undefined) {
      data.unitPriceCents = unitPriceCents;
    }
    if (lineNote) {
      data.lineNote = lineNote;
    }
    lineData.push(data);
  });

  return { lineData, subtotalCents, pricingEstimated };
}

function toOrderDraftLineSummary(line: OrderDraftLineRecord): OrderDraftLineSummary {
  const summary: OrderDraftLineSummary = {
    id: line.id,
    productName: line.productName,
    quantity: line.quantity,
    position: line.position,
  };
  if (line.baseProductId) {
    summary.baseProductId = line.baseProductId;
  }
  if (line.sku) {
    summary.sku = line.sku;
  }
  if (line.unitOfMeasure) {
    summary.unitOfMeasure = line.unitOfMeasure;
  }
  if (line.unitPriceCents !== null && line.unitPriceCents !== undefined) {
    summary.unitPriceCents = line.unitPriceCents;
    summary.lineSubtotalCents = line.unitPriceCents * line.quantity;
  }
  if (line.lineNote) {
    summary.lineNote = line.lineNote;
  }
  return summary;
}

function toOrderDraftSummary(draft: OrderDraftWithRelations): OrderDraftSummary {
  const summary: OrderDraftSummary = {
    id: draft.id,
    accountId: draft.accountId,
    status: toOrderDraftStatusKey(draft.status),
    currencyCode: draft.currencyCode,
    subtotalCents: draft.subtotalCents,
    lineCount: draft.lineCount,
    pricingEstimated: draft.pricingEstimated,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  };
  if (draft.account?.displayName) {
    summary.accountName = draft.account.displayName;
  }
  if (draft.shipToLocationId) {
    summary.shipToLocationId = draft.shipToLocationId;
  }
  if (draft.referenceCode) {
    summary.referenceCode = draft.referenceCode;
  }
  if (draft.customerPoNumber) {
    summary.customerPoNumber = draft.customerPoNumber;
  }
  if (draft.notes) {
    summary.notes = draft.notes;
  }
  if (draft.createdByUserId) {
    summary.createdByUserId = draft.createdByUserId;
  }
  if (draft.createdBy?.displayName) {
    summary.createdByName = draft.createdBy.displayName;
  }
  if (draft.submittedAt) {
    summary.submittedAt = draft.submittedAt.toISOString();
  }
  if (draft.submittedByUserId) {
    summary.submittedByUserId = draft.submittedByUserId;
  }
  if (draft.submittedBy?.displayName) {
    summary.submittedByName = draft.submittedBy.displayName;
  }
  if (draft.fulfilledAt) {
    summary.fulfilledAt = draft.fulfilledAt.toISOString();
  }
  if (draft.cancelledAt) {
    summary.cancelledAt = draft.cancelledAt.toISOString();
  }
  if (draft.cancelReason) {
    summary.cancelReason = draft.cancelReason;
  }
  return summary;
}

function toOrderDraftDetail(draft: OrderDraftWithRelations): OrderDraftDetail {
  return {
    ...toOrderDraftSummary(draft),
    lines: draft.lines.map((line) => toOrderDraftLineSummary(line)),
  };
}

function toOrderDraftStatusEnum(value: OrderDraftStatusKey): OrderDraftStatus {
  switch (value) {
    case 'draft':
      return OrderDraftStatus.DRAFT;
    case 'submitted':
      return OrderDraftStatus.SUBMITTED;
    case 'fulfilled':
      return OrderDraftStatus.FULFILLED;
    case 'cancelled':
      return OrderDraftStatus.CANCELLED;
  }
}

function toOrderDraftStatusKey(value: OrderDraftStatus): OrderDraftStatusKey {
  switch (value) {
    case OrderDraftStatus.DRAFT:
      return 'draft';
    case OrderDraftStatus.SUBMITTED:
      return 'submitted';
    case OrderDraftStatus.FULFILLED:
      return 'fulfilled';
    case OrderDraftStatus.CANCELLED:
      return 'cancelled';
  }
}

function normalizeLimit(value?: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(value), 1), MAX_LIMIT);
}

function normalizeOffset(value?: number): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.trunc(value);
}

function optionalTrimmed(value?: string | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNullableText(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeCurrency(value?: string): string {
  const trimmed = value?.trim().toUpperCase();
  return trimmed && trimmed.length === 3 ? trimmed : 'USD';
}

import type { CreateOrderDraftRequest, UpdateOrderDraftRequest } from '@pulse/contracts/orders';
import type { OrderDraftDraftPayload } from '@/lib/mobile-draft-queue';

// FR-MOB-047 — pure builder for the durable-queue payload of an order-on-behalf draft. Type-only
// imports (both erased) keep it free of runtime deps so it is unit-testable under `node --test`; the
// screen builds the request (create when there is no CRM draft id yet, update otherwise) and enqueues.
export function buildOrderDraftOfflinePayload(input: {
  request: CreateOrderDraftRequest | UpdateOrderDraftRequest;
  currentDraftId: string | undefined;
  accountId: string;
  accountName: string;
}): OrderDraftDraftPayload {
  const isUpdate = Boolean(input.currentDraftId);
  return {
    kind: 'order_draft',
    ...(input.currentDraftId ? { draftId: input.currentDraftId } : {}),
    isUpdate,
    accountId: input.accountId,
    accountName: input.accountName,
    request: input.request,
  };
}

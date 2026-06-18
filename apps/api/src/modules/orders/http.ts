import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import {
  ORDER_DRAFT_STATUSES,
  type CancelOrderDraftRequest,
  type CreateOrderDraftRequest,
  type ListOrderDraftsRequest,
  type OrderDraftStatusKey,
  type SubmitOrderDraftRequest,
  type UpdateOrderDraftRequest,
} from '@pulse/contracts/orders';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  cancelOrderDraft,
  createOrderDraft,
  fulfillOrderDraft,
  getOrderDraftDetail,
  listOrderDrafts,
  submitOrderDraft,
  updateOrderDraft,
} from './service.js';

export async function handleOrderRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isOrderRoute =
    pathname === '/api/v1/order-drafts'
    || /^\/api\/v1\/order-drafts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/order-drafts\/[^/]+\/(submit|cancel|fulfill)$/.test(pathname);

  if (!isOrderRoute) {
    return false;
  }

  try {
    if (pathname === '/api/v1/order-drafts') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'orders',
          action: 'order.view',
        });
        const query: ListOrderDraftsRequest = {};
        const accountId = url.searchParams.get('accountId')?.trim();
        const status = url.searchParams.get('status')?.trim();
        const search = url.searchParams.get('search')?.trim();
        const limit = parseInteger(url.searchParams.get('limit'));
        const offset = parseInteger(url.searchParams.get('offset'));

        if (accountId) {
          query.accountId = accountId;
        }
        if (status) {
          if (!isOrderDraftStatusKey(status)) {
            return badRequestResponse(res, `Invalid status: ${status}`, { allowed: ORDER_DRAFT_STATUSES });
          }
          query.status = status;
        }
        if (search) {
          query.search = search;
        }
        if (limit !== undefined) {
          query.limit = limit;
        }
        if (offset !== undefined) {
          query.offset = offset;
        }

        const response = await listOrderDrafts(actor, query);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'orders',
          action: 'order.create',
        });
        const body = (await readJsonBody(req)) as CreateOrderDraftRequest;
        const response = await createOrderDraft(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const transitionMatch = pathname.match(/^\/api\/v1\/order-drafts\/([^/]+)\/(submit|cancel|fulfill)$/);
    if (transitionMatch) {
      const orderDraftId = transitionMatch[1];
      const transition = transitionMatch[2];
      if (!orderDraftId || !transition) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      if (transition === 'submit') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'orders',
          action: 'order.submit',
        });
        const body = (await readJsonBody(req)) as SubmitOrderDraftRequest;
        const response = await submitOrderDraft(actor, orderDraftId, body);
        return jsonResponse(res, 200, response);
      }

      if (transition === 'cancel') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'orders',
          action: 'order.create',
        });
        const body = (await readJsonBody(req)) as CancelOrderDraftRequest;
        const response = await cancelOrderDraft(actor, orderDraftId, body);
        return jsonResponse(res, 200, response);
      }

      // transition === 'fulfill'
      const actor = await requireAuthenticatedActor(req, {
        module: 'orders',
        action: 'order.submit',
      });
      const response = await fulfillOrderDraft(actor, orderDraftId);
      return jsonResponse(res, 200, response);
    }

    const detailMatch = pathname.match(/^\/api\/v1\/order-drafts\/([^/]+)$/);
    if (detailMatch) {
      const orderDraftId = detailMatch[1];
      if (!orderDraftId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'orders',
          action: 'order.view',
        });
        const response = await getOrderDraftDetail(actor, orderDraftId);
        if (!response) {
          return notFoundResponse(res, { entity: 'OrderDraft', id: orderDraftId });
        }
        return jsonResponse(res, 200, response);
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'orders',
          action: 'order.create',
        });
        const body = (await readJsonBody(req)) as UpdateOrderDraftRequest;
        const response = await updateOrderDraft(actor, orderDraftId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
    }
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }

    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }

    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message.includes('not found') ? 404 : 400;
    if (statusCode === 404) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

function parseInteger(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function isOrderDraftStatusKey(value: string): value is OrderDraftStatusKey {
  return (ORDER_DRAFT_STATUSES as readonly string[]).includes(value);
}

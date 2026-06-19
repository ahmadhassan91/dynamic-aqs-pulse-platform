/**
 * ORD-P6 — order-on-behalf back-office triage API client functions.
 *
 * New frontend API functions (kept out of the pulse-api.ts monolith, mirroring the
 * pulse-api-ext-* convention). Each follows the same pattern:
 *   (apiBaseUrl, accessToken?, ...args) → fetch with Authorization Bearer header.
 *
 * Drives the office triage queue: list submitted order drafts, open one, mark it
 * fulfilled (keyed into Acumatica), or cancel it. The backend enforces RBAC + lifecycle.
 */

import type {
  CancelOrderDraftRequest,
  ListOrderDraftsResponse,
  OrderDraftDetail,
  OrderDraftStatusKey,
} from '@pulse/contracts';

async function extRequestJson<TResponse>(
  apiBaseUrl: string,
  pathname: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    accessToken?: string;
    body?: unknown;
  },
): Promise<TResponse> {
  let response: Response;
  const baseUrl = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;

  try {
    response = await fetch(`${baseUrl}${pathname}`, {
      method: options.method,
      headers: {
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (fetchError) {
    const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
    if (message === 'Failed to fetch') {
      throw new Error(`Pulse API is unavailable at ${baseUrl}. Make sure the backend is running and try again.`);
    }
    throw new Error(message);
  }

  if (!response.ok) {
    const responseText = await response.text();
    let detail = responseText;
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText) as Partial<{ error: string; detail: string; message: string }>;
        detail = parsed.detail ?? parsed.error ?? parsed.message ?? responseText;
      } catch {
        // use raw text
      }
    }
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TResponse;
}

export async function fetchOrderTriageQueue(
  apiBaseUrl: string,
  accessToken: string,
  query: { status?: OrderDraftStatusKey; limit?: number } = {},
): Promise<ListOrderDraftsResponse> {
  const searchParams = new URLSearchParams();
  if (query.status) {
    searchParams.set('status', query.status);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }
  const pathname = searchParams.size > 0 ? `/api/v1/order-drafts?${searchParams.toString()}` : '/api/v1/order-drafts';
  return extRequestJson<ListOrderDraftsResponse>(apiBaseUrl, pathname, { method: 'GET', accessToken });
}

export async function fetchOrderTriageDetail(
  apiBaseUrl: string,
  accessToken: string,
  draftId: string,
): Promise<OrderDraftDetail> {
  return extRequestJson<OrderDraftDetail>(apiBaseUrl, `/api/v1/order-drafts/${encodeURIComponent(draftId)}`, {
    method: 'GET',
    accessToken,
  });
}

export async function fulfillOrderTriageDraft(
  apiBaseUrl: string,
  accessToken: string,
  draftId: string,
): Promise<OrderDraftDetail> {
  return extRequestJson<OrderDraftDetail>(apiBaseUrl, `/api/v1/order-drafts/${encodeURIComponent(draftId)}/fulfill`, {
    method: 'POST',
    accessToken,
  });
}

export async function cancelOrderTriageDraft(
  apiBaseUrl: string,
  accessToken: string,
  draftId: string,
  input: CancelOrderDraftRequest = {},
): Promise<OrderDraftDetail> {
  return extRequestJson<OrderDraftDetail>(apiBaseUrl, `/api/v1/order-drafts/${encodeURIComponent(draftId)}/cancel`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

/**
 * Extended API client for Calendar + Accounts sprint-2 items.
 *
 * Rules:
 * - Do NOT edit pulse-api.ts — import from here instead.
 * - Mirror the requestJson pattern from pulse-api.ts (local copy below).
 * - New contract types referenced here are defined in
 *   packages/contracts/src/accounts.ts and packages/contracts/src/calendar.ts.
 */

import type {
  ListAccountsRequest,
  ListAccountsResponse,
} from '@pulse/contracts';

// ---------------------------------------------------------------------------
// Local fetch helper (mirrors pulse-api.ts requestJson exactly)
// ---------------------------------------------------------------------------

function normalizeApiBaseUrl(apiBaseUrl: string) {
  return apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (body && typeof body === 'object' && 'message' in body) {
      return String((body as Record<string, unknown>).message);
    }
    if (typeof body === 'string') return body;
  } catch {
    // ignore
  }
  return '';
}

function normalizeNetworkError(apiBaseUrl: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'Failed to fetch') {
    return `Pulse API is unavailable. Make sure the backend is running and the API base URL (${apiBaseUrl}) is reachable.`;
  }
  return message;
}

async function requestJsonExt<TResponse>(
  apiBaseUrl: string,
  pathname: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    accessToken?: string;
    body?: unknown;
  },
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}${pathname}`, {
      method: options.method,
      headers: {
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    throw new Error(normalizeNetworkError(apiBaseUrl, error));
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TResponse;
}

// ---------------------------------------------------------------------------
// UX-A-010: fetchAccountsPage — offset-paginated accounts list
// ---------------------------------------------------------------------------

export async function fetchAccountsPage(
  apiBaseUrl: string,
  accessToken: string,
  query: ListAccountsRequest & { offset?: number } = {},
): Promise<ListAccountsResponse> {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }
  if (query.offset !== undefined && query.offset > 0) {
    searchParams.set('offset', String(query.offset));
  }
  if (query.includeInactive !== undefined) {
    searchParams.set('includeInactive', String(query.includeInactive));
  }
  if (query.lifecycleStatus) {
    searchParams.set('lifecycleStatus', query.lifecycleStatus);
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/accounts?${searchParams.toString()}`
    : '/api/v1/accounts';

  return requestJsonExt<ListAccountsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

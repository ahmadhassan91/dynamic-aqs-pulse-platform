import type { AccountDetail, ListAccountsResponse } from '@pulse/contracts/accounts';
import type { AuthIdentity, AuthSession, LoginRequest, TokenPair } from '@pulse/contracts/auth';
import type {
  LeadDetail,
  ListLeadsRequest,
  ListLeadsResponse,
  ListLeadWorkflowQueueRequest,
  ListLeadWorkflowQueueResponse,
  PreviewLeadOcrCaptureRequest,
  PreviewLeadOcrCaptureResponse,
} from '@pulse/contracts/leads';

export type AuthBundle = {
  identity: AuthIdentity;
  session: AuthSession;
  tokens: TokenPair;
};

export const defaultApiBaseUrl = process.env.EXPO_PUBLIC_PULSE_API_URL?.trim() || 'https://pulse-crm.theclustox.com/api';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  accessToken?: string;
  body?: unknown;
};

export class PulseApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function loginToPulse(apiBaseUrl: string, input: LoginRequest) {
  return requestJson<AuthBundle>(apiBaseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function refreshPulseSession(apiBaseUrl: string, refreshToken: string) {
  return requestJson<AuthBundle>(apiBaseUrl, '/api/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function fetchCurrentSession(apiBaseUrl: string, accessToken: string) {
  return requestJson<{ identity: AuthIdentity; session: AuthSession }>(apiBaseUrl, '/api/v1/auth/me', {
    accessToken,
  });
}

export async function fetchLeads(apiBaseUrl: string, accessToken: string, query: ListLeadsRequest = {}) {
  const searchParams = new URLSearchParams();
  append(searchParams, 'search', query.search);
  append(searchParams, 'stage', query.stage);
  append(searchParams, 'routingTeam', query.routingTeam);
  append(searchParams, 'leadSourceCode', query.leadSourceCode);
  append(searchParams, 'limit', query.limit);
  const path = `/api/v1/leads${searchParams.size ? `?${searchParams.toString()}` : ''}`;
  return requestJson<ListLeadsResponse>(apiBaseUrl, path, { accessToken });
}

export async function fetchLeadDetail(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${encodeURIComponent(leadId)}`, { accessToken });
}

export async function fetchLeadWorkflowQueue(apiBaseUrl: string, accessToken: string, query: ListLeadWorkflowQueueRequest = {}) {
  const searchParams = new URLSearchParams();
  append(searchParams, 'search', query.search);
  append(searchParams, 'routingTeam', query.routingTeam);
  append(searchParams, 'view', query.view);
  append(searchParams, 'limit', query.limit);
  const path = `/api/v1/leads/workflow-queue${searchParams.size ? `?${searchParams.toString()}` : ''}`;
  return requestJson<ListLeadWorkflowQueueResponse>(apiBaseUrl, path, { accessToken });
}

export async function previewLeadOcrCapture(apiBaseUrl: string, accessToken: string, input: PreviewLeadOcrCaptureRequest) {
  return requestJson<PreviewLeadOcrCaptureResponse>(apiBaseUrl, '/api/v1/leads/ocr/preview', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchAccounts(apiBaseUrl: string, accessToken: string, query: { search?: string; limit?: number } = {}) {
  const searchParams = new URLSearchParams();
  append(searchParams, 'search', query.search);
  append(searchParams, 'limit', query.limit);
  const path = `/api/v1/accounts${searchParams.size ? `?${searchParams.toString()}` : ''}`;
  return requestJson<ListAccountsResponse>(apiBaseUrl, path, { accessToken });
}

export async function fetchAccountDetail(apiBaseUrl: string, accessToken: string, accountId: string) {
  return requestJson<AccountDetail>(apiBaseUrl, `/api/v1/accounts/${encodeURIComponent(accountId)}`, { accessToken });
}

async function requestJson<T>(apiBaseUrl: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}${path}`, init);

  const text = await response.text();
  const payload = text ? parsePayload(text) : undefined;

  if (!response.ok) {
    const message = extractErrorMessage(payload) ?? `Pulse API request failed with status ${response.status}`;
    throw new PulseApiError(message, response.status, payload);
  }

  return payload as T;
}

function append(searchParams: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === '') return;
  searchParams.set(key, String(value));
}

function parsePayload(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return undefined;
}

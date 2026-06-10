/**
 * API client for the CRM-layer reporting module (saved definitions, runs,
 * schedules, deliveries). Pattern: each fn takes (apiBaseUrl, accessToken, ...args),
 * uses an Authorization Bearer header, throws on !ok.
 */

import type {
  CreateReportDefinitionRequest,
  CreateReportScheduleRequest,
  ListReportDefinitionsResponse,
  ListReportDeliveriesResponse,
  ListReportSchedulesResponse,
  ReportConfig,
  ReportDefinitionSummary,
  ReportRunResult,
  ReportScheduleSummary,
  UpdateReportDefinitionRequest,
  UpdateReportScheduleRequest,
} from '@pulse/contracts';

async function fetchJson<T>(
  apiBaseUrl: string,
  path: string,
  options: {
    method?: string;
    accessToken: string;
    body?: unknown;
  },
): Promise<T> {
  const { method = 'GET', accessToken, body } = options;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { detail?: string; error?: string };
      detail = payload.detail ?? payload.error ?? detail;
    } catch {
      // keep default detail
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function listReportDefinitionsApi(apiBaseUrl: string, accessToken: string) {
  return fetchJson<ListReportDefinitionsResponse>(apiBaseUrl, '/api/v1/reports/definitions', { accessToken });
}

export async function createReportDefinitionApi(apiBaseUrl: string, accessToken: string, input: CreateReportDefinitionRequest) {
  return fetchJson<ReportDefinitionSummary>(apiBaseUrl, '/api/v1/reports/definitions', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateReportDefinitionApi(apiBaseUrl: string, accessToken: string, definitionId: string, input: UpdateReportDefinitionRequest) {
  return fetchJson<ReportDefinitionSummary>(apiBaseUrl, `/api/v1/reports/definitions/${encodeURIComponent(definitionId)}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function deleteReportDefinitionApi(apiBaseUrl: string, accessToken: string, definitionId: string) {
  return fetchJson<{ ok: boolean }>(apiBaseUrl, `/api/v1/reports/definitions/${encodeURIComponent(definitionId)}`, {
    method: 'DELETE',
    accessToken,
  });
}

export async function runReportDefinitionApi(apiBaseUrl: string, accessToken: string, definitionId: string) {
  return fetchJson<ReportRunResult>(apiBaseUrl, `/api/v1/reports/definitions/${encodeURIComponent(definitionId)}/run`, {
    method: 'POST',
    accessToken,
  });
}

export async function runAdHocReportApi(apiBaseUrl: string, accessToken: string, reportKey: string, config?: ReportConfig) {
  return fetchJson<ReportRunResult>(apiBaseUrl, '/api/v1/reports/run', {
    method: 'POST',
    accessToken,
    body: { reportKey, ...(config ? { config } : {}) },
  });
}

export async function listReportSchedulesApi(apiBaseUrl: string, accessToken: string, definitionId: string) {
  return fetchJson<ListReportSchedulesResponse>(apiBaseUrl, `/api/v1/reports/definitions/${encodeURIComponent(definitionId)}/schedules`, { accessToken });
}

export async function createReportScheduleApi(apiBaseUrl: string, accessToken: string, definitionId: string, input: CreateReportScheduleRequest) {
  return fetchJson<ReportScheduleSummary>(apiBaseUrl, `/api/v1/reports/definitions/${encodeURIComponent(definitionId)}/schedules`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateReportScheduleApi(apiBaseUrl: string, accessToken: string, scheduleId: string, input: UpdateReportScheduleRequest) {
  return fetchJson<ReportScheduleSummary>(apiBaseUrl, `/api/v1/reports/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function deleteReportScheduleApi(apiBaseUrl: string, accessToken: string, scheduleId: string) {
  return fetchJson<{ ok: boolean }>(apiBaseUrl, `/api/v1/reports/schedules/${encodeURIComponent(scheduleId)}`, {
    method: 'DELETE',
    accessToken,
  });
}

export async function listReportDeliveriesApi(apiBaseUrl: string, accessToken: string, scheduleId: string) {
  return fetchJson<ListReportDeliveriesResponse>(apiBaseUrl, `/api/v1/reports/schedules/${encodeURIComponent(scheduleId)}/deliveries`, { accessToken });
}

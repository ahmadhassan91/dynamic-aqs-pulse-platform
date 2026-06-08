/**
 * Sprint 2 extension — leads + CIS API client functions.
 *
 * New frontend API functions that CANNOT go in pulse-api.ts (shared monolith).
 * Each function follows the same pattern as pulse-api.ts:
 *   (apiBaseUrl, accessToken?, ...args) → fetch with Authorization Bearer header.
 *
 * Covered items:
 *   UX-L-010  logLeadActivityNote
 *   UX-L-013  fetchLeadsPage  (pagination + group filters)
 *   UX-L-014  fetchLeadsPage  (affinityGroupCode, ownershipGroupCode)
 *   UX-CIS-008 recordFinanceQueueDecision (inline approve/decline/request-info)
 *   UX-L-015  submitWebsiteLeadTestSubmission
 */

import type {
  CisFinanceDecisionRequest,
  CisPackageDetail,
  CaptureWebsiteLeadRequest,
  CaptureWebsiteLeadResponse,
  LeadStageKey,
  LeadRoutingTeamKey,
  ListLeadsResponse,
  LogLeadActivityNoteRequest,
  LogLeadActivityNoteResponse,
} from '@pulse/contracts';

// ---------------------------------------------------------------------------
// Internal fetch helper (mirrors requestJson in pulse-api.ts)
// ---------------------------------------------------------------------------

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
      throw new Error(
        `Pulse API is unavailable at ${baseUrl}. Make sure the backend is running and try again.`,
      );
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

// ---------------------------------------------------------------------------
// UX-L-010: log a freeform activity/note on a lead record timeline
// ---------------------------------------------------------------------------

export async function logLeadActivityNote(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: LogLeadActivityNoteRequest,
): Promise<LogLeadActivityNoteResponse> {
  return extRequestJson<LogLeadActivityNoteResponse>(
    apiBaseUrl,
    `/api/v1/leads/${encodeURIComponent(leadId)}/notes`,
    { method: 'POST', accessToken, body: input },
  );
}

// ---------------------------------------------------------------------------
// UX-L-013 + UX-L-014: paginated lead list with group + territory filters
// ---------------------------------------------------------------------------

export interface FetchLeadsPageParams {
  search?: string;
  stage?: LeadStageKey;
  routingTeam?: LeadRoutingTeamKey;
  leadSourceCode?: string;
  /** UX-L-014: filter by affinity group code */
  affinityGroupCode?: string;
  /** UX-L-014: filter by ownership group code */
  ownershipGroupCode?: string;
  /** UX-L-014: filter by territory id */
  territoryId?: string;
  /** UX-L-013: page size (default 50) */
  limit?: number;
  /** UX-L-013: zero-based page index */
  page?: number;
}

export async function fetchLeadsPage(
  apiBaseUrl: string,
  accessToken: string,
  params: FetchLeadsPageParams,
): Promise<ListLeadsResponse> {
  const sp = new URLSearchParams();

  if (params.search) { sp.set('search', params.search); }
  if (params.stage) { sp.set('stage', params.stage); }
  if (params.routingTeam) { sp.set('routingTeam', params.routingTeam); }
  if (params.leadSourceCode) { sp.set('leadSourceCode', params.leadSourceCode); }
  if (params.affinityGroupCode) { sp.set('affinityGroupCode', params.affinityGroupCode); }
  if (params.ownershipGroupCode) { sp.set('ownershipGroupCode', params.ownershipGroupCode); }
  if (params.territoryId) { sp.set('territoryId', params.territoryId); }
  if (params.limit !== undefined) { sp.set('limit', String(params.limit)); }
  if (params.page !== undefined) { sp.set('page', String(params.page)); }

  const pathname = sp.size > 0 ? `/api/v1/leads?${sp.toString()}` : '/api/v1/leads';

  return extRequestJson<ListLeadsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

// ---------------------------------------------------------------------------
// UX-CIS-008: inline finance queue approve / decline / request-info
// ---------------------------------------------------------------------------

export async function recordFinanceQueueDecision(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: CisFinanceDecisionRequest,
): Promise<CisPackageDetail> {
  return extRequestJson<CisPackageDetail>(
    apiBaseUrl,
    `/api/v1/cis/${encodeURIComponent(cisPackageId)}/finance-decision`,
    { method: 'POST', accessToken, body: input },
  );
}

// ---------------------------------------------------------------------------
// UX-L-015: test-submit a website lead capture form from the preview modal
// ---------------------------------------------------------------------------

export async function submitWebsiteLeadTestSubmission(
  apiBaseUrl: string,
  input: CaptureWebsiteLeadRequest,
): Promise<CaptureWebsiteLeadResponse> {
  return extRequestJson<CaptureWebsiteLeadResponse>(
    apiBaseUrl,
    '/api/v1/public/leads/capture',
    { method: 'POST', body: input },
  );
}

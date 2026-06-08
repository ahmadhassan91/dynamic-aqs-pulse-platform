/**
 * Extended API client for Sprint 2 training + territory UX-gap items.
 * New frontend API functions go here — do NOT edit pulse-api.ts.
 * Pattern: each fn takes (apiBaseUrl, accessToken, ...args), uses Authorization Bearer header, throws on !ok.
 */

import type {
  CreateAccountTrainingProgramRequest,
  TerritoryTrainingPenetrationResponse,
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
    const payload = await response.json().catch(() => null);
    throw new Error(
      (payload as { error?: { message?: string }; detail?: string; message?: string } | null)?.error?.message
      ?? (payload as { detail?: string } | null)?.detail
      ?? (payload as { message?: string } | null)?.message
      ?? `Request failed (${response.status})`,
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// UX-T-009 / UX-T-005 — Territory training penetration + onboarding programs
// ---------------------------------------------------------------------------

/**
 * UX-T-009: Fetch territory training-penetration breakdown for the reports tab.
 * Reuses the existing `/api/v1/training/territory-penetration` endpoint.
 */
export async function fetchTerritoryTrainingPenetration(
  apiBaseUrl: string,
  accessToken: string,
): Promise<TerritoryTrainingPenetrationResponse> {
  return fetchJson<TerritoryTrainingPenetrationResponse>(
    apiBaseUrl,
    '/api/v1/training/territory-penetration',
    { accessToken },
  );
}

/**
 * UX-T-005: Start an onboarding training program for an account.
 * Posts to the existing account-programs endpoint using the 'onboarding' training type code.
 * The caller supplies trainingTypeId for the onboarding type; templateId is optional.
 */
export async function initiateOnboardingTrainingProgram(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: CreateAccountTrainingProgramRequest,
): Promise<unknown> {
  return fetchJson<unknown>(
    apiBaseUrl,
    `/api/v1/training/accounts/${accountId}/programs`,
    { method: 'POST', accessToken, body: input },
  );
}

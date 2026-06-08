// Extended API client for Sprint 2 admin + consignment items.
// RULE: Do NOT import from or modify pulse-api.ts. Copy the fetch pattern here.
// Components import from '@/lib/pulse-api-ext-admin-consignment'.

import type {
  AffinityGroupReferenceSummary,
  BrandLabelReferenceSummary,
  OwnershipGroupReferenceSummary,
  ReferenceListResponse,
  ReferenceValueSummary,
} from '@pulse/contracts';

// ---------------------------------------------------------------------------
// Reference data types (UX-AD-007)
// ---------------------------------------------------------------------------

export interface AdminReferenceDataSnapshot {
  affinityGroups: AffinityGroupReferenceSummary[];
  ownershipGroups: OwnershipGroupReferenceSummary[];
  brandLabels: BrandLabelReferenceSummary[];
  leadSources: ReferenceValueSummary[];
}

// ---------------------------------------------------------------------------
// System settings types (UX-AD-009)
// ---------------------------------------------------------------------------

export interface AdminSystemSettingsResponse {
  companyName: string;
  timezone: string;
  currency: string;
  logoUrl?: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

export interface UpdateAdminSystemSettingsRequest {
  companyName?: string;
  timezone?: string;
  currency?: string;
  logoUrl?: string;
}

// ---------------------------------------------------------------------------
// Feature flag types (UX-AD-010)
// ---------------------------------------------------------------------------

export interface AdminFeatureFlagSummary {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  scope: 'global' | 'per_role' | 'per_user';
  updatedAt: string;
}

export interface AdminFeatureFlagsResponse {
  flags: AdminFeatureFlagSummary[];
}

export interface UpdateAdminFeatureFlagRequest {
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Routing threshold types (UX-AD-008)
// ---------------------------------------------------------------------------

export interface AdminRoutingThresholdsResponse {
  leadAssignmentSlaHours: number;
  overdueFollowUpDays: number;
  poClockBusinessDays: number;
  auditOverdueDays: number;
  updatedAt: string;
}

export interface UpdateAdminRoutingThresholdsRequest {
  leadAssignmentSlaHours?: number;
  overdueFollowUpDays?: number;
  poClockBusinessDays?: number;
  auditOverdueDays?: number;
}

// ---------------------------------------------------------------------------
// Consignment alert delivery settings (UX-CSG-008)
// ---------------------------------------------------------------------------

export interface AdminConsignmentAlertDeliveryMetrics {
  pendingAlertCount: number;
  failedAlertCount: number;
  retryableFailedAlertCount: number;
  sentAttemptCount: number;
  previewedAttemptCount: number;
  skippedAttemptCount: number;
  failedAttemptCount: number;
  latestFailure?: {
    alertId: string;
    recipientName: string;
    recipientEmail?: string;
    attemptedAt: string;
    errorMessage?: string;
  };
}

export interface AdminConsignmentAlertDeliverySettingsResponse {
  status: 'ready' | 'warning' | 'blocked';
  mode: string;
  deliveryProvider: string;
  configurationIssues: string[];
  metrics: AdminConsignmentAlertDeliveryMetrics;
  integrationNote: string;
}

// ---------------------------------------------------------------------------
// Internal fetch utilities (mirrors pulse-api.ts, kept private to this file)
// ---------------------------------------------------------------------------

async function requestJson<TResponse>(
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

async function readErrorDetail(response: Response): Promise<string> {
  const responseText = await response.text();
  if (!responseText) {
    return '';
  }

  try {
    const parsed = JSON.parse(responseText) as Partial<{
      error: string;
      detail: string;
      message: string;
    }>;
    return parsed.detail ?? parsed.error ?? parsed.message ?? responseText;
  } catch {
    return responseText;
  }
}

function normalizeApiBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeNetworkError(apiBaseUrl: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'Failed to fetch') {
    return `Pulse API is unavailable at ${normalizeApiBaseUrl(apiBaseUrl)}. Make sure the backend is running and try again.`;
  }
  return message;
}

// ---------------------------------------------------------------------------
// UX-AD-007: Reference data governance
// ---------------------------------------------------------------------------

export async function fetchAdminAffinityGroups(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<AffinityGroupReferenceSummary>>(
    apiBaseUrl,
    '/api/v1/reference/affinity-groups',
    { method: 'GET', accessToken },
  );
}

export async function fetchAdminOwnershipGroups(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<OwnershipGroupReferenceSummary>>(
    apiBaseUrl,
    '/api/v1/reference/ownership-groups',
    { method: 'GET', accessToken },
  );
}

export async function fetchAdminBrandLabels(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<BrandLabelReferenceSummary>>(
    apiBaseUrl,
    '/api/v1/reference/brand-labels',
    { method: 'GET', accessToken },
  );
}

export async function fetchAdminLeadSources(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<ReferenceValueSummary>>(
    apiBaseUrl,
    '/api/v1/reference/lead-sources',
    { method: 'GET', accessToken },
  );
}

// ---------------------------------------------------------------------------
// UX-AD-008: Routing thresholds & SLA timer
// PARKED: No existing endpoint. Returning a client-side stub that renders the
// read-only defaults. Backend CRUD endpoint deferred (no server.ts change
// allowed and no existing route in admin/http.ts or reference/http.ts).
// ---------------------------------------------------------------------------

export async function fetchAdminRoutingThresholds(
  _apiBaseUrl: string,
  _accessToken: string,
): Promise<AdminRoutingThresholdsResponse> {
  // Parked — return defaults until backend CRUD endpoint is added
  return Promise.resolve({
    leadAssignmentSlaHours: 24,
    overdueFollowUpDays: 7,
    poClockBusinessDays: 5,
    auditOverdueDays: 90,
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// UX-AD-009: System settings
// PARKED: No existing endpoint for company/logo/tz/currency. Returns defaults.
// Backend CRUD endpoint deferred.
// ---------------------------------------------------------------------------

export async function fetchAdminSystemSettings(
  _apiBaseUrl: string,
  _accessToken: string,
): Promise<AdminSystemSettingsResponse> {
  return Promise.resolve({
    companyName: 'Dynamic AQS',
    timezone: 'America/Toronto',
    currency: 'CAD',
    updatedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// UX-AD-010: Feature flags
// PARKED: No existing endpoint. Returns empty list with a note.
// Backend CRUD endpoint deferred.
// ---------------------------------------------------------------------------

export async function fetchAdminFeatureFlags(
  _apiBaseUrl: string,
  _accessToken: string,
): Promise<AdminFeatureFlagsResponse> {
  return Promise.resolve({ flags: [] });
}

// ---------------------------------------------------------------------------
// UX-CSG-008: Consignment alert delivery settings
// PARKED: No existing consignment alert delivery admin endpoint in
// apps/api/src/modules/consignment/http.ts (only the scanner job exists).
// Returns a static summary until the backend endpoint is added.
// ---------------------------------------------------------------------------

export async function fetchAdminConsignmentAlertDeliverySettings(
  _apiBaseUrl: string,
  _accessToken: string,
): Promise<AdminConsignmentAlertDeliverySettingsResponse> {
  return Promise.resolve({
    status: 'warning',
    mode: 'scanner_persisting',
    deliveryProvider: 'in-app',
    configurationIssues: [
      'Email delivery (Microsoft Graph sendMail) is parked — alerts are persisted to the database and surfaced in-app only until Graph credentials are certified.',
    ],
    metrics: {
      pendingAlertCount: 0,
      failedAlertCount: 0,
      retryableFailedAlertCount: 0,
      sentAttemptCount: 0,
      previewedAttemptCount: 0,
      skippedAttemptCount: 0,
      failedAttemptCount: 0,
    },
    integrationNote:
      'The consignment operational alert scanner runs on schedule and persists PENDING alerts to the database. In-app surfacing (the ranked Next Work queue) is live. Email delivery via Microsoft Graph sendMail requires the same credential certification as the lead alert pipeline.',
  });
}

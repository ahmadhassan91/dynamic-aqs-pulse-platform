import type { AuthBundle } from './api';
import type { StoredSession } from './session-store';

export type SessionLifecycleDeps = {
  fetchCurrentSession: (apiBaseUrl: string, accessToken: string) => Promise<Pick<AuthBundle, 'identity' | 'session'>>;
  refreshPulseSession: (apiBaseUrl: string, refreshToken: string) => Promise<AuthBundle>;
};

export type SessionLifecycleResolution = {
  auth: AuthBundle | null;
  apiBaseUrl?: string | undefined;
  errorMessage?: string;
  shouldClearStoredSession: boolean;
  shouldSaveStoredSession: boolean;
};

export async function resolveStoredSession(
  stored: StoredSession | null,
  deps: SessionLifecycleDeps,
): Promise<SessionLifecycleResolution> {
  if (!stored) {
    return {
      auth: null,
      shouldClearStoredSession: false,
      shouldSaveStoredSession: false,
    };
  }

  const apiBaseUrl = stored.apiBaseUrl;
  try {
    const current = await deps.fetchCurrentSession(apiBaseUrl ?? '', stored.auth.tokens.accessToken);
    const auth = {
      ...stored.auth,
      identity: current.identity,
      session: current.session,
    };
    if (!isMobileAuthAllowed(auth)) return mobileAccessDeniedResolution(apiBaseUrl);
    return {
      apiBaseUrl,
      auth,
      shouldClearStoredSession: false,
      shouldSaveStoredSession: true,
    };
  } catch {
    try {
      const refreshed = await deps.refreshPulseSession(apiBaseUrl ?? '', stored.auth.tokens.refreshToken);
      if (!isMobileAuthAllowed(refreshed)) return mobileAccessDeniedResolution(apiBaseUrl);
      return {
        apiBaseUrl,
        auth: refreshed,
        shouldClearStoredSession: false,
        shouldSaveStoredSession: true,
      };
    } catch (refreshError) {
      if (isSessionAuthFailure(refreshError)) {
        return {
          apiBaseUrl,
          auth: null,
          errorMessage: 'Saved sign-in expired. Please sign in again.',
          shouldClearStoredSession: true,
          shouldSaveStoredSession: false,
        };
      }
      return {
        apiBaseUrl,
        auth: isMobileAuthAllowed(stored.auth) ? stored.auth : null,
        errorMessage: 'Could not refresh the saved sign-in. Some CRM data may need a retry when the connection is stable.',
        shouldClearStoredSession: !isMobileAuthAllowed(stored.auth),
        shouldSaveStoredSession: false,
      };
    }
  }
}

export function isSessionAuthFailure(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403;
}

export function isMobileAuthAllowed(auth: AuthBundle) {
  return auth.session.scopes.includes('mobile');
}

function mobileAccessDeniedResolution(apiBaseUrl?: string): SessionLifecycleResolution {
  return {
    apiBaseUrl,
    auth: null,
    errorMessage: 'This Pulse account is not enabled for the mobile field app.',
    shouldClearStoredSession: true,
    shouldSaveStoredSession: false,
  };
}

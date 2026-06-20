'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LeadDashboardResponse } from '@pulse/contracts';
import { usePulseSession } from '@/lib/pulse-session';
import { fetchLeadDashboardApi } from '@/lib/pulse-api-ext-reports';

/**
 * Loads the role-scoped Lead dashboard for the Reporting Home. Mirrors the
 * use-dealer-portal-dashboard hook shape: session-derived auth, cancel-safe
 * effect, and an imperative reload callback.
 */
export function useLeadDashboard() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';

  const [dashboard, setDashboard] = useState<LeadDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchLeadDashboardApi(apiBaseUrl, accessToken);
      setDashboard(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the lead dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      // No token yet (session still hydrating) — stay in the loading state rather
      // than flashing the "no data" empty state; ProtectedWorkspace guarantees a
      // token by the time this is mounted under /reports.
      return () => {
        cancelled = true;
      };
    }
    setIsLoading(true);
    setErrorMessage(null);
    void (async () => {
      try {
        const response = await fetchLeadDashboardApi(apiBaseUrl, accessToken);
        if (!cancelled) setDashboard(response);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load the lead dashboard.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, accessToken]);

  return { dashboard, isLoading, errorMessage, reload };
}

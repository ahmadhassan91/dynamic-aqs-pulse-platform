'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ExecutiveDashboardResponse } from '@pulse/contracts';
import { usePulseSession } from '@/lib/pulse-session';
import { fetchExecutiveDashboardApi } from '@/lib/pulse-api-ext-reports';

/**
 * Loads the org-wide Executive overview for the Reporting Home (reports.executive
 * gate). Same shape as the other dashboard hooks: cancel-safe effect + reload.
 */
export function useExecutiveDashboard() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';

  const [dashboard, setDashboard] = useState<ExecutiveDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchExecutiveDashboardApi(apiBaseUrl, accessToken);
      setDashboard(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the executive dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      return () => {
        cancelled = true;
      };
    }
    setIsLoading(true);
    setErrorMessage(null);
    void (async () => {
      try {
        const response = await fetchExecutiveDashboardApi(apiBaseUrl, accessToken);
        if (!cancelled) setDashboard(response);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load the executive dashboard.');
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

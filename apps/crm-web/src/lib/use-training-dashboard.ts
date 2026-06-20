'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TrainingDashboardResponse } from '@pulse/contracts';
import { usePulseSession } from '@/lib/pulse-session';
import { fetchTrainingDashboardApi } from '@/lib/pulse-api-ext-reports';

/**
 * Loads the role-scoped Training dashboard for the Reporting Home. Same shape as
 * use-lead-dashboard: session-derived auth, cancel-safe effect, reload callback.
 */
export function useTrainingDashboard() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';

  const [dashboard, setDashboard] = useState<TrainingDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchTrainingDashboardApi(apiBaseUrl, accessToken);
      setDashboard(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not load the training dashboard.');
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      // No token yet (session still hydrating) — stay loading rather than flashing empty.
      return () => {
        cancelled = true;
      };
    }
    setIsLoading(true);
    setErrorMessage(null);
    void (async () => {
      try {
        const response = await fetchTrainingDashboardApi(apiBaseUrl, accessToken);
        if (!cancelled) setDashboard(response);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load the training dashboard.');
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

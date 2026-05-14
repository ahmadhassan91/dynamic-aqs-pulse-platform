'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DealerPortalDashboardResponse } from '@pulse/contracts';
import { fetchDealerPortalDashboard } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function useDealerPortalDashboard() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const isDealerPortalUser = auth?.identity.role === 'DEALER_PORTAL_USER';
  const [dashboard, setDashboard] = useState<DealerPortalDashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!accessToken || !isDealerPortalUser) {
      setDashboard(null);
      return null;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextDashboard = await fetchDealerPortalDashboard(apiBaseUrl, accessToken);
      setDashboard(nextDashboard);
      return nextDashboard;
    } catch (error) {
      setDashboard(null);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  useEffect(() => {
    if (!isHydrated || !accessToken || !isDealerPortalUser) {
      setDashboard(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextDashboard = await fetchDealerPortalDashboard(apiBaseUrl, accessToken);
        if (!cancelled) {
          setDashboard(nextDashboard);
        }
      } catch (error) {
        if (!cancelled) {
          setDashboard(null);
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, apiBaseUrl, isDealerPortalUser, isHydrated]);

  return {
    dashboard,
    errorMessage,
    isLoading,
    reload,
  };
}

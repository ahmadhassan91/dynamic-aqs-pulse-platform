'use client';

import { useEffect, useState } from 'react';
import type { DealerPortalCatalogResponse } from '@pulse/contracts';
import { fetchDealerPortalCatalog } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function useDealerPortalCatalog() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const [catalog, setCatalog] = useState<DealerPortalCatalogResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isHydrated || !accessToken) {
      setCatalog(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextCatalog = await fetchDealerPortalCatalog(apiBaseUrl, accessToken);
        if (!cancelled) {
          setCatalog(nextCatalog);
        }
      } catch (error) {
        if (!cancelled) {
          setCatalog(null);
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
  }, [accessToken, apiBaseUrl, isHydrated]);

  return {
    catalog,
    errorMessage,
    isLoading,
  };
}

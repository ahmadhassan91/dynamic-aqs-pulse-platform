'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DealerPortalOrderDetail, DealerPortalOrderSummary } from '@pulse/contracts';
import { fetchDealerPortalOrder, fetchDealerPortalOrders } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function useDealerPortalOrders() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const isDealerPortalUser = auth?.identity.role === 'DEALER_PORTAL_USER';
  const [orders, setOrders] = useState<DealerPortalOrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken || !isDealerPortalUser) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchDealerPortalOrders(apiBaseUrl, accessToken);
      setOrders(response.items);
    } catch (err) {
      setOrders([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  const fetchById = useCallback(async (orderId: string): Promise<DealerPortalOrderDetail> => {
    if (!accessToken || !isDealerPortalUser) {
      throw new Error('Dealer portal session required to view an order.');
    }

    setError(null);

    try {
      return await fetchDealerPortalOrder(apiBaseUrl, accessToken, orderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  useEffect(() => {
    if (!isHydrated || !accessToken || !isDealerPortalUser) {
      setOrders([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchDealerPortalOrders(apiBaseUrl, accessToken);
        if (!cancelled) {
          setOrders(response.items);
        }
      } catch (err) {
        if (!cancelled) {
          setOrders([]);
          setError(err instanceof Error ? err.message : String(err));
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
    orders,
    isLoading,
    error,
    refresh,
    fetchById,
  };
}

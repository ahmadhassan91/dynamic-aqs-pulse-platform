'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DealerPortalCartResponse,
  DealerPortalOrderDetail,
  SubmitDealerPortalOrderRequest,
  UpdateDealerPortalCartItemRequest,
} from '@pulse/contracts';
import {
  addDealerPortalCartItem,
  fetchDealerPortalCart,
  removeDealerPortalCartItem,
  submitDealerPortalOrder,
  updateDealerPortalCartItem,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function useDealerPortalCart() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const isDealerPortalUser = auth?.identity.role === 'DEALER_PORTAL_USER';
  const [cart, setCart] = useState<DealerPortalCartResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!accessToken || !isDealerPortalUser) {
      setCart(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await fetchDealerPortalCart(apiBaseUrl, accessToken);
      setCart(next);
    } catch (err) {
      setCart(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  const addItem = useCallback(async (presentationId: string, quantity: number) => {
    if (!accessToken || !isDealerPortalUser) {
      return;
    }

    setError(null);

    try {
      const next = await addDealerPortalCartItem(apiBaseUrl, accessToken, { presentationId, quantity });
      setCart(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  const updateItem = useCallback(async (lineId: string, patch: UpdateDealerPortalCartItemRequest) => {
    if (!accessToken || !isDealerPortalUser) {
      return;
    }

    setError(null);

    try {
      const next = await updateDealerPortalCartItem(apiBaseUrl, accessToken, lineId, patch);
      setCart(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  const removeItem = useCallback(async (lineId: string) => {
    if (!accessToken || !isDealerPortalUser) {
      return;
    }

    setError(null);

    try {
      const next = await removeDealerPortalCartItem(apiBaseUrl, accessToken, lineId);
      setCart(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  const submit = useCallback(async (req: SubmitDealerPortalOrderRequest): Promise<DealerPortalOrderDetail> => {
    if (!accessToken || !isDealerPortalUser) {
      throw new Error('Dealer portal session required to submit an order.');
    }

    setError(null);

    try {
      const order = await submitDealerPortalOrder(apiBaseUrl, accessToken, req);
      // Submit converts the DRAFT into a SUBMITTED order; the persistent cart is now empty.
      const next = await fetchDealerPortalCart(apiBaseUrl, accessToken);
      setCart(next);
      return order;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser]);

  useEffect(() => {
    if (!isHydrated || !accessToken || !isDealerPortalUser) {
      setCart(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const next = await fetchDealerPortalCart(apiBaseUrl, accessToken);
        if (!cancelled) {
          setCart(next);
        }
      } catch (err) {
        if (!cancelled) {
          setCart(null);
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
    cart,
    isLoading,
    error,
    addItem,
    updateItem,
    removeItem,
    submit,
    refresh,
  };
}

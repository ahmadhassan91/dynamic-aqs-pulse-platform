'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DealerPortalCatalogAssetSummary, DealerPortalCatalogProductSummary, DealerPortalCatalogResponse } from '@pulse/contracts';
import type { DealerCatalogAssetActions, DealerCatalogFavoriteActions } from '@/components/dealer/DealerCatalog';
import {
  favoriteDealerPortalProduct,
  fetchDealerPortalCatalog,
  recordDealerPortalAssetOpen,
  unfavoriteDealerPortalProduct,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type DealerCatalogProductWithFavorites = DealerPortalCatalogProductSummary & {
  isFavorite?: boolean;
  favoriteCount?: number;
};

export function useDealerPortalCatalog() {
  const { auth, apiBaseUrl, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';
  const isDealerPortalUser = auth?.identity.role === 'DEALER_PORTAL_USER';
  const [catalog, setCatalog] = useState<DealerPortalCatalogResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingPresentationId, setUpdatingPresentationId] = useState<string | undefined>();
  const [openingAssetId, setOpeningAssetId] = useState<string | undefined>();

  const toggleFavorite = useCallback(async (product: DealerCatalogProductWithFavorites) => {
    if (!accessToken || !isDealerPortalUser || updatingPresentationId) {
      return;
    }

    setUpdatingPresentationId(product.presentationId);
    setErrorMessage(null);

    try {
      const response = product.isFavorite
        ? await unfavoriteDealerPortalProduct(apiBaseUrl, accessToken, product.presentationId)
        : await favoriteDealerPortalProduct(apiBaseUrl, accessToken, product.presentationId);

      setCatalog((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          products: current.products.map((entry) => entry.presentationId === response.presentationId
            ? {
                ...entry,
                isFavorite: response.isFavorite,
                favoriteCount: response.favoriteCount,
              }
            : entry),
          userFavorites: {
            count: response.isFavorite
              ? current.userFavorites.presentationIds.includes(response.presentationId)
                ? current.userFavorites.count
                : current.userFavorites.count + 1
              : Math.max(0, current.userFavorites.count - (current.userFavorites.presentationIds.includes(response.presentationId) ? 1 : 0)),
            presentationIds: response.isFavorite
              ? Array.from(new Set([...current.userFavorites.presentationIds, response.presentationId]))
              : current.userFavorites.presentationIds.filter((presentationId) => presentationId !== response.presentationId),
          },
        };
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdatingPresentationId(undefined);
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser, updatingPresentationId]);

  const openAsset = useCallback(async (asset: DealerPortalCatalogAssetSummary) => {
    if (!accessToken || !isDealerPortalUser || openingAssetId) {
      return;
    }

    setOpeningAssetId(asset.id);
    setErrorMessage(null);

    try {
      const response = await recordDealerPortalAssetOpen(apiBaseUrl, accessToken, asset.id);
      const targetUrl = response.targetUrl ?? response.downloadUrl ?? asset.downloadUrl;
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setOpeningAssetId(undefined);
    }
  }, [accessToken, apiBaseUrl, isDealerPortalUser, openingAssetId]);

  const favoriteActions = useMemo<DealerCatalogFavoriteActions>(
    () => ({
      isAvailable: Boolean(accessToken && isDealerPortalUser),
      updatingPresentationId,
      toggleFavorite,
    }),
    [accessToken, isDealerPortalUser, toggleFavorite, updatingPresentationId],
  );

  const assetActions = useMemo<DealerCatalogAssetActions>(
    () => ({
      openingAssetId,
      openAsset,
    }),
    [openAsset, openingAssetId],
  );

  useEffect(() => {
    if (!isHydrated || !accessToken || !isDealerPortalUser) {
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
  }, [accessToken, apiBaseUrl, isDealerPortalUser, isHydrated]);

  return {
    assetActions,
    catalog,
    errorMessage,
    favoriteActions,
    isLoading,
  };
}

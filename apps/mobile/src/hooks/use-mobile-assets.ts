import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share } from 'react-native';
import type { DigitalAssetSummary } from '@pulse/contracts/digital-assets';
import { createDigitalAssetShareLink, fetchDigitalAssets } from '@/lib/api';
import { hydrateMobileAssetCache, saveMobileAssetCache, useMobileAssetCache } from '@/lib/asset-cache';
import { useSession } from '@/providers/session-provider';

export function useMobileAssets() {
  const { apiBaseUrl, auth } = useSession();
  const cache = useMobileAssetCache();
  const cacheAssetsRef = useRef(cache.assets);
  const [assets, setAssets] = useState<DigitalAssetSummary[]>(cache.assets);
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(cache.assets[0]?.id ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const selectedAsset = useMemo(() => assets.find((asset) => asset.id === selectedId) ?? assets[0], [assets, selectedId]);

  const loadAssets = useCallback(async () => {
    if (!auth) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const trimmedSearch = submittedSearch.trim();
      const response = await fetchDigitalAssets(apiBaseUrl, auth.tokens.accessToken, {
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
        status: 'active',
        limit: 25,
      });
      setAssets(response.items);
      setSelectedId((current) => current && response.items.some((asset) => asset.id === current) ? current : response.items[0]?.id ?? null);
      saveMobileAssetCache(response.items);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load asset library.');
      if (cacheAssetsRef.current.length) setAssets(cacheAssetsRef.current);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, auth, submittedSearch]);

  const submitSearch = useCallback(() => {
    setSubmittedSearch(search.trim());
  }, [search]);

  const clearSearch = useCallback(() => {
    setSearch('');
    setSubmittedSearch('');
  }, []);

  const selectAsset = useCallback((assetId: string) => {
    setSelectedId(assetId);
    setShareUrl(null);
  }, []);

  const createShareForSelectedAsset = useCallback(async () => {
    if (!auth || !selectedAsset) return;
    setIsSharing(true);
    setErrorMessage(null);
    try {
      const share = await createDigitalAssetShareLink(apiBaseUrl, auth.tokens.accessToken, selectedAsset.id, {
        recipientType: 'customer',
        contextType: 'mobile_field_share',
        expiresInDays: 14,
        note: 'Created from Pulse Field mobile.',
      });
      setShareUrl(share.shareUrl);
      await Share.share({ message: `${selectedAsset.title}\n${share.shareUrl}`, url: share.shareUrl, title: selectedAsset.title });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to create share link.');
    } finally {
      setIsSharing(false);
    }
  }, [apiBaseUrl, auth, selectedAsset]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    cacheAssetsRef.current = cache.assets;
  }, [cache.assets]);

  useEffect(() => {
    void hydrateMobileAssetCache().then((hydrated) => {
      if (!assets.length && hydrated.assets.length) {
        setAssets(hydrated.assets);
        setSelectedId(hydrated.assets[0]?.id ?? null);
      }
    });
  }, []);

  return {
    assets,
    cache,
    clearSearch,
    createShareForSelectedAsset,
    errorMessage,
    isLoading,
    isSharing,
    loadAssets,
    search,
    selectedAsset,
    selectAsset,
    setSearch,
    shareUrl,
    submitSearch,
  };
}

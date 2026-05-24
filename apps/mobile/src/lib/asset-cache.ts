import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { DigitalAssetSummary } from '@pulse/contracts/digital-assets';
import { toDisplaySafeMobileAssetCacheItem } from '@/lib/asset-cache-policy';

const cacheKey = 'pulse.mobile.assetCache.v1';
const listeners = new Set<() => void>();
let cachedAssets: DigitalAssetSummary[] = [];
let cachedAt: string | undefined;
let cachedRaw: string | undefined;
let cacheError: string | undefined;
let isNativeHydrating = false;
let cachedSnapshot: MobileAssetCacheState = { assets: cachedAssets };

export type MobileAssetCacheState = {
  assets: DigitalAssetSummary[];
  cachedAt?: string;
  errorMessage?: string;
};

export function useMobileAssetCache() {
  return useSyncExternalStore(subscribe, loadMobileAssetCache, loadMobileAssetCache);
}

export async function hydrateMobileAssetCache() {
  if (Platform.OS === 'web' || isNativeHydrating) return compactState();
  isNativeHydrating = true;
  try {
    const raw = await SecureStore.getItemAsync(cacheKey);
    applyCache(raw);
  } catch (error) {
    cacheError = formatCacheError(error);
    refreshSnapshot();
  } finally {
    isNativeHydrating = false;
    notify();
  }
  return compactState();
}

export function loadMobileAssetCache(): MobileAssetCacheState {
  const raw = readCache();
  if (!raw) {
    return compactState();
  }
  if (raw === cachedRaw) {
    return compactState();
  }
  applyCache(raw);
  return compactState();
}

export function saveMobileAssetCache(assets: DigitalAssetSummary[]) {
  const cachedAtValue = new Date().toISOString();
  const payload = JSON.stringify({
    assets: assets.slice(0, 50).map(toMobileAssetCacheItem),
    cachedAt: cachedAtValue,
  });
  cachedRaw = payload;
  cachedAssets = assets.slice(0, 50).map(toMobileAssetCacheItem);
  cachedAt = cachedAtValue;
  cacheError = undefined;
  refreshSnapshot();

  if (Platform.OS === 'web') {
    try {
      globalThis.localStorage?.setItem(cacheKey, payload);
    } catch (error) {
      cacheError = formatCacheError(error);
      refreshSnapshot();
    }
  } else {
    void SecureStore.setItemAsync(cacheKey, payload).catch((error) => {
      cacheError = formatCacheError(error);
      refreshSnapshot();
      notify();
    });
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readCache() {
  if (Platform.OS !== 'web') return cachedRaw;
  try {
    return globalThis.localStorage?.getItem(cacheKey) ?? cachedRaw;
  } catch (error) {
    cacheError = formatCacheError(error);
    refreshSnapshot();
    return cachedRaw;
  }
}

function applyCache(raw: string | null | undefined) {
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { assets?: DigitalAssetSummary[]; cachedAt?: string };
    cachedRaw = raw;
    cachedAssets = Array.isArray(parsed.assets) ? parsed.assets.map(toMobileAssetCacheItem) : [];
    cachedAt = parsed.cachedAt;
    cacheError = undefined;
    refreshSnapshot();
  } catch (error) {
    cacheError = error instanceof Error ? error.message : 'Unable to read cached asset metadata.';
    refreshSnapshot();
  }
}

function compactState(): MobileAssetCacheState {
  return cachedSnapshot;
}

function refreshSnapshot() {
  cachedSnapshot = {
    assets: cachedAssets,
    ...(cachedAt ? { cachedAt } : {}),
    ...(cacheError ? { errorMessage: cacheError } : {}),
  };
}

function notify() {
  for (const listener of listeners) listener();
}

function formatCacheError(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to save asset metadata on this device.';
}

function toMobileAssetCacheItem(asset: DigitalAssetSummary): DigitalAssetSummary {
  return toDisplaySafeMobileAssetCacheItem(asset);
}

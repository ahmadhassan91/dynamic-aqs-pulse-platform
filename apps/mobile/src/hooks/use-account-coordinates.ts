import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { accountAddressKey, type MappableAddress } from '@/lib/account-map-status';

export { accountAddressKey };

// The field map needs accounts with a geocodable address (and ideally server-stored lat/lng).
// AccountSummary does not yet carry address (see account-map-status.ts) — this generic shape
// decouples the geocoder from that backend gap so the foundation is ready when the data lands.
export type MappableAccount = MappableAddress & { id: string };

export type AccountCoordinate = { latitude: number; longitude: number };

// Module-level cache so geocoded coordinates survive re-renders and in-session navigation.
const geocodeCache = new Map<string, AccountCoordinate | null>();

export type UseAccountCoordinatesResult = {
  coordinates: Record<string, AccountCoordinate>;
  isGeocoding: boolean;
  geocodedCount: number;
  missingAddressCount: number;
};

// STOPGAP on-device forward geocoding (expo-location). Production should geocode server-side and
// store lat/lng on the account — on-device geocoding is rate-limited and approximate. Addresses are
// geocoded sequentially and cached in-memory to respect OS rate limits.
export function useAccountCoordinates(accounts: ReadonlyArray<MappableAccount>): UseAccountCoordinatesResult {
  const [coordinates, setCoordinates] = useState<Record<string, AccountCoordinate>>({});
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const seeded: Record<string, AccountCoordinate> = {};
      for (const account of accounts) {
        const key = accountAddressKey(account);
        if (key && geocodeCache.has(key)) {
          const cached = geocodeCache.get(key);
          if (cached) seeded[account.id] = cached;
        }
      }
      if (!cancelled && Object.keys(seeded).length) {
        setCoordinates((prev) => ({ ...prev, ...seeded }));
      }

      const pending = accounts.filter((account) => {
        const key = accountAddressKey(account);
        return key !== null && !geocodeCache.has(key);
      });
      if (!pending.length) return;

      if (!cancelled) setIsGeocoding(true);
      for (const account of pending) {
        if (cancelled) break;
        const key = accountAddressKey(account);
        if (!key) continue;
        try {
          const results = await Location.geocodeAsync(key);
          const hit = results[0];
          const coord: AccountCoordinate | null = hit
            ? { latitude: hit.latitude, longitude: hit.longitude }
            : null;
          geocodeCache.set(key, coord);
          if (!cancelled && coord) {
            setCoordinates((prev) => ({ ...prev, [account.id]: coord }));
          }
        } catch {
          geocodeCache.set(key, null);
        }
      }
      if (!cancelled) setIsGeocoding(false);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  return {
    coordinates,
    isGeocoding,
    geocodedCount: Object.keys(coordinates).length,
    missingAddressCount: accounts.filter((a) => accountAddressKey(a) === null).length,
  };
}

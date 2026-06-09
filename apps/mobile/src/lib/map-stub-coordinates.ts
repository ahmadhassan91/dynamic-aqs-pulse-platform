// STUB COORDINATES — placeholder only.
// AccountSummary carries no lat/lng (see account-map-status.ts); until the backend exposes real
// account geo data, markers are placed at deterministic pseudo-locations spread across the
// continental US so the map UI can be built and demoed. Swap deriveStubCoordinate() for the real
// account coordinate the moment the backend provides it — nothing else in the map screen changes.

export type LngLat = [longitude: number, latitude: number];

const US_CENTER = { latitude: 39.5, longitude: -98.35 };
const LAT_SPREAD = 18; // ~continental US height in degrees
const LNG_SPREAD = 50; // ~continental US width in degrees

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Returns a stable [lng, lat] (GeoJSON order) for an account id, spread deterministically.
export function deriveStubCoordinate(accountId: string): LngLat {
  const hash = hashString(accountId);
  const latFraction = (hash % 1000) / 1000;
  const lngFraction = ((hash >> 10) % 1000) / 1000;
  const latitude = US_CENTER.latitude + (latFraction - 0.5) * LAT_SPREAD;
  const longitude = US_CENTER.longitude + (lngFraction - 0.5) * LNG_SPREAD;
  return [longitude, latitude];
}

export const US_CENTER_LNG_LAT: LngLat = [US_CENTER.longitude, US_CENTER.latitude];

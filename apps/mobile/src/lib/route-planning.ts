// Client-side route mileage + optimization (RTE-P3/P4). Pure — no native imports — so it is
// unit-testable under `node --test`. Uses the SAME distance formula and nearest-neighbour algorithm
// as the server (apps/api/src/modules/territories/service.ts calculateMiles / orderRouteStops), so an
// offline client route is a faithful straight-line approximation. The exact order/total can still
// differ from the server's provider-neutral plan — that plan starts from the shipping-center origin and
// pre-sorts by record priority, whereas client Optimize uses a centroid origin over the selected stops.
// Straight-line (haversine) only; real road distance / traffic is the parked provider concern (OQ-MOB-08).

export type RoutePoint = { latitude: number; longitude: number };

const EARTH_RADIUS_MILES = 3958.8;

function toRadians(value: number): number {
  return value * (Math.PI / 180);
}

// Great-circle distance in miles — same formula and earth radius as the server's calculateMiles.
export function haversineMiles(from: RoutePoint, to: RoutePoint): number {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function roundMiles(value: number): number {
  return Math.round(value * 10) / 10;
}

// Per-leg miles for an ordered list of stops; index 0 is null (no previous stop), and any leg
// touching a stop without coordinates (null) is also null. Callers pass null for an unlocated stop.
export function routeLegMiles(stops: (RoutePoint | null)[]): (number | null)[] {
  return stops.map((stop, index) => {
    const previous = stops[index - 1];
    if (index === 0 || !previous || !stop) return null;
    return haversineMiles(previous, stop);
  });
}

// Sum of the measurable legs (legs touching an unlocated stop contribute nothing).
export function routeTotalMiles(stops: (RoutePoint | null)[]): number {
  return routeLegMiles(stops).reduce((sum: number, leg) => sum + (leg ?? 0), 0);
}

function routeCentroid(stops: RoutePoint[]): RoutePoint {
  if (!stops.length) return { latitude: 0, longitude: 0 };
  let latitude = 0;
  let longitude = 0;
  for (const stop of stops) {
    latitude += stop.latitude;
    longitude += stop.longitude;
  }
  return { latitude: latitude / stops.length, longitude: longitude / stops.length };
}

// Nearest-neighbour ordering, mirroring the server's orderRouteStops: start from `origin` (or the
// centroid when no origin is given), then repeatedly take the closest remaining stop. Returns a new
// ordered array; ties resolve to the earlier input index, so the result is stable. Generic over any
// item carrying latitude/longitude (callers pass e.g. { id, latitude, longitude }).
export function optimizeRouteOrder<T extends RoutePoint>(stops: T[], origin?: RoutePoint): T[] {
  if (stops.length < 2) return [...stops];
  const remaining = [...stops];
  const ordered: T[] = [];
  let current: RoutePoint = origin ?? routeCentroid(remaining);
  while (remaining.length > 0) {
    let nextIndex = 0;
    let nextDistance = haversineMiles(current, remaining[0]!);
    for (let index = 1; index < remaining.length; index += 1) {
      const distance = haversineMiles(current, remaining[index]!);
      if (distance < nextDistance) {
        nextIndex = index;
        nextDistance = distance;
      }
    }
    const [next] = remaining.splice(nextIndex, 1);
    ordered.push(next!);
    current = next!;
  }
  return ordered;
}

// Flatten the server's nearest-neighbour route plans into an ordered, de-duplicated list of account
// IDs (recordType 'account'), preserving first-seen order. Used to seed the builder from the server's
// suggested order (RTE-P4 "consume the existing route plan").
export function suggestedAccountIdsFromRoutePlans(
  routePlans: { stops: { recordType: string; recordId: string }[] }[],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const plan of routePlans) {
    for (const stop of plan.stops) {
      if (stop.recordType !== 'account' || seen.has(stop.recordId)) continue;
      seen.add(stop.recordId);
      ids.push(stop.recordId);
    }
  }
  return ids;
}

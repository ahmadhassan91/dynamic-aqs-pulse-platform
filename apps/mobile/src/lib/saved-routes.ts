// Saved/named routes (RTE-P6) — pure data shape + list operations + safe parsing of persisted JSON.
// No native imports, so it is unit-testable under `node --test`. Persistence + the reactive store live
// in saved-routes-store.ts. A saved route stores only the PLAN (stop ids, dwell, start time), not an
// account-data snapshot — accounts are looked up live by id on load (RTE-K4 covers server sync/sharing).

export type SavedRoute = {
  id: string;
  name: string;
  stopIds: string[];
  dwellByStopId: Record<string, number>;
  startMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export function isSavedRoute(value: unknown): value is SavedRoute {
  if (!value || typeof value !== 'object') return false;
  const route = value as Record<string, unknown>;
  return (
    typeof route.id === 'string' &&
    typeof route.name === 'string' &&
    Array.isArray(route.stopIds) && route.stopIds.every((id) => typeof id === 'string') &&
    typeof route.dwellByStopId === 'object' && route.dwellByStopId !== null && !Array.isArray(route.dwellByStopId) &&
    Object.values(route.dwellByStopId as Record<string, unknown>).every((value) => typeof value === 'number' && Number.isFinite(value)) &&
    typeof route.startMinutes === 'number' && Number.isFinite(route.startMinutes) &&
    typeof route.createdAt === 'string' &&
    typeof route.updatedAt === 'string'
  );
}

// Parse the persisted JSON defensively: a non-array, malformed JSON, or a corrupt entry never throws —
// invalid entries are dropped so a bad write can't brick the saved-routes list.
export function parseSavedRoutes(json: string): SavedRoute[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isSavedRoute) : [];
  } catch {
    return [];
  }
}

export function upsertSavedRoute(list: SavedRoute[], route: SavedRoute): SavedRoute[] {
  const index = list.findIndex((existing) => existing.id === route.id);
  if (index === -1) return [...list, route];
  const next = [...list];
  next[index] = route;
  return next;
}

export function removeSavedRoute(list: SavedRoute[], id: string): SavedRoute[] {
  return list.filter((route) => route.id !== id);
}

// Bound the persisted payload: when over `limit`, drop the oldest-updated routes but keep the surviving
// routes in their original order. (Durable storage has a finite budget; an unbounded list risks a
// silently-failed write — see saved-routes-store.persist.)
export function capSavedRoutes(list: SavedRoute[], limit: number): SavedRoute[] {
  if (list.length <= limit) return list;
  const keep = new Set(
    [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit).map((route) => route.id),
  );
  return list.filter((route) => keep.has(route.id));
}

// Copy an existing route under a new id/name (timestamp supplied by the caller so this stays pure).
// Returns the list unchanged when the source id is not found.
export function duplicateSavedRoute(list: SavedRoute[], id: string, newId: string, newName: string, timestamp: string): SavedRoute[] {
  const source = list.find((route) => route.id === id);
  if (!source) return list;
  return [...list, { ...source, id: newId, name: newName, createdAt: timestamp, updatedAt: timestamp }];
}

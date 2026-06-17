import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  capSavedRoutes,
  duplicateSavedRoute,
  parseSavedRoutes,
  removeSavedRoute,
  upsertSavedRoute,
  type SavedRoute,
} from './saved-routes';

// Native side of saved routes (RTE-P6): a SecureStore-backed, useSyncExternalStore-reactive store —
// the same durable-storage + subscribe/snapshot pattern as mobile-draft-queue, kept separate so the
// pure data ops in saved-routes.ts stay native-import-free and testable. Local-first; server sync /
// sharing is parked (RTE-K4).

const SAVED_ROUTES_KEY = 'pulse.routes.saved';
const SAVED_ROUTES_LIMIT = 25;

const listeners = new Set<() => void>();
let routes: SavedRoute[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;

function emit() {
  for (const listener of listeners) listener();
}

// Returns whether the durable write succeeded so callers can report honest success vs. session-only.
async function persist(): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(SAVED_ROUTES_KEY, JSON.stringify(routes));
    return true;
  } catch {
    return false;
  }
}

export async function hydrateSavedRoutes() {
  try {
    const value = await SecureStore.getItemAsync(SAVED_ROUTES_KEY);
    routes = value ? parseSavedRoutes(value) : [];
  } catch {
    routes = [];
  }
  hydrated = true;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!hydrated && !hydrating) {
    hydrating = hydrateSavedRoutes().finally(() => {
      hydrating = null;
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SavedRoute[] {
  return routes;
}

export function useSavedRoutes(): SavedRoute[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function uniqueRouteId(): string {
  return `route-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

// Create (or replace, when an id is supplied) a saved route from the current builder plan. Input arrays
// are copied so the store never aliases live screen state. Returns whether the durable write succeeded.
export async function saveRoute(input: Omit<SavedRoute, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<{ route: SavedRoute; persisted: boolean }> {
  const now = new Date().toISOString();
  const existing = input.id ? routes.find((route) => route.id === input.id) : undefined;
  const route: SavedRoute = {
    id: input.id ?? uniqueRouteId(),
    name: input.name,
    stopIds: [...input.stopIds],
    dwellByStopId: { ...input.dwellByStopId },
    startMinutes: input.startMinutes,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  routes = capSavedRoutes(upsertSavedRoute(routes, route), SAVED_ROUTES_LIMIT);
  emit();
  const persisted = await persist();
  return { route, persisted };
}

export async function deleteRoute(id: string): Promise<boolean> {
  routes = removeSavedRoute(routes, id);
  emit();
  return persist();
}

export async function duplicateRoute(id: string, newName: string): Promise<boolean> {
  const now = new Date().toISOString();
  routes = capSavedRoutes(duplicateSavedRoute(routes, id, uniqueRouteId(), newName, now), SAVED_ROUTES_LIMIT);
  emit();
  return persist();
}

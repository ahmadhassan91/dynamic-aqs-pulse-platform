import { useSyncExternalStore } from 'react';
import { addStop, moveStop, removeStop, toggleStop } from './route-selection';

// Shared in-memory store for the in-progress route's ordered stop ids (RTE-P7). The Route tab and the
// Map tab both read/write it through useRouteSelection(), so "Add to route" on the map shows up on the
// builder. `null` = "not yet seeded" — the Route tab seeds an initial route once from oldest-touch.
// Working state only; durable named routes live in saved-routes-store and reset on app kill.

let selectedIds: string[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function getSnapshot(): string[] | null {
  return selectedIds;
}

export function useRouteSelection(): string[] | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Replace the whole selection — used by seed, prune, optimize, load-suggested, and load-saved.
export function setRouteSelection(ids: string[] | null) {
  if (ids === selectedIds) return; // no-op replace → no churn
  selectedIds = ids;
  emit();
}

export function addRouteStop(id: string) {
  const current = selectedIds ?? [];
  const next = addStop(current, id);
  if (next === current && selectedIds !== null) return; // duplicate on an existing list → no change
  selectedIds = next;
  emit();
}

export function removeRouteStop(id: string) {
  const current = selectedIds ?? [];
  const next = removeStop(current, id);
  if (next.length === current.length && selectedIds !== null) return;
  selectedIds = next;
  emit();
}

export function toggleRouteStop(id: string) {
  selectedIds = toggleStop(selectedIds ?? [], id);
  emit();
}

export function moveRouteStop(index: number, direction: -1 | 1) {
  const current = selectedIds ?? [];
  const next = moveStop(current, index, direction);
  if (next === current) return; // out-of-bounds no-op
  selectedIds = next;
  emit();
}

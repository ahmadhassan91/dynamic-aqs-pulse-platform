// Pure operations on the in-progress route's ordered stop-id list (RTE-P7). No native imports, so it is
// unit-testable under `node --test`. The shared reactive store (route-selection-store.ts) applies these
// to module state; route.tsx and map.tsx both drive the same selection through that store, which is what
// lets "Add to route" on the map appear on the Route tab.

// Append an id if not already present (no duplicates); otherwise return the list unchanged.
export function addStop(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

export function removeStop(list: string[], id: string): string[] {
  return list.filter((value) => value !== id);
}

// Add the id if absent, remove it if present — the map's "Add to route" / "Remove from route" toggle.
export function toggleStop(list: string[], id: string): string[] {
  return list.includes(id) ? removeStop(list, id) : addStop(list, id);
}

// Swap the stop at `index` with its neighbour in `direction` (-1 up, +1 down). Out-of-bounds is a no-op
// (returns the same reference), so callers can rely on identity to detect "nothing moved".
export function moveStop(list: string[], index: number, direction: -1 | 1): string[] {
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

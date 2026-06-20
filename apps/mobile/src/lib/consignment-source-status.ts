// FR-MOB-011 (UX-M-003): before a ROSE count, distinguish a PARKED expected-count source (the office
// source is intentionally not connected, so expected quantities are placeholders) from a STALE one (a
// real Acumatica source exists but its data is old). Pure (no native imports) so it is unit-testable;
// the screen renders the returned label/tone/guidance. `now` is injected so the stale threshold is testable.
//
// NOTE: until Acumatica is connected, acumaticaStatus is effectively always 'parked'/seeded, so the
// 'stale' path can't be exercised with real data yet — a durable freshness signal (an enum on the
// contract) is a follow-up gated on the Acumatica integration. The threshold here is an assumption.

export type ConsignmentSourceState = 'parked' | 'stale' | 'fresh' | 'manual' | 'unknown';

export const CONSIGNMENT_SOURCE_STALE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h

export const CONSIGNMENT_SOURCE_STATE_META: Record<ConsignmentSourceState, { label: string; tone: string; guidance: string }> = {
  parked: { label: 'Source parked', tone: 'review', guidance: 'Office source is parked — expected quantities are placeholders. Count fresh and trust your physical count.' },
  stale: { label: 'Source stale', tone: 'warning', guidance: 'Expected counts may be out of date — verify them before you trust the numbers.' },
  fresh: { label: 'Source live', tone: 'active', guidance: 'Expected counts came from a recent office sync.' },
  manual: { label: 'Manual source', tone: 'review', guidance: 'Expected counts were entered or imported manually — verify against the physical count.' },
  unknown: { label: 'Source unconfirmed', tone: 'review', guidance: 'Verify the expected counts manually before you start counting.' },
};

export function deriveConsignmentSourceState(input: {
  acumaticaStatus?: string | null | undefined;
  acumaticaLastSyncedAt?: string | null | undefined;
  sourceFreshnessLabel?: string | null | undefined;
  expectedSource?: string | null | undefined;
  now: Date;
  staleAfterMs?: number | undefined;
}): ConsignmentSourceState {
  const { acumaticaStatus, acumaticaLastSyncedAt, sourceFreshnessLabel, expectedSource, now } = input;
  const staleAfterMs = input.staleAfterMs ?? CONSIGNMENT_SOURCE_STALE_AFTER_MS;
  const freshness = (sourceFreshnessLabel ?? '').toLowerCase();

  if (acumaticaStatus === 'parked' || acumaticaStatus === 'not_required' || freshness.includes('parked')) {
    return 'parked';
  }
  if (acumaticaStatus === 'available') {
    if (acumaticaLastSyncedAt) {
      const syncedMs = new Date(acumaticaLastSyncedAt).getTime();
      if (Number.isNaN(syncedMs)) return 'stale'; // unparseable timestamp -> conservative: verify before trusting
      const age = now.getTime() - syncedMs;
      return age > staleAfterMs ? 'stale' : 'fresh';
    }
    return 'stale'; // connected but never synced -> treat as stale (verify before trusting)
  }
  const source = (expectedSource ?? '').toLowerCase();
  if (source.includes('manual') || source.includes('import') || source.includes('seed')) {
    return 'manual';
  }
  return 'unknown';
}

export function deriveConsignmentSourceMeta(input: Parameters<typeof deriveConsignmentSourceState>[0]) {
  return CONSIGNMENT_SOURCE_STATE_META[deriveConsignmentSourceState(input)];
}

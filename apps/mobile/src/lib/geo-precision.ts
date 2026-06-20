import type { TerritoryMapGeoPrecisionKey } from '@pulse/contracts/territories';

// FR-MOB-028 — map pins are geocoded only to city/state today (street-level geocoding is parked), so
// the app must say so and not pretend a centroid is a street address. Pure (no native imports) so the
// precision classification + navigation gate are unit-testable. Final pin colours and real street-level
// geocoding remain blocked on the geocoding provider decision.

export interface GeoPrecisionInfo {
  label: string;
  tone: string;
  isApproximate: boolean;
  canNavigate: boolean;
  guidance: string;
}

const META: Record<TerritoryMapGeoPrecisionKey, GeoPrecisionInfo> = {
  city_state: {
    label: 'City-level pin',
    tone: 'review',
    isApproximate: true,
    canNavigate: true,
    guidance: 'Placed at the city/state centre, not the street address. Confirm the address before driving.',
  },
  state_fallback: {
    label: 'State-level pin',
    tone: 'warning',
    isApproximate: true,
    canNavigate: false,
    guidance: 'Only the state is known — this pin is the state centroid, too coarse to navigate to. Verify the address first.',
  },
};

// Unknown precision (e.g. an account with coordinates but no matching workspace pin) is treated as
// approximate-but-navigable so existing navigation does not regress.
const UNKNOWN: GeoPrecisionInfo = {
  label: 'Approximate pin',
  tone: 'review',
  isApproximate: true,
  canNavigate: true,
  guidance: 'Approximate position — confirm the address before driving.',
};

export function describeGeoPrecision(precision: TerritoryMapGeoPrecisionKey | null | undefined): GeoPrecisionInfo {
  if (!precision) return UNKNOWN;
  return META[precision] ?? UNKNOWN;
}

// A state-centroid pin is too coarse to route to usefully; city-level (and unknown-but-coordinated)
// pins are navigable, with the approximate-location warning shown alongside.
export function canNavigateWithPrecision(precision: TerritoryMapGeoPrecisionKey | null | undefined): boolean {
  return describeGeoPrecision(precision).canNavigate;
}

// External turn-by-turn handoff (FR-MOB-034 / RTE-P1). Pure URL formatting only — no native imports —
// so it is unit-testable under `node --test`. The native launch (Linking + persisted last provider)
// lives in nav-launch.ts. Lat/lng based for reliability: no geocoding needed, and overdue street-level
// accuracy is a separate parked concern. No API key, no billing — these are the free OS URL schemes.

export type NavProvider = 'apple' | 'google' | 'waze';

export type NavTarget = { latitude: number; longitude: number; label?: string };

// Display order in the action sheet (a last-used provider is floated to the top by the sheet).
export const NAV_PROVIDERS: { id: NavProvider; label: string; icon: string; fallback: string }[] = [
  { id: 'apple', label: 'Apple Maps', icon: 'map.fill', fallback: 'Maps' },
  { id: 'google', label: 'Google Maps', icon: 'map.fill', fallback: 'GMaps' },
  { id: 'waze', label: 'Waze', icon: 'car.fill', fallback: 'Waze' },
];

export function isNavProvider(value: string | null | undefined): value is NavProvider {
  return value === 'apple' || value === 'google' || value === 'waze';
}

export function isValidTarget(
  target: { latitude?: number | null; longitude?: number | null } | null | undefined,
): target is NavTarget {
  if (!target) return false;
  return (
    typeof target.latitude === 'number' && Number.isFinite(target.latitude) &&
    typeof target.longitude === 'number' && Number.isFinite(target.longitude)
  );
}

function coord(target: NavTarget): string {
  return `${target.latitude},${target.longitude}`;
}

// The native-app deep link plus an https web fallback for a single destination. driving mode is
// requested where the scheme supports it.
export function buildNavUrls(provider: NavProvider, target: NavTarget): { appUrl: string; webUrl: string } {
  const ll = coord(target);
  switch (provider) {
    case 'waze':
      return { appUrl: `waze://?ll=${ll}&navigate=yes`, webUrl: `https://waze.com/ul?ll=${ll}&navigate=yes` };
    case 'google':
      return {
        appUrl: `comgooglemaps://?daddr=${ll}&directionsmode=driving`,
        webUrl: `https://www.google.com/maps/dir/?api=1&destination=${ll}&travelmode=driving`,
      };
    case 'apple':
    default:
      // Apple's docs nominally use `ll`, but `daddr=<lat,lng>` is the directions parameter and is what
      // routes to turn-by-turn (dirflg=d = drive); the raw comma is a legal query sub-delim.
      return { appUrl: `maps://?daddr=${ll}&dirflg=d`, webUrl: `https://maps.apple.com/?daddr=${ll}&dirflg=d` };
  }
}

// Whole-route driving directions on Google (origin = device location, omitted). The last stop is the
// destination; intermediate stops are waypoints. Returns null for fewer than 2 valid stops. Web URL
// only — this is the route-level "open the whole route" action (RTE-P4 surfaces it).
export function buildMultiStopGoogleUrl(stops: NavTarget[]): string | null {
  const valid = stops.filter(isValidTarget);
  if (valid.length < 2) return null;
  // Google requires the waypoints '|' separator percent-encoded as %7C (and a raw '|' makes iOS
  // URL(string:) return nil, silently dropping the launch). Encode each coordinate so commas → %2C too.
  const destination = encodeURIComponent(coord(valid[valid.length - 1]!));
  const waypoints = valid.slice(0, -1).map((stop) => encodeURIComponent(coord(stop))).join('%7C');
  const base = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
  return waypoints ? `${base}&waypoints=${waypoints}` : base;
}

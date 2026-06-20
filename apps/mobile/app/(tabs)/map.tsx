import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import type { AccountSummary } from '@pulse/contracts/accounts';
import type { TerritoryMapCoverageEntrySummary, TerritoryMapGeoPrecisionKey } from '@pulse/contracts/territories';
import {
  ACCOUNT_MAP_STATUS_META,
  ACCOUNT_MAP_STATUS_ORDER,
  buildConsignmentSignalMap,
  deriveAccountMapStatus,
  type AccountMapStatus,
} from '@/lib/account-map-status';
import { NavigateSheet } from '@/components/navigate-sheet';
import { MarkerActionSheet } from '@/components/marker-action-sheet';
import type { NavTarget } from '@/lib/external-nav';
import { canNavigateWithPrecision, describeGeoPrecision } from '@/lib/geo-precision';
import { toggleRouteStop, useRouteSelection } from '@/lib/route-selection-store';
import { US_CENTER_LNG_LAT, deriveStubCoordinate, type LngLat } from '@/lib/map-stub-coordinates';
import { buildTerritoryStateCollection, summarizeMyTerritory } from '@/lib/territory-coverage';
import { fetchTerritoryMapWorkspace } from '@/lib/api';
import { useFieldData } from '@/hooks/use-mobile-data';
import { useSession } from '@/providers/session-provider';
import { useTheme } from '@/providers/theme-provider';
import { radius, spacing, typography } from '@/theme';

// CARTO Voyager GL — free, no API key, and the same basemap family the web territory map uses,
// so field reps see one consistent map across Pulse. (Alternatives: OpenFreeMap Liberty, MapTiler.)
const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

// Bundled US state boundaries (same asset the web territory map serves from /maps/us-states.geojson).
const US_STATES = require('@/assets/us-states.json') as {
  features: Array<{ type: 'Feature'; properties: Record<string, unknown> | null; geometry: unknown }>;
};

export default function MapScreen() {
  const { palette: colors, softShadow } = useTheme();
  const { apiBaseUrl, auth } = useSession();
  const { accounts, consignmentSites, errorMessage, isLoading } = useFieldData(200);
  const [active, setActive] = useState<Set<AccountMapStatus>>(() => new Set(ACCOUNT_MAP_STATUS_ORDER));
  const [coverageEntries, setCoverageEntries] = useState<TerritoryMapCoverageEntrySummary[]>([]);
  const [navTarget, setNavTarget] = useState<NavTarget | null>(null);
  const [markerActionAccount, setMarkerActionAccount] = useState<AccountSummary | null>(null);
  // FR-MOB-028 — per-account geocode precision from the territory workspace pins, keyed by account id.
  // (Record, not Map: the MapLibre `Map` import shadows the global Map constructor in this file.)
  const [precisionByAccount, setPrecisionByAccount] = useState<Record<string, TerritoryMapGeoPrecisionKey>>(() => ({}));
  const routeSelection = useRouteSelection();
  const routeSet = useMemo(() => new Set(routeSelection ?? []), [routeSelection]);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    fetchTerritoryMapWorkspace(apiBaseUrl, auth.tokens.accessToken)
      .then((workspace) => {
        if (cancelled) return;
        setCoverageEntries(workspace.coverageEntries);
        const precision: Record<string, TerritoryMapGeoPrecisionKey> = {};
        for (const pin of workspace.accountPins) precision[pin.recordId] = pin.geoPrecision;
        setPrecisionByAccount(precision);
      })
      .catch(() => {
        // Boundaries are an overlay; the map stays usable without them.
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  const myUserId = auth?.identity.userId;
  const stateCollection = useMemo(
    () => buildTerritoryStateCollection(US_STATES.features, coverageEntries, myUserId),
    [coverageEntries, myUserId],
  );
  const myTerritory = useMemo(() => summarizeMyTerritory(coverageEntries, myUserId), [coverageEntries, myUserId]);

  // Join the already-fetched consignment sites onto accounts so the marker colour can reflect
  // consignment / consignment-overdue without a second API call. (account.consignment carries no
  // overdue count, so the overdue signal must come from the per-site data.)
  const consignmentSignals = useMemo(() => buildConsignmentSignalMap(consignmentSites, new Date()), [consignmentSites]);

  const markers = useMemo(
    () =>
      accounts
        .map((account) => ({
          account,
          status: deriveAccountMapStatus(account, consignmentSignals.get(account.id)),
          coordinate:
            typeof account.longitude === 'number' && typeof account.latitude === 'number'
              ? ([account.longitude, account.latitude] as LngLat)
              : deriveStubCoordinate(account.id),
        }))
        .filter((marker) => active.has(marker.status)),
    [accounts, active, consignmentSignals],
  );

  function toggle(status: AccountMapStatus) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Map style={{ flex: 1 }} mapStyle={MAP_STYLE_URL}>
        <Camera initialViewState={{ center: US_CENTER_LNG_LAT, zoom: 3 }} />
        {coverageEntries.length > 0 ? (
          <GeoJSONSource id="territory-states" data={stateCollection as GeoJSON.GeoJSON}>
            <Layer
              id="territory-state-fill"
              type="fill"
              paint={{
                'fill-color': ['get', 'territoryColor'],
                // My territory pops; other covered territories stay visible context; gaps stay faint.
                'fill-opacity': [
                  'case',
                  ['boolean', ['get', 'isMine'], false],
                  0.45,
                  ['case', ['boolean', ['get', 'covered'], false], 0.18, 0.04],
                ],
              }}
            />
            <Layer
              id="territory-state-border"
              type="line"
              paint={{
                'line-color': 'rgba(255,255,255,0.85)',
                'line-width': ['case', ['boolean', ['get', 'isMine'], false], 2, 1],
              }}
            />
          </GeoJSONSource>
        ) : null}
        {markers.map(({ account, status, coordinate }) => {
          // FR-MOB-028 — navigate only to a real, precise-enough location. The marker may sit on a
          // deriveStubCoordinate (no coords), and a state-centroid pin is too coarse to route to.
          const precision = precisionByAccount[account.id];
          const precisionInfo = describeGeoPrecision(precision);
          const stopNavTarget: NavTarget | null =
            typeof account.latitude === 'number' && typeof account.longitude === 'number' && canNavigateWithPrecision(precision)
              ? { latitude: account.latitude, longitude: account.longitude, label: account.displayName }
              : null;
          const inRoute = routeSet.has(account.id);
          return (
          <Marker key={account.id} lngLat={coordinate}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${account.displayName} — ${ACCOUNT_MAP_STATUS_META[status].label} — ${precisionInfo.label}${inRoute ? ' — on route' : ''}`}
              accessibilityHint="Opens account. Long press for route and navigation actions."
              accessibilityActions={[
                { name: 'toggleRoute', label: inRoute ? 'Remove from route' : 'Add to route' },
                ...(stopNavTarget ? [{ name: 'navigate', label: 'Navigate here' }] : []),
              ]}
              onAccessibilityAction={(event) => {
                const action = event.nativeEvent.actionName;
                if (action === 'toggleRoute') toggleRouteStop(account.id);
                else if (action === 'navigate' && stopNavTarget) setNavTarget(stopNavTarget);
              }}
              onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
              onLongPress={() => setMarkerActionAccount(account)}
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.full,
                backgroundColor: ACCOUNT_MAP_STATUS_META[status].color,
                borderWidth: inRoute ? 3 : 2,
                borderColor: inRoute ? colors.primaryDeep : '#FFFFFF',
                ...softShadow,
              }}
            />
          </Marker>
          );
        })}
      </Map>

      <View style={{ position: 'absolute', top: spacing.md, left: spacing.md, right: spacing.md }}>
        <View
          style={{
            backgroundColor: colors.warningSoft,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: '#FACC15',
            padding: spacing.sm,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.text }}>
            Approximate positions — accounts are placed by their city/state, so navigation routes to that
            area, not the street address. State-only pins are too coarse to navigate. Colors, filters, and
            ownership are live.
          </Text>
        </View>
        {errorMessage ? (
          <Text style={{ ...typography.caption, color: colors.danger, marginTop: spacing.xs }}>{errorMessage}</Text>
        ) : null}
      </View>

      <View
        style={{
          position: 'absolute',
          bottom: spacing.xl,
          left: spacing.md,
          right: spacing.md,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          gap: spacing.sm,
          borderCurve: 'continuous',
          ...softShadow,
        }}
      >
        {myTerritory ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 12, height: 12, borderRadius: radius.full, backgroundColor: myTerritory.color, borderWidth: 2, borderColor: '#FFFFFF', ...softShadow }} />
            <Text style={{ ...typography.caption, color: colors.text }} numberOfLines={1}>
              My territory: {myTerritory.territoryNames.join(', ')} · {myTerritory.stateCodes.length} state{myTerritory.stateCodes.length === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
        <Text style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
          {isLoading ? 'Loading accounts...' : `${markers.length} shown${routeSelection && routeSelection.length ? ` · ${routeSelection.length} on route` : ''} · tap a status to filter`}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {ACCOUNT_MAP_STATUS_ORDER.map((status) => {
            const on = active.has(status);
            const meta = ACCOUNT_MAP_STATUS_META[status];
            return (
              <Pressable
                key={status}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${meta.label} filter ${on ? 'on' : 'off'}`}
                onPress={() => toggle(status)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 32,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: radius.full,
                  borderWidth: 1,
                  borderColor: on ? meta.color : colors.border,
                  backgroundColor: on ? `${meta.color}22` : colors.surface,
                  opacity: on ? 1 : 0.55,
                }}
              >
                <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: meta.color }} />
                <Text style={{ ...typography.caption, color: colors.text }}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <MarkerActionSheet
        account={markerActionAccount}
        inRoute={markerActionAccount ? routeSet.has(markerActionAccount.id) : false}
        canNavigate={
          typeof markerActionAccount?.latitude === 'number' &&
          typeof markerActionAccount?.longitude === 'number' &&
          canNavigateWithPrecision(markerActionAccount ? precisionByAccount[markerActionAccount.id] : undefined)
        }
        onOpen={() => {
          if (markerActionAccount) router.push({ pathname: '/account/[id]', params: { id: markerActionAccount.id } });
          setMarkerActionAccount(null);
        }}
        onToggleRoute={() => {
          if (markerActionAccount) toggleRouteStop(markerActionAccount.id);
          setMarkerActionAccount(null);
        }}
        onNavigate={() => {
          if (
            typeof markerActionAccount?.latitude === 'number' &&
            typeof markerActionAccount?.longitude === 'number' &&
            canNavigateWithPrecision(precisionByAccount[markerActionAccount.id])
          ) {
            setNavTarget({ latitude: markerActionAccount.latitude, longitude: markerActionAccount.longitude, label: markerActionAccount.displayName });
          }
          setMarkerActionAccount(null);
        }}
        onClose={() => setMarkerActionAccount(null)}
      />
      <NavigateSheet target={navTarget} onClose={() => setNavTarget(null)} />
    </View>
  );
}

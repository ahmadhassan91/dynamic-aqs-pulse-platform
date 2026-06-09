import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import {
  ACCOUNT_MAP_STATUS_META,
  ACCOUNT_MAP_STATUS_ORDER,
  deriveAccountMapStatus,
  type AccountMapStatus,
} from '@/lib/account-map-status';
import { US_CENTER_LNG_LAT, deriveStubCoordinate } from '@/lib/map-stub-coordinates';
import { useFieldData } from '@/hooks/use-mobile-data';
import { colors, radius, softShadow, spacing, typography } from '@/theme';

// Free, no-key demo tiles for the scaffold. Production: MapTiler/own tiles (style URL + key).
const MAP_STYLE_URL = 'https://demotiles.maplibre.org/style.json';

export default function MapScreen() {
  const { accounts, errorMessage, isLoading } = useFieldData(200);
  const [active, setActive] = useState<Set<AccountMapStatus>>(() => new Set(ACCOUNT_MAP_STATUS_ORDER));

  const markers = useMemo(
    () =>
      accounts
        .map((account) => ({
          account,
          status: deriveAccountMapStatus(account),
          coordinate: deriveStubCoordinate(account.id),
        }))
        .filter((marker) => active.has(marker.status)),
    [accounts, active],
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
        {markers.map(({ account, status, coordinate }) => (
          <Marker key={account.id} lngLat={coordinate}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${account.displayName} — ${ACCOUNT_MAP_STATUS_META[status].label}`}
              onPress={() => router.push({ pathname: '/account/[id]', params: { id: account.id } })}
              style={{
                width: 20,
                height: 20,
                borderRadius: radius.full,
                backgroundColor: ACCOUNT_MAP_STATUS_META[status].color,
                borderWidth: 2,
                borderColor: '#FFFFFF',
                ...softShadow,
              }}
            />
          </Marker>
        ))}
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
            Demo positions — accounts are shown at placeholder locations until the backend provides
            account geo data. Colors and filters are real.
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
        <Text style={{ ...typography.caption, color: colors.muted, textTransform: 'uppercase' }}>
          {isLoading ? 'Loading accounts...' : `${markers.length} shown · tap a status to filter`}
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
    </View>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Group, Paper, Stack, Text } from '@mantine/core';
import { IconBuildingWarehouse, IconMapPin, IconUsers } from '@tabler/icons-react';
import type {
  TerritoryMapCoverageEntrySummary,
  TerritoryMapPinSummary,
  TerritoryMapShippingCenterSummary,
} from '@pulse/contracts';

type MapLibreModule = typeof import('maplibre-gl');
type MapInstance = import('maplibre-gl').Map;
type PopupInstance = import('maplibre-gl').Popup;
type MarkerInstance = import('maplibre-gl').Marker;
type GeoJSONSourceInstance = import('maplibre-gl').GeoJSONSource;

const TERRITORY_COLORS = [
  '#2563eb',
  '#9333ea',
  '#f97316',
  '#16a34a',
  '#e11d48',
  '#0f766e',
  '#b45309',
  '#0891b2',
  '#7c3aed',
  '#65a30d',
] as const;

function getTerritoryColor(index: number) {
  return TERRITORY_COLORS[index % TERRITORY_COLORS.length] ?? '#2563eb';
}

type TerritoryMapLibreProps = {
  coverageEntries: TerritoryMapCoverageEntrySummary[];
  pins: TerritoryMapPinSummary[];
  shippingCenters: TerritoryMapShippingCenterSummary[];
  showBoundaries?: boolean;
  showPins?: boolean;
  onPinClick?: (pin: TerritoryMapPinSummary) => void;
};

type HoveredStateSummary = {
  stateName: string;
  territoryName: string;
  assignedTmName?: string;
  assignedRdName?: string;
  shippingCenterName?: string;
};

type GeoJsonFeature = GeoJSON.Feature<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;
type GeoJsonFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, GeoJSON.GeoJsonProperties>;

function stateNameToAbbr(name: string) {
  const map: Record<string, string> = {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    'District of Columbia': 'DC',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY',
  };

  return map[name] ?? name.toUpperCase().slice(0, 2);
}

function formatRecordType(pin: TerritoryMapPinSummary) {
  return pin.recordType === 'account' ? 'Account' : 'Lead';
}

function formatPinStatus(pin: TerritoryMapPinSummary) {
  if (pin.recordType === 'account') {
    return pin.status === 'active' ? 'Active account' : 'Inactive account';
  }

  if (!pin.territoryId) {
    return 'Needs assignment';
  }

  return pin.stage ? pin.stage.replace(/_/g, ' ') : 'Pipeline lead';
}

function getPointCoordinates(geometry: GeoJSON.Geometry | null | undefined) {
  if (!geometry || geometry.type !== 'Point') {
    return null;
  }

  const [longitude, latitude] = geometry.coordinates;
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return null;
  }

  return [longitude, latitude] as [number, number];
}

function buildPopupMarkup(pin: TerritoryMapPinSummary) {
  const statusColor =
    pin.recordType === 'account'
      ? pin.status === 'active'
        ? '#16a34a'
        : '#6b7280'
      : !pin.territoryId
        ? '#f97316'
        : '#2563eb';

  const statusLabel = formatPinStatus(pin);
  const locationLabel = [pin.city, pin.state].filter(Boolean).join(', ') || pin.state || 'State unavailable';

  return `
    <div style="
      font-family: Inter, system-ui, sans-serif;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      min-width: 240px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:${statusColor};box-shadow:0 0 4px ${statusColor}88;flex-shrink:0;"></div>
        <span style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.3;">${pin.label}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <span style="
          display:inline-block;
          padding:2px 10px;
          background:${statusColor}15;
          color:${statusColor};
          border:1px solid ${statusColor}35;
          border-radius:20px;
          font-size:10px;
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:0.5px;
        ">${statusLabel}</span>
        <span style="display:inline-block;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:20px;font-size:10px;font-weight:600;">
          ${formatRecordType(pin)}
        </span>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Location: <span style="color:#1e293b;">${locationLabel}</span></div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Territory: <span style="color:#1e293b;">${pin.territoryName ?? 'Unassigned'}</span></div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">TM: <span style="color:#1e293b;">${pin.assignedTmName ?? 'Unassigned'}</span></div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">RD: <span style="color:#1e293b;">${pin.assignedRdName ?? 'Unassigned'}</span></div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Shipping: <span style="color:#1e293b;">${pin.shippingCenterName ?? 'Unassigned'}</span></div>
      ${
        pin.recordType === 'lead' && pin.stage
          ? `<div style="font-size:11px;color:#64748b;margin-bottom:2px;">Stage: <span style="color:#1e293b;">${pin.stage.replace(/_/g, ' ')}</span></div>`
          : ''
      }
      ${
        pin.recordType === 'account' && pin.accountType
          ? `<div style="font-size:11px;color:#64748b;margin-bottom:2px;">Account type: <span style="color:#1e293b;">${pin.accountType}</span></div>`
          : ''
      }
      <div style="font-size:11px;color:#64748b;">Geo source: <span style="color:#1e293b;">${pin.geoPrecision.replace(/_/g, ' ')}</span></div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0;">
        <span style="font-size:11px;color:#94a3b8;">Click to open record →</span>
      </div>
    </div>
  `;
}

function buildShippingPopupMarkup(center: TerritoryMapShippingCenterSummary) {
  const locationLabel = [center.city, center.state].filter(Boolean).join(', ') || center.countryCode;
  return `
    <div style="
      font-family: Inter, system-ui, sans-serif;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      min-width: 220px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:26px;height:26px;border-radius:999px;background:#f59e0b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;">★</div>
        <span style="font-size:13px;font-weight:700;color:#1e293b;line-height:1.3;">${center.name}</span>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">${locationLabel}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Territories served: <span style="color:#1e293b;">${center.servicedTerritoryCount}</span></div>
      <div style="font-size:11px;color:#64748b;margin-bottom:2px;">Active leads: <span style="color:#1e293b;">${center.activeLeadCount}</span></div>
      <div style="font-size:11px;color:#64748b;">Active accounts: <span style="color:#1e293b;">${center.activeAccountCount}</span></div>
    </div>
  `;
}

export function TerritoryMapLibre({
  coverageEntries,
  pins,
  shippingCenters,
  showBoundaries = true,
  showPins = true,
  onPinClick,
}: TerritoryMapLibreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const popupRef = useRef<PopupInstance | null>(null);
  const markerRefs = useRef<MarkerInstance[]>([]);
  const geoJsonRef = useRef<{ features: GeoJsonFeature[] } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [hoveredState, setHoveredState] = useState<HoveredStateSummary | null>(null);

  const coverageByState = useMemo(() => {
    const paletteByTerritory = new Map<string, string>();
    const stateMap = new Map<
      string,
      TerritoryMapCoverageEntrySummary & {
        color: string;
      }
    >();

    coverageEntries.forEach((entry, index) => {
      if (!paletteByTerritory.has(entry.territoryId)) {
        paletteByTerritory.set(entry.territoryId, getTerritoryColor(index));
      }

      const color = paletteByTerritory.get(entry.territoryId) ?? getTerritoryColor(index);
      stateMap.set(`${entry.countryCode}:${entry.stateCode}`, {
        ...entry,
        color,
      });
    });

    return stateMap;
  }, [coverageEntries]);

  const pinsRef = useRef(pins);
  const shippingCentersRef = useRef(shippingCenters);
  const coverageByStateRef = useRef(coverageByState);
  const onPinClickRef = useRef(onPinClick);
  const showBoundariesRef = useRef(showBoundaries);
  const showPinsRef = useRef(showPins);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    shippingCentersRef.current = shippingCenters;
  }, [shippingCenters]);

  useEffect(() => {
    coverageByStateRef.current = coverageByState;
  }, [coverageByState]);

  useEffect(() => {
    onPinClickRef.current = onPinClick;
  }, [onPinClick]);

  useEffect(() => {
    showBoundariesRef.current = showBoundaries;
  }, [showBoundaries]);

  useEffect(() => {
    showPinsRef.current = showPins;
  }, [showPins]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    let cancelled = false;
    let map: MapInstance | null = null;

    async function initMap() {
      try {
        const maplibre = (await import('maplibre-gl')) as MapLibreModule;
        maplibreRef.current = maplibre;
        if (cancelled || !containerRef.current) {
          return;
        }

        map = new maplibre.Map({
          container: containerRef.current,
          style: {
            version: 8,
            sources: {
              carto: {
                type: 'raster',
                tiles: [
                  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                  'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                  'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
                ],
                tileSize: 256,
                attribution: '© CARTO · OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'carto-tiles',
                type: 'raster',
                source: 'carto',
                paint: {
                  'raster-opacity': 1,
                },
              },
            ],
          },
          center: [-96, 39],
          zoom: 3.45,
          minZoom: 2.5,
          maxZoom: 10,
        });

        map.addControl(new maplibre.NavigationControl(), 'top-left');
        mapRef.current = map;

        map.on('load', async () => {
          const response = await fetch('/maps/us-states.geojson');
          const geoJson = (await response.json()) as { features: GeoJsonFeature[] };
          if (cancelled || !map) {
            return;
          }

          geoJsonRef.current = geoJson;
          map.addSource('territory-states', {
            type: 'geojson',
            data: buildStateGeoJson(geoJson.features, coverageByStateRef.current),
          });

          map.addLayer({
            id: 'territory-state-fill',
            type: 'fill',
            source: 'territory-states',
            paint: {
              'fill-color': ['get', 'territoryColor'],
              'fill-opacity': 0.52,
            },
            layout: {
              visibility: showBoundariesRef.current ? 'visible' : 'none',
            },
          });

          map.addLayer({
            id: 'territory-state-border',
            type: 'line',
            source: 'territory-states',
            paint: {
              'line-color': 'rgba(255,255,255,0.72)',
              'line-width': 1,
            },
            layout: {
              visibility: showBoundariesRef.current ? 'visible' : 'none',
            },
          });

          map.addSource('territory-pins', {
            type: 'geojson',
            data: buildPinsGeoJson(pinsRef.current),
            cluster: true,
            clusterRadius: 42,
            clusterMaxZoom: 6,
          });

          map.addLayer({
            id: 'territory-pin-clusters',
            type: 'circle',
            source: 'territory-pins',
            filter: ['has', 'point_count'],
            paint: {
              'circle-radius': ['step', ['get', 'point_count'], 18, 8, 22, 20, 28],
              'circle-color': ['step', ['get', 'point_count'], '#dbeafe', 8, '#93c5fd', 20, '#2563eb'],
              'circle-stroke-width': 3,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.94,
            },
            layout: {
              visibility: showPinsRef.current ? 'visible' : 'none',
            },
          });

          map.addLayer({
            id: 'territory-pin-cluster-count',
            type: 'symbol',
            source: 'territory-pins',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['get', 'point_count_abbreviated'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12,
            },
            paint: {
              'text-color': '#0f172a',
            },
          });

          map.addLayer({
            id: 'territory-pin-points',
            type: 'circle',
            source: 'territory-pins',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': [
                'case',
                ['==', ['get', 'recordType'], 'account'],
                9,
                ['!', ['has', 'territoryId']],
                10,
                7,
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'recordType'], 'account'],
                '#16a34a',
                ['==', ['get', 'status'], 'inactive'],
                '#6b7280',
                ['!', ['has', 'territoryId']],
                '#f97316',
                '#2563eb',
              ],
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.95,
            },
            layout: {
              visibility: showPinsRef.current ? 'visible' : 'none',
            },
          });

          const popup = new maplibre.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 10,
          });
          popupRef.current = popup;

          map.on('mouseenter', 'territory-pin-points', (event) => {
            map?.getCanvas().style.setProperty('cursor', 'pointer');
            const feature = event.features?.[0];
            if (!feature) {
              return;
            }

            const pinId = String(feature.properties?.id ?? '');
            const pin = pinsRef.current.find((entry) => entry.id === pinId);
            if (!pin) {
              return;
            }

            const geometryCoordinates = getPointCoordinates(feature.geometry);
            if (!geometryCoordinates) {
              return;
            }
            const coordinates = [...geometryCoordinates] as [number, number];
            while (Math.abs(event.lngLat.lng - coordinates[0]) > 180) {
              coordinates[0] += event.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            popup.setLngLat(coordinates).setHTML(buildPopupMarkup(pin)).addTo(map!);
          });

          map.on('mouseleave', 'territory-pin-points', () => {
            map?.getCanvas().style.setProperty('cursor', '');
            popupRef.current?.remove();
          });

          map.on('click', 'territory-pin-points', (event) => {
            const feature = event.features?.[0];
            if (!feature || !onPinClickRef.current) {
              return;
            }
            const pinId = String(feature.properties?.id ?? '');
            const pin = pinsRef.current.find((entry) => entry.id === pinId);
            if (pin) {
              onPinClickRef.current(pin);
            }
          });

          map.on('mouseenter', 'territory-pin-clusters', () => {
            map?.getCanvas().style.setProperty('cursor', 'pointer');
          });

          map.on('mouseleave', 'territory-pin-clusters', () => {
            map?.getCanvas().style.setProperty('cursor', '');
          });

          map.on('click', 'territory-pin-clusters', async (event) => {
            const clusterFeature = event.features?.[0];
            if (!clusterFeature) {
              return;
            }
            const clusterId = clusterFeature.properties?.cluster_id;
            const source = map?.getSource('territory-pins') as unknown as GeoJSONSourceInstance | undefined;
            const clusterCoordinates = getPointCoordinates(clusterFeature.geometry);

            if (!source || clusterId === undefined || !clusterCoordinates) {
              return;
            }

            try {
              const zoom = await source.getClusterExpansionZoom(Number(clusterId));
              if (!map) {
                return;
              }
              map.easeTo({
                center: clusterCoordinates,
                zoom,
                duration: 500,
              });
            } catch {
              return;
            }
          });

          map.on('mousemove', 'territory-state-fill', (event) => {
            const feature = event.features?.[0];
            if (!feature) {
              return;
            }

            const stateCode = String(feature.properties?.stateCode ?? '');
            const coverage = coverageByStateRef.current.get(`US:${stateCode}`);
            if (!coverage) {
              setHoveredState(null);
              return;
            }

            setHoveredState({
              stateName: String(feature.properties?.name ?? stateCode),
              territoryName: coverage.territoryName,
              ...(coverage.assignedTmName ? { assignedTmName: coverage.assignedTmName } : {}),
              ...(coverage.assignedRdName ? { assignedRdName: coverage.assignedRdName } : {}),
              ...(coverage.shippingCenterName ? { shippingCenterName: coverage.shippingCenterName } : {}),
            });
          });

          map.on('mouseleave', 'territory-state-fill', () => {
            setHoveredState(null);
          });

          markerRefs.current.forEach((marker) => marker.remove());
          markerRefs.current = buildShippingCenterMarkers(
            map,
            maplibre,
            popup,
            shippingCentersRef.current,
          );

          setMapReady(true);
        });
      } catch (error) {
        console.error('MapLibre load error:', error);
        setMapReady(true);
      }
    }

    void initMap();

    return () => {
      cancelled = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      popupRef.current?.remove();
      popupRef.current = null;
      maplibreRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !geoJsonRef.current) {
      return;
    }

    const source = mapRef.current.getSource('territory-states') as unknown as GeoJSONSourceInstance | undefined;
    if (!source) {
      return;
    }

    source.setData(buildStateGeoJson(geoJsonRef.current.features, coverageByState));
  }, [coverageByState, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const source = mapRef.current.getSource('territory-pins') as unknown as GeoJSONSourceInstance | undefined;
    if (!source) {
      return;
    }

    source.setData(buildPinsGeoJson(pins));
  }, [pins, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const visibility = showBoundaries ? 'visible' : 'none';
    if (mapRef.current.getLayer('territory-state-fill')) {
      mapRef.current.setLayoutProperty('territory-state-fill', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('territory-state-border')) {
      mapRef.current.setLayoutProperty('territory-state-border', 'visibility', visibility);
    }
  }, [mapReady, showBoundaries]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const visibility = showPins ? 'visible' : 'none';
    if (mapRef.current.getLayer('territory-pin-clusters')) {
      mapRef.current.setLayoutProperty('territory-pin-clusters', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('territory-pin-cluster-count')) {
      mapRef.current.setLayoutProperty('territory-pin-cluster-count', 'visibility', visibility);
    }
    if (mapRef.current.getLayer('territory-pin-points')) {
      mapRef.current.setLayoutProperty('territory-pin-points', 'visibility', visibility);
    }
  }, [mapReady, showPins]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !popupRef.current || !maplibreRef.current) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = buildShippingCenterMarkers(
      mapRef.current,
      maplibreRef.current,
      popupRef.current,
      shippingCenters,
    );
  }, [mapReady, shippingCenters]);

  return (
    <Box pos="relative" h="100%">
      <Box ref={containerRef} h="100%" />
      <Paper
        withBorder
        radius="lg"
        p="sm"
        shadow="sm"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 300,
          backdropFilter: 'blur(10px)',
          background: 'rgba(255,255,255,0.94)',
        }}
      >
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text fw={700}>Live coverage focus</Text>
            <Text size="xs" c="dimmed">
              {pins.length} mapped records
            </Text>
          </Group>

          {hoveredState ? (
            <Stack gap={4}>
              <Text size="sm" fw={700}>
                {hoveredState.stateName}
              </Text>
              <Text size="sm" c="dimmed">
                Territory: {hoveredState.territoryName}
              </Text>
              <Text size="sm" c="dimmed">
                TM: {hoveredState.assignedTmName ?? 'Unassigned'}
              </Text>
              <Text size="sm" c="dimmed">
                RD: {hoveredState.assignedRdName ?? 'Unassigned'}
              </Text>
              <Text size="sm" c="dimmed">
                Shipping: {hoveredState.shippingCenterName ?? 'Unassigned'}
              </Text>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              Hover a covered state to inspect the current TM, RD, and shipping alignment.
            </Text>
          )}

          <Group gap="sm" mt="xs">
            <Group gap={6}>
              <Box w={10} h={10} style={{ borderRadius: 999, background: '#16a34a' }} />
              <Text size="xs">Accounts</Text>
            </Group>
            <Group gap={6}>
              <Box w={10} h={10} style={{ borderRadius: 999, background: '#2563eb' }} />
              <Text size="xs">Assigned leads</Text>
            </Group>
            <Group gap={6}>
              <Box w={10} h={10} style={{ borderRadius: 999, background: '#f97316' }} />
              <Text size="xs">Needs assignment</Text>
            </Group>
          </Group>
          <Group gap="sm">
            <Group gap={6}>
              <IconBuildingWarehouse size={14} color="#b45309" />
              <Text size="xs">Shipping hubs</Text>
            </Group>
            <Group gap={6}>
              <IconUsers size={14} color="#1d4ed8" />
              <Text size="xs">Clustered coverage</Text>
            </Group>
            <Group gap={6}>
              <IconMapPin size={14} color="#0f172a" />
              <Text size="xs">{mapReady ? 'Interactive map live' : 'Loading map'}</Text>
            </Group>
          </Group>
        </Stack>
      </Paper>
    </Box>
  );
}

function buildStateGeoJson(
  features: GeoJsonFeature[],
  coverageByState: Map<string, TerritoryMapCoverageEntrySummary & { color: string }>,
): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection' as const,
    features: features.map((feature) => {
      const properties = feature.properties ?? {};
      const stateCode = String(properties.postal ?? stateNameToAbbr(String(properties.name ?? '')));
      const coverage = coverageByState.get(`US:${stateCode}`);
      return {
        ...feature,
        properties: {
          ...properties,
          stateCode,
          territoryColor: coverage?.color ?? '#cbd5e1',
          territoryName: coverage?.territoryName ?? 'Unassigned',
          assignedTmName: coverage?.assignedTmName ?? 'Unassigned',
          assignedRdName: coverage?.assignedRdName ?? 'Unassigned',
          shippingCenterName: coverage?.shippingCenterName ?? 'Unassigned',
        },
      };
    }),
  };
}

function buildPinsGeoJson(pins: TerritoryMapPinSummary[]): GeoJsonFeatureCollection {
  return {
    type: 'FeatureCollection' as const,
    features: pins.map((pin) => ({
      type: 'Feature' as const,
      properties: {
        id: pin.id,
        recordType: pin.recordType,
        status: pin.status,
        territoryId: pin.territoryId,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.longitude, pin.latitude],
      },
    })),
  };
}

function buildShippingCenterMarkers(
  map: MapInstance,
  maplibre: MapLibreModule,
  popup: PopupInstance,
  shippingCenters: TerritoryMapShippingCenterSummary[],
) {
  return shippingCenters.map((center) => {
    const markerElement = document.createElement('button');
    markerElement.type = 'button';
    markerElement.setAttribute('aria-label', `${center.name} shipping hub`);
    markerElement.style.display = 'flex';
    markerElement.style.flexDirection = 'column';
    markerElement.style.alignItems = 'center';
    markerElement.style.gap = '6px';
    markerElement.style.background = 'transparent';
    markerElement.style.border = '0';
    markerElement.style.padding = '0';
    markerElement.style.cursor = 'pointer';
    markerElement.style.transform = 'translateY(-18px)';

    const badge = document.createElement('div');
    badge.style.width = '30px';
    badge.style.height = '30px';
    badge.style.borderRadius = '999px';
    badge.style.background = 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)';
    badge.style.border = '3px solid #ffffff';
    badge.style.boxShadow = '0 12px 24px rgba(217, 119, 6, 0.28), 0 0 0 4px rgba(255, 247, 237, 0.92)';
    badge.style.display = 'flex';
    badge.style.alignItems = 'center';
    badge.style.justifyContent = 'center';
    badge.style.color = '#ffffff';
    badge.style.fontSize = '15px';
    badge.style.fontWeight = '800';
    badge.textContent = '★';

    const label = document.createElement('div');
    label.style.padding = '4px 10px';
    label.style.borderRadius = '999px';
    label.style.background = 'rgba(255,255,255,0.96)';
    label.style.border = '1px solid rgba(245, 158, 11, 0.32)';
    label.style.boxShadow = '0 10px 18px rgba(15, 23, 42, 0.10)';
    label.style.color = '#9a3412';
    label.style.fontSize = '11px';
    label.style.fontWeight = '800';
    label.style.letterSpacing = '0.04em';
    label.textContent = center.code.toUpperCase();

    markerElement.appendChild(badge);
    markerElement.appendChild(label);

    const showPopup = () => {
      popup.setLngLat([center.longitude, center.latitude]).setHTML(buildShippingPopupMarkup(center)).addTo(map);
    };

    markerElement.addEventListener('mouseenter', () => {
      map.getCanvas().style.setProperty('cursor', 'pointer');
      showPopup();
    });
    markerElement.addEventListener('mouseleave', () => {
      map.getCanvas().style.setProperty('cursor', '');
      popup.remove();
    });
    markerElement.addEventListener('click', () => {
      map.flyTo({ center: [center.longitude, center.latitude], zoom: 5.2, speed: 0.8 });
      showPopup();
    });

    return new maplibre.Marker({
      element: markerElement,
      anchor: 'bottom',
    })
      .setLngLat([center.longitude, center.latitude])
      .addTo(map);
  });
}

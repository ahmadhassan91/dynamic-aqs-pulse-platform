import type { TerritoryMapCoverageEntrySummary } from '@pulse/contracts/territories';

// Territory boundary coloring for the mobile field map — same precedence as the web territory map
// (crm-web prototype-parity.ts): explicit admin color > printed-paper-map roster > deterministic
// palette keyed on a stable id, so admin-added TMs always get a distinct, stable color.

const PAPER_MAP_MANAGER_STYLES: Array<{ tokens: string[]; color: string }> = [
  { tokens: ['christopher holliday'], color: '#B1782B' },
  { tokens: ['john baranzelli'], color: '#F3EA3D' },
  { tokens: ['deen hopson'], color: '#F6D8AE' },
  { tokens: ['adam tims'], color: '#48B270' },
  { tokens: ['jarrod matthews'], color: '#E62929' },
  { tokens: ['doug holcomb'], color: '#7E46AA' },
  { tokens: ['tate lane'], color: '#F0AF62' },
  { tokens: ['don hearn'], color: '#1778B7' },
  { tokens: ['kyle victor'], color: '#8E94C4' },
  { tokens: ['brett larsen', 'chase gemberling'], color: '#B7D6EA' },
  { tokens: ['john d seipel', 'john d. seipel'], color: '#ECA7B8' },
];

const DYNAMIC_TERRITORY_PALETTE = [
  '#2563EB', '#0EA5E9', '#0D9488', '#16A34A', '#65A30D', '#CA8A04',
  '#D97706', '#EA580C', '#DC2626', '#DB2777', '#9333EA', '#4F46E5',
];

function dynamicTerritoryColor(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) | 0;
  }
  return DYNAMIC_TERRITORY_PALETTE[Math.abs(hash) % DYNAMIC_TERRITORY_PALETTE.length] ?? '#2563EB';
}

export function resolveTerritoryEntryColor(entry: TerritoryMapCoverageEntrySummary): string {
  const explicit = (entry.territoryColor ?? '').trim();
  if (explicit) return explicit;
  const managerName = (entry.assignedTmName ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const rosterStyle = PAPER_MAP_MANAGER_STYLES.find((style) =>
    style.tokens.some((token) => managerName.includes(token)),
  );
  if (rosterStyle) return rosterStyle.color;
  return dynamicTerritoryColor(entry.assignedTmUserId ?? entry.territoryId);
}

const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Puerto Rico': 'PR', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX',
  Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};

type StateFeature = {
  type: 'Feature';
  properties: Record<string, unknown> | null;
  geometry: unknown;
};

export type TerritoryStateFeatureCollection = {
  type: 'FeatureCollection';
  features: Array<StateFeature & { properties: Record<string, unknown> }>;
};

// Decorate the bundled us-states features with territory coverage: per-state fill color, the
// owning territory/TM, and whether the signed-in user owns it (drives the "my territory" emphasis).
export function buildTerritoryStateCollection(
  rawFeatures: StateFeature[],
  coverageEntries: TerritoryMapCoverageEntrySummary[],
  myUserId?: string,
): TerritoryStateFeatureCollection {
  const coverageByState = new Map<string, TerritoryMapCoverageEntrySummary>();
  for (const entry of coverageEntries) {
    coverageByState.set(`${entry.countryCode}:${entry.stateCode}`, entry);
  }

  return {
    type: 'FeatureCollection',
    features: rawFeatures.map((feature) => {
      const properties = feature.properties ?? {};
      const stateName = String(properties.name ?? '');
      const stateCode = STATE_NAME_TO_CODE[stateName] ?? '';
      const coverage = coverageByState.get(`US:${stateCode}`);
      return {
        ...feature,
        properties: {
          ...properties,
          stateCode,
          covered: Boolean(coverage),
          isMine: Boolean(coverage && myUserId && coverage.assignedTmUserId === myUserId),
          territoryColor: coverage ? resolveTerritoryEntryColor(coverage) : '#CBD5E1',
          territoryName: coverage?.territoryName ?? 'Unassigned',
          assignedTmName: coverage?.assignedTmName ?? 'Unassigned',
        },
      };
    }),
  };
}

export function summarizeMyTerritory(coverageEntries: TerritoryMapCoverageEntrySummary[], myUserId?: string) {
  if (!myUserId) return null;
  const mine = coverageEntries.filter((entry) => entry.assignedTmUserId === myUserId);
  if (mine.length === 0) return null;
  const territoryNames = Array.from(new Set(mine.map((entry) => entry.territoryName)));
  const stateCodes = Array.from(new Set(mine.map((entry) => entry.stateCode))).sort();
  const first = mine[0];
  return {
    territoryNames,
    stateCodes,
    color: first ? resolveTerritoryEntryColor(first) : '#2563EB',
  };
}

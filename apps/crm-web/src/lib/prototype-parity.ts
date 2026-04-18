export type TerritoryPrototypeTab = 'dashboard' | 'map' | 'list' | 'admin' | 'calendar';
export type CalendarPrototypeView = 'day' | 'week' | 'month' | 'list';

type PrototypeTabSummary = {
  value: TerritoryPrototypeTab;
  label: string;
};

type CalendarPrototypeViewSummary = {
  value: CalendarPrototypeView;
  label: string;
};

type PaperMapStyleInput = {
  managerName?: string | null | undefined;
  shippingCenterName?: string | null | undefined;
};

type PaperMapStyleSummary = {
  color: string;
  hubLabel?: string;
  shippingLabel?: string;
};

type TerritoryAssignmentImpactSummary = {
  assignedStates: string[];
  addedStates: string[];
  removedStates: string[];
  impactedStateCount: number;
};

const TERRITORY_PROTOTYPE_TABS: PrototypeTabSummary[] = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'map', label: 'Map View' },
  { value: 'list', label: 'Territory List' },
  { value: 'admin', label: 'Admin Config' },
  { value: 'calendar', label: 'Calendar' },
];

const CALENDAR_PROTOTYPE_VIEWS: CalendarPrototypeViewSummary[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'list', label: 'List' },
];

const PAPER_MAP_MANAGER_STYLES: Array<{ tokens: string[]; color: string }> = [
  { tokens: ['christopher holliday'], color: '#B1782B' },
  { tokens: ['john baranzelli'], color: '#F3EA3D' },
  { tokens: ['deen hopson'], color: '#F6D8AE' },
  { tokens: ['adam tims'], color: '#48B270' },
  { tokens: ['jarrod matthews'], color: '#E62929' },
  { tokens: ['doug holcomb'], color: '#7E46AA' },
  { tokens: ['tate lane'], color: '#F0AF62' },
  { tokens: ['don hearn'], color: '#1778B7' },
  { tokens: ['brett larsen', 'chase gemberling'], color: '#B7D6EA' },
  { tokens: ['john d seipel', 'john d. seipel'], color: '#ECA7B8' },
];

const SHIPPING_HUB_STYLES: Array<{ tokens: string[]; hubLabel: string; shippingLabel: string }> = [
  { tokens: ['nevada', 'henderson', 'nv'], hubLabel: 'NV HUB', shippingLabel: 'Nevada Shipping' },
  { tokens: ['new jersey', 'nj'], hubLabel: 'NJ HUB', shippingLabel: 'New Jersey Shipping' },
  { tokens: ['florida', 'fl'], hubLabel: 'FL HUB', shippingLabel: 'Florida Shipping' },
];

function normalizeLabel(value?: string | null) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeStateCodes(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function getTerritoryPrototypeTabs(canAdminTerritory: boolean): PrototypeTabSummary[] {
  return canAdminTerritory
    ? TERRITORY_PROTOTYPE_TABS
    : TERRITORY_PROTOTYPE_TABS.filter((tab) => tab.value !== 'admin');
}

export function getCalendarPrototypeViewOptions(): CalendarPrototypeViewSummary[] {
  return CALENDAR_PROTOTYPE_VIEWS;
}

export function buildTerritoryAssignmentImpactSummary(
  currentStates: string[],
  selectedStates: string[],
): TerritoryAssignmentImpactSummary {
  const assignedStates = normalizeStateCodes(selectedStates);
  const current = new Set(normalizeStateCodes(currentStates));
  const next = new Set(assignedStates);
  const addedStates = assignedStates.filter((state) => !current.has(state));
  const removedStates = Array.from(current).filter((state) => !next.has(state)).sort((left, right) => left.localeCompare(right));

  return {
    assignedStates,
    addedStates,
    removedStates,
    impactedStateCount: addedStates.length + removedStates.length,
  };
}

export function resolvePaperMapTerritoryStyle({
  managerName,
  shippingCenterName,
}: PaperMapStyleInput): PaperMapStyleSummary {
  const normalizedManagerName = normalizeLabel(managerName);
  const normalizedShippingCenterName = normalizeLabel(shippingCenterName);

  const managerStyle = PAPER_MAP_MANAGER_STYLES.find((entry) =>
    entry.tokens.some((token) => normalizedManagerName.includes(token)),
  );

  const shippingStyle = SHIPPING_HUB_STYLES.find((entry) =>
    entry.tokens.some((token) => normalizedShippingCenterName.includes(token)),
  );

  return {
    color: managerStyle?.color ?? '#2563eb',
    ...(shippingStyle?.hubLabel ? { hubLabel: shippingStyle.hubLabel } : {}),
    ...(shippingStyle?.shippingLabel ? { shippingLabel: shippingStyle.shippingLabel } : {}),
  };
}

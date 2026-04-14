import type { AuthRole } from './auth.js';
import type { LeadLifecycleStatusKey, LeadStageKey } from './leads.js';

export const TERRITORY_ASSIGNMENT_METHODS = [
  'default_state',
  'manual_override',
  'system',
] as const;

export type TerritoryAssignmentMethodKey = (typeof TERRITORY_ASSIGNMENT_METHODS)[number];

export const TERRITORY_ASSIGNMENT_ENTITY_TYPES = [
  'lead',
  'account',
  'location',
] as const;

export type TerritoryAssignmentEntityTypeKey = (typeof TERRITORY_ASSIGNMENT_ENTITY_TYPES)[number];

export const TERRITORY_MAP_PIN_RECORD_TYPES = [
  'account',
  'lead',
] as const;

export type TerritoryMapPinRecordTypeKey = (typeof TERRITORY_MAP_PIN_RECORD_TYPES)[number];

export const TERRITORY_MAP_GEO_PRECISIONS = [
  'city_state',
  'state_fallback',
] as const;

export type TerritoryMapGeoPrecisionKey = (typeof TERRITORY_MAP_GEO_PRECISIONS)[number];

export interface ShippingCenterSummary {
  id: string;
  code: string;
  name: string;
  city?: string;
  state?: string;
  countryCode: string;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShippingCenterRequest {
  code: string;
  name: string;
  city?: string;
  state?: string;
  countryCode?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateShippingCenterRequest {
  name?: string;
  city?: string;
  state?: string;
  countryCode?: string;
  isActive?: boolean;
  notes?: string;
}

export interface TerritoryPolicySummary {
  preHandoffTmVisibility: boolean;
  assignNationalTmLeadsByDefault: boolean;
  strategicGrowthRetainsOwnership: boolean;
  notes?: string;
  updatedAt: string;
}

export interface UpdateTerritoryPolicyRequest {
  preHandoffTmVisibility?: boolean;
  assignNationalTmLeadsByDefault?: boolean;
  strategicGrowthRetainsOwnership?: boolean;
  notes?: string;
}

export interface RegionSummary {
  id: string;
  code: string;
  name: string;
  directorUserId?: string;
  directorUserName?: string;
  isActive: boolean;
  notes?: string;
  territoryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegionRequest {
  code: string;
  name: string;
  directorUserId?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateRegionRequest {
  name?: string;
  directorUserId?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface TerritoryCoverageSummary {
  id: string;
  stateCode: string;
  countryCode: string;
}

export interface TerritorySummary {
  id: string;
  code: string;
  name: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  managerUserId?: string;
  managerUserName?: string;
  directorUserId?: string;
  directorUserName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  isActive: boolean;
  notes?: string;
  coverageStates: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTerritoryRequest {
  code: string;
  name: string;
  regionId: string;
  managerUserId?: string;
  shippingCenterId?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateTerritoryRequest {
  name?: string;
  regionId?: string;
  managerUserId?: string | null;
  shippingCenterId?: string | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface ReplaceTerritoryCoverageRequest {
  coverage: Array<{
    stateCode: string;
    countryCode?: string;
  }>;
}

export interface ListRegionsResponse {
  items: RegionSummary[];
}

export interface ListShippingCentersResponse {
  items: ShippingCenterSummary[];
}

export interface ListTerritoriesResponse {
  items: TerritorySummary[];
}

export interface TerritoryAssignmentHistoryEntry {
  id: string;
  entityType: TerritoryAssignmentEntityTypeKey;
  entityId: string;
  assignmentMethod: TerritoryAssignmentMethodKey;
  previousTerritoryId?: string;
  previousTerritoryCode?: string;
  nextTerritoryId?: string;
  nextTerritoryCode?: string;
  previousShippingCenterId?: string;
  nextShippingCenterId?: string;
  previousAssignedTmUserId?: string;
  nextAssignedTmUserId?: string;
  previousAssignedRdUserId?: string;
  nextAssignedRdUserId?: string;
  changedByUserId?: string;
  changedByUserName?: string;
  reasonCode?: string;
  reasonNote?: string;
  changedAt: string;
}

export interface ListTerritoryAssignmentHistoryResponse {
  items: TerritoryAssignmentHistoryEntry[];
}

export interface TerritoryAssignableUserSummary {
  userId: string;
  displayName: string;
  email: string;
  role: AuthRole;
}

export interface ListTerritoryAssignableUsersResponse {
  territoryManagers: TerritoryAssignableUserSummary[];
  regionalDirectors: TerritoryAssignableUserSummary[];
}

export interface ReassignLeadTerritoryRequest {
  territoryId: string;
  assignedTmUserId?: string | null;
  assignedRdUserId?: string | null;
  reasonCode: string;
  reasonNote?: string;
}

export interface LeadTerritoryAssignmentSummary {
  leadId: string;
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  assignmentMethod?: TerritoryAssignmentMethodKey;
  assignedAt?: string;
}

export interface TerritoryMapCoverageEntrySummary {
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  stateCode: string;
  countryCode: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  shippingCenterId?: string;
  shippingCenterName?: string;
}

export interface TerritoryMapPinSummary {
  id: string;
  recordType: TerritoryMapPinRecordTypeKey;
  recordId: string;
  label: string;
  status: 'active' | 'prospect' | 'inactive';
  latitude: number;
  longitude: number;
  geoPrecision: TerritoryMapGeoPrecisionKey;
  city?: string;
  state?: string;
  countryCode?: string;
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  affinityGroupName?: string;
  lifecycleStatus?: LeadLifecycleStatusKey;
  stage?: LeadStageKey;
  accountType?: string;
  sourceLabel?: string;
  lastTouchedAt?: string;
}

export interface TerritoryMapShippingCenterSummary extends ShippingCenterSummary {
  latitude: number;
  longitude: number;
  geoPrecision: TerritoryMapGeoPrecisionKey;
  servicedTerritoryCount: number;
  activeLeadCount: number;
  activeAccountCount: number;
}

export interface TerritoryMapWorkspaceResponse {
  policy: TerritoryPolicySummary;
  regions: RegionSummary[];
  territories: TerritorySummary[];
  coverageEntries: TerritoryMapCoverageEntrySummary[];
  shippingCenters: TerritoryMapShippingCenterSummary[];
  accountPins: TerritoryMapPinSummary[];
  leadPins: TerritoryMapPinSummary[];
  generatedAt: string;
}

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
  metadata?: Record<string, unknown>;
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

export interface ReassignAccountTerritoryRequest {
  territoryId: string;
  assignedTmUserId?: string | null;
  assignedRdUserId?: string | null;
  reasonCode: string;
  reasonNote?: string;
}

export interface BulkReassignAccountsTerritoryRequest {
  accountIds: string[];
  territoryId: string;
  assignedTmUserId?: string | null;
  assignedRdUserId?: string | null;
  reasonCode: string;
  reasonNote?: string;
}

export interface BulkReassignAccountsTerritoryResponse {
  items: AccountTerritoryAssignmentSummary[];
}

export interface BulkReassignLeadsTerritoryRequest {
  leadIds: string[];
  territoryId: string;
  assignedTmUserId?: string | null;
  assignedRdUserId?: string | null;
  reasonCode: string;
  reasonNote?: string;
}

export interface BulkReassignLeadsTerritoryResponse {
  items: LeadTerritoryAssignmentSummary[];
}

export interface AccountTerritoryAssignmentSummary {
  accountId: string;
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

export interface TerritoryRoutePlanStopSummary {
  sequence: number;
  pinId: string;
  recordType: TerritoryMapPinRecordTypeKey;
  recordId: string;
  label: string;
  status: TerritoryMapPinSummary['status'];
  latitude: number;
  longitude: number;
  geoPrecision: TerritoryMapGeoPrecisionKey;
  distanceFromPreviousMiles: number;
  city?: string;
  state?: string;
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  lifecycleStatus?: LeadLifecycleStatusKey;
  stage?: LeadStageKey;
  accountType?: string;
  lastTouchedAt?: string;
  visitExecutionState?: 'not_started' | 'checked_in' | 'completed';
  activeVisitSessionId?: string;
  lastVisitSessionId?: string;
  lastVisitCompletedAt?: string;
  lastVisitTrainerName?: string;
}

export interface TerritoryRoutePlanSummary {
  id: string;
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  originLatitude?: number;
  originLongitude?: number;
  originGeoPrecision?: TerritoryMapGeoPrecisionKey;
  stopCount: number;
  accountStopCount: number;
  leadStopCount: number;
  estimatedStraightLineMiles: number;
  isProviderOptimized: false;
  providerDependency: 'none';
  stops: TerritoryRoutePlanStopSummary[];
}

export interface TerritoryMapWorkspaceResponse {
  policy: TerritoryPolicySummary;
  regions: RegionSummary[];
  territories: TerritorySummary[];
  coverageEntries: TerritoryMapCoverageEntrySummary[];
  shippingCenters: TerritoryMapShippingCenterSummary[];
  accountPins: TerritoryMapPinSummary[];
  leadPins: TerritoryMapPinSummary[];
  routePlans: TerritoryRoutePlanSummary[];
  generatedAt: string;
}

export interface TerritoryDashboardStats {
  regions: number;
  territories: number;
  coveredStates: number;
  shippingCenters: number;
  activeLeads: number;
  activeAccounts: number;
  assignedLeads: number;
  assignedAccounts: number;
  unassignedLeads: number;
  unassignedAccounts: number;
  strategicGrowthLeads: number;
  nationalTmLeads: number;
}

export interface TerritoryDashboardAlert {
  label: string;
  detail: string;
  tone: 'orange' | 'red' | 'blue';
}

export interface TerritoryDashboardWorkload {
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  regionId: string;
  regionName: string;
  managerUserId?: string;
  managerName?: string;
  directorUserId?: string;
  directorUserName?: string;
  shippingCenterId?: string;
  shippingCenterName?: string;
  coveredStates: string[];
  activeLeadCount: number;
  activeAccountCount: number;
  trainedAccounts: number;
  activeProgramsCount: number;
  trainingPenetrationPercent: number;
  engaged30DayAccountCount: number;
  engaged90DayAccountCount: number;
  overdue90DayAccountCount: number;
  atRiskAccountCount: number;
  newLeadCount: number;
  discoveryLeadCount: number;
  cisLeadCount: number;
  onboardingLeadCount: number;
  totalWorkloadCount: number;
}

export interface TerritoryDashboardRegionRollupSummary {
  regionId: string;
  regionCode: string;
  regionName: string;
  directorUserId?: string;
  directorUserName?: string;
  territoryCount: number;
  activeTerritoryCount: number;
  coveredStates: number;
  activeLeadCount: number;
  activeAccountCount: number;
  trainedAccounts: number;
  activeProgramsCount: number;
  trainingPenetrationPercent: number;
  engaged30DayAccountCount: number;
  engaged90DayAccountCount: number;
  overdue90DayAccountCount: number;
  atRiskAccountCount: number;
  newLeadCount: number;
  discoveryLeadCount: number;
  cisLeadCount: number;
  onboardingLeadCount: number;
  shippingCenterCount: number;
  territoriesMissingManager: number;
  territoriesMissingShippingCenter: number;
}

export interface TerritoryDashboardOwnerMetricSummary {
  ownerUserId?: string;
  ownerName: string;
  ownerRole: 'territory_manager' | 'regional_director';
  regionCount: number;
  territoryCount: number;
  activeLeadCount: number;
  activeAccountCount: number;
  engaged30DayAccountCount: number;
  engaged90DayAccountCount: number;
  atRiskAccountCount: number;
  shippingCenterCount: number;
  coveredStates: number;
}

export interface TerritoryDashboardTrainingPenetrationSummary {
  totalAccounts: number;
  trainedAccounts: number;
  activeProgramsCount: number;
  penetrationPercent: number;
}

export interface TerritoryTrainingPenetrationTerritorySummary extends TerritoryDashboardTrainingPenetrationSummary {
  territoryId: string;
  territoryCode: string;
  territoryName: string;
  regionId: string;
  regionName: string;
}

export interface TerritoryTrainingPenetrationRegionSummary extends TerritoryDashboardTrainingPenetrationSummary {
  regionId: string;
  regionCode: string;
  regionName: string;
}

export interface TerritoryTrainingPenetrationResponse {
  summary: TerritoryDashboardTrainingPenetrationSummary;
  territories: TerritoryTrainingPenetrationTerritorySummary[];
  regions: TerritoryTrainingPenetrationRegionSummary[];
}

export interface TerritoryDashboardCoverageSummary {
  eligibleAccountCount: number;
  engaged30DayCount: number;
  engaged60DayCount: number;
  engaged90DayCount: number;
  overdue90DayCount: number;
  engaged30DayPercent: number;
  engaged60DayPercent: number;
  engaged90DayPercent: number;
}

export interface TerritoryDashboardLifecycleSummary {
  activeAccountCount: number;
  atRiskAccountCount: number;
  inactiveAccountCount: number;
  churnedAccountCount: number;
}

export interface TerritoryDashboardPipelineSummary {
  newLeadCount: number;
  discoveryLeadCount: number;
  cisLeadCount: number;
  onboardingLeadCount: number;
}

export interface TerritoryDashboardQueueSummary {
  unassignedLeads: number;
  unassignedAccounts: number;
  strategicGrowthLeads: number;
  nationalTmLeads: number;
  territoriesMissingManager: number;
  territoriesMissingShippingCenter: number;
  regionsMissingDirector: number;
}

export interface TerritoryDashboardResponse {
  stats: TerritoryDashboardStats;
  coverage: TerritoryDashboardCoverageSummary;
  lifecycle: TerritoryDashboardLifecycleSummary;
  pipeline: TerritoryDashboardPipelineSummary;
  trainingPenetration: TerritoryDashboardTrainingPenetrationSummary;
  alerts: TerritoryDashboardAlert[];
  workloads: TerritoryDashboardWorkload[];
  regionRollups: TerritoryDashboardRegionRollupSummary[];
  ownerMetrics: TerritoryDashboardOwnerMetricSummary[];
  queue: TerritoryDashboardQueueSummary;
  generatedAt: string;
}

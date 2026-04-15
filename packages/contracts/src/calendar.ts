export const CALENDAR_EVENT_TYPES = [
  'discovery_call',
  'virtual_training',
  'account_training',
  'on_site_visit',
  'consignment_audit',
] as const;

export type CalendarEventTypeKey = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const;

export type CalendarEventStatusKey = (typeof CALENDAR_EVENT_STATUSES)[number];

export interface CalendarWorkspaceRequest {
  startDate: string;
  endDate: string;
}

export interface CalendarEventSummary {
  id: string;
  sourceModule: 'leads' | 'training' | 'territories';
  sourceRecordId: string;
  sourcePath: string;
  eventType: CalendarEventTypeKey;
  status: CalendarEventStatusKey;
  title: string;
  startsAt: string;
  endsAt?: string;
  assignedToName?: string;
  contactName?: string;
  contactEmail?: string;
  accountId?: string;
  accountName?: string;
  leadId?: string;
  leadName?: string;
  territoryName?: string;
  regionName?: string;
  locationName?: string;
  notes?: string;
  outlookSync?: CalendarOutlookEventSyncSummary;
}

export interface CalendarOutlookConnectionSummary {
  provider: 'outlook';
  isConfigured: boolean;
  isConnected: boolean;
  connectionEmail?: string;
  connectedAt?: string;
  accessTokenExpiresAt?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
}

export interface CalendarOutlookEventSyncSummary {
  syncedAt?: string;
  externalWebLink?: string;
  lastSyncError?: string;
}

export interface StartCalendarOutlookConnectionResponse {
  provider: 'outlook';
  authorizationUrl: string;
  expiresAt: string;
}

export interface SyncCalendarOutlookEventRequest {
  sourceModule: 'leads' | 'training';
  sourceRecordId: string;
  eventType: CalendarEventTypeKey;
}

export interface SyncCalendarOutlookEventResponse {
  provider: 'outlook';
  sourceModule: 'leads' | 'training';
  sourceRecordId: string;
  eventType: CalendarEventTypeKey;
  externalEventId: string;
  externalWebLink?: string;
  syncedAt: string;
}

export interface CalendarOverviewSummary {
  totalEvents: number;
  scheduledCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  discoveryCallCount: number;
  virtualTrainingCount: number;
  accountTrainingCount: number;
  onSiteVisitCount: number;
  consignmentAuditCount: number;
}

export interface CalendarWorkspaceResponse {
  rangeStart: string;
  rangeEnd: string;
  summary: CalendarOverviewSummary;
  outlookConnection: CalendarOutlookConnectionSummary;
  items: CalendarEventSummary[];
}

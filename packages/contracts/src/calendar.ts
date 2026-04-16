export const CALENDAR_EVENT_TYPES = [
  'discovery_call',
  'virtual_training',
  'account_training',
  'on_site_visit',
  'consignment_audit',
] as const;

export type CalendarEventTypeKey = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_MEETING_PROVIDERS = [
  'none',
  'teams',
] as const;

export type CalendarMeetingProviderKey = (typeof CALENDAR_MEETING_PROVIDERS)[number];

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
  supportsSharedCalendars?: boolean;
  supportsTeamsMeetings?: boolean;
  availabilityMessage?: string;
  configurationIssues?: string[];
  policy?: CalendarOutlookPolicySummary;
  connectionEmail?: string;
  targetCalendarId?: string;
  targetCalendarName?: string;
  meetingProvider?: CalendarMeetingProviderKey;
  connectedAt?: string;
  accessTokenExpiresAt?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
}

export interface CalendarOutlookPolicySummary {
  allowUserConnections: boolean;
  isCurrentUserEligible: boolean;
  sharedCalendarsEnabled: boolean;
  defaultMeetingProvider: CalendarMeetingProviderKey;
  autoSyncDiscoveryEnabled: boolean;
  autoSyncTrainingEnabled: boolean;
  pilotUserEmails: string[];
}

export interface CalendarOutlookEventSyncSummary {
  syncedAt?: string;
  externalWebLink?: string;
  meetingJoinUrl?: string;
  lastSyncError?: string;
}

export interface CalendarOutlookCalendarSummary {
  id: string;
  name: string;
  ownerName?: string;
  ownerAddress?: string;
  canEdit: boolean;
  canShare?: boolean;
  isDefault: boolean;
  supportsTeamsMeetings: boolean;
}

export interface ListCalendarOutlookCalendarsResponse {
  items: CalendarOutlookCalendarSummary[];
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
  meetingJoinUrl?: string;
  syncedAt: string;
}

export interface UpdateCalendarOutlookConnectionRequest {
  targetCalendarId?: string | null;
  meetingProvider?: CalendarMeetingProviderKey;
}

export interface AdminCalendarIntegrationSettingsResponse {
  provider: 'outlook';
  isConfigured: boolean;
  configurationIssues: string[];
  policy: CalendarOutlookPolicySummary;
}

export interface UpdateAdminCalendarIntegrationSettingsRequest {
  allowUserConnections?: boolean;
  sharedCalendarsEnabled?: boolean;
  defaultMeetingProvider?: CalendarMeetingProviderKey;
  autoSyncDiscoveryEnabled?: boolean;
  autoSyncTrainingEnabled?: boolean;
  pilotUserEmails?: string[];
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

import type {
  AdminIntegrationStatusResponse,
  AdminOverviewResponse,
  AdminRoleAccessCatalogResponse,
  AdminSystemHealthResponse,
  AdminCalendarIntegrationSettingsResponse,
  AdminPaymentIntegrationSettingsResponse,
  AdminMicrosoftEntraIntegrationSettingsResponse,
  CreateAdminUserRequest,
  CreateAdminUserResponse,
  ImportAdminUsersRequest,
  ImportAdminUsersResponse,
  ListAdminActivityRequest,
  ListAdminActivityResponse,
  ListAdminUsersRequest,
  ListAdminUsersResponse,
  ResetAdminUserPasswordRequest,
  ResetAdminUserPasswordResponse,
  UpdateAdminUserRequest,
  UpdateAdminUserResponse,
  AuthIdentity,
  AuthSession,
  CompleteMicrosoftEntraLoginRequest,
  CompleteMicrosoftEntraLoginResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  CalendarWorkspaceRequest,
  CalendarWorkspaceResponse,
  CalendarOutlookConnectionSummary,
  ListCalendarOutlookCalendarsResponse,
  StartCalendarOutlookConnectionResponse,
  SyncCalendarOutlookEventRequest,
  SyncCalendarOutlookEventResponse,
  UpdateCalendarOutlookConnectionRequest,
  UpdateAdminCalendarIntegrationSettingsRequest,
  UpdateAdminPaymentIntegrationSettingsRequest,
  AccountDetail,
  AccountPaymentMethodSummary,
  AccountSummary,
  AccountLocationSummary,
  ContactSummary,
  DealerPortalAccountDetail,
  DealerPortalDashboardResponse,
  ProvisionDealerPortalUserRequest,
  ProvisionDealerPortalUserResponse,
  ResetDealerPortalUserPasswordRequest,
  ResetDealerPortalUserPasswordResponse,
  UpdateDealerPortalUserStatusRequest,
  UpdateDealerPortalUserStatusResponse,
  ListAccountsRequest,
  ListAccountsResponse,
  CreateAccountLocationRequest,
  CreateAccountPaymentMethodRequest,
  CreateContactRequest,
  ListAccountPaymentMethodsResponse,
  UpdateAccountLifecycleRequest,
  UpdateAccountLocationRequest,
  UpdateAccountPaymentMethodRequest,
  UpdateAccountRequest,
  UpdateContactRequest,
  CisFinanceDecisionRequest,
  CisLinkIssueRequest,
  CisLinkIssueResponse,
  CisPackageDetail,
  CancelMonerisHostedPaymentCaptureRequest,
  CancelMonerisHostedPaymentCaptureResponse,
  RecordMonerisHostedCaptureResultRequest,
  RecordMonerisHostedCaptureResultResponse,
  RecordCisPaymentVaultReferenceRequest,
  RequestCisPaymentCaptureRequest,
  CisPublicPackage,
  CisReviewSignoffRequest,
  CisSubmitToFinanceRequest,
  ListCisParsedDraftsResponse,
  StartMonerisHostedPaymentCaptureRequest,
  StartMonerisHostedPaymentCaptureResponse,
  CaptureWebsiteLeadRequest,
  CaptureWebsiteLeadResponse,
  CommitLeadImportRunRequest,
  CreateLeadRequest,
  CreateAffinityGroupRequest,
  CreateOwnershipGroupRequest,
  CompleteLeadDiscoveryRequest,
  ConvertLeadOnFirstOrderRequest,
  ConvertLeadOnFirstOrderResponse,
  CreateWebsiteLeadNotificationRecipientRequest,
  CreateWebsiteLeadSiteRequest,
  CreateLeadContactRequest,
  LeadDetail,
  LeadContactSummary,
  LeadConversionPreparationRecord,
  LeadConversionValidationResponse,
  ListLeadHistoryFeedRequest,
  ListLeadHistoryFeedResponse,
  LeadReadinessBlockersResponse,
  LeadReadinessDetail,
  LeadSummary,
  ListFinanceQueueRequest,
  ListFinanceQueueResponse,
  ImportLeadFileRequest,
  ImportLeadFileResponse,
  AffinityGroupImportRow,
  OwnershipGroupImportRow,
  CommitGroupRosterImportRunRequest,
  GroupRosterImportCommitResponse,
  GroupRosterImportFilePreviewRequest,
  GroupRosterImportFilePreviewResponse,
  GroupRosterImportRunDetail,
  ReviewGroupRosterImportRequest,
  ReviewGroupRosterImportResponse,
  LeadImportFilePreviewRequest,
  LeadImportFilePreviewResponse,
  LeadImportRunDetail,
  ReviewLeadImportRequest,
  ReviewLeadImportResponse,
  AccountTerritoryAssignmentSummary,
  LeadTerritoryAssignmentSummary,
  LogLeadInitialContactRequest,
  LeadRoutingPolicySummary,
  ResolveWebsiteLeadSubmissionRequest,
  StartMicrosoftEntraLoginRequest,
  StartMicrosoftEntraLoginResponse,
  UpdateAdminMicrosoftEntraIntegrationSettingsRequest,
  UpdateLeadRoutingPolicyRequest,
  ListLeadWorkflowQueueRequest,
  ListLeadWorkflowQueueResponse,
  LeadStageKey,
  ListLeadsRequest,
  ListLeadsResponse,
  ListWebsiteLeadNotificationRecipientsResponse,
  ListWebsiteLeadSitesResponse,
  ListWebsiteLeadSubmissionsRequest,
  ListWebsiteLeadSubmissionsResponse,
  ListWebsiteFormLeadsRequest,
  ListWebsiteFormLeadsResponse,
  LoginRequest,
  PublicWebsiteLeadSite,
  ReferenceListResponse,
  ReferenceImportRequest,
  ReferenceImportResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  BulkReassignAccountsTerritoryRequest,
  BulkReassignAccountsTerritoryResponse,
  CreateRegionRequest,
  CreateShippingCenterRequest,
  CreateTerritoryRequest,
  ReassignAccountTerritoryRequest,
  ReassignLeadTerritoryRequest,
  AffinityGroupReferenceSummary,
  OwnershipGroupReferenceSummary,
  ReferenceValueSummary,
  ScheduleLeadDiscoveryRequest,
  SavePublicCisDraftRequest,
  SkipLeadDiscoveryRequest,
  UpdateLeadContactRequest,
  UpdateAffinityGroupRequest,
  UpdateLeadLifecycleRequest,
  UpdateLeadRequest,
  UpdateLeadConversionPreparationRequest,
  UpdateLeadReadinessItemRequest,
  UpdateOwnershipGroupRequest,
  UpdateWebsiteLeadNotificationRecipientRequest,
  UpdateWebsiteLeadSiteRequest,
  SubmitPublicCisRequest,
  UploadCisScanRequest,
  UploadCisScanResponse,
  ApplyCisParsedDraftRequest,
  ListRegionsResponse,
  ListShippingCentersResponse,
  ListTerritoryAssignableUsersResponse,
  ListTerritoriesResponse,
  ListTerritoryAssignmentHistoryResponse,
  RegionSummary,
  ShippingCenterSummary,
  TerritoryMapWorkspaceResponse,
  TerritoryPolicySummary,
  TerritorySummary,
  UpdateRegionRequest,
  UpdateShippingCenterRequest,
  UpdateTerritoryRequest,
  ReplaceTerritoryCoverageRequest,
  ListTrainingAccountsRequest,
  ListTrainingAccountsResponse,
  ListTrainingRecertificationQueueResponse,
  TokenPair,
  TrainingCatalogResponse,
  TrainingCoachingWorkloadResponse,
  TrainingOverviewResponse,
  AccountTrainingHistoryResponse,
  CreateTrainingCategoryRequest,
  CheckInTrainingSessionRequest,
  CreateTrainingTypeRequest,
  CreateTrainingTemplateRequest,
  CreateAccountTrainingProgramRequest,
  CreateTrainingFollowUpTaskRequest,
  CreateTrainingSessionRequest,
  CompleteTrainingFollowUpTaskRequest,
  TrainingCategorySummary,
  TrainingFollowUpTaskSummary,
  TrainingTypeSummary,
  TrainingTemplateSummary,
  TrainingSessionSummary,
  TrainingTrainerSummary,
  UploadTrainingSessionProofRequest,
  UploadTrainingSessionProofResponse,
  ListTrainingSessionsRequest,
  ListTrainingSessionsResponse,
  ListTrainingTrainersResponse,
  CompleteTrainingSessionRequest,
  CancelTrainingSessionRequest,
  UpdateTrainingSessionScheduleRequest,
  WebsiteLeadNotificationRecipientSummary,
  WebsiteLeadSiteSummary,
  WebsiteLeadSubmissionSummary,
} from '@pulse/contracts';

type AuthBundle = {
  identity: AuthIdentity;
  session: AuthSession;
  tokens: TokenPair;
};

export async function loginToPulse(apiBaseUrl: string, input: LoginRequest) {
  return requestJson<AuthBundle>(apiBaseUrl, '/api/v1/auth/login', {
    method: 'POST',
    body: input,
  });
}

export async function requestPulsePasswordReset(apiBaseUrl: string, input: ForgotPasswordRequest) {
  return requestJson<ForgotPasswordResponse>(apiBaseUrl, '/api/v1/auth/forgot-password', {
    method: 'POST',
    body: input,
  });
}

export async function resetPulsePassword(apiBaseUrl: string, input: ResetPasswordRequest) {
  return requestJson<ResetPasswordResponse>(apiBaseUrl, '/api/v1/auth/reset-password', {
    method: 'POST',
    body: input,
  });
}

export async function startMicrosoftEntraLogin(
  apiBaseUrl: string,
  input: StartMicrosoftEntraLoginRequest = {},
) {
  return requestJson<StartMicrosoftEntraLoginResponse>(apiBaseUrl, '/api/v1/auth/entra/start', {
    method: 'POST',
    body: input,
  });
}

export async function completeMicrosoftEntraLogin(
  apiBaseUrl: string,
  input: CompleteMicrosoftEntraLoginRequest,
) {
  return requestJson<CompleteMicrosoftEntraLoginResponse>(apiBaseUrl, '/api/v1/auth/entra/complete', {
    method: 'POST',
    body: input,
  });
}

export async function logoutFromPulse(apiBaseUrl: string, accessToken: string) {
  return requestJson<{ sessionId: string; revokedAt: string }>(apiBaseUrl, '/api/v1/auth/logout', {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function refreshPulseSession(apiBaseUrl: string, refreshToken: string) {
  return requestJson<AuthBundle>(apiBaseUrl, '/api/v1/auth/refresh', {
    method: 'POST',
    body: {
      refreshToken,
    },
  });
}

export async function fetchCurrentSession(apiBaseUrl: string, accessToken: string) {
  return requestJsonMaybeNotFound<{ identity: AuthIdentity; session: AuthSession }>(apiBaseUrl, '/api/v1/auth/me', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchCalendarWorkspace(
  apiBaseUrl: string,
  accessToken: string,
  query: CalendarWorkspaceRequest,
) {
  const searchParams = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
  });

  return requestJson<CalendarWorkspaceResponse>(apiBaseUrl, `/api/v1/calendar/workspace?${searchParams.toString()}`, {
    method: 'GET',
    accessToken,
  });
}

export async function startCalendarOutlookConnection(apiBaseUrl: string, accessToken: string) {
  return requestJson<StartCalendarOutlookConnectionResponse>(apiBaseUrl, '/api/v1/calendar/outlook/connect', {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function disconnectCalendarOutlookConnection(apiBaseUrl: string, accessToken: string) {
  return requestJson<CalendarOutlookConnectionSummary>(apiBaseUrl, '/api/v1/calendar/outlook/connection', {
    method: 'DELETE',
    accessToken,
  });
}

export async function fetchCalendarOutlookCalendars(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListCalendarOutlookCalendarsResponse>(apiBaseUrl, '/api/v1/calendar/outlook/calendars', {
    method: 'GET',
    accessToken,
  });
}

export async function updateCalendarOutlookConnection(
  apiBaseUrl: string,
  accessToken: string,
  input: UpdateCalendarOutlookConnectionRequest,
) {
  return requestJson<CalendarOutlookConnectionSummary>(apiBaseUrl, '/api/v1/calendar/outlook/connection', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function syncCalendarOutlookEvent(
  apiBaseUrl: string,
  accessToken: string,
  input: SyncCalendarOutlookEventRequest,
) {
  return requestJson<SyncCalendarOutlookEventResponse>(apiBaseUrl, '/api/v1/calendar/outlook/events/sync', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchAdminOverview(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminOverviewResponse>(apiBaseUrl, '/api/v1/admin/overview', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminUsers(apiBaseUrl: string, accessToken: string, query: ListAdminUsersRequest = {}) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.role) {
    searchParams.set('role', query.role);
  }
  if (query.status) {
    searchParams.set('status', query.status);
  }
  if (query.page !== undefined) {
    searchParams.set('page', String(query.page));
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/admin/users?${searchParams.toString()}`
    : '/api/v1/admin/users';

  return requestJson<ListAdminUsersResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function createAdminUser(apiBaseUrl: string, accessToken: string, input: CreateAdminUserRequest) {
  return requestJson<CreateAdminUserResponse>(apiBaseUrl, '/api/v1/admin/users', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateAdminUser(apiBaseUrl: string, accessToken: string, userId: string, input: UpdateAdminUserRequest) {
  return requestJson<UpdateAdminUserResponse>(apiBaseUrl, `/api/v1/admin/users/${userId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function resetAdminUserPassword(
  apiBaseUrl: string,
  accessToken: string,
  userId: string,
  input: ResetAdminUserPasswordRequest = {},
) {
  return requestJson<ResetAdminUserPasswordResponse>(apiBaseUrl, `/api/v1/admin/users/${userId}/reset-password`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function importAdminUsers(apiBaseUrl: string, accessToken: string, input: ImportAdminUsersRequest) {
  return requestJson<ImportAdminUsersResponse>(apiBaseUrl, '/api/v1/admin/users/import', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchAdminRoleAccess(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminRoleAccessCatalogResponse>(apiBaseUrl, '/api/v1/admin/access/roles', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminActivity(
  apiBaseUrl: string,
  accessToken: string,
  query: ListAdminActivityRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.actorUserId) {
    searchParams.set('actorUserId', query.actorUserId);
  }
  if (query.action) {
    searchParams.set('action', query.action);
  }
  if (query.entityType) {
    searchParams.set('entityType', query.entityType);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/admin/activity?${searchParams.toString()}`
    : '/api/v1/admin/activity';

  return requestJson<ListAdminActivityResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminSystemHealth(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminSystemHealthResponse>(apiBaseUrl, '/api/v1/admin/system-health', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminIntegrations(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminIntegrationStatusResponse>(apiBaseUrl, '/api/v1/admin/integrations', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminCalendarIntegrationSettings(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminCalendarIntegrationSettingsResponse>(apiBaseUrl, '/api/v1/admin/integrations/calendar', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminMicrosoftEntraIntegrationSettings(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminMicrosoftEntraIntegrationSettingsResponse>(apiBaseUrl, '/api/v1/admin/integrations/auth', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAdminPaymentIntegrationSettings(apiBaseUrl: string, accessToken: string) {
  return requestJson<AdminPaymentIntegrationSettingsResponse>(apiBaseUrl, '/api/v1/admin/integrations/payments', {
    method: 'GET',
    accessToken,
  });
}

export async function updateAdminCalendarIntegrationSettings(
  apiBaseUrl: string,
  accessToken: string,
  input: UpdateAdminCalendarIntegrationSettingsRequest,
) {
  return requestJson<AdminCalendarIntegrationSettingsResponse>(apiBaseUrl, '/api/v1/admin/integrations/calendar', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function updateAdminMicrosoftEntraIntegrationSettings(
  apiBaseUrl: string,
  accessToken: string,
  input: UpdateAdminMicrosoftEntraIntegrationSettingsRequest,
) {
  return requestJson<AdminMicrosoftEntraIntegrationSettingsResponse>(apiBaseUrl, '/api/v1/admin/integrations/auth', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function updateAdminPaymentIntegrationSettings(
  apiBaseUrl: string,
  accessToken: string,
  input: UpdateAdminPaymentIntegrationSettingsRequest,
) {
  return requestJson<AdminPaymentIntegrationSettingsResponse>(apiBaseUrl, '/api/v1/admin/integrations/payments', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchBusinessSegments(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<ReferenceValueSummary>>(apiBaseUrl, '/api/v1/reference/business-segments', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchLeadSources(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<ReferenceValueSummary>>(apiBaseUrl, '/api/v1/reference/lead-sources', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAffinityGroups(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<AffinityGroupReferenceSummary>>(apiBaseUrl, '/api/v1/reference/affinity-groups', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchOwnershipGroups(apiBaseUrl: string, accessToken: string) {
  return requestJson<ReferenceListResponse<OwnershipGroupReferenceSummary>>(apiBaseUrl, '/api/v1/reference/ownership-groups', {
    method: 'GET',
    accessToken,
  });
}

export async function createAffinityGroup(apiBaseUrl: string, accessToken: string, input: CreateAffinityGroupRequest) {
  return requestJson<AffinityGroupReferenceSummary>(apiBaseUrl, '/api/v1/reference/affinity-groups', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateAffinityGroup(apiBaseUrl: string, accessToken: string, affinityGroupId: string, input: UpdateAffinityGroupRequest) {
  return requestJson<AffinityGroupReferenceSummary>(apiBaseUrl, `/api/v1/reference/affinity-groups/${affinityGroupId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function importAffinityGroups(
  apiBaseUrl: string,
  accessToken: string,
  input: ReferenceImportRequest<AffinityGroupImportRow>,
) {
  return requestJson<ReferenceImportResponse<AffinityGroupReferenceSummary>>(apiBaseUrl, '/api/v1/reference/affinity-groups/import', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function createOwnershipGroup(apiBaseUrl: string, accessToken: string, input: CreateOwnershipGroupRequest) {
  return requestJson<OwnershipGroupReferenceSummary>(apiBaseUrl, '/api/v1/reference/ownership-groups', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateOwnershipGroup(apiBaseUrl: string, accessToken: string, ownershipGroupId: string, input: UpdateOwnershipGroupRequest) {
  return requestJson<OwnershipGroupReferenceSummary>(apiBaseUrl, `/api/v1/reference/ownership-groups/${ownershipGroupId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function importOwnershipGroups(
  apiBaseUrl: string,
  accessToken: string,
  input: ReferenceImportRequest<OwnershipGroupImportRow>,
) {
  return requestJson<ReferenceImportResponse<OwnershipGroupReferenceSummary>>(apiBaseUrl, '/api/v1/reference/ownership-groups/import', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function previewGroupRosterImport(
  apiBaseUrl: string,
  accessToken: string,
  input: GroupRosterImportFilePreviewRequest,
) {
  return requestJson<GroupRosterImportFilePreviewResponse>(apiBaseUrl, '/api/v1/reference/group-rosters/preview', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function reviewGroupRosterImport(
  apiBaseUrl: string,
  accessToken: string,
  input: ReviewGroupRosterImportRequest,
) {
  return requestJson<ReviewGroupRosterImportResponse>(apiBaseUrl, '/api/v1/reference/group-rosters/review', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchGroupRosterImportRun(
  apiBaseUrl: string,
  accessToken: string,
  runId: string,
) {
  return requestJson<GroupRosterImportRunDetail>(apiBaseUrl, `/api/v1/reference/group-rosters/runs/${runId}`, {
    method: 'GET',
    accessToken,
  });
}

export async function commitGroupRosterImportRun(
  apiBaseUrl: string,
  accessToken: string,
  runId: string,
  input: CommitGroupRosterImportRunRequest,
) {
  return requestJson<GroupRosterImportCommitResponse>(apiBaseUrl, `/api/v1/reference/group-rosters/runs/${runId}/commit`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchTerritoryPolicy(apiBaseUrl: string, accessToken: string) {
  return requestJson<TerritoryPolicySummary>(apiBaseUrl, '/api/v1/territories/policy', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTerritoryRegions(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListRegionsResponse>(apiBaseUrl, '/api/v1/territories/regions', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTerritoryShippingCenters(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListShippingCentersResponse>(apiBaseUrl, '/api/v1/territories/shipping-centers', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTerritories(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListTerritoriesResponse>(apiBaseUrl, '/api/v1/territories', {
    method: 'GET',
    accessToken,
  });
}

export async function createTerritoryRegion(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateRegionRequest,
) {
  return requestJson<RegionSummary>(apiBaseUrl, '/api/v1/territories/regions', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateTerritoryRegion(
  apiBaseUrl: string,
  accessToken: string,
  regionId: string,
  input: UpdateRegionRequest,
) {
  return requestJson<RegionSummary>(apiBaseUrl, `/api/v1/territories/regions/${regionId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function createTerritoryShippingCenter(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateShippingCenterRequest,
) {
  return requestJson<ShippingCenterSummary>(apiBaseUrl, '/api/v1/territories/shipping-centers', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateTerritoryShippingCenter(
  apiBaseUrl: string,
  accessToken: string,
  shippingCenterId: string,
  input: UpdateShippingCenterRequest,
) {
  return requestJson<ShippingCenterSummary>(
    apiBaseUrl,
    `/api/v1/territories/shipping-centers/${shippingCenterId}`,
    {
      method: 'PATCH',
      accessToken,
      body: input,
    },
  );
}

export async function createTerritoryRecord(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateTerritoryRequest,
) {
  return requestJson<TerritorySummary>(apiBaseUrl, '/api/v1/territories', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateTerritoryRecord(
  apiBaseUrl: string,
  accessToken: string,
  territoryId: string,
  input: UpdateTerritoryRequest,
) {
  return requestJson<TerritorySummary>(apiBaseUrl, `/api/v1/territories/${territoryId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function replaceTerritoryCoverage(
  apiBaseUrl: string,
  accessToken: string,
  territoryId: string,
  input: ReplaceTerritoryCoverageRequest,
) {
  return requestJson<TerritorySummary>(apiBaseUrl, `/api/v1/territories/${territoryId}/coverage`, {
    method: 'PUT',
    accessToken,
    body: input,
  });
}

export async function fetchTerritoryAssignableUsers(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListTerritoryAssignableUsersResponse>(apiBaseUrl, '/api/v1/territories/assignable-users', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTerritoryAssignmentHistory(
  apiBaseUrl: string,
  accessToken: string,
  entityType: 'lead' | 'account' | 'location',
  entityId: string,
) {
  const searchParams = new URLSearchParams({
    entityType,
    entityId,
  });

  return requestJson<ListTerritoryAssignmentHistoryResponse>(
    apiBaseUrl,
    `/api/v1/territories/history?${searchParams.toString()}`,
    {
      method: 'GET',
      accessToken,
    },
  );
}

export async function fetchTerritoryMapWorkspace(apiBaseUrl: string, accessToken: string) {
  return requestJson<TerritoryMapWorkspaceResponse>(apiBaseUrl, '/api/v1/territories/map', {
    method: 'GET',
    accessToken,
  });
}

export async function reassignLeadTerritory(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: ReassignLeadTerritoryRequest,
) {
  return requestJson<LeadTerritoryAssignmentSummary>(
    apiBaseUrl,
    `/api/v1/territories/assignments/leads/${leadId}`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function reassignAccountTerritory(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: ReassignAccountTerritoryRequest,
) {
  return requestJson<AccountTerritoryAssignmentSummary>(
    apiBaseUrl,
    `/api/v1/territories/assignments/accounts/${accountId}`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function bulkReassignAccountsTerritory(
  apiBaseUrl: string,
  accessToken: string,
  input: BulkReassignAccountsTerritoryRequest,
) {
  return requestJson<BulkReassignAccountsTerritoryResponse>(
    apiBaseUrl,
    '/api/v1/territories/assignments/accounts/bulk',
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function fetchLeadRoutingPolicy(apiBaseUrl: string, accessToken: string) {
  return requestJson<LeadRoutingPolicySummary>(apiBaseUrl, '/api/v1/leads/routing-policy', {
    method: 'GET',
    accessToken,
  });
}

export async function updateLeadRoutingPolicy(
  apiBaseUrl: string,
  accessToken: string,
  input: UpdateLeadRoutingPolicyRequest,
) {
  return requestJson<LeadRoutingPolicySummary>(apiBaseUrl, '/api/v1/leads/routing-policy', {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchLeads(apiBaseUrl: string, accessToken: string, query: ListLeadsRequest) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.stage) {
    searchParams.set('stage', query.stage);
  }
  if (query.routingTeam) {
    searchParams.set('routingTeam', query.routingTeam);
  }
  if (query.leadSourceCode) {
    searchParams.set('leadSourceCode', query.leadSourceCode);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0 ? `/api/v1/leads?${searchParams.toString()}` : '/api/v1/leads';

  return requestJson<ListLeadsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAccounts(
  apiBaseUrl: string,
  accessToken: string,
  query: ListAccountsRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }
  if (query.includeInactive !== undefined) {
    searchParams.set('includeInactive', String(query.includeInactive));
  }
  if (query.lifecycleStatus) {
    searchParams.set('lifecycleStatus', query.lifecycleStatus);
  }

  const pathname = searchParams.size > 0 ? `/api/v1/accounts?${searchParams.toString()}` : '/api/v1/accounts';

  return requestJson<ListAccountsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAccountDetail(apiBaseUrl: string, accessToken: string, accountId: string) {
  return requestJson<AccountDetail>(apiBaseUrl, `/api/v1/accounts/${accountId}`, {
    method: 'GET',
    accessToken,
  });
}

export async function updateAccountRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: UpdateAccountRequest,
) {
  return requestJson<AccountDetail | AccountSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function updateAccountLifecycle(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: UpdateAccountLifecycleRequest,
) {
  return requestJson<AccountSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/lifecycle`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchAccountPaymentMethods(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
) {
  return requestJson<ListAccountPaymentMethodsResponse>(apiBaseUrl, `/api/v1/accounts/${accountId}/payment-methods`, {
    method: 'GET',
    accessToken,
  });
}

export async function createAccountPaymentMethodRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: CreateAccountPaymentMethodRequest,
) {
  return requestJson<AccountPaymentMethodSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/payment-methods`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateAccountPaymentMethodRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  paymentMethodId: string,
  input: UpdateAccountPaymentMethodRequest,
) {
  return requestJson<AccountPaymentMethodSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/payment-methods/${paymentMethodId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function createAccountContactRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: CreateContactRequest,
) {
  return requestJson<ContactSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/contacts`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateAccountContactRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  contactId: string,
  input: UpdateContactRequest,
) {
  return requestJson<ContactSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/contacts/${contactId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function createAccountLocationRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: CreateAccountLocationRequest,
) {
  return requestJson<AccountLocationSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/locations`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateAccountLocationRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  locationId: string,
  input: UpdateAccountLocationRequest,
) {
  return requestJson<AccountLocationSummary>(apiBaseUrl, `/api/v1/accounts/${accountId}/locations/${locationId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchTrainingOverview(apiBaseUrl: string, accessToken: string) {
  return requestJson<TrainingOverviewResponse>(apiBaseUrl, '/api/v1/training/overview', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTrainingCatalog(apiBaseUrl: string, accessToken: string) {
  return requestJson<TrainingCatalogResponse>(apiBaseUrl, '/api/v1/training/catalog', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTrainingTrainers(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListTrainingTrainersResponse>(apiBaseUrl, '/api/v1/training/trainers', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTrainingRecertificationQueue(
  apiBaseUrl: string,
  accessToken: string,
  query: {
    ownerTmUserId?: string;
    ownerRdUserId?: string;
    windowDays?: number;
    limit?: number;
  } = {},
) {
  const searchParams = new URLSearchParams();
  if (query.ownerTmUserId) {
    searchParams.set('ownerTmUserId', query.ownerTmUserId);
  }
  if (query.ownerRdUserId) {
    searchParams.set('ownerRdUserId', query.ownerRdUserId);
  }
  if (query.windowDays !== undefined) {
    searchParams.set('windowDays', String(query.windowDays));
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/training/recertification?${searchParams.toString()}`
    : '/api/v1/training/recertification';

  return requestJson<ListTrainingRecertificationQueueResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTrainingCoachingWorkload(apiBaseUrl: string, accessToken: string) {
  return requestJson<TrainingCoachingWorkloadResponse>(apiBaseUrl, '/api/v1/training/coaching', {
    method: 'GET',
    accessToken,
  });
}

export async function createTrainingCategoryRecord(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateTrainingCategoryRequest,
) {
  return requestJson<TrainingCategorySummary>(apiBaseUrl, '/api/v1/training/catalog/categories', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function createTrainingTypeRecord(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateTrainingTypeRequest,
) {
  return requestJson<TrainingTypeSummary>(apiBaseUrl, '/api/v1/training/catalog/types', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function createTrainingTemplateRecord(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateTrainingTemplateRequest,
) {
  return requestJson<TrainingTemplateSummary>(apiBaseUrl, '/api/v1/training/catalog/templates', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchTrainingAccounts(
  apiBaseUrl: string,
  accessToken: string,
  query: ListTrainingAccountsRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.status) {
    searchParams.set('status', query.status);
  }
  if (query.includeInactive !== undefined) {
    searchParams.set('includeInactive', String(query.includeInactive));
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/training/accounts?${searchParams.toString()}`
    : '/api/v1/training/accounts';

  return requestJson<ListTrainingAccountsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchTrainingSessions(
  apiBaseUrl: string,
  accessToken: string,
  query: ListTrainingSessionsRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.accountId) {
    searchParams.set('accountId', query.accountId);
  }
  if (query.trainerUserId) {
    searchParams.set('trainerUserId', query.trainerUserId);
  }
  if (query.status) {
    searchParams.set('status', query.status);
  }
  if (query.includeVisits !== undefined) {
    searchParams.set('includeVisits', String(query.includeVisits));
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/training/sessions?${searchParams.toString()}`
    : '/api/v1/training/sessions';

  return requestJson<ListTrainingSessionsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchAccountTrainingHistory(apiBaseUrl: string, accessToken: string, accountId: string) {
  return requestJson<AccountTrainingHistoryResponse>(apiBaseUrl, `/api/v1/training/accounts/${accountId}`, {
    method: 'GET',
    accessToken,
  });
}

export async function createAccountTrainingProgramRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: CreateAccountTrainingProgramRequest,
) {
  return requestJson(apiBaseUrl, `/api/v1/training/accounts/${accountId}/programs`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function createTrainingSessionRecord(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: CreateTrainingSessionRequest,
) {
  return requestJson<TrainingSessionSummary>(apiBaseUrl, `/api/v1/training/accounts/${accountId}/sessions`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function checkInTrainingSessionRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  input: CheckInTrainingSessionRequest = {},
) {
  return requestJson<TrainingSessionSummary>(apiBaseUrl, `/api/v1/training/sessions/${sessionId}/check-in`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function rescheduleTrainingSessionRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  input: UpdateTrainingSessionScheduleRequest,
) {
  return requestJson<TrainingSessionSummary>(apiBaseUrl, `/api/v1/training/sessions/${sessionId}/reschedule`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function completeTrainingSessionRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  input: CompleteTrainingSessionRequest,
) {
  return requestJson<TrainingSessionSummary>(apiBaseUrl, `/api/v1/training/sessions/${sessionId}/complete`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function uploadTrainingSessionProofRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  input: UploadTrainingSessionProofRequest,
) {
  return requestJson<UploadTrainingSessionProofResponse>(apiBaseUrl, `/api/v1/training/sessions/${sessionId}/proof`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function cancelTrainingSessionRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  input: CancelTrainingSessionRequest,
) {
  return requestJson<TrainingSessionSummary>(apiBaseUrl, `/api/v1/training/sessions/${sessionId}/cancel`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function createTrainingFollowUpTaskRecord(
  apiBaseUrl: string,
  accessToken: string,
  sessionId: string,
  input: CreateTrainingFollowUpTaskRequest,
) {
  return requestJson<TrainingFollowUpTaskSummary>(apiBaseUrl, `/api/v1/training/sessions/${sessionId}/follow-up-tasks`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function completeTrainingFollowUpTaskRecord(
  apiBaseUrl: string,
  accessToken: string,
  taskId: string,
  input: CompleteTrainingFollowUpTaskRequest = {},
) {
  return requestJson<TrainingFollowUpTaskSummary>(apiBaseUrl, `/api/v1/training/follow-up-tasks/${taskId}/complete`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchDealerPortalAccountDetail(apiBaseUrl: string, accessToken: string, accountId: string) {
  return requestJson<DealerPortalAccountDetail>(apiBaseUrl, `/api/v1/dealer-portal/accounts/${accountId}`, {
    method: 'GET',
    accessToken,
  });
}

export async function provisionDealerPortalUser(
  apiBaseUrl: string,
  accessToken: string,
  accountId: string,
  input: ProvisionDealerPortalUserRequest,
) {
  return requestJson<ProvisionDealerPortalUserResponse>(
    apiBaseUrl,
    `/api/v1/dealer-portal/accounts/${accountId}/users`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function updateDealerPortalUserStatus(
  apiBaseUrl: string,
  accessToken: string,
  portalUserId: string,
  input: UpdateDealerPortalUserStatusRequest,
) {
  return requestJson<UpdateDealerPortalUserStatusResponse>(
    apiBaseUrl,
    `/api/v1/dealer-portal/users/${portalUserId}`,
    {
      method: 'PATCH',
      accessToken,
      body: input,
    },
  );
}

export async function resetDealerPortalUserPassword(
  apiBaseUrl: string,
  accessToken: string,
  portalUserId: string,
  input: ResetDealerPortalUserPasswordRequest = {},
) {
  return requestJson<ResetDealerPortalUserPasswordResponse>(
    apiBaseUrl,
    `/api/v1/dealer-portal/users/${portalUserId}/reset-password`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function fetchDealerPortalDashboard(apiBaseUrl: string, accessToken: string) {
  return requestJson<DealerPortalDashboardResponse>(apiBaseUrl, '/api/v1/dealer-portal/me/dashboard', {
    method: 'GET',
    accessToken,
  });
}

export async function fetchWebsiteFormLeads(
  apiBaseUrl: string,
  accessToken: string,
  query: ListWebsiteFormLeadsRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.stage) {
    searchParams.set('stage', query.stage);
  }
  if (query.sourceSiteId) {
    searchParams.set('sourceSiteId', query.sourceSiteId);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/leads/website-forms?${searchParams.toString()}`
    : '/api/v1/leads/website-forms';

  return requestJson<ListWebsiteFormLeadsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchWebsiteLeadSubmissions(
  apiBaseUrl: string,
  accessToken: string,
  query: ListWebsiteLeadSubmissionsRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.sourceSiteId) {
    searchParams.set('sourceSiteId', query.sourceSiteId);
  }
  if (query.outcome) {
    searchParams.set('outcome', query.outcome);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/leads/website-submissions?${searchParams.toString()}`
    : '/api/v1/leads/website-submissions';

  return requestJson<ListWebsiteLeadSubmissionsResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function resolveWebsiteLeadSubmission(
  apiBaseUrl: string,
  accessToken: string,
  submissionId: string,
  input: ResolveWebsiteLeadSubmissionRequest,
) {
  return requestJson<WebsiteLeadSubmissionSummary>(
    apiBaseUrl,
    `/api/v1/leads/website-submissions/${submissionId}/resolve`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function fetchWebsiteLeadSites(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListWebsiteLeadSitesResponse>(apiBaseUrl, '/api/v1/leads/website-sites', {
    method: 'GET',
    accessToken,
  });
}

export async function createWebsiteLeadSite(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateWebsiteLeadSiteRequest,
) {
  return requestJson<WebsiteLeadSiteSummary>(apiBaseUrl, '/api/v1/leads/website-sites', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateWebsiteLeadSite(
  apiBaseUrl: string,
  accessToken: string,
  siteId: string,
  input: UpdateWebsiteLeadSiteRequest,
) {
  return requestJson<WebsiteLeadSiteSummary>(apiBaseUrl, `/api/v1/leads/website-sites/${siteId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchWebsiteLeadNotificationRecipients(apiBaseUrl: string, accessToken: string) {
  return requestJson<ListWebsiteLeadNotificationRecipientsResponse>(apiBaseUrl, '/api/v1/leads/website-notification-recipients', {
    method: 'GET',
    accessToken,
  });
}

export async function createWebsiteLeadNotificationRecipient(
  apiBaseUrl: string,
  accessToken: string,
  input: CreateWebsiteLeadNotificationRecipientRequest,
) {
  return requestJson<WebsiteLeadNotificationRecipientSummary>(apiBaseUrl, '/api/v1/leads/website-notification-recipients', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateWebsiteLeadNotificationRecipient(
  apiBaseUrl: string,
  accessToken: string,
  recipientId: string,
  input: UpdateWebsiteLeadNotificationRecipientRequest,
) {
  return requestJson<WebsiteLeadNotificationRecipientSummary>(apiBaseUrl, `/api/v1/leads/website-notification-recipients/${recipientId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchPublicWebsiteLeadSite(apiBaseUrl: string, siteId: string) {
  return requestJson<PublicWebsiteLeadSite>(apiBaseUrl, `/api/v1/public/website-sites/${encodeURIComponent(siteId)}`, {
    method: 'GET',
  });
}

export async function submitPublicWebsiteLead(apiBaseUrl: string, input: CaptureWebsiteLeadRequest) {
  return requestJson<CaptureWebsiteLeadResponse>(apiBaseUrl, '/api/v1/public/leads/capture', {
    method: 'POST',
    body: input,
  });
}

export async function fetchLeadWorkflowQueue(
  apiBaseUrl: string,
  accessToken: string,
  query: ListLeadWorkflowQueueRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.routingTeam) {
    searchParams.set('routingTeam', query.routingTeam);
  }
  if (query.view) {
    searchParams.set('view', query.view);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/leads/workflow-queue?${searchParams.toString()}`
    : '/api/v1/leads/workflow-queue';

  return requestJson<ListLeadWorkflowQueueResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchLeadHistoryFeed(
  apiBaseUrl: string,
  accessToken: string,
  query: ListLeadHistoryFeedRequest = {},
) {
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set('search', query.search);
  }
  if (query.limit !== undefined) {
    searchParams.set('limit', String(query.limit));
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/leads/history-feed?${searchParams.toString()}`
    : '/api/v1/leads/history-feed';

  return requestJson<ListLeadHistoryFeedResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchLeadDetail(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}`, {
    method: 'GET',
    accessToken,
  });
}

export async function createLead(apiBaseUrl: string, accessToken: string, input: CreateLeadRequest) {
  return requestJson<LeadSummary>(apiBaseUrl, '/api/v1/leads', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateLead(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: UpdateLeadRequest,
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchLeadCisPackage(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJsonMaybeNotFound<CisPackageDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/cis`, {
    method: 'GET',
    accessToken,
  });
}

export async function issueLeadCisLink(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: CisLinkIssueRequest,
  action: 'send-link' | 'resend-link' = 'send-link',
) {
  return requestJson<CisLinkIssueResponse>(apiBaseUrl, `/api/v1/leads/${leadId}/cis/${action}`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function uploadLeadCisScan(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: UploadCisScanRequest,
) {
  return requestJson<UploadCisScanResponse>(apiBaseUrl, `/api/v1/leads/${leadId}/cis/upload-scan`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function listCisParsedDrafts(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
) {
  return requestJson<ListCisParsedDraftsResponse>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/parsed-drafts`, {
    method: 'GET',
    accessToken,
  });
}

export async function applyCisParsedDraft(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  draftId: string,
  input: ApplyCisParsedDraftRequest = {},
) {
  return requestJson<CisPackageDetail>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/parsed-drafts/${draftId}/apply`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function reviewLeadCisPackage(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: CisReviewSignoffRequest,
) {
  return requestJson<CisPackageDetail>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/review-signoff`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function submitLeadCisToFinance(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: CisSubmitToFinanceRequest,
) {
  return requestJson<CisPackageDetail>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/submit-to-finance`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function recordLeadCisFinanceDecision(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: CisFinanceDecisionRequest,
) {
  return requestJson<CisPackageDetail>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/finance-decision`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function requestLeadCisPaymentCapture(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: RequestCisPaymentCaptureRequest = {},
) {
  return requestJson<CisPackageDetail>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/request-payment-capture`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function recordLeadCisPaymentVaultReference(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: RecordCisPaymentVaultReferenceRequest,
) {
  return requestJson<CisPackageDetail>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/payment-vault-reference`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function startLeadMonerisHostedCapture(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  input: StartMonerisHostedPaymentCaptureRequest = {},
) {
  return requestJson<StartMonerisHostedPaymentCaptureResponse>(apiBaseUrl, `/api/v1/cis/${cisPackageId}/moneris-hosted-capture/start`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function cancelLeadMonerisHostedCapture(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  attemptId: string,
  input: CancelMonerisHostedPaymentCaptureRequest = {},
) {
  return requestJson<CancelMonerisHostedPaymentCaptureResponse>(
    apiBaseUrl,
    `/api/v1/cis/${cisPackageId}/payment-capture-attempts/${attemptId}/moneris-cancel`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function recordLeadMonerisHostedCaptureResult(
  apiBaseUrl: string,
  accessToken: string,
  cisPackageId: string,
  attemptId: string,
  input: RecordMonerisHostedCaptureResultRequest,
) {
  return requestJson<RecordMonerisHostedCaptureResultResponse>(
    apiBaseUrl,
    `/api/v1/cis/${cisPackageId}/payment-capture-attempts/${attemptId}/moneris-result`,
    {
      method: 'POST',
      accessToken,
      body: input,
    },
  );
}

export async function fetchFinanceQueue(
  apiBaseUrl: string,
  accessToken: string,
  query: ListFinanceQueueRequest = {},
) {
  const searchParams = new URLSearchParams();
  if (query.decisionStatus) {
    searchParams.set('decisionStatus', query.decisionStatus);
  }

  const pathname = searchParams.size > 0
    ? `/api/v1/cis/finance-queue?${searchParams.toString()}`
    : '/api/v1/cis/finance-queue';

  return requestJson<ListFinanceQueueResponse>(apiBaseUrl, pathname, {
    method: 'GET',
    accessToken,
  });
}

export async function transitionLeadStage(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: {
    toStage: LeadStageKey;
    note?: string;
  },
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/stage-transition`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateLeadLifecycle(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: UpdateLeadLifecycleRequest,
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/lifecycle`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function logLeadInitialContact(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: LogLeadInitialContactRequest = {},
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/log-initial-contact`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function scheduleLeadDiscovery(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: ScheduleLeadDiscoveryRequest = {},
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/discovery/schedule`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function completeLeadDiscovery(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: CompleteLeadDiscoveryRequest,
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/discovery/complete`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function skipLeadDiscovery(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: SkipLeadDiscoveryRequest,
) {
  return requestJson<LeadDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/discovery/skip`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchLeadReadiness(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJsonMaybeNotFound<LeadReadinessDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/readiness`, {
    method: 'GET',
    accessToken,
  });
}

export async function fetchLeadReadinessBlockers(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJsonMaybeNotFound<LeadReadinessBlockersResponse>(apiBaseUrl, `/api/v1/leads/${leadId}/readiness/blockers`, {
    method: 'GET',
    accessToken,
  });
}

export async function generateLeadReadinessChecklist(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJson<LeadReadinessDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/readiness/checklist/generate`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function updateLeadReadinessItem(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  itemId: string,
  input: UpdateLeadReadinessItemRequest,
) {
  return requestJson<LeadReadinessDetail>(apiBaseUrl, `/api/v1/leads/${leadId}/readiness/items/${itemId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function fetchLeadContacts(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJson<LeadContactSummary[]>(apiBaseUrl, `/api/v1/leads/${leadId}/contacts`, {
    method: 'GET',
    accessToken,
  });
}

export async function createLeadContact(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: CreateLeadContactRequest,
) {
  return requestJson<LeadContactSummary>(apiBaseUrl, `/api/v1/leads/${leadId}/contacts`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function updateLeadContact(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  contactId: string,
  input: UpdateLeadContactRequest,
) {
  return requestJson<LeadContactSummary>(apiBaseUrl, `/api/v1/leads/${leadId}/contacts/${contactId}`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function importLeadContactsFromCis(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJson<LeadContactSummary[]>(apiBaseUrl, `/api/v1/leads/${leadId}/contacts/import-from-cis`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function fetchLeadConversionPreparation(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJsonMaybeNotFound<LeadConversionPreparationRecord>(apiBaseUrl, `/api/v1/leads/${leadId}/conversion-prep`, {
    method: 'GET',
    accessToken,
  });
}

export async function updateLeadConversionPreparation(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: UpdateLeadConversionPreparationRequest,
) {
  return requestJson<LeadConversionPreparationRecord>(apiBaseUrl, `/api/v1/leads/${leadId}/conversion-prep`, {
    method: 'PATCH',
    accessToken,
    body: input,
  });
}

export async function validateLeadConversionPreparation(apiBaseUrl: string, accessToken: string, leadId: string) {
  return requestJson<LeadConversionValidationResponse>(apiBaseUrl, `/api/v1/leads/${leadId}/conversion-prep/validate`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function convertLeadOnFirstOrder(
  apiBaseUrl: string,
  accessToken: string,
  leadId: string,
  input: ConvertLeadOnFirstOrderRequest,
) {
  return requestJson<ConvertLeadOnFirstOrderResponse>(apiBaseUrl, `/api/v1/leads/${leadId}/convert-on-first-order`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function previewLeadImport(
  apiBaseUrl: string,
  accessToken: string,
  input: LeadImportFilePreviewRequest,
) {
  return requestJson<LeadImportFilePreviewResponse>(apiBaseUrl, '/api/v1/leads/import/preview', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function importLeadFile(
  apiBaseUrl: string,
  accessToken: string,
  input: ImportLeadFileRequest,
) {
  return requestJson<ImportLeadFileResponse>(apiBaseUrl, '/api/v1/leads/import/file', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function reviewLeadImport(
  apiBaseUrl: string,
  accessToken: string,
  input: ReviewLeadImportRequest,
) {
  return requestJson<ReviewLeadImportResponse>(apiBaseUrl, '/api/v1/leads/import/review', {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchLeadImportRun(
  apiBaseUrl: string,
  accessToken: string,
  runId: string,
) {
  return requestJson<LeadImportRunDetail>(apiBaseUrl, `/api/v1/leads/import/runs/${runId}`, {
    method: 'GET',
    accessToken,
  });
}

export async function commitLeadImportRun(
  apiBaseUrl: string,
  accessToken: string,
  runId: string,
  input: CommitLeadImportRunRequest,
) {
  return requestJson<ImportLeadFileResponse>(apiBaseUrl, `/api/v1/leads/import/runs/${runId}/commit`, {
    method: 'POST',
    accessToken,
    body: input,
  });
}

export async function fetchPublicCisPackage(apiBaseUrl: string, token: string) {
  return requestJsonMaybeNotFound<CisPublicPackage>(apiBaseUrl, `/api/v1/public/cis/${token}`, {
    method: 'GET',
  });
}

export async function savePublicCisDraft(
  apiBaseUrl: string,
  token: string,
  input: SavePublicCisDraftRequest,
) {
  return requestJson<CisPublicPackage>(apiBaseUrl, `/api/v1/public/cis/${token}/save-draft`, {
    method: 'POST',
    body: input,
  });
}

export async function submitPublicCis(
  apiBaseUrl: string,
  token: string,
  input: SubmitPublicCisRequest,
) {
  return requestJson<CisPublicPackage>(apiBaseUrl, `/api/v1/public/cis/${token}/submit`, {
    method: 'POST',
    body: input,
  });
}

async function requestJson<TResponse>(
  apiBaseUrl: string,
  pathname: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    accessToken?: string;
    body?: unknown;
  },
): Promise<TResponse> {
  let response: Response;
  try {
    response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}${pathname}`, {
      method: options.method,
      headers: {
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    throw new Error(normalizeNetworkError(apiBaseUrl, error));
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TResponse;
}

async function requestJsonMaybeNotFound<TResponse>(
  apiBaseUrl: string,
  pathname: string,
  options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    accessToken?: string;
    body?: unknown;
  },
): Promise<TResponse | null> {
  let response: Response;
  try {
    response = await fetch(`${normalizeApiBaseUrl(apiBaseUrl)}${pathname}`, {
      method: options.method,
      headers: {
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch (error) {
    throw new Error(normalizeNetworkError(apiBaseUrl, error));
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as TResponse;
}

async function readErrorDetail(response: Response) {
  const responseText = await response.text();
  if (!responseText) {
    return '';
  }

  try {
    const parsed = JSON.parse(responseText) as Partial<{
      error: string;
      detail: string;
      message: string;
    }>;

    return parsed.detail || parsed.error || parsed.message || responseText;
  } catch {
    return responseText;
  }
}

function normalizeApiBaseUrl(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeNetworkError(apiBaseUrl: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'Failed to fetch') {
    return `Pulse API is unavailable at ${normalizeApiBaseUrl(apiBaseUrl)}. Make sure the backend is running and try again.`;
  }

  return message;
}

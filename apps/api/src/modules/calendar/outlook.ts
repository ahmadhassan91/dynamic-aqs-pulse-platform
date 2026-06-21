import {
  AuditAction,
  CalendarConnectionProvider,
  CalendarMeetingProviderPreference,
  prisma,
} from '@pulse/db';
import type {
  CalendarEventSummary,
  CalendarEventTypeKey,
  CalendarMeetingProviderKey,
  CalendarOutlookCalendarSummary,
  CalendarOutlookConnectionSummary,
  CalendarOutlookEventSyncSummary,
  CalendarOutlookPolicySummary,
  ListCalendarOutlookCalendarsResponse,
  StartCalendarOutlookConnectionResponse,
  SyncCalendarOutlookEventRequest,
  SyncCalendarOutlookEventResponse,
  UpdateCalendarOutlookConnectionRequest,
} from '@pulse/contracts';
import { createHash, randomBytes } from 'node:crypto';
import type { AppConfig } from '../../config.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import { decryptSecret, encryptSecret } from '../../utils/secrets.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { resolveCalendarEventForSync } from './events.js';
import {
  canActorUseOutlookCalendar,
  getOutlookCalendarAdminSettings,
  getOutlookPolicySummaryForActor,
  shouldAutoSyncOutlookEvent,
} from './policy.js';

type OutlookTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type OutlookProfileResponse = {
  id: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
};

type OutlookCalendarOwner = {
  name?: string | null;
  address?: string | null;
};

type OutlookCalendarEntryResponse = {
  id: string;
  name?: string | null;
  canEdit?: boolean | null;
  canShare?: boolean | null;
  isDefaultCalendar?: boolean | null;
  owner?: OutlookCalendarOwner | null;
  allowedOnlineMeetingProviders?: string[] | null;
};

type OutlookCalendarListResponse = {
  value?: OutlookCalendarEntryResponse[];
};

type OutlookEventResponse = {
  id: string;
  webLink?: string;
  onlineMeeting?: {
    joinUrl?: string | null;
  } | null;
};

type WorkspaceBindingMap = Map<string, CalendarOutlookEventSyncSummary>;

export class CalendarIntegrationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalendarIntegrationUnavailableError';
  }
}

export async function getOutlookWorkspaceState(
  actor: AuthenticatedActor,
  config: AppConfig,
  items: CalendarEventSummary[],
): Promise<{
  connection: CalendarOutlookConnectionSummary;
  bindings: WorkspaceBindingMap;
}> {
  const policyState = await getOutlookPolicySummaryForActor(actor, config);

  if (!config.outlookCalendar.enabled) {
    return {
      connection: buildConnectionSummary(null, false, [], policyState),
      bindings: new Map(),
    };
  }

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    return {
      connection: buildConnectionSummary(null, true, config.outlookCalendar.scopes, policyState),
      bindings: new Map(),
    };
  }

  const bindings = items.length > 0
    ? await prisma.calendarEventBinding.findMany({
      where: {
        connectionId: connection.id,
        OR: items.map((item) => ({
          sourceModule: item.sourceModule,
          sourceRecordId: item.sourceRecordId,
          eventType: item.eventType,
        })),
      },
    })
    : [];

  return {
    connection: buildConnectionSummary(connection, true, config.outlookCalendar.scopes, policyState),
    bindings: new Map(
      bindings.map((binding) => [
        createBindingKey(binding.sourceModule, binding.sourceRecordId, binding.eventType),
        {
          ...(binding.lastSyncedAt ? { syncedAt: binding.lastSyncedAt.toISOString() } : {}),
          ...(binding.externalWebLink ? { externalWebLink: binding.externalWebLink } : {}),
          ...(binding.externalMeetingJoinUrl ? { meetingJoinUrl: binding.externalMeetingJoinUrl } : {}),
          ...(binding.lastSyncError ? { lastSyncError: binding.lastSyncError } : {}),
        },
      ]),
    ),
  };
}

export async function listOutlookCalendars(
  actor: AuthenticatedActor,
  config: AppConfig,
): Promise<ListCalendarOutlookCalendarsResponse> {
  requireConfiguredOutlook(config);
  await ensureActorCanUseOutlookCalendar(actor, config);

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    throw new Error('Connect Outlook before loading available calendars');
  }

  const accessToken = await ensureActiveAccessToken(config, connection);
  const policyState = await getOutlookPolicySummaryForActor(actor, config);
  const items = filterCalendarsByPolicy(
    await fetchOutlookCalendars(config, accessToken),
    policyState.policy.sharedCalendarsEnabled,
    connection.providerEmail,
  );
  return { items };
}

export async function updateOutlookConnection(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: UpdateCalendarOutlookConnectionRequest,
): Promise<CalendarOutlookConnectionSummary> {
  const outlook = requireConfiguredOutlook(config);
  await ensureActorCanUseOutlookCalendar(actor, config);
  const policyState = await getOutlookPolicySummaryForActor(actor, config);
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    throw new Error('Connect Outlook before updating calendar settings');
  }

  const accessToken = await ensureActiveAccessToken(config, connection);
  const availableCalendars = filterCalendarsByPolicy(
    await fetchOutlookCalendars(config, accessToken),
    policyState.policy.sharedCalendarsEnabled,
    connection.providerEmail,
  );
  const requestedMeetingProvider = input.meetingProvider
    ? toMeetingProviderPreference(input.meetingProvider)
    : connection.meetingProviderPreference ?? toMeetingProviderPreference(policyState.policy.defaultMeetingProvider);

  let targetCalendarId: string | null = connection.targetCalendarId ?? null;
  let targetCalendarName: string | null = connection.targetCalendarName ?? null;

  if (input.targetCalendarId !== undefined) {
    if (input.targetCalendarId !== null && input.targetCalendarId.trim()) {
      const selected = availableCalendars.find((entry) => entry.id === input.targetCalendarId?.trim());
      if (!selected) {
        throw new Error('Selected Outlook calendar was not found for the current mailbox');
      }
      if (!selected.canEdit) {
        throw new Error('Selected Outlook calendar is not editable with the current mailbox permissions');
      }
      if (requestedMeetingProvider === CalendarMeetingProviderPreference.TEAMS && !selected.supportsTeamsMeetings) {
        throw new Error('Selected Outlook calendar does not support Teams meeting links');
      }
      targetCalendarId = selected.id;
      targetCalendarName = selected.name;
    } else {
      targetCalendarId = null;
      targetCalendarName = null;
    }
  }

  if (targetCalendarId) {
    const selected = availableCalendars.find((entry) => entry.id === targetCalendarId);
    if (!selected) {
      targetCalendarId = null;
      targetCalendarName = null;
    } else {
      targetCalendarName = selected.name;
      if (requestedMeetingProvider === CalendarMeetingProviderPreference.TEAMS && !selected.supportsTeamsMeetings) {
        throw new Error('Selected Outlook calendar does not support Teams meeting links');
      }
    }
  } else if (requestedMeetingProvider === CalendarMeetingProviderPreference.TEAMS) {
    const primary = availableCalendars.find((entry) => entry.isDefault) ?? availableCalendars[0] ?? null;
    if (primary && !primary.supportsTeamsMeetings) {
      throw new Error('The primary Outlook calendar does not support Teams meeting links');
    }
  }

  const updated = await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      targetCalendarId,
      targetCalendarName,
      meetingProviderPreference: requestedMeetingProvider,
      lastSyncError: null,
    },
  });

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.UPDATE,
      entityType: 'calendar_connection',
      entityId: updated.id,
      sourceSystem: 'outlook',
      metadata: {
        provider: 'outlook',
        targetCalendarId,
        targetCalendarName,
        meetingProviderPreference: requestedMeetingProvider.toLowerCase(),
      },
    }),
  });

  return buildConnectionSummary(updated, true, outlook.scopes, policyState);
}

export async function startOutlookConnection(
  actor: AuthenticatedActor,
  config: AppConfig,
): Promise<StartCalendarOutlookConnectionResponse> {
  const outlook = requireConfiguredOutlook(config);
  await ensureActorCanUseOutlookCalendar(actor, config);
  const state = randomBytes(32).toString('base64url');
  const stateHash = hashState(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.calendarConnectionAuthState.create({
    data: {
      userId: actor.userId,
      provider: CalendarConnectionProvider.OUTLOOK,
      stateHash,
      expiresAt,
    },
  });

  const authorizationUrl = new URL(`${outlook.authBaseUrl.replace(/\/$/, '')}/${outlook.tenantId}/oauth2/v2.0/authorize`);
  authorizationUrl.searchParams.set('client_id', outlook.clientId);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('redirect_uri', outlook.redirectUri);
  authorizationUrl.searchParams.set('response_mode', 'query');
  authorizationUrl.searchParams.set('scope', outlook.scopes.join(' '));
  authorizationUrl.searchParams.set('state', state);
  authorizationUrl.searchParams.set('prompt', 'select_account');

  return {
    provider: 'outlook',
    authorizationUrl: authorizationUrl.toString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function completeOutlookConnection(
  config: AppConfig,
  params: {
    code?: string | null;
    state?: string | null;
    error?: string | null;
    errorDescription?: string | null;
  },
) {
  const calendarRedirectUrl = new URL('/calendar', config.web.publicBaseUrl).toString();

  if (params.error) {
    return {
      redirectUrl: appendCalendarStatus(calendarRedirectUrl, 'error', params.errorDescription ?? params.error),
    };
  }

  const outlook = requireConfiguredOutlook(config);
  const code = params.code?.trim();
  const state = params.state?.trim();

  if (!code || !state) {
    return {
      redirectUrl: appendCalendarStatus(calendarRedirectUrl, 'error', 'Missing Outlook authorization code or state'),
    };
  }

  const authState = await prisma.calendarConnectionAuthState.findUnique({
    where: {
      stateHash: hashState(state),
    },
  });

  if (!authState || authState.provider !== CalendarConnectionProvider.OUTLOOK) {
    return {
      redirectUrl: appendCalendarStatus(calendarRedirectUrl, 'error', 'Outlook authorization state was not recognized'),
    };
  }

  if (authState.usedAt || authState.expiresAt.getTime() < Date.now()) {
    return {
      redirectUrl: appendCalendarStatus(calendarRedirectUrl, 'error', 'Outlook authorization state expired'),
    };
  }

  const tokenResponse = await exchangeToken(config, {
    grant_type: 'authorization_code',
    code,
  });
  const profile = await fetchOutlookProfile(config, tokenResponse.accessToken);
  const providerEmail = profile.mail ?? profile.userPrincipalName ?? null;
  const settings = await getOutlookCalendarAdminSettings(config);
  const defaultMeetingProvider = toMeetingProviderPreference(settings.policy.defaultMeetingProvider);

  await prisma.$transaction(async (tx) => {
    await tx.calendarConnection.upsert({
      where: {
        userId_provider: {
          userId: authState.userId,
          provider: CalendarConnectionProvider.OUTLOOK,
        },
      },
      create: {
        userId: authState.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
        providerSubject: profile.id,
        providerEmail,
        scope: tokenResponse.scope,
        accessTokenEncrypted: encryptSecret(tokenResponse.accessToken, outlook.encryptionKey),
        refreshTokenEncrypted: encryptSecret(tokenResponse.refreshToken, outlook.encryptionKey),
        accessTokenExpiresAt: tokenResponse.expiresAt,
        meetingProviderPreference: defaultMeetingProvider,
        isActive: true,
      },
      update: {
        providerSubject: profile.id,
        providerEmail,
        scope: tokenResponse.scope,
        accessTokenEncrypted: encryptSecret(tokenResponse.accessToken, outlook.encryptionKey),
        refreshTokenEncrypted: encryptSecret(tokenResponse.refreshToken, outlook.encryptionKey),
        accessTokenExpiresAt: tokenResponse.expiresAt,
        meetingProviderPreference: defaultMeetingProvider,
        isActive: true,
        lastSyncError: null,
      },
    });

    await tx.calendarConnectionAuthState.update({
      where: { id: authState.id },
      data: { usedAt: new Date() },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: authState.userId,
        action: AuditAction.SYNC,
        entityType: 'calendar_connection',
        entityId: authState.userId,
        sourceSystem: 'outlook',
        metadata: {
          provider: 'outlook',
          providerEmail,
          result: 'connected',
        },
      }),
    });
  });

  return {
    redirectUrl: appendCalendarStatus(calendarRedirectUrl, 'connected'),
  };
}

export async function disconnectOutlookConnection(
  actor: AuthenticatedActor,
  config: AppConfig,
): Promise<CalendarOutlookConnectionSummary> {
  if (!config.outlookCalendar.enabled) {
    return buildConnectionSummary(null, false);
  }

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    return buildConnectionSummary(null, true, config.outlookCalendar.scopes);
  }

  await prisma.$transaction(async (tx) => {
    await tx.calendarEventBinding.deleteMany({
      where: {
        connectionId: connection.id,
      },
    });

    await tx.calendarConnection.delete({
      where: { id: connection.id },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.LOGOUT,
        entityType: 'calendar_connection',
        entityId: connection.id,
        sourceSystem: 'outlook',
        metadata: {
          provider: 'outlook',
          providerEmail: connection.providerEmail ?? null,
          result: 'disconnected',
        },
      }),
    });
  });

  return buildConnectionSummary(null, true, config.outlookCalendar.scopes);
}

export async function tryAutoSyncCalendarEventToOutlook(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: SyncCalendarOutlookEventRequest,
): Promise<void> {
  if (!config.outlookCalendar.enabled) {
    return;
  }

  if (!await shouldAttemptAutoSync(actor, config, input.sourceModule)) {
    return;
  }

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    return;
  }

  try {
    await syncCalendarEventToOutlook(actor, config, input);
  } catch (error) {
    await prisma.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.SYNC,
        entityType: 'calendar_event_binding',
        entityId: connection.id,
        sourceSystem: 'outlook',
        metadata: {
          provider: 'outlook',
          sourceModule: input.sourceModule,
          sourceRecordId: input.sourceRecordId,
          eventType: input.eventType,
          result: 'auto_sync_failed',
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    });
  }
}

export async function tryAutoUnsyncCalendarEventFromOutlook(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: SyncCalendarOutlookEventRequest,
  reason: string,
): Promise<void> {
  if (!config.outlookCalendar.enabled) {
    return;
  }

  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    return;
  }

  try {
    await removeCalendarEventFromOutlook(actor, config, input, reason);
  } catch (error) {
    await prisma.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.SYNC,
        entityType: 'calendar_event_binding',
        entityId: connection.id,
        sourceSystem: 'outlook',
        metadata: {
          provider: 'outlook',
          sourceModule: input.sourceModule,
          sourceRecordId: input.sourceRecordId,
          eventType: input.eventType,
          result: 'auto_unsync_failed',
          reason,
          error: error instanceof Error ? error.message : String(error),
        },
      }),
    });
  }
}

export async function syncCalendarEventToOutlook(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: SyncCalendarOutlookEventRequest,
): Promise<SyncCalendarOutlookEventResponse> {
  requireConfiguredOutlook(config);
  await ensureActorCanUseOutlookCalendar(actor, config);
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    throw new Error('Connect Outlook before syncing calendar events');
  }

  const binding = await prisma.calendarEventBinding.findUnique({
    where: {
      connectionId_sourceModule_sourceRecordId_eventType: {
        connectionId: connection.id,
        sourceModule: input.sourceModule,
        sourceRecordId: input.sourceRecordId,
        eventType: input.eventType,
      },
    },
  });

  const event = await resolveCalendarEventForSync(actor, input);

  try {
    const activeAccessToken = await ensureActiveAccessToken(config, connection);
    const payload = buildOutlookEventPayload(event, config.web.publicBaseUrl, connection);
    const shouldRecreate =
      Boolean(
        binding
        && (
          (binding.targetCalendarId ?? null) !== (connection.targetCalendarId ?? null)
          || binding.meetingProvider !== connection.meetingProviderPreference
        ),
      );

    if (binding && shouldRecreate) {
      await deleteOutlookEvent(config, activeAccessToken, binding.externalEventId);
    }

    const createdNewEvent = !(binding && !shouldRecreate);
    const response = binding && !shouldRecreate
      ? await patchOutlookEvent(config, activeAccessToken, binding.externalEventId, payload)
      : await createOutlookEvent(config, activeAccessToken, connection, payload);
    const syncedAt = new Date();
    const externalWebLink = response.webLink ?? null;
    const externalMeetingJoinUrl = response.onlineMeeting?.joinUrl ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.calendarConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: syncedAt,
          lastSyncError: null,
        },
      });

      await tx.calendarEventBinding.upsert({
        where: {
          connectionId_sourceModule_sourceRecordId_eventType: {
            connectionId: connection.id,
            sourceModule: input.sourceModule,
            sourceRecordId: input.sourceRecordId,
            eventType: input.eventType,
          },
        },
        create: {
          connectionId: connection.id,
          provider: CalendarConnectionProvider.OUTLOOK,
          sourceModule: input.sourceModule,
          sourceRecordId: input.sourceRecordId,
          eventType: input.eventType,
          externalEventId: response.id,
          externalWebLink,
          externalMeetingJoinUrl,
          targetCalendarId: connection.targetCalendarId ?? null,
          meetingProvider: connection.meetingProviderPreference,
          lastSyncedAt: syncedAt,
          lastSyncError: null,
        },
        update: {
          externalEventId: response.id,
          externalWebLink,
          externalMeetingJoinUrl,
          targetCalendarId: connection.targetCalendarId ?? null,
          meetingProvider: connection.meetingProviderPreference,
          lastSyncedAt: syncedAt,
          lastSyncError: null,
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.SYNC,
          entityType: 'calendar_event_binding',
          entityId: connection.id,
          sourceSystem: 'outlook',
          metadata: {
            provider: 'outlook',
            sourceModule: input.sourceModule,
            sourceRecordId: input.sourceRecordId,
            eventType: input.eventType,
            externalEventId: response.id,
          },
        }),
      });
    }).catch(async (persistError) => {
      // The Graph event was created/patched but persisting its local binding failed. For a freshly CREATED
      // event there is no binding row, so the next sync would call createOutlookEvent again and leave a
      // DUPLICATE in the user's Outlook. Best-effort: delete the orphan we just created so a retry starts clean.
      // (The payload's transactionId dedup is only a partial, time-bounded backstop.) Never delete an event we
      // merely patched — that one was already bound.
      if (createdNewEvent) {
        try {
          await deleteOutlookEvent(config, activeAccessToken, response.id);
        } catch {
          // Swallow — surface the original persist error (the outer catch records it as lastSyncError).
        }
      }
      throw persistError;
    });

    return {
      provider: 'outlook',
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
      eventType: input.eventType,
      externalEventId: response.id,
      ...(response.webLink ? { externalWebLink: response.webLink } : {}),
      ...(externalMeetingJoinUrl ? { meetingJoinUrl: externalMeetingJoinUrl } : {}),
      syncedAt: syncedAt.toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.$transaction(async (tx) => {
      await tx.calendarConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncError: message,
        },
      });

      if (binding) {
        await tx.calendarEventBinding.update({
          where: { id: binding.id },
          data: {
            lastSyncError: message,
          },
        });
      }
    });

    throw error;
  }
}

async function removeCalendarEventFromOutlook(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: SyncCalendarOutlookEventRequest,
  reason: string,
) {
  requireConfiguredOutlook(config);
  const connection = await prisma.calendarConnection.findUnique({
    where: {
      userId_provider: {
        userId: actor.userId,
        provider: CalendarConnectionProvider.OUTLOOK,
      },
    },
  });

  if (!connection) {
    return;
  }

  const binding = await prisma.calendarEventBinding.findUnique({
    where: {
      connectionId_sourceModule_sourceRecordId_eventType: {
        connectionId: connection.id,
        sourceModule: input.sourceModule,
        sourceRecordId: input.sourceRecordId,
        eventType: input.eventType,
      },
    },
  });

  if (!binding) {
    return;
  }

  try {
    const accessToken = await ensureActiveAccessToken(config, connection);
    await deleteOutlookEvent(config, accessToken, binding.externalEventId);

    await prisma.$transaction(async (tx) => {
      await tx.calendarConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          lastSyncError: null,
        },
      });

      await tx.calendarEventBinding.delete({
        where: { id: binding.id },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.SYNC,
          entityType: 'calendar_event_binding',
          entityId: binding.id,
          sourceSystem: 'outlook',
          metadata: {
            provider: 'outlook',
            sourceModule: input.sourceModule,
            sourceRecordId: input.sourceRecordId,
            eventType: input.eventType,
            externalEventId: binding.externalEventId,
            result: 'removed',
            reason,
          },
        }),
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await prisma.$transaction(async (tx) => {
      await tx.calendarConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncError: message,
        },
      });

      await tx.calendarEventBinding.update({
        where: { id: binding.id },
        data: {
          lastSyncError: message,
        },
      });
    });

    throw error;
  }
}

function buildConnectionSummary(
  connection: {
    providerEmail: string | null;
    targetCalendarId?: string | null;
    targetCalendarName?: string | null;
    meetingProviderPreference?: CalendarMeetingProviderPreference;
    createdAt: Date;
    accessTokenExpiresAt: Date;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
  } | null,
  isConfigured: boolean,
  scopes: string[] = [],
  policyState?: {
    configurationIssues: string[];
    availabilityMessage?: string;
    policy: CalendarOutlookPolicySummary;
  },
): CalendarOutlookConnectionSummary {
  if (!connection) {
    return {
      provider: 'outlook',
      isConfigured,
      isConnected: false,
      ...(policyState?.configurationIssues.length ? { configurationIssues: policyState.configurationIssues } : {}),
      ...(policyState?.availabilityMessage ? { availabilityMessage: policyState.availabilityMessage } : {}),
      ...(policyState?.policy ? { policy: policyState.policy } : {}),
      ...(isConfigured
        ? {
            supportsSharedCalendars: scopes.includes('Calendars.ReadWrite.Shared'),
            supportsTeamsMeetings: true,
            meetingProvider: policyState?.policy.defaultMeetingProvider ?? ('none' as const),
          }
        : {}),
    };
  }

  return {
    provider: 'outlook',
    isConfigured,
    isConnected: true,
    supportsSharedCalendars: scopes.includes('Calendars.ReadWrite.Shared'),
    supportsTeamsMeetings: true,
    ...(policyState?.configurationIssues.length ? { configurationIssues: policyState.configurationIssues } : {}),
    ...(policyState?.availabilityMessage ? { availabilityMessage: policyState.availabilityMessage } : {}),
    ...(policyState?.policy ? { policy: policyState.policy } : {}),
    ...(connection.providerEmail ? { connectionEmail: connection.providerEmail } : {}),
    ...(connection.targetCalendarId ? { targetCalendarId: connection.targetCalendarId } : {}),
    ...(connection.targetCalendarName ? { targetCalendarName: connection.targetCalendarName } : {}),
    meetingProvider: fromMeetingProviderPreference(connection.meetingProviderPreference ?? CalendarMeetingProviderPreference.NONE),
    connectedAt: connection.createdAt.toISOString(),
    accessTokenExpiresAt: connection.accessTokenExpiresAt.toISOString(),
    ...(connection.lastSyncedAt ? { lastSyncedAt: connection.lastSyncedAt.toISOString() } : {}),
    ...(connection.lastSyncError ? { lastSyncError: connection.lastSyncError } : {}),
  };
}

function requireConfiguredOutlook(config: AppConfig) {
  if (
    !config.outlookCalendar.enabled
    || !config.outlookCalendar.tenantId
    || !config.outlookCalendar.clientId
    || !config.outlookCalendar.clientSecret
    || !config.outlookCalendar.redirectUri
    || !config.outlookCalendar.encryptionKey
  ) {
    throw new CalendarIntegrationUnavailableError('Outlook calendar integration is not configured');
  }

  return {
    tenantId: config.outlookCalendar.tenantId,
    clientId: config.outlookCalendar.clientId,
    clientSecret: config.outlookCalendar.clientSecret,
    redirectUri: config.outlookCalendar.redirectUri,
    scopes: config.outlookCalendar.scopes,
    authBaseUrl: config.outlookCalendar.authBaseUrl,
    graphBaseUrl: config.outlookCalendar.graphBaseUrl,
    encryptionKey: config.outlookCalendar.encryptionKey,
  };
}

async function ensureActorCanUseOutlookCalendar(actor: AuthenticatedActor, config: AppConfig) {
  const policyState = await getOutlookPolicySummaryForActor(actor, config);
  if (!policyState.isConfigured) {
    throw new CalendarIntegrationUnavailableError(policyState.availabilityMessage ?? 'Outlook calendar integration is not configured');
  }

  if (!await canActorUseOutlookCalendar(actor, config)) {
    throw new CalendarIntegrationUnavailableError(policyState.availabilityMessage ?? 'Outlook calendar sync is not enabled for this user');
  }
}

async function shouldAttemptAutoSync(
  actor: AuthenticatedActor,
  config: AppConfig,
  sourceModule: 'leads' | 'training',
) {
  return shouldAutoSyncOutlookEvent(actor, config, sourceModule);
}

function filterCalendarsByPolicy(
  items: CalendarOutlookCalendarSummary[],
  sharedCalendarsEnabled: boolean,
  providerEmail: string | null,
) {
  if (sharedCalendarsEnabled) {
    return items;
  }

  const normalizedProviderEmail = providerEmail?.trim().toLowerCase();
  return items.filter((entry) => {
    const ownerAddress = entry.ownerAddress?.trim().toLowerCase();
    return entry.isDefault || !ownerAddress || ownerAddress === normalizedProviderEmail;
  });
}

async function ensureActiveAccessToken(
  config: AppConfig,
  connection: {
    id: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted: string;
    accessTokenExpiresAt: Date;
  },
) {
  const outlook = requireConfiguredOutlook(config);

  if (connection.accessTokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(connection.accessTokenEncrypted, outlook.encryptionKey);
  }

  const refreshToken = decryptSecret(connection.refreshTokenEncrypted, outlook.encryptionKey);
  const refreshed = await exchangeToken(config, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptSecret(refreshed.accessToken, outlook.encryptionKey),
      refreshTokenEncrypted: encryptSecret(refreshed.refreshToken, outlook.encryptionKey),
      accessTokenExpiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
      lastSyncError: null,
    },
  });

  return refreshed.accessToken;
}

async function exchangeToken(
  config: AppConfig,
  input: {
    grant_type: 'authorization_code';
    code: string;
  } | {
    grant_type: 'refresh_token';
    refresh_token: string;
  },
) {
  const outlook = requireConfiguredOutlook(config);
  const body = new URLSearchParams({
    client_id: outlook.clientId,
    client_secret: outlook.clientSecret,
    redirect_uri: outlook.redirectUri,
    scope: outlook.scopes.join(' '),
    grant_type: input.grant_type,
    ...(input.grant_type === 'authorization_code'
      ? { code: input.code }
      : { refresh_token: input.refresh_token }),
  });

  const response = await fetch(
    `${outlook.authBaseUrl.replace(/\/$/, '')}/${outlook.tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    },
  );

  const payload = (await response.json()) as OutlookTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description ?? payload.error ?? 'Failed to exchange Outlook authorization code');
  }

  if (input.grant_type === 'authorization_code' && !payload.refresh_token) {
    throw new Error('Outlook did not return a refresh token');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? (input.grant_type === 'refresh_token' ? input.refresh_token : ''),
    expiresAt: new Date(Date.now() + Math.max(payload.expires_in ?? 3600, 300) * 1000),
    scope: payload.scope ?? outlook.scopes.join(' '),
  };
}

async function fetchOutlookProfile(config: AppConfig, accessToken: string) {
  const response = await fetch(`${config.outlookCalendar.graphBaseUrl.replace(/\/$/, '')}/me`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = (await response.json()) as OutlookProfileResponse & { error?: unknown };
  if (!response.ok || !payload.id) {
    throw new Error('Failed to read Outlook profile');
  }

  return payload;
}

async function fetchOutlookCalendars(config: AppConfig, accessToken: string): Promise<CalendarOutlookCalendarSummary[]> {
  const response = await fetch(
    `${config.outlookCalendar.graphBaseUrl.replace(/\/$/, '')}/me/calendars?$select=id,name,canEdit,canShare,isDefaultCalendar,owner,allowedOnlineMeetingProviders`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const payload = (await response.json()) as OutlookCalendarListResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? 'Failed to read Outlook calendars');
  }

  return (payload.value ?? [])
    .map((entry) => ({
      id: entry.id,
      name: entry.name?.trim() || 'Unnamed calendar',
      ...(entry.owner?.name ? { ownerName: entry.owner.name } : {}),
      ...(entry.owner?.address ? { ownerAddress: entry.owner.address } : {}),
      canEdit: entry.canEdit !== false,
      ...(entry.canShare !== undefined && entry.canShare !== null ? { canShare: entry.canShare } : {}),
      isDefault: entry.isDefaultCalendar === true,
      supportsTeamsMeetings: (entry.allowedOnlineMeetingProviders ?? []).includes('teamsForBusiness'),
    }))
    .sort((left, right) => Number(right.isDefault) - Number(left.isDefault) || left.name.localeCompare(right.name));
}

async function createOutlookEvent(
  config: AppConfig,
  accessToken: string,
  connection: {
    targetCalendarId: string | null;
  },
  payload: Record<string, unknown>,
) {
  const path = connection.targetCalendarId
    ? `/me/calendars/${encodeURIComponent(connection.targetCalendarId)}/events`
    : '/me/events';
  return sendOutlookEventRequest(config, accessToken, path, 'POST', payload);
}

async function patchOutlookEvent(
  config: AppConfig,
  accessToken: string,
  eventId: string,
  payload: Record<string, unknown>,
) {
  return sendOutlookEventRequest(
    config,
    accessToken,
    `/me/events/${encodeURIComponent(eventId)}`,
    'PATCH',
    payload,
  );
}

async function deleteOutlookEvent(
  config: AppConfig,
  accessToken: string,
  eventId: string,
) {
  const response = await fetch(
    `${config.outlookCalendar.graphBaseUrl.replace(/\/$/, '')}/me/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.status === 404) {
    return;
  }

  if (!response.ok) {
    const bodyText = await response.text();
    const body = bodyText ? JSON.parse(bodyText) as { error?: { message?: string } } : null;
    throw new Error(body?.error?.message ?? 'Failed to remove synced Outlook event');
  }
}

async function sendOutlookEventRequest(
  config: AppConfig,
  accessToken: string,
  path: string,
  method: 'POST' | 'PATCH',
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${config.outlookCalendar.graphBaseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  const body = bodyText ? (JSON.parse(bodyText) as OutlookEventResponse & { error?: { message?: string } }) : null;
  if (response.status === 204 && method === 'PATCH') {
    return {
      id: eventIdFromPath(path),
    };
  }

  if (!response.ok || !body?.id) {
    throw new Error(body?.error?.message ?? 'Failed to sync event to Outlook');
  }

  return body;
}

function buildOutlookEventPayload(
  event: CalendarEventSummary,
  webBaseUrl: string,
  connection: {
    meetingProviderPreference: CalendarMeetingProviderPreference;
  },
) {
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt
    ? new Date(event.endsAt)
    : new Date(startsAt.getTime() + defaultDurationMinutes(event.eventType) * 60_000);
  const absoluteSourceUrl = new URL(event.sourcePath, webBaseUrl).toString();
  const locationName = event.locationName ?? event.territoryName ?? event.regionName;
  const bodyLines = [
    `<p>Synced from Pulse CRM centralized calendar.</p>`,
    `<p><strong>Type:</strong> ${escapeHtml(event.eventType)}</p>`,
    ...(event.notes ? [`<p>${escapeHtml(event.notes)}</p>`] : []),
    `<p><strong>Pulse record:</strong> <a href="${escapeHtml(absoluteSourceUrl)}">${escapeHtml(absoluteSourceUrl)}</a></p>`,
  ];
  const shouldCreateTeamsMeeting =
    connection.meetingProviderPreference === CalendarMeetingProviderPreference.TEAMS
    && supportsOnlineMeeting(event.eventType);

  return {
    subject: event.title,
    body: {
      contentType: 'HTML',
      content: bodyLines.join(''),
    },
    start: {
      dateTime: startsAt.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: endsAt.toISOString(),
      timeZone: 'UTC',
    },
    ...(locationName
      ? {
        location: {
          displayName: locationName,
        },
      }
      : {}),
    categories: ['Pulse CRM', normalizeCategory(event.eventType)],
    transactionId: event.id,
    ...(shouldCreateTeamsMeeting
      ? {
          isOnlineMeeting: true,
          onlineMeetingProvider: 'teamsForBusiness',
        }
      : {}),
  };
}

function createBindingKey(sourceModule: string, sourceRecordId: string, eventType: string) {
  return `${sourceModule}:${sourceRecordId}:${eventType}`;
}

function eventIdFromPath(path: string) {
  return path.split('/').at(-1) ?? '';
}

function defaultDurationMinutes(eventType: CalendarEventTypeKey) {
  switch (eventType) {
    case 'discovery_call':
      return 30;
    case 'on_site_visit':
      return 120;
    default:
      return 60;
  }
}

function normalizeCategory(eventType: CalendarEventTypeKey) {
  return eventType.replace(/_/g, ' ');
}

function supportsOnlineMeeting(eventType: CalendarEventTypeKey) {
  return eventType === 'discovery_call' || eventType === 'virtual_training';
}

function toMeetingProviderPreference(value: CalendarMeetingProviderKey) {
  return value === 'teams'
    ? CalendarMeetingProviderPreference.TEAMS
    : CalendarMeetingProviderPreference.NONE;
}

function fromMeetingProviderPreference(value: CalendarMeetingProviderPreference): CalendarMeetingProviderKey {
  return value === CalendarMeetingProviderPreference.TEAMS ? 'teams' : 'none';
}

function hashState(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function appendCalendarStatus(baseUrl: string, status: 'connected' | 'error', detail?: string) {
  const url = new URL(baseUrl);
  url.searchParams.set('outlook', status);
  if (detail) {
    url.searchParams.set('outlookMessage', detail);
  }
  return url.toString();
}

import { createHash } from 'node:crypto';
import type { AppConfig } from '../../config.js';
import {
  LeadLifecycleStatus,
  LeadOperationalAlertDeliveryMode,
  LeadOperationalAlertDeliveryStatus,
  LeadOperationalAlertType,
  LeadRoutingTeam,
  LeadStage,
  Prisma,
  prisma,
} from '@pulse/db';
import { syncLeadAlertNotifications, syncLeadCisReceivedNotifications } from '../notifications/bridge.js';
import type { QueueJob, QueueManager } from '../../queue/contracts.js';
import { LEAD_OPERATIONAL_ALERT_DELIVERY_QUEUE } from '../../queue/definitions.js';
import type { AppLogger } from '../../utils/logger.js';
import type {
  AdminLeadOperationalAlertDeliverySettingsResponse,
  DeadLetterLeadOperationalAlertDeliveriesRequest,
  DeadLetterLeadOperationalAlertDeliveriesResponse,
  RetryLeadOperationalAlertDeliveriesRequest,
  RetryLeadOperationalAlertDeliveriesResponse,
} from '@pulse/contracts/leads';
import type { AuthenticatedActor } from '../auth/types.js';

const MAX_SCAN_LIMIT = 500;
const LEAD_OPERATIONAL_ALERT_DELIVERY_PROVIDER_KEY = 'pulse.lead-operational-alert.preview';
const LEAD_OPERATIONAL_ALERT_DELIVERY_DISABLED_PROVIDER_KEY = 'pulse.lead-operational-alert.disabled';
const LEAD_OPERATIONAL_ALERT_DELIVERY_MICROSOFT_GRAPH_PROVIDER_KEY = 'microsoft_graph.sendMail';
const LEAD_OPERATIONAL_ALERT_DELIVERY_ADMIN_PROVIDER_KEY = 'pulse.lead-operational-alert.admin';
const LEAD_OPERATIONAL_ALERT_DELIVERY_RETRY_LIMIT = 50;

const DEFAULT_STRATEGIC_GROWTH_ALERT_RECIPIENTS = [
  {
    code: 'sgt_michelle_hogan',
    routingTeam: LeadRoutingTeam.STRATEGIC_GROWTH,
    name: 'Michelle Hogan',
    roleTitle: 'Strategic Growth',
    sortOrder: 10,
  },
  {
    code: 'sgt_adrienne_cardinale',
    routingTeam: LeadRoutingTeam.STRATEGIC_GROWTH,
    name: 'Adrienne Cardinale',
    roleTitle: 'Strategic Growth',
    sortOrder: 20,
  },
  {
    code: 'sgt_gabriella',
    routingTeam: LeadRoutingTeam.STRATEGIC_GROWTH,
    name: 'Gabriella',
    roleTitle: 'Strategic Growth',
    sortOrder: 30,
  },
] as const;

type LeadOperationalAlertScanJobData = {
  limit?: number;
};

type LeadOperationalAlertDeliveryJobData = {
  alertId?: string;
};

type LeadOperationalAlertScanDependencies = {
  queue?: QueueManager;
  logger?: AppLogger;
};

type LeadOperationalRoutingRecord = {
  id: string;
  createdAt: Date;
  routingTeam: LeadRoutingTeam;
  assignedTmUserId: string | null;
  assignedTmName: string | null;
  assignedRdUserId: string | null;
  assignedRdUser: {
    displayName: string | null;
  } | null;
};

type LeadRoutingPolicySnapshot = {
  initialContactManagerEscalationDelayHours: number;
  initialContactLeadershipEscalationDelayHours: number;
  operationalAlertQuietHoursEnabled: boolean;
  operationalAlertQuietHoursStartLocal: string;
  operationalAlertQuietHoursEndLocal: string;
  operationalAlertQuietHoursTimeZone: string;
};

type LeadOperationalAlertDeliveryRecord = Prisma.LeadOperationalAlertGetPayload<{
  include: {
    lead: {
      select: {
        id: true;
        companyName: true;
        state: true;
        serviceTechCount: true;
        potentialValueCents: true;
      };
    };
    recipient: true;
    recipientUser: {
      select: {
        id: true;
        displayName: true;
        email: true;
      };
    };
  };
}>;

type DeliveryMessage = {
  recipientName: string;
  recipientEmail: string | null;
  subject: string;
  previewBody: string;
  metadata: Prisma.InputJsonValue;
};

type LeadOperationalAlertDeliveryDependencies = {
  fetch?: typeof fetch;
};

type LeadOperationalAlertDeliveryModeKey = AdminLeadOperationalAlertDeliverySettingsResponse['mode'];

export async function ensureLeadOperationalAlertRecipientsSeeded() {
  await Promise.all(
    DEFAULT_STRATEGIC_GROWTH_ALERT_RECIPIENTS.map((recipient) =>
      prisma.leadOperationalAlertRecipient.upsert({
        where: { code: recipient.code },
        update: {
          routingTeam: recipient.routingTeam,
          name: recipient.name,
          roleTitle: recipient.roleTitle,
          sortOrder: recipient.sortOrder,
        },
        create: {
          code: recipient.code,
          routingTeam: recipient.routingTeam,
          name: recipient.name,
          roleTitle: recipient.roleTitle,
          sortOrder: recipient.sortOrder,
          isActive: true,
        },
      }),
    ),
  );
}

export async function processLeadOperationalAlertScanJob(
  job: QueueJob<unknown>,
  deps: LeadOperationalAlertScanDependencies = {},
) {
  const payload = parseLeadOperationalAlertScanJobData(job.payload.data);
  await ensureLeadOperationalAlertRecipientsSeeded();

  const now = new Date();
  const policy = await getLeadRoutingPolicySnapshot();
  if (isLeadOperationalAlertQuietHoursActive(policy, now)) {
    deps.logger?.info('lead.operational_alert.scan_skipped', {
      reason: 'quiet_hours',
      timeZone: policy.operationalAlertQuietHoursTimeZone,
      quietHoursStartLocal: policy.operationalAlertQuietHoursStartLocal,
      quietHoursEndLocal: policy.operationalAlertQuietHoursEndLocal,
      correlationId: job.payload.correlationId,
    });

    return {
      ok: true,
      processedLeadCount: 0,
      createdAlertCount: 0,
      enqueuedDeliveryCount: 0,
      skippedReason: 'quiet_hours',
      processedAt: new Date().toISOString(),
    };
  }
  const managerEscalationCutoff = addHours(now, -1 * policy.initialContactManagerEscalationDelayHours);

  const [strategicGrowthRecipients, strategicGrowthLeads, escalationLeads] = await Promise.all([
    prisma.leadOperationalAlertRecipient.findMany({
      where: {
        routingTeam: LeadRoutingTeam.STRATEGIC_GROWTH,
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    }),
    prisma.lead.findMany({
      where: {
        lifecycleStatus: LeadLifecycleStatus.ACTIVE,
        stage: LeadStage.NEW,
        initialContactedAt: null,
        routingTeam: LeadRoutingTeam.STRATEGIC_GROWTH,
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: payload.limit,
      select: {
        id: true,
        createdAt: true,
        routingTeam: true,
        assignedTmUserId: true,
        assignedTmName: true,
        assignedRdUserId: true,
        assignedRdUser: {
          select: {
            displayName: true,
          },
        },
      },
    }),
    prisma.lead.findMany({
      where: {
        lifecycleStatus: LeadLifecycleStatus.ACTIVE,
        stage: LeadStage.NEW,
        initialContactedAt: null,
        routingTeam: LeadRoutingTeam.NATIONAL_TM,
        createdAt: {
          lte: managerEscalationCutoff,
        },
        OR: [
          { assignedTmUserId: { not: null } },
          { assignedRdUserId: { not: null } },
        ],
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: payload.limit,
      select: {
        id: true,
        createdAt: true,
        routingTeam: true,
        assignedTmUserId: true,
        assignedTmName: true,
        assignedRdUserId: true,
        assignedRdUser: {
          select: {
            displayName: true,
          },
        },
      },
    }),
  ]);

  let createdAlertCount = 0;
  let enqueuedDeliveryCount = 0;
  const processedLeadIds = new Set<string>();

  for (const lead of strategicGrowthLeads) {
    processedLeadIds.add(lead.id);
    for (const recipient of strategicGrowthRecipients) {
      const createdAlert = await createLeadOperationalAlert({
        leadId: lead.id,
        alertType: LeadOperationalAlertType.ROUTING_BROADCAST,
        recipientId: recipient.id,
        recipientName: recipient.name,
        ...(recipient.email ? { recipientEmail: recipient.email } : {}),
        metadata: {
          trigger: 'lead.operational-alert-scan',
          routingTeam: lead.routingTeam,
          recipientCode: recipient.code,
          correlationId: job.payload.correlationId,
        },
      });

      if (createdAlert) {
        createdAlertCount += 1;
        if (await enqueueLeadOperationalAlertDelivery(createdAlert.id, job.payload.correlationId, deps)) {
          enqueuedDeliveryCount += 1;
        }
      }
    }
  }

  for (const lead of escalationLeads) {
    const managerEscalationDue = addHours(lead.createdAt, policy.initialContactManagerEscalationDelayHours);
    const leadershipEscalationDue = addHours(lead.createdAt, policy.initialContactLeadershipEscalationDelayHours);
    let leadProcessed = false;

    if (
      managerEscalationDue.getTime() <= now.getTime()
      && (lead.assignedTmUserId || lead.assignedTmName)
    ) {
      const createdAlert = await createLeadOperationalAlert({
        leadId: lead.id,
        alertType: LeadOperationalAlertType.INITIAL_CONTACT_MANAGER_ESCALATION,
        ...(lead.assignedTmUserId ? { recipientUserId: lead.assignedTmUserId } : {}),
        recipientName: lead.assignedTmName ?? 'Assigned Territory Manager',
        metadata: {
          trigger: 'lead.operational-alert-scan',
          correlationId: job.payload.correlationId,
          escalationThresholdHours: policy.initialContactManagerEscalationDelayHours,
        },
      });
      leadProcessed = true;
      if (createdAlert) {
        createdAlertCount += 1;
        if (await enqueueLeadOperationalAlertDelivery(createdAlert.id, job.payload.correlationId, deps)) {
          enqueuedDeliveryCount += 1;
        }
      }
    }

    if (
      leadershipEscalationDue.getTime() <= now.getTime()
      && (lead.assignedRdUserId || lead.assignedRdUser?.displayName)
    ) {
      const createdAlert = await createLeadOperationalAlert({
        leadId: lead.id,
        alertType: LeadOperationalAlertType.INITIAL_CONTACT_LEADERSHIP_ESCALATION,
        ...(lead.assignedRdUserId ? { recipientUserId: lead.assignedRdUserId } : {}),
        recipientName: lead.assignedRdUser?.displayName ?? 'Assigned Regional Director',
        metadata: {
          trigger: 'lead.operational-alert-scan',
          correlationId: job.payload.correlationId,
          escalationThresholdHours: policy.initialContactLeadershipEscalationDelayHours,
        },
      });
      leadProcessed = true;
      if (createdAlert) {
        createdAlertCount += 1;
        if (await enqueueLeadOperationalAlertDelivery(createdAlert.id, job.payload.correlationId, deps)) {
          enqueuedDeliveryCount += 1;
        }
      }
    }

    if (leadProcessed) {
      processedLeadIds.add(lead.id);
    }
  }

  // FR-NOTIF bridge — surface the alerts just produced in each recipient's in-app inbox. Best-effort.
  try {
    await syncLeadAlertNotifications();
    await syncLeadCisReceivedNotifications();
  } catch {
    // Materializing in-app notifications must never fail the alert scan.
  }

  return {
    ok: true,
    processedLeadCount: processedLeadIds.size,
    createdAlertCount,
    enqueuedDeliveryCount,
    processedAt: new Date().toISOString(),
  };
}

export async function getLeadOperationalAlertDeliveryAdminSettings(
  config: AppConfig,
): Promise<AdminLeadOperationalAlertDeliverySettingsResponse> {
  const mode = toLeadOperationalAlertDeliveryModeKey(config.leads.operationalAlertDeliveryMode);
  const deliveryProvider = mode;
  const configurationIssues = getLeadOperationalAlertDeliveryConfigurationIssues(config);
  const metrics = await getLeadOperationalAlertDeliveryMetrics();
  const [policy, recipients] = await Promise.all([
    getLeadRoutingPolicySnapshot(),
    prisma.leadOperationalAlertRecipient.findMany({
      orderBy: [
        { routingTeam: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    }),
  ]);
  const isConfigured = configurationIssues.length === 0;
  const hasFailures = metrics.failedAlertCount > 0 || metrics.failedAttemptCount > 0;
  const status = !isConfigured
    ? mode === 'preview'
      ? 'warning'
      : 'blocked'
    : mode === 'preview' || hasFailures
      ? 'warning'
      : 'ready';

  return {
    provider: 'lead_operational_alerts',
    mode,
    deliveryProvider,
    isConfigured,
    status,
    statusDetail: buildLeadOperationalAlertDeliveryStatusDetail(mode, isConfigured, configurationIssues, metrics),
    configurationIssues,
    metrics,
    quietHours: {
      enabled: policy.operationalAlertQuietHoursEnabled,
      startLocal: policy.operationalAlertQuietHoursStartLocal,
      endLocal: policy.operationalAlertQuietHoursEndLocal,
      timeZone: policy.operationalAlertQuietHoursTimeZone,
    },
    recipients: recipients.map((recipient) => ({
      id: recipient.id,
      code: recipient.code,
      routingTeam: toLeadRoutingTeamKey(recipient.routingTeam),
      name: recipient.name,
      ...(recipient.email ? { email: recipient.email } : {}),
      ...(recipient.roleTitle ? { roleTitle: recipient.roleTitle } : {}),
      isActive: recipient.isActive,
      sortOrder: recipient.sortOrder,
      updatedAt: recipient.updatedAt.toISOString(),
    })),
    ...(mode === 'microsoft_graph'
      ? {
          microsoftGraph: {
            ...(config.leads.operationalAlertMicrosoftGraph.fromUser
              ? { fromUser: config.leads.operationalAlertMicrosoftGraph.fromUser }
              : {}),
            authBaseUrl: config.leads.operationalAlertMicrosoftGraph.authBaseUrl,
            graphBaseUrl: config.leads.operationalAlertMicrosoftGraph.graphBaseUrl,
            tenantConfigured: Boolean(config.leads.operationalAlertMicrosoftGraph.tenantId),
            clientConfigured: Boolean(config.leads.operationalAlertMicrosoftGraph.clientId),
            clientSecretConfigured: Boolean(config.leads.operationalAlertMicrosoftGraph.clientSecret),
          },
        }
      : {}),
  };
}

export async function listLeadOperationalAlertIntegrationStatuses(
  config: AppConfig,
): Promise<Array<{
  key: string;
  label: string;
  status: 'connected' | 'warning' | 'error';
  health: number;
  lastCheckedAt: string;
  detail: string;
}>> {
  const settings = await getLeadOperationalAlertDeliveryAdminSettings(config);
  const checkedAt = new Date().toISOString();
  const status = settings.status === 'ready'
    ? 'connected'
    : settings.status === 'warning'
      ? 'warning'
      : 'error';

  return [
    {
      key: 'lead-operational-alerts',
      label: 'Lead Alert Delivery',
      status,
      health: resolveLeadOperationalAlertDeliveryHealth(settings),
      lastCheckedAt: checkedAt,
      detail: settings.statusDetail,
    },
  ];
}

export async function retryLeadOperationalAlertDeliveries(
  actor: AuthenticatedActor,
  input: RetryLeadOperationalAlertDeliveriesRequest,
  deps: LeadOperationalAlertScanDependencies = {},
): Promise<RetryLeadOperationalAlertDeliveriesResponse> {
  const limit = clampLeadOperationalAlertRetryLimit(input.limit);
  const alertIds = normalizeAlertIds(input.alertIds);
  const alerts = await prisma.leadOperationalAlert.findMany({
    where: {
      deliveryStatus: LeadOperationalAlertDeliveryStatus.FAILED,
      ...(alertIds.length > 0 ? { id: { in: alertIds } } : {}),
    },
    orderBy: { lastDeliveryAttemptAt: 'asc' },
    take: limit,
    select: {
      id: true,
      recipientEmail: true,
    },
  });

  let retriedAlertCount = 0;
  let skippedAlertCount = 0;
  let enqueuedDeliveryCount = 0;

  for (const alert of alerts) {
    if (!alert.recipientEmail) {
      skippedAlertCount += 1;
      continue;
    }

    const updated = await prisma.leadOperationalAlert.updateMany({
      where: {
        id: alert.id,
        deliveryStatus: LeadOperationalAlertDeliveryStatus.FAILED,
      },
      data: {
        deliveryStatus: LeadOperationalAlertDeliveryStatus.PENDING,
        deliveredAt: null,
      },
    });

    if (updated.count === 0) {
      skippedAlertCount += 1;
      continue;
    }

    retriedAlertCount += 1;
    if (await enqueueLeadOperationalAlertDelivery(alert.id, `lead-alert-admin-retry-${actor.userId}-${Date.now()}`, deps)) {
      enqueuedDeliveryCount += 1;
    }
  }

  return {
    matchedAlertCount: alerts.length,
    retriedAlertCount,
    skippedAlertCount,
    enqueuedDeliveryCount,
    processedAt: new Date().toISOString(),
  };
}

export async function deadLetterLeadOperationalAlertDeliveries(
  actor: AuthenticatedActor,
  config: AppConfig,
  input: DeadLetterLeadOperationalAlertDeliveriesRequest,
): Promise<DeadLetterLeadOperationalAlertDeliveriesResponse> {
  const alertIds = normalizeAlertIds(input.alertIds);
  const reason = input.reason?.trim();
  if (alertIds.length === 0) {
    throw new Error('At least one failed lead alert must be selected.');
  }
  if (!reason) {
    throw new Error('Dead-letter reason is required.');
  }

  const alerts = await prisma.leadOperationalAlert.findMany({
    where: {
      id: { in: alertIds },
      deliveryStatus: LeadOperationalAlertDeliveryStatus.FAILED,
    },
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          state: true,
          serviceTechCount: true,
          potentialValueCents: true,
        },
      },
      recipient: true,
      recipientUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  let deadLetteredAlertCount = 0;
  let skippedAlertCount = 0;
  const deliveryMode = toLeadOperationalAlertDeliveryMode(config.leads.operationalAlertDeliveryMode);

  for (const alert of alerts) {
    const message = buildLeadOperationalAlertDeliveryMessage(alert);
    const updated = await prisma.leadOperationalAlert.updateMany({
      where: {
        id: alert.id,
        deliveryStatus: LeadOperationalAlertDeliveryStatus.FAILED,
      },
      data: {
        deliveryStatus: LeadOperationalAlertDeliveryStatus.PENDING,
      },
    });

    if (updated.count === 0) {
      skippedAlertCount += 1;
      continue;
    }

    await recordLeadOperationalAlertDeliveryAttempt(alert.id, {
      deliveryMode,
      status: LeadOperationalAlertDeliveryStatus.SKIPPED,
      providerKey: LEAD_OPERATIONAL_ALERT_DELIVERY_ADMIN_PROVIDER_KEY,
      recipientName: message.recipientName,
      recipientEmail: message.recipientEmail,
      subject: message.subject,
      metadata: {
        ...asJsonRecord(message.metadata),
        reason,
        action: 'admin_dead_letter',
        actorUserId: actor.userId,
        actorEmail: actor.email,
      },
    });
    deadLetteredAlertCount += 1;
  }

  return {
    matchedAlertCount: alerts.length,
    deadLetteredAlertCount,
    skippedAlertCount,
    processedAt: new Date().toISOString(),
  };
}

export async function processLeadOperationalAlertDeliveryJob(
  config: AppConfig,
  logger: AppLogger,
  job: QueueJob<unknown>,
  deps: LeadOperationalAlertDeliveryDependencies = {},
) {
  const payload = parseLeadOperationalAlertDeliveryJobData(job.payload.data);
  if (!payload.alertId) {
    logger.warn('lead.operational_alert.delivery_skipped', {
      reason: 'missing_alert_id',
      correlationId: job.payload.correlationId,
    });
    return {
      ok: false,
      status: 'missing_alert_id',
      processedAt: new Date().toISOString(),
    };
  }

  const alert = await prisma.leadOperationalAlert.findUnique({
    where: { id: payload.alertId },
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          state: true,
          serviceTechCount: true,
          potentialValueCents: true,
        },
      },
      recipient: true,
      recipientUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  if (!alert) {
    logger.warn('lead.operational_alert.delivery_skipped', {
      alertId: payload.alertId,
      reason: 'alert_not_found',
      correlationId: job.payload.correlationId,
    });
    return {
      ok: false,
      status: 'missing_alert',
      alertId: payload.alertId,
      processedAt: new Date().toISOString(),
    };
  }

  if (alert.deliveryStatus !== LeadOperationalAlertDeliveryStatus.PENDING) {
    return {
      ok: true,
      status: 'already_processed',
      alertId: alert.id,
      deliveryStatus: alert.deliveryStatus.toLowerCase(),
      processedAt: new Date().toISOString(),
    };
  }

  const deliveryMessage = buildLeadOperationalAlertDeliveryMessage(alert);
  const deliveryMode = toLeadOperationalAlertDeliveryMode(config.leads.operationalAlertDeliveryMode);

  if (deliveryMode === LeadOperationalAlertDeliveryMode.DISABLED) {
    await recordLeadOperationalAlertDeliveryAttempt(alert.id, {
      deliveryMode,
      status: LeadOperationalAlertDeliveryStatus.SKIPPED,
      providerKey: LEAD_OPERATIONAL_ALERT_DELIVERY_DISABLED_PROVIDER_KEY,
      recipientName: deliveryMessage.recipientName,
      recipientEmail: deliveryMessage.recipientEmail,
      subject: deliveryMessage.subject,
      metadata: {
        ...asJsonRecord(deliveryMessage.metadata),
        correlationId: job.payload.correlationId,
        reason: 'delivery_disabled',
      },
    });

    logger.warn('lead.operational_alert.delivery_skipped', {
      alertId: alert.id,
      alertType: alert.alertType,
      recipientName: deliveryMessage.recipientName,
      recipientEmail: deliveryMessage.recipientEmail,
      correlationId: job.payload.correlationId,
      reason: 'delivery_disabled',
    });

    return {
      ok: true,
      status: 'skipped',
      alertId: alert.id,
      processedAt: new Date().toISOString(),
    };
  }

  if (deliveryMode === LeadOperationalAlertDeliveryMode.MICROSOFT_GRAPH) {
    const graphResult = await sendLeadOperationalAlertWithMicrosoftGraph(
      config,
      deliveryMessage,
      deps.fetch ?? fetch,
    );

    if (!graphResult.ok) {
      const errorMessage = graphResult.errorMessage ?? 'Microsoft Graph notification delivery failed';
      await recordLeadOperationalAlertDeliveryAttempt(alert.id, {
        deliveryMode,
        status: LeadOperationalAlertDeliveryStatus.FAILED,
        providerKey: LEAD_OPERATIONAL_ALERT_DELIVERY_MICROSOFT_GRAPH_PROVIDER_KEY,
        recipientName: deliveryMessage.recipientName,
        recipientEmail: deliveryMessage.recipientEmail,
        subject: deliveryMessage.subject,
        errorMessage,
        metadata: {
          ...asJsonRecord(deliveryMessage.metadata),
          correlationId: job.payload.correlationId,
          provider: 'microsoft_graph',
          ...(graphResult.providerStatus ? { providerStatus: graphResult.providerStatus } : {}),
        },
      });

      logger.error('lead.operational_alert.delivery_failed', {
        alertId: alert.id,
        alertType: alert.alertType,
        recipientName: deliveryMessage.recipientName,
        recipientEmail: deliveryMessage.recipientEmail,
        correlationId: job.payload.correlationId,
        provider: 'microsoft_graph',
        error: errorMessage,
      });

      return {
        ok: false,
        status: 'failed',
        alertId: alert.id,
        error: errorMessage,
        processedAt: new Date().toISOString(),
      };
    }

    await recordLeadOperationalAlertDeliveryAttempt(alert.id, {
      deliveryMode,
      status: LeadOperationalAlertDeliveryStatus.SENT,
      providerKey: LEAD_OPERATIONAL_ALERT_DELIVERY_MICROSOFT_GRAPH_PROVIDER_KEY,
      recipientName: deliveryMessage.recipientName,
      recipientEmail: deliveryMessage.recipientEmail,
      subject: deliveryMessage.subject,
      metadata: {
        ...asJsonRecord(deliveryMessage.metadata),
        correlationId: job.payload.correlationId,
        provider: 'microsoft_graph',
        ...(graphResult.providerRequestId ? { providerRequestId: graphResult.providerRequestId } : {}),
      },
    });

    logger.info('lead.operational_alert.sent', {
      alertId: alert.id,
      alertType: alert.alertType,
      recipientName: deliveryMessage.recipientName,
      recipientEmail: deliveryMessage.recipientEmail,
      subject: deliveryMessage.subject,
      correlationId: job.payload.correlationId,
      provider: 'microsoft_graph',
      providerRequestId: graphResult.providerRequestId,
    });

    return {
      ok: true,
      status: 'sent',
      alertId: alert.id,
      processedAt: new Date().toISOString(),
    };
  }

  await recordLeadOperationalAlertDeliveryAttempt(alert.id, {
    deliveryMode,
    status: LeadOperationalAlertDeliveryStatus.PREVIEWED,
    providerKey: LEAD_OPERATIONAL_ALERT_DELIVERY_PROVIDER_KEY,
    recipientName: deliveryMessage.recipientName,
    recipientEmail: deliveryMessage.recipientEmail,
    subject: deliveryMessage.subject,
    metadata: {
      ...asJsonRecord(deliveryMessage.metadata),
      correlationId: job.payload.correlationId,
      previewBody: deliveryMessage.previewBody,
    },
  });

  logger.info('lead.operational_alert.preview', {
    alertId: alert.id,
    alertType: alert.alertType,
    recipientName: deliveryMessage.recipientName,
    recipientEmail: deliveryMessage.recipientEmail,
    subject: deliveryMessage.subject,
    correlationId: job.payload.correlationId,
  });

  return {
    ok: true,
    status: 'previewed',
    alertId: alert.id,
    processedAt: new Date().toISOString(),
  };
}

function toLeadOperationalAlertDeliveryMode(value: AppConfig['leads']['operationalAlertDeliveryMode']) {
  switch (value) {
    case 'disabled':
      return LeadOperationalAlertDeliveryMode.DISABLED;
    case 'microsoft_graph':
      return LeadOperationalAlertDeliveryMode.MICROSOFT_GRAPH;
    case 'preview':
    default:
      return LeadOperationalAlertDeliveryMode.PREVIEW;
  }
}

function toLeadOperationalAlertDeliveryModeKey(value: AppConfig['leads']['operationalAlertDeliveryMode']): LeadOperationalAlertDeliveryModeKey {
  switch (value) {
    case 'disabled':
      return 'disabled';
    case 'microsoft_graph':
      return 'microsoft_graph';
    case 'preview':
    default:
      return 'preview';
  }
}

function getLeadOperationalAlertDeliveryConfigurationIssues(config: AppConfig) {
  const mode = toLeadOperationalAlertDeliveryModeKey(config.leads.operationalAlertDeliveryMode);
  if (mode === 'disabled') {
    return ['NOTIFICATION_DELIVERY_DISABLED'];
  }

  if (mode === 'preview') {
    return [];
  }

  const issues: string[] = [];
  if (!config.leads.operationalAlertMicrosoftGraph.tenantId) issues.push('NOTIFICATION_MICROSOFT_GRAPH_TENANT_ID');
  if (!config.leads.operationalAlertMicrosoftGraph.clientId) issues.push('NOTIFICATION_MICROSOFT_GRAPH_CLIENT_ID');
  if (!config.leads.operationalAlertMicrosoftGraph.clientSecret) issues.push('NOTIFICATION_MICROSOFT_GRAPH_CLIENT_SECRET');
  if (!config.leads.operationalAlertMicrosoftGraph.fromUser) issues.push('NOTIFICATION_MICROSOFT_GRAPH_FROM_USER');
  return issues;
}

async function getLeadOperationalAlertDeliveryMetrics(): Promise<AdminLeadOperationalAlertDeliverySettingsResponse['metrics']> {
  const [
    pendingAlertCount,
    failedAlertCount,
    retryableFailedAlertCount,
    sentAttemptCount,
    previewedAttemptCount,
    skippedAttemptCount,
    failedAttemptCount,
    latestFailure,
  ] = await Promise.all([
    prisma.leadOperationalAlert.count({ where: { deliveryStatus: LeadOperationalAlertDeliveryStatus.PENDING } }),
    prisma.leadOperationalAlert.count({ where: { deliveryStatus: LeadOperationalAlertDeliveryStatus.FAILED } }),
    prisma.leadOperationalAlert.count({
      where: {
        deliveryStatus: LeadOperationalAlertDeliveryStatus.FAILED,
        recipientEmail: { not: null },
      },
    }),
    prisma.leadOperationalAlertDeliveryAttempt.count({ where: { status: LeadOperationalAlertDeliveryStatus.SENT } }),
    prisma.leadOperationalAlertDeliveryAttempt.count({ where: { status: LeadOperationalAlertDeliveryStatus.PREVIEWED } }),
    prisma.leadOperationalAlertDeliveryAttempt.count({ where: { status: LeadOperationalAlertDeliveryStatus.SKIPPED } }),
    prisma.leadOperationalAlertDeliveryAttempt.count({ where: { status: LeadOperationalAlertDeliveryStatus.FAILED } }),
    prisma.leadOperationalAlertDeliveryAttempt.findFirst({
      where: { status: LeadOperationalAlertDeliveryStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      select: {
        alertId: true,
        completedAt: true,
        createdAt: true,
        recipientName: true,
        recipientEmail: true,
        subject: true,
        errorMessage: true,
      },
    }),
  ]);

  return {
    pendingAlertCount,
    failedAlertCount,
    retryableFailedAlertCount,
    sentAttemptCount,
    previewedAttemptCount,
    skippedAttemptCount,
    failedAttemptCount,
    ...(latestFailure
      ? {
          latestFailure: {
            alertId: latestFailure.alertId,
            attemptedAt: (latestFailure.completedAt ?? latestFailure.createdAt).toISOString(),
            recipientName: latestFailure.recipientName,
            ...(latestFailure.recipientEmail ? { recipientEmail: latestFailure.recipientEmail } : {}),
            subject: latestFailure.subject,
            ...(latestFailure.errorMessage ? { errorMessage: latestFailure.errorMessage } : {}),
          },
        }
      : {}),
  };
}

function buildLeadOperationalAlertDeliveryStatusDetail(
  mode: LeadOperationalAlertDeliveryModeKey,
  isConfigured: boolean,
  configurationIssues: string[],
  metrics: AdminLeadOperationalAlertDeliverySettingsResponse['metrics'],
) {
  if (!isConfigured) {
    return mode === 'disabled'
      ? 'Lead alert delivery is disabled by environment configuration.'
      : `Lead alert delivery needs environment setup: ${configurationIssues.join(', ')}.`;
  }

  if (mode === 'preview') {
    return 'Lead alert delivery is in preview mode; attempts are recorded without sending email.';
  }

  if (metrics.failedAlertCount > 0) {
    return `${metrics.failedAlertCount} lead alert delivery failure(s) need retry or configuration review.`;
  }

  if (metrics.pendingAlertCount > 0) {
    return `${metrics.pendingAlertCount} lead alert(s) are waiting for delivery workers.`;
  }

  return 'Microsoft Graph delivery is configured for lead operational alerts.';
}

function resolveLeadOperationalAlertDeliveryHealth(
  settings: AdminLeadOperationalAlertDeliverySettingsResponse,
) {
  if (settings.status === 'blocked') return 20;
  if (settings.mode === 'disabled') return 35;
  if (settings.mode === 'preview') return 60;
  if (settings.metrics.failedAlertCount > 0) return 70;
  if (settings.metrics.pendingAlertCount > 0) return 85;
  return 100;
}

function clampLeadOperationalAlertRetryLimit(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return LEAD_OPERATIONAL_ALERT_DELIVERY_RETRY_LIMIT;
  }

  return Math.max(1, Math.min(LEAD_OPERATIONAL_ALERT_DELIVERY_RETRY_LIMIT, Math.floor(value as number)));
}

function normalizeAlertIds(value: string[] | undefined) {
  return Array.from(new Set(
    (value ?? [])
      .map((item) => item.trim())
      .filter(Boolean),
  ));
}

async function sendLeadOperationalAlertWithMicrosoftGraph(
  config: AppConfig,
  message: DeliveryMessage,
  fetchImpl: typeof fetch,
): Promise<{
  ok: boolean;
  errorMessage?: string;
  providerStatus?: number;
  providerRequestId?: string;
}> {
  const graphConfig = config.leads.operationalAlertMicrosoftGraph;
  const missing = [
    graphConfig.tenantId ? null : 'tenantId',
    graphConfig.clientId ? null : 'clientId',
    graphConfig.clientSecret ? null : 'clientSecret',
    graphConfig.fromUser ? null : 'fromUser',
  ].filter(Boolean);

  if (missing.length > 0) {
    return {
      ok: false,
      errorMessage: `Microsoft Graph notification delivery is missing configuration: ${missing.join(', ')}`,
    };
  }
  if (!message.recipientEmail) {
    return {
      ok: false,
      errorMessage: 'Microsoft Graph notification delivery requires a recipient email address',
    };
  }

  try {
    const tokenResponse = await fetchImpl(
      `${graphConfig.authBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(graphConfig.tenantId as string)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: graphConfig.clientId as string,
          client_secret: graphConfig.clientSecret as string,
          grant_type: 'client_credentials',
          scope: `${graphConfig.graphBaseUrl.replace(/\/v1\.0\/?$/, '').replace(/\/$/, '')}/.default`,
        }),
      },
    );

    if (!tokenResponse.ok) {
      return {
        ok: false,
        providerStatus: tokenResponse.status,
        errorMessage: `Microsoft Graph token request failed with status ${tokenResponse.status}`,
      };
    }

    const tokenPayload = await tokenResponse.json() as { access_token?: unknown };
    const accessToken = typeof tokenPayload.access_token === 'string' ? tokenPayload.access_token : '';
    if (!accessToken) {
      return {
        ok: false,
        errorMessage: 'Microsoft Graph token response did not include an access token',
      };
    }

    const sendResponse = await fetchImpl(
      `${graphConfig.graphBaseUrl.replace(/\/$/, '')}/users/${encodeURIComponent(graphConfig.fromUser as string)}/sendMail`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: {
              contentType: 'Text',
              content: message.previewBody,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: message.recipientEmail,
                  name: message.recipientName,
                },
              },
            ],
          },
          saveToSentItems: true,
        }),
      },
    );

    if (!sendResponse.ok) {
      const providerRequestId = sendResponse.headers.get('request-id') ?? sendResponse.headers.get('client-request-id') ?? undefined;
      return {
        ok: false,
        providerStatus: sendResponse.status,
        ...(providerRequestId ? { providerRequestId } : {}),
        errorMessage: `Microsoft Graph sendMail request failed with status ${sendResponse.status}`,
      };
    }

    const providerRequestId = sendResponse.headers.get('request-id') ?? sendResponse.headers.get('client-request-id') ?? undefined;
    return {
      ok: true,
      providerStatus: sendResponse.status,
      ...(providerRequestId ? { providerRequestId } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getLeadRoutingPolicySnapshot(): Promise<LeadRoutingPolicySnapshot> {
  const policy = await prisma.leadRoutingPolicy.findUnique({
    where: { id: 'default' },
    select: {
      initialContactManagerEscalationDelayHours: true,
      initialContactLeadershipEscalationDelayHours: true,
      operationalAlertQuietHoursEnabled: true,
      operationalAlertQuietHoursStartLocal: true,
      operationalAlertQuietHoursEndLocal: true,
      operationalAlertQuietHoursTimeZone: true,
    },
  });

  if (policy) {
    return policy;
  }

  return {
    initialContactManagerEscalationDelayHours: 12,
    initialContactLeadershipEscalationDelayHours: 24,
    operationalAlertQuietHoursEnabled: false,
    operationalAlertQuietHoursStartLocal: '18:00',
    operationalAlertQuietHoursEndLocal: '08:00',
    operationalAlertQuietHoursTimeZone: 'America/Los_Angeles',
  };
}

function isLeadOperationalAlertQuietHoursActive(policy: LeadRoutingPolicySnapshot, at: Date) {
  if (!policy.operationalAlertQuietHoursEnabled) {
    return false;
  }

  const currentMinutes = getLocalMinutesForTimeZone(at, policy.operationalAlertQuietHoursTimeZone);
  const startMinutes = parseLocalTimeMinutes(policy.operationalAlertQuietHoursStartLocal);
  const endMinutes = parseLocalTimeMinutes(policy.operationalAlertQuietHoursEndLocal);
  if (startMinutes === endMinutes) {
    return true;
  }

  return startMinutes < endMinutes
    ? currentMinutes >= startMinutes && currentMinutes < endMinutes
    : currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

function getLocalMinutesForTimeZone(at: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    }).formatToParts(at);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
    return (hour % 24) * 60 + minute;
  } catch {
    return at.getUTCHours() * 60 + at.getUTCMinutes();
  }
}

function parseLocalTimeMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return (Number(hours) * 60) + Number(minutes);
}

function toLeadRoutingTeamKey(value: LeadRoutingTeam) {
  switch (value) {
    case LeadRoutingTeam.STRATEGIC_GROWTH:
      return 'strategic_growth';
    case LeadRoutingTeam.NATIONAL_TM:
      return 'national_tm';
    default:
      return 'national_tm';
  }
}

async function enqueueLeadOperationalAlertDelivery(
  alertId: string,
  correlationId: string,
  deps: LeadOperationalAlertScanDependencies,
) {
  if (!deps.queue) {
    return false;
  }

  try {
    await deps.queue.enqueue(LEAD_OPERATIONAL_ALERT_DELIVERY_QUEUE, {
      jobType: LEAD_OPERATIONAL_ALERT_DELIVERY_QUEUE.name,
      triggeredBy: 'pulse-system',
      triggerSource: 'worker',
      correlationId: `${correlationId}:${alertId}`,
      metadata: {
        singletonKey: `lead-operational-alert-delivery:${alertId}`,
        idempotencyKey: `lead-operational-alert-delivery:${alertId}`,
        expireInSeconds: 60 * 10,
      },
      data: {
        alertId,
      },
    });

    return true;
  } catch (error) {
    deps.logger?.warn('lead.operational_alert.delivery_enqueue_failed', {
      alertId,
      correlationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function createLeadOperationalAlert(input: {
  leadId: string;
  alertType: LeadOperationalAlertType;
  recipientId?: string;
  recipientUserId?: string;
  recipientName: string;
  recipientEmail?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    const alert = await prisma.leadOperationalAlert.create({
      data: {
        leadId: input.leadId,
        alertType: input.alertType,
        recipientName: input.recipientName,
        ...(input.recipientId ? { recipientId: input.recipientId } : {}),
        ...(input.recipientUserId ? { recipientUserId: input.recipientUserId } : {}),
        ...(input.recipientEmail ? { recipientEmail: input.recipientEmail } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        dedupeKey: buildLeadOperationalAlertDedupeKey(input),
      },
      select: {
        id: true,
      },
    });
    return alert;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      return null;
    }

    throw error;
  }
}

async function recordLeadOperationalAlertDeliveryAttempt(
  alertId: string,
  input: {
    deliveryMode: LeadOperationalAlertDeliveryMode;
    status: LeadOperationalAlertDeliveryStatus;
    providerKey: string;
    recipientName: string;
    recipientEmail: string | null;
    subject: string;
    metadata?: Prisma.InputJsonValue;
    errorMessage?: string;
  },
) {
  const completedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const existingAttempts = await tx.leadOperationalAlertDeliveryAttempt.count({
      where: { alertId },
    });

    await tx.leadOperationalAlertDeliveryAttempt.create({
      data: {
        alertId,
        attemptNumber: existingAttempts + 1,
        deliveryMode: input.deliveryMode,
        status: input.status,
        providerKey: input.providerKey,
        recipientName: input.recipientName,
        ...(input.recipientEmail ? { recipientEmail: input.recipientEmail } : {}),
        subject: input.subject,
        ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        completedAt,
      },
    });

    await tx.leadOperationalAlert.update({
      where: { id: alertId },
      data: {
        deliveryStatus: input.status,
        lastDeliveryAttemptAt: completedAt,
        deliveredAt:
          input.status === LeadOperationalAlertDeliveryStatus.PREVIEWED
          || input.status === LeadOperationalAlertDeliveryStatus.SENT
            ? completedAt
            : null,
      },
    });
  });
}

function buildLeadOperationalAlertDedupeKey(input: {
  leadId: string;
  alertType: LeadOperationalAlertType;
  recipientId?: string;
  recipientUserId?: string;
  recipientName: string;
}) {
  return createHash('sha256')
    .update(
      [
        input.leadId,
        input.alertType,
        input.recipientId ?? '',
        input.recipientUserId ?? '',
        input.recipientName.toLowerCase(),
      ].join('|'),
    )
    .digest('hex');
}

function buildLeadOperationalAlertDeliveryMessage(alert: LeadOperationalAlertDeliveryRecord): DeliveryMessage {
  const recipientName = alert.recipientUser?.displayName
    ?? alert.recipient?.name
    ?? alert.recipientName;
  const recipientEmail = alert.recipientEmail
    ?? alert.recipient?.email
    ?? alert.recipientUser?.email
    ?? null;

  const subject = buildLeadOperationalAlertSubject(alert);
  const previewBody = [
    `${subject}.`,
    `Lead: ${alert.lead.companyName}`,
    `Recipient: ${recipientName}`,
    `Alert type: ${alert.alertType}`,
    alert.lead.state ? `State: ${alert.lead.state}` : null,
    `Service techs: ${alert.lead.serviceTechCount}`,
    alert.lead.potentialValueCents !== null ? `Potential value cents: ${alert.lead.potentialValueCents}` : null,
  ].filter(Boolean).join('\n');

  return {
    recipientName,
    recipientEmail,
    subject,
    previewBody,
    metadata: {
      leadId: alert.leadId,
      leadCompanyName: alert.lead.companyName,
      alertType: alert.alertType,
      recipientName,
      ...(recipientEmail ? { recipientEmail } : {}),
      ...(alert.lead.state ? { state: alert.lead.state } : {}),
    },
  };
}

function buildLeadOperationalAlertSubject(alert: LeadOperationalAlertDeliveryRecord) {
  switch (alert.alertType) {
    case LeadOperationalAlertType.ROUTING_BROADCAST:
      return `Pulse lead routing alert for ${alert.lead.companyName}`;
    case LeadOperationalAlertType.INITIAL_CONTACT_MANAGER_ESCALATION:
      return `Pulse initial contact manager escalation for ${alert.lead.companyName}`;
    case LeadOperationalAlertType.INITIAL_CONTACT_LEADERSHIP_ESCALATION:
      return `Pulse initial contact leadership escalation for ${alert.lead.companyName}`;
    default:
      return `Pulse lead operational alert for ${alert.lead.companyName}`;
  }
}

function parseLeadOperationalAlertScanJobData(data: unknown): Required<LeadOperationalAlertScanJobData> {
  const record = (data && typeof data === 'object' && !Array.isArray(data))
    ? (data as Record<string, unknown>)
    : {};
  const limit = typeof record.limit === 'number' && Number.isFinite(record.limit)
    ? Math.max(1, Math.min(MAX_SCAN_LIMIT, Math.trunc(record.limit)))
    : 250;

  return { limit };
}

function parseLeadOperationalAlertDeliveryJobData(data: unknown): LeadOperationalAlertDeliveryJobData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }

  const record = data as Record<string, unknown>;
  const alertId = typeof record.alertId === 'string' && record.alertId.trim()
    ? record.alertId.trim()
    : null;

  if (!alertId) {
    return {};
  }

  return { alertId };
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + (hours * 60 * 60 * 1000));
}

function asJsonRecord(value: Prisma.InputJsonValue) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.InputJsonValue>)
    : {};
}

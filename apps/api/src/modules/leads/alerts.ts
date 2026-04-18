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
import type { QueueJob, QueueManager } from '../../queue/contracts.js';
import { LEAD_OPERATIONAL_ALERT_DELIVERY_QUEUE } from '../../queue/definitions.js';
import type { AppLogger } from '../../utils/logger.js';

const MAX_SCAN_LIMIT = 500;
const LEAD_OPERATIONAL_ALERT_DELIVERY_PROVIDER_KEY = 'pulse.lead-operational-alert.preview';
const LEAD_OPERATIONAL_ALERT_DELIVERY_DISABLED_PROVIDER_KEY = 'pulse.lead-operational-alert.disabled';

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

  return {
    ok: true,
    processedLeadCount: processedLeadIds.size,
    createdAlertCount,
    enqueuedDeliveryCount,
    processedAt: new Date().toISOString(),
  };
}

export async function processLeadOperationalAlertDeliveryJob(
  config: AppConfig,
  logger: AppLogger,
  job: QueueJob<unknown>,
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
  const deliveryMode = config.leads.operationalAlertDeliveryMode === 'disabled'
    ? LeadOperationalAlertDeliveryMode.DISABLED
    : LeadOperationalAlertDeliveryMode.PREVIEW;

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

async function getLeadRoutingPolicySnapshot(): Promise<LeadRoutingPolicySnapshot> {
  const policy = await prisma.leadRoutingPolicy.findUnique({
    where: { id: 'default' },
    select: {
      initialContactManagerEscalationDelayHours: true,
      initialContactLeadershipEscalationDelayHours: true,
    },
  });

  if (policy) {
    return policy;
  }

  return {
    initialContactManagerEscalationDelayHours: 12,
    initialContactLeadershipEscalationDelayHours: 24,
  };
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

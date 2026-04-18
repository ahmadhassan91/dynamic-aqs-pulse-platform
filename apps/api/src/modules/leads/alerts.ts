import { createHash } from 'node:crypto';
import {
  LeadLifecycleStatus,
  LeadOperationalAlertType,
  LeadRoutingTeam,
  LeadStage,
  Prisma,
  prisma,
} from '@pulse/db';
import type { QueueJob } from '../../queue/contracts.js';

const MAX_SCAN_LIMIT = 500;

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
          isActive: true,
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

export async function processLeadOperationalAlertScanJob(job: QueueJob<unknown>) {
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
  const processedLeadIds = new Set<string>();

  for (const lead of strategicGrowthLeads) {
    processedLeadIds.add(lead.id);
    for (const recipient of strategicGrowthRecipients) {
      const created = await createLeadOperationalAlert({
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

      if (created) {
        createdAlertCount += 1;
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
      const created = await createLeadOperationalAlert({
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
      if (created) {
        createdAlertCount += 1;
      }
    }

    if (
      leadershipEscalationDue.getTime() <= now.getTime()
      && (lead.assignedRdUserId || lead.assignedRdUser?.displayName)
    ) {
      const created = await createLeadOperationalAlert({
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
      if (created) {
        createdAlertCount += 1;
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
    await prisma.leadOperationalAlert.create({
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
    });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      return false;
    }

    throw error;
  }
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

function parseLeadOperationalAlertScanJobData(data: unknown): Required<LeadOperationalAlertScanJobData> {
  const record = (data && typeof data === 'object' && !Array.isArray(data))
    ? (data as Record<string, unknown>)
    : {};
  const limit = typeof record.limit === 'number' && Number.isFinite(record.limit)
    ? Math.max(1, Math.min(MAX_SCAN_LIMIT, Math.trunc(record.limit)))
    : 250;

  return { limit };
}

function addHours(value: Date, hours: number) {
  return new Date(value.getTime() + (hours * 60 * 60 * 1000));
}

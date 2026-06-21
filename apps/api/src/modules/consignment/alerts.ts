// Consignment time-pressure engine.
//
// Implements PRD section 4A.5 / FR-CSG-012, FR-CSG-013, FR-CSG-030, FR-CSG-032.
// The scanner walks audits and PO clocks every tick and materializes alert
// records into ConsignmentOperationalAlert. Idempotency is enforced by the
// `dedupeKey` unique constraint on the model — re-scans never produce
// duplicates, so this job is safe to enqueue repeatedly.
//
// Delivery is intentionally NOT wired in this slice. Email delivery (Microsoft
// Graph sendMail) is the same parked dependency as the lead-alert dispatcher.
// Alerts persisted here can be surfaced in-app and via the existing admin
// integration UI as a follow-up once Graph credentials are certified.

import {
  ConsignmentAuditStatus,
  ConsignmentDiscrepancyStatus,
  ConsignmentOperationalAlertStatus,
  ConsignmentOperationalAlertType,
  ConsignmentPoFollowUpStatus,
  ConsignmentSiteStatus,
  Prisma,
  prisma,
} from '@pulse/db';
import type { QueueJob } from '../../queue/contracts.js';
import type { AppLogger } from '../../utils/logger.js';
import { syncConsignmentAlertNotifications } from '../notifications/bridge.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Audit alert windows from FR-CSG-012 (T-14, T-7, T-0) and FR-CSG-013 (+7, +14).
const AUDIT_T_MINUS_14_MS = 14 * DAY_MS;
const AUDIT_T_MINUS_7_MS = 7 * DAY_MS;
const AUDIT_T_PLUS_7_MS = 7 * DAY_MS;
const AUDIT_T_PLUS_14_MS = 14 * DAY_MS;

// PO clock alert windows from FR-CSG-030 (start, T-3, T-1) and FR-CSG-032 (+5, +10).
const PO_CLOCK_T_MINUS_3_MS = 3 * DAY_MS;
const PO_CLOCK_T_MINUS_1_MS = 1 * DAY_MS;
const PO_OVERDUE_5_DAYS_MS = 5 * DAY_MS;
const PO_OVERDUE_10_DAYS_MS = 10 * DAY_MS;

export type ConsignmentOperationalAlertScanResult = {
  ok: boolean;
  processedSiteCount: number;
  createdAlertCount: number;
  alertsByType: Record<string, number>;
  processedAt: string;
};

type ScanDependencies = {
  logger?: AppLogger | undefined;
};

// Dedupe key strategy: `${alertType}:${entityId}` — one record per (type, entity).
// Each type fires exactly once per entity over its lifetime, which is the
// PRD-required semantics for these windowed alerts.
function buildDedupeKey(type: ConsignmentOperationalAlertType, entityId: string) {
  return `${type}:${entityId}`;
}

type AlertCreateInput = {
  siteId: string;
  alertType: ConsignmentOperationalAlertType;
  triggeredAt: Date;
  auditId?: string;
  discrepancyId?: string;
  metadata?: Prisma.InputJsonValue;
};

// Idempotent alert creation. Returns true if a new row was inserted, false if
// the dedupeKey already exists (re-scan hit).
//
// We use a pre-check + create instead of upsert/try-catch on P2002 so the
// scanner doesn't spam stderr with unique-constraint errors on every periodic
// re-scan. The dedupeKey is unique, so a fresh existence check before insert
// is race-safe enough for this scheduler use case (single-instance per tick).
async function persistAlert(input: AlertCreateInput): Promise<boolean> {
  const dedupeKey = buildDedupeKey(
    input.alertType,
    input.discrepancyId ?? input.auditId ?? input.siteId,
  );

  const existing = await prisma.consignmentOperationalAlert.findUnique({
    where: { dedupeKey },
    select: { id: true },
  });
  if (existing) {
    return false;
  }

  try {
    await prisma.consignmentOperationalAlert.create({
      data: {
        siteId: input.siteId,
        alertType: input.alertType,
        triggeredAt: input.triggeredAt,
        status: ConsignmentOperationalAlertStatus.PENDING,
        dedupeKey,
        ...(input.auditId ? { auditId: input.auditId } : {}),
        ...(input.discrepancyId ? { discrepancyId: input.discrepancyId } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
      },
    });
    return true;
  } catch (error) {
    // Race fallback: if a concurrent scanner inserted between our pre-check and
    // create, treat the P2002 as a no-op (the alert is now persisted by the
    // other scanner — that's still the right outcome).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return false;
    }
    throw error;
  }
}

export async function scanConsignmentOperationalAlerts(
  deps: ScanDependencies = {},
): Promise<ConsignmentOperationalAlertScanResult> {
  const now = new Date();
  const nowMs = now.getTime();
  const counts: Record<string, number> = {};
  let createdAlertCount = 0;

  // --- AUDIT alerts: scan all non-cancelled audits on non-exited sites. ---
  const audits = await prisma.consignmentAudit.findMany({
    where: {
      status: { not: ConsignmentAuditStatus.CANCELLED },
      site: { status: { not: ConsignmentSiteStatus.EXITED } },
    },
    select: {
      id: true,
      siteId: true,
      scheduledFor: true,
      completedAt: true,
      status: true,
    },
  });

  for (const audit of audits) {
    const scheduledMs = audit.scheduledFor.getTime();
    const completed = audit.status === ConsignmentAuditStatus.COMPLETED && audit.completedAt !== null;

    if (!completed) {
      // T-14: scheduledFor is exactly 14d away or closer (but not yet T-7 territory).
      if (nowMs >= scheduledMs - AUDIT_T_MINUS_14_MS && nowMs < scheduledMs - AUDIT_T_MINUS_7_MS) {
        if (await persistAlert({
          siteId: audit.siteId,
          alertType: ConsignmentOperationalAlertType.AUDIT_DUE_FOURTEEN_DAYS,
          auditId: audit.id,
          triggeredAt: now,
          metadata: { scheduledFor: audit.scheduledFor.toISOString() },
        })) {
          counts.AUDIT_DUE_FOURTEEN_DAYS = (counts.AUDIT_DUE_FOURTEEN_DAYS ?? 0) + 1;
          createdAlertCount++;
        }
      }
      // T-7: within last 7 days before scheduled.
      if (nowMs >= scheduledMs - AUDIT_T_MINUS_7_MS && nowMs < scheduledMs - DAY_MS) {
        if (await persistAlert({
          siteId: audit.siteId,
          alertType: ConsignmentOperationalAlertType.AUDIT_DUE_SEVEN_DAYS,
          auditId: audit.id,
          triggeredAt: now,
          metadata: { scheduledFor: audit.scheduledFor.toISOString() },
        })) {
          counts.AUDIT_DUE_SEVEN_DAYS = (counts.AUDIT_DUE_SEVEN_DAYS ?? 0) + 1;
          createdAlertCount++;
        }
      }
      // T-0: scheduled day reached and not completed.
      if (nowMs >= scheduledMs - DAY_MS && nowMs < scheduledMs + DAY_MS) {
        if (await persistAlert({
          siteId: audit.siteId,
          alertType: ConsignmentOperationalAlertType.AUDIT_DUE_TODAY,
          auditId: audit.id,
          triggeredAt: now,
          metadata: { scheduledFor: audit.scheduledFor.toISOString() },
        })) {
          counts.AUDIT_DUE_TODAY = (counts.AUDIT_DUE_TODAY ?? 0) + 1;
          createdAlertCount++;
        }
      }
      // +7: overdue by ≥7 days, alert TM+RD.
      if (nowMs >= scheduledMs + AUDIT_T_PLUS_7_MS && nowMs < scheduledMs + AUDIT_T_PLUS_14_MS) {
        if (await persistAlert({
          siteId: audit.siteId,
          alertType: ConsignmentOperationalAlertType.AUDIT_OVERDUE_SEVEN_DAYS,
          auditId: audit.id,
          triggeredAt: now,
          metadata: { scheduledFor: audit.scheduledFor.toISOString(), daysOverdue: 7 },
        })) {
          counts.AUDIT_OVERDUE_SEVEN_DAYS = (counts.AUDIT_OVERDUE_SEVEN_DAYS ?? 0) + 1;
          createdAlertCount++;
        }
      }
      // +14: overdue by ≥14 days, escalate to Sales Leadership.
      if (nowMs >= scheduledMs + AUDIT_T_PLUS_14_MS) {
        if (await persistAlert({
          siteId: audit.siteId,
          alertType: ConsignmentOperationalAlertType.AUDIT_OVERDUE_FOURTEEN_DAYS,
          auditId: audit.id,
          triggeredAt: now,
          metadata: { scheduledFor: audit.scheduledFor.toISOString(), daysOverdue: 14 },
        })) {
          counts.AUDIT_OVERDUE_FOURTEEN_DAYS = (counts.AUDIT_OVERDUE_FOURTEEN_DAYS ?? 0) + 1;
          createdAlertCount++;
        }
      }
    }
  }

  // --- PO CLOCK alerts: scan discrepancies with active PO follow-up. ---
  const discrepancies = await prisma.consignmentDiscrepancyCase.findMany({
    where: {
      AND: [
        { site: { status: { not: ConsignmentSiteStatus.EXITED } } },
        { poDueAt: { not: null } },
        {
          OR: [
            { poFollowUpStatus: ConsignmentPoFollowUpStatus.REQUIRED },
            { poFollowUpStatus: ConsignmentPoFollowUpStatus.ESCALATED },
            { status: ConsignmentDiscrepancyStatus.PO_REQUIRED },
          ],
        },
      ],
    },
    select: {
      id: true,
      siteId: true,
      trueUpConfirmedAt: true,
      poDueAt: true,
    },
  });

  for (const disc of discrepancies) {
    if (!disc.poDueAt) continue;
    const poDueMs = disc.poDueAt.getTime();
    const trueUpMs = disc.trueUpConfirmedAt?.getTime();

    // PO_CLOCK_START — fires once when the clock starts (true-up confirmed within last 24h).
    if (trueUpMs !== undefined && nowMs - trueUpMs <= DAY_MS) {
      if (await persistAlert({
        siteId: disc.siteId,
        alertType: ConsignmentOperationalAlertType.PO_CLOCK_START,
        discrepancyId: disc.id,
        triggeredAt: now,
        metadata: { poDueAt: disc.poDueAt.toISOString() },
      })) {
        counts.PO_CLOCK_START = (counts.PO_CLOCK_START ?? 0) + 1;
        createdAlertCount++;
      }
    }

    // T-3: poDueAt within (now, now + 3d] and not yet inside T-1 window.
    if (poDueMs - PO_CLOCK_T_MINUS_3_MS <= nowMs && poDueMs - PO_CLOCK_T_MINUS_1_MS > nowMs) {
      if (await persistAlert({
        siteId: disc.siteId,
        alertType: ConsignmentOperationalAlertType.PO_CLOCK_THREE_DAYS_REMAINING,
        discrepancyId: disc.id,
        triggeredAt: now,
        metadata: { poDueAt: disc.poDueAt.toISOString() },
      })) {
        counts.PO_CLOCK_THREE_DAYS_REMAINING = (counts.PO_CLOCK_THREE_DAYS_REMAINING ?? 0) + 1;
        createdAlertCount++;
      }
    }

    // T-1: poDueAt within (now, now + 1d].
    if (poDueMs - PO_CLOCK_T_MINUS_1_MS <= nowMs && poDueMs > nowMs) {
      if (await persistAlert({
        siteId: disc.siteId,
        alertType: ConsignmentOperationalAlertType.PO_CLOCK_ONE_DAY_REMAINING,
        discrepancyId: disc.id,
        triggeredAt: now,
        metadata: { poDueAt: disc.poDueAt.toISOString() },
      })) {
        counts.PO_CLOCK_ONE_DAY_REMAINING = (counts.PO_CLOCK_ONE_DAY_REMAINING ?? 0) + 1;
        createdAlertCount++;
      }
    }

    // +5: overdue by ≥5 days, alert TM+RD.
    if (nowMs - poDueMs >= PO_OVERDUE_5_DAYS_MS && nowMs - poDueMs < PO_OVERDUE_10_DAYS_MS) {
      if (await persistAlert({
        siteId: disc.siteId,
        alertType: ConsignmentOperationalAlertType.PO_OVERDUE_FIVE_DAYS,
        discrepancyId: disc.id,
        triggeredAt: now,
        metadata: { poDueAt: disc.poDueAt.toISOString(), daysOverdue: 5 },
      })) {
        counts.PO_OVERDUE_FIVE_DAYS = (counts.PO_OVERDUE_FIVE_DAYS ?? 0) + 1;
        createdAlertCount++;
      }
    }

    // +10: overdue by ≥10 days, escalate to Sales Leadership.
    if (nowMs - poDueMs >= PO_OVERDUE_10_DAYS_MS) {
      if (await persistAlert({
        siteId: disc.siteId,
        alertType: ConsignmentOperationalAlertType.PO_OVERDUE_TEN_DAYS,
        discrepancyId: disc.id,
        triggeredAt: now,
        metadata: { poDueAt: disc.poDueAt.toISOString(), daysOverdue: 10 },
      })) {
        counts.PO_OVERDUE_TEN_DAYS = (counts.PO_OVERDUE_TEN_DAYS ?? 0) + 1;
        createdAlertCount++;
      }
    }
  }

  const processedSiteCount = new Set([
    ...audits.map((a) => a.siteId),
    ...discrepancies.map((d) => d.siteId),
  ]).size;

  const result: ConsignmentOperationalAlertScanResult = {
    ok: true,
    processedSiteCount,
    createdAlertCount,
    alertsByType: counts,
    processedAt: now.toISOString(),
  };

  deps.logger?.info('consignment.operational_alert.scan_complete', { ...result });

  return result;
}

// pg-boss-compatible job handler. The handler delegates straight to the
// pure scanner so it can also be invoked synchronously from regression tests.
export async function processConsignmentOperationalAlertScanJob(
  _job: QueueJob<unknown>,
  deps: ScanDependencies = {},
): Promise<ConsignmentOperationalAlertScanResult> {
  const result = await scanConsignmentOperationalAlerts(deps);
  // FR-NOTIF bridge — surface consignment alerts to each site's owner TM/RD in-app. Best-effort.
  try {
    await syncConsignmentAlertNotifications();
  } catch {
    // Materializing in-app notifications must never fail the alert scan.
  }
  return result;
}

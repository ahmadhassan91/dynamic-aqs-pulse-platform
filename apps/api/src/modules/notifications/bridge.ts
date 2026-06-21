import { prisma } from '@pulse/db';
import { upsertUserNotification } from './service.js';

// Bridge (FR-NOTIF): materialize per-user in-app notifications from the existing operational-alert
// scanners (Lead + Consignment). Idempotent — upsert on (recipientUserId, dedupeKey) — and bounded by a
// lookback window so re-runs on each scan tick stay cheap. This is the "no external dependency" path that
// makes the Notification Center fill from alerts the scanners already produce, ahead of email/push.

const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH = 500;

function humanizeAlertType(alertType: string): string {
  const text = alertType.toLowerCase().replace(/_/g, ' ').trim();
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : 'Alert';
}

function severityForAlertType(alertType: string): 'info' | 'warning' | 'critical' {
  if (/OVERDUE|ESCALATION|LEADERSHIP/.test(alertType)) return 'critical';
  if (/DUE|MANAGER|BROADCAST|PO_/.test(alertType)) return 'warning';
  return 'info';
}

export async function syncLeadAlertNotifications(): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const alerts = await prisma.leadOperationalAlert.findMany({
    where: { recipientUserId: { not: null }, createdAt: { gte: since } },
    include: { lead: { select: { id: true, companyName: true } } },
    orderBy: { createdAt: 'desc' },
    take: BATCH,
  });

  let materialized = 0;
  for (const alert of alerts) {
    if (!alert.recipientUserId) {
      continue;
    }
    const label = alert.lead?.companyName ? ` — ${alert.lead.companyName}` : '';
    await upsertUserNotification({
      recipientUserId: alert.recipientUserId,
      category: 'lead',
      eventType: alert.alertType,
      title: `${humanizeAlertType(alert.alertType)}${label}`,
      severity: severityForAlertType(alert.alertType),
      deepLinkType: 'lead',
      deepLinkId: alert.leadId,
      sourceType: 'lead_operational_alert',
      sourceId: alert.id,
      dedupeKey: `lead-alert:${alert.id}`,
    });
    materialized += 1;
  }
  return materialized;
}

export async function syncConsignmentAlertNotifications(): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const alerts = await prisma.consignmentOperationalAlert.findMany({
    where: { createdAt: { gte: since } },
    include: { site: { select: { id: true, name: true, ownerTmUserId: true, ownerRdUserId: true } } },
    orderBy: { createdAt: 'desc' },
    take: BATCH,
  });

  let materialized = 0;
  for (const alert of alerts) {
    const recipients = [alert.site?.ownerTmUserId, alert.site?.ownerRdUserId].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    if (recipients.length === 0) {
      continue;
    }
    const label = alert.site?.name ? ` — ${alert.site.name}` : '';
    for (const recipientUserId of recipients) {
      await upsertUserNotification({
        recipientUserId,
        category: 'consignment',
        eventType: alert.alertType,
        title: `${humanizeAlertType(alert.alertType)}${label}`,
        severity: severityForAlertType(alert.alertType),
        deepLinkType: 'consignment',
        deepLinkId: alert.siteId,
        sourceType: 'consignment_operational_alert',
        sourceId: alert.id,
        dedupeKey: `consignment-alert:${alert.id}:${recipientUserId}`,
      });
      materialized += 1;
    }
  }
  return materialized;
}

export async function syncOperationalAlertNotifications(): Promise<{ lead: number; consignment: number }> {
  const [lead, consignment] = await Promise.all([syncLeadAlertNotifications(), syncConsignmentAlertNotifications()]);
  return { lead, consignment };
}

import { prisma } from '@pulse/db';
import { resolveRuleRecipients, upsertUserNotification } from './service.js';

// Bridge (FR-NOTIF): materialize per-user in-app notifications from the existing operational-alert
// scanners (Lead + Consignment). Recipients = entity defaults (assignee / site owner TM+RD) PLUS any
// admin routing-rule recipients (FR-NOTIF-005). Idempotent — upsert on (recipientUserId, dedupeKey) —
// and bounded by a lookback window so re-runs on each scan tick stay cheap.

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
    where: { createdAt: { gte: since } },
    include: { lead: { select: { id: true, companyName: true } } },
    orderBy: { createdAt: 'desc' },
    take: BATCH,
  });

  let materialized = 0;
  for (const alert of alerts) {
    const recipients = new Set<string>(await resolveRuleRecipients('lead', alert.alertType));
    if (alert.recipientUserId) {
      recipients.add(alert.recipientUserId);
    }
    if (recipients.size === 0) {
      continue;
    }
    const label = alert.lead?.companyName ? ` — ${alert.lead.companyName}` : '';
    for (const recipientUserId of recipients) {
      await upsertUserNotification({
        recipientUserId,
        category: 'lead',
        eventType: alert.alertType,
        title: `${humanizeAlertType(alert.alertType)}${label}`,
        severity: severityForAlertType(alert.alertType),
        deepLinkType: 'lead',
        deepLinkId: alert.leadId,
        sourceType: 'lead_operational_alert',
        sourceId: alert.id,
        dedupeKey: `lead-alert:${alert.id}:${recipientUserId}`,
      });
      materialized += 1;
    }
  }
  return materialized;
}

// GAP-N2 / CG: "when a CIS is received → notify (call this person + leadership)." Fires once per lead
// (dedupeKey per lead id) when cisSubmittedAt is set, to the assignee + RD + any routed recipients.
export async function syncLeadCisReceivedNotifications(): Promise<number> {
  const since = new Date(Date.now() - LOOKBACK_MS);
  const leads = await prisma.lead.findMany({
    where: { cisSubmittedAt: { not: null, gte: since } },
    select: { id: true, companyName: true, assignedTmUserId: true, assignedRdUserId: true },
    orderBy: { cisSubmittedAt: 'desc' },
    take: BATCH,
  });

  let materialized = 0;
  for (const lead of leads) {
    const recipients = new Set<string>(await resolveRuleRecipients('lead', 'cis_received'));
    if (lead.assignedTmUserId) {
      recipients.add(lead.assignedTmUserId);
    }
    if (lead.assignedRdUserId) {
      recipients.add(lead.assignedRdUserId);
    }
    if (recipients.size === 0) {
      continue;
    }
    for (const recipientUserId of recipients) {
      await upsertUserNotification({
        recipientUserId,
        category: 'lead',
        eventType: 'cis_received',
        title: `CIS received — ${lead.companyName}`,
        body: 'A customer information sheet was received. Review and call the contact.',
        severity: 'warning',
        deepLinkType: 'lead',
        deepLinkId: lead.id,
        sourceType: 'lead_cis',
        sourceId: lead.id,
        dedupeKey: `lead-cis-received:${lead.id}`,
      });
      materialized += 1;
    }
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
    const recipients = new Set<string>(await resolveRuleRecipients('consignment', alert.alertType));
    if (alert.site?.ownerTmUserId) {
      recipients.add(alert.site.ownerTmUserId);
    }
    if (alert.site?.ownerRdUserId) {
      recipients.add(alert.site.ownerRdUserId);
    }
    if (recipients.size === 0) {
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

// CRM-native visit-inactivity trigger (FR-RPT-039 engagement staleness → in-app inbox). Flags active accounts
// with no logged engagement in the threshold window and notifies the owning TM + RD (plus any 'account'
// routing-rule recipients). Idempotent per staleness episode: the dedupe key embeds the current
// lastEngagementAt, so a continuously-stale account is notified once, while a re-engaged-then-stale account
// produces a fresh notification.
const ACCOUNT_INACTIVITY_THRESHOLD_DAYS = 90;

export async function syncAccountInactivityNotifications(): Promise<number> {
  const thresholdDate = new Date(Date.now() - ACCOUNT_INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
  const accounts = await prisma.account.findMany({
    where: {
      isActive: true,
      assignedTmUserId: { not: null },
      OR: [{ lastEngagementAt: null }, { lastEngagementAt: { lt: thresholdDate } }],
    },
    select: {
      id: true,
      displayName: true,
      lastEngagementAt: true,
      assignedTmUserId: true,
      assignedRdUserId: true,
    },
    orderBy: [{ lastEngagementAt: { sort: 'asc', nulls: 'first' } }],
    take: BATCH,
  });

  let materialized = 0;
  for (const account of accounts) {
    const recipients = new Set<string>(await resolveRuleRecipients('account', 'visit_inactivity'));
    if (account.assignedTmUserId) {
      recipients.add(account.assignedTmUserId);
    }
    if (account.assignedRdUserId) {
      recipients.add(account.assignedRdUserId);
    }
    if (recipients.size === 0) {
      continue;
    }
    const episode = account.lastEngagementAt ? account.lastEngagementAt.toISOString() : 'never';
    for (const recipientUserId of recipients) {
      await upsertUserNotification({
        recipientUserId,
        category: 'account',
        eventType: 'visit_inactivity',
        title: `No recent contact — ${account.displayName}`,
        body: `No logged engagement in over ${ACCOUNT_INACTIVITY_THRESHOLD_DAYS} days. Reach out to keep this account active.`,
        severity: 'warning',
        deepLinkType: 'account',
        deepLinkId: account.id,
        sourceType: 'account_inactivity',
        sourceId: account.id,
        dedupeKey: `account-inactivity:${account.id}:${episode}:${recipientUserId}`,
      });
      materialized += 1;
    }
  }
  return materialized;
}

export async function syncOperationalAlertNotifications(): Promise<{ lead: number; consignment: number; account: number }> {
  const [lead, consignment, account] = await Promise.all([
    syncLeadAlertNotifications(),
    syncConsignmentAlertNotifications(),
    syncAccountInactivityNotifications(),
  ]);
  return { lead, consignment, account };
}

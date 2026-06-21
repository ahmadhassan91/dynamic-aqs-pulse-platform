import { Prisma, UserNotificationCategory, UserNotificationSeverity, prisma } from '@pulse/db';
import { USER_NOTIFICATION_CATEGORIES } from '@pulse/contracts/notifications';
import type {
  ListNotificationPreferencesResponse,
  ListUserNotificationsRequest,
  ListUserNotificationsResponse,
  MarkNotificationsReadRequest,
  MarkNotificationsReadResponse,
  UnreadNotificationCountResponse,
  UpdateNotificationPreferenceRequest,
  UserNotificationCategoryKey,
  UserNotificationSeverityKey,
  UserNotificationSummary,
} from '@pulse/contracts/notifications';
import type { AuthenticatedActor } from '../auth/types.js';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const CATEGORY_TO_DB: Record<UserNotificationCategoryKey, UserNotificationCategory> = {
  lead: UserNotificationCategory.LEAD,
  consignment: UserNotificationCategory.CONSIGNMENT,
  training: UserNotificationCategory.TRAINING,
  order: UserNotificationCategory.ORDER,
  account: UserNotificationCategory.ACCOUNT,
  system: UserNotificationCategory.SYSTEM,
};

const CATEGORY_TO_KEY: Record<UserNotificationCategory, UserNotificationCategoryKey> = {
  LEAD: 'lead',
  CONSIGNMENT: 'consignment',
  TRAINING: 'training',
  ORDER: 'order',
  ACCOUNT: 'account',
  SYSTEM: 'system',
};

const SEVERITY_TO_DB: Record<UserNotificationSeverityKey, UserNotificationSeverity> = {
  info: UserNotificationSeverity.INFO,
  warning: UserNotificationSeverity.WARNING,
  critical: UserNotificationSeverity.CRITICAL,
};

const SEVERITY_TO_KEY: Record<UserNotificationSeverity, UserNotificationSeverityKey> = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
};

type UserNotificationRecord = Awaited<ReturnType<typeof prisma.userNotification.findFirstOrThrow>>;

function toSummary(notification: UserNotificationRecord): UserNotificationSummary {
  return {
    id: notification.id,
    category: CATEGORY_TO_KEY[notification.category],
    eventType: notification.eventType,
    severity: SEVERITY_TO_KEY[notification.severity],
    title: notification.title,
    ...(notification.body ? { body: notification.body } : {}),
    ...(notification.deepLinkType ? { deepLinkType: notification.deepLinkType } : {}),
    ...(notification.deepLinkId ? { deepLinkId: notification.deepLinkId } : {}),
    isRead: notification.readAt !== null,
    ...(notification.readAt ? { readAt: notification.readAt.toISOString() } : {}),
    createdAt: notification.createdAt.toISOString(),
  };
}

function unreadWhere(userId: string): Prisma.UserNotificationWhereInput {
  return { recipientUserId: userId, readAt: null, archivedAt: null };
}

export async function getUnreadNotificationCount(actor: AuthenticatedActor): Promise<UnreadNotificationCountResponse> {
  const unreadCount = await prisma.userNotification.count({ where: unreadWhere(actor.userId) });
  return { unreadCount };
}

export async function listUserNotifications(
  actor: AuthenticatedActor,
  query: ListUserNotificationsRequest = {},
): Promise<ListUserNotificationsResponse> {
  const limit = Math.min(Math.max(query.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(query.offset ?? 0, 0);
  const status = query.status ?? 'all';

  const where: Prisma.UserNotificationWhereInput = { recipientUserId: actor.userId };
  if (status === 'archived') {
    where.archivedAt = { not: null };
  } else {
    where.archivedAt = null;
    if (status === 'unread') {
      where.readAt = null;
    }
  }
  if (query.category) {
    where.category = CATEGORY_TO_DB[query.category];
  }

  const [items, total, unreadCount] = await Promise.all([
    prisma.userNotification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    prisma.userNotification.count({ where }),
    prisma.userNotification.count({ where: unreadWhere(actor.userId) }),
  ]);

  return { items: items.map(toSummary), total, unreadCount };
}

export async function markNotificationsRead(
  actor: AuthenticatedActor,
  input: MarkNotificationsReadRequest = {},
): Promise<MarkNotificationsReadResponse> {
  const where: Prisma.UserNotificationWhereInput = { recipientUserId: actor.userId, readAt: null };
  if (!input.all) {
    const ids = (input.ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) {
      const unreadCount = await prisma.userNotification.count({ where: unreadWhere(actor.userId) });
      return { updated: 0, unreadCount };
    }
    where.id = { in: ids };
  }

  const result = await prisma.userNotification.updateMany({ where, data: { readAt: new Date() } });
  const unreadCount = await prisma.userNotification.count({ where: unreadWhere(actor.userId) });
  return { updated: result.count, unreadCount };
}

export async function archiveNotification(
  actor: AuthenticatedActor,
  notificationId: string,
): Promise<UserNotificationSummary | null> {
  // Scope to the actor so one user can never archive another's notification.
  const existing = await prisma.userNotification.findFirst({
    where: { id: notificationId, recipientUserId: actor.userId },
  });
  if (!existing) {
    return null;
  }
  const now = new Date();
  const updated = await prisma.userNotification.update({
    where: { id: existing.id },
    data: { archivedAt: existing.archivedAt ?? now, readAt: existing.readAt ?? now },
  });
  return toSummary(updated);
}

// Internal helper for other modules / the alert bridge to materialize a per-user notification.
// Idempotent on (recipientUserId, dedupeKey): a re-scan refreshes title/severity without losing read state.
export interface CreateUserNotificationInput {
  recipientUserId: string;
  category: UserNotificationCategoryKey;
  eventType: string;
  title: string;
  body?: string;
  severity?: UserNotificationSeverityKey;
  deepLinkType?: string;
  deepLinkId?: string;
  sourceType?: string;
  sourceId?: string;
  dedupeKey: string;
  metadata?: Prisma.InputJsonValue;
}

export async function upsertUserNotification(input: CreateUserNotificationInput): Promise<void> {
  // FR-NOTIF-006: respect the recipient's per-category preference (absence of a row = enabled).
  if (!(await isCategoryEnabledForUser(input.recipientUserId, input.category))) {
    return;
  }
  const severity = SEVERITY_TO_DB[input.severity ?? 'info'];
  await prisma.userNotification.upsert({
    where: { recipientUserId_dedupeKey: { recipientUserId: input.recipientUserId, dedupeKey: input.dedupeKey } },
    create: {
      recipientUserId: input.recipientUserId,
      category: CATEGORY_TO_DB[input.category],
      eventType: input.eventType,
      severity,
      title: input.title,
      dedupeKey: input.dedupeKey,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.deepLinkType !== undefined ? { deepLinkType: input.deepLinkType } : {}),
      ...(input.deepLinkId !== undefined ? { deepLinkId: input.deepLinkId } : {}),
      ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
      ...(input.sourceId !== undefined ? { sourceId: input.sourceId } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
    update: {
      title: input.title,
      severity,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}

// FR-NOTIF-006 — per-user, per-category in-app preference. Absence of a row = enabled (opt-out model).
export async function isCategoryEnabledForUser(
  recipientUserId: string,
  category: UserNotificationCategoryKey,
): Promise<boolean> {
  const preference = await prisma.userNotificationPreference.findUnique({
    where: { recipientUserId_category: { recipientUserId, category: CATEGORY_TO_DB[category] } },
  });
  return preference ? preference.inAppEnabled : true;
}

export async function listNotificationPreferences(actor: AuthenticatedActor): Promise<ListNotificationPreferencesResponse> {
  const rows = await prisma.userNotificationPreference.findMany({ where: { recipientUserId: actor.userId } });
  const byCategory = new Map(rows.map((row) => [row.category, row.inAppEnabled] as const));
  const preferences = USER_NOTIFICATION_CATEGORIES.map((category) => ({
    category,
    inAppEnabled: byCategory.get(CATEGORY_TO_DB[category]) ?? true,
  }));
  return { preferences };
}

export async function updateNotificationPreference(
  actor: AuthenticatedActor,
  input: UpdateNotificationPreferenceRequest,
): Promise<ListNotificationPreferencesResponse> {
  await prisma.userNotificationPreference.upsert({
    where: { recipientUserId_category: { recipientUserId: actor.userId, category: CATEGORY_TO_DB[input.category] } },
    create: { recipientUserId: actor.userId, category: CATEGORY_TO_DB[input.category], inAppEnabled: input.inAppEnabled },
    update: { inAppEnabled: input.inAppEnabled },
  });
  return listNotificationPreferences(actor);
}

// FR-NOTIF — per-user in-app notification inbox. Channel-agnostic summary the Notification Center renders.

export const USER_NOTIFICATION_CATEGORIES = [
  'lead',
  'consignment',
  'training',
  'order',
  'account',
  'system',
] as const;
export type UserNotificationCategoryKey = (typeof USER_NOTIFICATION_CATEGORIES)[number];

export const USER_NOTIFICATION_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type UserNotificationSeverityKey = (typeof USER_NOTIFICATION_SEVERITIES)[number];

export interface UserNotificationSummary {
  id: string;
  category: UserNotificationCategoryKey;
  eventType: string;
  severity: UserNotificationSeverityKey;
  title: string;
  body?: string;
  /** Entity reference for deep-linking (e.g. deepLinkType 'lead' + deepLinkId '<uuid>'). */
  deepLinkType?: string;
  deepLinkId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ListUserNotificationsRequest {
  status?: 'all' | 'unread' | 'archived';
  category?: UserNotificationCategoryKey;
  limit?: number;
  offset?: number;
}

export interface ListUserNotificationsResponse {
  items: UserNotificationSummary[];
  total: number;
  unreadCount: number;
}

export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export interface MarkNotificationsReadRequest {
  /** Specific notification ids to mark read; ignored when `all` is true. */
  ids?: string[];
  /** Mark every unread notification for the actor as read. */
  all?: boolean;
}

export interface MarkNotificationsReadResponse {
  updated: number;
  unreadCount: number;
}

// FR-NOTIF-006 — per-user, per-category in-app preference (absence = enabled).
export interface UserNotificationPreferenceSummary {
  category: UserNotificationCategoryKey;
  inAppEnabled: boolean;
}

export interface ListNotificationPreferencesResponse {
  preferences: UserNotificationPreferenceSummary[];
}

export interface UpdateNotificationPreferenceRequest {
  category: UserNotificationCategoryKey;
  inAppEnabled: boolean;
}

// FR-NOTIF-005 — admin-configurable routing rules (who else gets a category/event).
export const NOTIFICATION_ROUTING_RECIPIENT_TYPES = ['role', 'user'] as const;
export type NotificationRoutingRecipientTypeKey = (typeof NOTIFICATION_ROUTING_RECIPIENT_TYPES)[number];

export interface NotificationRoutingRuleSummary {
  id: string;
  category: UserNotificationCategoryKey;
  /** null/undefined = applies to every event in the category. */
  eventType?: string;
  recipientType: NotificationRoutingRecipientTypeKey;
  recipientRoleCode?: string;
  recipientUserId?: string;
  isActive: boolean;
  note?: string;
  createdAt: string;
}

export interface ListNotificationRoutingRulesResponse {
  rules: NotificationRoutingRuleSummary[];
}

export interface CreateNotificationRoutingRuleRequest {
  category: UserNotificationCategoryKey;
  eventType?: string;
  recipientType: NotificationRoutingRecipientTypeKey;
  recipientRoleCode?: string;
  recipientUserId?: string;
  note?: string;
}

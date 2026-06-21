import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import {
  NOTIFICATION_ROUTING_RECIPIENT_TYPES,
  USER_NOTIFICATION_CATEGORIES,
  type CreateNotificationRoutingRuleRequest,
  type ListUserNotificationsRequest,
  type MarkNotificationsReadRequest,
  type UpdateNotificationPreferenceRequest,
  type UserNotificationCategoryKey,
} from '@pulse/contracts/notifications';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import { isAuthenticationError, isAuthorizationError, requireAuthenticatedActor } from '../auth/request.js';
import {
  archiveNotification,
  createNotificationRoutingRule,
  deleteNotificationRoutingRule,
  getUnreadNotificationCount,
  listNotificationPreferences,
  listNotificationRoutingRules,
  listUserNotifications,
  markNotificationsRead,
  updateNotificationPreference,
} from './service.js';

// Notifications are per-user: every route resolves the authenticated actor and operates only on that
// actor's own notifications (no module/action gate — any signed-in user has an inbox).
export async function handleNotificationRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isNotificationRoute =
    pathname === '/api/v1/notifications'
    || pathname === '/api/v1/notifications/unread-count'
    || pathname === '/api/v1/notifications/preferences'
    || pathname === '/api/v1/notifications/routing-rules'
    || pathname === '/api/v1/notifications/mark-read'
    || /^\/api\/v1\/notifications\/routing-rules\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/notifications\/[^/]+\/archive$/.test(pathname);

  if (!isNotificationRoute) {
    return false;
  }

  try {
    if (pathname === '/api/v1/notifications/unread-count') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }
      const actor = await requireAuthenticatedActor(req);
      return jsonResponse(res, 200, await getUnreadNotificationCount(actor));
    }

    if (pathname === '/api/v1/notifications/preferences') {
      const actor = await requireAuthenticatedActor(req);
      if (method === 'GET') {
        return jsonResponse(res, 200, await listNotificationPreferences(actor));
      }
      if (method === 'PUT') {
        const body = ((await readJsonBody(req)) ?? {}) as UpdateNotificationPreferenceRequest;
        if (!body.category || !(USER_NOTIFICATION_CATEGORIES as readonly string[]).includes(body.category)) {
          return badRequestResponse(res, 'A valid notification category is required.');
        }
        return jsonResponse(res, 200, await updateNotificationPreference(actor, { category: body.category, inAppEnabled: Boolean(body.inAppEnabled) }));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'PUT']);
    }

    if (pathname === '/api/v1/notifications/routing-rules') {
      // Admin-configurable routing (FR-NOTIF-005) — gated on the admin module.
      await requireAuthenticatedActor(req, { module: 'admin' });
      if (method === 'GET') {
        return jsonResponse(res, 200, await listNotificationRoutingRules());
      }
      if (method === 'POST') {
        const body = ((await readJsonBody(req)) ?? {}) as CreateNotificationRoutingRuleRequest;
        if (!body.category || !(USER_NOTIFICATION_CATEGORIES as readonly string[]).includes(body.category)) {
          return badRequestResponse(res, 'A valid notification category is required.');
        }
        if (!body.recipientType || !(NOTIFICATION_ROUTING_RECIPIENT_TYPES as readonly string[]).includes(body.recipientType)) {
          return badRequestResponse(res, 'recipientType must be "role" or "user".');
        }
        return jsonResponse(res, 201, await createNotificationRoutingRule(body));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const routingRuleMatch = pathname.match(/^\/api\/v1\/notifications\/routing-rules\/([^/]+)$/);
    if (routingRuleMatch) {
      if (method !== 'DELETE') {
        return methodNotAllowedResponse(res, method, ['DELETE']);
      }
      await requireAuthenticatedActor(req, { module: 'admin' });
      const ruleId = routingRuleMatch[1];
      if (!ruleId) {
        return false;
      }
      const deleted = await deleteNotificationRoutingRule(ruleId);
      if (!deleted) {
        return notFoundResponse(res, { entity: 'NotificationRoutingRule', id: ruleId });
      }
      return jsonResponse(res, 200, { ok: true });
    }

    if (pathname === '/api/v1/notifications/mark-read') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }
      const actor = await requireAuthenticatedActor(req);
      const body = ((await readJsonBody(req)) ?? {}) as MarkNotificationsReadRequest;
      return jsonResponse(res, 200, await markNotificationsRead(actor, body));
    }

    const archiveMatch = pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/archive$/);
    if (archiveMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }
      const notificationId = archiveMatch[1];
      if (!notificationId) {
        return false;
      }
      const actor = await requireAuthenticatedActor(req);
      const result = await archiveNotification(actor, notificationId);
      if (!result) {
        return notFoundResponse(res, { entity: 'UserNotification', id: notificationId });
      }
      return jsonResponse(res, 200, result);
    }

    if (pathname === '/api/v1/notifications') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }
      const actor = await requireAuthenticatedActor(req);
      const query: ListUserNotificationsRequest = {};
      const status = url.searchParams.get('status')?.trim();
      if (status === 'unread' || status === 'archived' || status === 'all') {
        query.status = status;
      }
      const category = url.searchParams.get('category')?.trim();
      if (category && (USER_NOTIFICATION_CATEGORIES as readonly string[]).includes(category)) {
        query.category = category as UserNotificationCategoryKey;
      }
      const limit = Number(url.searchParams.get('limit'));
      if (Number.isInteger(limit)) {
        query.limit = limit;
      }
      const offset = Number(url.searchParams.get('offset'));
      if (Number.isInteger(offset)) {
        query.offset = offset;
      }
      return jsonResponse(res, 200, await listUserNotifications(actor, query));
    }

    return false;
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }
    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }
    const message = error instanceof Error ? error.message : String(error);
    return badRequestResponse(res, message);
  }
}

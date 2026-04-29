import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  UpdateAdminMicrosoftEntraIntegrationSettingsRequest,
  UpdateAdminCalendarIntegrationSettingsRequest,
  UpdateAdminPaymentIntegrationSettingsRequest,
  CreateAdminUserRequest,
  ImportAdminUsersRequest,
  ListAdminActivityRequest,
  ListAdminUsersRequest,
  ResetAdminUserPasswordRequest,
  UpdateAdminUserRequest,
  WorkspaceActionKey,
  WorkspaceModuleKey,
} from '@pulse/contracts';
import type {
  DeadLetterLeadOperationalAlertDeliveriesRequest,
  RetryLeadOperationalAlertDeliveriesRequest,
  UpdateLeadOperationalAlertQuietHoursRequest,
  UpdateLeadOperationalAlertRecipientRequest,
} from '@pulse/contracts/leads';
import type { AppConfig } from '../../config.js';
import type { QueueManager } from '../../queue/contracts.js';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  createAdminUser,
  getAdminIntegrationStatus,
  getAdminOverview,
  getAdminSystemHealth,
  importAdminUsers,
  listAdminActivity,
  listAdminRoleAccess,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from './service.js';
import {
  getMicrosoftEntraAdminSettings,
  updateMicrosoftEntraAdminSettings,
} from '../auth/policy.js';
import {
  getOutlookCalendarAdminSettings,
  updateOutlookCalendarAdminSettings,
} from '../calendar/policy.js';
import {
  getPaymentIntegrationAdminSettings,
  updatePaymentIntegrationAdminSettings,
} from '../cis/policy.js';
import {
  deadLetterLeadOperationalAlertDeliveries,
  getLeadOperationalAlertDeliveryAdminSettings,
  retryLeadOperationalAlertDeliveries,
  updateLeadOperationalAlertQuietHours,
  updateLeadOperationalAlertRecipient,
} from '../leads/service.js';

type AdminRouteDependencies = {
  config: AppConfig;
  queue: QueueManager;
  getDatabaseHealth: () => Promise<{
    ok: boolean;
    checkedAt: string;
    error?: string | undefined;
  }>;
  getQueueStatus: () => Promise<{
    ok: boolean;
    state?: string;
    error?: string | undefined;
  }>;
  getWorkersStatus: () => Promise<{
    running?: boolean;
    registeredWorkers?: number;
    queue?: {
      registeredWorkers?: number;
    };
  }>;
  getAcumaticaHealth: () => Promise<{
    ok: boolean;
    checkedAt?: string | undefined;
    status?: string | undefined;
    error?: string | undefined;
  }>;
};

type AdminPermission = {
  module?: WorkspaceModuleKey;
  action?: WorkspaceActionKey;
};

export async function handleAdminRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: AdminRouteDependencies,
) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (pathname === '/api/v1/admin/overview') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.user_view' }, async () => {
      const overview = await getAdminOverview();
      return jsonResponse(res, 200, overview);
    });
  }

  if (pathname === '/api/v1/admin/users') {
    if (method === 'GET') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.user_view' }, async () => {
        const search = url.searchParams.get('search');
        const role = url.searchParams.get('role');
        const status = url.searchParams.get('status');
        const page = url.searchParams.get('page');
        const limit = url.searchParams.get('limit');

        const query: ListAdminUsersRequest = {};
        if (search) query.search = search;
        if (role) {
          query.role = role as NonNullable<ListAdminUsersRequest['role']>;
        }
        if (status) {
          query.status = status as NonNullable<ListAdminUsersRequest['status']>;
        }
        if (page) query.page = Number(page);
        if (limit) query.limit = Number(limit);

        const response = await listAdminUsers(query);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'POST') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.user_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateAdminUserRequest;
        const response = await createAdminUser(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  }

  if (pathname === '/api/v1/admin/users/import') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.user_manage' }, async (actor) => {
      const body = (await readJsonBody(req)) as ImportAdminUsersRequest;
      const response = await importAdminUsers(actor, body);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname.startsWith('/api/v1/admin/users/')) {
    const segments = pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    const previousSegment = segments[segments.length - 2];
    const resetPassword = lastSegment === 'reset-password' && previousSegment ? previousSegment : null;
    const userId = lastSegment === 'reset-password' ? previousSegment : lastSegment;

    if (!userId) {
      return badRequestResponse(res, 'User id is required');
    }

    if (resetPassword) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      return withAdminAuth(req, res, { module: 'admin', action: 'admin.user_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as ResetAdminUserPasswordRequest;
        const response = await resetAdminUserPassword(actor, resetPassword, body);
        return jsonResponse(res, 200, response);
      });
    }

    if (method !== 'PATCH') {
      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.user_manage' }, async (actor) => {
      const body = (await readJsonBody(req)) as UpdateAdminUserRequest;
      const response = await updateAdminUser(actor, userId, body);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/access/roles') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.role_view' }, async () => {
      const response = await listAdminRoleAccess();
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/activity') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.audit_view' }, async () => {
      const actorUserId = url.searchParams.get('actorUserId');
      const action = url.searchParams.get('action');
      const entityType = url.searchParams.get('entityType');
      const limit = url.searchParams.get('limit');

      const query: ListAdminActivityRequest = {};
      if (actorUserId) query.actorUserId = actorUserId;
      if (action) query.action = action;
      if (entityType) query.entityType = entityType;
      if (limit) query.limit = Number(limit);

      const response = await listAdminActivity(query);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/system-health') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.system_health_view' }, async () => {
      const snapshot = await buildAdminSystemSnapshot(dependencies);
      const response = await getAdminSystemHealth(snapshot);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/integrations') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_view' }, async () => {
      const snapshot = await buildAdminSystemSnapshot(dependencies);
      const response = await getAdminIntegrationStatus(snapshot);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/integrations/calendar') {
    if (method === 'GET') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_view' }, async () => {
        const response = await getOutlookCalendarAdminSettings(dependencies.config);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'PATCH') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateAdminCalendarIntegrationSettingsRequest;
        const response = await updateOutlookCalendarAdminSettings(actor, dependencies.config, body);
        return jsonResponse(res, 200, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
  }

  if (pathname === '/api/v1/admin/integrations/payments') {
    if (method === 'GET') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_view' }, async () => {
        const response = await getPaymentIntegrationAdminSettings(dependencies.config);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'PATCH') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateAdminPaymentIntegrationSettingsRequest;
        const response = await updatePaymentIntegrationAdminSettings(dependencies.config, actor, body);
        return jsonResponse(res, 200, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
  }

  if (pathname === '/api/v1/admin/integrations/auth') {
    if (method === 'GET') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_view' }, async () => {
        const response = await getMicrosoftEntraAdminSettings(dependencies.config);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'PATCH') {
      return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateAdminMicrosoftEntraIntegrationSettingsRequest;
        const response = await updateMicrosoftEntraAdminSettings(actor, dependencies.config, body);
        return jsonResponse(res, 200, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
  }

  if (pathname === '/api/v1/admin/integrations/lead-alerts') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_view' }, async () => {
      const response = await getLeadOperationalAlertDeliveryAdminSettings(dependencies.config);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/integrations/lead-alerts/retry') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
      const body = (await readJsonBody(req)) as RetryLeadOperationalAlertDeliveriesRequest;
      const response = await retryLeadOperationalAlertDeliveries(actor, body, { queue: dependencies.queue });
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/integrations/lead-alerts/dead-letter') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
      const body = (await readJsonBody(req)) as DeadLetterLeadOperationalAlertDeliveriesRequest;
      const response = await deadLetterLeadOperationalAlertDeliveries(actor, dependencies.config, body);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/admin/integrations/lead-alerts/quiet-hours') {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
      const body = (await readJsonBody(req)) as UpdateLeadOperationalAlertQuietHoursRequest;
      await updateLeadOperationalAlertQuietHours(actor, body);
      const response = await getLeadOperationalAlertDeliveryAdminSettings(dependencies.config);
      return jsonResponse(res, 200, response);
    });
  }

  const leadAlertRecipientMatch = pathname.match(/^\/api\/v1\/admin\/integrations\/lead-alerts\/recipients\/([^/]+)$/);
  if (leadAlertRecipientMatch?.[1]) {
    const recipientId = decodeURIComponent(leadAlertRecipientMatch[1]);
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    return withAdminAuth(req, res, { module: 'admin', action: 'admin.integration_manage' }, async (actor) => {
      const body = (await readJsonBody(req)) as UpdateLeadOperationalAlertRecipientRequest;
      await updateLeadOperationalAlertRecipient(actor, recipientId, body);
      const response = await getLeadOperationalAlertDeliveryAdminSettings(dependencies.config);
      return jsonResponse(res, 200, response);
    });
  }

  return false;
}

async function buildAdminSystemSnapshot(dependencies: AdminRouteDependencies) {
  const [database, queue, workers, acumatica] = await Promise.all([
    dependencies.getDatabaseHealth(),
    dependencies.getQueueStatus(),
    dependencies.getWorkersStatus(),
    dependencies.getAcumaticaHealth(),
  ]);

  return {
    config: dependencies.config,
    database,
    queue,
    workers,
    acumatica,
  };
}

async function withAdminAuth(
  req: IncomingMessage,
  res: ServerResponse,
  permission: AdminPermission,
  handler: (actor: Awaited<ReturnType<typeof requireAuthenticatedActor>>) => Promise<void>,
) {
  try {
    const actor = await requireAuthenticatedActor(req, permission);
    return await handler(actor);
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }
    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }
    return badRequestResponse(res, error instanceof Error ? error.message : String(error));
  }
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import { AuthorizationError } from '@pulse/auth';
import type {
  CreateAdminUserRequest,
  ImportAdminUsersRequest,
  ListAdminActivityRequest,
  ListAdminUsersRequest,
  ResetAdminUserPasswordRequest,
  UpdateAdminUserRequest,
  WorkspaceActionKey,
  WorkspaceModuleKey,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import { AuthenticationError, requireAuthenticatedActor } from '../auth/request.js';
import {
  createAdminUser,
  getAdminOverview,
  importAdminUsers,
  listAdminActivity,
  listAdminRoleAccess,
  listAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from './service.js';

type AdminRouteDependencies = {
  config: AppConfig;
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

  return false;
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
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(res, error.message);
    }
    if (error instanceof AuthorizationError) {
      return forbiddenResponse(res, error.message);
    }
    return badRequestResponse(res, error instanceof Error ? error.message : String(error));
  }
}

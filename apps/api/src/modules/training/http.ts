import { AuthorizationError } from '@pulse/auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CreateAccountTrainingProgramRequest,
  CreateTrainingCategoryRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  ListTrainingAccountsRequest,
} from '@pulse/contracts';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import { AuthenticationError, requireAuthenticatedActor } from '../auth/request.js';
import type { AuthenticatedActor } from '../auth/types.js';
import {
  createAccountTrainingProgram,
  createTrainingCategory,
  createTrainingTemplate,
  createTrainingType,
  getAccountTrainingHistory,
  listTrainingAccounts,
  listTrainingCatalog,
  listTrainingOverview,
} from './service.js';

export async function handleTrainingRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;
  const isTrainingRoute =
    pathname === '/api/v1/training/overview'
    || pathname === '/api/v1/training/catalog'
    || pathname === '/api/v1/training/catalog/categories'
    || pathname === '/api/v1/training/catalog/types'
    || pathname === '/api/v1/training/catalog/templates'
    || pathname === '/api/v1/training/accounts'
    || /^\/api\/v1\/training\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/training\/accounts\/[^/]+\/programs$/.test(pathname);

  if (!isTrainingRoute) {
    return false;
  }

  try {
    if (pathname === '/api/v1/training/overview') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const response = await listTrainingOverview(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/catalog') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const response = await listTrainingCatalog(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/catalog/categories') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      return withTrainingAuth(req, res, { action: 'training.catalog_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateTrainingCategoryRequest;
        const response = await createTrainingCategory(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    if (pathname === '/api/v1/training/catalog/types') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      return withTrainingAuth(req, res, { action: 'training.catalog_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateTrainingTypeRequest;
        const response = await createTrainingType(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    if (pathname === '/api/v1/training/catalog/templates') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      return withTrainingAuth(req, res, { action: 'training.catalog_manage' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateTrainingTemplateRequest;
        const response = await createTrainingTemplate(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    if (pathname === '/api/v1/training/accounts') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const query: ListTrainingAccountsRequest = {};
        const search = url.searchParams.get('search')?.trim();
        const status = url.searchParams.get('status')?.trim();
        const limit = parseInteger(url.searchParams.get('limit'));
        const includeInactive = parseBoolean(url.searchParams.get('includeInactive'));

        if (search) {
          query.search = search;
        }
        const normalizedStatus = status && ['all', 'overdue', 'active_programs', 'no_programs'].includes(status)
          ? (status as NonNullable<ListTrainingAccountsRequest['status']>)
          : null;
        if (normalizedStatus) {
          query.status = normalizedStatus;
        }
        if (limit !== undefined) {
          query.limit = limit;
        }
        if (includeInactive !== undefined) {
          query.includeInactive = includeInactive;
        }

        const response = await listTrainingAccounts(actor, query);
        return jsonResponse(res, 200, response);
      });
    }

    const accountDetailMatch = pathname.match(/^\/api\/v1\/training\/accounts\/([^/]+)$/);
    if (accountDetailMatch) {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const accountId = accountDetailMatch[1];
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const response = await getAccountTrainingHistory(actor, accountId);
        if (!response) {
          return notFoundResponse(res, { entity: 'AccountTrainingHistory', id: accountId });
        }

        return jsonResponse(res, 200, response);
      });
    }

    const accountProgramsMatch = pathname.match(/^\/api\/v1\/training\/accounts\/([^/]+)\/programs$/);
    if (accountProgramsMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const accountId = accountProgramsMatch[1];
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateAccountTrainingProgramRequest;
        const response = await createAccountTrainingProgram(actor, accountId, body);
        return jsonResponse(res, 201, response);
      });
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(res, error.message);
    }

    if (error instanceof AuthorizationError) {
      return forbiddenResponse(res, error.message);
    }

    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message.toLowerCase().includes('not found') ? 404 : 400;

    if (statusCode === 404) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

async function withTrainingAuth(
  req: IncomingMessage,
  res: ServerResponse,
  permission: {
    module?: 'training';
    action?: 'training.catalog_manage' | 'training.schedule';
  },
  handler: (actor: AuthenticatedActor) => Promise<unknown>,
) {
  const actor = await requireAuthenticatedActor(req, permission);
  return handler(actor);
}

function parseInteger(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | null) {
  if (value === null) {
    return undefined;
  }

  return value.toLowerCase() === 'true';
}

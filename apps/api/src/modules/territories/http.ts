import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import { AuthorizationError } from '@pulse/auth';
import type {
  CreateRegionRequest,
  CreateShippingCenterRequest,
  CreateTerritoryRequest,
  ReassignLeadTerritoryRequest,
  ReplaceTerritoryCoverageRequest,
  UpdateRegionRequest,
  UpdateShippingCenterRequest,
  UpdateTerritoryPolicyRequest,
  UpdateTerritoryRequest,
} from '@pulse/contracts';
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
  createRegion,
  createShippingCenter,
  createTerritory,
  getTerritoryMapWorkspace,
  getTerritoryPolicy,
  listTerritoryAssignableUsers,
  listRegions,
  listShippingCenters,
  listTerritories,
  listTerritoryAssignmentHistory,
  reassignLeadTerritory,
  replaceTerritoryCoverage,
  updateRegion,
  updateShippingCenter,
  updateTerritory,
  updateTerritoryPolicy,
} from './service.js';

export async function handleTerritoryRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (pathname === '/api/v1/territories/policy') {
    if (method === 'GET') {
      return withTerritoryAuth(req, res, async (actor) => {
        const response = await getTerritoryPolicy(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'PATCH') {
      return withTerritoryAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateTerritoryPolicyRequest;
        const response = await updateTerritoryPolicy(actor, body);
        return jsonResponse(res, 200, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
  }

  if (pathname === '/api/v1/territories/regions') {
    if (method === 'GET') {
      return withTerritoryAuth(req, res, async (actor) => {
        const response = await listRegions(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'POST') {
      return withTerritoryAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as CreateRegionRequest;
        const response = await createRegion(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  }

  if (pathname.startsWith('/api/v1/territories/regions/')) {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    const regionId = pathname.split('/').filter(Boolean).at(-1);
    if (!regionId) {
      return badRequestResponse(res, 'Region id is required');
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const body = (await readJsonBody(req)) as UpdateRegionRequest;
      const response = await updateRegion(actor, regionId, body);
      if (!response) {
        return jsonResponse(res, 404, {
          error: 'NOT_FOUND',
          detail: 'Region not found',
        });
      }
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/territories/shipping-centers') {
    if (method === 'GET') {
      return withTerritoryAuth(req, res, async (actor) => {
        const response = await listShippingCenters(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'POST') {
      return withTerritoryAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as CreateShippingCenterRequest;
        const response = await createShippingCenter(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  }

  if (pathname.startsWith('/api/v1/territories/shipping-centers/')) {
    if (method !== 'PATCH') {
      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    const shippingCenterId = pathname.split('/').filter(Boolean).at(-1);
    if (!shippingCenterId) {
      return badRequestResponse(res, 'Shipping center id is required');
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const body = (await readJsonBody(req)) as UpdateShippingCenterRequest;
      const response = await updateShippingCenter(actor, shippingCenterId, body);
      if (!response) {
        return jsonResponse(res, 404, {
          error: 'NOT_FOUND',
          detail: 'Shipping center not found',
        });
      }
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/territories') {
    if (method === 'GET') {
      return withTerritoryAuth(req, res, async (actor) => {
        const response = await listTerritories(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (method === 'POST') {
      return withTerritoryAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as CreateTerritoryRequest;
        const response = await createTerritory(actor, body);
        return jsonResponse(res, 201, response);
      });
    }

    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  }

  if (pathname === '/api/v1/territories/map') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const response = await getTerritoryMapWorkspace(actor);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/territories/assignable-users') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const response = await listTerritoryAssignableUsers(actor);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname.startsWith('/api/v1/territories/history')) {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    const entityType = url.searchParams.get('entityType');
    const entityId = url.searchParams.get('entityId');

    if (!entityType || !entityId) {
      return badRequestResponse(res, 'entityType and entityId are required');
    }
    if (!['lead', 'account', 'location'].includes(entityType)) {
      return badRequestResponse(res, 'entityType must be lead, account, or location');
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const response = await listTerritoryAssignmentHistory(
        actor,
        entityType as 'lead' | 'account' | 'location',
        entityId,
      );
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname.startsWith('/api/v1/territories/assignments/leads/')) {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    const leadId = pathname.split('/').filter(Boolean).at(-1);
    if (!leadId) {
      return badRequestResponse(res, 'Lead id is required');
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const body = (await readJsonBody(req)) as ReassignLeadTerritoryRequest;
      const response = await reassignLeadTerritory(actor, leadId, body);
      if (!response) {
        return jsonResponse(res, 404, {
          error: 'NOT_FOUND',
          detail: 'Lead not found',
        });
      }
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname.startsWith('/api/v1/territories/')) {
    const segments = pathname.split('/').filter(Boolean);
    const territoryId = segments[segments.length - 1];
    const previousSegment = segments[segments.length - 2];
    const coverageTarget = territoryId === 'coverage' ? previousSegment : null;

    if (coverageTarget) {
      if (method !== 'PUT') {
        return methodNotAllowedResponse(res, method, ['PUT']);
      }

      return withTerritoryAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as ReplaceTerritoryCoverageRequest;
        const response = await replaceTerritoryCoverage(actor, coverageTarget, body);
        if (!response) {
          return jsonResponse(res, 404, {
            error: 'NOT_FOUND',
            detail: 'Territory not found',
          });
        }
        return jsonResponse(res, 200, response);
      });
    }

    if (method !== 'PATCH') {
      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    if (!territoryId) {
      return badRequestResponse(res, 'Territory id is required');
    }

    return withTerritoryAuth(req, res, async (actor) => {
      const body = (await readJsonBody(req)) as UpdateTerritoryRequest;
      const response = await updateTerritory(actor, territoryId, body);
      if (!response) {
        return jsonResponse(res, 404, {
          error: 'NOT_FOUND',
          detail: 'Territory not found',
        });
      }
      return jsonResponse(res, 200, response);
    });
  }

  return false;
}

async function withTerritoryAuth(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (actor: Awaited<ReturnType<typeof requireAuthenticatedActor>>) => Promise<void>,
) {
  try {
    const actor = await requireAuthenticatedActor(req, { module: 'territories' });
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

import { AuthorizationError } from '@pulse/auth';
import type {
  CreateLeadSourceRequest,
  LeadSourceImportRow,
  LeadStageImportRow,
  ReferenceImportRequest,
  UpdateLeadStageReferenceRequest,
  UpdateReferenceValueRequest,
} from '@pulse/contracts';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
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
import {
  createLeadSource,
  importLeadSources,
  importLeadStages,
  listBusinessSegments,
  listLeadStages,
  listLeadSources,
  updateBusinessSegment,
  updateLeadStage,
  updateLeadSource,
} from './service.js';

export async function handleReferenceRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isReferenceRoute =
    pathname === '/api/v1/reference/business-segments'
    || pathname === '/api/v1/reference/lead-stages'
    || pathname === '/api/v1/reference/lead-stages/import'
    || pathname === '/api/v1/reference/lead-sources'
    || pathname === '/api/v1/reference/lead-sources/import'
    || /^\/api\/v1\/reference\/business-segments\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/lead-stages\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/lead-sources\/[^/]+$/.test(pathname);

  if (!isReferenceRoute) {
    return false;
  }

  try {
    if (pathname === '/api/v1/reference/business-segments') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.view',
      });
      const response = await listBusinessSegments(actor);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/reference/lead-sources') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          action: 'reference.view',
        });
        const response = await listLeadSources(actor);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          action: 'reference.manage',
        });
        const body = (await readJsonBody(req)) as CreateLeadSourceRequest;
        const response = await createLeadSource(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/reference/lead-sources/import') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as ReferenceImportRequest<LeadSourceImportRow>;
      const response = await importLeadSources(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/reference/lead-stages') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.view',
      });
      const response = await listLeadStages(actor);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/reference/lead-stages/import') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as ReferenceImportRequest<LeadStageImportRow>;
      const response = await importLeadStages(actor, body);
      return jsonResponse(res, 200, response);
    }

    const businessSegmentMatch = pathname.match(/^\/api\/v1\/reference\/business-segments\/([^/]+)$/);
    if (businessSegmentMatch) {
      const id = businessSegmentMatch[1];
      if (!id) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as UpdateReferenceValueRequest;
      const response = await updateBusinessSegment(actor, id, body);
      if (!response) {
        return notFoundResponse(res, { entity: 'BusinessSegmentRef', id });
      }

      return jsonResponse(res, 200, response);
    }

    const leadStageMatch = pathname.match(/^\/api\/v1\/reference\/lead-stages\/([^/]+)$/);
    if (leadStageMatch) {
      const id = leadStageMatch[1];
      if (!id) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as UpdateLeadStageReferenceRequest;
      const response = await updateLeadStage(actor, id, body);
      if (!response) {
        return notFoundResponse(res, { entity: 'LeadStageRef', id });
      }

      return jsonResponse(res, 200, response);
    }

    const leadSourceMatch = pathname.match(/^\/api\/v1\/reference\/lead-sources\/([^/]+)$/);
    if (leadSourceMatch) {
      const id = leadSourceMatch[1];
      if (!id) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as UpdateReferenceValueRequest;
      const response = await updateLeadSource(actor, id, body);
      if (!response) {
        return notFoundResponse(res, { entity: 'LeadSourceRef', id });
      }

      return jsonResponse(res, 200, response);
    }
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(res, error.message);
    }

    if (error instanceof AuthorizationError) {
      return forbiddenResponse(res, error.message);
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

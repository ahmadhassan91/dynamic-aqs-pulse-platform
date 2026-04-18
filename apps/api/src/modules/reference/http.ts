import type {
  CommitGroupRosterImportRunRequest,
  AffinityGroupImportRow,
  CreateAffinityGroupRequest,
  CreateLeadSourceRequest,
  CreateOwnershipGroupRequest,
  GroupRosterImportFilePreviewRequest,
  LeadSourceImportRow,
  LeadStageImportRow,
  OwnershipGroupImportRow,
  ReferenceImportRequest,
  ReviewGroupRosterImportRequest,
  UpdateAffinityGroupRequest,
  UpdateLeadStageReferenceRequest,
  UpdateOwnershipGroupRequest,
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
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  createAffinityGroup,
  createLeadSource,
  createOwnershipGroup,
  commitGroupRosterImportRun,
  importAffinityGroups,
  getGroupRosterImportRun,
  listAffinityGroups,
  importLeadSources,
  importLeadStages,
  importOwnershipGroups,
  listBusinessSegments,
  listLeadStages,
  listLeadSources,
  listOwnershipGroups,
  previewGroupRosterImport,
  reviewGroupRosterImport,
  updateAffinityGroup,
  updateBusinessSegment,
  updateLeadStage,
  updateLeadSource,
  updateOwnershipGroup,
} from './service.js';

export async function handleReferenceRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isReferenceRoute =
    pathname === '/api/v1/reference/business-segments'
    || pathname === '/api/v1/reference/affinity-groups'
    || pathname === '/api/v1/reference/affinity-groups/import'
    || pathname === '/api/v1/reference/group-rosters/preview'
    || pathname === '/api/v1/reference/group-rosters/review'
    || pathname === '/api/v1/reference/lead-stages'
    || pathname === '/api/v1/reference/lead-stages/import'
    || pathname === '/api/v1/reference/lead-sources'
    || pathname === '/api/v1/reference/ownership-groups'
    || pathname === '/api/v1/reference/ownership-groups/import'
    || pathname === '/api/v1/reference/lead-sources/import'
    || /^\/api\/v1\/reference\/affinity-groups\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/business-segments\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/lead-stages\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/lead-sources\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/ownership-groups\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/group-rosters\/runs\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/reference\/group-rosters\/runs\/[^/]+\/commit$/.test(pathname);

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

    if (pathname === '/api/v1/reference/affinity-groups') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          action: 'reference.view',
        });
        const response = await listAffinityGroups(actor);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          action: 'reference.manage',
        });
        const body = (await readJsonBody(req)) as CreateAffinityGroupRequest;
        const response = await createAffinityGroup(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/reference/affinity-groups/import') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as ReferenceImportRequest<AffinityGroupImportRow>;
      const response = await importAffinityGroups(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/reference/group-rosters/preview') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as GroupRosterImportFilePreviewRequest;
      const response = await previewGroupRosterImport(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/reference/group-rosters/review') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as ReviewGroupRosterImportRequest;
      const response = await reviewGroupRosterImport(actor, body);
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

    if (pathname === '/api/v1/reference/ownership-groups') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          action: 'reference.view',
        });
        const response = await listOwnershipGroups(actor);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          action: 'reference.manage',
        });
        const body = (await readJsonBody(req)) as CreateOwnershipGroupRequest;
        const response = await createOwnershipGroup(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/reference/ownership-groups/import') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as ReferenceImportRequest<OwnershipGroupImportRow>;
      const response = await importOwnershipGroups(actor, body);
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

    const groupRosterRunCommitMatch = pathname.match(/^\/api\/v1\/reference\/group-rosters\/runs\/([^/]+)\/commit$/);
    if (groupRosterRunCommitMatch) {
      const runId = groupRosterRunCommitMatch[1];
      if (!runId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as CommitGroupRosterImportRunRequest;
      const response = await commitGroupRosterImportRun(actor, runId, body);
      return jsonResponse(res, 200, response);
    }

    const groupRosterRunMatch = pathname.match(/^\/api\/v1\/reference\/group-rosters\/runs\/([^/]+)$/);
    if (groupRosterRunMatch) {
      const runId = groupRosterRunMatch[1];
      if (!runId) {
        return false;
      }

      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const response = await getGroupRosterImportRun(actor, runId);
      return jsonResponse(res, 200, response);
    }

    const affinityGroupMatch = pathname.match(/^\/api\/v1\/reference\/affinity-groups\/([^/]+)$/);
    if (affinityGroupMatch) {
      const id = affinityGroupMatch[1];
      if (!id) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as UpdateAffinityGroupRequest;
      const response = await updateAffinityGroup(actor, id, body);
      if (!response) {
        return notFoundResponse(res, { entity: 'AffinityGroupRef', id });
      }

      return jsonResponse(res, 200, response);
    }

    const ownershipGroupMatch = pathname.match(/^\/api\/v1\/reference\/ownership-groups\/([^/]+)$/);
    if (ownershipGroupMatch) {
      const id = ownershipGroupMatch[1];
      if (!id) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        action: 'reference.manage',
      });
      const body = (await readJsonBody(req)) as UpdateOwnershipGroupRequest;
      const response = await updateOwnershipGroup(actor, id, body);
      if (!response) {
        return notFoundResponse(res, { entity: 'OwnershipGroupRef', id });
      }

      return jsonResponse(res, 200, response);
    }
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }

    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not found')) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

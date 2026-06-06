import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  ConfirmConsignmentTrueUpRequest,
  ConsignmentOperationalQueueRequest,
  CreateConsignmentAuditRequest,
  CreateConsignmentSiteRequest,
  ListConsignmentSitesRequest,
  UpdateConsignmentAuditRequest,
  UpdateConsignmentDocumentRequest,
  UpdateConsignmentSiteRequest,
  UploadConsignmentAuditEvidenceRequest,
  UpsertConsignmentDocumentRequest,
} from '@pulse/contracts/consignment';
import type { AppConfig } from '../../config.js';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  matchPath,
  methodNotAllowedResponse,
  notFoundResponse,
  readIntegerQuery,
  readJsonBody,
  readTrimmedQuery,
  serviceUnavailableResponse,
  unauthorizedResponse,
} from '../../utils/http.js';
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  ConsignmentPersistenceUnavailableError,
  confirmConsignmentTrueUp,
  createConsignmentAudit,
  createConsignmentSite,
  getAccountConsignmentReadModel,
  getConsignmentSiteDetail,
  listConsignmentAudits,
  listConsignmentDocuments,
  listConsignmentOperationalQueue,
  listConsignmentReadinessItems,
  listConsignmentSites,
  updateConsignmentAudit,
  updateConsignmentDocument,
  updateConsignmentSite,
  uploadConsignmentAuditEvidence,
  upsertConsignmentDocument,
} from './service.js';

const CONSIGNMENT_EVIDENCE_UPLOAD_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

export async function handleConsignmentRoutes(req: IncomingMessage, res: ServerResponse, url: URL, config?: AppConfig) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (!isConsignmentRoute(pathname)) {
    return false;
  }

  try {
    if (pathname === '/api/v1/consignment/sites') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.view',
        });
        const response = await listConsignmentSites(actor, readListSitesQuery(url));
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.manage',
        });
        const body = (await readJsonBody(req)) as CreateConsignmentSiteRequest;
        const response = await createConsignmentSite(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/consignment/ops') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.view',
      });
      const response = await listConsignmentOperationalQueue(actor, readOperationalQueueQuery(url));
      return jsonResponse(res, 200, response);
    }

    const accountMatch = matchPath(pathname, '/api/v1/consignment/accounts/:accountId');
    if (accountMatch) {
      const accountId = accountMatch.accountId;
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }

      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.view',
      });
      const response = await getAccountConsignmentReadModel(actor, accountId);
      if (!response) {
        return notFoundResponse(res, { entity: 'AccountConsignmentReadModel', accountId });
      }

      return jsonResponse(res, 200, response);
    }

    const siteMatch = matchPath(pathname, '/api/v1/consignment/sites/:siteId');
    if (siteMatch) {
      const siteId = siteMatch.siteId;
      if (!siteId) {
        return badRequestResponse(res, 'Consignment site id is required');
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.view',
        });
        const response = await getConsignmentSiteDetail(actor, siteId);
        if (!response) {
          return notFoundResponse(res, { entity: 'ConsignmentSite', id: siteId });
        }

        return jsonResponse(res, 200, response);
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.manage',
        });
        const body = (await readJsonBody(req)) as UpdateConsignmentSiteRequest;
        const response = await updateConsignmentSite(actor, siteId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
    }

    const readinessMatch = matchPath(pathname, '/api/v1/consignment/sites/:siteId/readiness');
    if (readinessMatch) {
      const siteId = readinessMatch.siteId;
      if (!siteId) {
        return badRequestResponse(res, 'Consignment site id is required');
      }

      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.view',
      });
      const response = await listConsignmentReadinessItems(actor, siteId);
      if (!response) {
        return notFoundResponse(res, { entity: 'ConsignmentSite', id: siteId });
      }

      return jsonResponse(res, 200, { items: response });
    }

    const documentsMatch = matchPath(pathname, '/api/v1/consignment/sites/:siteId/documents');
    if (documentsMatch) {
      const siteId = documentsMatch.siteId;
      if (!siteId) {
        return badRequestResponse(res, 'Consignment site id is required');
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.view',
        });
        const response = await listConsignmentDocuments(actor, siteId);
        if (!response) {
          return notFoundResponse(res, { entity: 'ConsignmentSite', id: siteId });
        }

        return jsonResponse(res, 200, { items: response });
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.document_manage',
        });
        const body = (await readJsonBody(req)) as UpsertConsignmentDocumentRequest;
        const response = await upsertConsignmentDocument(actor, siteId, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const documentMatch = matchPath(pathname, '/api/v1/consignment/documents/:documentId');
    if (documentMatch) {
      const documentId = documentMatch.documentId;
      if (!documentId) {
        return badRequestResponse(res, 'Consignment document id is required');
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.document_manage',
      });
      const body = (await readJsonBody(req)) as UpdateConsignmentDocumentRequest;
      const response = await updateConsignmentDocument(actor, documentId, body);
      return jsonResponse(res, 200, response);
    }

    const auditsMatch = matchPath(pathname, '/api/v1/consignment/sites/:siteId/audits');
    if (auditsMatch) {
      const siteId = auditsMatch.siteId;
      if (!siteId) {
        return badRequestResponse(res, 'Consignment site id is required');
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.view',
        });
        const response = await listConsignmentAudits(actor, siteId);
        if (!response) {
          return notFoundResponse(res, { entity: 'ConsignmentSite', id: siteId });
        }

        return jsonResponse(res, 200, { items: response });
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'consignment',
          action: 'consignment.audit',
        });
        const body = (await readJsonBody(req)) as CreateConsignmentAuditRequest;
        const response = await createConsignmentAudit(actor, siteId, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const auditMatch = matchPath(pathname, '/api/v1/consignment/audits/:auditId');
    if (auditMatch) {
      const auditId = auditMatch.auditId;
      if (!auditId) {
        return badRequestResponse(res, 'Consignment audit id is required');
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.audit',
      });
      const body = (await readJsonBody(req)) as UpdateConsignmentAuditRequest;
      const response = await updateConsignmentAudit(actor, auditId, body);
      return jsonResponse(res, 200, response);
    }

    const trueUpMatch = matchPath(pathname, '/api/v1/consignment/audits/:auditId/true-up');
    if (trueUpMatch) {
      const auditId = trueUpMatch.auditId;
      if (!auditId) {
        return badRequestResponse(res, 'Consignment audit id is required');
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.manage',
      });
      const body = (await readJsonBody(req)) as ConfirmConsignmentTrueUpRequest;
      const response = await confirmConsignmentTrueUp(actor, auditId, body);
      return jsonResponse(res, 200, response);
    }

    const auditEvidenceMatch = matchPath(pathname, '/api/v1/consignment/audits/:auditId/evidence');
    if (auditEvidenceMatch) {
      const auditId = auditEvidenceMatch.auditId;
      if (!auditId) {
        return badRequestResponse(res, 'Consignment audit id is required');
      }
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }
      if (!config) {
        return badRequestResponse(res, 'Consignment evidence storage is not configured');
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'consignment',
        action: 'consignment.audit',
      });
      const body = (await readJsonBody(req, CONSIGNMENT_EVIDENCE_UPLOAD_BODY_LIMIT_BYTES)) as UploadConsignmentAuditEvidenceRequest;
      const response = await uploadConsignmentAuditEvidence(actor, config, auditId, body);
      return jsonResponse(res, 201, response);
    }
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }

    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }

    if (error instanceof ConsignmentPersistenceUnavailableError) {
      return serviceUnavailableResponse(res, error.message, {
        parked: {
          acumaticaExecution: true,
          schemaOwnedBy: 'consignment backend worker',
        },
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message.includes('not found') ? 404 : 400;
    if (statusCode === 404) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

function isConsignmentRoute(pathname: string) {
  return pathname === '/api/v1/consignment/sites'
    || pathname === '/api/v1/consignment/ops'
    || /^\/api\/v1\/consignment\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/consignment\/sites\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/consignment\/sites\/[^/]+\/readiness$/.test(pathname)
    || /^\/api\/v1\/consignment\/sites\/[^/]+\/documents$/.test(pathname)
    || /^\/api\/v1\/consignment\/documents\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/consignment\/sites\/[^/]+\/audits$/.test(pathname)
    || /^\/api\/v1\/consignment\/audits\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/consignment\/audits\/[^/]+\/true-up$/.test(pathname)
    || /^\/api\/v1\/consignment\/audits\/[^/]+\/evidence$/.test(pathname);
}

function readListSitesQuery(url: URL): ListConsignmentSitesRequest {
  const query: ListConsignmentSitesRequest = {};
  const search = readTrimmedQuery(url, 'search');
  const status = readTrimmedQuery(url, 'status');
  const readinessState = readTrimmedQuery(url, 'readinessState');
  const assignedTmUserId = readTrimmedQuery(url, 'assignedTmUserId');
  const assignedRdUserId = readTrimmedQuery(url, 'assignedRdUserId');
  const includeClosed = readBooleanQuery(url, 'includeClosed');
  const dueWithinDays = readIntegerQuery(url, 'dueWithinDays');
  const limit = readIntegerQuery(url, 'limit');

  if (search) query.search = search;
  if (status) query.status = status as NonNullable<ListConsignmentSitesRequest['status']>;
  if (readinessState) query.readinessState = readinessState as NonNullable<ListConsignmentSitesRequest['readinessState']>;
  if (assignedTmUserId) query.assignedTmUserId = assignedTmUserId;
  if (assignedRdUserId) query.assignedRdUserId = assignedRdUserId;
  if (includeClosed !== undefined) query.includeClosed = includeClosed;
  if (dueWithinDays !== undefined) query.dueWithinDays = dueWithinDays;
  if (limit !== undefined) query.limit = limit;

  return query;
}

function readOperationalQueueQuery(url: URL): ConsignmentOperationalQueueRequest {
  const query: ConsignmentOperationalQueueRequest = {};
  const status = readTrimmedQuery(url, 'status');
  const readinessState = readTrimmedQuery(url, 'readinessState');
  const auditStatus = readTrimmedQuery(url, 'auditStatus');
  const limit = readIntegerQuery(url, 'limit');

  if (status) query.status = status as NonNullable<ConsignmentOperationalQueueRequest['status']>;
  if (readinessState) query.readinessState = readinessState as NonNullable<ConsignmentOperationalQueueRequest['readinessState']>;
  if (auditStatus) query.auditStatus = auditStatus as NonNullable<ConsignmentOperationalQueueRequest['auditStatus']>;
  if (limit !== undefined) query.limit = limit;

  return query;
}

function readBooleanQuery(url: URL, key: string) {
  const value = url.searchParams.get(key);
  if (value === null) {
    return undefined;
  }

  return value.toLowerCase() === 'true';
}

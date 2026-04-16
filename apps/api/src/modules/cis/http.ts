import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  ApplyCisParsedDraftRequest,
  CisFinanceDecisionRequest,
  CisLinkIssueRequest,
  CisReviewSignoffRequest,
  CisSubmitToFinanceRequest,
  ListFinanceQueueRequest,
  SavePublicCisDraftRequest,
  SubmitPublicCisRequest,
  UploadCisScanRequest,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
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
  getCisPackageDetail,
  getLeadCisPackage,
  getPublicCisPackage,
  issueCisLink,
  listCisParsedDrafts,
  listFinanceQueue,
  applyCisParsedDraft,
  recordFinanceDecision,
  reviewAndSignOffCis,
  savePublicCisDraft,
  submitCisToFinance,
  submitPublicCis,
  uploadLeadCisScan,
} from './service.js';

export async function handleCisRoutes(req: IncomingMessage, res: ServerResponse, url: URL, config: AppConfig) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  const internalLeadMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/cis(?:\/(send-link|resend-link|upload-scan))?$/);
  const financeQueueRoute = pathname === '/api/v1/cis/finance-queue';
  const internalPackageMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)(?:\/(review-signoff|submit-to-finance|finance-decision))?$/);
  const parsedDraftCollectionMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/parsed-drafts$/);
  const parsedDraftApplyMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/parsed-drafts\/([^/]+)\/apply$/);
  const publicBaseMatch = pathname.match(/^\/api\/v1\/public\/cis\/([^/]+)(?:\/(save-draft|submit))?$/);

  if (!internalLeadMatch && !financeQueueRoute && !internalPackageMatch && !parsedDraftCollectionMatch && !parsedDraftApplyMatch && !publicBaseMatch) {
    return false;
  }

  try {
    if (publicBaseMatch) {
      const token = publicBaseMatch[1];
      const action = publicBaseMatch[2];
      if (!token) {
        return false;
      }

      if (!action) {
        if (method !== 'GET') {
          return methodNotAllowedResponse(res, method, ['GET']);
        }

        const response = await getPublicCisPackage(token);
        if (!response) {
          return notFoundResponse(res, { detail: 'CIS link not found or expired' });
        }

        return jsonResponse(res, 200, response);
      }

      if (action === 'save-draft') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const body = (await readJsonBody(req)) as SavePublicCisDraftRequest;
        const response = await savePublicCisDraft(token, body);
        return jsonResponse(res, 200, response);
      }

      if (action === 'submit') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const body = (await readJsonBody(req)) as SubmitPublicCisRequest;
        const response = await submitPublicCis(token, body);
        return jsonResponse(res, 200, response);
      }
    }

    if (internalLeadMatch) {
      const leadId = internalLeadMatch[1];
      const action = internalLeadMatch[2];
      if (!leadId) {
        return false;
      }

      if (!action) {
        if (method !== 'GET') {
          return methodNotAllowedResponse(res, method, ['GET']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.view',
        });
        const response = await getLeadCisPackage(actor, leadId);
        if (!response) {
          return notFoundResponse(res, { entity: 'CIS package', leadId });
        }

        return jsonResponse(res, 200, response);
      }

      if (action === 'send-link' || action === 'resend-link') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CisLinkIssueRequest;
        const response = await issueCisLink(actor, leadId, body, config);
        return jsonResponse(res, 200, response);
      }

      if (action === 'upload-scan') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as UploadCisScanRequest;
        const response = await uploadLeadCisScan(actor, leadId, body);
        return jsonResponse(res, 200, response);
      }
    }

    if (financeQueueRoute) {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'cis',
        action: 'lead.finance_queue_view',
      });
      const decisionStatus = url.searchParams.get('decisionStatus');
      const response = decisionStatus
        ? await listFinanceQueue(actor, { decisionStatus: decisionStatus as NonNullable<ListFinanceQueueRequest['decisionStatus']> })
        : await listFinanceQueue(actor);
      return jsonResponse(res, 200, response);
    }

    if (parsedDraftCollectionMatch) {
      const cisPackageId = parsedDraftCollectionMatch[1];
      if (!cisPackageId) {
        return false;
      }

      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'cis',
        action: 'lead.view',
      });
      const response = await listCisParsedDrafts(actor, cisPackageId);
      return jsonResponse(res, 200, response);
    }

    if (parsedDraftApplyMatch) {
      const cisPackageId = parsedDraftApplyMatch[1];
      const draftId = parsedDraftApplyMatch[2];
      if (!cisPackageId || !draftId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'cis',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as ApplyCisParsedDraftRequest;
      const response = await applyCisParsedDraft(actor, cisPackageId, draftId, body);
      return jsonResponse(res, 200, response);
    }

    if (internalPackageMatch) {
      const cisPackageId = internalPackageMatch[1];
      const action = internalPackageMatch[2];
      if (!cisPackageId) {
        return false;
      }

      if (!action) {
        if (method !== 'GET') {
          return methodNotAllowedResponse(res, method, ['GET']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.view',
        });
        const response = await getCisPackageDetail(actor, cisPackageId);
        if (!response) {
          return notFoundResponse(res, { entity: 'CIS package', id: cisPackageId });
        }

        return jsonResponse(res, 200, response);
      }

      if (action === 'review-signoff') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CisReviewSignoffRequest;
        const response = await reviewAndSignOffCis(actor, cisPackageId, body);
        return jsonResponse(res, 200, response);
      }

      if (action === 'submit-to-finance') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CisSubmitToFinanceRequest;
        const response = await submitCisToFinance(actor, cisPackageId, body);
        return jsonResponse(res, 200, response);
      }

      if (action === 'finance-decision') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.finance_decide',
        });
        const body = (await readJsonBody(req)) as CisFinanceDecisionRequest;
        const response = await recordFinanceDecision(actor, cisPackageId, body);
        return jsonResponse(res, 200, response);
      }
    }
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }

    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }

    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message.includes('not found') || message.includes('expired') ? 404 : 400;
    if (statusCode === 404) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  ApplyCisParsedDraftRequest,
  CancelMonerisHostedPaymentCaptureRequest,
  CisFinanceDecisionRequest,
  CisLinkIssueRequest,
  RecordMonerisHostedCaptureResultRequest,
  RecordCisPaymentVaultReferenceRequest,
  RequestCisPaymentCaptureRequest,
  CisReviewSignoffRequest,
  CisSubmitToFinanceRequest,
  ListFinanceQueueRequest,
  SavePublicCisDraftRequest,
  StartMonerisHostedPaymentCaptureRequest,
  SubmitPublicCisRequest,
  UploadCisScanRequest,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import type { QueueManager } from '../../queue/contracts.js';
import { MONERIS_HOSTED_CAPTURE_CALLBACK_QUEUE } from '../../queue/definitions.js';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  notFoundResponse,
  readJsonBody,
  readTextBody,
  serviceUnavailableResponse,
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
  cancelMonerisHostedPaymentCapture,
  recordFinanceDecision,
  recordCisPaymentVaultReference,
  recordMonerisHostedCaptureResult,
  reviewAndSignOffCis,
  requestCisPaymentCapture,
  savePublicCisDraft,
  startMonerisHostedPaymentCapture,
  submitCisToFinance,
  submitPublicCis,
  uploadLeadCisScan,
} from './service.js';

export async function handleCisRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  context: {
    config: AppConfig;
    queue: QueueManager;
  },
) {
  const { config, queue } = context;
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  const internalLeadMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/cis(?:\/(send-link|resend-link|upload-scan))?$/);
  const financeQueueRoute = pathname === '/api/v1/cis/finance-queue';
  const internalPackageMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)(?:\/(review-signoff|submit-to-finance|finance-decision|request-payment-capture|payment-vault-reference|moneris-hosted-capture\/start))?$/);
  const parsedDraftCollectionMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/parsed-drafts$/);
  const parsedDraftApplyMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/parsed-drafts\/([^/]+)\/apply$/);
  const hostedCaptureResultMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/payment-capture-attempts\/([^/]+)\/moneris-result$/);
  const hostedCaptureCancelMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/payment-capture-attempts\/([^/]+)\/moneris-cancel$/);
  const hostedCaptureCallbackMatch = pathname.match(/^\/api\/v1\/cis\/([^/]+)\/payment-capture-attempts\/([^/]+)\/moneris-callback$/);
  const publicBaseMatch = pathname.match(/^\/api\/v1\/public\/cis\/([^/]+)(?:\/(save-draft|submit))?$/);

  if (!internalLeadMatch && !financeQueueRoute && !internalPackageMatch && !parsedDraftCollectionMatch && !parsedDraftApplyMatch && !hostedCaptureResultMatch && !hostedCaptureCancelMatch && !hostedCaptureCallbackMatch && !publicBaseMatch) {
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

      if (action === 'request-payment-capture') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.finance_decide',
        });
        const body = (await readJsonBody(req)) as RequestCisPaymentCaptureRequest;
        const response = await requestCisPaymentCapture(actor, cisPackageId, body);
        return jsonResponse(res, 200, response);
      }

      if (action === 'payment-vault-reference') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.finance_decide',
        });
        const body = (await readJsonBody(req)) as RecordCisPaymentVaultReferenceRequest;
        const response = await recordCisPaymentVaultReference(actor, cisPackageId, body);
        return jsonResponse(res, 200, response);
      }

      if (action === 'moneris-hosted-capture/start') {
        if (method !== 'POST') {
          return methodNotAllowedResponse(res, method, ['POST']);
        }

        const actor = await requireAuthenticatedActor(req, {
          module: 'cis',
          action: 'lead.finance_decide',
        });
        const body = (await readJsonBody(req)) as StartMonerisHostedPaymentCaptureRequest;
        const response = await startMonerisHostedPaymentCapture(actor, config, cisPackageId, body);
        return jsonResponse(res, 200, response);
      }
    }

    if (hostedCaptureResultMatch) {
      const cisPackageId = hostedCaptureResultMatch[1];
      const attemptId = hostedCaptureResultMatch[2];
      if (!cisPackageId || !attemptId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'cis',
        action: 'lead.finance_decide',
      });
      const body = (await readJsonBody(req)) as RecordMonerisHostedCaptureResultRequest;
      const response = await recordMonerisHostedCaptureResult(actor, config, cisPackageId, attemptId, body);
      return jsonResponse(res, 200, response);
    }

    if (hostedCaptureCancelMatch) {
      const cisPackageId = hostedCaptureCancelMatch[1];
      const attemptId = hostedCaptureCancelMatch[2];
      if (!cisPackageId || !attemptId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'cis',
        action: 'lead.finance_decide',
      });
      const body = (await readJsonBody(req)) as CancelMonerisHostedPaymentCaptureRequest;
      const response = await cancelMonerisHostedPaymentCapture(actor, cisPackageId, attemptId, body);
      return jsonResponse(res, 200, response);
    }

    if (hostedCaptureCallbackMatch) {
      const cisPackageId = hostedCaptureCallbackMatch[1];
      const attemptId = hostedCaptureCallbackMatch[2];
      if (!cisPackageId || !attemptId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const configuredSecret = config.monerisHostedTokenization.callbackSecret;
      if (!configuredSecret) {
        return serviceUnavailableResponse(res, 'Moneris callback ingress is not configured for this environment');
      }

      const requestSecret = readHeader(req, 'x-pulse-callback-secret');
      if (!secretsMatch(requestSecret, configuredSecret)) {
        return unauthorizedResponse(res, 'Invalid Moneris callback secret');
      }

      const rawPayload = await readTextBody(req);
      const receipt = await queue.enqueue(MONERIS_HOSTED_CAPTURE_CALLBACK_QUEUE, {
        jobType: MONERIS_HOSTED_CAPTURE_CALLBACK_QUEUE.name,
        triggeredBy: 'moneris',
        triggerSource: 'webhook',
        correlationId: crypto.randomUUID(),
        data: {
          cisPackageId,
          attemptId,
          rawPayload,
          contentType: readHeader(req, 'content-type'),
          receivedAt: new Date().toISOString(),
          remoteAddress: req.socket.remoteAddress,
        },
      });

      return jsonResponse(res, 202, {
        accepted: true,
        job: receipt,
      });
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

function readHeader(req: IncomingMessage, name: string) {
  const raw = req.headers[name]?.toString().trim();
  return raw ? raw : undefined;
}

function secretsMatch(left: string | undefined, right: string | undefined) {
  if (!left || !right) {
    return false;
  }

  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

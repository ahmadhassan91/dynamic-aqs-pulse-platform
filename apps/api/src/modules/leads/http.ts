import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { AppConfig } from '../../config.js';
import type {
  CaptureWebsiteLeadRequest,
  CommitLeadImportRunRequest,
  CompleteLeadDiscoveryRequest,
  ConvertLeadOnFirstOrderRequest,
  CreateWebsiteLeadNotificationRecipientRequest,
  CreateWebsiteLeadSiteRequest,
  CreateLeadRequest,
  CreateLeadContactRequest,
  ImportLeadFileRequest,
  LeadImportFilePreviewRequest,
  ImportLeadsRequest,
  ReviewLeadImportRequest,
  ListLeadWorkflowQueueRequest,
  LogLeadInitialContactRequest,
  LogLeadActivityNoteRequest,
  LeadRoutingTeamKey,
  LeadStageKey,
  LeadLifecycleStatusKey,
  LeadWorkflowQueueViewKey,
  ListLeadHistoryFeedRequest,
  ListLeadsRequest,
  ListWebsiteLeadSubmissionsRequest,
  ListWebsiteFormLeadsRequest,
  PreviewLeadDuplicateCandidatesRequest,
  PreviewLeadOcrCaptureRequest,
  ResolveWebsiteLeadSubmissionRequest,
  ScheduleLeadDiscoveryRequest,
  SkipLeadDiscoveryRequest,
  TransitionLeadStageRequest,
  UpdateLeadRequest,
  UpdateLeadLifecycleRequest,
  UpdateLeadContactRequest,
  UpdateLeadConversionPreparationRequest,
  UpdateLeadRoutingPolicyRequest,
  UpdateLeadReadinessItemRequest,
  UpdateWebsiteLeadNotificationRecipientRequest,
  UpdateWebsiteLeadSiteRequest,
} from '@pulse/contracts';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  matchPath,
  matchesPath,
  methodNotAllowedResponse,
  notFoundResponse,
  readIntegerQuery,
  readJsonBody,
  readTrimmedQuery,
  tooManyRequestsResponse,
  unauthorizedResponse,
} from '../../utils/http.js';
import type { FixedWindowRateLimiter } from '../../utils/rate-limit.js';
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  captureWebsiteLead,
  completeLeadDiscovery,
  createLead,
  createWebsiteLeadNotificationRecipient,
  createWebsiteLeadSite,
  getLeadImportRun,
  getLeadDetail,
  getPublicWebsiteLeadSiteAllowedOrigins,
  getPublicWebsiteLeadSite,
  importLeadFile,
  getLeadRoutingPolicy,
  importLeads,
  logLeadInitialContact,
  logLeadActivityNote,
  listLeadWorkflowQueue,
  listLeadHistoryFeed,
  listActivePublicWebsiteLeadOrigins,
  listLeads,
  listWebsiteLeadNotificationRecipients,
  listWebsiteLeadSites,
  listWebsiteLeadSubmissions,
  listWebsiteFormLeads,
  previewLeadImport,
  previewLeadDuplicateCandidates,
  reviewLeadImport,
  commitLeadImportRun,
  resolveWebsiteLeadSubmission,
  scheduleLeadDiscovery,
  skipLeadDiscovery,
  transitionLeadStage,
  updateLeadLifecycle,
  updateLead,
  updateLeadRoutingPolicy,
  updateWebsiteLeadNotificationRecipient,
  updateWebsiteLeadSite,
} from './service.js';
import { previewLeadOcrCapture } from './ocr.js';
import {
  convertLeadOnFirstOrder,
  createLeadContact,
  generateLeadReadinessChecklist,
  getLeadConversionPreparation,
  getLeadReadiness,
  getLeadReadinessBlockers,
  importLeadContactsFromCis,
  listLeadContacts,
  updateLeadContact,
  updateLeadConversionPreparation,
  updateLeadReadinessItem,
  validateLeadConversionPreparation,
} from './readiness.js';

type LeadRouteDependencies = {
  config?: AppConfig | undefined;
  websiteLeadCaptureLimiter?: FixedWindowRateLimiter | undefined;
  websiteLeadCapturePreflightLimiter?: FixedWindowRateLimiter | undefined;
};

export async function handleLeadRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  deps?: AppConfig | LeadRouteDependencies,
) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const routeDeps = normalizeLeadRouteDependencies(deps);
  const config = routeDeps.config;

  const publicCaptureRoute =
    pathname === '/api/leads/capture'
    || pathname === '/api/v1/leads/capture'
    || pathname === '/api/v1/public/leads/capture'
    || matchesPath(pathname, '/api/v1/public/website-sites/:siteId');

  const internalLeadRoute =
    pathname === '/api/v1/leads'
    || pathname === '/api/v1/leads/website-forms'
    || pathname === '/api/v1/leads/website-submissions'
    || matchesPath(pathname, '/api/v1/leads/website-submissions/:submissionId/resolve')
    || pathname === '/api/v1/leads/website-sites'
    || pathname === '/api/v1/leads/website-notification-recipients'
    || pathname === '/api/v1/leads/duplicates/preview'
    || pathname === '/api/v1/leads/ocr/preview'
    || pathname === '/api/v1/leads/workflow-queue'
    || pathname === '/api/v1/leads/history-feed'
    || pathname === '/api/v1/leads/import'
    || pathname === '/api/v1/leads/import/file'
    || pathname === '/api/v1/leads/import/preview'
    || pathname === '/api/v1/leads/import/review'
    || matchesPath(pathname, '/api/v1/leads/import/runs/:runId')
    || matchesPath(pathname, '/api/v1/leads/import/runs/:runId/commit')
    || pathname === '/api/v1/leads/routing-policy'
    || matchesPath(pathname, '/api/v1/leads/:leadId')
    || matchesPath(pathname, '/api/v1/leads/:leadId/stage-transition')
    || matchesPath(pathname, '/api/v1/leads/:leadId/lifecycle')
    || matchesPath(pathname, '/api/v1/leads/:leadId/log-initial-contact')
    || matchesPath(pathname, '/api/v1/leads/:leadId/notes')
    || matchesPath(pathname, '/api/v1/leads/:leadId/discovery/schedule')
    || matchesPath(pathname, '/api/v1/leads/:leadId/discovery/complete')
    || matchesPath(pathname, '/api/v1/leads/:leadId/discovery/skip')
    || matchesPath(pathname, '/api/v1/leads/:leadId/readiness')
    || matchesPath(pathname, '/api/v1/leads/:leadId/readiness/blockers')
    || matchesPath(pathname, '/api/v1/leads/:leadId/readiness/checklist/generate')
    || matchesPath(pathname, '/api/v1/leads/:leadId/readiness/items/:itemId')
    || matchesPath(pathname, '/api/v1/leads/:leadId/contacts')
    || matchesPath(pathname, '/api/v1/leads/:leadId/contacts/import-from-cis')
    || matchesPath(pathname, '/api/v1/leads/:leadId/contacts/:contactId')
    || matchesPath(pathname, '/api/v1/leads/:leadId/conversion-prep')
    || matchesPath(pathname, '/api/v1/leads/:leadId/conversion-prep/validate')
    || matchesPath(pathname, '/api/v1/leads/:leadId/convert-on-first-order')
    || matchesPath(pathname, '/api/v1/leads/website-sites/:siteRecordId')
    || matchesPath(pathname, '/api/v1/leads/website-notification-recipients/:recipientId');

  if (!publicCaptureRoute && !internalLeadRoute) {
    return false;
  }

  try {
    if (publicCaptureRoute) {
      applyPublicCaptureCommonCorsHeaders(res);

      if (method === 'OPTIONS') {
        const preflightLimit = consumePublicCaptureRateLimit(
          routeDeps.websiteLeadCapturePreflightLimiter,
          ['preflight', pathname, getClientIp(req)].join(':'),
        );
        if (!preflightLimit.allowed) {
          await applyPublicCaptureCors(req, res, pathname, config);
          return tooManyRequestsResponse(
            res,
            'Too many website lead form preflight requests. Please try again shortly.',
            preflightLimit.retryAfterSeconds,
          );
        }
        await applyPublicCaptureCors(req, res, pathname, config);
        res.writeHead(204);
        res.end();
        return true;
      }

      const publicWebsiteSiteMatch = matchPath(pathname, '/api/v1/public/website-sites/:siteId');
      if (publicWebsiteSiteMatch) {
        if (method !== 'GET') {
          return methodNotAllowedResponse(res, method, ['GET', 'OPTIONS']);
        }

        const siteId = publicWebsiteSiteMatch.siteId;
        if (!siteId) {
          return badRequestResponse(res, 'siteId is required');
        }

        if (!(await isPublicOriginAllowedForSite(req, siteId, config))) {
          clearAllowedPublicOriginHeader(res);
          return forbiddenResponse(res, 'Origin is not allowed for this website lead form');
        }
        applyAllowedPublicOriginHeader(req, res);

        const response = await getPublicWebsiteLeadSite(siteId);
        return jsonResponse(res, 200, response);
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['OPTIONS', 'POST']);
      }

      const coarseLimit = consumePublicCaptureRateLimit(
        routeDeps.websiteLeadCaptureLimiter,
        ['public-capture', pathname, getClientIp(req)].join(':'),
      );
      if (!coarseLimit.allowed) {
        await applyPublicCaptureCors(req, res, pathname, config);
        return tooManyRequestsResponse(
          res,
          'Too many website lead form submissions. Please try again shortly.',
          coarseLimit.retryAfterSeconds,
        );
      }

      const body = (await readJsonBody(req)) as CaptureWebsiteLeadRequest;
      if (!(await isPublicOriginAllowedForSite(req, body.siteId, config))) {
        clearAllowedPublicOriginHeader(res);
        return forbiddenResponse(res, 'Origin is not allowed for this website lead form');
      }
      applyAllowedPublicOriginHeader(req, res);
      const siteLimit = consumePublicCaptureRateLimit(
        routeDeps.websiteLeadCaptureLimiter,
        ['website-site-capture', body.siteId, getClientIp(req)].join(':'),
      );
      if (!siteLimit.allowed) {
        return tooManyRequestsResponse(
          res,
          'Too many website lead form submissions for this site. Please try again shortly.',
          siteLimit.retryAfterSeconds,
        );
      }
      const response = await captureWebsiteLead(body);
      return jsonResponse(res, 201, response);
    }

    if (pathname === '/api/v1/leads') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const search = readTrimmedQuery(url, 'search');
        const stage = readTrimmedQuery(url, 'stage');
        const lifecycleStatus = readTrimmedQuery(url, 'lifecycleStatus');
        const routingTeam = readTrimmedQuery(url, 'routingTeam');
        const leadSourceCode = readTrimmedQuery(url, 'leadSourceCode');
        const affinityGroupCode = readTrimmedQuery(url, 'affinityGroupCode');
        const ownershipGroupCode = readTrimmedQuery(url, 'ownershipGroupCode');
        const territoryId = readTrimmedQuery(url, 'territoryId');
        const limit = readIntegerQuery(url, 'limit');
        const page = readIntegerQuery(url, 'page');
        const query: ListLeadsRequest = {
          ...(search ? { search } : {}),
          ...(stage ? { stage: stage as LeadStageKey } : {}),
          ...(lifecycleStatus ? { lifecycleStatus: lifecycleStatus as LeadLifecycleStatusKey } : {}),
          ...(routingTeam ? { routingTeam: routingTeam as LeadRoutingTeamKey } : {}),
          ...(leadSourceCode ? { leadSourceCode } : {}),
          ...(affinityGroupCode ? { affinityGroupCode } : {}),
          ...(ownershipGroupCode ? { ownershipGroupCode } : {}),
          ...(territoryId ? { territoryId } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(page !== undefined ? { page } : {}),
        };

        const response = await listLeads(actor, query);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CreateLeadRequest;
        const response = await createLead(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/leads/website-forms') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const search = readTrimmedQuery(url, 'search');
      const stage = readTrimmedQuery(url, 'stage');
      const lifecycleStatus = readTrimmedQuery(url, 'lifecycleStatus');
      const sourceSiteId = readTrimmedQuery(url, 'sourceSiteId');
      const limit = readIntegerQuery(url, 'limit');
      const query: ListWebsiteFormLeadsRequest = {
        ...(search ? { search } : {}),
        ...(stage ? { stage: stage as LeadStageKey } : {}),
        ...(lifecycleStatus ? { lifecycleStatus: lifecycleStatus as LeadLifecycleStatusKey } : {}),
        ...(sourceSiteId ? { sourceSiteId } : {}),
        ...(limit !== undefined ? { limit } : {}),
      };

      const response = await listWebsiteFormLeads(actor, query);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/duplicates/preview') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const body = (await readJsonBody(req)) as PreviewLeadDuplicateCandidatesRequest;
      const response = await previewLeadDuplicateCandidates(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/ocr/preview') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req, 5_000_000)) as PreviewLeadOcrCaptureRequest;
      const response = await previewLeadOcrCapture(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/website-submissions') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const search = readTrimmedQuery(url, 'search');
      const sourceSiteId = readTrimmedQuery(url, 'sourceSiteId');
      const outcome = readTrimmedQuery(url, 'outcome');
      const limit = readIntegerQuery(url, 'limit');
      const query: ListWebsiteLeadSubmissionsRequest = {};

      if (search) {
        query.search = search;
      }
      if (sourceSiteId) {
        query.sourceSiteId = sourceSiteId;
      }
      if (outcome) {
        query.outcome = outcome as NonNullable<ListWebsiteLeadSubmissionsRequest['outcome']>;
      }
      if (limit !== undefined) {
        query.limit = limit;
      }

      const response = await listWebsiteLeadSubmissions(actor, query);
      return jsonResponse(res, 200, response);
    }

    const resolveSubmissionMatch = matchPath(pathname, '/api/v1/leads/website-submissions/:submissionId/resolve');
    if (resolveSubmissionMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const submissionId = resolveSubmissionMatch.submissionId;
      if (!submissionId) {
        return badRequestResponse(res, 'Submission id is required');
      }

      const body = (await readJsonBody(req)) as ResolveWebsiteLeadSubmissionRequest;
      const response = await resolveWebsiteLeadSubmission(actor, submissionId, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/website-sites') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const response = await listWebsiteLeadSites(actor);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CreateWebsiteLeadSiteRequest;
        const response = await createWebsiteLeadSite(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/leads/website-notification-recipients') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const response = await listWebsiteLeadNotificationRecipients(actor);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CreateWebsiteLeadNotificationRecipientRequest;
        const response = await createWebsiteLeadNotificationRecipient(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/leads/history-feed') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const search = readTrimmedQuery(url, 'search');
      const limit = readIntegerQuery(url, 'limit');
      const query: ListLeadHistoryFeedRequest = {};
      if (search) {
        query.search = search;
      }
      if (limit !== undefined) {
        query.limit = limit;
      }

      const response = await listLeadHistoryFeed(actor, query);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/workflow-queue') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const search = readTrimmedQuery(url, 'search');
      const routingTeam = readTrimmedQuery(url, 'routingTeam');
      const view = readTrimmedQuery(url, 'view');
      const limit = readIntegerQuery(url, 'limit');
      const query: ListLeadWorkflowQueueRequest = {
        ...(search ? { search } : {}),
        ...(routingTeam ? { routingTeam: routingTeam as LeadRoutingTeamKey } : {}),
        ...(view ? { view: view as LeadWorkflowQueueViewKey } : {}),
        ...(limit !== undefined ? { limit } : {}),
      };

      const response = await listLeadWorkflowQueue(actor, query);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/import') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as ImportLeadsRequest;
      const response = await importLeads(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/import/preview') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as LeadImportFilePreviewRequest;
      const response = await previewLeadImport(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/import/file') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as ImportLeadFileRequest;
      const response = await importLeadFile(actor, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/import/review') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as ReviewLeadImportRequest;
      const response = await reviewLeadImport(actor, body);
      return jsonResponse(res, 200, response);
    }

    const importRunMatch = matchPath(pathname, '/api/v1/leads/import/runs/:runId');
    if (importRunMatch) {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }
      if (!importRunMatch.runId) {
        return badRequestResponse(res, 'runId is required');
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const response = await getLeadImportRun(actor, importRunMatch.runId);
      return jsonResponse(res, 200, response);
    }

    const importRunCommitMatch = matchPath(pathname, '/api/v1/leads/import/runs/:runId/commit');
    if (importRunCommitMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }
      if (!importRunCommitMatch.runId) {
        return badRequestResponse(res, 'runId is required');
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as CommitLeadImportRunRequest;
      const response = await commitLeadImportRun(actor, importRunCommitMatch.runId, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/leads/routing-policy') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const response = await getLeadRoutingPolicy(actor);
        return jsonResponse(res, 200, response);
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'reference.manage',
        });
        const body = (await readJsonBody(req)) as UpdateLeadRoutingPolicyRequest;
        const response = await updateLeadRoutingPolicy(actor, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
    }

    const websiteSiteMatch = matchPath(pathname, '/api/v1/leads/website-sites/:siteRecordId');
    if (websiteSiteMatch) {
      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const siteId = websiteSiteMatch.siteRecordId;
      if (!siteId) {
        return badRequestResponse(res, 'Website site id is required');
      }
      const body = (await readJsonBody(req)) as UpdateWebsiteLeadSiteRequest;
      const response = await updateWebsiteLeadSite(actor, siteId, body);
      return jsonResponse(res, 200, response);
    }

    const websiteRecipientMatch = matchPath(pathname, '/api/v1/leads/website-notification-recipients/:recipientId');
    if (websiteRecipientMatch) {
      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const recipientId = websiteRecipientMatch.recipientId;
      if (!recipientId) {
        return badRequestResponse(res, 'Website notification recipient id is required');
      }
      const body = (await readJsonBody(req)) as UpdateWebsiteLeadNotificationRecipientRequest;
      const response = await updateWebsiteLeadNotificationRecipient(actor, recipientId, body);
      return jsonResponse(res, 200, response);
    }

    const stageTransitionMatch = matchPath(pathname, '/api/v1/leads/:leadId/stage-transition');
    if (stageTransitionMatch) {
      const leadId = stageTransitionMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as TransitionLeadStageRequest;
      const response = await transitionLeadStage(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    const lifecycleMatch = matchPath(pathname, '/api/v1/leads/:leadId/lifecycle');
    if (lifecycleMatch) {
      const leadId = lifecycleMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as UpdateLeadLifecycleRequest;
      const response = await updateLeadLifecycle(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    const logInitialContactMatch = matchPath(pathname, '/api/v1/leads/:leadId/log-initial-contact');
    if (logInitialContactMatch) {
      const leadId = logInitialContactMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as LogLeadInitialContactRequest;
      const response = await logLeadInitialContact(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    // UX-L-010: freeform activity note on lead record
    const leadNotesMatch = matchPath(pathname, '/api/v1/leads/:leadId/notes');
    if (leadNotesMatch) {
      const leadId = leadNotesMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as LogLeadActivityNoteRequest;
      const response = await logLeadActivityNote(actor, leadId, body);
      return jsonResponse(res, 201, response);
    }

    const scheduleDiscoveryMatch = matchPath(pathname, '/api/v1/leads/:leadId/discovery/schedule');
    if (scheduleDiscoveryMatch) {
      const leadId = scheduleDiscoveryMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as ScheduleLeadDiscoveryRequest;
      const response = await scheduleLeadDiscovery(actor, leadId, body, config);
      return jsonResponse(res, 200, response);
    }

    const completeDiscoveryMatch = matchPath(pathname, '/api/v1/leads/:leadId/discovery/complete');
    if (completeDiscoveryMatch) {
      const leadId = completeDiscoveryMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as CompleteLeadDiscoveryRequest;
      const response = await completeLeadDiscovery(actor, leadId, body, config);
      return jsonResponse(res, 200, response);
    }

    const skipDiscoveryMatch = matchPath(pathname, '/api/v1/leads/:leadId/discovery/skip');
    if (skipDiscoveryMatch) {
      const leadId = skipDiscoveryMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as SkipLeadDiscoveryRequest;
      const response = await skipLeadDiscovery(actor, leadId, body, config);
      return jsonResponse(res, 200, response);
    }

    const readinessMatch = matchPath(pathname, '/api/v1/leads/:leadId/readiness');
    if (readinessMatch) {
      const leadId = readinessMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const response = await getLeadReadiness(actor, leadId);
        if (!response) {
          return notFoundResponse(res, { entity: 'Lead', id: leadId });
        }
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['GET']);
    }

    const readinessBlockersMatch = matchPath(pathname, '/api/v1/leads/:leadId/readiness/blockers');
    if (readinessBlockersMatch) {
      const leadId = readinessBlockersMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const response = await getLeadReadinessBlockers(actor, leadId);
      if (!response) {
        return notFoundResponse(res, { entity: 'Lead', id: leadId });
      }
      return jsonResponse(res, 200, response);
    }

    const generateChecklistMatch = matchPath(pathname, '/api/v1/leads/:leadId/readiness/checklist/generate');
    if (generateChecklistMatch) {
      const leadId = generateChecklistMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const response = await generateLeadReadinessChecklist(actor, leadId);
      return jsonResponse(res, 200, response);
    }

    const readinessItemMatch = matchPath(pathname, '/api/v1/leads/:leadId/readiness/items/:itemId');
    if (readinessItemMatch) {
      const leadId = readinessItemMatch.leadId;
      const itemId = readinessItemMatch.itemId;
      if (!leadId || !itemId) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as UpdateLeadReadinessItemRequest;
      const response = await updateLeadReadinessItem(actor, leadId, itemId, body);
      return jsonResponse(res, 200, response);
    }

    const leadContactsMatch = matchPath(pathname, '/api/v1/leads/:leadId/contacts');
    if (leadContactsMatch) {
      const leadId = leadContactsMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const response = await listLeadContacts(actor, leadId);
        if (!response) {
          return notFoundResponse(res, { entity: 'Lead', id: leadId });
        }
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as CreateLeadContactRequest;
        const response = await createLeadContact(actor, leadId, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const importLeadContactsMatch = matchPath(pathname, '/api/v1/leads/:leadId/contacts/import-from-cis');
    if (importLeadContactsMatch) {
      const leadId = importLeadContactsMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const response = await importLeadContactsFromCis(actor, leadId);
      return jsonResponse(res, 200, response);
    }

    const leadContactMatch = matchPath(pathname, '/api/v1/leads/:leadId/contacts/:contactId');
    if (leadContactMatch) {
      const leadId = leadContactMatch.leadId;
      const contactId = leadContactMatch.contactId;
      if (!leadId || !contactId) {
        return false;
      }

      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const body = (await readJsonBody(req)) as UpdateLeadContactRequest;
      const response = await updateLeadContact(actor, leadId, contactId, body);
      return jsonResponse(res, 200, response);
    }

    const conversionPrepMatch = matchPath(pathname, '/api/v1/leads/:leadId/conversion-prep');
    if (conversionPrepMatch) {
      const leadId = conversionPrepMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const response = await getLeadConversionPreparation(actor, leadId);
        if (!response) {
          return notFoundResponse(res, { entity: 'Lead', id: leadId });
        }
        return jsonResponse(res, 200, response);
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as UpdateLeadConversionPreparationRequest;
        const response = await updateLeadConversionPreparation(actor, leadId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
    }

    const validateConversionPrepMatch = matchPath(pathname, '/api/v1/leads/:leadId/conversion-prep/validate');
    if (validateConversionPrepMatch) {
      const leadId = validateConversionPrepMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const response = await validateLeadConversionPreparation(actor, leadId);
      return jsonResponse(res, 200, response);
    }

    const convertOnFirstOrderMatch = matchPath(pathname, '/api/v1/leads/:leadId/convert-on-first-order');
    if (convertOnFirstOrderMatch) {
      const leadId = convertOnFirstOrderMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'customers',
        action: 'customer.create',
      });
      const body = (await readJsonBody(req)) as ConvertLeadOnFirstOrderRequest;
      const response = await convertLeadOnFirstOrder(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    const leadMatch = matchPath(pathname, '/api/v1/leads/:leadId');
    if (leadMatch) {
      const leadId = leadMatch.leadId;
      if (!leadId) {
        return false;
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.intake_manage',
        });
        const body = (await readJsonBody(req)) as UpdateLeadRequest;
        const response = await updateLead(actor, leadId, body);
        return jsonResponse(res, 200, response);
      }

      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const response = await getLeadDetail(actor, leadId);
      if (!response) {
        return notFoundResponse(res, { entity: 'Lead', id: leadId });
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
    const statusCode = message.includes('not found') ? 404 : 400;
    if (statusCode === 404) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

function normalizeLeadRouteDependencies(deps?: AppConfig | LeadRouteDependencies): LeadRouteDependencies {
  if (!deps) {
    return {};
  }

  if ('app' in deps) {
    return {
      config: deps,
    };
  }

  return deps;
}

async function applyPublicCaptureCors(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  config?: AppConfig,
) {
  const origin = req.headers.origin;
  if (origin && await isPublicOriginAllowedForPath(origin, pathname, config)) {
    applyAllowedPublicOriginHeader(req, res);
  }
}

function applyPublicCaptureCommonCorsHeaders(res: ServerResponse) {
  res.setHeader('access-control-allow-methods', 'GET, OPTIONS, POST');
  res.setHeader('access-control-allow-headers', 'content-type');
}

function applyAllowedPublicOriginHeader(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (!origin) {
    return;
  }

  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
}

function clearAllowedPublicOriginHeader(res: ServerResponse) {
  res.removeHeader('access-control-allow-origin');
  res.removeHeader('vary');
}

function consumePublicCaptureRateLimit(limiter: FixedWindowRateLimiter | undefined, key: string) {
  return limiter?.consume(key) ?? {
    allowed: true,
    remaining: Number.POSITIVE_INFINITY,
    resetAt: new Date(),
    retryAfterSeconds: 1,
  };
}

function getClientIp(req: IncomingMessage) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwardedIp = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(',')[0];
  const normalizedForwardedIp = firstForwardedIp?.trim();

  return normalizedForwardedIp || req.socket.remoteAddress || 'unknown';
}

async function isPublicOriginAllowedForPath(origin: string, pathname: string, config?: AppConfig) {
  const siteMatch = matchPath(pathname, '/api/v1/public/website-sites/:siteId');
  if (siteMatch?.siteId) {
    const allowedOrigins = new Set([
      ...getInternalPublicCaptureAllowedOrigins(config),
      ...(await getPublicWebsiteLeadSiteAllowedOrigins(siteMatch.siteId)),
    ]);
    return allowedOrigins.has(origin);
  }

  const allowedOrigins = new Set([
    ...getInternalPublicCaptureAllowedOrigins(config),
    ...(await listActivePublicWebsiteLeadOrigins()),
  ]);
  return allowedOrigins.has(origin);
}

async function isPublicOriginAllowedForSite(req: IncomingMessage, siteId: string, config?: AppConfig) {
  const origin = req.headers.origin;
  if (!origin) {
    return false;
  }

  const allowedOrigins = new Set([
    ...getInternalPublicCaptureAllowedOrigins(config),
    ...(await getPublicWebsiteLeadSiteAllowedOrigins(siteId)),
  ]);
  return allowedOrigins.has(origin);
}

function getInternalPublicCaptureAllowedOrigins(config?: AppConfig) {
  const allowedOrigins = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3010',
    'http://127.0.0.1:3010',
  ]);

  if (config) {
    try {
      allowedOrigins.add(new URL(config.web.publicBaseUrl).origin);
    } catch {
      // Ignore invalid public base URL.
    }
  }

  return allowedOrigins;
}

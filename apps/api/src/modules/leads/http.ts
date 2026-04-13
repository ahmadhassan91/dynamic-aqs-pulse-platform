import { AuthorizationError } from '@pulse/auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CaptureWebsiteLeadRequest,
  CompleteLeadDiscoveryRequest,
  ConvertLeadOnFirstOrderRequest,
  CreateWebsiteLeadNotificationRecipientRequest,
  CreateWebsiteLeadSiteRequest,
  CreateLeadRequest,
  CreateLeadContactRequest,
  ImportLeadFileRequest,
  LeadImportFilePreviewRequest,
  ImportLeadsRequest,
  ListLeadWorkflowQueueRequest,
  LogLeadInitialContactRequest,
  LeadRoutingTeamKey,
  LeadStageKey,
  LeadLifecycleStatusKey,
  LeadWorkflowQueueViewKey,
  ListLeadHistoryFeedRequest,
  ListLeadsRequest,
  ListWebsiteLeadSubmissionsRequest,
  ListWebsiteFormLeadsRequest,
  ScheduleLeadDiscoveryRequest,
  SkipLeadDiscoveryRequest,
  TransitionLeadStageRequest,
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
  methodNotAllowedResponse,
  notFoundResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import { AuthenticationError, requireAuthenticatedActor } from '../auth/request.js';
import {
  captureWebsiteLead,
  completeLeadDiscovery,
  createLead,
  createWebsiteLeadNotificationRecipient,
  createWebsiteLeadSite,
  getLeadDetail,
  getPublicWebsiteLeadSite,
  importLeadFile,
  getLeadRoutingPolicy,
  importLeads,
  logLeadInitialContact,
  listLeadWorkflowQueue,
  listLeadHistoryFeed,
  listLeads,
  listWebsiteLeadNotificationRecipients,
  listWebsiteLeadSites,
  listWebsiteLeadSubmissions,
  listWebsiteFormLeads,
  previewLeadImport,
  scheduleLeadDiscovery,
  skipLeadDiscovery,
  transitionLeadStage,
  updateLeadLifecycle,
  updateLeadRoutingPolicy,
  updateWebsiteLeadNotificationRecipient,
  updateWebsiteLeadSite,
} from './service.js';
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

export async function handleLeadRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';

  const publicCaptureRoute =
    pathname === '/api/leads/capture'
    || pathname === '/api/v1/leads/capture'
    || pathname === '/api/v1/public/leads/capture'
    || /^\/api\/v1\/public\/website-sites\/[^/]+$/.test(pathname);

  const internalLeadRoute =
    pathname === '/api/v1/leads'
    || pathname === '/api/v1/leads/website-forms'
    || pathname === '/api/v1/leads/website-submissions'
    || pathname === '/api/v1/leads/website-sites'
    || pathname === '/api/v1/leads/website-notification-recipients'
    || pathname === '/api/v1/leads/workflow-queue'
    || pathname === '/api/v1/leads/history-feed'
    || pathname === '/api/v1/leads/import'
    || pathname === '/api/v1/leads/import/file'
    || pathname === '/api/v1/leads/import/preview'
    || pathname === '/api/v1/leads/routing-policy'
    || /^\/api\/v1\/leads\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/stage-transition$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/lifecycle$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/log-initial-contact$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/discovery\/schedule$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/discovery\/complete$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/discovery\/skip$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/readiness$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/readiness\/blockers$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/readiness\/checklist\/generate$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/readiness\/items\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/contacts$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/contacts\/import-from-cis$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/contacts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/conversion-prep$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/conversion-prep\/validate$/.test(pathname)
    || /^\/api\/v1\/leads\/[^/]+\/convert-on-first-order$/.test(pathname)
    || /^\/api\/v1\/leads\/website-sites\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/leads\/website-notification-recipients\/[^/]+$/.test(pathname);

  if (!publicCaptureRoute && !internalLeadRoute) {
    return false;
  }

  try {
    if (publicCaptureRoute) {
      applyPublicCaptureCors(res);

      if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return true;
      }

      if (/^\/api\/v1\/public\/website-sites\/[^/]+$/.test(pathname)) {
        if (method !== 'GET') {
          return methodNotAllowedResponse(res, method, ['GET', 'OPTIONS']);
        }

        const siteId = pathname.split('/').pop();
        if (!siteId) {
          return badRequestResponse(res, 'siteId is required');
        }

        const response = await getPublicWebsiteLeadSite(siteId);
        return jsonResponse(res, 200, response);
      }

      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['OPTIONS', 'POST']);
      }

      const body = (await readJsonBody(req)) as CaptureWebsiteLeadRequest;
      const response = await captureWebsiteLead(body);
      return jsonResponse(res, 201, response);
    }

    if (pathname === '/api/v1/leads') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'leads',
          action: 'lead.view',
        });
        const search = url.searchParams.get('search')?.trim();
        const stage = url.searchParams.get('stage');
        const lifecycleStatus = url.searchParams.get('lifecycleStatus');
        const routingTeam = url.searchParams.get('routingTeam');
        const leadSourceCode = url.searchParams.get('leadSourceCode')?.trim();
        const limit = parseInteger(url.searchParams.get('limit'));
        const query: ListLeadsRequest = {
          ...(search ? { search } : {}),
          ...(stage ? { stage: stage as LeadStageKey } : {}),
          ...(lifecycleStatus ? { lifecycleStatus: lifecycleStatus as LeadLifecycleStatusKey } : {}),
          ...(routingTeam ? { routingTeam: routingTeam as LeadRoutingTeamKey } : {}),
          ...(leadSourceCode ? { leadSourceCode } : {}),
          ...(limit !== undefined ? { limit } : {}),
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
      const search = url.searchParams.get('search')?.trim();
      const stage = url.searchParams.get('stage');
      const lifecycleStatus = url.searchParams.get('lifecycleStatus');
      const sourceSiteId = url.searchParams.get('sourceSiteId')?.trim();
      const limit = parseInteger(url.searchParams.get('limit'));
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

    if (pathname === '/api/v1/leads/website-submissions') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.view',
      });
      const search = url.searchParams.get('search')?.trim();
      const sourceSiteId = url.searchParams.get('sourceSiteId')?.trim();
      const outcome = url.searchParams.get('outcome');
      const limit = parseInteger(url.searchParams.get('limit'));
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
      const search = url.searchParams.get('search')?.trim();
      const limit = parseInteger(url.searchParams.get('limit'));
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
      const search = url.searchParams.get('search')?.trim();
      const routingTeam = url.searchParams.get('routingTeam');
      const view = url.searchParams.get('view');
      const limit = parseInteger(url.searchParams.get('limit'));
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

    if (pathname.startsWith('/api/v1/leads/website-sites/')) {
      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const siteId = pathname.split('/').pop();
      if (!siteId) {
        return badRequestResponse(res, 'Website site id is required');
      }
      const body = (await readJsonBody(req)) as UpdateWebsiteLeadSiteRequest;
      const response = await updateWebsiteLeadSite(actor, siteId, body);
      return jsonResponse(res, 200, response);
    }

    if (pathname.startsWith('/api/v1/leads/website-notification-recipients/')) {
      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'leads',
        action: 'lead.intake_manage',
      });
      const recipientId = pathname.split('/').pop();
      if (!recipientId) {
        return badRequestResponse(res, 'Website notification recipient id is required');
      }
      const body = (await readJsonBody(req)) as UpdateWebsiteLeadNotificationRecipientRequest;
      const response = await updateWebsiteLeadNotificationRecipient(actor, recipientId, body);
      return jsonResponse(res, 200, response);
    }

    const stageTransitionMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/stage-transition$/);
    if (stageTransitionMatch) {
      const leadId = stageTransitionMatch[1];
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

    const lifecycleMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/lifecycle$/);
    if (lifecycleMatch) {
      const leadId = lifecycleMatch[1];
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

    const logInitialContactMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/log-initial-contact$/);
    if (logInitialContactMatch) {
      const leadId = logInitialContactMatch[1];
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

    const scheduleDiscoveryMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/discovery\/schedule$/);
    if (scheduleDiscoveryMatch) {
      const leadId = scheduleDiscoveryMatch[1];
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
      const response = await scheduleLeadDiscovery(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    const completeDiscoveryMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/discovery\/complete$/);
    if (completeDiscoveryMatch) {
      const leadId = completeDiscoveryMatch[1];
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
      const response = await completeLeadDiscovery(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    const skipDiscoveryMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/discovery\/skip$/);
    if (skipDiscoveryMatch) {
      const leadId = skipDiscoveryMatch[1];
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
      const response = await skipLeadDiscovery(actor, leadId, body);
      return jsonResponse(res, 200, response);
    }

    const readinessMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/readiness$/);
    if (readinessMatch) {
      const leadId = readinessMatch[1];
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

    const readinessBlockersMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/readiness\/blockers$/);
    if (readinessBlockersMatch) {
      const leadId = readinessBlockersMatch[1];
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

    const generateChecklistMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/readiness\/checklist\/generate$/);
    if (generateChecklistMatch) {
      const leadId = generateChecklistMatch[1];
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

    const readinessItemMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/readiness\/items\/([^/]+)$/);
    if (readinessItemMatch) {
      const leadId = readinessItemMatch[1];
      const itemId = readinessItemMatch[2];
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

    const leadContactsMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/contacts$/);
    if (leadContactsMatch) {
      const leadId = leadContactsMatch[1];
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

    const importLeadContactsMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/contacts\/import-from-cis$/);
    if (importLeadContactsMatch) {
      const leadId = importLeadContactsMatch[1];
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

    const leadContactMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/contacts\/([^/]+)$/);
    if (leadContactMatch) {
      const leadId = leadContactMatch[1];
      const contactId = leadContactMatch[2];
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

    const conversionPrepMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/conversion-prep$/);
    if (conversionPrepMatch) {
      const leadId = conversionPrepMatch[1];
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

    const validateConversionPrepMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/conversion-prep\/validate$/);
    if (validateConversionPrepMatch) {
      const leadId = validateConversionPrepMatch[1];
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

    const convertOnFirstOrderMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)\/convert-on-first-order$/);
    if (convertOnFirstOrderMatch) {
      const leadId = convertOnFirstOrderMatch[1];
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

    const leadMatch = pathname.match(/^\/api\/v1\/leads\/([^/]+)$/);
    if (leadMatch) {
      const leadId = leadMatch[1];
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
      const response = await getLeadDetail(actor, leadId);
      if (!response) {
        return notFoundResponse(res, { entity: 'Lead', id: leadId });
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
    const statusCode = message.includes('not found') ? 404 : 400;
    if (statusCode === 404) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

function parseInteger(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function applyPublicCaptureCors(res: ServerResponse) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'OPTIONS, POST');
  res.setHeader('access-control-allow-headers', 'content-type');
}

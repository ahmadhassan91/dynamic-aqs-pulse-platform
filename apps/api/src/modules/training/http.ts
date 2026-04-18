import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type { AppConfig } from '../../config.js';
import type {
  CancelTrainingSessionRequest,
  CheckInTrainingSessionRequest,
  CompleteTrainingFollowUpTaskRequest,
  CompleteTrainingSessionRequest,
  CreateTrainingFollowUpTaskRequest,
  CreateAccountTrainingProgramRequest,
  CreateTrainingCategoryRequest,
  CreateTrainingSessionRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  ListTrainingAccountsRequest,
  ListTrainingComplianceReportRequest,
  ListTrainingRecertificationQueueRequest,
  ListTrainingOperationalQueueRequest,
  ListTrainingSessionsRequest,
  RevokeTrainingCertificationRequest,
  ResolveTrainingCertificationDecisionRequest,
  UploadTrainingSessionProofRequest,
  UpdateTrainingSessionScheduleRequest,
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
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import type { AuthenticatedActor } from '../auth/types.js';
import {
  cancelTrainingSession,
  checkInTrainingSession,
  completeTrainingFollowUpTask,
  completeTrainingSession,
  createAccountTrainingProgram,
  createTrainingFollowUpTask,
  createTrainingCategory,
  createTrainingSession,
  createTrainingTemplate,
  createTrainingType,
  getAccountTrainingHistory,
  getTerritoryTrainingPenetration,
  getTrainingCoachingWorkload,
  listTrainingAccounts,
  listTrainingCatalog,
  listTrainingComplianceReport,
  listTrainingOperationalQueue,
  listTrainingRecertificationQueue,
  listTrainingOverview,
  listTrainingSessions,
  listTrainingTrainers,
  resolveTrainingCertificationDecision,
  revokeTrainingCertification,
  rescheduleTrainingSession,
  uploadTrainingSessionProof,
} from './service.js';

export async function handleTrainingRoutes(req: IncomingMessage, res: ServerResponse, url: URL, config?: AppConfig) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;
  const isTrainingRoute =
    pathname === '/api/v1/training/overview'
    || pathname === '/api/v1/training/catalog'
    || pathname === '/api/v1/training/ops'
    || pathname === '/api/v1/training/recertification'
    || pathname === '/api/v1/training/coaching'
    || pathname === '/api/v1/training/territory-penetration'
    || pathname === '/api/v1/training/reporting'
    || pathname === '/api/v1/training/trainers'
    || pathname === '/api/v1/training/sessions'
    || pathname === '/api/v1/training/catalog/categories'
    || pathname === '/api/v1/training/catalog/types'
    || pathname === '/api/v1/training/catalog/templates'
    || pathname === '/api/v1/training/accounts'
    || /^\/api\/v1\/training\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/training\/accounts\/[^/]+\/programs$/.test(pathname)
    || /^\/api\/v1\/training\/accounts\/[^/]+\/sessions$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/check-in$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/reschedule$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/certification-decision$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/proof$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/complete$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/cancel$/.test(pathname)
    || /^\/api\/v1\/training\/sessions\/[^/]+\/follow-up-tasks$/.test(pathname)
    || /^\/api\/v1\/training\/follow-up-tasks\/[^/]+\/complete$/.test(pathname)
    || /^\/api\/v1\/training\/certifications\/[^/]+\/revoke$/.test(pathname);

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

    if (pathname === '/api/v1/training/ops') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const query: ListTrainingOperationalQueueRequest = {};
        const ownerTmUserId = url.searchParams.get('ownerTmUserId')?.trim();
        const ownerRdUserId = url.searchParams.get('ownerRdUserId')?.trim();
        const certificationWindowDays = parseInteger(url.searchParams.get('certificationWindowDays'));
        const limit = parseInteger(url.searchParams.get('limit'));

        if (ownerTmUserId) {
          query.ownerTmUserId = ownerTmUserId;
        }
        if (ownerRdUserId) {
          query.ownerRdUserId = ownerRdUserId;
        }
        if (certificationWindowDays !== undefined) {
          query.certificationWindowDays = certificationWindowDays;
        }
        if (limit !== undefined) {
          query.limit = limit;
        }

        const response = await listTrainingOperationalQueue(actor, query);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/recertification') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const query: ListTrainingRecertificationQueueRequest = {};
        const ownerTmUserId = url.searchParams.get('ownerTmUserId')?.trim();
        const ownerRdUserId = url.searchParams.get('ownerRdUserId')?.trim();
        const windowDays = parseInteger(url.searchParams.get('windowDays'));
        const limit = parseInteger(url.searchParams.get('limit'));

        if (ownerTmUserId) {
          query.ownerTmUserId = ownerTmUserId;
        }
        if (ownerRdUserId) {
          query.ownerRdUserId = ownerRdUserId;
        }
        if (windowDays !== undefined) {
          query.windowDays = windowDays;
        }
        if (limit !== undefined) {
          query.limit = limit;
        }

        const response = await listTrainingRecertificationQueue(actor, query);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/coaching') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const response = await getTrainingCoachingWorkload(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/territory-penetration') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const response = await getTerritoryTrainingPenetration(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/trainers') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const response = await listTrainingTrainers(actor);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/reporting') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const query: ListTrainingComplianceReportRequest = {};
        const ownerTmUserId = url.searchParams.get('ownerTmUserId')?.trim();
        const ownerRdUserId = url.searchParams.get('ownerRdUserId')?.trim();
        const certificationWindowDays = parseInteger(url.searchParams.get('certificationWindowDays'));

        if (ownerTmUserId) {
          query.ownerTmUserId = ownerTmUserId;
        }
        if (ownerRdUserId) {
          query.ownerRdUserId = ownerRdUserId;
        }
        if (certificationWindowDays !== undefined) {
          query.certificationWindowDays = certificationWindowDays;
        }

        const response = await listTrainingComplianceReport(actor, query);
        return jsonResponse(res, 200, response);
      });
    }

    if (pathname === '/api/v1/training/sessions') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      return withTrainingAuth(req, res, { module: 'training' }, async (actor) => {
        const query: ListTrainingSessionsRequest = {};
        const accountId = url.searchParams.get('accountId')?.trim();
        const trainerUserId = url.searchParams.get('trainerUserId')?.trim();
        const status = url.searchParams.get('status')?.trim();
        const includeVisits = parseBoolean(url.searchParams.get('includeVisits'));
        const limit = parseInteger(url.searchParams.get('limit'));

        if (accountId) {
          query.accountId = accountId;
        }
        if (trainerUserId) {
          query.trainerUserId = trainerUserId;
        }
        const normalizedStatus = status && ['all', 'scheduled', 'checked_in', 'overdue', 'exceptions', 'completed', 'cancelled', 'no_show'].includes(status)
          ? (status as NonNullable<ListTrainingSessionsRequest['status']>)
          : null;
        if (normalizedStatus) {
          query.status = normalizedStatus;
        }
        if (includeVisits !== undefined) {
          query.includeVisits = includeVisits;
        }
        if (limit !== undefined) {
          query.limit = limit;
        }

        const response = await listTrainingSessions(actor, query);
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

    const accountSessionsMatch = pathname.match(/^\/api\/v1\/training\/accounts\/([^/]+)\/sessions$/);
    if (accountSessionsMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const accountId = accountSessionsMatch[1];
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateTrainingSessionRequest;
        const response = await createTrainingSession(actor, accountId, body, config);
        return jsonResponse(res, 201, response);
      });
    }

    const sessionRescheduleMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/reschedule$/);
    if (sessionRescheduleMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionRescheduleMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateTrainingSessionScheduleRequest;
        const response = await rescheduleTrainingSession(actor, sessionId, body, config);
        return jsonResponse(res, 200, response);
      });
    }

    const sessionCertificationDecisionMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/certification-decision$/);
    if (sessionCertificationDecisionMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionCertificationDecisionMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as ResolveTrainingCertificationDecisionRequest;
        const response = await resolveTrainingCertificationDecision(actor, sessionId, body);
        return jsonResponse(res, 200, response);
      });
    }

    const sessionCheckInMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/check-in$/);
    if (sessionCheckInMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionCheckInMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CheckInTrainingSessionRequest;
        const response = await checkInTrainingSession(actor, sessionId, body);
        return jsonResponse(res, 200, response);
      });
    }

    const sessionCompleteMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/complete$/);
    if (sessionCompleteMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionCompleteMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CompleteTrainingSessionRequest;
        const response = await completeTrainingSession(actor, sessionId, body, config);
        return jsonResponse(res, 200, response);
      });
    }

    const sessionProofUploadMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/proof$/);
    if (sessionProofUploadMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionProofUploadMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }
      if (!config) {
        return badRequestResponse(res, 'Training proof storage is not configured');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as UploadTrainingSessionProofRequest;
        const response = await uploadTrainingSessionProof(actor, config, sessionId, body);
        return jsonResponse(res, 201, response);
      });
    }

    const sessionCancelMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/cancel$/);
    if (sessionCancelMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionCancelMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CancelTrainingSessionRequest;
        const response = await cancelTrainingSession(actor, sessionId, body, config);
        return jsonResponse(res, 200, response);
      });
    }

    const sessionFollowUpMatch = pathname.match(/^\/api\/v1\/training\/sessions\/([^/]+)\/follow-up-tasks$/);
    if (sessionFollowUpMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const sessionId = sessionFollowUpMatch[1];
      if (!sessionId) {
        return badRequestResponse(res, 'Session id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CreateTrainingFollowUpTaskRequest;
        const response = await createTrainingFollowUpTask(actor, sessionId, body);
        return jsonResponse(res, 201, response);
      });
    }

    const followUpTaskCompleteMatch = pathname.match(/^\/api\/v1\/training\/follow-up-tasks\/([^/]+)\/complete$/);
    if (followUpTaskCompleteMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const taskId = followUpTaskCompleteMatch[1];
      if (!taskId) {
        return badRequestResponse(res, 'Follow-up task id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as CompleteTrainingFollowUpTaskRequest;
        const response = await completeTrainingFollowUpTask(actor, taskId, body);
        return jsonResponse(res, 200, response);
      });
    }

    const revokeCertificationMatch = pathname.match(/^\/api\/v1\/training\/certifications\/([^/]+)\/revoke$/);
    if (revokeCertificationMatch) {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const certificationId = revokeCertificationMatch[1];
      if (!certificationId) {
        return badRequestResponse(res, 'Training certification id is required');
      }

      return withTrainingAuth(req, res, { action: 'training.schedule' }, async (actor) => {
        const body = (await readJsonBody(req)) as RevokeTrainingCertificationRequest;
        const response = await revokeTrainingCertification(actor, certificationId, body);
        return jsonResponse(res, 200, response);
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
  try {
    const actor = await requireAuthenticatedActor(req, permission);
    return await handler(actor);
  } catch (error) {
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }

    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    }

    return badRequestResponse(res, error instanceof Error ? error.message : String(error));
  }
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

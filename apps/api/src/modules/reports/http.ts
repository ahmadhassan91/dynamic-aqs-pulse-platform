import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CreateReportDefinitionRequest,
  CreateReportScheduleRequest,
  ReportConfig,
  UpdateReportDefinitionRequest,
  UpdateReportScheduleRequest,
} from '@pulse/contracts/reports';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  readJsonBody,
  unauthorizedResponse,
} from '../../utils/http.js';
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  createReportDefinition,
  createReportSchedule,
  deleteReportDefinition,
  deleteReportSchedule,
  getExecutiveDashboard,
  getLeadDashboard,
  getTrainingDashboard,
  listReportDefinitions,
  listReportDeliveries,
  listReportSchedules,
  runAdHocReport,
  runReportDefinition,
  updateReportDefinition,
  updateReportSchedule,
} from './service.js';

export async function handleReportRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (pathname === '/api/v1/reports/definitions') {
    if (method === 'GET') {
      return withReportsAuth(req, res, async (actor) => {
        const response = await listReportDefinitions(actor);
        return jsonResponse(res, 200, response);
      });
    }
    if (method === 'POST') {
      return withReportsAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as CreateReportDefinitionRequest;
        const response = await createReportDefinition(actor, body);
        return jsonResponse(res, 201, response);
      });
    }
    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  }

  if (pathname === '/api/v1/reports/run') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }
    return withReportsAuth(req, res, async (actor) => {
      const body = (await readJsonBody(req)) as { reportKey: string; config?: ReportConfig };
      const response = await runAdHocReport(actor, body.reportKey, body.config);
      return jsonResponse(res, 200, response);
    });
  }

  const definitionMatch = pathname.match(/^\/api\/v1\/reports\/definitions\/([^/]+)$/);
  if (definitionMatch) {
    const definitionId = decodeURIComponent(definitionMatch[1] ?? '');
    if (method === 'PATCH') {
      return withReportsAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateReportDefinitionRequest;
        const response = await updateReportDefinition(actor, definitionId, body);
        return jsonResponse(res, 200, response);
      });
    }
    if (method === 'DELETE') {
      return withReportsAuth(req, res, async (actor) => {
        await deleteReportDefinition(actor, definitionId);
        return jsonResponse(res, 200, { ok: true });
      });
    }
    return methodNotAllowedResponse(res, method, ['PATCH', 'DELETE']);
  }

  const runMatch = pathname.match(/^\/api\/v1\/reports\/definitions\/([^/]+)\/run$/);
  if (runMatch) {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }
    return withReportsAuth(req, res, async (actor) => {
      const response = await runReportDefinition(actor, decodeURIComponent(runMatch[1] ?? ''));
      return jsonResponse(res, 200, response);
    });
  }

  const schedulesMatch = pathname.match(/^\/api\/v1\/reports\/definitions\/([^/]+)\/schedules$/);
  if (schedulesMatch) {
    const definitionId = decodeURIComponent(schedulesMatch[1] ?? '');
    if (method === 'GET') {
      return withReportsAuth(req, res, async (actor) => {
        const response = await listReportSchedules(actor, definitionId);
        return jsonResponse(res, 200, response);
      });
    }
    if (method === 'POST') {
      return withReportsAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as CreateReportScheduleRequest;
        const response = await createReportSchedule(actor, definitionId, body);
        return jsonResponse(res, 201, response);
      });
    }
    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  }

  const scheduleMatch = pathname.match(/^\/api\/v1\/reports\/schedules\/([^/]+)$/);
  if (scheduleMatch) {
    const scheduleId = decodeURIComponent(scheduleMatch[1] ?? '');
    if (method === 'PATCH') {
      return withReportsAuth(req, res, async (actor) => {
        const body = (await readJsonBody(req)) as UpdateReportScheduleRequest;
        const response = await updateReportSchedule(actor, scheduleId, body);
        return jsonResponse(res, 200, response);
      });
    }
    if (method === 'DELETE') {
      return withReportsAuth(req, res, async (actor) => {
        await deleteReportSchedule(actor, scheduleId);
        return jsonResponse(res, 200, { ok: true });
      });
    }
    return methodNotAllowedResponse(res, method, ['PATCH', 'DELETE']);
  }

  const deliveriesMatch = pathname.match(/^\/api\/v1\/reports\/schedules\/([^/]+)\/deliveries$/);
  if (deliveriesMatch) {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }
    return withReportsAuth(req, res, async (actor) => {
      const response = await listReportDeliveries(actor, decodeURIComponent(deliveriesMatch[1] ?? ''));
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/reports/dashboard/leads') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }
    return withReportsAuth(req, res, async (actor) => {
      const response = await getLeadDashboard(actor);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/reports/dashboard/training') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }
    return withReportsAuth(req, res, async (actor) => {
      const response = await getTrainingDashboard(actor);
      return jsonResponse(res, 200, response);
    });
  }

  if (pathname === '/api/v1/reports/dashboard/executive') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }
    return withReportsAuth(req, res, async (actor) => {
      const response = await getExecutiveDashboard(actor);
      return jsonResponse(res, 200, response);
    });
  }

  return false;
}

async function withReportsAuth(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (actor: Awaited<ReturnType<typeof requireAuthenticatedActor>>) => Promise<void>,
) {
  try {
    const actor = await requireAuthenticatedActor(req, { module: 'reports' });
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

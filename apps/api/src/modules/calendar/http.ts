import { AuthorizationError } from '@pulse/auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CalendarWorkspaceRequest,
  SyncCalendarOutlookEventRequest,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  matchPath,
  methodNotAllowedResponse,
  readJsonBody,
  serviceUnavailableResponse,
  unauthorizedResponse,
} from '../../utils/http.js';
import { AuthenticationError, requireAuthenticatedActor } from '../auth/request.js';
import { CalendarIntegrationUnavailableError, completeOutlookConnection, disconnectOutlookConnection, startOutlookConnection, syncCalendarEventToOutlook } from './outlook.js';
import { getCalendarWorkspace } from './service.js';

export async function handleCalendarRoutes(req: IncomingMessage, res: ServerResponse, url: URL, config: AppConfig) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  try {
    if (pathname === '/api/v1/calendar/workspace') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const startDate = url.searchParams.get('startDate')?.trim();
      const endDate = url.searchParams.get('endDate')?.trim();

      if (!startDate || !endDate) {
        return badRequestResponse(res, 'startDate and endDate are required');
      }

      const actor = await requireAuthenticatedActor(req, { module: 'calendar' });
      const query: CalendarWorkspaceRequest = {
        startDate,
        endDate,
      };

      const response = await getCalendarWorkspace(actor, query, config);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/calendar/outlook/connect') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, { module: 'calendar' });
      const response = await startOutlookConnection(actor, config);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/calendar/outlook/connection') {
      if (method !== 'DELETE') {
        return methodNotAllowedResponse(res, method, ['DELETE']);
      }

      const actor = await requireAuthenticatedActor(req, { module: 'calendar' });
      const response = await disconnectOutlookConnection(actor, config);
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/calendar/outlook/events/sync') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, { module: 'calendar' });
      const body = (await readJsonBody(req, 100_000)) as Partial<SyncCalendarOutlookEventRequest>;
      if (
        !body
        || (body.sourceModule !== 'leads' && body.sourceModule !== 'training')
        || typeof body.sourceRecordId !== 'string'
        || typeof body.eventType !== 'string'
      ) {
        return badRequestResponse(res, 'sourceModule, sourceRecordId, and eventType are required');
      }

      const response = await syncCalendarEventToOutlook(actor, config, {
        sourceModule: body.sourceModule,
        sourceRecordId: body.sourceRecordId.trim(),
        eventType: body.eventType as SyncCalendarOutlookEventRequest['eventType'],
      });
      return jsonResponse(res, 200, response);
    }

    if (pathname === '/api/v1/integrations/outlook/callback') {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const response = await completeOutlookConnection(config, {
        code: url.searchParams.get('code'),
        state: url.searchParams.get('state'),
        error: url.searchParams.get('error'),
        errorDescription: url.searchParams.get('error_description'),
      });
      res.statusCode = 302;
      res.setHeader('location', response.redirectUrl);
      res.end();
      return true;
    }

    const match = matchPath(pathname, '/api/v1/calendar/outlook/events/:eventId');
    if (match) {
      return badRequestResponse(res, `Use /api/v1/calendar/outlook/events/sync for event sync actions (${match.eventId})`);
    }

    return false;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(res, error.message);
    }

    if (error instanceof AuthorizationError) {
      return forbiddenResponse(res, error.message);
    }

    if (error instanceof CalendarIntegrationUnavailableError) {
      return serviceUnavailableResponse(res, error.message);
    }

    return badRequestResponse(res, error instanceof Error ? error.message : String(error));
  }
}

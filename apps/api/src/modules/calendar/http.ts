import { AuthorizationError } from '@pulse/auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type { CalendarWorkspaceRequest } from '@pulse/contracts';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  unauthorizedResponse,
} from '../../utils/http.js';
import { AuthenticationError, requireAuthenticatedActor } from '../auth/request.js';
import { getCalendarWorkspace } from './service.js';

export async function handleCalendarRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (pathname !== '/api/v1/calendar/workspace') {
    return false;
  }

  try {
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

    const response = await getCalendarWorkspace(actor, query);
    return jsonResponse(res, 200, response);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse(res, error.message);
    }

    if (error instanceof AuthorizationError) {
      return forbiddenResponse(res, error.message);
    }

    return badRequestResponse(res, error instanceof Error ? error.message : String(error));
  }
}

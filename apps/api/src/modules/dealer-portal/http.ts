import { AuthorizationError } from '@pulse/auth';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  ProvisionDealerPortalUserRequest,
  ResetDealerPortalUserPasswordRequest,
  UpdateDealerPortalUserStatusRequest,
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
  getCurrentDealerPortalDashboard,
  getDealerPortalAccount,
  provisionDealerPortalUser,
  resetDealerPortalUserPassword,
  updateDealerPortalUserStatus,
} from './service.js';

export async function handleDealerPortalRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isDealerPortalRoute =
    /^\/api\/v1\/dealer-portal\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/accounts\/[^/]+\/users$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/users\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/users\/[^/]+\/reset-password$/.test(pathname)
    || pathname === '/api/v1/dealer-portal/me/dashboard';

  if (!isDealerPortalRoute) {
    return false;
  }

  try {
    const dealerDashboardMatch = pathname === '/api/v1/dealer-portal/me/dashboard';
    if (dealerDashboardMatch) {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
      });
      const response = await getCurrentDealerPortalDashboard(actor);
      return jsonResponse(res, 200, response);
    }

    const accountMatch = pathname.match(/^\/api\/v1\/dealer-portal\/accounts\/([^/]+)$/);
    if (accountMatch) {
      const accountId = accountMatch[1];
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
        action: 'lead.portal_setup',
      });
      const response = await getDealerPortalAccount(actor, accountId);
      if (!response) {
        return notFoundResponse(res, { entity: 'DealerPortalAccount', id: accountId });
      }

      return jsonResponse(res, 200, response);
    }

    const provisionMatch = pathname.match(/^\/api\/v1\/dealer-portal\/accounts\/([^/]+)\/users$/);
    if (provisionMatch) {
      const accountId = provisionMatch[1];
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
        action: 'lead.portal_setup',
      });
      const body = (await readJsonBody(req)) as ProvisionDealerPortalUserRequest;
      const response = await provisionDealerPortalUser(actor, accountId, body);
      return jsonResponse(res, 201, response);
    }

    const resetPasswordMatch = pathname.match(/^\/api\/v1\/dealer-portal\/users\/([^/]+)\/reset-password$/);
    if (resetPasswordMatch) {
      const portalUserId = resetPasswordMatch[1];
      if (!portalUserId) {
        return badRequestResponse(res, 'Dealer portal user id is required');
      }
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
        action: 'lead.portal_setup',
      });
      const body = (await readJsonBody(req)) as ResetDealerPortalUserPasswordRequest;
      const response = await resetDealerPortalUserPassword(actor, portalUserId, body);
      return jsonResponse(res, 200, response);
    }

    const userMatch = pathname.match(/^\/api\/v1\/dealer-portal\/users\/([^/]+)$/);
    if (userMatch) {
      const portalUserId = userMatch[1];
      if (!portalUserId) {
        return badRequestResponse(res, 'Dealer portal user id is required');
      }
      if (method !== 'PATCH') {
        return methodNotAllowedResponse(res, method, ['PATCH']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
        action: 'lead.portal_setup',
      });
      const body = (await readJsonBody(req)) as UpdateDealerPortalUserStatusRequest;
      const response = await updateDealerPortalUserStatus(actor, portalUserId, body);
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
    const normalized = message.toLowerCase();
    if (normalized.includes('not found')) {
      return notFoundResponse(res, { detail: message });
    }

    return badRequestResponse(res, message);
  }

  return false;
}

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  AcceptDealerPortalInviteRequest,
  DealerPortalAccessRoleKey,
  ProvisionDealerPortalUserRequest,
  ResetDealerPortalUserPasswordRequest,
  UpdateDealerPortalUserStatusRequest,
} from '@pulse/contracts';
import { DEALER_PORTAL_ACCESS_ROLES } from '@pulse/contracts';
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
  acceptDealerPortalInvite,
  createDealerPortalInvite,
  favoriteCurrentDealerPortalProduct,
  getCurrentDealerPortalCatalog,
  getCurrentDealerPortalDashboard,
  getDealerPortalAccount,
  getDealerPortalInternalPreview,
  provisionDealerPortalUser,
  recordCurrentDealerPortalAssetOpen,
  resetDealerPortalUserPassword,
  unfavoriteCurrentDealerPortalProduct,
  updateDealerPortalUserStatus,
} from './service.js';

export async function handleDealerPortalRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isDealerPortalRoute =
    /^\/api\/v1\/dealer-portal\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/internal-preview\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/accounts\/[^/]+\/internal-preview$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/accounts\/[^/]+\/users$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/users\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/users\/[^/]+\/invite$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/users\/[^/]+\/reset-password$/.test(pathname)
    || pathname === '/api/v1/dealer-portal/invites/accept'
    || pathname === '/api/v1/dealer-portal/me/catalog'
    || pathname === '/api/v1/dealer-portal/me/dashboard'
    || /^\/api\/v1\/dealer-portal\/me\/favorites\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/dealer-portal\/me\/assets\/[^/]+\/open$/.test(pathname);

  if (!isDealerPortalRoute) {
    return false;
  }

  try {
    const dealerDashboardMatch = pathname === '/api/v1/dealer-portal/me/dashboard';
    const dealerCatalogMatch = pathname === '/api/v1/dealer-portal/me/catalog';
    if (pathname === '/api/v1/dealer-portal/invites/accept') {
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const body = (await readJsonBody(req)) as AcceptDealerPortalInviteRequest;
      const response = await acceptDealerPortalInvite(body);
      return jsonResponse(res, 200, response);
    }

    if (dealerCatalogMatch) {
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
      });
      const response = await getCurrentDealerPortalCatalog(actor);
      return jsonResponse(res, 200, response);
    }

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

    const favoriteMatch = pathname.match(/^\/api\/v1\/dealer-portal\/me\/favorites\/([^/]+)$/);
    if (favoriteMatch) {
      const presentationId = favoriteMatch[1];
      if (!presentationId) {
        return badRequestResponse(res, 'Product presentation id is required');
      }
      if (method !== 'POST' && method !== 'DELETE') {
        return methodNotAllowedResponse(res, method, ['POST', 'DELETE']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
      });
      const response = method === 'POST'
        ? await favoriteCurrentDealerPortalProduct(actor, decodeURIComponent(presentationId))
        : await unfavoriteCurrentDealerPortalProduct(actor, decodeURIComponent(presentationId));
      return jsonResponse(res, 200, response);
    }

    const assetOpenMatch = pathname.match(/^\/api\/v1\/dealer-portal\/me\/assets\/([^/]+)\/open$/);
    if (assetOpenMatch) {
      const assetId = assetOpenMatch[1];
      if (!assetId) {
        return badRequestResponse(res, 'Asset id is required');
      }
      if (method !== 'POST') {
        return methodNotAllowedResponse(res, method, ['POST']);
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
      });
      const response = await recordCurrentDealerPortalAssetOpen(actor, decodeURIComponent(assetId));
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

    const internalPreviewMatch = pathname.match(/^\/api\/v1\/dealer-portal\/internal-preview\/accounts\/([^/]+)$/)
      ?? pathname.match(/^\/api\/v1\/dealer-portal\/accounts\/([^/]+)\/internal-preview$/);
    if (internalPreviewMatch) {
      const accountId = internalPreviewMatch[1];
      if (!accountId) {
        return badRequestResponse(res, 'Account id is required');
      }
      if (method !== 'GET') {
        return methodNotAllowedResponse(res, method, ['GET']);
      }

      const role = normalizePreviewRole(url.searchParams.get('role'));
      if (!role) {
        return badRequestResponse(res, 'Preview role must be one of: admin, purchasing, accounting, viewer');
      }

      const actor = await requireAuthenticatedActor(req, {
        module: 'dealer_portal',
        action: 'lead.portal_setup',
      });
      const response = await getDealerPortalInternalPreview(actor, accountId, role);
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

    const inviteMatch = pathname.match(/^\/api\/v1\/dealer-portal\/users\/([^/]+)\/invite$/);
    if (inviteMatch) {
      const portalUserId = inviteMatch[1];
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
      const response = await createDealerPortalInvite(actor, portalUserId);
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
    if (isAuthenticationError(error)) {
      return unauthorizedResponse(res, error.message);
    }

    if (isAuthorizationError(error)) {
      return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
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

function normalizePreviewRole(value: string | null): DealerPortalAccessRoleKey | null {
  const role = (value ?? 'viewer').trim().toLowerCase();
  return DEALER_PORTAL_ACCESS_ROLES.includes(role as DealerPortalAccessRoleKey)
    ? role as DealerPortalAccessRoleKey
    : null;
}

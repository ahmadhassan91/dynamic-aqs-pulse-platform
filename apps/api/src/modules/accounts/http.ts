import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CreateAccountRequest,
  CreateAccountLocationRequest,
  CreateContactRequest,
  ListAccountsRequest,
  UpdateAccountLifecycleRequest,
  UpdateAccountLocationRequest,
  UpdateAccountRequest,
  UpdateContactRequest,
} from '@pulse/contracts/accounts';
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
  createAccount,
  createAccountLocation,
  createAccountContact,
  getAccountDetail,
  listAccountLocations,
  listAccountContacts,
  listAccounts,
  updateAccount,
  updateAccountLifecycle,
  updateAccountContact,
  updateAccountLocation,
} from './service.js';

export async function handleAccountRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const pathname = url.pathname;
  const method = req.method ?? 'GET';
  const isAccountRoute =
    pathname === '/api/v1/accounts'
    || /^\/api\/v1\/accounts\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/accounts\/[^/]+\/lifecycle$/.test(pathname)
    || /^\/api\/v1\/accounts\/[^/]+\/locations$/.test(pathname)
    || /^\/api\/v1\/accounts\/[^/]+\/locations\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/accounts\/[^/]+\/contacts$/.test(pathname)
    || /^\/api\/v1\/accounts\/[^/]+\/contacts\/[^/]+$/.test(pathname);

  if (!isAccountRoute) {
    return false;
  }

  try {
    if (pathname === '/api/v1/accounts') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.view',
        });
        const query: ListAccountsRequest = {};
        const search = url.searchParams.get('search')?.trim();
        const limit = parseInteger(url.searchParams.get('limit'));
        const includeInactive = parseBoolean(url.searchParams.get('includeInactive'));
        const lifecycleStatus = url.searchParams.get('lifecycleStatus')?.trim();

        if (search) {
          query.search = search;
        }
        if (limit !== undefined) {
          query.limit = limit;
        }
        if (includeInactive !== undefined) {
          query.includeInactive = includeInactive;
        }
        if (lifecycleStatus) {
          query.lifecycleStatus = lifecycleStatus as NonNullable<ListAccountsRequest['lifecycleStatus']>;
        }

        const response = await listAccounts(actor, query);
        return jsonResponse(res, 200, response);
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.create',
        });
        const body = (await readJsonBody(req)) as CreateAccountRequest;
        const response = await createAccount(actor, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const accountMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)$/);
    if (accountMatch) {
      const accountId = accountMatch[1];
      if (!accountId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.view',
        });
        const response = await getAccountDetail(actor, accountId);
        if (!response) {
          return notFoundResponse(res, { entity: 'Account', id: accountId });
        }

        return jsonResponse(res, 200, response);
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.edit',
        });
        const body = (await readJsonBody(req)) as UpdateAccountRequest;
        const response = await updateAccount(actor, accountId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
    }

    const contactsMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/contacts$/);
    if (contactsMatch) {
      const accountId = contactsMatch[1];
      if (!accountId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'contact.view',
        });
        const response = await listAccountContacts(actor, accountId);
        if (!response) {
          return notFoundResponse(res, { entity: 'Account', id: accountId });
        }

        return jsonResponse(res, 200, { items: response });
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'contact.create',
        });
        const body = (await readJsonBody(req)) as CreateContactRequest;
        const response = await createAccountContact(actor, accountId, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const contactDetailMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/contacts\/([^/]+)$/);
    if (contactDetailMatch) {
      const accountId = contactDetailMatch[1];
      const contactId = contactDetailMatch[2];
      if (!accountId || !contactId) {
        return false;
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.edit',
        });
        const body = (await readJsonBody(req)) as UpdateContactRequest;
        const response = await updateAccountContact(actor, accountId, contactId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    const lifecycleMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/lifecycle$/);
    if (lifecycleMatch) {
      const accountId = lifecycleMatch[1];
      if (!accountId) {
        return false;
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.edit',
        });
        const body = (await readJsonBody(req)) as UpdateAccountLifecycleRequest;
        const response = await updateAccountLifecycle(actor, accountId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['PATCH']);
    }

    const locationsMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/locations$/);
    if (locationsMatch) {
      const accountId = locationsMatch[1];
      if (!accountId) {
        return false;
      }

      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.view',
        });
        const response = await listAccountLocations(actor, accountId);
        if (!response) {
          return notFoundResponse(res, { entity: 'Account', id: accountId });
        }

        return jsonResponse(res, 200, { items: response });
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'location.create',
        });
        const body = (await readJsonBody(req)) as CreateAccountLocationRequest;
        const response = await createAccountLocation(actor, accountId, body);
        return jsonResponse(res, 201, response);
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const locationDetailMatch = pathname.match(/^\/api\/v1\/accounts\/([^/]+)\/locations\/([^/]+)$/);
    if (locationDetailMatch) {
      const accountId = locationDetailMatch[1];
      const locationId = locationDetailMatch[2];
      if (!accountId || !locationId) {
        return false;
      }

      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, {
          module: 'customers',
          action: 'customer.edit',
        });
        const body = (await readJsonBody(req)) as UpdateAccountLocationRequest;
        const response = await updateAccountLocation(actor, accountId, locationId, body);
        return jsonResponse(res, 200, response);
      }

      return methodNotAllowedResponse(res, method, ['PATCH']);
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

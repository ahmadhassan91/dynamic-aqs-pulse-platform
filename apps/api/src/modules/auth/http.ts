import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  methodNotAllowedResponse,
  serviceUnavailableResponse,
  unauthorizedResponse,
  readJsonBody,
} from '../../utils/http.js';
import type { AppConfig } from '../../config.js';
import {
  completeMicrosoftEntraLogin,
  getCurrentSession,
  loginWithPassword,
  logoutCurrentSession,
  MicrosoftEntraAuthUnavailableError,
  readBearerToken,
  refreshSession,
  startMicrosoftEntraLogin,
} from './service.js';
import type {
  AuthRequestContext,
  CompleteMicrosoftEntraLoginRequest,
  LoginRequest,
  LogoutRequest,
  RefreshSessionRequest,
  StartMicrosoftEntraLoginRequest,
} from './types.js';

export async function handleAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  config: AppConfig,
) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;

  if (pathname === '/api/v1/auth/login') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as LoginRequest;
      const response = await loginWithPassword(config, body, buildRequestContext(req));
      return jsonResponse(res, 200, response);
    } catch (error) {
      return unauthorizedResponse(res, error instanceof Error ? error.message : String(error));
    }
  }

  if (pathname === '/api/v1/auth/refresh') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as RefreshSessionRequest;
      const response = await refreshSession(config, body, buildRequestContext(req));
      return jsonResponse(res, 200, response);
    } catch (error) {
      return unauthorizedResponse(res, error instanceof Error ? error.message : String(error));
    }
  }

  if (pathname === '/api/v1/auth/entra/start') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as StartMicrosoftEntraLoginRequest;
      const response = await startMicrosoftEntraLogin(config, body?.nextPath);
      return jsonResponse(res, 200, response);
    } catch (error) {
      if (error instanceof MicrosoftEntraAuthUnavailableError) {
        return serviceUnavailableResponse(res, error.message);
      }
      return badRequestResponse(res, error instanceof Error ? error.message : String(error));
    }
  }

  if (pathname === '/api/v1/auth/entra/complete') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    try {
      const body = (await readJsonBody(req)) as CompleteMicrosoftEntraLoginRequest;
      const response = await completeMicrosoftEntraLogin(config, body, buildRequestContext(req));
      return jsonResponse(res, 200, response);
    } catch (error) {
      if (error instanceof MicrosoftEntraAuthUnavailableError) {
        return serviceUnavailableResponse(res, error.message);
      }

      const message = error instanceof Error ? error.message : String(error);
      if (/missing .*authorization code|missing .*state/i.test(message)) {
        return badRequestResponse(res, message);
      }
      if (/not allowed to access the internal pulse workspace|no approved pulse role/i.test(message)) {
        return forbiddenResponse(res, message);
      }
      return unauthorizedResponse(res, message);
    }
  }

  if (pathname === '/api/v1/auth/me') {
    if (method !== 'GET') {
      return methodNotAllowedResponse(res, method, ['GET']);
    }

    const accessToken = readBearerToken(readHeader(req, 'authorization'));
    if (!accessToken) {
      return unauthorizedResponse(res, 'Missing bearer token');
    }

    try {
      const response = await getCurrentSession(accessToken);
      if (!response) {
        return unauthorizedResponse(res, 'Invalid session');
      }

      return jsonResponse(res, 200, response);
    } catch (error) {
      return unauthorizedResponse(res, error instanceof Error ? error.message : String(error));
    }
  }

  if (pathname === '/api/v1/auth/logout') {
    if (method !== 'POST') {
      return methodNotAllowedResponse(res, method, ['POST']);
    }

    const accessToken = readBearerToken(readHeader(req, 'authorization'));
    if (!accessToken) {
      return unauthorizedResponse(res, 'Missing bearer token');
    }

    try {
      const body = (await readJsonBody(req)) as LogoutRequest;
      if (body.refreshToken) {
        return badRequestResponse(res, 'Logout currently uses bearer access token only');
      }

      const response = await logoutCurrentSession(accessToken, buildRequestContext(req));
      if (!response) {
        return unauthorizedResponse(res, 'Invalid session');
      }

      return jsonResponse(res, 200, response);
    } catch (error) {
      return unauthorizedResponse(res, error instanceof Error ? error.message : String(error));
    }
  }

  return false;
}

function buildRequestContext(req: IncomingMessage): AuthRequestContext {
  return {
    ipAddress: getClientIp(req),
    userAgent: readHeader(req, 'user-agent'),
    requestId: readHeader(req, 'x-request-id'),
    correlationId: readHeader(req, 'x-correlation-id'),
  };
}

function readHeader(req: IncomingMessage, name: string) {
  const headerValue = req.headers[name];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

function getClientIp(req: IncomingMessage) {
  const forwardedFor = readHeader(req, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return req.socket.remoteAddress ?? undefined;
}

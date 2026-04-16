import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import { AuditAction, prisma } from '@pulse/db';
import type { WorkspaceActionKey, WorkspaceModuleKey } from '@pulse/contracts';
import type { IncomingMessage } from 'node:http';
import { buildAuditEntryData } from '../../utils/audit.js';
import { authenticateAccessToken, readBearerToken } from './service.js';
import type { AuthenticatedActor } from './types.js';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError
    || (error instanceof Error && error.name === 'AuthenticationError');
}

export function isAuthorizationError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AuthorizationError';
}

export async function requireAuthenticatedActor(
  req: IncomingMessage,
  permission?: {
    module?: WorkspaceModuleKey | undefined;
    action?: WorkspaceActionKey | undefined;
  },
): Promise<AuthenticatedActor> {
  const accessToken = readBearerToken(readHeader(req, 'authorization'));
  if (!accessToken) {
    throw new AuthenticationError('Missing bearer token');
  }

  const actor = await authenticateAccessToken(accessToken);
  if (!actor) {
    throw new AuthenticationError('Invalid session');
  }

  try {
    if (permission?.module) {
      assertModuleAccess(actor.role, permission.module);
    }
    if (permission?.action) {
      assertActionAccess(actor.role, permission.action);
    }
  } catch (error) {
    if (isAuthorizationError(error)) {
      await auditAuthorizationDenied(req, actor, permission, error instanceof Error ? error.message : 'Access denied');
    }
    throw error;
  }

  return actor;
}

function readHeader(req: IncomingMessage, name: string) {
  const headerValue = req.headers[name];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

async function auditAuthorizationDenied(
  req: IncomingMessage,
  actor: AuthenticatedActor,
  permission: {
    module?: WorkspaceModuleKey | undefined;
    action?: WorkspaceActionKey | undefined;
  } | undefined,
  message: string,
) {
  try {
    await prisma.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.REJECT,
        entityType: 'AUTHORIZATION_ATTEMPT',
        entityId: normalizePath(req.url),
        metadata: {
          operation: 'api_authorization',
          result: 'access_denied',
          actorRole: actor.role,
          actorType: actor.actorType,
          sessionId: actor.sessionId,
          module: permission?.module,
          actionKey: permission?.action,
          method: req.method ?? 'GET',
          path: normalizePath(req.url),
          userAgent: readHeader(req, 'user-agent'),
          ipAddress: readIpAddress(req),
          message,
        },
      }),
    });
  } catch {
    // Access denials should never crash the route if the audit trail itself fails.
  }
}

function normalizePath(url: string | undefined) {
  if (!url) {
    return 'unknown';
  }

  const [pathname] = url.split('?');
  return pathname || 'unknown';
}

function readIpAddress(req: IncomingMessage) {
  const forwardedFor = readHeader(req, 'x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim();
  }

  return req.socket.remoteAddress;
}

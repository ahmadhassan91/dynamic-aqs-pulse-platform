import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import type { WorkspaceActionKey, WorkspaceModuleKey } from '@pulse/contracts';
import type { IncomingMessage } from 'node:http';
import { authenticateAccessToken, readBearerToken } from './service.js';
import type { AuthenticatedActor } from './types.js';

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
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

  if (permission?.module) {
    assertModuleAccess(actor.role, permission.module);
  }
  if (permission?.action) {
    assertActionAccess(actor.role, permission.action);
  }

  return actor;
}

function readHeader(req: IncomingMessage, name: string) {
  const headerValue = req.headers[name];
  return Array.isArray(headerValue) ? headerValue[0] : headerValue;
}

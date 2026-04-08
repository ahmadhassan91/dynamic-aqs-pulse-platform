import type { AuthSession, TokenPair } from '@pulse/contracts';

export interface SessionEnvelope {
  session: AuthSession;
  tokens: TokenPair;
}

export function isSessionExpired(session: AuthSession, at = new Date()): boolean {
  return new Date(session.expiresAt).getTime() <= at.getTime();
}

export function isRefreshExpired(session: AuthSession, at = new Date()): boolean {
  if (!session.refreshExpiresAt) {
    return false;
  }

  return new Date(session.refreshExpiresAt).getTime() <= at.getTime();
}

export function buildSessionEnvelope(session: AuthSession, tokens: TokenPair): SessionEnvelope {
  return { session, tokens };
}

export function isSessionActive(session: AuthSession, at = new Date()): boolean {
  return !isSessionExpired(session, at);
}


import type {
  AuthIdentity,
  AuthSession,
  LoginRequest,
  RefreshSessionRequest,
  TokenPair,
} from '@pulse/contracts';

export type AuthResponse = {
  identity: AuthIdentity;
  session: AuthSession;
  tokens: TokenPair;
};

export type AuthRequestContext = {
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  correlationId?: string | undefined;
};

export type LogoutRequest = {
  refreshToken?: string | undefined;
};

export type { LoginRequest, RefreshSessionRequest };

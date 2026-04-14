'use client';

import type { FormEvent, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthIdentity, AuthRole, AuthSession, TokenPair } from '@pulse/contracts';
import { fetchCurrentSession, loginToPulse, logoutFromPulse, refreshPulseSession } from '@/lib/pulse-api';

const SETTINGS_STORAGE_KEY = 'pulse.crm-web.settings';
const SESSION_STORAGE_KEY = 'pulse.crm-web.session';
const PERSISTED_SESSION_STORAGE_KEY = 'pulse.crm-web.persistent-session';
const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_PULSE_API_BASE_URL ?? 'http://localhost:4000';

type AuthBundle = {
  identity: AuthIdentity;
  session: AuthSession;
  tokens: TokenPair;
};

type StoredSession = {
  version: 1;
  tokens: TokenPair;
};

type PulseSessionContextValue = {
  apiBaseUrl: string;
  auth: AuthBundle | null;
  authError: string | null;
  email: string;
  isHydrated: boolean;
  isLoggingIn: boolean;
  password: string;
  rememberMe: boolean;
  login: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  loginWithCredentials: (input: {
    email: string;
    password: string;
    rememberMe?: boolean;
    expectedRole?: AuthRole;
    roleErrorMessage?: string;
  }) => Promise<AuthBundle>;
  logout: () => Promise<void>;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRememberMe: (value: boolean) => void;
};

const PulseSessionContext = createContext<PulseSessionContextValue | null>(null);

export function PulseSessionProvider({ children }: { children: ReactNode }) {
  const apiBaseUrl = DEFAULT_API_BASE_URL;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [auth, setAuth] = useState<AuthBundle | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    async function hydrateSession() {
      const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        try {
          const parsed = JSON.parse(storedSettings) as Partial<{ email: string; rememberMe: boolean }>;
          if (parsed.email) {
            setEmail(parsed.email);
          }
          if (typeof parsed.rememberMe === 'boolean') {
            setRememberMe(parsed.rememberMe);
          }
        } catch {
          // Ignore invalid settings.
        }
      }

      const storedSession = readStoredSession(window);
      if (storedSession) {
        try {
          const restoredAuth = await restoreAuthBundle(apiBaseUrl, storedSession.tokens);
          if (!cancelled) {
            setAuth(restoredAuth);
            setAuthError(null);
          }
        } catch {
          clearStoredSession(window);
          if (!cancelled) {
            setAuth(null);
            setAuthError('Your previous Pulse session expired. Please sign in again.');
          }
        }
      }

      if (!cancelled) {
        setIsHydrated(true);
      }
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        email,
        rememberMe,
      }),
    );
  }, [email, isHydrated, rememberMe]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }

    if (!auth) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(PERSISTED_SESSION_STORAGE_KEY);
      return;
    }

    const storedSession = toStoredSession(auth.tokens);

    if (rememberMe) {
      window.localStorage.setItem(PERSISTED_SESSION_STORAGE_KEY, JSON.stringify(storedSession));
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(storedSession));
    window.localStorage.removeItem(PERSISTED_SESSION_STORAGE_KEY);
  }, [auth, isHydrated, rememberMe]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const accessTokenExpiresAt = auth?.tokens.accessTokenExpiresAt;
    const refreshToken = auth?.tokens.refreshToken;

    if (!accessTokenExpiresAt || !refreshToken) {
      return;
    }

    const validatedRefreshToken = refreshToken;

    let cancelled = false;
    let timerId: number | undefined;

    async function refreshActiveSession() {
      try {
        const refreshed = await refreshPulseSession(apiBaseUrl, validatedRefreshToken);
        if (!cancelled) {
          setAuth(refreshed);
          setAuthError(null);
        }
      } catch {
        clearStoredSession(window);
        if (!cancelled) {
          setAuth(null);
          setAuthError('Your Pulse session expired. Please sign in again.');
        }
      }
    }

    const refreshDelay = getRefreshDelay(accessTokenExpiresAt);
    if (refreshDelay <= 0) {
      void refreshActiveSession();
    } else {
      timerId = window.setTimeout(() => {
        void refreshActiveSession();
      }, refreshDelay);
    }

    return () => {
      cancelled = true;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [apiBaseUrl, auth?.tokens.accessTokenExpiresAt, auth?.tokens.refreshToken]);

  const loginWithCredentials = useCallback(async (input: {
    email: string;
    password: string;
    rememberMe?: boolean;
    expectedRole?: AuthRole;
    roleErrorMessage?: string;
  }) => {
    const response = await loginToPulse(apiBaseUrl, {
      email: input.email,
      password: input.password,
    });

    if (input.expectedRole && response.identity.role !== input.expectedRole) {
      try {
        await logoutFromPulse(apiBaseUrl, response.tokens.accessToken);
      } catch {
        // Ignore logout failures when rejecting a mismatched role sign-in.
      }

      throw new Error(
        input.roleErrorMessage
        ?? `This account does not have access to the ${input.expectedRole.toLowerCase()} workspace.`,
      );
    }

    setRememberMe(Boolean(input.rememberMe));
    setAuth(response);
    setAuthError(null);
    setEmail(input.email);
    setPassword('');

    return response;
  }, [apiBaseUrl]);

  const login = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);

    try {
      await loginWithCredentials({
        email,
        password,
        rememberMe,
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoggingIn(false);
    }
  }, [email, loginWithCredentials, password, rememberMe]);

  const logout = useCallback(async () => {
    if (auth) {
      try {
        await logoutFromPulse(apiBaseUrl, auth.tokens.accessToken);
      } catch {
        // Clear local state even if API-side logout fails.
      }
    }

    setAuth(null);
    setPassword('');
    setAuthError(null);
  }, [apiBaseUrl, auth]);

  const value = useMemo<PulseSessionContextValue>(
    () => ({
      apiBaseUrl,
      auth,
      authError,
      email,
      isHydrated,
      isLoggingIn,
      loginWithCredentials,
      password,
      rememberMe,
      login,
      logout,
      setEmail,
      setPassword,
      setRememberMe,
    }),
    [apiBaseUrl, auth, authError, email, isHydrated, isLoggingIn, login, loginWithCredentials, logout, password, rememberMe],
  );

  return <PulseSessionContext.Provider value={value}>{children}</PulseSessionContext.Provider>;
}

export function usePulseSession() {
  const context = useContext(PulseSessionContext);
  if (!context) {
    throw new Error('usePulseSession must be used within PulseSessionProvider');
  }

  return context;
}

function toStoredSession(tokens: TokenPair): StoredSession {
  return {
    version: 1,
    tokens,
  };
}

function readStoredSession(storageWindow: Window): StoredSession | null {
  const rawStoredSession = storageWindow.localStorage.getItem(PERSISTED_SESSION_STORAGE_KEY)
    ?? storageWindow.sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawStoredSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawStoredSession) as Partial<StoredSession & AuthBundle>;
    if (parsed.tokens?.accessToken && parsed.tokens.refreshToken) {
      return toStoredSession(parsed.tokens);
    }
  } catch {
    // Ignore invalid session data.
  }

  return null;
}

function clearStoredSession(storageWindow: Window) {
  storageWindow.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  storageWindow.localStorage.removeItem(PERSISTED_SESSION_STORAGE_KEY);
}

async function restoreAuthBundle(apiBaseUrl: string, tokens: TokenPair): Promise<AuthBundle> {
  try {
    const currentSession = await fetchCurrentSession(apiBaseUrl, tokens.accessToken);
    if (currentSession) {
      return {
        identity: currentSession.identity,
        session: currentSession.session,
        tokens,
      };
    }
  } catch {
    // Fall through to refresh when the access token is no longer accepted.
  }

  return refreshPulseSession(apiBaseUrl, tokens.refreshToken);
}

function getRefreshDelay(accessTokenExpiresAt: string) {
  const expiresAt = Date.parse(accessTokenExpiresAt);
  if (Number.isNaN(expiresAt)) {
    return 0;
  }

  return Math.max(expiresAt - Date.now() - 60_000, 0);
}

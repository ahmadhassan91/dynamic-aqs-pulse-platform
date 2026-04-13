'use client';

import type { FormEvent, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthIdentity, AuthSession, TokenPair } from '@pulse/contracts';
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
  loginWithCredentials: (input: { email: string; password: string; rememberMe?: boolean }) => Promise<AuthBundle>;
  logout: () => Promise<void>;
  setApiBaseUrl: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRememberMe: (value: boolean) => void;
};

const PulseSessionContext = createContext<PulseSessionContextValue | null>(null);

export function PulseSessionProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [email, setEmail] = useState('admin@pulse.local');
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

    const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Partial<{ apiBaseUrl: string; email: string; rememberMe: boolean }>;
        if (parsed.apiBaseUrl) {
          setApiBaseUrl(parsed.apiBaseUrl);
        }
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

    const storedSession = window.localStorage.getItem(PERSISTED_SESSION_STORAGE_KEY)
      ?? window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as AuthBundle;
        if (parsed?.tokens?.accessToken) {
          setAuth(parsed);
        }
      } catch {
        // Ignore invalid session data.
      }
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        apiBaseUrl,
        email,
        rememberMe,
      }),
    );
  }, [apiBaseUrl, email, isHydrated, rememberMe]);

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') {
      return;
    }

    if (!auth) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(PERSISTED_SESSION_STORAGE_KEY);
      return;
    }

    if (rememberMe) {
      window.localStorage.setItem(PERSISTED_SESSION_STORAGE_KEY, JSON.stringify(auth));
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth));
    window.localStorage.removeItem(PERSISTED_SESSION_STORAGE_KEY);
  }, [auth, isHydrated, rememberMe]);

  useEffect(() => {
    const accessToken = auth?.tokens.accessToken;
    const refreshToken = auth?.tokens.refreshToken;

    if (!accessToken || !refreshToken) {
      return;
    }

    const validatedAccessToken = accessToken;
    const validatedRefreshToken = refreshToken;

    let cancelled = false;

    async function validateSession() {
      try {
        const response = await fetchCurrentSession(apiBaseUrl, validatedAccessToken);
        if (!cancelled && response) {
          setAuth((current) =>
            current
              ? {
                  ...current,
                  identity: response.identity,
                  session: response.session,
                }
              : current,
          );
          setAuthError(null);
        }
      } catch {
        try {
          const refreshed = await refreshPulseSession(apiBaseUrl, validatedRefreshToken);
          if (!cancelled) {
            setAuth(refreshed);
            setAuthError(null);
          }
        } catch {
          if (!cancelled) {
            setAuth(null);
          }
        }
      }
    }

    void validateSession();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth?.tokens.accessToken, auth?.tokens.refreshToken]);

  const loginWithCredentials = useCallback(async (input: { email: string; password: string; rememberMe?: boolean }) => {
    const response = await loginToPulse(apiBaseUrl, {
      email: input.email,
      password: input.password,
      ...(input.rememberMe !== undefined ? { rememberMe: input.rememberMe } : {}),
    });

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
    setRememberMe(false);
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
      setApiBaseUrl,
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

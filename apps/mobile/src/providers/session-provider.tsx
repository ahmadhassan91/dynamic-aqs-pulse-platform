import type { ReactNode } from 'react';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { LoginRequest } from '@pulse/contracts/auth';
import { defaultApiBaseUrl, fetchCurrentSession, loginToPulse, normalizeApiBaseUrl, refreshPulseSession, type AuthBundle } from '@/lib/api';
import { clearStoredSession, loadStoredSession, saveStoredSession } from '@/lib/session-store';

type SessionContextValue = {
  apiBaseUrl: string;
  setApiBaseUrl: (value: string) => void;
  auth: AuthBundle | null;
  isHydrated: boolean;
  isSigningIn: boolean;
  errorMessage: string | null;
  signIn: (input: LoginRequest) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [apiBaseUrl, setApiBaseUrlState] = useState(defaultApiBaseUrl);
  const [auth, setAuth] = useState<AuthBundle | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    void loadStoredSession()
      .then((stored) => {
        if (!isMounted) return;
        if (stored?.apiBaseUrl) setApiBaseUrlState(stored.apiBaseUrl);
        setAuth(stored?.auth ?? null);
      })
      .finally(() => {
        if (isMounted) setIsHydrated(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setApiBaseUrl = useCallback((value: string) => {
    try {
      setApiBaseUrlState(normalizeApiBaseUrl(value));
      setErrorMessage(null);
    } catch (error) {
      setApiBaseUrlState(value.trim() || defaultApiBaseUrl);
      setErrorMessage(error instanceof Error ? error.message : 'Invalid API URL.');
    }
  }, []);

  const signIn = useCallback(
    async (input: LoginRequest) => {
      setIsSigningIn(true);
      setErrorMessage(null);
      try {
        const bundle = await loginToPulse(apiBaseUrl, input);
        setAuth(bundle);
        await saveStoredSession({ apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl), auth: bundle });
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Unable to sign in.');
        throw error;
      } finally {
        setIsSigningIn(false);
      }
    },
    [apiBaseUrl],
  );

  const signOut = useCallback(async () => {
    setAuth(null);
    setErrorMessage(null);
    await clearStoredSession();
  }, []);

  const refresh = useCallback(async () => {
    if (!auth) return;
    try {
      const current = await fetchCurrentSession(apiBaseUrl, auth.tokens.accessToken);
      const refreshed = { ...auth, identity: current.identity, session: current.session };
      setAuth(refreshed);
      await saveStoredSession({ apiBaseUrl, auth: refreshed });
    } catch {
      try {
        const refreshed = await refreshPulseSession(apiBaseUrl, auth.tokens.refreshToken);
        setAuth(refreshed);
        await saveStoredSession({ apiBaseUrl, auth: refreshed });
      } catch {
        await signOut();
      }
    }
  }, [apiBaseUrl, auth, signOut]);

  const value = useMemo<SessionContextValue>(
    () => ({
      apiBaseUrl,
      setApiBaseUrl,
      auth,
      isHydrated,
      isSigningIn,
      errorMessage,
      signIn,
      signOut,
      refresh,
    }),
    [apiBaseUrl, auth, errorMessage, isHydrated, isSigningIn, refresh, setApiBaseUrl, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = React.use(SessionContext);
  if (!value) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return value;
}

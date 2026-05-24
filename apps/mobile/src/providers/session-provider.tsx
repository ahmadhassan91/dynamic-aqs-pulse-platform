import type { ReactNode } from 'react';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { LoginRequest } from '@pulse/contracts/auth';
import { defaultApiBaseUrl, fetchCurrentSession, loginToPulse, normalizeApiBaseUrl, refreshPulseSession, type AuthBundle } from '@/lib/api';
import { hydrateMobileDraftStorage } from '@/lib/mobile-draft-queue';
import { isMobileAuthAllowed, resolveStoredSession } from '@/lib/session-lifecycle';
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
    void hydrateMobileDraftStorage();
    void loadStoredSession()
      .then((stored) => resolveStoredSession(stored, { fetchCurrentSession, refreshPulseSession }))
      .then(async (resolution) => {
        if (!isMounted) return;
        if (resolution.apiBaseUrl) setApiBaseUrlState(resolution.apiBaseUrl);
        setAuth(resolution.auth);
        if (resolution.errorMessage) setErrorMessage(resolution.errorMessage);
        if (resolution.shouldClearStoredSession) {
          await clearStoredSession();
        } else if (resolution.shouldSaveStoredSession && resolution.auth) {
          await saveStoredSession({
            apiBaseUrl: normalizeApiBaseUrl(resolution.apiBaseUrl ?? defaultApiBaseUrl),
            auth: resolution.auth,
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsHydrated(true);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setApiBaseUrl = useCallback((value: string) => {
    setApiBaseUrlState(value);
    setErrorMessage(null);
  }, []);

  const signIn = useCallback(
    async (input: LoginRequest) => {
      setIsSigningIn(true);
      setErrorMessage(null);
      try {
        const bundle = await loginToPulse(apiBaseUrl, input);
        if (!isMobileAuthAllowed(bundle)) {
          throw new Error('This Pulse account is not enabled for the mobile field app.');
        }
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
    const resolution = await resolveStoredSession({ apiBaseUrl, auth }, { fetchCurrentSession, refreshPulseSession });
    setAuth(resolution.auth);
    if (resolution.errorMessage) setErrorMessage(resolution.errorMessage);
    if (resolution.shouldClearStoredSession) {
      await signOut();
    } else if (resolution.shouldSaveStoredSession && resolution.auth) {
      await saveStoredSession({ apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl), auth: resolution.auth });
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

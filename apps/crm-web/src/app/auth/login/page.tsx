'use client';

import { useEffect, useState } from 'react';
import { Center, Container } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { Logo } from '@/components/ui/Logo';
import { getDefaultWorkspacePath } from '@/lib/access';
import { startMicrosoftEntraLogin } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const router = useRouter();
  const { apiBaseUrl, auth, authError, email, loginWithCredentials, rememberMe } = usePulseSession();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const candidate = new URLSearchParams(window.location.search).get('next');
    const authErrorMessage = new URLSearchParams(window.location.search).get('error');
    setNextPath(candidate);
    if (authErrorMessage) {
      setError(authErrorMessage);
    }
  }, []);

  useEffect(() => {
    if (auth) {
      router.replace(nextPath ?? getDefaultWorkspacePath(auth.identity.role));
    }
  }, [auth, nextPath, router]);

  return (
    <Container size={420} my={40}>
      <Center mb="xl">
        <Logo />
      </Center>
      <LoginForm
        initialEmail={email}
        initialRememberMe={rememberMe}
        loading={loading}
        microsoftLoading={microsoftLoading}
        error={error ?? authError}
        onSubmit={async (values) => {
          setLoading(true);
          setError(null);

          try {
            const response = await loginWithCredentials(values);
            router.replace(nextPath ?? getDefaultWorkspacePath(response.identity.role));
          } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : String(loginError));
          } finally {
            setLoading(false);
          }
        }}
        onMicrosoftSignIn={async (values) => {
          if (typeof window === 'undefined') {
            return;
          }

          setMicrosoftLoading(true);
          setError(null);

          try {
            window.sessionStorage.setItem(
              'pulse.crm-web.entra-login',
              JSON.stringify({
                rememberMe: values.rememberMe,
              }),
            );

            const response = await startMicrosoftEntraLogin(apiBaseUrl, {
              ...(nextPath ? { nextPath } : {}),
            });
            window.location.assign(response.authorizationUrl);
          } catch (loginError) {
            window.sessionStorage.removeItem('pulse.crm-web.entra-login');
            setError(loginError instanceof Error ? loginError.message : String(loginError));
            setMicrosoftLoading(false);
          }
        }}
      />
    </Container>
  );
}

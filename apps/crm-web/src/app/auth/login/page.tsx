'use client';

import { useEffect, useState } from 'react';
import { Center, Container } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { Logo } from '@/components/ui/Logo';
import { getDefaultWorkspacePath } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const router = useRouter();
  const { auth, email, loginWithCredentials, rememberMe } = usePulseSession();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const candidate = new URLSearchParams(window.location.search).get('next');
    setNextPath(candidate);
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
        error={error}
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
      />
    </Container>
  );
}

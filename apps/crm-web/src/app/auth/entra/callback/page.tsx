'use client';

import { Suspense, useEffect, useState } from 'react';
import { Alert, Container, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { completeMicrosoftEntraLogin } from '@/lib/pulse-api';
import { getDefaultWorkspacePath } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

const PENDING_ENTRA_LOGIN_STORAGE_KEY = 'pulse.crm-web.entra-login';

export default function MicrosoftEntraCallbackPage() {
  return (
    <Suspense fallback={<CallbackStatusCard />}>
      <MicrosoftEntraCallbackContent />
    </Suspense>
  );
}

function MicrosoftEntraCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { apiBaseUrl, acceptAuthBundle } = usePulseSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let cancelled = false;

    async function finalizeLogin() {
      const providerError = searchParams.get('error');
      const providerErrorDescription = searchParams.get('error_description');
      if (providerError) {
        router.replace(
          `/auth/login?error=${encodeURIComponent(providerErrorDescription || 'Microsoft sign-in was cancelled.')}`,
        );
        return;
      }

      const code = searchParams.get('code');
      const state = searchParams.get('state');
      if (!code || !state) {
        setError('Microsoft sign-in did not return the expected authorization data.');
        return;
      }

      let rememberMe = false;
      const rawPendingLogin = window.sessionStorage.getItem(PENDING_ENTRA_LOGIN_STORAGE_KEY);
      if (rawPendingLogin) {
        try {
          const parsed = JSON.parse(rawPendingLogin) as Partial<{ rememberMe: boolean }>;
          rememberMe = Boolean(parsed.rememberMe);
        } catch {
          rememberMe = false;
        }
      }

      try {
        const response = await completeMicrosoftEntraLogin(apiBaseUrl, { code, state });
        if (cancelled) {
          return;
        }

        window.sessionStorage.removeItem(PENDING_ENTRA_LOGIN_STORAGE_KEY);
        acceptAuthBundle(response, {
          rememberMe,
          ...(response.identity.email ? { emailHint: response.identity.email } : {}),
        });
        router.replace(response.nextPath ?? getDefaultWorkspacePath(response.identity.role));
      } catch (completeError) {
        if (cancelled) {
          return;
        }

        window.sessionStorage.removeItem(PENDING_ENTRA_LOGIN_STORAGE_KEY);
        setError(completeError instanceof Error ? completeError.message : String(completeError));
      }
    }

    void finalizeLogin();

    return () => {
      cancelled = true;
    };
  }, [acceptAuthBundle, apiBaseUrl, router, searchParams]);

  return <CallbackStatusCard error={error} />;
}

function CallbackStatusCard({ error }: { error?: string | null } = {}) {
  return (
    <Container size={460} my={80}>
      <Paper radius="md" p="xl" withBorder>
        <Stack align="center" gap="md">
          {error ? (
            <>
              <Alert color="red" title="Microsoft sign-in failed" w="100%">
                {error}
              </Alert>
              <Text size="sm" c="dimmed" ta="center">
                Return to the Pulse login page and try again once the Microsoft sign-in issue is resolved.
              </Text>
            </>
          ) : (
            <>
              <Loader />
              <Title order={3} ta="center">
                Finishing Microsoft sign-in
              </Title>
              <Text size="sm" c="dimmed" ta="center">
                We are validating your Microsoft identity and opening your Pulse workspace.
              </Text>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  );
}

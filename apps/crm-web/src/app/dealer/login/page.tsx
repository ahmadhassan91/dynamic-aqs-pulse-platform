'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Button, Card, Checkbox, Container, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconAlertCircle, IconBuildingStore } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { getDefaultWorkspacePath } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';

export default function DealerLoginPage() {
  const router = useRouter();
  const { auth, authError, email: storedEmail, isHydrated, loginWithCredentials, logout, rememberMe: storedRememberMe } = usePulseSession();
  const [email, setEmail] = useState(storedEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(storedRememberMe);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextPath, setNextPath] = useState('/dealer/dashboard');

  useEffect(() => {
    setEmail(storedEmail);
  }, [storedEmail]);

  useEffect(() => {
    setRememberMe(storedRememberMe);
  }, [storedRememberMe]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const candidate = new URLSearchParams(window.location.search).get('next');
    if (candidate?.startsWith('/dealer')) {
      setNextPath(candidate);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      return;
    }

    if (auth.identity.role === 'DEALER_PORTAL_USER') {
      router.replace(nextPath);
    }
  }, [auth, nextPath, router]);

  if (isHydrated && auth && auth.identity.role !== 'DEALER_PORTAL_USER') {
    return (
      <Container size={520} py="xl">
        <Card withBorder radius="xl" p="xl" className="premium-hero-panel">
          <Stack gap="md">
            <Title order={2}>You&apos;re signed in with an internal Pulse account</Title>
            <Text c="dimmed">
              Dealer portal access requires a dealer user set up for this company. You can return to the internal workspace
              or sign out first and continue with a dealer portal login.
            </Text>
            <Button component={Link} href={getDefaultWorkspacePath(auth.identity.role)}>
              Open Internal Workspace
            </Button>
            <Button
              variant="default"
              onClick={() => {
                void logout();
              }}
            >
              Sign Out
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container size={460} py="xl">
      <Stack gap="xl">
        <Card withBorder radius="xl" p="xl" className="premium-hero-panel">
          <Stack gap="sm" align="center">
            <IconBuildingStore size={44} color="var(--mantine-color-blue-6)" />
            <Title order={1}>Dealer Portal Sign In</Title>
            <Text c="dimmed" ta="center">
              Sign in with the dealer portal account Dynamic AQS set up for your company.
            </Text>
          </Stack>
        </Card>

        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Stack gap="md">
            {(errorMessage ?? authError) ? (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {errorMessage ?? authError}
              </Alert>
            ) : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setErrorMessage(null);
                setIsSubmitting(true);

                void (async () => {
                  try {
                    await loginWithCredentials({
                      email,
                      password,
                      rememberMe,
                      expectedRole: 'DEALER_PORTAL_USER',
                      roleErrorMessage: 'This account does not have dealer portal access yet.',
                    });
                    router.replace(nextPath);
                  } catch (error) {
                    setErrorMessage(error instanceof Error ? error.message : String(error));
                  } finally {
                    setIsSubmitting(false);
                  }
                })();
              }}
            >
              <Stack gap="md">
                <TextInput
                  required
                  label="Email"
                  placeholder="dealer@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
                <PasswordInput
                  required
                  label="Password"
                  placeholder="Your dealer portal password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
                <Checkbox
                  label="Remember me on this device"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.currentTarget.checked)}
                />
                <Button type="submit" loading={isSubmitting}>
                  Sign In
                </Button>
              </Stack>
            </form>
            <Text size="sm" c="dimmed">
              Access is set up by Dynamic AQS operations. If you need a portal login, contact your
              territory manager or the Dynamic AQS support team.
            </Text>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

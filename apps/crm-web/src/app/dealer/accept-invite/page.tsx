'use client';

import { useEffect, useState } from 'react';
import { Alert, Anchor, Button, Container, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { acceptDealerPortalInvite } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export default function DealerAcceptInvitePage() {
  const { apiBaseUrl } = usePulseSession();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const candidate = new URLSearchParams(window.location.search).get('token');
    if (candidate) {
      setToken(candidate);
    }
  }, []);

  return (
    <Container size={440} my={64}>
      <Paper radius="md" p="xl" withBorder>
        <Title order={2} ta="center" mb="md">
          Finish Dealer Portal Setup
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Create your password to activate this dealer portal invite.
        </Text>

        {error ? (
          <Alert icon={<IconInfoCircle size="1rem" />} color="red" mb="md">
            {error}
          </Alert>
        ) : null}

        {message ? (
          <Alert icon={<IconInfoCircle size="1rem" />} color="green" mb="md">
            {message}
          </Alert>
        ) : null}

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setMessage(null);

            if (!token.trim()) {
              setError('Dealer invite token is required.');
              return;
            }
            if (!password.trim() || password.trim().length < 10) {
              setError('Password must be at least 10 characters long.');
              return;
            }
            if (password !== confirmPassword) {
              setError('Passwords do not match.');
              return;
            }

            setLoading(true);
            try {
              const response = await acceptDealerPortalInvite(apiBaseUrl, {
                token,
                password,
              });
              setMessage(`Invite accepted for ${response.email}. You can sign in now.`);
              setPassword('');
              setConfirmPassword('');
            } catch (acceptError) {
              setError(acceptError instanceof Error ? acceptError.message : String(acceptError));
            } finally {
              setLoading(false);
            }
          }}
        >
          <Stack>
            <PasswordInput
              required
              label="Invite token"
              placeholder="Paste the invite token or open the invite link"
              value={token}
              onChange={(event) => setToken(event.currentTarget.value)}
            />
            <PasswordInput
              required
              label="Password"
              placeholder="At least 10 characters"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            <PasswordInput
              required
              label="Confirm password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            />
            <Button type="submit" fullWidth loading={loading}>
              Activate Portal Access
            </Button>
            <Text size="sm" ta="center">
              <Anchor href="/dealer/login">Return to dealer sign in</Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

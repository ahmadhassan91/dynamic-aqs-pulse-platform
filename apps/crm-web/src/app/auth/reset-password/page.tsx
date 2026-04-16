'use client';

import { useEffect, useState } from 'react';
import { Alert, Anchor, Button, Container, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { resetPulsePassword } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export default function ResetPasswordPage() {
  const { apiBaseUrl } = usePulseSession();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
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
    <Container size={420} my={64}>
      <Paper radius="md" p="xl" withBorder>
        <Title order={2} ta="center" mb="md">
          Set a new password
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Choose a new password for your local Pulse account.
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
              setError('Password reset token is required.');
              return;
            }
            if (!newPassword.trim()) {
              setError('New password is required.');
              return;
            }
            if (newPassword.trim().length < 10) {
              setError('New password must be at least 10 characters long.');
              return;
            }
            if (newPassword !== confirmPassword) {
              setError('Passwords do not match.');
              return;
            }

            setLoading(true);
            try {
              const response = await resetPulsePassword(apiBaseUrl, {
                token,
                newPassword,
              });
              setMessage(`Password updated for ${response.email}. You can sign in now.`);
              setNewPassword('');
              setConfirmPassword('');
            } catch (resetError) {
              setError(resetError instanceof Error ? resetError.message : String(resetError));
            } finally {
              setLoading(false);
            }
          }}
        >
          <Stack>
            <PasswordInput
              required
              label="Reset token"
              placeholder="Paste the reset token or open a preview link"
              value={token}
              onChange={(event) => setToken(event.currentTarget.value)}
            />
            <PasswordInput
              required
              label="New password"
              placeholder="At least 10 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.currentTarget.value)}
            />
            <PasswordInput
              required
              label="Confirm password"
              placeholder="Re-enter the new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.currentTarget.value)}
            />
            <Button type="submit" fullWidth loading={loading}>
              Reset password
            </Button>
            <Text size="sm" ta="center">
              <Anchor href="/auth/login">Return to sign in</Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

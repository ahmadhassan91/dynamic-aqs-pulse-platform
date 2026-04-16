'use client';

import { useState } from 'react';
import { Alert, Anchor, Button, Container, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { requestPulsePasswordReset } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export default function ForgotPasswordPage() {
  const { apiBaseUrl } = usePulseSession();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewResetUrl, setPreviewResetUrl] = useState<string | null>(null);

  return (
    <Container size={420} my={64}>
      <Paper radius="md" p="xl" withBorder>
        <Title order={2} ta="center" mb="md">
          Recover local Pulse password
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Microsoft Entra users should sign in with Microsoft. Use this only for local Pulse accounts.
        </Text>

        {error ? (
          <Alert icon={<IconInfoCircle size="1rem" />} color="red" mb="md">
            {error}
          </Alert>
        ) : null}

        {message ? (
          <Alert icon={<IconInfoCircle size="1rem" />} color="blue" mb="md">
            <Stack gap="xs">
              <Text>{message}</Text>
              {previewResetUrl ? (
                <Anchor href={previewResetUrl}>
                  Open reset link preview
                </Anchor>
              ) : null}
            </Stack>
          </Alert>
        ) : null}

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);
            setError(null);
            setMessage(null);
            setPreviewResetUrl(null);

            try {
              const response = await requestPulsePasswordReset(apiBaseUrl, { email });
              setMessage(response.message);
              setPreviewResetUrl(response.previewResetUrl ?? null);
            } catch (requestError) {
              setError(requestError instanceof Error ? requestError.message : String(requestError));
            } finally {
              setLoading(false);
            }
          }}
        >
          <Stack>
            <TextInput
              required
              label="Email"
              placeholder="your@email.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <Button type="submit" fullWidth loading={loading}>
              Send reset instructions
            </Button>
            <Text size="sm" ta="center">
              <Anchor href="/auth/login">Back to sign in</Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}

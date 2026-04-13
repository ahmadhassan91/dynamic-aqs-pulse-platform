'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

interface LoginFormProps {
  initialEmail?: string;
  initialRememberMe?: boolean;
  loading?: boolean;
  error?: string | null;
  onSubmit?: (values: { email: string; password: string; rememberMe: boolean }) => void;
}

export function LoginForm({
  initialEmail = '',
  initialRememberMe = false,
  loading = false,
  error,
  onSubmit,
}: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(initialRememberMe);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    setRememberMe(initialRememberMe);
  }, [initialRememberMe]);

  return (
    <Paper radius="md" p="xl" withBorder>
      <Title order={2} ta="center" mb="md">
        Welcome to Pulse CRM
      </Title>
      <Text c="dimmed" size="sm" ta="center" mb="xl">
        Sign in to access your workspace
      </Text>

      {error || validationError ? (
        <Alert icon={<IconInfoCircle size="1rem" />} color="red" mb="md">
          {error || validationError}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();

          if (!/^\S+@\S+$/.test(email)) {
            setValidationError('Invalid email');
            return;
          }

          if (!password.trim()) {
            setValidationError('Password is required');
            return;
          }

          setValidationError(null);
          onSubmit?.({
            email,
            password,
            rememberMe,
          });
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

          <PasswordInput
            required
            label="Password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <Checkbox
            label="Remember me on this device"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.currentTarget.checked)}
          />

          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}

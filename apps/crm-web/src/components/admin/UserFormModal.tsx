'use client';

import { useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import type { AdminUserSummary, AuthRole } from '@pulse/contracts';
import { AUTH_ROLE_CATALOG } from '@/lib/auth-catalog';

type UserFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  isActive: boolean;
  password: string;
};

const authRoleCatalog = AUTH_ROLE_CATALOG ?? [];

export function UserFormModal({
  opened,
  onClose,
  user,
  onSubmit,
  loading = false,
  error,
}: {
  opened: boolean;
  onClose: () => void;
  user?: AdminUserSummary | null;
  onSubmit: (values: UserFormValues) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}) {
  const [values, setValues] = useState<UserFormValues>(() => buildInitialValues(user));
  const [validationError, setValidationError] = useState<string | null>(null);

  return (
    <Modal opened={opened} onClose={onClose} title={user ? 'Edit User' : 'Create New User'} size="md">
      <form
        onSubmit={async (event) => {
          event.preventDefault();

          if (!/^\S+@\S+\.\S+$/.test(values.email)) {
            setValidationError('A valid email address is required.');
            return;
          }

          if (!values.firstName.trim() || !values.lastName.trim()) {
            setValidationError('First name and last name are required.');
            return;
          }

          setValidationError(null);
          await onSubmit(values);
        }}
      >
        <Stack gap="md">
          {validationError || error ? (
            <Alert color="red">
              {validationError || error}
            </Alert>
          ) : null}

          <TextInput
            label="Email Address"
            placeholder="user@dynamicaqs.com"
            value={values.email}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setValues((current) => ({ ...current, email: nextValue }));
            }}
            required
          />

          <Group grow>
            <TextInput
              label="First Name"
              value={values.firstName}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setValues((current) => ({ ...current, firstName: nextValue }));
              }}
              required
            />
            <TextInput
              label="Last Name"
              value={values.lastName}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setValues((current) => ({ ...current, lastName: nextValue }));
              }}
              required
            />
          </Group>

          <Select
            label="Role"
            data={authRoleCatalog.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))}
            value={values.role}
            onChange={(value) => setValues((current) => ({ ...current, role: (value as AuthRole) || current.role }))}
            required
          />

          {!user ? (
            <TextInput
              label="Temporary Password"
              placeholder="Leave blank to auto-generate"
              value={values.password}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setValues((current) => ({ ...current, password: nextValue }));
              }}
            />
          ) : null}

          <Switch
            label="User is active"
            checked={values.isActive}
            onChange={(event) => {
              const nextChecked = event.currentTarget.checked;
              setValues((current) => ({ ...current, isActive: nextChecked }));
            }}
          />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {user ? 'Update User' : 'Create User'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function buildInitialValues(user?: AdminUserSummary | null): UserFormValues {
  const [firstName = '', ...rest] = (user?.displayName ?? '').split(/\s+/).filter(Boolean);

  return {
    email: user?.email ?? '',
    firstName: user?.firstName ?? firstName,
    lastName: user?.lastName ?? rest.join(' '),
    role: user?.role ?? 'ADMIN_CSR_OPS',
    isActive: user?.isActive ?? true,
    password: '',
  };
}

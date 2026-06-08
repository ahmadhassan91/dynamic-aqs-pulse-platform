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
  Text,
  TextInput,
} from '@mantine/core';
import type { AdminUserSummary, AuthRole } from '@pulse/contracts';
import {
  AUTH_ROLE_CATALOG,
  getRoleDisplayName,
  getRoleScopeSummary,
  getRoleSummary,
} from '@/lib/auth-catalog';

type ActorType = 'internal' | 'dealer';

type UserFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  actorType: ActorType;
  isActive: boolean;
  password: string;
};

const actorTypeOptions: Array<{ value: ActorType; label: string }> = [
  { value: 'internal', label: 'Internal (CRM user)' },
  { value: 'dealer', label: 'Dealer portal user' },
];

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
  const selectedRoleSummary = getRoleSummary(values.role);
  const selectedRoleScopeSummary = getRoleScopeSummary(values.role);
  const isDealerActorType = values.actorType === 'dealer';

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

          {/* UX-AD-011: actor type selector — allows dealer-portal user creation */}
          {!user ? (
            <Select
              label="User type"
              description="Internal users access the CRM. Dealer portal users access only the dealer-facing portal."
              data={actorTypeOptions}
              value={values.actorType}
              onChange={(value) => {
                const nextActorType = (value as ActorType | null) ?? 'internal';
                setValues((current) => ({
                  ...current,
                  actorType: nextActorType,
                  // Auto-switch role to DEALER_PORTAL_USER when dealer is selected
                  ...(nextActorType === 'dealer' && current.role !== 'DEALER_PORTAL_USER'
                    ? { role: 'DEALER_PORTAL_USER' as AuthRole }
                    : {}),
                  // Clear dealer role when switching back to internal
                  ...(nextActorType === 'internal' && current.role === 'DEALER_PORTAL_USER'
                    ? { role: 'ADMIN_CSR_OPS' as AuthRole }
                    : {}),
                }));
              }}
              allowDeselect={false}
            />
          ) : null}

          {isDealerActorType ? (
            <Alert color="orange" variant="light">
              <Text size="sm">
                Dealer portal users access only the dealer-facing portal surface. They cannot log in to the
                internal CRM. Ensure the email matches the dealer organisation contact. The role will be set
                to <strong>Dealer Portal User</strong> automatically.
              </Text>
            </Alert>
          ) : null}

          <TextInput
            label="Email Address"
            placeholder={isDealerActorType ? 'dealer@partnercompany.com' : 'user@dynamicaqs.com'}
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
            description={isDealerActorType ? 'Dealer portal users are always assigned the Dealer Portal User role.' : undefined}
            data={authRoleCatalog
              .filter((role) => isDealerActorType ? role === 'DEALER_PORTAL_USER' : role !== 'DEALER_PORTAL_USER')
              .map((role) => ({ value: role, label: getRoleDisplayName(role) }))}
            value={values.role}
            onChange={(value) => setValues((current) => ({ ...current, role: (value as AuthRole) || current.role }))}
            disabled={isDealerActorType}
            required
          />

          {selectedRoleSummary ? (
            <Alert color="blue" variant="light">
              {selectedRoleSummary}
              {selectedRoleScopeSummary ? ` ${selectedRoleScopeSummary}` : ''}
            </Alert>
          ) : null}

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
  const derivedActorType: ActorType = user?.actorType === 'dealer' ? 'dealer' : 'internal';

  return {
    email: user?.email ?? '',
    firstName: user?.firstName ?? firstName,
    lastName: user?.lastName ?? rest.join(' '),
    role: user?.role ?? 'ADMIN_CSR_OPS',
    actorType: derivedActorType,
    isActive: user?.isActive ?? true,
    password: '',
  };
}

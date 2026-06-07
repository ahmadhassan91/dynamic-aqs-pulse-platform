'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { AccountDetail } from '@pulse/contracts';
import { EmptyStateMessage, RowActionMenu } from '@/components/ui/Workbench';
import { createAccountContactRecord, updateAccountContactRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

const CONTACT_ROLE_OPTIONS = [
  { value: 'Primary', label: 'Primary' },
  { value: 'Billing', label: 'Billing' },
  { value: 'Ordering', label: 'Ordering' },
  { value: 'Technical', label: 'Technical' },
  { value: 'Owner / GM', label: 'Owner / GM' },
  { value: 'Field Technician', label: 'Field Technician' },
  { value: 'Office Manager', label: 'Office Manager' },
];

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  title: '',
  email: '',
  phone: '',
  mobilePhone: '',
  roleCode: '',
  locationId: '',
  isPrimary: false,
  isActive: true,
};

type ContactFormState = typeof EMPTY_FORM;

export function CustomerContacts(
  { account, onUpdated, canEdit }: { account: AccountDetail; onUpdated: () => Promise<void> | void; canEdit: boolean },
) {
  const { auth, apiBaseUrl } = usePulseSession();
  const [modalOpened, setModalOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);

  const locationOptions = useMemo(
    () => [
      { value: '', label: 'No linked location' },
      ...account.locations.map((location) => ({
        value: location.id,
        label: location.name ?? location.locationCode ?? location.line1 ?? 'Location',
      })),
    ],
    [account.locations],
  );

  function openCreate() {
    setEditingContactId(null);
    setForm(EMPTY_FORM);
    setModalOpened(true);
  }

  function openEdit(contact: AccountDetail['contacts'][number]) {
    setEditingContactId(contact.id);
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      mobilePhone: contact.mobilePhone ?? '',
      roleCode: contact.roleCode ?? '',
      locationId: contact.locationId ?? '',
      isPrimary: contact.isPrimary,
      isActive: contact.isActive,
    });
    setModalOpened(true);
  }

  async function handleSave() {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingContactId) {
        await updateAccountContactRecord(apiBaseUrl, auth.tokens.accessToken, account.id, editingContactId, {
          firstName: form.firstName,
          lastName: form.lastName,
          title: form.title.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          mobilePhone: form.mobilePhone.trim() || null,
          roleCode: form.roleCode.trim() || null,
          locationId: form.locationId || null,
          isPrimary: form.isPrimary,
          isActive: form.isActive,
        });
      } else {
        await createAccountContactRecord(apiBaseUrl, auth.tokens.accessToken, account.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          ...(form.title.trim() ? { title: form.title.trim() } : {}),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.mobilePhone.trim() ? { mobilePhone: form.mobilePhone.trim() } : {}),
          ...(form.roleCode.trim() ? { roleCode: form.roleCode.trim() } : {}),
          ...(form.locationId ? { locationId: form.locationId } : {}),
          isPrimary: form.isPrimary,
          isActive: form.isActive,
        });
      }

      await onUpdated();
      setModalOpened(false);
      notifications.show({
        title: editingContactId ? 'Contact updated' : 'Contact created',
        message: `${form.firstName} ${form.lastName} is now saved on this customer.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Contact update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(contact: AccountDetail['contacts'][number]) {
    if (!auth) {
      return;
    }

    try {
      await updateAccountContactRecord(apiBaseUrl, auth.tokens.accessToken, account.id, contact.id, {
        isActive: !contact.isActive,
      });
      await onUpdated();
      notifications.show({
        title: contact.isActive ? 'Contact deactivated' : 'Contact reactivated',
        message: `${contact.firstName} ${contact.lastName} has been ${contact.isActive ? 'deactivated' : 'reactivated'}.`,
        color: 'blue',
      });
    } catch (error) {
      notifications.show({
        title: 'Contact status update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    }
  }

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="md">
        <Title order={4}>Contacts</Title>
        {canEdit ? (
          <Button size="xs" variant="light" onClick={openCreate}>
            Add Contact
          </Button>
        ) : null}
      </Group>
      <Stack gap="sm">
        {account.contacts.length === 0 ? (
          <EmptyStateMessage
            title="No contacts saved"
            description={canEdit
              ? 'Add the primary contact when the account handoff details are ready.'
              : 'Contacts will appear here after they are saved on the account.'}
          />
        ) : account.contacts.map((contact) => (
          <Paper key={contact.id} withBorder radius="md" p="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text fw={600}>{`${contact.firstName} ${contact.lastName}`.trim()}</Text>
                {contact.title ? <Text size="sm" c="dimmed">{contact.title}</Text> : null}
                {contact.email ? <Text size="sm">{contact.email}</Text> : null}
                {contact.mobilePhone || contact.phone ? <Text size="sm">{contact.mobilePhone ?? contact.phone}</Text> : null}
              </Stack>
              <Stack gap="xs" align="flex-end">
                <Group gap="xs">
                  {contact.roleCode ? <Badge variant="light">{contact.roleCode}</Badge> : null}
                  {contact.isPrimary ? <Badge color="blue" variant="light">Primary</Badge> : null}
                  <Badge color={contact.isActive ? 'green' : 'gray'} variant="outline">
                    {contact.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Group>
                {canEdit ? (
                  <RowActionMenu
                    items={[
                      {
                        id: 'edit',
                        label: 'Edit contact',
                        onClick: () => openEdit(contact),
                      },
                      {
                        id: 'toggle-active',
                        label: contact.isActive ? 'Deactivate contact' : 'Reactivate contact',
                        color: contact.isActive ? 'danger' : 'success',
                        onClick: () => void handleToggleActive(contact),
                      },
                    ]}
                  />
                ) : null}
              </Stack>
            </Group>
          </Paper>
        ))}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={editingContactId ? 'Edit Contact' : 'Add Contact'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="First Name"
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.currentTarget.value }))}
              required
            />
            <TextInput
              label="Last Name"
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.currentTarget.value }))}
              required
            />
          </SimpleGrid>
          <TextInput
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.currentTarget.value }))}
          />
          <Select
            label="Role"
            value={form.roleCode || null}
            onChange={(value) => setForm((current) => ({ ...current, roleCode: value ?? '' }))}
            data={CONTACT_ROLE_OPTIONS}
            placeholder="Select a role"
            searchable
            clearable
          />
          <Select
            label="Linked Location"
            value={form.locationId}
            onChange={(value) => setForm((current) => ({ ...current, locationId: value ?? '' }))}
            data={locationOptions}
          />
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))}
            />
            <TextInput
              label="Phone"
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Mobile Phone"
              value={form.mobilePhone}
              onChange={(event) => setForm((current) => ({ ...current, mobilePhone: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <Group grow>
            <Switch
              checked={form.isPrimary}
              onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.currentTarget.checked }))}
              label="Primary contact"
            />
            <Switch
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))}
              label="Contact is active"
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpened(false)}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              loading={isSaving}
              disabled={!form.firstName.trim() || !form.lastName.trim()}
            >
              {editingContactId ? 'Save Contact' : 'Create Contact'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

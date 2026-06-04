'use client';

import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Paper,
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
import { createAccountLocationRecord, updateAccountLocationRecord } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

const EMPTY_FORM = {
  locationCode: '',
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  countryCode: 'US',
  isPrimary: false,
  isActive: true,
};

type LocationFormState = typeof EMPTY_FORM;

export function CustomerLocations(
  { account, onUpdated, canEdit }: { account: AccountDetail; onUpdated: () => Promise<void> | void; canEdit: boolean },
) {
  const { auth, apiBaseUrl } = usePulseSession();
  const [modalOpened, setModalOpened] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [form, setForm] = useState<LocationFormState>(EMPTY_FORM);

  function openCreate() {
    setEditingLocationId(null);
    setForm({
      ...EMPTY_FORM,
      isPrimary: account.locations.length === 0,
    });
    setModalOpened(true);
  }

  function openEdit(location: AccountDetail['locations'][number]) {
    setEditingLocationId(location.id);
    setForm({
      locationCode: location.locationCode ?? '',
      name: location.name ?? '',
      line1: location.line1 ?? '',
      line2: location.line2 ?? '',
      city: location.city ?? '',
      state: location.state ?? '',
      postalCode: location.postalCode ?? '',
      countryCode: location.countryCode ?? 'US',
      isPrimary: location.isPrimary,
      isActive: location.isActive,
    });
    setModalOpened(true);
  }

  async function handleSave() {
    if (!auth) {
      return;
    }

    setIsSaving(true);
    try {
      if (editingLocationId) {
        await updateAccountLocationRecord(apiBaseUrl, auth.tokens.accessToken, account.id, editingLocationId, {
          locationCode: form.locationCode.trim() || null,
          name: form.name.trim() || null,
          line1: form.line1.trim() || null,
          line2: form.line2.trim() || null,
          city: form.city.trim() || null,
          state: form.state.trim() || null,
          postalCode: form.postalCode.trim() || null,
          countryCode: form.countryCode.trim() || null,
          isPrimary: form.isPrimary,
          isActive: form.isActive,
        });
      } else {
        await createAccountLocationRecord(apiBaseUrl, auth.tokens.accessToken, account.id, {
          ...(form.locationCode.trim() ? { locationCode: form.locationCode.trim() } : {}),
          ...(form.name.trim() ? { name: form.name.trim() } : {}),
          ...(form.line1.trim() ? { line1: form.line1.trim() } : {}),
          ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
          ...(form.city.trim() ? { city: form.city.trim() } : {}),
          ...(form.state.trim() ? { state: form.state.trim() } : {}),
          ...(form.postalCode.trim() ? { postalCode: form.postalCode.trim() } : {}),
          ...(form.countryCode.trim() ? { countryCode: form.countryCode.trim() } : {}),
          isPrimary: form.isPrimary,
          isActive: form.isActive,
        });
      }

      await onUpdated();
      setModalOpened(false);
      notifications.show({
        title: editingLocationId ? 'Location updated' : 'Location created',
        message: `${form.name || form.locationCode || form.line1 || 'Location'} has been saved.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Location update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(location: AccountDetail['locations'][number]) {
    if (!auth) {
      return;
    }

    try {
      await updateAccountLocationRecord(apiBaseUrl, auth.tokens.accessToken, account.id, location.id, {
        isActive: !location.isActive,
      });
      await onUpdated();
      notifications.show({
        title: location.isActive ? 'Location deactivated' : 'Location reactivated',
        message: `${location.name ?? location.locationCode ?? 'Location'} has been ${location.isActive ? 'deactivated' : 'reactivated'}.`,
        color: 'blue',
      });
    } catch (error) {
      notifications.show({
        title: 'Location status update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    }
  }

  return (
    <Card withBorder radius="md" p="lg">
      <Group justify="space-between" mb="md">
        <Title order={4}>Locations</Title>
        {canEdit ? (
          <Button size="xs" variant="light" onClick={openCreate}>
            Add Location
          </Button>
        ) : null}
      </Group>
      <Stack gap="sm">
        {account.locations.length === 0 ? (
          <EmptyStateMessage
            title="No locations saved"
            description={canEdit
              ? 'Add the primary operating location when the account address is ready.'
              : 'Locations will appear here after they are saved on the account.'}
          />
        ) : account.locations.map((location) => (
          <Paper key={location.id} withBorder radius="md" p="md">
            <Group justify="space-between" mb="xs">
              <Stack gap={4}>
                <Text fw={600}>{location.name ?? location.locationCode ?? 'Location'}</Text>
                {[location.line1, location.city, location.state, location.postalCode, location.countryCode].filter(Boolean).length ? (
                  <Text size="sm" c="dimmed">
                    {[location.line1, location.city, location.state, location.postalCode, location.countryCode].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </Stack>
              <Stack gap="xs" align="flex-end">
                <Group gap="xs">
                  {location.isPrimary ? <Badge color="blue" variant="light">Primary</Badge> : null}
                  <Badge color={location.isActive ? 'green' : 'gray'} variant="outline">
                    {location.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </Group>
                {canEdit ? (
                  <RowActionMenu
                    items={[
                      {
                        id: 'edit',
                        label: 'Edit location',
                        onClick: () => openEdit(location),
                      },
                      {
                        id: 'toggle-active',
                        label: location.isActive ? 'Deactivate location' : 'Reactivate location',
                        color: location.isActive ? 'danger' : 'success',
                        onClick: () => void handleToggleActive(location),
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
        title={editingLocationId ? 'Edit Location' : 'Add Location'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Location Name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))}
            />
            <TextInput
              label="Location Reference"
              value={form.locationCode}
              onChange={(event) => setForm((current) => ({ ...current, locationCode: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <TextInput
            label="Address Line 1"
            value={form.line1}
            onChange={(event) => setForm((current) => ({ ...current, line1: event.currentTarget.value }))}
          />
          <TextInput
            label="Address Line 2"
            value={form.line2}
            onChange={(event) => setForm((current) => ({ ...current, line2: event.currentTarget.value }))}
          />
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              label="City"
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.currentTarget.value }))}
            />
            <TextInput
              label="State"
              value={form.state}
              onChange={(event) => setForm((current) => ({ ...current, state: event.currentTarget.value }))}
            />
            <TextInput
              label="Postal Code"
              value={form.postalCode}
              onChange={(event) => setForm((current) => ({ ...current, postalCode: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <TextInput
            label="Country Code"
            value={form.countryCode}
            onChange={(event) => setForm((current) => ({ ...current, countryCode: event.currentTarget.value }))}
          />
          <Group grow>
            <Switch
              checked={form.isPrimary}
              onChange={(event) => setForm((current) => ({ ...current, isPrimary: event.currentTarget.checked }))}
              label="Primary location"
            />
            <Switch
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.currentTarget.checked }))}
              label="Location is active"
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpened(false)}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              loading={isSaving}
              disabled={!(form.locationCode.trim() || form.name.trim() || form.line1.trim())}
            >
              {editingLocationId ? 'Save Location' : 'Create Location'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}

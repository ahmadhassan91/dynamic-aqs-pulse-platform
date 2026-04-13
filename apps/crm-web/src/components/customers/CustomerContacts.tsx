'use client';

import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core';
import type { AccountDetail } from '@pulse/contracts';

export function CustomerContacts({ account }: { account: AccountDetail }) {
  return (
    <Card withBorder radius="md" p="lg">
      <Title order={4} mb="md">Contacts</Title>
      <Stack gap="sm">
        {account.contacts.length === 0 ? (
          <Text size="sm" c="dimmed">No contacts are mapped to this account yet.</Text>
        ) : account.contacts.map((contact) => (
          <Card key={contact.id} withBorder radius="md" p="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Text fw={600}>{`${contact.firstName} ${contact.lastName}`.trim()}</Text>
                <Text size="sm" c="dimmed">{contact.title ?? 'No title recorded'}</Text>
                <Text size="sm">{contact.email ?? 'No email recorded'}</Text>
                <Text size="sm">{contact.mobilePhone ?? contact.phone ?? 'No phone recorded'}</Text>
              </Stack>
              <Group gap="xs">
                {contact.roleCode ? <Badge variant="light">{contact.roleCode}</Badge> : null}
                {contact.isPrimary ? <Badge color="blue" variant="light">Primary</Badge> : null}
                <Badge color={contact.isActive ? 'green' : 'gray'} variant="outline">
                  {contact.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Card>
  );
}

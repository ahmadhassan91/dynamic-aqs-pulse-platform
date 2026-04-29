'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { fetchAccountConsignmentReadModel, type ConsignmentSiteSummary } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { consignmentStatusColor, formatConsignmentDate, formatConsignmentStatus } from './ConsignmentWorkspace';

export function CustomerConsignmentIndicator({ accountId }: { accountId: string }) {
  const { apiBaseUrl, auth } = usePulseSession();
  const [sites, setSites] = useState<ConsignmentSiteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setSites([]);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchAccountConsignmentReadModel(apiBaseUrl, auth.tokens.accessToken, accountId);
        if (!cancelled) {
          setSites(response.sites);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, apiBaseUrl, auth]);

  if (isLoading) {
    return (
      <Card withBorder radius="md" p="md">
        <Group gap="sm">
          <Loader size="sm" color="blue" />
          <Text size="sm" c="dimmed">Checking consignment participation...</Text>
        </Group>
      </Card>
    );
  }

  if (errorMessage) {
    return <Alert color="red" variant="light">{errorMessage}</Alert>;
  }

  if (sites.length === 0) {
    return (
      <Card withBorder radius="md" p="md">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Title order={5}>Consignment</Title>
            <Text size="sm" c="dimmed">No active Pulse consignment site is linked to this account.</Text>
          </Stack>
          <Badge color="gray" variant="outline">Not Enrolled</Badge>
        </Group>
      </Card>
    );
  }

  const primarySite = sites[0];

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Group gap="xs">
            <Title order={5}>Consignment</Title>
            <Badge color="green" variant="light">Participant</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {sites.length} linked site{sites.length === 1 ? '' : 's'} in Pulse.
          </Text>
          {primarySite ? (
            <Group gap="xs">
              <Badge color={consignmentStatusColor(primarySite.status)} variant="light">
                {formatConsignmentStatus(primarySite.status)}
              </Badge>
              <Badge color="blue" variant="outline">
                Next ROSE: {formatConsignmentDate(primarySite.nextAuditDueAt)}
              </Badge>
              <Badge color={primarySite.acumaticaWarehouseId ? 'green' : 'gray'} variant="outline">
                {primarySite.acumaticaWarehouseId ?? 'Acumatica pending'}
              </Badge>
            </Group>
          ) : null}
        </Stack>
        {primarySite ? (
          <Button component={Link} href={`/consignment/${primarySite.id}`} variant="light" size="xs">
            Open Site
          </Button>
        ) : null}
      </Group>
    </Card>
  );
}

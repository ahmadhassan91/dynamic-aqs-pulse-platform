'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Card, Container, Grid, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowRight, IconBuilding, IconLogin, IconShieldCheck } from '@tabler/icons-react';
import { usePulseSession } from '@/lib/pulse-session';

export default function DealerPortalLandingPage() {
  const router = useRouter();
  const { auth, isHydrated } = usePulseSession();

  useEffect(() => {
    if (!isHydrated || !auth) {
      return;
    }

    if (auth.identity.role === 'DEALER_PORTAL_USER') {
      router.replace('/dealer/dashboard');
    }
  }, [auth, isHydrated, router]);

  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Card withBorder radius="xl" p="xl" className="premium-hero-panel">
          <Stack gap="md">
            <Group>
              <IconBuilding size={46} color="var(--mantine-color-blue-6)" />
              <Title order={1}>Pulse Dealer Portal</Title>
            </Group>
            <Text size="lg" c="dimmed">
              This is the live dealer-facing shell for account access, contact visibility, location context,
              and portal-user management. It is backed by the same production portal provisioning records used in Pulse CRM.
            </Text>
            <Group gap="xs">
              <Badge size="lg" color="blue" variant="light">Dealer Account Center</Badge>
              <Badge size="lg" color="green" variant="light">Provisioned Access Only</Badge>
            </Group>
            <Group gap="sm" mt="sm">
              <Button component={Link} href="/dealer/login" leftSection={<IconLogin size={16} />}>
                Sign In
              </Button>
              <Button component={Link} href="/auth/login" variant="default">
                Internal Pulse Login
              </Button>
            </Group>
          </Stack>
        </Card>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder radius="xl" p="lg" className="premium-detail-card" h="100%">
              <Stack gap="sm" h="100%">
                <IconShieldCheck size={28} color="var(--mantine-color-green-6)" />
                <Title order={3}>What is live now</Title>
                <Text c="dimmed">
                  Dealer users can sign in, open their dashboard, review territory and shipping ownership,
                  and access live company user, contact, and location data.
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <Card withBorder radius="xl" p="lg" className="premium-detail-card" h="100%">
              <Stack gap="sm" h="100%">
                <IconArrowRight size={28} color="var(--mantine-color-blue-6)" />
                <Title order={3}>How access works</Title>
                <Text c="dimmed">
                  Portal accounts are provisioned from the CRM customer record by Dynamic AQS operations.
                  There is no self-registration path in the live build yet.
                </Text>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}

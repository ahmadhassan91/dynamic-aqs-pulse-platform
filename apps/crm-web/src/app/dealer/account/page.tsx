'use client';

import { Alert, Card, Center, Loader, Stack, Text } from '@mantine/core';
import { DealerAccountCenter } from '@/components/dealer/DealerAccountCenter';
import { DealerPortalProtectedWorkspace } from '@/components/dealer/DealerPortalProtectedWorkspace';
import { BrandedDealerLayout } from '@/components/layout/BrandedDealerLayout';
import { useDealerPortalDashboard } from '@/lib/use-dealer-portal-dashboard';

export default function DealerAccountPage() {
  const { dashboard, errorMessage, isLoading } = useDealerPortalDashboard();

  return (
    <DealerPortalProtectedWorkspace>
      <BrandedDealerLayout dashboard={dashboard}>
        {isLoading ? (
          <Card withBorder radius="xl" p="xl" className="premium-detail-card">
            <Center>
              <Stack gap="xs" align="center">
                <Loader color="blue" />
                <Text size="sm" c="dimmed">
                  Loading account center...
                </Text>
              </Stack>
            </Center>
          </Card>
        ) : null}

        {errorMessage ? (
          <Alert color="red" variant="light">
            {errorMessage}
          </Alert>
        ) : null}

        {dashboard ? <DealerAccountCenter dashboard={dashboard} /> : null}
      </BrandedDealerLayout>
    </DealerPortalProtectedWorkspace>
  );
}

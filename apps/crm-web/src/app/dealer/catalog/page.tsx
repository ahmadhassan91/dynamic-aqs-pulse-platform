'use client';

import { Alert, Card, Center, Loader, Stack, Text } from '@mantine/core';
import { DealerCatalog } from '@/components/dealer/DealerCatalog';
import { DealerPortalProtectedWorkspace } from '@/components/dealer/DealerPortalProtectedWorkspace';
import { BrandedDealerLayout } from '@/components/layout/BrandedDealerLayout';
import { useDealerPortalCatalog } from '@/lib/use-dealer-portal-catalog';
import { useDealerPortalDashboard } from '@/lib/use-dealer-portal-dashboard';

export default function DealerCatalogPage() {
  const { dashboard } = useDealerPortalDashboard();
  const { assetActions, catalog, errorMessage, favoriteActions, isLoading } = useDealerPortalCatalog();

  return (
    <DealerPortalProtectedWorkspace>
      <BrandedDealerLayout dashboard={dashboard}>
        {isLoading ? (
          <Card withBorder radius="xl" p="xl" className="premium-detail-card">
            <Center>
              <Stack gap="xs" align="center">
                <Loader color="blue" />
                <Text size="sm" c="dimmed">
                  Loading dealer catalog...
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

        {catalog ? <DealerCatalog catalog={catalog} assetActions={assetActions} favoriteActions={favoriteActions} /> : null}
      </BrandedDealerLayout>
    </DealerPortalProtectedWorkspace>
  );
}

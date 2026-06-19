'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, Center, Loader, Stack, Text } from '@mantine/core';
import type { DealerPortalCatalogProductSummary } from '@pulse/contracts';
import { DealerCatalog, type DealerCatalogCartActions } from '@/components/dealer/DealerCatalog';
import { DealerPortalProtectedWorkspace } from '@/components/dealer/DealerPortalProtectedWorkspace';
import { BrandedDealerLayout } from '@/components/layout/BrandedDealerLayout';
import { useDealerPortalCart } from '@/lib/use-dealer-portal-cart';
import { useDealerPortalCatalog } from '@/lib/use-dealer-portal-catalog';
import { useDealerPortalDashboard } from '@/lib/use-dealer-portal-dashboard';

export default function DealerCatalogPage() {
  const { dashboard } = useDealerPortalDashboard();
  const { assetActions, catalog, errorMessage, favoriteActions, isLoading } = useDealerPortalCatalog();
  const { addItem, error: cartError } = useDealerPortalCart();
  const [addingPresentationId, setAddingPresentationId] = useState<string | undefined>();

  const cartActions = useMemo<DealerCatalogCartActions>(
    () => ({
      isAvailable: true,
      addingPresentationId,
      addToCart: async (product: DealerPortalCatalogProductSummary) => {
        setAddingPresentationId(product.presentationId);
        try {
          await addItem(product.presentationId, 1);
        } finally {
          setAddingPresentationId(undefined);
        }
      },
    }),
    [addItem, addingPresentationId],
  );

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
            <Stack gap="sm">
              <Text>{errorMessage}</Text>
              <Button size="xs" variant="light" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {cartError ? (
          <Alert color="red" variant="light">
            Could not update your cart: {cartError}
          </Alert>
        ) : null}

        {catalog ? (
          <DealerCatalog
            catalog={catalog}
            assetActions={assetActions}
            cartActions={cartActions}
            favoriteActions={favoriteActions}
          />
        ) : null}
      </BrandedDealerLayout>
    </DealerPortalProtectedWorkspace>
  );
}

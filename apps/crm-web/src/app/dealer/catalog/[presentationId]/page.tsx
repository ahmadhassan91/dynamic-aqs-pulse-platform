'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Alert, Button, Card, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconPackage } from '@tabler/icons-react';
import { DealerCatalogProductDetail } from '@/components/dealer/DealerCatalogProductDetail';
import { DealerPortalProtectedWorkspace } from '@/components/dealer/DealerPortalProtectedWorkspace';
import { BrandedDealerLayout } from '@/components/layout/BrandedDealerLayout';
import { useDealerPortalCatalog } from '@/lib/use-dealer-portal-catalog';
import { useDealerPortalDashboard } from '@/lib/use-dealer-portal-dashboard';

export default function DealerCatalogProductPage() {
  const params = useParams<{ presentationId?: string }>();
  const presentationId = typeof params.presentationId === 'string' ? decodeURIComponent(params.presentationId) : '';
  const { dashboard } = useDealerPortalDashboard();
  const { assetActions, catalog, errorMessage, favoriteActions, isLoading } = useDealerPortalCatalog();

  const product = useMemo(
    () => catalog?.products.find((entry) => entry.presentationId === presentationId) ?? null,
    [catalog?.products, presentationId],
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
                  Loading product details...
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

        {!isLoading && catalog && !product ? (
          <Card withBorder radius="xl" p="xl" className="premium-detail-card">
            <Stack gap="sm" align="center">
              <IconPackage size={36} />
              <Title order={3}>Product is not available</Title>
              <Text c="dimmed" ta="center" maw={620}>
                This product is not available for your company, or it is no longer visible to this account.
              </Text>
              <Button component={Link} href="/dealer/catalog" variant="light" leftSection={<IconArrowLeft size={16} />}>
                Back To Catalog
              </Button>
            </Stack>
          </Card>
        ) : null}

        {catalog && product ? (
          <DealerCatalogProductDetail
            product={product}
            catalogView={catalog.catalogView}
            assetActions={assetActions}
            favoriteActions={favoriteActions}
          />
        ) : null}
      </BrandedDealerLayout>
    </DealerPortalProtectedWorkspace>
  );
}

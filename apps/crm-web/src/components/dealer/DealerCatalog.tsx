'use client';

import { Alert, Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { DealerPortalCatalogResponse, DealerPortalCatalogProductSummary } from '@pulse/contracts';
import { IconDownload, IconPackage, IconTag } from '@tabler/icons-react';

export function DealerCatalog({ catalog }: { catalog: DealerPortalCatalogResponse }) {
  return (
    <Stack gap="lg">
      <Card withBorder radius="xl" p="lg" className="premium-hero-panel">
        <Group justify="space-between" align="flex-start">
          <Stack gap={6}>
            <Text className="eyebrow">Dealer Catalog</Text>
            <Title order={1}>Products and Files</Title>
            <Text c="dimmed" maw={760}>
              Browse the products and dealer-safe files Dynamic AQS has published for your company.
              Pricing and order submission will appear here after the ERP-backed commerce gate is approved.
            </Text>
            {catalog.catalogView ? (
              <Group gap="xs">
                <Badge size="lg" color="blue" variant="light">
                  {catalog.catalogView.name}
                </Badge>
                {catalog.catalogView.brandLabel ? (
                  <Badge size="lg" color="gray" variant="light">
                    {catalog.catalogView.brandLabel}
                  </Badge>
                ) : null}
              </Group>
            ) : null}
          </Stack>
          <Badge size="xl" color="green" variant="light">
            {catalog.products.length} published
          </Badge>
        </Group>
      </Card>

      {catalog.warnings.map((warning) => (
        <Alert key={warning} color="yellow" variant="light">
          {warning}
        </Alert>
      ))}

      {catalog.products.length === 0 ? (
        <Card withBorder radius="xl" p="xl" className="premium-detail-card">
          <Stack gap="xs" align="center">
            <IconPackage size={36} />
            <Title order={3}>No products are published yet</Title>
            <Text c="dimmed" ta="center" maw={620}>
              Dynamic AQS is still preparing the catalog view for this account. Once a dealer catalog view passes
              Product Management readiness, products and files will show here automatically.
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          {catalog.products.map((product) => (
            <ProductCard key={product.presentationId} product={product} />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}

function ProductCard({ product }: { product: DealerPortalCatalogProductSummary }) {
  const primaryFiles = product.assets.slice(0, 4);

  return (
    <Card withBorder radius="xl" p="lg" className="premium-detail-card">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <Badge color="gray" variant="light">
                {product.sku}
              </Badge>
              {product.categoryName ? (
                <Badge color="blue" variant="light">
                  {product.categoryName}
                </Badge>
              ) : null}
            </Group>
            <Title order={3}>{product.displayName}</Title>
            {product.shortDescription ? (
              <Text c="dimmed">{product.shortDescription}</Text>
            ) : null}
          </Stack>
          {product.brandLabel ? (
            <Badge color="green" variant="light" leftSection={<IconTag size={12} />}>
              {product.brandLabel}
            </Badge>
          ) : null}
        </Group>

        {product.specSummary ? (
          <Text size="sm">{product.specSummary}</Text>
        ) : null}

        <Stack gap="xs">
          <Text size="sm" fw={700}>
            Product files
          </Text>
          {primaryFiles.length === 0 ? (
            <Text size="sm" c="dimmed">
              No dealer-visible files are attached yet.
            </Text>
          ) : (
            primaryFiles.map((asset) => (
              <Group key={`${asset.id}-${asset.role}`} justify="space-between" gap="sm" wrap="nowrap">
                <Stack gap={0}>
                  <Text size="sm" fw={500}>
                    {asset.title}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {asset.role.replace(/_/g, ' ')}
                  </Text>
                </Stack>
                <Button
                  component="a"
                  href={asset.downloadUrl ?? '#'}
                  target={asset.downloadUrl ? '_blank' : undefined}
                  rel={asset.downloadUrl ? 'noreferrer' : undefined}
                  size="xs"
                  variant="light"
                  leftSection={<IconDownload size={14} />}
                  disabled={!asset.downloadUrl}
                >
                  Open
                </Button>
              </Group>
            ))
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

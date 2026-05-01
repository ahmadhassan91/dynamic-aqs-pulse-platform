'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Group, Loader, Paper, Select, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconArrowLeft, IconLink, IconRefresh, IconShieldCheck } from '@tabler/icons-react';
import {
  PRODUCT_ASSET_ROLES,
  type DigitalAssetSummary,
  type ProductAssetRoleKey,
} from '@pulse/contracts/digital-assets';
import type { ProductDetail } from '@pulse/contracts/product-management';
import {
  assignDigitalAssetToProduct,
  fetchDigitalAssetLibrary,
  fetchProductManagementProductDetail,
  validateProductManagementPresentation,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

export function ProductDetailWorkspace({ productId }: { productId: string }) {
  const { apiBaseUrl, auth } = usePulseSession();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [availableAssets, setAvailableAssets] = useState<DigitalAssetSummary[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAssetRole, setSelectedAssetRole] = useState<ProductAssetRoleKey>('primary_image');
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigningAsset, setIsAssigningAsset] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [response, assetLibrary] = await Promise.all([
          fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, productId),
          fetchDigitalAssetLibrary(apiBaseUrl, auth.tokens.accessToken, { limit: 100 }),
        ]);
        if (!cancelled) setProduct(response);
        if (!cancelled) setAvailableAssets(assetLibrary.items);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, productId]);

  const reloadProduct = async () => {
    if (!auth) return;
    const response = await fetchProductManagementProductDetail(apiBaseUrl, auth.tokens.accessToken, productId);
    setProduct(response);
  };

  const handleAssignAsset = async () => {
    if (!auth || !product || !selectedAssetId) return;
    const presentation = product.presentations[0];
    if (!presentation) return;
    const asset = availableAssets.find((item) => item.id === selectedAssetId);
    const roleSortOrder = product.assetAssignments.filter((assignment) => assignment.role === selectedAssetRole).length + 1;
    setIsAssigningAsset(true);
    setAssetError(null);
    try {
      await assignDigitalAssetToProduct(apiBaseUrl, auth.tokens.accessToken, {
        presentationId: presentation.id,
        assetId: selectedAssetId,
        assetVersionId: asset?.currentVersionId ?? null,
        role: selectedAssetRole,
        brandLabel: presentation.brandLabel ?? asset?.brandScope ?? null,
        regionScope: presentation.regionScope ?? asset?.regionScope ?? null,
        sortOrder: selectedAssetRole === 'primary_image' ? 10 : 100 + roleSortOrder,
        isRequired: selectedAssetRole === 'primary_image' || selectedAssetRole === 'spec_sheet',
      });
      setSelectedAssetId(null);
      await reloadProduct();
    } catch (assignError) {
      setAssetError(assignError instanceof Error ? assignError.message : String(assignError));
    } finally {
      setIsAssigningAsset(false);
    }
  };

  const handleValidatePresentation = async () => {
    if (!auth || !product?.presentations[0]) return;
    setIsValidating(true);
    setAssetError(null);
    try {
      await validateProductManagementPresentation(apiBaseUrl, auth.tokens.accessToken, product.presentations[0].id);
      await reloadProduct();
    } catch (validationError) {
      setAssetError(validationError instanceof Error ? validationError.message : String(validationError));
    } finally {
      setIsValidating(false);
    }
  };

  if (isLoading) {
    return <Group justify="center" p="xl"><Loader /></Group>;
  }

  if (error) {
    return (
      <Alert color="yellow" icon={<IconAlertTriangle size={18} />} title="Product detail unavailable">
        {error}
      </Alert>
    );
  }

  if (!product) {
    return <Text c="dimmed">Product not loaded.</Text>;
  }

  const primaryPresentation = product.presentations[0];
  const blockedChecks = product.readinessChecks.filter((check) => check.status === 'blocked');
  const assetRoleOptions = PRODUCT_ASSET_ROLES.map((role) => ({ value: role, label: formatLabel(role) }));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Button component={Link} href="/product-management?tab=products" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Products
        </Button>
        <Badge variant="light">{product.sourceSystem}</Badge>
      </Group>

      <Stack gap={4}>
        <Title order={2}>{primaryPresentation?.displayName ?? product.productName}</Title>
        <Text c="dimmed">{product.sku} {product.acumaticaInventoryId ? `| Acumatica ${product.acumaticaInventoryId}` : '| Acumatica link pending'}</Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Category</Text>
          <Text fw={700}>{product.category?.name ?? 'Unassigned'}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Lifecycle</Text>
          <Text fw={700}>{product.lifecycleStatus}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed">Go-Live Blockers</Text>
          <Text fw={700}>{blockedChecks.length}</Text>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Title order={4}>Presentation</Title>
          <Group>
            {primaryPresentation ? (
              <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={handleValidatePresentation} loading={isValidating}>
                Run Validation
              </Button>
            ) : null}
            <Badge color={primaryPresentation?.readyForDealerPortal ? 'green' : 'gray'}>{primaryPresentation?.publishStatus ?? 'draft'}</Badge>
          </Group>
        </Group>
        <Text>{primaryPresentation?.shortDescription ?? 'No dealer-facing description has been approved yet.'}</Text>
      </Paper>

      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm" align="flex-end">
          <Stack gap={2}>
            <Title order={4}>Product Files</Title>
            <Text c="dimmed" size="sm">Attach approved images, spec sheets, brochures, and install guides to the dealer-facing product presentation.</Text>
          </Stack>
          <Group align="flex-end">
            <Select
              w={280}
              label="Asset"
              searchable
              clearable
              placeholder="Select asset"
              value={selectedAssetId}
              onChange={setSelectedAssetId}
              data={availableAssets.map((asset) => ({
                value: asset.id,
                label: `${asset.title} / ${asset.kind} / ${asset.sourceSystem}`,
              }))}
            />
            <Select
              w={190}
              label="Role"
              value={selectedAssetRole}
              onChange={(value) => setSelectedAssetRole((value as ProductAssetRoleKey | null) ?? 'primary_image')}
              data={assetRoleOptions}
              allowDeselect={false}
            />
            <Button
              leftSection={<IconLink size={16} />}
              onClick={handleAssignAsset}
              disabled={!selectedAssetId || !primaryPresentation}
              loading={isAssigningAsset}
            >
              Attach
            </Button>
          </Group>
        </Group>

        {assetError ? (
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="sm">
            {assetError}
          </Alert>
        ) : null}

        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Asset</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Kind</Table.Th>
              <Table.Th>Scope</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Required</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {product.assetAssignments.map((assignment) => (
              <Table.Tr key={assignment.id}>
                <Table.Td>
                  <Text fw={600}>{assignment.title}</Text>
                  <Text size="xs" c="dimmed">/{assignment.stableSlug}</Text>
                </Table.Td>
                <Table.Td>{formatLabel(assignment.role)}</Table.Td>
                <Table.Td>{assignment.kind}</Table.Td>
                <Table.Td>{[assignment.brandScope, assignment.regionScope].filter(Boolean).join(' / ') || 'Unscoped'}</Table.Td>
                <Table.Td><Badge variant="light">{assignment.status} / {assignment.reviewStatus}</Badge></Table.Td>
                <Table.Td>{assignment.isRequired ? 'Yes' : 'No'}</Table.Td>
              </Table.Tr>
            ))}
            {!product.assetAssignments.length ? (
              <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">No files linked to this product yet.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder p="md">
        <Group mb="sm">
          <IconShieldCheck size={18} />
          <Title order={4}>Dealer Visibility</Title>
        </Group>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Group Type</Table.Th>
              <Table.Th>Group</Table.Th>
              <Table.Th>Region</Table.Th>
              <Table.Th>Brand</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {product.inclusions.map((inclusion) => (
              <Table.Tr key={inclusion.id}>
                <Table.Td>{inclusion.dealerGroupType}</Table.Td>
                <Table.Td>{inclusion.dealerGroupId ?? 'All'}</Table.Td>
                <Table.Td>{inclusion.regionScope ?? 'Any'}</Table.Td>
                <Table.Td>{inclusion.brandLabel ?? 'Neutral'}</Table.Td>
                <Table.Td>{inclusion.isVisible ? inclusion.publishStatus : 'hidden'}</Table.Td>
              </Table.Tr>
            ))}
            {!product.inclusions.length ? (
              <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">No dealer visibility rules yet.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Paper>

      <Paper withBorder p="md">
        <Title order={4} mb="sm">Go-Live Checklist</Title>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Check</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Message</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {product.readinessChecks.map((check) => (
              <Table.Tr key={check.id}>
                <Table.Td>{check.checkName}</Table.Td>
                <Table.Td><Badge color={check.status === 'pass' ? 'green' : check.status === 'warning' ? 'yellow' : 'red'}>{check.status}</Badge></Table.Td>
                <Table.Td>{check.message ?? '-'}</Table.Td>
              </Table.Tr>
            ))}
            {!product.readinessChecks.length ? (
              <Table.Tr><Table.Td colSpan={3}><Text ta="center" c="dimmed" py="md">Run publish validation to generate checks.</Text></Table.Td></Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Paper>
    </Stack>
  );
}

function formatLabel(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

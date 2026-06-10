'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconEye, IconInfoCircle } from '@tabler/icons-react';
import type { AccountSummary, DealerPortalInternalPreviewResponse } from '@pulse/contracts';
import { fetchAccounts, fetchDealerPortalInternalPreview } from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

// Plain-language "who wins" ladder, strongest first. This mirrors the resolver's precedence
// ordering (lowest number wins) without ever surfacing the integers to users.
const PRECEDENCE_LADDER: Array<{ kind: string; label: string; helper: string }> = [
  { kind: 'account_override', label: 'Account exception', helper: 'A specific dealer override beats everything' },
  { kind: 'private_label', label: 'Private label', helper: 'Dealer-branded presentation' },
  { kind: 'brand', label: 'Brand', helper: 'Brand-specific presentation and files' },
  { kind: 'ownership', label: 'Ownership group', helper: 'PE / common-owner roll-up (e.g. Redwood)' },
  { kind: 'affinity', label: 'Affinity group', helper: 'Buying-group relationship (e.g. NexStar)' },
  { kind: 'region', label: 'Region', helper: 'US / Canada / state-specific view' },
  { kind: 'independent', label: 'Independent', helper: 'Dealers without group relationships' },
  { kind: 'standard', label: 'Standard', helper: 'The default catalog everyone else sees' },
];

function ladderLabel(kind: string | undefined) {
  return PRECEDENCE_LADDER.find((rung) => rung.kind === kind)?.label ?? (kind ?? 'Standard');
}

function buildWhyExplanation(preview: DealerPortalInternalPreviewResponse): string {
  const view = preview.catalog.catalogView;
  const membership = preview.diagnostics.membershipContext;
  const resolution = preview.diagnostics.catalogResolution;

  if (!view) {
    if (membership && !membership.portalEligible) {
      return 'This account is not portal-eligible, so no dealer catalog resolves for it.';
    }
    return 'No catalog view matched this account — it falls back to having no portal catalog until a view or rule covers it.';
  }

  const winner = ladderLabel(view.kind);
  const parts: string[] = [];

  if (resolution.source === 'rule' && resolution.ruleName) {
    parts.push(`Matched by the “${resolution.ruleName}” rule`);
  } else if (resolution.source === 'default') {
    parts.push('No rule matched, so the default catalog view applies');
  }

  const groupFacts: string[] = [];
  if (membership?.ownershipGroupName) {
    groupFacts.push(`Ownership: ${membership.ownershipGroupName}`);
  }
  if (membership?.affinityGroupName) {
    groupFacts.push(`Affinity: ${membership.affinityGroupName}`);
  }
  if (membership?.regionName || membership?.regionCode) {
    groupFacts.push(`Region: ${membership.regionName ?? membership.regionCode}`);
  }

  if (membership?.ownershipGroupName && membership?.affinityGroupName) {
    // The hybrid case — explain the tiebreak in plain English.
    if (view.kind === 'ownership') {
      parts.push(`this dealer is in both groups (${groupFacts.join(' · ')}), and Ownership group outranks Affinity group on the ladder`);
    } else if (view.kind === 'affinity') {
      parts.push(`this dealer is in both groups (${groupFacts.join(' · ')}), and the affinity view won here — an ownership-level view is not configured for this group`);
    } else {
      parts.push(`group context: ${groupFacts.join(' · ')}`);
    }
  } else if (groupFacts.length > 0) {
    parts.push(`group context: ${groupFacts.join(' · ')}`);
  }

  const sentence = parts.length > 0 ? `${parts.join('; ')}.` : 'Resolved from the catalog view assignments.';
  return `“${view.name}” (${winner}) won. ${sentence} An account exception would override all of this.`;
}

export function DealerCatalogPreview() {
  const { auth, apiBaseUrl } = usePulseSession();
  const accessToken = auth?.tokens.accessToken ?? '';

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DealerPortalInternalPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    fetchAccounts(apiBaseUrl, accessToken, { limit: 100 })
      .then((response) => {
        if (!cancelled) setAccounts(response.items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Could not load accounts.');
      });
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, accessToken]);

  const loadPreview = useCallback(
    async (accountId: string) => {
      if (!accessToken) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetchDealerPortalInternalPreview(apiBaseUrl, accessToken, accountId, 'purchasing');
        setPreview(response);
      } catch (error) {
        setPreview(null);
        setErrorMessage(error instanceof Error ? error.message : 'Could not load the dealer preview.');
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl, accessToken],
  );

  useEffect(() => {
    if (selectedAccountId) {
      void loadPreview(selectedAccountId);
    }
  }, [selectedAccountId, loadPreview]);

  const view = preview?.catalog.catalogView;
  const winningKind = view?.kind;
  const membership = preview?.diagnostics.membershipContext;

  return (
    <Stack gap="lg">
      <Alert color="blue" variant="light" icon={<IconInfoCircle size={18} />} title="See the portal exactly as a dealer sees it">
        Pick an account: you get the catalog view that wins for that dealer, why it wins, and the
        products and files their portal shows. This is the fastest way to sanity-check group and
        brand presentation before a dealer ever logs in.
      </Alert>

      <Select
        label="Preview as account"
        placeholder="Search accounts…"
        searchable
        clearable
        data={accounts.map((account) => ({ value: account.id, label: account.displayName }))}
        value={selectedAccountId}
        onChange={setSelectedAccountId}
        maw={420}
        leftSection={<IconEye size={16} />}
      />

      {errorMessage ? (
        <Alert color="red" variant="light" title="Preview unavailable">
          {errorMessage}
        </Alert>
      ) : null}

      {isLoading ? (
        <Group gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Resolving this dealer’s catalog…</Text>
        </Group>
      ) : null}

      {preview && !isLoading ? (
        <>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Card withBorder radius="md" padding="lg">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb={4}>Resolved catalog view</Text>
              {view ? (
                <>
                  <Group gap="sm" mb="xs">
                    <Text fw={700}>{view.name}</Text>
                    <Badge variant="light">{ladderLabel(view.kind)}</Badge>
                  </Group>
                  <Text size="sm" c="dimmed">{buildWhyExplanation(preview)}</Text>
                  <Group gap="lg" mt="md">
                    <div>
                      <Text size="xs" c="dimmed">Visible products</Text>
                      <Text fw={700}>{preview.visibleProductCount}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Visible files</Text>
                      <Text fw={700}>{preview.visibleFileCount}</Text>
                    </div>
                    {membership?.groupClassification ? (
                      <div>
                        <Text size="xs" c="dimmed">Classification</Text>
                        <Text fw={700} tt="capitalize">{membership.groupClassification.replace(/_/g, ' ').toLowerCase()}</Text>
                      </div>
                    ) : null}
                  </Group>
                </>
              ) : (
                <Text size="sm" c="dimmed">{buildWhyExplanation(preview)}</Text>
              )}
            </Card>

            <Card withBorder radius="md" padding="lg">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700} mb="xs">Who wins — strongest first</Text>
              <Stack gap={6}>
                {PRECEDENCE_LADDER.map((rung) => {
                  const isWinner = rung.kind === winningKind;
                  return (
                    <Group key={rung.kind} gap="sm" wrap="nowrap">
                      <Badge
                        variant={isWinner ? 'filled' : 'light'}
                        color={isWinner ? 'blue' : 'gray'}
                        miw={140}
                      >
                        {rung.label}
                      </Badge>
                      <Text size="xs" {...(isWinner ? {} : { c: 'dimmed' })} fw={isWinner ? 600 : 400}>
                        {isWinner ? `← this dealer’s view (${rung.helper.toLowerCase()})` : rung.helper}
                      </Text>
                    </Group>
                  );
                })}
              </Stack>
            </Card>
          </SimpleGrid>

          <Card withBorder radius="md" padding="lg">
            <Group justify="space-between" mb="sm">
              <Text fw={700}>What this dealer sees</Text>
              <Text size="sm" c="dimmed">{preview.catalog.products.length} product{preview.catalog.products.length === 1 ? '' : 's'}</Text>
            </Group>
            {preview.catalog.products.length === 0 ? (
              <Text size="sm" c="dimmed">
                The resolved view has no published products yet — publish presentations into it from the
                Catalog views tab.
              </Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Family</Table.Th>
                    <Table.Th>Brand</Table.Th>
                    <Table.Th>Files</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {preview.catalog.products.slice(0, 25).map((product) => (
                    <Table.Tr key={product.presentationId}>
                      <Table.Td>
                        <Text size="sm" fw={600}>{product.displayName}</Text>
                        <Text size="xs" c="dimmed">{product.sku}</Text>
                      </Table.Td>
                      <Table.Td>{product.familyName ?? '—'}</Table.Td>
                      <Table.Td>{product.brandLabel ?? '—'}</Table.Td>
                      <Table.Td>{product.assets.length}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
            {preview.catalog.products.length > 25 ? (
              <Text size="xs" c="dimmed" mt="xs">Showing the first 25 of {preview.catalog.products.length} products.</Text>
            ) : null}
          </Card>
        </>
      ) : null}

      {!preview && !isLoading && !errorMessage ? (
        <Card withBorder radius="md" padding="xl">
          <Stack align="center" gap="xs">
            <IconEye size={28} stroke={1.5} />
            <Text fw={600}>Pick an account to preview</Text>
            <Text size="sm" c="dimmed" ta="center" maw={460}>
              The preview answers “what does this dealer actually see?” — resolved branding, products,
              files, and the exact reason that version won.
            </Text>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}

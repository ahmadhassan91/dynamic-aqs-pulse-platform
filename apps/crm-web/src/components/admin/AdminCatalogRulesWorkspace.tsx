'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  Loader,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChecks, IconEye, IconPlus, IconShieldCheck } from '@tabler/icons-react';
import type {
  CatalogRuleConditionFieldKey,
  CatalogRuleConditionOperatorKey,
  CatalogRuleDraftInput,
  CatalogRulePreviewResponse,
  CatalogRuleSetSummary,
  DealerCatalogViewSummary,
} from '@pulse/contracts/product-management';
import {
  activateCatalogRuleSet,
  createCatalogRuleSet,
  fetchCatalogRuleSets,
  fetchDealerCatalogViews,
  previewCatalogRuleSet,
  updateCatalogRuleSet,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type EditableRule = {
  name: string;
  field: CatalogRuleConditionFieldKey;
  operator: CatalogRuleConditionOperatorKey;
  value: string;
  result: string;
  priority: number;
};

const conditionFields: Array<{ value: CatalogRuleConditionFieldKey; label: string }> = [
  { value: 'affinity_group', label: 'Affinity Group' },
  { value: 'ownership_group', label: 'Ownership / PE Group' },
  { value: 'region', label: 'Region / Country' },
  { value: 'brand_label', label: 'Brand / Private Label' },
  { value: 'portal_eligible', label: 'Portal Eligible' },
  { value: 'independent', label: 'Independent' },
];

const operators: Array<{ value: CatalogRuleConditionOperatorKey; label: string }> = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
  { value: 'is_any', label: 'any value' },
];

const ruleTemplates: Array<{ label: string; description: string; rule: EditableRule }> = [
  {
    label: 'Affinity',
    description: 'Buying group or coaching network gets its catalog.',
    rule: { name: 'Affinity group gets matching catalog', field: 'affinity_group', operator: 'is', value: '', result: '', priority: 10 },
  },
  {
    label: 'Ownership / PE',
    description: 'Parent company or PE group gets reviewed or assigned.',
    rule: { name: 'Ownership / PE group gets matching catalog', field: 'ownership_group', operator: 'is', value: '', result: '', priority: 20 },
  },
  {
    label: 'Independent',
    description: 'Dealers without affinity or ownership use the independent catalog.',
    rule: { name: 'Independent dealers get independent catalog', field: 'independent', operator: 'is', value: 'yes', result: '', priority: 80 },
  },
  {
    label: 'Needs Review',
    description: 'Stop ambiguous accounts until an admin confirms.',
    rule: { name: 'Needs review before catalog publish', field: 'ownership_group', operator: 'is_not_empty', value: '', result: 'review', priority: 5 },
  },
];

export function AdminCatalogRulesWorkspace() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken;
  const [ruleSets, setRuleSets] = useState<CatalogRuleSetSummary[]>([]);
  const [catalogViews, setCatalogViews] = useState<DealerCatalogViewSummary[]>([]);
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>('');
  const [name, setName] = useState('Dealer Catalog Rules');
  const [description, setDescription] = useState('Simple rules for who sees each dealer catalog view.');
  const [rules, setRules] = useState<EditableRule[]>([newBlankRule()]);
  const [preview, setPreview] = useState<CatalogRulePreviewResponse | null>(null);
  const [lastPreviewDraft, setLastPreviewDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedRuleSet = useMemo(
    () => ruleSets.find((ruleSet) => ruleSet.id === selectedRuleSetId) ?? null,
    [ruleSets, selectedRuleSetId],
  );
  const activeRuleSet = ruleSets.find((ruleSet) => ruleSet.isActive);
  const resultOptions = catalogViews.map((view) => ({ value: view.id, label: view.name }));
  const currentDraft = useMemo(() => JSON.stringify({ name, description, rules }), [description, name, rules]);
  const publishBlocked = !preview || lastPreviewDraft !== currentDraft || preview.unmatchedCount > 0 || preview.reviewRequiredCount > 0;

  useEffect(() => {
    if (!isHydrated || !accessToken) return;
    const token = accessToken;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [nextRuleSets, nextViews] = await Promise.all([
          fetchCatalogRuleSets(apiBaseUrl, token),
          fetchDealerCatalogViews(apiBaseUrl, token, { isActive: true }),
        ]);
        if (cancelled) return;
        setRuleSets(nextRuleSets.items);
        setCatalogViews(nextViews.items);
        const firstDraft = nextRuleSets.items.find((item) => item.status !== 'active') ?? nextRuleSets.items[0];
        if (firstDraft) loadRuleSetIntoForm(firstDraft);
      } catch (error) {
        if (!cancelled) notifications.show({ color: 'red', title: 'Catalog rules did not load', message: error instanceof Error ? error.message : String(error) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, accessToken, isHydrated]);

  function loadRuleSetIntoForm(ruleSet: CatalogRuleSetSummary) {
    setSelectedRuleSetId(ruleSet.id);
    setName(ruleSet.name);
    setDescription(ruleSet.description ?? '');
    setRules(ruleSet.rules.length ? ruleSet.rules.map((rule) => ({
      name: rule.name,
      field: rule.conditions[0]?.field ?? 'affinity_group',
      operator: rule.conditions[0]?.operator ?? 'is',
      value: String(rule.conditions[0]?.value ?? ''),
      result: rule.dealerCatalogViewId ?? '',
      priority: rule.priority,
    })) : [newBlankRule()]);
    setPreview(null);
    setLastPreviewDraft('');
  }

  async function saveDraft() {
    if (!accessToken) return;
    const payload = { name, description, rules: buildRulePayload() };
    setSaving(true);
    try {
      const saved = selectedRuleSetId
        ? await updateCatalogRuleSet(apiBaseUrl, accessToken, selectedRuleSetId, payload)
        : await createCatalogRuleSet(apiBaseUrl, accessToken, payload);
      setRuleSets((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      loadRuleSetIntoForm(saved);
      notifications.show({ color: 'green', title: 'Draft saved', message: 'Catalog rules are ready to preview.' });
    } catch (error) {
      notifications.show({ color: 'red', title: 'Draft was not saved', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    if (!accessToken || !selectedRuleSetId) return;
    const result = await previewCatalogRuleSet(apiBaseUrl, accessToken, selectedRuleSetId, { rules: buildRulePayload(), sampleLimit: 25 });
    setPreview(result);
    setLastPreviewDraft(currentDraft);
    return result;
  }

  async function previewImpact() {
    setSaving(true);
    try {
      const result = await runPreview();
      if (result) notifications.show({ color: result.warnings.length ? 'yellow' : 'green', title: 'Preview complete', message: `${result.matchedCount} sampled accounts matched.` });
    } catch (error) {
      notifications.show({ color: 'red', title: 'Preview failed', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  async function publishRules() {
    if (!accessToken || !selectedRuleSetId) return;
    setSaving(true);
    try {
      const resultPreview = await runPreview();
      if (!resultPreview || resultPreview.unmatchedCount > 0 || resultPreview.reviewRequiredCount > 0) {
        notifications.show({
          color: 'yellow',
          title: 'Preview needs cleanup',
          message: 'Fix unmatched accounts or review-required rules before publishing.',
        });
        return;
      }
      const result = await activateCatalogRuleSet(apiBaseUrl, accessToken, selectedRuleSetId);
      setRuleSets((current) => [result.activeRuleSet, ...current.filter((item) => item.id !== result.activeRuleSet.id).map((item) => result.retiredRuleSetIds.includes(item.id) ? { ...item, status: 'retired' as const, isActive: false } : item)]);
      loadRuleSetIntoForm(result.activeRuleSet);
      notifications.show({ color: 'green', title: 'Catalog rules published', message: 'This rule set is now active.' });
    } catch (error) {
      notifications.show({ color: 'red', title: 'Rules were not published', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function buildRulePayload(): CatalogRuleDraftInput[] {
    return rules.map((rule) => ({
      name: rule.name,
      priority: rule.priority,
      conditions: [{
        field: rule.field,
        operator: rule.operator,
        ...(rule.operator === 'is_empty' || rule.operator === 'is_not_empty' || rule.operator === 'is_any' ? {} : { value: normalizeRuleValue(rule) }),
      }],
      resultAction: rule.result === 'review' ? 'require_review' : 'assign_catalog_view',
      dealerCatalogViewId: rule.result === 'review' ? null : rule.result,
      requireReviewReason: rule.result === 'review' ? 'Admin review required before the catalog view is assigned.' : null,
      isEnabled: true,
    }));
  }

  if (loading) {
    return <Loader />;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>Catalog Rules</Title>
          <Text c="dimmed">Decide who sees each dealer catalog view. Pricing stays in Acumatica.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} variant="light" onClick={() => {
          setSelectedRuleSetId('');
          setName('Dealer Catalog Rules');
          setDescription('Simple rules for who sees each dealer catalog view.');
          setRules([newBlankRule()]);
          setPreview(null);
        }}>
          New Draft
        </Button>
      </Group>

      <Alert color="blue" title="Keep it simple">
        Rules use the same inputs Dynamic discussed: affinity group, ownership/PE group, independent, region, brand, and portal eligibility. Price class is not used for catalog or file visibility.
      </Alert>
      <Alert color="gray" title="How to think about it">
        Affinity and ownership/PE are account labels. Independent means neither label applies. The rule outcome is the Dealer Catalog View that controls products and files.
      </Alert>

      <SimpleGrid cols={{ base: 1, md: 4 }}>
        <Metric label="Rule Sets" value={ruleSets.length} />
        <Metric label="Active Set" value={activeRuleSet ? '1' : '0'} {...(activeRuleSet?.name ? { helper: activeRuleSet.name } : {})} />
        <Metric label="Catalog Views" value={catalogViews.length} />
        <Metric label="Preview Matches" value={preview?.matchedCount ?? 0} />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper withBorder p="lg" radius="md">
          <Stack>
            <Group justify="space-between">
              <Title order={2}>Draft Rules</Title>
              {selectedRuleSet ? <Badge>{selectedRuleSet.status.replace(/_/g, ' ')}</Badge> : <Badge color="gray">new draft</Badge>}
            </Group>
            <TextInput label="Rule set name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
            <Textarea label="Notes" minRows={2} value={description} onChange={(event) => setDescription(event.currentTarget.value)} />
            <Paper withBorder p="md" radius="md" bg="gray.0">
              <Stack gap="xs">
                <Text fw={700}>Start from a simple rule</Text>
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  {ruleTemplates.map((template) => (
                    <Paper key={template.label} withBorder p="sm" radius="sm">
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={700}>{template.label}</Text>
                          <Text size="xs" c="dimmed">{template.description}</Text>
                        </div>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => setRules((current) => [...current, { ...template.rule, priority: (current.length + 1) * 10 }])}
                        >
                          Add
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
                <Text size="sm" c="dimmed">Templates only fill the rule shape. Choose the actual group value and catalog view before saving.</Text>
              </Stack>
            </Paper>
            <Divider />
            {rules.map((rule, index) => (
              <Paper key={index} withBorder p="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={700}>Rule {index + 1}</Text>
                    <Button size="xs" variant="subtle" color="red" disabled={rules.length === 1} onClick={() => setRules((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                      Remove
                    </Button>
                  </Group>
                  <TextInput label="Rule name" value={rule.name} onChange={(event) => updateRule(index, { name: event.currentTarget.value })} />
                  <SimpleGrid cols={{ base: 1, md: 3 }}>
                    <Select label="When" data={conditionFields} value={rule.field} onChange={(value) => updateRule(index, { field: (value as CatalogRuleConditionFieldKey) ?? 'affinity_group' })} />
                    <Select label="Match" data={operators} value={rule.operator} onChange={(value) => updateRule(index, { operator: (value as CatalogRuleConditionOperatorKey) ?? 'is' })} />
                    {isBooleanConditionField(rule.field) ? (
                      <Select
                        label="Value"
                        data={[
                          { value: 'yes', label: 'Yes' },
                          { value: 'no', label: 'No' },
                        ]}
                        value={rule.value || 'yes'}
                        disabled={['is_any', 'is_empty', 'is_not_empty'].includes(rule.operator)}
                        onChange={(value) => updateRule(index, { value: value ?? 'yes' })}
                        allowDeselect={false}
                      />
                    ) : (
                      <TextInput label="Value" value={rule.value} disabled={['is_any', 'is_empty', 'is_not_empty'].includes(rule.operator)} onChange={(event) => updateRule(index, { value: event.currentTarget.value })} />
                    )}
                  </SimpleGrid>
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <Select label="Then assign Dealer Catalog View" data={[...resultOptions, { value: 'review', label: 'Require Review' }]} value={rule.result} onChange={(value) => updateRule(index, { result: value ?? '' })} />
                    <NumberInput label="Order" value={rule.priority} min={1} onChange={(value) => updateRule(index, { priority: Number(value) || 100 })} />
                  </SimpleGrid>
                </Stack>
              </Paper>
            ))}
            <Group>
              <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => setRules((current) => [...current, newBlankRule(current.length)])}>Add Rule</Button>
              <Button leftSection={<IconChecks size={16} />} loading={saving} onClick={saveDraft}>Save Draft</Button>
              <Button variant="outline" leftSection={<IconEye size={16} />} disabled={!selectedRuleSetId} loading={saving} onClick={previewImpact}>Preview Impact</Button>
              <Button color="green" leftSection={<IconShieldCheck size={16} />} disabled={!selectedRuleSetId || publishBlocked} loading={saving} onClick={publishRules}>Publish</Button>
            </Group>
            {publishBlocked ? (
              <Text size="sm" c="dimmed">Preview must show no unmatched accounts and no review-required accounts before publishing.</Text>
            ) : null}
          </Stack>
        </Paper>

        <Paper withBorder p="lg" radius="md">
          <Stack>
            <Title order={2}>Rule Sets</Title>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Rules</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ruleSets.map((ruleSet) => (
                  <Table.Tr key={ruleSet.id} style={{ cursor: 'pointer' }} onClick={() => loadRuleSetIntoForm(ruleSet)}>
                    <Table.Td>{ruleSet.name}</Table.Td>
                    <Table.Td><Badge color={ruleSet.isActive ? 'green' : 'gray'}>{ruleSet.status}</Badge></Table.Td>
                    <Table.Td>{ruleSet.rules.length}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="lg" radius="md">
        <Group justify="space-between">
          <Title order={2}>Preview</Title>
          {preview ? <Badge color={preview.warnings.length ? 'yellow' : 'green'}>{preview.sampleAccountCount} sampled accounts</Badge> : null}
        </Group>
        {preview?.warnings.length ? (
          <Alert color="yellow" mt="md" title="Needs review">{preview.warnings.join(' ')}</Alert>
        ) : null}
        {preview && !preview.warnings.length ? (
          <Alert color="green" mt="md" title="Ready to publish">All sampled accounts matched a catalog view without review warnings.</Alert>
        ) : null}
        <Table mt="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Account</Table.Th>
              <Table.Th>Affinity</Table.Th>
              <Table.Th>Ownership / PE</Table.Th>
              <Table.Th>Classification</Table.Th>
              <Table.Th>Rule</Table.Th>
              <Table.Th>Catalog View</Table.Th>
              <Table.Th>Decision</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(preview?.rows ?? []).map((row) => (
              <Table.Tr key={row.accountId}>
                <Table.Td>{row.accountName}</Table.Td>
                <Table.Td>{row.affinityGroup ?? '-'}</Table.Td>
                <Table.Td>{row.ownershipGroup ?? '-'}</Table.Td>
                <Table.Td>{row.classification ?? '-'}</Table.Td>
                <Table.Td>{row.matchedRuleName ?? 'No match'}</Table.Td>
                <Table.Td>{row.dealerCatalogViewName ?? 'Review needed'}</Table.Td>
                <Table.Td>{row.warning ?? 'Catalog view assigned'}</Table.Td>
                <Table.Td><Badge color={row.warning ? 'yellow' : 'green'}>{row.warning ? 'Needs Review' : 'Ready'}</Badge></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {preview?.catalogViewImpacts.length ? (
          <>
            <Title order={3} mt="lg">Products and Files Affected</Title>
            <Table mt="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Catalog View</Table.Th>
                  <Table.Th>Accounts</Table.Th>
                  <Table.Th>Products shown</Table.Th>
                  <Table.Th>Ready products</Table.Th>
                  <Table.Th>Files linked</Table.Th>
                  <Table.Th>Missing setup</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.catalogViewImpacts.map((impact) => (
                  <Table.Tr key={impact.dealerCatalogViewId}>
                    <Table.Td>{impact.dealerCatalogViewName}</Table.Td>
                    <Table.Td>{impact.matchedAccountCount}</Table.Td>
                    <Table.Td>{impact.visibleProductCount}</Table.Td>
                    <Table.Td>{impact.readyProductCount}</Table.Td>
                    <Table.Td>{impact.linkedFileCount}</Table.Td>
                    <Table.Td>
                      <Badge color={impact.missingSetupCount ? 'yellow' : 'green'}>
                        {impact.missingSetupCount}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        ) : null}
      </Paper>
    </Stack>
  );

  function updateRule(index: number, patch: Partial<EditableRule>) {
    setRules((current) => current.map((rule, currentIndex) => currentIndex === index ? { ...rule, ...patch } : rule));
  }
}

function Metric({ label, value, helper }: { label: string; value: string | number; helper?: string }) {
  return (
    <Paper withBorder p="md" radius="md">
      <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
      <Text fz={28} fw={800}>{value}</Text>
      {helper ? <Text size="sm" c="dimmed" lineClamp={1}>{helper}</Text> : null}
    </Paper>
  );
}

function newBlankRule(index = 0): EditableRule {
  return {
    name: index === 0 ? 'Affinity group gets matching catalog' : 'New catalog rule',
    field: 'affinity_group',
    operator: 'is',
    value: '',
    result: '',
    priority: (index + 1) * 10,
  };
}

function normalizeRuleValue(rule: EditableRule) {
  if (rule.field === 'independent' || rule.field === 'portal_eligible') {
    return ['true', 'yes', '1'].includes(rule.value.trim().toLowerCase());
  }
  return rule.value.trim();
}

function isBooleanConditionField(field: CatalogRuleConditionFieldKey) {
  return field === 'independent' || field === 'portal_eligible';
}

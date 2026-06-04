'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Menu,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChecks, IconDotsVertical, IconEye, IconPlus, IconShieldCheck } from '@tabler/icons-react';
import type {
  CatalogRuleConditionFieldKey,
  CatalogRuleConditionOption,
  CatalogRuleConditionOperatorKey,
  CatalogRuleCatalogViewImpact,
  CatalogRuleDraftInput,
  CatalogRulePreviewRow,
  CatalogRulePreviewResponse,
  CatalogRuleSetSummary,
  DealerCatalogViewSummary,
} from '@pulse/contracts/product-management';
import {
  activateCatalogRuleSet,
  createCatalogRuleSet,
  fetchCatalogRuleConditionOptions,
  fetchCatalogRuleSets,
  fetchDealerCatalogViews,
  previewCatalogRuleSet,
  updateCatalogRuleSet,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import {
  EmptyStateMessage,
  WorkbenchAdvancedSection,
  WorkbenchHeader,
  WorkbenchMetricStrip,
  WorkbenchTable,
} from '@/components/ui/Workbench';

type RuleWizardStep = 'draft' | 'preview' | 'publish';

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

const ruleWizardSteps: RuleWizardStep[] = ['draft', 'preview', 'publish'];
const ruleWizardStepMeta: Record<RuleWizardStep, { label: string; description: string }> = {
  draft: { label: 'Draft', description: 'Build rules' },
  preview: { label: 'Preview', description: 'Check accounts' },
  publish: { label: 'Publish', description: 'Activate safely' },
};

export function AdminCatalogRulesWorkspace() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const accessToken = auth?.tokens.accessToken;
  const [ruleSets, setRuleSets] = useState<CatalogRuleSetSummary[]>([]);
  const [catalogViews, setCatalogViews] = useState<DealerCatalogViewSummary[]>([]);
  const [conditionOptions, setConditionOptions] = useState<{
    affinityGroups: CatalogRuleConditionOption[];
    ownershipGroups: CatalogRuleConditionOption[];
    regions: CatalogRuleConditionOption[];
    dealerCatalogViews: CatalogRuleConditionOption[];
  }>({ affinityGroups: [], ownershipGroups: [], regions: [], dealerCatalogViews: [] });
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>('');
  const [name, setName] = useState('Dealer Catalog Rules');
  const [description, setDescription] = useState('Simple rules for who sees each dealer catalog view.');
  const [rules, setRules] = useState<EditableRule[]>([newBlankRule()]);
  const [preview, setPreview] = useState<CatalogRulePreviewResponse | null>(null);
  const [lastPreviewDraft, setLastPreviewDraft] = useState('');
  const [wizardStep, setWizardStep] = useState<RuleWizardStep>('draft');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedRuleSet = useMemo(
    () => ruleSets.find((ruleSet) => ruleSet.id === selectedRuleSetId) ?? null,
    [ruleSets, selectedRuleSetId],
  );
  const activeRuleSet = ruleSets.find((ruleSet) => ruleSet.isActive);
  const resultOptions = conditionOptions.dealerCatalogViews.length
    ? conditionOptions.dealerCatalogViews.map((view) => ({ value: view.value, label: view.helper ? `${view.label} (${view.helper})` : view.label }))
    : catalogViews.map((view) => ({ value: view.id, label: view.name }));
  const currentDraft = useMemo(() => JSON.stringify({ name, description, rules }), [description, name, rules]);
  const previewIsStale = Boolean(preview && lastPreviewDraft !== currentDraft);
  const publishBlockers = [
    !selectedRuleSetId ? 'Save a draft before publishing.' : null,
    !preview ? 'Run preview before publishing.' : null,
    previewIsStale ? 'Preview is stale. Run preview again after draft changes.' : null,
    preview?.unmatchedCount ? 'Some sampled accounts do not match any rule.' : null,
    preview?.reviewRequiredCount ? 'Some sampled accounts still require review.' : null,
  ].filter((blocker): blocker is string => Boolean(blocker));
  const publishBlocked = publishBlockers.length > 0;
  const wizardStepIndex = Math.max(0, ruleWizardSteps.indexOf(wizardStep));

  useEffect(() => {
    if (!isHydrated || !accessToken) return;
    const token = accessToken;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [nextRuleSets, nextViews, nextOptions] = await Promise.all([
          fetchCatalogRuleSets(apiBaseUrl, token),
          fetchDealerCatalogViews(apiBaseUrl, token, { isActive: true }),
          fetchCatalogRuleConditionOptions(apiBaseUrl, token),
        ]);
        if (cancelled) return;
        setRuleSets(nextRuleSets.items);
        setCatalogViews(nextViews.items);
        setConditionOptions(nextOptions);
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
      result: rule.resultAction === 'require_review' ? 'review' : rule.dealerCatalogViewId ?? '',
      priority: rule.priority,
    })) : [newBlankRule()]);
    setPreview(null);
    setLastPreviewDraft('');
  }

  async function saveDraft() {
    if (!accessToken) return;
    const duplicatePriorities = findDuplicatePriorities(rules);
    if (duplicatePriorities.length) {
      notifications.show({
        color: 'yellow',
        title: 'Fix duplicate priorities',
        message: `Each rule needs a unique priority. Duplicate values: ${duplicatePriorities.join(', ')}.`,
      });
      return;
    }
    const payload = { name, description, rules: buildRulePayload() };
    setSaving(true);
    try {
      const saved = selectedRuleSetId
        ? await updateCatalogRuleSet(apiBaseUrl, accessToken, selectedRuleSetId, payload)
        : await createCatalogRuleSet(apiBaseUrl, accessToken, payload);
      setRuleSets((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      loadRuleSetIntoForm(saved);
      setWizardStep('preview');
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
      if (result) {
        setWizardStep('preview');
        notifications.show({
          color: result.warnings.length ? 'yellow' : 'green',
          title: 'Preview ran',
          message: `${result.matchedCount} matched, ${result.reviewRequiredCount} need review, ${result.unmatchedCount} have no rule.`,
        });
      }
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
      setWizardStep('publish');
      notifications.show({ color: 'green', title: 'Rule set is active', message: 'Pulse will use it to resolve dealer groups.' });
    } catch (error) {
      notifications.show({ color: 'red', title: 'Rules were not published', message: error instanceof Error ? error.message : String(error) });
    } finally {
      setSaving(false);
    }
  }

  function resetDraft() {
    setSelectedRuleSetId('');
    setName('Dealer Group Rules');
    setDescription('Simple rules for which dealer group each account belongs to.');
    setRules([newBlankRule()]);
    setPreview(null);
    setLastPreviewDraft('');
    setWizardStep('draft');
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
      requireReviewReason: rule.result === 'review' ? 'Independent or hybrid account needs admin review before catalog view assignment.' : null,
      isEnabled: true,
    }));
  }

  if (loading) {
    return <Loader aria-label="Loading catalog rules" />;
  }

  return (
    <Stack gap="lg" data-testid="admin-catalog-rules-workspace">
      <WorkbenchHeader
        eyebrow="Admin setup"
        title="Dealer Group Rules"
        description="Create rules that resolve each account to a dealer group. Preview before publishing so unclear accounts go to review instead of the wrong catalog."
        policyText="Dealer groups control product, file, branding, and portal visibility. Price class stays in pricing/reporting and is not used here."
      />

      <Paper withBorder p="lg" radius="md" className="premium-detail-card">
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" data-testid="catalog-rules-step-indicator">
          {ruleWizardSteps.map((step, index) => {
            const meta = ruleWizardStepMeta[step];
            const isActive = step === wizardStep;
            const isDone = index < wizardStepIndex;
            return (
              <Box
                key={step}
                p="sm"
                style={(theme) => ({
                  background: isActive ? theme.colors.blue[0] : isDone ? theme.colors.green[0] : theme.colors.gray[0],
                  border: `1px solid ${isActive ? theme.colors.blue[3] : theme.colors.gray[3]}`,
                  borderRadius: theme.radius.md,
                })}
              >
                <Group gap="sm" wrap="nowrap">
                  <Box
                    aria-hidden="true"
                    style={(theme) => ({
                      alignItems: 'center',
                      background: isActive ? theme.colors.blue[6] : isDone ? theme.colors.green[6] : theme.colors.gray[5],
                      borderRadius: 999,
                      color: theme.white,
                      display: 'flex',
                      flex: '0 0 28px',
                      fontSize: theme.fontSizes.xs,
                      fontWeight: 800,
                      height: 28,
                      justifyContent: 'center',
                      width: 28,
                    })}
                  >
                    {index + 1}
                  </Box>
                  <Stack gap={0}>
                    <Text fw={800}>{meta.label}</Text>
                    <Text size="xs" c="dimmed">{meta.description}</Text>
                  </Stack>
                </Group>
              </Box>
            );
          })}
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
        <MetricCard label="Active rule set" value={activeRuleSet ? '1' : '0'} helper={activeRuleSet?.name ?? 'No active rules'} />
        <MetricCard label="Drafts" value={String(ruleSets.filter((ruleSet) => ruleSet.status !== 'active').length)} helper="Saved rule versions" />
        <MetricCard label="Dealer groups" value={String(catalogViews.length)} helper="Available visibility targets" />
        <MetricCard label="Preview status" value={preview ? (publishBlocked ? 'Needs work' : 'Clean') : 'Not run'} helper={previewIsStale ? 'Preview is stale' : preview ? `${preview.matchedCount} matched` : 'Save, then preview'} />
      </SimpleGrid>

      {wizardStep === 'draft' ? (
        <Paper withBorder p="lg" radius="md" data-testid="catalog-rules-draft-step">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={2}>Draft Rule Set</Title>
              {selectedRuleSet ? <Badge>{selectedRuleSet.status.replace(/_/g, ' ')}</Badge> : <Badge color="gray">new draft</Badge>}
            </Group>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="Rule set name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
                data-testid="catalog-rule-set-name"
              />
              <Textarea
                label="Notes"
                minRows={1}
                value={description}
                onChange={(event) => setDescription(event.currentTarget.value)}
                data-testid="catalog-rule-set-notes"
              />
            </SimpleGrid>
            <WorkbenchAdvancedSection
              title="Use template"
              description="Optional starting points for affinity, ownership/PE, independent, and review rules."
            >
              <Stack gap="xs" mt="sm">
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
                          aria-label={`Add ${template.label} rule template`}
                          onClick={() => setRules((current) => [...current, { ...template.rule, priority: (current.length + 1) * 10 }])}
                        >
                          Add
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
                <Text size="sm" c="dimmed">Templates only fill the rule shape. Choose the actual group value and dealer group before saving.</Text>
              </Stack>
            </WorkbenchAdvancedSection>
            {rules.map((rule, index) => (
              <Paper key={index} withBorder p="md" radius="md" data-testid={`catalog-rule-card-${index}`}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Text fw={700}>Rule {index + 1}</Text>
                      <Text size="sm" c="dimmed">
                        {formatRuleSentence(rule, resultOptions)}
                      </Text>
                    </Stack>
                    <Menu position="bottom-end" withinPortal shadow="md" width={180}>
                      <Menu.Target>
                        <Button
                          size="xs"
                          variant="subtle"
                          aria-label={`Rule ${index + 1} actions`}
                          rightSection={<IconDotsVertical size={14} />}
                        >
                          More
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          color="red"
                          disabled={rules.length === 1}
                          onClick={() => setRules((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                        >
                          Remove rule
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                  <TextInput label="Rule name" value={rule.name} onChange={(event) => updateRule(index, { name: event.currentTarget.value })} />
                  <SimpleGrid cols={{ base: 1, md: 3 }}>
                    <Select
                      label="When"
                      aria-label={`Rule ${index + 1} account condition`}
                      data={conditionFields}
                      value={rule.field}
                      onChange={(value) => changeRuleField(index, (value as CatalogRuleConditionFieldKey) ?? 'affinity_group')}
                      data-testid={`catalog-rule-field-${index}`}
                    />
                    <Select
                      label="Match"
                      aria-label={`Rule ${index + 1} match operator`}
                      data={operators}
                      value={rule.operator}
                      onChange={(value) => updateRule(index, { operator: (value as CatalogRuleConditionOperatorKey) ?? 'is' })}
                      data-testid={`catalog-rule-operator-${index}`}
                    />
                    {renderConditionValueControl(rule, index)}
                  </SimpleGrid>
                  <Text size="xs" c="dimmed">
                    {rule.field === 'independent'
                      ? 'Independent means no confirmed affinity/franchise and no confirmed ownership/PE.'
                      : 'Values come from approved reference lists so catalog matching does not depend on spelling.'}
                  </Text>
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <Select
                      label="Then assign dealer group"
                      data={[...resultOptions, { value: 'review', label: 'Require review - unclear catalog context' }]}
                      value={rule.result}
                      onChange={(value) => updateRule(index, { result: value ?? '' })}
                      data-testid={`catalog-rule-decision-${index}`}
                    />
                    <NumberInput
                      label="Priority"
                      value={rule.priority}
                      min={1}
                      onChange={(value) => updateRule(index, { priority: Number(value) || 100 })}
                      data-testid={`catalog-rule-priority-${index}`}
                    />
                  </SimpleGrid>
                </Stack>
              </Paper>
            ))}
            <Group justify="space-between">
              <Button variant="default" leftSection={<IconPlus size={16} />} onClick={() => setRules((current) => [...current, newBlankRule(current.length)])}>
                Add rule
              </Button>
              <Group gap="sm">
                <Button variant="default" onClick={resetDraft}>New draft</Button>
                <Button leftSection={<IconChecks size={16} />} loading={saving} onClick={saveDraft} data-testid="catalog-rules-save-draft">
                  Save and continue
                </Button>
              </Group>
            </Group>
            <WorkbenchAdvancedSection
              title="Version history"
              description="Load a saved draft or active rule set without crowding the rule editor."
            >
              <Box mt="md" data-testid="catalog-rule-sets-table">
                <WorkbenchTable<CatalogRuleSetSummary>
                  ariaLabel="Catalog rule sets"
                  rows={ruleSets}
                  getRowKey={(ruleSet) => ruleSet.id}
                  minWidth={560}
                  withContainer={false}
                  onRowClick={(ruleSet) => {
                    loadRuleSetIntoForm(ruleSet);
                    setWizardStep('draft');
                  }}
                  columns={[
                    {
                      key: 'name',
                      header: 'Name',
                      render: (ruleSet) => <Text fw={700}>{ruleSet.name}</Text>,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (ruleSet) => <Badge color={ruleSet.isActive ? 'green' : 'gray'}>{ruleSet.status}</Badge>,
                    },
                    {
                      key: 'rules',
                      header: 'Rules',
                      render: (ruleSet) => ruleSet.rules.length,
                      align: 'right',
                    },
                  ]}
                  emptyState={(
                    <EmptyStateMessage
                      kind="no-data"
                      title="No rule sets yet"
                      description="Save the first draft to start dealer group rules."
                    />
                  )}
                />
              </Box>
            </WorkbenchAdvancedSection>
          </Stack>
        </Paper>
      ) : null}

      {wizardStep === 'preview' ? (
        <Paper withBorder p="lg" radius="md" data-testid="catalog-rules-preview-step">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Title order={2}>Preview Account Decisions</Title>
                <Text size="sm" c="dimmed">
                  Check sampled accounts before publishing. Publish still runs the full account check on the server.
                </Text>
              </Stack>
              <Button
                leftSection={<IconEye size={16} />}
                loading={saving}
                disabled={!selectedRuleSetId}
                onClick={() => void previewImpact()}
                data-testid="catalog-rules-preview-decisions"
              >
                Preview Account Decisions
              </Button>
            </Group>
            {!selectedRuleSetId ? (
              <Alert color="yellow" title="Save this draft first">Save this draft before preview or publish.</Alert>
            ) : null}
            {previewIsStale ? (
              <Alert color="yellow" title="Preview is stale">This draft changed after preview. Run preview again.</Alert>
            ) : null}
            {preview?.warnings.length ? (
              <Alert color="yellow" title="Needs review">{preview.warnings.join(' ')}</Alert>
            ) : null}
            {preview && !preview.warnings.length ? (
              <Alert color="green" title="No review flags in this preview">Publish will still run the full account check.</Alert>
            ) : null}
            {preview ? (
              <WorkbenchMetricStrip
                metrics={[
                  { label: 'Sample size', value: preview.sampleAccountCount, tone: 'blue' },
                  { label: 'Matched', value: preview.matchedCount, tone: 'green' },
                  {
                    label: 'Needs review',
                    value: preview.reviewRequiredCount,
                    tone: preview.reviewRequiredCount ? 'orange' : 'green',
                  },
                  {
                    label: 'No rule matched',
                    value: preview.unmatchedCount,
                    tone: preview.unmatchedCount ? 'red' : 'green',
                  },
                ]}
              />
            ) : null}
            <Box data-testid="catalog-rule-preview-decisions-table">
              <WorkbenchTable<CatalogRulePreviewRow>
                ariaLabel="Sample catalog rule account decisions"
                rows={preview?.rows ?? []}
                getRowKey={(row) => row.accountId}
                minWidth={920}
                withContainer={false}
                columns={[
                  {
                    key: 'account',
                    header: 'Account',
                    render: (row) => (
                      <Stack gap={2}>
                        <Text fw={700}>{row.accountName}</Text>
                        <Text size="xs" c="dimmed">
                          {row.classification ?? 'Unclassified'} · {row.region ?? 'No region'} · {row.portalEligible ? 'Portal eligible' : 'Not portal eligible'}
                        </Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'relationship',
                    header: 'Relationship',
                    render: (row) => (
                      <Stack gap={2}>
                        <Text size="sm">{row.affinityGroup ?? 'No affinity group'}</Text>
                        <Text size="xs" c="dimmed">{row.ownershipGroup ?? 'No ownership / PE group'}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'rule',
                    header: 'Rule result',
                    render: (row) => (
                      <Stack gap={2}>
                        <Text size="sm">{row.matchedRuleName ?? 'No match'}</Text>
                        <Text size="xs" c="dimmed">{formatRuleAction(row.resultAction)}</Text>
                      </Stack>
                    ),
                  },
                  {
                    key: 'catalog-view',
                    header: 'Dealer group',
                    render: (row) => row.dealerCatalogViewName ?? 'Review needed',
                  },
                  {
                    key: 'status',
                    header: 'Status',
                    render: (row) => (
                      <Stack gap={2}>
                        <Badge color={row.warning ? 'yellow' : 'green'}>{row.warning ? 'Needs review' : 'Ready'}</Badge>
                        {row.warning ? <Text size="xs" c="dimmed">{row.warning}</Text> : null}
                      </Stack>
                    ),
                  },
                ]}
                emptyState={(
                  <EmptyStateMessage
                    kind="no-data"
                    title="No preview run yet"
                    description="Save the rule set, then preview account decisions."
                  />
                )}
              />
            </Box>
            {preview?.catalogViewImpacts.length ? (
              <WorkbenchAdvancedSection
                title="Affected products and files"
                description="Review sampled dealer group impact after account decisions are checked."
              >
                <Box mt="md" data-testid="catalog-rule-preview-impact-table">
                  <WorkbenchTable<CatalogRuleCatalogViewImpact>
                    ariaLabel="Sampled catalog view impact"
                    rows={preview.catalogViewImpacts}
                    getRowKey={(impact) => impact.dealerCatalogViewId}
                    minWidth={840}
                    withContainer={false}
                    columns={[
                      {
                        key: 'catalog-view',
                        header: 'Dealer group',
                        render: (impact) => <Text fw={700}>{impact.dealerCatalogViewName}</Text>,
                      },
                      {
                        key: 'accounts',
                        header: 'Sampled accounts',
                        render: (impact) => impact.matchedAccountCount,
                        align: 'right',
                      },
                      {
                        key: 'products',
                        header: 'Products',
                        render: (impact) => `${impact.readyProductCount}/${impact.visibleProductCount} ready`,
                        align: 'right',
                      },
                      {
                        key: 'files',
                        header: 'Files linked',
                        render: (impact) => impact.linkedFileCount,
                        align: 'right',
                      },
                      {
                        key: 'missing-setup',
                        header: 'Missing setup',
                        render: (impact) => (
                          <Badge color={impact.missingSetupCount ? 'yellow' : 'green'}>
                            {impact.missingSetupCount}
                          </Badge>
                        ),
                        align: 'right',
                      },
                    ]}
                  />
                </Box>
              </WorkbenchAdvancedSection>
            ) : null}
            <Group justify="space-between">
              <Button variant="default" onClick={() => setWizardStep('draft')}>Back to Draft</Button>
              <Button
                color="blue"
                disabled={!preview || previewIsStale}
                onClick={() => setWizardStep('publish')}
              >
                Continue to Publish
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : null}

      {wizardStep === 'publish' ? (
        <Paper withBorder p="lg" radius="md" data-testid="catalog-rules-publish-step">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                <Title order={2}>Publish Rule Set</Title>
                <Text size="sm" c="dimmed">
                  This publishes rules only. It does not publish products, files, prices, orders, or inventory.
                </Text>
              </Stack>
              {selectedRuleSet ? <Badge color={selectedRuleSet.isActive ? 'green' : 'blue'}>{selectedRuleSet.status.replace(/_/g, ' ')}</Badge> : null}
            </Group>
            <SimpleGrid cols={{ base: 1, md: 4 }}>
              <MetricCard label="Rule set" value={name || 'Untitled'} helper={selectedRuleSetId ? 'Saved draft' : 'Not saved'} />
              <MetricCard label="Matched" value={String(preview?.matchedCount ?? 0)} helper="Sampled accounts" />
              <MetricCard label="Needs review" value={String(preview?.reviewRequiredCount ?? 0)} helper="Must be zero" />
              <MetricCard label="No rule matched" value={String(preview?.unmatchedCount ?? 0)} helper="Must be zero" />
            </SimpleGrid>
            {publishBlocked ? (
              <Alert color="yellow" title="Publish is blocked">
                <Stack gap={4}>
                  {publishBlockers.map((blocker) => <Text key={String(blocker)} size="sm">{blocker}</Text>)}
                </Stack>
              </Alert>
            ) : (
              <Alert color="green" title="Ready to publish">
                Preview is clean. Pulse will still run the full account check before activation.
              </Alert>
            )}
            <WorkbenchAdvancedSection
              title="Parked boundaries"
              description="Open when you need to confirm what this rule set does not control."
            >
              <Text size="sm" c="dimmed" mt="md">
                Rules use affinity group, ownership/PE group, independent status, region, and portal eligibility. Pricing, ordering, inventory, and brand/private-label account matching stay parked until Dynamic confirms the source of truth.
              </Text>
            </WorkbenchAdvancedSection>
            <Group justify="space-between">
              <Button variant="default" onClick={() => setWizardStep(preview ? 'preview' : 'draft')}>Back</Button>
              <Button
                color="green"
                leftSection={<IconShieldCheck size={16} />}
                loading={saving}
                disabled={publishBlocked || saving}
                onClick={() => void publishRules()}
                data-testid="catalog-rules-publish-rule-set"
              >
                Publish Rule Set
              </Button>
            </Group>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );

  function updateRule(index: number, patch: Partial<EditableRule>) {
    setRules((current) => current.map((rule, currentIndex) => currentIndex === index ? { ...rule, ...patch } : rule));
  }

  function changeRuleField(index: number, field: CatalogRuleConditionFieldKey) {
    updateRule(index, {
      field,
      operator: 'is',
      value: isBooleanConditionField(field) ? 'yes' : '',
    });
  }

  function renderConditionValueControl(rule: EditableRule, index: number) {
    const disabled = ['is_any', 'is_empty', 'is_not_empty'].includes(rule.operator);
    if (isBooleanConditionField(rule.field)) {
      return (
        <Select
          label="Value"
          aria-label={`Rule ${index + 1} value`}
          data={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          value={rule.value || 'yes'}
          disabled={disabled}
          onChange={(value) => updateRule(index, { value: value ?? 'yes' })}
          allowDeselect={false}
          data-testid={`catalog-rule-value-${index}`}
        />
      );
    }

    const options = getConditionValueOptions(rule.field);
    return (
      <Select
        label={getConditionValueLabel(rule.field)}
        searchable
        data={options.map((option) => ({ value: option.value, label: option.helper ? `${option.label} (${option.helper})` : option.label }))}
        value={rule.value || null}
        disabled={disabled || !options.length}
        placeholder={options.length ? 'Choose from approved list' : getConditionValuePlaceholder(rule.field)}
        aria-label={`Rule ${index + 1} value`}
        onChange={(value) => updateRule(index, { value: value ?? '' })}
        data-testid={`catalog-rule-value-${index}`}
      />
    );
  }

  function getConditionValueOptions(field: CatalogRuleConditionFieldKey) {
    if (field === 'affinity_group') return conditionOptions.affinityGroups;
    if (field === 'ownership_group') return conditionOptions.ownershipGroups;
    if (field === 'region') return conditionOptions.regions;
    return [];
  }
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

function getConditionValueLabel(field: CatalogRuleConditionFieldKey) {
  if (field === 'affinity_group') return 'Choose affinity group';
  if (field === 'ownership_group') return 'Choose ownership / PE group';
  if (field === 'region') return 'Choose region';
  return 'Value';
}

function getConditionValuePlaceholder(field: CatalogRuleConditionFieldKey) {
  if (field === 'affinity_group') return 'No approved affinity groups available';
  if (field === 'ownership_group') return 'No approved ownership / PE groups available';
  if (field === 'region') return 'No approved regions available';
  return 'No approved options available';
}

function formatRuleSentence(rule: EditableRule, resultOptions: Array<{ value: string; label: string }>) {
  const field = conditionFields.find((entry) => entry.value === rule.field)?.label ?? 'account field';
  const operator = operators.find((entry) => entry.value === rule.operator)?.label ?? rule.operator;
  const needsValue = !['is_any', 'is_empty', 'is_not_empty'].includes(rule.operator);
  const value = needsValue ? (rule.value || 'choose a value') : '';
  const result = rule.result === 'review'
    ? 'send the account to review'
    : `assign ${resultOptions.find((entry) => entry.value === rule.result)?.label ?? 'choose a dealer group'}`;

  return `When ${field} ${operator}${value ? ` ${value}` : ''}, ${result}.`;
}

function findDuplicatePriorities(rules: EditableRule[]) {
  const counts = new Map<number, number>();
  for (const rule of rules) {
    counts.set(rule.priority, (counts.get(rule.priority) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([priority]) => priority)
    .sort((left, right) => left - right);
}

function formatRuleAction(value?: string) {
  if (!value) {
    return 'No action';
  }

  return value.replace(/_/g, ' ');
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Paper withBorder p="md" radius="md" className="premium-stat-card">
      <Stack gap={4}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          {label}
        </Text>
        <Text fw={800} size="lg" lineClamp={1}>
          {value}
        </Text>
        {helper ? (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {helper}
          </Text>
        ) : null}
      </Stack>
    </Paper>
  );
}

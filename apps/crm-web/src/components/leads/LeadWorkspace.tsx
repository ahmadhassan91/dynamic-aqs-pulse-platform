'use client';

import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowRight,
  IconChartBar,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconFileUpload,
  IconListDetails,
  IconMail,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconTarget,
  IconTimeline,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import {
  type AffinityGroupReferenceSummary,
  type CreateLeadRequest,
  type GroupAxisSelectionKey,
  type LeadImportDuplicateCandidate,
  type PreviewLeadOcrCaptureResponse,
  type LeadRoutingPolicySummary,
  type LeadRoutingTeamKey,
  type LeadStageKey,
  type LeadSummary,
  type OwnershipGroupReferenceSummary,
  type ReferenceValueSummary,
} from '@pulse/contracts';
import {
  APP_LEAD_MARKETING_SOURCES,
  APP_LEAD_RATINGS,
  APP_LEAD_REGION_OPTIONS,
  findAppLeadRegionOption,
} from '@/lib/lead-form-options';
import {
  createLead,
  fetchAffinityGroups,
  fetchLeadRoutingPolicy,
  fetchLeadSources,
  fetchLeads,
  fetchOwnershipGroups,
  previewLeadDuplicateCandidates,
  previewLeadOcrCapture,
  transitionLeadStage,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';

type LeadWorkspaceTab = 'overview' | 'pipeline' | 'analytics';
type ViewMode = 'kanban' | 'list';
type ManualGroupAxisSelection = GroupAxisSelectionKey | '';
type LeadCreateFormState = {
  companyName: string;
  contactDisplayName: string;
  email: string;
  phone: string;
  state: string;
  affinityGroupSelection: ManualGroupAxisSelection;
  affinityGroupCode: string;
  ownershipGroupSelection: ManualGroupAxisSelection;
  ownershipGroupCode: string;
  sourceCampaign: string;
  leadRating: string;
  leadSourceCode: string;
  serviceTechCount: number;
  installTechCount: number;
  notes: string;
};

type StageMeta = {
  key: LeadStageKey;
  title: string;
  shortTitle: string;
  color: string;
};

const STAGE_META: readonly StageMeta[] = [
  { key: 'new', title: '1. New Lead', shortTitle: 'New', color: 'blue' },
  { key: 'discovery_scheduled', title: '2. Discovery Scheduled', shortTitle: 'Discovery Scheduled', color: 'indigo' },
  { key: 'discovery_completed', title: '3. Discovery Completed', shortTitle: 'Discovery Completed', color: 'orange' },
  { key: 'cis_sent', title: '4. CIS Sent', shortTitle: 'CIS Sent', color: 'grape' },
  { key: 'cis_signed', title: '5. CIS Signed', shortTitle: 'CIS Signed', color: 'teal' },
  { key: 'onboarding_completed', title: '6. Onboarding Completed', shortTitle: 'Onboarding', color: 'cyan' },
  { key: 'customer_active', title: '7. Customer Active', shortTitle: 'Customer Active', color: 'green' },
] as const;

const EMPTY_LEAD_FORM: LeadCreateFormState = {
  companyName: '',
  contactDisplayName: '',
  email: '',
  phone: '',
  state: '',
  affinityGroupSelection: '',
  affinityGroupCode: '',
  ownershipGroupSelection: '',
  ownershipGroupCode: '',
  sourceCampaign: '',
  leadRating: '',
  leadSourceCode: 'manual_entry',
  serviceTechCount: 1,
  installTechCount: 0,
  notes: '',
};

const leadRegionOptions = APP_LEAD_REGION_OPTIONS;
const leadMarketingSourceOptions = APP_LEAD_MARKETING_SOURCES;
const leadRatingOptions = APP_LEAD_RATINGS;
const manualGroupAxisSelectionOptions = [
  { value: 'none', label: 'Independent / no group' },
  { value: 'group', label: 'Select governed group' },
] satisfies ReadonlyArray<{ value: Exclude<GroupAxisSelectionKey, 'unknown'>; label: string }>;

const leadRegionSelectData = leadRegionOptions.map((option) => ({
  value: option.value,
  label: `${option.label} (${option.value})`,
}));

export function LeadWorkspace({
  initialTab = 'overview',
}: {
  initialTab?: LeadWorkspaceTab;
}) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LeadWorkspaceTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [leadSources, setLeadSources] = useState<ReferenceValueSummary[]>([]);
  const [affinityGroups, setAffinityGroups] = useState<AffinityGroupReferenceSummary[]>([]);
  const [ownershipGroups, setOwnershipGroups] = useState<OwnershipGroupReferenceSummary[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStageKey | ''>('');
  const [routingTeamFilter, setRoutingTeamFilter] = useState<LeadRoutingTeamKey | ''>('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('');
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [createLeadOpened, { open: openCreateLead, close: closeCreateLead }] = useDisclosure(false);
  const [createLeadForm, setCreateLeadForm] = useState<LeadCreateFormState>(EMPTY_LEAD_FORM);
  const [createLeadError, setCreateLeadError] = useState<string | null>(null);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<LeadImportDuplicateCandidate[]>([]);
  const [pendingDuplicatePayload, setPendingDuplicatePayload] = useState<CreateLeadRequest | null>(null);
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState('');
  const [ocrCaptureFile, setOcrCaptureFile] = useState<File | null>(null);
  const [ocrPreview, setOcrPreview] = useState<PreviewLeadOcrCaptureResponse | null>(null);
  const [ocrDuplicateCandidates, setOcrDuplicateCandidates] = useState<LeadImportDuplicateCandidate[]>([]);
  const [isPreviewingOcr, setIsPreviewingOcr] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropStageKey, setDropStageKey] = useState<LeadStageKey | null>(null);
  const [transitioningLeadId, setTransitioningLeadId] = useState<string | null>(null);
  const dragSuppressUntilRef = useRef(0);

  const deferredSearch = useDeferredValue(searchQuery.trim());

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!auth) {
      setLeadSources([]);
      setAffinityGroups([]);
      setOwnershipGroups([]);
      setRoutingPolicy(null);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadReferences() {
      setReferenceError(null);

      try {
        const [leadSourceResponse, affinityGroupResponse, ownershipGroupResponse, routingPolicyResponse] = await Promise.all([
          fetchLeadSources(apiBaseUrl, accessToken),
          fetchAffinityGroups(apiBaseUrl, accessToken),
          fetchOwnershipGroups(apiBaseUrl, accessToken),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setLeadSources(leadSourceResponse.items);
        setAffinityGroups(affinityGroupResponse.items);
        setOwnershipGroups(ownershipGroupResponse.items);
        setRoutingPolicy(routingPolicyResponse);
        setCreateLeadForm((current) => ({
          ...current,
          leadSourceCode: current.leadSourceCode || leadSourceResponse.items[0]?.code || 'manual_entry',
        }));
      } catch (error) {
        if (!cancelled) {
          setReferenceError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  useEffect(() => {
    if (!auth) {
      setLeads([]);
      setTotalLeads(0);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadLeads() {
      setIsLoadingLeads(true);
      setListError(null);

      try {
        const response = await fetchLeads(apiBaseUrl, accessToken, {
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(stageFilter ? { stage: stageFilter } : {}),
          ...(routingTeamFilter ? { routingTeam: routingTeamFilter } : {}),
          ...(leadSourceFilter ? { leadSourceCode: leadSourceFilter } : {}),
          limit: 200,
        });

        if (cancelled) {
          return;
        }

        setLeads(response.items);
        setTotalLeads(response.total);
      } catch (error) {
        if (!cancelled) {
          setListError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLeads(false);
        }
      }
    }

    void loadLeads();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, deferredSearch, leadSourceFilter, refreshNonce, routingTeamFilter, stageFilter]);

  const stageCounts = useMemo(
    () =>
      STAGE_META.reduce(
        (counts, stage) => ({
          ...counts,
          [stage.key]: leads.filter((lead) => lead.stage === stage.key).length,
        }),
        {} as Record<LeadStageKey, number>,
      ),
    [leads],
  );

  const latestLead = useMemo(
    () => [...leads].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null,
    [leads],
  );

  const stageColumns = useMemo(
    () =>
      STAGE_META.map((stage) => ({
        ...stage,
        leads: leads.filter((lead) => lead.stage === stage.key),
      })),
    [leads],
  );

  const analyticsBySource = useMemo(() => {
    const summary = new Map<string, number>();
    for (const lead of leads) {
      summary.set(lead.leadSourceName, (summary.get(lead.leadSourceName) ?? 0) + 1);
    }
    return [...summary.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const analyticsByRoutingTeam = useMemo(() => {
    const summary = new Map<string, number>();
    for (const lead of leads) {
      const label = formatRoutingTeam(lead.routingTeam);
      summary.set(label, (summary.get(label) ?? 0) + 1);
    }
    return [...summary.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  function buildManualLeadCreatePayload(): CreateLeadRequest | null {
    if (
      !auth
      || !createLeadForm.companyName.trim()
      || !createLeadForm.serviceTechCount
      || !createLeadForm.email.trim()
      || !createLeadForm.phone.trim()
    ) {
      setCreateLeadError('Company name, email, phone, and service tech count are required.');
      return null;
    }

    if (!createLeadForm.affinityGroupSelection) {
      setCreateLeadError('Choose an affinity group status before creating a manual lead.');
      return null;
    }

    if (!createLeadForm.ownershipGroupSelection) {
      setCreateLeadError('Choose an ownership group status before creating a manual lead.');
      return null;
    }

    if (createLeadForm.affinityGroupSelection === 'group' && !createLeadForm.affinityGroupCode) {
      setCreateLeadError('Choose an affinity group when the affinity selection is set to a governed group.');
      return null;
    }

    if (createLeadForm.ownershipGroupSelection === 'group' && !createLeadForm.ownershipGroupCode) {
      setCreateLeadError('Choose an ownership group when the ownership selection is set to a governed group.');
      return null;
    }

    const regionOption = findAppLeadRegionOption(createLeadForm.state);
    return {
      companyName: createLeadForm.companyName.trim(),
      serviceTechCount: createLeadForm.serviceTechCount,
      leadSourceCode: createLeadForm.leadSourceCode || 'manual_entry',
      affinityGroupSelection: createLeadForm.affinityGroupSelection,
      ownershipGroupSelection: createLeadForm.ownershipGroupSelection,
      ...(createLeadForm.contactDisplayName.trim() ? { contactDisplayName: createLeadForm.contactDisplayName.trim() } : {}),
      ...(createLeadForm.email.trim() ? { email: createLeadForm.email.trim() } : {}),
      ...(createLeadForm.phone.trim() ? { phone: createLeadForm.phone.trim() } : {}),
      ...(createLeadForm.state.trim() ? { state: createLeadForm.state.trim() } : {}),
      ...(createLeadForm.affinityGroupSelection === 'group' && createLeadForm.affinityGroupCode
        ? { affinityGroupCode: createLeadForm.affinityGroupCode }
        : {}),
      ...(createLeadForm.ownershipGroupSelection === 'group' && createLeadForm.ownershipGroupCode
        ? { ownershipGroupCode: createLeadForm.ownershipGroupCode }
        : {}),
      ...(regionOption ? { countryCode: regionOption.countryCode } : {}),
      ...(createLeadForm.sourceCampaign ? { sourceCampaign: createLeadForm.sourceCampaign } : {}),
      ...(createLeadForm.leadRating ? { leadRating: createLeadForm.leadRating } : {}),
      ...(createLeadForm.installTechCount > 0 ? { installTechCount: createLeadForm.installTechCount } : {}),
      ...(createLeadForm.notes.trim() ? { notes: createLeadForm.notes.trim() } : {}),
    };
  }

  function resetCreateLeadModal() {
    setCreateLeadForm({
      ...EMPTY_LEAD_FORM,
      leadSourceCode: createLeadForm.leadSourceCode || 'manual_entry',
    });
    setCreateLeadError(null);
    setDuplicateCandidates([]);
    setPendingDuplicatePayload(null);
    setDuplicateOverrideReason('');
    setOcrCaptureFile(null);
    setOcrPreview(null);
    setOcrDuplicateCandidates([]);
    closeCreateLead();
  }

  async function handlePreviewOcrCapture() {
    if (!auth || !ocrCaptureFile) {
      return;
    }

    setCreateLeadError(null);
    setIsPreviewingOcr(true);
    setOcrPreview(null);
    setOcrDuplicateCandidates([]);

    try {
      const contentBase64 = await readFileAsBase64(ocrCaptureFile);
      const preview = await previewLeadOcrCapture(apiBaseUrl, auth.tokens.accessToken, {
        documentType: 'business_card',
        fileName: ocrCaptureFile.name,
        mimeType: ocrCaptureFile.type || 'application/octet-stream',
        contentBase64,
        ...(createLeadForm.serviceTechCount > 0 ? { serviceTechCountFallback: createLeadForm.serviceTechCount } : {}),
      });

      setOcrPreview(preview);
      setOcrDuplicateCandidates(preview.duplicatePreview.candidates);
      setCreateLeadForm((current) => ({
        ...current,
        companyName: readOcrStringField(preview.fields.companyName?.value) || current.companyName,
        contactDisplayName: readOcrStringField(preview.fields.contactDisplayName?.value) || current.contactDisplayName,
        email: readOcrStringField(preview.fields.email?.value) || current.email,
        phone: readOcrStringField(preview.fields.phone?.value) || current.phone,
        state: readOcrStringField(preview.fields.state?.value) || current.state,
        serviceTechCount: preview.fields.serviceTechCount?.value || current.serviceTechCount,
        leadSourceCode: current.leadSourceCode || 'manual_entry',
        notes: [
          current.notes.trim(),
          preview.rawExtractionText ? `OCR capture text:\n${preview.rawExtractionText}` : '',
        ].filter(Boolean).join('\n\n'),
      }));
    } catch (error) {
      setCreateLeadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPreviewingOcr(false);
    }
  }

  async function finishCreateLead(payload: CreateLeadRequest) {
    if (!auth) {
      return;
    }

    const response = await createLead(apiBaseUrl, auth.tokens.accessToken, payload);

    resetCreateLeadModal();
    startTransition(() => {
      setActiveTab('pipeline');
      setViewMode('kanban');
      router.push(`/leads/${response.id}`);
    });
    setRefreshNonce((value) => value + 1);
  }

  async function handleCreateLead() {
    if (!auth) {
      return;
    }

    setCreateLeadError(null);
    const payload = buildManualLeadCreatePayload();
    if (!payload) {
      return;
    }

    const accessToken = auth.tokens.accessToken;
    setIsCreatingLead(true);

    try {
      const preview = await previewLeadDuplicateCandidates(apiBaseUrl, accessToken, payload);
      if (preview.hasPotentialDuplicate) {
        setDuplicateCandidates(preview.candidates);
        setPendingDuplicatePayload(payload);
        setDuplicateOverrideReason('');
        return;
      }

      await finishCreateLead(payload);
    } catch (error) {
      setCreateLeadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingLead(false);
    }
  }

  async function handleConfirmDuplicateCreate() {
    if (!pendingDuplicatePayload) {
      return;
    }

    const reason = duplicateOverrideReason.trim();
    if (!reason) {
      setCreateLeadError('Enter a reason before creating a separate duplicate lead.');
      return;
    }

    setIsCreatingLead(true);
    setCreateLeadError(null);

    try {
      await finishCreateLead({
        ...pendingDuplicatePayload,
        duplicateResolution: {
          decision: 'create_new',
          reason,
        },
      });
    } catch (error) {
      setCreateLeadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingLead(false);
    }
  }

  async function handleEnrichDuplicateLead(targetEntityId: string) {
    if (!pendingDuplicatePayload) {
      return;
    }

    const reason = duplicateOverrideReason.trim();
    if (!reason) {
      setCreateLeadError('Enter a reason before enriching an existing lead.');
      return;
    }

    setIsCreatingLead(true);
    setCreateLeadError(null);
    try {
      await finishCreateLead({
        ...pendingDuplicatePayload,
        duplicateResolution: {
          decision: 'enrich_existing',
          targetEntityId,
          reason,
        },
      });
    } catch (error) {
      setCreateLeadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingLead(false);
    }
  }

  function exportVisibleLeads() {
    const rows = leads.map((lead) => ({
      companyName: lead.companyName,
      contactDisplayName: lead.contactDisplayName,
      leadSource: lead.leadSourceName,
      serviceTechCount: String(lead.serviceTechCount),
      routingTeam: formatRoutingTeam(lead.routingTeam),
      stage: formatStageLabel(lead.stage),
      leadOwnerName: lead.leadOwnerName ?? '',
      createdAt: formatDateLabel(lead.createdAt),
    }));

    downloadCsv('pulse-leads-export.csv', rows);
  }

  function openLeadRecord(leadId: string) {
    if (Date.now() < dragSuppressUntilRef.current) {
      return;
    }

    router.push(`/leads/${leadId}`);
  }

  async function handleStageDrop(leadId: string, nextStage: LeadStageKey) {
    if (!auth) {
      return;
    }

    const lead = leads.find((entry) => entry.id === leadId);
    if (!lead || lead.stage === nextStage) {
      setDraggedLeadId(null);
      setDropStageKey(null);
      return;
    }

    const previousLeads = leads;
    const optimisticTimestamp = new Date().toISOString();

    setListError(null);
    setDraggedLeadId(null);
    setDropStageKey(null);
    setTransitioningLeadId(leadId);
    setLeads((current) =>
      current.map((entry) => (entry.id === leadId ? { ...entry, stage: nextStage, updatedAt: optimisticTimestamp } : entry)),
    );

    try {
      const updatedLead = await transitionLeadStage(apiBaseUrl, auth.tokens.accessToken, leadId, {
        toStage: nextStage,
      });

      setLeads((current) => current.map((entry) => (entry.id === leadId ? updatedLead : entry)));
    } catch (error) {
      setLeads(previousLeads);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransitioningLeadId(null);
    }
  }

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <>
      <Stack gap="md">
        <Paper shadow="sm" p="lg" radius="xl" className="premium-hero-panel">
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Title order={1}>Residential Lead Hub</Title>
              <Text size="sm" c="dimmed">
                Manage residential leads from Pulse-powered website forms, referrals, and trade shows with governed routing, gated review, and dedicated list + kanban modes.
              </Text>
              <Group gap="xs">
                <Badge color="blue" variant="light">Residential Program</Badge>
                <Badge color="cyan" variant="light">Pulse Website Intake</Badge>
                <Badge color="blue" variant="light">Ready for daily intake</Badge>
              </Group>
            </Stack>
            <Group gap="sm">
              <Button
                leftSection={<IconPlus size={16} />}
                variant="gradient"
                gradient={{ from: 'blue', to: 'indigo', deg: 120 }}
                onClick={openCreateLead}
              >
                New Intake
              </Button>
              <Button component={Link} href="/leads/import" variant="light" leftSection={<IconFileUpload size={16} />}>
                Import CSV
              </Button>
              <Button component={Link} href="/leads/forms" variant="light" color="cyan" leftSection={<IconWorld size={16} />}>
                Website Forms
              </Button>
              <Button component={Link} href="/leads/activities" variant="light" color="orange" leftSection={<IconClock size={16} />}>
                Workflow Queue
              </Button>
              <Button component={Link} href="/leads/finance" variant="light" color="indigo">
                Open Finance Queue
              </Button>
              <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportVisibleLeads}>
                Export Report
              </Button>
            </Group>
          </Group>
        </Paper>

        <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
          <Group justify="space-between" align="center" wrap="wrap">
            <Stack gap={4}>
              <Text fw={600}>Digital intake & routing</Text>
              <Text size="sm" c="dimmed">
                Homeowner and contractor forms across branded websites, plus referral and trade-show capture, land directly in Pulse CRM. Routing stays configuration-backed and currently runs on service tech count.
              </Text>
            </Stack>
            <Group gap="xs">
              {latestLead ? (
                <>
                  {latestLead.sourceSiteName ? <Badge color="cyan" variant="light">{latestLead.sourceSiteName}</Badge> : null}
                  {latestLead.sourceBrandTag ? <Badge color="blue" variant="light">{latestLead.sourceBrandTag}</Badge> : null}
                  <Button size="xs" variant="light" onClick={() => router.push(`/leads/${latestLead.id}`)}>
                    Open Latest Intake
                  </Button>
                </>
              ) : null}
              {routingPolicy ? (
                <Badge color="grape" variant="outline">
                  {formatRoutingBasis(routingPolicy.routingBasis)} / threshold {routingPolicy.strategicGrowthMax}
                </Badge>
              ) : null}
            </Group>
          </Group>
        </Paper>

        {referenceError ? (
          <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
            <Text c="red">{referenceError}</Text>
          </Paper>
        ) : null}

        <Tabs value={activeTab} onChange={(value) => setActiveTab((value as LeadWorkspaceTab) || 'overview')} className="premium-tabs-shell">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="pipeline" leftSection={<IconTimeline size={16} />}>
              Pipeline
            </Tabs.Tab>
            <Tabs.Tab value="analytics" leftSection={<IconChartBar size={16} />}>
              Analytics
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                <MetricCard label="Residential Leads" value={String(totalLeads)} icon={IconUsers} color="blue" />
                <MetricCard label="Website / digital intake" value={String(leads.filter((lead) => lead.sourceSiteId || lead.leadCaptureMethod === 'direct_web_form').length)} icon={IconWorld} color="cyan" />
                <MetricCard label="Awaiting CIS" value={String(leads.filter((lead) => lead.stage === 'cis_sent').length)} icon={IconClock} color="orange" />
                <MetricCard label="Ready for first order" value={String(leads.filter((lead) => lead.stage === 'onboarding_completed').length)} icon={IconTarget} color="teal" />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }} spacing="md">
                <ActionCard
                  title="Kanban Workflow"
                  description="Run the residential workflow visually from new lead through first-order activation."
                  actionLabel="Open Kanban"
                  icon={IconTimeline}
                  color="blue"
                  onClick={() => {
                    setActiveTab('pipeline');
                    setViewMode('kanban');
                  }}
                />
                <ActionCard
                  title="List Review"
                  description="Switch into reviewer mode for sorting, search, and rapid stage updates."
                  actionLabel="Open List"
                  icon={IconListDetails}
                  color="teal"
                  onClick={() => {
                    setActiveTab('pipeline');
                    setViewMode('list');
                  }}
                />
                <ActionCard
                  title="Referral / Event Intake"
                  description="Log a referral, phone-qualified, or trade-show lead into the same governed workflow."
                  actionLabel="New Intake"
                  icon={IconPlus}
                  color="green"
                  onClick={openCreateLead}
                />
                <ActionCard
                  title="Website Forms"
                  description="Review the branded homeowner and contractor forms, recent intake volume, and live embed coverage across the approved sites."
                  actionLabel="Open Forms"
                  icon={IconWorld}
                  color="grape"
                  href="/leads/forms"
                />
                <ActionCard
                  title="Workflow Queue"
                  description="Review calls, emails, and next actions generated from live lead stage, SLA, and CIS handoff state."
                  actionLabel="Open Queue"
                  icon={IconClock}
                  color="orange"
                  href="/leads/activities"
                />
                <ActionCard
                  title="Lead Import"
                  description="Upload CSV/XLSX files, map headers, and push rows into the governed lead import API."
                  actionLabel="Open Import"
                  icon={IconFileUpload}
                  color="grape"
                  href="/leads/import"
                />
                <ActionCard
                  title="Latest Intake"
                  description={latestLead ? `Open ${latestLead.companyName} and review the live lead record.` : 'New leads will appear here once intake starts landing in the production workspace.'}
                  actionLabel={latestLead ? 'Open Record' : 'Open Pipeline'}
                  icon={IconArrowRight}
                  color="cyan"
                  onClick={() => {
                    if (latestLead) {
                      router.push(`/leads/${latestLead.id}`);
                    } else {
                      setActiveTab('pipeline');
                    }
                  }}
                />
                <ActionCard
                  title="Finance Queue"
                  description="Open the live queue for CIS packages awaiting finance submission or decision."
                  actionLabel="Open Queue"
                  icon={IconClock}
                  color="indigo"
                  href="/leads/finance"
                />
              </SimpleGrid>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="pipeline" pt="md">
            <Stack gap="md">
              <Paper withBorder p="md" radius="xl" className="premium-filter-bar">
                <Group gap="sm" wrap="wrap" align="flex-end">
                  <TextInput
                    placeholder="Search leads, companies, emails..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                    style={{ flex: '1 1 280px' }}
                  />
                  <Select
                    placeholder="Stage"
                    value={stageFilter}
                    onChange={(value) => setStageFilter((value as LeadStageKey | null) ?? '')}
                    data={STAGE_META.map((stage) => ({ value: stage.key, label: stage.shortTitle }))}
                    clearable
                    w={190}
                  />
                  <Select
                    placeholder="Routing team"
                    value={routingTeamFilter}
                    onChange={(value) => setRoutingTeamFilter((value as LeadRoutingTeamKey | null) ?? '')}
                    data={[
                      { value: 'strategic_growth', label: 'Strategic Growth' },
                      { value: 'national_tm', label: 'National TM' },
                    ]}
                    clearable
                    w={200}
                  />
                  <Select
                    placeholder="Source"
                    value={leadSourceFilter}
                    onChange={(value) => setLeadSourceFilter(value ?? '')}
                    data={leadSources.map((source) => ({
                      value: source.code,
                      label: source.name,
                    }))}
                    clearable
                    searchable
                    w={220}
                  />
                  <SegmentedControl
                    value={viewMode}
                    onChange={(value) => setViewMode(value as ViewMode)}
                    data={[
                      { label: 'Kanban', value: 'kanban' },
                      { label: 'List', value: 'list' },
                    ]}
                  />
                  <ActionIcon variant="light" size="lg" onClick={() => setRefreshNonce((value) => value + 1)}>
                    <IconRefresh size={16} />
                  </ActionIcon>
                </Group>
              </Paper>

              {listError ? (
                <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
                  <Text c="red">{listError}</Text>
                </Paper>
              ) : null}

              {viewMode === 'kanban' ? (
                <ScrollArea type="auto">
                  <Group align="flex-start" wrap="nowrap" gap="md" py="xs">
                    {stageColumns.map((stage) => {
                      const isDropTarget = dropStageKey === stage.key;
                      const canDrop =
                        draggedLeadId !== null
                        && leads.some((lead) => lead.id === draggedLeadId && lead.stage !== stage.key);

                      return (
                      <div
                        key={stage.key}
                        data-testid={`lead-stage-column-${stage.key}`}
                        role="group"
                        aria-label={`Stage ${stage.title}`}
                        onDragOver={(event) => {
                          if (!canDrop) {
                            return;
                          }

                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'move';
                          if (dropStageKey !== stage.key) {
                            setDropStageKey(stage.key);
                          }
                        }}
                        onDragLeave={(event) => {
                          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            return;
                          }
                          if (dropStageKey === stage.key) {
                            setDropStageKey(null);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const leadId = event.dataTransfer.getData('text/plain');
                          if (!leadId) {
                            setDropStageKey(null);
                            return;
                          }

                          void handleStageDrop(leadId, stage.key);
                        }}
                        style={{
                          minWidth: 300,
                          borderColor: isDropTarget ? 'var(--mantine-color-blue-5)' : undefined,
                          background: isDropTarget ? 'rgba(34, 139, 230, 0.06)' : undefined,
                          transition: 'border-color 120ms ease, background 120ms ease',
                          borderRadius: 'var(--mantine-radius-xl)',
                        }}
                      >
                      <Paper
                        withBorder
                        radius="xl"
                        p="md"
                        miw={300}
                        className="premium-stat-card"
                      >
                        <Stack gap="sm">
                          <Group justify="space-between">
                            <Stack gap={0}>
                              <Text fw={700}>{stage.title}</Text>
                              <Text size="sm" c="dimmed">{stage.leads.length} lead{stage.leads.length === 1 ? '' : 's'}</Text>
                            </Stack>
                            <Badge color={stage.color} variant="light">{stage.key}</Badge>
                          </Group>
                          <Divider />
                          <Stack gap="sm">
                            {stage.leads.length === 0 ? (
                              <Text size="sm" c="dimmed">No leads in this stage.</Text>
                            ) : (
                              stage.leads.map((lead) => (
                                <div
                                  key={lead.id}
                                  data-testid="lead-kanban-card"
                                  role="group"
                                  aria-label={`Lead card ${lead.companyName}`}
                                  draggable={transitioningLeadId !== lead.id}
                                  onDragStart={(event) => {
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', lead.id);
                                    setDraggedLeadId(lead.id);
                                    setListError(null);
                                  }}
                                  onDragEnd={() => {
                                    dragSuppressUntilRef.current = Date.now() + 250;
                                    setDraggedLeadId(null);
                                    setDropStageKey(null);
                                  }}
                                  style={{
                                    cursor: transitioningLeadId === lead.id ? 'progress' : 'grab',
                                    opacity:
                                      transitioningLeadId === lead.id
                                        ? 0.55
                                        : draggedLeadId === lead.id
                                          ? 0.72
                                          : 1,
                                  }}
                                >
                                <Card
                                  withBorder
                                  radius="lg"
                                  p="md"
                                  className="premium-action-card"
                                  style={{ cursor: transitioningLeadId === lead.id ? 'progress' : 'pointer' }}
                                  onClick={() => openLeadRecord(lead.id)}
                                >
                                  <Stack gap="xs">
                                    <Group justify="space-between" align="flex-start">
                                      <Stack gap={2}>
                                        <Text fw={700}>{lead.companyName}</Text>
                                        <Text size="sm" c="dimmed">{lead.contactDisplayName}</Text>
                                      </Stack>
                                      {lead.potentialValueCents ? (
                                        <Text fw={700} c="blue">
                                          {formatCurrency(lead.potentialValueCents)}
                                        </Text>
                                      ) : (
                                        <Badge color={stage.color} variant="light">
                                          {lead.serviceTechCount} techs
                                        </Badge>
                                      )}
                                    </Group>
                                    <Group gap={6} wrap="wrap">
                                      <Badge variant="light" color="cyan">
                                        <Group gap={4} wrap="nowrap">
                                          <IconWorld size={12} />
                                          <Text size="xs" fw={700} inherit>{(lead.sourceSiteName ?? lead.leadSourceName).toUpperCase()}</Text>
                                        </Group>
                                      </Badge>
                                      {lead.sourceBrandTag ? (
                                        <Badge variant="light" color="blue">
                                          {lead.sourceBrandTag.toUpperCase()}
                                        </Badge>
                                      ) : null}
                                      {lead.leadRating ? (
                                        <Badge variant="light" color={leadRatingColor(lead.leadRating)}>
                                          {formatLeadRatingLabel(lead.leadRating)}
                                        </Badge>
                                      ) : null}
                                      <Badge variant="outline" color="gray">
                                        <Group gap={4} wrap="nowrap">
                                          <IconUsers size={12} />
                                          <Text size="xs" fw={600} inherit>{lead.serviceTechCount}</Text>
                                        </Group>
                                      </Badge>
                                      {lead.stage === 'new' ? (
                                        renderLeadSlaBadge(lead)
                                      ) : (
                                        <Badge variant="light" color="green">
                                          Contacted
                                        </Badge>
                                      )}
                                    </Group>
                                    <Text size="sm" c="dimmed">
                                      {lead.contactDisplayName}
                                      {lead.state ? ` · ${lead.state}` : ''}
                                    </Text>
                                    <Divider />
                                    <Group justify="space-between" align="center">
                                      <Text fw={600} size="sm">{primaryLeadActionLabel(lead)}</Text>
                                      <Group gap="xs" wrap="nowrap">
                                        {lead.phone ? (
                                          <ActionIcon
                                            component="a"
                                            href={`tel:${lead.phone}`}
                                            variant="subtle"
                                            color="blue"
                                            onClick={(event) => event.stopPropagation()}
                                            aria-label={`Call ${lead.companyName}`}
                                          >
                                            <IconPhone size={16} />
                                          </ActionIcon>
                                        ) : null}
                                        {lead.email ? (
                                          <ActionIcon
                                            component="a"
                                            href={`mailto:${lead.email}`}
                                            variant="subtle"
                                            color="teal"
                                            onClick={(event) => event.stopPropagation()}
                                            aria-label={`Email ${lead.companyName}`}
                                          >
                                            <IconMail size={16} />
                                          </ActionIcon>
                                        ) : null}
                                        <Group gap={4}>
                                          <Text size="xs" c="dimmed">{formatDateLabel(lead.updatedAt)}</Text>
                                          <IconChevronRight size={14} />
                                        </Group>
                                      </Group>
                                    </Group>
                                  </Stack>
                                </Card>
                                </div>
                              ))
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                      </div>
                    )})}
                  </Group>
                </ScrollArea>
              ) : (
                <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel">
                  <Table.ScrollContainer minWidth={980}>
                    <Table highlightOnHover verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Company</Table.Th>
                          <Table.Th>Contact</Table.Th>
                          <Table.Th>Stage</Table.Th>
                          <Table.Th>Routing</Table.Th>
                          <Table.Th>Lead source</Table.Th>
                          <Table.Th>Service techs</Table.Th>
                          <Table.Th>Updated</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {leads.map((lead) => (
                          <Table.Tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/leads/${lead.id}`)}>
                            <Table.Td fw={600}>{lead.companyName}</Table.Td>
                            <Table.Td>{lead.contactDisplayName}</Table.Td>
                            <Table.Td>{formatStageLabel(lead.stage)}</Table.Td>
                            <Table.Td>{formatRoutingTeam(lead.routingTeam)}</Table.Td>
                            <Table.Td>{lead.leadSourceName}</Table.Td>
                            <Table.Td>{lead.serviceTechCount}</Table.Td>
                            <Table.Td>{formatDateLabel(lead.updatedAt)}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Paper>
              )}

              {isLoadingLeads ? <Text size="sm" c="dimmed">Refreshing lead workspace...</Text> : null}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="analytics" pt="md">
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                {STAGE_META.map((stage) => (
                  <MetricCard key={stage.key} label={stage.shortTitle} value={String(stageCounts[stage.key] ?? 0)} icon={IconTimeline} color={stage.color} />
                ))}
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
                <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                  <Stack gap="md">
                    <Title order={4}>Lead source mix</Title>
                    {analyticsBySource.length === 0 ? (
                      <Text c="dimmed" size="sm">Lead source analytics will appear here once intake begins.</Text>
                    ) : (
                      analyticsBySource.map(([label, count]) => (
                        <Group key={label} justify="space-between">
                          <Text>{label}</Text>
                          <Badge variant="light" color="blue">{count}</Badge>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Paper>

                <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                  <Stack gap="md">
                    <Title order={4}>Routing distribution</Title>
                    {analyticsByRoutingTeam.length === 0 ? (
                      <Text c="dimmed" size="sm">Routing analytics will appear here once leads are assigned.</Text>
                    ) : (
                      analyticsByRoutingTeam.map(([label, count]) => (
                        <Group key={label} justify="space-between">
                          <Text>{label}</Text>
                          <Badge variant="light" color="grape">{count}</Badge>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Paper>
              </SimpleGrid>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <Modal opened={createLeadOpened} onClose={resetCreateLeadModal} title="New Intake" centered size="xl">
        <Stack gap="md">
          {duplicateCandidates.length > 0 ? (
            <Alert color="orange" variant="light">
              Pulse found potential duplicates. Review the matches below before deciding whether this should become a separate lead.
            </Alert>
          ) : null}
          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-end">
                <FileInput
                  leftSection={<IconFileUpload size={16} />}
                  label="Scan business card, badge, or handwritten note"
                  placeholder="Upload PDF, photo, or scan"
                  accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff"
                  value={ocrCaptureFile}
                  onChange={setOcrCaptureFile}
                  clearable
                  style={{ flex: 1 }}
                />
                <Button
                  variant="light"
                  leftSection={<IconFileUpload size={16} />}
                  onClick={() => void handlePreviewOcrCapture()}
                  loading={isPreviewingOcr}
                  disabled={!ocrCaptureFile}
                >
                  Scan
                </Button>
              </Group>
              {ocrPreview ? (
                <Alert color={ocrPreview.lowConfidence ? 'yellow' : 'teal'} variant="light">
                  OCR used {formatOcrMode(ocrPreview.extractionMode)} and filled the intake draft for review.
                  {ocrPreview.reviewReasons.length > 0 ? ` ${ocrPreview.reviewReasons.join(' ')}` : ''}
                </Alert>
              ) : null}
              {ocrDuplicateCandidates.length > 0 ? (
                <Stack gap="xs">
                  <Text size="sm" fw={700}>OCR duplicate candidates</Text>
                  {ocrDuplicateCandidates.map((candidate) => (
                    <Paper key={`ocr:${candidate.entityType}:${candidate.entityId}`} withBorder radius="md" p="sm">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={2}>
                          <Text fw={600}>{candidate.title}</Text>
                          {candidate.subtitle ? <Text size="sm" c="dimmed">{candidate.subtitle}</Text> : null}
                          {candidate.detail ? <Text size="xs" c="dimmed">{candidate.detail}</Text> : null}
                        </Stack>
                        <Badge color={candidate.entityType === 'account' ? 'teal' : 'orange'} variant="light">
                          {candidate.entityType === 'account' ? 'Account' : 'Lead'}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Paper>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <TextInput
              label="Company name"
              data-testid="lead-company-name"
              value={createLeadForm.companyName ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setCreateLeadForm((current) => ({ ...current, companyName: value }));
              }}
              required
            />
            <TextInput
              label="Contact name"
              data-testid="lead-contact-name"
              value={createLeadForm.contactDisplayName ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setCreateLeadForm((current) => ({ ...current, contactDisplayName: value }));
              }}
            />
            <TextInput
              label="Email"
              type="email"
              data-testid="lead-email"
              value={createLeadForm.email ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setCreateLeadForm((current) => ({ ...current, email: value }));
              }}
              required
            />
            <TextInput
              label="Phone"
              data-testid="lead-phone"
              value={createLeadForm.phone ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setCreateLeadForm((current) => ({ ...current, phone: value }));
              }}
              required
            />
            <Select
              searchable
              label="State / Province"
              placeholder="Select location..."
              value={createLeadForm.state || null}
              onChange={(value) => setCreateLeadForm((current) => ({ ...current, state: value ?? '' }))}
              data={leadRegionSelectData}
            />
            <Select
              label="Lead source"
              value={createLeadForm.leadSourceCode || null}
              onChange={(value) => setCreateLeadForm((current) => ({ ...current, leadSourceCode: value ?? 'manual_entry' }))}
              data={leadSources.map((source) => ({
                value: source.code,
                label: source.name,
              }))}
            />
            <Select
              label="Marketing source"
              placeholder="Select marketing source..."
              value={createLeadForm.sourceCampaign || null}
              onChange={(value) => setCreateLeadForm((current) => ({ ...current, sourceCampaign: value ?? '' }))}
              data={leadMarketingSourceOptions}
            />
            <Select
              label="Lead rating"
              placeholder="Select lead rating..."
              value={createLeadForm.leadRating || null}
              onChange={(value) => setCreateLeadForm((current) => ({ ...current, leadRating: value ?? '' }))}
              data={leadRatingOptions}
            />
          </SimpleGrid>
          <Paper withBorder radius="md" p="md" data-testid="lead-routing-section">
            <Stack gap="sm">
              <Alert color="blue" variant="light" title="Routing required">
                Pick the dealer relationship here so Pulse can route the lead. Use Independent / No group when the dealer is not part of an affinity, PE, or ownership group.
              </Alert>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Select
              label="Affinity group status"
              placeholder="Select affinity status..."
                  aria-label="Affinity group status"
                  data-testid="lead-affinity-group-status"
              value={createLeadForm.affinityGroupSelection || null}
              onChange={(value) =>
                setCreateLeadForm((current) => ({
                  ...current,
                  affinityGroupSelection: (value as ManualGroupAxisSelection | null) ?? '',
                  affinityGroupCode: value === 'group' ? current.affinityGroupCode : '',
                }))}
              data={manualGroupAxisSelectionOptions}
                  required
            />
            <Select
              label="Ownership group status"
              placeholder="Select ownership status..."
                  aria-label="Ownership group status"
                  data-testid="lead-ownership-group-status"
              value={createLeadForm.ownershipGroupSelection || null}
              onChange={(value) =>
                setCreateLeadForm((current) => ({
                  ...current,
                  ownershipGroupSelection: (value as ManualGroupAxisSelection | null) ?? '',
                  ownershipGroupCode: value === 'group' ? current.ownershipGroupCode : '',
                }))}
              data={manualGroupAxisSelectionOptions}
                  required
            />
            {createLeadForm.affinityGroupSelection === 'group' ? (
              <Select
                searchable
                label="Affinity group"
                placeholder="Choose affinity group..."
                    data-testid="lead-affinity-group"
                value={createLeadForm.affinityGroupCode || null}
                onChange={(value) => setCreateLeadForm((current) => ({ ...current, affinityGroupCode: value ?? '' }))}
                data={affinityGroups.map((group) => ({
                  value: group.code,
                  label: group.name,
                }))}
              />
            ) : null}
            {createLeadForm.ownershipGroupSelection === 'group' ? (
              <Select
                searchable
                label="Ownership group"
                placeholder="Choose ownership group..."
                    data-testid="lead-ownership-group"
                value={createLeadForm.ownershipGroupCode || null}
                onChange={(value) => setCreateLeadForm((current) => ({ ...current, ownershipGroupCode: value ?? '' }))}
                data={ownershipGroups.map((group) => ({
                  value: group.code,
                  label: group.name,
                }))}
              />
            ) : null}
              </SimpleGrid>
            </Stack>
          </Paper>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <NumberInput
              label="Service tech count"
              data-testid="lead-service-tech-count"
              value={createLeadForm.serviceTechCount ?? 0}
              onChange={(value) => setCreateLeadForm((current) => ({ ...current, serviceTechCount: Number(value) || 0 }))}
              min={0}
              required
            />
            <NumberInput
              label="Install tech count"
              data-testid="lead-install-tech-count"
              value={createLeadForm.installTechCount}
              onChange={(value) => setCreateLeadForm((current) => ({ ...current, installTechCount: Number(value) || 0 }))}
              min={0}
            />
          </SimpleGrid>
          <Textarea
            label="Notes"
            data-testid="lead-notes"
            value={createLeadForm.notes ?? ''}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateLeadForm((current) => ({ ...current, notes: value }));
            }}
            minRows={4}
          />
          {createLeadError ? <Text c="red">{createLeadError}</Text> : null}
          {duplicateCandidates.length > 0 ? (
            <Paper withBorder radius="md" p="md">
              <Stack gap="sm">
                <Text fw={700}>Potential duplicate matches</Text>
                {duplicateCandidates.map((candidate) => (
                  <Paper key={`${candidate.entityType}:${candidate.entityId}`} withBorder radius="md" p="sm">
                    <Group justify="space-between" align="flex-start">
                      <Stack gap={2}>
                        <Text fw={600}>{candidate.title}</Text>
                        {candidate.subtitle ? <Text size="sm" c="dimmed">{candidate.subtitle}</Text> : null}
                        {candidate.detail ? <Text size="xs" c="dimmed">{candidate.detail}</Text> : null}
                      </Stack>
                      <Badge color={candidate.entityType === 'account' ? 'teal' : 'orange'} variant="light">
                        {candidate.entityType === 'account' ? 'Account' : 'Lead'}
                      </Badge>
                    </Group>
                    {candidate.entityType === 'lead' ? (
                      <Group justify="flex-end" mt="sm">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => void handleEnrichDuplicateLead(candidate.entityId)}
                          loading={isCreatingLead}
                          disabled={!duplicateOverrideReason.trim()}
                        >
                          Enrich Existing Lead
                        </Button>
                      </Group>
                    ) : null}
                  </Paper>
                ))}
                <Textarea
                  label="Reason for separate lead"
                  description="Required to create a separate lead or enrich an existing lead."
                  value={duplicateOverrideReason}
                  onChange={(event) => setDuplicateOverrideReason(event.currentTarget.value)}
                  minRows={2}
                />
              </Stack>
            </Paper>
          ) : null}
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Manual intake lands in the same governed routing pipeline as web and import leads.
            </Text>
            {duplicateCandidates.length > 0 ? (
              <Group gap="xs">
                <Button
                  variant="default"
                  onClick={() => {
                    setDuplicateCandidates([]);
                    setPendingDuplicatePayload(null);
                    setDuplicateOverrideReason('');
                    setCreateLeadError(null);
                  }}
                  disabled={isCreatingLead}
                >
                  Review Intake
                </Button>
                <Button
                  onClick={() => void handleConfirmDuplicateCreate()}
                  loading={isCreatingLead}
                  color="orange"
                  disabled={!duplicateOverrideReason.trim()}
                >
                  Create Lead Anyway
                </Button>
              </Group>
            ) : (
              <Button onClick={() => void handleCreateLead()} loading={isCreatingLead}>
                Create Lead
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof IconUsers;
  color: string;
}) {
  return (
    <Card withBorder padding="lg" radius="xl" className="premium-stat-card">
      <Group justify="space-between">
        <Stack gap="xs">
          <Text size="sm" c="dimmed">{label}</Text>
          <Text size="xl" fw={700}>{value}</Text>
        </Stack>
        <ThemeIcon size="lg" variant="light" color={color}>
          <Icon size={20} />
        </ThemeIcon>
      </Group>
    </Card>
  );
}

function ActionCard({
  title,
  description,
  actionLabel,
  icon: Icon,
  color,
  href,
  onClick,
}: {
  title: string;
  description: string;
  actionLabel: string;
  icon: typeof IconTimeline;
  color: string;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <Card withBorder padding="lg" radius="xl" className="premium-action-card">
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start">
          <ThemeIcon size="xl" variant="light" color={color}>
            <Icon size={30} />
          </ThemeIcon>
        </Group>
        <Stack gap="xs" style={{ flex: 1 }}>
          <Title order={4}>{title}</Title>
          <Text size="sm" c="dimmed">{description}</Text>
        </Stack>
        {href ? (
          <Button variant="light" fullWidth component={Link} href={href}>
            {actionLabel}
          </Button>
        ) : (
          <Button variant="light" fullWidth onClick={onClick}>
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function formatRoutingTeam(value: LeadRoutingTeamKey) {
  return value === 'strategic_growth' ? 'Strategic Growth' : 'National TM';
}

function formatRoutingBasis(value: LeadRoutingPolicySummary['routingBasis']) {
  return value === 'truck_count' ? 'Truck Count' : 'Service Tech Count';
}

function formatStageLabel(value: LeadStageKey) {
  return STAGE_META.find((stage) => stage.key === value)?.shortTitle ?? value;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function leadRatingColor(value: string) {
  switch (value) {
    case 'hot':
      return 'orange';
    case 'warm':
      return 'yellow';
    case 'cold':
      return 'blue';
    case 'whale':
      return 'grape';
    case 'not_interested':
      return 'gray';
    default:
      return 'blue';
  }
}

function formatLeadRatingLabel(value: string) {
  return value
    .split('_')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(' ');
}

function renderLeadSlaBadge(lead: LeadSummary) {
  if (!lead.initialContactDueAt) {
    return (
      <Badge variant="light" color="gray">
        SLA pending
      </Badge>
    );
  }

  const hoursLeft = Math.floor((new Date(lead.initialContactDueAt).getTime() - Date.now()) / 3600000);
  if (hoursLeft < 0) {
    return (
      <Badge variant="filled" color="red">
        SLA Overdue
      </Badge>
    );
  }

  return (
    <Badge variant="light" color={hoursLeft < 12 ? 'orange' : 'blue'}>
      {hoursLeft}h SLA
    </Badge>
  );
}

function primaryLeadActionLabel(lead: LeadSummary) {
  switch (lead.stage) {
    case 'new':
      return 'Make Initial Contact';
    case 'discovery_scheduled':
      return 'Complete Discovery';
    case 'discovery_completed':
      return 'Send CIS';
    case 'cis_sent':
      return 'Follow Up CIS';
    case 'cis_signed':
      return 'Finish Setup';
    case 'onboarding_completed':
      return 'Ready for First Order';
    case 'customer_active':
      return 'Customer Active';
    default:
      return 'Open Lead';
  }
}

function formatOcrMode(value: PreviewLeadOcrCaptureResponse['extractionMode']) {
  switch (value) {
    case 'direct_text':
      return 'direct PDF text extraction';
    case 'tesseract_ocr':
      return 'Tesseract OCR';
    case 'manual_text':
      return 'review text';
  }
}

function readOcrStringField(value: string | number | undefined) {
  return typeof value === 'string' ? value : '';
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read OCR file'));
        return;
      }
      resolve(result.includes(',') ? result.split(',')[1] ?? '' : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read OCR file'));
    reader.readAsDataURL(file);
  });
}

function downloadCsv(filename: string, rows: Record<string, string>[]) {
  if (rows.length === 0 || typeof window === 'undefined') {
    return;
  }

  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => `"${(row[header] ?? '').replace(/"/g, '""')}"`)
        .join(','),
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

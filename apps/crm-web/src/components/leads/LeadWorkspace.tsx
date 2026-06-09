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
  Menu,
  Modal,
  NumberInput,
  Pagination,
  Paper,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Stepper,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowRight,
  IconChartBar,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconDownload,
  IconFileUpload,
  IconMail,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconTimeline,
  IconWorld,
} from '@tabler/icons-react';
import {
  type AffinityGroupReferenceSummary,
  type CreateLeadRequest,
  type GroupAxisSelectionKey,
  type LeadImportDuplicateCandidate,
  type LeadOcrCaptureDocumentTypeKey,
  type PreviewLeadOcrCaptureResponse,
  type LeadRoutingTeamKey,
  type LeadStageKey,
  type LeadSummary,
  type OwnershipGroupReferenceSummary,
  type ReferenceValueSummary,
  type TerritorySummary,
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
  fetchLeadSources,
  fetchLeads,
  fetchOwnershipGroups,
  fetchTerritories,
  previewLeadDuplicateCandidates,
  previewLeadOcrCapture,
  reassignLeadTerritory,
  transitionLeadStage,
} from '@/lib/pulse-api';
import { fetchLeadsPage } from '@/lib/pulse-api-ext-leads-cis';
import { canAccessModule } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import { EmptyStateMessage, RowActionMenu, WorkbenchAttentionPanel, WorkbenchHeader, WorkbenchMetricStrip } from '@/components/ui/Workbench';

export type LeadWorkspaceTab = 'queue' | 'insights';
type ViewMode = 'kanban' | 'list';
type LeadIntakeStep = 'customer' | 'routing' | 'review';
type DuplicateReviewStatus = 'idle' | 'clear' | 'matches';
type ManualGroupAxisSelection = GroupAxisSelectionKey | '';
type LeadCreateFormState = {
  companyName: string;
  contactDisplayName: string;
  /** UX-L-017: referral context — maps to sourceDetail when source is referral */
  sourceDetail: string;
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
  sourceBrandTag: string;
  privateLabelName: string;
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
  sourceDetail: '',
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
  sourceBrandTag: '',
  privateLabelName: '',
};

const leadRegionOptions = APP_LEAD_REGION_OPTIONS;
const leadMarketingSourceOptions = APP_LEAD_MARKETING_SOURCES;
const leadRatingOptions = APP_LEAD_RATINGS;
const leadOcrCaptureTypeOptions = [
  { value: 'business_card', label: 'Business card' },
  { value: 'show_badge', label: 'Show badge' },
  { value: 'handwritten_note', label: 'Handwritten note' },
  { value: 'other', label: 'Other file' },
] satisfies ReadonlyArray<{ value: LeadOcrCaptureDocumentTypeKey; label: string }>;
const manualGroupAxisSelectionOptions = [
  { value: 'none', label: 'Independent / no group' },
  { value: 'group', label: 'Select governed group' },
] satisfies ReadonlyArray<{ value: Exclude<GroupAxisSelectionKey, 'unknown'>; label: string }>;

const leadRegionSelectData = leadRegionOptions.map((option) => ({
  value: option.value,
  label: `${option.label} (${option.value})`,
}));

export function LeadWorkspace({
  initialTab = 'queue',
}: {
  initialTab?: LeadWorkspaceTab;
}) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const router = useRouter();
  const canOpenFinanceQueue = Boolean(auth?.identity.role && canAccessModule(auth.identity.role, 'cis'));
  const [activeTab, setActiveTab] = useState<LeadWorkspaceTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [leadSources, setLeadSources] = useState<ReferenceValueSummary[]>([]);
  const [affinityGroups, setAffinityGroups] = useState<AffinityGroupReferenceSummary[]>([]);
  const [ownershipGroups, setOwnershipGroups] = useState<OwnershipGroupReferenceSummary[]>([]);
  const [territories, setTerritories] = useState<TerritorySummary[]>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStageKey | ''>('');
  const [routingTeamFilter, setRoutingTeamFilter] = useState<LeadRoutingTeamKey | ''>('');
  const [leadSourceFilter, setLeadSourceFilter] = useState('');
  const [territoryIdFilter, setTerritoryIdFilter] = useState('');
  const [leads, setLeads] = useState<LeadSummary[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [listError, setListError] = useState<string | null>(null);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [createLeadOpened, { open: openCreateLead, close: closeCreateLead }] = useDisclosure(false);
  const [createLeadStep, setCreateLeadStep] = useState<LeadIntakeStep>('customer');
  const [createLeadForm, setCreateLeadForm] = useState<LeadCreateFormState>(EMPTY_LEAD_FORM);
  const [createLeadError, setCreateLeadError] = useState<string | null>(null);
  const [isCreatingLead, setIsCreatingLead] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<LeadImportDuplicateCandidate[]>([]);
  const [pendingDuplicatePayload, setPendingDuplicatePayload] = useState<CreateLeadRequest | null>(null);
  const [duplicateReviewStatus, setDuplicateReviewStatus] = useState<DuplicateReviewStatus>('idle');
  const [duplicateOverrideReason, setDuplicateOverrideReason] = useState('');
  const [ocrCaptureFile, setOcrCaptureFile] = useState<File | null>(null);
  const [ocrCaptureDocumentType, setOcrCaptureDocumentType] = useState<LeadOcrCaptureDocumentTypeKey>('business_card');
  const [ocrPreview, setOcrPreview] = useState<PreviewLeadOcrCaptureResponse | null>(null);
  const [ocrDuplicateCandidates, setOcrDuplicateCandidates] = useState<LeadImportDuplicateCandidate[]>([]);
  const [isPreviewingOcr, setIsPreviewingOcr] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropStageKey, setDropStageKey] = useState<LeadStageKey | null>(null);
  const [transitioningLeadId, setTransitioningLeadId] = useState<string | null>(null);
  const dragSuppressUntilRef = useRef(0);
  const [reassignLeadTarget, setReassignLeadTarget] = useState<LeadSummary | null>(null);
  const [reassignTerritoryId, setReassignTerritoryId] = useState('');
  const [reassignReasonCode, setReassignReasonCode] = useState('territory_realignment');
  const [reassignReasonNote, setReassignReasonNote] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  // UX-L-013: pagination
  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  // UX-L-014: affinity / ownership group queue filters
  const [affinityGroupFilter, setAffinityGroupFilter] = useState('');
  const [ownershipGroupFilter, setOwnershipGroupFilter] = useState('');
  // UX-L-011: backward stage gate
  const [backwardStageTarget, setBackwardStageTarget] = useState<{ leadId: string; toStage: LeadStageKey } | null>(null);
  const [backwardStageReason, setBackwardStageReason] = useState('');
  const [isConfirmingBackwardStage, setIsConfirmingBackwardStage] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery.trim());

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!auth) {
      setLeadSources([]);
      setAffinityGroups([]);
      setOwnershipGroups([]);
      setTerritories([]);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadReferences() {
      setReferenceError(null);

      try {
        const [leadSourceResponse, affinityGroupResponse, ownershipGroupResponse, territoriesResponse] = await Promise.all([
          fetchLeadSources(apiBaseUrl, accessToken),
          fetchAffinityGroups(apiBaseUrl, accessToken),
          fetchOwnershipGroups(apiBaseUrl, accessToken),
          fetchTerritories(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setLeadSources(leadSourceResponse.items);
        setAffinityGroups(affinityGroupResponse.items);
        setOwnershipGroups(ownershipGroupResponse.items);
        setTerritories(territoriesResponse.items);
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
        // UX-L-013: paginated fetch; UX-L-014: group filters
        const response = await fetchLeadsPage(apiBaseUrl, accessToken, {
          ...(deferredSearch ? { search: deferredSearch } : {}),
          ...(stageFilter ? { stage: stageFilter } : {}),
          ...(routingTeamFilter ? { routingTeam: routingTeamFilter } : {}),
          ...(leadSourceFilter ? { leadSourceCode: leadSourceFilter } : {}),
          ...(territoryIdFilter ? { territoryId: territoryIdFilter } : {}),
          ...(affinityGroupFilter ? { affinityGroupCode: affinityGroupFilter } : {}),
          ...(ownershipGroupFilter ? { ownershipGroupCode: ownershipGroupFilter } : {}),
          limit: PAGE_SIZE,
          page: currentPage - 1,
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
  }, [apiBaseUrl, auth, affinityGroupFilter, currentPage, deferredSearch, leadSourceFilter, ownershipGroupFilter, refreshNonce, routingTeamFilter, stageFilter, territoryIdFilter]);

  // UX-L-013: reset to page 1 when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearch, stageFilter, routingTeamFilter, leadSourceFilter, territoryIdFilter, affinityGroupFilter, ownershipGroupFilter, refreshNonce]);

  // UX-L-009: in-app SLA breach notification when overdue leads exist in the queue
  useEffect(() => {
    if (!leads.length) {
      return;
    }
    const overdueCount = leads.filter(
      (lead) => lead.initialContactDueAt && new Date(lead.initialContactDueAt).getTime() < Date.now(),
    ).length;
    if (overdueCount > 0) {
      notifications.show({
        id: 'sla-breach-alert',
        title: `${overdueCount} lead${overdueCount === 1 ? '' : 's'} past SLA deadline`,
        message: 'Review the overdue leads and make initial contact as soon as possible.',
        color: 'red',
        autoClose: 8000,
      });
    }
  }, [leads]);

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

  const digitalIntakeCount = useMemo(
    () => leads.filter((lead) => lead.sourceSiteId || lead.leadCaptureMethod === 'direct_web_form').length,
    [leads],
  );

  const overdueInitialContactCount = useMemo(
    () =>
      leads.filter((lead) => (
        lead.stage === 'new'
        && lead.initialContactDueAt
        && new Date(lead.initialContactDueAt).getTime() < Date.now()
      )).length,
    [leads],
  );

  const leadWorkbenchMetrics = useMemo(
    () => [
      { label: 'Residential leads', value: totalLeads, tone: 'blue', helper: `Loaded ${leads.length} in this view` },
      { label: 'Digital intake', value: digitalIntakeCount, tone: 'cyan', helper: 'Website and direct form leads' },
      { label: 'Awaiting CIS', value: stageCounts.cis_sent ?? 0, tone: 'orange', helper: 'Follow-up queue' },
      { label: 'Ready first order', value: stageCounts.onboarding_completed ?? 0, tone: 'teal', helper: 'Onboarding complete' },
    ],
    [digitalIntakeCount, leads.length, stageCounts.cis_sent, stageCounts.onboarding_completed, totalLeads],
  );

  const leadAttentionItems = useMemo(
    () => {
      const cisFollowUpCount = stageCounts.cis_sent ?? 0;
      const readyFirstOrderCount = stageCounts.onboarding_completed ?? 0;
      return [
        {
        id: 'initial-contact-overdue',
        title: 'Initial contact overdue',
        description: 'New leads past the first-contact SLA.',
        count: overdueInitialContactCount,
        tone: overdueInitialContactCount > 0 ? 'red' : 'gray',
        action: overdueInitialContactCount > 0 ? (
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setActiveTab('queue');
              setViewMode('list');
              setStageFilter('new');
            }}
          >
            Review
          </Button>
        ) : undefined,
      },
      {
        id: 'cis-follow-up',
        title: 'CIS follow-up',
        description: 'Leads waiting on signed CIS paperwork.',
        count: cisFollowUpCount,
        tone: 'orange',
        action: cisFollowUpCount > 0 ? (
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setActiveTab('queue');
              setViewMode('list');
              setStageFilter('cis_sent');
            }}
          >
            Open
          </Button>
        ) : undefined,
      },
      {
        id: 'first-order-ready',
        title: 'Ready for first order',
        description: 'Onboarding is complete and the lead is ready for activation.',
        count: readyFirstOrderCount,
        tone: 'teal',
        action: readyFirstOrderCount > 0 ? (
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setActiveTab('queue');
              setViewMode('list');
              setStageFilter('onboarding_completed');
            }}
          >
            Open
          </Button>
        ) : undefined,
      },
    ];
    },
    [overdueInitialContactCount, stageCounts.cis_sent, stageCounts.onboarding_completed],
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

  // UX-L-012: time-in-stage, pipeline value, territory breakdown
  const analyticsByTerritory = useMemo(() => {
    const summary = new Map<string, number>();
    for (const lead of leads) {
      const label = lead.territoryCode ?? lead.territoryId ?? 'Unassigned';
      summary.set(label, (summary.get(label) ?? 0) + 1);
    }
    return [...summary.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const totalPipelineValueCents = useMemo(
    () => leads.reduce((sum, lead) => sum + (lead.potentialValueCents ?? 0), 0),
    [leads],
  );

  const timeInStageAnalytics = useMemo(() => {
    const now = Date.now();
    const stageMap = new Map<LeadStageKey, number[]>();
    for (const lead of leads) {
      const updatedMs = new Date(lead.updatedAt).getTime();
      const daysInStage = Math.floor((now - updatedMs) / (1000 * 60 * 60 * 24));
      const existing = stageMap.get(lead.stage) ?? [];
      stageMap.set(lead.stage, [...existing, daysInStage]);
    }
    return STAGE_META.map((stage) => {
      const values = stageMap.get(stage.key) ?? [];
      const avg = values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
      return { stage: stage.shortTitle, avg, count: values.length };
    });
  }, [leads]);

  const slaTrendBreaches = useMemo(() => {
    const now = Date.now();
    return leads.filter(
      (lead) => lead.initialContactDueAt && new Date(lead.initialContactDueAt).getTime() < now,
    ).length;
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
      ...(createLeadForm.sourceBrandTag.trim() ? { sourceBrandTag: createLeadForm.sourceBrandTag.trim() } : {}),
      ...(createLeadForm.privateLabelName.trim() ? { privateLabelName: createLeadForm.privateLabelName.trim() } : {}),
      // UX-L-017: referral context stored in sourceDetail
      ...(createLeadForm.sourceDetail.trim() ? { sourceDetail: createLeadForm.sourceDetail.trim() } : {}),
    };
  }

  function clearDuplicateReviewState() {
    setDuplicateCandidates([]);
    setPendingDuplicatePayload(null);
    setDuplicateReviewStatus('idle');
    setDuplicateOverrideReason('');
  }

  function updateCreateLeadDraft(updater: (current: LeadCreateFormState) => LeadCreateFormState) {
    clearDuplicateReviewState();
    setCreateLeadForm(updater);
  }

  function validateCustomerStep() {
    if (
      !createLeadForm.companyName.trim()
      || !createLeadForm.serviceTechCount
      || !createLeadForm.email.trim()
      || !createLeadForm.phone.trim()
    ) {
      setCreateLeadError('Company name, email, phone, and service tech count are required.');
      return false;
    }

    setCreateLeadError(null);
    return true;
  }

  function validateRoutingStep() {
    if (!createLeadForm.affinityGroupSelection) {
      setCreateLeadError('Choose an affinity group status before creating a manual lead.');
      return false;
    }

    if (!createLeadForm.ownershipGroupSelection) {
      setCreateLeadError('Choose an ownership group status before creating a manual lead.');
      return false;
    }

    if (createLeadForm.affinityGroupSelection === 'group' && !createLeadForm.affinityGroupCode) {
      setCreateLeadError('Choose an affinity group when the affinity selection is set to a governed group.');
      return false;
    }

    if (createLeadForm.ownershipGroupSelection === 'group' && !createLeadForm.ownershipGroupCode) {
      setCreateLeadError('Choose an ownership group when the ownership selection is set to a governed group.');
      return false;
    }

    setCreateLeadError(null);
    return true;
  }

  function handleContinueToRouting() {
    if (validateCustomerStep()) {
      clearDuplicateReviewState();
      setCreateLeadStep('routing');
    }
  }

  function handleContinueToReview() {
    if (validateCustomerStep() && validateRoutingStep()) {
      clearDuplicateReviewState();
      setCreateLeadStep('review');
    }
  }

  function handleBackInCreateLead() {
    clearDuplicateReviewState();
    setCreateLeadError(null);
    if (createLeadStep === 'review') {
      setCreateLeadStep('routing');
      return;
    }

    if (createLeadStep === 'routing') {
      setCreateLeadStep('customer');
    }
  }

  function resetCreateLeadModal() {
    setCreateLeadForm({
      ...EMPTY_LEAD_FORM,
      leadSourceCode: createLeadForm.leadSourceCode || 'manual_entry',
    });
    setCreateLeadStep('customer');
    setCreateLeadError(null);
    setDuplicateCandidates([]);
    setPendingDuplicatePayload(null);
    setDuplicateReviewStatus('idle');
    setDuplicateOverrideReason('');
    setOcrCaptureFile(null);
    setOcrCaptureDocumentType('business_card');
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
        documentType: ocrCaptureDocumentType,
        fileName: ocrCaptureFile.name,
        mimeType: ocrCaptureFile.type || 'application/octet-stream',
        contentBase64,
        ...(createLeadForm.serviceTechCount > 0 ? { serviceTechCountFallback: createLeadForm.serviceTechCount } : {}),
      });

      setOcrPreview(preview);
      setOcrDuplicateCandidates(preview.duplicatePreview.candidates);
      updateCreateLeadDraft((current) => ({
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
      setActiveTab('queue');
      setViewMode('list');
      router.push(`/leads/${response.id}`);
    });
    setRefreshNonce((value) => value + 1);
  }

  async function handleReviewDuplicateCandidates() {
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
        setDuplicateReviewStatus('matches');
        setDuplicateOverrideReason('');
        return;
      }

      setDuplicateCandidates([]);
      setPendingDuplicatePayload(payload);
      setDuplicateReviewStatus('clear');
      setDuplicateOverrideReason('');
    } catch (error) {
      setCreateLeadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingLead(false);
    }
  }

  async function handleCreateReviewedLead() {
    if (!pendingDuplicatePayload || duplicateReviewStatus !== 'clear') {
      setCreateLeadError('Review possible matches before saving this lead.');
      return;
    }

    setIsCreatingLead(true);
    setCreateLeadError(null);
    try {
      await finishCreateLead(pendingDuplicatePayload);
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

  function handleUseExistingLead(leadId: string) {
    resetCreateLeadModal();
    router.push(`/leads/${leadId}`);
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

    // UX-L-011: BR-L-07 — backward stage requires a reason gate
    const fromIndex = STAGE_META.findIndex((s) => s.key === lead.stage);
    const toIndex = STAGE_META.findIndex((s) => s.key === nextStage);
    if (toIndex < fromIndex) {
      setDraggedLeadId(null);
      setDropStageKey(null);
      setBackwardStageTarget({ leadId, toStage: nextStage });
      setBackwardStageReason('');
      return;
    }

    await executeStageTransition(leadId, nextStage, undefined);
  }

  async function executeStageTransition(leadId: string, nextStage: LeadStageKey, backwardReason: string | undefined) {
    if (!auth) {
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
        ...(backwardReason ? { backwardReason } : {}),
      });

      setLeads((current) => current.map((entry) => (entry.id === leadId ? updatedLead : entry)));
    } catch (error) {
      setLeads(previousLeads);
      setListError(error instanceof Error ? error.message : String(error));
    } finally {
      setTransitioningLeadId(null);
    }
  }

  async function handleConfirmBackwardStage() {
    if (!backwardStageTarget || !backwardStageReason.trim()) {
      return;
    }
    setIsConfirmingBackwardStage(true);
    const { leadId, toStage } = backwardStageTarget;
    try {
      await executeStageTransition(leadId, toStage, backwardStageReason.trim());
    } finally {
      setIsConfirmingBackwardStage(false);
      setBackwardStageTarget(null);
      setBackwardStageReason('');
    }
  }

  async function handleReassignLead() {
    if (!auth || !reassignLeadTarget || !reassignTerritoryId) {
      return;
    }
    setIsReassigning(true);
    try {
      await reassignLeadTerritory(apiBaseUrl, auth.tokens.accessToken, reassignLeadTarget.id, {
        territoryId: reassignTerritoryId,
        reasonCode: reassignReasonCode,
        ...(reassignReasonNote.trim() ? { reasonNote: reassignReasonNote.trim() } : {}),
      });
      setReassignLeadTarget(null);
      setRefreshNonce((n) => n + 1);
      notifications.show({ title: 'Lead reassigned', message: 'Territory assignment updated.', color: 'green' });
    } catch (error) {
      notifications.show({ title: 'Reassign failed', message: error instanceof Error ? error.message : String(error), color: 'red' });
    } finally {
      setIsReassigning(false);
    }
  }

  if (!isHydrated || !auth) {
    return null;
  }

  return (
    <>
      <Stack gap="md">
        <WorkbenchHeader
          eyebrow="Residential Program"
          title="Lead Work Queue"
          description="Work residential leads by next action, SLA, owner, source, and routing status before opening board or reporting views."
          policyText={`Loaded ${leads.length} of ${totalLeads}`}
          primaryAction={(
            <Button
              leftSection={<IconPlus size={16} />}
              variant="gradient"
              gradient={{ from: 'blue', to: 'indigo', deg: 120 }}
              onClick={openCreateLead}
            >
              New Intake
            </Button>
          )}
          secondaryActions={(
            <Group gap="sm" justify="flex-end">
              <Menu position="bottom-end" withinPortal shadow="md" width={220}>
                <Menu.Target>
                  <Button variant="default" rightSection={<IconChevronDown size={14} />}>
                    More
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Review</Menu.Label>
                  {latestLead ? (
                    <Menu.Item
                      leftSection={<IconArrowRight size={14} />}
                      onClick={() => router.push(`/leads/${latestLead.id}`)}
                    >
                      Open Latest Intake
                    </Menu.Item>
                  ) : null}
                  {viewMode === 'kanban' ? (
                    <Menu.Item
                      leftSection={<IconTimeline size={14} />}
                      onClick={() => {
                        setActiveTab('queue');
                        setViewMode('list');
                      }}
                    >
                      Lead Work Queue
                    </Menu.Item>
                  ) : null}
                  <Menu.Item
                    leftSection={<IconTimeline size={14} />}
                    onClick={() => {
                      setActiveTab('queue');
                      setViewMode('kanban');
                    }}
                  >
                    Pipeline board
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconChartBar size={14} />}
                    onClick={() => setActiveTab('insights')}
                  >
                    Insights
                  </Menu.Item>
                  <Menu.Label>Intake</Menu.Label>
                  <Menu.Item
                    component={Link}
                    href="/leads/import"
                    leftSection={<IconFileUpload size={14} />}
                  >
                    Bulk import
                  </Menu.Item>
                  <Menu.Item
                    component={Link}
                    href="/leads/forms"
                    leftSection={<IconWorld size={14} />}
                  >
                    Website form setup
                  </Menu.Item>
                  <Menu.Label>Workflow</Menu.Label>
                  <Menu.Item
                    component={Link}
                    href="/leads/activities"
                    leftSection={<IconClock size={14} />}
                  >
                    Workflow review
                  </Menu.Item>
                  {canOpenFinanceQueue ? (
                    <Menu.Item
                      component={Link}
                      href="/leads/finance"
                      leftSection={<IconClock size={14} />}
                    >
                      Finance Queue
                    </Menu.Item>
                  ) : null}
                  <Menu.Divider />
                  <Menu.Item leftSection={<IconDownload size={14} />} onClick={exportVisibleLeads}>
                    Export Report
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        />

        {referenceError ? (
          <Paper withBorder p="md" radius="xl" className="premium-subhero-panel">
            <Text c="red">{referenceError}</Text>
          </Paper>
        ) : null}

        <Tabs value={activeTab} onChange={(value) => setActiveTab((value as LeadWorkspaceTab) || 'queue')} className="premium-tabs-shell">
          <Tabs.List>
            <Tabs.Tab value="queue" leftSection={<IconTimeline size={16} />}>
              Lead Work Queue
            </Tabs.Tab>
            <Tabs.Tab value="insights" leftSection={<IconChartBar size={16} />}>
              Insights
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="queue" pt="md">
            <Stack gap="md" data-testid="lead-work-queue-panel">
              <WorkbenchAttentionPanel
                description="A compact operator lane for the lead work that can change today."
                items={leadAttentionItems}
              />

              <Paper withBorder p="md" radius="xl" className="premium-filter-bar">
                <Group gap="sm" wrap="wrap" align="flex-end">
                  <TextInput
                    data-testid="lead-search-input"
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
                  <Select
                    placeholder="Territory"
                    value={territoryIdFilter}
                    onChange={(value) => setTerritoryIdFilter(value ?? '')}
                    data={territories
                      .filter((t) => t.isActive)
                      .map((t) => ({ value: t.id, label: `${t.code} – ${t.name}` }))}
                    clearable
                    searchable
                    w={200}
                  />
                  {/* UX-L-014: affinity / ownership group filters */}
                  <Select
                    placeholder="Affinity group"
                    value={affinityGroupFilter}
                    onChange={(value) => setAffinityGroupFilter(value ?? '')}
                    data={affinityGroups.map((g) => ({ value: g.code, label: g.name }))}
                    clearable
                    searchable
                    w={200}
                  />
                  <Select
                    placeholder="Ownership group"
                    value={ownershipGroupFilter}
                    onChange={(value) => setOwnershipGroupFilter(value ?? '')}
                    data={ownershipGroups.map((g) => ({ value: g.code, label: g.name }))}
                    clearable
                    searchable
                    w={200}
                  />
                  <ActionIcon variant="light" size="lg" aria-label="Refresh leads" onClick={() => setRefreshNonce((value) => value + 1)}>
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
                <ScrollArea type="auto" data-testid="lead-pipeline-board">
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
                      >
                        <Stack gap="sm">
                          <Group justify="space-between">
                            <Stack gap={0}>
                              <Text fw={700}>{stage.title}</Text>
                              <Text size="sm" c="dimmed">{stage.leads.length} lead{stage.leads.length === 1 ? '' : 's'}</Text>
                            </Stack>
                            <Badge color={stage.color} variant="light">{stage.shortTitle}</Badge>
                          </Group>
                          <Divider />
                          <Stack gap="sm">
                            {/* UX-L-002: ghost card when stage column is empty */}
                            {stage.leads.length === 0 ? (
                              <Paper
                                withBorder
                                radius="lg"
                                p="md"
                                style={{ opacity: 0.45, borderStyle: 'dashed' }}
                              >
                                <Text size="sm" c="dimmed" ta="center">No leads in this stage</Text>
                              </Paper>
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
                                        <Text size="sm" c="dimmed">
                                          {lead.contactDisplayName}
                                          {lead.state ? ` · ${lead.state}` : ''}
                                        </Text>
                                      </Stack>
                                      <IconChevronRight size={16} />
                                    </Group>
                                    <Group gap={6} wrap="wrap">
                                      <Badge variant="light" color="cyan">
                                        <Group gap={4} wrap="nowrap">
                                          <IconWorld size={12} />
                                          <Text size="xs" fw={700} inherit>{(lead.sourceSiteName ?? lead.leadSourceName).toUpperCase()}</Text>
                                        </Group>
                                      </Badge>
                                      {lead.stage === 'new' ? (
                                        renderLeadSlaBadge(lead)
                                      ) : (
                                        <Badge variant="light" color="green">
                                          Contacted
                                        </Badge>
                                      )}
                                      {/* UX-L-004: lifecycle badge on kanban card */}
                                      {lead.lifecycleStatus !== 'active' ? (
                                        <Badge
                                          variant="light"
                                          color={lead.lifecycleStatus === 'parked' ? 'orange' : 'gray'}
                                        >
                                          {lead.lifecycleStatus === 'parked' ? 'Parked' : 'Closed'}
                                        </Badge>
                                      ) : null}
                                    </Group>
                                    {lead.leadRating || lead.potentialValueCents ? (
                                      <Text size="xs" c="dimmed">
                                        {[
                                          lead.leadRating ? formatLeadRatingLabel(lead.leadRating) : null,
                                          lead.potentialValueCents ? formatCurrency(lead.potentialValueCents) : null,
                                        ].filter(Boolean).join(' • ')}
                                      </Text>
                                    ) : null}
                                    <Divider />
                                    <Group justify="space-between" align="center">
                                      <Stack gap={0}>
                                        <Text fw={600} size="sm">{leadActionLabel(lead)}</Text>
                                        <Text size="xs" c="dimmed">Updated {formatDateLabel(lead.updatedAt)}</Text>
                                      </Stack>
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
                <Paper withBorder radius="xl" p="sm" className="premium-subhero-panel" data-testid="lead-work-queue">
                  <Table.ScrollContainer minWidth={980}>
                    <Table highlightOnHover verticalSpacing="sm">
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Next action</Table.Th>
                          <Table.Th>Company</Table.Th>
                          <Table.Th>Contact</Table.Th>
                          <Table.Th>Owner / routing</Table.Th>
                          <Table.Th>Updated / SLA</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {leads.map((lead) => (
                          <Table.Tr key={lead.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/leads/${lead.id}`)}>
                            <Table.Td>
                              <Stack gap={6}>
                                <Group gap="xs" wrap="wrap">
                                  <Text fw={700}>{leadActionLabel(lead)}</Text>
                                  <Badge color={leadActionColor(lead)} variant="light">
                                    {formatStageLabel(lead.stage)}
                                  </Badge>
                                  {/* UX-L-004: lifecycle badge on list row */}
                                  {lead.lifecycleStatus !== 'active' ? (
                                    <Badge
                                      variant="light"
                                      color={lead.lifecycleStatus === 'parked' ? 'orange' : 'gray'}
                                    >
                                      {lead.lifecycleStatus === 'parked' ? 'Parked' : 'Closed'}
                                    </Badge>
                                  ) : null}
                                </Group>
                                {lead.workflowTask?.reason ? (
                                  <Text size="xs" c="dimmed" lineClamp={2}>
                                    {lead.workflowTask.reason}
                                  </Text>
                                ) : null}
                                <Group gap="xs" wrap="wrap">
                                  <Button
                                    component={Link}
                                    href={`/leads/${lead.id}`}
                                    variant="light"
                                    color={leadActionColor(lead)}
                                    size="xs"
                                    w="fit-content"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    Open lead
                                  </Button>
                                  <Group onClick={(e) => e.stopPropagation()}>
                                    <RowActionMenu items={[{ id: 'reassign', label: 'Reassign lead', onClick: () => { setReassignLeadTarget(lead); setReassignTerritoryId(lead.territoryId ?? ''); setReassignReasonCode('territory_realignment'); setReassignReasonNote(''); } }]} />
                                  </Group>
                                </Group>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text fw={600}>{lead.companyName}</Text>
                                <Text size="xs" c="dimmed">{lead.leadSourceName}</Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{lead.contactDisplayName}</Text>
                                <Text size="xs" c="dimmed">{lead.state ?? 'State pending'}</Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={2}>
                                <Text size="sm">{formatRoutingTeam(lead.routingTeam)}</Text>
                                <Text size="xs" c="dimmed">{lead.leadOwnerName ?? 'Owner pending'}</Text>
                              </Stack>
                            </Table.Td>
                            <Table.Td>
                              <Stack gap={4}>
                                <Text size="sm">{formatDateLabel(lead.updatedAt)}</Text>
                                {lead.stage === 'new' ? renderLeadSlaBadge(lead) : (
                                  <Badge variant="light" color="green">Contacted</Badge>
                                )}
                              </Stack>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Paper>
              )}

              {/* UX-L-001: empty state when territory or other filters return zero leads (list view only; kanban uses per-column ghost cards) */}
              {!isLoadingLeads && leads.length === 0 && viewMode === 'list' ? (
                <EmptyStateMessage
                  kind={deferredSearch || stageFilter || routingTeamFilter || leadSourceFilter || territoryIdFilter || affinityGroupFilter || ownershipGroupFilter ? 'filtered-out' : 'no-data'}
                  title={deferredSearch || stageFilter || routingTeamFilter || leadSourceFilter || territoryIdFilter || affinityGroupFilter || ownershipGroupFilter ? 'No leads match your current filters' : 'No leads in your territory yet'}
                  description={deferredSearch || stageFilter || routingTeamFilter || leadSourceFilter || territoryIdFilter || affinityGroupFilter || ownershipGroupFilter ? 'Try clearing one or more filters to see all accessible leads.' : 'New leads will appear here once created or assigned to your territory.'}
                />
              ) : null}

              {/* UX-L-013: pagination controls */}
              {viewMode === 'list' && totalLeads > PAGE_SIZE ? (
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed">
                    Page {currentPage} of {Math.ceil(totalLeads / PAGE_SIZE)} ({totalLeads} leads total)
                  </Text>
                  <Pagination
                    value={currentPage}
                    onChange={setCurrentPage}
                    total={Math.ceil(totalLeads / PAGE_SIZE)}
                    siblings={1}
                  />
                </Group>
              ) : null}

              {isLoadingLeads ? <Text size="sm" c="dimmed">Refreshing lead workspace...</Text> : null}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="insights" pt="md">
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                Report context for managers. Daily lead work stays in Lead Work Queue.
              </Text>
              <div data-testid="lead-insights-metrics">
                <WorkbenchMetricStrip metrics={leadWorkbenchMetrics} />
              </div>
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                {STAGE_META.map((stage) => (
                  <MetricCard key={stage.key} label={stage.shortTitle} value={String(stageCounts[stage.key] ?? 0)} icon={IconTimeline} color={stage.color} />
                ))}
              </SimpleGrid>

              {/* UX-L-012: pipeline value + SLA breach trend */}
              <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                <MetricCard
                  label="Pipeline value"
                  value={totalPipelineValueCents > 0 ? `$${(totalPipelineValueCents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                  icon={IconChartBar}
                  color="green"
                />
                <MetricCard
                  label="SLA breaches"
                  value={String(slaTrendBreaches)}
                  icon={IconAlertCircle}
                  color={slaTrendBreaches > 0 ? 'red' : 'gray'}
                />
                <MetricCard
                  label="Active leads"
                  value={String(leads.filter((l) => l.lifecycleStatus === 'active').length)}
                  icon={IconTimeline}
                  color="blue"
                />
                <MetricCard
                  label="Territories"
                  value={String(new Set(leads.map((l) => l.territoryCode).filter(Boolean)).size)}
                  icon={IconWorld}
                  color="teal"
                />
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

                {/* UX-L-012: time-in-stage analytics */}
                <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                  <Stack gap="md">
                    <Title order={4}>Avg. days in stage</Title>
                    {timeInStageAnalytics.filter((s) => s.count > 0).length === 0 ? (
                      <Text c="dimmed" size="sm">Stage duration analytics will appear once leads are active.</Text>
                    ) : (
                      timeInStageAnalytics.filter((s) => s.count > 0).map((s) => (
                        <Group key={s.stage} justify="space-between">
                          <Text>{s.stage}</Text>
                          <Badge variant="light" color="orange">{s.avg}d avg ({s.count})</Badge>
                        </Group>
                      ))
                    )}
                  </Stack>
                </Paper>

                {/* UX-L-012: territory breakdown */}
                <Paper withBorder radius="xl" p="lg" className="premium-subhero-panel">
                  <Stack gap="md">
                    <Title order={4}>Territory breakdown</Title>
                    {analyticsByTerritory.length === 0 ? (
                      <Text c="dimmed" size="sm">Territory distribution will appear once leads are assigned.</Text>
                    ) : (
                      analyticsByTerritory.map(([label, count]) => (
                        <Group key={label} justify="space-between">
                          <Text>{label}</Text>
                          <Badge variant="light" color="teal">{count}</Badge>
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

      {/* UX-L-011: BR-L-07 backward stage reason gate modal */}
      <Modal
        opened={backwardStageTarget !== null}
        onClose={() => { setBackwardStageTarget(null); setBackwardStageReason(''); }}
        title="Reason required for moving stage backward"
        centered
        size="sm"
      >
        <Stack gap="md">
          {backwardStageTarget ? (
            <Alert color="orange" icon={<IconAlertCircle size={16} />}>
              Moving from <strong>{backwardStageTarget ? STAGE_META.find((s) => s.key === leads.find((l) => l.id === backwardStageTarget.leadId)?.stage)?.shortTitle ?? '' : ''}</strong> back to <strong>{STAGE_META.find((s) => s.key === backwardStageTarget.toStage)?.shortTitle ?? ''}</strong> requires a reason (BR-L-07).
            </Alert>
          ) : null}
          <Textarea
            label="Reason for backward stage move"
            placeholder="Explain why this lead is being moved to an earlier stage..."
            value={backwardStageReason}
            onChange={(event) => setBackwardStageReason(event.currentTarget.value)}
            minRows={3}
            required
            disabled={isConfirmingBackwardStage}
          />
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              onClick={() => { setBackwardStageTarget(null); setBackwardStageReason(''); }}
              disabled={isConfirmingBackwardStage}
            >
              Cancel
            </Button>
            <Button
              color="orange"
              onClick={() => { void handleConfirmBackwardStage(); }}
              loading={isConfirmingBackwardStage}
              disabled={!backwardStageReason.trim()}
            >
              Confirm move
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={reassignLeadTarget !== null}
        onClose={() => setReassignLeadTarget(null)}
        title="Reassign Lead Territory"
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {reassignLeadTarget ? `Reassigning territory for ${reassignLeadTarget.companyName}.` : ''}
          </Text>
          <Select
            label="New Territory"
            placeholder="Select territory..."
            value={reassignTerritoryId || null}
            onChange={(value) => setReassignTerritoryId(value ?? '')}
            data={territories.filter((t) => t.isActive).map((t) => ({ value: t.id, label: `${t.code} – ${t.name}` }))}
            searchable
            required
          />
          <Select
            label="Reason Code"
            value={reassignReasonCode}
            onChange={(value) => setReassignReasonCode(value ?? 'territory_realignment')}
            data={[
              { value: 'territory_realignment', label: 'Territory Realignment' },
              { value: 'tm_change', label: 'TM Change' },
              { value: 'routing_correction', label: 'Routing Correction' },
              { value: 'manual_override', label: 'Manual Override' },
            ]}
            required
          />
          <Textarea
            label="Reason Note"
            description="Optional — provide additional context for this reassignment."
            value={reassignReasonNote}
            onChange={(event) => setReassignReasonNote(event.currentTarget.value)}
            minRows={2}
          />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setReassignLeadTarget(null)} disabled={isReassigning}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleReassignLead()}
              loading={isReassigning}
              disabled={!reassignTerritoryId}
            >
              Reassign
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={createLeadOpened} onClose={resetCreateLeadModal} title="New Intake" centered size="xl">
        <Stack gap="lg">
          <Stepper
            active={createLeadStep === 'customer' ? 0 : createLeadStep === 'routing' ? 1 : 2}
            size="sm"
            data-testid="lead-intake-stepper"
          >
            <Stepper.Step label="Customer" description="Company and contact" />
            <Stepper.Step label="Routing" description="Relationship answers" />
            <Stepper.Step label="Review" description="Check and save" />
          </Stepper>

          {createLeadError ? <Text c="red">{createLeadError}</Text> : null}

          {createLeadStep === 'customer' ? (
            <Stack gap="md" data-testid="new-intake-step-customer">
              <Stack gap={2}>
                <Title order={4}>Who is this for?</Title>
                <Text size="sm" c="dimmed">
                  Add the company and best contact. Scan a card or note if you have one.
                </Text>
              </Stack>

              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                <TextInput
                  label="Company name"
                  data-testid="lead-company-name"
                  value={createLeadForm.companyName ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateCreateLeadDraft((current) => ({ ...current, companyName: value }));
                  }}
                  required
                />
                <TextInput
                  label="Contact name"
                  data-testid="lead-contact-name"
                  value={createLeadForm.contactDisplayName ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateCreateLeadDraft((current) => ({ ...current, contactDisplayName: value }));
                  }}
                />
                <TextInput
                  label="Email"
                  type="email"
                  data-testid="lead-email"
                  value={createLeadForm.email ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateCreateLeadDraft((current) => ({ ...current, email: value }));
                  }}
                  required
                />
                <TextInput
                  label="Phone"
                  data-testid="lead-phone"
                  value={createLeadForm.phone ?? ''}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    updateCreateLeadDraft((current) => ({ ...current, phone: value }));
                  }}
                  required
                />
                <Select
                  searchable
                  label="State / Province"
                  placeholder="Select location..."
                  value={createLeadForm.state || null}
                  onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, state: value ?? '' }))}
                  data={leadRegionSelectData}
                />
                <NumberInput
                  label="Service tech count"
                  data-testid="lead-service-tech-count"
                  value={createLeadForm.serviceTechCount ?? 0}
                  onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, serviceTechCount: Number(value) || 0 }))}
                  min={0}
                  required
                />
              </SimpleGrid>

              <Paper withBorder radius="md" p="md">
                <Stack gap="sm">
                  <Stack gap={2}>
                    <Text fw={700}>Fill from card or note</Text>
                    <Text size="xs" c="dimmed">Optional OCR for business cards, badges, handwritten notes, and scanned PDFs.</Text>
                  </Stack>
                  <SegmentedControl
                    data-testid="lead-ocr-capture-type"
                    value={ocrCaptureDocumentType}
                    onChange={(value) => setOcrCaptureDocumentType(value as LeadOcrCaptureDocumentTypeKey)}
                    data={leadOcrCaptureTypeOptions}
                  />
                  <Group justify="space-between" align="flex-end">
                    <FileInput
                      leftSection={<IconFileUpload size={16} />}
                      label="Scan business card, badge, or handwritten note"
                      placeholder="Upload PDF, photo, or scan"
                      accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff"
                      value={ocrCaptureFile}
                      onChange={(file) => {
                        setOcrCaptureFile(file);
                        clearDuplicateReviewState();
                      }}
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
                      We filled what we could from the file. Please check it.
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
            </Stack>
          ) : null}

          {createLeadStep === 'routing' ? (
            <Stack gap="md" data-testid="new-intake-step-routing">
              <Stack gap={2}>
                <Title order={4}>Where should this go?</Title>
                <Text size="sm" c="dimmed">
                  Answer the relationship questions so the lead goes to the right team.
                </Text>
              </Stack>
              <Stack gap="sm" data-testid="lead-routing-section">
                <Alert color="blue" variant="light">
                  Keep buying groups and ownership groups separate. Choose Independent / No group when neither applies.
                </Alert>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Select
                    label="Affinity group status"
                    placeholder="Select affinity status..."
                    aria-label="Affinity group status"
                    data-testid="lead-affinity-group-status"
                    value={createLeadForm.affinityGroupSelection || null}
                    onChange={(value) =>
                      updateCreateLeadDraft((current) => ({
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
                      updateCreateLeadDraft((current) => ({
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
                      onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, affinityGroupCode: value ?? '' }))}
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
                      onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, ownershipGroupCode: value ?? '' }))}
                      data={ownershipGroups.map((group) => ({
                        value: group.code,
                        label: group.name,
                      }))}
                    />
                  ) : null}
                </SimpleGrid>
              </Stack>
            </Stack>
          ) : null}

          {createLeadStep === 'review' ? (
            <Stack gap="md" data-testid="new-intake-step-review">
              <Stack gap={2}>
                <Title order={4}>Check and save</Title>
                <Text size="sm" c="dimmed">
                  Review the customer, route, and any possible matches before saving.
                </Text>
              </Stack>

              <Paper withBorder radius="md" p="md" data-testid="new-intake-review-summary">
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <Stack gap={2}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Customer</Text>
                    <Text fw={700}>{createLeadForm.companyName || 'Company missing'}</Text>
                    <Text size="sm" c="dimmed">
                      {[createLeadForm.contactDisplayName, createLeadForm.email, createLeadForm.phone].filter(Boolean).join(' • ') || 'Contact missing'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {createLeadForm.state || 'State not selected'} • {createLeadForm.serviceTechCount || 0} service techs
                    </Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Routing</Text>
                    <Text size="sm">
                      Buying group: {formatManualGroupSelection(createLeadForm.affinityGroupSelection, createLeadForm.affinityGroupCode, affinityGroups)}
                    </Text>
                    <Text size="sm">
                      Ownership / PE group: {formatManualGroupSelection(createLeadForm.ownershipGroupSelection, createLeadForm.ownershipGroupCode, ownershipGroups)}
                    </Text>
                    <Text size="sm" c="dimmed">Pulse will apply the configured routing policy after save.</Text>
                  </Stack>
                </SimpleGrid>
              </Paper>

              <Paper withBorder radius="md" p="md">
                <Stack gap="md">
                  <Stack gap={2}>
                    <Text fw={700}>Optional details</Text>
                    <Text size="xs" c="dimmed">Add source, rating, install technicians, and notes when they are known.</Text>
                  </Stack>
                  <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                    <Select
                      label="Lead source"
                      value={createLeadForm.leadSourceCode || null}
                      onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, leadSourceCode: value ?? 'manual_entry' }))}
                      data={leadSources.map((source) => ({
                        value: source.code,
                        label: source.name,
                      }))}
                    />
                    <Select
                      label="Marketing source"
                      placeholder="Select marketing source..."
                      value={createLeadForm.sourceCampaign || null}
                      onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, sourceCampaign: value ?? '' }))}
                      data={leadMarketingSourceOptions}
                    />
                    {/* UX-L-017: referral context — show when source is referral */}
                    {(createLeadForm.leadSourceCode === 'referral' || createLeadForm.sourceCampaign === 'referral') ? (
                      <TextInput
                        label="Referred by (name)"
                        description="Name of the person or company who referred this lead. Stored as source detail."
                        placeholder="e.g. Jane Smith or Acme Corp"
                        value={createLeadForm.sourceDetail}
                        onChange={(event) => updateCreateLeadDraft((c) => ({ ...c, sourceDetail: event.currentTarget.value }))}
                      />
                    ) : null}
                    {/* UX-L-008: brand fields on intake form */}
                    <TextInput
                      label="Source Brand Tag"
                      description="Brand under which this lead first engaged (e.g. sub-brand or co-brand code)"
                      value={createLeadForm.sourceBrandTag}
                      onChange={(event) => updateCreateLeadDraft((c) => ({ ...c, sourceBrandTag: event.currentTarget.value }))}
                    />
                    <TextInput
                      label="Private Label Name"
                      description="Private label or white-label brand name if applicable"
                      value={createLeadForm.privateLabelName}
                      onChange={(event) => updateCreateLeadDraft((c) => ({ ...c, privateLabelName: event.currentTarget.value }))}
                    />
                    <Select
                      label="Lead rating"
                      placeholder="Select lead rating..."
                      value={createLeadForm.leadRating || null}
                      onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, leadRating: value ?? '' }))}
                      data={leadRatingOptions}
                    />
                    <NumberInput
                      label="Install tech count"
                      data-testid="lead-install-tech-count"
                      value={createLeadForm.installTechCount}
                      onChange={(value) => updateCreateLeadDraft((current) => ({ ...current, installTechCount: Number(value) || 0 }))}
                      min={0}
                    />
                  </SimpleGrid>
                  <Textarea
                    label="Notes"
                    data-testid="lead-notes"
                    value={createLeadForm.notes ?? ''}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      updateCreateLeadDraft((current) => ({ ...current, notes: value }));
                    }}
                    minRows={4}
                  />
                </Stack>
              </Paper>

              {ocrPreview ? (
                <Alert color={ocrPreview.lowConfidence ? 'yellow' : 'teal'} variant="light">
                  Scan review: {ocrPreview.lowConfidence ? 'please double-check low-confidence fields before saving.' : 'scan fields were applied to the draft.'}
                  {ocrPreview.reviewReasons.length > 0 ? ` ${ocrPreview.reviewReasons.join(' ')}` : ''}
                </Alert>
              ) : null}

              {ocrDuplicateCandidates.length > 0 ? (
                <Paper withBorder radius="md" p="md">
                  <Stack gap="xs">
                    <Text size="sm" fw={700}>Possible matches from the scan</Text>
                    {ocrDuplicateCandidates.map((candidate) => (
                      <Text key={`ocr-review:${candidate.entityType}:${candidate.entityId}`} size="sm" c="dimmed">
                        {candidate.title}{candidate.subtitle ? ` • ${candidate.subtitle}` : ''}
                      </Text>
                    ))}
                  </Stack>
                </Paper>
              ) : null}

              {duplicateReviewStatus === 'clear' ? (
                <Alert color="teal" variant="light">
                  No possible matches were found. You can save this as a new lead.
                </Alert>
              ) : null}

              {duplicateCandidates.length > 0 ? (
                <Paper withBorder radius="md" p="md" data-testid="new-intake-duplicate-panel">
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
                            {/* UX-L-006: navigate to existing record instead of creating/enriching */}
                            <Button size="xs" variant="subtle" color="blue" onClick={() => handleUseExistingLead(candidate.entityId)}>
                              Open Existing Lead
                            </Button>
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
                      data-testid="lead-duplicate-reason"
                      description="Required to create a separate lead or enrich an existing lead."
                      value={duplicateOverrideReason}
                      onChange={(event) => setDuplicateOverrideReason(event.currentTarget.value)}
                      minRows={2}
                    />
                  </Stack>
                </Paper>
              ) : null}
            </Stack>
          ) : null}

          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Manual intake lands in the same governed routing pipeline as web and import leads.
            </Text>
            <Group gap="xs">
              {createLeadStep !== 'customer' ? (
                <Button variant="default" onClick={handleBackInCreateLead} disabled={isCreatingLead}>
                  Back
                </Button>
              ) : null}
              {createLeadStep === 'customer' ? (
                <Button onClick={handleContinueToRouting}>
                  Continue to Routing
                </Button>
              ) : null}
              {createLeadStep === 'routing' ? (
                <Button onClick={handleContinueToReview}>
                  Continue to Review
                </Button>
              ) : null}
              {createLeadStep === 'review' && duplicateReviewStatus === 'idle' ? (
                <Button onClick={() => void handleReviewDuplicateCandidates()} loading={isCreatingLead}>
                  Review duplicates
                </Button>
              ) : null}
              {createLeadStep === 'review' && duplicateReviewStatus === 'clear' ? (
                <Button onClick={() => void handleCreateReviewedLead()} loading={isCreatingLead}>
                  Create Lead
                </Button>
              ) : null}
              {createLeadStep === 'review' && duplicateCandidates.length > 0 ? (
                <>
                  <Button
                    variant="default"
                    onClick={() => {
                      clearDuplicateReviewState();
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
                    data-testid="new-intake-create-anyway"
                  >
                    Create Lead Anyway
                  </Button>
                </>
              ) : null}
            </Group>
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
  icon: typeof IconTimeline;
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

function formatRoutingTeam(value: LeadRoutingTeamKey) {
  return value === 'strategic_growth' ? 'Strategic Growth' : 'National TM';
}

function formatManualGroupSelection(
  selection: ManualGroupAxisSelection,
  groupCode: string,
  groups: Array<{ code: string; name: string }>,
) {
  if (selection === 'none') {
    return 'Independent / no group';
  }

  if (selection === 'group') {
    return groups.find((group) => group.code === groupCode)?.name ?? 'Group not selected';
  }

  return 'Not selected';
}

function formatLeadRatingLabel(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(cents / 100);
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

function leadActionLabel(lead: LeadSummary) {
  return lead.workflowTask?.nextAction ?? primaryLeadActionLabel(lead);
}

function leadActionColor(lead: LeadSummary) {
  return lead.workflowTask?.colorToken ?? STAGE_META.find((stage) => stage.key === lead.stage)?.color ?? 'gray';
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

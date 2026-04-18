'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  NumberInput,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  Select,
  Stack,
  Stepper,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
} from '@mantine/core';
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconClock,
  IconEdit,
  IconFileText,
  IconLock,
  IconMail,
  IconPhone,
  IconTruck,
} from '@tabler/icons-react';
import type {
  AffinityGroupReferenceSummary,
  CompleteLeadDiscoveryRequest,
  GroupAxisSelectionKey,
  LeadConsignmentEntryTimingKey,
  LeadConsignmentInterestStatusKey,
  LeadLifecycleReasonCodeKey,
  LeadDetail,
  LeadRoutingPolicySummary,
  OwnershipGroupReferenceSummary,
  ReferenceValueSummary,
} from '@pulse/contracts';
import { canPerformAction } from '@/lib/access';
import {
  completeLeadDiscovery,
  fetchAffinityGroups,
  fetchBusinessSegments,
  fetchLeadDetail,
  fetchLeadSources,
  fetchOwnershipGroups,
  fetchLeadRoutingPolicy,
  logLeadInitialContact,
  scheduleLeadDiscovery,
  skipLeadDiscovery,
  updateLead,
  updateLeadLifecycle,
} from '@/lib/pulse-api';
import { usePulseSession } from '@/lib/pulse-session';
import { APP_LEAD_RATINGS, APP_LEAD_REGION_OPTIONS } from '@/lib/lead-form-options';
import { LeadCisPanel } from './LeadCisPanel';
import { LeadOnboardingReadyPanel } from './LeadOnboardingReadyPanel';

type LeadRecordWorkspaceProps = {
  leadId: string;
};

type LeadRecordTab = 'overview' | 'discovery' | 'cis' | 'onboarding' | 'activity';
type LeadEditFormState = {
  companyName: string;
  contactDisplayName: string;
  email: string;
  phone: string;
  state: string;
  businessSegmentCode: string;
  leadSourceCode: string;
  sourceDetail: string;
  sourceSiteId: string;
  sourceSiteName: string;
  sourceBrandTag: string;
  sourceCampaign: string;
  leadRating: string;
  serviceTechCount: number | '';
  installTechCount: number | '';
  truckCount: number | '';
  salesPersonCount: number | '';
  potentialValueDollars: number | '';
  affinityGroupSelection: GroupAxisSelectionKey | '';
  affinityGroupCode: string;
  ownershipGroupSelection: GroupAxisSelectionKey | '';
  ownershipGroupCode: string;
  privateLabelName: string;
  notes: string;
};

const DISCOVERY_PAIN_POINT_OPTIONS = [
  'Dust / Allergies',
  'Humidity Issues',
  'Static Electricity',
  'Odor Control',
  'Low IAQ Awareness',
  'High Maintenance Cost',
] as const;

const LEAD_PARK_REASON_OPTIONS: Array<{ value: LeadLifecycleReasonCodeKey; label: string }> = [
  { value: 'follow_up_later', label: 'Follow Up Later' },
  { value: 'no_response', label: 'No Response' },
  { value: 'other', label: 'Other' },
];

const LEAD_CLOSE_REASON_OPTIONS: Array<{ value: LeadLifecycleReasonCodeKey; label: string }> = [
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'disqualified', label: 'Disqualified' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
];

const groupAxisSelectionOptions: Array<{ value: GroupAxisSelectionKey; label: string }> = [
  { value: 'unknown', label: 'Unknown / not assessed' },
  { value: 'none', label: 'Independent / no group' },
  { value: 'group', label: 'Select governed group' },
];

const leadRatingOptions = APP_LEAD_RATINGS;
const leadRegionSelectData = APP_LEAD_REGION_OPTIONS.map((option) => ({
  value: option.value,
  label: `${option.label} (${option.value})`,
}));

export function LeadRecordWorkspace({ leadId }: LeadRecordWorkspaceProps) {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [businessSegments, setBusinessSegments] = useState<ReferenceValueSummary[]>([]);
  const [leadSources, setLeadSources] = useState<ReferenceValueSummary[]>([]);
  const [affinityGroups, setAffinityGroups] = useState<AffinityGroupReferenceSummary[]>([]);
  const [ownershipGroups, setOwnershipGroups] = useState<OwnershipGroupReferenceSummary[]>([]);
  const [activeTab, setActiveTab] = useState<LeadRecordTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [isSchedulingDiscovery, setIsSchedulingDiscovery] = useState(false);
  const [isCompletingDiscovery, setIsCompletingDiscovery] = useState(false);
  const [isSkippingDiscovery, setIsSkippingDiscovery] = useState(false);
  const [isUpdatingLifecycle, setIsUpdatingLifecycle] = useState(false);
  const [discoveryPainPoints, setDiscoveryPainPoints] = useState<string[]>([]);
  const [discoveryCurrentIaqSetup, setDiscoveryCurrentIaqSetup] = useState('');
  const [discoveryDecisionMaker, setDiscoveryDecisionMaker] = useState('');
  const [discoveryBuyingIntent, setDiscoveryBuyingIntent] = useState('');
  const [consignmentInterestStatus, setConsignmentInterestStatus] = useState<LeadConsignmentInterestStatusKey>('not_discussed');
  const [consignmentEntryTiming, setConsignmentEntryTiming] = useState<LeadConsignmentEntryTimingKey>('at_onboarding');
  const [discoveryFastTrackReason, setDiscoveryFastTrackReason] = useState('');
  const [discoverySummary, setDiscoverySummary] = useState('');
  const [lifecycleDraftStatus, setLifecycleDraftStatus] = useState<'parked' | 'closed'>('parked');
  const [lifecycleReasonCode, setLifecycleReasonCode] = useState<LeadLifecycleReasonCodeKey>('follow_up_later');
  const [lifecycleReasonNote, setLifecycleReasonNote] = useState('');
  const [editOpened, setEditOpened] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [leadEditForm, setLeadEditForm] = useState<LeadEditFormState>({
    companyName: '',
    contactDisplayName: '',
    email: '',
    phone: '',
    state: '',
    businessSegmentCode: '',
    leadSourceCode: '',
    sourceDetail: '',
    sourceSiteId: '',
    sourceSiteName: '',
    sourceBrandTag: '',
    sourceCampaign: '',
    leadRating: '',
    serviceTechCount: '',
    installTechCount: '',
    truckCount: '',
    salesPersonCount: '',
    potentialValueDollars: '',
    affinityGroupSelection: '',
    affinityGroupCode: '',
    ownershipGroupSelection: '',
    ownershipGroupCode: '',
    privateLabelName: '',
    notes: '',
  });

  const canManageLead = auth ? canPerformAction(auth.identity.role, 'lead.intake_manage') : false;
  const canViewFinanceQueue = auth ? canPerformAction(auth.identity.role, 'lead.finance_queue_view') : false;

  useEffect(() => {
    if (!auth) {
      setLead(null);
      setRoutingPolicy(null);
      return;
    }

    const accessToken = auth.tokens.accessToken;
    let cancelled = false;

    async function loadLead() {
      setIsLoading(true);
      setError(null);

      try {
        const [leadResponse, routingPolicyResponse, businessSegmentsResponse, leadSourcesResponse, affinityGroupsResponse, ownershipGroupsResponse] = await Promise.all([
          fetchLeadDetail(apiBaseUrl, accessToken, leadId),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
          fetchBusinessSegments(apiBaseUrl, accessToken),
          fetchLeadSources(apiBaseUrl, accessToken),
          fetchAffinityGroups(apiBaseUrl, accessToken),
          fetchOwnershipGroups(apiBaseUrl, accessToken),
        ]);
        if (!cancelled) {
          setLead(leadResponse);
          setRoutingPolicy(routingPolicyResponse);
          setBusinessSegments(businessSegmentsResponse.items);
          setLeadSources(leadSourcesResponse.items);
          setAffinityGroups(affinityGroupsResponse.items);
          setOwnershipGroups(ownershipGroupsResponse.items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
          setLead(null);
          setRoutingPolicy(null);
          setBusinessSegments([]);
          setLeadSources([]);
          setAffinityGroups([]);
          setOwnershipGroups([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLead();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth, leadId]);

  useEffect(() => {
    if (!lead) {
      return;
    }

    setDiscoveryPainPoints(lead.discoveryPainPoints ?? []);
    setDiscoveryCurrentIaqSetup(lead.discoveryCurrentIaqSetup ?? '');
    setDiscoveryDecisionMaker(lead.discoveryDecisionMaker ?? '');
    setDiscoveryBuyingIntent(lead.discoveryBuyingIntent ?? '');
    setConsignmentInterestStatus(lead.consignmentInterestStatus ?? 'not_discussed');
    setConsignmentEntryTiming(lead.consignmentEntryTiming ?? 'at_onboarding');
    setDiscoveryFastTrackReason(lead.discoveryFastTrackReason ?? '');
    setDiscoverySummary(lead.discoverySummary ?? lead.notes ?? '');
    setLifecycleDraftStatus(lead.lifecycleStatus === 'closed' ? 'closed' : 'parked');
    setLifecycleReasonCode(
      lead.lifecycleReasonCode
      ?? (lead.lifecycleStatus === 'closed' ? 'not_interested' : 'follow_up_later'),
    );
    setLifecycleReasonNote(lead.lifecycleReasonNote ?? '');
    setLeadEditForm({
      companyName: lead.companyName,
      contactDisplayName: lead.contactDisplayName,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      state: lead.state ?? '',
      businessSegmentCode: lead.businessSegmentCode,
      leadSourceCode: lead.leadSourceCode,
      sourceDetail: lead.sourceDetail ?? '',
      sourceSiteId: lead.sourceSiteId ?? '',
      sourceSiteName: lead.sourceSiteName ?? '',
      sourceBrandTag: lead.sourceBrandTag ?? '',
      sourceCampaign: lead.sourceCampaign ?? '',
      leadRating: lead.leadRating ?? '',
      serviceTechCount: lead.serviceTechCount,
      installTechCount: lead.installTechCount ?? '',
      truckCount: lead.truckCount ?? '',
      salesPersonCount: lead.salesPersonCount ?? '',
      potentialValueDollars:
        lead.potentialValueCents !== undefined && lead.potentialValueCents !== null
          ? Math.round(lead.potentialValueCents / 100)
          : '',
      affinityGroupSelection: lead.affinityGroupSelection,
      affinityGroupCode: lead.affinityGroupCode ?? '',
      ownershipGroupSelection: lead.ownershipGroupSelection,
      ownershipGroupCode: lead.ownershipGroupCode ?? '',
      privateLabelName: lead.privateLabelName ?? '',
      notes: lead.notes ?? '',
    });
  }, [lead]);

  const hasInitialContact = Boolean(lead?.initialContactedAt) || lead?.stage !== 'new';
  const leadIsActive = lead?.lifecycleStatus === 'active';
  const initialContactSlaHours = routingPolicy?.initialContactSlaHours ?? 24;
  const initialContactUrgentWindowHours = routingPolicy?.initialContactUrgentWindowHours ?? 12;
  const discoverySchedulingSlaHours = routingPolicy?.discoverySchedulingSlaHours ?? 72;
  const lifecycleReasonOptions = lifecycleDraftStatus === 'closed'
    ? LEAD_CLOSE_REASON_OPTIONS
    : LEAD_PARK_REASON_OPTIONS;
  const discoverySummaryValid = discoverySummary.trim().length >= 10;
  const daysInStage = useMemo(() => {
    if (!lead) {
      return 0;
    }

    const anchor = lead.stageHistory[0]?.occurredAt ?? lead.updatedAt;
    return Math.max(0, Math.floor((Date.now() - new Date(anchor).getTime()) / 86400000));
  }, [lead]);

  const slaState = useMemo(() => {
    if (!lead?.initialContactDueAt) {
      return {
        overdue: false,
        urgent: false,
        hoursLeft: undefined as number | undefined,
      };
    }

    const hoursLeft = Math.floor((new Date(lead.initialContactDueAt).getTime() - Date.now()) / 3600000);
    return {
      overdue: !hasInitialContact && hoursLeft < 0,
      urgent: !hasInitialContact && hoursLeft >= 0 && hoursLeft < initialContactUrgentWindowHours,
      hoursLeft,
    };
  }, [hasInitialContact, initialContactUrgentWindowHours, lead?.initialContactDueAt]);

  const workflowGates = useMemo(() => {
    if (!lead) {
      return [];
    }

    return [
      {
        label: 'Initial Contact',
        complete: hasInitialContact,
        detail: hasInitialContact
          ? `Logged ${lead.initialContactedAt ? `on ${formatDateLabel(lead.initialContactedAt)}` : 'inside Pulse CRM'}.`
          : `${initialContactSlaHours}-hour SLA is still active until the first contact is recorded.`,
      },
      {
        label: 'Discovery',
        complete: Boolean(lead.discoveryCompletedAt),
        detail: lead.discoveryCompletedAt
          ? lead.discoveryCallSkipped
            ? 'Discovery was bypassed with a documented fast-track reason.'
            : `Completed on ${formatDateLabel(lead.discoveryCompletedAt)}.`
          : `Discovery notes or a fast-track reason are still required before CIS can move cleanly, and scheduling should happen within ${discoverySchedulingSlaHours} hours of first contact.`,
      },
      {
        label: 'CIS Submission',
        complete: Boolean(lead.cisSignedAt),
        detail: lead.cisSignedAt
          ? `Signed off on ${formatDateLabel(lead.cisSignedAt)}.`
          : lead.cisSubmittedAt
            ? `Submitted on ${formatDateLabel(lead.cisSubmittedAt)} and awaiting internal sign-off.`
            : lead.cisSentAt
              ? `Sent on ${formatDateLabel(lead.cisSentAt)} and still waiting on the prospect.`
              : 'CIS has not been issued yet.',
      },
      {
        label: 'Finance Review',
        complete: lead.workflowTask.financeDecisionStatus === 'approved' || lead.workflowTask.financeDecisionStatus === 'conditional',
        detail: buildFinanceGateDetail(lead),
      },
      {
        label: 'Onboarding Ready',
        complete: Boolean(lead.onboardingCompletedAt),
        detail: lead.onboardingCompletedAt
          ? `Operational onboarding was marked complete on ${formatDateLabel(lead.onboardingCompletedAt)}.`
          : 'Portal/setup readiness is still inside CRM scope before the first-order handoff.',
      },
    ];
  }, [discoverySchedulingSlaHours, hasInitialContact, initialContactSlaHours, lead]);

  const activityItems = useMemo(() => {
    if (!lead) {
      return [];
    }

    const items = [
      {
        key: `created-${lead.id}`,
        title: 'Lead Created',
        description: `${lead.leadSourceName} intake landed in Pulse and routed to ${formatRoutingTeam(lead.routingTeam)}.`,
        occurredAt: lead.createdAt,
        color: 'blue',
      },
      ...(lead.initialContactedAt ? [{
        key: `contact-${lead.initialContactedAt}`,
        title: 'Initial Contact Logged',
        description: 'Sales / BD recorded the first outreach against the live lead record.',
        occurredAt: lead.initialContactedAt,
        color: 'teal',
      }] : []),
      ...(lead.discoveryScheduledAt ? [{
        key: `discovery-scheduled-${lead.discoveryScheduledAt}`,
        title: lead.discoveryCallSkipped ? 'Discovery Opened' : 'Discovery Scheduled',
        description: lead.discoveryCallSkipped
          ? 'The discovery workspace was opened before the lead was fast-tracked.'
          : 'Discovery scheduling is complete and qualification work moved into the discovery lane.',
        occurredAt: lead.discoveryScheduledAt,
        color: 'indigo',
      }] : []),
      ...(lead.discoveryCompletedAt ? [{
        key: `discovery-complete-${lead.discoveryCompletedAt}`,
        title: lead.discoveryCallSkipped ? 'Discovery Fast-Tracked' : 'Discovery Completed',
        description: lead.discoveryCallSkipped
          ? lead.discoveryFastTrackReason ?? 'Lead moved forward with an approved fast-track reason.'
          : lead.discoverySummary ?? 'Discovery summary captured and the lead was advanced to CIS readiness.',
        occurredAt: lead.discoveryCompletedAt,
        color: 'orange',
      }] : []),
      ...(lead.cisSentAt ? [{
        key: `cis-sent-${lead.cisSentAt}`,
        title: 'CIS Link Issued',
        description: 'Digital CIS handoff started from the live CRM record.',
        occurredAt: lead.cisSentAt,
        color: 'grape',
      }] : []),
      ...(lead.cisSubmittedAt ? [{
        key: `cis-submitted-${lead.cisSubmittedAt}`,
        title: 'CIS Submitted',
        description: 'Prospect submission landed back in Pulse for internal review.',
        occurredAt: lead.cisSubmittedAt,
        color: 'yellow',
      }] : []),
      ...(lead.cisSignedAt ? [{
        key: `cis-signed-${lead.cisSignedAt}`,
        title: 'CIS Signed Off',
        description: 'Internal review is complete and the finance/onboarding lane is unlocked.',
        occurredAt: lead.cisSignedAt,
        color: 'green',
      }] : []),
      ...(lead.lifecycleStatus !== 'active' && lead.lifecycleChangedAt ? [{
        key: `lifecycle-${lead.lifecycleStatus}-${lead.lifecycleChangedAt}`,
        title: lead.lifecycleStatus === 'closed' ? 'Lead Closed' : 'Lead Parked',
        description: formatLifecycleReason(lead.lifecycleReasonCode, lead.lifecycleReasonNote) ?? 'Lead moved out of the active pipeline with a recorded reason.',
        occurredAt: lead.lifecycleChangedAt,
        color: 'dark',
      }] : []),
      ...(lead.onboardingCompletedAt ? [{
        key: `onboarding-${lead.onboardingCompletedAt}`,
        title: 'Onboarding Ready',
        description: 'CRM-owned setup is complete. The next step is the first-order / ERP boundary.',
        occurredAt: lead.onboardingCompletedAt,
        color: 'cyan',
      }] : []),
      ...lead.stageHistory.map((event) => ({
        key: event.id,
        title: `Stage: ${formatStageLabel(event.toStage)}`,
        description: event.note ?? 'Stage transition recorded in the audit trail.',
        occurredAt: event.occurredAt,
        color: 'gray',
      })),
    ];

    return items
      .sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime())
      .filter((item, index, array) => array.findIndex((candidate) => candidate.key === item.key) === index);
  }, [lead]);

  if (!isHydrated || !auth) {
    return null;
  }

  if (isLoading) {
    return (
      <Paper withBorder radius="xl" p="xl" className="premium-subhero-panel">
        <Group gap="sm">
          <Loader size="sm" />
          <Text c="dimmed">Loading the lead record...</Text>
        </Group>
      </Paper>
    );
  }

  if (error || !lead) {
    return (
      <Paper withBorder radius="xl" p="xl" className="premium-subhero-panel">
        <Stack gap="sm">
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error ?? 'Lead not found.'}
          </Alert>
          <Group>
            <Button component={Link} href="/leads" variant="default">
              Back to Lead Pipeline
            </Button>
          </Group>
        </Stack>
      </Paper>
    );
  }

  const currentAuth = auth;
  const currentLead = lead;

  async function handleLogInitialContact() {
    setIsLoggingCall(true);
    setActionError(null);
    try {
      const updated = await logLeadInitialContact(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id, {});
      setLead(updated);
    } catch (action) {
      setActionError(action instanceof Error ? action.message : String(action));
    } finally {
      setIsLoggingCall(false);
    }
  }

  async function handleScheduleDiscovery() {
    setIsSchedulingDiscovery(true);
    setActionError(null);
    try {
      const updated = await scheduleLeadDiscovery(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id, {});
      setLead(updated);
    } catch (action) {
      setActionError(action instanceof Error ? action.message : String(action));
    } finally {
      setIsSchedulingDiscovery(false);
    }
  }

  async function handleCompleteDiscovery() {
    setIsCompletingDiscovery(true);
    setActionError(null);
    try {
      const payload: CompleteLeadDiscoveryRequest = {
        painPoints: discoveryPainPoints,
        ...(discoveryCurrentIaqSetup.trim() ? { currentIaqSetup: discoveryCurrentIaqSetup.trim() } : {}),
        ...(discoveryDecisionMaker.trim() ? { decisionMaker: discoveryDecisionMaker.trim() } : {}),
        ...(discoveryBuyingIntent.trim() ? { buyingIntent: discoveryBuyingIntent.trim() } : {}),
        ...(consignmentInterestStatus ? { consignmentInterestStatus } : {}),
        ...(consignmentInterestStatus !== 'not_discussed' && consignmentInterestStatus !== 'declined'
          ? { consignmentEntryTiming }
          : {}),
        ...(discoverySummary.trim() ? { summary: discoverySummary.trim() } : {}),
      };

      const updated = await completeLeadDiscovery(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id, payload);
      setLead(updated);
      setActiveTab('cis');
    } catch (action) {
      setActionError(action instanceof Error ? action.message : String(action));
    } finally {
      setIsCompletingDiscovery(false);
    }
  }

  async function handleSkipDiscovery() {
    setIsSkippingDiscovery(true);
    setActionError(null);
    try {
      const updated = await skipLeadDiscovery(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id, {
        painPoints: discoveryPainPoints,
        ...(discoveryCurrentIaqSetup.trim() ? { currentIaqSetup: discoveryCurrentIaqSetup.trim() } : {}),
        ...(discoveryDecisionMaker.trim() ? { decisionMaker: discoveryDecisionMaker.trim() } : {}),
        ...(discoveryBuyingIntent.trim() ? { buyingIntent: discoveryBuyingIntent.trim() } : {}),
        ...(consignmentInterestStatus ? { consignmentInterestStatus } : {}),
        ...(consignmentInterestStatus !== 'not_discussed' && consignmentInterestStatus !== 'declined'
          ? { consignmentEntryTiming }
          : {}),
        ...(discoverySummary.trim() ? { summary: discoverySummary.trim() } : {}),
        fastTrackReason: discoveryFastTrackReason.trim(),
      });
      setLead(updated);
      setActiveTab('cis');
    } catch (action) {
      setActionError(action instanceof Error ? action.message : String(action));
    } finally {
      setIsSkippingDiscovery(false);
    }
  }

  async function handleUpdateLifecycle(status: 'active' | 'parked' | 'closed') {
    setIsUpdatingLifecycle(true);
    setActionError(null);
    try {
      const updated = await updateLeadLifecycle(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id, status === 'active'
        ? { status: 'active' }
        : {
            status,
            reasonCode: lifecycleReasonCode,
            ...(lifecycleReasonNote.trim() ? { reasonNote: lifecycleReasonNote.trim() } : {}),
          });
      setLead(updated);
      if (status === 'active') {
        setLifecycleDraftStatus('parked');
        setLifecycleReasonCode('follow_up_later');
        setLifecycleReasonNote('');
      }
    } catch (action) {
      setActionError(action instanceof Error ? action.message : String(action));
    } finally {
      setIsUpdatingLifecycle(false);
    }
  }

  async function handleSaveLeadEdits() {
    if (!leadEditForm.companyName.trim()) {
      setActionError('Company name is required.');
      return;
    }
    if (!leadEditForm.contactDisplayName.trim()) {
      setActionError('Contact name is required.');
      return;
    }
    if (!leadEditForm.businessSegmentCode) {
      setActionError('Business segment is required.');
      return;
    }
    if (!leadEditForm.leadSourceCode) {
      setActionError('Lead source is required.');
      return;
    }
    if (leadEditForm.serviceTechCount === '') {
      setActionError('Service tech count is required.');
      return;
    }
    if (leadEditForm.affinityGroupSelection === 'group' && !leadEditForm.affinityGroupCode) {
      setActionError('Choose an affinity group when the affinity status is set to governed group.');
      return;
    }
    if (leadEditForm.ownershipGroupSelection === 'group' && !leadEditForm.ownershipGroupCode) {
      setActionError('Choose an ownership group when the ownership status is set to governed group.');
      return;
    }

    setIsSavingLead(true);
    setActionError(null);

    try {
      const updated = await updateLead(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id, {
        companyName: leadEditForm.companyName,
        contactDisplayName: leadEditForm.contactDisplayName,
        email: leadEditForm.email.trim() || null,
        phone: leadEditForm.phone.trim() || null,
        state: leadEditForm.state || null,
        businessSegmentCode: leadEditForm.businessSegmentCode,
        leadSourceCode: leadEditForm.leadSourceCode,
        sourceDetail: leadEditForm.sourceDetail.trim() || null,
        sourceSiteId: leadEditForm.sourceSiteId.trim() || null,
        sourceSiteName: leadEditForm.sourceSiteName.trim() || null,
        sourceBrandTag: leadEditForm.sourceBrandTag.trim() || null,
        sourceCampaign: leadEditForm.sourceCampaign.trim() || null,
        leadRating: leadEditForm.leadRating || null,
        serviceTechCount: leadEditForm.serviceTechCount,
        installTechCount: leadEditForm.installTechCount === '' ? null : leadEditForm.installTechCount,
        truckCount: leadEditForm.truckCount === '' ? null : leadEditForm.truckCount,
        salesPersonCount: leadEditForm.salesPersonCount === '' ? null : leadEditForm.salesPersonCount,
        potentialValueCents:
          leadEditForm.potentialValueDollars === ''
            ? null
            : leadEditForm.potentialValueDollars * 100,
        ...(leadEditForm.affinityGroupSelection ? { affinityGroupSelection: leadEditForm.affinityGroupSelection } : {}),
        ...(leadEditForm.affinityGroupSelection === 'group'
          ? { affinityGroupCode: leadEditForm.affinityGroupCode }
          : { affinityGroupCode: null }),
        ...(leadEditForm.ownershipGroupSelection ? { ownershipGroupSelection: leadEditForm.ownershipGroupSelection } : {}),
        ...(leadEditForm.ownershipGroupSelection === 'group'
          ? { ownershipGroupCode: leadEditForm.ownershipGroupCode }
          : { ownershipGroupCode: null }),
        privateLabelName: leadEditForm.privateLabelName.trim() || null,
        notes: leadEditForm.notes.trim() || null,
      });
      setLead(updated);
      setEditOpened(false);
    } catch (action) {
      setActionError(action instanceof Error ? action.message : String(action));
    } finally {
      setIsSavingLead(false);
    }
  }

  function handleNextBestAction() {
    switch (currentLead.workflowTask.nextAction) {
      case 'Resume Lead':
      case 'Reopen Lead':
        if (canManageLead) {
          void handleUpdateLifecycle('active');
        }
        break;
      case 'Make Initial Contact':
        if (canManageLead) {
          void handleLogInitialContact();
        }
        break;
      case 'Schedule Discovery Call':
      case 'Complete Discovery':
        setActiveTab('discovery');
        break;
      case 'Send CIS Link':
      case 'Follow Up CIS':
      case 'Submit for Credit Approval':
      case 'Resolve Finance Info Request':
      case 'Resolve Credit Decline':
      case 'Track Finance Decision':
        setActiveTab('cis');
        break;
      case 'Complete Onboarding':
        setActiveTab('onboarding');
        break;
      default:
        setActiveTab('overview');
        break;
    }
  }

  const nextActionLabel = currentLead.stage === 'onboarding_completed'
    ? 'Awaiting first-order handoff'
    : currentLead.workflowTask.nextAction;
  const businessSegmentSelectData = businessSegments.map((segment) => ({
    value: segment.code,
    label: segment.name,
  }));
  const leadSourceSelectData = leadSources.map((source) => ({
    value: source.code,
    label: source.name,
  }));
  const affinityGroupSelectData = affinityGroups.map((group) => ({
    value: group.code,
    label: group.name,
  }));
  const ownershipGroupSelectData = ownershipGroups.map((group) => ({
    value: group.code,
    label: group.name,
  }));

  return (
    <Stack gap="lg">
      <Breadcrumbs separator="›">
        <Link href="/leads">Lead Management</Link>
        <Text>{lead.companyName}</Text>
      </Breadcrumbs>

      <Paper withBorder radius="xl" p="xl" className="premium-hero-panel">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start">
            <Stack gap="xs">
              <Group gap="sm">
                <Title order={2}>{lead.companyName}</Title>
                {lead.sourceSiteName ? (
                  <Badge color="cyan" variant="light">
                    {lead.sourceSiteName}
                  </Badge>
                ) : null}
                {lead.sourceBrandTag ? (
                  <Badge color="blue" variant="light">
                    {lead.sourceBrandTag}
                  </Badge>
                ) : null}
                <Badge color={stageColor(lead.stage)} variant="light">
                  {formatStageLabel(lead.stage)}
                </Badge>
                {lead.lifecycleStatus !== 'active' ? (
                  <Badge color={lead.lifecycleStatus === 'closed' ? 'dark' : 'gray'} variant="filled">
                    {lead.lifecycleStatus === 'closed' ? 'Closed' : 'Parked'}
                  </Badge>
                ) : null}
                <Badge color={lead.routingTeam === 'strategic_growth' ? 'teal' : 'indigo'} variant="light">
                  {formatRoutingTeam(lead.routingTeam)}
                </Badge>
                {lead.leadRating ? (
                  <Badge color={leadRatingColor(lead.leadRating)} variant="light">
                    {formatLeadRatingLabel(lead.leadRating)}
                  </Badge>
                ) : null}
                {slaState.overdue ? <Badge color="red">SLA Overdue</Badge> : null}
                {!slaState.overdue && slaState.urgent ? <Badge color="orange">{slaState.hoursLeft}h SLA</Badge> : null}
                {hasInitialContact ? <Badge color="green" variant="light">Contacted</Badge> : null}
              </Group>
              <Text c="dimmed">
                {lead.contactDisplayName}
                {lead.email ? ` • ${lead.email}` : ''}
                {lead.phone ? ` • ${lead.phone}` : ''}
              </Text>
            </Stack>
            <Group gap="sm">
              {canManageLead ? (
                <Button
                  variant="light"
                  leftSection={<IconEdit size={16} />}
                  onClick={() => setEditOpened(true)}
                >
                  Edit Record
                </Button>
              ) : null}
              <Button component={Link} href="/leads" variant="default">
                Back to Pipeline
              </Button>
              <Button
                color="teal"
                leftSection={<IconPhone size={16} />}
                onClick={() => void handleLogInitialContact()}
                loading={isLoggingCall}
                disabled={!canManageLead || hasInitialContact || !leadIsActive}
              >
                {hasInitialContact ? 'Contacted' : 'Log Call'}
              </Button>
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <MetricDetail label="Lead Source" value={lead.leadSourceName} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <MetricDetail label="Service Tech Count" value={String(lead.serviceTechCount)} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <MetricDetail label="Assigned Owner" value={lead.leadOwnerName ?? 'Strategic Growth / TM Queue'} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <MetricDetail label="Time In Current Stage" value={`${daysInStage} day${daysInStage === 1 ? '' : 's'}`} />
            </Grid.Col>
          </Grid>

          {actionError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {actionError}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Modal
        opened={editOpened}
        onClose={() => setEditOpened(false)}
        title="Edit Record"
        centered
        size="xl"
      >
        <Stack gap="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Company name"
                value={leadEditForm.companyName}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, companyName: event.currentTarget.value }))}
                required
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Contact name"
                value={leadEditForm.contactDisplayName}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, contactDisplayName: event.currentTarget.value }))}
                required
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Email"
                type="email"
                value={leadEditForm.email}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, email: event.currentTarget.value }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Phone"
                value={leadEditForm.phone}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, phone: event.currentTarget.value }))}
              />
            </Grid.Col>
          </Grid>

          <Divider />

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Business segment"
                placeholder="Select business segment..."
                value={leadEditForm.businessSegmentCode || null}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, businessSegmentCode: value ?? '' }))}
                data={businessSegmentSelectData}
                searchable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Lead source"
                placeholder="Select lead source..."
                value={leadEditForm.leadSourceCode || null}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, leadSourceCode: value ?? '' }))}
                data={leadSourceSelectData}
                searchable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Source detail"
                value={leadEditForm.sourceDetail}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, sourceDetail: event.currentTarget.value }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Source campaign"
                value={leadEditForm.sourceCampaign}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, sourceCampaign: event.currentTarget.value }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                searchable
                clearable
                label="State / Province"
                placeholder="Select location..."
                value={leadEditForm.state || null}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, state: value ?? '' }))}
                data={leadRegionSelectData}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                clearable
                label="Lead rating"
                placeholder="Select lead rating..."
                value={leadEditForm.leadRating || null}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, leadRating: value ?? '' }))}
                data={leadRatingOptions}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Source site ID"
                value={leadEditForm.sourceSiteId}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, sourceSiteId: event.currentTarget.value }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Source site"
                value={leadEditForm.sourceSiteName}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, sourceSiteName: event.currentTarget.value }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <TextInput
                label="Brand tag"
                value={leadEditForm.sourceBrandTag}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, sourceBrandTag: event.currentTarget.value }))}
              />
            </Grid.Col>
          </Grid>

          <Divider />

          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                label="Service tech count"
                min={1}
                value={leadEditForm.serviceTechCount}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, serviceTechCount: typeof value === 'number' ? value : '' }))}
                required
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                label="Install tech count"
                min={0}
                value={leadEditForm.installTechCount}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, installTechCount: typeof value === 'number' ? value : '' }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                label="Truck count"
                min={0}
                value={leadEditForm.truckCount}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, truckCount: typeof value === 'number' ? value : '' }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                label="Sales person count"
                min={0}
                value={leadEditForm.salesPersonCount}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, salesPersonCount: typeof value === 'number' ? value : '' }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <NumberInput
                label="Potential value"
                min={0}
                thousandSeparator=","
                prefix="$"
                value={leadEditForm.potentialValueDollars}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, potentialValueDollars: typeof value === 'number' ? value : '' }))}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <TextInput
                label="Private label"
                value={leadEditForm.privateLabelName}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, privateLabelName: event.currentTarget.value }))}
              />
            </Grid.Col>
          </Grid>

          <Divider />

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Affinity group status"
                value={leadEditForm.affinityGroupSelection || null}
                onChange={(value) => setLeadEditForm((current) => ({
                  ...current,
                  affinityGroupSelection: (value as GroupAxisSelectionKey | null) ?? '',
                  affinityGroupCode: value === 'group' ? current.affinityGroupCode : '',
                }))}
                data={groupAxisSelectionOptions}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                searchable
                clearable
                disabled={leadEditForm.affinityGroupSelection !== 'group'}
                label="Affinity group"
                placeholder={leadEditForm.affinityGroupSelection === 'group' ? 'Select governed affinity group...' : 'Choose status first'}
                value={leadEditForm.affinityGroupCode || null}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, affinityGroupCode: value ?? '' }))}
                data={affinityGroupSelectData}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Ownership group status"
                value={leadEditForm.ownershipGroupSelection || null}
                onChange={(value) => setLeadEditForm((current) => ({
                  ...current,
                  ownershipGroupSelection: (value as GroupAxisSelectionKey | null) ?? '',
                  ownershipGroupCode: value === 'group' ? current.ownershipGroupCode : '',
                }))}
                data={groupAxisSelectionOptions}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                searchable
                clearable
                disabled={leadEditForm.ownershipGroupSelection !== 'group'}
                label="Ownership group"
                placeholder={leadEditForm.ownershipGroupSelection === 'group' ? 'Select governed ownership group...' : 'Choose status first'}
                value={leadEditForm.ownershipGroupCode || null}
                onChange={(value) => setLeadEditForm((current) => ({ ...current, ownershipGroupCode: value ?? '' }))}
                data={ownershipGroupSelectData}
              />
            </Grid.Col>
            <Grid.Col span={12}>
              <Textarea
                label="Notes"
                minRows={4}
                value={leadEditForm.notes}
                onChange={(event) => setLeadEditForm((current) => ({ ...current, notes: event.currentTarget.value }))}
              />
            </Grid.Col>
          </Grid>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Changes here update the live lead record and keep the detail and pipeline views aligned.
            </Text>
            <Group gap="sm">
              <Button variant="default" onClick={() => setEditOpened(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveLeadEdits()} loading={isSavingLead}>
                Save Changes
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as LeadRecordTab) || 'overview')} className="premium-tabs-shell">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconArrowRight size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="discovery" leftSection={<IconPhone size={16} />}>
            Discovery
          </Tabs.Tab>
	          <Tabs.Tab value="cis" leftSection={<IconFileText size={16} />}>
	            CIS, Finance & Setup
	          </Tabs.Tab>
	          <Tabs.Tab value="onboarding" leftSection={<IconCheck size={16} />}>
	            Onboarding Readiness
	          </Tabs.Tab>
	          <Tabs.Tab value="activity" leftSection={<IconActivity size={16} />}>
	            Activity Log
	          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Grid>
            <Grid.Col span={{ base: 12, xl: 8 }}>
              <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                <Title order={4} mb="md">General Information</Title>
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <DetailItem label="Company" value={lead.companyName} />
                    <DetailItem label="Contact" value={lead.contactDisplayName} />
                    <DetailItem label="Email" value={lead.email ?? 'N/A'} />
                    <DetailItem label="Phone" value={lead.phone ?? 'N/A'} />
                    <DetailItem label="State" value={lead.state ?? 'N/A'} />
                    <DetailItem label="Business Segment" value={lead.businessSegmentCode} />
                    <DetailItem label="Lead Source" value={lead.leadSourceName} />
                    <DetailItem label="Capture Method" value={formatCaptureMethod(lead.leadCaptureMethod)} />
                    <DetailItem label="Source Detail" value={lead.sourceDetail ?? 'N/A'} />
                    <DetailItem label="Source Campaign" value={lead.sourceCampaign ?? 'N/A'} />
                    <DetailItem label="Source Site ID" value={lead.sourceSiteId ?? 'N/A'} />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <DetailItem label="Affinity Group" value={formatGroupAxisLabel(lead.affinityGroupSelection, lead.affinityGroupName)} />
                    <DetailItem label="Ownership Group" value={formatGroupAxisLabel(lead.ownershipGroupSelection, lead.ownershipGroupName)} />
                    <DetailItem label="Group Classification" value={formatGroupClassificationLabel(lead.groupClassification)} />
                    <DetailItem label="Private Label" value={lead.privateLabelName ?? 'Dynamic AQS'} />
                    <DetailItem label="Source Site" value={lead.sourceSiteName ?? lead.sourceSiteId ?? 'N/A'} />
                    <DetailItem label="Brand Tag" value={lead.sourceBrandTag ?? 'N/A'} />
                    <DetailItem label="Lead Rating" value={lead.leadRating ? formatLeadRatingLabel(lead.leadRating) : 'Unrated'} />
                    <DetailItem label="Install Tech Count" value={lead.installTechCount !== undefined ? String(lead.installTechCount) : 'N/A'} />
                    <DetailItem label="Truck Count" value={lead.truckCount !== undefined ? String(lead.truckCount) : 'N/A'} />
                    <DetailItem label="Sales Person Count" value={lead.salesPersonCount !== undefined ? String(lead.salesPersonCount) : 'N/A'} />
                    <DetailItem label="Potential Value" value={lead.potentialValueCents !== undefined ? formatCurrency(lead.potentialValueCents) : 'N/A'} />
                    <DetailItem label="Routing Basis Snapshot" value={`${lead.routingBasis === 'truck_count' ? 'Truck Count' : 'Service Tech Count'} ≤ ${lead.routingThreshold}`} />
                  </Grid.Col>
                </Grid>
                <Divider my="md" />
                <Title order={5} mb="sm">Internal Notes</Title>
                <Text size="sm" c="dimmed">
                  {lead.discoverySummary ?? lead.notes ?? 'No notes recorded yet.'}
                </Text>
                {lead.lifecycleStatus !== 'active' ? (
                  <>
                    <Divider my="md" />
                    <Title order={5} mb="sm">Pipeline Disposition</Title>
                    <Text size="sm" c="dimmed">
                      {formatLifecycleReason(lead.lifecycleReasonCode, lead.lifecycleReasonNote) ?? 'Lead is currently outside the active pipeline.'}
                    </Text>
                  </>
                ) : null}
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, xl: 4 }}>
              <Stack gap="md">
                <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                  <Title order={5} mb="md">Next Best Action</Title>
                  <Text size="sm" mb="md">
                    {currentLead.stage === 'onboarding_completed'
                      ? 'CRM-owned onboarding is complete. The next milestone is the first-order / Acumatica boundary.'
                      : currentLead.workflowTask.reason}
                  </Text>
                  <Button
                    fullWidth
                    variant="light"
                    color={workflowActionColor(currentLead.workflowTask.colorToken)}
                    onClick={handleNextBestAction}
                    disabled={currentLead.stage === 'onboarding_completed'}
                  >
                    {nextActionLabel}
                  </Button>
                </Card>

                <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                  <Group justify="space-between" mb="md">
                    <Title order={5}>Workflow Gates</Title>
                    <Badge color={lead.onboardingCompletedAt ? 'green' : 'yellow'} variant="light">
                      {lead.onboardingCompletedAt ? 'Ready For First Order' : 'In Progress'}
                    </Badge>
                  </Group>
                  <Stack gap="sm">
                    {workflowGates.map((gate) => (
                      <Group key={gate.label} justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Text size="sm" fw={600}>{gate.label}</Text>
                          <Text size="xs" c="dimmed">{gate.detail}</Text>
                        </Stack>
                        <Badge color={gate.complete ? 'green' : 'gray'} variant="light">
                          {gate.complete ? 'Done' : 'Pending'}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>

                <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                  <Title order={5} mb="md">Secondary Actions</Title>
                  <Stack gap="xs">
                    <Button variant="light" fullWidth onClick={() => setActiveTab('discovery')}>
                      Open Discovery Workspace
                    </Button>
	                    <Button variant="light" fullWidth onClick={() => setActiveTab('cis')}>
	                      Open CIS Workspace
	                    </Button>
	                    <Button variant="light" fullWidth onClick={() => setActiveTab('onboarding')}>
	                      Open Onboarding Readiness
	                    </Button>
                    {canViewFinanceQueue ? (
                      <Button component={Link} href="/leads/finance" variant="light" fullWidth>
                        Open Finance Queue
                      </Button>
                    ) : null}
                  </Stack>
                </Card>

                <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                  <Title order={5} mb="md">Pipeline Lifecycle</Title>
                  {lead.lifecycleStatus === 'active' ? (
                    <Stack gap="sm">
                      <Text size="sm" c="dimmed">
                        Remove this lead from the active pipeline only with a documented reason. The stage stays intact so the lead can be reopened cleanly later.
                      </Text>
                      <Select
                        label="Lifecycle Action"
                        data={[
                          { value: 'parked', label: 'Park Lead' },
                          { value: 'closed', label: 'Close Lead' },
                        ]}
                        value={lifecycleDraftStatus}
                        onChange={(value) => {
                          const next = value === 'closed' ? 'closed' : 'parked';
                          setLifecycleDraftStatus(next);
                          setLifecycleReasonCode(next === 'closed' ? 'not_interested' : 'follow_up_later');
                        }}
                        disabled={!canManageLead || isUpdatingLifecycle}
                      />
                      <Select
                        label="Reason"
                        data={lifecycleReasonOptions}
                        value={lifecycleReasonCode}
                        onChange={(value) => setLifecycleReasonCode((value as LeadLifecycleReasonCodeKey) || (lifecycleDraftStatus === 'closed' ? 'not_interested' : 'follow_up_later'))}
                        disabled={!canManageLead || isUpdatingLifecycle}
                      />
                      <Textarea
                        label="Notes"
                        placeholder="Document the context for future follow-up or audit."
                        value={lifecycleReasonNote}
                        onChange={(event) => setLifecycleReasonNote(event.currentTarget.value)}
                        disabled={!canManageLead || isUpdatingLifecycle}
                        minRows={3}
                      />
                      <Button
                        color={lifecycleDraftStatus === 'closed' ? 'dark' : 'gray'}
                        onClick={() => void handleUpdateLifecycle(lifecycleDraftStatus)}
                        loading={isUpdatingLifecycle}
                        disabled={!canManageLead}
                      >
                        {lifecycleDraftStatus === 'closed' ? 'Close Lead' : 'Park Lead'}
                      </Button>
                    </Stack>
                  ) : (
                    <Stack gap="sm">
                      <Text size="sm" c="dimmed">
                        {formatLifecycleReason(lead.lifecycleReasonCode, lead.lifecycleReasonNote) ?? 'Lead is currently outside the active pipeline.'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {lead.lifecycleChangedAt ? `Updated ${formatDateLabel(lead.lifecycleChangedAt)}.` : 'No lifecycle timestamp recorded yet.'}
                      </Text>
                      <Button
                        color="blue"
                        variant="light"
                        onClick={() => void handleUpdateLifecycle('active')}
                        loading={isUpdatingLifecycle}
                        disabled={!canManageLead}
                      >
                        Reopen Lead
                      </Button>
                    </Stack>
                  )}
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        <Tabs.Panel value="discovery" pt="md">
          <Stack gap="lg">
            <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
              <Stack gap="md">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Title order={4}>Discovery Command Center</Title>
                    <Text size="sm" c="dimmed">
                      Discovery qualifies the opportunity before CIS. We capture the contractor&apos;s pain points, current IAQ setup, decision maker, buying intent, and any approved fast-track reason here.
                    </Text>
                  </Stack>
                  <Badge color={lead.discoveryCompletedAt ? 'teal' : lead.discoveryScheduledAt ? 'blue' : 'gray'} variant="light" size="lg">
                    {lead.discoveryCompletedAt ? 'Discovery Complete' : lead.discoveryScheduledAt ? 'Discovery In Progress' : 'Discovery Pending'}
                  </Badge>
                </Group>

                <Grid>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Current Owner</Text>
                    <Text size="sm" fw={600}>Sales / BD</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Current Step</Text>
                    <Text size="sm" fw={600}>{getDiscoveryStepTitle(lead, hasInitialContact)}</Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed">Next Handoff</Text>
                    <Text size="sm">CIS opens once discovery is completed or the fast-track reason is documented.</Text>
                  </Grid.Col>
                </Grid>
                {!leadIsActive ? (
                  <Alert color="gray" icon={<IconLock size={16} />}>
                    This lead is currently outside the active pipeline. Reopen it before recording discovery or CIS/onboarding actions.
                  </Alert>
                ) : null}
              </Stack>
            </Card>

            <Grid>
              <Grid.Col span={{ base: 12, xl: 8 }}>
                <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                  <Title order={4} mb="md">Discovery & Qualification</Title>

                  <Stepper
                    active={lead.discoveryCompletedAt ? 2 : lead.discoveryScheduledAt ? 1 : 0}
                    color="teal"
                    size="sm"
                    mb="xl"
                  >
                    <Stepper.Step label="1. Schedule Call" description={lead.discoveryScheduledAt ? formatDateLabel(lead.discoveryScheduledAt) : 'Not scheduled'}>
                      <Stack gap="sm" mt="md">
                        <Text size="sm" c="dimmed">
                          Log the first contact and schedule discovery before the lead moves into structured qualification.
                        </Text>
                        <Group>
                          <Button
                            leftSection={<IconPhone size={16} />}
                            variant="light"
                            onClick={() => void handleLogInitialContact()}
                            loading={isLoggingCall}
                            disabled={!canManageLead || hasInitialContact || !leadIsActive}
                          >
                            {hasInitialContact ? 'Initial Contact Logged' : 'Log Initial Contact'}
                          </Button>
                          <Button
                            leftSection={<IconCalendar size={16} />}
                            color="blue"
                            onClick={() => void handleScheduleDiscovery()}
                            loading={isSchedulingDiscovery}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryScheduledAt) || lead.stage !== 'new'}
                          >
                            {lead.discoveryScheduledAt ? 'Discovery Scheduled' : 'Schedule Discovery'}
                          </Button>
                        </Group>
                      </Stack>
                    </Stepper.Step>

                    <Stepper.Step label="2. Complete Discovery" description={lead.discoveryCompletedAt ? formatDateLabel(lead.discoveryCompletedAt) : 'Pending'}>
                      <Stack gap="sm" mt="md">
                        <MultiSelect
                          label="Pain Points"
                          placeholder="Select all that apply"
                          data={[...DISCOVERY_PAIN_POINT_OPTIONS]}
                          value={discoveryPainPoints}
                          onChange={setDiscoveryPainPoints}
                          disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                        />
                        <TextInput
                          label="Current IAQ Setup"
                          value={discoveryCurrentIaqSetup}
                          onChange={(event) => setDiscoveryCurrentIaqSetup(event.currentTarget.value)}
                          disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                        />
                        <Group grow>
                          <TextInput
                            label="Decision Maker"
                            value={discoveryDecisionMaker}
                            onChange={(event) => setDiscoveryDecisionMaker(event.currentTarget.value)}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                          />
                          <TextInput
                            label="Buying Intent"
                            value={discoveryBuyingIntent}
                            onChange={(event) => setDiscoveryBuyingIntent(event.currentTarget.value)}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                          />
                        </Group>
                        <Group grow>
                          <Button
                            variant={consignmentInterestStatus === 'interested' ? 'filled' : 'light'}
                            onClick={() => setConsignmentInterestStatus('interested')}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                          >
                            Mark Interested
                          </Button>
                          <Button
                            variant={consignmentInterestStatus === 'approved' ? 'filled' : 'light'}
                            color="teal"
                            onClick={() => setConsignmentInterestStatus('approved')}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                          >
                            Approve For Consignment
                          </Button>
                          <Button
                            variant={consignmentInterestStatus === 'declined' ? 'filled' : 'light'}
                            color="gray"
                            onClick={() => setConsignmentInterestStatus('declined')}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                          >
                            Not Interested
                          </Button>
                        </Group>
                        {consignmentInterestStatus !== 'not_discussed' && consignmentInterestStatus !== 'declined' ? (
                          <Group grow>
                            <Button
                              variant={consignmentEntryTiming === 'at_onboarding' ? 'filled' : 'light'}
                              color="orange"
                              onClick={() => setConsignmentEntryTiming('at_onboarding')}
                              disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                            >
                              Start At Onboarding
                            </Button>
                            <Button
                              variant={consignmentEntryTiming === 'later' ? 'filled' : 'light'}
                              color="blue"
                              onClick={() => setConsignmentEntryTiming('later')}
                              disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                            >
                              Start Later
                            </Button>
                          </Group>
                        ) : null}
                        <TextInput
                          label="Fast-Track Reason"
                          placeholder="Required only if discovery is skipped"
                          value={discoveryFastTrackReason}
                          onChange={(event) => setDiscoveryFastTrackReason(event.currentTarget.value)}
                          disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                        />
                        <Textarea
                          label="Discovery Summary"
                          placeholder="Summarize the opportunity, qualification details, and next steps..."
                          minRows={4}
                          value={discoverySummary}
                          onChange={(event) => setDiscoverySummary(event.currentTarget.value)}
                          disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt)}
                        />
                        <Group>
                          <Button
                            leftSection={<IconCheck size={16} />}
                            color="teal"
                            onClick={() => void handleCompleteDiscovery()}
                            loading={isCompletingDiscovery}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt) || !discoverySummaryValid}
                          >
                            Complete Discovery
                          </Button>
                          <Button
                            variant="light"
                            color="yellow"
                            onClick={() => void handleSkipDiscovery()}
                            loading={isSkippingDiscovery}
                            disabled={!canManageLead || !leadIsActive || Boolean(lead.discoveryCompletedAt) || discoveryFastTrackReason.trim().length === 0}
                          >
                            Skip Discovery (Fast-Track)
                          </Button>
                        </Group>
                      </Stack>
                    </Stepper.Step>

                    <Stepper.Step label="3. Ready for CIS" description={lead.discoveryCompletedAt ? 'Ready' : ''}>
                      <Alert color="teal" variant="light" icon={<IconCheck size={16} />} mt="md">
                        Discovery is closed. The lead can now move into the CIS workspace.
                      </Alert>
                    </Stepper.Step>
                  </Stepper>

                  <Title order={5} mb="sm">Discovery Summary</Title>
                  <Stack gap="xs" p="md" className="premium-stat-card">
                    <Text size="sm">{lead.discoverySummary ?? 'No discovery summary recorded yet.'}</Text>
                    {lead.discoveryPainPoints?.length ? (
                      <Text size="sm" c="dimmed">Pain Points: {lead.discoveryPainPoints.join(', ')}</Text>
                    ) : null}
                    {lead.discoveryDecisionMaker ? (
                      <Text size="sm" c="dimmed">Decision Maker: {lead.discoveryDecisionMaker}</Text>
                    ) : null}
                    {lead.discoveryBuyingIntent ? (
                      <Text size="sm" c="dimmed">Buying Intent: {lead.discoveryBuyingIntent}</Text>
                    ) : null}
                    {lead.discoveryCurrentIaqSetup ? (
                      <Text size="sm" c="dimmed">Current IAQ Setup: {lead.discoveryCurrentIaqSetup}</Text>
                    ) : null}
                    {lead.discoveryFastTrackReason ? (
                      <Text size="sm" c="dimmed">Fast-Track Reason: {lead.discoveryFastTrackReason}</Text>
                    ) : null}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, xl: 4 }}>
                <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                  <Title order={5} mb="md">Discovery Readiness</Title>
                  <Stack gap="xs">
                    <ReadinessRow label="Initial Contact" ready={hasInitialContact} />
                    <ReadinessRow label="Discovery Summary" ready={Boolean(lead.discoverySummary)} />
                    <ReadinessRow label="Fast-Track Reason" ready={lead.discoveryCallSkipped ? Boolean(lead.discoveryFastTrackReason) : true} />
                    <DetailCompact label="Routing Team" value={formatRoutingTeam(lead.routingTeam)} />
                    <DetailCompact label="Service Tech Count" value={String(lead.serviceTechCount)} />
                    <DetailCompact label="Affinity" value={formatGroupAxisLabel(lead.affinityGroupSelection, lead.affinityGroupName)} />
                    <DetailCompact label="State" value={lead.state ?? 'N/A'} />
                    <Alert color="blue" variant="light" mt="sm">
                      <Text size="xs">
                        Discovery hands off to CIS once the qualification summary is captured or the fast-track reason is documented.
                      </Text>
                    </Alert>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          </Stack>
        </Tabs.Panel>

	        <Tabs.Panel value="cis" pt="md">
	          <LeadCisPanel
	            apiBaseUrl={apiBaseUrl}
	            accessToken={currentAuth.tokens.accessToken}
	            actorRole={currentAuth.identity.role}
	            lead={currentLead}
	            onLeadChanged={() => {
	              void fetchLeadDetail(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id).then(setLead);
	            }}
	          />
	        </Tabs.Panel>

	        <Tabs.Panel value="onboarding" pt="md">
	          <LeadOnboardingReadyPanel
	            apiBaseUrl={apiBaseUrl}
	            accessToken={currentAuth.tokens.accessToken}
	            actorRole={currentAuth.identity.role}
	            lead={currentLead}
	            onLeadChanged={() => {
	              void fetchLeadDetail(apiBaseUrl, currentAuth.tokens.accessToken, currentLead.id).then(setLead);
	            }}
	          />
	        </Tabs.Panel>

	        <Tabs.Panel value="activity" pt="md">
          <Card withBorder radius="xl" p="lg" className="premium-detail-card">
            <Title order={4} mb="xl">Activity Timeline</Title>
            <Timeline active={Math.max(activityItems.length - 1, 0)} bulletSize={24} lineWidth={2}>
              {activityItems.map((item) => (
                <Timeline.Item
                  key={item.key}
                  bullet={timelineIcon(item.title)}
                  title={item.title}
                >
                  <Text c="dimmed" size="sm">{item.description}</Text>
                  <Text size="xs" mt={4}>{formatDateTimeLabel(item.occurredAt)}</Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function MetricDetail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">{label}</Text>
      <Text size="sm" fw={600}>{value}</Text>
    </Box>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <Box mb="sm">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="md" fw={500}>{value}</Text>
    </Box>
  );
}

function DetailCompact({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={500}>{value}</Text>
    </Group>
  );
}

function ReadinessRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">{label}</Text>
      <Badge color={ready ? 'teal' : 'gray'} variant="light">
        {ready ? 'Ready' : 'Pending'}
      </Badge>
    </Group>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function getDiscoveryStepTitle(lead: LeadDetail, hasInitialContact: boolean) {
  if (!hasInitialContact) {
    return 'Make initial contact and open discovery';
  }
  if (!lead.discoveryScheduledAt) {
    return 'Schedule the discovery call';
  }
  if (!lead.discoveryCompletedAt) {
    return 'Capture qualification and close discovery';
  }

  return 'Discovery is complete';
}

function buildFinanceGateDetail(lead: LeadDetail) {
  switch (lead.workflowTask.financeDecisionStatus) {
    case 'approved':
      return 'Finance approved the package and CRM setup can continue.';
    case 'conditional':
      return 'Finance approved with conditions. Resolve the conditions before final onboarding closeout.';
    case 'pending':
      return 'Finance review is in progress.';
    case 'info_requested':
      return 'Finance requested more information and the package loop stays in CRM.';
    case 'declined':
      return 'Finance declined open credit and the lead needs alternate payment handling.';
    case 'not_submitted':
    default:
      return lead.cisSignedAt
        ? 'Signed CIS is ready for finance submission.'
        : 'Finance will not see this record until the CIS is signed off internally.';
  }
}

function formatRoutingTeam(team: LeadDetail['routingTeam']) {
  return team === 'strategic_growth' ? 'Strategic Growth' : 'National TM';
}

function formatCaptureMethod(value: LeadDetail['leadCaptureMethod']) {
  switch (value) {
    case 'direct_web_form':
      return 'Direct Web Form';
    case 'bulk_import':
      return 'Bulk Import';
    case 'legacy_import':
      return 'Legacy Import';
    case 'manual_entry':
    default:
      return 'Manual Entry';
  }
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

function formatGroupAxisLabel(
  selection: LeadDetail['affinityGroupSelection'] | LeadDetail['ownershipGroupSelection'],
  groupName?: string,
) {
  switch (selection) {
    case 'group':
      return groupName ?? 'Governed group';
    case 'none':
      return 'Independent / No group';
    case 'unknown':
    default:
      return 'Unknown / Not assessed';
  }
}

function formatGroupClassificationLabel(classification?: LeadDetail['groupClassification']) {
  switch (classification) {
    case 'independent':
      return 'Independent';
    case 'affinity_only':
      return 'Affinity only';
    case 'ownership_only':
      return 'Ownership only';
    case 'hybrid':
      return 'Hybrid';
    default:
      return 'Pending classification';
  }
}

function formatStageLabel(stage: LeadDetail['stage']) {
  switch (stage) {
    case 'new':
      return '1. New Lead';
    case 'discovery_scheduled':
      return '2. Discovery Scheduled';
    case 'discovery_completed':
      return '3. Discovery Completed';
    case 'cis_sent':
      return '4. CIS Sent';
    case 'cis_signed':
      return '5. CIS Signed';
    case 'onboarding_completed':
      return '6. Onboarding Completed';
    case 'customer_active':
      return '7. Customer Active';
  }
}

function stageColor(stage: LeadDetail['stage']) {
  switch (stage) {
    case 'new':
      return 'blue';
    case 'discovery_scheduled':
      return 'indigo';
    case 'discovery_completed':
      return 'orange';
    case 'cis_sent':
      return 'grape';
    case 'cis_signed':
      return 'teal';
    case 'onboarding_completed':
      return 'cyan';
    case 'customer_active':
      return 'green';
  }
}

function workflowActionColor(colorToken: string) {
  switch (colorToken) {
    case 'dark':
      return 'dark';
    case 'red':
      return 'red';
    case 'orange':
      return 'orange';
    case 'teal':
      return 'teal';
    case 'green':
      return 'green';
    case 'indigo':
      return 'indigo';
    case 'cyan':
      return 'cyan';
    case 'yellow':
      return 'yellow';
    case 'blue':
    default:
      return 'blue';
  }
}

function timelineIcon(title: string) {
  if (title.includes('Closed') || title.includes('Parked')) {
    return <IconLock size={12} />;
  }
  if (title.includes('Contact')) {
    return <IconPhone size={12} />;
  }
  if (title.includes('Discovery')) {
    return <IconCalendar size={12} />;
  }
  if (title.includes('CIS')) {
    return <IconFileText size={12} />;
  }
  if (title.includes('Onboarding')) {
    return <IconCheck size={12} />;
  }
  if (title.includes('Lead Created')) {
    return <IconMail size={12} />;
  }

  return <IconClock size={12} />;
}

function formatLifecycleReason(reasonCode?: LeadLifecycleReasonCodeKey, reasonNote?: string) {
  if (!reasonCode) {
    return reasonNote ?? null;
  }

  const label = reasonCode
    .split('_')
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join(' ');

  return reasonNote ? `${label}: ${reasonNote}` : label;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTimeLabel(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

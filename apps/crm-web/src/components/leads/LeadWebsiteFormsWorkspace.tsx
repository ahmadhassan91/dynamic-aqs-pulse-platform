'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBell,
  IconBrowser,
  IconCheck,
  IconCode,
  IconCopy,
  IconEye,
  IconHistory,
  IconMail,
  IconPlus,
  IconPencil,
  IconRepeat,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import type {
  ListWebsiteLeadSubmissionsResponse,
  LeadRoutingPolicySummary,
  LeadRoutingBasisKey,
  LeadSummary,
  LeadStageKey,
  ResolveWebsiteLeadSubmissionRequest,
  WebsiteLeadSiteFormConfig,
  WebsiteLeadFormTypeKey,
  WebsiteLeadNotificationRecipientSummary,
  WebsiteLeadSiteSummary,
  WebsiteLeadSubmissionSummary,
  WebsiteLeadTypeKey,
} from '@pulse/contracts';
import {
  createWebsiteLeadNotificationRecipient,
  fetchLeads,
  createWebsiteLeadSite,
  fetchLeadRoutingPolicy,
  fetchWebsiteLeadNotificationRecipients,
  fetchWebsiteLeadSites,
  fetchWebsiteLeadSubmissions,
  resolveWebsiteLeadSubmission,
  updateLeadRoutingPolicy,
  updateWebsiteLeadNotificationRecipient,
  updateWebsiteLeadSite,
} from '@/lib/pulse-api';
import { canPerformAction } from '@/lib/access';
import { usePulseSession } from '@/lib/pulse-session';
import { PublicWebsiteLeadCaptureForm } from './PublicWebsiteLeadCaptureForm';

const DEFAULT_WEB_BASE_URL = process.env.NEXT_PUBLIC_PULSE_WEB_BASE_URL ?? 'http://localhost:3000';

const STAGE_META: Record<LeadStageKey, { label: string; color: string }> = {
  new: { label: 'New', color: 'blue' },
  discovery_scheduled: { label: 'Discovery Scheduled', color: 'indigo' },
  discovery_completed: { label: 'Discovery Completed', color: 'orange' },
  cis_sent: { label: 'CIS Sent', color: 'grape' },
  cis_signed: { label: 'CIS Signed', color: 'teal' },
  onboarding_completed: { label: 'Onboarding Completed', color: 'cyan' },
  customer_active: { label: 'Customer Active', color: 'green' },
};

type WebsiteFormsTab = 'sites' | 'notifications' | 'flow' | 'duplicates';

type SiteDraft = {
  siteId: string;
  siteName: string;
  url: string;
  brandTag: string;
  formType: WebsiteLeadFormTypeKey;
  notes: string;
  headline: string;
  subheadline: string;
  submitButtonLabel: string;
  successTitle: string;
  successMessage: string;
  homeownerInquiryLabel: string;
  contractorInquiryLabel: string;
  messageLabel: string;
  referralSourceLabel: string;
  referralDetailLabel: string;
  marketingConsentLabel: string;
  customerStatusLabel: string;
  homeownerInquiryOptions: string;
  contractorInquiryOptions: string;
  referralSourceOptions: string;
};

type RecipientDraft = {
  websiteLeadSiteId: string;
  name: string;
  email: string;
  roleTitle: string;
};

type FlowPolicyDraft = {
  routingBasis: LeadRoutingBasisKey;
  strategicGrowthMax: number;
  initialContactSlaHours: number;
  initialContactUrgentWindowHours: number;
  initialContactManagerEscalationDelayHours: number;
  initialContactLeadershipEscalationDelayHours: number;
  discoverySchedulingSlaHours: number;
  discoverySchedulingManagerEscalationDelayHours: number;
  cisFollowUpBusinessDays: number;
  cisFollowUpProspectReminderDelayBusinessDays: number;
  cisFollowUpOwnerAlertDelayBusinessDays: number;
  stagnantStageDays: number;
  notes: string;
};

const initialSiteDraft: SiteDraft = {
  siteId: '',
  siteName: '',
  url: '',
  brandTag: '',
  formType: 'both',
  notes: '',
  headline: 'Contact an IAQ Professional',
  subheadline: 'Protect your Indoor Space',
  submitButtonLabel: 'Submit',
  successTitle: 'Thanks, we’ve received your request.',
  successMessage: 'Your submission has been routed into Pulse CRM and the intake team will follow up from there.',
  homeownerInquiryLabel: 'For Homeowners: How can we help?',
  contractorInquiryLabel: 'For HVAC Contractors, I am inquiring about:',
  messageLabel: 'Please provide a brief summary of your request:',
  referralSourceLabel: 'How did you hear about us?',
  referralDetailLabel: 'Who can we thank for referring you?',
  marketingConsentLabel: 'I agree to receive other communications from Dynamic AQS.',
  customerStatusLabel: 'Please select customer type:',
  homeownerInquiryOptions: [
    'Improve indoor air quality',
    'Address odors or allergies',
    'Whole-home IAQ consultation',
    'Service or support request',
  ].join('\n'),
  contractorInquiryOptions: [
    'Become a contractor partner',
    'Product, pricing, or availability',
    'Training and onboarding',
    'Existing account support',
  ].join('\n'),
  referralSourceOptions: [
    'Search engine',
    'Dealer referral',
    'Social media',
    'Affinity group',
    'Existing customer',
  ].join('\n'),
};

const initialRecipientDraft: RecipientDraft = {
  websiteLeadSiteId: '',
  name: '',
  email: '',
  roleTitle: '',
};

const initialFlowPolicyDraft: FlowPolicyDraft = {
  routingBasis: 'service_tech_count',
  strategicGrowthMax: 5,
  initialContactSlaHours: 24,
  initialContactUrgentWindowHours: 12,
  initialContactManagerEscalationDelayHours: 12,
  initialContactLeadershipEscalationDelayHours: 24,
  discoverySchedulingSlaHours: 72,
  discoverySchedulingManagerEscalationDelayHours: 48,
  cisFollowUpBusinessDays: 5,
  cisFollowUpProspectReminderDelayBusinessDays: 3,
  cisFollowUpOwnerAlertDelayBusinessDays: 5,
  stagnantStageDays: 7,
  notes: '',
};

function formatWebsiteLeadOptionsText(options: string[]) {
  return options.join('\n');
}

function parseWebsiteLeadOptionsText(value: string) {
  return [...new Set(value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0))];
}

function toSiteDraft(site?: WebsiteLeadSiteSummary): SiteDraft {
  if (!site) {
    return initialSiteDraft;
  }

  return {
    siteId: site.siteId,
    siteName: site.siteName,
    url: site.url,
    brandTag: site.brandTag,
    formType: site.formType,
    notes: site.notes ?? '',
    headline: site.formConfig.headline,
    subheadline: site.formConfig.subheadline,
    submitButtonLabel: site.formConfig.submitButtonLabel,
    successTitle: site.formConfig.successTitle,
    successMessage: site.formConfig.successMessage,
    homeownerInquiryLabel: site.formConfig.homeownerInquiryLabel,
    contractorInquiryLabel: site.formConfig.contractorInquiryLabel,
    messageLabel: site.formConfig.messageLabel,
    referralSourceLabel: site.formConfig.referralSourceLabel,
    referralDetailLabel: site.formConfig.referralDetailLabel,
    marketingConsentLabel: site.formConfig.marketingConsentLabel,
    customerStatusLabel: site.formConfig.customerStatusLabel,
    homeownerInquiryOptions: formatWebsiteLeadOptionsText(site.formConfig.homeownerInquiryOptions),
    contractorInquiryOptions: formatWebsiteLeadOptionsText(site.formConfig.contractorInquiryOptions),
    referralSourceOptions: formatWebsiteLeadOptionsText(site.formConfig.referralSourceOptions),
  };
}

function toSiteFormConfigPayload(draft: SiteDraft): Partial<WebsiteLeadSiteFormConfig> {
  return {
    headline: draft.headline,
    subheadline: draft.subheadline,
    submitButtonLabel: draft.submitButtonLabel,
    successTitle: draft.successTitle,
    successMessage: draft.successMessage,
    homeownerInquiryLabel: draft.homeownerInquiryLabel,
    contractorInquiryLabel: draft.contractorInquiryLabel,
    messageLabel: draft.messageLabel,
    referralSourceLabel: draft.referralSourceLabel,
    referralDetailLabel: draft.referralDetailLabel,
    marketingConsentLabel: draft.marketingConsentLabel,
    customerStatusLabel: draft.customerStatusLabel,
    homeownerInquiryOptions: parseWebsiteLeadOptionsText(draft.homeownerInquiryOptions),
    contractorInquiryOptions: parseWebsiteLeadOptionsText(draft.contractorInquiryOptions),
    referralSourceOptions: parseWebsiteLeadOptionsText(draft.referralSourceOptions),
  };
}

export function LeadWebsiteFormsWorkspace() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [activeTab, setActiveTab] = useState<WebsiteFormsTab>('sites');
  const [sites, setSites] = useState<WebsiteLeadSiteSummary[]>([]);
  const [recipients, setRecipients] = useState<WebsiteLeadNotificationRecipientSummary[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [duplicateSubmissions, setDuplicateSubmissions] = useState<WebsiteLeadSubmissionSummary[]>([]);
  const [duplicateSubmissionTotal, setDuplicateSubmissionTotal] = useState(0);
  const [duplicateSummary, setDuplicateSummary] = useState<ListWebsiteLeadSubmissionsResponse['summary'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSite, setPreviewSite] = useState<WebsiteLeadSiteSummary | null>(null);
  const [embedSite, setEmbedSite] = useState<WebsiteLeadSiteSummary | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<WebsiteLeadSubmissionSummary | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(initialSiteDraft);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [recipientDraft, setRecipientDraft] = useState<RecipientDraft>(initialRecipientDraft);
  const [flowPolicyDraft, setFlowPolicyDraft] = useState<FlowPolicyDraft>(initialFlowPolicyDraft);
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [resolvingSubmissionKey, setResolvingSubmissionKey] = useState<string | null>(null);
  const [relinkCandidates, setRelinkCandidates] = useState<LeadSummary[]>([]);
  const [relinkTargetLeadId, setRelinkTargetLeadId] = useState<string | null>(null);
  const [isLoadingRelinkCandidates, setIsLoadingRelinkCandidates] = useState(false);

  useEffect(() => {
    if (!auth) {
      setSites([]);
      setRecipients([]);
      setRoutingPolicy(null);
      setDuplicateSubmissions([]);
      setDuplicateSubmissionTotal(0);
      setDuplicateSummary(null);
      setFlowPolicyDraft(initialFlowPolicyDraft);
      return;
    }

    let cancelled = false;
    const accessToken = auth.tokens.accessToken;

    async function loadWebsiteFormsWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [siteResponse, recipientResponse, routingPolicyResponse, duplicateResponse] = await Promise.all([
          fetchWebsiteLeadSites(apiBaseUrl, accessToken),
          fetchWebsiteLeadNotificationRecipients(apiBaseUrl, accessToken),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
          fetchWebsiteLeadSubmissions(apiBaseUrl, accessToken, {
            outcome: 'attached_to_existing_lead',
            limit: 50,
          }),
        ]);

        if (cancelled) {
          return;
        }

        setSites(siteResponse.items);
        setRecipients(recipientResponse.items);
        setRoutingPolicy(routingPolicyResponse);
        setDuplicateSubmissions(duplicateResponse.items);
        setDuplicateSubmissionTotal(duplicateResponse.total);
        setDuplicateSummary(duplicateResponse.summary);
        setFlowPolicyDraft({
          routingBasis: routingPolicyResponse.routingBasis,
          strategicGrowthMax: routingPolicyResponse.strategicGrowthMax,
          initialContactSlaHours: routingPolicyResponse.initialContactSlaHours,
          initialContactUrgentWindowHours: routingPolicyResponse.initialContactUrgentWindowHours,
          initialContactManagerEscalationDelayHours: routingPolicyResponse.initialContactManagerEscalationDelayHours,
          initialContactLeadershipEscalationDelayHours: routingPolicyResponse.initialContactLeadershipEscalationDelayHours,
          discoverySchedulingSlaHours: routingPolicyResponse.discoverySchedulingSlaHours,
          discoverySchedulingManagerEscalationDelayHours: routingPolicyResponse.discoverySchedulingManagerEscalationDelayHours,
          cisFollowUpBusinessDays: routingPolicyResponse.cisFollowUpBusinessDays,
          cisFollowUpProspectReminderDelayBusinessDays: routingPolicyResponse.cisFollowUpProspectReminderDelayBusinessDays,
          cisFollowUpOwnerAlertDelayBusinessDays: routingPolicyResponse.cisFollowUpOwnerAlertDelayBusinessDays,
          stagnantStageDays: routingPolicyResponse.stagnantStageDays,
          notes: routingPolicyResponse.notes ?? '',
        });
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadWebsiteFormsWorkspace();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, auth]);

  const activeSites = sites.filter((site) => site.isActive).length;
  const totalLeadsThisMonth = sites.reduce((sum, site) => sum + site.submissionsLast30Days, 0);
  const totalLinkedLeads = sites.reduce((sum, site) => sum + site.linkedLeadsTotal, 0);
  const duplicateCount = duplicateSummary?.duplicateCount ?? 0;
  const duplicateLinkedLeadCount = duplicateSummary?.uniqueLinkedLeadCount ?? 0;
  const publicWebBaseUrl = DEFAULT_WEB_BASE_URL;

  const activeRecipientCount = useMemo(
    () => recipients.filter((recipient) => recipient.isActive).length,
    [recipients],
  );
  const canManageReference = auth ? canPerformAction(auth.identity.role, 'reference.manage') : false;
  const accessToken = auth?.tokens.accessToken ?? '';

  useEffect(() => {
    if (!auth || !selectedSubmission || selectedSubmission.reviewStatus !== 'pending_review') {
      setRelinkCandidates([]);
      setRelinkTargetLeadId(null);
      setIsLoadingRelinkCandidates(false);
      return;
    }

    const submission = selectedSubmission;
    let cancelled = false;

    async function loadRelinkCandidates() {
      setIsLoadingRelinkCandidates(true);
      try {
        const searchSeed = submission.companyName
          ?? submission.email
          ?? submission.contactDisplayName;
        const response = await fetchLeads(apiBaseUrl, accessToken, {
          ...(searchSeed ? { search: searchSeed } : {}),
          limit: 25,
        });

        if (cancelled) {
          return;
        }

        const candidates = response.items.filter((lead) => (
          lead.lifecycleStatus === 'active'
          && lead.stage !== 'customer_active'
          && lead.id !== submission.linkedLeadId
        ));

        setRelinkCandidates(candidates);
        setRelinkTargetLeadId((current) => current ?? candidates[0]?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setRelinkCandidates([]);
          setRelinkTargetLeadId(null);
          notifications.show({
            title: 'Relink candidates unavailable',
            message: error instanceof Error ? error.message : String(error),
            color: 'red',
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRelinkCandidates(false);
        }
      }
    }

    void loadRelinkCandidates();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    apiBaseUrl,
    auth,
    selectedSubmission,
  ]);

  if (!isHydrated) {
    return null;
  }

  if (!auth) {
    return null;
  }

  const openPreview = (site: WebsiteLeadSiteSummary) => {
    setPreviewSite(site);
  };

  const openCreateSiteModal = () => {
    setEditingSiteId(null);
    setSiteDraft(initialSiteDraft);
    setSiteModalOpen(true);
  };

  const openEditSiteModal = (site: WebsiteLeadSiteSummary) => {
    setEditingSiteId(site.id);
    setSiteDraft(toSiteDraft(site));
    setSiteModalOpen(true);
  };

  function applyResolvedSubmission(updatedSubmission: WebsiteLeadSubmissionSummary) {
    setDuplicateSubmissions((current) => current.map((submission) => (
      submission.id === updatedSubmission.id ? updatedSubmission : submission
    )));
    setSelectedSubmission(updatedSubmission);
    setDuplicateSummary((current) => {
      if (!current) {
        return current;
      }

      const wasPending = selectedSubmission?.id === updatedSubmission.id
        ? selectedSubmission.reviewStatus === 'pending_review'
        : current.pendingReviewCount > 0;

      if (!wasPending) {
        return current;
      }

      return {
        ...current,
        pendingReviewCount: Math.max(0, current.pendingReviewCount - 1),
        resolvedCount: current.resolvedCount + 1,
      };
    });
  }

  async function handleResolveSubmission(decision: ResolveWebsiteLeadSubmissionRequest['decision']) {
    if (!selectedSubmission) {
      return;
    }
    if (decision === 'relink_existing' && !relinkTargetLeadId) {
      notifications.show({
        title: 'Choose a target lead',
        message: 'Select another active in-flight lead before relinking this repeat submission.',
        color: 'orange',
      });
      return;
    }

    const actionKey = `${selectedSubmission.id}:${decision}`;
    setResolvingSubmissionKey(actionKey);

    try {
      const updated = await resolveWebsiteLeadSubmission(apiBaseUrl, accessToken, selectedSubmission.id, {
        decision,
        ...(decision === 'relink_existing' && relinkTargetLeadId ? { targetLeadId: relinkTargetLeadId } : {}),
      });
      applyResolvedSubmission(updated);
      notifications.show({
        title: 'Duplicate review saved',
        message:
          decision === 'confirm_existing'
            ? 'Pulse will keep this website submission attached to the existing lead.'
            : decision === 'relink_existing'
              ? 'Pulse relinked this submission to the selected active lead.'
            : 'Pulse created a new lead from this website submission.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Duplicate review failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setResolvingSubmissionKey(null);
    }
  }

  async function handleToggleSite(site: WebsiteLeadSiteSummary) {
    try {
      const updated = await updateWebsiteLeadSite(apiBaseUrl, accessToken, site.id, {
        isActive: !site.isActive,
      });

      setSites((current) => current.map((entry) => (
        entry.id === site.id
          ? {
              ...entry,
              ...updated,
              submissionsLast30Days: entry.submissionsLast30Days,
              linkedLeadsTotal: entry.linkedLeadsTotal,
              activePipelineLeads: entry.activePipelineLeads,
              convertedLeads: entry.convertedLeads,
              conversionRate: entry.conversionRate,
              ...(entry.recentSubmissionAt ? { recentSubmissionAt: entry.recentSubmissionAt } : {}),
            }
          : entry
      )));
      notifications.show({
        title: 'Website updated',
        message: `${site.siteName} is now ${updated.isActive ? 'active' : 'inactive'} for Pulse-native capture.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Website update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    }
  }

  async function handleToggleRecipient(recipient: WebsiteLeadNotificationRecipientSummary) {
    try {
      const updated = await updateWebsiteLeadNotificationRecipient(
        apiBaseUrl,
        accessToken,
        recipient.id,
        { isActive: !recipient.isActive },
      );

      setRecipients((current) => current.map((entry) => (entry.id === recipient.id ? updated : entry)));
      notifications.show({
        title: 'Recipient updated',
        message: `${updated.name} is now ${updated.isActive ? 'active' : 'inactive'} for website-form alerts.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Recipient update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    }
  }

  async function handleSaveSite() {
    setIsSavingSite(true);
    try {
      const payload = {
        siteId: siteDraft.siteId,
        siteName: siteDraft.siteName,
        url: siteDraft.url,
        brandTag: siteDraft.brandTag,
        formType: siteDraft.formType,
        ...(siteDraft.notes.trim() ? { notes: siteDraft.notes.trim() } : {}),
        formConfig: toSiteFormConfigPayload(siteDraft),
      };

      const saved = editingSiteId
        ? await updateWebsiteLeadSite(apiBaseUrl, accessToken, editingSiteId, payload)
        : await createWebsiteLeadSite(apiBaseUrl, accessToken, payload);

      setSites((current) => {
        if (editingSiteId) {
          return current
            .map((entry) => (
              entry.id === editingSiteId
                ? {
                    ...entry,
                    ...saved,
                    submissionsLast30Days: entry.submissionsLast30Days,
                    linkedLeadsTotal: entry.linkedLeadsTotal,
                    activePipelineLeads: entry.activePipelineLeads,
                    convertedLeads: entry.convertedLeads,
                    conversionRate: entry.conversionRate,
                    ...(entry.recentSubmissionAt ? { recentSubmissionAt: entry.recentSubmissionAt } : {}),
                  }
                : entry
            ))
            .sort((left, right) => left.siteName.localeCompare(right.siteName));
        }

        return [...current, saved].sort((left, right) => left.siteName.localeCompare(right.siteName));
      });
      setSiteDraft(initialSiteDraft);
      setEditingSiteId(null);
      setSiteModalOpen(false);
      notifications.show({
        title: editingSiteId ? 'Website updated' : 'Website added',
        message: `${saved.siteName} is now configured for Pulse-native capture.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: editingSiteId ? 'Website update failed' : 'Website creation failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingSite(false);
    }
  }

  async function handleCreateRecipient() {
    setIsSavingRecipient(true);
    try {
      const payload = {
        ...(recipientDraft.websiteLeadSiteId ? { websiteLeadSiteId: recipientDraft.websiteLeadSiteId } : {}),
        name: recipientDraft.name,
        email: recipientDraft.email,
        ...(recipientDraft.roleTitle.trim() ? { roleTitle: recipientDraft.roleTitle.trim() } : {}),
      };
      const created = await createWebsiteLeadNotificationRecipient(apiBaseUrl, accessToken, payload);

      setRecipients((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
      setRecipientDraft(initialRecipientDraft);
      setRecipientModalOpen(false);
      notifications.show({
        title: 'Recipient added',
        message: `${created.name} will now receive website-form alerts.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Recipient creation failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingRecipient(false);
    }
  }

  async function handleSaveFlowPolicy() {
    setIsSavingPolicy(true);
    try {
      const updated = await updateLeadRoutingPolicy(apiBaseUrl, accessToken, {
        routingBasis: flowPolicyDraft.routingBasis,
        strategicGrowthMax: flowPolicyDraft.strategicGrowthMax,
        initialContactSlaHours: flowPolicyDraft.initialContactSlaHours,
        initialContactUrgentWindowHours: flowPolicyDraft.initialContactUrgentWindowHours,
        initialContactManagerEscalationDelayHours: flowPolicyDraft.initialContactManagerEscalationDelayHours,
        initialContactLeadershipEscalationDelayHours: flowPolicyDraft.initialContactLeadershipEscalationDelayHours,
        discoverySchedulingSlaHours: flowPolicyDraft.discoverySchedulingSlaHours,
        discoverySchedulingManagerEscalationDelayHours: flowPolicyDraft.discoverySchedulingManagerEscalationDelayHours,
        cisFollowUpBusinessDays: flowPolicyDraft.cisFollowUpBusinessDays,
        cisFollowUpProspectReminderDelayBusinessDays: flowPolicyDraft.cisFollowUpProspectReminderDelayBusinessDays,
        cisFollowUpOwnerAlertDelayBusinessDays: flowPolicyDraft.cisFollowUpOwnerAlertDelayBusinessDays,
        stagnantStageDays: flowPolicyDraft.stagnantStageDays,
        ...(flowPolicyDraft.notes.trim() ? { notes: flowPolicyDraft.notes.trim() } : {}),
      });

      setRoutingPolicy(updated);
      setFlowPolicyDraft({
        routingBasis: updated.routingBasis,
        strategicGrowthMax: updated.strategicGrowthMax,
        initialContactSlaHours: updated.initialContactSlaHours,
        initialContactUrgentWindowHours: updated.initialContactUrgentWindowHours,
        initialContactManagerEscalationDelayHours: updated.initialContactManagerEscalationDelayHours,
        initialContactLeadershipEscalationDelayHours: updated.initialContactLeadershipEscalationDelayHours,
        discoverySchedulingSlaHours: updated.discoverySchedulingSlaHours,
        discoverySchedulingManagerEscalationDelayHours: updated.discoverySchedulingManagerEscalationDelayHours,
        cisFollowUpBusinessDays: updated.cisFollowUpBusinessDays,
        cisFollowUpProspectReminderDelayBusinessDays: updated.cisFollowUpProspectReminderDelayBusinessDays,
        cisFollowUpOwnerAlertDelayBusinessDays: updated.cisFollowUpOwnerAlertDelayBusinessDays,
        stagnantStageDays: updated.stagnantStageDays,
        notes: updated.notes ?? '',
      });
      notifications.show({
        title: 'Flow policy updated',
        message: 'Routing and SLA thresholds are now saved in Pulse CRM.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Flow policy update failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
      });
    } finally {
      setIsSavingPolicy(false);
    }
  }

  return (
    <Stack gap="md">
      <Paper withBorder radius="md" p="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={1}>Pulse Website Lead Forms</Title>
            <Text size="sm" c="dimmed">
              Manage homeowner and contractor forms embedded across 16 branded websites. Each submission posts directly into
              Pulse CRM with site, brand, and lead-type tagging.
            </Text>
            <Group gap="xs">
              <Badge color="blue" variant="light">HubSpot Replaced</Badge>
              <Badge color="cyan" variant="light">{activeSites} Active Sites</Badge>
              <Badge color="grape" variant="light">{activeRecipientCount} Active Alert Recipients</Badge>
            </Group>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreateSiteModal}>
            Add Website
          </Button>
        </Group>
      </Paper>

      <Alert color="blue" variant="light">
        Pulse CRM is the lead-capture engine behind the branded-site forms. SolaceAir-style homeowner and contractor forms are
        rendered on each site, then submitted straight into the residential lead workflow without a third-party handoff.
      </Alert>

      {errorMessage ? (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {errorMessage}
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <MetricCard
          label="Active Sites"
          value={String(activeSites)}
          helper={`of ${sites.length} configured`}
          icon={<IconWorld size={20} />}
        />
        <MetricCard
          label="Leads This Month"
          value={String(totalLeadsThisMonth)}
          helper="Directly posted into Pulse CRM"
          icon={<IconCheck size={20} />}
          accent="blue"
        />
        <MetricCard
          label="All-Time Leads"
          value={String(totalLinkedLeads)}
          helper="Across all branded websites"
          icon={<IconUsers size={20} />}
        />
        <MetricCard
          label="Repeat Submissions"
          value={String(duplicateCount)}
          helper={`${duplicateLinkedLeadCount} active leads reused`}
          icon={<IconRepeat size={20} />}
          accent={duplicateCount > 0 ? 'orange' : 'green'}
        />
      </SimpleGrid>

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as WebsiteFormsTab) ?? 'sites')}>
        <Tabs.List>
          <Tabs.Tab value="sites" leftSection={<IconWorld size={16} />}>Websites ({sites.length})</Tabs.Tab>
          <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />}>Notifications</Tabs.Tab>
          <Tabs.Tab value="flow" leftSection={<IconArrowRight size={16} />}>Submission Flow</Tabs.Tab>
          <Tabs.Tab value="duplicates" leftSection={<IconHistory size={16} />}>Repeat Submissions ({duplicateSubmissionTotal})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="sites" pt="md">
          <Paper withBorder radius="md" p="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Website</Table.Th>
                  <Table.Th>Brand</Table.Th>
                  <Table.Th>Form Type</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Leads (Month)</Table.Th>
                  <Table.Th>Leads (Total)</Table.Th>
                  <Table.Th>Conv. Rate</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sites.map((site) => (
                  <Table.Tr key={site.id}>
                    <Table.Td>
                      <Text fw={500} size="sm">{site.siteName}</Text>
                      <Text size="xs" c="dimmed">{site.url}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{site.brandTag}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline" size="sm" color={site.formType === 'both' ? 'blue' : site.formType === 'contractor' ? 'teal' : 'grape'}>
                        {getFormTypeLabel(site.formType)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        checked={site.isActive}
                        onChange={() => void handleToggleSite(site)}
                        size="sm"
                        color="green"
                      />
                    </Table.Td>
                    <Table.Td fw={600}>{site.submissionsLast30Days}</Table.Td>
                    <Table.Td>{site.linkedLeadsTotal}</Table.Td>
                    <Table.Td>
                      <Badge color={site.conversionRate > 25 ? 'green' : site.conversionRate > 15 ? 'blue' : 'orange'} variant="light">
                        {site.conversionRate}%
                      </Badge>
                    </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Edit website form configuration">
                            <ActionIcon variant="subtle" color="grape" onClick={() => openEditSiteModal(site)}>
                              <IconPencil size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Preview form">
                            <ActionIcon variant="subtle" color="blue" onClick={() => openPreview(site)}>
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        <Tooltip label="Get embed code">
                          <ActionIcon variant="subtle" color="teal" onClick={() => setEmbedSite(site)}>
                            <IconCode size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="notifications" pt="md">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Stack gap={2}>
                  <Title order={4}>Lead Notification Recipients</Title>
                  <Text size="sm" c="dimmed">
                    These recipients get an immediate email when any branded website form submits into Pulse CRM. Legacy
                    HubSpot notification emails are retired, but the operational alert flow remains the same.
                  </Text>
                </Stack>
                <Button variant="outline" leftSection={<IconPlus size={16} />} onClick={() => setRecipientModalOpen(true)}>
                  Add Recipient
                </Button>
              </Group>

              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Role</Table.Th>
                    <Table.Th>Scope</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recipients.map((recipient) => {
                    const scopedSite = sites.find((site) => site.id === recipient.websiteLeadSiteId);
                    return (
                      <Table.Tr key={recipient.id}>
                        <Table.Td fw={500}>{recipient.name}</Table.Td>
                        <Table.Td>{recipient.email}</Table.Td>
                        <Table.Td>{recipient.roleTitle ?? 'Operational recipient'}</Table.Td>
                        <Table.Td>{scopedSite ? scopedSite.siteName : 'All branded sites'}</Table.Td>
                        <Table.Td>
                          <Switch
                            checked={recipient.isActive}
                            onChange={() => void handleToggleRecipient(recipient)}
                            size="sm"
                            color="green"
                          />
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="flow" pt="md">
          <Paper withBorder radius="md" p="lg">
            <Title order={4} mb="md">Pulse Website Submission Flow</Title>
            <Timeline active={4} bulletSize={28} lineWidth={2}>
              <Timeline.Item bullet={<IconBrowser size={16} />} title="1. Branded website form renders">
                <Text c="dimmed" size="sm">
                  A homeowner or contractor fills out the Pulse-powered form embedded on a branded site. Sites can run
                  homeowner-only, contractor-only, or dual-mode templates.
                </Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconArrowRight size={16} />} title="2. Pulse CRM ingests the submission">
                <Text c="dimmed" size="sm">
                  The form posts directly to <Code>POST /api/v1/public/leads/capture</Code> with site, brand, and lead-type
                  metadata. No HubSpot or third-party relay is required.
                </Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconUsers size={16} />} title="3. Residential lead record is created or linked">
                <Text c="dimmed" size="sm">
                  Pulse normalizes the payload, tags the source website, and now records each submission separately so repeat
                  submissions can attach to an existing in-flight lead instead of silently duplicating data.
                </Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconMail size={16} />} title="4. Operational notifications fire">
                <Text c="dimmed" size="sm">
                  The configured intake recipients receive immediate operational alerts with site, contact, and inquiry details
                  so follow-up starts without leaving Pulse CRM.
                </Text>
              </Timeline.Item>
              <Timeline.Item bullet={<IconCheck size={16} />} title="5. SLA and workflow tracking begin">
                <Text c="dimmed" size="sm">
                  The lead enters the same governed workspace used for discovery, CIS, onboarding readiness, finance review, and
                  first-order activation.
                </Text>
              </Timeline.Item>
            </Timeline>

            {routingPolicy ? (
              <Alert mt="lg" color="blue" variant="light">
                Current routing rule: {formatRoutingBasis(routingPolicy.routingBasis)} with Strategic Growth through{' '}
                {routingPolicy.strategicGrowthMax} and National TM from {routingPolicy.nationalTmMin}. Initial contact is due
                within {routingPolicy.initialContactSlaHours} hours, discovery should be scheduled within{' '}
                {routingPolicy.discoverySchedulingSlaHours} hours of first contact, and CIS follow-up becomes active after{' '}
                {routingPolicy.cisFollowUpBusinessDays} business days.
              </Alert>
            ) : null}

            <Paper withBorder radius="md" p="lg" mt="lg">
              <Group justify="space-between" align="flex-start" mb="md">
                <Stack gap={2}>
                  <Title order={5}>Routing & SLA policy</Title>
                  <Text size="sm" c="dimmed">
                    These settings back the live workflow queue, website intake routing, and lead-readiness timing rules.
                  </Text>
                </Stack>
                <Button onClick={() => void handleSaveFlowPolicy()} loading={isSavingPolicy} disabled={!canManageReference}>
                  Save Policy
                </Button>
              </Group>

              {!canManageReference ? (
                <Alert color="gray" variant="light" mb="md">
                  Your current role can review this policy, but only admins can change it.
                </Alert>
              ) : null}

              <Stack gap="lg">
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <Select
                    label="Routing basis"
                    data={[
                      { value: 'service_tech_count', label: 'Service Tech Count' },
                      { value: 'truck_count', label: 'Truck Count' },
                    ]}
                    value={flowPolicyDraft.routingBasis}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      routingBasis: (value as LeadRoutingBasisKey | null) ?? current.routingBasis,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Strategic Growth max"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.strategicGrowthMax}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      strategicGrowthMax: typeof value === 'number' ? value : current.strategicGrowthMax,
                    }))}
                    disabled={!canManageReference}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 3 }}>
                  <NumberInput
                    label="Initial contact SLA (hours)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.initialContactSlaHours}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      initialContactSlaHours: typeof value === 'number' ? value : current.initialContactSlaHours,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Urgent window (hours)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.initialContactUrgentWindowHours}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      initialContactUrgentWindowHours: typeof value === 'number' ? value : current.initialContactUrgentWindowHours,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Stagnant stage threshold (days)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.stagnantStageDays}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      stagnantStageDays: typeof value === 'number' ? value : current.stagnantStageDays,
                    }))}
                    disabled={!canManageReference}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <NumberInput
                    label="Manager alert after breach (hours)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.initialContactManagerEscalationDelayHours}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      initialContactManagerEscalationDelayHours:
                        typeof value === 'number' ? value : current.initialContactManagerEscalationDelayHours,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Leadership alert after breach (hours)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.initialContactLeadershipEscalationDelayHours}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      initialContactLeadershipEscalationDelayHours:
                        typeof value === 'number' ? value : current.initialContactLeadershipEscalationDelayHours,
                    }))}
                    disabled={!canManageReference}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <NumberInput
                    label="Discovery scheduling SLA (hours)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.discoverySchedulingSlaHours}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      discoverySchedulingSlaHours:
                        typeof value === 'number' ? value : current.discoverySchedulingSlaHours,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Discovery escalation delay (hours)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.discoverySchedulingManagerEscalationDelayHours}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      discoverySchedulingManagerEscalationDelayHours:
                        typeof value === 'number' ? value : current.discoverySchedulingManagerEscalationDelayHours,
                    }))}
                    disabled={!canManageReference}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 3 }}>
                  <NumberInput
                    label="CIS follow-up SLA (business days)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.cisFollowUpBusinessDays}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      cisFollowUpBusinessDays: typeof value === 'number' ? value : current.cisFollowUpBusinessDays,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Prospect reminder delay (business days)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.cisFollowUpProspectReminderDelayBusinessDays}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      cisFollowUpProspectReminderDelayBusinessDays:
                        typeof value === 'number' ? value : current.cisFollowUpProspectReminderDelayBusinessDays,
                    }))}
                    disabled={!canManageReference}
                  />
                  <NumberInput
                    label="Owner alert delay (business days)"
                    min={1}
                    allowDecimal={false}
                    value={flowPolicyDraft.cisFollowUpOwnerAlertDelayBusinessDays}
                    onChange={(value) => setFlowPolicyDraft((current) => ({
                      ...current,
                      cisFollowUpOwnerAlertDelayBusinessDays:
                        typeof value === 'number' ? value : current.cisFollowUpOwnerAlertDelayBusinessDays,
                    }))}
                    disabled={!canManageReference}
                  />
                </SimpleGrid>

                <Textarea
                  label="Policy notes"
                  value={flowPolicyDraft.notes}
                  onChange={(event) => setFlowPolicyDraft((current) => ({
                    ...current,
                    notes: event.currentTarget.value,
                  }))}
                  disabled={!canManageReference}
                  minRows={2}
                />
              </Stack>
            </Paper>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="duplicates" pt="md">
          <Paper withBorder radius="md" p="lg">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start">
                <Stack gap={2}>
                  <Title order={4}>Repeat submission review</Title>
                  <Text size="sm" c="dimmed">
                    Pulse auto-attaches repeat website submissions to an active in-flight lead instead of creating a duplicate.
                    Ops can review those events here and jump straight into the linked lead record.
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Badge color="orange" variant="light">{duplicateCount} repeat submissions</Badge>
                  <Badge color="blue" variant="light">{duplicateLinkedLeadCount} linked leads reused</Badge>
                  <Badge color={duplicateSummary?.pendingReviewCount ? 'grape' : 'gray'} variant="light">
                    {duplicateSummary?.pendingReviewCount ?? 0} pending review
                  </Badge>
                  <Badge color="teal" variant="light">
                    {duplicateSummary?.resolvedCount ?? 0} resolved
                  </Badge>
                </Group>
              </Group>

              {isLoading ? (
                <Alert color="blue" variant="light">Loading repeat-submission activity from the live Pulse backend.</Alert>
              ) : null}

              {!isLoading && duplicateSubmissions.length === 0 ? (
                <Alert color="green" variant="light">
                  No repeat submissions need review right now. New website form submissions are still landing directly in Pulse CRM.
                </Alert>
              ) : null}

              {duplicateSubmissions.length > 0 ? (
                <Table striped highlightOnHover>
                  <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Received</Table.Th>
                        <Table.Th>Website</Table.Th>
                        <Table.Th>Prospect</Table.Th>
                        <Table.Th>Attached Lead</Table.Th>
                        <Table.Th>Review</Table.Th>
                        <Table.Th>Workflow State</Table.Th>
                        <Table.Th>Signal</Table.Th>
                        <Table.Th>Actions</Table.Th>
                      </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {duplicateSubmissions.map((submission) => (
                      <Table.Tr key={submission.id}>
                        <Table.Td>
                          <Text size="sm" fw={500}>{formatDateTime(submission.createdAt)}</Text>
                          <Text size="xs" c="dimmed">{formatLeadTypeLabel(submission.leadType)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{submission.siteName ?? 'Unknown site'}</Text>
                          <Text size="xs" c="dimmed">{submission.brandTag ?? 'No brand tag'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{submission.contactDisplayName}</Text>
                          <Text size="xs" c="dimmed">
                            {[submission.companyName, submission.email, submission.phone].filter(Boolean).join(' • ') || 'No contact detail'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{submission.linkedLeadCompanyName ?? 'Lead linked'}</Text>
                          <Text size="xs" c="dimmed">{submission.linkedLeadId ?? 'Lead id unavailable'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={formatSubmissionReviewColor(submission.reviewStatus)} variant="light">
                            {formatSubmissionReviewLabel(submission.reviewStatus)}
                          </Badge>
                          {submission.reviewedByDisplayName ? (
                            <Text size="xs" c="dimmed" mt={4}>
                              {submission.reviewedByDisplayName}
                            </Text>
                          ) : null}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {submission.linkedLeadStage ? (
                              <Badge color={STAGE_META[submission.linkedLeadStage].color} variant="light">
                                {STAGE_META[submission.linkedLeadStage].label}
                              </Badge>
                            ) : null}
                            {submission.linkedLeadLifecycleStatus ? (
                              <Badge color={formatLifecycleStatusColor(submission.linkedLeadLifecycleStatus)} variant="outline">
                                {formatLifecycleStatusLabel(submission.linkedLeadLifecycleStatus)}
                              </Badge>
                            ) : null}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{buildSubmissionSignal(submission)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Review submission details">
                              <ActionIcon variant="subtle" color="blue" onClick={() => setSelectedSubmission(submission)}>
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                            {submission.linkedLeadId ? (
                              <Button component={Link} href={`/leads/${submission.linkedLeadId}`} variant="subtle" size="compact-sm">
                                Open Lead
                              </Button>
                            ) : null}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              ) : null}
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={embedSite !== null}
        onClose={() => setEmbedSite(null)}
        title={embedSite ? `Embed Code - ${embedSite.siteName}` : ''}
        size="lg"
      >
        {embedSite ? (
          <Stack gap="md">
            <Alert color="blue" variant="light">
              Copy this snippet into the branded contact page for <strong>{embedSite.siteName}</strong>. The form will render from
              Pulse CRM and post directly into the live lead-capture endpoint.
            </Alert>
            <Code block style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {generateEmbedCode(embedSite, publicWebBaseUrl)}
            </Code>
            <CopyButton value={generateEmbedCode(embedSite, publicWebBaseUrl)}>
              {({ copied, copy }) => (
                <Button
                  color={copied ? 'green' : 'blue'}
                  onClick={copy}
                  leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                >
                  {copied ? 'Copied!' : 'Copy Embed Code'}
                </Button>
              )}
            </CopyButton>
            <Button component={Link} href={`/forms/lead/${embedSite.siteId}`} target="_blank" variant="outline">
              Open Hosted Form
            </Button>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={previewSite !== null}
        onClose={() => setPreviewSite(null)}
        title={previewSite ? `Form Preview - ${previewSite.siteName}` : ''}
        size="xl"
      >
        {previewSite ? (
          <Grid>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Card withBorder p="lg" radius="md">
                <PublicWebsiteLeadCaptureForm
                  siteId={previewSite.siteId}
                  siteOverride={toPublicWebsiteLeadSite(previewSite)}
                  mode="preview"
                  embedded
                  initialLeadType={previewSite.formType === 'contractor' ? 'contractor' : 'homeowner'}
                />
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Paper p="md" bg="gray.0" radius="md">
                <Stack gap="sm">
                  <Title order={5}>Pulse CRM Intake Outcome</Title>
                  <Text size="xs" c="dimmed">1. Source tagged as &quot;{previewSite.siteName}&quot;</Text>
                  <Text size="xs" c="dimmed">2. Brand tagged as &quot;{previewSite.brandTag}&quot;</Text>
                  <Text size="xs" c="dimmed">3. {formatPreviewLeadTypeCopy(previewSite.formType)}</Text>
                  <Text size="xs" c="dimmed">4. Website submission record is preserved for audit and analytics</Text>
                  <Text size="xs" c="dimmed">5. Residential lead is created or linked inside the main pipeline</Text>
                  <Text size="xs" c="dimmed">6. Team notifications fire for follow-up</Text>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        ) : null}
      </Modal>

      <Modal
        opened={selectedSubmission !== null}
        onClose={() => setSelectedSubmission(null)}
        title={selectedSubmission ? `Repeat Submission - ${selectedSubmission.contactDisplayName}` : ''}
        size="lg"
      >
        {selectedSubmission ? (
          <Stack gap="md">
            <Alert color={selectedSubmission.reviewStatus === 'pending_review' ? 'orange' : 'teal'} variant="light">
              {selectedSubmission.reviewStatus === 'pending_review'
                ? 'This website submission was attached to an existing active lead instead of creating a duplicate record. Review it here before ops moves on.'
                : 'This repeat submission has already been reviewed and the saved decision is shown below.'}
            </Alert>
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <SubmissionDetail label="Submitted" value={formatDateTime(selectedSubmission.createdAt)} />
              <SubmissionDetail label="Website" value={selectedSubmission.siteName ?? 'Unknown site'} />
              <SubmissionDetail label="Brand Tag" value={selectedSubmission.brandTag ?? 'Not tagged'} />
              <SubmissionDetail label="Lead Type" value={formatLeadTypeLabel(selectedSubmission.leadType)} />
              <SubmissionDetail label="Review Status" value={formatSubmissionReviewLabel(selectedSubmission.reviewStatus)} />
              <SubmissionDetail label="Prospect" value={selectedSubmission.contactDisplayName} />
              <SubmissionDetail label="Company" value={selectedSubmission.companyName ?? 'Not provided'} />
              <SubmissionDetail label="Email" value={selectedSubmission.email ?? 'Not provided'} />
              <SubmissionDetail label="Phone" value={selectedSubmission.phone ?? 'Not provided'} />
              <SubmissionDetail label="State" value={selectedSubmission.state ?? 'Not provided'} />
              <SubmissionDetail label="Service Tech Count" value={formatOptionalNumber(selectedSubmission.serviceTechCount)} />
              <SubmissionDetail label="Inquiry Topic" value={selectedSubmission.inquiryTopic ?? 'Not provided'} />
              <SubmissionDetail label="Referral Source" value={selectedSubmission.referralSource ?? 'Not provided'} />
            </SimpleGrid>
            {selectedSubmission.reviewedByDisplayName ? (
              <Paper withBorder radius="md" p="md">
                <Stack gap={4}>
                  <Text size="sm" fw={600}>Review decision</Text>
                  <Text size="sm">
                    {selectedSubmission.reviewedByDisplayName}
                    {selectedSubmission.reviewedAt ? ` · ${formatDateTime(selectedSubmission.reviewedAt)}` : ''}
                  </Text>
                  {selectedSubmission.reviewNote ? (
                    <Text size="sm" c="dimmed">
                      {selectedSubmission.reviewNote}
                    </Text>
                  ) : null}
                </Stack>
              </Paper>
            ) : null}
            <Paper withBorder radius="md" p="md">
              <Stack gap={4}>
                <Text size="sm" fw={600}>Attached lead</Text>
                <Text size="sm">{selectedSubmission.linkedLeadCompanyName ?? 'Linked lead'}</Text>
                <Group gap="xs">
                  {selectedSubmission.linkedLeadStage ? (
                    <Badge color={STAGE_META[selectedSubmission.linkedLeadStage].color} variant="light">
                      {STAGE_META[selectedSubmission.linkedLeadStage].label}
                    </Badge>
                  ) : null}
                  {selectedSubmission.linkedLeadLifecycleStatus ? (
                    <Badge color={formatLifecycleStatusColor(selectedSubmission.linkedLeadLifecycleStatus)} variant="outline">
                      {formatLifecycleStatusLabel(selectedSubmission.linkedLeadLifecycleStatus)}
                    </Badge>
                  ) : null}
                </Group>
                {selectedSubmission.linkedLeadId ? (
                  <Button component={Link} href={`/leads/${selectedSubmission.linkedLeadId}`} variant="light" mt="xs">
                    Open Linked Lead
                  </Button>
                ) : null}
              </Stack>
            </Paper>
            {selectedSubmission.reviewStatus === 'pending_review' ? (
              <Stack gap="md">
                <Paper withBorder radius="md" p="md">
                  <Stack gap="sm">
                    <Text size="sm" fw={600}>Relink to another active lead</Text>
                    <Text size="sm" c="dimmed">
                      Use this when ops knows the repeat submission belongs under a different in-flight lead instead of the one Pulse matched first.
                    </Text>
                    <Select
                      label="Target active lead"
                      placeholder={isLoadingRelinkCandidates ? 'Loading active lead candidates…' : 'Select another active lead'}
                      data={relinkCandidates.map((lead) => ({
                        value: lead.id,
                        label: `${lead.companyName} · ${lead.contactDisplayName} · ${STAGE_META[lead.stage].label}`,
                      }))}
                      value={relinkTargetLeadId}
                      onChange={setRelinkTargetLeadId}
                      searchable
                      nothingFoundMessage="No alternate active leads found for this submission"
                      disabled={isLoadingRelinkCandidates || relinkCandidates.length === 0}
                    />
                  </Stack>
                </Paper>
                <Group justify="flex-end">
                  <Button
                    variant="default"
                    loading={resolvingSubmissionKey === `${selectedSubmission.id}:confirm_existing`}
                    onClick={() => {
                      void handleResolveSubmission('confirm_existing');
                    }}
                  >
                    Confirm Existing Lead
                  </Button>
                  <Button
                    variant="light"
                    loading={resolvingSubmissionKey === `${selectedSubmission.id}:relink_existing`}
                    disabled={relinkCandidates.length === 0 || !relinkTargetLeadId}
                    onClick={() => {
                      void handleResolveSubmission('relink_existing');
                    }}
                  >
                    Relink To Selected Lead
                  </Button>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    loading={resolvingSubmissionKey === `${selectedSubmission.id}:create_new_lead`}
                    onClick={() => {
                      void handleResolveSubmission('create_new_lead');
                    }}
                  >
                    Create New Lead From Submission
                  </Button>
                </Group>
              </Stack>
            ) : null}
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={siteModalOpen}
        onClose={() => {
          setSiteModalOpen(false);
          setEditingSiteId(null);
          setSiteDraft(initialSiteDraft);
        }}
        title={editingSiteId ? 'Edit Website Form' : 'Add Website'}
        size="xl"
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Site ID"
              value={siteDraft.siteId}
              onChange={(event) => setSiteDraft((current) => ({ ...current, siteId: event.currentTarget.value }))}
              placeholder="solace-air"
              disabled={editingSiteId !== null}
            />
            <TextInput
              label="Site Name"
              value={siteDraft.siteName}
              onChange={(event) => setSiteDraft((current) => ({ ...current, siteName: event.currentTarget.value }))}
              placeholder="SolaceAir.com"
            />
          </Group>
          <TextInput
            label="Website URL"
            value={siteDraft.url}
            onChange={(event) => setSiteDraft((current) => ({ ...current, url: event.currentTarget.value }))}
            placeholder="https://example.com/contact-us"
          />
          <Group grow>
            <TextInput
              label="Brand Tag"
              value={siteDraft.brandTag}
              onChange={(event) => setSiteDraft((current) => ({ ...current, brandTag: event.currentTarget.value.toUpperCase() }))}
              placeholder="SLA"
            />
            <Select
              label="Form Type"
              value={siteDraft.formType}
              onChange={(value) => setSiteDraft((current) => ({ ...current, formType: (value as WebsiteLeadFormTypeKey | null) ?? 'both' }))}
              data={[
                { value: 'homeowner', label: 'Homeowner Only' },
                { value: 'contractor', label: 'Contractor Only' },
                { value: 'both', label: 'Homeowner + Contractor' },
              ]}
            />
          </Group>
          <TextInput
            label="Headline"
            value={siteDraft.headline}
            onChange={(event) => setSiteDraft((current) => ({ ...current, headline: event.currentTarget.value }))}
            placeholder="Contact an IAQ Professional"
          />
          <Textarea
            label="Subheadline"
            value={siteDraft.subheadline}
            onChange={(event) => setSiteDraft((current) => ({ ...current, subheadline: event.currentTarget.value }))}
            minRows={2}
            placeholder="Protect your Indoor Space"
          />
          <Group grow>
            <TextInput
              label="Submit button label"
              value={siteDraft.submitButtonLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, submitButtonLabel: event.currentTarget.value }))}
              placeholder="Submit"
            />
            <TextInput
              label="Success title"
              value={siteDraft.successTitle}
              onChange={(event) => setSiteDraft((current) => ({ ...current, successTitle: event.currentTarget.value }))}
              placeholder="Thanks, we’ve received your request."
            />
          </Group>
          <Textarea
            label="Success message"
            value={siteDraft.successMessage}
            onChange={(event) => setSiteDraft((current) => ({ ...current, successMessage: event.currentTarget.value }))}
            minRows={2}
          />
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Homeowner inquiry label"
              value={siteDraft.homeownerInquiryLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, homeownerInquiryLabel: event.currentTarget.value }))}
            />
            <Textarea
              label="Homeowner inquiry options"
              description="One option per line"
              value={siteDraft.homeownerInquiryOptions}
              onChange={(event) => setSiteDraft((current) => ({ ...current, homeownerInquiryOptions: event.currentTarget.value }))}
              minRows={4}
            />
            <TextInput
              label="Contractor inquiry label"
              value={siteDraft.contractorInquiryLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, contractorInquiryLabel: event.currentTarget.value }))}
            />
            <Textarea
              label="Contractor inquiry options"
              description="One option per line"
              value={siteDraft.contractorInquiryOptions}
              onChange={(event) => setSiteDraft((current) => ({ ...current, contractorInquiryOptions: event.currentTarget.value }))}
              minRows={4}
            />
            <TextInput
              label="Referral source label"
              value={siteDraft.referralSourceLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, referralSourceLabel: event.currentTarget.value }))}
            />
            <Textarea
              label="Referral source options"
              description="One option per line"
              value={siteDraft.referralSourceOptions}
              onChange={(event) => setSiteDraft((current) => ({ ...current, referralSourceOptions: event.currentTarget.value }))}
              minRows={4}
            />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <TextInput
              label="Message label"
              value={siteDraft.messageLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, messageLabel: event.currentTarget.value }))}
            />
            <TextInput
              label="Referral detail label"
              value={siteDraft.referralDetailLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, referralDetailLabel: event.currentTarget.value }))}
            />
            <TextInput
              label="Marketing consent label"
              value={siteDraft.marketingConsentLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, marketingConsentLabel: event.currentTarget.value }))}
            />
            <TextInput
              label="Customer status label"
              value={siteDraft.customerStatusLabel}
              onChange={(event) => setSiteDraft((current) => ({ ...current, customerStatusLabel: event.currentTarget.value }))}
            />
          </SimpleGrid>
          <Textarea
            label="Notes"
            value={siteDraft.notes}
            onChange={(event) => setSiteDraft((current) => ({ ...current, notes: event.currentTarget.value }))}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setSiteModalOpen(false);
                setEditingSiteId(null);
                setSiteDraft(initialSiteDraft);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveSite()} loading={isSavingSite}>
              {editingSiteId ? 'Save Website' : 'Create Website'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={recipientModalOpen} onClose={() => setRecipientModalOpen(false)} title="Add Recipient" size="md">
        <Stack gap="md">
          <Select
            label="Scope"
            value={recipientDraft.websiteLeadSiteId}
            onChange={(value) => setRecipientDraft((current) => ({ ...current, websiteLeadSiteId: value ?? '' }))}
            data={[
              { value: '', label: 'All branded sites' },
              ...sites.map((site) => ({ value: site.id, label: site.siteName })),
            ]}
          />
          <TextInput
            label="Name"
            value={recipientDraft.name}
            onChange={(event) => setRecipientDraft((current) => ({ ...current, name: event.currentTarget.value }))}
          />
          <TextInput
            label="Email"
            value={recipientDraft.email}
            onChange={(event) => setRecipientDraft((current) => ({ ...current, email: event.currentTarget.value }))}
          />
          <TextInput
            label="Role"
            value={recipientDraft.roleTitle}
            onChange={(event) => setRecipientDraft((current) => ({ ...current, roleTitle: event.currentTarget.value }))}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRecipientModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateRecipient()} loading={isSavingRecipient}>Add Recipient</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function toPublicWebsiteLeadSite(site: WebsiteLeadSiteSummary) {
  return {
    id: site.id,
    siteId: site.siteId,
    siteName: site.siteName,
    url: site.url,
    brandTag: site.brandTag,
    formType: site.formType,
    formConfig: site.formConfig,
  };
}

function formatPreviewLeadTypeCopy(formType: WebsiteLeadFormTypeKey) {
  if (formType === 'both') {
    return 'Lead type is stored from the homeowner or contractor selection made in the live Pulse form.';
  }
  if (formType === 'contractor') {
    return 'Lead type is stored as "contractor" from this live contractor form.';
  }

  return 'Lead type is stored as "homeowner" from this live homeowner form.';
}

function generateEmbedCode(site: WebsiteLeadSiteSummary, publicWebBaseUrl: string) {
  const hostedFormUrl = new URL(`/forms/lead/${site.siteId}`, publicWebBaseUrl).toString();

  return `<!-- Pulse Website Form - ${site.siteName} -->
<iframe
  src="${hostedFormUrl}"
  title="Pulse Lead Capture - ${site.siteName}"
  style="width:100%;min-height:980px;border:0;border-radius:16px;"
  loading="lazy">
</iframe>`;
}

function MetricCard({
  label,
  value,
  helper,
  icon,
  accent = 'dark',
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  accent?: string;
}) {
  return (
    <Card withBorder p="lg">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text size="xl" fw={700} c={accent}>{value}</Text>
      <Text size="xs" c="dimmed">{helper}</Text>
    </Card>
  );
}

function getFormTypeLabel(formType: WebsiteLeadFormTypeKey) {
  if (formType === 'both') return 'Homeowner + Contractor';
  if (formType === 'contractor') return 'Contractor Only';
  return 'Homeowner Only';
}

function formatRoutingBasis(value: string) {
  return value === 'service_tech_count' ? 'Service tech count' : 'Truck count';
}

function formatRoutingTeam(value: string) {
  return value === 'strategic_growth' ? 'Strategic Growth' : 'National TM';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatLeadTypeLabel(value: WebsiteLeadTypeKey) {
  return value === 'contractor' ? 'Contractor' : 'Homeowner';
}

function formatSubmissionReviewLabel(value: WebsiteLeadSubmissionSummary['reviewStatus']) {
  switch (value) {
    case 'pending_review':
      return 'Pending Review';
    case 'confirmed_existing':
      return 'Confirmed Existing';
    case 'created_new_lead':
      return 'Created New Lead';
    case 'relinked_existing':
      return 'Relinked Existing';
    default:
      return 'Not Required';
  }
}

function formatSubmissionReviewColor(value: WebsiteLeadSubmissionSummary['reviewStatus']) {
  switch (value) {
    case 'pending_review':
      return 'orange';
    case 'confirmed_existing':
      return 'blue';
    case 'created_new_lead':
      return 'teal';
    case 'relinked_existing':
      return 'grape';
    default:
      return 'gray';
  }
}

function formatLifecycleStatusLabel(value: 'active' | 'parked' | 'closed') {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatLifecycleStatusColor(value: 'active' | 'parked' | 'closed') {
  if (value === 'active') return 'green';
  if (value === 'parked') return 'yellow';
  return 'gray';
}

function formatOptionalNumber(value?: number) {
  return value === undefined ? 'Not provided' : String(value);
}

function buildSubmissionSignal(submission: WebsiteLeadSubmissionSummary) {
  return [
    submission.inquiryTopic,
    submission.referralSource,
    submission.serviceTechCount !== undefined ? `${submission.serviceTechCount} service techs` : undefined,
  ].filter(Boolean).join(' • ') || 'Repeat website submission';
}

function SubmissionDetail({ label, value }: { label: string; value: string }) {
  return (
    <Paper withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
      <Text size="sm">{value}</Text>
    </Paper>
  );
}

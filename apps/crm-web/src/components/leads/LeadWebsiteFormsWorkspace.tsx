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
  IconMail,
  IconPlus,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import type {
  LeadRoutingPolicySummary,
  LeadStageKey,
  WebsiteLeadFormTypeKey,
  WebsiteLeadNotificationRecipientSummary,
  WebsiteLeadSiteSummary,
  WebsiteLeadTypeKey,
} from '@pulse/contracts';
import {
  createWebsiteLeadNotificationRecipient,
  createWebsiteLeadSite,
  fetchLeadRoutingPolicy,
  fetchWebsiteLeadNotificationRecipients,
  fetchWebsiteLeadSites,
  updateWebsiteLeadNotificationRecipient,
  updateWebsiteLeadSite,
} from '@/lib/pulse-api';
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

type WebsiteFormsTab = 'sites' | 'notifications' | 'flow';

type SiteDraft = {
  siteId: string;
  siteName: string;
  url: string;
  brandTag: string;
  formType: WebsiteLeadFormTypeKey;
  notes: string;
};

type RecipientDraft = {
  websiteLeadSiteId: string;
  name: string;
  email: string;
  roleTitle: string;
};

const initialSiteDraft: SiteDraft = {
  siteId: '',
  siteName: '',
  url: '',
  brandTag: '',
  formType: 'both',
  notes: '',
};

const initialRecipientDraft: RecipientDraft = {
  websiteLeadSiteId: '',
  name: '',
  email: '',
  roleTitle: '',
};

export function LeadWebsiteFormsWorkspace() {
  const { apiBaseUrl, auth, isHydrated } = usePulseSession();
  const [activeTab, setActiveTab] = useState<WebsiteFormsTab>('sites');
  const [sites, setSites] = useState<WebsiteLeadSiteSummary[]>([]);
  const [recipients, setRecipients] = useState<WebsiteLeadNotificationRecipientSummary[]>([]);
  const [routingPolicy, setRoutingPolicy] = useState<LeadRoutingPolicySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewSite, setPreviewSite] = useState<WebsiteLeadSiteSummary | null>(null);
  const [embedSite, setEmbedSite] = useState<WebsiteLeadSiteSummary | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(initialSiteDraft);
  const [recipientDraft, setRecipientDraft] = useState<RecipientDraft>(initialRecipientDraft);
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [recipientModalOpen, setRecipientModalOpen] = useState(false);
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [isSavingRecipient, setIsSavingRecipient] = useState(false);

  useEffect(() => {
    if (!auth) {
      setSites([]);
      setRecipients([]);
      setRoutingPolicy(null);
      return;
    }

    let cancelled = false;
    const accessToken = auth.tokens.accessToken;

    async function loadWebsiteFormsWorkspace() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [siteResponse, recipientResponse, routingPolicyResponse] = await Promise.all([
          fetchWebsiteLeadSites(apiBaseUrl, accessToken),
          fetchWebsiteLeadNotificationRecipients(apiBaseUrl, accessToken),
          fetchLeadRoutingPolicy(apiBaseUrl, accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setSites(siteResponse.items);
        setRecipients(recipientResponse.items);
        setRoutingPolicy(routingPolicyResponse);
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
  const publicWebBaseUrl = DEFAULT_WEB_BASE_URL;

  const activeRecipientCount = useMemo(
    () => recipients.filter((recipient) => recipient.isActive).length,
    [recipients],
  );

  if (!isHydrated) {
    return null;
  }

  if (!auth) {
    return null;
  }

  const accessToken = auth.tokens.accessToken;

  const openPreview = (site: WebsiteLeadSiteSummary) => {
    setPreviewSite(site);
  };

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

  async function handleCreateSite() {
    setIsSavingSite(true);
    try {
      const payload = {
        siteId: siteDraft.siteId,
        siteName: siteDraft.siteName,
        url: siteDraft.url,
        brandTag: siteDraft.brandTag,
        formType: siteDraft.formType,
        ...(siteDraft.notes.trim() ? { notes: siteDraft.notes.trim() } : {}),
      };
      const created = await createWebsiteLeadSite(apiBaseUrl, accessToken, payload);

      setSites((current) => [...current, created].sort((left, right) => left.siteName.localeCompare(right.siteName)));
      setSiteDraft(initialSiteDraft);
      setSiteModalOpen(false);
      notifications.show({
        title: 'Website added',
        message: `${created.siteName} is now configured for Pulse-native capture.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Website creation failed',
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
          <Button leftSection={<IconPlus size={16} />} onClick={() => setSiteModalOpen(true)}>
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
          label="Website Coverage"
          value={String(sites.length)}
          helper="Homeowner, contractor, or dual-mode templates"
          icon={<IconWorld size={20} />}
          accent="green"
        />
      </SimpleGrid>

      <Tabs value={activeTab} onChange={(value) => setActiveTab((value as WebsiteFormsTab) ?? 'sites')}>
        <Tabs.List>
          <Tabs.Tab value="sites" leftSection={<IconWorld size={16} />}>Websites ({sites.length})</Tabs.Tab>
          <Tabs.Tab value="notifications" leftSection={<IconBell size={16} />}>Notifications</Tabs.Tab>
          <Tabs.Tab value="flow" leftSection={<IconArrowRight size={16} />}>Submission Flow</Tabs.Tab>
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
                {routingPolicy.strategicGrowthMax} and National TM from {routingPolicy.nationalTmMin}.
              </Alert>
            ) : null}
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

      <Modal opened={siteModalOpen} onClose={() => setSiteModalOpen(false)} title="Add Website" size="lg">
        <Stack gap="md">
          <TextInput
            label="Site ID"
            value={siteDraft.siteId}
            onChange={(event) => setSiteDraft((current) => ({ ...current, siteId: event.currentTarget.value }))}
            placeholder="solace-air"
          />
          <TextInput
            label="Site Name"
            value={siteDraft.siteName}
            onChange={(event) => setSiteDraft((current) => ({ ...current, siteName: event.currentTarget.value }))}
            placeholder="SolaceAir.com"
          />
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
          <Textarea
            label="Notes"
            value={siteDraft.notes}
            onChange={(event) => setSiteDraft((current) => ({ ...current, notes: event.currentTarget.value }))}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSiteModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleCreateSite()} loading={isSavingSite}>Create Website</Button>
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

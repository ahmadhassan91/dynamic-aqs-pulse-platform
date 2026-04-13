'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  AuthRole,
  LeadContactRoleKey,
  LeadContactSummary,
  LeadConversionPreparationRecord,
  LeadDetail,
  LeadReadinessDetail,
  LeadReadinessItemSummary,
  PortalEligibilityStatusKey,
} from '@pulse/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconChecklist,
  IconCheck,
  IconRefresh,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import { canPerformAction } from '@/lib/access';
import {
  convertLeadOnFirstOrder,
  createLeadContact,
  fetchLeadContacts,
  fetchLeadConversionPreparation,
  fetchLeadReadiness,
  generateLeadReadinessChecklist,
  importLeadContactsFromCis,
  updateLeadConversionPreparation,
  updateLeadReadinessItem,
  validateLeadConversionPreparation,
} from '@/lib/pulse-api';

type LeadOnboardingReadyPanelProps = {
  apiBaseUrl: string;
  accessToken: string;
  actorRole: AuthRole;
  lead: LeadDetail;
  onLeadChanged: () => void;
};

const CONTACT_ROLE_OPTIONS: readonly { value: LeadContactRoleKey; label: string }[] = [
  { value: 'primary', label: 'Primary contact' },
  { value: 'owner_manager', label: 'Owner / GM' },
  { value: 'ordering', label: 'Ordering' },
  { value: 'accounts_payable', label: 'Accounts payable' },
  { value: 'technical', label: 'Technical' },
  { value: 'other', label: 'Other' },
] as const;

const PORTAL_ELIGIBILITY_OPTIONS: readonly { value: PortalEligibilityStatusKey; label: string }[] = [
  { value: 'unassessed', label: 'Unassessed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'ready', label: 'Ready' },
  { value: 'provisioned', label: 'Provisioned' },
] as const;

export function LeadOnboardingReadyPanel({
  apiBaseUrl,
  accessToken,
  actorRole,
  lead,
  onLeadChanged,
}: LeadOnboardingReadyPanelProps) {
  const [readiness, setReadiness] = useState<LeadReadinessDetail | null>(null);
  const [contacts, setContacts] = useState<LeadContactSummary[]>([]);
  const [preparation, setPreparation] = useState<LeadConversionPreparationRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  const [isImportingContacts, setIsImportingContacts] = useState(false);
  const [isSavingPreparation, setIsSavingPreparation] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [newContactRole, setNewContactRole] = useState<LeadContactRoleKey>('primary');
  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactTitle, setNewContactTitle] = useState('');
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const [targetAccountName, setTargetAccountName] = useState('');
  const [legalCompanyName, setLegalCompanyName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [financeAuthorityMode, setFinanceAuthorityMode] = useState('');
  const [priceClassCode, setPriceClassCode] = useState('');
  const [portalEligibilityStatus, setPortalEligibilityStatus] = useState<PortalEligibilityStatusKey>('unassessed');
  const [shippingName, setShippingName] = useState('');
  const [shippingLine1, setShippingLine1] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingLine1, setBillingLine1] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');
  const [prepNotes, setPrepNotes] = useState('');
  const [firstOrderConfirmedAt, setFirstOrderConfirmedAt] = useState(toDateTimeLocalValue(new Date().toISOString()));

  const canManageLead = canPerformAction(actorRole, 'lead.intake_manage');
  const canCreateCustomer = canPerformAction(actorRole, 'customer.create');
  const canManagePortal = canPerformAction(actorRole, 'lead.portal_setup');
  const leadLifecycleLocked = lead.lifecycleStatus !== 'active';

  useEffect(() => {
    let cancelled = false;

    async function loadPanel() {
      setIsLoading(true);
      setActionError(null);

      try {
        const [nextReadiness, nextContacts, nextPreparation] = await Promise.all([
          fetchLeadReadiness(apiBaseUrl, accessToken, lead.id),
          fetchLeadContacts(apiBaseUrl, accessToken, lead.id),
          fetchLeadConversionPreparation(apiBaseUrl, accessToken, lead.id),
        ]);

        if (!cancelled) {
          setReadiness(nextReadiness);
          setContacts(nextContacts);
          setPreparation(nextPreparation);
        }
      } catch (error) {
        if (!cancelled) {
          setActionError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPanel();

    return () => {
      cancelled = true;
    };
  }, [accessToken, apiBaseUrl, lead.id]);

  useEffect(() => {
    if (!preparation) {
      return;
    }

    setTargetAccountName(preparation.targetAccountName ?? lead.companyName);
    setLegalCompanyName(preparation.legalCompanyName ?? lead.companyName);
    setAccountType(preparation.accountType ?? '');
    setFinanceAuthorityMode(preparation.financeAuthorityMode ?? '');
    setPriceClassCode(preparation.priceClassCode ?? '');
    setPortalEligibilityStatus(preparation.portalEligibilityStatus);
    setShippingName(preparation.shippingAddressSnapshot?.name ?? '');
    setShippingLine1(preparation.shippingAddressSnapshot?.line1 ?? '');
    setShippingCity(preparation.shippingAddressSnapshot?.city ?? '');
    setShippingState(preparation.shippingAddressSnapshot?.state ?? '');
    setShippingPostalCode(preparation.shippingAddressSnapshot?.postalCode ?? '');
    setBillingName(preparation.billingAddressSnapshot?.name ?? '');
    setBillingLine1(preparation.billingAddressSnapshot?.line1 ?? '');
    setBillingCity(preparation.billingAddressSnapshot?.city ?? '');
    setBillingState(preparation.billingAddressSnapshot?.state ?? '');
    setBillingPostalCode(preparation.billingAddressSnapshot?.postalCode ?? '');
    setPrepNotes(preparation.notes ?? '');
  }, [lead.companyName, preparation]);

  const financeGateLabel = useMemo(() => {
    switch (lead.workflowTask.financeDecisionStatus) {
      case 'approved':
        return 'Finance Approved';
      case 'conditional':
        return 'Finance Conditional';
      case 'info_requested':
        return 'Finance Info Requested';
      case 'declined':
        return 'Finance Declined';
      case 'pending':
        return 'Finance Pending';
      default:
        return 'Not Submitted';
    }
  }, [lead.workflowTask.financeDecisionStatus]);

  const readinessColor = readinessStatusColor(readiness?.summary.status ?? 'not_started');

  async function reloadPanel() {
    const [nextReadiness, nextContacts, nextPreparation] = await Promise.all([
      fetchLeadReadiness(apiBaseUrl, accessToken, lead.id),
      fetchLeadContacts(apiBaseUrl, accessToken, lead.id),
      fetchLeadConversionPreparation(apiBaseUrl, accessToken, lead.id),
    ]);

    setReadiness(nextReadiness);
    setContacts(nextContacts);
    setPreparation(nextPreparation);
  }

  async function handleGenerateChecklist() {
    setIsGeneratingChecklist(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const nextReadiness = await generateLeadReadinessChecklist(apiBaseUrl, accessToken, lead.id);
      setReadiness(nextReadiness);
      await reloadPanel();
      setActionMessage('Onboarding checklist generated from the CRM readiness template.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGeneratingChecklist(false);
    }
  }

  async function handleImportContacts() {
    setIsImportingContacts(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const imported = await importLeadContactsFromCis(apiBaseUrl, accessToken, lead.id);
      setContacts(imported);
      await reloadPanel();
      setActionMessage('Lead contacts were refreshed from lead capture and CIS data.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImportingContacts(false);
    }
  }

  async function handleCreateContact() {
    setIsCreatingContact(true);
    setActionError(null);
    setActionMessage(null);

    try {
      await createLeadContact(apiBaseUrl, accessToken, lead.id, {
        role: newContactRole,
        displayName: newContactName.trim(),
        ...(newContactTitle.trim() ? { title: newContactTitle.trim() } : {}),
        ...(newContactEmail.trim() ? { email: newContactEmail.trim() } : {}),
        ...(newContactPhone.trim() ? { phone: newContactPhone.trim() } : {}),
        isPrimary: newContactRole === 'primary',
      });
      setNewContactName('');
      setNewContactTitle('');
      setNewContactEmail('');
      setNewContactPhone('');
      await reloadPanel();
      setActionMessage('Lead contact added to the conversion preparation set.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreatingContact(false);
    }
  }

  async function handleChecklistStatusChange(item: LeadReadinessItemSummary, status: LeadReadinessItemSummary['status']) {
    setActiveItemId(item.id);
    setActionError(null);
    setActionMessage(null);

    try {
      const nextReadiness = await updateLeadReadinessItem(apiBaseUrl, accessToken, lead.id, item.id, {
        status,
      });
      setReadiness(nextReadiness);
      await reloadPanel();
      setActionMessage(`${item.label} updated to ${formatChecklistStatus(status)}.`);
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveItemId(null);
    }
  }

  async function handleSavePreparation() {
    setIsSavingPreparation(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const nextPreparation = await updateLeadConversionPreparation(apiBaseUrl, accessToken, lead.id, {
        ...(targetAccountName.trim() ? { targetAccountName: targetAccountName.trim() } : {}),
        ...(legalCompanyName.trim() ? { legalCompanyName: legalCompanyName.trim() } : {}),
        ...(accountType.trim() ? { accountType: accountType.trim() } : {}),
        ...(financeAuthorityMode.trim() ? { financeAuthorityMode: financeAuthorityMode.trim() } : {}),
        ...(priceClassCode.trim() ? { priceClassCode: priceClassCode.trim() } : {}),
        portalEligibilityStatus,
        shippingAddressSnapshot: {
          ...(shippingName.trim() ? { name: shippingName.trim() } : {}),
          ...(shippingLine1.trim() ? { line1: shippingLine1.trim() } : {}),
          ...(shippingCity.trim() ? { city: shippingCity.trim() } : {}),
          ...(shippingState.trim() ? { state: shippingState.trim() } : {}),
          ...(shippingPostalCode.trim() ? { postalCode: shippingPostalCode.trim() } : {}),
          countryCode: 'US',
        },
        billingAddressSnapshot: {
          ...(billingName.trim() ? { name: billingName.trim() } : {}),
          ...(billingLine1.trim() ? { line1: billingLine1.trim() } : {}),
          ...(billingCity.trim() ? { city: billingCity.trim() } : {}),
          ...(billingState.trim() ? { state: billingState.trim() } : {}),
          ...(billingPostalCode.trim() ? { postalCode: billingPostalCode.trim() } : {}),
          countryCode: 'US',
        },
        ...(prepNotes.trim() ? { notes: prepNotes.trim() } : {}),
      });

      setPreparation(nextPreparation);
      await reloadPanel();
      setActionMessage('Conversion preparation was saved.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSavingPreparation(false);
    }
  }

  async function handleValidatePreparation() {
    setIsValidating(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const result = await validateLeadConversionPreparation(apiBaseUrl, accessToken, lead.id);
      setPreparation(result.preparation);
      await reloadPanel();
      setActionMessage(result.ready ? 'Lead is now ready for first-order conversion.' : 'Readiness was re-evaluated and blockers were refreshed.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsValidating(false);
    }
  }

  async function handleConvert() {
    setIsConverting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const result = await convertLeadOnFirstOrder(apiBaseUrl, accessToken, lead.id, {
        firstOrderConfirmedAt: fromDateTimeLocalValue(firstOrderConfirmedAt),
      });
      setActionMessage(`Lead converted into a customer account. Account ID: ${result.accountId}`);
      await reloadPanel();
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsConverting(false);
    }
  }

  if (isLoading && !readiness && !preparation) {
    return (
      <Paper withBorder radius="xl" p="lg" className="premium-drawer-card">
        <Text c="dimmed">Loading onboarding readiness…</Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="xl" p="lg" className="premium-drawer-card">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={4}>Onboarding Readiness & First-Order Boundary</Title>
            <Text size="sm" c="dimmed">
              This is the CRM-owned readiness lane between finance approval and the first-order conversion boundary.
            </Text>
          </Stack>
          <Badge color={readinessColor} variant="light" size="lg">
            {formatReadinessStatus(readiness?.summary.status ?? 'not_started')}
          </Badge>
        </Group>

        {actionError ? (
          <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
            {actionError}
          </Alert>
        ) : null}

        {leadLifecycleLocked ? (
          <Alert color="gray" variant="light" icon={<IconAlertCircle size={16} />}>
            This lead is parked or closed. Reopen it before editing readiness, conversion prep, or first-order conversion details.
          </Alert>
        ) : null}

        {actionMessage ? (
          <Alert color="teal" variant="light" icon={<IconCheck size={16} />}>
            {actionMessage}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <Card withBorder radius="xl" p="lg" className="premium-stat-card">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Finance Gate</Text>
            <Title order={3} mt="sm">{financeGateLabel}</Title>
            <Text size="sm" c="dimmed" mt="xs">
              Finance status comes from the CIS package and is treated as a readiness blocker until it is cleared.
            </Text>
          </Card>
          <Card withBorder radius="xl" p="lg" className="premium-stat-card">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Checklist</Text>
            <Title order={3} mt="sm">{formatChecklistSummaryStatus(readiness?.summary.checklistStatus ?? 'not_started')}</Title>
            <Text size="sm" c="dimmed" mt="xs">
              {readiness
                ? `${readiness.summary.completedRequiredItemCount}/${readiness.summary.requiredItemCount} required items complete`
                : 'Checklist has not been generated yet.'}
            </Text>
          </Card>
          <Card withBorder radius="xl" p="lg" className="premium-stat-card">
            <Text size="xs" tt="uppercase" fw={700} c="dimmed">Conversion Prep</Text>
            <Title order={3} mt="sm">{preparation?.conversionReady ? 'Ready' : 'In Progress'}</Title>
            <Text size="sm" c="dimmed" mt="xs">
              First-order conversion stays inside CRM until the Acumatica handoff boundary is reached.
            </Text>
          </Card>
        </SimpleGrid>

        {readiness?.blockers.length ? (
          <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
            <Stack gap={4}>
              <Text fw={600}>Current blockers</Text>
              {readiness.blockers.map((blocker) => (
                <Text key={blocker} size="sm">{blocker}</Text>
              ))}
            </Stack>
          </Alert>
        ) : null}

        <Grid>
          <Grid.Col span={{ base: 12, xl: 7 }}>
            <Card withBorder radius="xl" p="lg" className="premium-detail-card">
              <Group justify="space-between" mb="md">
                <Title order={5}>Checklist & CRM-Owned Gates</Title>
                <Group gap="xs">
                  <Button
                    variant="light"
                    leftSection={<IconChecklist size={16} />}
                    onClick={() => void handleGenerateChecklist()}
                    loading={isGeneratingChecklist}
                    disabled={!canManageLead || leadLifecycleLocked}
                  >
                    Generate Checklist
                  </Button>
                  <Button
                    variant="light"
                    leftSection={<IconRefresh size={16} />}
                    onClick={() => void handleValidatePreparation()}
                    loading={isValidating}
                    disabled={!canManageLead || leadLifecycleLocked}
                  >
                    Re-evaluate
                  </Button>
                </Group>
              </Group>

              <Stack gap="sm">
                {(readiness?.items ?? []).map((item) => (
                  <Paper key={item.id} withBorder radius="lg" p="md">
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <Stack gap={2} style={{ flex: 1 }}>
                        <Group gap="xs">
                          <Text fw={600} size="sm">{item.label}</Text>
                          {!item.required ? (
                            <Badge size="xs" variant="light" color="gray">Optional</Badge>
                          ) : null}
                          <Badge size="xs" variant="light" color={readinessItemColor(item.status)}>
                            {formatChecklistStatus(item.status)}
                          </Badge>
                        </Group>
                        {item.ownerRoleCode ? (
                          <Text size="xs" c="dimmed">Owner: {item.ownerRoleCode}</Text>
                        ) : null}
                        {item.notes ? (
                          <Text size="xs" c="dimmed">{item.notes}</Text>
                        ) : null}
                      </Stack>
                      {canManageLead ? (
                        <Group gap="xs" align="center">
                          <Button
                            size="xs"
                            variant="light"
                            color="teal"
                            onClick={() => void handleChecklistStatusChange(item, 'completed')}
                            loading={activeItemId === item.id}
                            disabled={leadLifecycleLocked}
                          >
                            Complete
                          </Button>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="gray"
                            onClick={() => void handleChecklistStatusChange(item, 'pending')}
                            loading={activeItemId === item.id}
                            disabled={leadLifecycleLocked}
                          >
                            Reset
                          </Button>
                        </Group>
                      ) : null}
                    </Group>
                  </Paper>
                ))}
                {!readiness?.items.length ? (
                  <Text size="sm" c="dimmed">Generate the readiness checklist to begin the CRM-owned onboarding lane.</Text>
                ) : null}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, xl: 5 }}>
            <Stack gap="md">
              <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                <Group justify="space-between" mb="md">
                  <Title order={5}>Lead Contacts</Title>
                  <Button
                    variant="light"
                    leftSection={<IconUsers size={16} />}
                    onClick={() => void handleImportContacts()}
                    loading={isImportingContacts}
                    disabled={!canManageLead || leadLifecycleLocked}
                  >
                    Import from Lead + CIS
                  </Button>
                </Group>

                <Stack gap="sm">
                  {contacts.map((contact) => (
                    <Paper key={contact.id} withBorder radius="lg" p="md">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={2}>
                          <Group gap="xs">
                            <Text fw={600} size="sm">{contact.displayName}</Text>
                            <Badge size="xs" color="blue" variant="light">{formatContactRole(contact.role)}</Badge>
                            {contact.isPrimary ? (
                              <Badge size="xs" color="teal" variant="light">Primary</Badge>
                            ) : null}
                          </Group>
                          {contact.title ? <Text size="xs" c="dimmed">{contact.title}</Text> : null}
                          {contact.email ? <Text size="xs" c="dimmed">{contact.email}</Text> : null}
                          {contact.phone || contact.mobilePhone ? (
                            <Text size="xs" c="dimmed">{contact.mobilePhone ?? contact.phone}</Text>
                          ) : null}
                        </Stack>
                        {contact.source ? (
                          <Badge size="xs" variant="light" color="gray">{formatContactSource(contact.source)}</Badge>
                        ) : null}
                      </Group>
                    </Paper>
                  ))}
                </Stack>

                {canManageLead ? (
                  <Stack gap="sm" mt="lg">
                    <Title order={6}>Add Manual Contact</Title>
                    <Select
                      label="Role"
                      data={[...CONTACT_ROLE_OPTIONS]}
                      value={newContactRole}
                      onChange={(value) => setNewContactRole((value as LeadContactRoleKey) ?? 'primary')}
                      disabled={leadLifecycleLocked}
                    />
                    <TextInput
                      label="Display Name"
                      value={newContactName}
                      onChange={(event) => setNewContactName(event.currentTarget.value)}
                      disabled={leadLifecycleLocked}
                    />
                    <TextInput
                      label="Title"
                      value={newContactTitle}
                      onChange={(event) => setNewContactTitle(event.currentTarget.value)}
                      disabled={leadLifecycleLocked}
                    />
                    <TextInput
                      label="Email"
                      value={newContactEmail}
                      onChange={(event) => setNewContactEmail(event.currentTarget.value)}
                      disabled={leadLifecycleLocked}
                    />
                    <TextInput
                      label="Phone"
                      value={newContactPhone}
                      onChange={(event) => setNewContactPhone(event.currentTarget.value)}
                      disabled={leadLifecycleLocked}
                    />
                    <Button
                      leftSection={<IconUserPlus size={16} />}
                      onClick={() => void handleCreateContact()}
                      loading={isCreatingContact}
                      disabled={leadLifecycleLocked || newContactName.trim().length === 0}
                    >
                      Add Contact
                    </Button>
                  </Stack>
                ) : null}
              </Card>

              <Card withBorder radius="xl" p="lg" className="premium-detail-card">
                <Group justify="space-between" mb="md">
                  <Title order={5}>First-Order Boundary</Title>
                  <Badge color={preparation?.conversionReady ? 'teal' : 'yellow'} variant="light">
                    {preparation?.conversionReady ? 'Ready' : 'Not Ready'}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="md">
                  Customer creation stays blocked until readiness is complete and the first order is confirmed.
                </Text>
                <TextInput
                  label="First Order Confirmed At"
                  type="datetime-local"
                  value={firstOrderConfirmedAt}
                  onChange={(event) => setFirstOrderConfirmedAt(event.currentTarget.value)}
                />
                <Button
                  mt="md"
                  leftSection={<IconArrowRight size={16} />}
                  onClick={() => void handleConvert()}
                  loading={isConverting}
                  disabled={!canCreateCustomer || leadLifecycleLocked || readiness?.summary.status !== 'ready'}
                >
                  Convert On First Order
                </Button>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>

        <Card withBorder radius="xl" p="lg" className="premium-detail-card">
          <Group justify="space-between" mb="md">
            <Title order={5}>Conversion Preparation</Title>
            <Group gap="xs">
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={() => void handleValidatePreparation()}
                loading={isValidating}
                disabled={!canManageLead || leadLifecycleLocked}
              >
                Validate
              </Button>
              <Button
                leftSection={<IconCheck size={16} />}
                onClick={() => void handleSavePreparation()}
                loading={isSavingPreparation}
                disabled={leadLifecycleLocked || (!canManageLead && !canManagePortal)}
              >
                Save Preparation
              </Button>
            </Group>
          </Group>

          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Stack gap="sm">
                <TextInput label="Target Account Name" value={targetAccountName} onChange={(event) => setTargetAccountName(event.currentTarget.value)} />
                <TextInput label="Legal Company Name" value={legalCompanyName} onChange={(event) => setLegalCompanyName(event.currentTarget.value)} />
                <TextInput label="Account Type" value={accountType} onChange={(event) => setAccountType(event.currentTarget.value)} />
                <TextInput label="Finance Authority Mode" value={financeAuthorityMode} onChange={(event) => setFinanceAuthorityMode(event.currentTarget.value)} />
                <TextInput label="Price Class Code" value={priceClassCode} onChange={(event) => setPriceClassCode(event.currentTarget.value)} />
                <Select
                  label="Portal Eligibility"
                  data={[...PORTAL_ELIGIBILITY_OPTIONS]}
                  value={portalEligibilityStatus}
                  onChange={(value) => setPortalEligibilityStatus((value as PortalEligibilityStatusKey) ?? 'unassessed')}
                />
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Stack gap="sm">
                <Title order={6}>Shipping / Service</Title>
                <TextInput label="Name" value={shippingName} onChange={(event) => setShippingName(event.currentTarget.value)} />
                <TextInput label="Address" value={shippingLine1} onChange={(event) => setShippingLine1(event.currentTarget.value)} />
                <TextInput label="City" value={shippingCity} onChange={(event) => setShippingCity(event.currentTarget.value)} />
                <TextInput label="State" value={shippingState} onChange={(event) => setShippingState(event.currentTarget.value)} />
                <TextInput label="Postal Code" value={shippingPostalCode} onChange={(event) => setShippingPostalCode(event.currentTarget.value)} />
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Stack gap="sm">
                <Title order={6}>Billing</Title>
                <TextInput label="Name" value={billingName} onChange={(event) => setBillingName(event.currentTarget.value)} />
                <TextInput label="Address" value={billingLine1} onChange={(event) => setBillingLine1(event.currentTarget.value)} />
                <TextInput label="City" value={billingCity} onChange={(event) => setBillingCity(event.currentTarget.value)} />
                <TextInput label="State" value={billingState} onChange={(event) => setBillingState(event.currentTarget.value)} />
                <TextInput label="Postal Code" value={billingPostalCode} onChange={(event) => setBillingPostalCode(event.currentTarget.value)} />
              </Stack>
            </Grid.Col>
          </Grid>

          <Textarea
            mt="md"
            label="Readiness Notes"
            minRows={3}
            value={prepNotes}
            onChange={(event) => setPrepNotes(event.currentTarget.value)}
          />
        </Card>
      </Stack>
    </Paper>
  );
}

function readinessStatusColor(status: LeadReadinessDetail['summary']['status']) {
  switch (status) {
    case 'ready':
    case 'converted':
      return 'teal';
    case 'blocked':
      return 'red';
    case 'in_progress':
      return 'blue';
    default:
      return 'gray';
  }
}

function readinessItemColor(status: LeadReadinessItemSummary['status']) {
  switch (status) {
    case 'completed':
      return 'teal';
    case 'blocked':
      return 'red';
    case 'in_progress':
      return 'blue';
    case 'not_required':
      return 'gray';
    default:
      return 'yellow';
  }
}

function formatReadinessStatus(status: LeadReadinessDetail['summary']['status']) {
  switch (status) {
    case 'not_started':
      return 'Not Started';
    case 'in_progress':
      return 'In Progress';
    case 'blocked':
      return 'Blocked';
    case 'ready':
      return 'Ready For First Order';
    case 'converted':
      return 'Converted';
  }
}

function formatChecklistSummaryStatus(status: LeadReadinessDetail['summary']['checklistStatus']) {
  switch (status) {
    case 'not_started':
      return 'Not Started';
    case 'in_progress':
      return 'In Progress';
    case 'blocked':
      return 'Blocked';
    case 'completed':
      return 'Completed';
  }
}

function formatChecklistStatus(status: LeadReadinessItemSummary['status']) {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'not_required':
      return 'Not Required';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatContactRole(role: LeadContactRoleKey) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatContactSource(source: LeadContactSummary['source']) {
  if (!source) {
    return 'Unknown';
  }

  return source.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toDateTimeLocalValue(value: string) {
  const date = new Date(value);
  const offsetMilliseconds = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  return new Date(value).toISOString();
}

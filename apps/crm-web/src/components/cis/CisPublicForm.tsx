'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  CisFormDataRecord,
  CisFormDraftInput,
  CisPackageStatusKey,
  CisPaymentMethodKey,
  CisPublicPackage,
} from '@pulse/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  Grid,
  Group,
  NumberInput,
  Overlay,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconBuildingBank,
  IconBuildingSkyscraper,
  IconCheck,
  IconCreditCard,
  IconMail,
  IconShieldLock,
  IconUser,
} from '@tabler/icons-react';
import { fetchPublicCisPackage, savePublicCisDraft, submitPublicCis } from '@/lib/pulse-api';

const DEFAULT_API_BASE_URL = process.env.NEXT_PUBLIC_PULSE_API_BASE_URL ?? 'http://localhost:4000';

type CisPublicFormProps = {
  token: string;
};

type PublicCisFormState = CisFormDraftInput & {
  hasSignature: boolean;
};

const EDITABLE_STATUSES = new Set<CisPackageStatusKey>(['not_sent', 'link_sent', 'draft_in_progress']);

const PAYMENT_METHOD_OPTIONS: readonly { value: CisPaymentMethodKey; label: string }[] = [
  { value: 'NET_30', label: 'Net 30' },
  { value: 'ACH', label: 'ACH / EFT' },
  { value: 'CREDIT_CARD', label: 'Credit Card on File' },
] as const;

const STATE_OPTIONS = [
  'AK', 'AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DC', 'DE', 'FL',
  'GA', 'HI', 'IA', 'ID', 'IL', 'IN', 'KS', 'KY', 'LA', 'MA',
  'MD', 'ME', 'MI', 'MN', 'MO', 'MS', 'MT', 'NC', 'ND', 'NE',
  'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
].map((value) => ({ value, label: value }));

export function CisPublicForm({ token }: CisPublicFormProps) {
  const [cisPackage, setCisPackage] = useState<CisPublicPackage | null>(null);
  const [formState, setFormState] = useState<PublicCisFormState>(createEmptyFormState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPackage() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetchPublicCisPackage(DEFAULT_API_BASE_URL, token);
        if (cancelled) {
          return;
        }

        if (!response) {
          setLoadError('This CIS link is not active anymore.');
          setCisPackage(null);
          return;
        }

        setCisPackage(response);
        setFormState(mapFormDataToState(response.formData));
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setCisPackage(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPackage();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const isEditable = cisPackage ? EDITABLE_STATUSES.has(cisPackage.status) : false;
  const completionBanner = useMemo(() => {
    if (!cisPackage) {
      return null;
    }

    if (cisPackage.status === 'submitted') {
      return {
        color: 'green',
        title: 'CIS package submitted',
        message: 'Your customer information sheet is now in the internal review workflow.',
      };
    }

    if (formState.cardOnFileAuthorized) {
      return {
        color: 'violet',
        title: 'Card-on-file authorization captured',
        message: 'The required card-on-file acknowledgement is included with this package.',
      };
    }

    return null;
  }, [cisPackage, formState.cardOnFileAuthorized]);

  function updateField<K extends keyof PublicCisFormState>(field: K, value: PublicCisFormState[K]) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSaveDraft() {
    if (!isEditable) {
      return;
    }

    setIsSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await savePublicCisDraft(DEFAULT_API_BASE_URL, token, {
        formData: toDraftInput(formState),
      });

      setCisPackage(response);
      setFormState(mapFormDataToState(response.formData));
      setActionMessage('Draft saved successfully.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEditable) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await submitPublicCis(DEFAULT_API_BASE_URL, token, {
        formData: toDraftInput(formState),
      });

      setCisPackage(response);
      setFormState(mapFormDataToState(response.formData));
      setActionMessage('Your CIS package has been submitted for internal review.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Card withBorder radius="xl" p="xl">
          <Text c="dimmed">Loading your CIS package...</Text>
        </Card>
      </Container>
    );
  }

  if (loadError || !cisPackage) {
    return (
      <Container size="lg" py="xl">
        <Card withBorder radius="xl" p="xl">
          <Stack gap="sm" align="center">
            <Title order={2}>CIS Link Not Found</Title>
            <Text c="dimmed" ta="center">
              {loadError ?? 'This CIS package is not active anymore.'}
            </Text>
          </Stack>
        </Card>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Stack gap="xs" align="center">
          <Title order={1} ta="center">Customer Information Sheet</Title>
          <Text ta="center" c="dimmed">
            Complete the current Dynamic AQS CIS package for <strong>{cisPackage.leadCompanyName}</strong>. Business review data is stored in Pulse CRM, while raw payment details stay outside the CRM.
          </Text>
          <Group gap="xs" justify="center">
            <Badge color="blue" variant="light">{formatEntryMethod(cisPackage.entryMethod)}</Badge>
            <Badge color="violet" variant="light">Card on file required</Badge>
            {cisPackage.externalLinkExpiresAt ? (
              <Badge color="gray" variant="light">Expires {formatDateTimeLabel(cisPackage.externalLinkExpiresAt)}</Badge>
            ) : null}
          </Group>
        </Stack>

        {completionBanner ? (
          <Alert color={completionBanner.color} variant="light" icon={<IconCheck size={16} />}>
            <Text fw={600}>{completionBanner.title}</Text>
            <Text size="sm">{completionBanner.message}</Text>
          </Alert>
        ) : null}

        {actionMessage ? (
          <Alert color="teal" variant="light" icon={<IconCheck size={16} />}>
            {actionMessage}
          </Alert>
        ) : null}

        {actionError ? (
          <Alert color="red" variant="light">
            {actionError}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <Stack gap="lg">
            <Card withBorder radius="xl" p="xl">
              {!isEditable ? (
                <Overlay color="#fff" backgroundOpacity={0.75} blur={2} zIndex={5} center>
                  <Stack align="center" gap="xs">
                    <ThemeIcon color="green" size={60} radius="xl">
                      <IconCheck size={30} />
                    </ThemeIcon>
                    <Title order={3}>CIS Package Submitted</Title>
                  </Stack>
                </Overlay>
              ) : null}

              <Group mb="md" gap="xs">
                <IconBuildingSkyscraper size={24} color="var(--mantine-color-blue-6)" />
                <Title order={3}>Help Us Learn About Your Company</Title>
              </Group>

              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Company Website"
                    value={formState.companyWebsite ?? ''}
                    onChange={(event) => updateField('companyWebsite', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <NumberInput
                    label="# of Techs"
                    min={0}
                    value={formState.numOfTechs ?? ''}
                    onChange={(value) => updateField('numOfTechs', toOptionalNumberValue(value))}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <NumberInput
                    label="# of Install Trucks"
                    min={0}
                    value={formState.numOfInstallTechs ?? ''}
                    onChange={(value) => updateField('numOfInstallTechs', toOptionalNumberValue(value))}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <NumberInput
                    label="# of Salespeople / Advisors"
                    min={0}
                    value={formState.numOfSalespeopleAdvisors ?? ''}
                    onChange={(value) => updateField('numOfSalespeopleAdvisors', toOptionalNumberValue(value))}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Affinity Group or Franchise"
                    value={formState.affinityGroupOrFranchise ?? ''}
                    onChange={(event) => updateField('affinityGroupOrFranchise', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Parent Company / PE Group"
                    value={formState.parentCompanyName ?? ''}
                    onChange={(event) => updateField('parentCompanyName', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={12}>
                  <Checkbox
                    label="We are part of a private equity group"
                    checked={Boolean(formState.isPrivateEquity)}
                    onChange={(event) => updateField('isPrivateEquity', event.currentTarget.checked)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="xl" />

              <Group mb="md" gap="xs">
                <IconUser size={24} color="var(--mantine-color-blue-6)" />
                <Title order={3}>Primary Contact and Owner / General Manager</Title>
              </Group>

              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Primary Contact Name"
                    value={formState.primaryContactName ?? ''}
                    onChange={(event) => updateField('primaryContactName', event.currentTarget.value)}
                    disabled={!isEditable}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Primary Contact Title"
                    value={formState.primaryContactTitle ?? ''}
                    onChange={(event) => updateField('primaryContactTitle', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Primary Contact Email"
                    type="email"
                    value={formState.primaryContactEmail ?? ''}
                    onChange={(event) => updateField('primaryContactEmail', event.currentTarget.value)}
                    disabled={!isEditable}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Primary Contact Cell Phone"
                    value={formState.primaryContactCellPhone ?? ''}
                    onChange={(event) => updateField('primaryContactCellPhone', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Owner / General Manager Name"
                    value={formState.ownerManagerName ?? ''}
                    onChange={(event) => updateField('ownerManagerName', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Owner / GM Title"
                    value={formState.ownerManagerTitle ?? ''}
                    onChange={(event) => updateField('ownerManagerTitle', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Owner / GM Email"
                    type="email"
                    value={formState.ownerManagerEmail ?? ''}
                    onChange={(event) => updateField('ownerManagerEmail', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Owner / GM Cell Phone"
                    value={formState.ownerManagerCellPhone ?? ''}
                    onChange={(event) => updateField('ownerManagerCellPhone', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="xl" />

              <Group mb="md" gap="xs">
                <IconBuildingBank size={24} color="var(--mantine-color-blue-6)" />
                <Title order={3}>Business Information as Registered</Title>
              </Group>

              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Legal Company Name"
                    value={formState.legalCompanyName ?? ''}
                    onChange={(event) => updateField('legalCompanyName', event.currentTarget.value)}
                    disabled={!isEditable}
                    required
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Company Phone"
                    value={formState.companyPhone ?? ''}
                    onChange={(event) => updateField('companyPhone', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 5 }}>
                  <TextInput
                    label="Physical Address"
                    value={formState.physicalAddress ?? ''}
                    onChange={(event) => updateField('physicalAddress', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <TextInput
                    label="City"
                    value={formState.physicalCity ?? ''}
                    onChange={(event) => updateField('physicalCity', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <Select
                    label="State"
                    data={STATE_OPTIONS}
                    value={formState.physicalState ?? null}
                    onChange={(value) => updateField('physicalState', value ?? undefined)}
                    disabled={!isEditable}
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <TextInput
                    label="ZIP"
                    value={formState.physicalZip ?? ''}
                    onChange={(event) => updateField('physicalZip', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 5 }}>
                  <TextInput
                    label="Billing Address"
                    value={formState.billingAddress ?? ''}
                    onChange={(event) => updateField('billingAddress', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 3 }}>
                  <TextInput
                    label="Billing City"
                    value={formState.billingCity ?? ''}
                    onChange={(event) => updateField('billingCity', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <Select
                    label="Billing State"
                    data={STATE_OPTIONS}
                    value={formState.billingState ?? null}
                    onChange={(value) => updateField('billingState', value ?? undefined)}
                    disabled={!isEditable}
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 2 }}>
                  <TextInput
                    label="Billing ZIP"
                    value={formState.billingZip ?? ''}
                    onChange={(event) => updateField('billingZip', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Type of Business"
                    value={formState.typeOfBusiness ?? ''}
                    onChange={(event) => updateField('typeOfBusiness', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <NumberInput
                    label="Years in Business"
                    min={0}
                    value={formState.yearsInBusiness ?? ''}
                    onChange={(value) => updateField('yearsInBusiness', toOptionalNumberValue(value))}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <NumberInput
                    label="Months in Business"
                    min={0}
                    max={11}
                    value={formState.monthsInBusiness ?? ''}
                    onChange={(value) => updateField('monthsInBusiness', toOptionalNumberValue(value))}
                    disabled={!isEditable}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="xl" />

              <Group mb="md" gap="xs">
                <IconUser size={24} color="var(--mantine-color-blue-6)" />
                <Title order={3}>Who Will Be Ordering and Accounts Payable</Title>
              </Group>

              <Grid>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Ordering Contact Name"
                    value={formState.orderingContactName ?? ''}
                    onChange={(event) => updateField('orderingContactName', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Ordering Contact Phone"
                    value={formState.orderingContactCellPhone ?? ''}
                    onChange={(event) => updateField('orderingContactCellPhone', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Ordering Contact Email"
                    type="email"
                    value={formState.orderingContactEmail ?? ''}
                    onChange={(event) => updateField('orderingContactEmail', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Accounts Payable Name"
                    value={formState.apContactName ?? ''}
                    onChange={(event) => updateField('apContactName', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Accounts Payable Phone"
                    value={formState.apDirectPhone ?? ''}
                    onChange={(event) => updateField('apDirectPhone', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Accounts Payable Email"
                    type="email"
                    value={formState.apEmail ?? ''}
                    onChange={(event) => updateField('apEmail', event.currentTarget.value)}
                    disabled={!isEditable}
                  />
                </Grid.Col>
              </Grid>

              <Divider my="xl" />

              <Group mb="md" gap="xs">
                <IconMail size={24} color="var(--mantine-color-blue-6)" />
                <Title order={3}>Preferred Payment Method</Title>
              </Group>

              <Select
                label="Please select one"
                value={formState.paymentMethod ?? null}
                onChange={(value) => updateField('paymentMethod', (value ?? undefined) as CisPaymentMethodKey | undefined)}
                data={PAYMENT_METHOD_OPTIONS}
                disabled={!isEditable}
              />

              {formState.hasSignature ? (
                <Alert color="teal" variant="light" mt="md" icon={<IconCheck size={16} />}>
                  Signature acknowledgement captured {cisPackage.formData.signatureCapturedAt ? formatDateTimeLabel(cisPackage.formData.signatureCapturedAt) : 'for this draft'}.
                </Alert>
              ) : null}
            </Card>

            <Card withBorder radius="xl" p="xl" style={{ borderColor: 'var(--mantine-color-violet-4)' }}>
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <IconCreditCard size={24} color="var(--mantine-color-violet-6)" />
                  <Title order={3}>Section 2 - Card On File Authorization</Title>
                </Group>
                <Badge color="violet" variant="light">Pulse secure handoff</Badge>
              </Group>

              <Text size="sm" c="dimmed" mb="xl">
                The current CIS requires a credit card to be on file for all accounts. Pulse records the authorization state here, while the raw banking or card data remains outside the CRM.
              </Text>

              <Stack gap="md">
                <Checkbox
                  label="I authorize the required card-on-file step for account review"
                  checked={Boolean(formState.cardOnFileAuthorized)}
                  onChange={(event) => updateField('cardOnFileAuthorized', event.currentTarget.checked)}
                  disabled={!isEditable}
                />
                <Checkbox
                  label="ACH / EFT information will be provided through the approved secure path if ACH is selected"
                  checked={Boolean(formState.achAuthorized)}
                  onChange={(event) => updateField('achAuthorized', event.currentTarget.checked)}
                  disabled={!isEditable}
                />
                <Checkbox
                  label="Resale certificate attached or will be supplied with the package"
                  checked={Boolean(formState.resaleCertificateAttached)}
                  onChange={(event) => updateField('resaleCertificateAttached', event.currentTarget.checked)}
                  disabled={!isEditable}
                />
                <Checkbox
                  label="I certify the information above is accurate and authorize Dynamic AQS to continue account review"
                  checked={Boolean(formState.hasSignature)}
                  onChange={(event) => updateField('hasSignature', event.currentTarget.checked)}
                  disabled={!isEditable}
                />
              </Stack>

              <Group justify="flex-end" mt="xl">
                <Button variant="light" onClick={() => void handleSaveDraft()} loading={isSaving} disabled={!isEditable || isSubmitting}>
                  Save Draft
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={!isEditable || isSaving}>
                  Submit CIS Package
                </Button>
              </Group>
            </Card>
          </Stack>
        </form>
      </Stack>
    </Container>
  );
}

function createEmptyFormState(): PublicCisFormState {
  return {
    hasSignature: false,
  };
}

function mapFormDataToState(formData: CisFormDataRecord): PublicCisFormState {
  return {
    ...formData,
    hasSignature: Boolean(formData.signatureCapturedAt),
  };
}

function toDraftInput(formState: PublicCisFormState): CisFormDraftInput {
  return {
    ...formState,
    hasSignature: formState.hasSignature,
  };
}

function toOptionalNumberValue(value: string | number) {
  if (typeof value === 'string') {
    if (!value.trim()) {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return Number.isFinite(value) ? value : undefined;
}

function formatEntryMethod(entryMethod: CisPublicPackage['entryMethod']) {
  return entryMethod === 'digital_link' ? 'Digital Link' : 'Scanned PDF';
}

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

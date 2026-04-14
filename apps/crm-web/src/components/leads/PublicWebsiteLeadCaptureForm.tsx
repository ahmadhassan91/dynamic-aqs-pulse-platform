'use client';

import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  Grid,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconMail } from '@tabler/icons-react';
import {
  type CaptureWebsiteLeadRequest,
  type PublicWebsiteLeadSite,
  type WebsiteLeadCustomerStatusKey,
  type WebsiteLeadTypeKey,
} from '@pulse/contracts';
import { APP_LEAD_REGION_OPTIONS, findAppLeadRegionOption } from '@/lib/lead-form-options';
import { fetchPublicWebsiteLeadSite, submitPublicWebsiteLead } from '@/lib/pulse-api';

const API_BASE_URL = process.env.NEXT_PUBLIC_PULSE_API_BASE_URL ?? 'http://localhost:4000';

const homeownerInquiryOptions = [
  'Improve indoor air quality',
  'Address odors or allergies',
  'Whole-home IAQ consultation',
  'Service or support request',
];

const contractorInquiryOptions = [
  'Become a contractor partner',
  'Product, pricing, or availability',
  'Training and onboarding',
  'Existing account support',
];

const referralSourceOptions = [
  'Search engine',
  'Dealer referral',
  'Social media',
  'Affinity group',
  'Existing customer',
];

const leadRegionOptions = APP_LEAD_REGION_OPTIONS;

const leadRegionSelectData = leadRegionOptions.map((option) => ({
  value: option.value,
  label: `${option.label} (${option.value})`,
}));

type Props = {
  siteId: string;
  siteOverride?: PublicWebsiteLeadSite;
  mode?: 'live' | 'preview';
  embedded?: boolean;
  initialLeadType?: WebsiteLeadTypeKey;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  postalCode: string;
  companyName: string;
  serviceTechCount: string;
  state: string;
  inquiryTopic: string;
  message: string;
  referralSource: string;
  referralDetail: string;
  customerStatus: WebsiteLeadCustomerStatusKey;
  consent: boolean;
};

const initialFormState: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  streetAddress: '',
  city: '',
  postalCode: '',
  companyName: '',
  serviceTechCount: '',
  state: '',
  inquiryTopic: '',
  message: '',
  referralSource: '',
  referralDetail: '',
  customerStatus: 'new_customer',
  consent: false,
};

export function PublicWebsiteLeadCaptureForm({
  siteId,
  siteOverride,
  mode = 'live',
  embedded = false,
  initialLeadType,
}: Props) {
  const isPreview = mode === 'preview';
  const [site, setSite] = useState<PublicWebsiteLeadSite | null>(siteOverride ?? null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [leadType, setLeadType] = useState<WebsiteLeadTypeKey>(initialLeadType ?? 'homeowner');
  const [isLoadingSite, setIsLoadingSite] = useState(siteOverride ? false : true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedLeadId, setSubmittedLeadId] = useState<string | null>(null);

  useEffect(() => {
    if (siteOverride) {
      setSite(siteOverride);
      setLeadType(initialLeadType ?? (siteOverride.formType === 'contractor' ? 'contractor' : 'homeowner'));
      setIsLoadingSite(false);
      setErrorMessage(null);
      return undefined;
    }

    let cancelled = false;

    async function loadSite() {
      setIsLoadingSite(true);
      setErrorMessage(null);

      try {
        const response = await fetchPublicWebsiteLeadSite(API_BASE_URL, siteId);
        if (cancelled) {
          return;
        }

        setSite(response);
        setLeadType(response.formType === 'contractor' ? 'contractor' : 'homeowner');
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSite(false);
        }
      }
    }

    void loadSite();

    return () => {
      cancelled = true;
    };
  }, [initialLeadType, siteId, siteOverride]);

  const resolvedLeadType = useMemo<WebsiteLeadTypeKey>(() => {
    if (!site) {
      return leadType;
    }
    if (site.formType === 'homeowner') {
      return 'homeowner';
    }
    if (site.formType === 'contractor') {
      return 'contractor';
    }
    return leadType;
  }, [leadType, site]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!site) {
      return;
    }
    if (isPreview) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const submissionMessage = buildSubmissionMessage(formState);
      const regionOption = findAppLeadRegionOption(formState.state);
      const payload: CaptureWebsiteLeadRequest = {
        siteId: site.siteId,
        leadType: resolvedLeadType,
        formType: site.formType,
        contactFirstName: formState.firstName,
        contactLastName: formState.lastName,
        email: formState.email,
        phone: formState.phone,
        ...(formState.streetAddress.trim() ? { streetAddress: formState.streetAddress.trim() } : {}),
        ...(formState.city.trim() ? { city: formState.city.trim() } : {}),
        state: formState.state,
        ...(formState.postalCode.trim() ? { postalCode: formState.postalCode.trim() } : {}),
        ...(regionOption ? { countryCode: regionOption.countryCode } : {}),
        ...(resolvedLeadType === 'contractor' ? { customerStatus: formState.customerStatus } : {}),
        ...(resolvedLeadType === 'homeowner' ? { marketingConsent: formState.consent } : {}),
        ...(formState.inquiryTopic ? { inquiryTopic: formState.inquiryTopic } : {}),
        ...(formState.referralSource ? { referralSource: formState.referralSource } : {}),
        ...(formState.referralDetail ? { referralDetail: formState.referralDetail } : {}),
        ...(submissionMessage ? { message: submissionMessage } : {}),
        ...(resolvedLeadType === 'contractor'
          ? {
              companyName: formState.companyName,
              serviceTechCount: Number(formState.serviceTechCount || '0'),
            }
          : {}),
      };

      const response = await submitPublicWebsiteLead(API_BASE_URL, payload);
      setSubmittedLeadId(response.id);
      setFormState(initialFormState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderShell(content: ReactNode) {
    if (embedded) {
      return <>{content}</>;
    }

    return (
      <Container size="md" py="xl">
        {content}
      </Container>
    );
  }

  if (isLoadingSite) {
    return renderShell(
      <Paper withBorder radius="lg" p="xl">
        <Group justify="center" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading Pulse website form...</Text>
        </Group>
      </Paper>,
    );
  }

  if (!site) {
    return renderShell(
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        {errorMessage ?? 'Website form is not available.'}
      </Alert>,
    );
  }

  if (submittedLeadId) {
    return renderShell(
      <Paper withBorder radius="lg" p="xl">
        <Stack gap="md" align="center">
          <Badge color="green" variant="light">Submitted to Pulse CRM</Badge>
          <Title order={2} ta="center">Thanks, we’ve received your request.</Title>
          <Text ta="center" c="dimmed">
            Your submission for {site.siteName} has been routed into the Pulse CRM workflow and the intake team will follow up from there.
          </Text>
          <Group gap="xs">
            <IconCheck size={16} />
            <Text size="sm">Reference lead ID: {submittedLeadId}</Text>
          </Group>
        </Stack>
      </Paper>,
    );
  }

  return renderShell(
    <Stack gap="md">
      {isPreview ? (
        <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
          Preview mode is rendering the real hosted Pulse form component. Submission is intentionally disabled in this modal.
        </Alert>
      ) : null}

      <Stack gap="md">
        <Stack gap={4} align="center">
          <Title order={2} ta="center">Contact an IAQ Professional</Title>
          <Text ta="center" fw={700} size="lg">Protect your Indoor Space</Text>
          <Text ta="center" c="dimmed">{site.siteName}</Text>
          <Badge color="blue" variant="light">{site.brandTag}</Badge>
        </Stack>

        {errorMessage ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {errorMessage}
          </Alert>
        ) : null}

        <Card withBorder radius="lg" p="xl">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {site.formType === 'both' ? (
                <SegmentedControl
                  fullWidth
                  value={resolvedLeadType}
                  onChange={(value) => setLeadType(value as WebsiteLeadTypeKey)}
                  data={[
                    { label: 'Homeowner', value: 'homeowner' },
                    { label: 'Contractor', value: 'contractor' },
                  ]}
                />
              ) : (
                <Badge variant="light" color={resolvedLeadType === 'homeowner' ? 'grape' : 'teal'} w="fit-content">
                  {resolvedLeadType === 'homeowner' ? 'Homeowner Form' : 'Contractor Form'}
                </Badge>
              )}

              {resolvedLeadType === 'contractor' ? (
                <>
                  <Text size="sm" c="dimmed">Please select customer type:</Text>
                  <SegmentedControl
                    fullWidth
                    value={formState.customerStatus}
                    onChange={(value) => setFormState((current) => ({ ...current, customerStatus: value as FormState['customerStatus'] }))}
                    data={[
                      { label: 'New Customer', value: 'new_customer' },
                      { label: 'Existing Customer', value: 'existing_customer' },
                    ]}
                  />
                </>
              ) : null}

              <Grid gutter="md">
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="First name"
                    required
                    value={formState.firstName}
                    onChange={(event) => setFormState((current) => ({ ...current, firstName: event.currentTarget.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Last name"
                    required
                    value={formState.lastName}
                    onChange={(event) => setFormState((current) => ({ ...current, lastName: event.currentTarget.value }))}
                  />
                </Grid.Col>
                {resolvedLeadType === 'contractor' ? (
                  <>
                    <Grid.Col span={12}>
                      <TextInput
                        label="Company name"
                        required
                        value={formState.companyName}
                        onChange={(event) => setFormState((current) => ({ ...current, companyName: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                    <Grid.Col span={12}>
                      <TextInput
                        label="# of Service Technicians"
                        required
                        value={formState.serviceTechCount}
                        onChange={(event) => setFormState((current) => ({ ...current, serviceTechCount: event.currentTarget.value }))}
                      />
                    </Grid.Col>
                  </>
                ) : null}
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Email"
                    required
                    value={formState.email}
                    onChange={(event) => setFormState((current) => ({ ...current, email: event.currentTarget.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Mobile phone number or Direct phone"
                    required
                    value={formState.phone}
                    onChange={(event) => setFormState((current) => ({ ...current, phone: event.currentTarget.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Street address"
                    required
                    value={formState.streetAddress}
                    onChange={(event) => setFormState((current) => ({ ...current, streetAddress: event.currentTarget.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="City"
                    required
                    value={formState.city}
                    onChange={(event) => setFormState((current) => ({ ...current, city: event.currentTarget.value }))}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Select
                    searchable
                    label="State / Province"
                    placeholder="Select location..."
                    required
                    value={formState.state || null}
                    onChange={(value) => setFormState((current) => ({ ...current, state: value ?? '' }))}
                    data={leadRegionSelectData}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <TextInput
                    label="Zip / Postal Code"
                    required
                    value={formState.postalCode}
                    onChange={(event) => setFormState((current) => ({ ...current, postalCode: event.currentTarget.value }))}
                  />
                </Grid.Col>
              </Grid>

              <Select
                label={resolvedLeadType === 'homeowner' ? 'For Homeowners: How can we help?' : 'For HVAC Contractors, I am inquiring about:'}
                required
                value={formState.inquiryTopic}
                onChange={(value) => setFormState((current) => ({ ...current, inquiryTopic: value ?? '' }))}
                data={resolvedLeadType === 'homeowner' ? homeownerInquiryOptions : contractorInquiryOptions}
              />

              <Textarea
                label="Please provide a brief summary of your request:"
                minRows={4}
                value={formState.message}
                onChange={(event) => setFormState((current) => ({ ...current, message: event.currentTarget.value }))}
              />

              {resolvedLeadType === 'contractor' ? (
                <>
                  <Select
                    label="How did you hear about us?"
                    value={formState.referralSource}
                    onChange={(value) => setFormState((current) => ({ ...current, referralSource: value ?? '' }))}
                    data={referralSourceOptions}
                  />
                  <TextInput
                    label="Who can we thank for referring you?"
                    value={formState.referralDetail}
                    onChange={(event) => setFormState((current) => ({ ...current, referralDetail: event.currentTarget.value }))}
                  />
                </>
              ) : (
                <Checkbox
                  label="I agree to receive other communications from Dynamic AQS."
                  checked={formState.consent}
                  onChange={(event) => setFormState((current) => ({ ...current, consent: event.currentTarget.checked }))}
                />
              )}

              <Button
                type="submit"
                fullWidth
                loading={isSubmitting}
                disabled={isPreview}
                leftSection={<IconMail size={16} />}
              >
                {isPreview ? 'Preview Only' : 'Submit'}
              </Button>
              <Text size="xs" c="dimmed" ta="center">Powered by Pulse CRM</Text>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Stack>,
  );
}

function buildSubmissionMessage(formState: FormState) {
  return formState.message.trim() || undefined;
}

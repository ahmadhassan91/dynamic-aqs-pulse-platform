'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AuthRole,
  CisFinanceDecisionRequest,
  CisFinanceDecisionStatusKey,
  CisPaymentCaptureAttemptRecord,
  CisPackageDetail,
  CisParsedDraftRecord,
  CisPaymentMethodKey,
  CisPaymentTermsKey,
  CisPaymentVaultProviderKey,
  LeadDetail,
} from '@pulse/contracts';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  CopyButton,
  Divider,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconClipboardCheck,
  IconCopy,
  IconCreditCard,
  IconExternalLink,
  IconFileDescription,
  IconLink,
  IconMail,
  IconSend,
} from '@tabler/icons-react';
import {
  applyCisParsedDraft,
  fetchLeadCisPackage,
  issueLeadCisLink,
  listCisParsedDrafts,
  recordLeadMonerisHostedCaptureResult,
  recordLeadCisFinanceDecision,
  recordLeadCisPaymentVaultReference,
  requestLeadCisPaymentCapture,
  reviewLeadCisPackage,
  startLeadMonerisHostedCapture,
  submitLeadCisToFinance,
  uploadLeadCisScan,
} from '@/lib/pulse-api';

type LeadCisPanelProps = {
  apiBaseUrl: string;
  accessToken: string;
  actorRole: AuthRole;
  lead: LeadDetail;
  onLeadChanged: () => void;
};

type FinanceDecisionState = Exclude<CisFinanceDecisionStatusKey, 'not_submitted' | 'pending'>;

const SENDABLE_LEAD_STAGES = new Set<LeadDetail['stage']>([
  'discovery_completed',
  'cis_sent',
  'cis_signed',
  'onboarding_completed',
  'customer_active',
]);

const CIS_MANAGE_ROLES = new Set<AuthRole>([
  'SUPER_ADMIN',
  'EXECUTIVE',
  'SALES_BD_REP',
  'SALES_BD_LEADERSHIP',
  'ADMIN_CSR_OPS',
]);

const FINANCE_DECISION_ROLES = new Set<AuthRole>([
  'SUPER_ADMIN',
  'EXECUTIVE',
  'FINANCE',
]);

const FINANCE_DECISION_OPTIONS: readonly { value: FinanceDecisionState; label: string }[] = [
  { value: 'approved', label: 'Approve' },
  { value: 'conditional', label: 'Approve with conditions' },
  { value: 'info_requested', label: 'Request more information' },
  { value: 'declined', label: 'Decline' },
] as const;

const PAYMENT_TERM_OPTIONS: readonly CisPaymentTermsKey[] = ['NET_30', 'NET_60', 'COD', 'CUSTOM'];
const PAYMENT_VAULT_PROVIDER_OPTIONS: Array<{ value: CisPaymentVaultProviderKey; label: string }> = [
  { value: 'unknown', label: 'Not locked yet' },
  { value: 'ebizcharge', label: 'eBizCharge' },
  { value: 'moneris', label: 'Moneris' },
];
const PAYMENT_VAULT_STATUS_OPTIONS = [
  { value: 'vaulted', label: 'Vaulted' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'verification_pending', label: 'Verification pending' },
  { value: 'replaced', label: 'Replaced' },
] as const;

type MonerisHostedLaunchState = {
  attemptId: string;
  iframeUrl: string;
  iframeOrigin: string;
  profileId: string;
  expiresAt?: string;
};

export function LeadCisPanel({
  apiBaseUrl,
  accessToken,
  actorRole,
  lead,
  onLeadChanged,
}: LeadCisPanelProps) {
  const [cisPackage, setCisPackage] = useState<CisPackageDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastIssuedPublicUrl, setLastIssuedPublicUrl] = useState<string | null>(null);
  const [recipientEmail, setRecipientEmail] = useState(lead.email ?? '');
  const [linkNote, setLinkNote] = useState('');
  const [salesReviewNotes, setSalesReviewNotes] = useState('');
  const [financeCoverNotes, setFinanceCoverNotes] = useState('');
  const [financeSubmissionNotes, setFinanceSubmissionNotes] = useState('');
  const [financeDecision, setFinanceDecision] = useState<FinanceDecisionState>('approved');
  const [financeDecisionNotes, setFinanceDecisionNotes] = useState('');
  const [requestedInfoNotes, setRequestedInfoNotes] = useState('');
  const [creditLineAmount, setCreditLineAmount] = useState('');
  const [paymentTerms, setPaymentTerms] = useState<CisPaymentTermsKey>('NET_30');
  const [paymentCaptureNote, setPaymentCaptureNote] = useState('');
  const [vaultProvider, setVaultProvider] = useState<CisPaymentVaultProviderKey>('unknown');
  const [vaultToken, setVaultToken] = useState('');
  const [vaultCustomerRef, setVaultCustomerRef] = useState('');
  const [vaultLast4, setVaultLast4] = useState('');
  const [vaultBrand, setVaultBrand] = useState('');
  const [vaultStatus, setVaultStatus] = useState<(typeof PAYMENT_VAULT_STATUS_OPTIONS)[number]['value']>('vaulted');
  const [vaultAuthorizationCapturedAt, setVaultAuthorizationCapturedAt] = useState('');
  const [vaultReferenceNote, setVaultReferenceNote] = useState('');
  const [parsedDrafts, setParsedDrafts] = useState<CisParsedDraftRecord[]>([]);
  const [parsedDraftsError, setParsedDraftsError] = useState<string | null>(null);
  const [isLoadingParsedDrafts, setIsLoadingParsedDrafts] = useState(false);
  const [scanFileName, setScanFileName] = useState('');
  const [scanParserVersion, setScanParserVersion] = useState('manual-review-v1');
  const [scanRawExtractionText, setScanRawExtractionText] = useState('');
  const [scanSafeFieldPayloadJson, setScanSafeFieldPayloadJson] = useState('{\n  "legalCompanyName": "",\n  "primaryContactName": "",\n  "primaryContactEmail": ""\n}');
  const [scanPaymentFieldsDetected, setScanPaymentFieldsDetected] = useState(false);
  const [isRegisteringScan, setIsRegisteringScan] = useState(false);
  const [applyingParsedDraftId, setApplyingParsedDraftId] = useState<string | null>(null);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [isSigningOff, setIsSigningOff] = useState(false);
  const [isSubmittingFinance, setIsSubmittingFinance] = useState(false);
  const [isRecordingDecision, setIsRecordingDecision] = useState(false);
  const [isRequestingPaymentCapture, setIsRequestingPaymentCapture] = useState(false);
  const [isRecordingVaultReference, setIsRecordingVaultReference] = useState(false);
  const [isLaunchingHostedCapture, setIsLaunchingHostedCapture] = useState(false);
  const [isRecordingHostedCaptureResult, setIsRecordingHostedCaptureResult] = useState(false);
  const [hostedCaptureLaunch, setHostedCaptureLaunch] = useState<MonerisHostedLaunchState | null>(null);
  const monerisIframeRef = useRef<HTMLIFrameElement | null>(null);

  const canManageCis = CIS_MANAGE_ROLES.has(actorRole);
  const canDecideFinance = FINANCE_DECISION_ROLES.has(actorRole);
  const canIssueCis = SENDABLE_LEAD_STAGES.has(lead.stage);
  const leadLifecycleLocked = lead.lifecycleStatus !== 'active';

  useEffect(() => {
    setRecipientEmail(lead.email ?? '');
    setLinkNote('');
    setScanFileName(`${lead.companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'lead'}-cis-scan.pdf`);
  }, [lead.companyName, lead.email, lead.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadCis() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetchLeadCisPackage(apiBaseUrl, accessToken, lead.id);
        if (!cancelled) {
          setCisPackage(response);
        }
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

    void loadCis();

    return () => {
      cancelled = true;
    };
  }, [accessToken, apiBaseUrl, lead.id]);

  useEffect(() => {
    if (!cisPackage) {
      setSalesReviewNotes('');
      setFinanceCoverNotes('');
      setFinanceSubmissionNotes('');
      setFinanceDecision('approved');
      setFinanceDecisionNotes('');
      setRequestedInfoNotes('');
      setCreditLineAmount('');
      setPaymentTerms('NET_30');
      setPaymentCaptureNote('');
      setVaultProvider('unknown');
      setVaultToken('');
      setVaultCustomerRef('');
      setVaultLast4('');
    setVaultBrand('');
    setVaultStatus('vaulted');
    setVaultAuthorizationCapturedAt('');
    setVaultReferenceNote('');
    setHostedCaptureLaunch(null);
    return;
  }

    setSalesReviewNotes(cisPackage.internalReview?.salesReviewNotes ?? '');
    setFinanceCoverNotes(cisPackage.internalReview?.financeCoverNotes ?? '');
    setFinanceSubmissionNotes(cisPackage.financeDecision?.submissionNotes ?? '');
    setFinanceDecisionNotes(cisPackage.financeDecision?.decisionNotes ?? '');
    setRequestedInfoNotes(cisPackage.financeDecision?.requestedInfoNotes ?? '');
    setCreditLineAmount(
      cisPackage.financeDecision?.creditLineAmount !== undefined
        ? String(cisPackage.financeDecision.creditLineAmount)
        : '',
    );
    setPaymentTerms(cisPackage.financeDecision?.paymentTerms ?? 'NET_30');
    setPaymentCaptureNote('');
    setVaultProvider(cisPackage.paymentVaultReferences[0]?.provider ?? 'unknown');
    setVaultToken('');
    setVaultCustomerRef('');
    setVaultLast4('');
    setVaultBrand('');
    setVaultStatus('vaulted');
    setVaultAuthorizationCapturedAt('');
    setVaultReferenceNote('');
  }, [cisPackage]);

  const cisPackageId = cisPackage?.id;

  useEffect(() => {
    let cancelled = false;

    async function loadParsedDrafts() {
      if (!cisPackageId) {
        setParsedDrafts([]);
        setParsedDraftsError(null);
        return;
      }

      setIsLoadingParsedDrafts(true);
      setParsedDraftsError(null);

      try {
        const response = await listCisParsedDrafts(apiBaseUrl, accessToken, cisPackageId);
        if (!cancelled) {
          setParsedDrafts(response.items);
        }
      } catch (error) {
        if (!cancelled) {
          setParsedDrafts([]);
          setParsedDraftsError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingParsedDrafts(false);
        }
      }
    }

    void loadParsedDrafts();

    return () => {
      cancelled = true;
    };
  }, [accessToken, apiBaseUrl, cisPackageId]);

  const paymentMethod = cisPackage?.formData.paymentMethod;
  const requiresCreditTerms =
    paymentMethod !== undefined
    && paymentMethod !== 'CREDIT_CARD'
    && financeDecision === 'approved';

  const financeStatusLabel = useMemo(() => {
    if (!cisPackage?.financeDecision) {
      return cisPackage?.status === 'sales_signed_off' ? 'Awaiting finance submission' : 'Not submitted';
    }

    return formatFinanceDecisionStatus(cisPackage.financeDecision.status);
  }, [cisPackage]);
  const latestCaptureAttempt = cisPackage?.paymentCaptureAttempts[0];
  const latestVaultReference = cisPackage?.paymentVaultReferences[0];
  const canTrackHostedPaymentCapture =
    Boolean(cisPackage)
    && !leadLifecycleLocked
    && canDecideFinance
    && ['finance_pending', 'finance_approved'].includes(cisPackage?.status ?? 'not_sent');

  async function reloadCis() {
    const response = await fetchLeadCisPackage(apiBaseUrl, accessToken, lead.id);
    setCisPackage(response);
    if (response) {
      await reloadParsedDraftsByPackageId(response.id);
    } else {
      setParsedDrafts([]);
      setParsedDraftsError(null);
    }
  }

  async function reloadParsedDraftsByPackageId(cisPackageId: string) {
    const response = await listCisParsedDrafts(apiBaseUrl, accessToken, cisPackageId);
    setParsedDrafts(response.items);
    setParsedDraftsError(null);
  }

  async function handleRegisterScannedDraft() {
    if (!canManageCis || leadLifecycleLocked) {
      return;
    }

    setIsRegisteringScan(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const safeFieldPayload = parseOptionalJsonObject(scanSafeFieldPayloadJson, 'Safe field payload');
      const request = {
        fileName: scanFileName.trim(),
        ...(scanParserVersion.trim() ? { parserVersion: scanParserVersion.trim() } : {}),
        ...(scanRawExtractionText.trim() ? { rawExtractionText: scanRawExtractionText.trim() } : {}),
        ...(safeFieldPayload ? { safeFieldPayload: safeFieldPayload as unknown as NonNullable<Parameters<typeof uploadLeadCisScan>[3]['safeFieldPayload']> } : {}),
        paymentFieldsDetected: scanPaymentFieldsDetected,
      };
      const response = await uploadLeadCisScan(apiBaseUrl, accessToken, lead.id, request);

      setCisPackage(response.cisPackage);
      await reloadParsedDraftsByPackageId(response.cisPackage.id);
      setActionMessage(
        response.parsedDraft.paymentFieldsDetected
          ? 'Scanned CIS parse registered. Payment fields were flagged and kept out of canonical CIS data.'
          : 'Scanned CIS parse registered and ready for reviewed apply.',
      );
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRegisteringScan(false);
    }
  }

  async function handleApplyParsedDraft(parsedDraftId: string) {
    if (!cisPackage || !canManageCis || leadLifecycleLocked) {
      return;
    }

    setApplyingParsedDraftId(parsedDraftId);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await applyCisParsedDraft(apiBaseUrl, accessToken, cisPackage.id, parsedDraftId, {
        note: 'Applied from scanned CIS fallback review.',
      });

      setCisPackage(response);
      await reloadParsedDraftsByPackageId(response.id);
      setActionMessage('Reviewed parsed draft applied into the CIS package.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setApplyingParsedDraftId(null);
    }
  }

  async function handleIssueLink(action: 'send-link' | 'resend-link') {
    if (!canManageCis || !canIssueCis || leadLifecycleLocked) {
      return;
    }

    setIsSendingLink(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await issueLeadCisLink(
        apiBaseUrl,
        accessToken,
        lead.id,
        {
          ...(recipientEmail.trim() ? { recipientEmail: recipientEmail.trim() } : {}),
          ...(linkNote.trim() ? { note: linkNote.trim() } : {}),
        },
        action,
      );

      setLastIssuedPublicUrl(response.publicUrl);
      setActionMessage(action === 'send-link' ? 'CIS link issued successfully.' : 'Fresh CIS link issued successfully.');
      await reloadCis();
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSendingLink(false);
    }
  }

  async function handleReviewSignoff() {
    if (!cisPackage || !canManageCis || leadLifecycleLocked) {
      return;
    }

    setIsSigningOff(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await reviewLeadCisPackage(apiBaseUrl, accessToken, cisPackage.id, {
        ...(salesReviewNotes.trim() ? { salesReviewNotes: salesReviewNotes.trim() } : {}),
        ...(financeCoverNotes.trim() ? { financeCoverNotes: financeCoverNotes.trim() } : {}),
      });

      setCisPackage(response);
      setActionMessage('CIS package reviewed and signed off.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSigningOff(false);
    }
  }

  async function handleSubmitToFinance() {
    if (!cisPackage || !canManageCis || leadLifecycleLocked) {
      return;
    }

    setIsSubmittingFinance(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await submitLeadCisToFinance(apiBaseUrl, accessToken, cisPackage.id, {
        ...(financeSubmissionNotes.trim() ? { submissionNotes: financeSubmissionNotes.trim() } : {}),
      });

      setCisPackage(response);
      setActionMessage('CIS package submitted to finance.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSubmittingFinance(false);
    }
  }

  async function handleFinanceDecision() {
    if (!cisPackage || !canDecideFinance || leadLifecycleLocked) {
      return;
    }

    setIsRecordingDecision(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const payload: CisFinanceDecisionRequest = {
        decision: financeDecision,
        ...(financeDecisionNotes.trim() ? { decisionNotes: financeDecisionNotes.trim() } : {}),
        ...(requestedInfoNotes.trim() ? { requestedInfoNotes: requestedInfoNotes.trim() } : {}),
        ...(creditLineAmount.trim() ? { creditLineAmount: Number(creditLineAmount) } : {}),
        ...(paymentTerms ? { paymentTerms } : {}),
      };

      const response = await recordLeadCisFinanceDecision(apiBaseUrl, accessToken, cisPackage.id, payload);

      setCisPackage(response);
      setActionMessage(`Finance decision recorded: ${formatFinanceDecisionStatus(response.financeDecision?.status ?? financeDecision)}.`);
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRecordingDecision(false);
    }
  }

  async function handleRequestPaymentCapture() {
    if (!cisPackage || !canTrackHostedPaymentCapture) {
      return;
    }

    setIsRequestingPaymentCapture(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await requestLeadCisPaymentCapture(apiBaseUrl, accessToken, cisPackage.id, {
        ...(paymentCaptureNote.trim() ? { note: paymentCaptureNote.trim() } : {}),
      });

      setCisPackage(response);
      setPaymentCaptureNote('');
      setActionMessage('Hosted payment capture request recorded for finance follow-up.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRequestingPaymentCapture(false);
    }
  }

  async function handleLaunchMonerisHostedCapture() {
    if (!cisPackage || !canTrackHostedPaymentCapture) {
      return;
    }

    setIsLaunchingHostedCapture(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await startLeadMonerisHostedCapture(apiBaseUrl, accessToken, cisPackage.id, {
        ...(paymentCaptureNote.trim() ? { note: paymentCaptureNote.trim() } : {}),
      });

      setCisPackage(response.cisPackage);
      setPaymentCaptureNote('');
      setHostedCaptureLaunch({
        attemptId: response.launch.attemptId,
        iframeUrl: response.launch.iframeUrl,
        iframeOrigin: response.launch.iframeOrigin,
        profileId: response.launch.profileId,
        ...(response.launch.expiresAt ? { expiresAt: response.launch.expiresAt } : {}),
      });
      setActionMessage('Secure Moneris hosted capture launched. Enter payment details in the frame, then tokenize from Pulse.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLaunchingHostedCapture(false);
    }
  }

  function handleSendMonerisTokenizeRequest() {
    if (!hostedCaptureLaunch || !monerisIframeRef.current?.contentWindow) {
      return;
    }

    monerisIframeRef.current.contentWindow.postMessage('tokenize', hostedCaptureLaunch.iframeOrigin);
    setActionMessage('Tokenize request sent to the secure Moneris frame.');
  }

  async function handleRecordPaymentVaultReference() {
    if (!cisPackage || !canTrackHostedPaymentCapture) {
      return;
    }

    setIsRecordingVaultReference(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const response = await recordLeadCisPaymentVaultReference(apiBaseUrl, accessToken, cisPackage.id, {
        provider: vaultProvider,
        ...(vaultToken.trim() ? { vaultToken: vaultToken.trim() } : {}),
        ...(vaultCustomerRef.trim() ? { vaultCustomerRef: vaultCustomerRef.trim() } : {}),
        ...(vaultLast4.trim() ? { last4: vaultLast4.trim() } : {}),
        ...(vaultBrand.trim() ? { brand: vaultBrand.trim() } : {}),
        ...(vaultAuthorizationCapturedAt.trim() ? { authorizationCapturedAt: vaultAuthorizationCapturedAt.trim() } : {}),
        ...(vaultStatus.trim() ? { status: vaultStatus.trim() } : {}),
        ...(vaultReferenceNote.trim() ? { note: vaultReferenceNote.trim() } : {}),
      });

      setCisPackage(response);
      setVaultToken('');
      setVaultCustomerRef('');
      setVaultLast4('');
      setVaultBrand('');
      setVaultStatus('vaulted');
      setVaultAuthorizationCapturedAt('');
      setVaultReferenceNote('');
      setActionMessage('Tokenized vault reference recorded on the CIS package.');
      onLeadChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRecordingVaultReference(false);
    }
  }

  useEffect(() => {
    if (!hostedCaptureLaunch || !cisPackageId || isRecordingHostedCaptureResult) {
      return undefined;
    }

    const activeLaunch = hostedCaptureLaunch;
    const activePackageId = cisPackageId;

    function handleMonerisMessage(event: MessageEvent) {
      if (event.origin !== activeLaunch.iframeOrigin) {
        return;
      }

      const payload = parseMonerisHostedCaptureMessage(event.data);
      if (!payload) {
        return;
      }

      setIsRecordingHostedCaptureResult(true);
      setActionError(null);

      void recordLeadMonerisHostedCaptureResult(
        apiBaseUrl,
        accessToken,
        activePackageId,
        activeLaunch.attemptId,
        {
          ...(payload.responseCode ? { responseCode: payload.responseCode } : {}),
          ...(payload.errorMessage ? { errorMessage: payload.errorMessage } : {}),
          ...(payload.temporaryToken ? { temporaryToken: payload.temporaryToken } : {}),
          ...(payload.bin ? { bin: payload.bin } : {}),
          ...(isObjectRecord(payload.rawProviderPayload) ? { rawProviderPayload: payload.rawProviderPayload } : {}),
          note: payload.responseCode === '001'
            ? 'Moneris hosted tokenization completed in the centralized CIS flow.'
            : 'Moneris hosted tokenization returned an error.',
        },
      )
        .then((response) => {
          setCisPackage(response.cisPackage);
          setHostedCaptureLaunch(null);
          setActionMessage(
            response.attempt.status === 'token_received'
              ? 'Moneris temporary token received. Finance can now finish the provider-side follow-up without exposing raw payment data in Pulse.'
              : `Moneris capture failed${response.attempt.providerErrorMessage ? `: ${response.attempt.providerErrorMessage}` : '.'}`,
          );
          onLeadChanged();
        })
        .catch((error) => {
          setActionError(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          setIsRecordingHostedCaptureResult(false);
        });
    }

    window.addEventListener('message', handleMonerisMessage);
    return () => {
      window.removeEventListener('message', handleMonerisMessage);
    };
  }, [
    accessToken,
    apiBaseUrl,
    cisPackageId,
    hostedCaptureLaunch,
    isRecordingHostedCaptureResult,
    onLeadChanged,
  ]);

  const scannedCisFallbackCard = canManageCis ? (
    <Card withBorder radius="xl" p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <ThemeIcon size="lg" color="orange" variant="light" radius="xl">
              <IconFileDescription size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Scanned CIS fallback</Text>
              <Text size="xs" c="dimmed">
                Register a scanned CIS parse draft when the prospect returns a PDF instead of finishing the digital link.
              </Text>
            </div>
          </Group>
          <Badge variant="light" color={parsedDrafts.length > 0 ? 'orange' : 'gray'}>
            {parsedDrafts.length > 0 ? `${parsedDrafts.length} draft${parsedDrafts.length === 1 ? '' : 's'}` : 'No drafts yet'}
          </Badge>
        </Group>

        <Alert color="orange" icon={<IconAlertCircle size={16} />}>
          OCR/vision drafts can populate safe company and contact fields, but payment fields stay excluded and must be handled through the hosted/tokenized payment path.
        </Alert>

        {parsedDraftsError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {parsedDraftsError}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Scan file name"
            value={scanFileName}
            onChange={(event) => setScanFileName(event.currentTarget.value)}
            placeholder="dealer-cis-scan.pdf"
            disabled={leadLifecycleLocked || isRegisteringScan}
          />
          <TextInput
            label="Parser version"
            value={scanParserVersion}
            onChange={(event) => setScanParserVersion(event.currentTarget.value)}
            placeholder="manual-review-v1"
            disabled={leadLifecycleLocked || isRegisteringScan}
          />
        </SimpleGrid>

        <Textarea
          label="Raw extraction text"
          value={scanRawExtractionText}
          onChange={(event) => setScanRawExtractionText(event.currentTarget.value)}
          placeholder="Paste OCR or transcription text here when a scanned CIS is reviewed internally."
          minRows={3}
          disabled={leadLifecycleLocked || isRegisteringScan}
        />

        <Textarea
          label="Safe field payload (JSON)"
          value={scanSafeFieldPayloadJson}
          onChange={(event) => setScanSafeFieldPayloadJson(event.currentTarget.value)}
          placeholder='{\n  "legalCompanyName": "Dynamic Dealer",\n  "primaryContactName": "Taylor Smith"\n}'
          minRows={8}
          disabled={leadLifecycleLocked || isRegisteringScan}
        />

        <Checkbox
          label="Payment fields were present on the scanned form and must stay out of canonical CIS data"
          checked={scanPaymentFieldsDetected}
          onChange={(event) => setScanPaymentFieldsDetected(event.currentTarget.checked)}
          disabled={leadLifecycleLocked || isRegisteringScan}
        />

        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            {cisPackage
              ? 'This will attach a reviewed parse draft to the active CIS package.'
              : 'This can start the CIS fallback flow even before a digital link package exists.'}
          </Text>
          <Button
            leftSection={<IconFileDescription size={16} />}
            onClick={() => {
              void handleRegisterScannedDraft();
            }}
            loading={isRegisteringScan}
            disabled={leadLifecycleLocked}
          >
            Register scanned parse
          </Button>
        </Group>

        {isLoadingParsedDrafts ? (
          <Text size="sm" c="dimmed">Loading parsed drafts...</Text>
        ) : null}

        {parsedDrafts.map((draft) => (
          <Card key={draft.id} withBorder radius="xl" p="md" className="premium-subhero-panel">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={700}>{draft.documentFileName}</Text>
                  <Text size="xs" c="dimmed">
                    {formatCisEvent(draft.parseStatus)} • {draft.parserVersion} • {formatOptionalDate(draft.createdAt)}
                  </Text>
                </div>
                <Badge variant="light" color={draft.paymentFieldsDetected ? 'orange' : 'teal'}>
                  {draft.paymentFieldsDetected ? 'Payment fields flagged' : 'Safe fields only'}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                Safe fields: {draft.safeFieldPayload ? Object.keys(draft.safeFieldPayload).join(', ') || 'No mapped fields yet' : 'No mapped fields yet'}
              </Text>
              {draft.rawExtractionText ? (
                <Text size="sm" c="dimmed">
                  Extraction preview: {draft.rawExtractionText.slice(0, 180)}{draft.rawExtractionText.length > 180 ? '…' : ''}
                </Text>
              ) : null}
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  Parsed drafts are applied into the live CIS package only after internal review.
                </Text>
                <Button
                  variant="light"
                  onClick={() => {
                    void handleApplyParsedDraft(draft.id);
                  }}
                  loading={applyingParsedDraftId === draft.id}
                  disabled={leadLifecycleLocked || !draft.safeFieldPayload || Object.keys(draft.safeFieldPayload).length === 0}
                >
                  Apply reviewed draft
                </Button>
              </Group>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Card>
  ) : null;

  return (
    <Paper withBorder radius="xl" p="lg" className="premium-drawer-card">
      <Stack gap="md">
        <Modal
          opened={Boolean(hostedCaptureLaunch)}
          onClose={() => {
            if (!isRecordingHostedCaptureResult) {
              setHostedCaptureLaunch(null);
            }
          }}
          title="Moneris hosted payment capture"
          size="xl"
          centered
        >
          <Stack gap="md">
            <Alert color="blue" icon={<IconCreditCard size={16} />}>
              Payment details stay inside the secure Moneris frame. Pulse only tracks the hosted attempt and any returned temporary token metadata.
            </Alert>
            <Text size="sm" c="dimmed">
              Enter the payment details in the secure frame below, then click <strong>Tokenize in secure frame</strong> so Moneris can return the temporary token to Pulse.
            </Text>
            {hostedCaptureLaunch?.expiresAt ? (
              <Text size="xs" c="dimmed">
                This hosted attempt expires {formatDateTimeLabel(hostedCaptureLaunch.expiresAt)}.
              </Text>
            ) : null}
            {hostedCaptureLaunch ? (
              <iframe
                ref={monerisIframeRef}
                title="Moneris hosted tokenization"
                src={hostedCaptureLaunch.iframeUrl}
                style={{ width: '100%', minHeight: 340, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 16, background: '#fff' }}
              />
            ) : null}
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Profile: {hostedCaptureLaunch?.profileId ?? '—'}
              </Text>
              <Group>
                <Button variant="light" onClick={() => setHostedCaptureLaunch(null)} disabled={isRecordingHostedCaptureResult}>
                  Close
                </Button>
                <Button onClick={handleSendMonerisTokenizeRequest} loading={isRecordingHostedCaptureResult} disabled={!hostedCaptureLaunch}>
                  Tokenize in secure frame
                </Button>
              </Group>
            </Group>
          </Stack>
        </Modal>

        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Title order={4}>CIS Workspace</Title>
            <Text size="sm" c="dimmed">
              Send the digital CIS, review the returned package, and route finance decisions without leaving the approved lead workspace.
            </Text>
          </Stack>
          <Badge variant="light" color={cisPackage ? statusColor(cisPackage.status) : canIssueCis ? 'blue' : 'gray'}>
            {cisPackage ? formatCisStatus(cisPackage.status) : canIssueCis ? 'Ready to send' : 'Discovery gated'}
          </Badge>
        </Group>

        {loadError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {loadError}
          </Alert>
        ) : null}

        {actionMessage ? (
          <Alert color="teal" icon={<IconCheck size={16} />}>
            {actionMessage}
          </Alert>
        ) : null}

        {actionError ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {actionError}
          </Alert>
        ) : null}

        {leadLifecycleLocked ? (
          <Alert color="gray" icon={<IconAlertCircle size={16} />}>
            This lead is parked or closed. Reopen it before sending CIS, submitting to finance, or recording finance decisions.
          </Alert>
        ) : null}

        {isLoading ? <Text size="sm" c="dimmed">Loading CIS package...</Text> : null}

        {!isLoading && !loadError && !cisPackage ? (
          <>
            <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <ThemeIcon size="lg" color="blue" variant="light" radius="xl">
                      <IconLink size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Step 1. Send & Track CIS</Text>
                      <Text size="xs" c="dimmed">Issue the prospect-facing CIS from the lead workspace.</Text>
                    </div>
                  </Group>
                  <Badge variant="light" color={canIssueCis ? 'blue' : 'orange'}>
                    {canIssueCis ? 'Ready' : 'Blocked'}
                  </Badge>
                </Group>

                {!canIssueCis ? (
                  <Alert color="orange" icon={<IconAlertCircle size={16} />}>
                    CIS is gated until discovery is complete. Move the lead into Discovery Completed first, then issue the digital link from here.
                  </Alert>
                ) : null}

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Recipient email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.currentTarget.value)}
                    placeholder="prospect@example.com"
                    disabled={!canManageCis || leadLifecycleLocked || isSendingLink}
                  />
                  <TextInput
                    label="Current lead stage"
                    value={formatLeadStage(lead.stage)}
                    disabled
                  />
                </SimpleGrid>

                <Textarea
                  label="Internal send note"
                  value={linkNote}
                  onChange={(event) => setLinkNote(event.currentTarget.value)}
                  placeholder="Capture any context that should travel with the CIS send event."
                  minRows={3}
                  disabled={!canManageCis || leadLifecycleLocked || isSendingLink}
                />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Contact: {lead.contactDisplayName || 'Not captured yet'}
                  </Text>
                  <Button
                    leftSection={<IconSend size={16} />}
                    onClick={() => {
                      void handleIssueLink('send-link');
                    }}
                    loading={isSendingLink}
                    disabled={!canManageCis || leadLifecycleLocked || !canIssueCis}
                  >
                    Send CIS link
                  </Button>
                </Group>
              </Stack>
            </Card>
            {scannedCisFallbackCard}
          </>
        ) : null}

        {cisPackage ? (
          <>
            <Card withBorder radius="xl" p="lg" className="premium-subhero-panel">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <ThemeIcon size="lg" color="grape" variant="light" radius="xl">
                      <IconClipboardCheck size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Package status and checkpoints</Text>
                      <Text size="xs" c="dimmed">Follow the same send, review, and finance rhythm from the approved prototype.</Text>
                    </div>
                  </Group>
                  <Badge variant="light" color={statusColor(cisPackage.status)}>
                    {formatCisStatus(cisPackage.status)}
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
                  <MetricCard label="Link sends" value={String(cisPackage.externalLinkSentCount)} />
                  <MetricCard label="Finance status" value={financeStatusLabel} />
                  <MetricCard label="Payment method" value={formatPaymentMethod(paymentMethod)} />
                  <MetricCard label="Card on file" value={cisPackage.formData.cardOnFileAuthorized ? 'Authorized' : 'Pending'} />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                  <ReadOnlyField label="Last sent" value={formatOptionalDate(cisPackage.externalLinkLastSentAt)} />
                  <ReadOnlyField label="Link expires" value={formatOptionalDate(cisPackage.externalLinkExpiresAt)} />
                  <ReadOnlyField label="Prospect submitted" value={formatOptionalDate(cisPackage.submittedAt)} />
                  <ReadOnlyField label="Finance decided" value={formatOptionalDate(cisPackage.financeDecidedAt)} />
                </SimpleGrid>
              </Stack>
            </Card>

            <Card withBorder radius="xl" p="lg">
              <Stack gap="md">
                <Group justify="space-between" align="center">
                  <Group gap="xs">
                    <ThemeIcon size="lg" color="blue" variant="light" radius="xl">
                      <IconMail size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Step 1. Send & Track CIS</Text>
                      <Text size="xs" c="dimmed">Resend the link, capture context, and open the public package when needed.</Text>
                    </div>
                  </Group>
                  <Badge variant="light" color={cisPackage.submittedAt ? 'teal' : 'orange'}>
                    {cisPackage.submittedAt ? 'Prospect submitted' : 'Awaiting prospect'}
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Recipient email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.currentTarget.value)}
                    placeholder="prospect@example.com"
                    disabled={!canManageCis || leadLifecycleLocked || isSendingLink}
                  />
                  <TextInput
                    label="Entry method"
                    value={cisPackage.entryMethod === 'digital_link' ? 'Digital link' : 'Scanned PDF'}
                    disabled
                  />
                </SimpleGrid>

                <Textarea
                  label="Send note"
                  value={linkNote}
                  onChange={(event) => setLinkNote(event.currentTarget.value)}
                  placeholder="Capture resend context or handoff notes."
                  minRows={3}
                  disabled={!canManageCis || leadLifecycleLocked || isSendingLink}
                />

                <Group gap="sm" wrap="wrap">
                  <Button
                    leftSection={<IconSend size={16} />}
                    variant="light"
                    onClick={() => {
                      void handleIssueLink('resend-link');
                    }}
                    loading={isSendingLink}
                    disabled={!canManageCis || leadLifecycleLocked}
                  >
                    Resend link
                  </Button>
                  {lastIssuedPublicUrl ? (
                    <>
                      <CopyButton value={lastIssuedPublicUrl}>
                        {({ copied, copy }) => (
                          <Button
                            leftSection={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                            variant="light"
                            color={copied ? 'teal' : 'gray'}
                            onClick={copy}
                          >
                            {copied ? 'Copied' : 'Copy link'}
                          </Button>
                        )}
                      </CopyButton>
                      <Button
                        component="a"
                        href={lastIssuedPublicUrl}
                        target="_blank"
                        rel="noreferrer"
                        leftSection={<IconExternalLink size={16} />}
                      >
                        Open public CIS
                      </Button>
                    </>
                  ) : null}
                </Group>
              </Stack>
            </Card>

            <Card withBorder radius="xl" p="lg">
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" color="green" variant="light" radius="xl">
                    <IconFileDescription size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>Step 2. Review CIS data</Text>
                    <Text size="xs" c="dimmed">Review the structured package inside the same card and tab language used by the approved prototype.</Text>
                  </div>
                </Group>

                <Tabs defaultValue="company" className="premium-tabs-shell">
                  <Tabs.List>
                    <Tabs.Tab value="company">Company & Contacts</Tabs.Tab>
                    <Tabs.Tab value="ordering">Ordering & AP</Tabs.Tab>
                    <Tabs.Tab value="payment">Payment & Signature</Tabs.Tab>
                  </Tabs.List>

                  <Tabs.Panel value="company" pt="md">
                    <Stack gap="md">
                      <Text fw={600} size="sm" c="blue.7">Help Us Learn About Your Company</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        <ReadOnlyField label="Company website" value={cisPackage.formData.companyWebsite} />
                        <ReadOnlyField label="Service technicians" value={formatOptionalNumber(cisPackage.formData.numOfTechs)} />
                        <ReadOnlyField label="Install trucks / techs" value={formatOptionalNumber(cisPackage.formData.numOfInstallTechs)} />
                        <ReadOnlyField label="Salespeople / advisors" value={formatOptionalNumber(cisPackage.formData.numOfSalespeopleAdvisors)} />
                        <ReadOnlyField label="Affinity / franchise" value={cisPackage.formData.affinityGroupOrFranchise} />
                        <ReadOnlyField label="Private equity" value={cisPackage.formData.isPrivateEquity ? 'Yes' : 'No'} />
                        <ReadOnlyField label="Parent company" value={cisPackage.formData.parentCompanyName} />
                      </SimpleGrid>

                      <Divider />

                      <Text fw={600} size="sm" c="blue.7">Primary Contact</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        <ReadOnlyField label="Name" value={cisPackage.formData.primaryContactName} />
                        <ReadOnlyField label="Title" value={cisPackage.formData.primaryContactTitle} />
                        <ReadOnlyField label="Email" value={cisPackage.formData.primaryContactEmail} />
                        <ReadOnlyField label="Cell phone" value={cisPackage.formData.primaryContactCellPhone} />
                      </SimpleGrid>

                      <Divider />

                      <Text fw={600} size="sm" c="blue.7">Owner / General Manager</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        <ReadOnlyField label="Name" value={cisPackage.formData.ownerManagerName} />
                        <ReadOnlyField label="Title" value={cisPackage.formData.ownerManagerTitle} />
                        <ReadOnlyField label="Email" value={cisPackage.formData.ownerManagerEmail} />
                        <ReadOnlyField label="Cell phone" value={cisPackage.formData.ownerManagerCellPhone} />
                      </SimpleGrid>

                      <Divider />

                      <Text fw={600} size="sm" c="blue.7">Business Information as Registered</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        <ReadOnlyField label="Legal company name" value={cisPackage.formData.legalCompanyName} />
                        <ReadOnlyField label="Company phone" value={cisPackage.formData.companyPhone} />
                        <ReadOnlyField label="Type of business" value={cisPackage.formData.typeOfBusiness} />
                        <ReadOnlyField label="Physical address" value={formatAddress(cisPackage.formData.physicalAddress, cisPackage.formData.physicalCity, cisPackage.formData.physicalState, cisPackage.formData.physicalZip)} />
                        <ReadOnlyField label="Billing address" value={formatAddress(cisPackage.formData.billingAddress, cisPackage.formData.billingCity, cisPackage.formData.billingState, cisPackage.formData.billingZip)} />
                        <ReadOnlyField label="Time in business" value={formatTenure(cisPackage.formData.yearsInBusiness, cisPackage.formData.monthsInBusiness)} />
                      </SimpleGrid>
                    </Stack>
                  </Tabs.Panel>

                  <Tabs.Panel value="ordering" pt="md">
                    <Stack gap="md">
                      <Text fw={600} size="sm" c="blue.7">Who Will Be Ordering and Accounts Payable</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        <ReadOnlyField label="Ordering contact" value={cisPackage.formData.orderingContactName} />
                        <ReadOnlyField label="Ordering contact cell" value={cisPackage.formData.orderingContactCellPhone} />
                        <ReadOnlyField label="Ordering contact email" value={cisPackage.formData.orderingContactEmail} />
                        <ReadOnlyField label="Accounts payable" value={cisPackage.formData.apContactName} />
                        <ReadOnlyField label="AP direct phone" value={cisPackage.formData.apDirectPhone} />
                        <ReadOnlyField label="AP email" value={cisPackage.formData.apEmail} />
                      </SimpleGrid>
                    </Stack>
                  </Tabs.Panel>

                  <Tabs.Panel value="payment" pt="md">
                    <Stack gap="md">
                      <Text fw={600} size="sm" c="blue.7">Payment Authorization</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
                        <ReadOnlyField label="Preferred payment method" value={formatPaymentMethod(cisPackage.formData.paymentMethod)} />
                        <ReadOnlyField label="ACH authorized" value={cisPackage.formData.achAuthorized ? 'Yes' : 'No'} />
                        <ReadOnlyField label="Card on file authorized" value={cisPackage.formData.cardOnFileAuthorized ? 'Yes' : 'No'} />
                        <ReadOnlyField label="Resale certificate attached" value={cisPackage.formData.resaleCertificateAttached ? 'Yes' : 'No'} />
                        <ReadOnlyField label="Signature captured" value={cisPackage.formData.signatureCapturedAt ? formatDateTimeLabel(cisPackage.formData.signatureCapturedAt) : 'Pending'} />
                        <ReadOnlyField label="Prospect last saved" value={formatOptionalDate(cisPackage.formData.lastSavedAt)} />
                      </SimpleGrid>
                    </Stack>
                  </Tabs.Panel>
                </Tabs>
              </Stack>
            </Card>

            <Card withBorder radius="xl" p="lg">
              <Stack gap="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" color="teal" variant="light" radius="xl">
                    <IconClipboardCheck size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>Step 3. Internal review and finance</Text>
                    <Text size="xs" c="dimmed">Keep the send, sign-off, and finance actions in one structured workspace instead of a separate mini-app.</Text>
                  </div>
                </Group>

                <SimpleGrid cols={{ base: 1, xl: canDecideFinance ? 3 : 2 }} spacing="md">
                  <Card withBorder radius="xl" p="md">
                    <Stack gap="sm">
                      <Text fw={600}>Sales / BD review</Text>
                      <Textarea
                        label="Review notes"
                        value={salesReviewNotes}
                        onChange={(event) => setSalesReviewNotes(event.currentTarget.value)}
                        placeholder="Capture completeness, corrections, and prospect follow-up context."
                        minRows={4}
                        disabled={!canManageCis || leadLifecycleLocked || isSigningOff}
                      />
                      <Textarea
                        label="Finance cover notes"
                        value={financeCoverNotes}
                        onChange={(event) => setFinanceCoverNotes(event.currentTarget.value)}
                        placeholder="Summarize the ask for finance review."
                        minRows={4}
                        disabled={!canManageCis || leadLifecycleLocked || isSigningOff}
                      />
                      <Button
                        onClick={() => {
                          void handleReviewSignoff();
                        }}
                        loading={isSigningOff}
                        disabled={!canManageCis || leadLifecycleLocked || !['submitted', 'review_in_progress', 'sales_signed_off'].includes(cisPackage.status)}
                      >
                        Record sales sign-off
                      </Button>
                    </Stack>
                  </Card>

                  <Card withBorder radius="xl" p="md">
                    <Stack gap="sm">
                      <Text fw={600}>Finance submission</Text>
                      <Textarea
                        label="Submission notes"
                        value={financeSubmissionNotes}
                        onChange={(event) => setFinanceSubmissionNotes(event.currentTarget.value)}
                        placeholder="Explain the requested terms or any review caveats."
                        minRows={4}
                        disabled={!canManageCis || leadLifecycleLocked || isSubmittingFinance}
                      />
                      <ReadOnlyField label="Sales sign-off" value={formatOptionalDate(cisPackage.salesSignedOffAt)} />
                      <ReadOnlyField label="Submitted to finance" value={formatOptionalDate(cisPackage.financeSubmittedAt)} />
                      <Button
                        onClick={() => {
                          void handleSubmitToFinance();
                        }}
                        loading={isSubmittingFinance}
                        disabled={!canManageCis || leadLifecycleLocked || !['sales_signed_off', 'finance_pending'].includes(cisPackage.status)}
                      >
                        Submit to finance
                      </Button>
                    </Stack>
                  </Card>

                  {canDecideFinance ? (
                    <Card withBorder radius="xl" p="md">
                      <Stack gap="sm">
                        <Text fw={600}>Finance decision</Text>
                        <Select
                          label="Decision"
                          value={financeDecision}
                          onChange={(value) => {
                            if (value) {
                              setFinanceDecision(value as FinanceDecisionState);
                            }
                          }}
                          data={FINANCE_DECISION_OPTIONS}
                          disabled={leadLifecycleLocked || isRecordingDecision}
                        />
                        {requiresCreditTerms ? (
                          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            <TextInput
                              label="Credit line amount"
                              value={creditLineAmount}
                              onChange={(event) => setCreditLineAmount(event.currentTarget.value)}
                              placeholder="50000"
                              disabled={leadLifecycleLocked || isRecordingDecision}
                            />
                            <Select
                              label="Payment terms"
                              value={paymentTerms}
                              onChange={(value) => {
                                if (value) {
                                  setPaymentTerms(value as CisPaymentTermsKey);
                                }
                              }}
                              data={PAYMENT_TERM_OPTIONS.map((option) => ({
                                value: option,
                                label: formatPaymentTerms(option),
                              }))}
                              disabled={leadLifecycleLocked || isRecordingDecision}
                            />
                          </SimpleGrid>
                        ) : null}
                        <Textarea
                          label="Decision notes"
                          value={financeDecisionNotes}
                          onChange={(event) => setFinanceDecisionNotes(event.currentTarget.value)}
                          placeholder="Capture approval terms, conditions, or decline reasons."
                          minRows={3}
                          disabled={leadLifecycleLocked || isRecordingDecision}
                        />
                        {(financeDecision === 'conditional' || financeDecision === 'info_requested') ? (
                          <Textarea
                            label="Requested information"
                            value={requestedInfoNotes}
                            onChange={(event) => setRequestedInfoNotes(event.currentTarget.value)}
                            placeholder="List the information or corrections finance still needs."
                            minRows={3}
                            disabled={leadLifecycleLocked || isRecordingDecision}
                          />
                        ) : null}
                        <Button
                          onClick={() => {
                            void handleFinanceDecision();
                          }}
                          loading={isRecordingDecision}
                          disabled={leadLifecycleLocked || !['finance_pending', 'finance_approved', 'finance_declined'].includes(cisPackage.status)}
                        >
                          Record finance decision
                        </Button>
                      </Stack>
                    </Card>
                  ) : null}
                </SimpleGrid>

                <Card withBorder radius="xl" p="md">
                  <Stack gap="sm">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={600}>Hosted payment capture</Text>
                        <Text size="sm" c="dimmed">
                          Keep card and bank details outside Pulse. Finance can record when hosted capture is requested and store only the tokenized provider reference once it is approved.
                        </Text>
                      </div>
                      <Badge color={paymentStatusColor(cisPackage.paymentStatus)} variant="light">
                        {formatPaymentStatus(cisPackage.paymentStatus)}
                      </Badge>
                    </Group>

                    <Alert color="blue" icon={<IconCreditCard size={16} />}>
                      Pulse does not store raw card or bank details here. This lane tracks hosted capture progress and masked/tokenized vault outcomes only.
                    </Alert>

                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                      <ReadOnlyField label="Payment method" value={formatPaymentMethod(cisPackage.formData.paymentMethod)} />
                      <ReadOnlyField label="Vault references" value={String(cisPackage.paymentVaultReferences.length)} />
                      <ReadOnlyField
                        label="Latest hosted attempt"
                        value={latestCaptureAttempt ? `${formatCaptureAttemptStatus(latestCaptureAttempt.status)} • ${formatDateTimeLabel(latestCaptureAttempt.createdAt)}` : '—'}
                      />
                    </SimpleGrid>

                    {cisPackage.paymentCaptureAttempts.length > 0 ? (
                      <Stack gap="xs">
                        <Text fw={600}>Hosted capture attempts</Text>
                        {cisPackage.paymentCaptureAttempts.map((attempt) => (
                          <Card key={attempt.id} withBorder radius="lg" p="sm">
                            <Group justify="space-between" align="flex-start">
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Badge color="blue" variant="light">{formatVaultProvider(attempt.provider)}</Badge>
                                  <Badge color={captureAttemptColor(attempt.status)} variant="light">{formatCaptureAttemptStatus(attempt.status)}</Badge>
                                  {attempt.providerResultCode ? <Badge color="gray" variant="light">Code {attempt.providerResultCode}</Badge> : null}
                                  {attempt.bin ? <Badge color="teal" variant="light">BIN {attempt.bin}</Badge> : null}
                                </Group>
                                <Text size="sm" c="dimmed">
                                  Temporary token present: {attempt.hasTemporaryToken ? 'Yes' : 'No'}
                                  {attempt.providerErrorMessage ? ` • ${attempt.providerErrorMessage}` : ''}
                                </Text>
                              </Stack>
                              <Text size="sm" c="dimmed">
                                {attempt.completedAt ? formatDateTimeLabel(attempt.completedAt) : formatDateTimeLabel(attempt.launchedAt)}
                              </Text>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    ) : null}

                    {cisPackage.paymentVaultReferences.length > 0 ? (
                      <Stack gap="xs">
                        {cisPackage.paymentVaultReferences.map((reference) => (
                          <Card key={reference.id} withBorder radius="lg" p="sm">
                            <Group justify="space-between" align="flex-start">
                              <Stack gap={2}>
                                <Group gap="xs">
                                  <Badge color="blue" variant="light">{formatVaultProvider(reference.provider)}</Badge>
                                  <Badge color="grape" variant="light">{reference.status}</Badge>
                                  {reference.last4 ? <Badge color="gray" variant="light">•••• {reference.last4}</Badge> : null}
                                  {reference.brand ? <Badge color="teal" variant="light">{reference.brand}</Badge> : null}
                                </Group>
                                <Text size="sm" c="dimmed">
                                  Stored as masked/tokenized provider data only. Vault token present: {reference.hasVaultToken ? 'Yes' : 'No'} • Customer ref present: {reference.hasVaultCustomerRef ? 'Yes' : 'No'}
                                </Text>
                              </Stack>
                              <Text size="sm" c="dimmed">
                                {reference.authorizationCapturedAt ? formatDateTimeLabel(reference.authorizationCapturedAt) : formatDateTimeLabel(reference.createdAt)}
                              </Text>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No tokenized vault reference has been recorded on this CIS package yet.
                      </Text>
                    )}

                    {canDecideFinance ? (
                      <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="md">
                        <Card withBorder radius="xl" p="md">
                          <Stack gap="sm">
                            <Text fw={600}>1. Request hosted capture</Text>
                            <Text size="sm" c="dimmed">
                              Launch the secure Moneris hosted frame when runtime is enabled, or keep using the manual tracking lane while the provider step stays outside Pulse.
                            </Text>
                            <Textarea
                              label="Capture request note"
                              value={paymentCaptureNote}
                              onChange={(event) => setPaymentCaptureNote(event.currentTarget.value)}
                              placeholder="Capture who is handling the hosted request or any follow-up required."
                              minRows={3}
                              disabled={!canTrackHostedPaymentCapture || isRequestingPaymentCapture}
                            />
                            <Group>
                              <Button
                                onClick={() => {
                                  void handleLaunchMonerisHostedCapture();
                                }}
                                loading={isLaunchingHostedCapture}
                                disabled={!canTrackHostedPaymentCapture}
                              >
                                Launch Moneris hosted capture
                              </Button>
                              <Button
                                variant="light"
                                onClick={() => {
                                  void handleRequestPaymentCapture();
                                }}
                                loading={isRequestingPaymentCapture}
                                disabled={!canTrackHostedPaymentCapture}
                              >
                                Mark hosted capture requested
                              </Button>
                            </Group>
                            <Text size="xs" c="dimmed">
                              Launch is for the real secure frame. Manual request recording is still useful when finance completes hosted capture outside Pulse.
                            </Text>
                          </Stack>
                        </Card>

                        <Card withBorder radius="xl" p="md">
                          <Stack gap="sm">
                            <Text fw={600}>2. Record tokenized vault outcome</Text>
                            <Text size="sm" c="dimmed">
                              Record the provider reference after hosted capture succeeds. Raw payment details still stay outside Pulse.
                            </Text>

                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                              <Select
                                label="Provider"
                                value={vaultProvider}
                                onChange={(value) => {
                                  if (value) {
                                    setVaultProvider(value as CisPaymentVaultProviderKey);
                                  }
                                }}
                                data={PAYMENT_VAULT_PROVIDER_OPTIONS}
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                              <Select
                                label="Vault status"
                                value={vaultStatus}
                                onChange={(value) => {
                                  if (value) {
                                    setVaultStatus(value as (typeof PAYMENT_VAULT_STATUS_OPTIONS)[number]['value']);
                                  }
                                }}
                                data={PAYMENT_VAULT_STATUS_OPTIONS.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                }))}
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                              <TextInput
                                label="Vault token"
                                value={vaultToken}
                                onChange={(event) => setVaultToken(event.currentTarget.value)}
                                placeholder="tok_..."
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                              <TextInput
                                label="Vault customer ref"
                                value={vaultCustomerRef}
                                onChange={(event) => setVaultCustomerRef(event.currentTarget.value)}
                                placeholder="cust_..."
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                              <TextInput
                                label="Last 4"
                                value={vaultLast4}
                                onChange={(event) => setVaultLast4(event.currentTarget.value)}
                                placeholder="4242"
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                              <TextInput
                                label="Brand"
                                value={vaultBrand}
                                onChange={(event) => setVaultBrand(event.currentTarget.value)}
                                placeholder="Visa"
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                              <TextInput
                                label="Authorization captured at"
                                value={vaultAuthorizationCapturedAt}
                                onChange={(event) => setVaultAuthorizationCapturedAt(event.currentTarget.value)}
                                placeholder="2026-04-17T10:30:00.000Z"
                                disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                              />
                            </SimpleGrid>

                            <Textarea
                              label="Finance note"
                              value={vaultReferenceNote}
                              onChange={(event) => setVaultReferenceNote(event.currentTarget.value)}
                              placeholder="Capture any provider or hosted-checkout context worth retaining in the CIS audit trail."
                              minRows={3}
                              disabled={!canTrackHostedPaymentCapture || isRecordingVaultReference}
                            />

                            <Button
                              onClick={() => {
                                void handleRecordPaymentVaultReference();
                              }}
                              loading={isRecordingVaultReference}
                              disabled={!canTrackHostedPaymentCapture}
                            >
                              Record vault reference
                            </Button>
                          </Stack>
                        </Card>
                      </SimpleGrid>
                    ) : (
                      <Text size="sm" c="dimmed">
                        Finance-only roles can request hosted capture and record the resulting tokenized provider reference here once the external step is complete.
                      </Text>
                    )}
                  </Stack>
                </Card>
              </Stack>
            </Card>

            {scannedCisFallbackCard}

            {cisPackage.events.length > 0 ? (
              <Card withBorder radius="xl" p="lg">
                <Stack gap="sm">
                  <Group gap="xs">
                    <ThemeIcon size="lg" color="gray" variant="light" radius="xl">
                      <IconMail size={18} />
                    </ThemeIcon>
                    <Text fw={700}>CIS timeline</Text>
                  </Group>
                  {cisPackage.events.slice(0, 6).map((event, index) => (
                    <Stack key={event.id} gap={6}>
                      {index > 0 ? <Divider /> : null}
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={2}>
                          <Text fw={600}>{formatCisEvent(event.eventType)}</Text>
                          <Text size="sm" c="dimmed">{event.note ?? 'No note captured for this step.'}</Text>
                        </Stack>
                        <Text size="sm" c="dimmed">{formatDateTimeLabel(event.occurredAt)}</Text>
                      </Group>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder radius="xl" p="md" className="premium-stat-card">
      <Stack gap={4}>
        <Text size="xs" tt="uppercase" fw={700} c="dimmed">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Card>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | undefined }) {
  return (
    <Stack gap={2}>
      <Text size="xs" tt="uppercase" fw={700} c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value && value.trim() ? value : '—'}
      </Text>
    </Stack>
  );
}

function captureAttemptColor(status: CisPaymentCaptureAttemptRecord['status']) {
  switch (status) {
    case 'token_received':
    case 'consumed':
      return 'green';
    case 'failed':
    case 'expired':
      return 'red';
    case 'cancelled':
      return 'gray';
    default:
      return 'yellow';
  }
}

function formatCaptureAttemptStatus(status: CisPaymentCaptureAttemptRecord['status']) {
  switch (status) {
    case 'token_received':
      return 'Temporary token received';
    default:
      return status.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  }
}

function parseMonerisHostedCaptureMessage(data: unknown): {
  responseCode?: string;
  errorMessage?: string;
  temporaryToken?: string;
  bin?: string;
  rawProviderPayload?: Record<string, unknown>;
} | null {
  const normalized = normalizeMonerisPayloadRecord(data);
  if (!normalized) {
    return null;
  }

  const responseCode = readOptionalString(normalized.responseCode);
  const errorMessage = readOptionalString(normalized.errorMessage);
  const temporaryToken = readOptionalString(normalized.dataKey) ?? readOptionalString(normalized.temporaryToken);
  const bin = readOptionalString(normalized.bin);

  if (!responseCode && !errorMessage && !temporaryToken && !bin) {
    return null;
  }

  return {
    ...(responseCode ? { responseCode } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    ...(temporaryToken ? { temporaryToken } : {}),
    ...(bin ? { bin } : {}),
    rawProviderPayload: normalized,
  };
}

function normalizeMonerisPayloadRecord(value: unknown): Record<string, unknown> | null {
  if (isObjectRecord(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (isObjectRecord(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to query-string parsing.
  }

  const params = new URLSearchParams(trimmed);
  if (params.size === 0) {
    return null;
  }

  const record: Record<string, unknown> = {};
  for (const [key, entry] of params.entries()) {
    record[key] = entry;
  }
  return record;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function statusColor(status: CisPackageDetail['status']) {
  switch (status) {
    case 'finance_approved':
    case 'completed':
      return 'green';
    case 'sales_signed_off':
    case 'finance_pending':
      return 'blue';
    case 'submitted':
    case 'review_in_progress':
      return 'yellow';
    case 'finance_declined':
      return 'red';
    default:
      return 'gray';
  }
}

function formatCisStatus(status: CisPackageDetail['status']) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatLeadStage(stage: LeadDetail['stage']) {
  return stage.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatFinanceDecisionStatus(status: CisFinanceDecisionStatusKey) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatPaymentMethod(value: CisPaymentMethodKey | undefined) {
  if (!value) {
    return 'Not selected';
  }

  return value === 'CREDIT_CARD' ? 'Credit Card' : value.replace('_', ' ');
}

function formatPaymentTerms(value: CisPaymentTermsKey) {
  return value.replace('_', ' ');
}

function formatPaymentStatus(value: CisPackageDetail['paymentStatus']) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (entry) => entry.toUpperCase());
}

function paymentStatusColor(value: CisPackageDetail['paymentStatus']) {
  switch (value) {
    case 'vault_complete':
      return 'green';
    case 'vault_pending':
      return 'yellow';
    case 'not_required':
      return 'gray';
    default:
      return 'blue';
  }
}

function formatVaultProvider(value: CisPaymentVaultProviderKey) {
  switch (value) {
    case 'ebizcharge':
      return 'eBizCharge';
    case 'moneris':
      return 'Moneris';
    default:
      return 'Unknown / Other';
  }
}

function formatDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatOptionalDate(value?: string) {
  return value ? formatDateTimeLabel(value) : '—';
}

function formatOptionalNumber(value?: number) {
  return value !== undefined ? String(value) : '—';
}

function formatTenure(years?: number, months?: number) {
  if (years === undefined && months === undefined) {
    return '—';
  }

  return `${years ?? 0} years / ${months ?? 0} months`;
}

function formatAddress(address?: string, city?: string, state?: string, zip?: string) {
  const parts = [address, city, state, zip].filter((value) => value && value.trim());
  return parts.length > 0 ? parts.join(', ') : '—';
}

function formatCisEvent(eventType: string) {
  return eventType.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function parseOptionalJsonObject(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${label} must be valid JSON: ${error.message}`
        : `${label} must be valid JSON`,
    );
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

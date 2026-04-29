import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import { Prisma, prisma } from '@pulse/db';
import type {
  LeadImportDuplicateCandidate,
  LeadOcrCapturedField,
  LeadOcrCapturedLeadFields,
  LeadOcrCaptureDocumentTypeKey,
  LeadOcrExtractionModeKey,
  PreviewLeadDuplicateCandidatesResponse,
  PreviewLeadOcrCaptureRequest,
  PreviewLeadOcrCaptureResponse,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { resolveLeadRecordScope } from '../auth/visibility.js';
import { normalizeEmailAddress, optionalTrimmed } from './shared.js';

const DEFAULT_PARSER_VERSION = 'pymupdf-tesseract-v1';
const LOW_CONFIDENCE_THRESHOLD = 0.65;
const MIN_USEFUL_EXTRACTION_CHARS = 20;

type ProcessorResult = {
  text?: string;
  mode?: LeadOcrExtractionModeKey;
  averageCharsPerPage?: number;
  pagesProcessed?: number;
  error?: string;
};

type AccountOcrDuplicateMatch = Prisma.AccountGetPayload<{
  include: {
    contacts: true;
    locations: true;
  };
}>;

export async function previewLeadOcrCapture(
  actor: AuthenticatedActor,
  input: PreviewLeadOcrCaptureRequest,
): Promise<PreviewLeadOcrCaptureResponse> {
  assertModuleAccess(actor.role, 'leads');
  assertActionAccess(actor.role, 'lead.intake_manage');

  const parserVersion = optionalTrimmed(input.parserVersion) ?? DEFAULT_PARSER_VERSION;
  const documentType = normalizeDocumentType(input.documentType);
  const extraction = await extractOcrText(input);
  const rawExtractionText = optionalTrimmed(extraction.text) ?? '';
  const fields = extractLeadFields(rawExtractionText, input.serviceTechCountFallback);
  const duplicatePreview = await previewExtractedDuplicateCandidates(actor, fields);
  const reviewReasons = buildReviewReasons(rawExtractionText, fields, duplicatePreview);
  const lowConfidence =
    reviewReasons.length > 0
    || Object.values(fields).some((field) => field && field.confidence < LOW_CONFIDENCE_THRESHOLD);

  return {
    parserVersion,
    documentType,
    extractionMode: extraction.mode ?? 'manual_text',
    rawExtractionText,
    ...(extraction.averageCharsPerPage !== undefined ? { averageCharsPerPage: extraction.averageCharsPerPage } : {}),
    ...(extraction.pagesProcessed !== undefined ? { pagesProcessed: extraction.pagesProcessed } : {}),
    lowConfidence,
    reviewReasons,
    fields,
    duplicatePreview,
  };
}

async function extractOcrText(input: PreviewLeadOcrCaptureRequest): Promise<ProcessorResult> {
  const rawExtractionText = optionalTrimmed(input.rawExtractionText);
  if (rawExtractionText) {
    return {
      text: rawExtractionText,
      mode: 'manual_text',
      pagesProcessed: 1,
    };
  }

  const contentBase64 = optionalTrimmed(input.contentBase64);
  if (!contentBase64) {
    throw new Error('Either rawExtractionText or contentBase64 is required for lead OCR preview');
  }

  const processorPath = resolveOcrProcessorPath();
  const pythonBinary = process.env.PULSE_OCR_PYTHON_BIN || 'python3';
  const stdout = await runOcrProcessor(pythonBinary, processorPath, {
    contentBase64,
    fileName: optionalTrimmed(input.fileName) ?? 'lead-ocr-upload',
    mimeType: optionalTrimmed(input.mimeType) ?? 'application/octet-stream',
  });
  const parsed = JSON.parse(stdout) as ProcessorResult;
  if (parsed.error) {
    throw new Error(`OCR processor failed: ${parsed.error}`);
  }
  return parsed;
}

async function runOcrProcessor(
  pythonBinary: string,
  processorPath: string,
  payload: {
    contentBase64: string;
    fileName: string;
    mimeType: string;
  },
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBinary, [processorPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('OCR processor timed out'));
    }, 30_000);
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 5 * 1024 * 1024) {
        child.kill('SIGKILL');
        reject(new Error('OCR processor output exceeded 5MB'));
      }
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `OCR processor exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

function resolveOcrProcessorPath() {
  const configured = optionalTrimmed(process.env.PULSE_OCR_PROCESSOR_PATH);
  if (configured) {
    return configured;
  }

  const candidates = [
    path.resolve(process.cwd(), 'apps/api/scripts/ocr_processor.py'),
    path.resolve(process.cwd(), 'scripts/ocr_processor.py'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error('OCR processor script not found; set PULSE_OCR_PROCESSOR_PATH');
  }
  return match;
}

function normalizeDocumentType(value: PreviewLeadOcrCaptureRequest['documentType']): LeadOcrCaptureDocumentTypeKey {
  switch (value) {
    case 'business_card':
    case 'show_badge':
    case 'handwritten_note':
    case 'other':
      return value;
    case undefined:
      return 'business_card';
    default:
      throw new Error(`Unsupported lead OCR document type: ${value}`);
  }
}

function extractLeadFields(text: string, serviceTechCountFallback?: number): LeadOcrCapturedLeadFields {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const emailCandidate = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const email = emailCandidate ? normalizeEmailAddress(emailCandidate) : undefined;
  const phone = optionalTrimmed(text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0]);
  const state = extractState(text);
  const website = optionalTrimmed(text.match(/\b(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?\b/i)?.[0]);
  const companyName = extractCompanyName(lines, email, website);
  const contactDisplayName = extractContactName(lines, companyName);
  const serviceTechCount = normalizeServiceTechFallback(serviceTechCountFallback);

  return {
    ...(companyName ? { companyName: field(companyName, 0.7) } : {}),
    ...(contactDisplayName ? { contactDisplayName: field(contactDisplayName, 0.62) } : {}),
    ...(email ? { email: field(email, 0.94) } : {}),
    ...(phone ? { phone: field(phone, 0.82) } : {}),
    ...(state ? { state: field(state, 0.7) } : {}),
    ...(website ? { website: field(website, 0.72) } : {}),
    ...(serviceTechCount !== undefined
      ? { serviceTechCount: { value: serviceTechCount, confidence: 0.35, source: 'operator_default' } }
      : {}),
  };
}

function field(value: string, confidence: number): LeadOcrCapturedField {
  return {
    value,
    confidence,
    source: 'ocr',
  };
}

function normalizeServiceTechFallback(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function extractCompanyName(lines: string[], email?: string, website?: string) {
  const ignored = new Set(['inc', 'llc', 'corp', 'corporation', 'company']);
  const candidate = lines.find((line) => {
    const normalized = line.toLowerCase();
    return line.length >= 3
      && !email?.toLowerCase().includes(normalized)
      && !website?.toLowerCase().includes(normalized)
      && !/@/.test(line)
      && !/\d{3}[\s.-]?\d{3}[\s.-]?\d{4}/.test(line)
      && !ignored.has(normalized);
  });
  return optionalTrimmed(candidate);
}

function extractContactName(lines: string[], companyName?: string) {
  const candidate = lines.find((line) => {
    if (companyName && line === companyName) {
      return false;
    }
    return /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line);
  });
  return optionalTrimmed(candidate);
}

function extractState(text: string) {
  const stateMatch = text.match(/\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/);
  return optionalTrimmed(stateMatch?.[0]);
}

async function previewExtractedDuplicateCandidates(
  actor: AuthenticatedActor,
  fields: LeadOcrCapturedLeadFields,
): Promise<PreviewLeadDuplicateCandidatesResponse> {
  const email = optionalTrimmed(typeof fields.email?.value === 'string' ? fields.email.value : undefined);
  const phone = optionalTrimmed(typeof fields.phone?.value === 'string' ? fields.phone.value : undefined);
  const companyName = optionalTrimmed(typeof fields.companyName?.value === 'string' ? fields.companyName.value : undefined);
  const state = optionalTrimmed(typeof fields.state?.value === 'string' ? fields.state.value : undefined);
  const duplicateSignals = buildDuplicateSignals({
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(companyName !== undefined ? { companyName } : {}),
    ...(state !== undefined ? { state } : {}),
  });

  if (duplicateSignals.length === 0) {
    return {
      hasPotentialDuplicate: false,
      candidates: [],
    };
  }

  const leadScope = await resolveLeadRecordScope(actor);
  const scopedLeadWhere: Prisma.LeadWhereInput = leadScope
    ? { AND: [{ OR: duplicateSignals.leadSignals }, leadScope] }
    : { OR: duplicateSignals.leadSignals };

  const leadMatches = duplicateSignals.leadSignals.length > 0
    ? await prisma.lead.findMany({
        where: scopedLeadWhere,
        take: 10,
        orderBy: { updatedAt: 'desc' },
      })
    : [];
  const accountMatches: AccountOcrDuplicateMatch[] = duplicateSignals.accountSignals.length > 0
    ? await prisma.account.findMany({
        where: { OR: duplicateSignals.accountSignals },
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          contacts: {
            where: {
              OR: [
                ...(email ? [{ email: { equals: email, mode: Prisma.QueryMode.insensitive } }] : []),
                ...(phone ? [{ phone }] : []),
              ],
            },
            take: 1,
          },
          locations: {
            where: {
              isPrimary: true,
            },
            take: 1,
          },
        },
      })
    : [];

  const candidates: LeadImportDuplicateCandidate[] = [
    ...leadMatches.map((lead) => ({
      entityType: 'lead' as const,
      entityId: lead.id,
      title: lead.companyName,
      subtitle: `Lead ${lead.stage.toLowerCase()} · ${lead.lifecycleStatus.toLowerCase()}`,
      detail: [lead.email, lead.phone, lead.state].filter(Boolean).join(' · '),
    })),
    ...accountMatches.map((account) => ({
      entityType: 'account' as const,
      entityId: account.id,
      title: account.displayName,
      subtitle: `Customer account · ${account.lifecycleStatus.toLowerCase()}`,
      detail: [
        account.contacts[0]?.email,
        account.contacts[0]?.phone,
        account.contacts[0]?.mobilePhone,
        account.locations[0]?.state,
      ].filter(Boolean).join(' · '),
    })),
  ];

  return {
    hasPotentialDuplicate: candidates.length > 0,
    candidates,
  };
}

function buildDuplicateSignals(input: {
  email?: string;
  phone?: string;
  companyName?: string;
  state?: string;
}) {
  const leadSignals: Prisma.LeadWhereInput[] = [];
  const accountSignals: Prisma.AccountWhereInput[] = [];

  if (input.email) {
    leadSignals.push({ email: { equals: input.email, mode: Prisma.QueryMode.insensitive } });
    accountSignals.push({
      contacts: { some: { email: { equals: input.email, mode: Prisma.QueryMode.insensitive } } },
    });
  }
  if (input.phone) {
    leadSignals.push({ phone: input.phone });
    accountSignals.push({
      contacts: { some: { OR: [{ phone: input.phone }, { mobilePhone: input.phone }] } },
    });
  }
  if (input.companyName && input.state) {
    leadSignals.push({
      AND: [
        { companyName: { equals: input.companyName, mode: Prisma.QueryMode.insensitive } },
        { state: input.state },
      ],
    });
    accountSignals.push({
      AND: [
        { displayName: { equals: input.companyName, mode: Prisma.QueryMode.insensitive } },
        { locations: { some: { state: input.state } } },
      ],
    });
  }

  return { leadSignals, accountSignals, length: leadSignals.length + accountSignals.length };
}

function buildReviewReasons(
  rawExtractionText: string,
  fields: LeadOcrCapturedLeadFields,
  duplicatePreview: PreviewLeadDuplicateCandidatesResponse,
) {
  const reasons: string[] = [];
  if (rawExtractionText.length < MIN_USEFUL_EXTRACTION_CHARS) {
    reasons.push('OCR text is too short to trust without manual review.');
  }
  if (!fields.companyName) {
    reasons.push('Company name was not confidently detected.');
  }
  if (!fields.email && !fields.phone) {
    reasons.push('No email or phone was detected for duplicate matching.');
  }
  if (!fields.serviceTechCount) {
    reasons.push('Service tech count is still required before lead creation/routing.');
  }
  if (duplicatePreview.hasPotentialDuplicate) {
    reasons.push('Potential duplicate lead/account candidates were found.');
  }
  return reasons;
}

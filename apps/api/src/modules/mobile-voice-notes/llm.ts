import type { AppConfig } from '../../config.js';
import type { MobileVoiceNoteStructuredData } from '@pulse/contracts/mobile-voice-notes';

export type VoiceNoteStructureInput = {
  transcriptText?: string | undefined;
  audio?: {
    fileName: string;
    mimeType: string;
    contentBase64: string;
  } | undefined;
};

export type VoiceNoteStructureResult = {
  rawTranscript?: string | undefined;
  structuredData?: MobileVoiceNoteStructuredData | undefined;
  provider: 'openai' | 'heuristic' | 'disabled';
  model?: string | undefined;
  status: 'structured' | 'needs_review' | 'failed';
  errorMessage?: string | undefined;
};

type OpenAiResponsesResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type OpenAiTranscriptionResponse = {
  text?: string;
};

export async function structureVoiceNote(
  config: AppConfig,
  input: VoiceNoteStructureInput,
): Promise<VoiceNoteStructureResult> {
  const transcriptFromInput = normalizeTranscript(input.transcriptText);
  const aiConfig = config.ai.voiceNotes;
  let rawTranscript = transcriptFromInput;
  let transcriptionError: string | undefined;

  if (!rawTranscript && input.audio && aiConfig.provider === 'openai' && aiConfig.openaiApiKey) {
    try {
      rawTranscript = normalizeTranscript(await transcribeWithOpenAi(config, input.audio));
    } catch (error) {
      transcriptionError = error instanceof Error ? error.message : 'Audio transcription failed';
    }
  }

  if (rawTranscript && aiConfig.provider === 'openai' && aiConfig.openaiApiKey) {
    try {
      const structuredData = await structureWithOpenAi(config, rawTranscript);
      return {
        rawTranscript,
        structuredData,
        provider: 'openai',
        model: aiConfig.structureModel,
        status: 'structured',
      };
    } catch (error) {
      const fallback = buildHeuristicStructuredNote(rawTranscript);
      return {
        rawTranscript,
        structuredData: fallback,
        provider: 'heuristic',
        model: 'local-keyword-parser',
        status: 'needs_review',
        errorMessage: error instanceof Error ? error.message : 'OpenAI structuring failed',
      };
    }
  }

  if (rawTranscript) {
    return {
      rawTranscript,
      structuredData: buildHeuristicStructuredNote(rawTranscript),
      provider: aiConfig.provider === 'disabled' ? 'disabled' : 'heuristic',
      model: 'local-keyword-parser',
      status: 'needs_review',
      errorMessage: aiConfig.provider === 'disabled'
        ? 'Voice note AI provider is disabled; local structure needs office review.'
        : undefined,
    };
  }

  return {
    provider: aiConfig.provider === 'openai' ? 'openai' : 'disabled',
    model: aiConfig.provider === 'openai' ? aiConfig.transcriptionModel : undefined,
    status: 'needs_review',
    errorMessage: transcriptionError ?? 'Audio was saved, but no transcript is available yet.',
  };
}

export function buildHeuristicStructuredNote(rawText: string): MobileVoiceNoteStructuredData {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  const tags = inferTags(normalized);
  const nextStep = inferNextStep(normalized);
  return {
    summary: summarize(normalized),
    sentiment: inferSentiment(normalized),
    tags,
    rawText: normalized,
    confidence: normalized.length > 80 ? 'medium' : 'low',
    ...(nextStep ? { nextStep } : {}),
  };
}

async function transcribeWithOpenAi(
  config: AppConfig,
  audio: NonNullable<VoiceNoteStructureInput['audio']>,
) {
  const aiConfig = config.ai.voiceNotes;
  const form = new FormData();
  form.set('model', aiConfig.transcriptionModel);
  form.set('file', new Blob([Buffer.from(audio.contentBase64, 'base64')], { type: audio.mimeType }), audio.fileName);

  const response = await fetchWithTimeout(`${aiConfig.openaiBaseUrl.replace(/\/+$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiConfig.openaiApiKey}`,
    },
    body: form,
  }, aiConfig.timeoutMs);
  if (!response.ok) {
    throw new Error(`OpenAI transcription failed with status ${response.status}`);
  }
  const payload = await response.json() as OpenAiTranscriptionResponse;
  if (!payload.text?.trim()) {
    throw new Error('OpenAI transcription returned no text');
  }
  return payload.text;
}

async function structureWithOpenAi(config: AppConfig, rawTranscript: string): Promise<MobileVoiceNoteStructuredData> {
  const aiConfig = config.ai.voiceNotes;
  const response = await fetchWithTimeout(`${aiConfig.openaiBaseUrl.replace(/\/+$/, '')}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aiConfig.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: aiConfig.structureModel,
      reasoning: { effort: 'low' },
      text: {
        verbosity: 'low',
        format: {
          type: 'json_schema',
          name: 'mobile_voice_note_structure',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: {
                type: 'string',
                description: 'One compact CRM-safe summary of the transcript.',
              },
              nextStep: {
                type: 'string',
                description: 'Specific follow-up action from the transcript, or an empty string when absent.',
              },
              sentiment: {
                type: 'string',
                enum: ['positive', 'neutral', 'concern', 'urgent'],
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
              },
              followUpDate: {
                type: 'string',
                description: 'Explicit date/time mentioned for follow-up, or an empty string when absent.',
              },
              entities: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  accounts: { type: 'array', items: { type: 'string' } },
                  people: { type: 'array', items: { type: 'string' } },
                  products: { type: 'array', items: { type: 'string' } },
                },
                required: ['accounts', 'people', 'products'],
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
              },
            },
            required: ['summary', 'nextStep', 'sentiment', 'tags', 'followUpDate', 'entities', 'confidence'],
          },
        },
      },
      input: [
        {
          role: 'system',
          content: [
            'You structure Dynamic AQS territory-manager voice notes for Pulse CRM.',
            'Create a reviewable CRM note payload from only the transcript.',
            'Do not invent facts that are not in the transcript.',
            'Use empty strings or empty arrays when the transcript does not provide a field.',
          ].join(' '),
        },
        {
          role: 'user',
          content: rawTranscript,
        },
      ],
    }),
  }, aiConfig.timeoutMs);
  if (!response.ok) {
    throw new Error(`OpenAI structuring failed with status ${response.status}${await formatOpenAiError(response)}`);
  }

  const payload = await response.json() as OpenAiResponsesResponse;
  const content = extractOpenAiResponseText(payload);
  if (!content) {
    throw new Error('OpenAI structuring returned no content');
  }

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return normalizeStructuredData(parsed, rawTranscript);
}

function extractOpenAiResponseText(payload: OpenAiResponsesResponse) {
  const outputText = payload.output_text?.trim();
  if (outputText) return outputText;
  const nestedText = payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((content) => content.type === 'output_text' && content.text?.trim())
    ?.text
    ?.trim();
  return nestedText || undefined;
}

async function formatOpenAiError(response: Response) {
  const text = await response.text().catch(() => '');
  const message = truncate(text.replace(/\s+/g, ' ').trim(), 240);
  return message ? `: ${message}` : '';
}

function normalizeStructuredData(parsed: Record<string, unknown>, rawText: string): MobileVoiceNoteStructuredData {
  const sentiment = parsed.sentiment === 'positive'
    || parsed.sentiment === 'concern'
    || parsed.sentiment === 'urgent'
    ? parsed.sentiment
    : 'neutral';
  const confidence = parsed.confidence === 'high'
    || parsed.confidence === 'low'
    ? parsed.confidence
    : 'medium';
  const nextStep = boundedString(parsed.nextStep, 300);
  const followUpDate = boundedString(parsed.followUpDate, 40);
  const entities = normalizeEntities(parsed.entities);
  return {
    summary: boundedString(parsed.summary, 600) || summarize(rawText),
    sentiment,
    tags: normalizeTags(parsed.tags),
    rawText,
    confidence,
    ...(nextStep ? { nextStep } : {}),
    ...(followUpDate ? { followUpDate } : {}),
    ...(entities ? { entities } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeTranscript(value: string | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function summarize(value: string) {
  const firstSentence = value.split(/(?<=[.!?])\s+/)[0]?.trim() ?? value;
  return truncate(firstSentence || value, 220);
}

function inferNextStep(value: string) {
  const sentence = value
    .split(/(?<=[.!?])\s+/)
    .find((item) => /\b(follow up|call|email|schedule|send|quote|proposal|training|consignment|visit|tomorrow|next week|asap)\b/i.test(item));
  return sentence ? truncate(sentence.trim(), 220) : undefined;
}

function inferSentiment(value: string): MobileVoiceNoteStructuredData['sentiment'] {
  if (/\b(urgent|asap|blocked|escalate|today|immediately)\b/i.test(value)) return 'urgent';
  if (/\b(issue|problem|concern|frustrated|risk|delay|missing|complaint)\b/i.test(value)) return 'concern';
  if (/\b(great|approved|interested|ready|positive|good|happy)\b/i.test(value)) return 'positive';
  return 'neutral';
}

function inferTags(value: string) {
  const candidates = [
    ['lead', /\blead|prospect|new customer\b/i],
    ['account', /\baccount|dealer|customer\b/i],
    ['training', /\btraining|certification|roster\b/i],
    ['consignment', /\bconsignment|rose|inventory|audit\b/i],
    ['pricing', /\bprice|pricing|quote|discount\b/i],
    ['follow-up', /\bfollow up|call|email|next step\b/i],
    ['product', /\bproduct|sku|model|unit\b/i],
  ] as const;
  return candidates.filter(([, pattern]) => pattern.test(value)).map(([tag]) => tag);
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === 'string' ? item.trim().toLowerCase() : '')
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeEntities(value: unknown): MobileVoiceNoteStructuredData['entities'] | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const accounts = normalizeStringArray(record.accounts);
  const people = normalizeStringArray(record.people);
  const products = normalizeStringArray(record.products);
  const entities: NonNullable<MobileVoiceNoteStructuredData['entities']> = {};
  if (accounts?.length) entities.accounts = accounts;
  if (people?.length) entities.people = people;
  if (products?.length) entities.products = products;
  if (!entities.accounts?.length && !entities.people?.length && !entities.products?.length) return undefined;
  return entities;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .slice(0, 10);
  return items.length ? items : undefined;
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? truncate(value.trim(), maxLength) || undefined : undefined;
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

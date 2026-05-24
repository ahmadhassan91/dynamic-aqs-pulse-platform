import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CreateMobileVoiceNoteRequest,
  ListMobileVoiceNoteReviewQueueRequest,
  ListMobileVoiceNotesRequest,
  ReviewMobileVoiceNoteRequest,
} from '@pulse/contracts/mobile-voice-notes';
import type { AppConfig } from '../../config.js';
import {
  badRequestResponse,
  forbiddenResponse,
  jsonResponse,
  matchPath,
  methodNotAllowedResponse,
  notFoundResponse,
  readIntegerQuery,
  readJsonBody,
  readTrimmedQuery,
  unauthorizedResponse,
} from '../../utils/http.js';
import { isAuthenticationError, isAuthorizationError, requireAuthenticatedActor } from '../auth/request.js';
import {
  createMobileVoiceNote,
  getMobileVoiceNoteDetail,
  listMobileVoiceNoteReviewQueue,
  listMobileVoiceNotes,
  reviewMobileVoiceNote,
} from './service.js';

const VOICE_NOTE_BODY_LIMIT_BYTES = 8 * 1024 * 1024;

export async function handleMobileVoiceNoteRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  config: AppConfig,
) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/v1/mobile/voice-notes') && !pathname.startsWith('/api/v1/mobile-voice-notes')) {
    return false;
  }

  try {
    if (pathname === '/api/v1/mobile-voice-notes/review-queue') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req);
        const query = compact({
          contextType: readTrimmedQuery(url, 'contextType') as ListMobileVoiceNoteReviewQueueRequest['contextType'],
          processingStatus: readTrimmedQuery(url, 'processingStatus') as ListMobileVoiceNoteReviewQueueRequest['processingStatus'],
          reviewStatus: readTrimmedQuery(url, 'reviewStatus') as ListMobileVoiceNoteReviewQueueRequest['reviewStatus'],
          leadId: readTrimmedQuery(url, 'leadId'),
          accountId: readTrimmedQuery(url, 'accountId'),
          trainingSessionId: readTrimmedQuery(url, 'trainingSessionId'),
          consignmentSiteId: readTrimmedQuery(url, 'consignmentSiteId'),
          createdByUserId: readTrimmedQuery(url, 'createdByUserId'),
          search: readTrimmedQuery(url, 'search'),
          limit: readIntegerQuery(url, 'limit'),
        }) as ListMobileVoiceNoteReviewQueueRequest;
        return jsonResponse(res, 200, await listMobileVoiceNoteReviewQueue(actor, query));
      }

      return methodNotAllowedResponse(res, method, ['GET']);
    }

    const reviewMatch = matchPath(pathname, '/api/v1/mobile-voice-notes/:voiceNoteId/review');
    if (reviewMatch) {
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req);
        const body = (await readJsonBody(req, VOICE_NOTE_BODY_LIMIT_BYTES)) as ReviewMobileVoiceNoteRequest;
        return jsonResponse(res, 200, await reviewMobileVoiceNote(actor, reviewMatch.voiceNoteId ?? '', body));
      }

      return methodNotAllowedResponse(res, method, ['POST']);
    }

    const reviewDetailMatch = matchPath(pathname, '/api/v1/mobile-voice-notes/:voiceNoteId');
    if (reviewDetailMatch) {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req);
        const detail = await getMobileVoiceNoteDetail(actor, reviewDetailMatch.voiceNoteId ?? '');
        return detail ? jsonResponse(res, 200, detail) : notFoundResponse(res, 'Voice note was not found.');
      }

      return methodNotAllowedResponse(res, method, ['GET']);
    }

    if (pathname === '/api/v1/mobile/voice-notes') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'mobile' });
        const query = compact({
          contextType: readTrimmedQuery(url, 'contextType') as ListMobileVoiceNotesRequest['contextType'],
          processingStatus: readTrimmedQuery(url, 'processingStatus') as ListMobileVoiceNotesRequest['processingStatus'],
          reviewStatus: readTrimmedQuery(url, 'reviewStatus') as ListMobileVoiceNotesRequest['reviewStatus'],
          leadId: readTrimmedQuery(url, 'leadId'),
          accountId: readTrimmedQuery(url, 'accountId'),
          trainingSessionId: readTrimmedQuery(url, 'trainingSessionId'),
          consignmentSiteId: readTrimmedQuery(url, 'consignmentSiteId'),
          limit: readIntegerQuery(url, 'limit'),
        }) as ListMobileVoiceNotesRequest;
        return jsonResponse(res, 200, await listMobileVoiceNotes(actor, query));
      }

      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'mobile' });
        const body = (await readJsonBody(req, VOICE_NOTE_BODY_LIMIT_BYTES)) as CreateMobileVoiceNoteRequest;
        return jsonResponse(res, 201, await createMobileVoiceNote(config, actor, body));
      }

      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    return methodNotAllowedResponse(res, method, ['GET', 'POST']);
  } catch (error) {
    if (isAuthenticationError(error)) return unauthorizedResponse(res, error.message);
    if (isAuthorizationError(error)) return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    return badRequestResponse(res, error instanceof Error ? error.message : 'Mobile voice note request failed');
  }
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== '')) as T;
}

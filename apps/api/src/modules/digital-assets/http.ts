import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CreateDigitalAssetCollectionRequest,
  CreateDigitalAssetRequest,
  CreateDigitalAssetVersionRequest,
  CreateProductAssetAssignmentRequest,
  UpdateDigitalAssetCollectionRequest,
  UpdateDigitalAssetRequest,
  UpsertDigitalAssetCollectionItemRequest,
  WidenManifestImportRequest,
} from '@pulse/contracts/digital-assets';
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
  createDigitalAssetCollection,
  createDigitalAsset,
  createDigitalAssetVersion,
  assignProductAsset,
  commitWidenManifestImport,
  getDigitalAssetDetail,
  listDigitalAssetCollections,
  listWidenManifestImportRuns,
  listDigitalAssets,
  previewWidenManifestImport,
  removeDigitalAssetCollectionItem,
  unlinkProductAsset,
  updateDigitalAsset,
  updateDigitalAssetCollection,
  upsertDigitalAssetCollectionItem,
} from './service.js';

export async function handleDigitalAssetRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/v1/digital-assets')) {
    return false;
  }

  try {
    if (pathname === '/api/v1/digital-assets/assets' || pathname === '/api/v1/digital-assets') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.view' });
        return jsonResponse(res, 200, await listDigitalAssets(actor, compact({
          search: readTrimmedQuery(url, 'search'),
          kind: readTrimmedQuery(url, 'kind') as any,
          status: readTrimmedQuery(url, 'status') as any,
          visibility: readTrimmedQuery(url, 'visibility') as any,
          brandScope: readTrimmedQuery(url, 'brandScope'),
          regionScope: readTrimmedQuery(url, 'regionScope'),
          dealerGroupId: readTrimmedQuery(url, 'dealerGroupId'),
          sourceSystem: readTrimmedQuery(url, 'sourceSystem') as any,
          limit: readIntegerQuery(url, 'limit'),
        }) as any));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.upload' });
        return jsonResponse(res, 201, await createDigitalAsset(actor, (await readJsonBody(req)) as CreateDigitalAssetRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const assetMatch = matchPath(pathname, '/api/v1/digital-assets/assets/:assetId');
    if (assetMatch) {
      const assetId = assetMatch.assetId;
      if (!assetId) return badRequestResponse(res, 'Digital asset id is required');
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.view' });
        const response = await getDigitalAssetDetail(actor, assetId);
        return response ? jsonResponse(res, 200, response) : notFoundResponse(res, { entity: 'DigitalAsset', id: assetId });
      }
      if (method === 'PATCH') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.edit' });
        return jsonResponse(res, 200, await updateDigitalAsset(actor, assetId, (await readJsonBody(req)) as UpdateDigitalAssetRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'PATCH']);
    }

    const versionMatch = matchPath(pathname, '/api/v1/digital-assets/assets/:assetId/versions');
    if (versionMatch) {
      const assetId = versionMatch.assetId;
      if (!assetId) return badRequestResponse(res, 'Digital asset id is required');
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.upload' });
      return jsonResponse(res, 201, await createDigitalAssetVersion(actor, assetId, (await readJsonBody(req)) as CreateDigitalAssetVersionRequest));
    }

    if (pathname === '/api/v1/digital-assets/collections') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.view' });
        return jsonResponse(res, 200, await listDigitalAssetCollections(actor));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.edit' });
        return jsonResponse(res, 201, await createDigitalAssetCollection(actor, (await readJsonBody(req)) as CreateDigitalAssetCollectionRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const collectionMatch = matchPath(pathname, '/api/v1/digital-assets/collections/:collectionId');
    if (collectionMatch) {
      const collectionId = collectionMatch.collectionId;
      if (!collectionId) return badRequestResponse(res, 'Digital asset collection id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.edit' });
      return jsonResponse(res, 200, await updateDigitalAssetCollection(actor, collectionId, (await readJsonBody(req)) as UpdateDigitalAssetCollectionRequest));
    }

    const collectionItemMatch = matchPath(pathname, '/api/v1/digital-assets/collections/:collectionId/items');
    if (collectionItemMatch) {
      const collectionId = collectionItemMatch.collectionId;
      if (!collectionId) return badRequestResponse(res, 'Digital asset collection id is required');
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.edit' });
      return jsonResponse(res, 201, await upsertDigitalAssetCollectionItem(actor, collectionId, (await readJsonBody(req)) as UpsertDigitalAssetCollectionItemRequest));
    }

    const removeCollectionItemMatch = matchPath(pathname, '/api/v1/digital-assets/collections/:collectionId/items/:assetId');
    if (removeCollectionItemMatch) {
      const collectionId = removeCollectionItemMatch.collectionId;
      const assetId = removeCollectionItemMatch.assetId;
      if (!collectionId || !assetId) return badRequestResponse(res, 'Digital asset collection id and asset id are required');
      if (method !== 'DELETE') return methodNotAllowedResponse(res, method, ['DELETE']);
      const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.edit' });
      return jsonResponse(res, 200, await removeDigitalAssetCollectionItem(actor, collectionId, assetId));
    }

    if (pathname === '/api/v1/digital-assets/product-assignments') {
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.asset_link' });
      return jsonResponse(res, 201, await assignProductAsset(actor, (await readJsonBody(req)) as CreateProductAssetAssignmentRequest));
    }

    const assignmentMatch = matchPath(pathname, '/api/v1/digital-assets/product-assignments/:assignmentId');
    if (assignmentMatch) {
      const assignmentId = assignmentMatch.assignmentId;
      if (!assignmentId) return badRequestResponse(res, 'Product asset assignment id is required');
      if (method !== 'DELETE') return methodNotAllowedResponse(res, method, ['DELETE']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.asset_link' });
      return jsonResponse(res, 200, await unlinkProductAsset(actor, assignmentId));
    }

    if (pathname === '/api/v1/digital-assets/widen-import-preview' || pathname === '/api/v1/digital-assets/widen-manifest/preview') {
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.sync' });
      return jsonResponse(res, 200, await previewWidenManifestImport(actor, (await readJsonBody(req, 10_000_000)) as WidenManifestImportRequest));
    }

    if (pathname === '/api/v1/digital-assets/widen-manifest/commit') {
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.sync' });
      return jsonResponse(res, 201, await commitWidenManifestImport(actor, (await readJsonBody(req, 10_000_000)) as WidenManifestImportRequest));
    }

    if (pathname === '/api/v1/digital-assets/widen-import-runs') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.sync' });
        return jsonResponse(res, 200, await listWidenManifestImportRuns(actor, compact({ limit: readIntegerQuery(url, 'limit') })));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'digital_assets', action: 'digital_asset.sync' });
        return jsonResponse(res, 201, await commitWidenManifestImport(actor, (await readJsonBody(req, 10_000_000)) as WidenManifestImportRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    return notFoundResponse(res, { path: pathname, method });
  } catch (error) {
    if (isAuthenticationError(error)) return unauthorizedResponse(res, error.message);
    if (isAuthorizationError(error)) return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    return badRequestResponse(res, error instanceof Error ? error.message : 'Digital Assets request failed');
  }
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

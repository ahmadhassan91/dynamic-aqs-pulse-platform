import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CommitProductReferenceImportRequest,
  CreateProductCategoryRequest,
  ProductReferenceImportPreviewRequest,
  UpdateProductCategoryRequest,
  UpdateProductPresentationRequest,
  UpsertCatalogInclusionRequest,
} from '@pulse/contracts/product-management';
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
import {
  isAuthenticationError,
  isAuthorizationError,
  requireAuthenticatedActor,
} from '../auth/request.js';
import {
  createCatalogInclusion,
  createProductCategory,
  getProductDetail,
  listProductCategories,
  listProducts,
  runProductPublishValidation,
  updateCatalogInclusion,
  updateProductCategory,
  updateProductPresentation,
} from './service.js';
import {
  commitProductReferenceImport,
  previewProductReferenceImport,
} from './legacy-import.js';

export async function handleProductManagementRoutes(req: IncomingMessage, res: ServerResponse, url: URL) {
  const method = req.method ?? 'GET';
  const pathname = url.pathname;
  if (!pathname.startsWith('/api/v1/product-management')) {
    return false;
  }

  try {
    if (pathname === '/api/v1/product-management/products') {
      if (method !== 'GET') return methodNotAllowedResponse(res, method, ['GET']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
      return jsonResponse(res, 200, await listProducts(actor, compact({
        search: readTrimmedQuery(url, 'search'),
        categoryId: readTrimmedQuery(url, 'categoryId'),
        familyId: readTrimmedQuery(url, 'familyId'),
        publishStatus: readTrimmedQuery(url, 'publishStatus') as any,
        regionScope: readTrimmedQuery(url, 'regionScope'),
        brandLabel: readTrimmedQuery(url, 'brandLabel'),
        sourceSystem: readTrimmedQuery(url, 'sourceSystem') as any,
        limit: readIntegerQuery(url, 'limit'),
      }) as any));
    }

    if (pathname === '/api/v1/product-management/categories') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
        return jsonResponse(res, 200, await listProductCategories(actor));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
        return jsonResponse(res, 201, await createProductCategory(actor, (await readJsonBody(req)) as CreateProductCategoryRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const categoryMatch = matchPath(pathname, '/api/v1/product-management/categories/:categoryId');
    if (categoryMatch) {
      const categoryId = categoryMatch.categoryId;
      if (!categoryId) return badRequestResponse(res, 'Product category id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await updateProductCategory(actor, categoryId, (await readJsonBody(req)) as UpdateProductCategoryRequest));
    }

    if (pathname === '/api/v1/product-management/import-preview') {
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await previewProductReferenceImport((await readJsonBody(req)) as ProductReferenceImportPreviewRequest));
    }

    if (pathname === '/api/v1/product-management/import-runs') {
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 201, await commitProductReferenceImport(actor, (await readJsonBody(req)) as CommitProductReferenceImportRequest));
    }

    const productMatch = matchPath(pathname, '/api/v1/product-management/products/:productId');
    if (productMatch) {
      const productId = productMatch.productId;
      if (!productId) return badRequestResponse(res, 'Product id is required');
      if (method !== 'GET') return methodNotAllowedResponse(res, method, ['GET']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
      const response = await getProductDetail(actor, productId);
      return response ? jsonResponse(res, 200, response) : notFoundResponse(res, { entity: 'BaseProduct', id: productId });
    }

    const presentationMatch = matchPath(pathname, '/api/v1/product-management/presentations/:presentationId');
    if (presentationMatch) {
      const presentationId = presentationMatch.presentationId;
      if (!presentationId) return badRequestResponse(res, 'Product presentation id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await updateProductPresentation(actor, presentationId, (await readJsonBody(req)) as UpdateProductPresentationRequest));
    }

    const validationMatch = matchPath(pathname, '/api/v1/product-management/presentations/:presentationId/validate');
    if (validationMatch) {
      const presentationId = validationMatch.presentationId;
      if (!presentationId) return badRequestResponse(res, 'Product presentation id is required');
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.publish' });
      return jsonResponse(res, 200, await runProductPublishValidation(actor, presentationId));
    }

    if (pathname === '/api/v1/product-management/catalog-inclusions') {
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 201, await createCatalogInclusion(actor, (await readJsonBody(req)) as UpsertCatalogInclusionRequest));
    }

    const inclusionMatch = matchPath(pathname, '/api/v1/product-management/catalog-inclusions/:inclusionId');
    if (inclusionMatch) {
      const inclusionId = inclusionMatch.inclusionId;
      if (!inclusionId) return badRequestResponse(res, 'Catalog inclusion id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await updateCatalogInclusion(actor, inclusionId, (await readJsonBody(req)) as UpsertCatalogInclusionRequest));
    }

    return notFoundResponse(res, { path: pathname, method });
  } catch (error) {
    if (isAuthenticationError(error)) return unauthorizedResponse(res, error.message);
    if (isAuthorizationError(error)) return forbiddenResponse(res, error instanceof Error ? error.message : 'Access denied');
    return badRequestResponse(res, error instanceof Error ? error.message : 'Product Management request failed');
  }
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

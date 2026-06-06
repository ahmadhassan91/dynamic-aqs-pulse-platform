import type { IncomingMessage, ServerResponse } from 'node:http';
import type { URL } from 'node:url';
import type {
  CatalogRulePreviewRequest,
  CommitProductReferenceImportRequest,
  CreateCatalogRuleSetRequest,
  CreateDealerCatalogViewRequest,
  CreateDealerCatalogSnapshotRequest,
  CreateProductCategoryRequest,
  CreateProductFamilyRequest,
  UpdateDealerCatalogViewRequest,
  ProductReferenceImportPreviewRequest,
  UpdateCatalogRuleSetRequest,
  UpdateProductCategoryRequest,
  UpdateProductFamilyRequest,
  UpdateProductPresentationRequest,
  UpsertCatalogInclusionRequest,
  RollbackDealerCatalogSnapshotRequest,
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
  activateCatalogRuleSet,
  createCatalogRuleSet,
  createCatalogInclusion,
  createDealerCatalogView,
  compareDealerCatalogSnapshot,
  publishDealerCatalogSnapshot,
  createProductCategory,
  createProductFamily,
  getProductDetail,
  listCatalogRuleConditionOptions,
  listCatalogRuleSets,
  listDealerCatalogViews,
  listDealerCatalogSnapshots,
  listProductCategories,
  listProductFamilies,
  listProducts,
  previewCatalogRuleSet,
  runProductPublishValidation,
  rollbackDealerCatalogSnapshot,
  updateCatalogRuleSet,
  updateCatalogInclusion,
  updateDealerCatalogView,
  updateProductCategory,
  updateProductFamily,
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
        includeDetail: url.searchParams.get('includeDetail') === 'true' ? true : undefined,
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

    if (pathname === '/api/v1/product-management/families') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
        return jsonResponse(res, 200, await listProductFamilies(actor));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
        return jsonResponse(res, 201, await createProductFamily(actor, (await readJsonBody(req)) as CreateProductFamilyRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    if (pathname === '/api/v1/product-management/catalog-views') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
        const isActiveQuery = readTrimmedQuery(url, 'isActive');
        return jsonResponse(res, 200, await listDealerCatalogViews(actor, compact({
          kind: readTrimmedQuery(url, 'kind') as any,
          search: readTrimmedQuery(url, 'search'),
          isActive: isActiveQuery === undefined ? undefined : isActiveQuery === 'true',
        }) as any));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
        return jsonResponse(res, 201, await createDealerCatalogView(actor, (await readJsonBody(req)) as CreateDealerCatalogViewRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const catalogViewMatch = matchPath(pathname, '/api/v1/product-management/catalog-views/:catalogViewId');
    if (catalogViewMatch) {
      const catalogViewId = catalogViewMatch.catalogViewId;
      if (!catalogViewId) return badRequestResponse(res, 'Dealer catalog view id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await updateDealerCatalogView(actor, catalogViewId, (await readJsonBody(req)) as UpdateDealerCatalogViewRequest));
    }

    if (pathname === '/api/v1/product-management/catalog-rule-options') {
      if (method !== 'GET') return methodNotAllowedResponse(res, method, ['GET']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
      return jsonResponse(res, 200, await listCatalogRuleConditionOptions(actor));
    }

    const catalogSnapshotCollectionMatch = matchPath(pathname, '/api/v1/product-management/catalog-views/:catalogViewId/snapshots');
    if (catalogSnapshotCollectionMatch) {
      const catalogViewId = catalogSnapshotCollectionMatch.catalogViewId;
      if (!catalogViewId) return badRequestResponse(res, 'Dealer catalog view id is required');
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
        return jsonResponse(res, 200, await listDealerCatalogSnapshots(actor, catalogViewId));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.publish' });
        return jsonResponse(res, 201, await publishDealerCatalogSnapshot(actor, catalogViewId, (await readJsonBody(req)) as CreateDealerCatalogSnapshotRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const catalogSnapshotCompareMatch = matchPath(pathname, '/api/v1/product-management/catalog-views/:catalogViewId/snapshot-compare');
    if (catalogSnapshotCompareMatch) {
      const catalogViewId = catalogSnapshotCompareMatch.catalogViewId;
      if (!catalogViewId) return badRequestResponse(res, 'Dealer catalog view id is required');
      if (method !== 'GET') return methodNotAllowedResponse(res, method, ['GET']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
      return jsonResponse(res, 200, await compareDealerCatalogSnapshot(actor, catalogViewId));
    }

    const catalogSnapshotRollbackMatch = matchPath(pathname, '/api/v1/product-management/catalog-views/:catalogViewId/snapshots/:snapshotId/rollback');
    if (catalogSnapshotRollbackMatch) {
      const { catalogViewId, snapshotId } = catalogSnapshotRollbackMatch;
      if (!catalogViewId || !snapshotId) return badRequestResponse(res, 'Dealer catalog view id and snapshot id are required');
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.publish' });
      return jsonResponse(res, 201, await rollbackDealerCatalogSnapshot(actor, catalogViewId, snapshotId, (await readJsonBody(req)) as RollbackDealerCatalogSnapshotRequest));
    }

    if (pathname === '/api/v1/product-management/catalog-rule-sets') {
      if (method === 'GET') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.view' });
        return jsonResponse(res, 200, await listCatalogRuleSets(actor));
      }
      if (method === 'POST') {
        const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
        return jsonResponse(res, 201, await createCatalogRuleSet(actor, (await readJsonBody(req)) as CreateCatalogRuleSetRequest));
      }
      return methodNotAllowedResponse(res, method, ['GET', 'POST']);
    }

    const catalogRulePreviewMatch = matchPath(pathname, '/api/v1/product-management/catalog-rule-sets/:ruleSetId/preview');
    if (catalogRulePreviewMatch) {
      const ruleSetId = catalogRulePreviewMatch.ruleSetId;
      if (!ruleSetId) return badRequestResponse(res, 'Catalog rule set id is required');
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await previewCatalogRuleSet(actor, ruleSetId, (await readJsonBody(req)) as CatalogRulePreviewRequest));
    }

    const catalogRuleActivateMatch = matchPath(pathname, '/api/v1/product-management/catalog-rule-sets/:ruleSetId/activate');
    if (catalogRuleActivateMatch) {
      const ruleSetId = catalogRuleActivateMatch.ruleSetId;
      if (!ruleSetId) return badRequestResponse(res, 'Catalog rule set id is required');
      if (method !== 'POST') return methodNotAllowedResponse(res, method, ['POST']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.publish' });
      return jsonResponse(res, 200, await activateCatalogRuleSet(actor, ruleSetId));
    }

    const catalogRuleSetMatch = matchPath(pathname, '/api/v1/product-management/catalog-rule-sets/:ruleSetId');
    if (catalogRuleSetMatch) {
      const ruleSetId = catalogRuleSetMatch.ruleSetId;
      if (!ruleSetId) return badRequestResponse(res, 'Catalog rule set id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await updateCatalogRuleSet(actor, ruleSetId, (await readJsonBody(req)) as UpdateCatalogRuleSetRequest));
    }

    const familyMatch = matchPath(pathname, '/api/v1/product-management/families/:familyId');
    if (familyMatch) {
      const familyId = familyMatch.familyId;
      if (!familyId) return badRequestResponse(res, 'Product family id is required');
      if (method !== 'PATCH') return methodNotAllowedResponse(res, method, ['PATCH']);
      const actor = await requireAuthenticatedActor(req, { module: 'product_management', action: 'product.manage' });
      return jsonResponse(res, 200, await updateProductFamily(actor, familyId, (await readJsonBody(req)) as UpdateProductFamilyRequest));
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

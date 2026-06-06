import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ProductAssetRole,
  ProductLifecycleStatus,
  ProductPublishStatus,
  ProductSourceSystem,
  AuditAction,
  prisma,
} from '@pulse/db';
import { loadAppConfig } from '@pulse/config';
import type {
  CommitProductReferenceImportRequest,
  CommitProductReferenceImportResponse,
  ProductReferenceImportPreviewRequest,
  ProductReferenceImportPreviewResponse,
  ProductSourceSystemKey,
} from '@pulse/contracts/product-management';
import { buildAuditEntryData } from '../../utils/audit.js';
import { createDigitalAsset, createDigitalAssetVersion, updateDigitalAsset } from '../digital-assets/service.js';
import type { AuthenticatedActor } from '../auth/types.js';

const CURATED_SOURCE = 'meetings_curated_csv' as const;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 50_000;

// Three-letter Shopify Tag brand codes → governed brand label names.
const BRAND_CODE_TO_NAME: Record<string, string> = {
  STS: 'StratosAire',
  SLA: 'SolaceAir',
  NEX: 'Nexstar',
  SNA: 'PureAirX',
  CAD: 'Clean Air Defense',
  ECO: 'Eco Friendly Home',
  ARS: 'ARS',
  ASV: 'Aire Serv',
  ENV: 'EnviroAire',
  BIO: 'BioForce',
  MPA: 'MPA',
  GEN: 'Generic',
};

type CandidateProduct = {
  sku: string;
  name: string;
  shopifyTitle?: string;
  acumaticaDescription?: string;
  categoryName?: string;
  productType?: string;
  description?: string;
  regionScope?: 'US' | 'CA';
  imageUrl?: string;
  acumaticaInventoryId?: string;
  acumaticaItemClass?: string;
  uom?: string;
  itemStatus?: string;
  brandCodes: Set<string>;
  sourceSystems: Set<ProductSourceSystemKey>;
};

export async function previewProductReferenceImport(input: ProductReferenceImportPreviewRequest = {}): Promise<ProductReferenceImportPreviewResponse> {
  const context = await loadProductReferenceCandidates(input.limit);
  return {
    ...summarizeCandidates(context),
    sampleProducts: Array.from(context.candidates.values()).slice(0, 25).map((candidate) => ({
      sku: candidate.sku,
      name: candidate.name,
      sourceSystems: Array.from(candidate.sourceSystems),
      ...(candidate.categoryName ? { categoryName: candidate.categoryName } : {}),
      ...(candidate.regionScope ? { regionScope: candidate.regionScope } : {}),
      ...(candidate.imageUrl ? { imageUrl: candidate.imageUrl } : {}),
    })),
  };
}

export async function commitProductReferenceImport(
  actor: AuthenticatedActor,
  input: CommitProductReferenceImportRequest = {},
): Promise<CommitProductReferenceImportResponse> {
  const context = await loadProductReferenceCandidates(input.limit);
  const summary = summarizeCandidates(context);

  if (input.dryRun) {
    return {
      ...summary,
      dryRun: true,
      productsCreated: 0,
      productsUpdated: 0,
      presentationsCreated: 0,
      presentationsUpdated: 0,
      categoriesUpserted: 0,
      imageAssetsUpserted: 0,
      assetAssignmentsUpserted: 0,
      imageAssetsFailed: 0,
    };
  }

  // PRD parked boundary (PRODUCT_MANAGEMENT_END_TO_END_PRD §"Parked Data Migration Boundary"):
  // legacy CSV apply/import must NOT become production product truth until Acumatica
  // mappings are certified. A non-authoritative seed is allowed only when explicitly
  // enabled (PULSE_ALLOW_LEGACY_PRODUCT_SEED=true) for dev/UAT. Default = blocked.
  if (!loadAppConfig(process.env).productReferenceImport.seedEnabled) {
    throw new Error(
      'Legacy product import is parked per the Product Management PRD: it must not be applied as production product truth until Acumatica field/identity mappings are certified. '
      + 'Use dryRun for preview, or set PULSE_ALLOW_LEGACY_PRODUCT_SEED=true to seed non-authoritative draft data in dev/UAT.',
    );
  }

  const candidates = Array.from(context.candidates.values());
  let categoriesUpserted = 0;
  let productsCreated = 0;
  let productsUpdated = 0;
  let presentationsCreated = 0;
  let presentationsUpdated = 0;
  let imageAssetsUpserted = 0;
  let assetAssignmentsUpserted = 0;
  let imageAssetsFailed = 0;

  // Collected inside the product $transaction, ingested AFTER it commits. We never call
  // createDigitalAsset inside the product transaction because it opens its own
  // transaction (nesting would break / dead-lock the seed).
  const imageTargets: Array<{ sku: string; presentationId: string; imageUrl: string; productName: string }> = [];
  const seedEnabled = loadAppConfig(process.env).productReferenceImport.seedEnabled;

  await prisma.$transaction(async (tx) => {
    // 1. ProductCategory — dedupe by derived code = slug(categoryName).
    const categoryIdByName = new Map<string, string>();
    const distinctCategoryNames = [...new Set(candidates.map((c) => c.categoryName).filter((name): name is string => Boolean(name)))];
    for (const name of distinctCategoryNames) {
      const code = slug(name);
      const category = await tx.productCategory.upsert({
        where: { code },
        create: { code, name, isActive: true, sortOrder: 100 },
        update: { name },
      });
      categoryIdByName.set(name, category.id);
      categoriesUpserted += 1;
    }

    // 2. BrandLabelRef — upsert each distinct brand code seen.
    const brandIdByCode = new Map<string, string>();
    const distinctBrandCodes = [...new Set(candidates.flatMap((c) => [...c.brandCodes]))];
    for (const code of distinctBrandCodes) {
      const name = BRAND_CODE_TO_NAME[code] ?? code;
      const brand = await tx.brandLabelRef.upsert({
        where: { code },
        create: { code, name, isActive: true, sortOrder: 100 },
        update: { name },
      });
      brandIdByCode.set(code, brand.id);
    }

    // 3. BaseProduct — dedupe by sku.
    for (const candidate of candidates) {
      const fromAcumatica = candidate.sourceSystems.has('acumatica');
      const productName = candidate.acumaticaDescription ?? candidate.shopifyTitle ?? candidate.name;
      const itemStatus = candidate.itemStatus;
      const lifecycleStatus = ProductLifecycleStatus.DRAFT;
      const isSellable = itemStatus === 'AC';
      const categoryId = candidate.categoryName ? categoryIdByName.get(candidate.categoryName) ?? null : null;

      const baseData = {
        productName,
        acumaticaInventoryId: candidate.acumaticaInventoryId ?? null,
        acumaticaItemClass: candidate.acumaticaItemClass ?? null,
        uom: candidate.uom ?? null,
        itemStatus: itemStatus ?? null,
        categoryId,
      };

      const existing = await tx.baseProduct.findUnique({ where: { sku: candidate.sku } });
      if (existing) {
        await tx.baseProduct.update({
          where: { sku: candidate.sku },
          data: {
            ...baseData,
            ...(fromAcumatica ? { acumaticaLastSyncedAt: new Date() } : {}),
          },
        });
        productsUpdated += 1;
      } else {
        await tx.baseProduct.create({
          data: {
            sku: candidate.sku,
            ...baseData,
            // Provenance: mark as legacy CSV seed (not certified ERP truth). This is the
            // queryable, bulk-reversible marker; live Acumatica sync later overwrites it
            // to ACUMATICA by SKU. sourceOfTruth stays ACUMATICA so ownership is unambiguous.
            sourceSystem: ProductSourceSystem.FILE_IMPORT,
            sourceOfTruthSystem: ProductSourceSystem.ACUMATICA,
            lifecycleStatus,
            isSellable,
            isDealerVisible: false,
            ...(fromAcumatica ? { acumaticaLastSyncedAt: new Date() } : {}),
          },
        });
        productsCreated += 1;
      }

      const baseProduct = await tx.baseProduct.findUnique({ where: { sku: candidate.sku }, select: { id: true } });
      if (!baseProduct) continue;

      // 4. ProductPresentation — one per (baseProduct × regionScope × brandLabel).
      // Capture the first (primary) presentation id so a legacy image can be linked to it
      // after the transaction commits.
      let primaryPresentationId: string | undefined;
      const hasShopify = candidate.sourceSystems.has('shopify');
      if (hasShopify) {
        const displayName = candidate.shopifyTitle ?? candidate.name;
        const longDescription = candidate.description ?? null;
        const regionScope = candidate.regionScope ?? null;
        const brandNames = candidate.brandCodes.size
          ? [...candidate.brandCodes].map((code) => BRAND_CODE_TO_NAME[code] ?? code)
          : [null];
        for (const brandLabel of brandNames) {
          const found = await tx.productPresentation.findFirst({
            where: { baseProductId: baseProduct.id, regionScope, brandLabel },
          });
          if (found) {
            await tx.productPresentation.update({
              where: { id: found.id },
              data: { displayName, longDescription },
            });
            presentationsUpdated += 1;
            primaryPresentationId ??= found.id;
          } else {
            const created = await tx.productPresentation.create({
              data: {
                baseProductId: baseProduct.id,
                displayName,
                longDescription,
                regionScope,
                brandLabel,
                businessSegment: 'RESIDENTIAL',
                publishStatus: ProductPublishStatus.DRAFT,
              },
            });
            presentationsCreated += 1;
            primaryPresentationId ??= created.id;
          }
        }
      } else {
        const found = await tx.productPresentation.findFirst({
          where: { baseProductId: baseProduct.id, regionScope: null, brandLabel: null },
        });
        const displayName = candidate.name;
        if (found) {
          await tx.productPresentation.update({
            where: { id: found.id },
            data: { displayName },
          });
          presentationsUpdated += 1;
          primaryPresentationId = found.id;
        } else {
          const created = await tx.productPresentation.create({
            data: {
              baseProductId: baseProduct.id,
              displayName,
              regionScope: null,
              brandLabel: null,
              businessSegment: 'RESIDENTIAL',
              publishStatus: ProductPublishStatus.DRAFT,
            },
          });
          presentationsCreated += 1;
          primaryPresentationId = created.id;
        }
      }

      // Collect legacy image targets to ingest after the transaction commits. We do NOT
      // touch the network here; this only records {sku, presentationId, imageUrl}.
      if (candidate.imageUrl && primaryPresentationId) {
        imageTargets.push({
          sku: candidate.sku,
          presentationId: primaryPresentationId,
          imageUrl: candidate.imageUrl,
          productName: candidate.acumaticaDescription ?? candidate.shopifyTitle ?? candidate.name,
        });
      }
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.IMPORT,
        entityType: 'PRODUCT_REFERENCE_IMPORT',
        sourceSystem: CURATED_SOURCE,
        metadata: {
          productsCreated,
          productsUpdated,
          presentationsCreated,
          presentationsUpdated,
          categoriesUpserted,
          uniqueSkus: summary.uniqueSkus,
        },
      }),
    });
  });

  // 5. Legacy product-image ingestion — opt-in AND seed-gated. Runs only when the
  //    non-authoritative product seed is enabled (PULSE_ALLOW_LEGACY_PRODUCT_SEED=true)
  //    AND the caller explicitly requested it. This reuses the digital-assets ingestion
  //    path (SSRF-protected, storage-abstracted) and runs OUTSIDE the product
  //    transaction. Any download/SSRF/non-200 error is swallowed so the import never
  //    fails because an image cannot be fetched.
  if (seedEnabled && input.ingestImages) {
    ({ imageAssetsUpserted, assetAssignmentsUpserted, imageAssetsFailed } = await ingestLegacyProductImages(
      actor,
      imageTargets,
    ));
  }

  return {
    ...summary,
    dryRun: false,
    productsCreated,
    productsUpdated,
    presentationsCreated,
    presentationsUpdated,
    categoriesUpserted,
    imageAssetsUpserted,
    assetAssignmentsUpserted,
    imageAssetsFailed,
  };
}

/**
 * Ingest legacy product images via the digital-assets path, then link each ingested
 * asset to its presentation as a PRIMARY_IMAGE assignment.
 *
 * Governance: assets are written as ACTIVE / DEALER_PORTAL / PENDING_REVIEW /
 * FILE_IMPORT. PENDING_REVIEW keeps them OUT of dealer snapshots (which require
 * APPROVED or NOT_REQUIRED) until a human approves them — defense-in-depth on top of
 * the publish-blocked FILE_IMPORT products.
 *
 * Idempotency: assets are deduped by stableSlug (`product-image-${sku}`); assignments
 * are deduped by (presentationId, assetId, role). Re-running does not double rows.
 *
 * Resilience: each target is wrapped in try/catch — a failed download (SSRF rejection,
 * non-200, network error) increments imageAssetsFailed and continues; it NEVER throws.
 */
async function ingestLegacyProductImages(
  actor: AuthenticatedActor,
  imageTargets: Array<{ sku: string; presentationId: string; imageUrl: string; productName: string }>,
): Promise<{ imageAssetsUpserted: number; assetAssignmentsUpserted: number; imageAssetsFailed: number }> {
  let imageAssetsUpserted = 0;
  let assetAssignmentsUpserted = 0;
  let imageAssetsFailed = 0;

  const imageHostAllowlist = loadAppConfig(process.env).productReferenceImport.imageHostAllowlist;

  for (const target of imageTargets) {
    // SSRF guard for this path: only download from approved hosts (https + allowlist).
    // A poisoned/edited CSV row with any other host is skipped before any network call.
    if (!isAllowedImageHost(target.imageUrl, imageHostAllowlist)) {
      imageAssetsFailed += 1;
      continue;
    }

    // Dedupe key includes a hash of the RAW sku so two distinct SKUs that happen to
    // slugify identically (e.g. 'AB-12' vs 'AB.12') can never share one image asset.
    const stableSlug = `product-image-${slug(target.sku)}-${shortHash(target.sku)}`;
    let createdAssetId: string | null = null;
    try {
      const existing = await prisma.digitalAsset.findFirst({
        where: { stableSlug },
        select: { id: true, status: true, reviewStatus: true },
      });
      if (existing) {
        // Self-heal: a prior run may have created the shell+version but failed before
        // promotion (leaving DRAFT / NOT_REQUIRED). Promote it to the governed legacy
        // state instead of leaving it stuck and re-counted as a failure forever.
        if (existing.status !== 'ACTIVE' || existing.reviewStatus !== 'PENDING_REVIEW') {
          await updateDigitalAsset(actor, existing.id, { status: 'active', reviewStatus: 'pending_review' });
          imageAssetsUpserted += 1;
        }
        const linked = await ensurePrimaryImageAssignment(target.presentationId, existing.id);
        if (linked) assetAssignmentsUpserted += 1;
        continue;
      }

      // Create the governed asset shell, then ingest the source download as its first
      // version (createDigitalAssetVersion → SSRF-protected downloadSourceAsset →
      // storeDigitalAssetObject; createDigitalAsset itself does not run the download).
      const asset = await createDigitalAsset(actor, {
        title: `${target.productName} image`,
        kind: 'image',
        visibility: 'dealer_portal',
        sourceSystem: 'file_import',
        stableSlug,
      });
      createdAssetId = asset.id;

      await createDigitalAssetVersion(actor, asset.id, {
        fileName: `${slug(target.sku)}.jpg`,
        ingestSourceDownload: true,
        sourceDownloadUrl: target.imageUrl,
      });

      // Defense-in-depth: confirm the downloaded payload is actually an image before a
      // human is ever asked to review it. The asset is PENDING_REVIEW so a mislabeled file
      // can't reach dealers regardless, but we reject obvious non-images here.
      const version = await prisma.digitalAssetVersion.findFirst({
        where: { assetId: asset.id },
        orderBy: { versionNumber: 'desc' },
        select: { mimeType: true },
      });
      if (version?.mimeType && !version.mimeType.toLowerCase().startsWith('image/')) {
        throw new Error(`downloaded asset for ${target.sku} is not an image (content-type ${version.mimeType})`);
      }

      // Promote to the governed legacy state: ACTIVE so it is a real asset, PENDING_REVIEW
      // so it stays out of dealer snapshots until a human approves it.
      await updateDigitalAsset(actor, asset.id, { status: 'active', reviewStatus: 'pending_review' });
      const linked = await ensurePrimaryImageAssignment(target.presentationId, asset.id);
      // Count only after the asset is fully promoted AND linked, so a late failure can
      // never record a partial success.
      imageAssetsUpserted += 1;
      if (linked) assetAssignmentsUpserted += 1;
    } catch {
      // Any failure after the shell was created (download, SSRF rejection, non-200,
      // non-image, promotion, or assignment) removes the orphan completely so no dangling
      // un-promoted record is left behind, then counts the image as failed. The legacy
      // product seed must NEVER fail because an image cannot be ingested.
      if (createdAssetId) await deleteOrphanAsset(createdAssetId);
      imageAssetsFailed += 1;
    }
  }

  return { imageAssetsUpserted, assetAssignmentsUpserted, imageAssetsFailed };
}

// Validates an image source URL for the legacy ingest path: must be a parseable https URL
// whose host is in the configured allowlist. Pure + exported for unit testing.
export function isAllowedImageHost(imageUrl: string, allowlist: string[]): boolean {
  try {
    const parsed = new URL(imageUrl);
    if (parsed.protocol !== 'https:') return false;
    return allowlist.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function shortHash(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 8);
}

// Completely removes an orphaned asset (assignments → null currentVersion → versions →
// asset), swallowing every error so cleanup itself can never throw or mask the original.
async function deleteOrphanAsset(assetId: string): Promise<void> {
  await prisma.productAssetAssignment.deleteMany({ where: { assetId } }).catch(() => {});
  await prisma.digitalAsset.update({ where: { id: assetId }, data: { currentVersionId: null } }).catch(() => {});
  await prisma.digitalAssetVersion.deleteMany({ where: { assetId } }).catch(() => {});
  await prisma.digitalAsset.delete({ where: { id: assetId } }).catch(() => {});
}

async function ensurePrimaryImageAssignment(presentationId: string, assetId: string): Promise<boolean> {
  const existing = await prisma.productAssetAssignment.findFirst({
    where: { presentationId, assetId, role: ProductAssetRole.PRIMARY_IMAGE },
    select: { id: true },
  });
  if (existing) return false;
  await prisma.productAssetAssignment.create({
    data: {
      presentationId,
      assetId,
      role: ProductAssetRole.PRIMARY_IMAGE,
      sortOrder: 100,
      isRequired: false,
    },
  });
  return true;
}

async function loadProductReferenceCandidates(limitInput?: number) {
  const limit = Math.min(Math.max(limitInput ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const { acumaticaStockItemsPath, shopifyUsProductsPath, shopifyCaProductsPath } =
    loadAppConfig(process.env).productReferenceImport;
  const [acumaticaCsv, shopifyUsCsv, shopifyCaCsv] = await Promise.all([
    readOptionalReferenceFile(acumaticaStockItemsPath),
    readOptionalReferenceFile(shopifyUsProductsPath),
    readOptionalReferenceFile(shopifyCaProductsPath),
  ]);
  const candidates = new Map<string, CandidateProduct>();
  const warnings: string[] = [];
  let acumaticaRows = 0;
  let shopifyRows = 0;
  let skippedRows = 0;
  if (acumaticaCsv) ingestAcumatica(acumaticaCsv, candidates, limit, warnings, (count) => { acumaticaRows = count; }, () => { skippedRows += 1; });
  else warnings.push('Acumatica reference CSV is not available in this environment; import remains parked until source files and mappings are approved.');
  if (shopifyUsCsv) ingestShopify(shopifyUsCsv, 'US', candidates, limit, warnings, (count) => { shopifyRows += count; }, () => { skippedRows += 1; });
  else warnings.push('Shopify US reference CSV is not available in this environment; preview can resume when approved migration files are staged.');
  if (shopifyCaCsv) ingestShopify(shopifyCaCsv, 'CA', candidates, limit, warnings, (count) => { shopifyRows += count; }, () => { skippedRows += 1; });
  else warnings.push('Shopify Canada reference CSV is not available in this environment; preview can resume when approved migration files are staged.');
  return { candidates, acumaticaRows, shopifyRows, skippedRows, warnings };
}

// seed-data ships inside apps/api; this module compiles to
// apps/api/dist/modules/product-management/legacy-import.js, so the bundled
// reference CSVs live three directories up under seed-data/product-reference.
const SEED_DATA_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'seed-data',
  'product-reference',
);

async function readOptionalReferenceFile(filePath: string) {
  const result = await tryReadFile(filePath);
  if (result !== null) return result;

  // Fall back to the CSVs bundled with the API package. The configured default
  // is resolved against process.cwd(); when the import runs from a different
  // working directory (e.g. tests, scripts) that path may not exist.
  const fallbackPath = path.join(SEED_DATA_DIR, path.basename(filePath));
  if (fallbackPath !== filePath) {
    const fallback = await tryReadFile(fallbackPath);
    if (fallback !== null) return fallback;
  }
  return '';
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

function ingestAcumatica(
  csv: string,
  candidates: Map<string, CandidateProduct>,
  limit: number,
  warnings: string[],
  setRows: (count: number) => void,
  markSkipped: () => void,
) {
  const rows = parseCsv(csv);
  const headerIndex = rows.findIndex((row) => row.includes('InventoryID'));
  if (headerIndex < 0) {
    warnings.push('Acumatica stock item header was not found.');
    return;
  }
  const headerRow = rows[headerIndex];
  if (!headerRow) {
    warnings.push('Acumatica stock item header row was empty.');
    return;
  }
  const headers = headerRow.map((header) => header.trim());
  let imported = 0;
  for (const row of rows.slice(headerIndex + 1)) {
    if (imported >= limit) break;
    const record = toRecord(headers, row);
    const sku = clean(record.InventoryID);
    if (!sku) {
      markSkipped();
      continue;
    }
    const candidate = getCandidate(candidates, sku, clean(record.Description) ?? sku);
    candidate.name = clean(record.Description) ?? candidate.name;
    assignIfPresent(candidate, 'acumaticaDescription', clean(record.Description));
    candidate.acumaticaInventoryId = sku;
    assignIfPresent(candidate, 'acumaticaItemClass', clean(record.ItemClass));
    assignIfPresent(candidate, 'uom', clean(record.BaseUnit));
    assignIfPresent(candidate, 'itemStatus', clean(record.ItemStatus));
    candidate.sourceSystems.add('acumatica');
    imported += 1;
  }
  setRows(imported);
}

function ingestShopify(
  csv: string,
  regionScope: 'US' | 'CA',
  candidates: Map<string, CandidateProduct>,
  limit: number,
  warnings: string[],
  addRows: (count: number) => void,
  markSkipped: () => void,
) {
  const rows = parseCsv(csv);
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  if (!headers.includes('Variant SKU')) {
    warnings.push(`Shopify ${regionScope} header was not found.`);
    return;
  }
  let imported = 0;
  let lastTitle = '';
  let lastBody = '';
  let lastCategory = '';
  let lastType = '';
  let lastImage = '';
  let lastTags = '';
  for (const row of rows.slice(1)) {
    if (imported >= limit) break;
    const record = toRecord(headers, row);
    lastTitle = clean(record.Title) ?? lastTitle;
    lastBody = clean(record['Body (HTML)']) ?? lastBody;
    lastCategory = clean(record['Product Category']) ?? lastCategory;
    lastType = clean(record.Type) ?? lastType;
    lastImage = clean(record['Image Src']) ?? lastImage;
    lastTags = clean(record.Tags) ?? lastTags;
    const sku = clean(record['Variant SKU']);
    if (!sku) {
      markSkipped();
      continue;
    }
    const candidate = getCandidate(candidates, sku, lastTitle || sku);
    candidate.name = lastTitle || candidate.name;
    assignIfPresent(candidate, 'shopifyTitle', lastTitle || undefined);
    assignIfPresent(candidate, 'description', lastBody);
    assignIfPresent(candidate, 'categoryName', normalizeCategoryName(lastCategory || lastType));
    assignIfPresent(candidate, 'productType', lastType);
    candidate.regionScope = regionScope;
    assignIfPresent(candidate, 'imageUrl', lastImage);
    for (const code of parseBrandCodes(lastTags)) candidate.brandCodes.add(code);
    candidate.sourceSystems.add('shopify');
    imported += 1;
  }
  addRows(imported);
}

function summarizeCandidates(context: Awaited<ReturnType<typeof loadProductReferenceCandidates>>) {
  const candidateList = Array.from(context.candidates.values());
  return {
    source: CURATED_SOURCE,
    acumaticaRows: context.acumaticaRows,
    shopifyRows: context.shopifyRows,
    uniqueSkus: context.candidates.size,
    candidateCategories: new Set(candidateList.map((candidate) => candidate.categoryName).filter(Boolean)).size,
    imageAssets: candidateList.filter((candidate) => candidate.imageUrl).length,
    skippedRows: context.skippedRows,
    warnings: context.warnings,
  };
}

function getCandidate(candidates: Map<string, CandidateProduct>, sku: string, fallbackName: string) {
  const existing = candidates.get(sku);
  if (existing) return existing;
  const candidate: CandidateProduct = { sku, name: fallbackName, brandCodes: new Set(), sourceSystems: new Set() };
  candidates.set(sku, candidate);
  return candidate;
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function toRecord(headers: string[], row: string[]) {
  const record: Record<string, string | undefined> = {};
  headers.forEach((header, index) => {
    if (header) record[header] = row[index];
  });
  return record;
}

function clean(value: string | undefined) {
  const cleaned = value?.replace(/&quot;/g, '"').trim();
  if (!cleaned || cleaned.toUpperCase() === 'NULL') return undefined;
  return cleaned;
}

function assignIfPresent<TKey extends keyof CandidateProduct>(
  candidate: CandidateProduct,
  key: TKey,
  value: CandidateProduct[TKey] | undefined,
) {
  if (value !== undefined && value !== '') {
    candidate[key] = value;
  }
}

function normalizeCategoryName(value: string | undefined) {
  if (!value) return undefined;
  const parts = value.split('>').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? value.trim();
}

function parseBrandCodes(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((token) => token.trim().toUpperCase())
    .filter((token) => token in BRAND_CODE_TO_NAME);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'uncategorized';
}

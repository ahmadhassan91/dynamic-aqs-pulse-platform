import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  DigitalAssetKind,
  DigitalAssetReviewStatus,
  DigitalAssetStatus,
  DigitalAssetVisibility,
  ProductAssetRole,
  ProductLifecycleStatus,
  ProductPublishStatus,
  ProductSourceSystem,
  prisma,
} from '@pulse/db';
import type {
  CommitProductReferenceImportRequest,
  CommitProductReferenceImportResponse,
  ProductReferenceImportPreviewRequest,
  ProductReferenceImportPreviewResponse,
  ProductSourceSystemKey,
} from '@pulse/contracts/product-management';
import type { AuthenticatedActor } from '../auth/types.js';

const CURATED_SOURCE = 'meetings_curated_csv' as const;
const ACUMATICA_STOCK_ITEMS_PATH = '/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Acumatica Stock Items.xlsx - Results.csv';
const SHOPIFY_US_PRODUCTS_PATH = '/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shopify US Products.csv';
const SHOPIFY_CA_PRODUCTS_PATH = '/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shopify Canada Products.csv';
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5_000;

type CandidateProduct = {
  sku: string;
  name: string;
  categoryName?: string;
  productType?: string;
  description?: string;
  regionScope?: 'US' | 'CA';
  imageUrl?: string;
  acumaticaInventoryId?: string;
  acumaticaItemClass?: string;
  uom?: string;
  itemStatus?: string;
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
    };
  }

  const counters = {
    productsCreated: 0,
    productsUpdated: 0,
    presentationsCreated: 0,
    presentationsUpdated: 0,
    categoriesUpserted: 0,
    imageAssetsUpserted: 0,
    assetAssignmentsUpserted: 0,
  };

  await prisma.$transaction(async (tx) => {
    for (const candidate of context.candidates.values()) {
      const category = candidate.categoryName
        ? await tx.productCategory.upsert({
            where: { code: categoryCode(candidate.categoryName) },
            create: {
              code: categoryCode(candidate.categoryName),
              name: candidate.categoryName,
              categoryType: candidate.productType ?? null,
              regionScope: candidate.regionScope ?? null,
            },
            update: {
              name: candidate.categoryName,
              categoryType: candidate.productType ?? null,
            },
          })
        : null;
      if (category) counters.categoriesUpserted += 1;

      const existingProduct = await tx.baseProduct.findUnique({ where: { sku: candidate.sku } });
      const productUpdate = compact({
        productName: candidate.name,
        acumaticaInventoryId: candidate.acumaticaInventoryId,
        acumaticaItemClass: candidate.acumaticaItemClass,
        uom: candidate.uom,
        itemStatus: candidate.itemStatus,
        sourceSystem: candidate.sourceSystems.has('acumatica') ? ProductSourceSystem.ACUMATICA : ProductSourceSystem.SHOPIFY,
        sourceOfTruthSystem: ProductSourceSystem.ACUMATICA,
        categoryId: category?.id,
      });
      const product = await tx.baseProduct.upsert({
        where: { sku: candidate.sku },
        create: {
          sku: candidate.sku,
          productName: candidate.name,
          acumaticaInventoryId: candidate.acumaticaInventoryId ?? null,
          acumaticaItemClass: candidate.acumaticaItemClass ?? null,
          uom: candidate.uom ?? null,
          itemStatus: candidate.itemStatus ?? null,
          lifecycleStatus: candidate.itemStatus === 'AC' || candidate.sourceSystems.has('shopify') ? ProductLifecycleStatus.ACTIVE : ProductLifecycleStatus.DRAFT,
          sourceSystem: candidate.sourceSystems.has('acumatica') ? ProductSourceSystem.ACUMATICA : ProductSourceSystem.SHOPIFY,
          sourceOfTruthSystem: ProductSourceSystem.ACUMATICA,
          categoryId: category?.id ?? null,
          isDealerVisible: false,
          createdByUserId: actor.userId,
        },
        update: productUpdate as any,
      });
      if (existingProduct) counters.productsUpdated += 1;
      else counters.productsCreated += 1;

      const existingPresentation = await tx.productPresentation.findFirst({
        where: {
          baseProductId: product.id,
          regionScope: candidate.regionScope ?? null,
          brandLabel: null,
        },
      });
      const presentationData = {
        displayName: candidate.name,
        shortDescription: plainText(candidate.description)?.slice(0, 500) ?? null,
        longDescription: plainText(candidate.description) ?? null,
        regionScope: candidate.regionScope ?? null,
        brandLabel: null,
        publishStatus: ProductPublishStatus.DRAFT,
      };
      const presentation = existingPresentation
        ? await tx.productPresentation.update({ where: { id: existingPresentation.id }, data: presentationData })
        : await tx.productPresentation.create({ data: { baseProductId: product.id, ...presentationData } });
      if (existingPresentation) counters.presentationsUpdated += 1;
      else counters.presentationsCreated += 1;

      if (candidate.imageUrl) {
        const stableSlug = `shopify-${candidate.regionScope?.toLowerCase() ?? 'legacy'}-${slugify(candidate.sku)}`;
        const asset = await tx.digitalAsset.upsert({
          where: { stableSlug },
          create: {
            stableSlug,
            title: `${candidate.name} image`,
            kind: DigitalAssetKind.IMAGE,
            status: DigitalAssetStatus.NEEDS_REVIEW,
            visibility: DigitalAssetVisibility.INTERNAL_ONLY,
            reviewStatus: DigitalAssetReviewStatus.PENDING_REVIEW,
            sourceSystem: ProductSourceSystem.SHOPIFY,
            sourceOfTruthSystem: ProductSourceSystem.PULSE,
            audience: 'internal',
            regionScope: candidate.regionScope ?? null,
            legacyUrl: candidate.imageUrl,
            createdByUserId: actor.userId,
          },
          update: {
            title: `${candidate.name} image`,
            legacyUrl: candidate.imageUrl,
            regionScope: candidate.regionScope ?? null,
          },
        });
        counters.imageAssetsUpserted += 1;

        const existingVersion = await tx.digitalAssetVersion.findFirst({ where: { assetId: asset.id, externalUrl: candidate.imageUrl } });
        const version = existingVersion ?? await tx.digitalAssetVersion.create({
          data: {
            assetId: asset.id,
            versionNumber: 1,
            externalUrl: candidate.imageUrl,
            fileName: imageFileName(candidate.imageUrl, candidate.sku),
            mimeType: inferImageMimeType(candidate.imageUrl),
            sha256: legacyUrlHash(candidate.imageUrl),
            isCurrent: true,
            createdByUserId: actor.userId,
          },
        });
        await tx.digitalAsset.update({ where: { id: asset.id }, data: { currentVersionId: version.id } });

        const existingAssignment = await tx.productAssetAssignment.findFirst({
          where: {
            presentationId: presentation.id,
            assetId: asset.id,
            role: ProductAssetRole.PRIMARY_IMAGE,
          },
        });
        if (!existingAssignment) {
          await tx.productAssetAssignment.create({
            data: {
              presentationId: presentation.id,
              assetId: asset.id,
              assetVersionId: version.id,
              role: ProductAssetRole.PRIMARY_IMAGE,
              regionScope: candidate.regionScope ?? null,
              isRequired: true,
            },
          });
        }
        counters.assetAssignmentsUpserted += 1;
      }
    }
  }, { timeout: 60_000 });

  return { ...summary, dryRun: false, ...counters };
}

async function loadProductReferenceCandidates(limitInput?: number) {
  const limit = Math.min(Math.max(limitInput ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const [acumaticaCsv, shopifyUsCsv, shopifyCaCsv] = await Promise.all([
    readFile(ACUMATICA_STOCK_ITEMS_PATH, 'utf8'),
    readFile(SHOPIFY_US_PRODUCTS_PATH, 'utf8'),
    readFile(SHOPIFY_CA_PRODUCTS_PATH, 'utf8'),
  ]);
  const candidates = new Map<string, CandidateProduct>();
  const warnings: string[] = [];
  let acumaticaRows = 0;
  let shopifyRows = 0;
  let skippedRows = 0;
  ingestAcumatica(acumaticaCsv, candidates, limit, warnings, (count) => { acumaticaRows = count; }, () => { skippedRows += 1; });
  ingestShopify(shopifyUsCsv, 'US', candidates, limit, warnings, (count) => { shopifyRows += count; }, () => { skippedRows += 1; });
  ingestShopify(shopifyCaCsv, 'CA', candidates, limit, warnings, (count) => { shopifyRows += count; }, () => { skippedRows += 1; });
  return { candidates, acumaticaRows, shopifyRows, skippedRows, warnings };
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
  for (const row of rows.slice(1)) {
    if (imported >= limit) break;
    const record = toRecord(headers, row);
    lastTitle = clean(record.Title) ?? lastTitle;
    lastBody = clean(record['Body (HTML)']) ?? lastBody;
    lastCategory = clean(record['Product Category']) ?? lastCategory;
    lastType = clean(record.Type) ?? lastType;
    lastImage = clean(record['Image Src']) ?? lastImage;
    const sku = clean(record['Variant SKU']);
    if (!sku) {
      markSkipped();
      continue;
    }
    const candidate = getCandidate(candidates, sku, lastTitle || sku);
    candidate.name = lastTitle || candidate.name;
    assignIfPresent(candidate, 'description', lastBody);
    assignIfPresent(candidate, 'categoryName', normalizeCategoryName(lastCategory || lastType));
    assignIfPresent(candidate, 'productType', lastType);
    candidate.regionScope = regionScope;
    assignIfPresent(candidate, 'imageUrl', lastImage);
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
  const candidate: CandidateProduct = { sku, name: fallbackName, sourceSystems: new Set() };
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

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entryValue]) => entryValue !== undefined));
}

function categoryCode(value: string) {
  return `legacy-${slugify(value)}`.slice(0, 120);
}

function normalizeCategoryName(value: string | undefined) {
  if (!value) return undefined;
  const parts = value.split('>').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? value.trim();
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'uncategorized';
}

function plainText(value: string | undefined) {
  return value
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function imageFileName(url: string, sku: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('/').pop() || `${sku}.image`;
  } catch {
    return `${sku}.image`;
  }
}

function inferImageMimeType(url: string) {
  const lowered = url.toLowerCase();
  if (lowered.includes('.png')) return 'image/png';
  if (lowered.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function legacyUrlHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

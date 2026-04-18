import { GroupAxisSelection, GroupClassification, type Prisma } from '@pulse/db';
import type { GroupAxisSelectionKey, GroupClassificationKey } from '@pulse/contracts';

const UNKNOWN_MARKERS = new Set(['unknown', 'not_assessed', 'not assessed', 'unassigned']);
const NONE_MARKERS = new Set(['independent', 'none', 'no_group', 'no group', 'n/a', 'na']);

type GroupAxisKind = 'affinity' | 'ownership';

type GroupAxisRecord = {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
};

type ResolveGroupAxisInput = {
  selection?: GroupAxisSelectionKey | undefined;
  id?: string | null | undefined;
  code?: string | undefined;
  name?: string | undefined;
  requireExplicitSelection?: boolean;
  disallowUnknownSelection?: boolean;
  tx: Prisma.TransactionClient;
  kind: GroupAxisKind;
};

export type ResolvedGroupAxis = {
  selection: GroupAxisSelection;
  id: string | null;
  code?: string;
  name?: string;
};

export function deriveGroupClassification(
  affinitySelection: GroupAxisSelection,
  ownershipSelection: GroupAxisSelection,
): GroupClassification | null {
  if (affinitySelection === GroupAxisSelection.UNKNOWN || ownershipSelection === GroupAxisSelection.UNKNOWN) {
    return null;
  }

  const hasAffinity = affinitySelection === GroupAxisSelection.GROUP;
  const hasOwnership = ownershipSelection === GroupAxisSelection.GROUP;

  if (hasAffinity && hasOwnership) {
    return GroupClassification.HYBRID;
  }
  if (hasAffinity) {
    return GroupClassification.AFFINITY_ONLY;
  }
  if (hasOwnership) {
    return GroupClassification.OWNERSHIP_ONLY;
  }

  return GroupClassification.INDEPENDENT;
}

export function toGroupAxisSelectionKey(selection: GroupAxisSelection): GroupAxisSelectionKey {
  switch (selection) {
    case GroupAxisSelection.UNKNOWN:
      return 'unknown';
    case GroupAxisSelection.NONE:
      return 'none';
    case GroupAxisSelection.GROUP:
      return 'group';
  }
}

export function toGroupClassificationKey(classification: GroupClassification): GroupClassificationKey {
  switch (classification) {
    case GroupClassification.INDEPENDENT:
      return 'independent';
    case GroupClassification.AFFINITY_ONLY:
      return 'affinity_only';
    case GroupClassification.OWNERSHIP_ONLY:
      return 'ownership_only';
    case GroupClassification.HYBRID:
      return 'hybrid';
  }
}

export async function resolveAffinityGroupAxis(input: ResolveGroupAxisInput): Promise<ResolvedGroupAxis> {
  return resolveGroupAxis({
    ...input,
    kind: 'affinity',
  });
}

export async function resolveOwnershipGroupAxis(input: ResolveGroupAxisInput): Promise<ResolvedGroupAxis> {
  return resolveGroupAxis({
    ...input,
    kind: 'ownership',
  });
}

async function resolveGroupAxis(input: ResolveGroupAxisInput): Promise<ResolvedGroupAxis> {
  const name = normalizeOptionalString(input.name);
  const code = normalizeOptionalCode(input.code);
  const id = normalizeOptionalString(input.id ?? undefined);

  let normalizedSelection = input.selection ? toGroupAxisSelectionEnum(input.selection, input.kind) : undefined;

  if (!normalizedSelection) {
    if (name && UNKNOWN_MARKERS.has(normalizeMarker(name))) {
      normalizedSelection = GroupAxisSelection.UNKNOWN;
    } else if ((name && NONE_MARKERS.has(normalizeMarker(name))) || (code && NONE_MARKERS.has(normalizeMarker(code)))) {
      normalizedSelection = GroupAxisSelection.NONE;
    } else if (id || code || name) {
      normalizedSelection = GroupAxisSelection.GROUP;
    } else if (input.requireExplicitSelection) {
      throw new Error(`${input.kind}GroupSelection is required`);
    } else {
      normalizedSelection = GroupAxisSelection.UNKNOWN;
    }
  }

  if (normalizedSelection === GroupAxisSelection.UNKNOWN && input.disallowUnknownSelection) {
    throw new Error(`${input.kind}GroupSelection cannot be "unknown"`);
  }

  if (normalizedSelection !== GroupAxisSelection.GROUP) {
    if (id || code || (name && !UNKNOWN_MARKERS.has(normalizeMarker(name)) && !NONE_MARKERS.has(normalizeMarker(name)))) {
      throw new Error(`${input.kind}GroupId/code/name can only be supplied when ${input.kind}GroupSelection is "group"`);
    }

    return {
      selection: normalizedSelection,
      id: null,
    };
  }

  const record = await findGroupRecord(input.tx, input.kind, { id, code, name });
  if (!record) {
    throw new Error(`${input.kind} group could not be resolved`);
  }

  return {
    selection: GroupAxisSelection.GROUP,
    id: record.id,
    code: record.code,
    name: record.name,
  };
}

async function findGroupRecord(
  tx: Prisma.TransactionClient,
  kind: GroupAxisKind,
  criteria: { id?: string | undefined; code?: string | undefined; name?: string | undefined },
): Promise<GroupAxisRecord | null> {
  if (kind === 'affinity') {
    if (criteria.id) {
      return tx.affinityGroupRef.findUnique({
        where: { id: criteria.id },
        select: { id: true, code: true, name: true, shortName: true },
      });
    }
    if (criteria.code) {
      return tx.affinityGroupRef.findUnique({
        where: { code: criteria.code },
        select: { id: true, code: true, name: true, shortName: true },
      });
    }
    if (criteria.name) {
      return tx.affinityGroupRef.findFirst({
        where: {
          OR: [
            { name: { equals: criteria.name, mode: 'insensitive' } },
            { shortName: { equals: criteria.name, mode: 'insensitive' } },
          ],
        },
        select: { id: true, code: true, name: true, shortName: true },
      });
    }
    return null;
  }

  if (criteria.id) {
    return tx.ownershipGroupRef.findUnique({
      where: { id: criteria.id },
      select: { id: true, code: true, name: true, shortName: true },
    });
  }
  if (criteria.code) {
    return tx.ownershipGroupRef.findUnique({
      where: { code: criteria.code },
      select: { id: true, code: true, name: true, shortName: true },
    });
  }
  if (criteria.name) {
    return tx.ownershipGroupRef.findFirst({
      where: {
        OR: [
          { name: { equals: criteria.name, mode: 'insensitive' } },
          { shortName: { equals: criteria.name, mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, name: true, shortName: true },
    });
  }

  return null;
}

function toGroupAxisSelectionEnum(value: GroupAxisSelectionKey, kind: GroupAxisKind): GroupAxisSelection {
  switch (value) {
    case 'unknown':
      return GroupAxisSelection.UNKNOWN;
    case 'none':
      return GroupAxisSelection.NONE;
    case 'group':
      return GroupAxisSelection.GROUP;
    default:
      throw new Error(`Unsupported ${kind}GroupSelection value: ${value}`);
  }
}

function normalizeOptionalString(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeOptionalCode(value: string | undefined) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.replace(/\s+/g, '_').toUpperCase() : undefined;
}

function normalizeMarker(value: string) {
  return value.trim().replace(/\s+/g, '_').toLowerCase();
}

import { assertActionAccess, assertModuleAccess, normalizeRole } from '@pulse/auth';
import {
  AuditAction,
  LeadLifecycleStatus,
  LeadStage,
  LeadRoutingTeam,
  UserKind,
  Prisma,
  TerritoryAssignmentEntityType,
  TerritoryAssignmentMethod,
  prisma,
} from '@pulse/db';
import type {
  AccountTerritoryAssignmentSummary,
  CreateRegionRequest,
  CreateShippingCenterRequest,
  CreateTerritoryRequest,
  TerritoryDashboardAlert,
  TerritoryDashboardOwnerMetricSummary,
  TerritoryDashboardQueueSummary,
  TerritoryDashboardRegionRollupSummary,
  TerritoryDashboardResponse,
  TerritoryDashboardStats,
  TerritoryDashboardWorkload,
  LeadTerritoryAssignmentSummary,
  ListTerritoryAssignableUsersResponse,
  ListRegionsResponse,
  ListShippingCentersResponse,
  ListTerritoriesResponse,
  ListTerritoryAssignmentHistoryResponse,
  ReassignAccountTerritoryRequest,
  RegionSummary,
  ReassignLeadTerritoryRequest,
  ReplaceTerritoryCoverageRequest,
  ShippingCenterSummary,
  TerritoryAssignableUserSummary,
  TerritoryMapCoverageEntrySummary,
  TerritoryMapGeoPrecisionKey,
  TerritoryMapPinSummary,
  TerritoryMapShippingCenterSummary,
  TerritoryMapWorkspaceResponse,
  TerritoryPolicySummary,
  TerritorySummary,
  UpdateRegionRequest,
  UpdateShippingCenterRequest,
  UpdateTerritoryPolicyRequest,
  UpdateTerritoryRequest,
} from '@pulse/contracts';
import { findLeadRegionOption } from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAccountRecordScope, buildLeadRecordScope } from '../auth/visibility.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import {
  assertTerritoryAssignmentHistoryVisible,
  buildRegionReadScope,
  buildShippingCenterReadScope,
  buildTerritoryReadScope,
} from './visibility.js';

const REGION_ENTITY_TYPE = 'REGION';
const TERRITORY_ENTITY_TYPE = 'TERRITORY';
const TERRITORY_COVERAGE_ENTITY_TYPE = 'TERRITORY_STATE_COVERAGE';
const TERRITORY_OVERRIDE_ENTITY_TYPE = 'TERRITORY_ASSIGNMENT_OVERRIDE';
const TERRITORY_POLICY_ENTITY_TYPE = 'TERRITORY_POLICY';
const SHIPPING_CENTER_ENTITY_TYPE = 'SHIPPING_CENTER';
const LEAD_ENTITY_TYPE = 'LEAD';
const ACCOUNT_ENTITY_TYPE = 'ACCOUNT';

const DEFAULT_SHIPPING_CENTERS = [
  { code: 'nv_nevada', name: 'Nevada Shipping', city: 'Las Vegas', state: 'NV', countryCode: 'US' },
  { code: 'fl_southeast', name: 'Florida Shipping', city: 'Fort Lauderdale', state: 'FL', countryCode: 'US' },
  { code: 'nj_princeton', name: 'New Jersey Shipping', city: 'Princeton', state: 'NJ', countryCode: 'US' },
] as const;

type TerritoryWithRefs = Prisma.TerritoryGetPayload<{
  include: {
    region: {
      include: {
        directorUser: {
          select: {
            id: true;
            displayName: true;
          };
        };
      };
    };
    managerUser: {
      select: {
        id: true;
        displayName: true;
      };
    };
    shippingCenter: true;
    stateCoverage: {
      orderBy: {
        stateCode: 'asc';
      };
    };
  };
}>;

type TerritoryResolution = {
  territoryId?: string;
  territoryCode?: string;
  territoryName?: string;
  regionId?: string;
  regionCode?: string;
  regionName?: string;
  shippingCenterId?: string;
  shippingCenterCode?: string;
  shippingCenterName?: string;
  assignedTmUserId?: string;
  assignedTmName?: string;
  assignedRdUserId?: string;
  assignedRdName?: string;
  assignmentMethod?: TerritoryAssignmentMethod;
};

type AccountWithTerritoryRefs = Prisma.AccountGetPayload<{
  include: typeof ACCOUNT_TERRITORY_INCLUDE;
}>;

type TerritoryDashboardLeadRecord = {
  id: string;
  territoryId: string | null;
  shippingCenterId: string | null;
  assignedTmUserId: string | null;
  assignedRdUserId: string | null;
  routingTeam: LeadRoutingTeam;
};

type TerritoryDashboardAccountRecord = {
  id: string;
  territoryId: string | null;
  shippingCenterId: string | null;
  assignedTmUserId: string | null;
  assignedRdUserId: string | null;
};

const ASSIGNABLE_TERRITORY_ROLE_CODES = ['TERRITORY_MANAGER', 'REGIONAL_DIRECTOR'] as const;

export async function ensureTerritoryPolicySeeded() {
  await prisma.$transaction(async (tx) => {
    await tx.territoryPolicy.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        preHandoffTmVisibility: false,
        assignNationalTmLeadsByDefault: true,
        strategicGrowthRetainsOwnership: true,
      },
    });

    await Promise.all(
      DEFAULT_SHIPPING_CENTERS.map((center) =>
        tx.shippingCenter.upsert({
          where: { code: center.code },
          update: {},
          create: {
            code: center.code,
            name: center.name,
            city: center.city,
            state: center.state,
            countryCode: center.countryCode,
            isActive: true,
          },
        }),
      ),
    );
  });
}

export async function listShippingCenters(actor: AuthenticatedActor): Promise<ListShippingCentersResponse> {
  assertModuleAccess(actor.role, 'territories');
  const scopeWhere = buildShippingCenterReadScope(actor);

  const query = {
    orderBy: [{ name: 'asc' }],
    ...(scopeWhere ? { where: scopeWhere } : {}),
  } satisfies Prisma.ShippingCenterFindManyArgs;

  const items = await prisma.shippingCenter.findMany(query);

  return {
    items: items.map(toShippingCenterSummary),
  };
}

export async function createShippingCenter(
  actor: AuthenticatedActor,
  input: CreateShippingCenterRequest,
): Promise<ShippingCenterSummary> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const code = normalizeCode(input.code, 'code');
  const name = requireText(input.name, 'name');
  const city = optionalText(input.city);
  const state = normalizeStateCode(input.state);
  const countryCode = normalizeCountryCode(input.countryCode, input.state);
  const isActive = input.isActive ?? true;
  const notes = optionalText(input.notes);

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.shippingCenter.create({
      data: {
        code,
        name,
        ...(city !== undefined ? { city } : {}),
        ...(state !== undefined ? { state } : {}),
        countryCode,
        isActive,
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: SHIPPING_CENTER_ENTITY_TYPE,
        entityId: next.id,
        afterData: toShippingCenterAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.create_shipping_center'),
      }),
    });

    return next;
  });

  return toShippingCenterSummary(created);
}

export async function updateShippingCenter(
  actor: AuthenticatedActor,
  shippingCenterId: string,
  input: UpdateShippingCenterRequest,
): Promise<ShippingCenterSummary | null> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const current = await prisma.shippingCenter.findUnique({
    where: { id: shippingCenterId },
  });
  if (!current) {
    return null;
  }

  const data = {
    ...(input.name !== undefined ? { name: requireText(input.name, 'name') } : {}),
    ...(input.city !== undefined ? { city: optionalText(input.city) ?? null } : {}),
    ...(input.state !== undefined ? { state: normalizeStateCode(input.state) ?? null } : {}),
    ...(input.countryCode !== undefined ? { countryCode: normalizeCountryCode(input.countryCode) } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
  } satisfies Prisma.ShippingCenterUpdateInput;

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.shippingCenter.update({
      where: { id: shippingCenterId },
      data,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: SHIPPING_CENTER_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toShippingCenterAuditPayload(current),
        afterData: toShippingCenterAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.update_shipping_center'),
      }),
    });

    return next;
  });

  return toShippingCenterSummary(updated);
}

export async function getTerritoryPolicy(actor: AuthenticatedActor): Promise<TerritoryPolicySummary> {
  assertModuleAccess(actor.role, 'territories');
  const policy = await requireTerritoryPolicy();
  return toTerritoryPolicySummary(policy);
}

export async function updateTerritoryPolicy(
  actor: AuthenticatedActor,
  input: UpdateTerritoryPolicyRequest,
): Promise<TerritoryPolicySummary> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const current = await requireTerritoryPolicy();

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.territoryPolicy.update({
      where: { id: current.id },
      data: {
        ...(input.preHandoffTmVisibility !== undefined
          ? { preHandoffTmVisibility: input.preHandoffTmVisibility }
          : {}),
        ...(input.assignNationalTmLeadsByDefault !== undefined
          ? { assignNationalTmLeadsByDefault: input.assignNationalTmLeadsByDefault }
          : {}),
        ...(input.strategicGrowthRetainsOwnership !== undefined
          ? { strategicGrowthRetainsOwnership: input.strategicGrowthRetainsOwnership }
          : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TERRITORY_POLICY_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toTerritoryPolicyAuditPayload(current),
        afterData: toTerritoryPolicyAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.update_policy'),
      }),
    });

    await refreshLeadTerritoryAssignments(tx, {
      where: {
        OR: [
          { territoryId: { not: null } },
          { state: { not: null } },
        ],
      },
      changedByUserId: actor.userId,
      reasonCode: 'policy_refresh',
      reasonNote: 'Lead territory assignments were refreshed after territory policy changed.',
    });

    return next;
  });

  return toTerritoryPolicySummary(updated);
}

export async function listRegions(actor: AuthenticatedActor): Promise<ListRegionsResponse> {
  assertModuleAccess(actor.role, 'territories');
  const regionScope = buildRegionReadScope(actor);
  const territoryScope = buildTerritoryReadScope(actor);

  const query = {
    orderBy: [{ name: 'asc' }],
    ...(regionScope ? { where: regionScope } : {}),
    include: {
      directorUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      territories: {
        ...(territoryScope ? { where: territoryScope } : {}),
        select: {
          id: true,
        },
      },
    },
  } satisfies Prisma.RegionFindManyArgs;

  const items = await prisma.region.findMany(query);

  return {
    items: items.map((item) => toRegionSummaryWithVisibleTerritoryCount(item, item.territories.length)),
  };
}

export async function createRegion(actor: AuthenticatedActor, input: CreateRegionRequest): Promise<RegionSummary> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const code = normalizeCode(input.code, 'code');
  const name = requireText(input.name, 'name');
  const directorUserId = await validateOptionalUserId(input.directorUserId);
  const isActive = input.isActive ?? true;
  const notes = optionalText(input.notes);

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.region.create({
      data: {
        code,
        name,
        ...(directorUserId ? { directorUserId } : {}),
        isActive,
        ...(notes !== undefined ? { notes } : {}),
      },
      include: {
        directorUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            territories: true,
          },
        },
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: REGION_ENTITY_TYPE,
        entityId: next.id,
        afterData: toRegionAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.create_region'),
      }),
    });

    return next;
  });

  return toRegionSummary(created);
}

export async function updateRegion(
  actor: AuthenticatedActor,
  regionId: string,
  input: UpdateRegionRequest,
): Promise<RegionSummary | null> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const current = await prisma.region.findUnique({
    where: { id: regionId },
    include: {
      directorUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      _count: {
        select: {
          territories: true,
        },
      },
    },
  });
  if (!current) {
    return null;
  }

  const directorUserId =
    input.directorUserId === undefined ? undefined : await validateOptionalUserId(input.directorUserId ?? null);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.region.update({
      where: { id: regionId },
      data: {
        ...(input.name !== undefined ? { name: requireText(input.name, 'name') } : {}),
        ...(directorUserId !== undefined ? { directorUserId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
      },
      include: {
        directorUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            territories: true,
          },
        },
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: REGION_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toRegionAuditPayload(current),
        afterData: toRegionAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.update_region'),
      }),
    });

    await refreshLeadTerritoryAssignments(tx, {
      where: {
        territory: {
          is: {
            regionId,
          },
        },
      },
      changedByUserId: actor.userId,
      reasonCode: 'region_refresh',
      reasonNote: 'Lead territory assignments were refreshed after region ownership changed.',
    });

    await refreshAccountTerritoryAssignments(tx, {
      where: {
        territory: {
          is: {
            regionId,
          },
        },
      },
      changedByUserId: actor.userId,
      reasonCode: 'region_refresh',
      reasonNote: 'Account territory assignments were refreshed after region ownership changed.',
    });

    return next;
  });

  return toRegionSummary(updated);
}

export async function listTerritories(actor: AuthenticatedActor): Promise<ListTerritoriesResponse> {
  assertModuleAccess(actor.role, 'territories');
  const scopeWhere = buildTerritoryReadScope(actor);

  const query = {
    orderBy: [{ name: 'asc' }],
    ...(scopeWhere ? { where: scopeWhere } : {}),
    include: TERRITORY_INCLUDE,
  } satisfies Prisma.TerritoryFindManyArgs;

  const items = await prisma.territory.findMany(query);

  return {
    items: items.map(toTerritorySummary),
  };
}

export async function getTerritoryMapWorkspace(
  actor: AuthenticatedActor,
): Promise<TerritoryMapWorkspaceResponse> {
  assertModuleAccess(actor.role, 'territories');
  const territoryScope = buildTerritoryReadScope(actor);
  const regionScope = buildRegionReadScope(actor);
  const shippingCenterScope = buildShippingCenterReadScope(actor);
  const leadScope = buildLeadRecordScope(actor);
  const accountScope = buildAccountRecordScope(actor);

  const regionQuery = {
    orderBy: [{ name: 'asc' }],
    ...(regionScope ? { where: regionScope } : {}),
    include: {
      directorUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      territories: {
        ...(territoryScope ? { where: territoryScope } : {}),
        select: {
          id: true,
        },
      },
    },
  } satisfies Prisma.RegionFindManyArgs;

  const territoryQuery = {
    orderBy: [{ name: 'asc' }],
    ...(territoryScope ? { where: territoryScope } : {}),
    include: TERRITORY_INCLUDE,
  } satisfies Prisma.TerritoryFindManyArgs;

  const shippingCenterQuery = {
    orderBy: [{ name: 'asc' }],
    ...(shippingCenterScope ? { where: shippingCenterScope } : {}),
  } satisfies Prisma.ShippingCenterFindManyArgs;

  const [policy, regionItems, territoryItems, shippingCenterItems, leadItems, accountItems] = await Promise.all([
    requireTerritoryPolicy(),
    prisma.region.findMany(regionQuery),
    prisma.territory.findMany(territoryQuery),
    prisma.shippingCenter.findMany(shippingCenterQuery),
    prisma.lead.findMany({
      where: leadScope
        ? {
            AND: [
              leadScope,
              {
                lifecycleStatus: 'ACTIVE',
                stage: {
                  not: LeadStage.CUSTOMER_ACTIVE,
                },
              },
            ],
          }
        : {
            lifecycleStatus: 'ACTIVE',
            stage: {
              not: LeadStage.CUSTOMER_ACTIVE,
            },
          },
      orderBy: [{ companyName: 'asc' }],
      include: LEAD_TERRITORY_INCLUDE,
    }),
    prisma.account.findMany({
      where: accountScope
        ? {
            AND: [
              accountScope,
              {
                isActive: true,
              },
            ],
          }
        : {
            isActive: true,
          },
      orderBy: [{ displayName: 'asc' }],
      include: {
        territory: {
          include: {
            region: true,
          },
        },
        shippingCenter: true,
        assignedTmUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        assignedRdUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        locations: {
          where: {
            isActive: true,
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
      },
    }),
  ]);

  const territories = territoryItems.map(toTerritorySummary);
  const regions = regionItems.map((item) => toRegionSummaryWithVisibleTerritoryCount(item, item.territories.length));
  const coverageEntries = territoryItems.flatMap((territory) => toTerritoryMapCoverageEntries(territory));

  const leadCountsByShippingCenter = new Map<string, number>();
  const accountCountsByShippingCenter = new Map<string, number>();
  const territoryCountsByShippingCenter = new Map<string, number>();

  for (const lead of leadItems) {
    if (lead.shippingCenterId) {
      leadCountsByShippingCenter.set(
        lead.shippingCenterId,
        (leadCountsByShippingCenter.get(lead.shippingCenterId) ?? 0) + 1,
      );
    }
  }

  for (const account of accountItems) {
    if (account.shippingCenterId) {
      accountCountsByShippingCenter.set(
        account.shippingCenterId,
        (accountCountsByShippingCenter.get(account.shippingCenterId) ?? 0) + 1,
      );
    }
  }

  for (const territory of territoryItems) {
    if (territory.shippingCenterId) {
      territoryCountsByShippingCenter.set(
        territory.shippingCenterId,
        (territoryCountsByShippingCenter.get(territory.shippingCenterId) ?? 0) + 1,
      );
    }
  }

  return {
    policy: toTerritoryPolicySummary(policy),
    regions,
    territories,
    coverageEntries,
    shippingCenters: shippingCenterItems.map((item) =>
      toTerritoryMapShippingCenterSummary(item, {
        servicedTerritoryCount: territoryCountsByShippingCenter.get(item.id) ?? 0,
        activeLeadCount: leadCountsByShippingCenter.get(item.id) ?? 0,
        activeAccountCount: accountCountsByShippingCenter.get(item.id) ?? 0,
      }),
    ),
    accountPins: accountItems.map(toTerritoryMapAccountPin),
    leadPins: leadItems.map(toTerritoryMapLeadPin),
    generatedAt: new Date().toISOString(),
  };
}

export async function getTerritoryDashboard(actor: AuthenticatedActor): Promise<TerritoryDashboardResponse> {
  assertModuleAccess(actor.role, 'territories');
  const territoryScope = buildTerritoryReadScope(actor);
  const regionScope = buildRegionReadScope(actor);
  const shippingCenterScope = buildShippingCenterReadScope(actor);
  const leadScope = buildLeadRecordScope(actor);
  const accountScope = buildAccountRecordScope(actor);

  const regionQuery = {
    orderBy: [{ name: 'asc' }],
    ...(regionScope ? { where: regionScope } : {}),
    include: {
      directorUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  } satisfies Prisma.RegionFindManyArgs;

  const territoryQuery = {
    orderBy: [{ name: 'asc' }],
    ...(territoryScope ? { where: territoryScope } : {}),
    include: TERRITORY_INCLUDE,
  } satisfies Prisma.TerritoryFindManyArgs;

  const shippingCenterQuery = {
    orderBy: [{ name: 'asc' }],
    ...(shippingCenterScope ? { where: shippingCenterScope } : {}),
    select: {
      id: true,
      isActive: true,
    },
  } satisfies Prisma.ShippingCenterFindManyArgs;

  const [regionItems, territoryItems, shippingCenterItems, leadItems, accountItems] = await Promise.all([
    prisma.region.findMany(regionQuery),
    prisma.territory.findMany(territoryQuery),
    prisma.shippingCenter.findMany(shippingCenterQuery),
    prisma.lead.findMany({
      where: leadScope
        ? {
            AND: [
              leadScope,
              {
                lifecycleStatus: LeadLifecycleStatus.ACTIVE,
                stage: {
                  not: LeadStage.CUSTOMER_ACTIVE,
                },
              },
            ],
          }
        : {
            lifecycleStatus: LeadLifecycleStatus.ACTIVE,
            stage: {
              not: LeadStage.CUSTOMER_ACTIVE,
            },
          },
      select: {
        id: true,
        territoryId: true,
        shippingCenterId: true,
        assignedTmUserId: true,
        assignedRdUserId: true,
        routingTeam: true,
      },
    }),
    prisma.account.findMany({
      where: accountScope
        ? {
            AND: [
              accountScope,
              {
                isActive: true,
              },
            ],
          }
        : {
            isActive: true,
          },
      select: {
        id: true,
        territoryId: true,
        shippingCenterId: true,
        assignedTmUserId: true,
        assignedRdUserId: true,
      },
    }),
  ]);

  const territories = territoryItems.map(toTerritorySummary);
  const regions = regionItems.map((item) =>
    toRegionSummaryWithVisibleTerritoryCount(
      item,
      territories.filter((territory) => territory.regionId === item.id).length,
    ),
  );
  const leadRecords = leadItems as TerritoryDashboardLeadRecord[];
  const accountRecords = accountItems as TerritoryDashboardAccountRecord[];

  const territoryById = new Map(territories.map((territory) => [territory.id, territory]));
  const territoryLeadCounts = new Map<string, number>();
  const territoryAccountCounts = new Map<string, number>();
  const regionLeadCounts = new Map<string, number>();
  const regionAccountCounts = new Map<string, number>();

  for (const lead of leadRecords) {
    if (!lead.territoryId) {
      continue;
    }

    territoryLeadCounts.set(lead.territoryId, (territoryLeadCounts.get(lead.territoryId) ?? 0) + 1);
    const territory = territoryById.get(lead.territoryId);
    if (territory) {
      regionLeadCounts.set(territory.regionId, (regionLeadCounts.get(territory.regionId) ?? 0) + 1);
    }
  }

  for (const account of accountRecords) {
    if (!account.territoryId) {
      continue;
    }

    territoryAccountCounts.set(account.territoryId, (territoryAccountCounts.get(account.territoryId) ?? 0) + 1);
    const territory = territoryById.get(account.territoryId);
    if (territory) {
      regionAccountCounts.set(territory.regionId, (regionAccountCounts.get(territory.regionId) ?? 0) + 1);
    }
  }

  const queue: TerritoryDashboardQueueSummary = {
    unassignedLeads: leadRecords.filter((lead) => !lead.territoryId).length,
    unassignedAccounts: accountRecords.filter((account) => !account.territoryId).length,
    strategicGrowthLeads: leadRecords.filter((lead) => lead.routingTeam === LeadRoutingTeam.STRATEGIC_GROWTH).length,
    nationalTmLeads: leadRecords.filter((lead) => lead.routingTeam === LeadRoutingTeam.NATIONAL_TM).length,
    territoriesMissingManager: territories.filter((territory) => !territory.managerUserId).length,
    territoriesMissingShippingCenter: territories.filter((territory) => !territory.shippingCenterId).length,
    regionsMissingDirector: regions.filter((region) => !region.directorUserId).length,
  };

  const stats: TerritoryDashboardStats = {
    regions: regions.length,
    territories: territories.length,
    coveredStates: territories.reduce((sum, territory) => sum + territory.coverageStates.length, 0),
    shippingCenters: shippingCenterItems.filter((center) => center.isActive).length,
    activeLeads: leadRecords.length,
    activeAccounts: accountRecords.length,
    assignedLeads: leadRecords.filter((lead) => Boolean(lead.territoryId)).length,
    assignedAccounts: accountRecords.filter((account) => Boolean(account.territoryId)).length,
    unassignedLeads: queue.unassignedLeads,
    unassignedAccounts: queue.unassignedAccounts,
    strategicGrowthLeads: queue.strategicGrowthLeads,
    nationalTmLeads: queue.nationalTmLeads,
  };

  const alerts = buildTerritoryDashboardAlerts(queue);
  const workloads = buildTerritoryDashboardWorkloads(territories, territoryLeadCounts, territoryAccountCounts);
  const regionRollups = buildTerritoryDashboardRegionRollups(
    regions,
    territories,
    regionLeadCounts,
    regionAccountCounts,
  );
  const ownerMetrics = await buildTerritoryDashboardOwnerMetrics({
    regions,
    territories,
    leadRecords,
    accountRecords,
    territoryById,
  });

  return {
    stats,
    alerts,
    workloads,
    regionRollups,
    ownerMetrics,
    queue,
    generatedAt: new Date().toISOString(),
  };
}

export async function createTerritory(actor: AuthenticatedActor, input: CreateTerritoryRequest): Promise<TerritorySummary> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const code = normalizeCode(input.code, 'code');
  const name = requireText(input.name, 'name');
  await requireRegion(input.regionId);
  const managerUserId = await validateOptionalUserId(input.managerUserId);
  const shippingCenterId = await validateOptionalShippingCenterId(input.shippingCenterId);
  const isActive = input.isActive ?? true;
  const notes = optionalText(input.notes);

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.territory.create({
      data: {
        code,
        name,
        regionId: input.regionId,
        ...(managerUserId ? { managerUserId } : {}),
        ...(shippingCenterId ? { shippingCenterId } : {}),
        isActive,
        ...(notes !== undefined ? { notes } : {}),
      },
      include: TERRITORY_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TERRITORY_ENTITY_TYPE,
        entityId: next.id,
        afterData: toTerritoryAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.create_territory'),
      }),
    });

    return next;
  });

  return toTerritorySummary(created);
}

export async function updateTerritory(
  actor: AuthenticatedActor,
  territoryId: string,
  input: UpdateTerritoryRequest,
): Promise<TerritorySummary | null> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const current = await prisma.territory.findUnique({
    where: { id: territoryId },
    include: TERRITORY_INCLUDE,
  });
  if (!current) {
    return null;
  }

  if (input.regionId !== undefined) {
    await requireRegion(input.regionId);
  }

  const managerUserId =
    input.managerUserId === undefined ? undefined : await validateOptionalUserId(input.managerUserId ?? null);
  const shippingCenterId =
    input.shippingCenterId === undefined
      ? undefined
      : await validateOptionalShippingCenterId(input.shippingCenterId ?? null);

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.territory.update({
      where: { id: territoryId },
      data: {
        ...(input.name !== undefined ? { name: requireText(input.name, 'name') } : {}),
        ...(input.regionId !== undefined ? { regionId: input.regionId } : {}),
        ...(managerUserId !== undefined ? { managerUserId } : {}),
        ...(shippingCenterId !== undefined ? { shippingCenterId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: optionalText(input.notes) ?? null } : {}),
      },
      include: TERRITORY_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TERRITORY_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toTerritoryAuditPayload(current),
        afterData: toTerritoryAuditPayload(next),
        metadata: baseMetadata(actor, 'territory.update_territory'),
      }),
    });

    await refreshLeadTerritoryAssignments(tx, {
      where: {
        territoryId,
      },
      changedByUserId: actor.userId,
      reasonCode: 'territory_refresh',
      reasonNote: 'Lead territory assignments were refreshed after territory settings changed.',
    });

    await refreshAccountTerritoryAssignments(tx, {
      where: {
        territoryId,
      },
      changedByUserId: actor.userId,
      reasonCode: 'territory_refresh',
      reasonNote: 'Account territory assignments were refreshed after territory settings changed.',
    });

    return next;
  });

  return toTerritorySummary(updated);
}

export async function replaceTerritoryCoverage(
  actor: AuthenticatedActor,
  territoryId: string,
  input: ReplaceTerritoryCoverageRequest,
): Promise<TerritorySummary | null> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.admin');

  const current = await prisma.territory.findUnique({
    where: { id: territoryId },
    include: TERRITORY_INCLUDE,
  });
  if (!current) {
    return null;
  }

  const normalizedCoverage = Array.from(
    new Map(
      input.coverage.map((entry) => {
        const stateCode = normalizeStateCode(entry.stateCode);
        if (!stateCode) {
          throw new Error('State/Province must be a valid US state or Canadian province');
        }

        const countryCode = normalizeCountryCode(entry.countryCode, entry.stateCode);
        return [`${countryCode}:${stateCode}`, { stateCode, countryCode }];
      }),
    ).values(),
  );

  await validateCoverageConflicts(territoryId, normalizedCoverage);
  const previousStates = current.stateCoverage.map((entry) => entry.stateCode);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.territoryStateCoverage.deleteMany({
      where: { territoryId },
    });

    if (normalizedCoverage.length > 0) {
      await tx.territoryStateCoverage.createMany({
        data: normalizedCoverage.map((entry) => ({
          territoryId,
          stateCode: entry.stateCode,
          countryCode: entry.countryCode,
        })),
      });
    }

    const next = await tx.territory.findUniqueOrThrow({
      where: { id: territoryId },
      include: TERRITORY_INCLUDE,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TERRITORY_COVERAGE_ENTITY_TYPE,
        entityId: territoryId,
        beforeData: {
          coverage: current.stateCoverage.map((entry) => `${entry.countryCode}:${entry.stateCode}`),
        },
        afterData: {
          coverage: next.stateCoverage.map((entry) => `${entry.countryCode}:${entry.stateCode}`),
        },
        metadata: baseMetadata(actor, 'territory.replace_coverage'),
      }),
    });

    await refreshLeadTerritoryAssignments(tx, {
      where: {
        OR: [
          { territoryId },
          {
            state: {
              in: Array.from(new Set([...previousStates, ...normalizedCoverage.map((entry) => entry.stateCode)])),
            },
          },
        ],
      },
      changedByUserId: actor.userId,
      reasonCode: 'coverage_refresh',
      reasonNote: 'Lead territory assignments were refreshed after territory coverage changed.',
    });

    await refreshAccountTerritoryAssignments(tx, {
      where: {
        OR: [
          { territoryId },
          {
            locations: {
              some: {
                isActive: true,
                state: {
                  in: Array.from(new Set([...previousStates, ...normalizedCoverage.map((entry) => entry.stateCode)])),
                },
              },
            },
          },
        ],
      },
      changedByUserId: actor.userId,
      reasonCode: 'coverage_refresh',
      reasonNote: 'Account territory assignments were refreshed after territory coverage changed.',
    });

    return next;
  });

  return toTerritorySummary(updated);
}

export async function listTerritoryAssignmentHistory(
  actor: AuthenticatedActor,
  entityType: 'lead' | 'account' | 'location',
  entityId: string,
): Promise<ListTerritoryAssignmentHistoryResponse> {
  assertModuleAccess(actor.role, 'territories');
  await assertTerritoryAssignmentHistoryVisible(actor, entityType, entityId);

  const items = await prisma.territoryAssignmentHistory.findMany({
    where: {
      entityType: toTerritoryAssignmentEntityType(entityType),
      entityId,
    },
    orderBy: [{ changedAt: 'desc' }],
    include: {
      changedByUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  return {
    items: items.map((item) => ({
      id: item.id,
      entityType,
      entityId: item.entityId,
      assignmentMethod: toTerritoryAssignmentMethodKey(item.assignmentMethod),
      ...(item.previousTerritoryId ? { previousTerritoryId: item.previousTerritoryId } : {}),
      ...(item.previousTerritoryCode ? { previousTerritoryCode: item.previousTerritoryCode } : {}),
      ...(item.nextTerritoryId ? { nextTerritoryId: item.nextTerritoryId } : {}),
      ...(item.nextTerritoryCode ? { nextTerritoryCode: item.nextTerritoryCode } : {}),
      ...(item.previousShippingCenterId ? { previousShippingCenterId: item.previousShippingCenterId } : {}),
      ...(item.nextShippingCenterId ? { nextShippingCenterId: item.nextShippingCenterId } : {}),
      ...(item.previousAssignedTmUserId ? { previousAssignedTmUserId: item.previousAssignedTmUserId } : {}),
      ...(item.nextAssignedTmUserId ? { nextAssignedTmUserId: item.nextAssignedTmUserId } : {}),
      ...(item.previousAssignedRdUserId ? { previousAssignedRdUserId: item.previousAssignedRdUserId } : {}),
      ...(item.nextAssignedRdUserId ? { nextAssignedRdUserId: item.nextAssignedRdUserId } : {}),
      ...(item.changedByUserId ? { changedByUserId: item.changedByUserId } : {}),
      ...(item.changedByUser?.displayName ? { changedByUserName: item.changedByUser.displayName } : {}),
      ...(item.reasonCode ? { reasonCode: item.reasonCode } : {}),
      ...(item.reasonNote ? { reasonNote: item.reasonNote } : {}),
      changedAt: item.changedAt.toISOString(),
    })),
  };
}

export async function listTerritoryAssignableUsers(actor: AuthenticatedActor): Promise<ListTerritoryAssignableUsersResponse> {
  assertModuleAccess(actor.role, 'territories');

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      userType: UserKind.INTERNAL,
      roleCode: {
        in: [...ASSIGNABLE_TERRITORY_ROLE_CODES],
      },
    },
    orderBy: [
      { roleCode: 'asc' },
      { displayName: 'asc' },
    ],
    select: {
      id: true,
      displayName: true,
      email: true,
      roleCode: true,
    },
  });

  const mapped = users.map<TerritoryAssignableUserSummary>((user) => ({
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    role: normalizeRole(user.roleCode),
  }));

  return {
    territoryManagers: mapped.filter((user) => user.role === 'TERRITORY_MANAGER'),
    regionalDirectors: mapped.filter((user) => user.role === 'REGIONAL_DIRECTOR'),
  };
}

export async function reassignLeadTerritory(
  actor: AuthenticatedActor,
  leadId: string,
  input: ReassignLeadTerritoryRequest,
): Promise<LeadTerritoryAssignmentSummary | null> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.reassign');

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: LEAD_TERRITORY_INCLUDE,
  });
  if (!lead) {
    return null;
  }

  const territory = await prisma.territory.findUnique({
    where: { id: input.territoryId },
    include: TERRITORY_INCLUDE,
  });
  if (!territory || !territory.isActive) {
    throw new Error('Unknown or inactive territory');
  }

  const assignedTmUserId = await validateOptionalTerritoryOwnerUserId(input.assignedTmUserId, 'TERRITORY_MANAGER');
  const assignedRdUserId = await validateOptionalTerritoryOwnerUserId(input.assignedRdUserId, 'REGIONAL_DIRECTOR');
  const reasonCode = requireText(input.reasonCode, 'reasonCode');
  const reasonNote = optionalText(input.reasonNote);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.territoryAssignmentOverride.upsert({
      where: {
        entityType_entityId: {
          entityType: TerritoryAssignmentEntityType.LEAD,
          entityId: leadId,
        },
      },
      update: {
        territoryId: territory.id,
        ...(assignedTmUserId !== undefined ? { assignedTmUserId } : { assignedTmUserId: null }),
        ...(assignedRdUserId !== undefined ? { assignedRdUserId } : { assignedRdUserId: null }),
        reasonCode,
        ...(reasonNote !== undefined ? { reasonNote } : { reasonNote: null }),
        createdByUserId: actor.userId,
      },
      create: {
        entityType: TerritoryAssignmentEntityType.LEAD,
        entityId: leadId,
        territoryId: territory.id,
        ...(assignedTmUserId !== undefined ? { assignedTmUserId } : {}),
        ...(assignedRdUserId !== undefined ? { assignedRdUserId } : {}),
        reasonCode,
        ...(reasonNote !== undefined ? { reasonNote } : {}),
        createdByUserId: actor.userId,
      },
    });

    const next = await syncLeadTerritoryAssignment(tx, {
      leadId,
      assignmentMethod: TerritoryAssignmentMethod.MANUAL_OVERRIDE,
      changedByUserId: actor.userId,
      reasonCode,
      ...(reasonNote !== undefined ? { reasonNote } : {}),
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TERRITORY_OVERRIDE_ENTITY_TYPE,
        entityId: leadId,
        afterData: {
          territoryId: territory.id,
          territoryCode: territory.code,
          leadId,
          assignedTmUserId: assignedTmUserId ?? undefined,
          assignedRdUserId: assignedRdUserId ?? undefined,
          reasonCode,
          reasonNote: reasonNote ?? undefined,
        },
        metadata: baseMetadata(actor, 'territory.reassign_lead'),
      }),
    });

    return next;
  });

  return toLeadTerritoryAssignmentSummary(updated);
}

export async function reassignAccountTerritory(
  actor: AuthenticatedActor,
  accountId: string,
  input: ReassignAccountTerritoryRequest,
): Promise<AccountTerritoryAssignmentSummary | null> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.reassign');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: ACCOUNT_TERRITORY_INCLUDE,
  });
  if (!account) {
    return null;
  }

  const territory = await prisma.territory.findUnique({
    where: { id: input.territoryId },
    include: TERRITORY_INCLUDE,
  });
  if (!territory || !territory.isActive) {
    throw new Error('Unknown or inactive territory');
  }

  const assignedTmUserId = await validateOptionalTerritoryOwnerUserId(input.assignedTmUserId, 'TERRITORY_MANAGER');
  const assignedRdUserId = await validateOptionalTerritoryOwnerUserId(input.assignedRdUserId, 'REGIONAL_DIRECTOR');
  const reasonCode = requireText(input.reasonCode, 'reasonCode');
  const reasonNote = optionalText(input.reasonNote);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.territoryAssignmentOverride.upsert({
      where: {
        entityType_entityId: {
          entityType: TerritoryAssignmentEntityType.ACCOUNT,
          entityId: accountId,
        },
      },
      update: {
        territoryId: territory.id,
        ...(assignedTmUserId !== undefined ? { assignedTmUserId } : { assignedTmUserId: null }),
        ...(assignedRdUserId !== undefined ? { assignedRdUserId } : { assignedRdUserId: null }),
        reasonCode,
        ...(reasonNote !== undefined ? { reasonNote } : { reasonNote: null }),
        createdByUserId: actor.userId,
      },
      create: {
        entityType: TerritoryAssignmentEntityType.ACCOUNT,
        entityId: accountId,
        territoryId: territory.id,
        ...(assignedTmUserId !== undefined ? { assignedTmUserId } : {}),
        ...(assignedRdUserId !== undefined ? { assignedRdUserId } : {}),
        reasonCode,
        ...(reasonNote !== undefined ? { reasonNote } : {}),
        createdByUserId: actor.userId,
      },
    });

    const next = await syncAccountTerritoryAssignment(tx, {
      accountId,
      assignmentMethod: TerritoryAssignmentMethod.MANUAL_OVERRIDE,
      changedByUserId: actor.userId,
      reasonCode,
      ...(reasonNote !== undefined ? { reasonNote } : {}),
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TERRITORY_OVERRIDE_ENTITY_TYPE,
        entityId: accountId,
        afterData: {
          territoryId: territory.id,
          territoryCode: territory.code,
          accountId,
          assignedTmUserId: assignedTmUserId ?? undefined,
          assignedRdUserId: assignedRdUserId ?? undefined,
          reasonCode,
          reasonNote: reasonNote ?? undefined,
        },
        metadata: baseMetadata(actor, 'territory.reassign_account'),
      }),
    });

    return next;
  });

  return toAccountTerritoryAssignmentSummary(updated);
}

export async function resolveLeadTerritoryContext(
  tx: Prisma.TransactionClient,
  input: {
    leadId?: string;
    state?: string | null;
    countryCode?: string | null;
    routingTeam: LeadRoutingTeam;
  },
): Promise<TerritoryResolution> {
  const countryCode = normalizeCountryCode(input.countryCode, input.state);
  const policy = await requireTerritoryPolicy(tx);

  let territory: TerritoryWithRefs | null = null;
  let assignmentMethod: TerritoryAssignmentMethod = TerritoryAssignmentMethod.DEFAULT_STATE;
  let override:
    | Prisma.TerritoryAssignmentOverrideGetPayload<{
        include: {
          territory: {
            include: typeof TERRITORY_INCLUDE;
          };
          assignedTmUser: {
            select: {
              id: true;
              displayName: true;
            };
          };
          assignedRdUser: {
            select: {
              id: true;
              displayName: true;
            };
          };
        };
      }>
    | null = null;

  if (input.leadId) {
    override = await tx.territoryAssignmentOverride.findUnique({
      where: {
        entityType_entityId: {
          entityType: TerritoryAssignmentEntityType.LEAD,
          entityId: input.leadId,
        },
      },
      include: {
        territory: {
          include: TERRITORY_INCLUDE,
        },
        assignedTmUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        assignedRdUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    if (override?.territory?.isActive) {
      territory = override.territory;
      assignmentMethod = TerritoryAssignmentMethod.MANUAL_OVERRIDE;
    }
  }

  const stateCode = normalizeStateCode(input.state);
  if (!territory) {
    if (!stateCode) {
      return {};
    }

    const coverage = await tx.territoryStateCoverage.findUnique({
      where: {
        countryCode_stateCode: {
          countryCode,
          stateCode,
        },
      },
      include: {
        territory: {
          include: TERRITORY_INCLUDE,
        },
      },
    });

    if (coverage?.territory?.isActive) {
      territory = coverage.territory;
    }
  }

  if (!territory) {
    return {};
  }

  const base: TerritoryResolution = {
    territoryId: territory.id,
    territoryCode: territory.code,
    territoryName: territory.name,
    regionId: territory.regionId,
    regionCode: territory.region.code,
    regionName: territory.region.name,
    ...(territory.shippingCenterId ? { shippingCenterId: territory.shippingCenterId } : {}),
    ...(territory.shippingCenter?.code ? { shippingCenterCode: territory.shippingCenter.code } : {}),
    ...(territory.shippingCenter?.name ? { shippingCenterName: territory.shippingCenter.name } : {}),
    assignmentMethod,
  };

  if (assignmentMethod === TerritoryAssignmentMethod.MANUAL_OVERRIDE) {
    const assignedTmUserId = override?.assignedTmUserId ?? territory.managerUserId ?? undefined;
    const assignedTmName = override?.assignedTmUser?.displayName ?? territory.managerUser?.displayName ?? undefined;
    const assignedRdUserId = override?.assignedRdUserId ?? territory.region.directorUserId ?? undefined;
    const assignedRdName = override?.assignedRdUser?.displayName ?? territory.region.directorUser?.displayName ?? undefined;
    return {
      ...base,
      ...(assignedTmUserId ? { assignedTmUserId } : {}),
      ...(assignedTmName ? { assignedTmName } : {}),
      ...(assignedRdUserId ? { assignedRdUserId } : {}),
      ...(assignedRdName ? { assignedRdName } : {}),
    };
  }

  if (input.routingTeam === LeadRoutingTeam.STRATEGIC_GROWTH && policy.strategicGrowthRetainsOwnership) {
    return base;
  }

  if (input.routingTeam === LeadRoutingTeam.NATIONAL_TM && !policy.assignNationalTmLeadsByDefault) {
    return base;
  }

  return {
    ...base,
    ...(territory.managerUserId ? { assignedTmUserId: territory.managerUserId } : {}),
    ...(territory.managerUser?.displayName ? { assignedTmName: territory.managerUser.displayName } : {}),
    ...(territory.region.directorUserId ? { assignedRdUserId: territory.region.directorUserId } : {}),
    ...(territory.region.directorUser?.displayName ? { assignedRdName: territory.region.directorUser.displayName } : {}),
  };
}

export function buildLeadTerritoryUpdateData(
  resolution: TerritoryResolution,
  assignmentMethod: TerritoryAssignmentMethod,
): Prisma.LeadUncheckedUpdateInput {
  const assignedAt = new Date();

  return {
    territoryId: resolution.territoryId ?? null,
    shippingCenterId: resolution.shippingCenterId ?? null,
    assignedTmUserId: resolution.assignedTmUserId ?? null,
    assignedRdUserId: resolution.assignedRdUserId ?? null,
    assignedTmName: resolution.assignedTmName ?? null,
    territoryAssignmentMethod: assignmentMethod,
    territoryAssignedAt: resolution.territoryId ? assignedAt : null,
  };
}

export async function syncLeadTerritoryAssignment(
  tx: Prisma.TransactionClient,
  input: {
    leadId: string;
    assignmentMethod?: TerritoryAssignmentMethod;
    changedByUserId?: string;
    reasonCode?: string;
    reasonNote?: string;
  },
) {
  const current = await tx.lead.findUniqueOrThrow({
    where: { id: input.leadId },
    include: LEAD_TERRITORY_INCLUDE,
  });

  const resolution = await resolveLeadTerritoryContext(tx, {
    leadId: input.leadId,
    state: current.state,
    countryCode: current.countryCode,
    routingTeam: current.routingTeam,
  });

  const assignmentMethod = input.assignmentMethod ?? resolution.assignmentMethod ?? TerritoryAssignmentMethod.DEFAULT_STATE;
  const next = await tx.lead.update({
    where: { id: input.leadId },
    data: buildLeadTerritoryUpdateData(resolution, assignmentMethod),
    include: LEAD_TERRITORY_INCLUDE,
  });

  if (hasLeadTerritoryAssignmentDelta(current, next, assignmentMethod)) {
    await writeLeadTerritoryHistory(tx, {
      lead: current,
      next,
      assignmentMethod,
      ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: input.changedByUserId,
        action: AuditAction.UPDATE,
        entityType: LEAD_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toLeadTerritoryAuditPayload(current),
        afterData: toLeadTerritoryAuditPayload(next),
        metadata: {
          assignmentMethod: toTerritoryAssignmentMethodKey(assignmentMethod),
          ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
          ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
          ...(input.changedByUserId ? { trigger: 'manual' } : { trigger: 'system' }),
          operation: 'lead.territory_assignment.sync',
        },
      }),
    });
  }

  return next;
}

export async function syncAccountTerritoryAssignment(
  tx: Prisma.TransactionClient,
  input: {
    accountId: string;
    assignmentMethod?: TerritoryAssignmentMethod;
    changedByUserId?: string;
    reasonCode?: string;
    reasonNote?: string;
  },
) {
  const current = await tx.account.findUniqueOrThrow({
    where: { id: input.accountId },
    include: ACCOUNT_TERRITORY_INCLUDE,
  });

  const resolution = await resolveAccountTerritoryContext(tx, {
    accountId: input.accountId,
  });

  const assignmentMethod = input.assignmentMethod ?? resolution.assignmentMethod ?? current.territoryAssignmentMethod ?? TerritoryAssignmentMethod.DEFAULT_STATE;
  const next = await tx.account.update({
    where: { id: input.accountId },
    data: buildAccountTerritoryUpdateData(resolution, assignmentMethod),
    include: ACCOUNT_TERRITORY_INCLUDE,
  });

  if (hasAccountTerritoryAssignmentDelta(current, next, assignmentMethod)) {
    await writeAccountTerritoryHistory(tx, {
      account: current,
      next,
      assignmentMethod,
      ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: input.changedByUserId,
        action: AuditAction.UPDATE,
        entityType: ACCOUNT_ENTITY_TYPE,
        entityId: next.id,
        beforeData: toAccountTerritoryAuditPayload(current),
        afterData: toAccountTerritoryAuditPayload(next),
        metadata: {
          assignmentMethod: toTerritoryAssignmentMethodKey(assignmentMethod),
          ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
          ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
          ...(input.changedByUserId ? { trigger: 'manual' } : { trigger: 'system' }),
          operation: 'account.territory_assignment.sync',
        },
      }),
    });
  }

  return next;
}

async function refreshLeadTerritoryAssignments(
  tx: Prisma.TransactionClient,
  input: {
    where: Prisma.LeadWhereInput;
    changedByUserId?: string;
    reasonCode?: string;
    reasonNote?: string;
  },
) {
  const leads = await tx.lead.findMany({
    where: {
      AND: [
        input.where,
        {
          stage: {
            not: LeadStage.CUSTOMER_ACTIVE,
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  for (const lead of leads) {
    await syncLeadTerritoryAssignment(tx, {
      leadId: lead.id,
      ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
    });
  }
}

async function refreshAccountTerritoryAssignments(
  tx: Prisma.TransactionClient,
  input: {
    where: Prisma.AccountWhereInput;
    changedByUserId?: string;
    reasonCode?: string;
    reasonNote?: string;
  },
) {
  const accounts = await tx.account.findMany({
    where: input.where,
    select: {
      id: true,
    },
  });

  for (const account of accounts) {
    await syncAccountTerritoryAssignment(tx, {
      accountId: account.id,
      ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
    });
  }
}

const TERRITORY_INCLUDE = {
  region: {
    include: {
      directorUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  },
  managerUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  shippingCenter: true,
  stateCoverage: {
    orderBy: {
      stateCode: 'asc',
    },
  },
} satisfies Prisma.TerritoryInclude;

const LEAD_TERRITORY_INCLUDE = {
  territory: {
    include: {
      region: {
        include: {
          directorUser: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
      shippingCenter: true,
    },
  },
  shippingCenter: true,
  assignedTmUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  assignedRdUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.LeadInclude;

const ACCOUNT_TERRITORY_INCLUDE = {
  territory: {
    include: {
      region: {
        include: {
          directorUser: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
      shippingCenter: true,
    },
  },
  shippingCenter: true,
  assignedTmUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  assignedRdUser: {
    select: {
      id: true,
      displayName: true,
    },
  },
  locations: {
    where: {
      isActive: true,
    },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    take: 1,
  },
} satisfies Prisma.AccountInclude;

function hasLeadTerritoryAssignmentDelta(
  current: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>,
  next: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>,
  assignmentMethod: TerritoryAssignmentMethod,
) {
  return (
    current.territoryId !== next.territoryId
    || current.shippingCenterId !== next.shippingCenterId
    || current.assignedTmUserId !== next.assignedTmUserId
    || current.assignedRdUserId !== next.assignedRdUserId
    || current.territoryAssignmentMethod !== assignmentMethod
  );
}

function hasAccountTerritoryAssignmentDelta(
  current: AccountWithTerritoryRefs,
  next: AccountWithTerritoryRefs,
  assignmentMethod: TerritoryAssignmentMethod,
) {
  return (
    current.territoryId !== next.territoryId
    || current.shippingCenterId !== next.shippingCenterId
    || current.assignedTmUserId !== next.assignedTmUserId
    || current.assignedRdUserId !== next.assignedRdUserId
    || current.territoryAssignmentMethod !== assignmentMethod
  );
}

async function writeLeadTerritoryHistory(
  tx: Prisma.TransactionClient,
  input: {
    lead: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>;
    next: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>;
    changedByUserId?: string;
    assignmentMethod: TerritoryAssignmentMethod;
    reasonCode?: string;
    reasonNote?: string;
  },
) {
  await tx.territoryAssignmentHistory.create({
    data: {
      entityType: TerritoryAssignmentEntityType.LEAD,
      entityId: input.next.id,
      assignmentMethod: input.assignmentMethod,
      ...(input.lead.territoryId ? { previousTerritoryId: input.lead.territoryId } : {}),
      ...(input.next.territoryId ? { nextTerritoryId: input.next.territoryId } : {}),
      ...(input.lead.shippingCenterId ? { previousShippingCenterId: input.lead.shippingCenterId } : {}),
      ...(input.next.shippingCenterId ? { nextShippingCenterId: input.next.shippingCenterId } : {}),
      ...(input.lead.assignedTmUserId ? { previousAssignedTmUserId: input.lead.assignedTmUserId } : {}),
      ...(input.next.assignedTmUserId ? { nextAssignedTmUserId: input.next.assignedTmUserId } : {}),
      ...(input.lead.assignedRdUserId ? { previousAssignedRdUserId: input.lead.assignedRdUserId } : {}),
      ...(input.next.assignedRdUserId ? { nextAssignedRdUserId: input.next.assignedRdUserId } : {}),
      ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
      ...(input.lead.territory?.code ? { previousTerritoryCode: input.lead.territory.code } : {}),
      ...(input.next.territory?.code ? { nextTerritoryCode: input.next.territory.code } : {}),
    },
  });
}

async function writeAccountTerritoryHistory(
  tx: Prisma.TransactionClient,
  input: {
    account: AccountWithTerritoryRefs;
    next: AccountWithTerritoryRefs;
    changedByUserId?: string;
    assignmentMethod: TerritoryAssignmentMethod;
    reasonCode?: string;
    reasonNote?: string;
  },
) {
  await tx.territoryAssignmentHistory.create({
    data: {
      entityType: TerritoryAssignmentEntityType.ACCOUNT,
      entityId: input.next.id,
      assignmentMethod: input.assignmentMethod,
      ...(input.account.territoryId ? { previousTerritoryId: input.account.territoryId } : {}),
      ...(input.next.territoryId ? { nextTerritoryId: input.next.territoryId } : {}),
      ...(input.account.shippingCenterId ? { previousShippingCenterId: input.account.shippingCenterId } : {}),
      ...(input.next.shippingCenterId ? { nextShippingCenterId: input.next.shippingCenterId } : {}),
      ...(input.account.assignedTmUserId ? { previousAssignedTmUserId: input.account.assignedTmUserId } : {}),
      ...(input.next.assignedTmUserId ? { nextAssignedTmUserId: input.next.assignedTmUserId } : {}),
      ...(input.account.assignedRdUserId ? { previousAssignedRdUserId: input.account.assignedRdUserId } : {}),
      ...(input.next.assignedRdUserId ? { nextAssignedRdUserId: input.next.assignedRdUserId } : {}),
      ...(input.changedByUserId ? { changedByUserId: input.changedByUserId } : {}),
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
      ...(input.reasonNote ? { reasonNote: input.reasonNote } : {}),
      ...(input.account.territory?.code ? { previousTerritoryCode: input.account.territory.code } : {}),
      ...(input.next.territory?.code ? { nextTerritoryCode: input.next.territory.code } : {}),
    },
  });
}

async function resolveAccountTerritoryContext(
  tx: Prisma.TransactionClient,
  input: {
    accountId: string;
  },
): Promise<TerritoryResolution> {
  const account = await tx.account.findUniqueOrThrow({
    where: { id: input.accountId },
    include: ACCOUNT_TERRITORY_INCLUDE,
  });

  let territory: TerritoryWithRefs | null = null;
  let assignmentMethod: TerritoryAssignmentMethod = TerritoryAssignmentMethod.DEFAULT_STATE;

  const override = await tx.territoryAssignmentOverride.findUnique({
    where: {
      entityType_entityId: {
        entityType: TerritoryAssignmentEntityType.ACCOUNT,
        entityId: input.accountId,
      },
    },
    include: {
      territory: {
        include: TERRITORY_INCLUDE,
      },
      assignedTmUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      assignedRdUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });

  if (override?.territory?.isActive) {
    territory = override.territory;
    assignmentMethod = TerritoryAssignmentMethod.MANUAL_OVERRIDE;
  }

  const primaryLocation = account.locations[0] ?? null;
  if (!territory && primaryLocation?.state) {
    const countryCode = normalizeCountryCode(primaryLocation.countryCode, primaryLocation.state);
    const stateCode = normalizeStateCode(primaryLocation.state);

    if (stateCode) {
      const coverage = await tx.territoryStateCoverage.findUnique({
        where: {
          countryCode_stateCode: {
            countryCode,
            stateCode,
          },
        },
        include: {
          territory: {
            include: TERRITORY_INCLUDE,
          },
        },
      });

      if (coverage?.territory?.isActive) {
        territory = coverage.territory;
      }
    }
  }

  if (!territory && account.territory?.isActive) {
    territory = account.territory as TerritoryWithRefs;
    assignmentMethod = account.territoryAssignmentMethod ?? TerritoryAssignmentMethod.SYSTEM;
  }

  if (!territory) {
    return {};
  }

  const base: TerritoryResolution = {
    territoryId: territory.id,
    territoryCode: territory.code,
    territoryName: territory.name,
    regionId: territory.regionId,
    regionCode: territory.region.code,
    regionName: territory.region.name,
    ...(territory.shippingCenterId ? { shippingCenterId: territory.shippingCenterId } : {}),
    ...(territory.shippingCenter?.code ? { shippingCenterCode: territory.shippingCenter.code } : {}),
    ...(territory.shippingCenter?.name ? { shippingCenterName: territory.shippingCenter.name } : {}),
    assignmentMethod,
  };

  if (assignmentMethod === TerritoryAssignmentMethod.MANUAL_OVERRIDE) {
    const assignedTmUserId = override?.assignedTmUserId ?? territory.managerUserId ?? undefined;
    const assignedTmName = override?.assignedTmUser?.displayName ?? territory.managerUser?.displayName ?? undefined;
    const assignedRdUserId = override?.assignedRdUserId ?? territory.region.directorUserId ?? undefined;
    const assignedRdName = override?.assignedRdUser?.displayName ?? territory.region.directorUser?.displayName ?? undefined;
    return {
      ...base,
      ...(assignedTmUserId ? { assignedTmUserId } : {}),
      ...(assignedTmName ? { assignedTmName } : {}),
      ...(assignedRdUserId ? { assignedRdUserId } : {}),
      ...(assignedRdName ? { assignedRdName } : {}),
    };
  }

  return {
    ...base,
    ...(territory.managerUserId ? { assignedTmUserId: territory.managerUserId } : {}),
    ...(territory.managerUser?.displayName ? { assignedTmName: territory.managerUser.displayName } : {}),
    ...(territory.region.directorUserId ? { assignedRdUserId: territory.region.directorUserId } : {}),
    ...(territory.region.directorUser?.displayName ? { assignedRdName: territory.region.directorUser.displayName } : {}),
  };
}

function buildAccountTerritoryUpdateData(
  resolution: TerritoryResolution,
  assignmentMethod: TerritoryAssignmentMethod,
): Prisma.AccountUncheckedUpdateInput {
  const assignedAt = new Date();

  return {
    territoryId: resolution.territoryId ?? null,
    shippingCenterId: resolution.shippingCenterId ?? null,
    assignedTmUserId: resolution.assignedTmUserId ?? null,
    assignedRdUserId: resolution.assignedRdUserId ?? null,
    territoryAssignmentMethod: assignmentMethod,
    territoryAssignedAt: resolution.territoryId ? assignedAt : null,
  };
}

async function requireTerritoryPolicy(tx: Prisma.TransactionClient = prisma) {
  const policy = await tx.territoryPolicy.findUnique({
    where: { id: 'default' },
  });

  if (!policy) {
    throw new Error('Territory policy is not seeded');
  }

  return policy;
}

async function requireRegion(regionId: string) {
  const region = await prisma.region.findUnique({
    where: { id: regionId },
    select: { id: true, isActive: true },
  });

  if (!region || !region.isActive) {
    throw new Error('Unknown or inactive region');
  }
}

async function validateOptionalUserId(userId: string | null | undefined) {
  const normalized = optionalText(userId);
  if (!normalized) {
    return normalized;
  }

  const user = await prisma.user.findUnique({
    where: { id: normalized },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new Error('Unknown or inactive user');
  }

  return user.id;
}

async function validateOptionalTerritoryOwnerUserId(
  userId: string | null | undefined,
  expectedRole: 'TERRITORY_MANAGER' | 'REGIONAL_DIRECTOR',
) {
  const normalized = optionalText(userId);
  if (!normalized) {
    return undefined;
  }

  const user = await prisma.user.findUnique({
    where: { id: normalized },
    select: {
      id: true,
      isActive: true,
      userType: true,
      roleCode: true,
    },
  });

  if (!user || !user.isActive || user.userType !== UserKind.INTERNAL) {
    throw new Error('Unknown or inactive assignable user');
  }
  if (normalizeRole(user.roleCode) !== expectedRole) {
    throw new Error(`Selected user must have role ${expectedRole}`);
  }

  return user.id;
}

async function validateOptionalShippingCenterId(shippingCenterId: string | null | undefined) {
  const normalized = optionalText(shippingCenterId);
  if (!normalized) {
    return normalized;
  }

  const center = await prisma.shippingCenter.findUnique({
    where: { id: normalized },
    select: { id: true, isActive: true },
  });

  if (!center || !center.isActive) {
    throw new Error('Unknown or inactive shipping center');
  }

  return center.id;
}

async function validateCoverageConflicts(
  territoryId: string,
  coverage: Array<{ stateCode: string; countryCode: string }>,
) {
  for (const entry of coverage) {
    const conflict = await prisma.territoryStateCoverage.findUnique({
      where: {
        countryCode_stateCode: {
          countryCode: entry.countryCode,
          stateCode: entry.stateCode,
        },
      },
    });

    if (conflict && conflict.territoryId !== territoryId) {
      throw new Error(`Coverage already exists for ${entry.countryCode}:${entry.stateCode}`);
    }
  }
}

function toRegionSummary(
  item: Prisma.RegionGetPayload<{
    include: {
      directorUser: {
        select: {
          id: true;
          displayName: true;
        };
      };
      _count: {
        select: {
          territories: true;
        };
      };
    };
  }>,
): RegionSummary {
  return toRegionSummaryWithVisibleTerritoryCount(item, item._count.territories);
}

function toRegionSummaryWithVisibleTerritoryCount(
  item: {
    id: string;
    code: string;
    name: string;
    directorUserId: string | null;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    directorUser?: {
      id: string;
      displayName: string;
    } | null;
  },
  territoryCount: number,
): RegionSummary {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    ...(item.directorUserId ? { directorUserId: item.directorUserId } : {}),
    ...(item.directorUser?.displayName ? { directorUserName: item.directorUser.displayName } : {}),
    isActive: item.isActive,
    ...(item.notes ? { notes: item.notes } : {}),
    territoryCount,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toShippingCenterSummary(item: Prisma.ShippingCenterGetPayload<{}>): ShippingCenterSummary {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    ...(item.city ? { city: item.city } : {}),
    ...(item.state ? { state: item.state } : {}),
    countryCode: item.countryCode,
    isActive: item.isActive,
    ...(item.notes ? { notes: item.notes } : {}),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toTerritorySummary(item: TerritoryWithRefs): TerritorySummary {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    regionId: item.regionId,
    regionCode: item.region.code,
    regionName: item.region.name,
    ...(item.managerUserId ? { managerUserId: item.managerUserId } : {}),
    ...(item.managerUser?.displayName ? { managerUserName: item.managerUser.displayName } : {}),
    ...(item.region.directorUserId ? { directorUserId: item.region.directorUserId } : {}),
    ...(item.region.directorUser?.displayName ? { directorUserName: item.region.directorUser.displayName } : {}),
    ...(item.shippingCenterId ? { shippingCenterId: item.shippingCenterId } : {}),
    ...(item.shippingCenter?.code ? { shippingCenterCode: item.shippingCenter.code } : {}),
    ...(item.shippingCenter?.name ? { shippingCenterName: item.shippingCenter.name } : {}),
    isActive: item.isActive,
    ...(item.notes ? { notes: item.notes } : {}),
    coverageStates: item.stateCoverage.map((entry) => entry.stateCode),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function buildTerritoryDashboardAlerts(queue: TerritoryDashboardQueueSummary): TerritoryDashboardAlert[] {
  const alerts: TerritoryDashboardAlert[] = [];

  if (queue.unassignedLeads > 0) {
    alerts.push({
      label: 'Unassigned active leads',
      detail: `${queue.unassignedLeads} live leads still need territory ownership and routing cleanup.`,
      tone: 'orange',
    });
  }

  if (queue.territoriesMissingManager > 0) {
    alerts.push({
      label: 'Territories missing TM ownership',
      detail: `${queue.territoriesMissingManager} territories do not yet have a named territory manager.`,
      tone: 'orange',
    });
  }

  if (queue.territoriesMissingShippingCenter > 0) {
    alerts.push({
      label: 'Shipping center gaps',
      detail: `${queue.territoriesMissingShippingCenter} territories are missing a linked shipping center.`,
      tone: 'red',
    });
  }

  if (queue.regionsMissingDirector > 0) {
    alerts.push({
      label: 'Regions missing RD ownership',
      detail: `${queue.regionsMissingDirector} regions do not yet have a named regional director.`,
      tone: 'blue',
    });
  }

  if (queue.unassignedAccounts > 0) {
    alerts.push({
      label: 'Unassigned active accounts',
      detail: `${queue.unassignedAccounts} active accounts still need maintained territory alignment.`,
      tone: 'orange',
    });
  }

  return alerts;
}

function buildTerritoryDashboardWorkloads(
  territories: TerritorySummary[],
  territoryLeadCounts: Map<string, number>,
  territoryAccountCounts: Map<string, number>,
): TerritoryDashboardWorkload[] {
  return territories
    .map((territory) => {
      const activeLeadCount = territoryLeadCounts.get(territory.id) ?? 0;
      const activeAccountCount = territoryAccountCounts.get(territory.id) ?? 0;

      return {
        territoryId: territory.id,
        territoryCode: territory.code,
        territoryName: territory.name,
        regionId: territory.regionId,
        regionName: territory.regionName,
        ...(territory.managerUserId ? { managerUserId: territory.managerUserId } : {}),
        ...(territory.managerUserName ? { managerName: territory.managerUserName } : {}),
        ...(territory.directorUserId ? { directorUserId: territory.directorUserId } : {}),
        ...(territory.directorUserName ? { directorUserName: territory.directorUserName } : {}),
        ...(territory.shippingCenterId ? { shippingCenterId: territory.shippingCenterId } : {}),
        ...(territory.shippingCenterName ? { shippingCenterName: territory.shippingCenterName } : {}),
        coveredStates: territory.coverageStates,
        activeLeadCount,
        activeAccountCount,
        totalWorkloadCount: activeLeadCount + activeAccountCount,
      };
    })
    .sort(
      (left, right) =>
        right.totalWorkloadCount - left.totalWorkloadCount
        || right.activeLeadCount - left.activeLeadCount
        || left.territoryName.localeCompare(right.territoryName),
    )
    .slice(0, 8);
}

function buildTerritoryDashboardRegionRollups(
  regions: RegionSummary[],
  territories: TerritorySummary[],
  regionLeadCounts: Map<string, number>,
  regionAccountCounts: Map<string, number>,
): TerritoryDashboardRegionRollupSummary[] {
  return regions
    .map((region) => {
      const regionTerritories = territories.filter((territory) => territory.regionId === region.id);
      const shippingCenterIds = new Set(regionTerritories.flatMap((territory) => territory.shippingCenterId ? [territory.shippingCenterId] : []));

      return {
        regionId: region.id,
        regionCode: region.code,
        regionName: region.name,
        ...(region.directorUserId ? { directorUserId: region.directorUserId } : {}),
        ...(region.directorUserName ? { directorUserName: region.directorUserName } : {}),
        territoryCount: regionTerritories.length,
        activeTerritoryCount: regionTerritories.filter((territory) => territory.isActive).length,
        coveredStates: regionTerritories.reduce((sum, territory) => sum + territory.coverageStates.length, 0),
        activeLeadCount: regionLeadCounts.get(region.id) ?? 0,
        activeAccountCount: regionAccountCounts.get(region.id) ?? 0,
        shippingCenterCount: shippingCenterIds.size,
        territoriesMissingManager: regionTerritories.filter((territory) => !territory.managerUserId).length,
        territoriesMissingShippingCenter: regionTerritories.filter((territory) => !territory.shippingCenterId).length,
      };
    })
    .sort(
      (left, right) =>
        right.activeLeadCount - left.activeLeadCount
        || right.activeAccountCount - left.activeAccountCount
        || left.regionName.localeCompare(right.regionName),
    );
}

async function buildTerritoryDashboardOwnerMetrics(input: {
  regions: RegionSummary[];
  territories: TerritorySummary[];
  leadRecords: TerritoryDashboardLeadRecord[];
  accountRecords: TerritoryDashboardAccountRecord[];
  territoryById: Map<string, TerritorySummary>;
}): Promise<TerritoryDashboardOwnerMetricSummary[]> {
  type WorkingOwnerMetric = {
    ownerRole: 'territory_manager' | 'regional_director';
    ownerUserId?: string;
    regionIds: Set<string>;
    territoryIds: Set<string>;
    shippingCenterIds: Set<string>;
    coveredStates: number;
    activeLeadCount: number;
    activeAccountCount: number;
  };

  const metrics = new Map<string, WorkingOwnerMetric>();
  const ownerIds = new Set<string>();

  const ensureMetric = (ownerRole: 'territory_manager' | 'regional_director', ownerUserId?: string) => {
    const key = `${ownerRole}:${ownerUserId ?? 'unassigned'}`;
    let metric = metrics.get(key);
    if (!metric) {
      metric = {
        ownerRole,
        ...(ownerUserId ? { ownerUserId } : {}),
        regionIds: new Set<string>(),
        territoryIds: new Set<string>(),
        shippingCenterIds: new Set<string>(),
        coveredStates: 0,
        activeLeadCount: 0,
        activeAccountCount: 0,
      };
      metrics.set(key, metric);
    }
    if (ownerUserId) {
      ownerIds.add(ownerUserId);
    }
    return metric;
  };

  for (const territory of input.territories) {
    if (territory.managerUserId) {
      const metric = ensureMetric('territory_manager', territory.managerUserId);
      metric.regionIds.add(territory.regionId);
      metric.territoryIds.add(territory.id);
      if (territory.shippingCenterId) {
        metric.shippingCenterIds.add(territory.shippingCenterId);
      }
      metric.coveredStates += territory.coverageStates.length;
    }

    if (territory.directorUserId) {
      const metric = ensureMetric('regional_director', territory.directorUserId);
      metric.regionIds.add(territory.regionId);
      metric.territoryIds.add(territory.id);
      if (territory.shippingCenterId) {
        metric.shippingCenterIds.add(territory.shippingCenterId);
      }
      metric.coveredStates += territory.coverageStates.length;
    }
  }

  for (const region of input.regions) {
    if (!region.directorUserId) {
      continue;
    }
    ensureMetric('regional_director', region.directorUserId).regionIds.add(region.id);
  }

  for (const lead of input.leadRecords) {
    if (lead.assignedTmUserId) {
      ensureMetric('territory_manager', lead.assignedTmUserId).activeLeadCount += 1;
    }
    if (lead.assignedRdUserId) {
      ensureMetric('regional_director', lead.assignedRdUserId).activeLeadCount += 1;
    }

    const territory = lead.territoryId ? input.territoryById.get(lead.territoryId) : undefined;
    if (territory?.managerUserId && !lead.assignedTmUserId) {
      ensureMetric('territory_manager', territory.managerUserId).activeLeadCount += 1;
    }
    if (territory?.directorUserId && !lead.assignedRdUserId) {
      ensureMetric('regional_director', territory.directorUserId).activeLeadCount += 1;
    }
  }

  for (const account of input.accountRecords) {
    if (account.assignedTmUserId) {
      ensureMetric('territory_manager', account.assignedTmUserId).activeAccountCount += 1;
    }
    if (account.assignedRdUserId) {
      ensureMetric('regional_director', account.assignedRdUserId).activeAccountCount += 1;
    }

    const territory = account.territoryId ? input.territoryById.get(account.territoryId) : undefined;
    if (territory?.managerUserId && !account.assignedTmUserId) {
      ensureMetric('territory_manager', territory.managerUserId).activeAccountCount += 1;
    }
    if (territory?.directorUserId && !account.assignedRdUserId) {
      ensureMetric('regional_director', territory.directorUserId).activeAccountCount += 1;
    }
  }

  const users = ownerIds.size
    ? await prisma.user.findMany({
        where: {
          id: {
            in: [...ownerIds],
          },
        },
        select: {
          id: true,
          displayName: true,
        },
      })
    : [];
  const ownerNameById = new Map(users.map((user) => [user.id, user.displayName]));

  for (const territory of input.territories) {
    if (territory.managerUserId && territory.managerUserName) {
      ownerNameById.set(territory.managerUserId, territory.managerUserName);
    }
    if (territory.directorUserId && territory.directorUserName) {
      ownerNameById.set(territory.directorUserId, territory.directorUserName);
    }
  }
  for (const region of input.regions) {
    if (region.directorUserId && region.directorUserName) {
      ownerNameById.set(region.directorUserId, region.directorUserName);
    }
  }

  return [...metrics.values()]
    .map((metric) => ({
      ...(metric.ownerUserId ? { ownerUserId: metric.ownerUserId } : {}),
      ownerName: metric.ownerUserId ? ownerNameById.get(metric.ownerUserId) ?? 'Assigned owner' : 'Unassigned owner',
      ownerRole: metric.ownerRole,
      regionCount: metric.regionIds.size,
      territoryCount: metric.territoryIds.size,
      activeLeadCount: metric.activeLeadCount,
      activeAccountCount: metric.activeAccountCount,
      shippingCenterCount: metric.shippingCenterIds.size,
      coveredStates: metric.coveredStates,
    }))
    .sort(
      (left, right) =>
        right.activeLeadCount + right.activeAccountCount - (left.activeLeadCount + left.activeAccountCount)
        || right.territoryCount - left.territoryCount
        || left.ownerName.localeCompare(right.ownerName),
    );
}

function toTerritoryMapCoverageEntries(item: TerritoryWithRefs): TerritoryMapCoverageEntrySummary[] {
  return item.stateCoverage.map((entry) => ({
    territoryId: item.id,
    territoryCode: item.code,
    territoryName: item.name,
    regionId: item.regionId,
    regionCode: item.region.code,
    regionName: item.region.name,
    stateCode: entry.stateCode,
    countryCode: entry.countryCode,
    ...(item.managerUserId ? { assignedTmUserId: item.managerUserId } : {}),
    ...(item.managerUser?.displayName ? { assignedTmName: item.managerUser.displayName } : {}),
    ...(item.region.directorUserId ? { assignedRdUserId: item.region.directorUserId } : {}),
    ...(item.region.directorUser?.displayName ? { assignedRdName: item.region.directorUser.displayName } : {}),
    ...(item.shippingCenterId ? { shippingCenterId: item.shippingCenterId } : {}),
    ...(item.shippingCenter?.name ? { shippingCenterName: item.shippingCenter.name } : {}),
  }));
}

function toTerritoryMapShippingCenterSummary(
  item: Prisma.ShippingCenterGetPayload<{}>,
  counts: {
    servicedTerritoryCount: number;
    activeLeadCount: number;
    activeAccountCount: number;
  },
): TerritoryMapShippingCenterSummary {
  const coordinates = deriveApproximateCoordinates({
    key: `shipping-center:${item.id}`,
    ...(item.city ? { city: item.city } : {}),
    ...(item.state ? { state: item.state } : {}),
  });

  return {
    ...toShippingCenterSummary(item),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    geoPrecision: coordinates.geoPrecision,
    servicedTerritoryCount: counts.servicedTerritoryCount,
    activeLeadCount: counts.activeLeadCount,
    activeAccountCount: counts.activeAccountCount,
  };
}

function toTerritoryMapLeadPin(
  lead: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>,
): TerritoryMapPinSummary {
  const coordinates = deriveApproximateCoordinates({
    key: `lead:${lead.id}`,
    ...(lead.state ? { state: lead.state } : {}),
  });

  return {
    id: `lead:${lead.id}`,
    recordType: 'lead',
    recordId: lead.id,
    label: lead.companyName,
    status: 'prospect',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    geoPrecision: coordinates.geoPrecision,
    ...(lead.state ? { state: lead.state } : {}),
    ...(lead.countryCode ? { countryCode: lead.countryCode } : {}),
    ...(lead.territoryId ? { territoryId: lead.territoryId } : {}),
    ...(lead.territory?.code ? { territoryCode: lead.territory.code } : {}),
    ...(lead.territory?.name ? { territoryName: lead.territory.name } : {}),
    ...(lead.territory?.regionId ? { regionId: lead.territory.regionId } : {}),
    ...(lead.territory?.region.code ? { regionCode: lead.territory.region.code } : {}),
    ...(lead.territory?.region.name ? { regionName: lead.territory.region.name } : {}),
    ...(lead.assignedTmUserId ? { assignedTmUserId: lead.assignedTmUserId } : {}),
    ...(lead.assignedTmUser?.displayName ? { assignedTmName: lead.assignedTmUser.displayName } : {}),
    ...(lead.assignedRdUserId ? { assignedRdUserId: lead.assignedRdUserId } : {}),
    ...(lead.assignedRdUser?.displayName ? { assignedRdName: lead.assignedRdUser.displayName } : {}),
    ...(lead.shippingCenterId ? { shippingCenterId: lead.shippingCenterId } : {}),
    ...(lead.shippingCenter?.code ? { shippingCenterCode: lead.shippingCenter.code } : {}),
    ...(lead.shippingCenter?.name ? { shippingCenterName: lead.shippingCenter.name } : {}),
    ...(lead.affinityGroupName ? { affinityGroupName: lead.affinityGroupName } : {}),
    lifecycleStatus: normalizeLeadLifecycleStatusKey(lead.lifecycleStatus),
    stage: normalizeLeadStageKey(lead.stage),
    ...(lead.sourceDetail ? { sourceLabel: lead.sourceDetail } : {}),
    lastTouchedAt: lead.updatedAt.toISOString(),
  };
}

function toTerritoryMapAccountPin(
  account: Prisma.AccountGetPayload<{
    include: {
      territory: {
        include: {
          region: true;
        };
      };
      shippingCenter: true;
      assignedTmUser: {
        select: {
          id: true;
          displayName: true;
        };
      };
      assignedRdUser: {
        select: {
          id: true;
          displayName: true;
        };
      };
      locations: true;
    };
  }>,
): TerritoryMapPinSummary {
  const primaryLocation = account.locations[0] ?? null;
  const coordinates = deriveApproximateCoordinates({
    key: `account:${account.id}`,
    ...(primaryLocation?.city ? { city: primaryLocation.city } : {}),
    ...(primaryLocation?.state ? { state: primaryLocation.state } : {}),
  });

  return {
    id: `account:${account.id}`,
    recordType: 'account',
    recordId: account.id,
    label: account.displayName,
    status: account.isActive ? 'active' : 'inactive',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    geoPrecision: coordinates.geoPrecision,
    ...(primaryLocation?.city ? { city: primaryLocation.city } : {}),
    ...(primaryLocation?.state ? { state: primaryLocation.state } : {}),
    ...(primaryLocation?.countryCode ? { countryCode: primaryLocation.countryCode } : {}),
    ...(account.territoryId ? { territoryId: account.territoryId } : {}),
    ...(account.territory?.code ? { territoryCode: account.territory.code } : {}),
    ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
    ...(account.territory?.regionId ? { regionId: account.territory.regionId } : {}),
    ...(account.territory?.region.code ? { regionCode: account.territory.region.code } : {}),
    ...(account.territory?.region.name ? { regionName: account.territory.region.name } : {}),
    ...(account.assignedTmUserId ? { assignedTmUserId: account.assignedTmUserId } : {}),
    ...(account.assignedTmUser?.displayName ? { assignedTmName: account.assignedTmUser.displayName } : {}),
    ...(account.assignedRdUserId ? { assignedRdUserId: account.assignedRdUserId } : {}),
    ...(account.assignedRdUser?.displayName ? { assignedRdName: account.assignedRdUser.displayName } : {}),
    ...(account.shippingCenterId ? { shippingCenterId: account.shippingCenterId } : {}),
    ...(account.shippingCenter?.code ? { shippingCenterCode: account.shippingCenter.code } : {}),
    ...(account.shippingCenter?.name ? { shippingCenterName: account.shippingCenter.name } : {}),
    ...(account.accountType ? { accountType: account.accountType } : {}),
    lastTouchedAt: account.updatedAt.toISOString(),
  };
}

const CITY_STATE_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  'atlanta,ga': { latitude: 33.749, longitude: -84.388 },
  'chicago,il': { latitude: 41.8781, longitude: -87.6298 },
  'columbus,oh': { latitude: 39.9612, longitude: -82.9988 },
  'denver,co': { latitude: 39.7392, longitude: -104.9903 },
  'fort lauderdale,fl': { latitude: 26.1224, longitude: -80.1373 },
  'houston,tx': { latitude: 29.7604, longitude: -95.3698 },
  'indianapolis,in': { latitude: 39.7684, longitude: -86.1581 },
  'las vegas,nv': { latitude: 36.1699, longitude: -115.1398 },
  'memphis,tn': { latitude: 35.1495, longitude: -90.049 },
  'new braunfels,tx': { latitude: 29.703, longitude: -98.1245 },
  'orlando,fl': { latitude: 28.5383, longitude: -81.3792 },
  'princeton,nj': { latitude: 40.3573, longitude: -74.6672 },
};

const STATE_COORDINATES: Record<string, [number, number]> = {
  AL: [-86.8, 32.8], AK: [-150.0, 64.0], AZ: [-111.9, 34.3], AR: [-92.4, 34.9], CA: [-119.4, 36.8],
  CO: [-105.5, 39.0], CT: [-72.7, 41.6], DE: [-75.5, 39.1], FL: [-81.7, 27.8], GA: [-83.4, 32.6],
  HI: [-157.5, 20.8], ID: [-114.4, 44.2], IL: [-89.3, 40.0], IN: [-86.1, 40.0], IA: [-93.5, 42.0],
  KS: [-98.4, 38.5], KY: [-84.9, 37.5], LA: [-91.9, 31.2], ME: [-69.0, 45.2], MD: [-76.7, 39.0],
  MA: [-71.8, 42.3], MI: [-84.7, 44.3], MN: [-94.3, 46.4], MS: [-89.7, 32.7], MO: [-92.6, 38.5],
  MT: [-110.4, 46.9], NE: [-99.9, 41.5], NV: [-116.4, 38.5], NH: [-71.6, 43.7], NJ: [-74.7, 40.1],
  NM: [-106.1, 34.4], NY: [-75.0, 43.0], NC: [-79.0, 35.5], ND: [-100.5, 47.5], OH: [-82.8, 40.4],
  OK: [-97.5, 35.5], OR: [-120.5, 44.0], PA: [-77.8, 41.0], RI: [-71.5, 41.7], SC: [-80.9, 33.8],
  SD: [-100.2, 44.4], TN: [-86.6, 35.8], TX: [-99.2, 31.0], UT: [-111.6, 39.3], VT: [-72.7, 44.1],
  VA: [-78.7, 37.5], WA: [-120.7, 47.4], WV: [-80.6, 38.6], WI: [-89.6, 44.5], WY: [-107.6, 43.0],
  DC: [-77.0, 38.9],
};

function deriveApproximateCoordinates(input: {
  key: string;
  city?: string;
  state?: string;
}): { latitude: number; longitude: number; geoPrecision: TerritoryMapGeoPrecisionKey } {
  const normalizedState = normalizeStateCode(input.state) ?? undefined;
  const normalizedCity = input.city?.trim().toLowerCase();

  if (normalizedCity && normalizedState) {
    const key = `${normalizedCity},${normalizedState.toLowerCase()}`;
    const resolved = CITY_STATE_COORDINATES[key];
    if (resolved) {
      return {
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        geoPrecision: 'city_state',
      };
    }
  }

  const stateCenter = normalizedState ? STATE_COORDINATES[normalizedState] : undefined;
  if (stateCenter) {
    const hash = hashKey(input.key);
    const lngOffset = ((hash % 9) - 4) * 0.28;
    const latOffset = ((hash % 7) - 3) * 0.22;
    return {
      latitude: stateCenter[1] + latOffset,
      longitude: stateCenter[0] + lngOffset,
      geoPrecision: 'state_fallback',
    };
  }

  return {
    latitude: 39,
    longitude: -96,
    geoPrecision: 'state_fallback',
  };
}

function hashKey(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toLeadTerritoryAssignmentSummary(
  lead: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>,
): LeadTerritoryAssignmentSummary {
  return {
    leadId: lead.id,
    ...(lead.territoryId ? { territoryId: lead.territoryId } : {}),
    ...(lead.territory?.code ? { territoryCode: lead.territory.code } : {}),
    ...(lead.territory?.name ? { territoryName: lead.territory.name } : {}),
    ...(lead.territory?.regionId ? { regionId: lead.territory.regionId } : {}),
    ...(lead.territory?.region.code ? { regionCode: lead.territory.region.code } : {}),
    ...(lead.territory?.region.name ? { regionName: lead.territory.region.name } : {}),
    ...(lead.shippingCenterId ? { shippingCenterId: lead.shippingCenterId } : {}),
    ...(lead.shippingCenter?.code ? { shippingCenterCode: lead.shippingCenter.code } : {}),
    ...(lead.shippingCenter?.name ? { shippingCenterName: lead.shippingCenter.name } : {}),
    ...(lead.assignedTmUserId ? { assignedTmUserId: lead.assignedTmUserId } : {}),
    ...(lead.assignedTmUser?.displayName ? { assignedTmName: lead.assignedTmUser.displayName } : {}),
    ...(lead.assignedRdUserId ? { assignedRdUserId: lead.assignedRdUserId } : {}),
    ...(lead.assignedRdUser?.displayName ? { assignedRdName: lead.assignedRdUser.displayName } : {}),
    ...(lead.territoryAssignmentMethod
      ? { assignmentMethod: toTerritoryAssignmentMethodKey(lead.territoryAssignmentMethod) }
      : {}),
    ...(lead.territoryAssignedAt ? { assignedAt: lead.territoryAssignedAt.toISOString() } : {}),
  };
}

function toAccountTerritoryAssignmentSummary(account: AccountWithTerritoryRefs): AccountTerritoryAssignmentSummary {
  return {
    accountId: account.id,
    ...(account.territoryId ? { territoryId: account.territoryId } : {}),
    ...(account.territory?.code ? { territoryCode: account.territory.code } : {}),
    ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
    ...(account.territory?.regionId ? { regionId: account.territory.regionId } : {}),
    ...(account.territory?.region.code ? { regionCode: account.territory.region.code } : {}),
    ...(account.territory?.region.name ? { regionName: account.territory.region.name } : {}),
    ...(account.shippingCenterId ? { shippingCenterId: account.shippingCenterId } : {}),
    ...(account.shippingCenter?.code ? { shippingCenterCode: account.shippingCenter.code } : {}),
    ...(account.shippingCenter?.name ? { shippingCenterName: account.shippingCenter.name } : {}),
    ...(account.assignedTmUserId ? { assignedTmUserId: account.assignedTmUserId } : {}),
    ...(account.assignedTmUser?.displayName ? { assignedTmName: account.assignedTmUser.displayName } : {}),
    ...(account.assignedRdUserId ? { assignedRdUserId: account.assignedRdUserId } : {}),
    ...(account.assignedRdUser?.displayName ? { assignedRdName: account.assignedRdUser.displayName } : {}),
    ...(account.territoryAssignmentMethod
      ? { assignmentMethod: toTerritoryAssignmentMethodKey(account.territoryAssignmentMethod) }
      : {}),
    ...(account.territoryAssignedAt ? { assignedAt: account.territoryAssignedAt.toISOString() } : {}),
  };
}

function toLeadTerritoryAuditPayload(
  lead: Prisma.LeadGetPayload<{ include: typeof LEAD_TERRITORY_INCLUDE }>,
) {
  return {
    territoryId: lead.territoryId,
    territoryCode: lead.territory?.code,
    shippingCenterId: lead.shippingCenterId,
    shippingCenterCode: lead.shippingCenter?.code,
    assignedTmUserId: lead.assignedTmUserId,
    assignedTmName: lead.assignedTmUser?.displayName ?? lead.assignedTmName,
    assignedRdUserId: lead.assignedRdUserId,
    assignedRdName: lead.assignedRdUser?.displayName ?? undefined,
    assignmentMethod: lead.territoryAssignmentMethod
      ? toTerritoryAssignmentMethodKey(lead.territoryAssignmentMethod)
      : undefined,
  };
}

function toAccountTerritoryAuditPayload(account: AccountWithTerritoryRefs) {
  return {
    territoryId: account.territoryId,
    territoryCode: account.territory?.code,
    shippingCenterId: account.shippingCenterId,
    shippingCenterCode: account.shippingCenter?.code,
    assignedTmUserId: account.assignedTmUserId,
    assignedTmName: account.assignedTmUser?.displayName ?? undefined,
    assignedRdUserId: account.assignedRdUserId,
    assignedRdName: account.assignedRdUser?.displayName ?? undefined,
    assignmentMethod: account.territoryAssignmentMethod
      ? toTerritoryAssignmentMethodKey(account.territoryAssignmentMethod)
      : undefined,
  };
}

function toTerritoryPolicySummary(
  item: Prisma.TerritoryPolicyGetPayload<{}>,
): TerritoryPolicySummary {
  return {
    preHandoffTmVisibility: item.preHandoffTmVisibility,
    assignNationalTmLeadsByDefault: item.assignNationalTmLeadsByDefault,
    strategicGrowthRetainsOwnership: item.strategicGrowthRetainsOwnership,
    ...(item.notes ? { notes: item.notes } : {}),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toRegionAuditPayload(item: {
  code: string;
  name: string;
  directorUserId: string | null;
  isActive: boolean;
  notes: string | null;
}) {
  return {
    code: item.code,
    name: item.name,
    directorUserId: item.directorUserId ?? undefined,
    isActive: item.isActive,
    notes: item.notes ?? undefined,
  };
}

function toShippingCenterAuditPayload(item: Prisma.ShippingCenterGetPayload<{}>) {
  return {
    code: item.code,
    name: item.name,
    city: item.city ?? undefined,
    state: item.state ?? undefined,
    countryCode: item.countryCode,
    isActive: item.isActive,
    notes: item.notes ?? undefined,
  };
}

function toTerritoryAuditPayload(item: TerritoryWithRefs) {
  return {
    code: item.code,
    name: item.name,
    regionId: item.regionId,
    managerUserId: item.managerUserId ?? undefined,
    shippingCenterId: item.shippingCenterId ?? undefined,
    isActive: item.isActive,
    notes: item.notes ?? undefined,
    coverage: item.stateCoverage.map((entry) => `${entry.countryCode}:${entry.stateCode}`),
  };
}

function toTerritoryPolicyAuditPayload(item: Prisma.TerritoryPolicyGetPayload<{}>) {
  return {
    preHandoffTmVisibility: item.preHandoffTmVisibility,
    assignNationalTmLeadsByDefault: item.assignNationalTmLeadsByDefault,
    strategicGrowthRetainsOwnership: item.strategicGrowthRetainsOwnership,
    notes: item.notes ?? undefined,
  };
}

function normalizeCode(value: string, field: string) {
  const trimmed = requireText(value, field)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!trimmed) {
    throw new Error(`${field} is required`);
  }

  return trimmed;
}

function normalizeStateCode(value: string | null | undefined) {
  const trimmed = optionalText(value);
  if (!trimmed) {
    return undefined;
  }

  const resolved = findLeadRegionOption(trimmed);
  return resolved?.value;
}

function normalizeCountryCode(value: string | null | undefined, regionValue?: string | null | undefined) {
  const explicit = optionalText(value);
  if (explicit) {
    return explicit.toUpperCase();
  }

  const resolvedRegion = regionValue ? findLeadRegionOption(regionValue) : undefined;
  return resolvedRegion?.countryCode ?? 'US';
}

function normalizeLeadLifecycleStatusKey(value: LeadLifecycleStatus) {
  return value.toLowerCase() as NonNullable<TerritoryMapPinSummary['lifecycleStatus']>;
}

function normalizeLeadStageKey(value: LeadStage) {
  return value.toLowerCase() as NonNullable<TerritoryMapPinSummary['stage']>;
}

function requireText(value: string | null | undefined, field: string) {
  const trimmed = optionalText(value);
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  return trimmed;
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toTerritoryAssignmentMethodKey(value: TerritoryAssignmentMethod) {
  switch (value) {
    case TerritoryAssignmentMethod.DEFAULT_STATE:
      return 'default_state';
    case TerritoryAssignmentMethod.MANUAL_OVERRIDE:
      return 'manual_override';
    case TerritoryAssignmentMethod.SYSTEM:
    default:
      return 'system';
  }
}

function toTerritoryAssignmentEntityType(value: 'lead' | 'account' | 'location') {
  switch (value) {
    case 'account':
      return TerritoryAssignmentEntityType.ACCOUNT;
    case 'location':
      return TerritoryAssignmentEntityType.LOCATION;
    case 'lead':
    default:
      return TerritoryAssignmentEntityType.LEAD;
  }
}

function baseMetadata(actor: AuthenticatedActor, operation: string) {
  return {
    sessionId: actor.sessionId,
    actorRole: actor.role,
    actorType: actor.actorType,
    operation,
  };
}

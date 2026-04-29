import { assertActionAccess, assertModuleAccess, normalizeRole } from '@pulse/auth';
import {
  AuditAction,
  AccountTrainingProgramStatus,
  AccountLifecycleStatus,
  LeadLifecycleStatus,
  LeadStage,
  LeadRoutingTeam,
  TrainingActivityKind,
  TrainingSessionStatus,
  UserKind,
  Prisma,
  TerritoryAssignmentEntityType,
  TerritoryAssignmentMethod,
  prisma,
} from '@pulse/db';
import type {
  AccountTerritoryAssignmentSummary,
  BulkReassignAccountsTerritoryRequest,
  BulkReassignAccountsTerritoryResponse,
  BulkReassignLeadsTerritoryRequest,
  BulkReassignLeadsTerritoryResponse,
  CreateRegionRequest,
  CreateShippingCenterRequest,
  CreateTerritoryRequest,
  TerritoryDashboardAlert,
  TerritoryDashboardCoverageSummary,
  TerritoryDashboardLifecycleSummary,
  TerritoryDashboardOwnerMetricSummary,
  TerritoryDashboardPipelineSummary,
  TerritoryDashboardQueueSummary,
  TerritoryDashboardRegionRollupSummary,
  TerritoryDashboardResponse,
  TerritoryDashboardStats,
  TerritoryDashboardTrainingPenetrationSummary,
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
  TerritoryRoutePlanStopSummary,
  TerritoryRoutePlanSummary,
  TerritorySummary,
  UpdateRegionRequest,
  UpdateShippingCenterRequest,
  UpdateTerritoryPolicyRequest,
  UpdateTerritoryRequest,
} from '@pulse/contracts';
import { findLeadRegionOption } from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAccountRecordScope, resolveLeadRecordScope } from '../auth/visibility.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import {
  assertTerritoryAssignmentHistoryVisible,
  assertTerritoryReassignmentVisible,
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

type LeadWithTerritoryRefs = Prisma.LeadGetPayload<{
  include: typeof LEAD_TERRITORY_INCLUDE;
}>;

type TerritoryDashboardLeadRecord = {
  id: string;
  territoryId: string | null;
  shippingCenterId: string | null;
  assignedTmUserId: string | null;
  assignedRdUserId: string | null;
  routingTeam: LeadRoutingTeam;
  stage: LeadStage;
};

type TerritoryDashboardAccountRecord = {
  id: string;
  territoryId: string | null;
  shippingCenterId: string | null;
  assignedTmUserId: string | null;
  assignedRdUserId: string | null;
  isActive: boolean;
  lifecycleStatus: AccountLifecycleStatus;
  lastEngagementAt: Date | null;
  trainingPrograms: Array<{
    status: AccountTrainingProgramStatus;
  }>;
  trainingSessions: Array<{
    status: TrainingSessionStatus;
    activityKind: TrainingActivityKind;
  }>;
};

type TerritoryRouteVisitState = {
  accountId: string;
  activeVisitSessionId?: string;
  lastVisitSessionId?: string;
  lastVisitCompletedAt?: string;
  lastVisitTrainerName?: string;
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
  const scopeWhere = await buildShippingCenterReadScope(actor);

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
  const regionScope = await buildRegionReadScope(actor);
  const territoryScope = await buildTerritoryReadScope(actor);

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
  const scopeWhere = await buildTerritoryReadScope(actor);

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
  const territoryScope = await buildTerritoryReadScope(actor);
  const regionScope = await buildRegionReadScope(actor);
  const shippingCenterScope = await buildShippingCenterReadScope(actor);
  const leadScope = await resolveLeadRecordScope(actor);
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

  const [policy, regionItems, territoryItems, shippingCenterItems, leadItems, accountItems, visitSessions] = await Promise.all([
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
    prisma.trainingSession.findMany({
      where: {
        activityKind: TrainingActivityKind.SITE_VISIT,
        status: {
          in: [TrainingSessionStatus.SCHEDULED, TrainingSessionStatus.COMPLETED],
        },
        ...(accountScope ? { account: accountScope } : {}),
      },
      orderBy: [{ checkedInAt: 'desc' }, { completedAt: 'desc' }, { scheduledAt: 'desc' }],
      take: 500,
      include: {
        trainerUser: {
          select: {
            displayName: true,
          },
        },
      },
    }),
  ]);

  const territories = territoryItems.map(toTerritorySummary);
  const regions = regionItems.map((item) => toRegionSummaryWithVisibleTerritoryCount(item, item.territories.length));
  const coverageEntries = territoryItems.flatMap((territory) => toTerritoryMapCoverageEntries(territory));
  const accountPins = accountItems.map(toTerritoryMapAccountPin);
  const leadPins = leadItems.map(toTerritoryMapLeadPin);

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

  const shippingCenters = shippingCenterItems.map((item) =>
    toTerritoryMapShippingCenterSummary(item, {
      servicedTerritoryCount: territoryCountsByShippingCenter.get(item.id) ?? 0,
      activeLeadCount: leadCountsByShippingCenter.get(item.id) ?? 0,
      activeAccountCount: accountCountsByShippingCenter.get(item.id) ?? 0,
    }),
  );

  return {
    policy: toTerritoryPolicySummary(policy),
    regions,
    territories,
    coverageEntries,
    shippingCenters,
    accountPins,
    leadPins,
    routePlans: buildProviderNeutralRoutePlans({
      pins: [...accountPins, ...leadPins],
      shippingCenters,
      visitStates: buildTerritoryRouteVisitStates(visitSessions),
    }),
    generatedAt: new Date().toISOString(),
  };
}

export async function getTerritoryDashboard(actor: AuthenticatedActor): Promise<TerritoryDashboardResponse> {
  assertModuleAccess(actor.role, 'territories');
  const territoryScope = await buildTerritoryReadScope(actor);
  const regionScope = await buildRegionReadScope(actor);
  const shippingCenterScope = await buildShippingCenterReadScope(actor);
  const leadScope = await resolveLeadRecordScope(actor);
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
        stage: true,
      },
    }),
    prisma.account.findMany({
      ...(accountScope ? { where: accountScope } : {}),
      select: {
        id: true,
        territoryId: true,
        shippingCenterId: true,
        assignedTmUserId: true,
        assignedRdUserId: true,
        isActive: true,
        lifecycleStatus: true,
        lastEngagementAt: true,
        trainingPrograms: {
          select: {
            status: true,
          },
        },
        trainingSessions: {
          select: {
            status: true,
            activityKind: true,
          },
        },
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
  const activeAccountRecords = accountRecords.filter((account) => account.isActive);

  const territoryById = new Map(territories.map((territory) => [territory.id, territory]));
  const territoryLeadCounts = new Map<string, number>();
  const territoryAccountCounts = new Map<string, number>();
  const regionLeadCounts = new Map<string, number>();
  const regionAccountCounts = new Map<string, number>();
  const territoryPipelineCounts = new Map<string, PipelinePhaseCounts>();
  const regionPipelineCounts = new Map<string, PipelinePhaseCounts>();
  const territoryCoverageCounts = new Map<string, CoverageCounts>();
  const regionCoverageCounts = new Map<string, CoverageCounts>();
  const territoryLifecycleCounts = new Map<string, LifecycleCounts>();
  const regionLifecycleCounts = new Map<string, LifecycleCounts>();
  const territoryTrainingCounts = new Map<string, TrainingPenetrationCounts>();
  const regionTrainingCounts = new Map<string, TrainingPenetrationCounts>();

  for (const lead of leadRecords) {
    const phase = getLeadPipelinePhase(lead.stage);
    if (!lead.territoryId) {
      continue;
    }

    territoryLeadCounts.set(lead.territoryId, (territoryLeadCounts.get(lead.territoryId) ?? 0) + 1);
    incrementPipelineCounts(territoryPipelineCounts, lead.territoryId, phase);
    const territory = territoryById.get(lead.territoryId);
    if (territory) {
      regionLeadCounts.set(territory.regionId, (regionLeadCounts.get(territory.regionId) ?? 0) + 1);
      incrementPipelineCounts(regionPipelineCounts, territory.regionId, phase);
    }
  }

  for (const account of accountRecords) {
    const coverageSnapshot = summarizeCoverage(account);
    const trainingSnapshot = summarizeTrainingPenetration(account);

    if (account.territoryId) {
      if (account.isActive) {
        territoryAccountCounts.set(account.territoryId, (territoryAccountCounts.get(account.territoryId) ?? 0) + 1);
      }
      incrementCoverageCounts(territoryCoverageCounts, account.territoryId, coverageSnapshot);
      incrementLifecycleCounts(territoryLifecycleCounts, account.territoryId, account.lifecycleStatus);
      incrementTrainingPenetrationCounts(territoryTrainingCounts, account.territoryId, trainingSnapshot);
    }

    const territory = account.territoryId ? territoryById.get(account.territoryId) : undefined;
    if (territory) {
      if (account.isActive) {
        regionAccountCounts.set(territory.regionId, (regionAccountCounts.get(territory.regionId) ?? 0) + 1);
      }
      incrementCoverageCounts(regionCoverageCounts, territory.regionId, coverageSnapshot);
      incrementLifecycleCounts(regionLifecycleCounts, territory.regionId, account.lifecycleStatus);
      incrementTrainingPenetrationCounts(regionTrainingCounts, territory.regionId, trainingSnapshot);
    }
  }

  const queue: TerritoryDashboardQueueSummary = {
    unassignedLeads: leadRecords.filter((lead) => !lead.territoryId).length,
    unassignedAccounts: activeAccountRecords.filter((account) => !account.territoryId).length,
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
    activeAccounts: activeAccountRecords.length,
    assignedLeads: leadRecords.filter((lead) => Boolean(lead.territoryId)).length,
    assignedAccounts: activeAccountRecords.filter((account) => Boolean(account.territoryId)).length,
    unassignedLeads: queue.unassignedLeads,
    unassignedAccounts: queue.unassignedAccounts,
    strategicGrowthLeads: queue.strategicGrowthLeads,
    nationalTmLeads: queue.nationalTmLeads,
  };

  const coverage = toTerritoryDashboardCoverageSummary(summarizeCoverageCollection(accountRecords));
  const lifecycle = toTerritoryDashboardLifecycleSummary(summarizeLifecycleCollection(accountRecords));
  const pipeline = toTerritoryDashboardPipelineSummary(summarizePipelineCollection(leadRecords));
  const trainingPenetration = toTerritoryDashboardTrainingPenetrationSummary(
    summarizeTrainingPenetrationCollection(accountRecords),
  );
  const alerts = buildTerritoryDashboardAlerts(queue);
  const workloads = buildTerritoryDashboardWorkloads(
    territories,
    territoryLeadCounts,
    territoryAccountCounts,
    territoryTrainingCounts,
    territoryCoverageCounts,
    territoryLifecycleCounts,
    territoryPipelineCounts,
  );
  const regionRollups = buildTerritoryDashboardRegionRollups(
    regions,
    territories,
    regionLeadCounts,
    regionAccountCounts,
    regionTrainingCounts,
    regionCoverageCounts,
    regionLifecycleCounts,
    regionPipelineCounts,
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
    coverage,
    lifecycle,
    pipeline,
    trainingPenetration,
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
      ...(isPlainRecord(item.metadata) ? { metadata: item.metadata } : {}),
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
  await assertTerritoryReassignmentVisible(actor, 'lead', leadId);

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
  await assertTerritoryReassignmentVisible(actor, 'account', accountId);

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

export async function bulkReassignLeadTerritories(
  actor: AuthenticatedActor,
  input: BulkReassignLeadsTerritoryRequest,
): Promise<BulkReassignLeadsTerritoryResponse> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.reassign');

  const requestedLeadIds = Array.isArray(input.leadIds) ? input.leadIds : [];
  const leadIds = Array.from(
    new Set(
      requestedLeadIds
        .map((value: string) => value.trim())
        .filter((value: string): value is string => value.length > 0),
    ),
  );
  if (leadIds.length === 0) {
    throw new Error('At least one lead is required');
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

  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
    },
    include: LEAD_TERRITORY_INCLUDE,
  });
  if (leads.length !== leadIds.length) {
    const foundIds = new Set(leads.map((lead) => lead.id));
    const missingId = leadIds.find((leadId) => !foundIds.has(leadId));
    throw new Error(`Lead not found: ${missingId ?? 'unknown'}`);
  }

  for (const leadId of leadIds) {
    await assertTerritoryReassignmentVisible(actor, 'lead', leadId);
  }

  const bulkOperationId = `territory-bulk-leads-${Date.now()}`;
  const updated = await prisma.$transaction(async (tx) => {
    const nextLeads: LeadWithTerritoryRefs[] = [];

    for (const leadId of leadIds) {
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
        metadata: {
          operation: 'territory.bulk_reassign_leads',
          bulkOperation: true,
          bulkOperationId,
          entityCount: leadIds.length,
        },
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
          metadata: {
            ...baseMetadata(actor, 'territory.bulk_reassign_leads'),
            leadCount: leadIds.length,
            bulkOperation: true,
            bulkOperationId,
          },
        }),
      });

      nextLeads.push(next);
    }

    return nextLeads;
  });

  return {
    items: updated.map((lead) => toLeadTerritoryAssignmentSummary(lead)),
  };
}

export async function bulkReassignAccountTerritories(
  actor: AuthenticatedActor,
  input: BulkReassignAccountsTerritoryRequest,
): Promise<BulkReassignAccountsTerritoryResponse> {
  assertModuleAccess(actor.role, 'territories');
  assertActionAccess(actor.role, 'territory.reassign');

  const requestedAccountIds = Array.isArray(input.accountIds) ? input.accountIds : [];
  const accountIds = Array.from(
    new Set(
      requestedAccountIds
        .map((value: string) => value.trim())
        .filter((value: string): value is string => value.length > 0),
    ),
  );
  if (accountIds.length === 0) {
    throw new Error('At least one account is required');
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

  const accounts = await prisma.account.findMany({
    where: {
      id: {
        in: accountIds,
      },
    },
    include: ACCOUNT_TERRITORY_INCLUDE,
  });

  if (accounts.length !== accountIds.length) {
    const foundIds = new Set(accounts.map((account) => account.id));
    const missingId = accountIds.find((accountId) => !foundIds.has(accountId));
    throw new Error(`Account not found: ${missingId ?? 'unknown'}`);
  }
  for (const accountId of accountIds) {
    await assertTerritoryReassignmentVisible(actor, 'account', accountId);
  }

  const bulkOperationId = `territory-bulk-accounts-${Date.now()}`;
  const updated = await prisma.$transaction(async (tx) => {
    const nextAccounts: AccountWithTerritoryRefs[] = [];

    for (const accountId of accountIds) {
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
        metadata: {
          operation: 'territory.bulk_reassign_accounts',
          bulkOperation: true,
          bulkOperationId,
          entityCount: accountIds.length,
        },
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
          metadata: {
            ...baseMetadata(actor, 'territory.bulk_reassign_accounts'),
            accountCount: accountIds.length,
            bulkOperation: true,
            bulkOperationId,
          },
        }),
      });

      nextAccounts.push(next);
    }

    return nextAccounts;
  });

  return {
    items: updated.map((account) => toAccountTerritoryAssignmentSummary(account)),
  };
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
    metadata?: Prisma.InputJsonValue;
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
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
          ...(input.metadata ? { historyMetadata: input.metadata } : {}),
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
    metadata?: Prisma.InputJsonValue;
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
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
          ...(input.metadata ? { historyMetadata: input.metadata } : {}),
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
  affinityGroup: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
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
    metadata?: Prisma.InputJsonValue;
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
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
    metadata?: Prisma.InputJsonValue;
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
      ...(input.metadata ? { metadata: input.metadata } : {}),
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

type CoverageCounts = {
  eligibleAccountCount: number;
  engaged30DayCount: number;
  engaged60DayCount: number;
  engaged90DayCount: number;
  overdue90DayCount: number;
};

type LifecycleCounts = {
  activeAccountCount: number;
  atRiskAccountCount: number;
  inactiveAccountCount: number;
  churnedAccountCount: number;
};

type PipelinePhaseCounts = {
  newLeadCount: number;
  discoveryLeadCount: number;
  cisLeadCount: number;
  onboardingLeadCount: number;
};

type TrainingPenetrationCounts = {
  totalAccounts: number;
  trainedAccounts: number;
  activeProgramsCount: number;
};

function createCoverageCounts(): CoverageCounts {
  return {
    eligibleAccountCount: 0,
    engaged30DayCount: 0,
    engaged60DayCount: 0,
    engaged90DayCount: 0,
    overdue90DayCount: 0,
  };
}

function createLifecycleCounts(): LifecycleCounts {
  return {
    activeAccountCount: 0,
    atRiskAccountCount: 0,
    inactiveAccountCount: 0,
    churnedAccountCount: 0,
  };
}

function createPipelinePhaseCounts(): PipelinePhaseCounts {
  return {
    newLeadCount: 0,
    discoveryLeadCount: 0,
    cisLeadCount: 0,
    onboardingLeadCount: 0,
  };
}

function createTrainingPenetrationCounts(): TrainingPenetrationCounts {
  return {
    totalAccounts: 0,
    trainedAccounts: 0,
    activeProgramsCount: 0,
  };
}

function getLeadPipelinePhase(stage: LeadStage): keyof PipelinePhaseCounts {
  if (stage === LeadStage.NEW) {
    return 'newLeadCount';
  }
  if (stage === LeadStage.DISCOVERY_SCHEDULED || stage === LeadStage.DISCOVERY_COMPLETED) {
    return 'discoveryLeadCount';
  }
  if (stage === LeadStage.CIS_SENT || stage === LeadStage.CIS_SIGNED) {
    return 'cisLeadCount';
  }
  return 'onboardingLeadCount';
}

function isCoverageEligibleAccount(account: TerritoryDashboardAccountRecord): boolean {
  return account.isActive
    && (account.lifecycleStatus === AccountLifecycleStatus.ACTIVE || account.lifecycleStatus === AccountLifecycleStatus.AT_RISK);
}

function getDaysSince(date: Date | null): number {
  if (!date) {
    return Number.POSITIVE_INFINITY;
  }

  const diff = Date.now() - date.getTime();
  if (diff < 0) {
    return 0;
  }

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function summarizeCoverage(account: TerritoryDashboardAccountRecord): CoverageCounts {
  const counts = createCoverageCounts();
  if (!isCoverageEligibleAccount(account)) {
    return counts;
  }

  const daysSinceLastEngagement = getDaysSince(account.lastEngagementAt);
  counts.eligibleAccountCount = 1;
  if (daysSinceLastEngagement <= 30) {
    counts.engaged30DayCount = 1;
  }
  if (daysSinceLastEngagement <= 60) {
    counts.engaged60DayCount = 1;
  }
  if (daysSinceLastEngagement <= 90) {
    counts.engaged90DayCount = 1;
  } else {
    counts.overdue90DayCount = 1;
  }
  return counts;
}

function summarizeCoverageCollection(accounts: TerritoryDashboardAccountRecord[]): CoverageCounts {
  const counts = createCoverageCounts();
  for (const account of accounts) {
    mergeCoverageCounts(counts, summarizeCoverage(account));
  }
  return counts;
}

function summarizeLifecycleCollection(accounts: TerritoryDashboardAccountRecord[]): LifecycleCounts {
  const counts = createLifecycleCounts();
  for (const account of accounts) {
    incrementLifecycleCounter(counts, account.lifecycleStatus);
  }
  return counts;
}

function summarizePipelineCollection(leads: TerritoryDashboardLeadRecord[]): PipelinePhaseCounts {
  const counts = createPipelinePhaseCounts();
  for (const lead of leads) {
    counts[getLeadPipelinePhase(lead.stage)] += 1;
  }
  return counts;
}

function summarizeTrainingPenetration(account: TerritoryDashboardAccountRecord): TrainingPenetrationCounts {
  const counts = createTrainingPenetrationCounts();
  if (!account.isActive) {
    return counts;
  }

  counts.totalAccounts = 1;
  counts.activeProgramsCount = account.trainingPrograms.filter((program) => (
    program.status === AccountTrainingProgramStatus.ACTIVE
      || program.status === AccountTrainingProgramStatus.NOT_STARTED
      || program.status === AccountTrainingProgramStatus.OVERDUE
  )).length;
  counts.trainedAccounts = account.trainingSessions.some((session) => (
    session.status === TrainingSessionStatus.COMPLETED
      && session.activityKind === TrainingActivityKind.TRAINING
  ))
    ? 1
    : 0;
  return counts;
}

function summarizeTrainingPenetrationCollection(accounts: TerritoryDashboardAccountRecord[]): TrainingPenetrationCounts {
  const counts = createTrainingPenetrationCounts();
  for (const account of accounts) {
    mergeTrainingPenetrationCounts(counts, summarizeTrainingPenetration(account));
  }
  return counts;
}

function mergeCoverageCounts(target: CoverageCounts, next: CoverageCounts) {
  target.eligibleAccountCount += next.eligibleAccountCount;
  target.engaged30DayCount += next.engaged30DayCount;
  target.engaged60DayCount += next.engaged60DayCount;
  target.engaged90DayCount += next.engaged90DayCount;
  target.overdue90DayCount += next.overdue90DayCount;
}

function incrementCoverageCounts(collection: Map<string, CoverageCounts>, key: string, snapshot: CoverageCounts) {
  const current = collection.get(key) ?? createCoverageCounts();
  mergeCoverageCounts(current, snapshot);
  collection.set(key, current);
}

function mergeTrainingPenetrationCounts(target: TrainingPenetrationCounts, next: TrainingPenetrationCounts) {
  target.totalAccounts += next.totalAccounts;
  target.trainedAccounts += next.trainedAccounts;
  target.activeProgramsCount += next.activeProgramsCount;
}

function incrementTrainingPenetrationCounts(
  collection: Map<string, TrainingPenetrationCounts>,
  key: string,
  snapshot: TrainingPenetrationCounts,
) {
  const current = collection.get(key) ?? createTrainingPenetrationCounts();
  mergeTrainingPenetrationCounts(current, snapshot);
  collection.set(key, current);
}

function incrementLifecycleCounter(target: LifecycleCounts, status: AccountLifecycleStatus) {
  if (status === AccountLifecycleStatus.ACTIVE) {
    target.activeAccountCount += 1;
    return;
  }
  if (status === AccountLifecycleStatus.AT_RISK) {
    target.atRiskAccountCount += 1;
    return;
  }
  if (status === AccountLifecycleStatus.INACTIVE) {
    target.inactiveAccountCount += 1;
    return;
  }
  target.churnedAccountCount += 1;
}

function incrementLifecycleCounts(collection: Map<string, LifecycleCounts>, key: string, status: AccountLifecycleStatus) {
  const current = collection.get(key) ?? createLifecycleCounts();
  incrementLifecycleCounter(current, status);
  collection.set(key, current);
}

function incrementPipelineCounts(collection: Map<string, PipelinePhaseCounts>, key: string, phase: keyof PipelinePhaseCounts) {
  const current = collection.get(key) ?? createPipelinePhaseCounts();
  current[phase] += 1;
  collection.set(key, current);
}

function toCoveragePercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((value / total) * 100);
}

function toTerritoryDashboardCoverageSummary(counts: CoverageCounts): TerritoryDashboardCoverageSummary {
  return {
    ...counts,
    engaged30DayPercent: toCoveragePercent(counts.engaged30DayCount, counts.eligibleAccountCount),
    engaged60DayPercent: toCoveragePercent(counts.engaged60DayCount, counts.eligibleAccountCount),
    engaged90DayPercent: toCoveragePercent(counts.engaged90DayCount, counts.eligibleAccountCount),
  };
}

function toTerritoryDashboardTrainingPenetrationSummary(
  counts: TrainingPenetrationCounts,
): TerritoryDashboardTrainingPenetrationSummary {
  return {
    totalAccounts: counts.totalAccounts,
    trainedAccounts: counts.trainedAccounts,
    activeProgramsCount: counts.activeProgramsCount,
    penetrationPercent: toCoveragePercent(counts.trainedAccounts, counts.totalAccounts),
  };
}

function toTerritoryDashboardLifecycleSummary(counts: LifecycleCounts): TerritoryDashboardLifecycleSummary {
  return counts;
}

function toTerritoryDashboardPipelineSummary(counts: PipelinePhaseCounts): TerritoryDashboardPipelineSummary {
  return counts;
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
  territoryTrainingCounts: Map<string, TrainingPenetrationCounts>,
  territoryCoverageCounts: Map<string, CoverageCounts>,
  territoryLifecycleCounts: Map<string, LifecycleCounts>,
  territoryPipelineCounts: Map<string, PipelinePhaseCounts>,
): TerritoryDashboardWorkload[] {
  return territories
    .map((territory) => {
      const activeLeadCount = territoryLeadCounts.get(territory.id) ?? 0;
      const activeAccountCount = territoryAccountCounts.get(territory.id) ?? 0;
      const trainingPenetration = territoryTrainingCounts.get(territory.id) ?? createTrainingPenetrationCounts();
      const coverage = territoryCoverageCounts.get(territory.id) ?? createCoverageCounts();
      const lifecycle = territoryLifecycleCounts.get(territory.id) ?? createLifecycleCounts();
      const pipeline = territoryPipelineCounts.get(territory.id) ?? createPipelinePhaseCounts();

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
        trainedAccounts: trainingPenetration.trainedAccounts,
        activeProgramsCount: trainingPenetration.activeProgramsCount,
        trainingPenetrationPercent: toCoveragePercent(
          trainingPenetration.trainedAccounts,
          trainingPenetration.totalAccounts,
        ),
        engaged30DayAccountCount: coverage.engaged30DayCount,
        engaged90DayAccountCount: coverage.engaged90DayCount,
        overdue90DayAccountCount: coverage.overdue90DayCount,
        atRiskAccountCount: lifecycle.atRiskAccountCount,
        newLeadCount: pipeline.newLeadCount,
        discoveryLeadCount: pipeline.discoveryLeadCount,
        cisLeadCount: pipeline.cisLeadCount,
        onboardingLeadCount: pipeline.onboardingLeadCount,
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
  regionTrainingCounts: Map<string, TrainingPenetrationCounts>,
  regionCoverageCounts: Map<string, CoverageCounts>,
  regionLifecycleCounts: Map<string, LifecycleCounts>,
  regionPipelineCounts: Map<string, PipelinePhaseCounts>,
): TerritoryDashboardRegionRollupSummary[] {
  return regions
    .map((region) => {
      const regionTerritories = territories.filter((territory) => territory.regionId === region.id);
      const shippingCenterIds = new Set(regionTerritories.flatMap((territory) => territory.shippingCenterId ? [territory.shippingCenterId] : []));
      const trainingPenetration = regionTrainingCounts.get(region.id) ?? createTrainingPenetrationCounts();
      const coverage = regionCoverageCounts.get(region.id) ?? createCoverageCounts();
      const lifecycle = regionLifecycleCounts.get(region.id) ?? createLifecycleCounts();
      const pipeline = regionPipelineCounts.get(region.id) ?? createPipelinePhaseCounts();

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
        trainedAccounts: trainingPenetration.trainedAccounts,
        activeProgramsCount: trainingPenetration.activeProgramsCount,
        trainingPenetrationPercent: toCoveragePercent(
          trainingPenetration.trainedAccounts,
          trainingPenetration.totalAccounts,
        ),
        engaged30DayAccountCount: coverage.engaged30DayCount,
        engaged90DayAccountCount: coverage.engaged90DayCount,
        overdue90DayAccountCount: coverage.overdue90DayCount,
        atRiskAccountCount: lifecycle.atRiskAccountCount,
        newLeadCount: pipeline.newLeadCount,
        discoveryLeadCount: pipeline.discoveryLeadCount,
        cisLeadCount: pipeline.cisLeadCount,
        onboardingLeadCount: pipeline.onboardingLeadCount,
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
    engaged30DayAccountCount: number;
    engaged90DayAccountCount: number;
    atRiskAccountCount: number;
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
        engaged30DayAccountCount: 0,
        engaged90DayAccountCount: 0,
        atRiskAccountCount: 0,
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
    const coverage = summarizeCoverage(account);
    const lifecycle = account.lifecycleStatus === AccountLifecycleStatus.AT_RISK ? 1 : 0;

    if (account.assignedTmUserId) {
      const metric = ensureMetric('territory_manager', account.assignedTmUserId);
      if (account.isActive) {
        metric.activeAccountCount += 1;
      }
      metric.engaged30DayAccountCount += coverage.engaged30DayCount;
      metric.engaged90DayAccountCount += coverage.engaged90DayCount;
      metric.atRiskAccountCount += lifecycle;
    }
    if (account.assignedRdUserId) {
      const metric = ensureMetric('regional_director', account.assignedRdUserId);
      if (account.isActive) {
        metric.activeAccountCount += 1;
      }
      metric.engaged30DayAccountCount += coverage.engaged30DayCount;
      metric.engaged90DayAccountCount += coverage.engaged90DayCount;
      metric.atRiskAccountCount += lifecycle;
    }

    const territory = account.territoryId ? input.territoryById.get(account.territoryId) : undefined;
    if (territory?.managerUserId && !account.assignedTmUserId) {
      const metric = ensureMetric('territory_manager', territory.managerUserId);
      if (account.isActive) {
        metric.activeAccountCount += 1;
      }
      metric.engaged30DayAccountCount += coverage.engaged30DayCount;
      metric.engaged90DayAccountCount += coverage.engaged90DayCount;
      metric.atRiskAccountCount += lifecycle;
    }
    if (territory?.directorUserId && !account.assignedRdUserId) {
      const metric = ensureMetric('regional_director', territory.directorUserId);
      if (account.isActive) {
        metric.activeAccountCount += 1;
      }
      metric.engaged30DayAccountCount += coverage.engaged30DayCount;
      metric.engaged90DayAccountCount += coverage.engaged90DayCount;
      metric.atRiskAccountCount += lifecycle;
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
      engaged30DayAccountCount: metric.engaged30DayAccountCount,
      engaged90DayAccountCount: metric.engaged90DayAccountCount,
      atRiskAccountCount: metric.atRiskAccountCount,
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
    ...(lead.affinityGroup?.name ? { affinityGroupName: lead.affinityGroup.name } : {}),
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

function buildProviderNeutralRoutePlans(input: {
  pins: TerritoryMapPinSummary[];
  shippingCenters: TerritoryMapShippingCenterSummary[];
  visitStates?: Map<string, TerritoryRouteVisitState>;
}): TerritoryRoutePlanSummary[] {
  const centerById = new Map(input.shippingCenters.map((center) => [center.id, center]));
  const groups = new Map<string, TerritoryMapPinSummary[]>();

  for (const pin of input.pins) {
    const territoryKey = pin.territoryId ?? 'unassigned';
    const shippingCenterKey = pin.shippingCenterId ?? 'unassigned';
    const groupKey = `${territoryKey}:${shippingCenterKey}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), pin]);
  }

  return Array.from(groups.entries())
    .map(([groupKey, pins]) => {
      const firstPin = pins[0];
      const shippingCenter = firstPin?.shippingCenterId ? centerById.get(firstPin.shippingCenterId) : undefined;
      const orderedStops = orderRouteStops(pins, shippingCenter, input.visitStates);
      const totalMiles = orderedStops.reduce((sum, stop) => sum + stop.distanceFromPreviousMiles, 0);

      return {
        id: `route:${groupKey}`,
        ...(firstPin?.territoryId ? { territoryId: firstPin.territoryId } : {}),
        ...(firstPin?.territoryCode ? { territoryCode: firstPin.territoryCode } : {}),
        ...(firstPin?.territoryName ? { territoryName: firstPin.territoryName } : {}),
        ...(firstPin?.regionId ? { regionId: firstPin.regionId } : {}),
        ...(firstPin?.regionCode ? { regionCode: firstPin.regionCode } : {}),
        ...(firstPin?.regionName ? { regionName: firstPin.regionName } : {}),
        ...(firstPin?.shippingCenterId ? { shippingCenterId: firstPin.shippingCenterId } : {}),
        ...(firstPin?.shippingCenterCode ? { shippingCenterCode: firstPin.shippingCenterCode } : {}),
        ...(firstPin?.shippingCenterName ? { shippingCenterName: firstPin.shippingCenterName } : {}),
        ...(shippingCenter ? { originLatitude: shippingCenter.latitude } : {}),
        ...(shippingCenter ? { originLongitude: shippingCenter.longitude } : {}),
        ...(shippingCenter ? { originGeoPrecision: shippingCenter.geoPrecision } : {}),
        stopCount: orderedStops.length,
        accountStopCount: pins.filter((pin) => pin.recordType === 'account').length,
        leadStopCount: pins.filter((pin) => pin.recordType === 'lead').length,
        estimatedStraightLineMiles: roundMiles(totalMiles),
        isProviderOptimized: false,
        providerDependency: 'none',
        stops: orderedStops,
      } satisfies TerritoryRoutePlanSummary;
    })
    .sort((left, right) => {
      const leftName = left.territoryName ?? left.shippingCenterName ?? 'Unassigned';
      const rightName = right.territoryName ?? right.shippingCenterName ?? 'Unassigned';
      return leftName.localeCompare(rightName);
    });
}

function orderRouteStops(
  pins: TerritoryMapPinSummary[],
  origin?: TerritoryMapShippingCenterSummary,
  visitStates?: Map<string, TerritoryRouteVisitState>,
): TerritoryRoutePlanStopSummary[] {
  const remaining = [...pins].sort(compareRoutePins);
  const stops: TerritoryRoutePlanStopSummary[] = [];
  let current = origin
    ? { latitude: origin.latitude, longitude: origin.longitude }
    : getRouteCentroid(remaining);

  while (remaining.length > 0) {
    let nextIndex = 0;
    let nextDistance = calculateMiles(current, remaining[0] ?? current);

    for (let index = 1; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      if (!candidate) {
        continue;
      }
      const distance = calculateMiles(current, candidate);
      if (distance < nextDistance) {
        nextIndex = index;
        nextDistance = distance;
      }
    }

    const [nextPin] = remaining.splice(nextIndex, 1);
    if (!nextPin) {
      continue;
    }

    stops.push(toRoutePlanStop(nextPin, stops.length + 1, roundMiles(nextDistance), visitStates));
    current = nextPin;
  }

  return stops;
}

function compareRoutePins(left: TerritoryMapPinSummary, right: TerritoryMapPinSummary) {
  const recordPriority = getRouteRecordPriority(left) - getRouteRecordPriority(right);
  if (recordPriority !== 0) {
    return recordPriority;
  }

  const leftTouched = left.lastTouchedAt ? Date.parse(left.lastTouchedAt) : 0;
  const rightTouched = right.lastTouchedAt ? Date.parse(right.lastTouchedAt) : 0;
  if (leftTouched !== rightTouched) {
    return rightTouched - leftTouched;
  }

  return left.label.localeCompare(right.label);
}

function getRouteRecordPriority(pin: TerritoryMapPinSummary) {
  if (pin.recordType === 'account') {
    return 0;
  }
  if (pin.stage === 'cis_signed' || pin.stage === 'onboarding_completed') {
    return 1;
  }
  return 2;
}

function toRoutePlanStop(
  pin: TerritoryMapPinSummary,
  sequence: number,
  distanceFromPreviousMiles: number,
  visitStates?: Map<string, TerritoryRouteVisitState>,
): TerritoryRoutePlanStopSummary {
  const visitState = pin.recordType === 'account' ? visitStates?.get(pin.recordId) : undefined;
  return {
    sequence,
    pinId: pin.id,
    recordType: pin.recordType,
    recordId: pin.recordId,
    label: pin.label,
    status: pin.status,
    latitude: pin.latitude,
    longitude: pin.longitude,
    geoPrecision: pin.geoPrecision,
    distanceFromPreviousMiles,
    ...(pin.city ? { city: pin.city } : {}),
    ...(pin.state ? { state: pin.state } : {}),
    ...(pin.territoryId ? { territoryId: pin.territoryId } : {}),
    ...(pin.territoryCode ? { territoryCode: pin.territoryCode } : {}),
    ...(pin.territoryName ? { territoryName: pin.territoryName } : {}),
    ...(pin.assignedTmUserId ? { assignedTmUserId: pin.assignedTmUserId } : {}),
    ...(pin.assignedTmName ? { assignedTmName: pin.assignedTmName } : {}),
    ...(pin.assignedRdUserId ? { assignedRdUserId: pin.assignedRdUserId } : {}),
    ...(pin.assignedRdName ? { assignedRdName: pin.assignedRdName } : {}),
    ...(pin.lifecycleStatus ? { lifecycleStatus: pin.lifecycleStatus } : {}),
    ...(pin.stage ? { stage: pin.stage } : {}),
    ...(pin.accountType ? { accountType: pin.accountType } : {}),
    ...(pin.lastTouchedAt ? { lastTouchedAt: pin.lastTouchedAt } : {}),
    ...(pin.recordType === 'account'
      ? { visitExecutionState: visitState?.activeVisitSessionId ? 'checked_in' : visitState?.lastVisitSessionId ? 'completed' : 'not_started' }
      : {}),
    ...(visitState?.activeVisitSessionId ? { activeVisitSessionId: visitState.activeVisitSessionId } : {}),
    ...(visitState?.lastVisitSessionId ? { lastVisitSessionId: visitState.lastVisitSessionId } : {}),
    ...(visitState?.lastVisitCompletedAt ? { lastVisitCompletedAt: visitState.lastVisitCompletedAt } : {}),
    ...(visitState?.lastVisitTrainerName ? { lastVisitTrainerName: visitState.lastVisitTrainerName } : {}),
  };
}

function buildTerritoryRouteVisitStates(
  sessions: Array<{
    id: string;
    accountId: string;
    checkedInAt: Date | null;
    completedAt: Date | null;
    trainerUser?: {
      displayName: string;
    } | null;
  }>,
) {
  const states = new Map<string, TerritoryRouteVisitState>();

  for (const session of sessions) {
    const current = states.get(session.accountId) ?? { accountId: session.accountId };
    if (session.checkedInAt && !session.completedAt && !current.activeVisitSessionId) {
      current.activeVisitSessionId = session.id;
    }
    if (session.completedAt && !current.lastVisitSessionId) {
      current.lastVisitSessionId = session.id;
      current.lastVisitCompletedAt = session.completedAt.toISOString();
      if (session.trainerUser?.displayName) {
        current.lastVisitTrainerName = session.trainerUser.displayName;
      }
    }
    states.set(session.accountId, current);
  }

  return states;
}

function getRouteCentroid(pins: TerritoryMapPinSummary[]) {
  if (pins.length === 0) {
    return { latitude: 39, longitude: -96 };
  }

  return {
    latitude: pins.reduce((sum, pin) => sum + pin.latitude, 0) / pins.length,
    longitude: pins.reduce((sum, pin) => sum + pin.longitude, 0) / pins.length,
  };
}

function calculateMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMiles = 3958.8;
  const fromLat = degreesToRadians(from.latitude);
  const toLat = degreesToRadians(to.latitude);
  const deltaLat = degreesToRadians(to.latitude - from.latitude);
  const deltaLng = degreesToRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return value * (Math.PI / 180);
}

function roundMiles(value: number) {
  return Math.round(value * 10) / 10;
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

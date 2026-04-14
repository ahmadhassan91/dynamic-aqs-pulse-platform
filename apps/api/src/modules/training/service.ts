import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AccountSegment,
  AccountTrainingProgramStatus,
  AuditAction,
  prisma,
  TrainingActivityKind,
  TrainingCatalogFamily,
  TrainingCategoryKind,
  TrainingDeliveryMode,
  TrainingFollowUpTaskStatus,
  TrainingProofRequirement,
  TrainingSessionStatus,
  Prisma,
} from '@pulse/db';
import type {
  AccountTrainingHistoryResponse,
  AccountTrainingProgramSummary,
  CancelTrainingSessionRequest,
  CompleteTrainingFollowUpTaskRequest,
  CompleteTrainingSessionRequest,
  CreateTrainingFollowUpTaskRequest,
  CreateAccountTrainingProgramRequest,
  CreateTrainingCategoryRequest,
  CreateTrainingSessionRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  ListTrainingAccountsRequest,
  ListTrainingAccountsResponse,
  ListTrainingSessionsRequest,
  ListTrainingSessionsResponse,
  ListTrainingTrainersResponse,
  TrainingAccountSummary,
  TrainingCadencePolicySummary,
  TrainingCatalogResponse,
  TrainingCategoryKindKey,
  TrainingCategorySummary,
  TrainingFollowUpTaskStatusKey,
  TrainingFollowUpTaskSummary,
  TrainingOverviewResponse,
  TrainingProofRequirementKey,
  TrainingSessionSummary,
  TrainingTrainerSummary,
  TrainingTemplateSummary,
  TrainingTypeSummary,
  UpdateTrainingSessionScheduleRequest,
} from '@pulse/contracts';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAuditEntryData } from '../../utils/audit.js';

const TRAINING_CATEGORY_ENTITY = 'TRAINING_CATEGORY';
const TRAINING_TYPE_ENTITY = 'TRAINING_TYPE';
const TRAINING_TEMPLATE_ENTITY = 'TRAINING_TEMPLATE';
const TRAINING_PROGRAM_ENTITY = 'ACCOUNT_TRAINING_PROGRAM';
const TRAINING_SESSION_ENTITY = 'TRAINING_SESSION';
const TRAINING_FOLLOW_UP_TASK_ENTITY = 'TRAINING_FOLLOW_UP_TASK';

const DEFAULT_TRAINING_CATEGORIES = [
  {
    kind: TrainingCategoryKind.ONBOARDING,
    code: 'onboarding',
    name: 'Onboarding',
    description: 'Structured onboarding programs and first-customer enablement.',
    sortOrder: 10,
  },
  {
    kind: TrainingCategoryKind.PRODUCT,
    code: 'product',
    name: 'Product',
    description: 'Product-specific enablement and installation education.',
    sortOrder: 20,
  },
  {
    kind: TrainingCategoryKind.TECHNICAL,
    code: 'technical',
    name: 'Technical',
    description: 'Technical and problem-solving training tied to equipment and IAQ workflows.',
    sortOrder: 30,
  },
  {
    kind: TrainingCategoryKind.SALES,
    code: 'sales',
    name: 'Sales',
    description: 'Comfort advisor, CSR, objection handling, and communication training.',
    sortOrder: 40,
  },
  {
    kind: TrainingCategoryKind.COMPLIANCE,
    code: 'compliance',
    name: 'Compliance',
    description: 'Programs that support required operational or program compliance.',
    sortOrder: 50,
  },
  {
    kind: TrainingCategoryKind.CERTIFICATION,
    code: 'certification',
    name: 'Certification',
    description: 'Certification and credential-oriented training tracks.',
    sortOrder: 60,
  },
  {
    kind: TrainingCategoryKind.CUSTOM,
    code: 'custom',
    name: 'Custom',
    description: 'Account-specific presentations and non-standard training formats.',
    sortOrder: 70,
  },
  {
    kind: TrainingCategoryKind.VISIT,
    code: 'visit',
    name: 'Visits',
    description: 'Site visits and follow-up touches that should not count as formal training.',
    sortOrder: 80,
  },
] as const;

const DEFAULT_TRAINING_TYPES = [
  {
    categoryCode: 'visit',
    code: 'site_visit',
    name: 'Site Visit',
    description: 'Territory visit, field coaching, or follow-up that is not a formal training session.',
    family: TrainingCatalogFamily.VISIT_FOLLOW_UP,
    deliveryMode: TrainingDeliveryMode.VISIT,
    defaultDurationMinutes: 90,
    countsTowardHours: false,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 10,
  },
  {
    categoryCode: 'product',
    code: 'iaq_filtration_vs_purification',
    name: 'Background to IAQ & Filtration vs Air Purification',
    description: 'Foundational IAQ education covering filtration versus purification positioning.',
    family: TrainingCatalogFamily.PROGRAM_FOUNDATION,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 20,
  },
  {
    categoryCode: 'sales',
    code: 'comfort_advisor',
    name: 'Comfort Advisor',
    description: 'Product and technical knowledge with communication best practices for a sales role.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 30,
  },
  {
    categoryCode: 'sales',
    code: 'csr_office_staff',
    name: 'CSR / Office Staff Training',
    description: 'Helps customer service and office staff communicate IAQ benefits before dispatch.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.PHONE,
    defaultDurationMinutes: 45,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 40,
  },
  {
    categoryCode: 'visit',
    code: 'drop_by',
    name: 'Drop By',
    description: 'Unscheduled educational visit or follow-up conversation.',
    family: TrainingCatalogFamily.VISIT_FOLLOW_UP,
    deliveryMode: TrainingDeliveryMode.VISIT,
    defaultDurationMinutes: 30,
    countsTowardHours: false,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 50,
  },
  {
    categoryCode: 'technical',
    code: 'fix_it_stars',
    name: 'Fix It Stars',
    description: 'Focuses on permanent-fix thinking and best-practice technical troubleshooting.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 60,
  },
  {
    categoryCode: 'technical',
    code: 'gasses_odors_oxidation',
    name: 'Gasses, Odors & Oxidation',
    description: 'Technical training on contaminants, health impacts, UVV technology, and ozone.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 70,
  },
  {
    categoryCode: 'technical',
    code: 'germs_uvc_energy',
    name: 'Germs & UVC Energy',
    description: 'Covers controlling germs and biological contaminants using UVC technology.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 80,
  },
  {
    categoryCode: 'onboarding',
    code: 'grid_hw_hybrid',
    name: 'Grid / H&W Hybrid - On Site',
    description: 'Long-form training covering home contaminants plus the How & When communication foundation.',
    family: TrainingCatalogFamily.PROGRAM_FOUNDATION,
    deliveryMode: TrainingDeliveryMode.HYBRID,
    defaultDurationMinutes: 120,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 90,
  },
  {
    categoryCode: 'onboarding',
    code: 'grid_training_on_site',
    name: 'Grid Training - On Site',
    description: 'Teaches the three core home contaminants and the product story for each.',
    family: TrainingCatalogFamily.PROGRAM_FOUNDATION,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 90,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 100,
  },
  {
    categoryCode: 'product',
    code: 'hepa_bypass',
    name: 'HEPA-Bypass',
    description: 'Product knowledge and technical information for HEPA-bypass applications.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 45,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 110,
  },
  {
    categoryCode: 'sales',
    code: 'how_and_when',
    name: 'How & When',
    description: 'Communication foundation aligned to common service-call processes.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 120,
  },
  {
    categoryCode: 'product',
    code: 'humidifier',
    name: 'Humidifier',
    description: 'Technical and communication training for humidity and RH2 humidifiers.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 45,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 130,
  },
  {
    categoryCode: 'sales',
    code: 'jeopardy',
    name: 'Jeopardy',
    description: 'Game-show style engagement format used to identify knowledge gaps.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 140,
  },
  {
    categoryCode: 'sales',
    code: 'know_your_numbers',
    name: 'Know Your Numbers',
    description: 'Business-performance training focused on metrics and program economics.',
    family: TrainingCatalogFamily.MANAGEMENT,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: false,
    isCertificationTrack: false,
    sortOrder: 150,
  },
  {
    categoryCode: 'sales',
    code: 'management',
    name: 'Management',
    description: 'Helps managers create and support a strong IAQ program.',
    family: TrainingCatalogFamily.MANAGEMENT,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: false,
    isCertificationTrack: false,
    sortOrder: 160,
  },
  {
    categoryCode: 'sales',
    code: 'objection_handling',
    name: 'Objection Handling',
    description: 'Advanced communication training that follows How & When.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 170,
  },
  {
    categoryCode: 'onboarding',
    code: 'onboarding',
    name: 'Onboarding',
    description: 'Structured onboarding sessions for newly activated customer accounts.',
    family: TrainingCatalogFamily.PROGRAM_FOUNDATION,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 180,
  },
  {
    categoryCode: 'sales',
    code: 'outbound_calling',
    name: 'Outbound Calling',
    description: 'Outbound calling and phone-based IAQ communication training.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.PHONE,
    defaultDurationMinutes: 45,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 190,
  },
  {
    categoryCode: 'product',
    code: 'pan_treatments',
    name: 'Pan Treatments',
    description: 'Technical, product, and communication training around pan treatment solutions.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 45,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 200,
  },
  {
    categoryCode: 'sales',
    code: 'role_play',
    name: 'Role Play',
    description: 'Training that uses role play to practice effective communication techniques.',
    family: TrainingCatalogFamily.SALES_COMMUNICATION,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 210,
  },
  {
    categoryCode: 'certification',
    code: 'iaq_certification_curriculum',
    name: 'IAQ Certification Curriculum',
    description: 'Current active IAQ certification curriculum referenced by the existing training site.',
    family: TrainingCatalogFamily.PROGRAM_FOUNDATION,
    deliveryMode: TrainingDeliveryMode.VIRTUAL,
    defaultDurationMinutes: 90,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: true,
    sortOrder: 220,
  },
  {
    categoryCode: 'certification',
    code: 'product_installations',
    name: 'Product Installations',
    description: 'Current active product-installation certification/curriculum track.',
    family: TrainingCatalogFamily.TECHNICAL_PRODUCT,
    deliveryMode: TrainingDeliveryMode.ON_SITE,
    defaultDurationMinutes: 90,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: true,
    sortOrder: 230,
  },
  {
    categoryCode: 'custom',
    code: 'custom_presentation',
    name: 'Custom Presentation',
    description: 'Account-specific presentation or enablement session outside the standard catalog.',
    family: TrainingCatalogFamily.CUSTOM,
    deliveryMode: TrainingDeliveryMode.CUSTOM,
    defaultDurationMinutes: 60,
    countsTowardHours: true,
    isCustomerFacing: true,
    isCertificationTrack: false,
    sortOrder: 240,
  },
] as const;

const DEFAULT_TRAINING_TEMPLATE_OVERRIDES = new Map<string, Partial<TemplateSeed>>([
  ['site_visit', { proofRequirement: TrainingProofRequirement.NOTES_ONLY }],
  ['drop_by', { proofRequirement: TrainingProofRequirement.NOTES_ONLY }],
  ['iaq_certification_curriculum', { proofRequirement: TrainingProofRequirement.CERTIFICATE_REQUIRED }],
  ['product_installations', { proofRequirement: TrainingProofRequirement.CERTIFICATE_REQUIRED }],
]);

type TemplateSeed = {
  code: string;
  title: string;
  description?: string | undefined;
  proofRequirement: TrainingProofRequirement;
  prerequisiteSummary?: string | undefined;
  materialsSummary?: string | undefined;
};

type CategoryMap = Map<string, { id: string; code: string; name: string }>;
type TypeMap = Map<string, { id: string; code: string; name: string }>;

const DEFAULT_TRAINING_CADENCE_OVERRIDES = new Map<string, { cadenceDays: number; isRequired: boolean }>([
  ['onboarding', { cadenceDays: 30, isRequired: true }],
  ['grid_training_on_site', { cadenceDays: 180, isRequired: true }],
  ['grid_hw_hybrid', { cadenceDays: 180, isRequired: true }],
  ['how_and_when', { cadenceDays: 180, isRequired: true }],
  ['comfort_advisor', { cadenceDays: 180, isRequired: true }],
  ['site_visit', { cadenceDays: 180, isRequired: false }],
  ['drop_by', { cadenceDays: 180, isRequired: false }],
]);

const trainingProgramArgs = Prisma.validator<Prisma.AccountTrainingProgramDefaultArgs>()({
  include: {
    trainingType: true,
    template: true,
    ownerTmUser: {
      select: {
        id: true,
        displayName: true,
      },
    },
    ownerRdUser: {
      select: {
        id: true,
        displayName: true,
      },
    },
  },
});

const trainingSessionArgs = Prisma.validator<Prisma.TrainingSessionDefaultArgs>()({
  include: {
    account: {
      select: {
        id: true,
        displayName: true,
      },
    },
    program: {
      select: {
        id: true,
        title: true,
      },
    },
    trainingType: true,
    trainerUser: {
      select: {
        id: true,
        displayName: true,
        roleCode: true,
        email: true,
      },
    },
    location: true,
    followUpTasks: {
      include: {
        ownerUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        createdByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
    },
  },
});

const trainingAccountArgs = Prisma.validator<Prisma.AccountDefaultArgs>()({
  include: {
    businessSegment: true,
    territory: {
      include: {
        region: true,
      },
    },
    assignedTmUser: {
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    },
    trainingPrograms: {
      include: trainingProgramArgs.include,
      orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'asc' }],
    },
    trainingSessions: {
      include: trainingSessionArgs.include,
      orderBy: [{ completedAt: 'desc' }, { scheduledAt: 'desc' }, { createdAt: 'desc' }],
    },
  },
});

type TrainingProgramRecord = Prisma.AccountTrainingProgramGetPayload<typeof trainingProgramArgs>;
type TrainingSessionRecord = Prisma.TrainingSessionGetPayload<typeof trainingSessionArgs>;
type TrainingAccountRecord = Prisma.AccountGetPayload<typeof trainingAccountArgs>;
type TrainingFollowUpTaskRecord = TrainingSessionRecord['followUpTasks'][number];
type TrainingCategoryRecord = Prisma.TrainingCategoryGetPayload<{
  include: { _count: { select: { trainingTypes: true } } };
}>;
type TrainingTypeRecord = Prisma.TrainingTypeGetPayload<{
  include: { category: true };
}>;
type TrainingTemplateRecord = Prisma.TrainingTemplateGetPayload<{
  include: { trainingType: true };
}>;
type TrainingCadencePolicyRecord = Prisma.TrainingCadencePolicyGetPayload<{
  include: { trainingType: true };
}>;

const trainingFollowUpTaskInclude = Prisma.validator<Prisma.TrainingFollowUpTaskDefaultArgs>()({
  include: {
    ownerUser: {
      select: {
        id: true,
        displayName: true,
      },
    },
    createdByUser: {
      select: {
        id: true,
        displayName: true,
      },
    },
  },
}).include;

const ELIGIBLE_TRAINER_ROLE_CODES = new Set([
  'TRAINING_OPS',
  'TERRITORY_MANAGER',
  'REGIONAL_DIRECTOR',
]);

export async function ensureTrainingSeeded() {
  await prisma.$transaction(async (tx) => {
    for (const category of DEFAULT_TRAINING_CATEGORIES) {
      await tx.trainingCategory.upsert({
        where: { code: category.code },
        update: {},
        create: {
          kind: category.kind,
          code: category.code,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      });
    }

    const categories = await tx.trainingCategory.findMany({
      select: { id: true, code: true, name: true },
    });
    const categoryMap = new Map(categories.map((entry) => [entry.code, entry]));

    for (const trainingType of DEFAULT_TRAINING_TYPES) {
      const category = categoryMap.get(trainingType.categoryCode);
      if (!category) {
        throw new Error(`Missing training category seed: ${trainingType.categoryCode}`);
      }

      await tx.trainingType.upsert({
        where: { code: trainingType.code },
        update: {},
        create: {
          categoryId: category.id,
          code: trainingType.code,
          name: trainingType.name,
          description: trainingType.description,
          family: trainingType.family,
          deliveryMode: trainingType.deliveryMode,
          defaultDurationMinutes: trainingType.defaultDurationMinutes,
          countsTowardHours: trainingType.countsTowardHours,
          isCustomerFacing: trainingType.isCustomerFacing,
          isCertificationTrack: trainingType.isCertificationTrack,
          sortOrder: trainingType.sortOrder,
          isActive: true,
        },
      });
    }

    const trainingTypes = await tx.trainingType.findMany({
      select: { id: true, code: true, name: true },
    });
    const typeMap = new Map(trainingTypes.map((entry) => [entry.code, entry]));

    for (const trainingType of DEFAULT_TRAINING_TYPES) {
      const typeRecord = typeMap.get(trainingType.code);
      if (!typeRecord) {
        throw new Error(`Missing training type seed: ${trainingType.code}`);
      }

      const override = DEFAULT_TRAINING_TEMPLATE_OVERRIDES.get(trainingType.code);
      const templateSeed: TemplateSeed = {
        code: `${trainingType.code}_default`,
        title: `${trainingType.name} Template`,
        description: trainingType.description,
        proofRequirement: override?.proofRequirement ?? TrainingProofRequirement.ATTENDANCE_AND_NOTES,
        prerequisiteSummary: override?.prerequisiteSummary,
        materialsSummary: override?.materialsSummary,
      };

      await tx.trainingTemplate.upsert({
        where: { code: templateSeed.code },
        update: {},
        create: {
          trainingTypeId: typeRecord.id,
          code: templateSeed.code,
          title: templateSeed.title,
          ...(templateSeed.description ? { description: templateSeed.description } : {}),
          ...(templateSeed.prerequisiteSummary ? { prerequisiteSummary: templateSeed.prerequisiteSummary } : {}),
          ...(templateSeed.materialsSummary ? { materialsSummary: templateSeed.materialsSummary } : {}),
          proofRequirement: templateSeed.proofRequirement,
          isActive: true,
        },
      });

      const cadenceOverride = DEFAULT_TRAINING_CADENCE_OVERRIDES.get(trainingType.code);
      const existingCadencePolicy = await tx.trainingCadencePolicy.findFirst({
        where: {
          trainingTypeId: typeRecord.id,
          segmentScope: null,
        },
      });

      if (!existingCadencePolicy) {
        await tx.trainingCadencePolicy.create({
          data: {
            trainingTypeId: typeRecord.id,
            cadenceDays: cadenceOverride?.cadenceDays ?? 180,
            isRequired: cadenceOverride?.isRequired ?? trainingType.countsTowardHours,
            appliesToAllAccounts: true,
            isActive: true,
          },
        });
      }
    }
  });
}

export async function listTrainingOverview(actor: AuthenticatedActor): Promise<TrainingOverviewResponse> {
  assertModuleAccess(actor.role, 'training');

  const [totalAccountsTracked, activePrograms, completedSessions, scheduledSessions, overduePrograms, openFollowUpTasks, categoryCount, trainingTypeCount, templateCount, certificationTrackCount] = await Promise.all([
    prisma.account.count({
      where: {
        isActive: true,
      },
    }),
    prisma.accountTrainingProgram.count({
      where: {
        status: {
          in: [AccountTrainingProgramStatus.ACTIVE, AccountTrainingProgramStatus.NOT_STARTED, AccountTrainingProgramStatus.OVERDUE],
        },
      },
    }),
    prisma.trainingSession.count({
      where: {
        status: TrainingSessionStatus.COMPLETED,
      },
    }),
    prisma.trainingSession.count({
      where: {
        status: TrainingSessionStatus.SCHEDULED,
      },
    }),
    prisma.accountTrainingProgram.count({
      where: {
        OR: [
          { status: AccountTrainingProgramStatus.OVERDUE },
          {
            status: AccountTrainingProgramStatus.ACTIVE,
            nextDueAt: {
              lt: new Date(),
            },
          },
        ],
      },
    }),
    prisma.trainingFollowUpTask.count({
      where: {
        status: TrainingFollowUpTaskStatus.OPEN,
      },
    }),
    prisma.trainingCategory.count({
      where: { isActive: true },
    }),
    prisma.trainingType.count({
      where: { isActive: true },
    }),
    prisma.trainingTemplate.count({
      where: { isActive: true },
    }),
    prisma.trainingType.count({
      where: {
        isActive: true,
        isCertificationTrack: true,
      },
    }),
  ]);

  const completedHourSessions = await prisma.trainingSession.findMany({
    where: {
      status: TrainingSessionStatus.COMPLETED,
      activityKind: TrainingActivityKind.TRAINING,
    },
    select: {
      durationMinutes: true,
      trainingType: {
        select: {
          countsTowardHours: true,
        },
      },
    },
  });

  const deliveredTrainingHours = completedHourSessions.reduce((sum, entry) => (
    entry.trainingType?.countsTowardHours ? sum + (entry.durationMinutes / 60) : sum
  ), 0);

  return {
    totalAccountsTracked,
    activePrograms,
    overduePrograms,
    completedSessions,
    scheduledSessions,
    openFollowUpTasks,
    deliveredTrainingHours: roundHours(deliveredTrainingHours),
    categoryCount,
    trainingTypeCount,
    templateCount,
    certificationTrackCount,
  };
}

export async function listTrainingCatalog(actor: AuthenticatedActor): Promise<TrainingCatalogResponse> {
  assertModuleAccess(actor.role, 'training');

  const [categories, trainingTypes, templates, cadencePolicies] = await Promise.all([
    prisma.trainingCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            trainingTypes: true,
          },
        },
      },
    }),
    prisma.trainingType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        category: true,
      },
    }),
    prisma.trainingTemplate.findMany({
      orderBy: [{ title: 'asc' }],
      include: {
        trainingType: true,
      },
    }),
    prisma.trainingCadencePolicy.findMany({
      orderBy: [{ cadenceDays: 'asc' }, { createdAt: 'asc' }],
      include: {
        trainingType: true,
      },
    }),
  ]);

  return {
    categories: categories.map(toTrainingCategorySummary),
    trainingTypes: trainingTypes.map(toTrainingTypeSummary),
    templates: templates.map(toTrainingTemplateSummary),
    cadencePolicies: cadencePolicies.map(toTrainingCadencePolicySummary),
  };
}

export async function createTrainingCategory(
  actor: AuthenticatedActor,
  input: CreateTrainingCategoryRequest,
): Promise<TrainingCategorySummary> {
  assertActionAccess(actor.role, 'training.catalog_manage');

  const code = normalizeCode(input.code);
  const name = input.name?.trim();
  if (!code || !name) {
    throw new Error('code and name are required');
  }

  const created = await prisma.$transaction(async (tx) => {
    const category = await tx.trainingCategory.create({
      data: {
        kind: toTrainingCategoryKind(input.kind),
        code,
        name,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        sortOrder: input.sortOrder ?? 100,
        isActive: input.isActive ?? true,
      },
      include: {
        _count: {
          select: {
            trainingTypes: true,
          },
        },
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TRAINING_CATEGORY_ENTITY,
        entityId: category.id,
        afterData: {
          code: category.code,
          name: category.name,
          kind: category.kind,
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return category;
  });

  return toTrainingCategorySummary(created);
}

export async function createTrainingType(
  actor: AuthenticatedActor,
  input: CreateTrainingTypeRequest,
): Promise<TrainingTypeSummary> {
  assertActionAccess(actor.role, 'training.catalog_manage');

  const category = await prisma.trainingCategory.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) {
    throw new Error('Training category not found');
  }

  const code = normalizeCode(input.code);
  const name = input.name?.trim();
  if (!code || !name) {
    throw new Error('code and name are required');
  }
  if (input.defaultDurationMinutes <= 0) {
    throw new Error('defaultDurationMinutes must be greater than zero');
  }

  const created = await prisma.$transaction(async (tx) => {
    const trainingType = await tx.trainingType.create({
      data: {
        categoryId: category.id,
        code,
        name,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        family: toTrainingCatalogFamily(input.family),
        deliveryMode: toTrainingDeliveryMode(input.deliveryMode),
        defaultDurationMinutes: input.defaultDurationMinutes,
        countsTowardHours: input.countsTowardHours ?? true,
        isCustomerFacing: input.isCustomerFacing ?? true,
        isCertificationTrack: input.isCertificationTrack ?? false,
        ...(input.targetSegment ? { targetSegment: toAccountSegment(input.targetSegment) } : {}),
        sortOrder: input.sortOrder ?? 100,
        isActive: input.isActive ?? true,
      },
      include: {
        category: true,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TRAINING_TYPE_ENTITY,
        entityId: trainingType.id,
        afterData: {
          code: trainingType.code,
          name: trainingType.name,
          categoryCode: category.code,
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return trainingType;
  });

  return toTrainingTypeSummary(created);
}

export async function createTrainingTemplate(
  actor: AuthenticatedActor,
  input: CreateTrainingTemplateRequest,
): Promise<TrainingTemplateSummary> {
  assertActionAccess(actor.role, 'training.catalog_manage');

  const trainingType = await prisma.trainingType.findUnique({
    where: { id: input.trainingTypeId },
  });
  if (!trainingType) {
    throw new Error('Training type not found');
  }

  const code = normalizeCode(input.code);
  const title = input.title?.trim();
  if (!code || !title) {
    throw new Error('code and title are required');
  }

  const created = await prisma.$transaction(async (tx) => {
    const template = await tx.trainingTemplate.create({
      data: {
        trainingTypeId: trainingType.id,
        code,
        title,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.prerequisiteSummary?.trim() ? { prerequisiteSummary: input.prerequisiteSummary.trim() } : {}),
        ...(input.materialsSummary?.trim() ? { materialsSummary: input.materialsSummary.trim() } : {}),
        proofRequirement: toTrainingProofRequirement(input.proofRequirement ?? 'attendance_and_notes'),
        isActive: input.isActive ?? true,
      },
      include: {
        trainingType: true,
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TRAINING_TEMPLATE_ENTITY,
        entityId: template.id,
        afterData: {
          code: template.code,
          title: template.title,
          trainingTypeCode: trainingType.code,
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return template;
  });

  return toTrainingTemplateSummary(created);
}

export async function listTrainingAccounts(
  actor: AuthenticatedActor,
  query: ListTrainingAccountsRequest = {},
): Promise<ListTrainingAccountsResponse> {
  assertModuleAccess(actor.role, 'training');

  const search = query.search?.trim();
  const status = query.status ?? 'all';

  const accounts = await prisma.account.findMany({
    where: {
      ...(query.includeInactive ? {} : { isActive: true }),
      ...(search
        ? {
            displayName: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    orderBy: [{ displayName: 'asc' }],
    take: query.limit ?? 100,
    include: trainingAccountArgs.include,
  });

  const items = accounts
    .map(toTrainingAccountSummary)
    .filter((item) => filterTrainingAccountSummary(item, status));

  return {
    items,
    total: items.length,
  };
}

export async function getAccountTrainingHistory(
  actor: AuthenticatedActor,
  accountId: string,
): Promise<AccountTrainingHistoryResponse | null> {
  assertModuleAccess(actor.role, 'training');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: trainingAccountArgs.include,
  });

  if (!account) {
    return null;
  }

  return toAccountTrainingHistory(account);
}

export async function createAccountTrainingProgram(
  actor: AuthenticatedActor,
  accountId: string,
  input: CreateAccountTrainingProgramRequest,
): Promise<AccountTrainingProgramSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      businessSegment: true,
      territory: true,
      assignedTmUser: true,
      assignedRdUser: true,
    },
  });
  if (!account) {
    throw new Error('Account not found');
  }

  const trainingType = input.trainingTypeId
    ? await prisma.trainingType.findUnique({
        where: { id: input.trainingTypeId },
      })
    : null;
  const template = input.templateId
    ? await prisma.trainingTemplate.findUnique({
        where: { id: input.templateId },
      })
    : null;

  if (input.trainingTypeId && !trainingType) {
    throw new Error('Training type not found');
  }
  if (input.templateId && !template) {
    throw new Error('Training template not found');
  }
  if (template && trainingType && template.trainingTypeId !== trainingType.id) {
    throw new Error('Training template does not belong to the selected training type');
  }

  const title = input.title?.trim()
    || template?.title
    || trainingType?.name
    || 'Account Training Program';
  const targetSegment = input.targetSegment
    ? toAccountSegment(input.targetSegment)
    : resolveAccountTargetSegment(account.businessSegment?.code);
  const cadenceDays = input.cadenceDays
    ?? (trainingType ? await resolveDefaultCadenceDays(trainingType.id) : null)
    ?? undefined;

  const nextDueAt = cadenceDays
    ? new Date(Date.now() + cadenceDays * 24 * 60 * 60 * 1000)
    : undefined;

  const created = await prisma.$transaction(async (tx) => {
    const program = await tx.accountTrainingProgram.create({
      data: {
        accountId,
        ...(trainingType ? { trainingTypeId: trainingType.id } : {}),
        ...(template ? { templateId: template.id } : {}),
        createdByUserId: actor.userId,
        ownerTmUserId: account.assignedTmUserId,
        ownerRdUserId: account.assignedRdUserId,
        title,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        status: AccountTrainingProgramStatus.ACTIVE,
        ...(cadenceDays ? { cadenceDays } : {}),
        isRequired: input.isRequired ?? Boolean(trainingType?.countsTowardHours),
        ...(targetSegment ? { targetSegment } : {}),
        ...(nextDueAt ? { nextDueAt } : {}),
        startedAt: new Date(),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
      include: trainingProgramArgs.include,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TRAINING_PROGRAM_ENTITY,
        entityId: program.id,
        afterData: {
          accountId,
          title: program.title,
          trainingTypeCode: program.trainingType?.code,
          nextDueAt: program.nextDueAt?.toISOString(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return program;
  });

  return toAccountTrainingProgramSummary(created);
}

export async function listTrainingTrainers(
  actor: AuthenticatedActor,
): Promise<ListTrainingTrainersResponse> {
  assertModuleAccess(actor.role, 'training');

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      roleCode: {
        in: [...ELIGIBLE_TRAINER_ROLE_CODES],
      },
      OR: [
        { trainingTrainerProfile: null },
        { trainingTrainerProfile: { isActive: true } },
      ],
    },
    orderBy: [{ displayName: 'asc' }],
    include: {
      trainingTrainerProfile: true,
    },
  });

  return {
    items: users.map((user) => ({
      userId: user.id,
      displayName: user.displayName,
      ...(user.email ? { email: user.email } : {}),
      roleCode: user.roleCode,
      ...(user.trainingTrainerProfile?.title ? { title: user.trainingTrainerProfile.title } : {}),
      ...(user.trainingTrainerProfile?.notes ? { notes: user.trainingTrainerProfile.notes } : {}),
      isActive: user.trainingTrainerProfile?.isActive ?? true,
    })),
  };
}

export async function listTrainingSessions(
  actor: AuthenticatedActor,
  query: ListTrainingSessionsRequest = {},
): Promise<ListTrainingSessionsResponse> {
  assertModuleAccess(actor.role, 'training');

  const status = query.status ?? 'all';
  const sessions = await prisma.trainingSession.findMany({
    where: {
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.trainerUserId ? { trainerUserId: query.trainerUserId } : {}),
      ...(query.includeVisits ? {} : { activityKind: TrainingActivityKind.TRAINING }),
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: query.limit ?? 100,
    include: trainingSessionArgs.include,
  });

  const items = sessions
    .map(toTrainingSessionSummary)
    .filter((session) => filterTrainingSessionSummary(session, status));

  return {
    items,
    total: items.length,
    overdueCount: items.filter((item) => item.isOverdue).length,
    openFollowUpTaskCount: items.reduce((sum, item) => sum + item.openFollowUpTaskCount, 0),
  };
}

export async function createTrainingSession(
  actor: AuthenticatedActor,
  accountId: string,
  input: CreateTrainingSessionRequest,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      assignedTmUser: true,
      assignedRdUser: true,
      locations: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!account) {
    throw new Error('Account not found');
  }

  const scheduledAt = parseIsoDate(input.scheduledAt, 'scheduledAt');
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new Error('scheduledAt must be in the future');
  }
  if (input.durationMinutes <= 0) {
    throw new Error('durationMinutes must be greater than zero');
  }

  const trainer = await ensureAssignableTrainer(input.trainerUserId);

  const program = input.programId
    ? await prisma.accountTrainingProgram.findUnique({
        where: { id: input.programId },
        include: trainingProgramArgs.include,
      })
    : null;
  if (input.programId && !program) {
    throw new Error('Training program not found');
  }
  if (program && program.accountId !== accountId) {
    throw new Error('Training program does not belong to the selected account');
  }

  const trainingType = input.trainingTypeId
    ? await prisma.trainingType.findUnique({
        where: { id: input.trainingTypeId },
      })
    : program?.trainingTypeId
      ? await prisma.trainingType.findUnique({ where: { id: program.trainingTypeId } })
      : null;

  if (input.trainingTypeId && !trainingType) {
    throw new Error('Training type not found');
  }

  const locationId = input.locationId ?? account.locations.find((entry) => entry.isPrimary)?.id;
  if (locationId) {
    const hasLocation = account.locations.some((entry) => entry.id === locationId);
    if (!hasLocation) {
      throw new Error('Training location does not belong to the selected account');
    }
  }

  const activityKind = input.activityKind ? toTrainingActivityKind(input.activityKind) : TrainingActivityKind.TRAINING;
  const title = input.title?.trim() || trainingType?.name || program?.title || 'Training Session';

  const created = await prisma.$transaction(async (tx) => {
    const session = await tx.trainingSession.create({
      data: {
        accountId,
        ...(locationId ? { locationId } : {}),
        ...(program ? { programId: program.id } : {}),
        ...(trainingType ? { trainingTypeId: trainingType.id } : {}),
        trainerUserId: trainer.id,
        activityKind,
        status: TrainingSessionStatus.SCHEDULED,
        title,
        scheduledAt,
        durationMinutes: input.durationMinutes,
        attendeeCount: input.attendeeCount ?? 0,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      },
      include: trainingSessionArgs.include,
    });

    if (program && !program.startedAt) {
      await tx.accountTrainingProgram.update({
        where: { id: program.id },
        data: {
          startedAt: scheduledAt,
          status: AccountTrainingProgramStatus.ACTIVE,
        },
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TRAINING_SESSION_ENTITY,
        entityId: session.id,
        afterData: {
          accountId,
          trainerUserId: trainer.id,
          programId: program?.id,
          trainingTypeCode: trainingType?.code,
          scheduledAt: scheduledAt.toISOString(),
          activityKind: activityKind.toLowerCase(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return session;
  });

  return toTrainingSessionSummary(created);
}

export async function rescheduleTrainingSession(
  actor: AuthenticatedActor,
  sessionId: string,
  input: UpdateTrainingSessionScheduleRequest,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: trainingSessionArgs.include,
  });
  if (!session) {
    throw new Error('Training session not found');
  }
  if (session.status !== TrainingSessionStatus.SCHEDULED) {
    throw new Error('Only scheduled training sessions can be rescheduled');
  }

  const scheduledAt = parseIsoDate(input.scheduledAt, 'scheduledAt');
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new Error('scheduledAt must be in the future');
  }

  const trainer = input.trainerUserId
    ? await ensureAssignableTrainer(input.trainerUserId)
    : null;

  if (input.locationId) {
    const location = await prisma.accountLocation.findFirst({
      where: {
        id: input.locationId,
        accountId: session.accountId,
      },
      select: { id: true },
    });
    if (!location) {
      throw new Error('Training location does not belong to the selected account');
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.trainingSession.update({
      where: { id: sessionId },
      data: {
        scheduledAt,
        ...(trainer ? { trainerUserId: trainer.id } : {}),
        ...(input.locationId ? { locationId: input.locationId } : {}),
        ...(input.title?.trim() ? { title: input.title.trim() } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.attendeeCount !== undefined ? { attendeeCount: input.attendeeCount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      },
      include: trainingSessionArgs.include,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_SESSION_ENTITY,
        entityId: sessionId,
        beforeData: {
          scheduledAt: session.scheduledAt?.toISOString(),
          trainerUserId: session.trainerUserId,
        },
        afterData: {
          scheduledAt: next.scheduledAt?.toISOString(),
          trainerUserId: next.trainerUserId,
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toTrainingSessionSummary(updated);
}

export async function completeTrainingSession(
  actor: AuthenticatedActor,
  sessionId: string,
  input: CompleteTrainingSessionRequest,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: trainingSessionArgs.include,
  });
  if (!session) {
    throw new Error('Training session not found');
  }
  if (session.status !== TrainingSessionStatus.SCHEDULED) {
    throw new Error('Only scheduled training sessions can be completed');
  }

  const completedAt = input.completedAt ? parseIsoDate(input.completedAt, 'completedAt') : new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trainingSession.update({
      where: { id: sessionId },
      data: {
        status: TrainingSessionStatus.COMPLETED,
        completedAt,
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.attendeeCount !== undefined ? { attendeeCount: input.attendeeCount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        ...(input.completionSummary?.trim() ? { completionSummary: input.completionSummary.trim() } : {}),
      },
    });

    if (session.programId) {
      const program = await tx.accountTrainingProgram.findUnique({
        where: { id: session.programId },
      });

      if (program) {
        const nextDueAt = program.cadenceDays
          ? addCadenceDays(completedAt, program.cadenceDays)
          : null;
        await tx.accountTrainingProgram.update({
          where: { id: program.id },
          data: {
            lastCompletedAt: completedAt,
            ...(program.cadenceDays
              ? {
                  nextDueAt,
                  status: AccountTrainingProgramStatus.ACTIVE,
                }
              : {
                  completedAt,
                  nextDueAt: null,
                  status: AccountTrainingProgramStatus.COMPLETE,
                }),
          },
        });
      }
    }

    if (input.createFollowUpTask) {
      await createTrainingFollowUpTaskInTransaction(
        tx,
        actor,
        {
          id: sessionId,
          accountId: session.accountId,
          programId: session.programId,
        },
        input.createFollowUpTask,
      );
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_SESSION_ENTITY,
        entityId: sessionId,
        beforeData: {
          status: session.status.toLowerCase(),
        },
        afterData: {
          status: TrainingSessionStatus.COMPLETED.toLowerCase(),
          completedAt: completedAt.toISOString(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return tx.trainingSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: trainingSessionArgs.include,
    });
  });

  return toTrainingSessionSummary(updated);
}

export async function cancelTrainingSession(
  actor: AuthenticatedActor,
  sessionId: string,
  input: CancelTrainingSessionRequest,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: trainingSessionArgs.include,
  });
  if (!session) {
    throw new Error('Training session not found');
  }
  if (session.status !== TrainingSessionStatus.SCHEDULED) {
    throw new Error('Only scheduled training sessions can be cancelled or marked no-show');
  }

  const status = toTrainingSessionStatus(input.status);
  if (status !== TrainingSessionStatus.CANCELLED && status !== TrainingSessionStatus.NO_SHOW) {
    throw new Error('Unsupported training session terminal status');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.trainingSession.update({
      where: { id: sessionId },
      data: {
        status,
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
      },
      include: trainingSessionArgs.include,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_SESSION_ENTITY,
        entityId: sessionId,
        beforeData: {
          status: session.status.toLowerCase(),
        },
        afterData: {
          status: status.toLowerCase(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toTrainingSessionSummary(updated);
}

export async function createTrainingFollowUpTask(
  actor: AuthenticatedActor,
  sessionId: string,
  input: CreateTrainingFollowUpTaskRequest,
): Promise<TrainingFollowUpTaskSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: trainingSessionArgs.include,
  });
  if (!session) {
    throw new Error('Training session not found');
  }

  const created = await prisma.$transaction(async (tx) => {
    const task = await createTrainingFollowUpTaskInTransaction(tx, actor, session, input);
    return task;
  });

  return toTrainingFollowUpTaskSummary(created);
}

export async function completeTrainingFollowUpTask(
  actor: AuthenticatedActor,
  taskId: string,
  input: CompleteTrainingFollowUpTaskRequest,
): Promise<TrainingFollowUpTaskSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const task = await prisma.trainingFollowUpTask.findUnique({
    where: { id: taskId },
    include: trainingFollowUpTaskInclude,
  });
  if (!task) {
    throw new Error('Training follow-up task not found');
  }
  if (task.status !== TrainingFollowUpTaskStatus.OPEN) {
    throw new Error('Only open follow-up tasks can be completed');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.trainingFollowUpTask.update({
      where: { id: taskId },
      data: {
        status: TrainingFollowUpTaskStatus.COMPLETED,
        completedAt: new Date(),
        ...(input.notes !== undefined ? { description: input.notes.trim() || null } : {}),
      },
      include: trainingFollowUpTaskInclude,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_FOLLOW_UP_TASK_ENTITY,
        entityId: taskId,
        beforeData: {
          status: task.status.toLowerCase(),
        },
        afterData: {
          status: TrainingFollowUpTaskStatus.COMPLETED.toLowerCase(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return next;
  });

  return toTrainingFollowUpTaskSummary(updated);
}

function toTrainingCategorySummary(
  category: TrainingCategoryRecord,
): TrainingCategorySummary {
  return {
    id: category.id,
    kind: toTrainingCategoryKindKey(category.kind),
    code: category.code,
    name: category.name,
    ...(category.description ? { description: category.description } : {}),
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    trainingTypeCount: category._count.trainingTypes,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

function toTrainingTypeSummary(
  trainingType: TrainingTypeRecord,
): TrainingTypeSummary {
  return {
    id: trainingType.id,
    categoryId: trainingType.categoryId,
    categoryCode: trainingType.category.code,
    categoryName: trainingType.category.name,
    code: trainingType.code,
    name: trainingType.name,
    ...(trainingType.description ? { description: trainingType.description } : {}),
    family: toTrainingCatalogFamilyKey(trainingType.family),
    deliveryMode: toTrainingDeliveryModeKey(trainingType.deliveryMode),
    defaultDurationMinutes: trainingType.defaultDurationMinutes,
    countsTowardHours: trainingType.countsTowardHours,
    isCustomerFacing: trainingType.isCustomerFacing,
    isCertificationTrack: trainingType.isCertificationTrack,
    ...(trainingType.targetSegment ? { targetSegment: toAccountSegmentKey(trainingType.targetSegment) } : {}),
    sortOrder: trainingType.sortOrder,
    isActive: trainingType.isActive,
    createdAt: trainingType.createdAt.toISOString(),
    updatedAt: trainingType.updatedAt.toISOString(),
  };
}

function toTrainingTemplateSummary(
  template: TrainingTemplateRecord,
): TrainingTemplateSummary {
  return {
    id: template.id,
    trainingTypeId: template.trainingTypeId,
    trainingTypeCode: template.trainingType.code,
    trainingTypeName: template.trainingType.name,
    code: template.code,
    title: template.title,
    ...(template.description ? { description: template.description } : {}),
    ...(template.prerequisiteSummary ? { prerequisiteSummary: template.prerequisiteSummary } : {}),
    ...(template.materialsSummary ? { materialsSummary: template.materialsSummary } : {}),
    proofRequirement: toTrainingProofRequirementKey(template.proofRequirement),
    isActive: template.isActive,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

function toTrainingCadencePolicySummary(
  policy: TrainingCadencePolicyRecord,
): TrainingCadencePolicySummary {
  return {
    id: policy.id,
    trainingTypeId: policy.trainingTypeId,
    trainingTypeCode: policy.trainingType.code,
    ...(policy.segmentScope ? { segmentScope: toAccountSegmentKey(policy.segmentScope) } : {}),
    cadenceDays: policy.cadenceDays,
    isRequired: policy.isRequired,
    appliesToAllAccounts: policy.appliesToAllAccounts,
    isActive: policy.isActive,
    ...(policy.notes ? { notes: policy.notes } : {}),
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

function toTrainingAccountSummary(
  account: TrainingAccountRecord,
): TrainingAccountSummary {
  const activePrograms = account.trainingPrograms.filter((entry) => isProgramActive(entry.status));
  const overduePrograms = activePrograms.filter((entry) => isProgramOverdue(entry.status, entry.nextDueAt));
  const qualifyingSessions = account.trainingSessions.filter((entry) => (
    entry.status === TrainingSessionStatus.COMPLETED
    && entry.activityKind === TrainingActivityKind.TRAINING
    && entry.trainingType?.countsTowardHours
  ));
  const completedTrainingSessions = account.trainingSessions.filter((entry) => (
    entry.status === TrainingSessionStatus.COMPLETED
    && entry.activityKind === TrainingActivityKind.TRAINING
  ));
  const certificationTrackCount = activePrograms.filter((entry) => entry.trainingType?.isCertificationTrack).length;
  const lastTrainingAt = latestDateIso(completedTrainingSessions.map((entry) => entry.completedAt));
  const nextDueAt = earliestDateIso(activePrograms.map((entry) => entry.nextDueAt));

  return {
    accountId: account.id,
    accountName: account.displayName,
    ...(account.businessSegment?.code ? { businessSegmentCode: account.businessSegment.code } : {}),
    ...(account.territoryId ? { territoryId: account.territoryId } : {}),
    ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
    ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
    ...(account.assignedTmUser?.displayName ? { assignedTmName: account.assignedTmUser.displayName } : {}),
    ...(lastTrainingAt ? { lastTrainingAt } : {}),
    ...(nextDueAt ? { nextDueAt } : {}),
    totalTrainingHours: roundHours(qualifyingSessions.reduce((sum, entry) => sum + (entry.durationMinutes / 60), 0)),
    activeProgramCount: activePrograms.length,
    overdueProgramCount: overduePrograms.length,
    certificationTrackCount,
  };
}

function toAccountTrainingHistory(
  account: TrainingAccountRecord,
): AccountTrainingHistoryResponse {
  const summary = toTrainingAccountSummary(account);
  return {
    ...summary,
    programs: account.trainingPrograms.map(toAccountTrainingProgramSummary),
    recentSessions: account.trainingSessions.slice(0, 12).map(toTrainingSessionSummary),
    openFollowUpTasks: account.trainingSessions
      .flatMap((session) => session.followUpTasks)
      .filter((task) => task.status === TrainingFollowUpTaskStatus.OPEN)
      .map(toTrainingFollowUpTaskSummary)
      .slice(0, 12),
  };
}

function toAccountTrainingProgramSummary(
  program: TrainingProgramRecord,
): AccountTrainingProgramSummary {
  return {
    id: program.id,
    accountId: program.accountId,
    title: program.title,
    ...(program.description ? { description: program.description } : {}),
    ...(program.trainingTypeId ? { trainingTypeId: program.trainingTypeId } : {}),
    ...(program.trainingType?.code ? { trainingTypeCode: program.trainingType.code } : {}),
    ...(program.trainingType?.name ? { trainingTypeName: program.trainingType.name } : {}),
    ...(program.templateId ? { templateId: program.templateId } : {}),
    ...(program.template?.title ? { templateTitle: program.template.title } : {}),
    status: toAccountTrainingProgramStatusKey(program.status),
    ...(program.cadenceDays !== null ? { cadenceDays: program.cadenceDays } : {}),
    isRequired: program.isRequired,
    ...(program.targetSegment ? { targetSegment: toAccountSegmentKey(program.targetSegment) } : {}),
    ...(program.ownerTmUserId ? { ownerTmUserId: program.ownerTmUserId } : {}),
    ...(program.ownerTmUser?.displayName ? { ownerTmName: program.ownerTmUser.displayName } : {}),
    ...(program.ownerRdUserId ? { ownerRdUserId: program.ownerRdUserId } : {}),
    ...(program.ownerRdUser?.displayName ? { ownerRdName: program.ownerRdUser.displayName } : {}),
    ...(program.nextDueAt ? { nextDueAt: program.nextDueAt.toISOString() } : {}),
    ...(program.lastCompletedAt ? { lastCompletedAt: program.lastCompletedAt.toISOString() } : {}),
    ...(program.startedAt ? { startedAt: program.startedAt.toISOString() } : {}),
    ...(program.completedAt ? { completedAt: program.completedAt.toISOString() } : {}),
    ...(program.notes ? { notes: program.notes } : {}),
    isOverdue: isProgramOverdue(program.status, program.nextDueAt),
    createdAt: program.createdAt.toISOString(),
    updatedAt: program.updatedAt.toISOString(),
  };
}

function toTrainingSessionSummary(
  session: TrainingSessionRecord,
): TrainingSessionSummary {
  const openFollowUpTaskCount = session.followUpTasks.filter((task) => task.status === TrainingFollowUpTaskStatus.OPEN).length;
  return {
    id: session.id,
    accountId: session.accountId,
    ...(session.account?.displayName ? { accountName: session.account.displayName } : {}),
    ...(session.locationId ? { locationId: session.locationId } : {}),
    ...(session.location?.name ? { locationName: session.location.name } : {}),
    ...(session.programId ? { programId: session.programId } : {}),
    ...(session.program?.title ? { programTitle: session.program.title } : {}),
    ...(session.trainingTypeId ? { trainingTypeId: session.trainingTypeId } : {}),
    ...(session.trainingType?.code ? { trainingTypeCode: session.trainingType.code } : {}),
    ...(session.trainingType?.name ? { trainingTypeName: session.trainingType.name } : {}),
    ...(session.trainerUserId ? { trainerUserId: session.trainerUserId } : {}),
    ...(session.trainerUser?.displayName ? { trainerName: session.trainerUser.displayName } : {}),
    activityKind: toTrainingActivityKindKey(session.activityKind),
    status: toTrainingSessionStatusKey(session.status),
    title: session.title,
    ...(session.scheduledAt ? { scheduledAt: session.scheduledAt.toISOString() } : {}),
    ...(session.completedAt ? { completedAt: session.completedAt.toISOString() } : {}),
    durationMinutes: session.durationMinutes,
    attendeeCount: session.attendeeCount,
    ...(session.notes ? { notes: session.notes } : {}),
    ...(session.completionSummary ? { completionSummary: session.completionSummary } : {}),
    isOverdue: session.status === TrainingSessionStatus.SCHEDULED && Boolean(session.scheduledAt && session.scheduledAt.getTime() < Date.now()),
    countsTowardHours: session.trainingType?.countsTowardHours ?? false,
    openFollowUpTaskCount,
    followUpTasks: session.followUpTasks.map(toTrainingFollowUpTaskSummary),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function toTrainingFollowUpTaskSummary(
  task: TrainingFollowUpTaskRecord,
): TrainingFollowUpTaskSummary {
  return {
    id: task.id,
    sessionId: task.sessionId,
    accountId: task.accountId,
    title: task.title,
    ...(task.description ? { description: task.description } : {}),
    ...(task.dueAt ? { dueAt: task.dueAt.toISOString() } : {}),
    status: toTrainingFollowUpTaskStatusKey(task.status),
    ...(task.ownerUserId ? { ownerUserId: task.ownerUserId } : {}),
    ...(task.ownerUser?.displayName ? { ownerName: task.ownerUser.displayName } : {}),
    ...(task.createdByUserId ? { createdByUserId: task.createdByUserId } : {}),
    ...(task.createdByUser?.displayName ? { createdByName: task.createdByUser.displayName } : {}),
    ...(task.completedAt ? { completedAt: task.completedAt.toISOString() } : {}),
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function filterTrainingAccountSummary(item: TrainingAccountSummary, status: ListTrainingAccountsRequest['status']) {
  if (!status || status === 'all') {
    return true;
  }
  if (status === 'overdue') {
    return item.overdueProgramCount > 0;
  }
  if (status === 'active_programs') {
    return item.activeProgramCount > 0;
  }
  if (status === 'no_programs') {
    return item.activeProgramCount === 0;
  }
  return true;
}

function filterTrainingSessionSummary(item: TrainingSessionSummary, status: ListTrainingSessionsRequest['status']) {
  if (!status || status === 'all') {
    return true;
  }
  if (status === 'overdue') {
    return item.isOverdue;
  }
  return item.status === status;
}

function isProgramActive(status: AccountTrainingProgramStatus) {
  return status === AccountTrainingProgramStatus.ACTIVE
    || status === AccountTrainingProgramStatus.NOT_STARTED
    || status === AccountTrainingProgramStatus.OVERDUE;
}

function isProgramOverdue(status: AccountTrainingProgramStatus, nextDueAt: Date | null) {
  if (status === AccountTrainingProgramStatus.OVERDUE) {
    return true;
  }
  return status === AccountTrainingProgramStatus.ACTIVE && Boolean(nextDueAt && nextDueAt.getTime() < Date.now());
}

function latestDateIso(values: Array<Date | null | undefined>) {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());
  if (timestamps.length === 0) {
    return undefined;
  }
  return new Date(Math.max(...timestamps)).toISOString();
}

function earliestDateIso(values: Array<Date | null | undefined>) {
  const timestamps = values
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());
  if (timestamps.length === 0) {
    return undefined;
  }
  return new Date(Math.min(...timestamps)).toISOString();
}

function normalizeCode(input: string | undefined) {
  return input?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function resolveAccountTargetSegment(code?: string | null): AccountSegment | undefined {
  if (!code) {
    return undefined;
  }
  return toAccountSegment(code);
}

async function resolveDefaultCadenceDays(trainingTypeId: string) {
  const policy = await prisma.trainingCadencePolicy.findFirst({
    where: {
      trainingTypeId,
      isActive: true,
      segmentScope: null,
    },
    orderBy: [{ isRequired: 'desc' }, { cadenceDays: 'asc' }],
  });
  return policy?.cadenceDays ?? null;
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

function parseIsoDate(input: string, fieldName: string) {
  const value = new Date(input);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} must be a valid ISO date`);
  }

  return value;
}

function addCadenceDays(baseDate: Date, cadenceDays: number) {
  return new Date(baseDate.getTime() + cadenceDays * 24 * 60 * 60 * 1000);
}

function toTrainingCategoryKind(input: TrainingCategoryKindKey) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingCategoryKind, value)) {
    throw new Error(`Unsupported training category kind: ${input}`);
  }

  return value as TrainingCategoryKind;
}

function toTrainingCategoryKindKey(input: TrainingCategoryKind) {
  return input.toLowerCase() as TrainingCategoryKindKey;
}

function toTrainingCatalogFamily(input: CreateTrainingTypeRequest['family']) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingCatalogFamily, value)) {
    throw new Error(`Unsupported training catalog family: ${input}`);
  }

  return value as TrainingCatalogFamily;
}

function toTrainingCatalogFamilyKey(input: TrainingCatalogFamily) {
  return input.toLowerCase() as TrainingTypeSummary['family'];
}

function toTrainingDeliveryMode(input: CreateTrainingTypeRequest['deliveryMode']) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingDeliveryMode, value)) {
    throw new Error(`Unsupported training delivery mode: ${input}`);
  }

  return value as TrainingDeliveryMode;
}

function toTrainingDeliveryModeKey(input: TrainingDeliveryMode) {
  return input.toLowerCase() as TrainingTypeSummary['deliveryMode'];
}

function toTrainingProofRequirement(input: TrainingProofRequirementKey) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingProofRequirement, value)) {
    throw new Error(`Unsupported training proof requirement: ${input}`);
  }

  return value as TrainingProofRequirement;
}

function toTrainingProofRequirementKey(input: TrainingProofRequirement) {
  return input.toLowerCase() as TrainingProofRequirementKey;
}

function toAccountTrainingProgramStatusKey(input: AccountTrainingProgramStatus) {
  return input.toLowerCase() as AccountTrainingProgramSummary['status'];
}

function toTrainingSessionStatusKey(input: TrainingSessionStatus) {
  return input.toLowerCase() as TrainingSessionSummary['status'];
}

function toTrainingSessionStatus(input: CancelTrainingSessionRequest['status']) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingSessionStatus, value)) {
    throw new Error(`Unsupported training session status: ${input}`);
  }

  return value as TrainingSessionStatus;
}

function toTrainingActivityKindKey(input: TrainingActivityKind) {
  return input.toLowerCase() as TrainingSessionSummary['activityKind'];
}

function toTrainingActivityKind(input: CreateTrainingSessionRequest['activityKind']) {
  const value = (input ?? 'training').trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingActivityKind, value)) {
    throw new Error(`Unsupported training activity kind: ${input}`);
  }

  return value as TrainingActivityKind;
}

function toTrainingFollowUpTaskStatusKey(input: TrainingFollowUpTaskStatus) {
  return input.toLowerCase() as TrainingFollowUpTaskStatusKey;
}

function toAccountSegment(input: string) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(AccountSegment, value)) {
    throw new Error(`Unsupported account segment: ${input}`);
  }

  return value as AccountSegment;
}

function toAccountSegmentKey(input: AccountSegment) {
  return input.toLowerCase();
}

async function ensureAssignableTrainer(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      trainingTrainerProfile: true,
    },
  });

  if (!user || !user.isActive) {
    throw new Error('Trainer not found');
  }
  if (!ELIGIBLE_TRAINER_ROLE_CODES.has(user.roleCode)) {
    throw new Error('Selected user is not eligible to deliver training sessions');
  }
  if (user.trainingTrainerProfile && !user.trainingTrainerProfile.isActive) {
    throw new Error('Selected trainer profile is inactive');
  }

  return user;
}

async function createTrainingFollowUpTaskInTransaction(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
  session: Pick<TrainingSessionRecord, 'id' | 'accountId' | 'programId'>,
  input: CreateTrainingFollowUpTaskRequest,
) {
  const title = input.title?.trim();
  if (!title) {
    throw new Error('Follow-up task title is required');
  }

  if (input.ownerUserId) {
    const owner = await tx.user.findUnique({
      where: { id: input.ownerUserId },
    });
    if (!owner || !owner.isActive) {
      throw new Error('Follow-up task owner not found');
    }
  }

  const task = await tx.trainingFollowUpTask.create({
    data: {
      sessionId: session.id,
      accountId: session.accountId,
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
      createdByUserId: actor.userId,
      title,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.dueAt ? { dueAt: parseIsoDate(input.dueAt, 'dueAt') } : {}),
    },
    include: trainingFollowUpTaskInclude,
  });

  await tx.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.CREATE,
      entityType: TRAINING_FOLLOW_UP_TASK_ENTITY,
      entityId: task.id,
      afterData: {
        sessionId: session.id,
        accountId: session.accountId,
        title: task.title,
        ownerUserId: task.ownerUserId,
      },
      metadata: trainingAuditMetadata(actor),
    }),
  });

  return task;
}

function trainingAuditMetadata(actor: AuthenticatedActor) {
  return {
    sessionId: actor.sessionId,
    actorRole: actor.role,
    module: 'training',
  };
}

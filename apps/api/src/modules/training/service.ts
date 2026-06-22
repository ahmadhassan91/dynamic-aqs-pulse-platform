import { assertActionAccess, assertModuleAccess } from '@pulse/auth';
import {
  AccountSegment,
  AccountTrainingProgramStatus,
  AuditAction,
  MobileVoiceNoteReviewStatus,
  prisma,
  TrainingProofDocumentType,
  TrainingProofReviewStatus,
  TrainingActivityKind,
  TrainingCatalogFamily,
  TrainingCategoryKind,
  TrainingCertificationOutcome,
  TrainingCertificationStatus,
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
  CalendarEventTypeKey,
  CheckInTrainingSessionRequest,
  CompleteTrainingFollowUpTaskRequest,
  CompleteTrainingSessionRequest,
  CreateTrainingFollowUpTaskRequest,
  CreateAccountTrainingProgramRequest,
  CreateTrainingCategoryRequest,
  CreateTrainingSessionRequest,
  CreateTrainingTemplateRequest,
  CreateTrainingTypeRequest,
  DownloadTrainingSessionProofResponse,
  ListTrainingAccountsRequest,
  ListTrainingAccountsResponse,
  ListTrainingOperationalQueueRequest,
  ListTrainingOperationalQueueResponse,
  ListTrainingRecertificationQueueRequest,
  ListTrainingRecertificationQueueResponse,
  ListTrainingComplianceReportRequest,
  ListTrainingComplianceReportResponse,
  ListTrainingSessionsRequest,
  ListTrainingSessionsResponse,
  RevokeTrainingCertificationRequest,
  ReviewTrainingSessionProofRequest,
  ReviewTrainingSessionProofResponse,
  ResolveTrainingCertificationDecisionRequest,
  TrainingCoachingFollowUpTaskItem,
  TrainingCoachingUpcomingSessionItem,
  TrainingCoachingWorkloadResponse,
  ListTrainingTrainersResponse,
  TrainingAccountSummary,
  TrainingCadencePolicySummary,
  TrainingCatalogResponse,
  TrainingCategoryKindKey,
  TrainingCategorySummary,
  TrainingCertificationOutcomeKey,
  TrainingCertificationStatusKey,
  TrainingCertificationSummary,
  TrainingExecutionExceptionSeverityKey,
  TrainingOperationalCadenceQueueItem,
  TrainingOperationalCertificationQueueItem,
  TrainingOperationalExceptionQueueItem,
  TrainingComplianceCertificationTrackRollup,
  TrainingComplianceOwnerRollup,
  TrainingComplianceAccountExportRow,
  TrainingExecutionExceptionSummary,
  TrainingExecutionExceptionTypeKey,
  TrainingFollowUpTaskStatusKey,
  TrainingFollowUpTaskSummary,
  TrainingComplianceHoursRollup,
  TrainingExecutionStateKey,
  TrainingFieldActivityNoteSummary,
  TrainingOverviewResponse,
  TrainingProofDocumentSummary,
  TrainingProofDocumentTypeKey,
  TrainingProofRequirementKey,
  TrainingSessionSummary,
  TrainingTrainerSummary,
  TrainingTemplateSummary,
  TrainingTypeSummary,
  UploadTrainingSessionProofRequest,
  UploadTrainingSessionProofResponse,
  UpdateTrainingSessionScheduleRequest,
  TerritoryTrainingPenetrationResponse,
  TerritoryTrainingPenetrationTerritorySummary,
  TerritoryTrainingPenetrationRegionSummary,
} from '@pulse/contracts';
import type { AppConfig } from '../../config.js';
import type { AuthenticatedActor } from '../auth/types.js';
import { buildAccountRecordScope, buildTrainingSessionRecordScope } from '../auth/visibility.js';
import { createAppLogger } from '../../utils/logger.js';
import { markAccountEngaged } from '../accounts/service.js';
import { buildAuditEntryData } from '../../utils/audit.js';
import {
  tryAutoSyncCalendarEventToOutlook,
  tryAutoUnsyncCalendarEventFromOutlook,
} from '../calendar/outlook.js';
import { readStoredDocument, storeBase64Document } from '../documents/storage.js';

const TRAINING_CATEGORY_ENTITY = 'TRAINING_CATEGORY';
const TRAINING_TYPE_ENTITY = 'TRAINING_TYPE';
const TRAINING_TEMPLATE_ENTITY = 'TRAINING_TEMPLATE';
const TRAINING_PROGRAM_ENTITY = 'ACCOUNT_TRAINING_PROGRAM';
const TRAINING_SESSION_ENTITY = 'TRAINING_SESSION';
const TRAINING_CERTIFICATION_ENTITY = 'TRAINING_CERTIFICATION_RECORD';
const TRAINING_FOLLOW_UP_TASK_ENTITY = 'TRAINING_FOLLOW_UP_TASK';
const TRAINING_PROOF_DOCUMENT_ENTITY = 'TRAINING_PROOF_DOCUMENT';
const TRAINING_PROOF_MAX_BYTES = 4 * 1024 * 1024;
const TRAINING_PROOF_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
]);

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
        template: {
          select: {
            proofRequirement: true,
          },
        },
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
    certifications: {
      include: {
        trainingType: true,
        awardedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ awardedAt: 'desc' }, { createdAt: 'desc' }],
    },
    proofDocuments: {
      include: {
        uploadedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ uploadedAt: 'desc' }, { createdAt: 'desc' }],
    },
    mobileVoiceNotes: {
      where: {
        reviewStatus: MobileVoiceNoteReviewStatus.APPROVED,
      },
      include: {
        createdBy: { select: { displayName: true } },
        reviewedBy: { select: { displayName: true } },
      },
      orderBy: [{ recordedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
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
    assignedRdUser: {
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    },
    locations: {
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    },
    trainingPrograms: {
      include: trainingProgramArgs.include,
      orderBy: [{ nextDueAt: 'asc' }, { createdAt: 'asc' }],
    },
    trainingSessions: {
      include: trainingSessionArgs.include,
      orderBy: [{ completedAt: 'desc' }, { scheduledAt: 'desc' }, { createdAt: 'desc' }],
    },
    trainingCertifications: {
      include: {
        trainingType: true,
        awardedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
      orderBy: [{ awardedAt: 'desc' }, { createdAt: 'desc' }],
    },
  },
});

type TrainingProgramRecord = Prisma.AccountTrainingProgramGetPayload<typeof trainingProgramArgs>;
type TrainingSessionRecord = Prisma.TrainingSessionGetPayload<typeof trainingSessionArgs>;
type TrainingAccountRecord = Prisma.AccountGetPayload<typeof trainingAccountArgs>;
type TrainingFollowUpTaskRecord = TrainingSessionRecord['followUpTasks'][number];
type TrainingCertificationRecord = TrainingSessionRecord['certifications'][number];
type TrainingProofDocumentRecord = TrainingSessionRecord['proofDocuments'][number];
type TrainingFieldActivityRecord = TrainingSessionRecord['mobileVoiceNotes'][number];
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
type TrainingCertificationLifecycleRecord = Prisma.TrainingCertificationRecordGetPayload<{
  include: {
    trainingType: true;
    awardedByUser: {
      select: {
        id: true;
        displayName: true;
      };
    };
  };
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
let trainingSeedPromise: Promise<void> | null = null;

export async function ensureTrainingSeeded() {
  if (trainingSeedPromise) {
    return trainingSeedPromise;
  }

  trainingSeedPromise = ensureTrainingSeededInternal().finally(() => {
    trainingSeedPromise = null;
  });

  return trainingSeedPromise;
}

async function requireVisibleTrainingAccount(
  actor: AuthenticatedActor,
  accountId: string,
): Promise<TrainingAccountRecord> {
  const accountScope = buildAccountRecordScope(actor);
  const account = await prisma.account.findFirst({
    where: {
      AND: [
        ...(accountScope ? [accountScope] : []),
        { id: accountId },
      ],
    },
    include: trainingAccountArgs.include,
  });
  if (!account) {
    throw new Error('Account not found');
  }
  return account;
}

async function requireVisibleTrainingSession(
  actor: AuthenticatedActor,
  sessionId: string,
): Promise<TrainingSessionRecord> {
  const sessionScope = buildTrainingSessionRecordScope(actor);
  const session = await prisma.trainingSession.findFirst({
    where: {
      AND: [
        ...(sessionScope ? [sessionScope] : []),
        { id: sessionId },
      ],
    },
    include: trainingSessionArgs.include,
  });
  if (!session) {
    throw new Error('Training session not found');
  }
  return session;
}

async function requireVisibleTrainingFollowUpTask(
  actor: AuthenticatedActor,
  taskId: string,
): Promise<Prisma.TrainingFollowUpTaskGetPayload<{ include: typeof trainingFollowUpTaskInclude }>> {
  const sessionScope = buildTrainingSessionRecordScope(actor);
  const task = await prisma.trainingFollowUpTask.findFirst({
    where: {
      AND: [
        ...(sessionScope ? [{ session: sessionScope }] : []),
        { id: taskId },
      ],
    },
    include: trainingFollowUpTaskInclude,
  });
  if (!task) {
    throw new Error('Training follow-up task not found');
  }
  return task;
}

async function requireVisibleTrainingCertification(
  actor: AuthenticatedActor,
  certificationId: string,
): Promise<TrainingCertificationLifecycleRecord> {
  const accountScope = buildAccountRecordScope(actor);
  const certification = await prisma.trainingCertificationRecord.findFirst({
    where: {
      AND: [
        ...(accountScope ? [{ account: accountScope }] : []),
        { id: certificationId },
      ],
    },
    include: {
      trainingType: true,
      awardedByUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });
  if (!certification) {
    throw new Error('Training certification not found');
  }
  return certification;
}

async function ensureTrainingSeededInternal() {
  await prisma.trainingCategory.createMany({
    data: DEFAULT_TRAINING_CATEGORIES.map((category) => ({
      kind: category.kind,
      code: category.code,
      name: category.name,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: true,
    })),
    skipDuplicates: true,
  });

  const categories = await prisma.trainingCategory.findMany({
    select: { id: true, code: true, name: true },
  });
  const categoryMap = new Map(categories.map((entry) => [entry.code, entry]));

  for (const trainingType of DEFAULT_TRAINING_TYPES) {
    const category = categoryMap.get(trainingType.categoryCode);
    if (!category) {
      throw new Error(`Missing training category seed: ${trainingType.categoryCode}`);
    }

    const typeRecord = await prisma.trainingType.upsert({
      where: { code: trainingType.code },
      update: {
        categoryId: category.id,
        name: trainingType.name,
        ...(trainingType.description ? { description: trainingType.description } : {}),
        family: trainingType.family,
        deliveryMode: trainingType.deliveryMode,
        defaultDurationMinutes: trainingType.defaultDurationMinutes,
        countsTowardHours: trainingType.countsTowardHours,
        isCustomerFacing: trainingType.isCustomerFacing,
        isCertificationTrack: trainingType.isCertificationTrack,
        sortOrder: trainingType.sortOrder,
        isActive: true,
      },
      create: {
        categoryId: category.id,
        code: trainingType.code,
        name: trainingType.name,
        ...(trainingType.description ? { description: trainingType.description } : {}),
        family: trainingType.family,
        deliveryMode: trainingType.deliveryMode,
        defaultDurationMinutes: trainingType.defaultDurationMinutes,
        countsTowardHours: trainingType.countsTowardHours,
        isCustomerFacing: trainingType.isCustomerFacing,
        isCertificationTrack: trainingType.isCertificationTrack,
        sortOrder: trainingType.sortOrder,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });

    const override = DEFAULT_TRAINING_TEMPLATE_OVERRIDES.get(trainingType.code);
    const templateSeed: TemplateSeed = {
      code: `${trainingType.code}_default`,
      title: `${trainingType.name} Template`,
      description: trainingType.description,
      proofRequirement: override?.proofRequirement ?? TrainingProofRequirement.ATTENDANCE_AND_NOTES,
      prerequisiteSummary: override?.prerequisiteSummary,
      materialsSummary: override?.materialsSummary,
    };

    await prisma.trainingTemplate.upsert({
      where: { code: templateSeed.code },
      update: {
        trainingTypeId: typeRecord.id,
        title: templateSeed.title,
        ...(templateSeed.description ? { description: templateSeed.description } : {}),
        ...(templateSeed.prerequisiteSummary ? { prerequisiteSummary: templateSeed.prerequisiteSummary } : {}),
        ...(templateSeed.materialsSummary ? { materialsSummary: templateSeed.materialsSummary } : {}),
        proofRequirement: templateSeed.proofRequirement,
        isActive: true,
      },
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
    const existingCadencePolicy = await prisma.trainingCadencePolicy.findFirst({
      where: {
        trainingTypeId: typeRecord.id,
        segmentScope: null,
      },
    });

    if (existingCadencePolicy) {
      await prisma.trainingCadencePolicy.update({
        where: { id: existingCadencePolicy.id },
        data: {
          cadenceDays: cadenceOverride?.cadenceDays ?? 180,
          isRequired: cadenceOverride?.isRequired ?? trainingType.countsTowardHours,
          appliesToAllAccounts: true,
          isActive: true,
        },
      });
    } else {
      await prisma.trainingCadencePolicy.create({
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
}

export async function listTrainingOverview(actor: AuthenticatedActor): Promise<TrainingOverviewResponse> {
  assertModuleAccess(actor.role, 'training');
  const accountScope = buildAccountRecordScope(actor);
  const sessionScope = buildTrainingSessionRecordScope(actor);
  const accountScopedWhere = accountScope ? { account: accountScope } : {};
  const sessionScopedWhere = sessionScope ? { AND: [sessionScope] } : {};

  const [
    totalAccountsTracked,
    activePrograms,
    completedSessions,
    scheduledSessions,
    overduePrograms,
    openFollowUpTasks,
    categoryCount,
    trainingTypeCount,
    templateCount,
    certificationTrackCount,
    activeCertificationCount,
    pendingCertificationDecisionCount,
  ] = await Promise.all([
    prisma.account.count({
      where: {
        AND: [
          ...(accountScope ? [accountScope] : []),
          { isActive: true },
        ],
      },
    }),
    prisma.accountTrainingProgram.count({
      where: {
        ...accountScopedWhere,
        status: {
          in: [AccountTrainingProgramStatus.ACTIVE, AccountTrainingProgramStatus.NOT_STARTED, AccountTrainingProgramStatus.OVERDUE],
        },
      },
    }),
    prisma.trainingSession.count({
      where: {
        ...sessionScopedWhere,
        status: TrainingSessionStatus.COMPLETED,
      },
    }),
    prisma.trainingSession.count({
      where: {
        ...sessionScopedWhere,
        status: TrainingSessionStatus.SCHEDULED,
      },
    }),
    prisma.accountTrainingProgram.count({
      where: {
        ...accountScopedWhere,
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
        ...(sessionScope ? { session: sessionScope } : {}),
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
    prisma.trainingCertificationRecord.count({
      where: {
        ...accountScopedWhere,
        status: TrainingCertificationStatus.ACTIVE,
      },
    }),
    prisma.trainingSession.count({
      where: {
        ...sessionScopedWhere,
        status: TrainingSessionStatus.COMPLETED,
        certificationOutcome: TrainingCertificationOutcome.PENDING_DECISION,
      },
    }),
  ]);

  const completedHourSessions = await prisma.trainingSession.findMany({
    where: {
      ...sessionScopedWhere,
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
    activeCertificationCount,
    pendingCertificationDecisionCount,
    executionExceptionCount: overduePrograms + pendingCertificationDecisionCount,
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
  const accountScope = buildAccountRecordScope(actor);

  const accounts = await prisma.account.findMany({
    where: {
      AND: [
        ...(accountScope ? [accountScope] : []),
        {
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
      ],
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
  const accountScope = buildAccountRecordScope(actor);

  const account = await prisma.account.findFirst({
    where: {
      AND: [
        ...(accountScope ? [accountScope] : []),
        { id: accountId },
      ],
    },
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

  const account = await requireVisibleTrainingAccount(actor, accountId);

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
  const sessionScope = buildTrainingSessionRecordScope(actor);
  const sessions = await prisma.trainingSession.findMany({
    where: {
      AND: [
        ...(sessionScope ? [sessionScope] : []),
        {
          ...(query.accountId ? { accountId: query.accountId } : {}),
          ...(query.trainerUserId ? { trainerUserId: query.trainerUserId } : {}),
          ...(query.includeVisits ? {} : { activityKind: TrainingActivityKind.TRAINING }),
        },
      ],
    },
    orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    take: query.limit ?? 100,
    include: trainingSessionArgs.include,
  });

  const items = sessions
    .map(toTrainingSessionSummary)
    .filter((session) => filterTrainingSessionSummary(session, status));
  const executionExceptions = buildTrainingExecutionExceptions(items);

  return {
    items,
    total: items.length,
    overdueCount: items.filter((item) => item.isOverdue).length,
    openFollowUpTaskCount: items.reduce((sum, item) => sum + item.openFollowUpTaskCount, 0),
    executionExceptions,
  };
}

export async function listTrainingOperationalQueue(
  actor: AuthenticatedActor,
  query: ListTrainingOperationalQueueRequest = {},
): Promise<ListTrainingOperationalQueueResponse> {
  assertModuleAccess(actor.role, 'training');

  const scope = resolveTrainingOperationalQueueScope(actor, query);
  const accountScope = buildAccountRecordScope(actor);
  const accounts = await prisma.account.findMany({
    where: {
      AND: [
        ...(accountScope ? [accountScope] : []),
        {
          isActive: true,
          ...(scope.ownerTmUserId ? { assignedTmUserId: scope.ownerTmUserId } : {}),
          ...(scope.ownerRdUserId ? { assignedRdUserId: scope.ownerRdUserId } : {}),
          OR: [
            { trainingPrograms: { some: {} } },
            { trainingSessions: { some: {} } },
            { trainingCertifications: { some: {} } },
          ],
        },
      ],
    },
    orderBy: [{ displayName: 'asc' }],
    take: scope.limit,
    include: trainingAccountArgs.include,
  });

  const expiringCertifications = accounts
    .flatMap((account) => buildExpiringTrainingCertificationQueueItems(account, scope.certificationWindowDays))
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry || compareQueueAccountNames(left.accountName, right.accountName));
  const expiredCertifications = accounts
    .flatMap(buildExpiredTrainingCertificationQueueItems)
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry || compareQueueAccountNames(left.accountName, right.accountName));
  const overduePrograms = accounts
    .flatMap(buildOverdueTrainingProgramQueueItems)
    .sort((left, right) => right.daysOverdue - left.daysOverdue || compareQueueAccountNames(left.accountName, right.accountName));
  const unresolvedExecutionExceptions = accounts
    .flatMap(buildTrainingOperationalExceptionQueueItems)
    .sort((left, right) => (
      severityWeight(right.severity) - severityWeight(left.severity)
      || compareQueueAccountNames(left.accountName, right.accountName)
    ));

  return {
    expiringCertifications: expiringCertifications.slice(0, scope.limit),
    expiredCertifications: expiredCertifications.slice(0, scope.limit),
    overduePrograms: overduePrograms.slice(0, scope.limit),
    unresolvedExecutionExceptions: unresolvedExecutionExceptions.slice(0, scope.limit),
    summary: {
      expiringCertificationCount: expiringCertifications.length,
      expiredCertificationCount: expiredCertifications.length,
      overdueProgramCount: overduePrograms.length,
      unresolvedExecutionExceptionCount: unresolvedExecutionExceptions.length,
    },
  };
}

// Training aggregate reports load accounts (with deep training includes) and roll up in JS. Bound the scan
// so a large, growing account base can't materialize unboundedly and fall over; truncation is logged so it
// is visible rather than silent. (A full server-side rollup is the longer-term optimization.)
const TRAINING_REPORT_ACCOUNT_CAP = 5000;
const trainingReportLogger = createAppLogger();

async function fetchCappedTrainingReportAccounts(where: Prisma.AccountWhereInput, context: string) {
  const accounts = await prisma.account.findMany({
    where,
    orderBy: [{ displayName: 'asc' }],
    include: trainingAccountArgs.include,
    take: TRAINING_REPORT_ACCOUNT_CAP + 1,
  });
  if (accounts.length > TRAINING_REPORT_ACCOUNT_CAP) {
    trainingReportLogger.warn('training report account scan truncated', {
      context,
      cap: TRAINING_REPORT_ACCOUNT_CAP,
    });
    accounts.length = TRAINING_REPORT_ACCOUNT_CAP;
  }
  return accounts;
}

export async function listTrainingComplianceReport(
  actor: AuthenticatedActor,
  query: ListTrainingComplianceReportRequest = {},
): Promise<ListTrainingComplianceReportResponse> {
  assertModuleAccess(actor.role, 'training');

  const scope = resolveTrainingComplianceScope(actor, query);
  const accountScope = buildAccountRecordScope(actor);
  const accounts = await fetchCappedTrainingReportAccounts(
    {
      AND: [
        ...(accountScope ? [accountScope] : []),
        {
          isActive: true,
          ...(scope.ownerTmUserId ? { assignedTmUserId: scope.ownerTmUserId } : {}),
          ...(scope.ownerRdUserId ? { assignedRdUserId: scope.ownerRdUserId } : {}),
          OR: [
            { trainingPrograms: { some: {} } },
            { trainingSessions: { some: {} } },
            { trainingCertifications: { some: {} } },
          ],
        },
      ],
    },
    'compliance-report',
  );

  const tmRollups = new Map<string, TrainingComplianceOwnerRollup>();
  const rdRollups = new Map<string, TrainingComplianceOwnerRollup>();
  const certificationTrackRollups = new Map<string, TrainingComplianceCertificationTrackRollup>();
  const hoursByAccount = new Map<string, TrainingComplianceHoursRollup>();
  const hoursByTerritory = new Map<string, TrainingComplianceHoursRollup>();
  const hoursByTrainer = new Map<string, TrainingComplianceHoursRollup>();
  const hoursByTrainingType = new Map<string, TrainingComplianceHoursRollup>();
  const hoursByState = new Map<string, TrainingComplianceHoursRollup>();
  const accountExportRows: TrainingComplianceAccountExportRow[] = [];

  let activeCertificationCount = 0;
  let expiringCertificationCount = 0;
  let expiredCertificationCount = 0;
  let revokedCertificationCount = 0;
  let overdueProgramCount = 0;
  let unresolvedExecutionExceptionCount = 0;
  let pendingCertificationDecisionCount = 0;
  let deliveredTrainingHours = 0;
  let accountsWithActivePrograms = 0;

  for (const account of accounts) {
    const metrics = buildTrainingComplianceAccountMetrics(account, scope.certificationWindowDays);

    activeCertificationCount += metrics.activeCertificationCount;
    expiringCertificationCount += metrics.expiringCertificationCount;
    expiredCertificationCount += metrics.expiredCertificationCount;
    revokedCertificationCount += metrics.revokedCertificationCount;
    overdueProgramCount += metrics.overdueProgramCount;
    unresolvedExecutionExceptionCount += metrics.unresolvedExecutionExceptionCount;
    pendingCertificationDecisionCount += metrics.pendingCertificationDecisionCount;
    deliveredTrainingHours += metrics.deliveredTrainingHours;
    if (metrics.hasActivePrograms) {
      accountsWithActivePrograms += 1;
    }
    accountExportRows.push(buildTrainingComplianceAccountExportRow(account, metrics));
    accumulateTrainingHoursRollups({
      account,
      hoursByAccount,
      hoursByTerritory,
      hoursByTrainer,
      hoursByTrainingType,
      hoursByState,
    });

    if (account.assignedTmUserId && account.assignedTmUser?.displayName) {
      accumulateTrainingComplianceOwnerRollup(
        tmRollups,
        account.assignedTmUserId,
        account.assignedTmUser.displayName,
        'TERRITORY_MANAGER',
        metrics,
      );
    }

    if (account.assignedRdUserId && account.assignedRdUser?.displayName) {
      accumulateTrainingComplianceOwnerRollup(
        rdRollups,
        account.assignedRdUserId,
        account.assignedRdUser.displayName,
        'REGIONAL_DIRECTOR',
        metrics,
      );
    }

    for (const program of account.trainingPrograms) {
      if (!isProgramOverdue(program.status, program.nextDueAt)) {
        continue;
      }

      const tmOwnerId = program.ownerTmUserId ?? account.assignedTmUserId ?? undefined;
      const tmOwnerName = program.ownerTmUser?.displayName ?? account.assignedTmUser?.displayName ?? undefined;
      const rdOwnerId = program.ownerRdUserId ?? account.assignedRdUserId ?? undefined;
      const rdOwnerName = program.ownerRdUser?.displayName ?? account.assignedRdUser?.displayName ?? undefined;

      if (tmOwnerId && tmOwnerName) {
        incrementTrainingOwnerOverdueProgram(tmRollups, tmOwnerId, tmOwnerName, 'TERRITORY_MANAGER');
      }
      if (rdOwnerId && rdOwnerName) {
        incrementTrainingOwnerOverdueProgram(rdRollups, rdOwnerId, rdOwnerName, 'REGIONAL_DIRECTOR');
      }
    }

    for (const certification of account.trainingCertifications) {
      const key = certification.trainingTypeId
        ?? certification.trainingType?.code
        ?? certification.certificationCode
        ?? certification.title;

      const rollup = certificationTrackRollups.get(key) ?? {
        ...(certification.trainingTypeId ? { trainingTypeId: certification.trainingTypeId } : {}),
        ...(certification.trainingType?.code ? { trainingTypeCode: certification.trainingType.code } : {}),
        ...(certification.trainingType?.name ? { trainingTypeName: certification.trainingType.name } : {}),
        activeCertificationCount: 0,
        expiringCertificationCount: 0,
        expiredCertificationCount: 0,
        revokedCertificationCount: 0,
      };

      if (isTrainingCertificationRevoked(certification)) {
        rollup.revokedCertificationCount += 1;
      } else if (isTrainingCertificationExpired(certification)) {
        rollup.expiredCertificationCount += 1;
      } else {
        rollup.activeCertificationCount += 1;
        if (isTrainingCertificationExpiringWithin(certification, scope.certificationWindowDays)) {
          rollup.expiringCertificationCount += 1;
        }
      }

      certificationTrackRollups.set(key, rollup);
    }
  }

  return {
    summary: {
      accountsInScope: accounts.length,
      accountsWithActivePrograms,
      activeCertificationCount,
      expiringCertificationCount,
      expiredCertificationCount,
      revokedCertificationCount,
      overdueProgramCount,
      unresolvedExecutionExceptionCount,
      pendingCertificationDecisionCount,
      deliveredTrainingHours: roundHours(deliveredTrainingHours),
    },
    territoryManagers: sortTrainingComplianceOwnerRollups(tmRollups),
    regionalDirectors: sortTrainingComplianceOwnerRollups(rdRollups),
    certificationTracks: Array.from(certificationTrackRollups.values()).sort((left, right) => (
      (right.expiringCertificationCount + right.expiredCertificationCount + right.revokedCertificationCount)
      - (left.expiringCertificationCount + left.expiredCertificationCount + left.revokedCertificationCount)
      || (left.trainingTypeName ?? left.trainingTypeCode ?? '').localeCompare(right.trainingTypeName ?? right.trainingTypeCode ?? '')
    )),
    trainingHoursByAccount: sortTrainingHoursRollups(hoursByAccount),
    trainingHoursByTerritory: sortTrainingHoursRollups(hoursByTerritory),
    trainingHoursByTrainer: sortTrainingHoursRollups(hoursByTrainer),
    trainingHoursByTrainingType: sortTrainingHoursRollups(hoursByTrainingType),
    trainingHoursByState: sortTrainingHoursRollups(hoursByState),
    accountExportRows: sortTrainingComplianceAccountExportRows(accountExportRows),
  };
}

export async function listTrainingRecertificationQueue(
  actor: AuthenticatedActor,
  query: ListTrainingRecertificationQueueRequest = {},
): Promise<ListTrainingRecertificationQueueResponse> {
  assertModuleAccess(actor.role, 'training');

  const windowDays = query.windowDays && query.windowDays > 0 ? query.windowDays : 45;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 100;
  const accountScope = buildAccountRecordScope(actor);
  const ownerScope = resolveTrainingComplianceScope(actor, {
    ...(query.ownerTmUserId ? { ownerTmUserId: query.ownerTmUserId } : {}),
    ...(query.ownerRdUserId ? { ownerRdUserId: query.ownerRdUserId } : {}),
    certificationWindowDays: windowDays,
  });

  const accounts = await fetchCappedTrainingReportAccounts(
    {
      AND: [
        ...(accountScope ? [accountScope] : []),
        {
          isActive: true,
          ...(ownerScope.ownerTmUserId ? { assignedTmUserId: ownerScope.ownerTmUserId } : {}),
          ...(ownerScope.ownerRdUserId ? { assignedRdUserId: ownerScope.ownerRdUserId } : {}),
          trainingCertifications: { some: {} },
        },
      ],
    },
    'recertification-queue',
  );

  const expiringItems = accounts
    .flatMap((account) => buildExpiringTrainingCertificationQueueItems(account, windowDays));
  const expiredItems = accounts
    .flatMap(buildExpiredTrainingCertificationQueueItems);
  const items = [...expiredItems, ...expiringItems]
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry || compareQueueAccountNames(left.accountName, right.accountName))
    .slice(0, limit);

  return {
    items,
    summary: {
      windowDays,
      totalDueCount: expiringItems.length + expiredItems.length,
      expiringCount: expiringItems.length,
      expiredCount: expiredItems.length,
    },
  };
}

export async function getTrainingCoachingWorkload(
  actor: AuthenticatedActor,
): Promise<TrainingCoachingWorkloadResponse> {
  assertModuleAccess(actor.role, 'training');

  const accountScope = buildAccountRecordScope(actor);
  const accounts = await fetchCappedTrainingReportAccounts(
    {
      AND: [
        ...(accountScope ? [accountScope] : []),
        {
          isActive: true,
          OR: [
            { trainingPrograms: { some: {} } },
            { trainingSessions: { some: {} } },
            { trainingCertifications: { some: {} } },
          ],
        },
      ],
    },
    'coaching-workload',
  );

  const upcomingSessions = accounts
    .flatMap((account) => buildTrainingCoachingUpcomingSessions(account))
    .sort((left, right) => compareIsoDate(left.scheduledAt, right.scheduledAt) || compareQueueAccountNames(left.accountName, right.accountName));
  const overduePrograms = accounts
    .flatMap(buildOverdueTrainingProgramQueueItems)
    .sort((left, right) => right.daysOverdue - left.daysOverdue || compareQueueAccountNames(left.accountName, right.accountName));
  const openFollowUpTasks = accounts
    .flatMap((account) => buildTrainingCoachingFollowUpTasks(account))
    .sort((left, right) => compareIsoDate(left.dueAt, right.dueAt) || compareQueueAccountNames(left.accountName, right.accountName));
  const expiringCertifications = accounts
    .flatMap((account) => buildExpiringTrainingCertificationQueueItems(account, 45))
    .sort((left, right) => left.daysUntilExpiry - right.daysUntilExpiry || compareQueueAccountNames(left.accountName, right.accountName));

  return {
    summary: {
      upcomingSessionCount: upcomingSessions.length,
      overdueProgramCount: overduePrograms.length,
      openFollowUpTaskCount: openFollowUpTasks.length,
      expiringCertificationCount: expiringCertifications.length,
    },
    upcomingSessions: upcomingSessions.slice(0, 25),
    overduePrograms: overduePrograms.slice(0, 25),
    openFollowUpTasks: openFollowUpTasks.slice(0, 25),
    expiringCertifications: expiringCertifications.slice(0, 25),
  };
}

export async function getTerritoryTrainingPenetration(
  actor: AuthenticatedActor,
): Promise<TerritoryTrainingPenetrationResponse> {
  assertModuleAccess(actor.role, 'training');

  const accountScope = buildAccountRecordScope(actor);
  const accounts = await fetchCappedTrainingReportAccounts(
    {
      AND: [
        ...(accountScope ? [accountScope] : []),
        {
          isActive: true,
          territoryId: { not: null },
        },
      ],
    },
    'territory-penetration',
  );

  return buildTerritoryTrainingPenetrationResponse(accounts);
}

export async function createTrainingSession(
  actor: AuthenticatedActor,
  accountId: string,
  input: CreateTrainingSessionRequest,
  config?: AppConfig,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const account = await requireVisibleTrainingAccount(actor, accountId);

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
  const certificationOutcome = trainingType?.isCertificationTrack
    ? TrainingCertificationOutcome.PENDING_DECISION
    : TrainingCertificationOutcome.NOT_APPLICABLE;

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
        certificationOutcome,
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
          certificationOutcome: certificationOutcome.toLowerCase(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return session;
  });

  if (config) {
    await tryAutoSyncCalendarEventToOutlook(actor, config, {
      sourceModule: 'training',
      sourceRecordId: created.id,
      eventType: resolveTrainingCalendarEventType(created),
    });
  }

  return toTrainingSessionSummary(created);
}

export async function rescheduleTrainingSession(
  actor: AuthenticatedActor,
  sessionId: string,
  input: UpdateTrainingSessionScheduleRequest,
  config?: AppConfig,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await requireVisibleTrainingSession(actor, sessionId);
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

  if (config) {
    await tryAutoSyncCalendarEventToOutlook(actor, config, {
      sourceModule: 'training',
      sourceRecordId: updated.id,
      eventType: resolveTrainingCalendarEventType(updated),
    });
  }

  return toTrainingSessionSummary(updated);
}

export async function checkInTrainingSession(
  actor: AuthenticatedActor,
  sessionId: string,
  input: CheckInTrainingSessionRequest = {},
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await requireVisibleTrainingSession(actor, sessionId);
  if (session.status !== TrainingSessionStatus.SCHEDULED) {
    throw new Error('Only scheduled training sessions can be checked in');
  }
  if (session.checkedInAt) {
    return toTrainingSessionSummary(session);
  }

  const checkedInAt = input.checkedInAt ? parseIsoDate(input.checkedInAt, 'checkedInAt') : new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.trainingSession.update({
      where: { id: sessionId },
      data: {
        checkedInAt,
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
          checkedInAt: session.checkedInAt?.toISOString(),
        },
        afterData: {
          checkedInAt: checkedInAt.toISOString(),
        },
        metadata: {
          ...trainingAuditMetadata(actor),
          operation: 'check_in',
        },
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
  config?: AppConfig,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await requireVisibleTrainingSession(actor, sessionId);
  if (session.status !== TrainingSessionStatus.SCHEDULED) {
    throw new Error('Only scheduled training sessions can be completed');
  }

  const completedAt = input.completedAt ? parseIsoDate(input.completedAt, 'completedAt') : new Date();
  const checkedOutAt = input.checkedOutAt ? parseIsoDate(input.checkedOutAt, 'checkedOutAt') : completedAt;
  const checkoutNotes = input.checkoutNotes?.trim();
  if (!checkoutNotes) {
    throw new Error('checkoutNotes are required when completing a training session');
  }
  const checkedInAt = session.checkedInAt ?? session.scheduledAt ?? completedAt;
  if (checkedOutAt.getTime() < checkedInAt.getTime()) {
    throw new Error('checkedOutAt cannot be before check-in');
  }

  const proofAttachmentCount = Math.max(
    input.proofAttachmentCount ?? session.proofAttachmentCount,
    session.proofDocuments.length,
  );
  if (proofAttachmentCount < 0) {
    throw new Error('proofAttachmentCount cannot be negative');
  }

  const certificationOutcome = resolveTrainingCertificationOutcome(
    session,
    input.certificationOutcome,
  );

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic claim guarding the complete-session TOCTOU: only the first concurrent caller flips
    // SCHEDULED -> COMPLETED. A racing or retried call matches 0 rows and bails (below) BEFORE
    // advancing the program cadence or awarding a duplicate certification.
    const claimed = await tx.trainingSession.updateMany({
      where: { id: sessionId, status: TrainingSessionStatus.SCHEDULED },
      data: {
        status: TrainingSessionStatus.COMPLETED,
        checkedInAt,
        checkedOutAt,
        completedAt,
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.attendeeCount !== undefined ? { attendeeCount: input.attendeeCount } : {}),
        ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
        checkoutNotes,
        ...(input.proofNotes !== undefined ? { proofNotes: input.proofNotes.trim() || null } : {}),
        proofAttachmentCount,
        ...((input.proofNotes?.trim() || proofAttachmentCount > 0) ? { proofCapturedAt: checkedOutAt } : {}),
        certificationOutcome,
        ...(input.completionSummary?.trim() ? { completionSummary: input.completionSummary.trim() } : {}),
      },
    });
    if (claimed.count === 0) {
      throw new Error('Only scheduled training sessions can be completed');
    }

    // Engagement tracking: a completed training/visit is a tracked field engagement for the account.
    await markAccountEngaged(tx, session.accountId, completedAt);

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

    if (certificationOutcome === TrainingCertificationOutcome.AWARDED) {
      const certificationTitle = input.certificationTitle?.trim()
        || session.trainingType?.name
        || session.title;

      const certification = await tx.trainingCertificationRecord.create({
        data: {
          accountId: session.accountId,
          sessionId,
          ...(session.programId ? { programId: session.programId } : {}),
          ...(session.trainingTypeId ? { trainingTypeId: session.trainingTypeId } : {}),
          awardedByUserId: actor.userId,
          ...(input.certificationCode?.trim() ? { certificationCode: input.certificationCode.trim() } : {}),
          title: certificationTitle,
          status: TrainingCertificationStatus.ACTIVE,
          awardedAt: checkedOutAt,
          ...(input.certificationExpiresAt ? { expiresAt: parseIsoDate(input.certificationExpiresAt, 'certificationExpiresAt') } : {}),
          ...(input.certificationNotes?.trim() ? { notes: input.certificationNotes.trim() } : {}),
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: TRAINING_CERTIFICATION_ENTITY,
          entityId: certification.id,
          afterData: {
            accountId: session.accountId,
            sessionId,
            title: certification.title,
            status: certification.status.toLowerCase(),
          },
          metadata: trainingAuditMetadata(actor),
        }),
      });
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
          checkedInAt: checkedInAt.toISOString(),
          checkedOutAt: checkedOutAt.toISOString(),
          certificationOutcome: certificationOutcome.toLowerCase(),
        },
        metadata: trainingAuditMetadata(actor),
      }),
    });

    return tx.trainingSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: trainingSessionArgs.include,
    });
  });

  if (config) {
    await tryAutoUnsyncCalendarEventFromOutlook(
      actor,
      config,
      {
        sourceModule: 'training',
        sourceRecordId: updated.id,
        eventType: resolveTrainingCalendarEventType(updated),
      },
      'Training session completed in Pulse',
    );
  }

  return toTrainingSessionSummary(updated);
}

export async function uploadTrainingSessionProof(
  actor: AuthenticatedActor,
  config: AppConfig,
  sessionId: string,
  input: UploadTrainingSessionProofRequest,
): Promise<UploadTrainingSessionProofResponse> {
  assertActionAccess(actor.role, 'training.schedule');

  const sessionScope = buildTrainingSessionRecordScope(actor);
  const session = await prisma.trainingSession.findFirst({
    where: {
      AND: [
        ...(sessionScope ? [sessionScope] : []),
        { id: sessionId },
      ],
    },
    include: trainingSessionArgs.include,
  });
  if (!session) {
    throw new Error('Training session not found');
  }
  if (session.status === TrainingSessionStatus.CANCELLED || session.status === TrainingSessionStatus.NO_SHOW) {
    throw new Error('Proof cannot be uploaded to cancelled or no-show sessions');
  }

  const fileName = input.fileName?.trim();
  const mimeType = input.mimeType?.trim();
  if (!fileName) {
    throw new Error('fileName is required');
  }
  if (!mimeType) {
    throw new Error('mimeType is required');
  }
  if (!TRAINING_PROOF_ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    throw new Error('Unsupported training proof file type');
  }

  const estimatedSizeBytes = estimateBase64DecodedSize(input.contentBase64);
  if (estimatedSizeBytes > TRAINING_PROOF_MAX_BYTES) {
    throw new Error('Training proof file cannot exceed 4 MB');
  }

  const documentType = toTrainingProofDocumentType(input.documentType ?? 'proof_attachment');
  const storageKey = buildTrainingProofStorageKey(sessionId, fileName);
  const stored = await storeBase64Document(config, {
    storageKey,
    contentBase64: input.contentBase64,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const document = await tx.trainingProofDocument.create({
      data: {
        sessionId,
        documentType,
        storageKey,
        fileName,
        mimeType,
        sizeBytes: stored.sizeBytes,
        uploadedByUserId: actor.userId,
        sha256: stored.sha256,
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    const nextSession = await tx.trainingSession.update({
      where: { id: sessionId },
      data: {
        proofAttachmentCount: {
          increment: 1,
        },
        proofCapturedAt: new Date(),
      },
      include: trainingSessionArgs.include,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.CREATE,
        entityType: TRAINING_PROOF_DOCUMENT_ENTITY,
        entityId: document.id,
        afterData: {
          sessionId,
          documentType: toTrainingProofDocumentTypeKey(document.documentType),
          fileName: document.fileName,
          mimeType: document.mimeType,
          storageKey: document.storageKey,
          sizeBytes: document.sizeBytes,
        },
        metadata: {
          ...trainingAuditMetadata(actor),
          operation: 'upload_proof',
        },
      }),
    });

    return {
      session: nextSession,
      document,
    };
  });

  return {
    session: toTrainingSessionSummary(updated.session),
    document: toTrainingProofDocumentSummary(updated.document),
  };
}

export async function reviewTrainingSessionProof(
  actor: AuthenticatedActor,
  documentId: string,
  input: ReviewTrainingSessionProofRequest,
): Promise<ReviewTrainingSessionProofResponse> {
  assertActionAccess(actor.role, 'training.schedule');

  const normalizedDocumentId = documentId?.trim();
  if (!normalizedDocumentId) {
    throw new Error('Training proof document id is required');
  }

  const reviewStatus = toTrainingProofReviewStatus(input.reviewStatus);
  const reviewNotes = input.reviewNotes?.trim();
  const sessionScope = buildTrainingSessionRecordScope(actor);
  const proofDocument = await prisma.trainingProofDocument.findFirst({
    where: {
      id: normalizedDocumentId,
      ...(sessionScope ? { session: sessionScope } : {}),
    },
    include: {
      session: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!proofDocument) {
    throw new Error('Training proof document not found');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const document = await tx.trainingProofDocument.update({
      where: { id: normalizedDocumentId },
      data: {
        reviewStatus,
        reviewedByUserId: actor.userId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
      },
      include: {
        uploadedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    const session = await tx.trainingSession.findUniqueOrThrow({
      where: { id: proofDocument.session.id },
      include: trainingSessionArgs.include,
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_PROOF_DOCUMENT_ENTITY,
        entityId: document.id,
        beforeData: {
          reviewStatus: toTrainingProofReviewStatusKey(proofDocument.reviewStatus),
          reviewedByUserId: proofDocument.reviewedByUserId,
          reviewedAt: proofDocument.reviewedAt?.toISOString(),
          reviewNotes: proofDocument.reviewNotes,
        },
        afterData: {
          reviewStatus: toTrainingProofReviewStatusKey(document.reviewStatus),
          reviewedByUserId: document.reviewedByUserId,
          reviewedAt: document.reviewedAt?.toISOString(),
          reviewNotes: document.reviewNotes,
        },
        metadata: {
          ...trainingAuditMetadata(actor),
          operation: 'review_proof',
          sessionId: proofDocument.session.id,
        },
      }),
    });

    return {
      session,
      document,
    };
  });

  return {
    session: toTrainingSessionSummary(updated.session),
    document: toTrainingProofDocumentSummary(updated.document),
  };
}

export async function downloadTrainingSessionProof(
  actor: AuthenticatedActor,
  config: AppConfig,
  documentId: string,
): Promise<DownloadTrainingSessionProofResponse> {
  assertActionAccess(actor.role, 'training.schedule');

  const normalizedDocumentId = documentId?.trim();
  if (!normalizedDocumentId) {
    throw new Error('Training proof document id is required');
  }

  const sessionScope = buildTrainingSessionRecordScope(actor);
  const document = await prisma.trainingProofDocument.findFirst({
    where: {
      id: normalizedDocumentId,
      ...(sessionScope ? { session: sessionScope } : {}),
    },
    include: {
      uploadedByUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
      reviewedByUser: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  });
  if (!document) {
    throw new Error('Training proof document not found');
  }

  const stored = await readStoredDocument(config, document.storageKey);
  if (document.sha256 && stored.sha256 !== document.sha256) {
    throw new Error('Training proof document checksum mismatch');
  }

  await prisma.auditEntry.create({
    data: buildAuditEntryData({
      actorUserId: actor.userId,
      action: AuditAction.EXPORT,
      entityType: TRAINING_PROOF_DOCUMENT_ENTITY,
      entityId: document.id,
      afterData: {
        sessionId: document.sessionId,
        fileName: document.fileName,
        mimeType: document.mimeType,
        storageKey: document.storageKey,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
      },
      metadata: {
        ...trainingAuditMetadata(actor),
        operation: 'download_proof',
      },
    }),
  });

  return {
    document: toTrainingProofDocumentSummary(document),
    contentBase64: stored.contentBase64,
    sizeBytes: stored.sizeBytes,
    sha256: stored.sha256,
  };
}

export async function resolveTrainingCertificationDecision(
  actor: AuthenticatedActor,
  sessionId: string,
  input: ResolveTrainingCertificationDecisionRequest,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await requireVisibleTrainingSession(actor, sessionId);
  if (session.status !== TrainingSessionStatus.COMPLETED) {
    throw new Error('Only completed training sessions can resolve certification decisions');
  }
  if (!(session.trainingType?.isCertificationTrack)) {
    throw new Error('Certification decisions can only be resolved for certification-track sessions');
  }
  if (session.certificationOutcome !== TrainingCertificationOutcome.PENDING_DECISION) {
    throw new Error('Only pending certification decisions can be resolved');
  }

  const normalizedOutcome = input.certificationOutcome.trim().toLowerCase();
  if (normalizedOutcome !== 'awarded' && normalizedOutcome !== 'not_awarded') {
    throw new Error('certificationOutcome must be awarded or not_awarded');
  }

  const certificationOutcome = normalizedOutcome === 'awarded'
    ? TrainingCertificationOutcome.AWARDED
    : TrainingCertificationOutcome.NOT_AWARDED;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.trainingSession.update({
      where: { id: sessionId },
      data: {
        certificationOutcome,
      },
    });

    let certification: { id: string } | null = null;
    if (certificationOutcome === TrainingCertificationOutcome.AWARDED) {
      certification = await tx.trainingCertificationRecord.create({
        data: {
          accountId: session.accountId,
          sessionId,
          ...(session.programId ? { programId: session.programId } : {}),
          ...(session.trainingTypeId ? { trainingTypeId: session.trainingTypeId } : {}),
          awardedByUserId: actor.userId,
          ...(input.certificationCode?.trim() ? { certificationCode: input.certificationCode.trim() } : {}),
          title: input.certificationTitle?.trim() || session.trainingType?.name || session.title,
          status: TrainingCertificationStatus.ACTIVE,
          awardedAt: session.checkedOutAt ?? session.completedAt ?? new Date(),
          ...(input.certificationExpiresAt
            ? { expiresAt: parseIsoDate(input.certificationExpiresAt, 'certificationExpiresAt') }
            : {}),
          ...(input.certificationNotes?.trim() ? { notes: input.certificationNotes.trim() } : {}),
        },
      });

      await tx.auditEntry.create({
        data: buildAuditEntryData({
          actorUserId: actor.userId,
          action: AuditAction.CREATE,
          entityType: TRAINING_CERTIFICATION_ENTITY,
          entityId: certification.id,
          afterData: {
            accountId: session.accountId,
            sessionId,
            status: TrainingCertificationStatus.ACTIVE.toLowerCase(),
            outcome: certificationOutcome.toLowerCase(),
          },
          metadata: {
            ...trainingAuditMetadata(actor),
            operation: 'resolve_certification_decision',
          },
        }),
      });
    }

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_SESSION_ENTITY,
        entityId: sessionId,
        beforeData: {
          certificationOutcome: session.certificationOutcome.toLowerCase(),
        },
        afterData: {
          certificationOutcome: certificationOutcome.toLowerCase(),
        },
        metadata: {
          ...trainingAuditMetadata(actor),
          operation: 'resolve_certification_decision',
        },
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
  config?: AppConfig,
): Promise<TrainingSessionSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await requireVisibleTrainingSession(actor, sessionId);
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

  if (config) {
    await tryAutoUnsyncCalendarEventFromOutlook(
      actor,
      config,
      {
        sourceModule: 'training',
        sourceRecordId: updated.id,
        eventType: resolveTrainingCalendarEventType(updated),
      },
      `Training session marked ${updated.status.toLowerCase()} in Pulse`,
    );
  }

  return toTrainingSessionSummary(updated);
}

export async function createTrainingFollowUpTask(
  actor: AuthenticatedActor,
  sessionId: string,
  input: CreateTrainingFollowUpTaskRequest,
): Promise<TrainingFollowUpTaskSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const session = await requireVisibleTrainingSession(actor, sessionId);

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

  const task = await requireVisibleTrainingFollowUpTask(actor, taskId);
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

export async function revokeTrainingCertification(
  actor: AuthenticatedActor,
  certificationId: string,
  input: RevokeTrainingCertificationRequest = {},
): Promise<TrainingCertificationSummary> {
  assertActionAccess(actor.role, 'training.schedule');

  const certification = await requireVisibleTrainingCertification(actor, certificationId);

  if (certification.status === TrainingCertificationStatus.REVOKED) {
    return toTrainingCertificationSummary(certification);
  }

  const nextNotes = buildTrainingCertificationLifecycleNotes(
    certification.notes,
    'Revoked',
    input.notes,
    actor.displayName ?? actor.email ?? actor.userId,
  );

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.trainingCertificationRecord.update({
      where: { id: certificationId },
      data: {
        status: TrainingCertificationStatus.REVOKED,
        ...(nextNotes ? { notes: nextNotes } : {}),
      },
      include: {
        trainingType: true,
        awardedByUser: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    await tx.auditEntry.create({
      data: buildAuditEntryData({
        actorUserId: actor.userId,
        action: AuditAction.UPDATE,
        entityType: TRAINING_CERTIFICATION_ENTITY,
        entityId: certificationId,
        beforeData: {
          status: certification.status.toLowerCase(),
          notes: certification.notes,
        },
        afterData: {
          status: TrainingCertificationStatus.REVOKED.toLowerCase(),
          notes: next.notes,
        },
        metadata: {
          ...trainingAuditMetadata(actor),
          operation: 'revoke_certification',
        },
      }),
    });

    return next;
  });

  return toTrainingCertificationSummary(updated);
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
  const sessionSummaries = account.trainingSessions.map(toTrainingSessionSummary);
  const recentSessions = sessionSummaries.slice(0, 12);
  return {
    ...summary,
    programs: account.trainingPrograms.map(toAccountTrainingProgramSummary),
    recentSessions,
    openFollowUpTasks: account.trainingSessions
      .flatMap((session) => session.followUpTasks)
      .filter((task) => task.status === TrainingFollowUpTaskStatus.OPEN)
      .map(toTrainingFollowUpTaskSummary)
      .slice(0, 12),
    certifications: account.trainingCertifications.map(toTrainingCertificationSummary),
    executionExceptions: buildTrainingExecutionExceptions(sessionSummaries),
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
    executionState: toTrainingExecutionStateKey(session),
    certificationOutcome: toTrainingCertificationOutcomeKey(session.certificationOutcome),
    isCertificationTrack: session.trainingType?.isCertificationTrack ?? false,
    title: session.title,
    ...(session.scheduledAt ? { scheduledAt: session.scheduledAt.toISOString() } : {}),
    ...(session.checkedInAt ? { checkedInAt: session.checkedInAt.toISOString() } : {}),
    ...(session.checkedOutAt ? { checkedOutAt: session.checkedOutAt.toISOString() } : {}),
    ...(session.completedAt ? { completedAt: session.completedAt.toISOString() } : {}),
    durationMinutes: session.durationMinutes,
    attendeeCount: session.attendeeCount,
    ...(session.notes ? { notes: session.notes } : {}),
    ...(session.checkoutNotes ? { checkoutNotes: session.checkoutNotes } : {}),
    ...(session.proofNotes ? { proofNotes: session.proofNotes } : {}),
    proofAttachmentCount: session.proofAttachmentCount,
    ...(session.proofCapturedAt ? { proofCapturedAt: session.proofCapturedAt.toISOString() } : {}),
    proofDocuments: session.proofDocuments.map(toTrainingProofDocumentSummary),
    ...(session.completionSummary ? { completionSummary: session.completionSummary } : {}),
    isOverdue: session.status === TrainingSessionStatus.SCHEDULED && Boolean(session.scheduledAt && session.scheduledAt.getTime() < Date.now()),
    countsTowardHours: session.trainingType?.countsTowardHours ?? false,
    openFollowUpTaskCount,
    followUpTasks: session.followUpTasks.map(toTrainingFollowUpTaskSummary),
    fieldActivity: session.mobileVoiceNotes.map(toTrainingFieldActivitySummary),
    certifications: session.certifications.map(toTrainingCertificationSummary),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function toTrainingFieldActivitySummary(note: TrainingFieldActivityRecord): TrainingFieldActivityNoteSummary {
  return {
    id: note.id,
    title: note.title,
    ...(note.structuredSummary ? { summary: note.structuredSummary } : {}),
    ...(note.structuredNextStep ? { nextStep: note.structuredNextStep } : {}),
    ...(note.structuredSentiment ? { sentiment: note.structuredSentiment } : {}),
    ...(note.createdBy?.displayName ? { capturedByName: note.createdBy.displayName } : {}),
    ...(note.reviewedBy?.displayName ? { reviewedByName: note.reviewedBy.displayName } : {}),
    recordedAt: note.recordedAt.toISOString(),
    ...(note.reviewedAt ? { reviewedAt: note.reviewedAt.toISOString() } : {}),
    ...(note.writebackTarget ? { writebackTarget: note.writebackTarget } : {}),
  };
}

function toTrainingCertificationSummary(
  certification: TrainingCertificationRecord,
): TrainingCertificationSummary {
  return {
    id: certification.id,
    accountId: certification.accountId,
    ...(certification.sessionId ? { sessionId: certification.sessionId } : {}),
    ...(certification.programId ? { programId: certification.programId } : {}),
    ...(certification.trainingTypeId ? { trainingTypeId: certification.trainingTypeId } : {}),
    ...(certification.trainingType?.code ? { trainingTypeCode: certification.trainingType.code } : {}),
    ...(certification.trainingType?.name ? { trainingTypeName: certification.trainingType.name } : {}),
    ...(certification.certificationCode ? { certificationCode: certification.certificationCode } : {}),
    title: certification.title,
    status: toTrainingCertificationStatusKey(certification.status),
    awardedAt: certification.awardedAt.toISOString(),
    ...(certification.expiresAt ? { expiresAt: certification.expiresAt.toISOString() } : {}),
    ...(certification.awardedByUserId ? { awardedByUserId: certification.awardedByUserId } : {}),
    ...(certification.awardedByUser?.displayName ? { awardedByName: certification.awardedByUser.displayName } : {}),
    ...(certification.notes ? { notes: certification.notes } : {}),
    createdAt: certification.createdAt.toISOString(),
    updatedAt: certification.updatedAt.toISOString(),
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

function toTrainingProofDocumentSummary(
  document: TrainingProofDocumentRecord,
): TrainingProofDocumentSummary {
  return {
    id: document.id,
    sessionId: document.sessionId,
    documentType: toTrainingProofDocumentTypeKey(document.documentType),
    storageKey: document.storageKey,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    ...(document.uploadedByUserId ? { uploadedByUserId: document.uploadedByUserId } : {}),
    ...(document.uploadedByUser?.displayName ? { uploadedByName: document.uploadedByUser.displayName } : {}),
    uploadedAt: document.uploadedAt.toISOString(),
    ...(document.sha256 ? { sha256: document.sha256 } : {}),
    reviewStatus: toTrainingProofReviewStatusKey(document.reviewStatus),
    ...(document.reviewedByUserId ? { reviewedByUserId: document.reviewedByUserId } : {}),
    ...(document.reviewedByUser?.displayName ? { reviewedByName: document.reviewedByUser.displayName } : {}),
    ...(document.reviewedAt ? { reviewedAt: document.reviewedAt.toISOString() } : {}),
    ...(document.reviewNotes ? { reviewNotes: document.reviewNotes } : {}),
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
  if (status === 'checked_in') {
    return item.executionState === 'checked_in';
  }
  if (status === 'overdue') {
    return item.isOverdue;
  }
  if (status === 'exceptions') {
    return hasTrainingExecutionException(item);
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

function toTrainingProofDocumentType(input: TrainingProofDocumentTypeKey) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingProofDocumentType, value)) {
    throw new Error(`Unsupported training proof document type: ${input}`);
  }

  return value as TrainingProofDocumentType;
}

function toTrainingProofDocumentTypeKey(input: TrainingProofDocumentType) {
  return input.toLowerCase() as TrainingProofDocumentTypeKey;
}

function toTrainingProofReviewStatus(input: ReviewTrainingSessionProofRequest['reviewStatus']) {
  const value = input.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingProofReviewStatus, value)) {
    throw new Error(`Unsupported training proof review status: ${input}`);
  }

  return value as TrainingProofReviewStatus;
}

function toTrainingProofReviewStatusKey(input: TrainingProofReviewStatus) {
  return input.toLowerCase() as TrainingProofDocumentSummary['reviewStatus'];
}

function toAccountTrainingProgramStatusKey(input: AccountTrainingProgramStatus) {
  return input.toLowerCase() as AccountTrainingProgramSummary['status'];
}

function toTrainingSessionStatusKey(input: TrainingSessionStatus) {
  return input.toLowerCase() as TrainingSessionSummary['status'];
}

function toTrainingExecutionStateKey(session: Pick<TrainingSessionRecord, 'status' | 'checkedInAt'>): TrainingExecutionStateKey {
  if (session.status === TrainingSessionStatus.SCHEDULED && session.checkedInAt) {
    return 'checked_in';
  }

  return session.status.toLowerCase() as TrainingExecutionStateKey;
}

function toTrainingCertificationOutcomeKey(input: TrainingCertificationOutcome): TrainingCertificationOutcomeKey {
  return input.toLowerCase() as TrainingCertificationOutcomeKey;
}

function toTrainingCertificationStatusKey(input: TrainingCertificationStatus): TrainingCertificationStatusKey {
  return input.toLowerCase() as TrainingCertificationStatusKey;
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

function resolveTrainingCertificationOutcome(
  session: TrainingSessionRecord,
  requestedOutcome?: TrainingCertificationOutcomeKey,
) {
  const isCertificationTrack = session.trainingType?.isCertificationTrack ?? false;

  if (!isCertificationTrack) {
    if (requestedOutcome && requestedOutcome !== 'not_applicable') {
      throw new Error('Certification outcomes can only be recorded for certification-track sessions');
    }
    return TrainingCertificationOutcome.NOT_APPLICABLE;
  }

  if (!requestedOutcome) {
    return TrainingCertificationOutcome.PENDING_DECISION;
  }

  const normalized = requestedOutcome.trim().toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(TrainingCertificationOutcome, normalized)) {
    throw new Error(`Unsupported training certification outcome: ${requestedOutcome}`);
  }

  const outcome = normalized as TrainingCertificationOutcome;
  if (session.activityKind !== TrainingActivityKind.TRAINING && outcome === TrainingCertificationOutcome.AWARDED) {
    throw new Error('Site visits cannot award certifications');
  }
  if (outcome === TrainingCertificationOutcome.NOT_APPLICABLE) {
    return TrainingCertificationOutcome.PENDING_DECISION;
  }

  return outcome;
}

function buildTrainingExecutionExceptions(items: TrainingSessionSummary[]): TrainingExecutionExceptionSummary[] {
  return items.flatMap((item) => {
    const exceptions: TrainingExecutionExceptionSummary[] = [];
    const requiresProof = item.certificationOutcome === 'awarded';

    if (item.isOverdue) {
      exceptions.push({
        type: 'session_overdue',
        severity: 'high',
        sessionId: item.id,
        accountId: item.accountId,
        ...(item.accountName ? { accountName: item.accountName } : {}),
        title: item.title,
        detail: 'Scheduled training session is overdue and still incomplete.',
        ...(item.scheduledAt ? { scheduledAt: item.scheduledAt } : {}),
        ...(item.trainingTypeCode ? { trainingTypeCode: item.trainingTypeCode } : {}),
      });
    }

    if (item.status === 'completed' && requiresProof && item.proofAttachmentCount === 0 && !item.proofNotes?.trim()) {
      exceptions.push({
        type: 'proof_missing',
        severity: 'medium',
        sessionId: item.id,
        accountId: item.accountId,
        ...(item.accountName ? { accountName: item.accountName } : {}),
        title: item.title,
        detail: 'Certification completion is missing proof metadata or proof notes.',
        ...(item.scheduledAt ? { scheduledAt: item.scheduledAt } : {}),
        ...(item.trainingTypeCode ? { trainingTypeCode: item.trainingTypeCode } : {}),
      });
    }

    if (item.status === 'completed' && item.proofDocuments.some((document) => document.reviewStatus === 'rejected')) {
      exceptions.push({
        type: 'proof_rejected',
        severity: 'medium',
        sessionId: item.id,
        accountId: item.accountId,
        ...(item.accountName ? { accountName: item.accountName } : {}),
        title: item.title,
        detail: 'Training proof was rejected and needs corrected evidence before closure.',
        ...(item.scheduledAt ? { scheduledAt: item.scheduledAt } : {}),
        ...(item.trainingTypeCode ? { trainingTypeCode: item.trainingTypeCode } : {}),
      });
    }

    if (item.status === 'completed' && item.certificationOutcome === 'pending_decision') {
      exceptions.push({
        type: 'certification_decision_pending',
        severity: 'medium',
        sessionId: item.id,
        accountId: item.accountId,
        ...(item.accountName ? { accountName: item.accountName } : {}),
        title: item.title,
        detail: 'Certification-track session was completed without a final certification decision.',
        ...(item.scheduledAt ? { scheduledAt: item.scheduledAt } : {}),
        ...(item.trainingTypeCode ? { trainingTypeCode: item.trainingTypeCode } : {}),
      });
    }

    return exceptions;
  });
}

function resolveTrainingComplianceScope(
  actor: AuthenticatedActor,
  query: ListTrainingComplianceReportRequest,
) {
  const certificationWindowDays = query.certificationWindowDays && query.certificationWindowDays > 0
    ? query.certificationWindowDays
    : 45;

  if (actor.role === 'TERRITORY_MANAGER') {
    return {
      ownerTmUserId: actor.userId,
      ownerRdUserId: undefined,
      certificationWindowDays,
    };
  }

  if (actor.role === 'REGIONAL_DIRECTOR') {
    return {
      ownerTmUserId: undefined,
      ownerRdUserId: actor.userId,
      certificationWindowDays,
    };
  }

  return {
    ownerTmUserId: query.ownerTmUserId?.trim() || undefined,
    ownerRdUserId: query.ownerRdUserId?.trim() || undefined,
    certificationWindowDays,
  };
}

function resolveTrainingOperationalQueueScope(
  actor: AuthenticatedActor,
  query: ListTrainingOperationalQueueRequest,
) {
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 100;
  const scope = resolveTrainingComplianceScope(actor, query);

  return {
    ...scope,
    limit,
  };
}

function buildTrainingComplianceAccountMetrics(
  account: TrainingAccountRecord,
  certificationWindowDays: number,
) {
  const sessionSummaries = account.trainingSessions.map(toTrainingSessionSummary);
  const unresolvedExecutionExceptions = buildTrainingExecutionExceptions(sessionSummaries);
  const activePrograms = account.trainingPrograms.filter((entry) => isProgramActive(entry.status));
  const overduePrograms = account.trainingPrograms.filter((entry) => isProgramOverdue(entry.status, entry.nextDueAt));
  const qualifyingSessions = account.trainingSessions.filter((entry) => (
    entry.status === TrainingSessionStatus.COMPLETED
    && entry.activityKind === TrainingActivityKind.TRAINING
    && entry.trainingType?.countsTowardHours
  ));

  const activeCertificationCount = account.trainingCertifications.filter((entry) => isTrainingCertificationActive(entry)).length;
  const expiringCertificationCount = account.trainingCertifications.filter((entry) => (
    isTrainingCertificationActive(entry) && isTrainingCertificationExpiringWithin(entry, certificationWindowDays)
  )).length;
  const expiredCertificationCount = account.trainingCertifications.filter((entry) => isTrainingCertificationExpired(entry)).length;
  const revokedCertificationCount = account.trainingCertifications.filter((entry) => isTrainingCertificationRevoked(entry)).length;

  return {
    hasActivePrograms: activePrograms.length > 0,
    activeProgramCount: activePrograms.length,
    activeCertificationCount,
    expiringCertificationCount,
    expiredCertificationCount,
    revokedCertificationCount,
    overdueProgramCount: overduePrograms.length,
    unresolvedExecutionExceptionCount: unresolvedExecutionExceptions.length,
    pendingCertificationDecisionCount: unresolvedExecutionExceptions.filter((entry) => entry.type === 'certification_decision_pending').length,
    deliveredTrainingHours: roundHours(
      qualifyingSessions.reduce((sum, entry) => sum + (entry.durationMinutes / 60), 0),
    ),
    completedTrainingSessionCount: qualifyingSessions.length,
    proofDocumentCount: account.trainingSessions.reduce((sum, entry) => sum + entry.proofDocuments.length, 0),
    certificationProofMissingCount: unresolvedExecutionExceptions.filter((entry) => entry.type === 'proof_missing').length,
    lastTrainingAt: getLatestCompletedTrainingAt(qualifyingSessions),
    nextDueAt: getNextTrainingProgramDueAt(activePrograms),
  };
}

function buildTrainingComplianceAccountExportRow(
  account: TrainingAccountRecord,
  metrics: ReturnType<typeof buildTrainingComplianceAccountMetrics>,
): TrainingComplianceAccountExportRow {
  return {
    accountId: account.id,
    accountName: account.displayName,
    ...(account.businessSegment?.code ? { businessSegmentCode: account.businessSegment.code } : {}),
    ...(account.territoryId ? { territoryId: account.territoryId } : {}),
    ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
    ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
    ...(account.assignedTmUserId ? { ownerTmUserId: account.assignedTmUserId } : {}),
    ...(account.assignedTmUser?.displayName ? { ownerTmName: account.assignedTmUser.displayName } : {}),
    ...(account.assignedRdUserId ? { ownerRdUserId: account.assignedRdUserId } : {}),
    ...(account.assignedRdUser?.displayName ? { ownerRdName: account.assignedRdUser.displayName } : {}),
    activeProgramCount: metrics.activeProgramCount,
    overdueProgramCount: metrics.overdueProgramCount,
    activeCertificationCount: metrics.activeCertificationCount,
    expiringCertificationCount: metrics.expiringCertificationCount,
    expiredCertificationCount: metrics.expiredCertificationCount,
    revokedCertificationCount: metrics.revokedCertificationCount,
    pendingCertificationDecisionCount: metrics.pendingCertificationDecisionCount,
    unresolvedExecutionExceptionCount: metrics.unresolvedExecutionExceptionCount,
    completedTrainingSessionCount: metrics.completedTrainingSessionCount,
    deliveredTrainingHours: metrics.deliveredTrainingHours,
    proofDocumentCount: metrics.proofDocumentCount,
    certificationProofMissingCount: metrics.certificationProofMissingCount,
    ...(metrics.lastTrainingAt ? { lastTrainingAt: metrics.lastTrainingAt.toISOString() } : {}),
    ...(metrics.nextDueAt ? { nextDueAt: metrics.nextDueAt.toISOString() } : {}),
    riskLevel: resolveTrainingComplianceAccountRiskLevel(metrics),
  };
}

function resolveTrainingComplianceAccountRiskLevel(
  metrics: ReturnType<typeof buildTrainingComplianceAccountMetrics>,
): TrainingComplianceAccountExportRow['riskLevel'] {
  if (
    metrics.expiredCertificationCount > 0
    || metrics.revokedCertificationCount > 0
    || metrics.overdueProgramCount > 0
    || metrics.certificationProofMissingCount > 0
  ) {
    return 'critical';
  }

  if (
    metrics.expiringCertificationCount > 0
    || metrics.pendingCertificationDecisionCount > 0
    || metrics.unresolvedExecutionExceptionCount > 0
  ) {
    return 'attention';
  }

  return 'healthy';
}

function sortTrainingComplianceAccountExportRows(rows: TrainingComplianceAccountExportRow[]) {
  const riskRank: Record<TrainingComplianceAccountExportRow['riskLevel'], number> = {
    critical: 3,
    attention: 2,
    healthy: 1,
  };

  return rows.sort((left, right) => (
    riskRank[right.riskLevel] - riskRank[left.riskLevel]
    || right.unresolvedExecutionExceptionCount - left.unresolvedExecutionExceptionCount
    || right.overdueProgramCount - left.overdueProgramCount
    || left.accountName.localeCompare(right.accountName)
  ));
}

function getLatestCompletedTrainingAt(sessions: TrainingSessionRecord[]) {
  return sessions.reduce<Date | undefined>((latest, session) => {
    const completedAt = session.completedAt ?? session.checkedOutAt ?? session.scheduledAt;
    if (!completedAt) {
      return latest;
    }
    if (!latest || completedAt.getTime() > latest.getTime()) {
      return completedAt;
    }
    return latest;
  }, undefined);
}

function getNextTrainingProgramDueAt(programs: TrainingProgramRecord[]) {
  return programs.reduce<Date | undefined>((next, program) => {
    if (!program.nextDueAt) {
      return next;
    }
    if (!next || program.nextDueAt.getTime() < next.getTime()) {
      return program.nextDueAt;
    }
    return next;
  }, undefined);
}

function accumulateTrainingHoursRollups(input: {
  account: TrainingAccountRecord;
  hoursByAccount: Map<string, TrainingComplianceHoursRollup>;
  hoursByTerritory: Map<string, TrainingComplianceHoursRollup>;
  hoursByTrainer: Map<string, TrainingComplianceHoursRollup>;
  hoursByTrainingType: Map<string, TrainingComplianceHoursRollup>;
  hoursByState: Map<string, TrainingComplianceHoursRollup>;
}) {
  const qualifyingSessions = input.account.trainingSessions.filter((entry) => (
    entry.status === TrainingSessionStatus.COMPLETED
    && entry.activityKind === TrainingActivityKind.TRAINING
    && entry.trainingType?.countsTowardHours
  ));

  for (const session of qualifyingSessions) {
    const hours = session.durationMinutes / 60;
    incrementTrainingHoursRollup(input.hoursByAccount, input.account.id, input.account.displayName, hours, {
      accountId: input.account.id,
      accountName: input.account.displayName,
    });

    const territoryKey = input.account.territoryId ?? 'unassigned';
    incrementTrainingHoursRollup(
      input.hoursByTerritory,
      territoryKey,
      input.account.territory?.name ?? 'Unassigned territory',
      hours,
      {
        ...(input.account.territoryId ? { territoryId: input.account.territoryId } : {}),
        ...(input.account.territory?.name ? { territoryName: input.account.territory.name } : {}),
      },
    );

    const trainerKey = session.trainerUserId ?? 'unassigned';
    incrementTrainingHoursRollup(
      input.hoursByTrainer,
      trainerKey,
      session.trainerUser?.displayName ?? 'Unassigned trainer',
      hours,
      {
        ...(session.trainerUserId ? { trainerUserId: session.trainerUserId } : {}),
        ...(session.trainerUser?.displayName ? { trainerName: session.trainerUser.displayName } : {}),
      },
    );

    const trainingTypeKey = session.trainingTypeId ?? 'unknown';
    incrementTrainingHoursRollup(
      input.hoursByTrainingType,
      trainingTypeKey,
      session.trainingType?.name ?? 'Unknown training type',
      hours,
      {
        ...(session.trainingTypeId ? { trainingTypeId: session.trainingTypeId } : {}),
        ...(session.trainingType?.code ? { trainingTypeCode: session.trainingType.code } : {}),
        ...(session.trainingType?.name ? { trainingTypeName: session.trainingType.name } : {}),
      },
    );

    const state = session.location?.state?.trim() || 'unknown';
    incrementTrainingHoursRollup(input.hoursByState, state, state === 'unknown' ? 'Unknown state' : state, hours, {
      ...(state !== 'unknown' ? { state } : {}),
    });
  }
}

function incrementTrainingHoursRollup(
  map: Map<string, TrainingComplianceHoursRollup>,
  key: string,
  label: string,
  hours: number,
  extra: Partial<TrainingComplianceHoursRollup>,
) {
  const current = map.get(key) ?? {
    key,
    label,
    completedSessionCount: 0,
    deliveredTrainingHours: 0,
    ...extra,
  };
  current.completedSessionCount += 1;
  current.deliveredTrainingHours = roundHours(current.deliveredTrainingHours + hours);
  map.set(key, current);
}

function sortTrainingHoursRollups(map: Map<string, TrainingComplianceHoursRollup>) {
  return Array.from(map.values()).sort((left, right) => (
    right.deliveredTrainingHours - left.deliveredTrainingHours
    || right.completedSessionCount - left.completedSessionCount
    || left.label.localeCompare(right.label)
  ));
}

function accumulateTrainingComplianceOwnerRollup(
  map: Map<string, TrainingComplianceOwnerRollup>,
  ownerUserId: string,
  ownerName: string,
  roleCode: TrainingComplianceOwnerRollup['roleCode'],
  metrics: ReturnType<typeof buildTrainingComplianceAccountMetrics>,
) {
  const current = map.get(ownerUserId) ?? {
    ownerUserId,
    ownerName,
    roleCode,
    accountCount: 0,
    activeCertificationCount: 0,
    expiringCertificationCount: 0,
    expiredCertificationCount: 0,
    revokedCertificationCount: 0,
    overdueProgramCount: 0,
    unresolvedExecutionExceptionCount: 0,
    pendingCertificationDecisionCount: 0,
    deliveredTrainingHours: 0,
  };

  current.accountCount += 1;
  current.activeCertificationCount += metrics.activeCertificationCount;
  current.expiringCertificationCount += metrics.expiringCertificationCount;
  current.expiredCertificationCount += metrics.expiredCertificationCount;
  current.revokedCertificationCount += metrics.revokedCertificationCount;
  current.unresolvedExecutionExceptionCount += metrics.unresolvedExecutionExceptionCount;
  current.pendingCertificationDecisionCount += metrics.pendingCertificationDecisionCount;
  current.deliveredTrainingHours = roundHours(current.deliveredTrainingHours + metrics.deliveredTrainingHours);

  map.set(ownerUserId, current);
}

function incrementTrainingOwnerOverdueProgram(
  map: Map<string, TrainingComplianceOwnerRollup>,
  ownerUserId: string,
  ownerName: string,
  roleCode: TrainingComplianceOwnerRollup['roleCode'],
) {
  const current = map.get(ownerUserId) ?? {
    ownerUserId,
    ownerName,
    roleCode,
    accountCount: 0,
    activeCertificationCount: 0,
    expiringCertificationCount: 0,
    expiredCertificationCount: 0,
    revokedCertificationCount: 0,
    overdueProgramCount: 0,
    unresolvedExecutionExceptionCount: 0,
    pendingCertificationDecisionCount: 0,
    deliveredTrainingHours: 0,
  };

  current.overdueProgramCount += 1;
  map.set(ownerUserId, current);
}

function buildExpiringTrainingCertificationQueueItems(
  account: TrainingAccountRecord,
  certificationWindowDays: number,
): TrainingOperationalCertificationQueueItem[] {
  const now = Date.now();
  const windowEnd = now + certificationWindowDays * 24 * 60 * 60 * 1000;

  return account.trainingCertifications
    .filter((certification) => {
      if (!certification.expiresAt) {
        return false;
      }

      const expiresAt = certification.expiresAt.getTime();
      return certification.status === TrainingCertificationStatus.ACTIVE
        && expiresAt >= now
        && expiresAt <= windowEnd;
    })
    .map((certification) => toTrainingOperationalCertificationQueueItem(account, certification));
}

function buildExpiredTrainingCertificationQueueItems(
  account: TrainingAccountRecord,
): TrainingOperationalCertificationQueueItem[] {
  const now = Date.now();

  return account.trainingCertifications
    .filter((certification) => {
      if (!certification.expiresAt) {
        return false;
      }

      const isExpiredByDate = certification.expiresAt.getTime() < now;
      return certification.status === TrainingCertificationStatus.EXPIRED
        || (certification.status === TrainingCertificationStatus.ACTIVE && isExpiredByDate);
    })
    .map((certification) => toTrainingOperationalCertificationQueueItem(account, certification));
}

function buildOverdueTrainingProgramQueueItems(
  account: TrainingAccountRecord,
): TrainingOperationalCadenceQueueItem[] {
  return account.trainingPrograms
    .filter((program) => isProgramOverdue(program.status, program.nextDueAt))
    .map((program) => {
      const ownerTmUserId = program.ownerTmUserId ?? account.assignedTmUserId ?? undefined;
      const ownerTmName = program.ownerTmUser?.displayName ?? account.assignedTmUser?.displayName;
      const ownerRdUserId = program.ownerRdUserId ?? account.assignedRdUserId ?? undefined;
      const ownerRdName = program.ownerRdUser?.displayName ?? account.assignedRdUser?.displayName;

      return {
        programId: program.id,
        accountId: account.id,
        accountName: account.displayName,
        ...(account.territoryId ? { territoryId: account.territoryId } : {}),
        ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
        ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
        ...(ownerTmUserId ? { ownerTmUserId } : {}),
        ...(ownerTmName ? { ownerTmName } : {}),
        ...(ownerRdUserId ? { ownerRdUserId } : {}),
        ...(ownerRdName ? { ownerRdName } : {}),
        ...(program.trainingTypeId ? { trainingTypeId: program.trainingTypeId } : {}),
        ...(program.trainingType?.code ? { trainingTypeCode: program.trainingType.code } : {}),
        ...(program.trainingType?.name ? { trainingTypeName: program.trainingType.name } : {}),
        title: program.title,
        nextDueAt: (program.nextDueAt ?? new Date()).toISOString(),
        ...(program.lastCompletedAt ? { lastCompletedAt: program.lastCompletedAt.toISOString() } : {}),
        ...(program.cadenceDays !== null ? { cadenceDays: program.cadenceDays } : {}),
        isRequired: program.isRequired,
        daysOverdue: program.nextDueAt ? daysBetween(program.nextDueAt, new Date()) : 0,
      };
    });
}

function buildTrainingOperationalExceptionQueueItems(
  account: TrainingAccountRecord,
): TrainingOperationalExceptionQueueItem[] {
  return account.trainingSessions.flatMap((session) => {
    const summary = toTrainingSessionSummary(session);
    return buildTrainingExecutionExceptions([summary]).map((exception) => ({
      ...exception,
      ...(account.territoryId ? { territoryId: account.territoryId } : {}),
      ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
      ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
      ...(account.assignedTmUserId ? { ownerTmUserId: account.assignedTmUserId } : {}),
      ...(account.assignedTmUser?.displayName ? { ownerTmName: account.assignedTmUser.displayName } : {}),
      ...(account.assignedRdUserId ? { ownerRdUserId: account.assignedRdUserId } : {}),
      ...(account.assignedRdUser?.displayName ? { ownerRdName: account.assignedRdUser.displayName } : {}),
      ...(summary.trainerUserId ? { trainerUserId: summary.trainerUserId } : {}),
      ...(summary.trainerName ? { trainerName: summary.trainerName } : {}),
    }));
  });
}

function buildTrainingCoachingUpcomingSessions(
  account: TrainingAccountRecord,
): TrainingCoachingUpcomingSessionItem[] {
  return account.trainingSessions
    .filter((session) => session.status === TrainingSessionStatus.SCHEDULED)
    .map((session) => ({
      sessionId: session.id,
      accountId: account.id,
      accountName: account.displayName,
      title: session.title,
      ...(session.scheduledAt ? { scheduledAt: session.scheduledAt.toISOString() } : {}),
      ...(account.territoryId ? { territoryId: account.territoryId } : {}),
      ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
      ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
      ...(session.trainerUserId ? { trainerUserId: session.trainerUserId } : {}),
      ...(session.trainerUser?.displayName ? { trainerName: session.trainerUser.displayName } : {}),
    }));
}

function buildTrainingCoachingFollowUpTasks(
  account: TrainingAccountRecord,
): TrainingCoachingFollowUpTaskItem[] {
  return account.trainingSessions.flatMap((session) => session.followUpTasks
    .filter((task) => task.status === TrainingFollowUpTaskStatus.OPEN)
    .map((task) => ({
      ...toTrainingFollowUpTaskSummary(task),
      accountName: account.displayName,
      ...(account.territoryId ? { territoryId: account.territoryId } : {}),
      ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
      ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
      sessionTitle: session.title,
    })));
}

function toTrainingOperationalCertificationQueueItem(
  account: TrainingAccountRecord,
  certification: TrainingAccountRecord['trainingCertifications'][number],
): TrainingOperationalCertificationQueueItem {
  return {
    certificationId: certification.id,
    accountId: account.id,
    accountName: account.displayName,
    ...(account.territoryId ? { territoryId: account.territoryId } : {}),
    ...(account.territory?.name ? { territoryName: account.territory.name } : {}),
    ...(account.territory?.region?.name ? { regionName: account.territory.region.name } : {}),
    ...(account.assignedTmUserId ? { ownerTmUserId: account.assignedTmUserId } : {}),
    ...(account.assignedTmUser?.displayName ? { ownerTmName: account.assignedTmUser.displayName } : {}),
    ...(account.assignedRdUserId ? { ownerRdUserId: account.assignedRdUserId } : {}),
    ...(account.assignedRdUser?.displayName ? { ownerRdName: account.assignedRdUser.displayName } : {}),
    ...(certification.trainingTypeId ? { trainingTypeId: certification.trainingTypeId } : {}),
    ...(certification.trainingType?.code ? { trainingTypeCode: certification.trainingType.code } : {}),
    ...(certification.trainingType?.name ? { trainingTypeName: certification.trainingType.name } : {}),
    ...(certification.certificationCode ? { certificationCode: certification.certificationCode } : {}),
    title: certification.title,
    status: toTrainingCertificationStatusKey(certification.status),
    awardedAt: certification.awardedAt.toISOString(),
    expiresAt: (certification.expiresAt ?? certification.awardedAt).toISOString(),
    daysUntilExpiry: certification.expiresAt ? daysBetween(new Date(), certification.expiresAt) : 0,
  };
}

function buildTerritoryTrainingPenetrationResponse(
  accounts: TrainingAccountRecord[],
): TerritoryTrainingPenetrationResponse {
  const territoryMap = new Map<string, TerritoryTrainingPenetrationTerritorySummary>();
  const regionMap = new Map<string, TerritoryTrainingPenetrationRegionSummary>();

  let totalAccounts = 0;
  let trainedAccounts = 0;
  let activeProgramsCount = 0;

  for (const account of accounts) {
    if (!account.territoryId || !account.territory) {
      continue;
    }

    totalAccounts += 1;
    const metrics = summarizeTrainingPenetrationAccount(account);
    if (metrics.isTrained) {
      trainedAccounts += 1;
    }
    activeProgramsCount += metrics.activeProgramsCount;

    const territoryCurrent = territoryMap.get(account.territoryId) ?? {
      territoryId: account.territoryId,
      territoryCode: account.territory.code,
      territoryName: account.territory.name,
      regionId: account.territory.regionId,
      regionName: account.territory.region?.name ?? 'Region',
      totalAccounts: 0,
      trainedAccounts: 0,
      activeProgramsCount: 0,
      penetrationPercent: 0,
    };
    territoryCurrent.totalAccounts += 1;
    territoryCurrent.trainedAccounts += metrics.isTrained ? 1 : 0;
    territoryCurrent.activeProgramsCount += metrics.activeProgramsCount;
    territoryCurrent.penetrationPercent = calculatePercent(territoryCurrent.trainedAccounts, territoryCurrent.totalAccounts);
    territoryMap.set(account.territoryId, territoryCurrent);

    const regionId = account.territory.regionId;
    const regionCurrent = regionMap.get(regionId) ?? {
      regionId,
      regionCode: account.territory.region?.code ?? regionId,
      regionName: account.territory.region?.name ?? 'Region',
      totalAccounts: 0,
      trainedAccounts: 0,
      activeProgramsCount: 0,
      penetrationPercent: 0,
    };
    regionCurrent.totalAccounts += 1;
    regionCurrent.trainedAccounts += metrics.isTrained ? 1 : 0;
    regionCurrent.activeProgramsCount += metrics.activeProgramsCount;
    regionCurrent.penetrationPercent = calculatePercent(regionCurrent.trainedAccounts, regionCurrent.totalAccounts);
    regionMap.set(regionId, regionCurrent);
  }

  return {
    summary: {
      totalAccounts,
      trainedAccounts,
      activeProgramsCount,
      penetrationPercent: calculatePercent(trainedAccounts, totalAccounts),
    },
    territories: Array.from(territoryMap.values()).sort((left, right) => left.territoryName.localeCompare(right.territoryName)),
    regions: Array.from(regionMap.values()).sort((left, right) => left.regionName.localeCompare(right.regionName)),
  };
}

function summarizeTrainingPenetrationAccount(account: TrainingAccountRecord) {
  const activeProgramsCount = account.trainingPrograms.filter((entry) => isProgramActive(entry.status)).length;
  const isTrained = account.trainingSessions.some((entry) => (
    entry.status === TrainingSessionStatus.COMPLETED
    && entry.activityKind === TrainingActivityKind.TRAINING
  ));

  return {
    activeProgramsCount,
    isTrained,
  };
}

function isTrainingCertificationRevoked(certification: TrainingCertificationRecord) {
  return certification.status === TrainingCertificationStatus.REVOKED;
}

function isTrainingCertificationExpired(certification: TrainingCertificationRecord) {
  if (!certification.expiresAt) {
    return certification.status === TrainingCertificationStatus.EXPIRED;
  }

  return certification.status === TrainingCertificationStatus.EXPIRED
    || (
      certification.status === TrainingCertificationStatus.ACTIVE
      && certification.expiresAt.getTime() < Date.now()
    );
}

function isTrainingCertificationActive(certification: TrainingCertificationRecord) {
  return certification.status === TrainingCertificationStatus.ACTIVE
    && !isTrainingCertificationExpired(certification);
}

function isTrainingCertificationExpiringWithin(
  certification: TrainingCertificationRecord,
  certificationWindowDays: number,
) {
  if (!certification.expiresAt) {
    return false;
  }

  const now = Date.now();
  const expiresAt = certification.expiresAt.getTime();
  const windowEnd = now + certificationWindowDays * 24 * 60 * 60 * 1000;

  return expiresAt >= now && expiresAt <= windowEnd;
}

function sortTrainingComplianceOwnerRollups(map: Map<string, TrainingComplianceOwnerRollup>) {
  return Array.from(map.values()).sort((left, right) => (
    (right.unresolvedExecutionExceptionCount + right.overdueProgramCount)
    - (left.unresolvedExecutionExceptionCount + left.overdueProgramCount)
    || right.expiringCertificationCount - left.expiringCertificationCount
    || left.ownerName.localeCompare(right.ownerName)
  ));
}

function buildTrainingCertificationLifecycleNotes(
  existingNotes: string | null,
  operation: string,
  detail: string | undefined,
  actorDisplayName: string,
) {
  const normalizedDetail = detail?.trim();
  const entry = `${operation} by ${actorDisplayName} on ${new Date().toISOString()}${normalizedDetail ? `: ${normalizedDetail}` : ''}`;
  if (existingNotes?.trim()) {
    return `${existingNotes.trim()}\n${entry}`;
  }
  return entry;
}

function daysBetween(start: Date, end: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((end.getTime() - start.getTime()) / millisecondsPerDay);
}

function calculatePercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Math.round((numerator / denominator) * 100);
}

function compareIsoDate(left?: string, right?: string) {
  if (!left && !right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return new Date(left).getTime() - new Date(right).getTime();
}

function compareQueueAccountNames(left: string | undefined, right: string | undefined) {
  return (left ?? '').localeCompare(right ?? '');
}

function buildTrainingProofStorageKey(sessionId: string, fileName: string) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return ['training-proof', sessionId, `${Date.now()}-${safeFileName}`].join('/');
}

function estimateBase64DecodedSize(value: string) {
  const normalized = value.trim().replace(/\s+/g, '');
  if (!normalized) {
    throw new Error('contentBase64 is required');
  }
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

function severityWeight(severity: TrainingExecutionExceptionSeverityKey) {
  if (severity === 'high') {
    return 3;
  }
  if (severity === 'medium') {
    return 2;
  }
  return 1;
}

function hasTrainingExecutionException(item: TrainingSessionSummary) {
  return buildTrainingExecutionExceptions([item]).length > 0;
}

function resolveTrainingCalendarEventType(
  session: Pick<TrainingSessionRecord, 'activityKind'> & {
    trainingType?: {
      deliveryMode: TrainingDeliveryMode;
    } | null;
  },
): CalendarEventTypeKey {
  if (session.activityKind === TrainingActivityKind.SITE_VISIT) {
    return 'on_site_visit';
  }

  if (session.trainingType?.deliveryMode === TrainingDeliveryMode.VIRTUAL) {
    return 'virtual_training';
  }

  return 'account_training';
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

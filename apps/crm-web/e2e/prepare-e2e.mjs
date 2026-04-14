import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyTestEnvironment, ensureTestDatabaseReady, resetDatabase } from '../../api/test/support/runtime.mjs';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(e2eDir, '../../..');
const fixturePath = path.join(e2eDir, '.generated-fixtures.json');

process.env.PORT = '4100';
process.env.APP_WEB_BASE_URL = 'http://127.0.0.1:3101';
process.env.NEXT_PUBLIC_PULSE_API_BASE_URL = 'http://127.0.0.1:4100';
process.env.NEXT_PUBLIC_PULSE_WEB_BASE_URL = 'http://127.0.0.1:3101';

applyTestEnvironment();
ensureTestDatabaseReady();

const { prisma } = await importFromRepo('packages/db/dist/index.js');
const { loadAppConfig } = await importFromRepo('apps/api/dist/config.js');
const { ensureReferenceDataSeeded } = await importFromRepo('apps/api/dist/modules/reference/service.js');
const {
  ensureLeadRoutingPolicySeeded,
  ensureWebsiteLeadConfigSeeded,
  createLead,
} = await importFromRepo('apps/api/dist/modules/leads/service.js');
const {
  ensureTerritoryPolicySeeded,
} = await importFromRepo('apps/api/dist/modules/territories/service.js');
const {
  ensureTrainingSeeded,
  createAccountTrainingProgram,
  createTrainingSession,
} = await importFromRepo('apps/api/dist/modules/training/service.js');
const {
  ensureBootstrapAdminSeeded,
  loginWithPassword,
  authenticateAccessToken,
} = await importFromRepo('apps/api/dist/modules/auth/service.js');
const {
  issueCisLink,
  savePublicCisDraft,
} = await importFromRepo('apps/api/dist/modules/cis/service.js');
const {
  provisionDealerPortalUser,
} = await importFromRepo('apps/api/dist/modules/dealer-portal/service.js');

const config = loadAppConfig(process.env);

await prisma.$connect();

try {
  await resetDatabase(prisma);
  await ensureReferenceDataSeeded();
  await ensureLeadRoutingPolicySeeded();
  await ensureWebsiteLeadConfigSeeded();
  await ensureTerritoryPolicySeeded();
  await ensureTrainingSeeded();
  await ensureBootstrapAdminSeeded(config);

  const adminAuth = await loginWithPassword(
    config,
    {
      email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
    },
    {},
  );

  const adminActor = await authenticateAccessToken(adminAuth.tokens.accessToken);
  if (!adminActor) {
    throw new Error('Failed to create E2E admin actor.');
  }

  const websiteSite = await prisma.websiteLeadSite.findUniqueOrThrow({
    where: { siteId: 'purairx' },
  });

  const cisLead = await createLead(adminActor, {
    companyName: 'E2E Indoor Comfort',
    contactDisplayName: 'Jordan E2E',
    email: 'jordan.e2e@example.com',
    phone: '555-200-1000',
    state: 'TX',
    serviceTechCount: 4,
  });

  const issuedCis = await issueCisLink(adminActor, cisLead.id, {
    recipientEmail: 'jordan.e2e@example.com',
    note: 'E2E seeded CIS package',
  }, config);

  const cisToken = extractPublicToken(issuedCis.publicUrl);

  await savePublicCisDraft(cisToken, {
    formData: {
      companyWebsite: 'https://e2e-indoor.example.com',
      numOfTechs: 4,
      numOfInstallTechs: 2,
      numOfSalespeopleAdvisors: 1,
      affinityGroupOrFranchise: 'AireServ',
      isPrivateEquity: false,
      primaryContactName: 'Jordan E2E',
      primaryContactTitle: 'Owner',
      primaryContactEmail: 'jordan.e2e@example.com',
      primaryContactCellPhone: '555-200-1000',
      ownerManagerName: 'Jordan E2E',
      ownerManagerTitle: 'Owner',
      ownerManagerEmail: 'jordan.e2e@example.com',
      ownerManagerCellPhone: '555-200-1000',
      legalCompanyName: 'E2E Indoor Comfort LLC',
      physicalAddress: '455 Market Street',
      physicalCity: 'Dallas',
      physicalState: 'TX',
      physicalZip: '75201',
      physicalCountryCode: 'US',
      billingAddress: '455 Market Street',
      billingCity: 'Dallas',
      billingState: 'TX',
      billingZip: '75201',
      billingCountryCode: 'US',
      companyPhone: '555-200-2000',
      typeOfBusiness: 'LLC',
      yearsInBusiness: 4,
      monthsInBusiness: 6,
      orderingContactName: 'Jordan E2E',
      orderingContactCellPhone: '555-200-1000',
      orderingContactEmail: 'orders.e2e@example.com',
      apContactName: 'Dana Accounts',
      apDirectPhone: '555-200-3000',
      apEmail: 'ap.e2e@example.com',
      paymentMethod: 'NET_30',
      cardOnFileAuthorized: false,
      resaleCertificateAttached: true,
      hasSignature: false,
    },
  });

  const shippingCenter = await prisma.shippingCenter.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
  });

  const tmUser = await prisma.user.create({
    data: {
      email: 'tm.e2e@pulse.local',
      displayName: 'Terry Territory',
      roleCode: 'TERRITORY_MANAGER',
      isActive: true,
    },
  });

  const rdUser = await prisma.user.create({
    data: {
      email: 'rd.e2e@pulse.local',
      displayName: 'Riley Regional',
      roleCode: 'REGIONAL_DIRECTOR',
      isActive: true,
    },
  });

  const trainerUser = await prisma.user.create({
    data: {
      email: 'trainer.e2e@pulse.local',
      displayName: 'Taylor Trainer',
      roleCode: 'TRAINING_OPS',
      isActive: true,
      trainingTrainerProfile: {
        create: {
          isActive: true,
        },
      },
    },
  });

  const segment = await prisma.businessSegmentRef.findFirst({
    where: { code: 'residential' },
  });

  const region = await prisma.region.create({
    data: {
      code: 'e2e_region',
      name: 'E2E Region',
      directorUserId: rdUser.id,
      isActive: true,
    },
  });

  const territory = await prisma.territory.create({
    data: {
      code: 'e2e_territory',
      name: 'E2E Territory',
      regionId: region.id,
      managerUserId: tmUser.id,
      shippingCenterId: shippingCenter.id,
      isActive: true,
    },
  });

  const account = await prisma.account.create({
    data: {
      accountNumber: 'E2E-1001',
      displayName: 'E2E Dealer Comfort',
      legalName: 'E2E Dealer Comfort LLC',
      accountType: 'Dealer',
      businessSegmentId: segment?.id ?? null,
      territoryId: territory.id,
      shippingCenterId: shippingCenter.id,
      assignedTmUserId: tmUser.id,
      assignedRdUserId: rdUser.id,
      isActive: true,
      contacts: {
        create: {
          firstName: 'Dana',
          lastName: 'Dealer',
          email: 'dealer.e2e@example.com',
          title: 'Owner',
          isPrimary: true,
          isActive: true,
        },
      },
      locations: {
        create: {
          name: 'Main Office',
          city: 'Dallas',
          state: 'TX',
          countryCode: 'US',
          isPrimary: true,
          isActive: true,
        },
      },
    },
    include: {
      contacts: true,
      locations: true,
    },
  });

  const dealerPortal = await provisionDealerPortalUser(adminActor, account.id, {
    contactId: account.contacts[0]?.id,
    isPrimaryOwner: true,
  });

  const certificationType = await prisma.trainingType.findUniqueOrThrow({
    where: { code: 'iaq_certification_curriculum' },
  });

  const trainingActor = {
    ...adminActor,
    role: 'TRAINING_OPS',
  };

  const trainingProgram = await createAccountTrainingProgram(trainingActor, account.id, {
    trainingTypeId: certificationType.id,
    isRequired: true,
  });

  const scheduledAt = new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString();

  const trainingSession = await createTrainingSession(trainingActor, account.id, {
    programId: trainingProgram.id,
    trainingTypeId: certificationType.id,
    trainerUserId: trainerUser.id,
    scheduledAt,
    durationMinutes: 90,
    attendeeCount: 4,
    activityKind: 'training',
    notes: 'E2E seeded training session',
  });

  await fs.writeFile(
    fixturePath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      internalAuth: {
        email: process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL,
        password: process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD,
      },
      publicWebsiteForm: {
        siteId: websiteSite.siteId,
        siteName: websiteSite.siteName,
      },
      cis: {
        token: cisToken,
        leadId: cisLead.id,
        companyName: cisLead.companyName,
      },
      customer: {
        accountId: account.id,
        displayName: account.displayName,
      },
      dealerPortal: {
        email: account.contacts[0]?.email,
        password: dealerPortal.temporaryPassword,
        accountDisplayName: account.displayName,
      },
      training: {
        sessionId: trainingSession.id,
        title: trainingSession.title,
      },
    }, null, 2),
    'utf8',
  );
} finally {
  await prisma.$disconnect();
}

function extractPublicToken(publicUrl) {
  return new URL(publicUrl).pathname.split('/').filter(Boolean).at(-1);
}

async function importFromRepo(relativePath) {
  return import(pathToFileURL(path.join(repoRootDir, relativePath)).href);
}

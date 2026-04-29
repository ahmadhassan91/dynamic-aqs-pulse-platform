import type { WebsiteLeadFormType } from '@pulse/db';

export type WebsiteLeadSiteSeed = {
  siteId: string;
  siteName: string;
  url: string;
  allowedOrigins?: string[];
  brandTag: string;
  formType: WebsiteLeadFormType;
  isActive: boolean;
};

export type WebsiteLeadNotificationRecipientSeed = {
  name: string;
  email: string;
  roleTitle?: string;
  isActive: boolean;
};

export const WEBSITE_LEAD_SITE_SEEDS: WebsiteLeadSiteSeed[] = [
  { siteId: 'solace-air', siteName: 'SolaceAir.com', url: 'https://solaceair.com/contact-us', brandTag: 'SLA', formType: 'BOTH', isActive: true },
  { siteId: 'dynamic-aqs', siteName: 'DynamicAQS.com', url: 'https://dynamicaqs.com/contact-us', brandTag: 'DYN', formType: 'BOTH', isActive: true },
  { siteId: 'purairx', siteName: 'PurAirX.com', url: 'https://purairx.com/contact-us', brandTag: 'PAX', formType: 'CONTRACTOR', isActive: true },
  { siteId: 'modern-purair', siteName: 'ModernPURAIR.ca', url: 'https://modernpurair.ca/contact-us', brandTag: 'MPA', formType: 'BOTH', isActive: true },
  { siteId: 'bioair', siteName: 'BioAirSolutions.com', url: 'https://bioairsolutions.com/contact-us', brandTag: 'BIO', formType: 'BOTH', isActive: true },
  { siteId: 'cad-system', siteName: 'CleanAirDefense.com', url: 'https://cleanairdefense.com/contact-us', brandTag: 'CAD', formType: 'BOTH', isActive: true },
  { siteId: 'enviromaster', siteName: 'Enviromaster.com', url: 'https://enviromaster.com/contact-us', brandTag: 'ENV', formType: 'CONTRACTOR', isActive: true },
  { siteId: 'eco-air', siteName: 'EcoAirSolutions.com', url: 'https://ecoairsolutions.com/contact-us', brandTag: 'ECO', formType: 'BOTH', isActive: false },
  { siteId: 'nexstar-clean', siteName: 'NexstarClean.com', url: 'https://nexstarclean.com/contact-us', brandTag: 'NEX', formType: 'CONTRACTOR', isActive: true },
  { siteId: 'service-experts-iaq', siteName: 'ServiceExperts.com/iaq', url: 'https://serviceexperts.com/iaq', brandTag: 'SVC', formType: 'HOMEOWNER', isActive: true },
  { siteId: 'ars-iaq', siteName: 'ARS.com/iaq', url: 'https://ars.com/iaq', brandTag: 'ARS', formType: 'HOMEOWNER', isActive: true },
  { siteId: 'aire-serv', siteName: 'AireServ.com', url: 'https://aireserv.com/contact-us', brandTag: 'ASV', formType: 'HOMEOWNER', isActive: true },
  { siteId: 'certified-path', siteName: 'CertifiedPath.com', url: 'https://certifiedpath.com/contact-us', brandTag: 'CPA', formType: 'BOTH', isActive: true },
  { siteId: 'egia', siteName: 'EGIA.org', url: 'https://egia.org/contact-us', brandTag: 'EGI', formType: 'CONTRACTOR', isActive: true },
  { siteId: 'steamatic', siteName: 'Steamatic.com', url: 'https://steamatic.com/contact-us', brandTag: 'STM', formType: 'CONTRACTOR', isActive: false },
  { siteId: 'sorted', siteName: 'Sorted.com', url: 'https://sorted.com/contact-us', brandTag: 'SRT', formType: 'CONTRACTOR', isActive: true },
];

export const WEBSITE_LEAD_NOTIFICATION_RECIPIENT_SEEDS: WebsiteLeadNotificationRecipientSeed[] = [
  {
    name: 'Adrienne Cardinale',
    email: 'acardinale@dynamicaqs.com',
    roleTitle: 'Director of Strategic Partnerships',
    isActive: true,
  },
  {
    name: 'Michelle Hogan',
    email: 'mhogan@dynamicaqs.com',
    roleTitle: 'VP Business Development',
    isActive: true,
  },
];

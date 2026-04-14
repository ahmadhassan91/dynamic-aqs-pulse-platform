import { WebsiteLeadFormType } from '@pulse/db';
import type {
  WebsiteLeadSiteFormConfig,
  WebsiteLeadNotificationRecipientSummary,
  WebsiteLeadSiteSummary,
} from '@pulse/contracts';
import type { Prisma } from '@pulse/db';

export function toWebsiteLeadFormTypeKey(value: WebsiteLeadFormType) {
  switch (value) {
    case WebsiteLeadFormType.HOMEOWNER:
      return 'homeowner';
    case WebsiteLeadFormType.CONTRACTOR:
      return 'contractor';
    case WebsiteLeadFormType.BOTH:
      return 'both';
  }
}

export function toWebsiteLeadFormTypeEnum(value: string) {
  switch (value) {
    case 'homeowner':
      return WebsiteLeadFormType.HOMEOWNER;
    case 'contractor':
      return WebsiteLeadFormType.CONTRACTOR;
    case 'both':
      return WebsiteLeadFormType.BOTH;
    default:
      throw new Error(`Unknown website lead form type: ${value}`);
  }
}

export function buildDefaultWebsiteLeadSiteFormConfig(
  siteName: string,
  formType: ReturnType<typeof toWebsiteLeadFormTypeKey>,
): WebsiteLeadSiteFormConfig {
  return {
    headline: 'Contact an IAQ Professional',
    subheadline: `Protect your Indoor Space with ${siteName}`,
    submitButtonLabel: 'Submit',
    successTitle: 'Thanks, we’ve received your request.',
    successMessage: `Your submission for ${siteName} has been routed into Pulse CRM and the intake team will follow up from there.`,
    homeownerInquiryLabel: 'For Homeowners: How can we help?',
    contractorInquiryLabel: 'For HVAC Contractors, I am inquiring about:',
    messageLabel: 'Please provide a brief summary of your request:',
    referralSourceLabel: 'How did you hear about us?',
    referralDetailLabel: 'Who can we thank for referring you?',
    marketingConsentLabel: 'I agree to receive other communications from Dynamic AQS.',
    customerStatusLabel: 'Please select customer type:',
    homeownerInquiryOptions: [
      'Improve indoor air quality',
      'Address odors or allergies',
      'Whole-home IAQ consultation',
      'Service or support request',
    ],
    contractorInquiryOptions: [
      'Become a contractor partner',
      'Product, pricing, or availability',
      'Training and onboarding',
      'Existing account support',
    ],
    referralSourceOptions: [
      'Search engine',
      'Dealer referral',
      'Social media',
      'Affinity group',
      'Existing customer',
    ],
    ...(formType === 'homeowner'
      ? {
          subheadline: `Protect your Indoor Space with ${siteName}`,
        }
      : {}),
  };
}

export function toWebsiteLeadSiteFormConfig(
  site: Pick<
    Prisma.WebsiteLeadSiteGetPayload<{}>,
    | 'siteName'
    | 'formType'
    | 'headline'
    | 'subheadline'
    | 'submitButtonLabel'
    | 'successTitle'
    | 'successMessage'
    | 'homeownerInquiryLabel'
    | 'contractorInquiryLabel'
    | 'messageLabel'
    | 'referralSourceLabel'
    | 'referralDetailLabel'
    | 'marketingConsentLabel'
    | 'customerStatusLabel'
    | 'homeownerInquiryOptions'
    | 'contractorInquiryOptions'
    | 'referralSourceOptions'
  >,
): WebsiteLeadSiteFormConfig {
  const defaults = buildDefaultWebsiteLeadSiteFormConfig(site.siteName, toWebsiteLeadFormTypeKey(site.formType));

  return {
    headline: optionalTrimmed(site.headline ?? undefined) ?? defaults.headline,
    subheadline: optionalTrimmed(site.subheadline ?? undefined) ?? defaults.subheadline,
    submitButtonLabel: optionalTrimmed(site.submitButtonLabel ?? undefined) ?? defaults.submitButtonLabel,
    successTitle: optionalTrimmed(site.successTitle ?? undefined) ?? defaults.successTitle,
    successMessage: optionalTrimmed(site.successMessage ?? undefined) ?? defaults.successMessage,
    homeownerInquiryLabel: optionalTrimmed(site.homeownerInquiryLabel ?? undefined) ?? defaults.homeownerInquiryLabel,
    contractorInquiryLabel: optionalTrimmed(site.contractorInquiryLabel ?? undefined) ?? defaults.contractorInquiryLabel,
    messageLabel: optionalTrimmed(site.messageLabel ?? undefined) ?? defaults.messageLabel,
    referralSourceLabel: optionalTrimmed(site.referralSourceLabel ?? undefined) ?? defaults.referralSourceLabel,
    referralDetailLabel: optionalTrimmed(site.referralDetailLabel ?? undefined) ?? defaults.referralDetailLabel,
    marketingConsentLabel: optionalTrimmed(site.marketingConsentLabel ?? undefined) ?? defaults.marketingConsentLabel,
    customerStatusLabel: optionalTrimmed(site.customerStatusLabel ?? undefined) ?? defaults.customerStatusLabel,
    homeownerInquiryOptions: site.homeownerInquiryOptions.length > 0 ? site.homeownerInquiryOptions : defaults.homeownerInquiryOptions,
    contractorInquiryOptions: site.contractorInquiryOptions.length > 0 ? site.contractorInquiryOptions : defaults.contractorInquiryOptions,
    referralSourceOptions: site.referralSourceOptions.length > 0 ? site.referralSourceOptions : defaults.referralSourceOptions,
  };
}

export function toWebsiteLeadSiteSummary(site: Prisma.WebsiteLeadSiteGetPayload<{}>): WebsiteLeadSiteSummary {
  return {
    id: site.id,
    siteId: site.siteId,
    siteName: site.siteName,
    url: site.url,
    brandTag: site.brandTag,
    formType: toWebsiteLeadFormTypeKey(site.formType),
    isActive: site.isActive,
    ...(site.notes ? { notes: site.notes } : {}),
    formConfig: toWebsiteLeadSiteFormConfig(site),
    submissionsLast30Days: 0,
    linkedLeadsTotal: 0,
    activePipelineLeads: 0,
    convertedLeads: 0,
    conversionRate: 0,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}

export function toWebsiteLeadNotificationRecipientSummary(
  recipient: Prisma.WebsiteLeadNotificationRecipientGetPayload<{}>,
): WebsiteLeadNotificationRecipientSummary {
  return {
    id: recipient.id,
    ...(recipient.websiteLeadSiteId ? { websiteLeadSiteId: recipient.websiteLeadSiteId } : {}),
    name: recipient.name,
    email: recipient.email,
    ...(recipient.roleTitle ? { roleTitle: recipient.roleTitle } : {}),
    isActive: recipient.isActive,
    createdAt: recipient.createdAt.toISOString(),
    updatedAt: recipient.updatedAt.toISOString(),
  };
}

export function requiredTrimmed(value: unknown, fieldName: string) {
  const normalized = optionalTrimmed(asString(value));
  if (!normalized) {
    throw new Error(`${fieldName} is required`);
  }

  return normalized;
}

export function optionalTrimmed(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function normalizeEmailAddress(value: string) {
  const normalized = requiredTrimmed(value, 'email').toLowerCase();
  if (!normalized.includes('@')) {
    throw new Error('email must be valid');
  }
  return normalized;
}

export function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

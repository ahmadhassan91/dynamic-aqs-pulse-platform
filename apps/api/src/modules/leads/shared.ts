import { WebsiteLeadFormType } from '@pulse/db';
import type {
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

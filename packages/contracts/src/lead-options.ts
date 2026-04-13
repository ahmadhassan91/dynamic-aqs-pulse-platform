export const LEAD_RATINGS = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'whale', label: 'Whale' },
] as const;

export type LeadRatingKey = (typeof LEAD_RATINGS)[number]['value'];

export const LEAD_MARKETING_SOURCES = [
  { value: 'digital_ad', label: 'Digital Ad' },
  { value: 'content_marketing', label: 'Content Marketing' },
  { value: 'event', label: 'Event' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'direct_mail', label: 'Direct Mail' },
  { value: 'referral', label: 'Referral' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'seo', label: 'SEO' },
  { value: 'other', label: 'Other' },
] as const;

export type LeadMarketingSourceKey = (typeof LEAD_MARKETING_SOURCES)[number]['value'];

export const LEAD_REGION_OPTIONS = [
  { value: 'AL', label: 'Alabama', countryCode: 'US', group: 'United States' },
  { value: 'AK', label: 'Alaska', countryCode: 'US', group: 'United States' },
  { value: 'AZ', label: 'Arizona', countryCode: 'US', group: 'United States' },
  { value: 'AR', label: 'Arkansas', countryCode: 'US', group: 'United States' },
  { value: 'CA', label: 'California', countryCode: 'US', group: 'United States' },
  { value: 'CO', label: 'Colorado', countryCode: 'US', group: 'United States' },
  { value: 'CT', label: 'Connecticut', countryCode: 'US', group: 'United States' },
  { value: 'DE', label: 'Delaware', countryCode: 'US', group: 'United States' },
  { value: 'FL', label: 'Florida', countryCode: 'US', group: 'United States' },
  { value: 'GA', label: 'Georgia', countryCode: 'US', group: 'United States' },
  { value: 'HI', label: 'Hawaii', countryCode: 'US', group: 'United States' },
  { value: 'ID', label: 'Idaho', countryCode: 'US', group: 'United States' },
  { value: 'IL', label: 'Illinois', countryCode: 'US', group: 'United States' },
  { value: 'IN', label: 'Indiana', countryCode: 'US', group: 'United States' },
  { value: 'IA', label: 'Iowa', countryCode: 'US', group: 'United States' },
  { value: 'KS', label: 'Kansas', countryCode: 'US', group: 'United States' },
  { value: 'KY', label: 'Kentucky', countryCode: 'US', group: 'United States' },
  { value: 'LA', label: 'Louisiana', countryCode: 'US', group: 'United States' },
  { value: 'ME', label: 'Maine', countryCode: 'US', group: 'United States' },
  { value: 'MD', label: 'Maryland', countryCode: 'US', group: 'United States' },
  { value: 'MA', label: 'Massachusetts', countryCode: 'US', group: 'United States' },
  { value: 'MI', label: 'Michigan', countryCode: 'US', group: 'United States' },
  { value: 'MN', label: 'Minnesota', countryCode: 'US', group: 'United States' },
  { value: 'MS', label: 'Mississippi', countryCode: 'US', group: 'United States' },
  { value: 'MO', label: 'Missouri', countryCode: 'US', group: 'United States' },
  { value: 'MT', label: 'Montana', countryCode: 'US', group: 'United States' },
  { value: 'NE', label: 'Nebraska', countryCode: 'US', group: 'United States' },
  { value: 'NV', label: 'Nevada', countryCode: 'US', group: 'United States' },
  { value: 'NH', label: 'New Hampshire', countryCode: 'US', group: 'United States' },
  { value: 'NJ', label: 'New Jersey', countryCode: 'US', group: 'United States' },
  { value: 'NM', label: 'New Mexico', countryCode: 'US', group: 'United States' },
  { value: 'NY', label: 'New York', countryCode: 'US', group: 'United States' },
  { value: 'NC', label: 'North Carolina', countryCode: 'US', group: 'United States' },
  { value: 'ND', label: 'North Dakota', countryCode: 'US', group: 'United States' },
  { value: 'OH', label: 'Ohio', countryCode: 'US', group: 'United States' },
  { value: 'OK', label: 'Oklahoma', countryCode: 'US', group: 'United States' },
  { value: 'OR', label: 'Oregon', countryCode: 'US', group: 'United States' },
  { value: 'PA', label: 'Pennsylvania', countryCode: 'US', group: 'United States' },
  { value: 'RI', label: 'Rhode Island', countryCode: 'US', group: 'United States' },
  { value: 'SC', label: 'South Carolina', countryCode: 'US', group: 'United States' },
  { value: 'SD', label: 'South Dakota', countryCode: 'US', group: 'United States' },
  { value: 'TN', label: 'Tennessee', countryCode: 'US', group: 'United States' },
  { value: 'TX', label: 'Texas', countryCode: 'US', group: 'United States' },
  { value: 'UT', label: 'Utah', countryCode: 'US', group: 'United States' },
  { value: 'VT', label: 'Vermont', countryCode: 'US', group: 'United States' },
  { value: 'VA', label: 'Virginia', countryCode: 'US', group: 'United States' },
  { value: 'WA', label: 'Washington', countryCode: 'US', group: 'United States' },
  { value: 'WV', label: 'West Virginia', countryCode: 'US', group: 'United States' },
  { value: 'WI', label: 'Wisconsin', countryCode: 'US', group: 'United States' },
  { value: 'WY', label: 'Wyoming', countryCode: 'US', group: 'United States' },
  { value: 'DC', label: 'District of Columbia', countryCode: 'US', group: 'United States' },
  { value: 'AB', label: 'Alberta', countryCode: 'CA', group: 'Canada' },
  { value: 'BC', label: 'British Columbia', countryCode: 'CA', group: 'Canada' },
  { value: 'MB', label: 'Manitoba', countryCode: 'CA', group: 'Canada' },
  { value: 'NB', label: 'New Brunswick', countryCode: 'CA', group: 'Canada' },
  { value: 'NL', label: 'Newfoundland and Labrador', countryCode: 'CA', group: 'Canada' },
  { value: 'NS', label: 'Nova Scotia', countryCode: 'CA', group: 'Canada' },
  { value: 'NT', label: 'Northwest Territories', countryCode: 'CA', group: 'Canada' },
  { value: 'NU', label: 'Nunavut', countryCode: 'CA', group: 'Canada' },
  { value: 'ON', label: 'Ontario', countryCode: 'CA', group: 'Canada' },
  { value: 'PE', label: 'Prince Edward Island', countryCode: 'CA', group: 'Canada' },
  { value: 'QC', label: 'Quebec', countryCode: 'CA', group: 'Canada' },
  { value: 'SK', label: 'Saskatchewan', countryCode: 'CA', group: 'Canada' },
  { value: 'YT', label: 'Yukon', countryCode: 'CA', group: 'Canada' },
] as const;

export type LeadRegionCode = (typeof LEAD_REGION_OPTIONS)[number]['value'];
export type LeadRegionOption = (typeof LEAD_REGION_OPTIONS)[number];

const LEAD_REGION_LOOKUP = new Map<string, LeadRegionOption>(
  LEAD_REGION_OPTIONS.flatMap((option) => [
    [option.value.toUpperCase(), option],
    [option.label.toUpperCase(), option],
  ]),
);

export function findLeadRegionOption(value: string | null | undefined): LeadRegionOption | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  return LEAD_REGION_LOOKUP.get(normalized);
}

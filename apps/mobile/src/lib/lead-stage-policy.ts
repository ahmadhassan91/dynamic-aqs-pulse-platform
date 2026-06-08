import { LEAD_STAGES } from '@pulse/contracts/leads';

// Stages that may be advanced from mobile — excludes final/complex back-office stages
export const MOBILE_ADVANCEABLE_STAGES = LEAD_STAGES.filter(
  (stage) => !['onboarding_completed', 'customer_active'].includes(stage),
);

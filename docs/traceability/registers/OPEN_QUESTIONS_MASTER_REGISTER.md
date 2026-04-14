# Open Questions Master Register

Last updated: 2026-04-07

## Purpose

This document consolidates the active roadmap open questions into one place for review, ownership, and closure planning.

Scope:
- Active repo only
- `docs/roadmap/prds`
- `docs/roadmap/architecture`
- Excludes `.claude/worktrees`

Coverage rules:
- Includes formal `OQ-*` entries from PRDs and architecture docs
- Includes unnumbered architecture open-question lists where the source file keeps them as bullets instead of `OQ-*` rows
- Retains source-level closure notes where a question is already answered but not yet formally closed in the source document

## Summary

| Metric | Count |
|---|---:|
| Unique formal `OQ-*` IDs | 160 |
| Closure candidates already answered in source | 2 |
| Additional unnumbered architecture open-question groups | 3 |

## Closure Candidates

| Source | ID | Status | Note |
|---|---|---|---|
| `docs/roadmap/prds/PRICING_COMMERCIAL_RULES_PRD.md` | `OQ-PR-07` | Closure candidate | Meetings already answer this as base-price-only in portal; Acumatica owns invoice |
| `docs/roadmap/prds/PRICING_COMMERCIAL_RULES_PRD.md` | `OQ-PR-SUPP-05` | Closure candidate | Explicitly asks to formally close `OQ-PR-07` |
| `docs/roadmap/prds/DIGITAL_ASSETS_DOCUMENTS_PRD.md` | `OQ-DA-01` | Effectively answered | Validation supplement says `AWS S3 + CloudFront` is the intended path unless architecture reopens it |
| `docs/roadmap/prds/DIGITAL_ASSETS_DOCUMENTS_PRD.md` | `OQ-DA-03` | Consolidation candidate | Should be narrowed into `OQ-DA-A02` per validation supplement |

## PRD Open Questions

### LEAD_CAPTURE_MANAGEMENT_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-LC-01` | Exact truck count threshold for routing? Current: `<=5` vs `>5`. Should this be configurable from day one? | Sales Leadership | Open |
| `OQ-LC-02` | Should discovery call be mandatory or optional? Current: optional with documented skip reason. | Sales Leadership | Open |
| `OQ-LC-03` | Voice-to-text service for mobile lead notes? Options: OpenAI Whisper, Azure Speech, Google Speech. | Architecture | Open |
| `OQ-LC-04` | Duplicate merge behavior: which fields win? Options: newest wins, manual field-by-field, configurable. | Admin | Open |
| `OQ-LC-05` | Should leads be visible to TMs before routing completes? | Sales Leadership | Open |
| `OQ-LC-06` | How to handle leads from Canada: tax ID and address format? | Product | Open |
| `OQ-LC-A01` | Should all three BD reps receive simultaneous alerts for every SGT lead, or should a round-robin model designate a single owner? | Michelle Hogan + Sales Leadership | Open |
| `OQ-LC-A02` | What is the exact affinity-group list that should appear in the intake dropdown? | Admin / Michelle | Open |
| `OQ-LC-A03` | Should leads that originated from Map My Customer activity be importable as leads, or does Map My Customer only log against existing CRM records? | Architecture + CG | Open |
| `OQ-LC-A04` | What happens to leads currently in Dynamics CRM and parallel Excel spreadsheets on go-live? | Product + Dan Harshbarger | Open |
| `OQ-LC-A05` | For the `number of trucks` field, does this mean service trucks only, install trucks only, or a combined total? | Michelle + Ahmad | Open |
| `OQ-LC-A06` | Are historical sales data from QuickBooks, stored in Azure SQL by Dan, in scope for migration to CRM lead/customer history? | Dan Harshbarger + Architecture | Open |

### CIS_CREDIT_ONBOARDING_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-CIS-01` | E-signature vendor selection: DocuSign, HelloSign, or custom? | Architecture | Open |
| `OQ-CIS-02` | Should portal access happen at CIS signed or credit approved? | Sales Leadership + CG | Open |
| `OQ-CIS-03` | Card-on-file: tokenize during CIS or in a separate step? | Finance + Architecture | Open |
| `OQ-CIS-04` | Should conditional approval auto-reduce credit line or require manual action? | David Hudasko | Open |
| `OQ-CIS-05` | Canada launch timing: is a CIS form variant needed for Phase 1? | Product | Open |
| `OQ-CIS-A01` | When Finance approves with a custom credit line or terms, should Sales/BD see the full terms text or only a summary? | Finance + Sales Leadership | Open |
| `OQ-CIS-A02` | Should logging a WebEx Training activity in mobile automatically check off the corresponding onboarding checklist item, or should they be manually linked? | Architecture + Training Ops | Open |
| `OQ-CIS-A03` | For `monthsInBusiness` found in code, is this intended for businesses less than one year old, and does Finance treat sub-one-year businesses differently for credit decisions? | Finance | Open |
| `OQ-CIS-A04` | At what point should the prospect be notified of their approved credit line: immediately by the CRM or personally by the Sales/BD rep first? | Sales Leadership | Open |
| `OQ-CIS-A05` | For the Canada CIS variant, is it a conditional-field version of the same flow or a fully separate flow, and does it require a different e-signature legal framework? | Product + Legal | Open |
| `OQ-CIS-A06` | Does `card-on-file authorization required for all accounts` also apply to Canadian, government, institutional, and ACH-only accounts? | Finance | Open |

### CUSTOMER_ACCOUNT_CONTACT_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-CA-01` | At-risk threshold: 60 days or configurable? | Sales Leadership | Open |
| `OQ-CA-02` | Should parent/child accounts share credit or be independent? | Finance | Open |
| `OQ-CA-03` | How should customer re-activation from Churned be handled? | Sales Leadership | Open |
| `OQ-CA-04` | Should financial data refresh interval be configurable per customer tier? | Architecture | Open |
| `OQ-CA-A01` | When a billing address or AP contact changes in CRM, should Finance receive an automated alert or should Sales/BD notify Finance manually? | Dan Harshbarger + CG + Finance | Open |
| `OQ-CA-A02` | Is `Independent` a standalone customer segment, or simply `no affinity group + no ownership group`? | Michelle Hogan + Sales Leadership | Open |
| `OQ-CA-A03` | For dual-group customers, what is the composite rebate calculation rule? | Finance + Sales Leadership | Open |
| `OQ-CA-A04` | Should the 20-year historical sales data in Azure SQL be migrated into CRM customer order history, and how are part/customer mismatches resolved? | Dan Harshbarger + Architecture | Open |
| `OQ-CA-A05` | Should the Customer 360 sales trend chart show Acumatica-only revenue or also legacy QuickBooks/Azure data if migrated? | Product + Dan Harshbarger | Open |
| `OQ-CA-A06` | What happens to dealer-group assignment and price class when a customer leaves an affinity group? | Finance + Sales Leadership | Open |

### PRICING_COMMERCIAL_RULES_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-PR-01` | Nightly or manual price sync, or both? | Dan Harshbarger | Open |
| `OQ-PR-02` | Credit hold behavior: block checkout or warn only? | Finance + Sales Leadership | Open |
| `OQ-PR-03` | Should price changes mid-checkout force re-pricing or allow original pricing? | Product + Finance | Open |
| `OQ-PR-04` | Volume and quantity break support in Phase 1? | Product | Open |
| `OQ-PR-05` | Which ERP price classes are active in Phase 1 and which remain dormant or commercial-only? | Pricing Ops | Open |
| `OQ-PR-06` | Should Pulse eventually replace the wildcard pricing tool or only consume its outputs in Phase 1? | Product + Dan Harshbarger | Open |
| `OQ-PR-07` | Should portal checkout estimate tax, shipping, and surcharge, or remain base-price only until Acumatica invoices the order? | Finance + Product | Closure candidate; source says answered |
| `OQ-PR-SUPP-01` | Should the portal display a `rebate-eligible spend` figure separately from total YTD spend, excluding shipping? | Finance + Michelle Hogan | Open |
| `OQ-PR-SUPP-02` | Do code keys like `DEALER_STANDARD` and `DEALER_PREFERRED` map to `A1-A16`, or are they a separate mapping layer? | Dan Harshbarger + Architecture | Open |
| `OQ-PR-SUPP-03` | Apex members receive a line-item discount, not a price class discount. Should the portal show only standard pricing, or a visible discount field? | Finance + Curry | Open |
| `OQ-PR-SUPP-04` | How many distinct price lists will exist at go-live? | Dan Harshbarger | Open |
| `OQ-PR-SUPP-05` | `OQ-PR-07` should be formally closed because meetings confirmed base-price-only portal display. | Dan Harshbarger + Finance | Closure candidate |

### CONSIGNMENT_MANAGEMENT_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-CSG-01` | Barcode format: UPC, QR, or Code 128? | Ops + Architecture | Open |
| `OQ-CSG-02` | What constitutes a `write-off` for discrepancies? | Finance + Samantha | Open |
| `OQ-CSG-03` | PURPLE and SAND cycle: mandatory or optional? | Ops | Open |
| `OQ-CSG-04` | Should consignment POs auto-create in Acumatica or stay manual? | Finance + Architecture | Open |
| `OQ-CSG-05` | Partial PO acceptance: can the customer submit a PO for only part of consumed inventory? | Finance | Open |
| `OQ-CSG-06` | Is minute-by-minute sync required, or is a short-delay operational SLA acceptable? | Ops + Architecture | Open |
| `OQ-CSG-07` | After onboarding, is the first follow-up always the standard 90-day on-site ROSE audit, or does any 45-60 day variant remain in scope? | Ops + Samantha | Open |
| `OQ-CSG-SUPP-01` | Should the dealer portal eventually show the consignment customer their inventory balance, or is that internal-only? | Curry + Ops | Open |
| `OQ-CSG-SUPP-02` | What is the retention and legal standing of signed inventory adjustment forms currently stored in Dropbox? | Legal / Finance | Open |
| `OQ-CSG-SUPP-03` | Can a customer partially PO consumed items from one audit, and what are the workflow consequences? | Finance + Samantha | Open; overlaps `OQ-CSG-05` |
| `OQ-CSG-SUPP-04` | PURPLE is currently defined as P2. Should it be promoted to P1 based on operational evidence? | Ops + Product | Open |
| `OQ-CSG-SUPP-05` | Should the UI use `warehouse` or `consignment site` terminology? | Product + Samantha | Open |
| `OQ-CSG-SUPP-06` | Is there a minimum order quantity or inventory level that triggers eligibility to join consignment? | Sales Leadership + Samantha | Open |

### DEALER_PORTAL_REQUIREMENTS.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-DP-SUPP-01` | What is the exact dealer-role set at launch, including the permission matrix? | Product + Dan Harshbarger | Open |
| `OQ-DP-SUPP-02` | Should TMs see the dealer portal view of an account, or only the internal CRM view? | Curry + Product | Open |
| `OQ-DP-SUPP-03` | Is historical order data pre-Acumatica in scope for go-live or deferred? | Dan Harshbarger + Architecture | Open |
| `OQ-DP-SUPP-04` | Confirm the rejected `requested delivery date` field is removed from checkout spec and wireframes. | Product | Open |
| `OQ-DP-SUPP-05` | Rebate-eligible spend display: separate total, or note that shipping is excluded? | Finance + Michelle Hogan | Open |
| `OQ-DP-SUPP-06` | Who internally manages Widen, and does the commercial team use it? | Curry + Marketing | Open |

### MOBILE_APP_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-MOBILE-001` | What is the exact dollar threshold for `active account` definition? | Executive / Michelle Hogan | Open |
| `OQ-MOBILE-002` | Should inactive leads fall off the map automatically after six months of no order, or only by filter toggle? | Don Hearn / Field Ops | Open |
| `OQ-MOBILE-003` | Should the Consignment to Enroll mini-pipeline be its own screen or part of account detail? | Product / Adrienne Cardinale | Open |
| `OQ-MOBILE-004` | Which training type enum drives the app: admin-managed catalog or hard-coded list? | Architecture / Training Ops | Open |
| `OQ-MOBILE-005` | Has Firebase been selected for push, or is a managed push service preferred for Expo SDK 51? | Architecture | Open |
| `OQ-MOBILE-006` | Will the Consignment to Enroll flow always require Acumatica warehouse pre-creation, or is there an exception path for net-new customers? | Samantha Marks / Ops | Open |

### REPORTING_REQUIREMENTS_MASTER.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-RPT-001` | What is the exact minimum order value threshold for the `active account` definition? | Executive / Michelle Hogan | Open |
| `OQ-RPT-002` | Will the 20-year QuickBooks historical data be imported in Phase 1 or deferred? | Dan Harshbarger / Architecture | Open |
| `OQ-RPT-003` | Should commercial sales data be visible in the Phase 1 report builder to authorized users, or filtered out even for executives? | Dan Harshbarger / Product | Open |
| `OQ-RPT-004` | Which field defines `lost account`: last order date threshold, explicit TM status, or both? | Michelle Hogan / Sales Ops | Open |
| `OQ-RPT-005` | Will the website lead form embed code be styled per brand, and if so are brand tokens admin-configured or developer-managed? | Johan Ericsson / Michelle Hogan | Open |
| `OQ-RPT-006` | Is form-level analytics captured by Pulse or by a third-party analytics layer, and how does it flow into the reporting read model? | Architecture / Ahmad | Open |

### TRAINING_MANAGEMENT_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-TM-01` | Exact training cadence requirements per type? | Training Ops | Open |
| `OQ-TM-02` | Should Outlook sync be real-time or batch every 15 minutes? | Architecture | Open |
| `OQ-TM-03` | Is IAQ Certification internal or external? | Training Ops | Open |
| `OQ-TM-04` | Is contest and incentive budget tracking needed? | Sales Leadership | Open |
| `OQ-TM-05` | Should video recordings of WebEx sessions be stored in Pulse? | Architecture | Open |
| `OQ-TM-06` | Do technician attendees become full CRM contacts or a lighter participant record? | Product + Ops | Open |
| `OQ-TM-07` | Does the existing external training and certification website remain in Phase 1, or is part of that experience replaced in Pulse? | Training Ops + Product | Open |
| `OQ-TM-08` | How deep does Phase 1 training catalog governance go: standard catalog plus custom presentations, or full TM-specific curriculum management? | Training Ops | Open |
| `OQ-TM-SUPP-001` | What is the complete canonical list of 16-20 standard training types? | Training Ops | Open |
| `OQ-TM-SUPP-002` | Is `Comfort Advisor` a training type or a role descriptor? | Training Ops / Product | Open |
| `OQ-TM-SUPP-003` | For the Friday reconciliation elimination goal, what is the minimum check-out data set required? | CG / Field Ops | Open |
| `OQ-TM-SUPP-004` | Sessions imply near-real-time Outlook sync. Has that actually been confirmed with architecture? | Architecture | Open |
| `OQ-TM-SUPP-005` | Do Regional Directors need a training coverage gap view showing accounts not trained in 90 days? | Product / Field Ops | Open |

### TERRITORY_MANAGEMENT_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-TR-01` | Is district level in the hierarchy actually used? | Don Hearn | Open |
| `OQ-TR-02` | Route optimization provider: Google, OSRM, or MapBox? | Architecture | Open |
| `OQ-TR-03` | GPS check-in radius tolerance: 100m or 500m? | Ops | Open |
| `OQ-TR-04` | Should territory boundaries be polygon-based or state and zip based? | Architecture | Open |
| `OQ-TR-05` | Canada territory model: separate regions? | Sales Leadership | Open |
| `OQ-TR-06` | Should route optimization honor planned stop duration exactly or allow soft compression of low-priority stops? | Ops + Product | Open |
| `OQ-TR-07` | What is the precedence rule between Strategic Growth ownership and default TM geography assignment? | Sales Leadership + Don Hearn | Open |
| `OQ-TR-A01` | What is the exact precedence rule between Strategic Growth ownership and default TM geography assignment? | Sales Leadership + Don Hearn | Open |
| `OQ-TR-A02` | At what point in the lifecycle does territory and TM assignment become operationally binding? | Sales Leadership + Michelle Hogan | Open |
| `OQ-TR-A03` | Can a customer carry multiple affinity-group contexts for territory and reporting, or must one primary group be chosen? | Sales Leadership + Michelle Hogan | Open |
| `OQ-TR-A04` | Should territory and customer views prioritize management and decision-maker contacts above technicians and service users? | Product + Don Hearn | Open |
| `OQ-TR-A05` | Does the Phase 1 canonical territory model need county-level commercial support even if the first UI stays residential and state first? | Dan Harshbarger + Architecture | Open |
| `OQ-TR-A06` | What threshold defines a territory-level training and compliance exception: 30, 60, or 90 days? | Sales Leadership + Don Hearn | Open |
| `OQ-TR-A07` | Should route optimization provider choice and GPS radius tolerance stay PRD-level decisions, or move to technical design after workflow sign-off? | Product + Architecture | Open |

### DIGITAL_ASSETS_DOCUMENTS_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-DA-01` | Storage provider: S3, Azure Blob, or Cloudflare R2? | Architecture | Effectively answered; closure candidate |
| `OQ-DA-02` | Max file size limit: 50MB, 100MB, videos? | Architecture | Open |
| `OQ-DA-03` | Which Widen behaviors must Phase 1 preserve, and what is the expected replacement or coexistence timeline? | Marketing + CG | Open; should be narrowed into `OQ-DA-A02` |
| `OQ-DA-04` | Should dealers be able to request assets not in their scope? | Product | Open |
| `OQ-DA-05` | In Phase 1, do we build a full dealer/customer-facing asset portal or start with internal quick-share plus curated authenticated collections? | Marketing + Product | Open |
| `OQ-DA-A01` | How will existing Widen-linked URLs be redirected, mapped, or preserved during migration to Pulse-managed stable URLs? | Marketing + Architecture | Open |
| `OQ-DA-A02` | Which Widen behaviors are mandatory for Phase 1 parity? | Marketing + CG | Open |
| `OQ-DA-A03` | Does Phase 1 require a full dealer/customer-facing asset portal, or only curated authenticated collections plus internal quick-share workflows? | Marketing + Product | Open |
| `OQ-DA-A04` | What replacement and conflict-resolution workflow is required when a newer asset version supersedes an existing linked asset? | Johan Ericsson + Marketing | Open |
| `OQ-DA-A05` | What file-size, version-retention, and lifecycle policy applies to large binaries such as videos and multi-version collateral? | Architecture + Marketing | Open |

### PRODUCT_MANAGEMENT_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-PM-A01` | What is the approved migration and stewardship path for product descriptions and images where Acumatica does not hold dealer-ready content? | Dan Harshbarger + Product + Marketing | Open |
| `OQ-PM-A02` | What precedence rule applies when a dealer belongs to overlapping affinity, ownership, private-label, or account-tier contexts and product visibility rules conflict? | CG + Michelle Hogan | Open |
| `OQ-PM-A03` | What pricing, if any, should appear on neutral Product Management screens versus account-context screens? | CG + Dan Harshbarger | Open |
| `OQ-PM-A04` | Does Phase 1 require default asset inheritance when a brand-specific brochure or image is missing, or should readiness block publication until the override exists? | Marketing + Product | Open |
| `OQ-PM-A05` | What are the exact dealer-portal readiness criteria, approval owner, and rollback rules when a published product has the wrong brand, file, or visibility rule? | Product + Marketing + Portal Admin | Open |
| `OQ-PM-A06` | What is the decision rule for collapsing Shopify variant rows into Pulse product families versus keeping them distinct sellable items? | Dan Harshbarger + Product | Open |
| `OQ-PM-A07` | Are PDF and spreadsheet exports in this module limited to catalog and price-sheet outputs, or do broader dynamic reporting needs move to Reporting? | CG + Product + Reporting | Open |

### ACUMATICA_INTEGRATION_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-ACI-A01` | What is the exact operational trigger for creating and syncing the Acumatica customer record? | CG + Samantha | Open |
| `OQ-ACI-A02` | What Acumatica API capabilities are confirmed for the target build: field inventory, webhook support, changed-since or CDC support, rate limits, authentication constraints? | Dan Harshbarger + Integration Team | Open |
| `OQ-ACI-A03` | If webhooks are unavailable, what is the maximum acceptable latency for credit-hold, invoice, and order-status visibility in Pulse? | Finance + Operations | Open |
| `OQ-ACI-A04` | What is the signed conflict-resolution rule when CRM and Acumatica differ on customer name, address, or contact changes? | Finance + CRM Admin | Open |
| `OQ-ACI-A05` | What is the migration plan from current PDF or manual card capture to tokenized payment handling, and must that cutover be complete before go-live? | Finance + Security + Product | Open |
| `OQ-ACI-A06` | Should pricing integration optimize for annual batch refresh plus manual pull, or keep nightly sync and on-demand publish? | Pricing + Dan Harshbarger | Open |
| `OQ-ACI-A07` | Who approves consignment audit baselines and variance corrections, and what must be written back to Acumatica versus kept only in Pulse history? | Operations + Finance + Samantha | Open |

### ALERTS_NOTIFICATIONS_COMMUNICATION_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-AN-A01` | What are the approved SLA windows for lead, onboarding, finance, and admin handoff alerts before escalation begins? | Michelle Hogan + CG | Open |
| `OQ-AN-A02` | What reminder cadence is required for consignment and other deadline-based workflows: single warning, multi-step warnings, or configurable per alert type? | Samantha + Don Hearn | Open |
| `OQ-AN-A03` | What exact credit-status states must trigger alerts in Pulse? | Finance + Ops | Open |
| `OQ-AN-A04` | Which alerts must always break through immediately, and which may be batched into digests or quiet-hour delivery? | CG + Michelle Hogan | Open |
| `OQ-AN-A05` | What constitutes acknowledgment for escalation tracking: open, read, explicit acknowledge, or only resolution of the underlying issue? | Product + Architecture | Open |
| `OQ-AN-A06` | What threshold defines training inactivity exceptions, and does it vary by training type, lifecycle stage, or touchpoint inactivity? | Adrienne Cardinale | Open |
| `OQ-AN-A07` | When a discrepancy case or missing-PO alert is raised, what is the official closure trigger and handoff order between TM, RD, Ops, and Finance? | Samantha + Ops | Open |
| `OQ-AN-A08` | What push-notification and quiet-hour expectations are acceptable for field users on mobile for P0 versus P1 alerts? | Don Hearn + Product | Open |

### FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-01` | MFA mandatory for field team TMs? | CISO + Product | Open |
| `OQ-02` | Dealer user SSO federation? | Product + Architecture | Open |
| `OQ-03` | API key rotation automatic or manual? | Architecture | Open |
| `OQ-04` | Password expiration for field users? | CISO + Ops | Open |
| `OQ-05` | Multi-brand support in Phase 2? | Product | Open |
| `OQ-06` | Session timeout enforcement: same device only or any IP change? | CISO | Open |
| `OQ-07` | Audit log storage: same DB or separate? | Architecture | Open |
| `OQ-08` | Feature flag vendor or custom? | Architecture | Open |

### FOUNDATION_SECURITY_ADMIN_PRD.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-FA-01` | MFA for all internal users or just admins? | Security + CG | Open |
| `OQ-FA-02` | Should dealer users have MFA option? | Product | Open |
| `OQ-FA-03` | Entra ID group naming convention? | IT | Open |
| `OQ-FA-04` | Audit log storage: same DB or separate? | Architecture | Open |
| `OQ-FA-05` | Feature flag vendor or custom implementation? | Architecture | Open |
| `OQ-FA-06` | Which delegated leaders receive broad admin authority in Phase 1? | Product + CG | Open |
| `OQ-FA-07` | Do geo and IP restrictions apply to all production access or only privileged roles? | Security + IT | Open |
| `OQ-FA-08` | Which hosted payment and tokenization provider will be used for finance-sensitive forms? | Finance + Architecture | Open |
| `OQ-FA-A01` | Which named leaders receive delegated admin authority in Phase 1, and what exact actions are in or out of scope? | CG + Product | Open |
| `OQ-FA-A02` | What external consultant or read-only support access model is approved? | CG + Security | Open |
| `OQ-FA-A03` | What sandbox model is approved for downstream integration work, and who provisions it? | Dan Harshbarger + Security | Open |
| `OQ-FA-A04` | Which internal roles must use MFA at launch, and is enforcement inherited from Entra or implemented as a Pulse-specific rollout? | IT + Security + CG | Open |
| `OQ-FA-A05` | What is the break-glass access procedure if Entra and SSO are unavailable, and who owns credential rotation and audit review? | IT + Security | Open |
| `OQ-FA-A06` | Do geo and IP restrictions apply to all production access or only privileged roles, and how are travel and VPN scenarios handled? | Security + IT | Open |
| `OQ-FA-A07` | When account ownership changes, do all historical notes, trainings, audits, and activities remain tied to the original actor? | Ops + Product | Open |
| `OQ-FA-A08` | Can account ownership differ from territory assignment in Phase 1, or must every account have exactly one operational owner? | Don Hearn + CG | Open |

### PRD_SUPPLEMENTS.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-SUP-01` | Minimum order value for portal checkout? | Sales Leadership | Open |
| `OQ-SUP-02` | Should cart be shared across users at the same account? | Product | Open |
| `OQ-SUP-03` | French language support for Canadian dealers in Phase 2? | Product | Open |
| `OQ-SUP-04` | Should Outlook attendee responses sync back to Pulse? | Product | Open |
| `OQ-SUP-05` | Audio file upload for voice notes in Phase 2? | Architecture | Open |
| `OQ-SUP-06` | Custom vocabulary or dictionary for speech recognition? | Product | Open |
| `OQ-SUP-07` | Report output retention period; 90 days proposed? | Ops | Open |

## Architecture Open Questions

### AUTH_IMPLEMENTATION_GUIDE.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-AUTH-01` | Should dealer portal support `Remember me` and extend refresh token to 30 days? | Product | Open |
| `OQ-AUTH-02` | Is email verification required for dealer self-registration if enabled? | Product | Open |
| `OQ-AUTH-03` | Should MFA be mandatory for all internal users or only admin and finance roles? | Security | Open |
| `OQ-AUTH-04` | Should mobile support biometric re-auth for sensitive operations like order placement or audit completion? | Mobile Lead | Open |
| `OQ-AUTH-05` | Should Phase 2 support dealer portal SSO such as Entra ID B2C? | Architecture | Open |

### API_CONTRACT_SPECIFICATION.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-API-01` | WebSocket for real-time notifications or polling? | Architecture | Open |
| `OQ-API-02` | GraphQL for Customer 360, or REST with includes? | Architecture | Open |
| `OQ-API-03` | File upload size limits: 50MB, 100MB, video exceptions? | Architecture | Open |
| `OQ-API-04` | API versioning strategy for dealer-portal backward compatibility? | Architecture | Open |
| `OQ-API-05` | Rate limiting per endpoint or per module? | Architecture | Open |
| `OQ-API-06` | Final business-segment classification rules and owner for residential, commercial, distributor, and mixed exceptions? | Architecture + Business | Open |

### JOB_WORKER_EXECUTION_PATTERN.md

| ID | Question | Owner | Status / Note |
|---|---|---|---|
| `OQ-JOB-01` | Should workers run as separate Docker containers or the same container with a different process? | DevOps | Open |
| `OQ-JOB-02` | What are the actual Acumatica rate limits, and do sync jobs need throttling? | Integration Lead + Acumatica SME | Open |
| `OQ-JOB-03` | Outlook sync: per-user or batch, and how does per-user scale for 50+ users? | Architecture | Open |
| `OQ-JOB-04` | Should KPI snapshots use materialized views or compute on demand? | Architecture | Open |
| `OQ-JOB-05` | Email provider choice: SendGrid, AWS SES, or SMTP relay? | Ops | Open |

### MESSAGE_QUEUE_AND_ASYNC_PATTERN.md

These items are open in the source file but are not assigned formal `OQ-*` IDs there.

| Local Ref | Question | Owner | Status / Note |
|---|---|---|---|
| `MQ-UQ-01` | Should we use separate worker services that pull from the queue, or embedded workers inside the main app? | Architecture / DevOps | Open |
| `MQ-UQ-02` | Should job results be stored for audit, or discarded after a fixed number of days? | Architecture | Open |
| `MQ-UQ-03` | Do we need job prioritization within a queue? | Architecture | Open |
| `MQ-UQ-04` | Which service owns final business-segment classification rules when Acumatica and Pulse context disagree? | Architecture + Business | Open |
| `ADR-MQ-01` | Should circuit breaker behavior be implemented at the Acumatica client level or at the job-handler level? | Backend Lead / Integration Lead | Open ADR |
| `ADR-MQ-02` | Should Acumatica client isolation be per-job, pooled, or moved to stateless OAuth? | Integration Lead | Open ADR |
| `ADR-MQ-03` | Should Pulse expose a webhook receiver endpoint that enqueues inbound Acumatica events, and if so which queue tier should own it? | Architecture / Integration Lead | Open ADR |
| `ADR-MQ-04` | When should embedded workers be extracted into a separate worker service? | Architecture / DevOps | Open ADR |

### SECURITY_AND_SECRETS_ARCHITECTURE.md

These items are open in the source file but are not assigned formal `OQ-*` IDs there.

| Local Ref | Question | Owner | Status / Note |
|---|---|---|---|
| `SEC-UQ-01` | Should we implement HSM-backed key storage for launch, or defer until PCI or higher security requirements force it? | Security / Architecture | Open |
| `SEC-UQ-02` | Should API keys be IP-whitelisted, and where does that differ between backend integrations and mobile usage? | Security / Architecture | Open |
| `SEC-UQ-03` | Should mobile implement certificate pinning, and what is the safe certificate-update process? | Security / Mobile | Open |
| `SEC-UQ-04` | How should shared-account or shared-device scenarios be handled for TMs? | Product / Security | Open |
| `ADR-SEC-03` | What is the approved Key Vault to runtime secret-injection mechanism for Acumatica credentials and other secrets? | DevOps / Architecture | Open ADR |

### PROJECT_IMPLEMENTATION_NETWORK_DIAGRAM.md

These items are open decisions in the source file but are not assigned formal `OQ-*` IDs there.

| Local Ref | Question | Owner | Status / Note |
|---|---|---|---|
| `NET-OD-01` | Final ERP customer and account creation trigger | Architecture + Product | Open |
| `NET-OD-02` | Payment-provider pattern and final PCI boundary | Architecture + Finance | Open |
| `NET-OD-03` | Widen coexistence versus replacement boundary | Product + Marketing + Architecture | Open |
| `NET-OD-04` | Dealer-group model versus price-class separation in final design | Product + Pricing + Architecture | Open |
| `NET-OD-05` | Final KPI definition set for readiness, active account, training, and consignment metrics | Product + Ops + Reporting | Open |
| `NET-OD-06` | Historical data migration cut line for reporting | Product + Architecture + Dan Harshbarger | Open |
| `NET-OD-07` | Exact business-segment classification rules for residential, commercial, distributor, and mixed accounts | Product + Architecture + Business | Open |

## Review Notes

- This register is intentionally a consolidation layer, not a replacement for source PRDs and architecture docs.
- If a source document formally closes an item, update that source first and then update this register.
- If multiple IDs are really the same business decision, prefer one owner decision with explicit downstream impact notes rather than closing items independently without traceability.
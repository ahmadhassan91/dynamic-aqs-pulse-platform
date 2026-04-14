# Pricing, Dealer Groups, Affinity, Ownership, And PE Implementation Guide

## Document Control
| Field | Value |
|-------|-------|
| Document Type | Source of Truth Guide |
| Version | 1.0 |
| Status | Active |
| Owner | Product / Architecture / Pricing Ops |
| Scope | Pricing classes, dealer groups, affinity groups, ownership / PE overlays, portal visibility, ERP boundaries |
| Primary Sources | `Meetings/18 feb 2026 Discovery session 2.md`, `Meetings/02 March session 7 Discovery - Delaer Portal.md`, `prds/PRICING_COMMERCIAL_RULES_PRD.md`, `prds/DEALER_PORTAL_ENHANCEMENT_PLAN.md`, `architecture/SYSTEM_ERD_BLUEPRINT.md` |

---

## 1. Why This Guide Exists

These concepts were discussed across multiple discovery sessions and artifacts, but they are easy to confuse:

- `Affinity group`
- `Ownership group / PE`
- `Dealer group`
- `Price class`
- `Brand / private label`

If the team collapses these into one field or one setup step, the system will show the wrong catalog, wrong files, wrong branding, or wrong prices.

This guide is the simple implementation rulebook for development and integration.

---

## 2. Executive Summary

### The 3 rules the dev team must remember

1. `Dealer group != price class`
2. `Affinity / ownership are raw classifications, not final portal context`
3. `Portal price != final invoice price`

### The intended resolution chain

```text
Raw account attributes
  -> resolve dealer group
  -> map dealer group to default price class
  -> load approved portal prices
  -> show catalog/files/branding from dealer group
  -> receive final invoice truth from Acumatica
```

### One-sentence explanation of each concept

- `Affinity group`: buying/coaching/community membership such as Nexstar, CertainPath, EGIA, local affiliates, or independents.
- `Ownership group / PE`: common-owner or PE overlay such as Redwood or Apollo.
- `Dealer group`: the system-resolved visibility context used for catalog, files, and branded experience.
- `Price class`: the ERP-aligned pricing tier used to resolve what the dealer pays.
- `Brand / private label`: the presentation layer that changes naming, assets, and visual treatment without changing the base SKU.

---

## 3. What Discovery Established

### Pricing classes

- Pricing truth is ERP-governed. Acumatica owns customer class, price class, and final invoice truth.
- Discovery identified roughly `34` active price classes overall, with about `30` used in residential scope.
- Unknown or not-yet-classified accounts fall back to a governed generic/default residential class.
- About `81%` of accounts use generic pricing today.
- Pricing is not meant to be recalculated by calling ERP on every portal action. The operating model is controlled publish or nightly/manual batch sync.
- Pricing uses wildcard / rule-based generation today, where a smaller maintained ruleset expands into thousands of effective prices.

### Dealer groups

- Dealer group is not a legacy source field. It is a resolved business context.
- Dealer group is used for:
  - catalog visibility
  - asset/file visibility
  - branded portal experience
  - product presentation context

### Affinity and ownership / PE

- Affinity groups and ownership groups are separate axes.
- They must both be preserved because one account can carry both.
- They are needed for:
  - dealer group resolution
  - reporting
  - commercial / rebate context
  - future governance

### Brand / private label

- Brand or private label affects presentation, not core product identity.
- The same underlying SKU may be presented differently depending on dealer group and label rules.

### Rebate boundary

- Complex rebate and compound membership logic remains outside Pulse.
- Pulse should not become the rebate engine.

---

## 4. The Canonical Model

| Concept | What it is | What it controls | What it must NOT control |
|---------|------------|------------------|---------------------------|
| `AffinityGroup` | Buying / coaching / network membership | Reporting, dealer-group resolution inputs, attribution | Final pricing by itself |
| `OwnershipGroup` | PE / common-owner overlay | Reporting, dealer-group resolution inputs, commercial context | Catalog by itself |
| `BrandLabel` | Brand / private-label presentation context | Names, assets, visual treatment | ERP SKU identity |
| `DealerGroup` | Resolved dealer-facing visibility context | Catalog, files, branding, asset scope | Final invoice pricing |
| `PriceClass` | ERP-aligned pricing tier | Portal base price resolution, tier reporting | Catalog visibility |
| `CustomerClass` | ERP account classification | Finance / ERP behavior | Dealer-facing catalog rules |

---

## 5. Simple Resolution Logic

### Step 1. Capture raw business attributes on the account

Store and maintain:

- `affinityGroupId`
- `ownershipGroupId`
- `brandLabelId` or private-label eligibility
- `region`
- `country / currency context`
- `portalEligible`
- `companyType`
- `businessSegment`
- `customerClass`
- `priceClassId` from ERP

### Step 2. Resolve dealer group

Use this rule:

```text
affinity + ownership + region + portal eligibility + brand/private-label context
  => dealer group
```

This result should be persisted, not recomputed invisibly in the UI.

### Step 3. Resolve price class

Use this rule:

```text
account context / dealer group
  -> default price class
  -> explicit override allowed with audit
  -> fallback to generic/default class if unresolved
```

ERP remains authoritative for the final assigned pricing tier.

### Step 4. Build the dealer experience from 2 independent layers

- `Dealer group` drives:
  - catalog visibility
  - digital asset/file visibility
  - branded presentation
- `Price class` drives:
  - displayed base price
  - cart pricing
  - price-tier reporting

### Step 5. Receive final invoice truth from ERP

The portal shows a base/pre-invoice price. Acumatica returns final invoice truth after:

- shipping
- tax
- surcharge
- discounts
- finance-driven adjustments

---

## 6. What The Database Should Preserve

The current architecture is already pointing in the right direction. Development should preserve these entities as separate masters:

- `AffinityGroup`
- `OwnershipGroup`
- `BrandLabel`
- `DealerGroup`
- `DealerGroupRule`
- `AccountDealerContext`
- `PriceClass`
- `PriceBook`
- `PriceEntry`
- `AccountPriceAssignment`

### Minimum practical schema rule

Do not use one generic `group` field.

Instead:

- store raw classification inputs
- persist resolved dealer context
- persist price assignment separately
- keep product identity separate from presentation

---

## 7. Product, Catalog, And Asset Rules

### Product identity

- One base product / SKU should stay neutral.
- Do not duplicate SKUs per affinity or per label.

### Presentation

Use presentation and asset layers to vary:

- display name
- brochures
- manuals
- imagery
- brand treatment
- file availability

### Catalog inclusion

Catalog and file access should be driven by `dealer group`, not by `price class`.

---

## 8. Pricing Rules For Development

### What Pulse should do

- store price classes
- store price entries
- sync price books from ERP
- support controlled publish cadence
- show base/pre-invoice portal prices
- track override and history
- support USD and CAD separation

### What Pulse should not do

- calculate final invoice truth
- calculate complex rebate logic
- depend on real-time ERP calls for every portal price lookup
- merge US and Canada into one price context

### Wildcard pricing note

Discovery makes it clear the business maintains a smaller pricing ruleset that expands into a much larger resolved price set. Phase 1 development should therefore support one of these patterns cleanly:

1. Pulse imports the resolved outputs from the existing wildcard process, or
2. Pulse later gains a governed rule-expansion capability

Phase 1 does not need to pretend these thousands of prices are maintained manually one by one.

---

## 9. Affinity, Ownership, And PE Guidance

### Affinity groups

These are operationally meaningful, not just labels for reports.

They may:

- drive dealer-group resolution
- influence branded experience
- feed reporting and market-penetration analysis
- arrive as periodic roster imports

### Ownership / PE groups

These are an overlay, not a replacement for affinity.

They may:

- affect reporting
- affect classification/governance
- affect commercial treatment
- coexist with the same account's affinity membership

### Roster imports

Affinity and ownership source data should be stewarded imports with:

- source file / source system
- effective date
- version
- active / inactive flag
- match confidence
- history

---

## 10. Reporting Dimensions That Must Exist

Reporting should treat these as first-class dimensions:

- affinity group
- ownership / PE group
- franchise / independent
- dealer group
- price class
- region
- location
- business segment
- currency

This is required for:

- YoY sales by affinity
- PE / ownership performance
- location-by-location analysis
- market penetration against imported rosters
- price-tier performance

---

## 11. Integration Boundaries

### Acumatica owns

- customer class
- price class truth
- final invoice amount
- finance-driven adjustments
- rebate / settlement accounting

### Pulse owns

- account operational context
- affinity / ownership / brand reference data
- dealer-group resolution
- product presentation and catalog visibility
- file / asset visibility
- portal-facing base price resolution
- override audit and governance workflows

---

## 12. Known Risks And Common Mistakes

### Mistake 1. Using one field called `group`

This causes:

- wrong catalog visibility
- wrong files
- wrong branding
- wrong reporting
- no clean PE overlay support

### Mistake 2. Using dealer group as the pricing tier

This causes:

- pricing logic to bleed into product/catalog logic
- difficulty handling overrides
- difficulty staying aligned to ERP

### Mistake 3. Using price class to drive catalog visibility

This is backwards. Price class is for pricing. Dealer group is for experience and visibility.

### Mistake 4. Repricing through ERP on every action

This creates:

- fragile checkout
- latency
- unnecessary ERP coupling

### Mistake 5. Putting rebate logic into Pulse

This creates a finance and reconciliation problem that discovery explicitly avoided.

---

## 13. Recommended Development Order

1. Build the reference masters:
   - affinity groups
   - ownership groups
   - brand labels
   - dealer groups
   - price classes
2. Build account raw-classification capture and stewardship.
3. Build dealer-group rule management and resolved-context persistence.
4. Build dealer-group to default price-class mapping and override history.
5. Build price-book / price-entry sync with controlled publish.
6. Build portal catalog and asset filtering by dealer group.
7. Build portal price resolution by price class and currency.
8. Build roster import/versioning for affinity and ownership sources.
9. Build reporting dimensions and validation cases.

---

## 14. Representative Test Matrix

Before pilot, test accounts should cover:

- affinity vs no affinity
- ownership overlay vs none
- independent vs franchise
- branded/private-label vs generic
- US vs Canada
- default price class vs manual override
- portal eligible vs not eligible

At least one test case should include mixed or odd classification so the team validates exception handling instead of assuming every account is clean.

---

## 15. Open Questions To Close During Design

- Which ERP price classes are truly active in Phase 1?
- Does Phase 1 consume wildcard pricing outputs only, or also author them?
- What exact override authority exists for dealer-group changes vs price-class changes?
- What exact Canada scope is active in Phase 1?
- Which affinity and ownership rosters are authoritative and how often do they refresh?

---

## 16. Final Implementation Rule

Use this mental model:

```text
Affinity / Ownership / Brand / Region / Eligibility
  are inputs

Dealer Group
  is the resolved experience context

Price Class
  is the resolved pricing context

Acumatica
  is final financial truth
```

If the system follows that model, pricing, portal visibility, product presentation, reporting, and integration will stay clean.

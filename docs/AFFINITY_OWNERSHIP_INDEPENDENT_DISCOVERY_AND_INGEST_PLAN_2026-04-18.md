# Affinity, Ownership, And Independent Discovery And Ingest Plan

Date: 2026-04-18

## Why This Matters

Dynamic AQS does not treat `Affinity Group`, `Ownership Group`, and `Independent` as optional tags.

They are core operating classifications used to:
- understand who a contractor learns from or belongs with
- understand who owns the contractor financially
- segment accounts for reporting, dealer context, and downstream pricing/rebate interpretation
- reconcile monthly / quarterly roster imports
- preserve correct context from lead through CIS and customer activation

Today Pulse stores affinity and ownership as free-text strings on the lead, with no governed master-data model behind them. That is not enough for production.

## Discovery Summary

### What the business means by each term

From `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md`:
- affinity groups are broader membership / best-practice / buying / franchise-like groups, not just one narrow category
- ownership groups are private-equity or common-ownership structures
- a contractor can belong to both
- a contractor can belong to neither and still be valid as `Independent`

Evidence:
- `18 feb 2026 Discovery session 2.md:1549` says there are membership-based affinity groups, franchises, and common ownership groups
- `18 feb 2026 Discovery session 2.md:1558` says an ownership group is a private equity fund
- `18 feb 2026 Discovery session 2.md:1573` says they can be in different affinity groups, or no affinity group, and still be part of an ownership group
- `18 feb 2026 Discovery session 2.md:1579` says they need to track both

From `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/20 Feb session 3 _ Discovery session 3 _ Validations.md`:
- the business thinks of this as dual-layer segmentation: who they learn from versus who owns them
- `Independent` is not a missing value; it is a real classification bucket and the largest one

Evidence:
- `20 Feb session 3 _ Discovery session 3 _ Validations.md:557` says they need affinity groups and ownership groups as separate layers
- `20 Feb session 3 _ Discovery session 3 _ Validations.md:569` says the middle overlap is real and growing
- `20 Feb session 3 _ Discovery session 3 _ Validations.md:593` says `Independent` completes the model
- `20 Feb session 3 _ Discovery session 3 _ Validations.md:595` says independence is their largest bucket

### Operational behavior discovered in meetings

From `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md`:
- affinity and ownership are currently set up inside the CRM
- if they do not know the value yet, they use `Unknown`
- new groups are added over time inside the CRM
- affinity lists arrive on a recurring basis and need reconciliation

Evidence:
- `18 feb 2026 Discovery session 2.md:1468` says affinity and ownership are set up in CRM and if unknown they enter `Unknown`
- `18 feb 2026 Discovery session 2.md:1473` confirms new ownership groups and affinity groups are added over time
- `18 feb 2026 Discovery session 2.md:1486` says affinity groups have a code and a description
- `18 feb 2026 Discovery session 2.md:1507` shows ownership groups as their own list
- `18 feb 2026 Discovery session 2.md:1402` and `1408` describe periodic affinity-group lists and manual reconciliation
- `18 feb 2026 Discovery session 2.md:1432` confirms the source lists are messy and can contain overlaps

From `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md`:
- a lot of leads come in from affinity-group lists
- they do this quarterly today
- Clustox’s mapped import approach was explicitly liked because incoming list formats differ

Evidence:
- `13th March Discovery Session 9.md:219` says a lot of leads come from the affinity group list
- `13th March Discovery Session 9.md:399` says they do this every quarter
- `13th March Discovery Session 9.md:419` says the mapping mechanism is needed because all formats differ

From `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/Adding a customer.docx.md`:
- during customer setup, affinity and PE context are explicitly part of the operator checklist
- default tendency is often `Independent`, but staff are expected to check CIS and override when needed

Evidence:
- `Adding a customer.docx.md:37` says `Private equity if known`
- `Adding a customer.docx.md:38` says affinity is typically independent when adding a customer, but staff must check the CIS if it says otherwise

### What should stay out of CRM

The meetings also make it clear that rebate calculation itself should not be implemented in CRM. CRM should reflect the classification state, not perform the accounting math.

Evidence:
- `Fri 27th  Feb Session 6.md:316` says CRM should reflect the rebate program, not perform the processing
- `Fri 27th  Feb Session 6.md:680` says compound rebate logic stays outside CRM

## Current Implementation Reality

Pulse is only partially ready here.

### What exists

- leads already have free-text `affinityGroupName` and `ownershipGroupName`
- import mapping already recognizes affinity and ownership columns
- lead readiness already has checklist concepts for validating affinity and ownership
- CIS draft population already carries those strings forward

Evidence in repo:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/schema.prisma:1151`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/schema.prisma:1152`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/file-ingest.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/readiness.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts`

### What is missing

- no governed `AffinityGroupRef` table
- no governed `OwnershipGroupRef` table
- no admin CRUD/import for either master list
- no lead/account foreign keys to governed master records
- no explicit `Independent` / `Unknown` controlled defaults in master data
- no roster-import model tied to affinity or ownership membership ingestion
- manual lead intake still silently defaults missing values instead of forcing explicit classification behavior
- customer/account model still does not carry governed affinity/ownership context

## Recommended Canonical Model

### Business semantics

Use these as the production rules:

1. `Affinity Group`
   - membership / best-practice / buying / franchise-style grouping
   - answers: who they learn with / align with

2. `Ownership Group`
   - private-equity / parent-owner / portfolio grouping
   - answers: who owns them

3. `Independent`
   - explicit valid classification, not a null
   - means no known affinity-group membership and no known ownership-group alignment for that lane

4. `Unknown`
   - temporary operator-safe placeholder
   - allowed when intake cannot determine the correct classification yet
   - must be visible for later steward correction

### Data modeling rule

Do not collapse affinity and ownership into one generic text label.

Keep:
- separate governed reference tables
- separate foreign keys on lead and account
- separate display snapshots for audit/history resilience if needed

## Ingest Plan

### Phase A: Govern the master data

Create two dedicated reference entities:
- `AffinityGroupRef`
- `OwnershipGroupRef`

Each should support:
- `code`
- `name`
- `description`
- `isActive`
- `sortOrder`
- `sourceSystem`
- `externalReferenceId` or equivalent source identifier when available
- audit history

Seed system rows on day one:
- `independent`
- `unknown`

Why dedicated tables instead of only reusing free-text or a generic label list:
- affinity groups and ownership groups have different semantics
- both will need imports and lifecycle stewardship
- both will later drive reporting, dealer-context resolution, and migration reconciliation

### Phase B: Attach governed references to lead and account

Add to `Lead`:
- `affinityGroupId`
- `ownershipGroupId`

Keep the current string fields temporarily during migration/backfill:
- `affinityGroupName`
- `ownershipGroupName`

Then migrate the write path so:
- new writes resolve to governed ids
- snapshot strings remain aligned for history/export compatibility

Add to `Account`:
- `affinityGroupId`
- `ownershipGroupId`
- optional snapshot/display fields if needed for operational exports

This is important because the meetings and customer documents make it clear these classifications matter after conversion too, not only at lead intake.

### Phase C: Fix intake behavior

For manual internal lead intake:
- require explicit affinity and ownership selection
- do not silently backfill blanks to `Independent`

Allowed safe choices at intake:
- governed group value
- `Independent`
- `Unknown`

For public / website lead capture:
- do not block public form submission on unknown operator-only classifications
- stamp explicit governed fallback values such as `Unknown`
- surface those for later internal review instead of leaving them blank

For imports:
- mapping must support both fields
- import review should show when one or both are missing
- import can apply a steward-selected fallback of `Unknown` or `Independent` per run when the source file lacks the column

### Phase D: Build the roster ingestion lane

There are two ingestion problems here:

1. master list ingest
   - load the governed affinity and ownership reference lists themselves

2. roster membership ingest
   - load periodic member rosters that indicate who currently belongs to a given group

Those should be modeled separately.

Recommended:
- `AffinityRosterImportRun`
- `AffinityRosterImportRow`
- later, if needed, similar ownership roster imports if they also arrive as changing membership sheets

The roster import lane should support:
- CSV/XLSX mapping
- source-file/date/version tracking
- steward review
- dedupe against existing leads/accounts
- match-by-name/company/address heuristics
- flagging of ambiguous or conflicting matches

### Phase E: Use it in downstream modules

Once governed references are live, wire them into:
- lead intake and import
- CIS auto-population
- customer conversion
- customer/account detail
- territory/account summaries where useful
- reporting filters
- dealer-context resolution later

Keep one important boundary:
- use these classifications to reflect business context
- do not implement rebate-calculation logic inside CRM

## Proposed Delivery Sequence

### Slice 1: classification master-data foundation

Build:
- schema for `AffinityGroupRef` and `OwnershipGroupRef`
- seed `Independent` and `Unknown`
- admin list/create/update/deactivate/import APIs
- basic admin UI for reference management

### Slice 2: lead intake enforcement

Build:
- manual lead intake requires explicit affinity + ownership choices
- website capture defaults to explicit `Unknown`
- import review highlights missing classification data
- regression coverage for allowed and denied paths

### Slice 3: account propagation

Build:
- lead-to-account propagation of governed affinity and ownership references
- customer detail surfaces for editing and correcting them
- audit and history for changes

### Slice 4: roster membership ingest

Build:
- mapped roster import
- import-run history
- steward correction queue
- company/account/lead matching assistance

### Slice 5: reporting and downstream use

Build:
- affinity and ownership filters in reports
- account/lead segmentation views
- reporting-ready read models without embedding rebate math in CRM

## What We Can Implement Without Asking Dynamic Again

We do not need more business clarification to start:
- dedicated master-data tables
- `Independent` and `Unknown` seeded defaults
- admin CRUD/import for affinity and ownership groups
- lead/account foreign keys
- manual intake requiredness
- website explicit fallback behavior
- roster-import framework

## What Still Needs Care, But Not a Blocker

- whether ownership-group roster ingestion needs its own separate recurring feed on day one, or whether ownership is more admin-maintained than affinity
- how much overlap reporting should be shown in CRM before the reporting layer is deeper
- whether private label should stay separate from affinity forever or later relate to it through another governed model

## Recommended Next Build

The next clean slice should be:

1. `AffinityGroupRef` + `OwnershipGroupRef` schema
2. admin CRUD/import
3. lead intake requiredness and explicit `Independent` / `Unknown` handling

That is the fastest path to turning these from fragile strings into real production master data.

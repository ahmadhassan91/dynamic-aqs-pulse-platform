# Can Do Now Vs Dynamic Decision Tracker

Date: 2026-04-16

Purpose:
- separate engineering-owned hardening from business/policy decisions
- keep the team moving on the modules we want to push toward 90%
- make the Dynamic meeting a decision session instead of a generic status call

## Foundation / Auth / Users / Permissions

Can harden now:
- admin-managed Microsoft Entra group mapping and access-policy controls  
  Why this matters: moves internal SSO rollout out of env-only behavior and into a governed admin workflow.
- failed login / denied action audit coverage  
  Why this matters: gives us traceability when auth or permission decisions block real users.
- record-scope guard scaffolding in API routes  
  Why this matters: keeps visibility rules enforceable at the backend instead of drifting into UI-only checks.
- password reset flow hardening for the local/dealer path  
  Why this matters: closes a real auth surface we already own technically.

Needs Dynamic decision:
- final internal auth posture: Entra-only or Entra-plus-break-glass local login  
  Why this matters: changes rollout, support, and security expectations across all internal modules.
- final MFA and session timeout rules by role  
  Why this matters: changes the real user experience and security posture.
- exact role catalog and hybrid-role policy  
  Why this matters: RBAC hardens quickly, so wrong role definitions become expensive later.
- final record-scope visibility policy by role  
  Why this matters: territory, finance, training, and admin visibility all depend on this being explicit.

## Leads

Can harden now:
- shared dedupe kernel across website, manual, and import intake  
  Why this matters: keeps lead quality rules consistent instead of fragmenting by entry path.
- persisted import review runs and saved mapping templates  
  Why this matters: makes bulk intake production-usable instead of one-off operator work.
- native-form runtime hardening and notification plumbing scaffolding  
  Why this matters: website intake is already live and needs robust operational behavior.
- lifecycle, import, and dedupe regression depth  
  Why this matters: lead management is the backbone module and needs stronger protection against regressions.

Needs Dynamic decision:
- final duplicate resolution policy: create, reuse, update, merge, or review  
  Why this matters: the wrong default here can corrupt customer and lead history.
- final routing-basis precedence when service-tech, install-tech, and truck counts conflict  
  Why this matters: assignment decisions become wrong if we guess the priority.
- final discovery-required vs skippable rules  
  Why this matters: impacts the operational lead journey and calendar behavior.
- final homeowner / non-dealer intake treatment  
  Why this matters: changes whether certain leads stay in CRM, get rerouted, or are filtered.

## Calendar

Can harden now:
- admin integration settings for Outlook rollout, pilot users, and meeting defaults  
  Why this matters: makes centralized calendar rollout manageable by admins instead of code/env edits.
- scheduler UX hardening and role-aware failure handling  
  Why this matters: the centralized scheduler needs to behave cleanly for partial-access roles.
- more regression coverage for sync, unsync, rollout policy, and scheduler paths  
  Why this matters: calendar touches multiple modules and can regress quietly without targeted tests.
- deeper live event-family support where requirements are already stable  
  Why this matters: centralized calendar becomes more operationally valuable without waiting for provider decisions.

Needs Dynamic decision:
- final meeting-link policy: Teams, WebEx, none, or mixed by event type  
  Why this matters: affects provider behavior, invite content, and admin rollout settings.
- shared calendar phase-1 expectations  
  Why this matters: changes how we test and govern Outlook connectivity.
- whether calendar is only a launcher or also a direct scheduling workspace for every event family  
  Why this matters: affects how much workflow logic belongs in calendar itself.

## Territory

Can harden now:
- scope-aware territory visibility and reporting views  
  Why this matters: a lot of operational territory value is still engineering-owned and does not need business input.
- propagation hardening from lead to account to ownership history  
  Why this matters: avoids drift after reassignment or conversion.
- map usability and exception-reporting improvements  
  Why this matters: the command center gets more useful without changing business policy.
- override audit / history refinement  
  Why this matters: territory changes must remain explainable and reviewable.

Needs Dynamic decision:
- final Strategic Growth precedence and override rules  
  Why this matters: this directly changes assignment truth.
- final pre-handoff TM visibility policy  
  Why this matters: determines who can see and act on accounts before the first-order boundary.
- final location-vs-account territory truth  
  Why this matters: affects whether propagation is account-level only or per-location.
- final map precision expectations now: state, ZIP, county, or custom shapes  
  Why this matters: changes the shape of the territory data model and UX effort.

## Training

Can harden now:
- reporting and exception views  
  Why this matters: a lot of the training value in meetings was operational reporting, not just scheduling.
- certification operations depth: renewal, expiry, and admin review states  
  Why this matters: we already have the certification foundation and can deepen it safely.
- richer participant / technician roster handling  
  Why this matters: helps the module fit the real field-training workflow better.
- stronger calendar-to-training integration and regression coverage  
  Why this matters: training is one of the main event families in the centralized calendar.

Needs Dynamic decision:
- final certification governance and approval authority  
  Why this matters: determines who can issue, approve, and renew certifications.
- final proof requirements by training and certification type  
  Why this matters: affects mobile execution and compliance behavior.
- final cadence/overdue logic by account type and segment  
  Why this matters: changes how we flag exceptions and trigger follow-up.
- final commercial-ready training scope in this phase  
  Why this matters: affects whether we add placeholders or real commercial tracks now.

## Recommended next engineering-owned order

1. Foundation/Auth hardening through admin-managed Entra access policy
2. Calendar admin settings and scheduler hardening
3. Leads dedupe/import hardening
4. Territory reporting / scope visibility
5. Training reporting / certification operations

## Recommended Dynamic decision order

1. auth posture and role/visibility rules
2. lead dedupe and routing-basis decisions
3. territory ownership and override policy
4. training certification/proof/cadence policy
5. calendar provider and meeting-link policy

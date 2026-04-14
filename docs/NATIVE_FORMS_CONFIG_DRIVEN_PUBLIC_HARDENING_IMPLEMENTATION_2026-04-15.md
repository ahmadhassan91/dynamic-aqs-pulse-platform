# Native Forms Config-Driven Public Hardening

Date: 2026-04-15

## Scope Closed In This Slice

This slice moved Pulse native website forms from a mostly fixed implementation to a config-driven, backend-enforced production path.

What is now true:
- each branded website can carry its own hosted form copy and option lists through `WebsiteLeadSite`
- the public hosted form reads site config from the API instead of hardcoded labels and select options
- public submission validation is now site-aware and rejects inquiry/referral values not configured for that website
- the admin workspace can create and edit site-level form copy/options and preview the real hosted form
- the duplicate-review regression suite now covers meeting-backed homeowner and contractor use cases under the hardened validation rules

## Implementation Decisions

### 1. Site-level form configuration lives with `WebsiteLeadSite`

We added form copy and option metadata directly onto the website site model instead of introducing a second disconnected builder table.

This includes:
- headline
- subheadline
- submit/success copy
- homeowner inquiry label/options
- contractor inquiry label/options
- referral source label/options
- message/referral detail/consent/customer-status labels

This keeps hosted form behavior, admin editing, and public rendering tied to the same site record that already owns branding, URL, and activation status.

### 2. Public hosted forms are backend authoritative

The public route still resolves by `siteId`, but the frontend no longer decides what options are valid.

The API now enforces:
- lead type must be allowed for the site
- inquiry topic must be in the configured list for that site/lead type
- referral source must be in the configured list for that site

That keeps the public form and backend intake path consistent even if a site’s copy/options change later.

### 3. Admin preview is the real hosted form

The admin workspace preview continues to render the actual hosted form component rather than a second fake preview implementation.

That keeps parity tighter across:
- site copy edits
- option-list edits
- success-state copy
- contractor/homeowner split

## Regression Coverage Added Or Tightened

The lead website-forms regression suite now proves:
- seeded sites expose active config
- admin config updates flow through to public hosted forms
- invalid inquiry/referral values are rejected by the backend
- homeowner and contractor meeting-backed branded-form submissions persist the right Pulse metadata
- duplicate submission review still works under the config-driven validation model
- oversized payloads are still rejected before bloating stored JSON

## Known Boundaries After This Slice

These items are still intentionally not treated as complete:
- verified embed origin / connection-status enforcement per website
- real outbound alert dispatch to notification recipients
- full field-builder semantics like per-field requiredness, masks, and conditional visibility

Those are the next hardening layers, not part of this slice’s close criteria.

## Why This Matters

The key production change here is not cosmetic. Pulse native forms now behave like a governed intake surface:
- site-configured
- backend-enforced
- regression-covered
- ready to be embedded across different branded websites without changing the application code each time

# Website Native Forms Connection Model

Date: 2026-04-15

## How One Pulse Form Connects To Different Websites

The production model is:

1. Internal admin creates or maintains a `WebsiteLeadSite` record in Pulse.
2. That site record defines:
   - `siteId`
   - `siteName`
   - target website URL
   - brand tag
   - allowed form mode (`homeowner`, `contractor`, or `both`)
   - site-specific form copy and allowed option lists
3. The admin workspace generates a hosted-form link and embed snippet for that `siteId`.
4. The website team places that snippet on the branded contact or lead page.
5. The hosted Pulse form is served from:
   - `/forms/lead/[siteId]`
6. Submission posts into the public Pulse lead-capture API.
7. Pulse stamps the lead and submission with the site metadata and routes it into the lead backbone.

## What Gets Stamped Into Pulse

At submit time, Pulse already captures:
- source site ID
- source site name / URL context
- brand tag
- capture method
- inquiry topic
- referral source / detail
- address metadata
- customer-status metadata for contractor intake

That means the website does not have to pass internal CRM-routing logic. The website only embeds the hosted form for the right `siteId`.

## Why This Works Across Many Websites

This pattern scales because the form renderer is shared, but the configuration is site-specific.

So:
- `solace-air`
- `dynamic-aqs`
- `purairx`
- `aire-serv`
- and the other branded sites

can all use the same Pulse form runtime while still having:
- different branding copy
- different allowed inquiry options
- different form modes
- different notification recipient configuration

## Current Production Connection Contract

Today the operational connection path is:
- site registry in `/leads/forms`
- hosted public route for preview/QA
- generated embed snippet for website install

This is enough for real rollout.

## Next Hardening Layer

The next production hardening for connection management is:
- verified origin/domain enforcement
- per-site connection status
- stronger embed/install verification
- later, notification-delivery confirmation per site

Those items improve operational confidence, but they are not required for the hosted-form model itself to function across different websites.

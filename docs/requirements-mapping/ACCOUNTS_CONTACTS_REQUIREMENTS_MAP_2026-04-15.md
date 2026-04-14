# Accounts / Contacts Requirements Map

Date: 2026-04-15

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/CUSTOMER_ACCOUNT_CONTACT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/source_of_truth/LEAD_ACCOUNT_CONTACT_CRM_FLOW.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/ROLE_BASED_VISIBILITY_REQUIREMENTS.md`

| Requirement | Source | Status | Implementation Evidence | Hardening / Next Action |
| --- | --- | --- | --- | --- |
| Customer is created only on first order | Customer PRD + lead/account/contact flow | Partial | lead conversion boundary is implemented in `apps/api/src/modules/leads/readiness.ts`; direct `POST /accounts` is now restricted to `SUPER_ADMIN` bootstrap/migration usage | Remove or isolate manual create entirely once migration tooling is finalized |
| Source lead reference retained on customer | Customer PRD | Implemented | account detail/list expose `sourceLeadId`, customer detail links back to source lead, regression coverage in `apps/api/test/accounts.regression.test.mjs` | Keep this lineage canonical |
| Customer 360 workspace | Customer PRD | Partial | `/customers` and `/customers/[id]` now expose live profile, contacts, locations, training, and dealer portal under the approved shell | Add orders, invoices, shipments, activities, documents, and pricing tabs when those backends are truly live |
| Account information section editable for operational fields | Customer PRD | Partial | account detail now supports edit for display name, legal name, account type, and active state | Extend into richer account fields and governed classification inputs |
| Customer search/list | Customer PRD | Partial | searchable list by display/legal/account number is live in `CustomerList.tsx` and `apps/api/src/modules/accounts/service.ts` | Add filters, pagination, configurable columns, and bulk actions |
| Customer edit | Customer PRD | Implemented | `PATCH /api/v1/accounts/:accountId` plus real profile editing UI in `CustomerOverview.tsx` | Add notes and audit-friendly richer field sections |
| Lead data carried forward into customer | Customer PRD | Partial | source lead, territory, shipping center, TM/RD assignment, contact and location carry forward from conversion are live | Extend carry-forward into broader discovery/CIS/account context |
| Multiple contacts per customer | Customer PRD | Implemented | account contacts list/create/update/deactivate flows are live in API and customer detail UI | Add contact search across customers later |
| Contact roles | Customer PRD | Partial | role capture is supported through `roleCode` and editable customer contact forms | Move to governed role catalog and grouped role presentation |
| Contact-to-portal user link | Customer PRD | Implemented | dealer portal access is managed from customer detail and linked to account/contact records | Deepen record-scope permissions later |
| Contact deactivation | Customer PRD | Implemented | soft deactivation/reactivation and primary fallback are regression-covered | Keep activity/training references intact |
| Contact import from CIS | Customer PRD | Partial | conversion creates customer contacts from lead/readiness preparation, but not full CIS role flattening parity yet | Expand role-aware carry-forward from CIS sections |
| Multiple locations per customer | Customer PRD | Implemented | account location list/create/update/deactivate flows are live in API and customer detail UI | Add map and service-area depth later |
| Billing vs shipping separation | Customer PRD | Partial | multiple locations are supported, but explicit billing-vs-shipping modeling is still thin | Add first-class billing/shipping semantics and same-as-billing behavior |
| Warehouse / shipping context on customer | Customer PRD + territory flow | Implemented | shipping-center context is exposed on account list/detail and preserved from lead conversion | Keep territory propagation clean as location logic expands |
| Customer lifecycle state machine (`Active / At Risk / Inactive / Churned`) | Customer PRD | Partial | current production model still only exposes `isActive` | Add explicit lifecycle state + aging automation next |
| At-risk flag and no-order aging | Customer PRD | Missing | no account aging/status automation exists yet | Build once ERP/order read models are present or an interim order signal exists |
| Acumatica ID and sync status | Customer PRD | Partial | `accountNumber` exists, but sync/status badges are not production-ready | Add ERP read-model status only when Acumatica boundary is live |
| Customer merge | Customer PRD | Missing | no merge workflow yet | Park until duplicate-governance rules are approved |

Current hardening priorities:
1. Add explicit customer lifecycle states and at-risk automation
2. Expand the customer workspace beyond profile/contacts/locations into activities/documents/ERP tabs
3. Replace free-text contact roles with governed role values
4. Deepen customer carry-forward from lead/CIS into a fuller 360 record

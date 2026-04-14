# Roadmap Trust Map

**Date:** 2026-03-30  
**Purpose:** Define which roadmap artifacts should be treated as authoritative, which are working drafts, and which are context or historical reference only.

## 1. How to Use This Map

If two documents disagree, use this precedence order:

1. Current authoritative baseline files
2. Active PRDs
3. Working technical design documents
4. Analysis and audit summaries
5. Deprecated or historical artifacts

This map is based on validation against the discovery-session corpus and the current roadmap package.

## 2. Authoritative Baseline

Use these first when making planning, scope, or release decisions.

### Program Baseline
- `registers/PROJECT_BREAKDOWN_DETAILED.csv`
- `source_of_truth/FULL_RELEASE_PLAN.md`
- `source_of_truth/PRD_MODULE_COVERAGE_MATRIX.md`
- `source_of_truth/PROGRAM_100_PERCENT_COMPLETION_CHECKLIST.md`
- `validated/authoritative/DISCOVERY_BASED_ROADMAP_FULL_VALIDATION_2026-03-30.md`

### Control Registers
- `registers/RAID_LOG_INITIAL.csv`
- `registers/INTEGRATION_REGISTER.csv`
- `registers/DEPENDENCY_CRITICAL_PATH_REGISTER.csv`
- `registers/DATA_MIGRATION_MATRIX.csv`

### Active Functional Baseline
- `prds/ACUMATICA_INTEGRATION_PRD.md`
- `prds/ALERTS_NOTIFICATIONS_COMMUNICATION_PRD.md`
- `prds/CIS_CREDIT_ONBOARDING_PRD.md`
- `prds/CONSIGNMENT_MANAGEMENT_PRD.md`
- `prds/CUSTOMER_ACCOUNT_CONTACT_PRD.md`
- `prds/DEALER_PORTAL_REQUIREMENTS.md`
- `prds/DIGITAL_ASSETS_DOCUMENTS_PRD.md`
- `prds/FOUNDATION_SECURITY_ADMIN_PRD.md`
- `prds/LEAD_CAPTURE_MANAGEMENT_PRD.md`
- `prds/MOBILE_APP_PRD.md`
- `prds/PRICING_COMMERCIAL_RULES_PRD.md`
- `prds/PRODUCT_MANAGEMENT_PRD.md`
- `prds/REPORTING_REQUIREMENTS_MASTER.md`
- `prds/ROLE_BASED_VISIBILITY_REQUIREMENTS.md`
- `prds/TERRITORY_MANAGEMENT_PRD.md`
- `prds/TRAINING_MANAGEMENT_PRD.md`

### Validated Companion Docs
- `validated/authoritative/CONSIGNMENT_OPERATING_MODEL_AND_SCHEMA_VALIDATION.md`

## 3. Working Draft

These are useful and often strong, but they are not final authority where policy decisions or final sign-off are still open.

### Technical Design
- `architecture/API_CONTRACT_SPECIFICATION.md`
- `architecture/AUTH_IMPLEMENTATION_GUIDE.md`
- `architecture/COST_MODEL_AND_INFRASTRUCTURE_SIZING.md`
- `architecture/CRM_UI_INFORMATION_ARCHITECTURE_BLUEPRINT.md`
- `architecture/DATABASE_SCHEMA.md`
- `architecture/DEPLOYMENT_AND_FEATURE_FLAGS.md`
- `architecture/JOB_WORKER_EXECUTION_PATTERN.md`
- `architecture/MESSAGE_QUEUE_AND_ASYNC_PATTERN.md`
- `architecture/PRODUCT_MANAGEMENT_ACUMATICA_INTEGRATION_ARCHITECTURE.md`
- `architecture/PRODUCT_MANAGEMENT_INFORMATION_ARCHITECTURE.md`
- `architecture/PROJECT_IMPLEMENTATION_NETWORK_DIAGRAM.md`
- `architecture/SECURITY_AND_SECRETS_ARCHITECTURE.md`
- `architecture/SYSTEM_ARCHITECTURE_OPTIONS_AND_RECOMMENDATION.md`
- `architecture/SYSTEM_ERD_BLUEPRINT.md`
- `architecture/TESTING_AND_QUALITY_STRATEGY.md`

### Supporting PRD Material
- `prds/CONSIGNMENT_STAKEHOLDER_SWIMLANE.md`
- `prds/DEALER_PORTAL_ENHANCEMENT_PLAN.md`
- `prds/FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md`
- `prds/MOBILE_APP_SUPPLEMENT.md`
- `prds/MOBILE_APP_SWIMLANE_JOURNEY.md`
- `prds/MOBILE_FIELD_CURRENT_STATE_AND_TOBE_SWIMLANE.md`
- `prds/MODULE_BY_MODULE_PRD_PACK.md`
- `prds/PRD_SUPPLEMENTS.md`
- `prds/PRODUCT_MANAGEMENT_ENHANCEMENT_PLAN.md`
- `prds/PRODUCT_MANAGEMENT_STAKEHOLDER_SWIMLANE.md`
- `prds/WEB_DASHBOARD_SUPPLEMENT.md`

### Companion Control Docs
- `registers/METRIC_DEFINITION_REGISTER.md`
- `registers/SPRINT_1_READINESS_CHECKLIST.md`
- `registers/RISK_CLOSURE_TRACKER.md`

## 4. Context Only

These documents are useful for understanding the discovery process, gap analysis, or earlier reasoning, but they should not override the live baseline.

### Analysis Folder
- `analysis/AGENT_FINDINGS_SYNTHESIS.md`
- `analysis/ARCHITECT_ERD_FINDINGS.md`
- `analysis/BEFORE_AFTER_MODULE_MATRIX.md`
- `analysis/CTO_ARCHITECTURE_FINDINGS.md`
- `analysis/DISCOVERY_ANALYSIS_BEFORE_AFTER.md`
- `analysis/DISCOVERY_ANALYSIS_INDEX.md`
- `analysis/DISCOVERY_EXECUTIVE_SUMMARY.md`
- `analysis/DISCOVERY_QUICK_REFERENCE.md`
- `analysis/EXTRACTED_FUNCTIONAL_REQUIREMENTS.md`
- `analysis/HIGH_LEVEL_PROGRAM_RISKS_SUMMARY.md`
- `analysis/MOBILE_FEEDBACK_INCORPORATION_PLAN.md`
- `analysis/REPORTING_DASHBOARD_GAP_MATRIX.md`
- `analysis/REPORTING_DASHBOARD_SESSION_BRIEF.md`
- `analysis/SENIOR_DEVELOPER_IMPLEMENTATION_FINDINGS.md`
- `analysis/WIDEN_RELATIONSHIP_FINDINGS.md`

### Historical / Audit Snapshots
- `validated/historical/DELIVERABLES_SUMMARY.md`
- `validated/historical/CONSISTENCY_ALIGNMENT_MASTER.md`
- `validated/historical/WBS_GAP_CLOSURE_SUMMARY_2026-03-30.md`
- `validated/historical/ROADMAP_PACKAGE_VALIDATION_2026-03-30.md`
- `workbooks/BASELINE_RECONCILIATION_MASTER.xlsx`
- `workbooks/SCOPE_TRACEABILITY_WORKBOOK.xlsx`
- `workbooks/SPRINT_RELEASE_PLAN.xlsx`
- `workbooks/Dynamic_AQS_Sprint_Release_Plan.xlsx`
- `workbooks/Dynamic_AQS_WBS_Costing.xlsx`
- `workbooks/DYNAMIC_AQS_COSTING_PLAN.xlsx`

### Migrated Root Docs
- `legacy_root_docs/duplicates/`
- `legacy_root_docs/context/`

## 5. Deprecated / Do Not Use

Do not use these as active planning or requirements authority.

- `prds/_deprecated/MOBILE_APP_REQUIREMENTS_TRACEABILITY.md`
- `prds/_deprecated/MOBILE_APP_STAKEHOLDER_SWIMLANE_CORRECTED.md`
- `prds/_deprecated/PRODUCT_MANAGEMENT_DEALER_PORTAL_IMPROVEMENT_PLAN.md`
- `prds/_deprecated/PRODUCT_MANAGEMENT_MODULE_REQUIREMENTS.md`
- `prds/_deprecated/WEB_DASHBOARD_REQUIREMENTS.md`

## 6. Important Exceptions

- `registers/RAID_LOG_INITIAL.csv` overrides any older risk counts or status summaries elsewhere.
- `registers/PROJECT_BREAKDOWN_DETAILED.csv` overrides any older WBS row counts, story-point totals, or sprint totals elsewhere.
- Active PRDs override analysis summaries where discovery synthesis and current requirements wording differ.
- When architecture documents and PRDs disagree, use the PRD as the business baseline and treat the architecture document as requiring refresh.

## 7. Current Readout

- The roadmap package is discovery-aligned and broadly credible.
- The strongest live functional baseline is the active PRD set plus the live registers.
- The weakest area is no longer scope coverage; it is baseline hygiene, remaining policy decisions, and final technical sign-off.

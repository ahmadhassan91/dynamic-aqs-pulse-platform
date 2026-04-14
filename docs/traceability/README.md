# Traceability Mirror

This folder keeps the most important roadmap traceability artifacts visible inside the implementation repo so delivery decisions can be checked without bouncing back into the planning workspace.

## Mirrored From

Source roadmap repo:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/registers`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/source_of_truth`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/workbooks/SCOPE_TRACEABILITY_WORKBOOK.xlsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/workbooks/SPRINT_RELEASE_PLAN.xlsx`

## What Lives Here

- `registers/`
  - risk, dependency, migration, and open-question registers
- `source_of_truth/`
  - architecture, schema, coverage, and release-planning guidance
- `workbooks/`
  - scope traceability workbook
  - sprint release plan

## Working Rule

The planning repo remains the upstream authoring location for these assets.

The implementation repo keeps a mirrored copy so:

- developers can validate scope at build time
- code review can reference the same traceability artifacts
- implementation decisions stay visible against approved source material

## Update Expectation

Whenever a major scope, foundation, or release decision changes in the roadmap repo, refresh this mirror in the implementation repo as part of the same working session.

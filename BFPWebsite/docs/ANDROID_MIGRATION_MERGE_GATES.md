# Android Migration Branch Merge Gates

Date established: 2026-02-26  
Branch scope: `android-app` only

## Purpose

Define practical, explicit conditions that must be met before any Android migration work is considered merge-ready for `main`.

## Mandatory Merge Gates

All gates below are required. If any item is unmet, merge is blocked.

### Gate 1 — User Sign-Off Required

- A user review confirms the migration increment is acceptable for integration.
- The user explicitly confirms "approved to proceed for merge" (or equivalent explicit approval).
- Approval must reference what was reviewed (feature scope, test result set, and affected docs/files).

### Gate 2 — Validation Expectations

- Web baseline remains intact against [docs/ANDROID_MIGRATION_WEB_BASELINE.md](docs/ANDROID_MIGRATION_WEB_BASELINE.md).
- Build passes on migration branch: `npm run build`.
- Validation harness passes: `node .apm/run-validation.mjs`.
- Any known non-blocking warnings are documented with impact assessment.
- No unresolved blocker-level defects remain for affected scope.

### Gate 3 — Readiness Criteria

- Changes are isolated to intended migration scope and do not introduce unplanned production behavior changes.
- Core docs are updated for operator clarity where behavior/process changed.
- Rollback path is clear (ability to withhold merge and continue on `android-app` without impacting `main`).
- Task memory logs for completed migration increments are up to date and reviewable.

## Merge Decision Rule

Merge from `android-app` to `main` is permitted only when Gate 1, Gate 2, and Gate 3 are all satisfied and explicitly acknowledged.

## Operational Notes

- Prefer small, reviewable merge increments.
- If uncertainty exists, defer merge and continue iteration on `android-app`.
- Protect `main` as production-safe at all times.

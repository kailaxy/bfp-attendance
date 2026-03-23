# Android Migration Production-Safety Note

Date established: 2026-02-26  
Applies to branch: `android-app`

## Operational Safety Policy

1. `main` remains production-safe at all times.
2. All Android migration implementation work stays isolated on `android-app` until merge gates are satisfied.
3. No deployment-impacting Android migration changes are to be applied directly on `main`.
4. If migration work introduces risk or uncertainty, do not merge; continue iteration in `android-app`.

## Rollback Expectation

- Rollback default is branch isolation: withhold merge to `main` and continue corrections on `android-app`.
- If a migration change has already been merged and causes issues, rollback is performed by reverting the specific merge/change set on `main` and restoring the last known production-safe state.

## Enforcement Guidance

- Use [docs/ANDROID_MIGRATION_MERGE_GATES.md](docs/ANDROID_MIGRATION_MERGE_GATES.md) as the required pre-merge checklist.
- Use [docs/ANDROID_MIGRATION_WEB_BASELINE.md](docs/ANDROID_MIGRATION_WEB_BASELINE.md) for regression comparison before merge approval.

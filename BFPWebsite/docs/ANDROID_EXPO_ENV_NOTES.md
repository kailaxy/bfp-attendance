# Android Expo Environment Notes

Date established: 2026-02-26  
Scope: `mobile-app` foundation on `android-app` branch

## Purpose

Provide the minimum environment and run-path notes required to start and validate the Expo Android app foundation safely during migration.

## Prerequisites

- Node.js LTS installed (recommended current active LTS)
- npm installed
- Expo Go app on Android device (for Expo Go workflow)
- Same local network between development machine and Android device (for QR connection)

## Install and Run

Workspace expectations before running commands:

- Open the repository workspace root: `BFPWebsite/`
- Keep Android implementation and validation work on branch: `android-app`
- Run mobile commands from `BFPWebsite/mobile-app` only

From repository root:

1. `cd mobile-app`
2. `npm install`
3. `npm run start`
4. On Android device, open Expo Go and scan the QR code shown in terminal/browser

Optional run targets:

- `npm run android` (opens Android target flow if emulator/device integration is available)
- `npm run web` (quick UI sanity check in browser while preserving mobile API wiring)

## Foundation Validation Notes

- TypeScript compile check: `npx tsc --noEmit`
- Expo config resolution check: `npx expo config --json`

## Safety and Governance Constraints

- Keep all mobile migration work on `android-app`.
- Do not apply deployment-impacting changes to `main`.
- Respect merge gates in [docs/ANDROID_MIGRATION_MERGE_GATES.md](docs/ANDROID_MIGRATION_MERGE_GATES.md).
- Validate parity against [docs/ANDROID_MIGRATION_WEB_BASELINE.md](docs/ANDROID_MIGRATION_WEB_BASELINE.md) as features are migrated.

## Branch and Workspace Guardrails

- Branch policy: `android-app` is the dedicated branch for mobile app implementation and validation evidence.
- Workspace policy: retain web app and backend assets in the same repository workspace; avoid moving mobile code outside `mobile-app/`.
- Command scope: use root-level commands for web/frontend docs and `mobile-app` commands for Expo mobile workflow.

## Mobile API Environment Configuration

The mobile service layer reads endpoint configuration from Expo public environment variables.

- Source template: `mobile-app/.env.example`
- Variables:
	- `EXPO_PUBLIC_API_MODE` (`mock` or `live`)
	- `EXPO_PUBLIC_APPS_SCRIPT_BASE_URL` (Apps Script deployment URL, required for `live`)
	- `EXPO_PUBLIC_API_TIMEOUT_MS` (optional, default `15000`)

### Safe Defaults

- Default mode is `mock` when env values are absent or invalid.
- In `live` mode with no base URL, services return deterministic `CONFIG_ERROR` instead of calling invalid endpoints.
- Feature screens should consume `mobile-app/src/services/attendanceApi.ts` and must not hardcode API URLs.

### Switching Environments

1. Copy `mobile-app/.env.example` to `mobile-app/.env`.
2. For local mock work: keep `EXPO_PUBLIC_API_MODE=mock`.
3. For Apps Script integration: set `EXPO_PUBLIC_API_MODE=live` and provide `EXPO_PUBLIC_APPS_SCRIPT_BASE_URL`.
4. Restart Expo (`npm run start`) after changing env variables.

## API Mode Behavior (Mock vs Live)

- `mock` mode:
	- Uses local mock responses and avoids live endpoint network requests.
	- Safe default for local UI development and validation.
- `live` mode:
	- Uses Apps Script endpoints resolved from `EXPO_PUBLIC_APPS_SCRIPT_BASE_URL`.
	- Requires reachable deployed backend and valid response envelopes.
- `live` mode without base URL:
	- Service methods return deterministic `CONFIG_ERROR` and smoke check fails fast.

## Contract Smoke Check Usage

Run from `mobile-app/`:

1. `npm run contract:smoke`

Expected outcomes:

- In `mock` mode:
	- Expected result: `PASS (mock mode)`
	- Expected note: live endpoint fetch checks are skipped
	- Resolved route output may show `[not configured]` when base URL is unset
- In `live` mode with valid base URL:
	- Expected behavior: route resolution output for `/health`, `/scan`, `/logs`, `/personnel`, `/leaves`
	- Expected live fetch checks: `/health`, `/logs`, `/personnel`, `/leaves`
	- Expected result: `PASS` only if all live checks pass envelope/shape validation
- In `live` mode without base URL:
	- Expected result: `FAIL`
	- Expected reason: requires `EXPO_PUBLIC_APPS_SCRIPT_BASE_URL`

Operational note:

- `/scan` is resolved and printed by smoke output for visibility, but not live-fetched by default to avoid write-like side effects during routine smoke checks.

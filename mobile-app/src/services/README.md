# Mobile Services Integration Notes

This folder contains the standardized service path for mobile feature screens.

## Integration Touchpoints

- `apiConfig.ts`
  - Resolves API mode, base URL, timeout, and route composition from Expo env variables.
  - Use this for environment switching behavior and endpoint path composition.
- `apiClient.ts`
  - Shared HTTP wrapper with timeout handling and deterministic success/error normalization.
  - UI-facing error shape is stable: `{ code, message, details? }`.
- `attendanceApi.ts`
  - Domain-level endpoint functions: `getHealth`, `submitScan`, `getLogs`, `getPersonnel`, `getLeaves`.
  - Exports default configured singleton `attendanceApi` for feature-level consumption.
- `index.ts`
  - Barrel export for all services; import from this entrypoint in screens/hooks.

## Environment Setup

Use `mobile-app/.env.example` as the template.

- `EXPO_PUBLIC_API_MODE=mock|live`
- `EXPO_PUBLIC_APPS_SCRIPT_BASE_URL=<Apps Script URL>`
- `EXPO_PUBLIC_API_TIMEOUT_MS=<milliseconds>`

When `live` mode is selected without a base URL, service methods return `CONFIG_ERROR` and do not issue network requests.

Mode behavior summary:

- `mock`: safe default, no live fetch requirement for feature validation.
- `live`: requires deployed Apps Script URL and network reachability.
- invalid/missing mode value: normalized to `mock`.

## Contract Smoke Validation

Run:

```bash
npm run contract:smoke
```

Behavior:

- `mock` mode: validates route composition setup and exits PASS without network calls.
- `live` mode: performs lightweight GET checks for `/health`, `/logs`, `/personnel`, `/leaves` and validates response envelope compatibility.

Expected outcomes by mode:

- `mock` + no base URL: PASS (route list may show `[not configured]`).
- `live` + valid base URL + healthy backend: PASS.
- `live` + missing base URL: FAIL with explicit configuration reason.

Route note:

- `/scan` route resolution is printed for visibility, but live smoke does not call `/scan` by default to avoid write-like side effects in routine validation.

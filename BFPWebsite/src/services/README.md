# Attendance Service Layer

This folder provides a backend-agnostic adapter for attendance operations.

## Adapter entry point

- Use `attendanceApi` from `attendanceAdapter.js` for default runtime behavior.
- Use `createAttendanceAdapter({ mode })` when you need to override mode in tests.

## Environment variables (Vite)

- `VITE_API_ADAPTER_MODE`:
  - `mock` (default fallback)
  - `live`
- `VITE_APPS_SCRIPT_BASE_URL`:
  - Required only when mode is `live`
  - Example shape: `https://script.google.com/macros/s/<deployment-id>/exec`

## Exposed methods

- `submitScan(payload)`
- `getLogs(query)`
- `getPersonnel()`
- `getLeaves()`

Both methods return a standardized result object:

- Success: `{ ok: true, data: ... }`
- Failure: `{ ok: false, error: { code, message, status?, details? } }`

## Contract assumptions

- The scan endpoint accepts `POST /scan` with JSON payload.
- The logs endpoint accepts `GET /logs` with optional query parameters.

These paths are explicit defaults for now and can be adapted later in `apiConfig.js` without changing UI components.

## Apps Script JSON contract (Task 2.1)

- `GET /health` or `GET /meta`
  - Returns API metadata and supported routes.
- `GET /logs`
  - Returns archived attendance entries for frontend logs consumption.
- `GET /personnel`
  - Returns personnel records from `ReferenceProfile`.
- `GET /leaves`
  - Returns leave records from `LeavePersonnel`.
- `POST /scan`
  - Accepts JSON body with scanned ID in one of: `qrCode`, `userId`, `id`.
  - Runs profile lookup + attendance time-in/time-out workflow against existing sheets.

### Standard response envelope

All endpoints return JSON with a consistent envelope:

- `status`: `success` or `error`
- `success`: boolean
- `message`: string
- `data`: object or `null`
- `error`: object or `null`
- `timestamp`: ISO string

### Compatibility fields for current adapter

To align with current frontend assumptions, responses also include top-level compatibility fields:

- `POST /scan`: `success`, `message`, `referenceId`, `timestamp`, `attendee`
- `GET /logs`: `items`, `total`, `nextCursor` (optional)

This allows migration to envelope-first parsing later without breaking current Task 2.2 integration assumptions.

## Task 2.2 business rules and mapping guarantees

### ID resolution

- Scanner IDs are matched strictly against `ReferenceProfile` `ACCOUNT NUMBER`.
- Matching is normalization-safe for case and whitespace (`"BFP 001"`, `"bfp001"`, and `" BFP001 "` resolve the same account).

### Profile payload coverage

Successful `POST /scan` responses include profile fields needed by scanner/logs card rendering:

- `attendee.personnelId` / `attendee.accountNumber`
- `attendee.name`, `attendee.firstName`, `attendee.lastName`
- `attendee.rank`
- `attendee.unit`
- `attendee.adminOp`
- `attendee.photoUrl`
- `attendee.status` (`On-Duty` or `Off-Duty`)

For envelope-first consumers, equivalent information is also in `data.profile`.

### GMT+8 two-scan rule

- Daily boundary is enforced using `GMT+8` calendar day.
- First valid scan for a day: creates Time-In and `On-Duty`.
- Second valid scan for same day: updates Time-Out and `Off-Duty`.
- Third or later same-day scan: blocked with deterministic error response.

### Deterministic error codes

- `INVALID_JSON` - body is not parseable JSON.
- `MALFORMED_PAYLOAD` - body is JSON but not an object.
- `VALIDATION_ERROR` - missing scanned ID (`qrCode`/`userId`/`id`).
- `NOT_FOUND` - unsupported route for current method.
- `USER_NOT_FOUND` - account not found in `ReferenceProfile`.
- `INVALID_TRANSITION` - two-scan daily limit reached / invalid state transition.
- `SCAN_PROCESS_FAILED` / `INTERNAL_ERROR` - server-side processing failures.

## Task 2.3 daily archival process

### Archival handler

- `runDailyRawToArchiveTransfer()` is the operational entrypoint for scheduled execution.
- It uses script locking to avoid concurrent duplicate runs.
- It delegates actual transfer logic to `archiveAttendanceData()`.

### Eligibility and transfer rule

- Source: `Attendance_Raw_Log`
- Target: `Attendance_Archive`
- A raw row is eligible when `Time-In` is a valid date and its `GMT+8` day is before the current `GMT+8` day.
- Current-day rows remain in raw log to avoid premature archival of in-progress operations.

### Duplicate protection

- Archive deduplication key is record ID in column `A`.
- Before insert, archive IDs are indexed and existing IDs are skipped.
- Repeated runs are safe: already archived rows are not inserted again.

### Post-transfer raw log behavior

- Only rows that were successfully archived or detected as already archived duplicates are cleared from `Attendance_Raw_Log`.
- Non-eligible rows are retained untouched.
- Clear behavior is content-only for the row cells (headers and sheet structure are preserved).

### Manual trigger setup (7:00 AM)

Use Apps Script editor with project timezone configured to local operations timezone.

1. Run `ensureDailyArchiveTrigger()` once manually.
2. Confirm a time-driven trigger exists for handler `runDailyRawToArchiveTransfer` at hour `7` daily.
3. Optional: Run `runDailyRawToArchiveTransfer()` manually to verify summary output before relying on schedule.

Expected result per run: deterministic summary with scanned/eligible/inserted/skipped/cleared counts and no duplicate archive insertion on repeated triggers.
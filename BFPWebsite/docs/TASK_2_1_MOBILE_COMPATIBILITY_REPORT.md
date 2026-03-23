# Task 2.1 – Mobile Compatibility Validation Report (Apps Script Backend)

Date: 2026-02-26  
Scope: Google Apps Script backend route and contract readiness for mobile integration

## Files Reviewed
- `Code.gs.txt`
- `mobile-app/src/services/apiConfig.ts`
- `mobile-app/src/services/apiClient.ts`
- `mobile-app/src/services/attendanceApi.ts`
- `mobile-app/src/types/attendanceApiContracts.ts`
- `src/pages/AttendanceScannerPage.jsx`
- `src/pages/AttendanceLogsPage.jsx`
- `src/pages/ListOfPersonnelPage.jsx`
- `src/pages/LeaveMonitoringPage.jsx`

## Confirmed-Compatible Areas

### Routing and Route Parsing
- Implemented GET routes: `/health`, `/logs`, `/personnel`, `/leaves`.
- Implemented POST route: `/scan`.
- Route parsing supports both:
  - `e.pathInfo` path-style routing, and
  - query parameter routing via `?route=/...` or `?action=/...`.
- Mobile route construction for Apps Script (`?route=/...`) is compatible with backend parsing.

### Envelope and Response Shape Compatibility
- Success responses include envelope fields (`status`, `success`, `message`, `data`, `error`, `timestamp`) plus top-level compatibility fields.
- Mobile API client behavior (prefers `data` when present) is compatible with current backend response structure.

### Attendance Scan Workflow
- `POST /scan` supports scan ID fields: `qrCode`, `userId`, `id`.
- Two-scan attendance behavior is enforced:
  - First valid scan (per day): time-in, `action: "timein"`, `status: "On-Duty"`.
  - Second valid scan (same day): time-out, `action: "timeout"`, `status: "Off-Duty"`.
  - Third+ scan (same day): blocked with `code: "INVALID_TRANSITION"`.
- Scan response includes mobile-relevant display fields under `attendee` and `profile` (name/rank/unit/adminOp/photo/status/timestamp/referenceId).

### Logs Contract
- `GET /logs` supports:
  - combined retrieval (default),
  - `source=raw`,
  - `source=archive`.
- `source` field is emitted per entry as `raw` or `archive`.
- Combined mode sorts by newest `timestamp` first.
- Log field names match expected contract (`id`, `timestamp`, `personnelId`, `name`, `unit`, `status`, `source`).

### Personnel and Leave Contracts
- `GET /personnel` emits stable list-item fields used by list UIs:
  - `accountNumber`, `rank`, `lastName`, `firstName`, `middleName`, `designation`, `unit`.
- `GET /leaves` emits stable leave list fields:
  - `id`, `personnelName`, `accountNumber`, `rank`, `leaveType`, `startDate`, `endDate`, `reason`, `status`.

## Gaps Requiring Minimal Backend Adjustments (Prioritized)

1. **Align `total` with filtered output count for `/personnel` and `/leaves`**  
   - Current behavior sets `total` from raw source row length before transformation/filtering.  
   - Impact: clients can receive `total` > `items.length` when invalid rows are dropped.  
   - Minimal fix: compute transformed list once and set `total = transformedItems.length`.

2. **Guarantee deterministic sorting for `source=raw` and `source=archive` log requests**  
   - Current explicit sort exists only for combined mode. Single-source mode relies on sheet row order.  
   - Impact: ordering assumptions may drift with sheet operations/cleanup.  
   - Minimal fix: apply the same timestamp-desc sort in single-source branches.

3. **Clarify log status vocabulary for strict mobile rendering rules**  
   - Current logs use raw `remarks` fallback (`On-Duty`/`Off-Duty`) or `IN/OUT` derivation.  
   - Impact: clients may need normalization logic if they require strict enum values.  
   - Minimal fix (optional but low-cost): normalize logs `status` to canonical values (`IN`/`OUT`) or document accepted values.

## Non-Required Changes Explicitly Deferred
- No backend route refactor (path-only routing) is required.
- No response envelope redesign is required.
- No schema expansion beyond currently exposed mobile fields is required.
- No archival/business-rule changes are required for this compatibility scope.
- No performance optimization/refactoring recommendations are included (out of scope for Task 2.1).

## Go/No-Go Readiness
- **Go (with minor follow-up):** Backend contracts are usable for mobile integration now.
- **Recommended before broad rollout:** apply the minimal fixes above (especially `total` alignment and deterministic single-source log sorting) under Task 2.2.

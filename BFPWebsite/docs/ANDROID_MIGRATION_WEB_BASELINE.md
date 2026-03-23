# Android Migration Web Baseline Checklist

Date captured: 2026-02-26  
Branch: android-app  
Purpose: Regression reference for preserving current web behavior while Android migration work proceeds.

## Runnable State Baseline

- [x] `npm run build` passes on branch `android-app`
- [x] Validation harness passes: `node .apm/run-validation.mjs` → 15/15
- [x] Existing non-blocking build warning remains present (bundle chunk size warning)

## Core Behavior Baseline (Web)

### 1) Attendance Scanner
- [x] Scanner view is reachable from sidebar navigation
- [x] Start/Stop camera lifecycle is user-controlled
- [x] QR scan submits to API via `attendanceApi.submitScan`
- [x] Success path renders profile/status card and cooldown behavior
- [x] Error path maps backend error codes to user-facing scanner messages

Primary references:
- `src/pages/AttendanceScannerPage.jsx`
- `src/services/attendanceAdapter.js`
- `Code.gs.txt`

### 2) Attendance Logs
- [x] Logs view is reachable from sidebar navigation
- [x] Logs fetch through adapter and parse API `items`
- [x] Raw/Archive source labeling is normalized and displayed
- [x] Entries are grouped into on-duty/off-duty rows and sorted newest-first
- [x] Filtering/search behavior exists for operational log review

Primary references:
- `src/pages/AttendanceLogsPage.jsx`
- `src/services/attendanceAdapter.js`
- `Code.gs.txt`

### 3) Dashboard
- [x] Dashboard view is reachable from sidebar navigation
- [x] Dashboard derives attendance metrics from log feed
- [x] Day-level status logic normalizes `IN/OUT` equivalents
- [x] Unit and personnel-derived insights render from available data

Primary references:
- `src/pages/DashboardPage.jsx`
- `src/services/attendanceAdapter.js`

### 4) Leave Monitoring
- [x] Leave Monitoring view is reachable from sidebar navigation
- [x] Leave data loads from `attendanceApi.getLeaves`
- [x] Calendar month view renders leave spans with status legend
- [x] Leave detail panel supports selection and inspection

Primary references:
- `src/pages/LeaveMonitoringPage.jsx`
- `src/services/attendanceAdapter.js`
- `Code.gs.txt`

### 5) List of Personnel
- [x] List of Personnel view is reachable from sidebar navigation
- [x] Personnel data loads from `attendanceApi.getPersonnel`
- [x] Search supports name/rank/unit/account number matching
- [x] Sort controls support rank/name/field ordering behavior

Primary references:
- `src/pages/ListOfPersonnelPage.jsx`
- `src/services/attendanceAdapter.js`
- `Code.gs.txt`

## Existing Baseline Artifacts

- `CHECKLIST.md`
- `PROJECT_COMPLETION_SUMMARY.md`
- `README.md`
- Historical UI captures were previously stored in the repository root and were removed during cleanup.
- Behavior baselines should now be validated using the runnable checks above and current app state.

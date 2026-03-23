# Task 2.2 – No-Regression Validation Note

Date: 2026-02-26  
Scope: Post-change contract validation for Apps Script endpoints after minimal fixes in Task 2.2.

## Modified File
- `Code.gs.txt`

## Validation Method
- Static contract/behavior review of updated route handlers and helper functions.
- Diagnostics check for file-level issues.
- Cross-check against mobile contract types in `mobile-app/src/types/attendanceApiContracts.ts`.

> Note: Full runtime endpoint execution is not performed in this workspace because Google Apps Script deployment/runtime is external.

## Before vs After Outcomes

### `GET /health`
- **Before:** Stable metadata and route/sheet declarations.
- **After:** Unchanged.
- **Regression Risk:** None observed.

### `POST /scan`
- **Before:** Two-scan behavior enforced (time-in, time-out, third-scan block), with envelope + compatibility fields.
- **After:** Unchanged business logic and response shape.
- **Regression Risk:** None observed.

### `GET /logs`
- **Before:** Combined retrieval sorted by timestamp-desc; single-source retrieval relied on source row order.
- **After:** Combined and single-source (`raw`, `archive`) now all sorted timestamp-desc via shared helper.
- **Status Field:** Added low-risk normalization in logs transformation:
  - Canonicalizes common duty values to `IN`/`OUT`.
  - Preserves unrecognized/custom remarks as-is.
- **Regression Risk:** Low; response shape preserved (`id`, `timestamp`, `personnelId`, `name`, `unit`, `status`, `source`).

### `GET /personnel`
- **Before:** `total` reflected raw row count, which could exceed returned transformed `items`.
- **After:** `total` now equals transformed output count (`items.length`).
- **Regression Risk:** None observed; shape unchanged.

### `GET /leaves`
- **Before:** `total` reflected raw row count, which could exceed returned transformed `items`.
- **After:** `total` now equals transformed output count (`items.length`).
- **Regression Risk:** None observed; shape unchanged.

## Two-Scan Workflow Check
- Confirmed unchanged in `logAttendance`:
  - first scan => create time-in,
  - second scan => set time-out,
  - third+ scan => `INVALID_TRANSITION`.

## Contract Compatibility Summary
- Envelope structure remains intact (`status`, `success`, `message`, `data`, `error`, `timestamp`) with compatibility fields.
- Route parsing remains intact (`pathInfo` and `route`/`action` query fallback).
- Mobile contract compatibility retained; minimal fixes successfully applied without broad refactor.

## Diagnostics
- `Code.gs.txt`: no errors reported.

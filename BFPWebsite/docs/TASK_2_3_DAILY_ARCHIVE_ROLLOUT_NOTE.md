# Task 2.3 – Daily Archive Rollout Note

Date: 2026-02-26  
Scope: Operations continuity for daily raw-to-archive transfer

## Redeploy Requirement

- **Apps Script redeploy is required** for recent backend updates in `Code.gs.txt` to be reflected in production Web App API behavior.
- **Trigger re-validation is required after deploy/redeploy** to ensure the daily archival schedule remains present and correct.

## Post-Deploy Verification Checklist

1. Open Apps Script editor for the deployed project.
2. Run `ensureDailyArchiveTrigger()` once.
3. Confirm one time-driven trigger exists for `runDailyRawToArchiveTransfer` at hour `7` daily (project timezone).
4. Run `runDailyRawToArchiveTransfer()` manually once.
5. Verify result summary is returned with deterministic counts (`scannedRows`, `eligibleRows`, `insertedRows`, `duplicateRowsSkipped`, `retainedRows`, `clearedRows`).
6. Validate sheet state:
   - `Attendance_Raw_Log`: only non-eligible/current-day rows remain.
   - `Attendance_Archive`: newly eligible rows appear, with no duplicate insertions.
7. Check Apps Script execution logs for errors/warnings.

## Operational Safety Notes

- The scheduled/manual entrypoint is lock-guarded (`LockService`), preventing concurrent overlap.
- Archival is idempotent by record-ID dedupe; repeated manual runs are safe.
- Current-day rows are intentionally retained in raw log until day boundary passes (GMT+8 rule).

---
name: Shift sync reliability
description: Root causes of missed loyverse_shifts records and the four fixes applied to restore once-daily post-close reliability.
---

## Rule
loyverse_shifts must only sync AFTER the register is closed. Receipts and shift reports are separate concerns with different timing dependencies.

**Why:** The Loyverse shift report is finalised only when the cashier closes the register. The old design ran syncNewShifts() at exactly 3:00 AM Bangkok — the same moment as shift close — creating a race condition where the cron fired before closed_at was set, writing empty or partial records.

## Four fixes applied (scheduler.ts + routes.ts)

1. **3:00 AM task now calls `syncReceiptsOnly()`** — receipts don't depend on the register being closed; they're fetched by time window.

2. **3:30 AM task calls `syncNewShifts()`** — 30 min buffer gives the cashier time to close and Loyverse time to finalise the shift report.

3. **`closed_at` guard in `syncNewShifts()`** — any shift without `closed_at` is skipped (logged, not silently dropped). Prevents open-shift rows overwriting completed records.

4. **Destructive purge removed from `GET /api/loyverse/shifts`** — routes.ts had a `db.delete(loyverse_shifts).where(lt(shiftDate, firstOfMonth))` running on EVERY call to the read endpoint. Silently destroyed all shift records older than the 1st of the current month.

5. **`scheduleIncrementalSync()` disabled** — imported a non-existent `./pos-ingestion/ingester.js`, producing 96 silent errors/day. Removed the call from `start()`; method body left unreachable.

## How to apply
- Never add shift report writes inside the 3:00 AM receipt sync window.
- Any new shift-related cron must check `shift.closed_at` before persisting.
- Do not add purge/delete logic inside read (GET) endpoints for loyverse_shifts.
- loyverse_receipts has its own purge in GET /api/loyverse/receipts — that is a separate, out-of-scope concern.

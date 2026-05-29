/**
 * Shift Rebuild Scheduler
 *
 * Runs at 03:05 BKK every night (after shift end at 03:00 BKK).
 * Triggers receipt truth rebuild for the completed shift's business date,
 * which auto-triggers the daily usage rebuild.
 *
 * Logs every run (success + failure) to shift_rebuild_log.
 * On failure, writes a dedup-protected event to monitor_events so the
 * monitoring dashboard surfaces it immediately.
 */

import { pool } from "../db";

const SCHEDULER_TAG = "[shiftRebuildScheduler]";

// ─── TABLE SETUP ──────────────────────────────────────────────────────────────
async function ensureTables(): Promise<void> {
  await pool!.query(`
    CREATE TABLE IF NOT EXISTS shift_rebuild_log (
      id              SERIAL PRIMARY KEY,
      business_date   DATE NOT NULL,
      triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      trigger_source  TEXT NOT NULL DEFAULT 'cron',
      status          TEXT NOT NULL,
      receipt_count   INTEGER,
      buns_total      NUMERIC,
      beef_g_total    NUMERIC,
      drinks_total    NUMERIC,
      usage_rebuild_ok BOOLEAN,
      error_message   TEXT,
      duration_ms     INTEGER
    )
  `);
  await pool!.query(`
    CREATE INDEX IF NOT EXISTS shift_rebuild_log_date_idx
      ON shift_rebuild_log (business_date DESC)
  `);
}

// ─── BUSINESS DATE HELPER ─────────────────────────────────────────────────────
// At 03:05 BKK the shift that just finished belongs to YESTERDAY in BKK.
function yesterdayBKK(): string {
  const now = new Date();
  const bkkStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const bkk = new Date(bkkStr + "T00:00:00Z");
  bkk.setUTCDate(bkk.getUTCDate() - 1);
  return bkk.toISOString().slice(0, 10);
}

// ─── RUN REBUILD ──────────────────────────────────────────────────────────────
export async function runShiftRebuild(
  businessDate: string,
  triggerSource: "cron" | "manual" = "cron"
): Promise<{ ok: boolean; message: string }> {
  await ensureTables();

  const start = Date.now();
  console.log(`${SCHEDULER_TAG} Starting rebuild for business_date=${businessDate} source=${triggerSource}`);

  let status: "success" | "failure" = "failure";
  let receiptCount: number | null = null;
  let bunsTotal: number | null = null;
  let beefGTotal: number | null = null;
  let drinksTotal: number | null = null;
  let usageRebuildOk: boolean | null = null;
  let errorMessage: string | null = null;

  try {
    const { rebuildReceiptTruth } = await import("./receiptTruthSummary");
    const summary = await rebuildReceiptTruth(businessDate);
    receiptCount = summary?.allReceipts ?? null;

    let usageErr: string | null = null;
    try {
      const { rebuildReceiptTruthDailyUsage } = await import("./receiptTruthDailyUsageService");
      const usageResult = await rebuildReceiptTruthDailyUsage(businessDate);
      usageRebuildOk = true;
      bunsTotal = usageResult?.summary?.expectedBuns ?? null;
      beefGTotal = usageResult?.summary?.expectedBeefGrams ?? null;
      drinksTotal = usageResult?.summary?.totalDrinksUsed ?? null;
    } catch (ue: any) {
      usageErr = ue?.message || String(ue);
      usageRebuildOk = false;
      console.error(`${SCHEDULER_TAG} Daily usage rebuild failed:`, usageErr);
    }

    status = "success";

    console.log(
      `${SCHEDULER_TAG} Rebuild success — receipts=${receiptCount} buns=${bunsTotal} beef_g=${beefGTotal} drinks=${drinksTotal} usage_ok=${usageRebuildOk}`
    );

    if (!usageRebuildOk) {
      errorMessage = `Usage rebuild failed: ${usageErr}`;
      await flagMonitorEvent(businessDate, "warn", `Shift rebuild succeeded but daily usage rebuild failed: ${usageErr}`);
    }
  } catch (e: any) {
    errorMessage = e?.message || String(e);
    console.error(`${SCHEDULER_TAG} Rebuild FAILED for ${businessDate}:`, errorMessage);

    await flagMonitorEvent(
      businessDate,
      "critical",
      `Shift rebuild failed for ${businessDate}: ${errorMessage}`
    );
  }

  const durationMs = Date.now() - start;

  await pool!.query(
    `INSERT INTO shift_rebuild_log
       (business_date, trigger_source, status, receipt_count, buns_total, beef_g_total,
        drinks_total, usage_rebuild_ok, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      businessDate,
      triggerSource,
      status,
      receiptCount,
      bunsTotal,
      beefGTotal,
      drinksTotal,
      usageRebuildOk,
      errorMessage,
      durationMs,
    ]
  );

  return {
    ok: status === "success",
    message:
      status === "success"
        ? `Rebuild complete — ${receiptCount} receipts, buns=${bunsTotal}, beef_g=${beefGTotal}, drinks=${drinksTotal}`
        : `Rebuild failed: ${errorMessage}`,
  };
}

// ─── MONITOR EVENTS ───────────────────────────────────────────────────────────
async function flagMonitorEvent(
  eventDate: string,
  severity: "warn" | "critical",
  message: string
): Promise<void> {
  try {
    const key = "SHIFT_REBUILD_FAIL";
    const fingerprint = `${key}::${eventDate}`;
    await pool!.query(
      `INSERT INTO monitor_events (monitor_key, event_date, fingerprint, severity, message, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fingerprint) DO UPDATE SET
         severity = EXCLUDED.severity,
         message  = EXCLUDED.message,
         fired_at = NOW()`,
      [key, eventDate, fingerprint, severity, message, null]
    );
    console.log(`${SCHEDULER_TAG} Flagged monitor event: ${severity} — ${message}`);
  } catch (me: any) {
    console.error(`${SCHEDULER_TAG} Failed to write monitor event:`, me.message);
  }
}

// ─── SCHEDULER ────────────────────────────────────────────────────────────────
let _schedulerStarted = false;

function msUntilNext0305BKK(): number {
  const now = new Date();
  const bkkStr = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const bkk = new Date(bkkStr);
  const target = new Date(bkk);
  target.setHours(3, 5, 0, 0);
  if (bkk >= target) target.setDate(target.getDate() + 1);
  const diffMs = target.getTime() - bkk.getTime();
  return diffMs;
}

export function startShiftRebuildScheduler(): void {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

  function scheduleNext(): void {
    const ms = msUntilNext0305BKK();
    console.log(`${SCHEDULER_TAG} Next shift rebuild in ${Math.round(ms / 60000)} min (03:05 BKK)`);
    setTimeout(async () => {
      const businessDate = yesterdayBKK();
      try {
        await runShiftRebuild(businessDate, "cron");
      } catch (e: any) {
        console.error(`${SCHEDULER_TAG} Unhandled error in cron run:`, e.message);
      }
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

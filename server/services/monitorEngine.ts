import { pool } from "../db";

// ---------------------------------------------------------------------------
// Work Register — Monitoring Engine
// Runs 4 rule checks and writes dedup-protected events to monitor_events.
// Scheduled daily at 13:00 Asia/Bangkok (06:00 UTC).
// ---------------------------------------------------------------------------

export interface MonitorResult {
  key: string;
  severity: "info" | "warning" | "critical";
  message: string;
  payload?: Record<string, unknown>;
  fired: boolean;
  skipped?: boolean;
}

function todayBKK(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
}

async function fireEvent(
  key: string,
  eventDate: string,
  severity: "info" | "warning" | "critical",
  message: string,
  payload?: Record<string, unknown>,
): Promise<boolean> {
  if (!pool) return false;
  const fingerprint = `${key}::${eventDate}`;
  try {
    await pool.query(
      `INSERT INTO monitor_events (monitor_key, event_date, fingerprint, severity, message, payload)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (fingerprint) DO NOTHING`,
      [key, eventDate, fingerprint, severity, message, payload ? JSON.stringify(payload) : null],
    );
    return true;
  } catch {
    return false;
  }
}

// Rule 1: Missing Form 1 (daily_sales_v2 records)
// shiftDate is TEXT in format YYYY-MM-DD
async function checkMissingForm1(dateStr: string): Promise<MonitorResult> {
  const key = "missing_form1";
  if (!pool) return { key, severity: "warning", message: "DB unavailable", fired: false };
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS cnt FROM daily_sales_v2 WHERE "shiftDate" = $1 AND "deletedAt" IS NULL`,
      [dateStr],
    );
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    if (cnt === 0) {
      const msg = `Form 1 (Daily Sales) not submitted for ${dateStr}`;
      const fired = await fireEvent(key, dateStr, "warning", msg, { date: dateStr });
      return { key, severity: "warning", message: msg, fired };
    }
    return { key, severity: "info", message: `Form 1 OK for ${dateStr} (${cnt} record(s))`, fired: false, skipped: true };
  } catch (e) {
    return { key, severity: "warning", message: `Form 1 check error: ${(e as Error).message}`, fired: false };
  }
}

// Rule 2: Missing Form 2 (daily_stock_v2 linked to daily_sales_v2 on given date)
async function checkMissingForm2(dateStr: string): Promise<MonitorResult> {
  const key = "missing_form2";
  if (!pool) return { key, severity: "warning", message: "DB unavailable", fired: false };
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS cnt FROM daily_stock_v2 dsv2
       INNER JOIN daily_sales_v2 dsv ON dsv2."salesId" = dsv.id
       WHERE dsv."shiftDate" = $1 AND dsv."deletedAt" IS NULL`,
      [dateStr],
    );
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    if (cnt === 0) {
      const msg = `Form 2 (Daily Stock) not submitted for ${dateStr}`;
      const fired = await fireEvent(key, dateStr, "warning", msg, { date: dateStr });
      return { key, severity: "warning", message: msg, fired };
    }
    return { key, severity: "info", message: `Form 2 OK for ${dateStr} (${cnt} record(s))`, fired: false, skipped: true };
  } catch (e) {
    return { key, severity: "warning", message: `Form 2 check error: ${(e as Error).message}`, fired: false };
  }
}

// Rule 3: Stock variance breach using daily_stock_sales table
// Thresholds: rolls_ordered_count >5 variance from prior day, meat_weight >500g, drink_stock_count >3
const VARIANCE_CHECKS = [
  { col: "burger_buns_stock", label: "Burger Buns",  threshold: 5 },
  { col: "meat_weight",       label: "Meat (g)",     threshold: 500 },
  { col: "drink_stock_count", label: "Drinks",       threshold: 3 },
];

async function checkVarianceBreach(dateStr: string): Promise<MonitorResult[]> {
  const results: MonitorResult[] = [];
  if (!pool) return results;
  for (const rule of VARIANCE_CHECKS) {
    const key = `variance_${rule.col}`;
    try {
      // Get today's value and yesterday's value, compute delta
      const r = await pool.query(
        `SELECT ${rule.col} AS val, shift_date
         FROM daily_stock_sales
         WHERE DATE(shift_date AT TIME ZONE 'Asia/Bangkok') IN ($1::date, ($1::date - INTERVAL '1 day')::date)
         ORDER BY shift_date DESC LIMIT 2`,
        [dateStr],
      );
      if (r.rows.length < 2) {
        results.push({ key, severity: "info", message: `${rule.label} — not enough data for variance check on ${dateStr}`, fired: false, skipped: true });
        continue;
      }
      const today = parseFloat(r.rows[0]?.val ?? "0");
      const yesterday = parseFloat(r.rows[1]?.val ?? "0");
      const delta = Math.abs(today - yesterday);
      if (delta > rule.threshold) {
        const msg = `${rule.label} variance: ${delta > 0 ? "+" : ""}${(today - yesterday).toFixed(1)} vs prior day (threshold ±${rule.threshold}) on ${dateStr}`;
        const fired = await fireEvent(key, dateStr, "critical", msg, { date: dateStr, col: rule.col, today, yesterday, delta });
        results.push({ key, severity: "critical", message: msg, fired, payload: { today, yesterday, delta } });
      } else {
        results.push({ key, severity: "info", message: `${rule.label} variance OK (Δ${delta.toFixed(1)}) on ${dateStr}`, fired: false, skipped: true });
      }
    } catch (e) {
      results.push({ key, severity: "warning", message: `${rule.label} check error: ${(e as Error).message}`, fired: false });
    }
  }
  return results;
}

// Rule 4: Loyverse/Grab receipts not uploaded for the day
async function checkGrabCsvMissing(dateStr: string): Promise<MonitorResult> {
  const key = "grab_csv_missing";
  if (!pool) return { key, severity: "warning", message: "DB unavailable", fired: false };
  try {
    const r = await pool.query(
      `SELECT COUNT(*) AS cnt FROM loyverse_receipts WHERE shift_date = $1::date`,
      [dateStr],
    );
    const cnt = parseInt(r.rows[0]?.cnt ?? "0", 10);
    if (cnt === 0) {
      const msg = `Loyverse receipts not found for ${dateStr}`;
      const fired = await fireEvent(key, dateStr, "warning", msg, { date: dateStr });
      return { key, severity: "warning", message: msg, fired };
    }
    return { key, severity: "info", message: `Loyverse receipts OK for ${dateStr} (${cnt} row(s))`, fired: false, skipped: true };
  } catch (e) {
    return { key, severity: "warning", message: `Loyverse check error: ${(e as Error).message}`, fired: false };
  }
}

// Main runner — call this once a day or on-demand via POST /api/ai-ops/monitors/run
export async function runMonitors(dateOverride?: string): Promise<MonitorResult[]> {
  const dateStr = dateOverride ?? todayBKK();
  console.log(`[monitorEngine] Running monitors for date: ${dateStr}`);

  const [form1, form2, grab] = await Promise.all([
    checkMissingForm1(dateStr),
    checkMissingForm2(dateStr),
    checkGrabCsvMissing(dateStr),
  ]);

  const varianceResults = await checkVarianceBreach(dateStr);
  const all = [form1, form2, grab, ...varianceResults];

  const fired = all.filter((r) => r.fired).length;
  console.log(`[monitorEngine] Done — ${all.length} checks, ${fired} event(s) fired for ${dateStr}`);
  return all;
}

// ---------------------------------------------------------------------------
// Scheduler — daily at 13:00 Asia/Bangkok (06:00 UTC)
// ---------------------------------------------------------------------------
let _schedulerStarted = false;

export function startMonitorScheduler(): void {
  if (_schedulerStarted) return;
  _schedulerStarted = true;

  function msUntilNext1300BKK(): number {
    const now = new Date();
    const bkk = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const target = new Date(bkk);
    target.setHours(13, 0, 0, 0);
    if (bkk >= target) target.setDate(target.getDate() + 1);
    return target.getTime() - bkk.getTime();
  }

  function scheduleNext(): void {
    const ms = msUntilNext1300BKK();
    console.log(`[monitorEngine] Next monitor run in ${Math.round(ms / 60000)} min`);
    setTimeout(async () => {
      try { await runMonitors(); } catch (e) { console.error("[monitorEngine] Scheduler error:", (e as Error).message); }
      scheduleNext();
    }, ms);
  }

  scheduleNext();
}

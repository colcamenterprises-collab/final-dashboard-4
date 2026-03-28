/**
 * Analysis Build Orchestrator
 *
 * Self-healing layer for the receipt truth / daily usage pipeline.
 *
 * Core contract:
 *   - If daily usage exists for a date → return it immediately
 *   - If missing → attempt auto-build (receipts truth first if also missing)
 *   - On failure → persist FAILED status + create issue_register entry
 *
 * Tables managed:
 *   analysis_build_status  — build lifecycle tracking (unique per date+type)
 *
 * Trigger sources:
 *   SCHEDULER | AUTO_ON_READ | MANUAL | STARTUP_CATCHUP | BOB
 */

import { pool } from "../db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BuildType = "RECEIPTS_TRUTH" | "DAILY_USAGE";
export type BuildStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
export type TriggerSource = "SCHEDULER" | "AUTO_ON_READ" | "MANUAL" | "STARTUP_CATCHUP" | "BOB";

export interface BuildStatusRow {
  id: number;
  businessDate: string;
  buildType: BuildType;
  status: BuildStatus;
  triggerSource: TriggerSource;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  metadataJson: Record<string, unknown> | null;
  updatedAt: string;
}

export interface AutoBuildResult {
  ok: boolean;
  autoBuilt: boolean;
  buildStatus: BuildStatus;
  buildError?: string;
  receiptsTruthStatus: BuildStatus | null;
  dailyUsageStatus: BuildStatus | null;
  data?: unknown;
}

// ─── Table bootstrap ──────────────────────────────────────────────────────────

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pool!.query(`
    CREATE TABLE IF NOT EXISTS analysis_build_status (
      id             SERIAL PRIMARY KEY,
      business_date  DATE NOT NULL,
      build_type     TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'PENDING',
      trigger_source TEXT NOT NULL,
      started_at     TIMESTAMPTZ,
      completed_at   TIMESTAMPTZ,
      error_message  TEXT,
      metadata_json  JSONB,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (business_date, build_type)
    )
  `);
  await pool!.query(`
    CREATE INDEX IF NOT EXISTS analysis_build_status_date_idx
      ON analysis_build_status (business_date DESC)
  `);
  tableReady = true;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

async function upsertBuildStatus(
  businessDate: string,
  buildType: BuildType,
  status: BuildStatus,
  triggerSource: TriggerSource,
  errorMessage?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await ensureTable();
  const startedAt = (status === "RUNNING") ? new Date().toISOString() : null;
  const completedAt = (status === "SUCCESS" || status === "FAILED") ? new Date().toISOString() : null;

  await pool!.query(
    `INSERT INTO analysis_build_status
       (business_date, build_type, status, trigger_source, started_at, completed_at, error_message, metadata_json, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (business_date, build_type) DO UPDATE SET
       status         = EXCLUDED.status,
       trigger_source = EXCLUDED.trigger_source,
       started_at     = COALESCE(EXCLUDED.started_at, analysis_build_status.started_at),
       completed_at   = EXCLUDED.completed_at,
       error_message  = EXCLUDED.error_message,
       metadata_json  = COALESCE(EXCLUDED.metadata_json, analysis_build_status.metadata_json),
       updated_at     = NOW()`,
    [
      businessDate,
      buildType,
      status,
      triggerSource,
      startedAt,
      completedAt,
      errorMessage ?? null,
      metadata ? JSON.stringify(metadata) : null,
    ]
  );
}

export async function getBuildStatus(businessDate: string): Promise<{
  receiptsTruth: BuildStatusRow | null;
  dailyUsage: BuildStatusRow | null;
}> {
  await ensureTable();
  const result = await pool!.query(
    `SELECT id, business_date, build_type, status, trigger_source,
            started_at, completed_at, error_message, metadata_json, updated_at
     FROM analysis_build_status
     WHERE business_date = $1::date`,
    [businessDate]
  );

  const toRow = (r: any): BuildStatusRow => ({
    id: r.id,
    businessDate: String(r.business_date).slice(0, 10),
    buildType: r.build_type,
    status: r.status,
    triggerSource: r.trigger_source,
    startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    errorMessage: r.error_message ?? null,
    metadataJson: r.metadata_json ?? null,
    updatedAt: new Date(r.updated_at).toISOString(),
  });

  const rows = result.rows;
  const rtRow = rows.find((r: any) => r.build_type === "RECEIPTS_TRUTH");
  const duRow = rows.find((r: any) => r.build_type === "DAILY_USAGE");
  return {
    receiptsTruth: rtRow ? toRow(rtRow) : null,
    dailyUsage: duRow ? toRow(duRow) : null,
  };
}

// ─── Issue register integration ───────────────────────────────────────────────

async function upsertBuildFailureIssue(
  businessDate: string,
  errorMessage: string
): Promise<void> {
  try {
    const sourceRef = `MISSING_USAGE_BUILD::${businessDate}`;
    const title = `Auto-build failed for ${businessDate}`;
    const description = `Analysis auto-build was triggered for ${businessDate} but failed. Error: ${errorMessage}`;

    await pool!.query(
      `INSERT INTO issue_register
         (shift_date, issue_type, category, severity, title, description,
          detected_by, source_page, source_ref, status, metadata_json)
       VALUES ($1::date, 'MISSING_USAGE_BUILD', 'SYSTEM', 'CRITICAL', $2, $3,
               'SYSTEM', 'analysis/stock-usage', $4, 'OPEN',
               $5::jsonb)
       ON CONFLICT (shift_date, issue_type, source_ref) DO UPDATE SET
         description  = EXCLUDED.description,
         updated_at   = NOW(),
         metadata_json = EXCLUDED.metadata_json`,
      [
        businessDate,
        title,
        description,
        sourceRef,
        JSON.stringify({ errorMessage, lastAttempt: new Date().toISOString() }),
      ]
    );
  } catch (issueErr: any) {
    console.error("[analysisBuildOrchestrator] Failed to write issue_register:", issueErr.message);
  }
}

// ─── Source data checks ───────────────────────────────────────────────────────

async function checkReceiptsTruthExists(businessDate: string): Promise<boolean> {
  const result = await pool!.query(
    `SELECT 1 FROM receipt_truth_summary WHERE business_date = $1::date LIMIT 1`,
    [businessDate]
  );
  return result.rows.length > 0;
}

async function checkDailyUsageExists(businessDate: string): Promise<boolean> {
  const result = await pool!.query(
    `SELECT 1 FROM receipt_truth_daily_usage WHERE business_date = $1::date LIMIT 1`,
    [businessDate]
  );
  return result.rows.length > 0;
}

async function checkRawSourceExists(businessDate: string): Promise<boolean> {
  const result = await pool!.query(
    `SELECT 1 FROM lv_receipt WHERE DATE(datetime_bkk) = $1::date LIMIT 1`,
    [businessDate]
  );
  return result.rows.length > 0;
}

// ─── Build helpers ────────────────────────────────────────────────────────────

async function buildReceiptsTruth(
  businessDate: string,
  triggerSource: TriggerSource
): Promise<{ ok: boolean; error?: string }> {
  await upsertBuildStatus(businessDate, "RECEIPTS_TRUTH", "RUNNING", triggerSource);
  try {
    const { rebuildReceiptTruth } = await import("./receiptTruthSummary");
    await rebuildReceiptTruth(businessDate);
    await upsertBuildStatus(businessDate, "RECEIPTS_TRUTH", "SUCCESS", triggerSource, undefined, {
      rebuiltAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    await upsertBuildStatus(businessDate, "RECEIPTS_TRUTH", "FAILED", triggerSource, msg);
    return { ok: false, error: msg };
  }
}

async function buildDailyUsage(
  businessDate: string,
  triggerSource: TriggerSource
): Promise<{ ok: boolean; error?: string }> {
  await upsertBuildStatus(businessDate, "DAILY_USAGE", "RUNNING", triggerSource);
  try {
    const { rebuildReceiptTruthDailyUsage } = await import("./receiptTruthDailyUsageService");
    await rebuildReceiptTruthDailyUsage(businessDate);
    await upsertBuildStatus(businessDate, "DAILY_USAGE", "SUCCESS", triggerSource, undefined, {
      rebuiltAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    await upsertBuildStatus(businessDate, "DAILY_USAGE", "FAILED", triggerSource, msg);
    return { ok: false, error: msg };
  }
}

// ─── In-flight guard (prevents duplicate concurrent builds) ───────────────────

const _inFlight = new Set<string>();

// ─── Main orchestration function ──────────────────────────────────────────────

/**
 * Ensure daily usage exists for the given date.
 *
 * If daily usage already exists → returns { ok: true, autoBuilt: false }.
 * If missing → auto-builds (receipts truth first if also missing).
 * On failure → creates an issue_register entry and returns structured error.
 */
export async function ensureAnalysisForDate(
  businessDate: string,
  triggerSource: TriggerSource
): Promise<AutoBuildResult> {
  const tag = `[analysisBuildOrchestrator][${businessDate}][${triggerSource}]`;

  // Fast path: data already exists
  if (await checkDailyUsageExists(businessDate)) {
    const statusRows = await getBuildStatus(businessDate);
    return {
      ok: true,
      autoBuilt: false,
      buildStatus: "SUCCESS",
      receiptsTruthStatus: statusRows.receiptsTruth?.status ?? null,
      dailyUsageStatus: statusRows.dailyUsage?.status ?? null,
    };
  }

  // Prevent duplicate concurrent builds for same date
  const flightKey = `${businessDate}:${triggerSource}`;
  if (_inFlight.has(flightKey)) {
    console.log(`${tag} Build already in-flight — skipping duplicate`);
    return {
      ok: false,
      autoBuilt: false,
      buildStatus: "RUNNING",
      buildError: "Build already in progress",
      receiptsTruthStatus: "RUNNING",
      dailyUsageStatus: "RUNNING",
    };
  }

  _inFlight.add(flightKey);
  console.log(`${tag} Daily usage missing — starting auto-build`);

  try {
    // Check if receipts truth is also missing
    const receiptsTruthExists = await checkReceiptsTruthExists(businessDate);

    if (!receiptsTruthExists) {
      console.log(`${tag} Receipts truth also missing — rebuilding receipts truth first`);
      const rtResult = await buildReceiptsTruth(businessDate, triggerSource);

      if (!rtResult.ok) {
        const errMsg = `Receipts truth build failed: ${rtResult.error}`;
        console.error(`${tag} ${errMsg}`);
        await upsertBuildFailureIssue(businessDate, errMsg);

        const statusRows = await getBuildStatus(businessDate);
        return {
          ok: false,
          autoBuilt: false,
          buildStatus: "FAILED",
          buildError: errMsg,
          receiptsTruthStatus: statusRows.receiptsTruth?.status ?? "FAILED",
          dailyUsageStatus: null,
        };
      }

      console.log(`${tag} Receipts truth rebuilt successfully`);
    }

    // Now build daily usage
    const duResult = await buildDailyUsage(businessDate, triggerSource);

    if (!duResult.ok) {
      const errMsg = `Daily usage build failed: ${duResult.error}`;
      console.error(`${tag} ${errMsg}`);
      await upsertBuildFailureIssue(businessDate, errMsg);

      const statusRows = await getBuildStatus(businessDate);
      return {
        ok: false,
        autoBuilt: false,
        buildStatus: "FAILED",
        buildError: errMsg,
        receiptsTruthStatus: statusRows.receiptsTruth?.status ?? null,
        dailyUsageStatus: "FAILED",
      };
    }

    console.log(`${tag} Auto-build complete`);
    const statusRows = await getBuildStatus(businessDate);
    return {
      ok: true,
      autoBuilt: true,
      buildStatus: "SUCCESS",
      receiptsTruthStatus: statusRows.receiptsTruth?.status ?? "SUCCESS",
      dailyUsageStatus: "SUCCESS",
    };
  } finally {
    _inFlight.delete(flightKey);
  }
}

// ─── Startup catch-up ─────────────────────────────────────────────────────────

/**
 * Called once at server startup.
 * Checks the last 3 business dates and fills any gaps.
 * Idempotent — skips dates that already have data.
 */
export async function runStartupCatchup(): Promise<void> {
  const tag = "[analysisBuildOrchestrator][STARTUP_CATCHUP]";
  try {
    await ensureTable();

    const dates = lastNBusinessDates(3);
    console.log(`${tag} Checking dates: ${dates.join(", ")}`);

    for (const date of dates) {
      const usageExists = await checkDailyUsageExists(date);
      if (usageExists) {
        console.log(`${tag} ${date} — daily usage exists, skipping`);
        continue;
      }

      const rawExists = await checkRawSourceExists(date);
      if (!rawExists) {
        console.log(`${tag} ${date} — no raw source data, skipping`);
        continue;
      }

      console.log(`${tag} ${date} — missing daily usage, running catch-up build`);
      const result = await ensureAnalysisForDate(date, "STARTUP_CATCHUP");
      if (result.ok) {
        console.log(`${tag} ${date} — catch-up build succeeded (autoBuilt=${result.autoBuilt})`);
      } else {
        console.warn(`${tag} ${date} — catch-up build FAILED: ${result.buildError}`);
      }
    }

    console.log(`${tag} Startup catch-up complete`);
  } catch (err: any) {
    console.error(`${tag} Startup catch-up error:`, err.message);
  }
}

// ─── Backfill existing data into build status ─────────────────────────────────

/**
 * One-shot backfill — called at startup, safe to re-run.
 *
 * For each of the last N business dates:
 *   - If receipt_truth_summary exists but no RECEIPTS_TRUTH status row → insert SUCCESS
 *   - If receipt_truth_daily_usage exists but no DAILY_USAGE status row → insert SUCCESS
 *
 * Uses the real built_at timestamp from each table.
 * Never touches existing status rows. Never rebuilds data.
 */
export async function runBackfillBuildStatus(daysBack = 7): Promise<void> {
  const tag = "[analysisBuildOrchestrator][BACKFILL]";
  try {
    await ensureTable();

    const dates = lastNBusinessDates(daysBack);
    let inserted = 0;

    for (const date of dates) {
      // ── Receipts truth backfill ──────────────────────────────────────────
      const rtCheck = await pool!.query(
        `SELECT built_at FROM receipt_truth_summary
         WHERE business_date = $1::date
         ORDER BY built_at DESC LIMIT 1`,
        [date]
      );

      if (rtCheck.rows.length > 0) {
        const rtBuiltAt: string = rtCheck.rows[0].built_at
          ? new Date(rtCheck.rows[0].built_at).toISOString()
          : new Date().toISOString();

        const rtStatusExists = await pool!.query(
          `SELECT 1 FROM analysis_build_status
           WHERE business_date = $1::date AND build_type = 'RECEIPTS_TRUTH'`,
          [date]
        );

        if (rtStatusExists.rows.length === 0) {
          await pool!.query(
            `INSERT INTO analysis_build_status
               (business_date, build_type, status, trigger_source, started_at, completed_at, updated_at)
             VALUES ($1::date, 'RECEIPTS_TRUTH', 'SUCCESS', 'BACKFILL', $2, $2, NOW())
             ON CONFLICT (business_date, build_type) DO NOTHING`,
            [date, rtBuiltAt]
          );
          inserted++;
          console.log(`${tag} ${date} RECEIPTS_TRUTH → SUCCESS (built_at=${rtBuiltAt})`);
        }
      }

      // ── Daily usage backfill ─────────────────────────────────────────────
      const duCheck = await pool!.query(
        `SELECT MAX(built_at) AS built_at FROM receipt_truth_daily_usage
         WHERE business_date = $1::date`,
        [date]
      );

      if (duCheck.rows.length > 0 && duCheck.rows[0].built_at !== null) {
        const duBuiltAt: string = new Date(duCheck.rows[0].built_at).toISOString();

        const duStatusExists = await pool!.query(
          `SELECT 1 FROM analysis_build_status
           WHERE business_date = $1::date AND build_type = 'DAILY_USAGE'`,
          [date]
        );

        if (duStatusExists.rows.length === 0) {
          await pool!.query(
            `INSERT INTO analysis_build_status
               (business_date, build_type, status, trigger_source, started_at, completed_at, updated_at)
             VALUES ($1::date, 'DAILY_USAGE', 'SUCCESS', 'BACKFILL', $2, $2, NOW())
             ON CONFLICT (business_date, build_type) DO NOTHING`,
            [date, duBuiltAt]
          );
          inserted++;
          console.log(`${tag} ${date} DAILY_USAGE → SUCCESS (built_at=${duBuiltAt})`);
        }
      }
    }

    console.log(`${tag} Complete — inserted ${inserted} status rows across ${dates.length} dates`);
  } catch (err: any) {
    console.error(`${tag} Error:`, err.message);
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function lastNBusinessDates(n: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  // Use BKK date
  const bkkStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const bkk = new Date(bkkStr + "T00:00:00Z");

  for (let i = 1; i <= n + 2 && dates.length < n; i++) {
    const candidate = new Date(bkk);
    candidate.setUTCDate(candidate.getUTCDate() - i);
    const iso = candidate.toISOString().slice(0, 10);
    // Skip weekends only if needed — restaurant operates daily so include all days
    dates.push(iso);
    if (dates.length >= n) break;
  }

  return dates;
}

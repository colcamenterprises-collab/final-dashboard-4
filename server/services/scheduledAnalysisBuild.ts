import cron from "node-cron";
import { pool } from "../db";
import { ensureAnalysisForDate } from "./analysisBuildOrchestrator";

const TAG = "[scheduledAnalysisBuild]";
let started = false;
let isRunning = false;

function previousBusinessDateBkk(): string {
  const now = new Date();
  const bkkNowText = now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
  const bkkNow = new Date(bkkNowText);
  bkkNow.setDate(bkkNow.getDate() - 1);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(bkkNow);
}

async function withPgLock<T>(lockKey: number, businessDate: string, fn: () => Promise<T>): Promise<T | null> {
  if (!pool) return null;

  const lockResult = await pool.query("SELECT pg_try_advisory_lock($1) AS locked", [lockKey]);
  const locked = lockResult.rows?.[0]?.locked === true;

  if (!locked) {
    console.log(`${TAG} SKIPPED_ALREADY_BUILT date=${businessDate} reason=lock_not_acquired`);
    return null;
  }

  try {
    return await fn();
  } finally {
    await pool.query("SELECT pg_advisory_unlock($1)", [lockKey]).catch(() => undefined);
  }
}

async function upsertMissingUsageBuildIssue(businessDate: string, detail: string): Promise<void> {
  if (!pool) return;

  await pool.query(
    `INSERT INTO issue_register
       (shift_date, issue_type, category, severity, title, description,
        detected_by, source_page, source_ref, status, metadata_json)
     VALUES ($1::date, 'MISSING_USAGE_BUILD', 'SYSTEM', 'P0', $2, $3,
             'SYSTEM', 'analysis/stock-usage', $4, 'OPEN', $5::jsonb)
     ON CONFLICT (shift_date, issue_type, source_ref) DO UPDATE SET
       severity = EXCLUDED.severity,
       description = EXCLUDED.description,
       metadata_json = EXCLUDED.metadata_json,
       updated_at = NOW()`,
    [
      businessDate,
      `Scheduled build failed for ${businessDate}`,
      detail,
      `MISSING_USAGE_BUILD::${businessDate}`,
      JSON.stringify({ trigger: "SCHEDULED_BUILD", failedAt: new Date().toISOString() }),
    ]
  );
}

export async function runScheduledAnalysisBuild(): Promise<void> {
  if (isRunning) {
    console.log(`${TAG} SKIPPED_ALREADY_BUILT date=unknown reason=in_process`);
    return;
  }

  isRunning = true;
  const businessDate = previousBusinessDateBkk();

  try {
    await withPgLock(430430, businessDate, async () => {
      const result = await ensureAnalysisForDate(businessDate, "SCHEDULED_BUILD");

      if (result.ok) {
        if (result.autoBuilt) {
          console.log(`${TAG} SUCCESS date=${businessDate} mode=auto_build`);
        } else {
          console.log(`${TAG} SKIPPED_ALREADY_BUILT date=${businessDate}`);
        }
        return;
      }

      const errorText = result.buildError || "Unknown scheduled build error";
      await upsertMissingUsageBuildIssue(
        businessDate,
        `Scheduled build failed for ${businessDate}. error=${errorText}`
      );
      console.error(`${TAG} FAILED date=${businessDate} error=${errorText}`);
    });
  } catch (error: any) {
    const msg = error?.message || String(error);
    await upsertMissingUsageBuildIssue(
      businessDate,
      `Scheduled build crashed for ${businessDate}. error=${msg}`
    ).catch(() => undefined);
    console.error(`${TAG} FAILED date=${businessDate} error=${msg}`);
  } finally {
    isRunning = false;
  }
}

export function startScheduledAnalysisBuildJob(): void {
  if (started) return;
  started = true;

  cron.schedule(
    "30 4 * * *",
    async () => {
      await runScheduledAnalysisBuild();
    },
    { timezone: "Asia/Bangkok" }
  );

  console.log(`${TAG} Scheduled daily build at 04:30 Asia/Bangkok`);
}

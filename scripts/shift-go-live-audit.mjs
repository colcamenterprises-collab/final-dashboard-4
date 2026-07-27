import pg from "pg";
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const { Pool } = pg;
const failures = [];
const warnings = [];
const passes = [];

function pass(message) { passes.push(message); console.log(`PASS  ${message}`); }
function warn(message) { warnings.push(message); console.log(`WARN  ${message}`); }
function fail(message) { failures.push(message); console.log(`FAIL  ${message}`); }

function bangkokShiftDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(get("hour"));
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  if (hour >= 3) return date;
  const previous = new Date(`${date}T00:00:00+07:00`);
  previous.setDate(previous.getDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(previous);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured");
  process.exit(2);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const shiftDate = bangkokShiftDate();

console.log(`\n=== SHIFT GO-LIVE AUDIT ===`);
console.log(`Bangkok shift date: ${shiftDate}`);

try {
  const columnsResult = await pool.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_sales_v2'
    ORDER BY ordinal_position
  `);
  const columns = new Set(columnsResult.rows.map((row) => row.column_name));
  const requiredColumns = ["id", "shiftDate", "completedBy", "startingCash", "endingCash", "totalSales", "totalExpenses", "payload"];
  const missing = requiredColumns.filter((column) => !columns.has(column));
  if (missing.length) fail(`daily_sales_v2 missing columns: ${missing.join(", ")}`);
  else pass("daily_sales_v2 contains required shift columns");

  const permissionsResult = await pool.query(`
    SELECT
      has_table_privilege(current_user, 'public.daily_sales_v2', 'SELECT') AS can_select,
      has_table_privilege(current_user, 'public.daily_sales_v2', 'INSERT') AS can_insert,
      has_table_privilege(current_user, 'public.daily_sales_v2', 'UPDATE') AS can_update
  `);
  const permissions = permissionsResult.rows[0] || {};
  if (permissions.can_select && permissions.can_insert && permissions.can_update) pass("application database user can read, open and close shifts");
  else fail(`daily_sales_v2 permissions incomplete: ${JSON.stringify(permissions)}`);

  const todayResult = await pool.query(`
    SELECT id, "shiftDate", "completedBy", "startingCash", "endingCash", "totalSales", "totalExpenses", "createdAt", payload
    FROM daily_sales_v2
    WHERE COALESCE("shiftDate"::date, shift_date::date) = $1::date
      AND "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
  `, [shiftDate]);

  if (todayResult.rows.length === 0) warn("no shift record exists yet for the current Bangkok shift date");
  else {
    pass(`${todayResult.rows.length} shift record(s) found for current Bangkok shift date`);
    if (todayResult.rows.length > 1) warn("multiple records exist for the same shift date; active-shift protection is required before staff use");
    for (const row of todayResult.rows) {
      const status = row.payload?.status || row.payload?.shiftStatus || "unknown";
      console.log(`      ${row.id} | ${row.completedBy || "unassigned"} | float ${row.startingCash ?? 0} | status ${status}`);
    }
  }

  const sourceChecks = [
    ["client/src/pages/operations/daily-sales/Form.tsx", ["/api/forms/daily-sales/v3", "daily_shift_workflow_context", "startingCash"]],
    ["server/routes/forms.ts", ["daily-sales-v2", "daily_sales_v2", "shiftId"]],
  ];
  for (const [relativePath, needles] of sourceChecks) {
    const filePath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(filePath)) {
      fail(`missing source file: ${relativePath}`);
      continue;
    }
    const source = fs.readFileSync(filePath, "utf8");
    const missingNeedles = needles.filter((needle) => !source.includes(needle));
    if (missingNeedles.length) fail(`${relativePath} missing expected flow markers: ${missingNeedles.join(", ")}`);
    else pass(`${relativePath} contains expected shift workflow markers`);
  }

  const formRouteResult = await pool.query(`SELECT to_regclass('public.daily_sales_v2') AS table_name`);
  if (formRouteResult.rows[0]?.table_name) pass("daily_sales_v2 table resolves in production schema");
  else fail("daily_sales_v2 table does not resolve");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await pool.end();
}

console.log(`\n=== RESULT ===`);
console.log(`PASS: ${passes.length}  WARN: ${warnings.length}  FAIL: ${failures.length}`);
if (warnings.length) {
  console.log("\nWarnings:");
  warnings.forEach((message) => console.log(`- ${message}`));
}
if (failures.length) {
  console.log("\nFailures:");
  failures.forEach((message) => console.log(`- ${message}`));
  process.exit(1);
}
console.log("\nShift data layer is ready for live workflow testing.");

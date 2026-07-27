import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, content) => {
  fs.writeFileSync(path.join(root, file), content);
  console.log(`updated ${file}`);
};
const requireReplace = (content, from, to, label) => {
  if (content.includes(to)) return content;
  if (!content.includes(from)) throw new Error(`Could not find ${label}`);
  return content.replace(from, to);
};

// Frontend route: owner-only, not merely authenticated.
{
  const file = "client/src/App.tsx";
  let source = read(file);
  source = requireReplace(
    source,
    '<Route path="/reports/shift-report" element={<ProtectedRoute><ShiftHistory /></ProtectedRoute>} />',
    '<Route path="/reports/shift-report" element={<ProtectedRoute><OwnerRoute><ShiftHistory /></OwnerRoute></ProtectedRoute>} />',
    "shift-report route",
  );
  write(file, source);
}

// Backend: owner-only and include the POS cash-register shift in the owner report.
{
  const file = "server/routes/shiftReportRoutes.ts";
  let source = read(file);

  source = requireReplace(
    source,
    'import { Router } from "express";',
    'import { Router, type NextFunction, type Request, type Response } from "express";\nimport { attachSessionUser } from "../middleware/sessionAuth";\nimport { getPinSessionUser } from "./pinAuth";',
    "shift report auth imports",
  );

  source = requireReplace(
    source,
    'const router = Router();',
    `const router = Router();

function ownerOnly(req: Request, res: Response, next: NextFunction) {
  attachSessionUser(req);
  const sessionUser = (req as any).user;
  const pinUser = getPinSessionUser(req);
  const user = sessionUser || pinUser;
  if (!user || user.role !== "owner") {
    return res.status(403).json({ error: "Owner access required" });
  }
  (req as any).user = user;
  next();
}

router.use(ownerOnly);`,
    "owner-only middleware",
  );

  source = requireReplace(
    source,
    `    selected_dates AS (
      SELECT shift_date
      FROM (
        SELECT shift_date::date AS shift_date FROM loyverse_shifts
        UNION
        SELECT shift_date FROM forms
      ) all_dates`,
    `    pos_register AS (
      SELECT DISTINCT ON (shift_date)
        shift_date,
        p.id AS pos_shift_id,
        p.staff_name AS cashier_name,
        p.opened_at,
        p.closed_at,
        p.starting_float,
        p.closing_cash,
        p.cash_banked,
        p.expected_cash,
        p.variance AS register_variance,
        p.status AS pos_shift_status,
        COALESCE(m.money_in, 0)::numeric AS money_in,
        COALESCE(m.money_out, 0)::numeric AS money_out,
        COALESCE(m.net_movement, 0)::numeric AS net_movement
      FROM (
        SELECT ps.*,
          CASE
            WHEN EXTRACT(HOUR FROM ps.opened_at AT TIME ZONE 'Asia/Bangkok') < 3
              THEN ((ps.opened_at AT TIME ZONE 'Asia/Bangkok')::date - INTERVAL '1 day')::date
            ELSE (ps.opened_at AT TIME ZONE 'Asia/Bangkok')::date
          END AS shift_date
        FROM pos_shifts ps
      ) p
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(CASE WHEN movement_type='cash_in' THEN amount ELSE 0 END),0) AS money_in,
          COALESCE(SUM(CASE WHEN movement_type='cash_out' THEN amount ELSE 0 END),0) AS money_out,
          COALESCE(SUM(CASE WHEN movement_type='cash_in' THEN amount ELSE -amount END),0) AS net_movement
        FROM pos_shift_movements
        WHERE shift_id = p.id
      ) m ON true
      ORDER BY shift_date, p.opened_at DESC
    ),
    selected_dates AS (
      SELECT shift_date
      FROM (
        SELECT shift_date::date AS shift_date FROM loyverse_shifts
        UNION
        SELECT shift_date FROM forms
        UNION
        SELECT shift_date FROM pos_register
      ) all_dates`,
    "POS register CTE",
  );

  source = requireReplace(
    source,
    `           s.shift_receipts, f.form_id, f.staff_gross, f.staff_cash, f.staff_qr, f.staff_grab, f.staff_other, f.staff_receipts
    FROM shift_reports s
    LEFT JOIN receipts r ON r.shift_date = s.shift_date
    LEFT JOIN forms f ON f.shift_date = s.shift_date`,
    `           s.shift_receipts, f.form_id, f.staff_gross, f.staff_cash, f.staff_qr, f.staff_grab, f.staff_other, f.staff_receipts,
           p.pos_shift_id, p.cashier_name, p.opened_at, p.closed_at, p.starting_float,
           p.closing_cash, p.cash_banked, p.expected_cash, p.register_variance,
           p.pos_shift_status, p.money_in, p.money_out, p.net_movement
    FROM shift_reports s
    LEFT JOIN receipts r ON r.shift_date = s.shift_date
    LEFT JOIN forms f ON f.shift_date = s.shift_date
    LEFT JOIN pos_register p ON p.shift_date = s.shift_date`,
    "POS register report join",
  );

  source = requireReplace(
    source,
    `    const dailySalesV2 = row.form_id ? { grossSales: toNumber(row.staff_gross), cash: toNumber(row.staff_cash), qr: toNumber(row.staff_qr), grab: toNumber(row.staff_grab), other: toNumber(row.staff_other), receiptCount: toNumber(row.staff_receipts) } : { grossSales: null, cash: null, qr: null, grab: null, other: null, receiptCount: null };

    const posFields = {`,
    `    const dailySalesV2 = row.form_id ? { grossSales: toNumber(row.staff_gross), cash: toNumber(row.staff_cash), qr: toNumber(row.staff_qr), grab: toNumber(row.staff_grab), other: toNumber(row.staff_other), receiptCount: toNumber(row.staff_receipts) } : { grossSales: null, cash: null, qr: null, grab: null, other: null, receiptCount: null };
    const posShift = row.pos_shift_id ? {
      id: row.pos_shift_id,
      cashierName: row.cashier_name,
      openedAt: row.opened_at,
      closedAt: row.closed_at,
      startingFloat: toNumber(row.starting_float),
      moneyIn: toNumber(row.money_in) ?? 0,
      moneyOut: toNumber(row.money_out) ?? 0,
      netMovement: toNumber(row.net_movement) ?? 0,
      physicalClosingCash: toNumber(row.closing_cash),
      cashBanked: toNumber(row.cash_banked),
      expectedCash: toNumber(row.expected_cash),
      registerVariance: toNumber(row.register_variance),
      status: row.pos_shift_status,
    } : null;

    const posFields = {`,
    "POS shift DTO",
  );

  source = requireReplace(
    source,
    `      receipts, shiftReport, dailySalesV2,
      posIntegrityStatus, staffVerificationStatus, overallStatus,`,
    `      receipts, shiftReport, dailySalesV2, posShift,
      posIntegrityStatus, staffVerificationStatus, overallStatus,`,
    "POS shift response",
  );

  source = source.replace(
    'canonical_source: "loyverse_shifts,lv_receipt,daily_sales_v2"',
    'canonical_source: "loyverse_shifts,lv_receipt,daily_sales_v2,pos_shifts,pos_shift_movements"',
  );

  write(file, source);
}

// Owner report UI: display the private register reconciliation separately from staff-entered data.
{
  const file = "client/src/pages/reports/ShiftHistory.tsx";
  let source = read(file);

  source = requireReplace(
    source,
    '  source: string;\n}',
    `  source: string;
  posShift?: {
    id: string;
    cashierName: string | null;
    openedAt: string | null;
    closedAt: string | null;
    startingFloat: number | null;
    moneyIn: number;
    moneyOut: number;
    netMovement: number;
    physicalClosingCash: number | null;
    cashBanked: number | null;
    expectedCash: number | null;
    registerVariance: number | null;
    status: string;
  } | null;
}`,
    "ShiftReport POS shift interface",
  );

  source = source.replace('title="Shift History"', 'title="Owner Shift Report"');
  source = source.replace('meta={reports.length > 0 ? `${reports.length} shifts` : "Expandable shift detail view"}', 'meta={reports.length > 0 ? `${reports.length} private financial reports` : "Owner-only shift reconciliation"}');

  source = requireReplace(
    source,
    `                    {/* Stock reconciliation */}
                    <RollsReconciliationTable date={report.shiftDate.slice(0, 10)} />`,
    `                    {/* Private POS register reconciliation — owner only */}
                    {report.posShift && (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Cash register reconciliation</p>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span><strong>Cashier:</strong> {report.posShift.cashierName || "—"}</span>
                            <span><strong>Status:</strong> {report.posShift.status?.toUpperCase() || "—"}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                              { label: "Starting float", value: fmt(report.posShift.startingFloat) },
                              { label: "Money in", value: fmt(report.posShift.moneyIn) },
                              { label: "Money out", value: fmt(report.posShift.moneyOut) },
                              { label: "Cash banked", value: fmt(report.posShift.cashBanked) },
                              { label: "Physical close", value: fmt(report.posShift.physicalClosingCash) },
                              { label: "Expected cash", value: fmt(report.posShift.expectedCash) },
                              { label: "Register variance", value: fmt(report.posShift.registerVariance) },
                              { label: "Net movement", value: fmt(report.posShift.netMovement) },
                            ].map((row) => (
                              <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                                <p className="text-sm font-bold text-slate-900">{row.value}</p>
                                <p className="mt-0.5 text-[10px] text-slate-500">{row.label}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stock reconciliation */}
                    <RollsReconciliationTable date={report.shiftDate.slice(0, 10)} />`,
    "owner register reconciliation panel",
  );

  write(file, source);
}

console.log("PASS owner-only shift report installed");

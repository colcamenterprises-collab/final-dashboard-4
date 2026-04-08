import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// ─── Types ─────────────────────────────────────────────────────────
type StaffData = {
  totalSales: number | null;
  cashSales: number | null;
  grabSales: number | null;
  scanSales: number | null;
  expensesTotal: number | null;
  rollsEnd: number | null;
  meatEnd: number | null;
  drinksCount: number | null;
};

type PosShift = {
  totalSales: number | null;
  startingCash: number | null;
  cashPayments: number | null;
  grab: number | null;
  scan: number | null;
  expenses: number | null;
  expectedCash: number | null;
  actualCash: number | null;
  difference: number | null;
};

type Differences = {
  totalSales: number | null;
  cash: number | null;
  grab: number | null;
  scan: number | null;
  expenses: number | null;
};

type WageDetail = {
  entries: { name: string; amount: number }[];
  totalWages: number;
  staffCount: number;
};

type ReceiptEvidence = {
  posReceiptCount: number | null;
  cashierReceiptCount: number | null;
  receiptDifference: number | null;
  receiptStatus: string;
};

type ComparisonPayload = {
  date: string;
  shiftWindow: string;
  staffData: StaffData | { message: string };
  posShiftReport: PosShift | { message: string };
  differences: Differences;
  receiptEvidence?: ReceiptEvidence;
  wageDetail?: WageDetail;
};

type PrimeCostPayload = {
  ok: boolean;
  date: string;
  daily?: {
    date: string;
    sales: number;
    wages: number;
    fnb: number;
    primeCost: number;
    primePct: number;
  };
};

type HistoryRow = {
  id: string;
  shift_date: string;
  completed_by: string;
  total_sales: number;
  cash_sales: number;
  qr_sales: number;
  grab_sales: number;
  aroi_sales: number;
  shopping_total: number;
  wages_total: number;
  others_total: number;
  total_expenses: number;
  rolls_end: number;
  meat_end_g: number;
  expected_cash_bank: number;
  expected_total_bank: number;
};

// ─── Helpers ────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);

const thb = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return `฿${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const num = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
};
const isMsg = (v: unknown): v is { message: string } =>
  Boolean(v && typeof v === "object" && "message" in v);

const RECEIPT_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  EVIDENCE_MATCH:    { label: "Matched",          color: "text-green-700 bg-green-50 border-green-200" },
  MISSING_RECEIPTS:  { label: "Receipts Missing",  color: "text-red-700 bg-red-50 border-red-200" },
  PHANTOM_RECEIPTS:  { label: "Phantom Receipts",  color: "text-orange-700 bg-orange-50 border-orange-200" },
  POS_UNAVAILABLE:   { label: "POS Unavailable",   color: "text-gray-600 bg-gray-50 border-gray-200" },
  FORM_MISSING:      { label: "Form Missing",      color: "text-amber-700 bg-amber-50 border-amber-200" },
  NO_EVIDENCE:       { label: "No Evidence",       color: "text-gray-500 bg-gray-50 border-gray-200" },
};

// ─── Sub-components ─────────────────────────────────────────────────

function StatusPill({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        {label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
      ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-600"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-400"}`} />
      {label}: {ok ? "Connected" : "Missing"}
    </span>
  );
}

function Card({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-1 w-5 rounded-full" style={{ background: accent ?? "#FFEB00" }} />
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, warn, success }: {
  label: string; value: string; bold?: boolean; warn?: boolean; success?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${
        warn ? "text-red-600" : success ? "text-green-600" : bold ? "text-gray-900" : "text-gray-700"
      }`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-100 my-2" />;
}

function SeverityBadge({ level }: { level: "critical" | "warning" | "info" }) {
  const cls = {
    critical: "bg-red-50 border-red-200 text-red-700",
    warning:  "bg-amber-50 border-amber-200 text-amber-700",
    info:     "bg-gray-50 border-gray-200 text-gray-500",
  }[level];
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {level.toUpperCase()}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────
export default function DailyReview() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [month, setMonth] = useState(thisMonth());
  const autoDateSet = useRef(false);

  // ── Queries ──
  const { data: comparison, isLoading: loadingComparison } = useQuery<ComparisonPayload>({
    queryKey: ["/api/analysis/daily-comparison", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/analysis/daily-comparison?date=${selectedDate}`);
      if (!r.ok) throw new Error("Failed to load shift comparison");
      return r.json();
    },
    enabled: Boolean(selectedDate),
  });

  const { data: primeCost, isLoading: loadingPrimeCost } = useQuery<PrimeCostPayload>({
    queryKey: ["/api/metrics/prime-cost", selectedDate],
    queryFn: async () => {
      const r = await fetch(`/api/metrics/prime-cost`);
      if (!r.ok) throw new Error("Failed to load prime cost");
      return r.json();
    },
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery<HistoryRow[]>({
    queryKey: ["/api/analysis/daily-sales", month],
    queryFn: async () => {
      const r = await fetch(`/api/analysis/daily-sales?month=${month}`);
      if (!r.ok) throw new Error("Failed to load shift history");
      return r.json();
    },
    enabled: Boolean(month),
  });

  // Auto-select latest completed shift on first load
  useEffect(() => {
    if (!autoDateSet.current && history.length > 0) {
      autoDateSet.current = true;
      const sorted = [...history].sort((a, b) => b.shift_date.localeCompare(a.shift_date));
      const latest = sorted[0].shift_date;
      setSelectedDate(latest);
      setMonth(latest.slice(0, 7));
    }
  }, [history]);

  // ── Derived ──
  const staffData = comparison && !isMsg(comparison.staffData) ? comparison.staffData : null;
  const posShift  = comparison && !isMsg(comparison.posShiftReport) ? comparison.posShiftReport : null;
  const diffs     = comparison?.differences ?? null;
  const receipt   = comparison?.receiptEvidence ?? null;
  const wages     = comparison?.wageDetail ?? null;

  const hasForm     = staffData !== null;
  const hasPOS      = posShift !== null;
  const hasReceipt  = receipt !== null && receipt.receiptStatus !== "NO_EVIDENCE";
  const hasLabour   = wages !== null && (wages.staffCount > 0 || wages.totalWages > 0);

  // Determine if this is a future/current open date (no shift started yet)
  const isTodayOrFuture = selectedDate >= todayISO();
  const isOpenShift = isTodayOrFuture && !hasForm;

  // ── Issues ──
  type Issue = { type: string; item: string; expected: string; actual: string; variance: string; severity: "critical" | "warning" | "info" };
  const criticalIssues: Issue[] = [];

  if (!hasForm && !isOpenShift) {
    criticalIssues.push({ type: "Missing Data", item: "Daily Sales & Stock Form", expected: "Submitted", actual: "Not Found", variance: "—", severity: "critical" });
  }
  if (!hasPOS && !isOpenShift) {
    criticalIssues.push({ type: "Missing Data", item: "POS Shift Report", expected: "Available", actual: "Not Found", variance: "—", severity: "critical" });
  }
  if (diffs?.totalSales !== null && diffs?.totalSales !== undefined && diffs.totalSales !== 0) {
    criticalIssues.push({ type: "Sales Mismatch", item: "Total Sales", expected: thb(posShift?.totalSales), actual: thb(staffData?.totalSales), variance: thb(diffs.totalSales), severity: Math.abs(diffs.totalSales) > 500 ? "critical" : "warning" });
  }
  if (diffs?.cash !== null && diffs?.cash !== undefined && diffs.cash !== 0) {
    criticalIssues.push({ type: "Cash Mismatch", item: "Cash Sales", expected: thb(posShift?.cashPayments), actual: thb(staffData?.cashSales), variance: thb(diffs.cash), severity: Math.abs(diffs.cash) > 200 ? "critical" : "warning" });
  }
  if (diffs?.expenses !== null && diffs?.expenses !== undefined && diffs.expenses !== 0) {
    criticalIssues.push({ type: "Expense Mismatch", item: "Total Expenses", expected: thb(posShift?.expenses), actual: thb(staffData?.expensesTotal), variance: thb(diffs.expenses), severity: Math.abs(diffs.expenses) > 100 ? "warning" : "info" });
  }
  if (hasForm && (staffData?.rollsEnd === 0)) {
    criticalIssues.push({ type: "Stock Alert", item: "Burger Buns Remaining", expected: "> 0", actual: "0", variance: "—", severity: "warning" });
  }
  if (hasForm && (staffData?.meatEnd === 0)) {
    criticalIssues.push({ type: "Stock Alert", item: "Meat Remaining (g)", expected: "> 0", actual: "0", variance: "—", severity: "warning" });
  }
  if (receipt?.receiptStatus === "MISSING_RECEIPTS" && (receipt.receiptDifference ?? 0) > 0) {
    criticalIssues.push({ type: "Receipt Alert", item: "Unaccounted Receipts", expected: String(receipt.posReceiptCount), actual: String(receipt.cashierReceiptCount), variance: `+${receipt.receiptDifference}`, severity: "critical" });
  }

  const prime = primeCost?.daily;
  const selectedHistoryRow = history.find(r => r.shift_date === selectedDate);

  const receiptStatusInfo = receipt ? (RECEIPT_STATUS_LABEL[receipt.receiptStatus] ?? { label: receipt.receiptStatus, color: "text-gray-500 bg-gray-50 border-gray-200" }) : null;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 md:p-6 space-y-6" style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-8 rounded-full bg-[#FFEB00]" />
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Daily Sales & Shift Analysis</h1>
          </div>
          <p className="mt-1 ml-11 text-xs text-gray-400">
            Shift meeting place — sales, POS comparison, receipts, stock and labour summary
          </p>
        </div>
        <div className="flex items-center gap-2 ml-11 md:ml-0">
          <span className="text-xs text-gray-400">Shift Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              autoDateSet.current = true;
              setSelectedDate(e.target.value);
              setMonth(e.target.value.slice(0, 7));
            }}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:outline-none focus:border-yellow-400"
          />
        </div>
      </div>

      {/* ── Status Chips ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Daily Form"    ok={loadingComparison ? null : hasForm} />
        <StatusPill label="POS Shift"     ok={loadingComparison ? null : hasPOS} />
        <StatusPill label="Receipt Match" ok={loadingComparison ? null : (hasReceipt ? receipt?.receiptStatus === "EVIDENCE_MATCH" : null)} />
        <StatusPill label="Labour Data"   ok={loadingComparison ? null : hasLabour} />
      </div>

      {/* ── Open shift notice ────────────────────────────────────── */}
      {isOpenShift && !loadingComparison && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <span className="text-sm text-amber-700 font-medium">
            No form submitted yet for {selectedDate} — shift may still be open or not yet started
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loadingComparison && (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400 shadow-sm">
          Loading shift data…
        </div>
      )}

      {!loadingComparison && !isOpenShift && (
        <>
          {/* ── Critical Issues ─────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-red-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Critical Issues</span>
              {criticalIssues.length > 0 && (
                <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {criticalIssues.length}
                </span>
              )}
            </div>
            {criticalIssues.length === 0 ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
                <span className="text-sm text-green-700 font-medium">No critical issues for this shift</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Type</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Item</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Expected</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Actual</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Variance</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {criticalIssues.map((issue, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">{issue.type}</td>
                          <td className="px-4 py-3 font-medium text-gray-800">{issue.item}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{issue.expected}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{issue.actual}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-600">{issue.variance}</td>
                          <td className="px-4 py-3 text-right"><SeverityBadge level={issue.severity} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── 4 Summary Cards ─────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-[#FFEB00]" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Shift Overview</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Sales */}
              <Card title="Sales Summary">
                {hasForm ? (
                  <>
                    <Row label="Total Sales"   value={thb(staffData?.totalSales)} bold />
                    <Divider />
                    <Row label="Cash"          value={thb(staffData?.cashSales)} />
                    <Row label="QR / PromptPay" value={thb(staffData?.scanSales)} />
                    <Row label="GrabFood"      value={thb(staffData?.grabSales)} />
                    <Divider />
                    <Row label="Expenses Total" value={thb(staffData?.expensesTotal)} />
                  </>
                ) : (
                  <p className="text-sm text-gray-400 py-2">No form data for this shift</p>
                )}
              </Card>

              {/* Stock */}
              <Card title="Stock Status" accent="#6366f1">
                {hasForm ? (
                  <>
                    <Row label="Buns Remaining"   value={staffData?.rollsEnd !== null ? num(staffData?.rollsEnd) : "Not recorded"} warn={staffData?.rollsEnd === 0} />
                    <Row label="Meat Remaining (g)" value={staffData?.meatEnd !== null ? num(staffData?.meatEnd) : "Not recorded"} warn={staffData?.meatEnd === 0} />
                    <Row label="Drinks Count"     value={staffData?.drinksCount !== null ? num(staffData?.drinksCount) : "Not recorded"} />
                    <Divider />
                    <Row
                      label="Status"
                      value={staffData?.rollsEnd === 0 || staffData?.meatEnd === 0 ? "Depleted" : "All Recorded"}
                      warn={staffData?.rollsEnd === 0 || staffData?.meatEnd === 0}
                      success={staffData?.rollsEnd !== 0 && staffData?.meatEnd !== 0 && staffData?.rollsEnd !== null}
                    />
                  </>
                ) : (
                  <p className="text-sm text-gray-400 py-2">Stock data not available</p>
                )}
              </Card>

              {/* Cash Control */}
              <Card title="Cash Control" accent="#10b981">
                {hasPOS ? (
                  <>
                    <Row label="Starting Cash"  value={thb(posShift?.startingCash)} />
                    <Row label="Expected Cash"  value={thb(posShift?.expectedCash)} />
                    <Row label="Actual Cash"    value={thb(posShift?.actualCash ?? null)} bold />
                    <Divider />
                    <Row
                      label="Difference"
                      value={posShift?.difference !== null ? thb(posShift?.difference) : "—"}
                      warn={posShift?.difference !== null && posShift.difference !== 0}
                      success={posShift?.difference === 0}
                    />
                  </>
                ) : (
                  <p className="text-sm text-gray-400 py-2">POS shift report not available</p>
                )}
              </Card>

              {/* Profit Snapshot */}
              <Card title="Profit Snapshot" accent="#f59e0b">
                {prime ? (
                  <>
                    <Row label="Total Sales"    value={thb(prime.sales)} bold />
                    <Row label="Wages"          value={thb(prime.wages)} />
                    <Row label="Food & Bev Cost" value={thb(prime.fnb)} />
                    <Row label="Prime Cost"     value={thb(prime.primeCost)} />
                    <Divider />
                    <Row
                      label="Prime Cost %"
                      value={`${prime.primePct.toFixed(1)}%`}
                      warn={prime.primePct > 65}
                      success={prime.primePct <= 65}
                    />
                  </>
                ) : (
                  <p className="text-sm text-gray-400 py-2">
                    {loadingPrimeCost ? "Loading…" : "Profit data unavailable"}
                  </p>
                )}
              </Card>
            </div>
          </section>

          {/* ── Form vs POS Comparison ───────────────────────────── */}
          {(hasForm || hasPOS) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-5 rounded-full bg-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Form vs POS Comparison</span>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Item</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Daily Form</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">POS Report</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        { label: "Total Sales",  form: staffData?.totalSales,    pos: posShift?.totalSales,    diff: diffs?.totalSales },
                        { label: "Cash",         form: staffData?.cashSales,     pos: posShift?.cashPayments,  diff: diffs?.cash },
                        { label: "GrabFood",     form: staffData?.grabSales,     pos: posShift?.grab,          diff: diffs?.grab },
                        { label: "QR / Scan",    form: staffData?.scanSales,     pos: posShift?.scan,          diff: diffs?.scan },
                        { label: "Expenses",     form: staffData?.expensesTotal, pos: posShift?.expenses,      diff: diffs?.expenses },
                      ].map((row) => {
                        const hasDiff = row.diff !== null && row.diff !== undefined && row.diff !== 0;
                        return (
                          <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-gray-700">{row.label}</td>
                            <td className="px-5 py-3 text-right text-gray-600">
                              {row.form !== null && row.form !== undefined ? thb(row.form) : <span className="text-gray-300">No data</span>}
                            </td>
                            <td className="px-5 py-3 text-right text-gray-600">
                              {row.pos !== null && row.pos !== undefined ? thb(row.pos) : <span className="text-gray-300">No data</span>}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {row.diff === null || row.diff === undefined ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                <span className={`font-semibold ${hasDiff ? "text-red-600" : "text-green-600"}`}>
                                  {row.diff === 0 ? "✓ Match" : thb(row.diff)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* ── Receipt Summary ──────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-teal-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Receipt Summary</span>
            </div>
            {receipt && receipt.receiptStatus !== "NO_EVIDENCE" ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{receipt.posReceiptCount ?? "—"}</div>
                    <div className="text-xs text-gray-400 mt-1">POS Receipts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{receipt.cashierReceiptCount ?? "—"}</div>
                    <div className="text-xs text-gray-400 mt-1">Cashier Declared</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${(receipt.receiptDifference ?? 0) !== 0 ? "text-red-600" : "text-green-600"}`}>
                      {receipt.receiptDifference !== null ? (receipt.receiptDifference === 0 ? "0" : `+${receipt.receiptDifference}`) : "—"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Difference</div>
                  </div>
                  <div className="text-center flex items-center justify-center">
                    {receiptStatusInfo && (
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${receiptStatusInfo.color}`}>
                        {receiptStatusInfo.label}
                      </span>
                    )}
                  </div>
                </div>
                {receipt.receiptStatus === "MISSING_RECEIPTS" && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                    POS shows {receipt.receiptDifference} more receipts than declared — verify with cashier
                  </div>
                )}
                {receipt.receiptStatus === "PHANTOM_RECEIPTS" && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700">
                    Cashier declared {Math.abs(receipt.receiptDifference ?? 0)} more receipts than POS shows
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-6 text-center text-sm text-gray-400">
                Receipt evidence not available for this shift
              </div>
            )}
          </section>

          {/* ── Stock Summary ────────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-indigo-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Stock Summary</span>
            </div>
            {hasForm ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <div className={`text-2xl font-bold ${staffData?.rollsEnd === 0 ? "text-red-600" : "text-gray-900"}`}>
                      {staffData?.rollsEnd !== null ? num(staffData?.rollsEnd) : "—"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Buns Remaining</div>
                    {staffData?.rollsEnd === 0 && <div className="text-xs text-red-500 mt-0.5 font-medium">Depleted</div>}
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${staffData?.meatEnd === 0 ? "text-red-600" : "text-gray-900"}`}>
                      {staffData?.meatEnd !== null ? `${num(staffData?.meatEnd)}g` : "—"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Meat Remaining</div>
                    {staffData?.meatEnd === 0 && <div className="text-xs text-red-500 mt-0.5 font-medium">Depleted</div>}
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {staffData?.drinksCount !== null ? num(staffData?.drinksCount) : "—"}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Drinks Count</div>
                  </div>
                  {selectedHistoryRow && (
                    <>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{thb(selectedHistoryRow.shopping_total)}</div>
                        <div className="text-xs text-gray-400 mt-1">Purchases (Shopping)</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">{thb(selectedHistoryRow.expected_total_bank)}</div>
                        <div className="text-xs text-gray-400 mt-1">Expected Bank Total</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-6 text-center text-sm text-gray-400">
                Stock data not available — no form submitted for this shift
              </div>
            )}
          </section>

          {/* ── Labour Summary ───────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Labour Summary</span>
            </div>
            {hasLabour ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{wages!.staffCount > 0 ? wages!.staffCount : "—"}</div>
                    <div className="text-xs text-gray-400 mt-1">Staff on Shift</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{thb(wages!.totalWages)}</div>
                    <div className="text-xs text-gray-400 mt-1">Total Wages</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500 mt-1">Shift Window</div>
                    <div className="text-sm text-gray-700">17:00 – 03:00 BKK</div>
                    <div className="text-xs text-gray-400 mt-0.5">Paid window 18:00 – 02:00</div>
                  </div>
                </div>
                {wages!.entries.length > 0 && (
                  <div className="border-t border-gray-100 pt-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Staff Wages</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {wages!.entries.map((e, i) => (
                        <div key={i} className="flex justify-between items-center rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                          <span className="text-sm text-gray-700 font-medium">{e.name}</span>
                          <span className="text-sm text-gray-900 font-semibold">{thb(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {wages!.staffCount === 0 && wages!.totalWages > 0 && (
                  <div className="text-xs text-gray-400 mt-2">
                    Wages total recorded — individual staff entries not available in this form version
                  </div>
                )}
              </div>
            ) : selectedHistoryRow && selectedHistoryRow.wages_total > 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{thb(selectedHistoryRow.wages_total)}</div>
                    <div className="text-xs text-gray-400 mt-1">Total Wages (from history)</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-500">Shift Window</div>
                    <div className="text-sm text-gray-700">17:00 – 03:00 BKK</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-400">Staff name breakdown not available for this form version</div>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-6 text-center text-sm text-gray-400">
                Labour data not available — no wage entries found in form
              </div>
            )}
          </section>

          {/* ── Profit Full Snapshot ─────────────────────────────── */}
          {(prime || selectedHistoryRow) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-5 rounded-full bg-amber-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Profit Snapshot</span>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xl font-bold text-gray-900">{prime ? thb(prime.sales) : thb(selectedHistoryRow?.total_sales)}</div>
                    <div className="text-xs text-gray-400 mt-1">Total Sales</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{prime ? thb(prime.wages) : thb(selectedHistoryRow?.wages_total)}</div>
                    <div className="text-xs text-gray-400 mt-1">Wages</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-gray-900">{prime ? thb(prime.fnb) : thb(selectedHistoryRow?.total_expenses)}</div>
                    <div className="text-xs text-gray-400 mt-1">{prime ? "Food & Bev Cost" : "Total Expenses"}</div>
                  </div>
                  {prime && (
                    <div>
                      <div className={`text-xl font-bold ${prime.primePct > 65 ? "text-red-600" : "text-green-600"}`}>
                        {prime.primePct.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Prime Cost %</div>
                    </div>
                  )}
                </div>
                {prime && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Prime Cost Total</span>
                      <span className="text-sm font-semibold text-gray-900">{thb(prime.primeCost)}</span>
                    </div>
                    {prime.primePct > 65 && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        Prime cost above 65% threshold — review wages and F&B costs
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Shift History ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-1 w-5 rounded-full bg-gray-300" />
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Shift History</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 shadow-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
        </div>

        {loadingHistory ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-6 text-center text-sm text-gray-400">
            Loading history…
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-5 py-6 text-center text-sm text-gray-400">
            No shift data for {month}
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {["Date","By","Total","Cash","QR","Grab","Expenses","Exp Bank","Buns","Meat (g)"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400 whitespace-nowrap first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...history].sort((a, b) => b.shift_date.localeCompare(a.shift_date)).map((row) => {
                    const isSelected = row.shift_date === selectedDate;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => {
                          autoDateSet.current = true;
                          setSelectedDate(row.shift_date);
                          setMonth(row.shift_date.slice(0, 7));
                        }}
                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${isSelected ? "bg-yellow-50 border-l-2 border-yellow-400" : ""}`}
                      >
                        <td className={`px-4 py-3 font-semibold whitespace-nowrap ${isSelected ? "text-yellow-700" : "text-gray-700"}`}>
                          {row.shift_date}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.completed_by || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{thb(row.total_sales)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thb(row.cash_sales)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thb(row.qr_sales)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thb(row.grab_sales)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thb(row.total_expenses)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{thb(row.expected_total_bank)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap ${row.rolls_end === 0 ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          {row.rolls_end ?? "—"}
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap ${row.meat_end_g === 0 ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          {num(row.meat_end_g)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
              Click any row to load that shift — sorted most recent first
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

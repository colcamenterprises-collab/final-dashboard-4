import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// ─── Colour palette ────────────────────────────────────────────────
const YELLOW = "#FFEB00";

// ─── Types ────────────────────────────────────────────────────────
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

type ComparisonPayload = {
  date: string;
  shiftWindow: string;
  staffData: StaffData | { message: string };
  posShiftReport: PosShift | { message: string };
  differences: Differences;
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

// ─── Helpers ──────────────────────────────────────────────────────
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

const isMessage = (v: unknown): v is { message: string } =>
  Boolean(v && typeof v === "object" && "message" in v);

// ─── Sub-components ───────────────────────────────────────────────

function SourcePill({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/40">
        <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
        {label}: Unavailable
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        ok
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
      {label}: {ok ? "Connected" : "Missing"}
    </span>
  );
}

function SummaryCard({
  title,
  children,
  accentColor,
}: {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div
          className="h-1 w-5 rounded-full"
          style={{ background: accentColor || YELLOW }}
        />
        <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
          {title}
        </span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  warning,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-sm text-white/50">{label}</span>
      <span
        className={`text-sm font-semibold ${
          warning ? "text-red-400" : highlight ? "text-white" : "text-white/80"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function UnavailableBlock({ reason }: { reason: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-center">
      <div className="text-sm text-white/30 font-medium">{reason}</div>
    </div>
  );
}

function SeverityBadge({ level }: { level: "critical" | "warning" | "info" }) {
  const styles = {
    critical: "bg-red-500/20 border-red-500/40 text-red-300",
    warning: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300",
    info: "bg-white/10 border-white/20 text-white/60",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${styles[level]}`}>
      {level.toUpperCase()}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export default function DailyReview() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [month, setMonth] = useState(thisMonth());

  // ── Data queries ──
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

  // ── Derived values ──
  const staffData = comparison && !isMessage(comparison.staffData) ? comparison.staffData : null;
  const posShift = comparison && !isMessage(comparison.posShiftReport) ? comparison.posShiftReport : null;
  const diffs = comparison?.differences ?? null;

  const hasForm = staffData !== null;
  const hasPOS = posShift !== null;

  // Source status
  const formConnected = hasForm;
  const posConnected = hasPOS;
  const receiptConnected = hasPOS && posShift?.difference !== null;

  // ── Critical issues detection ──
  type Issue = { type: string; item: string; expected: string; actual: string; variance: string; severity: "critical" | "warning" | "info" };

  const criticalIssues: Issue[] = [];

  if (!hasForm) {
    criticalIssues.push({
      type: "Missing Data",
      item: "Daily Sales & Stock Form",
      expected: "Submitted",
      actual: "Not Found",
      variance: "—",
      severity: "critical",
    });
  }
  if (!hasPOS) {
    criticalIssues.push({
      type: "Missing Data",
      item: "POS Shift Report",
      expected: "Available",
      actual: "Not Found",
      variance: "—",
      severity: "critical",
    });
  }
  if (diffs?.totalSales !== null && diffs?.totalSales !== undefined && diffs.totalSales !== 0) {
    criticalIssues.push({
      type: "Sales Mismatch",
      item: "Total Sales",
      expected: thb(posShift?.totalSales),
      actual: thb(staffData?.totalSales),
      variance: thb(diffs.totalSales),
      severity: Math.abs(diffs.totalSales) > 500 ? "critical" : "warning",
    });
  }
  if (diffs?.cash !== null && diffs?.cash !== undefined && diffs.cash !== 0) {
    criticalIssues.push({
      type: "Cash Mismatch",
      item: "Cash Sales",
      expected: thb(posShift?.cashPayments),
      actual: thb(staffData?.cashSales),
      variance: thb(diffs.cash),
      severity: Math.abs(diffs.cash) > 200 ? "critical" : "warning",
    });
  }
  if (diffs?.expenses !== null && diffs?.expenses !== undefined && diffs.expenses !== 0) {
    criticalIssues.push({
      type: "Expense Mismatch",
      item: "Total Expenses",
      expected: thb(posShift?.expenses),
      actual: thb(staffData?.expensesTotal),
      variance: thb(diffs.expenses),
      severity: Math.abs(diffs.expenses) > 100 ? "warning" : "info",
    });
  }
  if (staffData?.rollsEnd === 0 || staffData?.rollsEnd === null) {
    criticalIssues.push({
      type: "Stock Alert",
      item: "Burger Buns Remaining",
      expected: "> 0",
      actual: staffData?.rollsEnd === null ? "Not recorded" : "0",
      variance: staffData?.rollsEnd === null ? "No data" : "—",
      severity: staffData?.rollsEnd === 0 ? "warning" : "info",
    });
  }
  if (staffData?.meatEnd === 0 || staffData?.meatEnd === null) {
    criticalIssues.push({
      type: "Stock Alert",
      item: "Meat Remaining (g)",
      expected: "> 0",
      actual: staffData?.meatEnd === null ? "Not recorded" : "0",
      variance: staffData?.meatEnd === null ? "No data" : "—",
      severity: staffData?.meatEnd === 0 ? "warning" : "info",
    });
  }
  if (diffs?.grab === null && hasPOS && hasForm) {
    criticalIssues.push({
      type: "Data Gap",
      item: "Grab Sales (POS)",
      expected: "Available",
      actual: "Not in POS report",
      variance: "—",
      severity: "info",
    });
  }

  const prime = primeCost?.daily;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-4 md:p-6 space-y-6" style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-1.5 w-8 rounded-full" style={{ background: YELLOW }} />
            <h1 className="text-2xl font-extrabold tracking-tight">Daily Review</h1>
          </div>
          <p className="mt-1 ml-11 text-xs text-white/40">
            Daily management summary — sales, variances, and stock status
          </p>
        </div>

        <div className="flex items-center gap-2 ml-11 md:ml-0">
          <span className="text-xs text-white/40">Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setMonth(e.target.value.slice(0, 7));
            }}
            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-400/60"
          />
        </div>
      </div>

      {/* Source status pills */}
      <div className="ml-0 flex flex-wrap gap-2">
        <SourcePill label="Daily Form" ok={loadingComparison ? null : formConnected} />
        <SourcePill label="POS Shift Data" ok={loadingComparison ? null : posConnected} />
        <SourcePill label="Receipt Match" ok={loadingComparison ? null : receiptConnected} />
        <SourcePill label="Labour Data" ok={null} />
      </div>

      {/* Loading state */}
      {loadingComparison && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-8 text-center text-sm text-white/40">
          Loading shift data...
        </div>
      )}

      {!loadingComparison && (
        <>
          {/* ── Critical Issues ───────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-red-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Critical Issues
              </span>
              {criticalIssues.length > 0 && (
                <span className="rounded-full bg-red-500/20 border border-red-500/30 px-2 py-0.5 text-xs font-semibold text-red-300">
                  {criticalIssues.length}
                </span>
              )}
            </div>

            {criticalIssues.length === 0 ? (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-5 py-4">
                <span className="text-sm text-green-400 font-medium">No critical issues detected for this shift</span>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">Type</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">Item</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">Expected</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">Actual</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">Variance</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/40">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {criticalIssues.map((issue, i) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white/50 text-xs">{issue.type}</td>
                          <td className="px-4 py-3 font-medium text-white">{issue.item}</td>
                          <td className="px-4 py-3 text-right text-white/60">{issue.expected}</td>
                          <td className="px-4 py-3 text-right text-white/60">{issue.actual}</td>
                          <td className="px-4 py-3 text-right font-semibold text-red-400">{issue.variance}</td>
                          <td className="px-4 py-3 text-right">
                            <SeverityBadge level={issue.severity} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* ── Four Summary Blocks ───────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full" style={{ background: YELLOW }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Daily Report Summary
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Block A — Sales */}
              <SummaryCard title="Sales Summary">
                {hasForm ? (
                  <>
                    <SummaryRow label="Total Sales" value={thb(staffData?.totalSales)} highlight />
                    <div className="border-t border-white/10 mt-2 pt-2" />
                    <SummaryRow label="Cash" value={thb(staffData?.cashSales)} />
                    <SummaryRow label="QR / PromptPay" value={thb(staffData?.scanSales)} />
                    <SummaryRow label="GrabFood" value={thb(staffData?.grabSales)} />
                    <SummaryRow label="Other" value={thb(staffData ? (staffData.totalSales ?? 0) - (staffData.cashSales ?? 0) - (staffData.scanSales ?? 0) - (staffData.grabSales ?? 0) : null)} />
                    <div className="border-t border-white/10 mt-2 pt-2" />
                    <SummaryRow label="Total Expenses" value={thb(staffData?.expensesTotal)} />
                  </>
                ) : (
                  <div className="text-sm text-white/30 py-2">Form data not submitted for this shift</div>
                )}
              </SummaryCard>

              {/* Block B — Stock Variance */}
              <SummaryCard title="Stock Status">
                {hasForm ? (
                  <>
                    <SummaryRow
                      label="Buns Remaining"
                      value={staffData?.rollsEnd !== null ? num(staffData?.rollsEnd) : "Not recorded"}
                      warning={staffData?.rollsEnd === 0}
                    />
                    <SummaryRow
                      label="Meat Remaining (g)"
                      value={staffData?.meatEnd !== null ? num(staffData?.meatEnd) : "Not recorded"}
                      warning={staffData?.meatEnd === 0}
                    />
                    <SummaryRow
                      label="Drinks Remaining"
                      value={staffData?.drinksCount !== null ? num(staffData?.drinksCount) : "Not recorded"}
                    />
                    <div className="border-t border-white/10 mt-2 pt-2" />
                    <SummaryRow
                      label="Stock Status"
                      value={
                        staffData?.rollsEnd === 0 || staffData?.meatEnd === 0
                          ? "Depleted items"
                          : staffData?.rollsEnd === null || staffData?.meatEnd === null
                          ? "Partial data"
                          : "All recorded"
                      }
                      warning={staffData?.rollsEnd === 0 || staffData?.meatEnd === 0}
                      highlight={staffData?.rollsEnd !== 0 && staffData?.meatEnd !== 0}
                    />
                  </>
                ) : (
                  <div className="text-sm text-white/30 py-2">Stock data not available for this shift</div>
                )}
              </SummaryCard>

              {/* Block C — Cash Reconciliation */}
              <SummaryCard title="Cash Control">
                {hasPOS ? (
                  <>
                    <SummaryRow label="Starting Cash" value={thb(posShift?.startingCash)} />
                    <SummaryRow label="Expected Cash" value={thb(posShift?.expectedCash)} />
                    <SummaryRow label="Actual Cash" value={thb(posShift?.actualCash)} highlight />
                    <div className="border-t border-white/10 mt-2 pt-2" />
                    <SummaryRow
                      label="Cash Difference"
                      value={posShift?.difference !== null ? thb(posShift?.difference) : "No variance data"}
                      warning={posShift?.difference !== null && posShift.difference !== 0}
                    />
                  </>
                ) : (
                  <div className="text-sm text-white/30 py-2">POS shift report not available</div>
                )}
              </SummaryCard>

              {/* Block D — Profit Snapshot */}
              <SummaryCard title="Profit Snapshot">
                {prime ? (
                  <>
                    <SummaryRow label="Total Sales" value={thb(prime.sales)} highlight />
                    <SummaryRow label="Wages" value={thb(prime.wages)} />
                    <SummaryRow label="Food & Bev Cost" value={thb(prime.fnb)} />
                    <SummaryRow label="Prime Cost" value={thb(prime.primeCost)} />
                    <div className="border-t border-white/10 mt-2 pt-2" />
                    <SummaryRow
                      label="Prime Cost %"
                      value={`${prime.primePct.toFixed(1)}%`}
                      warning={prime.primePct > 65}
                      highlight={prime.primePct <= 65}
                    />
                    {loadingPrimeCost && <div className="text-xs text-white/30 pt-1">Loading...</div>}
                  </>
                ) : (
                  <div className="text-sm text-white/30 py-2">
                    {loadingPrimeCost ? "Loading profit data..." : "Profit data unavailable for this date"}
                  </div>
                )}
              </SummaryCard>
            </div>
          </section>

          {/* ── Form vs POS Comparison ────────────────────────── */}
          {(hasForm || hasPOS) && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 w-5 rounded-full bg-blue-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                  Form vs POS Comparison
                </span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">Item</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">Daily Form</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">POS Report</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider text-white/40">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {[
                        { label: "Total Sales", form: staffData?.totalSales, pos: posShift?.totalSales, diff: diffs?.totalSales },
                        { label: "Cash", form: staffData?.cashSales, pos: posShift?.cashPayments, diff: diffs?.cash },
                        { label: "GrabFood", form: staffData?.grabSales, pos: posShift?.grab, diff: diffs?.grab },
                        { label: "QR / Scan", form: staffData?.scanSales, pos: posShift?.scan, diff: diffs?.scan },
                        { label: "Expenses", form: staffData?.expensesTotal, pos: posShift?.expenses, diff: diffs?.expenses },
                      ].map((row) => {
                        const hasDiff = row.diff !== null && row.diff !== undefined && row.diff !== 0;
                        return (
                          <tr key={row.label} className="hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3 font-medium text-white/80">{row.label}</td>
                            <td className="px-5 py-3 text-right text-white/60">
                              {row.form !== null && row.form !== undefined ? thb(row.form) : <span className="text-white/25">No data</span>}
                            </td>
                            <td className="px-5 py-3 text-right text-white/60">
                              {row.pos !== null && row.pos !== undefined ? thb(row.pos) : <span className="text-white/25">No data</span>}
                            </td>
                            <td className="px-5 py-3 text-right">
                              {row.diff === null || row.diff === undefined ? (
                                <span className="text-white/25">—</span>
                              ) : (
                                <span className={`font-semibold ${hasDiff ? "text-red-400" : "text-green-400"}`}>
                                  {row.diff === 0 ? "Matched" : thb(row.diff)}
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

          {/* ── Labour Section ────────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full bg-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Labour Summary
              </span>
            </div>
            <UnavailableBlock reason="Labour analysis data unavailable — usage reconciliation source is offline. Wages recorded in form: wages shown in Sales Summary above." />
          </section>

          {/* ── Staffing vs Demand Chart ──────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1 w-5 rounded-full" style={{ background: YELLOW }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Staffing vs Demand (6PM – 2AM)
              </span>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6">
              <div className="mb-3 text-xs text-white/30 font-medium">Hourly demand</div>
              <div className="flex items-end gap-1.5 h-24 overflow-x-auto pb-1">
                {Array.from({ length: 9 }, (_, i) => {
                  const hour = 18 + i;
                  const displayHour = hour > 24 ? hour - 24 : hour;
                  const label = hour === 24 ? "12am" : hour > 24 ? `${displayHour}am` : hour >= 22 ? `${hour - 12}pm` : `${hour > 12 ? hour - 12 : hour}pm`;
                  return (
                    <div key={hour} className="flex flex-col items-center gap-1 flex-1 min-w-[32px]">
                      <div className="w-full rounded-t bg-white/10 border border-white/10" style={{ height: "40px" }} />
                      <span className="text-[10px] text-white/25 whitespace-nowrap">{label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-white/25">
                Hourly data unavailable — usage reconciliation source offline
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Shift History ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-1 w-5 rounded-full bg-white/30" />
            <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
              Shift History
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/30">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-400/60"
            />
          </div>
        </div>

        {loadingHistory ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-center text-sm text-white/30">
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-6 text-center text-sm text-white/30">
            No shift data for {month}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">By</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Total</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Cash</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">QR</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Grab</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Expenses</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Exp Bank</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Buns</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white/40 whitespace-nowrap">Meat (g)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((row) => {
                    const isSelected = row.shift_date === selectedDate;
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedDate(row.shift_date)}
                        className={`cursor-pointer transition-colors hover:bg-white/10 ${isSelected ? "bg-yellow-400/10 border-l-2 border-yellow-400" : ""}`}
                      >
                        <td className={`px-4 py-3 font-medium whitespace-nowrap ${isSelected ? "text-yellow-300" : "text-white/80"}`}>
                          {row.shift_date}
                        </td>
                        <td className="px-4 py-3 text-white/50 whitespace-nowrap">{row.completed_by || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-white/80 whitespace-nowrap">{thb(row.total_sales)}</td>
                        <td className="px-4 py-3 text-right text-white/50 whitespace-nowrap">{thb(row.cash_sales)}</td>
                        <td className="px-4 py-3 text-right text-white/50 whitespace-nowrap">{thb(row.qr_sales)}</td>
                        <td className="px-4 py-3 text-right text-white/50 whitespace-nowrap">{thb(row.grab_sales)}</td>
                        <td className="px-4 py-3 text-right text-white/50 whitespace-nowrap">{thb(row.total_expenses)}</td>
                        <td className="px-4 py-3 text-right text-white/50 whitespace-nowrap">{thb(row.expected_total_bank)}</td>
                        <td className={`px-4 py-3 text-right whitespace-nowrap ${row.rolls_end === 0 ? "text-red-400" : "text-white/50"}`}>
                          {row.rolls_end ?? "—"}
                        </td>
                        <td className={`px-4 py-3 text-right whitespace-nowrap ${row.meat_end_g === 0 ? "text-red-400" : "text-white/50"}`}>
                          {num(row.meat_end_g)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-white/5 text-xs text-white/25">
              Click any row to load that shift above
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

// ─── Types ──────────────────────────────────────────────────────────
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
  daily?: { date: string; sales: number; wages: number; fnb: number; primeCost: number; primePct: number };
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

// ─── Helpers ─────────────────────────────────────────────────────────
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);

// Returns YYYY-MM-DD in Bangkok timezone (UTC+7), offset by daysBack
const bkkDate = (daysBack: number): string => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
// Yesterday in BKK time — the latest shift that is guaranteed to be closed
const bkkYesterday = () => bkkDate(1);
// Today in BKK time — used to exclude still-open shifts
const bkkToday = () => bkkDate(0);
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

const RECEIPT_STATUS: Record<string, { label: string; cls: string }> = {
  EVIDENCE_MATCH:   { label: "Matched",         cls: "text-green-700 bg-green-100/40 border-green-300" },
  MISSING_RECEIPTS: { label: "Receipts Missing", cls: "text-red-700 bg-red-100/40 border-red-300" },
  PHANTOM_RECEIPTS: { label: "Phantom Receipts", cls: "text-orange-700 bg-orange-100/40 border-orange-300" },
  POS_UNAVAILABLE:  { label: "POS Unavailable",  cls: "text-gray-600 border-gray-300" },
  FORM_MISSING:     { label: "Form Missing",     cls: "text-amber-700 bg-amber-100/40 border-amber-300" },
  NO_EVIDENCE:      { label: "No Evidence",      cls: "text-gray-500 border-gray-300" },
};

// ─── Sub-components ──────────────────────────────────────────────────

function StatusPill({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        {label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
      ok
        ? "border-green-300 bg-green-100/40 text-green-700"
        : "border-red-300 bg-red-100/40 text-red-600"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-400"}`} />
      {label}: {ok ? "Connected" : "Missing"}
    </span>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-white shadow-sm p-4">
      <p className="text-xs font-semibold text-gray-500 mb-3">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, warn, success }: {
  label: string; value: string; bold?: boolean; warn?: boolean; success?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-xs font-semibold ${
        warn ? "text-red-600" : success ? "text-green-700" : bold ? "text-gray-900" : "text-gray-700"
      }`}>
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 my-1.5" />;
}

function SeverityBadge({ level }: { level: "critical" | "warning" | "info" }) {
  const cls = {
    critical: "bg-red-100/40 border-red-300 text-red-700",
    warning:  "bg-amber-100/40 border-amber-300 text-amber-700",
    info:     "border-gray-300 text-gray-500",
  }[level];
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {level === "critical" ? "Critical" : level === "warning" ? "Warning" : "Info"}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 mb-2">{children}</p>;
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded border border-gray-200 bg-white px-4 py-5 text-center text-xs text-gray-400">
      {text}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────
export default function DailyReview() {
  const [selectedDate, setSelectedDate] = useState(bkkYesterday);
  const [month, setMonth] = useState(() => bkkYesterday().slice(0, 7));
  const autoDateSet = useRef(false);

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

  // Auto-select the most recent COMPLETED shift on first data load.
  // Exclude today's BKK date — its Loyverse shift is still open until 3 AM.
  useEffect(() => {
    if (!autoDateSet.current && history.length > 0) {
      autoDateSet.current = true;
      const todayBKK = bkkToday();
      const completedRows = history.filter((r) => r.shift_date < todayBKK);
      if (completedRows.length > 0) {
        const latest = [...completedRows].sort((a, b) => b.shift_date.localeCompare(a.shift_date))[0].shift_date;
        setSelectedDate(latest);
        setMonth(latest.slice(0, 7));
      }
    }
  }, [history]);

  // Derived state
  const staffData = comparison && !isMsg(comparison.staffData) ? comparison.staffData : null;
  const posShift  = comparison && !isMsg(comparison.posShiftReport) ? comparison.posShiftReport : null;
  const diffs     = comparison?.differences ?? null;
  const receipt   = comparison?.receiptEvidence ?? null;
  const wages     = comparison?.wageDetail ?? null;

  const hasForm    = staffData !== null;
  const hasPOS     = posShift !== null;
  const hasReceipt = receipt !== null && receipt.receiptStatus !== "NO_EVIDENCE";
  const hasLabour  = wages !== null && (wages.staffCount > 0 || wages.totalWages > 0);

  const isTodayOrFuture = selectedDate >= todayISO();
  const isOpenShift = isTodayOrFuture && !hasForm;

  // Build issues list
  type Issue = { type: string; item: string; expected: string; actual: string; variance: string; severity: "critical" | "warning" | "info" };
  const issues: Issue[] = [];
  if (!hasForm && !isOpenShift)
    issues.push({ type: "Missing Data", item: "Daily Sales & Stock Form", expected: "Submitted", actual: "Not Found", variance: "—", severity: "critical" });
  if (!hasPOS && !isOpenShift)
    issues.push({ type: "Missing Data", item: "POS Shift Report", expected: "Available", actual: "Not Found", variance: "—", severity: "critical" });
  if (diffs?.totalSales !== null && diffs?.totalSales !== undefined && diffs.totalSales !== 0)
    issues.push({ type: "Sales Mismatch", item: "Total Sales", expected: thb(posShift?.totalSales), actual: thb(staffData?.totalSales), variance: thb(diffs.totalSales), severity: Math.abs(diffs.totalSales) > 500 ? "critical" : "warning" });
  if (diffs?.cash !== null && diffs?.cash !== undefined && diffs.cash !== 0)
    issues.push({ type: "Cash Mismatch", item: "Cash Sales", expected: thb(posShift?.cashPayments), actual: thb(staffData?.cashSales), variance: thb(diffs.cash), severity: Math.abs(diffs.cash) > 200 ? "critical" : "warning" });
  if (diffs?.expenses !== null && diffs?.expenses !== undefined && diffs.expenses !== 0)
    issues.push({ type: "Expense Mismatch", item: "Total Expenses", expected: thb(posShift?.expenses), actual: thb(staffData?.expensesTotal), variance: thb(diffs.expenses), severity: Math.abs(diffs.expenses) > 100 ? "warning" : "info" });
  if (hasForm && staffData?.rollsEnd === 0)
    issues.push({ type: "Stock Alert", item: "Burger Buns Remaining", expected: "> 0", actual: "0", variance: "—", severity: "warning" });
  if (hasForm && staffData?.meatEnd === 0)
    issues.push({ type: "Stock Alert", item: "Meat Remaining (g)", expected: "> 0", actual: "0", variance: "—", severity: "warning" });
  if (receipt?.receiptStatus === "MISSING_RECEIPTS" && (receipt.receiptDifference ?? 0) > 0)
    issues.push({ type: "Receipt Alert", item: "Unaccounted Receipts", expected: String(receipt.posReceiptCount), actual: String(receipt.cashierReceiptCount), variance: `+${receipt.receiptDifference}`, severity: "critical" });

  const prime = primeCost?.daily;
  const selectedHistoryRow = history.find(r => r.shift_date === selectedDate);
  const receiptStatusInfo = receipt ? (RECEIPT_STATUS[receipt.receiptStatus] ?? { label: receipt.receiptStatus, cls: "border-gray-300 text-gray-500" }) : null;

  return (
    <div className="bg-white text-gray-900 p-4 space-y-5" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px" }}>

      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Sales & Shift Analysis</h1>
          <p className="text-xs text-gray-400 mt-0.5">Sales, POS comparison, receipts, stock and labour summary</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Shift Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              autoDateSet.current = true;
              setSelectedDate(e.target.value);
              setMonth(e.target.value.slice(0, 7));
            }}
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
          />
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <StatusPill label="Daily Form"    ok={loadingComparison ? null : hasForm} />
        <StatusPill label="POS Shift"     ok={loadingComparison ? null : hasPOS} />
        <StatusPill label="Receipt Match" ok={loadingComparison ? null : (hasReceipt ? receipt?.receiptStatus === "EVIDENCE_MATCH" : null)} />
        <StatusPill label="Labour Data"   ok={loadingComparison ? null : hasLabour} />
      </div>

      {/* Open shift notice */}
      {isOpenShift && !loadingComparison && (
        <div className="rounded border border-amber-300 bg-amber-100/40 px-4 py-3">
          <span className="text-xs text-amber-700 font-medium">
            No form submitted yet for {selectedDate} — shift may still be open or not yet started
          </span>
        </div>
      )}

      {/* Loading */}
      {loadingComparison && (
        <div className="rounded border border-gray-200 bg-white px-4 py-8 text-center text-xs text-gray-400">
          Loading shift data…
        </div>
      )}

      {!loadingComparison && !isOpenShift && (
        <>
          {/* Critical Issues */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <SectionLabel>Critical Issues</SectionLabel>
              {issues.length > 0 && (
                <span className="rounded border border-red-300 bg-red-100/40 px-2 py-0.5 text-xs font-semibold text-red-700 -mt-2">
                  {issues.length}
                </span>
              )}
            </div>
            {issues.length === 0 ? (
              <div className="rounded border border-green-300 bg-green-100/40 px-4 py-3">
                <span className="text-xs text-green-700 font-medium">No critical issues for this shift</span>
              </div>
            ) : (
              <div className="rounded border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400">Type</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400">Item</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">Expected</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">Actual</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">Variance</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {issues.map((issue, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-xs text-gray-400">{issue.type}</td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{issue.item}</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">{issue.expected}</td>
                          <td className="px-3 py-2 text-right text-xs text-gray-500">{issue.actual}</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-red-600">{issue.variance}</td>
                          <td className="px-3 py-2 text-right"><SeverityBadge level={issue.severity} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* 4 Summary Cards */}
          <section>
            <SectionLabel>Shift Overview</SectionLabel>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

              <Card title="Sales Summary">
                {hasForm ? (
                  <>
                    <Row label="Total Sales"    value={thb(staffData?.totalSales)} bold />
                    <Divider />
                    <Row label="Cash"           value={thb(staffData?.cashSales)} />
                    <Row label="QR / PromptPay" value={thb(staffData?.scanSales)} />
                    <Row label="GrabFood"       value={thb(staffData?.grabSales)} />
                    <Divider />
                    <Row label="Expenses Total" value={thb(staffData?.expensesTotal)} />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-1">No form data for this shift</p>
                )}
              </Card>

              <Card title="Stock Status">
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
                  <p className="text-xs text-gray-400 py-1">Stock data not available</p>
                )}
              </Card>

              <Card title="Cash Control">
                {hasPOS ? (
                  <>
                    <Row label="Starting Cash" value={thb(posShift?.startingCash)} />
                    <Row label="Expected Cash" value={thb(posShift?.expectedCash)} />
                    <Row label="Actual Cash"   value={thb(posShift?.actualCash ?? null)} bold />
                    <Divider />
                    <Row
                      label="Difference"
                      value={posShift?.difference !== null ? thb(posShift?.difference) : "—"}
                      warn={posShift?.difference !== null && posShift.difference !== 0}
                      success={posShift?.difference === 0}
                    />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-1">POS shift report not available</p>
                )}
              </Card>

              <Card title="Profit Snapshot">
                {prime ? (
                  <>
                    <Row label="Total Sales"     value={thb(prime.sales)} bold />
                    <Row label="Wages"           value={thb(prime.wages)} />
                    <Row label="Food & Bev Cost" value={thb(prime.fnb)} />
                    <Row label="Prime Cost"      value={thb(prime.primeCost)} />
                    <Divider />
                    <Row
                      label="Prime Cost %"
                      value={`${prime.primePct.toFixed(1)}%`}
                      warn={prime.primePct > 65}
                      success={prime.primePct <= 65}
                    />
                  </>
                ) : (
                  <p className="text-xs text-gray-400 py-1">
                    {loadingPrimeCost ? "Loading…" : "Profit data unavailable"}
                  </p>
                )}
              </Card>
            </div>
          </section>

          {/* Form vs POS Comparison */}
          {(hasForm || hasPOS) && (
            <section>
              <SectionLabel>Form vs POS Comparison</SectionLabel>
              <div className="rounded border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-gray-400">Item</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-400">Daily Form</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-400">POS Report</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-gray-400">Difference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { label: "Total Sales", form: staffData?.totalSales, pos: posShift?.totalSales,   diff: diffs?.totalSales },
                        { label: "Cash",        form: staffData?.cashSales,  pos: posShift?.cashPayments, diff: diffs?.cash },
                        { label: "GrabFood",    form: staffData?.grabSales,  pos: posShift?.grab,         diff: diffs?.grab },
                        { label: "QR / Scan",   form: staffData?.scanSales,  pos: posShift?.scan,         diff: diffs?.scan },
                        { label: "Expenses",    form: staffData?.expensesTotal, pos: posShift?.expenses,  diff: diffs?.expenses },
                      ].map((row) => {
                        const hasDiff = row.diff !== null && row.diff !== undefined && row.diff !== 0;
                        return (
                          <tr key={row.label}>
                            <td className="px-4 py-2 text-xs font-medium text-gray-700">{row.label}</td>
                            <td className="px-4 py-2 text-right text-xs text-gray-600">
                              {row.form !== null && row.form !== undefined ? thb(row.form) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right text-xs text-gray-600">
                              {row.pos !== null && row.pos !== undefined ? thb(row.pos) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2 text-right text-xs font-semibold">
                              {row.diff === null || row.diff === undefined ? (
                                <span className="text-gray-300">—</span>
                              ) : (
                                <span className={hasDiff ? "text-red-600" : "text-green-700"}>
                                  {row.diff === 0 ? "Match" : thb(row.diff)}
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

          {/* Receipt Summary */}
          <section>
            <SectionLabel>Receipt Summary</SectionLabel>
            {hasReceipt && receipt ? (
              <div className="rounded border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">POS Receipts</p>
                    <p className="text-sm font-bold text-gray-900">{receipt.posReceiptCount ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Cashier Declared</p>
                    <p className="text-sm font-bold text-gray-900">{receipt.cashierReceiptCount ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Difference</p>
                    <p className={`text-sm font-bold ${(receipt.receiptDifference ?? 0) !== 0 ? "text-red-600" : "text-green-700"}`}>
                      {receipt.receiptDifference !== null ? (receipt.receiptDifference === 0 ? "0" : `+${receipt.receiptDifference}`) : "—"}
                    </p>
                  </div>
                </div>
                {receiptStatusInfo && (
                  <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${receiptStatusInfo.cls}`}>
                    {receiptStatusInfo.label}
                  </span>
                )}
                {receipt.receiptStatus === "MISSING_RECEIPTS" && (
                  <p className="mt-2 text-xs text-red-600">
                    POS shows {receipt.receiptDifference} more receipts than cashier declared — verify with cashier
                  </p>
                )}
                {receipt.receiptStatus === "PHANTOM_RECEIPTS" && (
                  <p className="mt-2 text-xs text-orange-700">
                    Cashier declared {Math.abs(receipt.receiptDifference ?? 0)} more receipts than POS shows
                  </p>
                )}
              </div>
            ) : (
              <EmptyCard text="Receipt evidence not available for this shift" />
            )}
          </section>

          {/* Stock Summary */}
          <section>
            <SectionLabel>Stock Summary</SectionLabel>
            {hasForm ? (
              <div className="rounded border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Buns Remaining</p>
                    <p className={`text-sm font-bold ${staffData?.rollsEnd === 0 ? "text-red-600" : "text-gray-900"}`}>
                      {staffData?.rollsEnd !== null ? num(staffData?.rollsEnd) : "—"}
                    </p>
                    {staffData?.rollsEnd === 0 && <p className="text-xs text-red-500 font-medium">Depleted</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Meat Remaining</p>
                    <p className={`text-sm font-bold ${staffData?.meatEnd === 0 ? "text-red-600" : "text-gray-900"}`}>
                      {staffData?.meatEnd !== null ? `${num(staffData?.meatEnd)}g` : "—"}
                    </p>
                    {staffData?.meatEnd === 0 && <p className="text-xs text-red-500 font-medium">Depleted</p>}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Drinks Count</p>
                    <p className="text-sm font-bold text-gray-900">
                      {staffData?.drinksCount !== null ? num(staffData?.drinksCount) : "—"}
                    </p>
                  </div>
                  {selectedHistoryRow && (
                    <>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Purchases</p>
                        <p className="text-sm font-bold text-gray-900">{thb(selectedHistoryRow.shopping_total)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">Expected Bank</p>
                        <p className="text-sm font-bold text-gray-900">{thb(selectedHistoryRow.expected_total_bank)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <EmptyCard text="Stock data not available — no form submitted for this shift" />
            )}
          </section>

          {/* Labour Summary */}
          <section>
            <SectionLabel>Labour Summary</SectionLabel>
            {hasLabour ? (
              <div className="rounded border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Staff on Shift</p>
                    <p className="text-sm font-bold text-gray-900">{wages!.staffCount > 0 ? wages!.staffCount : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total Wages</p>
                    <p className="text-sm font-bold text-gray-900">{thb(wages!.totalWages)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Shift Window</p>
                    <p className="text-xs font-medium text-gray-700">17:00 – 03:00 BKK</p>
                  </div>
                </div>
                {wages!.entries.length > 0 && (
                  <>
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Staff Wages</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {wages!.entries.map((e, i) => (
                          <div key={i} className="flex justify-between items-center rounded border border-gray-200 px-3 py-1.5">
                            <span className="text-xs text-gray-700 font-medium">{e.name}</span>
                            <span className="text-xs text-gray-900 font-semibold">{thb(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {wages!.staffCount === 0 && wages!.totalWages > 0 && (
                  <p className="text-xs text-gray-400 mt-2">Individual staff entries not available in this form version</p>
                )}
              </div>
            ) : selectedHistoryRow && selectedHistoryRow.wages_total > 0 ? (
              <div className="rounded border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total Wages</p>
                    <p className="text-sm font-bold text-gray-900">{thb(selectedHistoryRow.wages_total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Shift Window</p>
                    <p className="text-xs font-medium text-gray-700">17:00 – 03:00 BKK</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">Staff name breakdown not available for this form version</p>
              </div>
            ) : (
              <EmptyCard text="Labour data not available — no wage entries found in form" />
            )}
          </section>

          {/* Profit Full View */}
          {(prime || selectedHistoryRow) && (
            <section>
              <SectionLabel>Profit Detail</SectionLabel>
              <div className="rounded border border-gray-200 bg-white p-4">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total Sales</p>
                    <p className="text-sm font-bold text-gray-900">{prime ? thb(prime.sales) : thb(selectedHistoryRow?.total_sales)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Wages</p>
                    <p className="text-sm font-bold text-gray-900">{prime ? thb(prime.wages) : thb(selectedHistoryRow?.wages_total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{prime ? "Food & Bev Cost" : "Total Expenses"}</p>
                    <p className="text-sm font-bold text-gray-900">{prime ? thb(prime.fnb) : thb(selectedHistoryRow?.total_expenses)}</p>
                  </div>
                  {prime && (
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Prime Cost %</p>
                      <p className={`text-sm font-bold ${prime.primePct > 65 ? "text-red-600" : "text-green-700"}`}>
                        {prime.primePct.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
                {prime && prime.primePct > 65 && (
                  <p className="mt-3 rounded border border-red-300 bg-red-100/40 px-3 py-2 text-xs text-red-700">
                    Prime cost above 65% threshold — review wages and food & bev costs
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {/* Shift History */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Shift History</SectionLabel>
          <div className="flex items-center gap-2 -mt-2">
            <span className="text-xs text-gray-400">Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 focus:outline-none focus:border-gray-400"
            />
          </div>
        </div>

        {loadingHistory ? (
          <EmptyCard text="Loading history…" />
        ) : history.length === 0 ? (
          <EmptyCard text={`No shift data for ${month}`} />
        ) : (
          <div className="rounded border border-gray-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    {["Date", "By", "Total", "Cash", "QR", "Grab", "Expenses", "Exp Bank", "Buns", "Meat (g)"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
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
                        className={`cursor-pointer transition-colors hover:bg-gray-200/30 ${isSelected ? "bg-yellow-50 border-l-2 border-l-yellow-400" : ""}`}
                      >
                        <td className={`px-3 py-2 text-xs font-semibold whitespace-nowrap ${isSelected ? "text-yellow-700" : "text-gray-700"}`}>
                          {row.shift_date}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{row.completed_by || "—"}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-gray-800 whitespace-nowrap">{thb(row.total_sales)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.cash_sales)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.qr_sales)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.grab_sales)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.total_expenses)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.expected_total_bank)}</td>
                        <td className={`px-3 py-2 text-xs whitespace-nowrap ${row.rolls_end === 0 ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          {row.rolls_end ?? "—"}
                        </td>
                        <td className={`px-3 py-2 text-xs whitespace-nowrap ${row.meat_end_g === 0 ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          {num(row.meat_end_g)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-3 py-1.5 border-t border-gray-100 text-xs text-gray-400">
              Click any row to load that shift — sorted most recent first
            </div>
          </div>
        )}
      </section>

    </div>
  );
}

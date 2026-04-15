import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

type StaffData = {
  totalSales: number | null;
  cashSales: number | null;
  grabSales: number | null;
  scanSales: number | null;
  expensesTotal: number | null;
  rollsEnd: number | null;
  meatEnd: number | null;
  drinksCount: number | null;
  drinksBySku: { sku: string; count: number }[];
  expectedBank: number | null;
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
  receiptCount: number | null;
  expectedBank: number | null;
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

type CriticalIssue = {
  code: string;
  type: string;
  item: string;
  expected: string;
  actual: string;
  variance: string;
  severity: "critical" | "warning" | "info";
};

type UsageRecon = {
  buns?: { variance?: number | null };
  meat?: { varianceGrams?: number | null };
  drinks?: {
    rows: Array<{
      label: string;
      closing: number | null;
      variance: number | null;
    }>;
  };
};

type LabourSummary = {
  utilisation?: {
    fullShiftUtilisationPercent?: number;
  };
};

type ComparisonPayload = {
  date: string;
  shiftWindow: string;
  staffData: StaffData | { message: string };
  posShiftReport: PosShift | { message: string };
  differences: Differences;
  receiptEvidence?: ReceiptEvidence;
  wageDetail?: WageDetail;
  receiptSummary?: {
    source: string;
    channels: { cash: number | null; qr: number | null; grab: number | null; other: number | null };
    total: number | null;
  };
  stockRecon?: UsageRecon | null;
  labourSummary?: LabourSummary | null;
  criticalIssues?: CriticalIssue[];
  shiftReport?: { id: string; pdfUrl: string } | null;
};

type PrimeCostPayload = {
  ok: boolean;
  status?: string;
  reason?: string;
  date?: string;
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
  shopping_total: number;
  wages_total: number;
  total_expenses: number;
  rolls_end: number;
  meat_end_g: number;
  expected_total_bank: number;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const bkkDate = (daysBack: number): string => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  d.setDate(d.getDate() - daysBack);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const bkkYesterday = () => bkkDate(1);
const bkkToday = () => bkkDate(0);
const thb = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return `฿${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
const num = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
const isMsg = (v: unknown): v is { message: string } => Boolean(v && typeof v === "object" && "message" in v);

function StatusPill({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-400">{label}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${ok ? "border-green-300 bg-green-100/40 text-green-700" : "border-red-300 bg-red-100/40 text-red-600"}`}>
      {label}: {ok ? "Connected" : "Missing"}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold text-gray-500 mb-2">{children}</p>;
}

function EmptyCard({ text }: { text: string }) {
  return <div className="rounded border border-gray-200 bg-white px-4 py-5 text-center text-xs text-gray-400">{text}</div>;
}

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
      const r = await fetch(`/api/metrics/prime-cost?date=${selectedDate}`);
      if (!r.ok) throw new Error("Failed to load prime cost");
      return r.json();
    },
    enabled: Boolean(selectedDate),
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

  const staffData = comparison && !isMsg(comparison.staffData) ? comparison.staffData : null;
  const posShift = comparison && !isMsg(comparison.posShiftReport) ? comparison.posShiftReport : null;
  const diffs = comparison?.differences ?? null;
  const wages = comparison?.wageDetail ?? null;
  const issues = comparison?.criticalIssues ?? [];
  const receiptSummary = comparison?.receiptSummary;
  const stockRecon = comparison?.stockRecon;
  const labourSummary = comparison?.labourSummary;
  const shiftReport = comparison?.shiftReport;

  const hasForm = staffData !== null;
  const hasPOS = posShift !== null;
  const hasLabour = Boolean(wages && wages.staffCount > 0);
  const isTodayOrFuture = selectedDate >= todayISO();
  const isOpenShift = isTodayOrFuture && !hasForm;

  const prime = primeCost?.daily;

  return (
    <div className="bg-white text-gray-900 p-4 space-y-5" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px" }}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Daily Sales & Shift Analysis</h1>
          <p className="text-xs text-gray-400 mt-0.5">Operational shift review from canonical daily comparison</p>
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
            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusPill label="Daily Form" ok={loadingComparison ? null : hasForm} />
        <StatusPill label="POS Shift" ok={loadingComparison ? null : hasPOS} />
        <StatusPill label="Labour Data" ok={loadingComparison ? null : hasLabour} />
        <StatusPill label="Prime Cost" ok={loadingPrimeCost ? null : Boolean(prime)} />
      </div>

      {isOpenShift && !loadingComparison && (
        <div className="rounded border border-amber-300 bg-amber-100/40 px-4 py-3 text-xs text-amber-700">
          No form submitted yet for {selectedDate} — shift may still be open or not yet started.
        </div>
      )}

      {loadingComparison && <EmptyCard text="Loading shift data…" />}

      {!loadingComparison && !isOpenShift && (
        <>
          <section>
            <SectionLabel>Critical Issues</SectionLabel>
            {issues.length === 0 ? (
              <div className="rounded border border-green-300 bg-green-100/40 px-4 py-3 text-xs text-green-700">No critical issues for this shift.</div>
            ) : (
              <div className="rounded border border-gray-200 bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Type', 'Item', 'Expected', 'Actual', 'Variance', 'Severity'].map((h) => (
                          <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {issues.map((issue, i) => (
                        <tr key={`${issue.code}-${i}`}>
                          <td className="px-3 py-2 text-xs text-gray-500">{issue.type}</td>
                          <td className="px-3 py-2 text-xs font-medium text-gray-800">{issue.item}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-600">{issue.expected}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-600">{issue.actual}</td>
                          <td className="px-3 py-2 text-xs text-right text-red-600 font-semibold">{issue.variance}</td>
                          <td className="px-3 py-2 text-xs text-right uppercase text-gray-600">{issue.severity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section>
            <SectionLabel>Shift Summary</SectionLabel>
            <div className="rounded border border-gray-200 bg-white p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-xs text-gray-400">Total Sales</p><p className="text-sm font-bold">{thb(staffData?.totalSales)}</p></div>
              <div><p className="text-xs text-gray-400">Cash</p><p className="text-sm font-bold">{thb(staffData?.cashSales)}</p></div>
              <div><p className="text-xs text-gray-400">QR / PromptPay</p><p className="text-sm font-bold">{thb(staffData?.scanSales)}</p></div>
              <div><p className="text-xs text-gray-400">Grab</p><p className="text-sm font-bold">{thb(staffData?.grabSales)}</p></div>
              <div><p className="text-xs text-gray-400">Expenses Total</p><p className="text-sm font-bold">{thb(staffData?.expensesTotal)}</p></div>
              <div><p className="text-xs text-gray-400">Expected Bank</p><p className="text-sm font-bold">{thb(staffData?.expectedBank ?? posShift?.expectedBank)}</p></div>
              <div><p className="text-xs text-gray-400">POS Receipts</p><p className="text-sm font-bold">{num(posShift?.receiptCount)}</p></div>
            </div>
          </section>

          <section>
            <SectionLabel>Cash / POS Status</SectionLabel>
            {hasPOS ? (
              <div className="rounded border border-gray-200 bg-white p-4 grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div><p className="text-xs text-gray-400">Starting Cash</p><p className="text-sm font-bold">{thb(posShift?.startingCash)}</p></div>
                <div><p className="text-xs text-gray-400">POS Cash</p><p className="text-sm font-bold">{thb(posShift?.cashPayments)}</p></div>
                <div><p className="text-xs text-gray-400">Expected Cash</p><p className="text-sm font-bold">{thb(posShift?.expectedCash)}</p></div>
                <div><p className="text-xs text-gray-400">Counted/Form Cash</p><p className="text-sm font-bold">{thb(staffData?.cashSales)}</p></div>
                <div><p className="text-xs text-gray-400">Variance</p><p className="text-sm font-bold">{thb(diffs?.cash ?? posShift?.difference)}</p></div>
              </div>
            ) : (
              <EmptyCard text="POS Shift Report Missing — Cash/POS status unavailable" />
            )}
          </section>

          <section>
            <SectionLabel>Receipt Summary</SectionLabel>
            <div className="rounded border border-gray-200 bg-white p-4 grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div><p className="text-xs text-gray-400">Cash Receipts</p><p className="text-sm font-bold">{num(receiptSummary?.channels.cash)}</p></div>
              <div><p className="text-xs text-gray-400">QR Receipts</p><p className="text-sm font-bold">{num(receiptSummary?.channels.qr)}</p></div>
              <div><p className="text-xs text-gray-400">Grab Receipts</p><p className="text-sm font-bold">{num(receiptSummary?.channels.grab)}</p></div>
              <div><p className="text-xs text-gray-400">Other Receipts</p><p className="text-sm font-bold">{num(receiptSummary?.channels.other)}</p></div>
              <div><p className="text-xs text-gray-400">Total Receipts</p><p className="text-sm font-bold">{num(receiptSummary?.total)}</p></div>
            </div>
          </section>

          <section>
            <SectionLabel>Stock Summary</SectionLabel>
            <div className="rounded border border-gray-200 bg-white p-4 space-y-3">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div><p className="text-xs text-gray-400">Buns Remaining</p><p className="text-sm font-bold">{num(staffData?.rollsEnd)}</p></div>
                <div><p className="text-xs text-gray-400">Meat Remaining (g)</p><p className="text-sm font-bold">{num(staffData?.meatEnd)}</p></div>
                <div><p className="text-xs text-gray-400">Bun Variance</p><p className="text-sm font-bold">{num(stockRecon?.buns?.variance)}</p></div>
                <div><p className="text-xs text-gray-400">Meat Variance (g)</p><p className="text-sm font-bold">{num(stockRecon?.meat?.varianceGrams)}</p></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">Drinks by SKU/Brand</p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400">Drink</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">Closing Count</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(stockRecon?.drinks?.rows?.length
                        ? stockRecon.drinks.rows.map((d) => ({ sku: d.label, closing: d.closing, variance: d.variance }))
                        : (staffData?.drinksBySku ?? []).map((d) => ({ sku: d.sku, closing: d.count, variance: null }))
                      ).map((row) => (
                        <tr key={row.sku}>
                          <td className="px-3 py-2 text-xs text-gray-700">{row.sku}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-700">{num(row.closing)}</td>
                          <td className="px-3 py-2 text-xs text-right text-gray-700">{num(row.variance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section>
            <SectionLabel>Labour Summary</SectionLabel>
            <div className="rounded border border-gray-200 bg-white p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-xs text-gray-400">Staff Count</p><p className="text-sm font-bold">{num(wages?.staffCount)}</p></div>
              <div><p className="text-xs text-gray-400">Total Wages</p><p className="text-sm font-bold">{thb(wages?.totalWages)}</p></div>
              <div><p className="text-xs text-gray-400">Shift Window</p><p className="text-sm font-bold">{comparison?.shiftWindow || '17:00-03:00'}</p></div>
              <div><p className="text-xs text-gray-400">Labour Utilisation %</p><p className="text-sm font-bold">{labourSummary?.utilisation?.fullShiftUtilisationPercent !== undefined ? `${labourSummary.utilisation.fullShiftUtilisationPercent.toFixed(1)}%` : 'Unavailable'}</p></div>
            </div>
          </section>

          <section>
            <SectionLabel>Profit / Cost</SectionLabel>
            {prime ? (
              <div className="rounded border border-gray-200 bg-white p-4 grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div><p className="text-xs text-gray-400">Total Sales</p><p className="text-sm font-bold">{thb(prime.sales)}</p></div>
                <div><p className="text-xs text-gray-400">Wages</p><p className="text-sm font-bold">{thb(prime.wages)}</p></div>
                <div><p className="text-xs text-gray-400">Food & Bev Cost</p><p className="text-sm font-bold">{thb(prime.fnb)}</p></div>
                <div><p className="text-xs text-gray-400">Prime Cost</p><p className="text-sm font-bold">{thb(prime.primeCost)}</p></div>
                <div><p className="text-xs text-gray-400">Prime Cost %</p><p className="text-sm font-bold">{prime.primePct.toFixed(1)}%</p></div>
              </div>
            ) : (
              <EmptyCard text={primeCost?.reason === 'NO_SHIFT_DATA' ? 'Profit data unavailable — NO_SHIFT_DATA' : 'Profit data unavailable'} />
            )}
          </section>

          <section>
            <SectionLabel>Form vs POS Comparison</SectionLabel>
            {hasPOS ? (
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
                        { label: 'Total Sales', form: staffData?.totalSales, pos: posShift?.totalSales, diff: diffs?.totalSales },
                        { label: 'Cash', form: staffData?.cashSales, pos: posShift?.cashPayments, diff: diffs?.cash },
                        { label: 'Grab', form: staffData?.grabSales, pos: posShift?.grab, diff: diffs?.grab },
                        { label: 'QR / PromptPay', form: staffData?.scanSales, pos: posShift?.scan, diff: diffs?.scan },
                      ].map((row) => (
                        <tr key={row.label}>
                          <td className="px-4 py-2 text-xs text-gray-700">{row.label}</td>
                          <td className="px-4 py-2 text-xs text-right text-gray-600">{thb(row.form)}</td>
                          <td className="px-4 py-2 text-xs text-right text-gray-600">{thb(row.pos)}</td>
                          <td className="px-4 py-2 text-xs text-right text-gray-600">{thb(row.diff)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <EmptyCard text="POS Shift Report Missing — Comparison Unavailable" />
            )}
          </section>
        </>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Shift History</SectionLabel>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded border border-gray-200 px-2 py-1 text-xs"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => {
                if (shiftReport?.pdfUrl) window.open(shiftReport.pdfUrl, '_blank');
              }}
              disabled={!shiftReport?.pdfUrl}
              className="rounded border border-gray-200 px-2 py-1 text-xs disabled:opacity-40"
            >
              PDF
            </button>
            <span className="text-xs text-gray-400">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-gray-200 bg-white px-2 py-1 text-xs" />
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
                    {['Date', 'By', 'Total', 'Cash', 'QR', 'Grab', 'Expenses', 'Exp Bank', 'Buns', 'Meat (g)'].map((h) => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...history].sort((a, b) => b.shift_date.localeCompare(a.shift_date)).map((row) => (
                    <tr key={row.id} onClick={() => { autoDateSet.current = true; setSelectedDate(row.shift_date); setMonth(row.shift_date.slice(0, 7)); }} className="cursor-pointer hover:bg-gray-200/30">
                      <td className="px-3 py-2 text-xs font-semibold text-gray-700 whitespace-nowrap">{row.shift_date}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{row.completed_by || '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.total_sales)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.cash_sales)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.qr_sales)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.grab_sales)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.total_expenses)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{thb(row.expected_total_bank)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{num(row.rolls_end)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{num(row.meat_end_g)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

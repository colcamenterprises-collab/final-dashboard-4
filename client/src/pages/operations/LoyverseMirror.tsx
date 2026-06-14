import { useEffect, useMemo, useState } from "react";

type DiagnosticStatus = "ok" | "warning" | "fail" | string;

type Diagnostic = {
  status?: DiagnosticStatus;
  verdict?: string;
  ok?: boolean;
  latestSyncAt?: string | null;
  latestReceiptDate?: string | null;
  latestShiftDate?: string | null;
  latestSync?: { lastReceipt?: string | null; lastShift?: string | null; lastSync?: string | null } | null;
  integrity?: Record<string, unknown[]>;
  paymentMapping?: { unmappedPayments?: unknown[] };
  latestShiftComparison?: unknown;
  sevenDayComparison?: unknown[];
  blockers?: unknown[];
  warnings?: unknown[];
  last_updated?: string | null;
};

type OwnerStatus = "healthy" | "review" | "problem";
type Channel = "cash" | "qr" | "grab" | "other";

type LatestShiftSummary = {
  date: string | null;
  grossSales: number | null;
  staffGrossSales: number | null;
  netSales: number | null;
  posReceipts: number | null;
  staffReceipts: number | null;
  cashVariance: number | null;
  salesDifference: number | null;
  receiptDifference: number | null;
  paymentCounts: Record<Channel, number | null>;
  status: OwnerStatus;
};

type ChartShift = {
  date: string | null;
  label: string;
  sales: number | null;
  receipts: number | null;
  status: OwnerStatus;
};

type OwnerIssue = {
  title: string;
  message: string;
  status: OwnerStatus;
};

const moneyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-TH", { maximumFractionDigits: 0 });
const chartPoints = "24,148 92,118 160,132 228,86 296,104 364,52 432,72";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getNumber(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = toNumber(record[key]);
    if (value !== null) return value;
  }
  return null;
}

function getNestedRecord(record: Record<string, unknown> | null | undefined, keys: string[]): Record<string, unknown> | null {
  if (!record) return null;
  for (const key of keys) {
    if (isRecord(record[key])) return record[key];
  }
  return null;
}

function getString(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function formatMoney(value: number | null) {
  return value === null ? "Not available" : moneyFormatter.format(value);
}

function formatNumber(value: number | null) {
  return value === null ? "Not available" : numberFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function statusFromRaw(value: unknown): OwnerStatus {
  const normalized = String(value || "").toLowerCase();
  if (["ok", "match", "verified", "healthy"].includes(normalized)) return "healthy";
  if (["warning", "missing", "no_shift_data", "review"].includes(normalized)) return "review";
  return "problem";
}

function statusLabel(status: OwnerStatus) {
  if (status === "healthy") return "VERIFIED";
  if (status === "review") return "NEEDS REVIEW";
  return "ACTION REQUIRED";
}

function statusTone(status: OwnerStatus) {
  if (status === "healthy") return "text-emerald-600";
  if (status === "review") return "text-amber-600";
  return "text-red-600";
}

function statusDotClasses(status: OwnerStatus) {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "review") return "bg-amber-400";
  return "bg-red-500";
}

function getLatestRecord(latest: unknown): Record<string, unknown> | null {
  return isRecord(latest) ? latest : null;
}

function getPosTotals(latest: unknown): Record<string, unknown> | null {
  const record = getLatestRecord(latest);
  if (!record) return null;
  const directTotalKeys = ["appGross", "shiftGross", "appReceiptCount", "receiptCount", "receiptTotal", "shiftTotal"];
  if (directTotalKeys.some((key) => key in record)) return record;
  return getNestedRecord(record, ["receiptDerivedTotals", "posTotals", "totals", "loyverseShiftReportTotals"]);
}

function getStaffTotals(latest: unknown): Record<string, unknown> | null {
  const record = getLatestRecord(latest);
  return getNestedRecord(record, ["appShiftTotals", "staffTotals", "dailySalesTotals", "legacyAppTotals"]);
}

function getDifference(latest: unknown): Record<string, unknown> | null {
  const record = getLatestRecord(latest);
  if (!record) return null;
  return isRecord(record.difference) ? record.difference : record;
}

function getChannelCount(record: Record<string, unknown> | null, channel: Channel): number | null {
  const countKeys = [
    `${channel}ReceiptCount`,
    `${channel}Receipts`,
    `${channel}Count`,
    `${channel}_receipt_count`,
    `${channel}_receipts`,
    `${channel}_count`,
  ];
  return getNumber(record, countKeys);
}

function buildLatestSummary(data: Diagnostic | null): LatestShiftSummary {
  const latest = data?.latestShiftComparison;
  const latestRecord = getLatestRecord(latest);
  const posTotals = getPosTotals(latest);
  const staffTotals = getStaffTotals(latest);
  const difference = getDifference(latest);
  const status = statusFromRaw(getString(latestRecord, ["status"]) || data?.status || data?.verdict);
  const grossSales = getNumber(posTotals, ["grossSales", "gross", "appGross", "shiftGross", "receiptTotal", "shiftTotal"]);
  const staffGrossSales = getNumber(staffTotals, ["grossSales", "gross", "totalSales", "grossSalesThb", "staffGross", "staffGrossSales"]);
  const posReceipts = getNumber(posTotals, ["receiptCount", "receipts", "appReceiptCount", "posReceipts"]);
  const staffReceipts = getNumber(staffTotals, ["receiptCount", "receipts", "staffReceipts", "staffReceiptCount"]);
  const receiptDifference = posReceipts !== null && staffReceipts !== null ? posReceipts - staffReceipts : null;
  const salesDifference = getNumber(difference, ["grossSales", "gross", "netDifference", "variance"])
    ?? (grossSales !== null && staffGrossSales !== null ? grossSales - staffGrossSales : null);

  return {
    date: getString(latestRecord, ["date", "shiftDate"]) || data?.latestShiftDate || null,
    grossSales,
    staffGrossSales,
    netSales: getNumber(posTotals, ["netSales", "net", "shiftNet", "appGross", "grossSales", "receiptTotal"]),
    posReceipts,
    staffReceipts,
    cashVariance: getNumber(difference, ["cash", "cashTotal", "cashVariance"]),
    salesDifference,
    receiptDifference,
    paymentCounts: {
      cash: getChannelCount(posTotals, "cash"),
      qr: getChannelCount(posTotals, "qr"),
      grab: getChannelCount(posTotals, "grab"),
      other: getChannelCount(posTotals, "other"),
    },
    status,
  };
}

function buildChartShifts(data: Diagnostic | null): ChartShift[] {
  return asArray(data?.sevenDayComparison)
    .map((row) => {
      const record = isRecord(row) ? row : null;
      const appTotals = getNestedRecord(record, ["appTotals", "receiptDerivedTotals", "posTotals"]);
      const shiftTotals = getNestedRecord(record, ["loyverseShiftTotals", "shiftTotals"]);
      const date = getString(record, ["date", "shiftDate"]);
      const sales = getNumber(appTotals, ["grossSales", "netSales", "gross", "net"])
        ?? getNumber(record, ["appGross", "shiftGross", "shiftNet", "receiptTotal", "shiftTotal"])
        ?? getNumber(shiftTotals, ["grossSales", "netSales", "gross", "net"]);
      const receipts = getNumber(appTotals, ["receiptCount", "receipts"])
        ?? getNumber(record, ["appReceiptCount", "receiptCount", "receipts"]);

      return {
        date,
        label: date ? formatDate(date).replace(/ 20\d{2}$/, "") : "N/A",
        sales,
        receipts,
        status: statusFromRaw(getString(record, ["status"])),
      };
    })
    .reverse();
}

function countRows(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function countIntegrityFindings(data: Diagnostic | null) {
  return Object.values(data?.integrity || {}).reduce((total, rows) => total + countRows(rows), 0);
}

function buildIssues(data: Diagnostic | null, latest: LatestShiftSummary): OwnerIssue[] {
  const issues: OwnerIssue[] = [];
  const sevenDays = asArray(data?.sevenDayComparison).filter(isRecord);
  const missingShift = sevenDays.find((day) => statusFromRaw(getString(day, ["status"])) === "review");
  const salesProblem = latest.status === "problem" || sevenDays.find((day) => statusFromRaw(getString(day, ["status"])) === "problem");
  const unmappedPayments = asArray(data?.paymentMapping?.unmappedPayments);
  const detailFindings = countIntegrityFindings(data);
  const blockers = asArray(data?.blockers).length;

  if (salesProblem) {
    issues.push({
      title: "Daily Sales Need Review",
      message: "Latest shift totals differ from the sales captured at the till.",
      status: "problem",
    });
  }

  if (missingShift) {
    issues.push({
      title: "Daily Sales Missing",
      message: `Shift report not found for ${formatDate(getString(missingShift, ["date", "shiftDate"]))}.`,
      status: "review",
    });
  }

  if (unmappedPayments.length > 0) {
    issues.push({
      title: "Payment Type Needs Setup",
      message: `${unmappedPayments.length} payment name${unmappedPayments.length === 1 ? "" : "s"} need a category before totals can be fully trusted.`,
      status: "review",
    });
  }

  if (detailFindings > 0) {
    issues.push({
      title: "Sale Details Need Review",
      message: `${detailFindings} sale detail${detailFindings === 1 ? "" : "s"} need review before the mirror is fully healthy.`,
      status: "review",
    });
  }

  if (blockers > 0 && issues.length === 0) {
    issues.push({
      title: "Stock Count Missing",
      message: `${blockers} item${blockers === 1 ? "" : "s"} need attention before today's review is complete.`,
      status: "review",
    });
  }

  return issues;
}

function totalPaymentCounts(counts: Record<Channel, number | null>): number | null {
  const values = Object.values(counts);
  return values.every((value) => value === null) ? null : values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function paymentMixPercentages(counts: Record<Channel, number | null>) {
  const total = totalPaymentCounts(counts);
  if (!total) return null;
  return {
    cash: Math.round(((counts.cash ?? 0) / total) * 100),
    qr: Math.round(((counts.qr ?? 0) / total) * 100),
    grab: Math.round(((counts.grab ?? 0) / total) * 100),
    other: Math.round(((counts.other ?? 0) / total) * 100),
  };
}

function KpiCard({ title, value, detail, status }: { title: string; value: string; detail: string; status?: OwnerStatus }) {
  return (
    <article className="flex min-h-[150px] flex-col justify-between rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-bold text-slate-500">{title}</p>
        {status ? <span className={`h-3 w-3 rounded-full ${statusDotClasses(status)}`} /> : <span className="h-3 w-3 rounded-full bg-[#FFD400]" />}
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-xs font-bold text-slate-400">{detail}</p>
      </div>
    </article>
  );
}

function VerificationCard({ title, rows, result, status }: { title: string; rows: Array<[string, string]>; result: string; status: OwnerStatus }) {
  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <div className="mt-6 space-y-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-5 border-b border-slate-100 pb-3 last:border-b-0">
            <span className="text-sm font-bold text-slate-500">{label}</span>
            <span className="text-lg font-black text-slate-950">{value}</span>
          </div>
        ))}
      </div>
      <p className={`mt-6 text-lg font-black ${statusTone(status)}`}>{result}</p>
    </article>
  );
}

function AlertCard({ title, items }: { title: string; items: OwnerIssue[] }) {
  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 p-4">
            <span className="font-black text-slate-950">POS Sync Healthy</span>
            <span className="text-lg font-black text-emerald-600">✓</span>
          </div>
        ) : items.map((item) => (
          <div key={`${item.title}-${item.message}`} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4">
            <div>
              <p className="font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">{item.message}</p>
            </div>
            <span className={`text-lg font-black ${statusTone(item.status)}`}>{item.status === "problem" ? "!" : item.status === "review" ? "⚠" : "✓"}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function OperationalPanel({ latest, issues, overallStatus }: { latest: LatestShiftSummary; issues: OwnerIssue[]; overallStatus: OwnerStatus }) {
  return (
    <aside className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-400">Action Required</p>
      <div className="mt-6 space-y-4">
        {issues.length === 0 ? (
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-emerald-50 p-4">
            <span className="font-black text-slate-950">POS Sync Healthy</span>
            <span className="text-lg font-black text-emerald-600">✓</span>
          </div>
        ) : issues.map((item) => (
          <div key={`${item.title}-${item.message}`} className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <p className="font-black text-slate-950">{item.title}</p>
              <span className={`text-lg font-black ${statusTone(item.status)}`}>{item.status === "problem" ? "!" : "⚠"}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-500">{item.message}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl bg-slate-950 p-5 text-white">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#FFD400]">Latest Completed Shift</p>
        <p className="mt-4 text-2xl font-black">{formatDate(latest.date)}</p>
        <p className="mt-1 text-sm font-bold text-white/50">18:00 → 03:00</p>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-white/45">Gross Sales</p>
            <p className="mt-1 text-xl font-black">{formatMoney(latest.grossSales)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-white/45">Receipts</p>
            <p className="mt-1 text-xl font-black">{formatNumber(latest.posReceipts)}</p>
          </div>
        </div>
        <p className={`mt-6 text-xl font-black ${overallStatus === "healthy" ? "text-emerald-400" : overallStatus === "review" ? "text-amber-300" : "text-red-400"}`}>{statusLabel(overallStatus)}</p>
      </div>

      <div className="mt-8 space-y-3">
        {[
          ["Verification Status", statusLabel(overallStatus)],
          ["Cash Variance", formatMoney(latest.cashVariance)],
          ["POS Health", overallStatus === "problem" ? "Attention Required" : "Healthy"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="text-sm font-black text-slate-500">{label}</span>
            <span className="text-sm font-black text-slate-950">{value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function StockVerificationCard() {
  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h3 className="text-xl font-black text-slate-950">Stock Verification</h3>
      <div className="mt-6 space-y-4">
        {["Rolls", "Meat", "Drinks"].map((label) => (
          <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-b-0">
            <span className="text-sm font-bold text-slate-500">{label}</span>
            <span className="text-lg font-black text-amber-600">Not available</span>
          </div>
        ))}
      </div>
      <p className="mt-6 text-lg font-black text-amber-600">Variance: Not available</p>
    </article>
  );
}

function LastSevenSalesChart({ shifts, maxSales }: { shifts: ChartShift[]; maxSales: number }) {
  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-950">Last 7 Shifts Gross Sales</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">Primary operating view</p>
        </div>
        <span className="rounded-full bg-[#FFD400] px-5 py-2 text-xs font-black text-black">Gross Sales</span>
      </div>
      <div className="mt-8 flex h-[430px] items-end gap-3 rounded-3xl bg-slate-50 p-4 sm:gap-5 md:p-8">
        {shifts.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-center text-sm font-bold text-slate-400">Not enough completed shifts to draw the chart.</div>
        ) : shifts.map((shift) => {
          const height = `${Math.max(12, ((shift.sales ?? 0) / maxSales) * 100)}%`;
          return (
            <div key={`${shift.date}-${shift.label}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-4">
              <div className="text-center text-[10px] font-black text-slate-400 sm:text-xs">{shift.sales === null ? "N/A" : formatMoney(shift.sales)}</div>
              <div className="w-full max-w-16 rounded-t-3xl bg-[#FFD400] shadow-[0_12px_24px_rgba(255,212,0,0.28)]" style={{ height }} />
              <div className="truncate text-[10px] font-black text-slate-400 sm:text-xs">{shift.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SalesMixChart({ latest }: { latest: LatestShiftSummary }) {
  const mix = paymentMixPercentages(latest.paymentCounts);
  const conic = mix
    ? `conic-gradient(#111827 0 ${mix.cash}%, #FFD400 ${mix.cash}% ${mix.cash + mix.qr}%, #22c55e ${mix.cash + mix.qr}% ${mix.cash + mix.qr + mix.grab}%, #94a3b8 ${mix.cash + mix.qr + mix.grab}% 100%)`
    : "conic-gradient(#e2e8f0 0 100%)";

  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h2 className="text-2xl font-black text-slate-950">Sales Mix</h2>
      <p className="mt-1 text-sm font-bold text-slate-400">Receipt share by channel</p>
      <div className="mt-8 flex flex-col items-center gap-8 sm:flex-row">
        <div className="grid h-44 w-44 place-items-center rounded-full" style={{ background: conic }}>
          <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center text-sm font-black text-slate-400">Receipts</div>
        </div>
        <div className="w-full space-y-3">
          {(["cash", "qr", "grab", "other"] as Channel[]).map((channel) => (
            <div key={channel} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-sm font-black capitalize text-slate-600">{channel}</span>
              <span className="text-lg font-black text-slate-950">{mix ? `${mix[channel]}%` : "Not available"}</span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function TrendChart({ shifts }: { shifts: ChartShift[] }) {
  const hasData = shifts.some((shift) => shift.sales !== null || shift.receipts !== null);

  return (
    <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <h2 className="text-2xl font-black text-slate-950">7 Day Trend</h2>
      <p className="mt-1 text-sm font-bold text-slate-400">Sales and receipts overlaid</p>
      <div className="mt-8 rounded-3xl bg-slate-50 p-5">
        {hasData ? (
          <svg viewBox="0 0 456 180" className="h-56 w-full overflow-visible">
            <polyline points="24,148 92,130 160,136 228,96 296,110 364,72 432,82" fill="none" stroke="#cbd5e1" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={chartPoints} fill="none" stroke="#FFD400" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="24,132 92,126 160,122 228,100 296,94 364,88 432,70" fill="none" stroke="#111827" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {chartPoints.split(" ").map((point) => {
              const [cx, cy] = point.split(",");
              return <circle key={point} cx={cx} cy={cy} r="6" fill="#FFD400" stroke="#111827" strokeWidth="3" />;
            })}
          </svg>
        ) : (
          <div className="grid h-56 place-items-center text-center text-sm font-bold text-slate-400">Not enough completed shifts to draw the trend.</div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-4 text-sm font-black text-slate-500">
        <span><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#FFD400]" />Sales</span>
        <span><span className="mr-2 inline-block h-3 w-3 rounded-full bg-slate-950" />Receipts</span>
      </div>
    </article>
  );
}

export default function LoyverseMirror() {
  const [data, setData] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/loyverse/mirror-diagnostic")
      .then(async (response) => {
        if (!response.ok) throw new Error("The POS mirror is not available right now.");
        return response.json();
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch(() => {
        if (active) setError("The POS mirror is not available right now. Please try again after the next sync.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const latest = useMemo(() => buildLatestSummary(data), [data]);
  const shifts = useMemo(() => buildChartShifts(data), [data]);
  const issues = useMemo(() => buildIssues(data, latest), [data, latest]);
  const overallStatus = latest.status === "healthy" && issues.length === 0 ? "healthy" : latest.status === "problem" ? "problem" : "review";
  const maxSales = Math.max(1, ...shifts.map((shift) => shift.sales ?? 0));
  const previousShift = shifts.length > 1 ? shifts[shifts.length - 2] : null;
  const receiptTotal = totalPaymentCounts(latest.paymentCounts);
  const receiptVerified = latest.receiptDifference === 0;
  const salesVerified = latest.salesDifference === 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#101214] p-4 text-slate-950 md:p-6">
        <section className="rounded-[2rem] bg-white p-8 shadow-2xl">
          <h1 className="text-3xl font-black">POS Mirror</h1>
          <p className="mt-3 text-slate-500">Loading your latest shift dashboard.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#101214] p-4 text-slate-950 md:p-6">
        <section className="rounded-[2rem] bg-white p-8 shadow-2xl">
          <h1 className="text-3xl font-black">POS Mirror</h1>
          <p className="mt-3 rounded-2xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111111] p-3 text-slate-950 md:p-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 overflow-hidden rounded-[2.25rem] bg-[#111111] shadow-2xl lg:flex-row">
        <aside className="w-full shrink-0 bg-[#111111] p-5 text-white lg:w-72">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD400] font-black text-black">SB</div>
            <div>
              <p className="text-lg font-black">Smash Mirror</p>
              <p className="text-xs font-semibold text-white/45">Owner Operations</p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/45">Search here...</div>

          <nav className="mt-8 space-y-3">
            <p className="px-3 text-xs font-black uppercase tracking-[0.22em] text-white/35">Main Menu</p>
            {["Business Overview", "Verification", "Charts", "Action Required"].map((item, index) => (
              <div key={item} className={`rounded-2xl px-4 py-3 text-sm font-black ${index === 0 ? "bg-[#FFD400] text-black" : "text-white/70"}`}>{item}</div>
            ))}
          </nav>

          <div className="mt-10 rounded-3xl bg-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Business Window</p>
            <p className="mt-3 text-xl font-black">18:00 → 03:00</p>
            <p className="mt-1 text-sm font-semibold text-white/50">Phuket time</p>
            <div className="mt-4 inline-flex rounded-full bg-[#FFD400] px-3 py-1 text-xs font-black text-black">Latest completed shift</div>
          </div>
        </aside>

        <section className="flex-1 rounded-[2rem] bg-white p-4 md:p-8 lg:p-10">
          <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">Hello, Owner!</h1>
              <p className="mt-3 text-base font-semibold text-slate-500">Gross sales, verification, POS health, and action required.</p>
            </div>
            <div className="flex items-center gap-3 rounded-full border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <span className={`h-3 w-3 rounded-full ${statusDotClasses(overallStatus)}`} />
              <div>
                <p className="text-sm font-black">{statusLabel(overallStatus)}</p>
                <p className="text-xs font-semibold text-slate-400">Last Sync: {formatTime(data?.latestSyncAt || data?.latestSync?.lastSync || data?.last_updated || null)}</p>
              </div>
            </div>
          </header>

          <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard title="Gross Sales" value={formatMoney(latest.grossSales)} detail="Latest completed shift" />
            <KpiCard title="Receipts" value={formatNumber(latest.posReceipts)} detail="Latest completed shift" />
            <KpiCard title="Verification Status" value={statusLabel(overallStatus)} detail="Sales and receipts" status={overallStatus} />
            <KpiCard title="Cash Variance" value={formatMoney(latest.cashVariance)} detail={latest.cashVariance === 0 ? "Cash matched" : "Latest shift"} status={latest.cashVariance === 0 ? "healthy" : latest.cashVariance === null ? "review" : "problem"} />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(320px,3fr)]">
            <LastSevenSalesChart shifts={shifts} maxSales={maxSales} />
            <OperationalPanel latest={latest} issues={issues} overallStatus={overallStatus} />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-4">
            <VerificationCard
              title="Receipt Verification"
              rows={[["POS Receipts", formatNumber(latest.posReceipts)], ["Staff Receipts", formatNumber(latest.staffReceipts)]]}
              result={latest.receiptDifference === null ? "Difference: Not available" : receiptVerified ? "✓ Match" : `⚠ Difference: ${formatNumber(Math.abs(latest.receiptDifference))}`}
              status={latest.receiptDifference === null ? "review" : receiptVerified ? "healthy" : "problem"}
            />
            <VerificationCard
              title="Sales Verification"
              rows={[["POS Gross Sales", formatMoney(latest.grossSales)], ["Staff Gross Sales", formatMoney(latest.staffGrossSales)]]}
              result={latest.salesDifference === null ? "Difference: Not available" : salesVerified ? "✓ Verified" : `Difference ${formatMoney(Math.abs(latest.salesDifference))}`}
              status={latest.salesDifference === null ? "review" : salesVerified ? "healthy" : "problem"}
            />
            <VerificationCard
              title="Payment Breakdown"
              rows={[["Cash", formatNumber(latest.paymentCounts.cash)], ["QR", formatNumber(latest.paymentCounts.qr)], ["Grab", formatNumber(latest.paymentCounts.grab)], ["Total", formatNumber(receiptTotal)]]}
              result="Receipt counts"
              status={receiptTotal === null ? "review" : "healthy"}
            />
            <StockVerificationCard />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-2">
            <SalesMixChart latest={latest} />
            <TrendChart shifts={shifts} />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <h2 className="text-2xl font-black text-slate-950">POS Health</h2>
              <div className="mt-6 space-y-4">
                {[
                  ["POS Sync Healthy", overallStatus === "problem" ? "Attention Required" : "✓"],
                  ["Purchases Lodged", "Not available"],
                  ["Daily Sales", latest.date ? statusLabel(latest.status) : "Not available"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="font-black text-slate-950">{label}</span>
                    <span className="font-black text-slate-500">{value}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
              <h2 className="text-2xl font-black text-slate-950">Quick Actions</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4 font-black text-slate-500">Review latest shift</div>
                <div className="rounded-2xl bg-slate-50 p-4 font-black text-slate-500">Check stock count</div>
                <div className="rounded-2xl bg-slate-50 p-4 font-black text-slate-500">Review payments</div>
                <div className="rounded-2xl bg-slate-50 p-4 font-black text-slate-500">Open reports</div>
              </div>
              <p className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-6 text-slate-500">
                Latest shift means the most recently completed business shift in Phuket time, from 18:00 to 03:00.
              </p>
            </article>
          </section>
        </section>
      </div>
    </main>
  );
}

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

type LatestShiftSummary = {
  date: string | null;
  grossSales: number | null;
  netSales: number | null;
  receipts: number | null;
  cash: number | null;
  qr: number | null;
  grab: number | null;
  other: number | null;
  cashVariance: number | null;
  status: OwnerStatus;
};

type ChartShift = {
  date: string | null;
  label: string;
  sales: number | null;
  status: OwnerStatus;
};

type OwnerIssue = {
  title: string;
  message: string;
  action: string;
  status: OwnerStatus;
};

const moneyFormatter = new Intl.NumberFormat("en-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-TH", { maximumFractionDigits: 0 });

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
  if (status === "healthy") return "Healthy";
  if (status === "review") return "Needs Review";
  return "Action Required";
}

function statusClasses(status: OwnerStatus) {
  if (status === "healthy") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "review") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function statusDotClasses(status: OwnerStatus) {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "review") return "bg-amber-400";
  return "bg-red-500";
}

function getTotalsFromLatest(latest: unknown): Record<string, unknown> | null {
  if (!isRecord(latest)) return null;
  const directTotalKeys = ["appGross", "shiftGross", "appReceiptCount", "receiptCount", "receiptTotal", "shiftTotal"];
  if (directTotalKeys.some((key) => key in latest)) return latest;

  const receiptDerived = latest.receiptDerivedTotals;
  if (isRecord(receiptDerived)) return receiptDerived;

  const shiftTotals = latest.loyverseShiftReportTotals;
  if (isRecord(shiftTotals)) return shiftTotals;

  return latest;
}

function getDifferenceFromLatest(latest: unknown): Record<string, unknown> | null {
  if (!isRecord(latest)) return null;
  return isRecord(latest.difference) ? latest.difference : latest;
}

function buildLatestSummary(data: Diagnostic | null): LatestShiftSummary {
  const latest = data?.latestShiftComparison;
  const latestRecord = isRecord(latest) ? latest : null;
  const totals = getTotalsFromLatest(latest);
  const difference = getDifferenceFromLatest(latest);
  const status = statusFromRaw(getString(latestRecord, ["status"]) || data?.status || data?.verdict);
  const grossSales = getNumber(totals, ["grossSales", "gross", "appGross", "shiftGross", "receiptTotal", "shiftTotal"]);
  const netSales = getNumber(totals, ["netSales", "net", "shiftNet", "appGross", "grossSales", "receiptTotal"]);

  return {
    date: getString(latestRecord, ["date", "shiftDate"]) || data?.latestShiftDate || null,
    grossSales,
    netSales,
    receipts: getNumber(totals, ["receiptCount", "receipts", "appReceiptCount"]),
    cash: getNumber(totals, ["cash", "cashTotal", "appCash", "shiftCash"]),
    qr: getNumber(totals, ["qr", "qrTotal", "appQr", "shiftQr"]),
    grab: getNumber(totals, ["grab", "grabTotal", "appGrab", "shiftGrab"]),
    other: getNumber(totals, ["other", "otherTotal"]),
    cashVariance: getNumber(difference, ["cash", "cashTotal", "cashVariance"]),
    status,
  };
}

function buildChartShifts(data: Diagnostic | null): ChartShift[] {
  return asArray(data?.sevenDayComparison)
    .map((row) => {
      const record = isRecord(row) ? row : null;
      const appTotals = isRecord(record?.appTotals) ? record.appTotals : null;
      const shiftTotals = isRecord(record?.loyverseShiftTotals) ? record.loyverseShiftTotals : null;
      const date = getString(record, ["date", "shiftDate"]);
      const sales = getNumber(appTotals, ["grossSales", "netSales", "gross", "net"])
        ?? getNumber(record, ["appGross", "shiftGross", "shiftNet", "receiptTotal", "shiftTotal"])
        ?? getNumber(shiftTotals, ["grossSales", "netSales", "gross", "net"]);

      return {
        date,
        label: date ? formatDate(date).replace(/ 20\d{2}$/, "") : "N/A",
        sales,
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
      title: "Shift Sales Don't Match",
      message: "Latest shift totals differ from the sales captured at the till.",
      action: "Review shift totals",
      status: "problem",
    });
  }

  if (missingShift) {
    issues.push({
      title: "Missing Shift Report",
      message: `Shift report not found for ${formatDate(getString(missingShift, ["date", "shiftDate"]))}.`,
      action: "Sync required",
      status: "review",
    });
  }

  if (unmappedPayments.length > 0) {
    issues.push({
      title: "Payment Type Requires Setup",
      message: `${unmappedPayments.length} payment name${unmappedPayments.length === 1 ? "" : "s"} need a category before totals can be fully trusted.`,
      action: "Assign category",
      status: "review",
    });
  }

  if (detailFindings > 0) {
    issues.push({
      title: "Sale Details Need Review",
      message: `${detailFindings} sale detail${detailFindings === 1 ? "" : "s"} need review before the mirror is fully healthy.`,
      action: "Review details",
      status: "review",
    });
  }

  if (blockers > 0 && issues.length === 0) {
    issues.push({
      title: "Shift Review Required",
      message: `${blockers} item${blockers === 1 ? "" : "s"} need attention before today's review is complete.`,
      action: "Review now",
      status: "review",
    });
  }

  return issues;
}

function KpiCard({ title, value, subtitle, status }: { title: string; value: string; subtitle: string; status?: OwnerStatus }) {
  return (
    <article className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-4 text-3xl font-black tracking-tight text-slate-950">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-900">{status ? <span className={`h-3 w-3 rounded-full ${statusDotClasses(status)}`} /> : "•"}</span>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">{subtitle}</p>
    </article>
  );
}

function SummaryCard({ label, value, status }: { label: string; value: string; status?: OwnerStatus }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-black text-slate-950">{value}</p>
        {status ? <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(status)}`}>{statusLabel(status)}</span> : null}
      </div>
    </div>
  );
}

function HealthCard({ title, status, detail }: { title: string; status: OwnerStatus; detail: string }) {
  return (
    <div className={`rounded-3xl border p-5 ${statusClasses(status)}`}>
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${statusDotClasses(status)}`} />
        <p className="font-black text-slate-950">{title}</p>
      </div>
      <p className="mt-4 text-sm font-bold">{statusLabel(status)}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
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
    <main className="min-h-screen bg-[#101214] p-3 text-slate-950 md:p-6">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 overflow-hidden rounded-[2.25rem] bg-[#101214] shadow-2xl lg:flex-row">
        <aside className="w-full shrink-0 bg-[#101214] p-5 text-white lg:w-72">
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
            {["Business Overview", "Sales", "POS Health", "Shift Issues"].map((item, index) => (
              <div key={item} className={`rounded-2xl px-4 py-3 text-sm font-black ${index === 0 ? "bg-[#FFD400] text-black" : "text-white/70"}`}>{item}</div>
            ))}
          </nav>

          <div className="mt-10 rounded-3xl bg-white/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">Business Window</p>
            <p className="mt-3 text-xl font-black">18:00 - 03:00</p>
            <p className="mt-1 text-sm font-semibold text-white/50">Phuket time</p>
            <div className="mt-4 inline-flex rounded-full bg-[#FFD400] px-3 py-1 text-xs font-black text-black">Latest completed shift</div>
          </div>
        </aside>

        <section className="flex-1 rounded-[2rem] bg-white p-4 md:p-8 lg:p-10">
          <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">Hello, Owner!</h1>
              <p className="mt-3 text-base font-semibold text-slate-500">Here is your latest completed shift overview.</p>
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
            <KpiCard title="Latest Shift Sales" value={formatMoney(latest.netSales ?? latest.grossSales)} subtitle="Compared with previous shift" />
            <KpiCard title="Receipts" value={formatNumber(latest.receipts)} subtitle="Latest shift receipts" />
            <KpiCard title="Cash Variance" value={formatMoney(latest.cashVariance)} subtitle={latest.cashVariance === 0 ? "Cash matched" : "Compared with previous shift"} status={latest.cashVariance === 0 ? "healthy" : latest.cashVariance === null ? "review" : "problem"} />
            <KpiCard title="POS Sync Status" value={statusLabel(overallStatus)} subtitle={`Last Sync: ${formatTime(data?.latestSyncAt || data?.latestSync?.lastSync || data?.last_updated || null)}`} status={overallStatus} />
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Latest Shift Summary</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">Shift Date: {formatDate(latest.date)}</p>
                </div>
                <span className={`w-fit rounded-full border px-4 py-2 text-sm font-black ${statusClasses(latest.status)}`}>{statusLabel(latest.status)}</span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Gross Sales" value={formatMoney(latest.grossSales)} />
                <SummaryCard label="Net Sales" value={formatMoney(latest.netSales)} />
                <SummaryCard label="Receipts" value={formatNumber(latest.receipts)} />
                <SummaryCard label="Cash" value={formatMoney(latest.cash)} />
                <SummaryCard label="QR" value={formatMoney(latest.qr)} />
                <SummaryCard label="Grab" value={formatMoney(latest.grab)} />
                <SummaryCard label="Other" value={formatMoney(latest.other)} />
                <SummaryCard label="Status" value={statusLabel(latest.status)} status={latest.status} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
              <h2 className="text-2xl font-black">Shift Checks</h2>
              <div className="mt-6 space-y-3">
                <HealthCard title="POS Sync" status={overallStatus === "problem" ? "problem" : "healthy"} detail="Latest sales connection check" />
                <HealthCard title="Receipt Imports" status={latest.receipts === null ? "review" : "healthy"} detail="Latest shift receipt count" />
                <HealthCard title="Shift Reports" status={latest.date ? latest.status : "review"} detail="Latest completed business shift" />
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Last 7 Shifts</h2>
                  <p className="mt-1 text-sm font-semibold text-slate-400">Sales by completed business shift</p>
                </div>
                <div className="rounded-full bg-slate-50 px-4 py-2 text-xs font-black text-slate-500">Sales</div>
              </div>

              <div className="mt-8 flex h-72 items-end gap-3 overflow-hidden rounded-3xl bg-slate-50 p-4 sm:gap-5 md:p-6">
                {shifts.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center text-center text-sm font-bold text-slate-400">Not enough completed shifts to draw the chart.</div>
                ) : shifts.map((shift) => {
                  const height = `${Math.max(10, ((shift.sales ?? 0) / maxSales) * 100)}%`;
                  return (
                    <div key={`${shift.date}-${shift.label}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-3">
                      <div className="text-center text-[10px] font-black text-slate-400 sm:text-xs">{shift.sales === null ? "N/A" : formatMoney(shift.sales)}</div>
                      <div className={`w-full max-w-12 rounded-t-2xl ${shift.status === "problem" ? "bg-red-400" : shift.status === "review" ? "bg-amber-300" : "bg-[#FFD400]"}`} style={{ height }} />
                      <div className="truncate text-[10px] font-black text-slate-400 sm:text-xs">{shift.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
              <h2 className="text-2xl font-black">POS Health</h2>
              <div className="mt-6 grid gap-3">
                <HealthCard title="Payment Types" status={asArray(data?.paymentMapping?.unmappedPayments).length > 0 ? "review" : "healthy"} detail="Payment types are categorized" />
                <HealthCard title="Sale Details" status={countIntegrityFindings(data) > 0 ? "review" : "healthy"} detail="Sale details are complete" />
                <HealthCard title="Shift Reports" status={latest.date ? latest.status : "review"} detail="Report is present for the shift" />
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
              <h2 className="text-2xl font-black">Issues To Review</h2>
              <div className="mt-5 space-y-4">
                {issues.length === 0 ? (
                  <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                    <p className="text-lg font-black text-emerald-800">No owner action needed</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">The latest shift is ready for review.</p>
                  </div>
                ) : issues.map((issue) => (
                  <article key={`${issue.title}-${issue.action}`} className={`rounded-3xl border p-5 ${statusClasses(issue.status)}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-950">{issue.title}</h3>
                        <p className="mt-1 text-sm font-semibold text-slate-600">{issue.message}</p>
                      </div>
                      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${statusDotClasses(issue.status)}`} />
                    </div>
                    <button type="button" className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">{issue.action}</button>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:p-7">
              <h2 className="text-2xl font-black">Quick Read</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <SummaryCard label="Latest Shift Receipts" value={formatNumber(latest.receipts)} />
                <SummaryCard label="Last 7 Shift Average" value={shifts.some((shift) => shift.sales !== null) ? formatMoney(shifts.reduce((sum, shift) => sum + (shift.sales ?? 0), 0) / shifts.filter((shift) => shift.sales !== null).length) : "Not available"} />
                <SummaryCard label="Today vs Previous" value={previousShift?.sales !== null && previousShift?.sales !== undefined && latest.netSales !== null ? formatMoney(latest.netSales - previousShift.sales) : "Not available"} />
                <SummaryCard label="Completed Shifts" value={formatNumber(shifts.length)} />
              </div>
              <p className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-semibold leading-6 text-slate-500">
                Latest shift means the most recently completed business shift in Phuket time, from 18:00 to 03:00.
              </p>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

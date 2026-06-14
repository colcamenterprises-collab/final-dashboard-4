import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RefreshCw, AlertTriangle, CheckCircle, XCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return "฿" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtShortDate(s: string | null | undefined): string {
  if (!s) return "—";
  const [, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}`;
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  const day  = String(d.getDate()).padStart(2, "0");
  const mon  = String(d.getMonth() + 1).padStart(2, "0");
  const hrs  = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()} ${hrs}:${mins}`;
}

function syncAgeLabel(s: string | null | undefined): string {
  if (!s) return "unknown";
  const mins = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

type Health = "healthy" | "warning" | "failed";

function normaliseDayStatus(status: string | null | undefined): Health {
  if (!status) return "failed";
  const s = status.toUpperCase();
  if (s === "MATCH" || s === "OK" || s === "MIRROR_VERIFIED") return "healthy";
  if (s === "NO_SHIFT_DATA" || s === "WARNING") return "warning";
  return "failed";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const h = normaliseDayStatus(status);
  const s = (status || "").toUpperCase();
  const label =
    s === "NO_SHIFT_DATA" ? "No data"  :
    s === "MISMATCH"      ? "Mismatch" :
    s === "MATCH"         ? "Match"    :
    s === "OK"            ? "Verified" :
    h === "healthy"       ? "Healthy"  :
    h === "warning"       ? "Warning"  : "Failed";
  const cls =
    h === "healthy" ? "bg-emerald-100 text-emerald-800" :
    h === "warning" ? "bg-amber-100 text-amber-800"     :
                      "bg-red-100 text-red-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// Normalise the two shapes from mirror-ui-data sevenDayComparison
function normaliseDay(day: any) {
  const app = day.appTotals            || {};
  const rec = day.receiptDerivedTotals || {};
  return {
    date:     day.shiftDate || day.date || null,
    receipts: app.receiptCount ?? rec.receiptCount ?? day.appReceiptCount ?? null,
    gross:    app.grossSales   ?? rec.grossSales   ?? day.appGross        ?? null,
    cash:     app.cash         ?? rec.cash         ?? day.appCash         ?? null,
    qr:       app.qr           ?? rec.qr           ?? day.appQr           ?? null,
    grab:     app.grab         ?? rec.grab         ?? day.appGrab         ?? null,
    status:   day.status ?? null,
  };
}

// ── Small pieces ──────────────────────────────────────────────────────────────

function Btn({
  onClick, disabled, children, variant = "dark",
}: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; variant?: "dark" | "ghost";
}) {
  const base = "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";
  const dark  = "bg-[#111111] text-white hover:bg-neutral-800";
  const ghost = "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variant === "dark" ? dark : ghost}`}>
      {children}
    </button>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent: string }) {
  return (
    <div className={`rounded-2xl border p-4 space-y-1 ${accent}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest opacity-60">{label}</p>
      <p className="text-xl font-black tracking-tight">{value}</p>
      {sub && <p className="text-[10px] opacity-50">{sub}</p>}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
      {children}
    </p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LoyverseMirror() {
  const [mirrorData, setMirrorData]   = useState<any>(null);
  const [mirrorError, setMirrorError] = useState<string | null>(null);
  const [mirrorLoading, setMirrorLoading] = useState(true);

  const { data: ownerData } = useQuery<any>({
    queryKey: ["/api/operations-read/owner-dashboard"],
    refetchInterval: 120_000,
  });

  const fetchMirror = useCallback(() => {
    setMirrorLoading(true);
    setMirrorError(null);
    fetch("/api/loyverse/mirror-ui-data")
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setMirrorData)
      .catch(e => setMirrorError(e?.message || "Failed to load"))
      .finally(() => setMirrorLoading(false));
  }, []);

  useEffect(() => { fetchMirror(); }, [fetchMirror]);

  // ── Derive values ────────────────────────────────────────────────────────

  const days = mirrorData
    ? (mirrorData.sevenDayComparison || []).map(normaliseDay)
    : [];

  const latest = mirrorData?.latestShiftComparison
    ? normaliseDay(mirrorData.latestShiftComparison)
    : (days[0] ?? null);

  const missingDays  = days.filter((d: any) => d.status === "NO_SHIFT_DATA");
  const mismatchDays = days.filter((d: any) => d.status === "MISMATCH");

  const integ = mirrorData?.integrity || mirrorData?.dataIntegrity || {};
  const dupReceipts = Number(integ.duplicateReceipts?.length ?? integ.duplicateReceipts ?? 0);
  const hasIntegIssue = dupReceipts > 0;

  const unmappedPayments: any[] = Array.isArray(mirrorData?.paymentMapping)
    ? mirrorData.paymentMapping.filter((p: any) => p.appLabel === "Other" || p.mappingStatus === "unmapped")
    : (mirrorData?.paymentMapping?.unmappedPayments || []);
  const hasUnmapped = unmappedPayments.length > 0;

  const overallOk = !mirrorLoading && !mirrorError && missingDays.length === 0 && mismatchDays.length === 0 && !hasIntegIssue;

  const syncHealth = ownerData?.syncHealth ?? {};
  const latestReceiptAt = mirrorData?.latestReceiptDate ?? syncHealth.latestReceiptAt ?? null;
  const latestSyncAt = mirrorData?.latestSyncAt ?? syncHealth.lastSyncAt ?? null;
  const latestShiftDate = mirrorData?.latestShiftDate ?? syncHealth.latestShiftDate ?? null;

  // Chart data from owner-dashboard (more accurate payment breakdown)
  const ownerShifts = ownerData?.lastSevenShifts ?? [];
  const chartData = [...ownerShifts].reverse().map((s: any) => ({
    date: fmtShortDate(s.date),
    grossSales: s.grossSales,
    receipts: s.receipts,
  }));

  // ── Loading ────────────────────────────────────────────────────────────────

  if (mirrorLoading && !mirrorData) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">POS Verification</h1>
          <p className="text-xs text-slate-400 mt-1">Loading POS data…</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (mirrorError && !mirrorData) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">POS Verification</h1>
          <p className="text-xs text-slate-400 mt-1">Latest completed POS shift data</p>
        </div>
        <Panel className="border-red-200">
          <div className="bg-red-50 p-6 space-y-3">
            <p className="text-sm font-bold text-red-800">Could not load POS data</p>
            <p className="text-xs text-red-700">{mirrorError}</p>
            <Btn onClick={fetchMirror} variant="ghost">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Btn>
          </div>
        </Panel>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl text-slate-900">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">POS Verification</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Latest completed POS shift:{" "}
            <span className="font-semibold text-slate-600">{fmtDate(latest?.date)}</span>
            <span className="ml-2">· 18:00–03:00 Bangkok</span>
          </p>
        </div>
        <Btn onClick={fetchMirror} disabled={mirrorLoading} variant="ghost">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Btn>
      </div>

      {/* ── Sync health banner ───────────────────────────────────────────── */}
      <Panel className={overallOk ? "border-emerald-200" : "border-amber-200"}>
        <div className={`p-5 flex items-start gap-3 ${overallOk ? "bg-emerald-50" : "bg-amber-50"}`}>
          <div className="mt-0.5 shrink-0">
            {overallOk
              ? <CheckCircle className="h-5 w-5 text-emerald-600" />
              : <AlertTriangle className="h-5 w-5 text-amber-500" />}
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <p className={`text-sm font-bold ${overallOk ? "text-emerald-800" : "text-amber-800"}`}>
              {overallOk ? "POS data verified — all shifts match" : "POS data needs attention"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Last sync</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{syncAgeLabel(latestSyncAt)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(latestSyncAt)}</p>
              </div>
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Latest receipt</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{fmtDateTime(latestReceiptAt)}</p>
              </div>
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Latest shift</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{fmtDate(latestShiftDate)}</p>
              </div>
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Shifts reviewed</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{days.length} days</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Latest completed shift KPIs ──────────────────────────────────── */}
      {latest && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Latest completed shift — {fmtDate(latest.date)}
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <KpiCard
              label="Status"
              value={<StatusPill status={latest.status} />}
              accent={
                normaliseDayStatus(latest.status) === "healthy" ? "border-emerald-200 bg-emerald-50 text-emerald-900" :
                normaliseDayStatus(latest.status) === "warning" ? "border-amber-200 bg-amber-50 text-amber-900"       :
                "border-red-200 bg-red-50 text-red-900"
              }
            />
            <KpiCard
              label="Receipts"
              value={latest.receipts ?? ownerData?.latestShift?.receiptCount ?? "—"}
              accent="border-blue-100 bg-blue-50 text-blue-900"
            />
            <KpiCard
              label="Gross Sales"
              value={fmtMoney(latest.gross ?? ownerData?.latestShift?.grossSales)}
              accent="border-purple-100 bg-purple-50 text-purple-900"
            />
            <KpiCard
              label="Cash"
              value={fmtMoney(latest.cash ?? ownerData?.latestShift?.cash)}
              accent="border-emerald-100 bg-emerald-50 text-emerald-900"
            />
            <KpiCard
              label="QR"
              value={fmtMoney(latest.qr ?? ownerData?.latestShift?.qr)}
              accent="border-sky-100 bg-sky-50 text-sky-900"
            />
            <KpiCard
              label="Grab"
              value={fmtMoney(latest.grab ?? ownerData?.latestShift?.grab)}
              accent="border-orange-100 bg-orange-50 text-orange-900"
            />
          </div>
        </div>
      )}

      {/* ── 7-day bar chart ───────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <Panel>
          <SectionLabel>Last 7 Shifts — Gross Sales</SectionLabel>
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `฿${(v / 1000).toFixed(0)}k` : `฿${v}`}
                  width={44}
                />
                <Tooltip
                  formatter={(v: any) => [fmtMoney(v), "Gross Sales"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "11px" }}
                />
                <Bar dataKey="grossSales" fill="#6366f1" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      {/* ── 7-day shift table ─────────────────────────────────────────────── */}
      <Panel>
        <SectionLabel>Last 7 Completed Shifts</SectionLabel>
        {days.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-400">No shift data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Receipts</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Gross Sales</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Cash</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">QR</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Grab</th>
                  <th className="px-4 py-3 font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d: any, i: number) => (
                  <tr key={d.date || i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 font-semibold text-slate-800">{fmtDate(d.date)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{d.receipts ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-medium">{fmtMoney(d.gross)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(d.cash)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(d.qr)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{fmtMoney(d.grab)}</td>
                    <td className="px-4 py-3"><StatusPill status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Issues ────────────────────────────────────────────────────────── */}
      {(missingDays.length > 0 || mismatchDays.length > 0 || hasUnmapped || hasIntegIssue) ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Issues requiring attention</p>

          {missingDays.length > 0 && (
            <Panel className="border-amber-200">
              <SectionLabel>POS data missing ({missingDays.length} shift{missingDays.length > 1 ? "s" : ""})</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                {missingDays.map((d: any) => (
                  <div key={d.date} className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs font-bold text-amber-900">{fmtDate(d.date)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Receipts were recorded for this date but the shift report is not yet available. This can happen when a shift closes late or the sync is pending.
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {mismatchDays.length > 0 && (
            <Panel className="border-red-200">
              <SectionLabel>Sales figures need review ({mismatchDays.length})</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                {mismatchDays.map((d: any) => (
                  <div key={d.date} className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-bold text-red-900">{fmtDate(d.date)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      The sales total recorded by the system does not match the shift report for this date. Contact your manager to review.
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {hasUnmapped && (
            <Panel className="border-amber-200">
              <SectionLabel>Payment type needs review</SectionLabel>
              <div className="px-5 pb-5">
                <p className="text-xs text-slate-600">
                  One or more payment types from the POS are not recognised as Cash, QR, or Grab. These are counted under "Other". Contact your manager if the total looks incorrect.
                </p>
              </div>
            </Panel>
          )}

          {hasIntegIssue && (
            <Panel className="border-red-200">
              <SectionLabel>Receipt data needs review</SectionLabel>
              <div className="px-5 pb-5">
                <p className="text-xs text-slate-600">
                  The POS data contains entries that need review. This may affect reported totals. Contact your manager.
                </p>
              </div>
            </Panel>
          )}
        </div>
      ) : (
        !mirrorLoading && (
          <Panel className="border-emerald-200">
            <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm font-semibold text-emerald-800">
                No issues found — all checked shifts match their POS data.
              </p>
            </div>
          </Panel>
        )
      )}

    </div>
  );
}

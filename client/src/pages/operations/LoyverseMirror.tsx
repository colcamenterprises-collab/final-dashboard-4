import { useState, useEffect, useCallback } from "react";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronRight } from "lucide-react";

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return "฿" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s).slice(0, 10);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()}`;
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hrs   = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()} ${hrs}:${mins}`;
}

function syncAgeLabel(s: string | null | undefined): string {
  if (!s) return "unknown";
  const mins = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24)   return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

// ── Status helpers ─────────────────────────────────────────────────────────────

type Health = "healthy" | "warning" | "failed";

function normaliseHealth(status: string | null | undefined): Health {
  if (!status) return "failed";
  const s = status.toUpperCase();
  if (s === "OK" || s === "MIRROR_VERIFIED") return "healthy";
  if (s === "WARNING") return "warning";
  return "failed";
}

function normaliseDayStatus(status: string | null | undefined): Health {
  if (!status) return "failed";
  const s = status.toUpperCase();
  if (s === "MATCH" || s === "OK") return "healthy";
  if (s === "NO_SHIFT_DATA") return "warning";
  return "failed";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const h = normaliseDayStatus(status);
  const s = (status || "").toUpperCase();
  const label =
    s === "NO_SHIFT_DATA" ? "No data"  :
    s === "MISMATCH"      ? "Mismatch" :
    s === "MATCH"         ? "Match"    :
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

// Handles two API shapes:
//   sevenDayComparison items  → appTotals.* (receipt-derived from mirror)
//   latestShiftComparison     → receiptDerivedTotals.* (latest shift snapshot)
function normaliseDay(day: any) {
  const app = day.appTotals            || {};  // sevenDayComparison shape
  const rec = day.receiptDerivedTotals || {};  // latestShiftComparison shape

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

function normaliseBlockers(raw: any[]): string[] {
  return (raw || []).map(b =>
    typeof b === "string" ? b : (b?.message || b?.code || JSON.stringify(b))
  );
}

// ── Small reusable pieces ─────────────────────────────────────────────────────

function Btn({
  onClick, disabled, children, variant = "dark",
}: {
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  variant?: "dark" | "ghost";
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

function KpiCard({
  label, value, sub, accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string;
}) {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoyverseMirror() {
  const [data, setData]       = useState<any>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [devOpen, setDevOpen] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/loyverse/mirror-ui-data")
      .then(async r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e?.message || "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSyncMissing = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const r = await fetch("/api/loyverse/sync-missing-shifts", { method: "POST" });
      const j = await r.json();
      const recovered = (j.recovered || []).filter((x: any) => x.status === "recovered");
      setSyncMsg({
        ok: true,
        text: recovered.length === 0
          ? "No missing shifts found — mirror is up to date."
          : `Recovered ${recovered.length} missing shift(s): ${recovered.map((x: any) => fmtDate(x.biz_date)).join(", ")}`,
      });
      fetchData();
    } catch (e: any) {
      setSyncMsg({ ok: false, text: "Sync failed: " + (e?.message || "unknown error") });
    } finally {
      setSyncing(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 max-w-5xl">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Loyverse Mirror</h1>
          <p className="text-xs text-slate-400 mt-1">Loading POS sync status…</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400 animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  // ── Auth / error states ────────────────────────────────────────────────────

  const isAuthError = error && (error.includes("401") || error.includes("403") || error.toLowerCase().includes("unauthorized"));

  if (error || !data) {
    return (
      <div className="space-y-5 max-w-5xl">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Loyverse Mirror</h1>
          <p className="text-xs text-slate-400 mt-1">POS sync status and 7-day shift comparison</p>
        </div>
        {isAuthError ? (
          <Panel className="border-amber-200">
            <div className="bg-amber-50 p-6 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm font-bold text-amber-900">Owner authentication required</p>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                This page is restricted to the owner account. Sign in with the owner PIN to view the Loyverse sync status, 7-day shift comparison, and data integrity checks.
              </p>
              <Btn onClick={fetchData} variant="dark">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Btn>
            </div>
          </Panel>
        ) : (
          <Panel className="border-red-200">
            <div className="bg-red-50 p-6 space-y-3">
              <p className="text-sm font-bold text-red-800">Could not load mirror data</p>
              <p className="text-xs text-red-700">{error || "No data returned. Check server connection."}</p>
              <Btn onClick={fetchData} variant="ghost">
                <RefreshCw className="h-3.5 w-3.5" /> Retry
              </Btn>
            </div>
          </Panel>
        )}
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const overallHealth = normaliseHealth(data.status);

  const days      = (data.sevenDayComparison || []).map(normaliseDay);
  const latest    = data.latestShiftComparison ? normaliseDay(data.latestShiftComparison) : (days[0] ?? null);
  const latestRaw = data.latestShiftComparison;

  const missingDays  = days.filter((d: any) => d.status === "NO_SHIFT_DATA");
  const mismatchDays = days.filter((d: any) => d.status === "MISMATCH");

  const unmapped: any[] = Array.isArray(data.paymentMapping)
    ? data.paymentMapping.filter((p: any) => p.appLabel === "Other")
    : (data.paymentMapping?.unmappedPayments || []);

  const integ         = data.integrity || data.dataIntegrity || {};
  const dupReceipts   = Number(integ.duplicateReceipts ?? 0);
  const orphanItems   = Number(integ.orphanLineItems   ?? 0);
  const orphanMods    = Number(integ.orphanModifiers   ?? 0);
  const hasIntegIssue = dupReceipts > 0 || orphanItems > 0 || orphanMods > 0;

  const blockers  = normaliseBlockers(data.blockers);
  const hasIssues = blockers.length > 0 || missingDays.length > 0 || mismatchDays.length > 0 || unmapped.length > 0 || hasIntegIssue;

  const receiptMs = data.latestReceiptDate ? new Date(data.latestReceiptDate).getTime() : 0;
  const shiftMs   = data.latestShiftDate   ? new Date(data.latestShiftDate).getTime()   : 0;
  const stale     = receiptMs > 0 && shiftMs > 0 && (receiptMs - shiftMs) > 86400000 * 1.5;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl text-slate-900">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Loyverse Mirror</h1>
          <p className="text-xs text-slate-400 mt-0.5">POS sync status · 7-day shift comparison</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={fetchData} disabled={loading} variant="ghost">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Btn>
          <Btn onClick={handleSyncMissing} disabled={syncing} variant="ghost">
            {syncing ? "Syncing…" : "Sync missing shifts"}
          </Btn>
          <Btn disabled variant="ghost" title="Provide a date range via the API">
            Run sync
          </Btn>
        </div>
      </div>

      {/* ── Sync result banner ───────────────────────────────────────────── */}
      {syncMsg && (
        <div className={`rounded-2xl border p-4 text-sm font-medium ${syncMsg.ok ? "border-blue-200 bg-blue-50 text-blue-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {syncMsg.text}
        </div>
      )}

      {/* ── Overall health banner ────────────────────────────────────────── */}
      <Panel className={
        overallHealth === "healthy" ? "border-emerald-200" :
        overallHealth === "warning" ? "border-amber-200"   : "border-red-200"
      }>
        <div className={`p-5 flex items-start gap-3 ${
          overallHealth === "healthy" ? "bg-emerald-50" :
          overallHealth === "warning" ? "bg-amber-50"   : "bg-red-50"
        }`}>
          <div className="mt-0.5 shrink-0">
            {overallHealth === "healthy"
              ? <CheckCircle className="h-5 w-5 text-emerald-600" />
              : overallHealth === "warning"
              ? <AlertTriangle className="h-5 w-5 text-amber-500" />
              : <XCircle className="h-5 w-5 text-red-600" />}
          </div>
          <div className="flex-1 min-w-0 space-y-4">
            <p className={`text-sm font-bold ${
              overallHealth === "healthy" ? "text-emerald-800" :
              overallHealth === "warning" ? "text-amber-800"   : "text-red-800"
            }`}>
              {overallHealth === "healthy" ? "Loyverse mirror is healthy" :
               overallHealth === "warning" ? "Loyverse mirror needs attention" :
               "Loyverse mirror has issues"}
            </p>

            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Last sync</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{syncAgeLabel(data.latestSyncAt)}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{fmtDateTime(data.latestSyncAt)}</p>
              </div>
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Latest receipt</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{fmtDateTime(data.latestReceiptDate)}</p>
              </div>
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Latest shift</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{fmtDate(data.latestShiftDate)}</p>
              </div>
              <div className="rounded-xl bg-white/70 border border-white/80 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Shifts checked</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">{days.length} days</p>
              </div>
            </div>

            {stale && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Shift report may be behind — the latest receipt is more than one business day newer than the latest completed shift.
              </div>
            )}
          </div>
        </div>
      </Panel>

      {/* ── Latest completed shift ───────────────────────────────────────── */}
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
              value={latest.receipts ?? "—"}
              accent="border-blue-100 bg-blue-50 text-blue-900"
            />
            <KpiCard
              label="Gross sales"
              value={fmtMoney(latest.gross)}
              accent="border-purple-100 bg-purple-50 text-purple-900"
            />
            <KpiCard
              label="Cash"
              value={fmtMoney(latest.cash)}
              accent="border-emerald-100 bg-emerald-50 text-emerald-900"
            />
            <KpiCard
              label="QR"
              value={fmtMoney(latest.qr)}
              accent="border-sky-100 bg-sky-50 text-sky-900"
            />
            <KpiCard
              label="Grab"
              value={fmtMoney(latest.grab)}
              accent="border-orange-100 bg-orange-50 text-orange-900"
            />
          </div>
          {latestRaw?.itemCount != null && (
            <p className="text-xs text-slate-400 pt-1">
              {latestRaw.itemCount.toLocaleString()} line items · {(latestRaw.modifierCount ?? 0).toLocaleString()} modifiers recorded
            </p>
          )}
        </div>
      )}

      {/* ── 7-day shift table ────────────────────────────────────────────── */}
      <Panel>
        <SectionLabel>Last 7 completed shifts</SectionLabel>
        {days.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-slate-400">No shift data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-5 py-3 font-semibold text-slate-500">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Receipts</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-right">Gross sales</th>
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

      {/* ── Issues panel ─────────────────────────────────────────────────── */}
      {hasIssues ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Issues requiring attention</p>

          {missingDays.length > 0 && (
            <Panel className="border-amber-200">
              <SectionLabel>Missing shift reports ({missingDays.length})</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                {missingDays.map((d: any) => (
                  <div key={d.date} className="rounded-xl bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs font-bold text-amber-900">{fmtDate(d.date)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Receipts were recorded for this date but no completed shift report was found. This can happen when a shift closes late.
                    </p>
                    <p className="text-xs font-semibold text-amber-700 mt-1.5">
                      Suggested action: click "Sync missing shifts" above to attempt automatic recovery.
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {mismatchDays.length > 0 && (
            <Panel className="border-red-200">
              <SectionLabel>Sales total mismatches ({mismatchDays.length})</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                {mismatchDays.map((d: any) => (
                  <div key={d.date} className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-bold text-red-900">{fmtDate(d.date)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      The sales total from this date doesn't match the shift report. This usually means a receipt was added or changed after the shift was closed.
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {unmapped.length > 0 && (
            <Panel>
              <SectionLabel>Unrecognised payment types ({unmapped.length})</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                <p className="text-xs text-slate-500 mb-2">
                  These payment types exist in the POS but are not recognised as Cash, QR, or Grab. They are counted under "Other" and do not affect the total. Review if anything looks unexpected.
                </p>
                {unmapped.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-xs">
                    <span className="font-semibold text-slate-800">{p.name || p.pt_name || "Unknown"}</span>
                    <span className="text-slate-500">
                      {(p.receiptCount ?? p.receipt_count ?? "?").toLocaleString()} receipts · categorised as Other
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {hasIntegIssue && (
            <Panel className="border-red-200">
              <SectionLabel>Data integrity issues</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                {dupReceipts > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-bold text-red-900">{dupReceipts.toLocaleString()} duplicate receipt(s)</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      The same receipt ID appears more than once in the database. This should not happen and may indicate a sync error.
                    </p>
                  </div>
                )}
                {orphanItems > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-bold text-red-900">{orphanItems.toLocaleString()} orphan line item(s)</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      These item records have no matching receipt. They won't affect sales figures but indicate a sync gap.
                    </p>
                  </div>
                )}
                {orphanMods > 0 && (
                  <div className="rounded-xl bg-red-50 border border-red-100 p-3">
                    <p className="text-xs font-bold text-red-900">{orphanMods.toLocaleString()} orphan modifier(s)</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      These modifier records have no matching receipt. Won't affect totals but may indicate a sync gap.
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {blockers.length > 0 && (
            <Panel className="border-red-200">
              <SectionLabel>Blockers ({blockers.length})</SectionLabel>
              <div className="px-5 pb-5 space-y-2">
                {blockers.map((b: string, i: number) => (
                  <div key={i} className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-xs font-medium text-red-800">
                    {b}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      ) : (
        <Panel className="border-emerald-200">
          <div className="flex items-center gap-3 px-5 py-4 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">
              No issues found — all checked shifts match their POS data.
            </p>
          </div>
        </Panel>
      )}

      {/* ── Developer details ─────────────────────────────────────────────── */}
      <Panel>
        <button
          className="flex w-full items-center justify-between px-5 py-3 text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          onClick={() => setDevOpen(v => !v)}
        >
          <span>Raw diagnostic data</span>
          {devOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {devOpen && (
          <pre className="border-t border-slate-100 p-5 text-xs text-slate-500 overflow-x-auto whitespace-pre-wrap break-all max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </Panel>

    </div>
  );
}

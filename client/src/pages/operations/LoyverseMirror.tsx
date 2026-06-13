import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

// ── Status normalisation ──────────────────────────────────────────────────────

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

function StatusBadge({ status }: { status: string | null | undefined }) {
  const h = normaliseDayStatus(status);
  const label =
    status === "NO_SHIFT_DATA" ? "No shift data" :
    status === "MISMATCH"      ? "Mismatch"       :
    status === "MATCH"         ? "Match"           :
    h === "healthy"            ? "Healthy"         :
    h === "warning"            ? "Warning"         : "Failed";
  const cls =
    h === "healthy" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
    h === "warning" ? "bg-amber-100 text-amber-800 border-amber-200"       :
                      "bg-red-100 text-red-800 border-red-200";
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// Normalise a sevenDayComparison row — handles both endpoint data shapes
function normaliseDay(day: any) {
  return {
    date:     day.shiftDate || day.date || null,
    receipts: day.appReceiptCount  ?? day.difference?.receiptCount ?? null,
    gross:    day.appGross         ?? day.difference?.grossSales   ?? null,
    cash:     day.appCash          ?? day.difference?.cash         ?? null,
    qr:       day.appQr            ?? day.difference?.qr           ?? null,
    grab:     day.appGrab          ?? day.difference?.grab         ?? null,
    status:   day.status           ?? null,
  };
}

// Flatten blockers whether they're strings or objects
function normaliseBlockers(raw: any[]): string[] {
  return (raw || []).map(b =>
    typeof b === "string" ? b : (b?.message || b?.code || JSON.stringify(b))
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoyverseMirror() {
  const [data, setData]         = useState<any>(null);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [devOpen, setDevOpen]   = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/loyverse/mirror-diagnostic")
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

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-xl font-semibold">Loyverse Mirror</h1>
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">Loyverse Mirror</h1>
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "No data returned from the diagnostic endpoint."}
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-1.5" />Retry
        </Button>
      </div>
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const overallHealth = normaliseHealth(data.status);

  const verdictText =
    overallHealth === "healthy" ? "Loyverse mirror is healthy"         :
    overallHealth === "warning" ? "Loyverse mirror needs attention"    :
                                  "Loyverse mirror has issues";

  const verdictColour =
    overallHealth === "healthy" ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
    overallHealth === "warning" ? "border-amber-200 bg-amber-50 text-amber-800"       :
                                  "border-red-200 bg-red-50 text-red-800";

  const days    = (data.sevenDayComparison || []).map(normaliseDay);
  const latest  = data.latestShiftComparison ? normaliseDay(data.latestShiftComparison) : (days[0] ?? null);
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

  const blockers      = normaliseBlockers(data.blockers);
  const hasIssues     = blockers.length > 0 || missingDays.length > 0 || mismatchDays.length > 0 || unmapped.length > 0 || hasIntegIssue;

  // Staleness: receipt newer than latest shift by more than 1.5 days?
  const receiptMs = data.latestReceiptDate ? new Date(data.latestReceiptDate).getTime() : 0;
  const shiftMs   = data.latestShiftDate   ? new Date(data.latestShiftDate).getTime()   : 0;
  const stale     = receiptMs > 0 && shiftMs > 0 && (receiptMs - shiftMs) > 86400000 * 1.5;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-5 text-slate-900">

      {/* Header + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Loyverse Mirror</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleSyncMissing} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync missing shifts"}
          </Button>
          <Button variant="outline" size="sm" disabled title="Run sync requires a date range — use the API directly with ?from=YYYY-MM-DD&to=YYYY-MM-DD">
            Run sync (date range required)
          </Button>
        </div>
      </div>

      {/* Sync result message */}
      {syncMsg && (
        <div className={`rounded border p-3 text-sm ${syncMsg.ok ? "border-blue-200 bg-blue-50 text-blue-800" : "border-red-200 bg-red-50 text-red-700"}`}>
          {syncMsg.text}
        </div>
      )}

      {/* 1. Overall status card */}
      <Card className={`border ${verdictColour.split(" ").slice(0, 2).join(" ")}`}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            {overallHealth === "healthy"
              ? <CheckCircle className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
              : overallHealth === "warning"
              ? <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              : <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />}
            <div className="space-y-3 flex-1 min-w-0">
              <p className={`text-base font-semibold ${verdictColour.split(" ").slice(2).join(" ")}`}>
                {verdictText}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Last sync</div>
                  <div className="text-sm font-medium">{syncAgeLabel(data.latestSyncAt)}</div>
                  <div className="text-xs text-slate-400">{fmtDateTime(data.latestSyncAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Latest receipt</div>
                  <div className="text-sm font-medium">{fmtDateTime(data.latestReceiptDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Latest shift</div>
                  <div className="text-sm font-medium">{fmtDate(data.latestShiftDate)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-0.5">Shifts checked</div>
                  <div className="text-sm font-medium">{days.length} days</div>
                </div>
              </div>
              {stale && (
                <div className="flex items-start gap-2 rounded bg-amber-100 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Shift report may be behind receipts — the latest receipt is more than one business day newer than the latest completed shift.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Latest completed shift card */}
      {latest && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Latest completed shift — {fmtDate(latest.date)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">Status</div>
                <StatusBadge status={latest.status} />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Receipts this shift</div>
                <div className="text-2xl font-bold num">{latest.receipts ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Gross sales</div>
                <div className="text-2xl font-bold currency">{fmtMoney(latest.gross)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Cash</div>
                <div className="text-2xl font-bold currency">{fmtMoney(latest.cash)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">QR</div>
                <div className="text-2xl font-bold currency">{fmtMoney(latest.qr)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-0.5">Grab</div>
                <div className="text-2xl font-bold currency">{fmtMoney(latest.grab)}</div>
              </div>
            </div>
            {latestRaw?.itemCount != null && (
              <p className="mt-3 text-xs text-slate-500">
                {latestRaw.itemCount.toLocaleString()} line items · {(latestRaw.modifierCount ?? 0).toLocaleString()} modifiers recorded for this shift
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Last 7 shifts table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-semibold">Last 7 completed shifts</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          {days.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-slate-500">No shift data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 font-medium text-slate-600">Date</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Receipts</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Gross sales</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Cash</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">QR</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600 text-right">Grab</th>
                    <th className="px-4 py-2.5 font-medium text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d: any, i: number) => (
                    <tr key={d.date || i} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{fmtDate(d.date)}</td>
                      <td className="px-4 py-2.5 text-right num">{d.receipts ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right currency">{fmtMoney(d.gross)}</td>
                      <td className="px-4 py-2.5 text-right currency">{fmtMoney(d.cash)}</td>
                      <td className="px-4 py-2.5 text-right currency">{fmtMoney(d.qr)}</td>
                      <td className="px-4 py-2.5 text-right currency">{fmtMoney(d.grab)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Issues section */}
      {hasIssues ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Issues requiring attention</h2>

          {missingDays.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Missing shift reports ({missingDays.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {missingDays.map((d: any) => (
                  <div key={d.date} className="rounded bg-amber-50 border border-amber-100 p-3">
                    <div className="text-sm font-medium">{fmtDate(d.date)}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Receipts were recorded in the mirror for this date but no completed shift report was found.
                      This can happen when a shift closes late or the shift report hasn't synced yet.
                    </div>
                    <div className="text-xs font-medium text-amber-700 mt-1.5">
                      Suggested action: click "Sync missing shifts" above to attempt automatic recovery.
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {mismatchDays.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-800 flex items-center gap-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  Sales total mismatches ({mismatchDays.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {mismatchDays.map((d: any) => (
                  <div key={d.date} className="rounded bg-red-50 border border-red-100 p-3">
                    <div className="text-sm font-medium">{fmtDate(d.date)}</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      The sales total from receipts in the mirror doesn't match the shift report for this date.
                      This usually means a receipt was added or changed after the shift was closed.
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {unmapped.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  Payment types mapped as "Other" ({unmapped.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  These payment types exist in Loyverse but are not recognised as Cash, QR, or Grab.
                  They are counted under "Other" and do not affect the total sales figure.
                  Review if anything here is unexpected.
                </p>
                <div className="space-y-1.5">
                  {unmapped.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-medium">{p.name || p.pt_name || "Unknown"}</span>
                      <span className="text-slate-500">
                        {(p.receiptCount ?? p.receipt_count ?? "?").toLocaleString()} receipts · mapped as Other
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {hasIntegIssue && (
            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-800 flex items-center gap-2">
                  <XCircle className="h-4 w-4 shrink-0" />
                  Data integrity issues
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dupReceipts > 0 && (
                  <div className="rounded bg-red-50 border border-red-100 p-3 text-xs">
                    <div className="font-medium">{dupReceipts.toLocaleString()} duplicate receipt(s)</div>
                    <div className="text-slate-600 mt-0.5">
                      The same receipt ID appears more than once in the mirror database. This should not happen and may indicate a sync error. Contact support.
                    </div>
                  </div>
                )}
                {orphanItems > 0 && (
                  <div className="rounded bg-red-50 border border-red-100 p-3 text-xs">
                    <div className="font-medium">{orphanItems.toLocaleString()} orphan line item(s)</div>
                    <div className="text-slate-600 mt-0.5">
                      These item records have no matching receipt in the mirror. They won't affect sales figures but indicate a sync gap.
                    </div>
                  </div>
                )}
                {orphanMods > 0 && (
                  <div className="rounded bg-red-50 border border-red-100 p-3 text-xs">
                    <div className="font-medium">{orphanMods.toLocaleString()} orphan modifier(s)</div>
                    <div className="text-slate-600 mt-0.5">
                      These modifier records have no matching receipt. Won't affect totals but may indicate a sync gap.
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          No issues found. All checked shifts match their Loyverse shift reports.
        </div>
      )}

      {/* 5. Developer details — collapsed by default */}
      <div className="border rounded bg-white">
        <button
          type="button"
          onClick={() => setDevOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <span>Developer details</span>
          {devOpen
            ? <ChevronDown  className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />}
        </button>
        {devOpen && (
          <div className="border-t px-4 py-3">
            <p className="text-xs text-slate-400 mb-2">Raw diagnostic payload from /api/loyverse/mirror-diagnostic</p>
            <pre className="text-xs text-slate-700 overflow-x-auto whitespace-pre-wrap break-words bg-slate-50 rounded p-3 max-h-96 overflow-y-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>

    </div>
  );
}

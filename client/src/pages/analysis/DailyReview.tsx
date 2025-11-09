import React, { useEffect, useMemo, useState } from "react";
import type { DailyComparisonResponse } from "../../../../shared/analysisTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DailySalesRow {
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
  expected_qr_bank: number;
  expected_total_bank: number;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);
const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0 });
};

function Flag({ val }: { val: number }) {
  const match = val === 0;
  return (
    <div className={`rounded px-2 py-1 text-center font-semibold ${match ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
      {match ? "✓" : "⚠"}
    </div>
  );
}

function DayPill({
  date,
  selected,
  status,
  onClick,
}: {
  date: string;
  selected: boolean;
  status: DailyComparisonResponse["availability"];
  onClick: () => void;
}) {
  const flagged = status === "ok";
  const cls =
    status === "ok"
      ? "border-gray-300"
      : "border-gray-200 bg-gray-100 text-gray-400";
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm ${
        selected ? "bg-black text-white" : "bg-white hover:bg-gray-50"
      } ${cls}`}
      title={
        status === "ok"
          ? "Data available"
          : status === "missing_both"
          ? "Missing POS and Form"
          : status === "missing_pos"
          ? "Missing POS"
          : "Missing Form"
      }
    >
      {date.slice(-2)}
    </button>
  );
}

export default function DailyReview() {
  const [month, setMonth] = useState(thisMonth());
  const [all, setAll] = useState<DailyComparisonResponse[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [current, setCurrent] = useState<DailyComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [actualAmountBanked, setActualAmountBanked] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exportDate, setExportDate] = useState("");
  const [syncDialog, setSyncDialog] = useState<{
    open: boolean;
    success: boolean;
    message: string;
    date?: string;
    sales?: number;
    expenses?: number;
  }>({
    open: false,
    success: false,
    message: "",
  });

  // Query for Daily Sales table data
  const { data: dailySalesRows = [], isLoading: isDailySalesLoading } = useQuery<DailySalesRow[]>({
    queryKey: ['/api/analysis/daily-sales'],
  });

  async function fetchJSON(url: string, init?: RequestInit) {
    const r = await fetch(url, init);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  }

  async function manualSync(dateStr: string) {
    try {
      setSyncing(true);
      const result = await fetchJSON(
        `/api/analysis/sync-pos-for-date?date=${dateStr}`,
        { method: "POST" }
      );
      if (result.ok) {
        setSyncDialog({
          open: true,
          success: true,
          message: result.message || "POS data synced successfully! The page data will refresh automatically.",
          date: result.date,
          sales: result.sales,
          expenses: result.expenses,
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        window.location.reload();
      } else {
        setSyncDialog({
          open: true,
          success: false,
          message: result.message || "Failed to sync POS data. Please try again.",
        });
      }
    } catch (err: any) {
      setSyncDialog({
        open: true,
        success: false,
        message: `Error: ${err.message || "Unknown error occurred"}`,
      });
    } finally {
      setSyncing(false);
    }
  }

  async function saveComment() {
    if (!selectedDate) {
      alert("No date selected. Please select a date first.");
      return;
    }
    setSavingComment(true);
    try {
      const payload = {
        comment,
        actualAmountBanked: actualAmountBanked ? parseFloat(actualAmountBanked) : null,
      };
      const resp = await fetchJSON(`/api/daily-review-comments/${selectedDate}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      alert(`Saved manager review for ${selectedDate}: ${resp.message || "Success"}`);
    } catch (err: any) {
      alert("Error saving review: " + err.message);
    } finally {
      setSavingComment(false);
    }
  }

  const handleDateExport = () => {
    if (exportDate) {
      window.open(`/api/analysis/daily-sales/export.csv?date=${exportDate}`, '_blank');
    }
  };

  useEffect(() => {
    (async () => {
      if (!month) return;
      setLoading(true);
      try {
        const data = await fetchJSON(`/api/analysis/daily-comparison-range?month=${month}`);
        setAll(data);
        const sorted = data.filter((d: DailyComparisonResponse) => d.date).sort(
          (a: DailyComparisonResponse, b: DailyComparisonResponse) =>
            a.date < b.date ? 1 : -1
        );
        if (sorted.length > 0 && !selectedDate) {
          setSelectedDate(sorted[0].date);
        }
      } catch (err) {
        console.error(err);
        setAll([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [month]);

  useEffect(() => {
    const item = all.find((d) => d.date === selectedDate);
    setCurrent(item ?? null);
  }, [selectedDate, all]);

  useEffect(() => {
    (async () => {
      if (!selectedDate) return;
      try {
        const resp = await fetchJSON(`/api/daily-review-comments/${selectedDate}`);
        if (resp.comment !== undefined) setComment(resp.comment || "");
        if (resp.actualAmountBanked !== undefined)
          setActualAmountBanked(resp.actualAmountBanked != null ? String(resp.actualAmountBanked) : "");
      } catch (err) {
        console.error(err);
      }
    })();
  }, [selectedDate]);

  const Section = ({ title, rows }: { title: string; rows: any[] }) => (
    <section className="mb-6">
      <h2 className="text-sm font-bold mb-2">{title}</h2>
      <div className="grid grid-cols-5 gap-1 text-sm items-center">
        <div className="font-semibold text-gray-500">Item</div>
        <div className="font-semibold">POS</div>
        <div className="font-semibold">Form</div>
        <div className="font-semibold">Diff (Form−POS)</div>
        <div className="font-semibold text-center">Flag</div>
        {rows.map((r: any) => (
          <React.Fragment key={r.label}>
            <div className="text-gray-600">{r.label}</div>
            <div>{r.pos == null ? "—" : fmt(Number(r.pos))}</div>
            <div>{r.form == null ? "—" : fmt(Number(r.form))}</div>
            <div>{r.diff == null ? "—" : r.diff === 0 ? "—" : fmt(r.diff)}</div>
            <div>{r.diff == null ? "—" : <Flag val={r.diff} />}</div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[980px] p-4 space-y-6">
      <header className="border-b pb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-sm font-extrabold">Sales & Shift Analysis</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1 text-sm" />
          {selectedDate && (
            <button
              onClick={() => manualSync(selectedDate)}
              disabled={syncing}
              className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              data-testid="button-manual-sync"
            >
              {syncing ? "Syncing..." : "Sync POS"}
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-2 flex-wrap">
        {all.map((d) => (
          <DayPill
            key={d.date}
            date={d.date}
            selected={selectedDate === d.date}
            status={d.availability}
            onClick={() => setSelectedDate(d.date)}
          />
        ))}
      </div>

      {loading && <div className="text-sm p-4">Loading…</div>}
      {!loading && !current && <div className="text-sm p-4 text-gray-600">No data for this month.</div>}

      {!loading && current && (
        <>
          <div className="rounded border p-3 bg-gray-50">
            <div className="text-sm">
              <span className="font-semibold">Business date:</span> {current.date} (17:00→03:00, POS = source of truth)
              {current.availability !== "ok" && (
                <span className="ml-2 text-red-700">
                  — {current.availability === "missing_both" ? "Missing POS & Form" :
                      current.availability === "missing_pos" ? "Missing POS" : "Missing Form"}
                </span>
              )}
            </div>
          </div>

          {current.availability === "ok" && current.pos && current.form && current.variance && (
            <>
              <Section
                title="Sales (Form vs POS)"
                rows={[
                  { label: "Cash", pos: current.pos.sales.cash, form: current.form.sales.cash, diff: current.variance.sales.cash },
                  { label: "QR", pos: current.pos.sales.qr, form: current.form.sales.qr, diff: current.variance.sales.qr },
                  { label: "Grab", pos: current.pos.sales.grab, form: current.form.sales.grab, diff: current.variance.sales.grab },
                  { label: "Total", pos: current.pos.sales.total, form: current.form.sales.total, diff: current.variance.sales.total },
                ]}
              />

              <Section
                title="Expenses"
                rows={[
                  { label: "Shopping", pos: current.pos.expenses.shoppingTotal, form: current.form.expenses.shoppingTotal, diff: current.variance.expenses.shoppingTotal },
                  { label: "Wages", pos: current.pos.expenses.wageTotal, form: current.form.expenses.wageTotal, diff: current.variance.expenses.wageTotal },
                  { label: "Other", pos: current.pos.expenses.otherTotal, form: current.form.expenses.otherTotal, diff: current.variance.expenses.otherTotal },
                  { label: "Total", pos: (current.pos.expenses.shoppingTotal + current.pos.expenses.wageTotal + current.pos.expenses.otherTotal), form: (current.form.expenses.shoppingTotal + current.form.expenses.wageTotal + current.form.expenses.otherTotal), diff: current.variance.expenses.grandTotal },
                ]}
              />

              <Section
                title="Net Banking & Cash"
                rows={[
                  { label: "Est. Net Banked", pos: current.pos.banking.estimatedNetBanked, form: current.form.banking.estimatedNetBanked, diff: current.variance.banking.estimatedNetBanked },
                  { label: "Expected Cash", pos: current.pos.banking.expectedCash, form: current.form.banking.expectedCash, diff: current.variance.banking.expectedCash },
                ]}
              />
            </>
          )}

          {current.availability !== "ok" && (
            <div className="text-sm text-gray-600">
              We don't have both sources to compare for this date. Data present:
              <ul className="list-disc ml-5 mt-1">
                {current.pos && <li>POS shift totals</li>}
                {current.form && <li>Daily Sales & Stock Form</li>}
                {!current.pos && !current.form && <li>None</li>}
              </ul>
            </div>
          )}

          <section className="border-t pt-3">
            <h2 className="font-bold text-sm mb-3">Manager Review</h2>
            
            {/* Banking Verification */}
            <div className="mb-4 p-3 bg-gray-50 rounded border">
              <div className="grid grid-cols-3 gap-3 items-center text-sm mb-2">
                <div>
                  <div className="text-xs text-gray-500">Expected Net Banked (from above)</div>
                  <div className="font-semibold text-base">
                    {current?.variance 
                      ? fmt(current.form?.banking.estimatedNetBanked ?? 0) 
                      : "—"}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Actual Amount Banked</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter actual..."
                    value={actualAmountBanked}
                    onChange={(e) => setActualAmountBanked(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                    data-testid="input-actual-banked"
                  />
                </div>
                <div>
                  {actualAmountBanked && current?.variance && current.form && (
                    (() => {
                      const expected = current.form.banking.estimatedNetBanked;
                      const actual = parseFloat(actualAmountBanked);
                      const diff = actual - expected;
                      const hasDiff = Math.abs(diff) > 0.01;
                      return (
                        <div className={`text-center p-2 rounded ${hasDiff ? 'bg-red-100 border border-red-300' : 'bg-green-100 border border-green-300'}`}>
                          <div className="text-xs font-semibold">{hasDiff ? '⚠️ Variance' : '✓ Match'}</div>
                          {hasDiff && (
                            <div className="text-sm font-bold text-red-700">
                              {diff > 0 ? '+' : ''}{fmt(diff)}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>

            {/* Manager Comments */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">Notes</h3>
              <button
                onClick={saveComment}
                disabled={savingComment || !selectedDate}
                className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                data-testid="button-save-review"
              >
                {savingComment ? "Saving..." : "Save Review"}
              </button>
            </div>
            <textarea
              className="w-full border rounded p-2 min-h-[110px] text-sm"
              placeholder="Record findings, explanations, or actions taken for this specific date…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              data-testid="textarea-manager-comment"
            />
            <div className="text-xs text-gray-500 mt-1">
              Manager review data is saved per business date and stored in the database.
            </div>
          </section>
        </>
      )}

      {/* All Shifts Data Section */}
      <section className="border-t pt-6 mt-8">
        <div className="mb-4">
          <h2 className="text-sm font-extrabold mb-4">All Shifts Data</h2>
          
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <input
              id="export-by-date"
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
              className="border rounded px-2 py-1"
            />
            <button
              onClick={handleDateExport}
              className="border rounded px-3 py-1 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={!exportDate}
            >
              Export by Date (CSV)
            </button>
          </div>

          {isDailySalesLoading && <p className="text-sm mt-4">Loading...</p>}
          {!isDailySalesLoading && dailySalesRows.length === 0 && (
            <p className="text-sm text-gray-500 mt-4">No data available</p>
          )}
        </div>

        {!isDailySalesLoading && dailySalesRows.length > 0 && (
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <table className="border-collapse text-xs sm:text-sm" style={{ minWidth: '1400px' }}>
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="px-3 py-2 text-left whitespace-nowrap">Date</th>
                  <th className="px-3 py-2 text-left whitespace-nowrap">Completed By</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Total</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Cash</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">QR</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Grab</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Other</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Exp Cash</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Exp QR</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Exp Total</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Shopping</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Wages</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Other Exp</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Tot Exp</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Rolls</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Meat (g)</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Export</th>
                </tr>
              </thead>
              <tbody>
                {dailySalesRows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">{r.shift_date}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.completed_by}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.total_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.cash_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.qr_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.grab_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.aroi_sales || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.expected_cash_bank || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.expected_qr_bank || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.expected_total_bank || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.shopping_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.wages_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.others_total || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{(r.total_expenses || 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.rolls_end || 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{r.meat_end_g || 0}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <a
                        className="underline text-xs text-emerald-600 hover:text-emerald-700"
                        href={`/api/analysis/daily-sales/export.csv?id=${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Export
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sync Success/Error Dialog */}
      <Dialog open={syncDialog.open} onOpenChange={(open) => setSyncDialog({ ...syncDialog, open })}>
        <DialogContent className="sm:max-w-md" data-testid="sync-result-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {syncDialog.success ? (
                <>
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  <span className="text-emerald-700">Sync Successful</span>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-500" />
                  <span className="text-red-700">Sync Failed</span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {syncDialog.success ? (
              <>
                <p className="text-sm text-gray-600">{syncDialog.message}</p>
                
                {syncDialog.date && (
                  <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(syncDialog.date).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                    
                    {syncDialog.sales !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sales Total</span>
                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                          ฿{syncDialog.sales.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                    
                    {syncDialog.expenses !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Expenses Total</span>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">
                          ฿{syncDialog.expenses.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                <button
                  onClick={() => setSyncDialog({ ...syncDialog, open: false })}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                  data-testid="btn-close-success"
                >
                  Got it!
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-red-600 whitespace-pre-wrap">{syncDialog.message}</p>
                
                <button
                  onClick={() => setSyncDialog({ ...syncDialog, open: false })}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                  data-testid="btn-close-error"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

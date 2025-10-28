import React, { useEffect, useMemo, useState } from "react";
import type { DailyComparisonResponse } from "../../../../shared/analysisTypes";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle } from "lucide-react";

const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0 });

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
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [actualAmountBanked, setActualAmountBanked] = useState<string>("");
  const [savingComment, setSavingComment] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDialog, setSyncDialog] = useState<{
    open: boolean;
    success: boolean;
    message: string;
    date?: string;
    sales?: number;
    expenses?: number;
  }>({ open: false, success: false, message: "" });

  const manualSync = async (date: string) => {
    setSyncing(true);
    try {
      const response = await fetch('/api/pos/sync-daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessDate: date })
      });
      
      if (response.ok) {
        const result = await response.json();
        setSyncDialog({
          open: true,
          success: true,
          message: 'POS data synced successfully',
          date,
          sales: result.sales.grand,
          expenses: result.expenses.shopping + result.expenses.wages
        });
        
        // Refresh the data
        const r = await fetch(`/api/analysis/daily-comparison-range?month=${month}`);
        if (r.ok) {
          const j = await r.json();
          const dataArray = Array.isArray(j) ? j : [];
          setAll(dataArray);
        }
      } else {
        const errorData = await response.json();
        setSyncDialog({
          open: true,
          success: false,
          message: `Sync failed: ${errorData.error || response.statusText}${errorData.details ? '\n' + errorData.details : ''}`
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncDialog({
        open: true,
        success: false,
        message: `Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/analysis/daily-comparison-range?month=${month}`);
        if (!r.ok) {
          console.error(`API error: ${r.status} ${r.statusText}`);
          if (alive) {
            setAll([]);
            setSelectedDate(null);
          }
          return;
        }
        const j = await r.json();
        if (!alive) return;
        
        // Defensive: ensure j is an array
        const dataArray = Array.isArray(j) ? j : [];
        setAll(dataArray);
        const latestWithAny = [...dataArray].reverse().find(d => d.availability !== "missing_both");
        setSelectedDate(latestWithAny?.date || dataArray[dataArray.length - 1]?.date || null);
      } catch (error) {
        console.error('Failed to fetch daily comparison data:', error);
        if (alive) {
          setAll([]);
          setSelectedDate(null);
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [month]);

  const current = useMemo(() => all.find(d => d.date === selectedDate) || null, [all, selectedDate]);

  const dayHasFlag = (d: DailyComparisonResponse) => {
    if (d.availability !== "ok" || !d.variance) return false;
    const S = d.variance.sales, E = d.variance.expenses, B = d.variance.banking;
    return (
      S.cash !== 0 ||
      S.qr !== 0 ||
      S.grab !== 0 ||
      S.total !== 0 ||
      E.grandTotal !== 0 ||
      B.expectedCash !== 0 ||
      B.estimatedNetBanked !== 0
    );
  };

  const saveComment = async () => {
    if (!selectedDate) return;
    
    setSavingComment(true);
    try {
      const response = await fetch('/api/daily-review-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          businessDate: selectedDate, 
          comment,
          actualAmountBanked: actualAmountBanked ? parseFloat(actualAmountBanked) : null,
          createdBy: 'Manager'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save');
      }
      
      alert('Manager review saved successfully');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save manager review');
    } finally {
      setSavingComment(false);
    }
  };

  // Load comment and banking data when date changes
  useEffect(() => {
    if (!selectedDate) return;
    
    (async () => {
      try {
        const response = await fetch(`/api/daily-review-comments/${selectedDate}`);
        if (response.ok) {
          const data = await response.json();
          setComment(data.comment || "");
          setActualAmountBanked(data.actualAmountBanked !== null ? data.actualAmountBanked.toString() : "");
        }
      } catch (error) {
        console.error('Error loading review data:', error);
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
            <div>{r.pos === null ? "—" : fmt(r.pos)}</div>
            <div>{r.form === null ? "—" : fmt(r.form)}</div>
            <div>{r.diff === null ? "—" : r.diff === 0 ? "—" : fmt(r.diff)}</div>
            <div>{r.diff === null ? "—" : <Flag val={r.diff} />}</div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[980px] p-4 space-y-6">
      <header className="border-b pb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-sm font-extrabold">Daily Review</h1>
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
              <span className="font-semibold">Business date:</span> {current.date} (18:00→03:00, POS = source of truth)
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
                  {
                    label: "Grand Total",
                    pos: current.pos.expenses.shoppingTotal + current.pos.expenses.wageTotal,
                    form: current.form.expenses.shoppingTotal + current.form.expenses.wageTotal,
                    diff: current.variance.expenses.grandTotal,
                  },
                ]}
              />

              <Section
                title="Banking & Cash"
                rows={[
                  { label: "Expected Cash", pos: current.pos.banking.expectedCash, form: current.form.banking.expectedCash, diff: current.variance.banking.expectedCash },
                  { label: "Estimated Net Banked", pos: current.pos.banking.estimatedNetBanked, form: current.form.banking.estimatedNetBanked, diff: current.variance.banking.estimatedNetBanked },
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

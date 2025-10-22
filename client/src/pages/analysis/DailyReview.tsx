import { useEffect, useMemo, useState } from "react";
import type { DailyComparisonResponse } from "../../../../shared/analysisTypes";

const THRESHOLDS = { sales: 500, expenses: 500, banking: 300 };
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0 });

function Flag({ val, limit }: { val: number; limit: number }) {
  const ok = Math.abs(val) < limit;
  return (
    <div
      className={`rounded px-2 py-1 text-center font-semibold text-xs ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {ok ? "✓" : "⚠"}
    </div>
  );
}

function DayPill({
  date,
  selected,
  flagged,
  onClick,
}: {
  date: string;
  selected: boolean;
  flagged: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-xs min-h-[44px] min-w-[44px] active:scale-95 transition-transform ${
        selected ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-slate-50 border-slate-300"
      } ${flagged ? "border-red-400 ring-2 ring-red-200" : ""}`}
      title={flagged ? "Has anomalies" : "OK"}
      data-testid={`day-pill-${date}`}
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
  const [comment, setComment] = useState(localStorage.getItem("dailyReviewComment") || "");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/analysis/daily-comparison-range?month=${month}`);
        const j = (await r.json()) as DailyComparisonResponse[];
        if (!alive) return;
        setAll(j);
        setSelectedDate(j.length ? j[j.length - 1].date : null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [month]);

  const current = useMemo(
    () => all.find((d) => d.date === selectedDate) || null,
    [all, selectedDate]
  );

  const dayHasFlag = (d: DailyComparisonResponse) => {
    const S = d.variance.sales;
    const E = d.variance.expenses;
    const B = d.variance.banking;
    return (
      Math.abs(S.cash) >= THRESHOLDS.sales ||
      Math.abs(S.qr) >= THRESHOLDS.sales ||
      Math.abs(S.grab) >= THRESHOLDS.sales ||
      Math.abs(S.total) >= THRESHOLDS.sales ||
      Math.abs(E.grandTotal) >= THRESHOLDS.expenses ||
      Math.abs(B.expectedCash) >= THRESHOLDS.banking ||
      Math.abs(B.estimatedNetBanked) >= THRESHOLDS.banking
    );
  };

  const saveComment = (txt: string) => {
    setComment(txt);
    localStorage.setItem("dailyReviewComment", txt);
  };

  const Section = ({ title, rows, type }: { title: string; rows: any[]; type: keyof typeof THRESHOLDS }) => (
    <section className="mb-6">
      <h2 className="text-sm font-semibold mb-3 text-slate-900">{title}</h2>
      <div className="grid grid-cols-5 gap-2 text-xs items-center">
        <div className="font-semibold text-slate-600">Item</div>
        <div className="font-semibold text-slate-600">POS</div>
        <div className="font-semibold text-slate-600">Form</div>
        <div className="font-semibold text-slate-600">Diff (Form−POS)</div>
        <div className="font-semibold text-center text-slate-600">Flag</div>
        {rows.map((r: any) => (
          <div key={r.label} className="contents">
            <div className="text-slate-700">{r.label}</div>
            <div className="text-slate-900">฿{fmt(r.pos)}</div>
            <div className="text-slate-900">฿{fmt(r.form)}</div>
            <div className={Math.abs(r.diff) ? "font-semibold text-slate-900" : "text-slate-500"}>
              {r.diff === 0 ? "—" : `฿${fmt(r.diff)}`}
            </div>
            <Flag val={r.diff} limit={THRESHOLDS[type]} />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-6">
      <header className="border-b border-slate-200 pb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-lg font-bold text-slate-900">Daily Review</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-300 rounded px-3 py-2 text-xs min-h-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            data-testid="input-month-selector"
          />
        </div>
      </header>

      {/* Day chooser */}
      <div className="flex gap-2 flex-wrap">
        {all.map((d) => (
          <DayPill
            key={d.date}
            date={d.date}
            selected={selectedDate === d.date}
            flagged={dayHasFlag(d)}
            onClick={() => setSelectedDate(d.date)}
          />
        ))}
      </div>

      {loading && <div className="text-xs p-4 text-slate-600">Loading…</div>}
      {!loading && !current && (
        <div className="text-xs p-4 text-slate-600">No data for this month.</div>
      )}

      {!loading && current && (
        <>
          {/* Context banner */}
          <div className="rounded border border-slate-300 p-4 bg-slate-50">
            <div className="text-xs text-slate-700">
              <span className="font-semibold">Business date:</span> {current.date} (18:00→03:00, POS = source of truth)
            </div>
          </div>

          {/* SALES */}
          <Section
            title="Sales (Form vs POS)"
            type="sales"
            rows={[
              { label: "Cash", pos: current.pos.sales.cash, form: current.form.sales.cash, diff: current.variance.sales.cash },
              { label: "QR", pos: current.pos.sales.qr, form: current.form.sales.qr, diff: current.variance.sales.qr },
              { label: "Grab", pos: current.pos.sales.grab, form: current.form.sales.grab, diff: current.variance.sales.grab },
              { label: "Total", pos: current.pos.sales.total, form: current.form.sales.total, diff: current.variance.sales.total },
            ]}
          />

          {/* EXPENSES */}
          <Section
            title="Money Out (Expenses)"
            type="expenses"
            rows={[
              { label: "Shopping", pos: current.pos.expenses.shoppingTotal, form: current.form.expenses.shoppingTotal, diff: current.variance.expenses.shoppingTotal },
              { label: "Wages", pos: current.pos.expenses.wageTotal, form: current.form.expenses.wageTotal, diff: current.variance.expenses.wageTotal },
              {
                label: "Grand Total",
                pos: current.pos.expenses.shoppingTotal + current.pos.expenses.wageTotal + current.pos.expenses.otherTotal,
                form: current.form.expenses.shoppingTotal + current.form.expenses.wageTotal + current.form.expenses.otherTotal,
                diff: current.variance.expenses.grandTotal,
              },
            ]}
          />

          {/* BANKING */}
          <Section
            title="Banking & Cash"
            type="banking"
            rows={[
              { label: "Expected Cash", pos: current.pos.banking.expectedCash, form: current.form.banking.expectedCash, diff: current.variance.banking.expectedCash },
              { label: "Estimated Net Banked", pos: current.pos.banking.estimatedNetBanked, form: current.form.banking.estimatedNetBanked, diff: current.variance.banking.estimatedNetBanked },
            ]}
          />

          {/* COMMENTS */}
          <section className="border-t border-slate-200 pt-4">
            <h2 className="font-semibold mb-3 text-sm text-slate-900">Manager Comments (local only)</h2>
            <textarea
              className="w-full border border-slate-300 rounded px-3 py-2 min-h-[120px] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Record findings, explanations, or actions taken…"
              value={comment}
              onChange={(e) => saveComment(e.target.value)}
              data-testid="textarea-manager-comments"
            />
            <div className="text-xs text-slate-500 mt-2">
              (Comments are saved only on this device. We can wire them to the database per business date later if you'd like.)
            </div>
          </section>
        </>
      )}
    </div>
  );
}

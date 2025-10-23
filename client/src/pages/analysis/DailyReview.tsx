import React, { useEffect, useMemo, useState } from "react";
import type { DailyComparisonResponse } from "../../../../shared/analysisTypes";

const THRESHOLDS = { sales: 500, expenses: 500, banking: 300 };
const todayISO = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => todayISO().slice(0, 7);
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0 });

function Flag({ val, limit }: { val: number; limit: number }) {
  const ok = Math.abs(val) < limit;
  return (
    <div className={`rounded px-2 py-1 text-center font-semibold ${ok ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"}`}>
      {ok ? "✓" : "⚠"}
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
        const latestWithAny = [...j].reverse().find(d => d.availability !== "missing_both");
        setSelectedDate(latestWithAny?.date || j[j.length - 1]?.date || null);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [month]);

  const current = useMemo(() => all.find(d => d.date === selectedDate) || null, [all, selectedDate]);

  const dayHasFlag = (d: DailyComparisonResponse) => {
    if (d.availability !== "ok" || !d.variance) return false;
    const S = d.variance.sales, E = d.variance.expenses, B = d.variance.banking;
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
            <div>{r.diff === null ? "—" : <Flag val={r.diff} limit={THRESHOLDS[type]} />}</div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[980px] p-4 space-y-6">
      <header className="border-b pb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-sm font-extrabold">Daily Review</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="border rounded px-2 py-1 text-sm" />
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
                type="sales"
                rows={[
                  { label: "Cash", pos: current.pos.sales.cash, form: current.form.sales.cash, diff: current.variance.sales.cash },
                  { label: "QR", pos: current.pos.sales.qr, form: current.form.sales.qr, diff: current.variance.sales.qr },
                  { label: "Grab", pos: current.pos.sales.grab, form: current.form.sales.grab, diff: current.variance.sales.grab },
                  { label: "Total", pos: current.pos.sales.total, form: current.form.sales.total, diff: current.variance.sales.total },
                ]}
              />

              <Section
                title="Expenses"
                type="expenses"
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
                type="banking"
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
            <h2 className="font-bold mb-2 text-sm">Manager Comments (local only)</h2>
            <textarea
              className="w-full border rounded p-2 min-h-[110px] text-sm"
              placeholder="Record findings, explanations, or actions taken…"
              value={comment}
              onChange={(e) => saveComment(e.target.value)}
            />
            <div className="text-xs text-gray-500 mt-1">
              (Comments are saved only on this device. We can wire them to the database per business date later if you'd like.)
            </div>
          </section>
        </>
      )}
    </div>
  );
}

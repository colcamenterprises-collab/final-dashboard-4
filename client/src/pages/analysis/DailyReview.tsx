import { useState, useEffect } from "react";
import type { DailyComparisonResponse } from "../../../../shared/analysisTypes";

const THRESHOLDS = { sales: 500, expenses: 500, banking: 300 };
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0 });

function Flag({ val, limit }: { val: number; limit: number }) {
  const ok = Math.abs(val) < limit;
  return (
    <div
      className={`rounded-lg px-2 py-1 text-center font-semibold ${
        ok ? "bg-green-200 text-green-800" : "bg-red-200 text-red-800"
      }`}
    >
      {ok ? "✓" : "⚠"}
    </div>
  );
}

export default function DailyReview() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DailyComparisonResponse | null>(null);
  const [comment, setComment] = useState(localStorage.getItem("dailyReviewComment") || "");

  useEffect(() => {
    fetch(`/api/analysis/daily-comparison?date=${date}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [date]);

  const saveComment = (txt: string) => {
    setComment(txt);
    localStorage.setItem("dailyReviewComment", txt);
  };

  if (!data) return <div className="p-6 text-sm">Loading...</div>;

  const pos = data.pos;
  const form = data.form;
  const v = data.variance;

  const Section = ({ title, rows, type }: { title: string; rows: any[]; type: keyof typeof THRESHOLDS }) => (
    <section className="mb-6">
      <h2 className="text-lg font-bold mb-2">{title}</h2>
      <div className="grid grid-cols-5 gap-1 text-sm items-center">
        <div className="font-semibold text-gray-500">Item</div>
        <div className="font-semibold">POS</div>
        <div className="font-semibold">Form</div>
        <div className="font-semibold">Diff</div>
        <div className="font-semibold text-center">Flag</div>
        {rows.map((r: any) => (
          <>
            <div key={`${r.label}-label`} className="text-gray-600">{r.label}</div>
            <div key={`${r.label}-pos`}>{fmt(r.pos)}</div>
            <div key={`${r.label}-form`}>{fmt(r.form)}</div>
            <div key={`${r.label}-diff`} className={Math.abs(r.diff) ? "font-semibold" : ""}>
              {r.diff === 0 ? "—" : fmt(r.diff)}
            </div>
            <div key={`${r.label}-flag`}>
              <Flag val={r.diff} limit={THRESHOLDS[type]} />
            </div>
          </>
        ))}
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[980px] p-4 space-y-6">
      <header className="flex items-center justify-between border-b pb-2">
        <h1 className="text-xl font-extrabold">Daily Review</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded-lg px-2 py-1 text-sm"
        />
      </header>

      <Section
        title="Sales (Form vs POS)"
        type="sales"
        rows={[
          { label: "Cash", pos: pos.sales.cash, form: form.sales.cash, diff: v.sales.cash },
          { label: "QR", pos: pos.sales.qr, form: form.sales.qr, diff: v.sales.qr },
          { label: "Grab", pos: pos.sales.grab, form: form.sales.grab, diff: v.sales.grab },
          { label: "Total", pos: pos.sales.total, form: form.sales.total, diff: v.sales.total },
        ]}
      />

      <Section
        title="Expenses"
        type="expenses"
        rows={[
          { label: "Shopping", pos: pos.expenses.shoppingTotal, form: form.expenses.shoppingTotal, diff: v.expenses.shoppingTotal },
          { label: "Wages", pos: pos.expenses.wageTotal, form: form.expenses.wageTotal, diff: v.expenses.wageTotal },
          { label: "Grand Total",
            pos: pos.expenses.shoppingTotal + pos.expenses.wageTotal,
            form: form.expenses.shoppingTotal + form.expenses.wageTotal,
            diff: v.expenses.grandTotal },
        ]}
      />

      <Section
        title="Banking & Cash"
        type="banking"
        rows={[
          { label: "Expected Cash", pos: pos.banking.expectedCash, form: form.banking.expectedCash, diff: v.banking.expectedCash },
          { label: "Estimated Net Banked", pos: pos.banking.estimatedNetBanked, form: form.banking.estimatedNetBanked, diff: v.banking.estimatedNetBanked },
        ]}
      />

      <section className="border-t pt-3">
        <h2 className="font-bold mb-2">Manager Comments</h2>
        <textarea
          className="w-full border rounded-lg p-2 min-h-[100px] text-sm"
          placeholder="Record findings, explanations, or actions taken..."
          value={comment}
          onChange={(e) => saveComment(e.target.value)}
        />
      </section>
    </div>
  );
}

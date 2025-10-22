import { useState, useEffect } from "react";
import type { DailyComparisonResponse } from "../../../../shared/analysisTypes";
import { formatDateDDMMYYYY, convertFromInputDate } from "@/lib/format";

const THRESHOLDS = { sales: 500, expenses: 500, banking: 300 };
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0 });

function Flag({ val }: { val: number }) {
  const isMatch = val === 0;
  return (
    <span
      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
        isMatch ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {isMatch ? "✓ Match" : "Variance"}
    </span>
  );
}

export default function DailyReview() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<DailyComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState(localStorage.getItem("dailyReviewComment") || "");

  useEffect(() => {
    loadData();
  }, [date]);

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(`/api/analysis/daily-comparison?date=${date}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const saveComment = (txt: string) => {
    setComment(txt);
    localStorage.setItem("dailyReviewComment", txt);
  };

  if (!data) return <div className="p-6 text-sm">Loading...</div>;

  const pos = data.pos;
  const form = data.form;
  const v = data.variance;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header and Controls */}
      <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-base font-semibold">Daily Review</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
              POS vs Form Comparison
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Review date:</label>
            <span className="text-xs font-medium text-slate-900">{convertFromInputDate(date)}</span>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border rounded px-2 sm:px-3 py-2 text-xs min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
            data-testid="input-review-date"
          />
          <button 
            onClick={loadData} 
            disabled={loading} 
            className="px-3 sm:px-4 py-2 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] active:scale-95 transition-transform"
            data-testid="button-load-review"
          >
            {loading ? "Loading…" : "Load Review"}
          </button>
        </div>
      </div>

      {/* Content Sections */}
      <div className="p-2 sm:p-4 space-y-6">
        {/* Sales Section */}
        <section className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Sales (Form vs POS)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Payment Type</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">POS</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Form</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Variance</th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">Cash</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.sales.cash)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.sales.cash)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.sales.cash) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.sales.cash === 0 ? "—" : `฿${fmt(v.sales.cash)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.sales.cash} />
                  </td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">QR</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.sales.qr)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.sales.qr)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.sales.qr) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.sales.qr === 0 ? "—" : `฿${fmt(v.sales.qr)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.sales.qr} />
                  </td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">Grab</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.sales.grab)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.sales.grab)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.sales.grab) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.sales.grab === 0 ? "—" : `฿${fmt(v.sales.grab)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.sales.grab} />
                  </td>
                </tr>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                  <td className="px-4 py-2 text-slate-900">Total Sales</td>
                  <td className="px-4 py-2 text-right text-slate-900">฿{fmt(pos.sales.total)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">฿{fmt(form.sales.total)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">
                    {v.sales.total === 0 ? "—" : `฿${fmt(v.sales.total)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.sales.total} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Expenses Section */}
        <section className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Expenses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Expense Type</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">POS</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Form</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Variance</th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">Shopping</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.expenses.shoppingTotal)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.expenses.shoppingTotal)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.expenses.shoppingTotal) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.expenses.shoppingTotal === 0 ? "—" : `฿${fmt(v.expenses.shoppingTotal)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.expenses.shoppingTotal} />
                  </td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">Wages</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.expenses.wageTotal)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.expenses.wageTotal)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.expenses.wageTotal) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.expenses.wageTotal === 0 ? "—" : `฿${fmt(v.expenses.wageTotal)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.expenses.wageTotal} />
                  </td>
                </tr>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-semibold">
                  <td className="px-4 py-2 text-slate-900">Total Expenses</td>
                  <td className="px-4 py-2 text-right text-slate-900">฿{fmt(pos.expenses.shoppingTotal + pos.expenses.wageTotal)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">฿{fmt(form.expenses.shoppingTotal + form.expenses.wageTotal)}</td>
                  <td className="px-4 py-2 text-right text-slate-900">
                    {v.expenses.grandTotal === 0 ? "—" : `฿${fmt(v.expenses.grandTotal)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.expenses.grandTotal} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Banking Section */}
        <section className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Banking & Cash</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Item</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">POS</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Form</th>
                  <th className="px-4 py-2 text-right font-semibold text-slate-700">Variance</th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">Expected Cash</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.banking.expectedCash)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.banking.expectedCash)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.banking.expectedCash) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.banking.expectedCash === 0 ? "—" : `฿${fmt(v.banking.expectedCash)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.banking.expectedCash} />
                  </td>
                </tr>
                <tr className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-900">Estimated Net Banked</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(pos.banking.estimatedNetBanked)}</td>
                  <td className="px-4 py-2 text-right text-slate-700">฿{fmt(form.banking.estimatedNetBanked)}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${Math.abs(v.banking.estimatedNetBanked) > 0 ? "text-slate-900" : "text-slate-500"}`}>
                    {v.banking.estimatedNetBanked === 0 ? "—" : `฿${fmt(v.banking.estimatedNetBanked)}`}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Flag val={v.banking.estimatedNetBanked} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Manager Comments */}
        <section className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">Manager Comments</h2>
          </div>
          <div className="p-4">
            <textarea
              className="w-full border border-slate-300 rounded px-3 py-2 min-h-[120px] text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="Record findings, explanations, or actions taken..."
              value={comment}
              onChange={(e) => saveComment(e.target.value)}
              data-testid="textarea-manager-comments"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

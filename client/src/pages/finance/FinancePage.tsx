import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";

const thb = (amount: number | undefined) => `฿${(amount || 0).toLocaleString()}`;

interface PnlSummary {
  period: string;
  sales: number;
  expenses: number;
  profit: number;
  breakdown: {
    canonicalExpenses: number;
    shift: Array<{ type: string; category: string; amount: number }>;
  };
}

export default function FinancePage() {
  const [period, setPeriod] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).slice(0, 7));

  const { data: summary, isLoading, error } = useQuery<PnlSummary>({
    queryKey: ['pnl', period],
    queryFn: async () => {
      const res = await fetch(`/api/pnl/${period}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  if (isLoading) return <div className="p-6">Loading finance data…</div>;
  if (error || !summary) return <div className="p-6 text-red-600">Failed to load P&amp;L data.</div>;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-3 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">P&amp;L (Shift Approved)</h1>
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="border rounded px-2 py-1" />
      </div>

      <Card><CardContent><h2>Sales</h2><p>{thb(summary.sales)}</p></CardContent></Card>
      <Card><CardContent><h2>Expenses</h2><p>{thb(summary.expenses)}</p></CardContent></Card>
      <Card><CardContent><h2>Profit</h2><p>{thb(summary.profit)}</p></CardContent></Card>

      <Card className="col-span-3">
        <CardContent>
          <h2>Breakdown</h2>
          <p>Canonical Expenses: {thb(summary.breakdown.canonicalExpenses)}</p>
          <table className="w-full border-collapse border mt-3">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Type</th>
                <th className="border p-2 text-left">Category</th>
                <th className="border p-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {summary.breakdown.shift.map((row, index) => (
                <tr key={`${row.type}-${row.category}-${index}`}>
                  <td className="border p-2">{row.type}</td>
                  <td className="border p-2">{row.category}</td>
                  <td className="border p-2 text-right">{row.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

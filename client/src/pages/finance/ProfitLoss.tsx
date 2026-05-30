import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MonthData {
  sales: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
}

interface ProfitLossData {
  success: boolean;
  year: number;
  monthlyData: Record<string, MonthData>;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n: number) {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pct(part: number, total: number) {
  if (!total) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}

export default function ProfitLoss() {
  const { data, isLoading, isError } = useQuery<ProfitLossData>({
    queryKey: ["/api/profit-loss"],
  });

  const months = data
    ? MONTHS.filter((m) => data.monthlyData?.[m])
    : [];

  const totals = months.reduce(
    (acc, m) => {
      const d = data!.monthlyData[m];
      acc.sales += d.sales || 0;
      acc.cogs += d.cogs || 0;
      acc.expenses += d.expenses || 0;
      acc.grossProfit += d.grossProfit || 0;
      acc.netProfit += d.netProfit || 0;
      return acc;
    },
    { sales: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 }
  );

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Profit & Loss</h1>
        <p className="text-xs text-slate-500">{data?.year ?? "—"} — Monthly breakdown</p>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading P&L data...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load P&L data.</div>
      )}

      {!isLoading && !isError && months.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-xs">No P&L data available.</div>
      )}

      {months.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-3 py-2 font-medium text-slate-500">Month</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Sales (฿)</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">COGS (฿)</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Expenses (฿)</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Gross Profit</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Net Profit</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Margin</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month, idx) => {
                const d = data!.monthlyData[month];
                const isPositive = d.netProfit >= 0;
                return (
                  <tr
                    key={month}
                    className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">{month}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(d.sales)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{fmt(d.cogs)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-500">{fmt(d.expenses)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{fmt(d.grossProfit)}</td>
                    <td className={`px-3 py-2 text-right font-mono font-semibold flex items-center justify-end gap-1 ${isPositive ? "text-green-600" : "text-red-500"}`}>
                      {isPositive
                        ? <TrendingUp className="h-3 w-3" />
                        : <TrendingDown className="h-3 w-3" />}
                      {fmt(d.netProfit)}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-500">
                      {pct(d.netProfit, d.sales)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-semibold">
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">Total</td>
                <td className="px-3 py-2 text-right font-mono text-slate-800 dark:text-slate-200">{fmt(totals.sales)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(totals.cogs)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">{fmt(totals.expenses)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-800 dark:text-slate-200">{fmt(totals.grossProfit)}</td>
                <td className={`px-3 py-2 text-right font-mono ${totals.netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {fmt(totals.netProfit)}
                </td>
                <td className="px-3 py-2 text-right text-slate-500">{pct(totals.netProfit, totals.sales)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

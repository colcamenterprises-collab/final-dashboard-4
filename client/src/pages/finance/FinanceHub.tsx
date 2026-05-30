import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TrendingUp, Receipt, Upload, ArrowRight } from "lucide-react";

interface FinancialOverview {
  period: string;
  totalRevenue: number;
  totalExpenses: number;
  grossProfit: number;
  profitMargin: number;
  averageDaily?: number;
}

const sections = [
  {
    to: "/finance/profit-loss",
    label: "Profit & Loss",
    icon: TrendingUp,
    description: "Monthly P&L breakdown — sales, COGS, expenses, net profit",
  },
  {
    to: "/finance/expenses",
    label: "Expenses",
    icon: Receipt,
    description: "All expense records by date, category and supplier",
  },
  {
    to: "/finance/expenses-import",
    label: "Expenses Import",
    icon: Upload,
    description: "Upload and review imported expense statements",
  },
];

function fmt(n: number) {
  return n?.toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? "—";
}

export default function FinanceHub() {
  const { data } = useQuery<FinancialOverview>({
    queryKey: ["/api/reports/financial-overview"],
  });

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Finance</h1>
        <p className="text-xs text-slate-500">Financial overview and reporting</p>
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Revenue</p>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-1">฿{fmt(data.totalRevenue)}</p>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Expenses</p>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-1">฿{fmt(data.totalExpenses)}</p>
          </div>
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Gross Profit</p>
            <p className={`text-base font-semibold mt-1 ${data.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ฿{fmt(data.grossProfit)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sections.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
                <s.icon className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{s.description}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TrendingUp, Receipt, Upload, ArrowRight } from "lucide-react";

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
  dataSource?: {
    salesRecords?: number;
    loyverseRecords?: number;
    expenseRecords?: number;
  };
}

type Metric = {
  label: string;
  value: number | null;
  suffix?: string;
  missing?: string;
};

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
  return n.toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function moneyMetric(label: string, value: number | null, missing?: string): Metric {
  return { label, value, missing };
}

function renderMetric(metric: Metric) {
  const isMissing = metric.value === null || metric.value === undefined;
  const value = isMissing ? "Missing data" : `${metric.suffix === "%" ? "" : "฿"}${fmt(metric.value)}${metric.suffix ?? ""}`;

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide">{metric.label}</p>
      <p className={`text-base font-semibold text-slate-800 dark:text-slate-200 mt-1 ${isMissing ? "text-slate-400" : ""}`}>
        {value}
      </p>
      {isMissing && metric.missing && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{metric.missing}</p>
      )}
    </div>
  );
}

export default function FinanceHub() {
  const { data, isLoading, isError } = useQuery<ProfitLossData>({
    queryKey: ["/api/profit-loss"],
  });

  const months = data?.monthlyData ? Object.values(data.monthlyData) : [];
  const revenue = months.reduce((sum, month) => sum + Number(month.sales || 0), 0);
  const expenses = months.reduce((sum, month) => sum + Number(month.expenses || 0), 0);
  const hasRevenueSource = Boolean((data?.dataSource?.salesRecords || 0) > 0 || (data?.dataSource?.loyverseRecords || 0) > 0);
  const hasExpenseSource = Boolean((data?.dataSource?.expenseRecords || 0) > 0);
  const cogsMissing = "COGS source unavailable; hub will not use estimated COGS.";
  const metrics: Metric[] = [
    moneyMetric("Revenue", hasRevenueSource ? revenue : null, "No sales source records returned."),
    moneyMetric("COGS", null, cogsMissing),
    moneyMetric("Gross Profit", null, cogsMissing),
    moneyMetric("Expenses", hasExpenseSource ? expenses : null, "No expense source records returned."),
    moneyMetric("Net Profit", null, cogsMissing),
    { label: "Margin %", value: null, suffix: "%", missing: cogsMissing },
  ];

  return (
    <div className="p-4 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Finance</h1>
        <p className="text-xs text-slate-500">Financial overview and reporting</p>
      </div>

      {isLoading && <div className="text-xs text-slate-400">Loading finance metrics...</div>}
      {isError && <div className="text-xs text-red-500">Failed to load finance metrics.</div>}
      {!isLoading && !isError && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label}>{renderMetric(metric)}</div>
          ))}
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

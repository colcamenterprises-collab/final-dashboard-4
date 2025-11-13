import { useQuery } from "@tanstack/react-query";
import { MetricCard, SectionCard, ModernButton } from "@/components/ui";
import BalanceCard from "@/components/BalanceCard";
import { StockLodgmentModal } from "@/components/operations/StockLodgmentModal";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Activity,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  Globe,
  Package
} from "lucide-react";

// Balance Hero Component
function BalanceHero() {
  const [, setLocation] = useLocation();
  const { data: financeSummary } = useQuery({
    queryKey: ['/api/finance/summary/today'],
  });

  const currentMonthExpenses = (financeSummary as any)?.currentMonthExpenses || 0;
  const month = (financeSummary as any)?.month || '';

  return (
    <div className="relative overflow-hidden rounded bg-gradient-to-br from-emerald-500 to-teal-600 p-4 sm:p-6 md:p-8 text-white shadow-xl">
      {/* Background decoration */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/5" />
      
      <div className="relative">
        <p className="text-emerald-100 text-xs sm:text-sm font-medium mb-2">Monthly Expenses {month && `(${month})`}</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 md:mb-8">
          ฿{currentMonthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>
        
        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <StockLodgmentModal
            triggerClassName="bg-white/15 hover:bg-white/25 text-white border-white/20 w-full sm:w-auto text-xs"
            triggerText="Lodge Stock Purchase"
            triggerIcon={<Package className="h-4 w-4 mr-2" />}
            onSuccess={() => {}}
          />
          <ModernButton 
            onClick={() => setLocation('/finance/expenses')}
            className="bg-white/15 hover:bg-white/25 text-white border-white/20 w-full sm:w-auto text-xs"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Business Expense
          </ModernButton>
        </div>
      </div>
    </div>
  );
}

// KPI Grid Component
function KPIGrid() {
  const { data: financeSummary, isLoading } = useQuery({
    queryKey: ['/api/finance/summary/today'],
  });

  const mtdSales = (financeSummary as any)?.currentMonthSales || 0;
  const netProfit = (financeSummary as any)?.netProfit || 0;
  const totalExpenses = (financeSummary as any)?.currentMonthExpenses || 0;
  const shiftCount = (financeSummary as any)?.shiftCount || 0;

  const kpis = [
    {
      title: "MTD Sales",
      value: isLoading ? "—" : `฿${mtdSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: `${shiftCount} shifts`,
      icon: DollarSign,
      color: "emerald"
    },
    {
      title: "Net Profit",
      value: isLoading ? "—" : `฿${netProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: "This month",
      icon: TrendingUp,
      color: "emerald"
    },
    {
      title: "Total Expenses",
      value: isLoading ? "—" : `฿${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: "MTD spend",
      icon: ArrowDownLeft,
      color: "orange"
    },
    {
      title: "Avg Per Shift",
      value: isLoading || shiftCount === 0 ? "—" : `฿${(mtdSales / shiftCount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: `${shiftCount} shifts`,
      icon: Activity,
      color: "blue"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
      {kpis.map((kpi, index) => (
        <div key={index} className="bg-white rounded p-4 sm:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow min-w-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className={`p-2 rounded bg-${kpi.color}-50`}>
              <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 text-${kpi.color}-600`} />
            </div>
          </div>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 mb-1 break-words">{kpi.value}</p>
          <p className="text-xs sm:text-sm font-medium text-slate-900">{kpi.title}</p>
          <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

// Cash Balance Snapshot Component
function CashBalanceSnapshot() {
  const [posBalances, setPosBalances] = useState([]);
  const [formBalances, setFormBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/balance/pos").then(r => r.json()),
      fetch("/api/balance/forms").then(r => r.json())
    ]).then(([pos, forms]) => {
      setPosBalances(pos);
      setFormBalances(forms);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to fetch balance data:", err);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="w-full lg:w-1/3 bg-white rounded p-4 sm:p-6 shadow-sm border text-gray-500">Loading balances...</div>;

  return (
    <div className="w-full lg:w-1/3 bg-white rounded p-4 sm:p-6 shadow-sm border">
      <h2 className="text-xs sm:text-sm font-bold mb-4 text-gray-800">Shift Summary</h2>
      <div>
        {posBalances.length > 0 ? (
          posBalances.map((b: any, i) => <BalanceCard key={i} {...b} />)
        ) : (
          <div className="text-gray-500 text-xs sm:text-sm">No shift data available</div>
        )}
        <div className="mt-4 text-xs text-gray-500">
          Note: Green boxes indicate register difference within ฿50 (acceptable range). Red boxes indicate difference exceeding ฿50 (requires attention).
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  
  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 p-2 sm:p-0">
      {/* Balance Hero */}
      <BalanceHero />
      
      {/* KPI Grid */}
      <KPIGrid />
      
      {/* Cash Balance Snapshot */}
      <CashBalanceSnapshot />
    </div>
  );
}
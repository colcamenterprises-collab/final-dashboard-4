import { useQuery } from "@tanstack/react-query";
import { MetricCard, SectionCard, ModernButton } from "@/components/ui";
import BalanceCard from "@/components/BalanceCard";
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
  Globe
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
    <div className="relative overflow-hidden rounded bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white shadow-xl">
      {/* Background decoration */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/5" />
      
      <div className="relative">
        <p className="text-emerald-100 text-sm font-medium mb-2">Monthly Expenses {month && `(${month})`}</p>
        <h1 className="text-4xl font-bold mb-8">
          ฿{currentMonthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>
        
        {/* Quick Actions */}
        <div className="flex gap-3">
          <ModernButton 
            onClick={() => setLocation('/finance/expenses')}
            className="bg-white/15 hover:bg-white/25 text-white border-white/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Expense
          </ModernButton>
          <ModernButton 
            onClick={() => setLocation('/operations/daily-sales-v2/library')}
            className="bg-white/15 hover:bg-white/25 text-white border-white/20"
          >
            <FileText className="h-4 w-4 mr-2" />
            Daily Sales & Stock
          </ModernButton>
        </div>
      </div>
    </div>
  );
}

// KPI Grid Component
function KPIGrid() {
  const { data: financeSummary } = useQuery({
    queryKey: ['/api/finance/summary/today'],
  });

  const kpis = [
    {
      title: "Today's Orders",
      value: "24",
      change: "+15.3%",
      trend: "up",
      icon: ShoppingCart,
      color: "emerald"
    },
    {
      title: "Net Profit",
      value: "฿12,450",
      change: "+8.7%",
      trend: "up", 
      icon: DollarSign,
      color: "emerald"
    },
    {
      title: "Online Orders",
      value: "18",
      change: "+22.1%",
      trend: "up",
      icon: Globe,
      color: "blue"
    },
    {
      title: "Deliveries",
      value: "16",
      change: "+12.5%",
      trend: "up",
      icon: Activity,
      color: "orange"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <div key={index} className="bg-white rounded p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded bg-${kpi.color}-50`}>
              <kpi.icon className={`h-5 w-5 text-${kpi.color}-600`} />
            </div>
            <div className={`flex items-center text-sm ${kpi.trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
              {kpi.trend === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {kpi.change}
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 mb-1">{kpi.value}</p>
          <p className="text-sm text-slate-600">{kpi.title}</p>
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

  if (loading) return <div className="w-1/3 bg-white rounded p-6 shadow-sm border text-gray-500">Loading balances...</div>;

  return (
    <div className="w-1/3 bg-white rounded p-6 shadow-sm border">
      <h2 className="text-sm font-bold mb-4 text-gray-800">Shift Summary</h2>
      <div>
        {posBalances.length > 0 ? (
          posBalances.map((b: any, i) => <BalanceCard key={i} {...b} />)
        ) : (
          <div className="text-gray-500 text-sm">No shift data available</div>
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
    <div className="space-y-8">
      {/* Balance Hero */}
      <BalanceHero />
      
      {/* Online Ordering CTA Button */}
      <button
        onClick={() => window.open('/order', '_blank')}
        className="w-full bg-black text-white font-semibold py-4 px-6 rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2 shadow-lg"
        data-testid="button-online-ordering-cta"
      >
        <Globe className="h-5 w-5" />
        <span className="text-base">Online Ordering Platform</span>
        <ArrowUpRight className="h-4 w-4" />
      </button>
      
      {/* KPI Grid */}
      <KPIGrid />
      
      {/* Cash Balance Snapshot */}
      <CashBalanceSnapshot />
    </div>
  );
}
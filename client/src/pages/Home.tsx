import { useQuery } from "@tanstack/react-query";
import { MetricCard, SectionCard, ModernButton } from "@/components/ui";
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
  Send,
  Wallet
} from "lucide-react";

// Balance Hero Component
function BalanceHero() {
  const { data: financeSummary } = useQuery({
    queryKey: ['/api/finance/summary/today'],
  });

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white shadow-xl">
      {/* Background decoration */}
      <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/10" />
      <div className="absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/5" />
      
      <div className="relative">
        <p className="text-emerald-100 text-sm font-medium mb-2">Total Balance</p>
        <h1 className="text-4xl font-bold mb-8">
          ฿{(financeSummary as any)?.netProfit?.toLocaleString() || "0"}
        </h1>
        
        {/* Quick Actions */}
        <div className="flex gap-3">
          <ModernButton className="bg-white/15 hover:bg-white/25 text-white border-white/20">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </ModernButton>
          <ModernButton className="bg-white/15 hover:bg-white/25 text-white border-white/20">
            <Send className="h-4 w-4 mr-2" />
            Transfer
          </ModernButton>
          <ModernButton className="bg-white/15 hover:bg-white/25 text-white border-white/20">
            <Wallet className="h-4 w-4 mr-2" />
            Pay
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
      title: "Sales Today",
      value: `฿${(financeSummary as any)?.sales?.toLocaleString() || "0"}`,
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "emerald"
    },
    {
      title: "Orders",
      value: "127",
      change: "+8.2%",
      trend: "up", 
      icon: ShoppingCart,
      color: "blue"
    },
    {
      title: "Customers",
      value: "89",
      change: "-2.1%",
      trend: "down",
      icon: Users,
      color: "orange"
    },
    {
      title: "Profit Margin",
      value: "42.1%",
      change: "+1.8%",
      trend: "up",
      icon: Activity,
      color: "emerald"
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, index) => (
        <div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className={`p-2 rounded-xl bg-${kpi.color}-50`}>
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


export default function Home() {
  return (
    <div className="space-y-8">
      {/* Balance Hero */}
      <BalanceHero />
      
      {/* KPI Grid */}
      <KPIGrid />
    </div>
  );
}
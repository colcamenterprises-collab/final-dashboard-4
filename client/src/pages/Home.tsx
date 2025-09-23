import { useQuery } from "@tanstack/react-query";
import { MetricCard, SectionCard, ModernButton } from "@/components/ui";
import BalanceCard from "@/components/BalanceCard";
import { useEffect, useState } from "react";
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

  if (loading) return <div className="bg-white rounded-2xl p-6 shadow-sm border text-gray-500">Loading balances...</div>;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Shift Summary</h2>
      <div className="max-w-md">
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
  return (
    <div className="space-y-8">
      {/* Balance Hero */}
      <BalanceHero />
      
      {/* KPI Grid */}
      <KPIGrid />
      
      {/* Cash Balance Snapshot */}
      <CashBalanceSnapshot />
      
      {/* Additional content to test scrolling */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-xl font-bold mb-4">Recent Orders</h3>
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex justify-between items-center py-2 border-b">
                <span>Order #{1000 + i}</span>
                <span className="font-semibold">฿{(Math.random() * 500 + 100).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h3 className="text-xl font-bold mb-4">Top Items</h3>
          <div className="space-y-3">
            {['Burger Classic', 'Cheese Deluxe', 'BBQ Special', 'Chicken Wrap', 'Fries'].map(item => (
              <div key={item} className="flex justify-between items-center py-2 border-b">
                <span>{item}</span>
                <span className="text-emerald-600 font-semibold">{Math.floor(Math.random() * 50 + 10)} sold</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-2xl p-6 shadow-sm border">
        <h3 className="text-xl font-bold mb-4">Sales Chart</h3>
        <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
          <span className="text-slate-400">Chart would go here</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h4 className="font-bold mb-3">Quick Stats</h4>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Today's Revenue</span><span>฿2,450</span></div>
            <div className="flex justify-between"><span>Orders</span><span>45</span></div>
            <div className="flex justify-between"><span>Customers</span><span>38</span></div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h4 className="font-bold mb-3">Inventory</h4>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Burger Buns</span><span>120</span></div>
            <div className="flex justify-between"><span>Meat (kg)</span><span>15</span></div>
            <div className="flex justify-between"><span>Drinks</span><span>89</span></div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h4 className="font-bold mb-3">Staff</h4>
          <div className="space-y-2">
            <div className="flex justify-between"><span>On Duty</span><span>5</span></div>
            <div className="flex justify-between"><span>Break</span><span>1</span></div>
            <div className="flex justify-between"><span>Total</span><span>6</span></div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <h3 className="text-xl font-bold mb-2">End of Page Test</h3>
        <p>If you can see this section and scroll to it, then scrolling is working correctly!</p>
      </div>
    </div>
  );
}
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MetricCard, SectionCard, ModernButton } from "@/components/ui";
import BalanceCard from "@/components/BalanceCard";
import { StockLodgmentModal } from "@/components/operations/StockLodgmentModal";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { DoughnutChart } from "@/components/health";
import { Button } from "@/components/ui/button";
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
import axios from "axios";

// Balance Hero Component
function BalanceHero() {
  const queryClient = useQueryClient();
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
          <ExpenseLodgmentModal
            triggerClassName="bg-white/15 hover:bg-white/25 text-white border-white/20 w-full sm:w-auto text-xs"
            triggerText="Add Business Expense"
            triggerIcon={<Plus className="h-4 w-4 mr-2" />}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/finance/summary/today'] });
              queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
            }}
          />
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

// Prime Cost Component
type PCDaily = { sales:number; wages:number; fnb:number; primeCost:number; primePct:number|null; };
type PCMtd = { sales:number; wages:number; fnb:number; primeCost:number; primePct:number|null; };

function PrimeCostCards() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [daily, setDaily] = useState<PCDaily|null>(null);
  const [mtd, setMtd] = useState<PCMtd|null>(null);
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/metrics/prime-cost");
        const j = await r.json();
        if (!j.ok) { setErr(j.error||"failed"); setLoading(false); return; }
        setDate(j.date);
        setDaily(j.daily);
        setMtd(j.mtd);
      } catch(e:any) {
        setErr(e?.message||"failed");
      } finally { setLoading(false); }
    })();
  }, []);

  const pc = (v:number|null) => v==null ? "—" : `${v.toFixed(1)}%`;

  const color = (v:number|null) => {
    if (v==null) return "bg-slate-200 text-slate-700";
    if (v <= 55) return "bg-emerald-100 text-emerald-800";
    if (v <= 60) return "bg-amber-100 text-amber-800";
    return "bg-rose-100 text-rose-800";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div className="rounded-lg border p-4 bg-white shadow-sm">
        <div className="text-sm text-slate-600 font-semibold">Prime Cost — Latest Shift</div>
        <div className="text-xs text-slate-500 mb-2">Shift date: {date || "—"}</div>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : err ? (
          <div className="text-rose-600 text-sm">{err}</div>
        ) : (
          <>
            <div className={`inline-block px-3 py-1 rounded text-lg font-bold ${color(daily?.primePct ?? null)}`}>
              {pc(daily?.primePct ?? null)}
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Sales:</span>
                <span className="font-medium">฿{(daily?.sales||0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Wages:</span>
                <span className="font-medium">฿{(daily?.wages||0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Food & Beverage:</span>
                <span className="font-medium">฿{(daily?.fnb||0).toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg border p-4 bg-white shadow-sm">
        <div className="text-sm text-slate-600 font-semibold">Prime Cost — MTD</div>
        <div className="text-xs text-slate-500 mb-2">Month to date</div>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : err ? (
          <div className="text-rose-600 text-sm">{err}</div>
        ) : (
          <>
            <div className={`inline-block px-3 py-1 rounded text-lg font-bold ${color(mtd?.primePct ?? null)}`}>
              {pc(mtd?.primePct ?? null)}
            </div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Sales:</span>
                <span className="font-medium">฿{(mtd?.sales||0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Wages:</span>
                <span className="font-medium">฿{(mtd?.wages||0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Food & Beverage:</span>
                <span className="font-medium">฿{(mtd?.fnb||0).toLocaleString()}</span>
              </div>
            </div>
          </>
        )}
      </div>
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
      
      {/* Prime Cost Cards */}
      <PrimeCostCards />
      
      {/* System Health Section (CHUNK 5) */}
      <SystemHealthSection />
      
      {/* Cash Balance Snapshot */}
      <CashBalanceSnapshot />
    </div>
  );
}

// System Health Section Component (CHUNK 5)
function SystemHealthSection() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    try {
      const res = await axios.get("/api/system-health/run");
      setHealth(res.data);
    } catch (err) {
      console.error("Health test failed:", err);
    }
    setLoading(false);
  }

  useEffect(() => {
    runTest();
  }, []);

  const total = 8;
  const passed = health
    ? Object.values(health.results || {}).filter((v) => v === true).length
    : 0;

  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-[4px] shadow-sm">
      <div className="bg-yellow-300 px-4 py-3 rounded-t-[4px]">
        <h2 className="text-sm font-bold text-gray-900">
          System Health
        </h2>
      </div>

      <div className="p-4 flex flex-col md:flex-row gap-6">
        {/* DOUGHNUT GRAPH */}
        <div className="w-full md:w-1/3 flex items-center justify-center">
          <DoughnutChart results={health?.results} />
        </div>

        {/* SUMMARY */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-xl font-bold text-emerald-600">
            {passed} / {total} checks passed
          </p>
          <p className="text-xs text-slate-600 mt-1">
            {passRate}% operational
          </p>
          
          {health?.timestamp && (
            <p className="text-xs text-slate-500 mt-3">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          )}

          {health?.durationMs && (
            <p className="text-xs text-slate-500">
              Duration: {health.durationMs}ms
            </p>
          )}

          <Button
            className="mt-4 bg-black text-white hover:bg-gray-800 text-xs font-medium rounded-[4px] w-fit"
            onClick={runTest}
            disabled={loading}
            data-testid="button-run-health-test"
          >
            {loading ? "Running..." : "Run Health Test"}
          </Button>
        </div>
      </div>

      {/* ERROR DISPLAY */}
      {health?.results?.errors && health.results.errors.length > 0 && (
        <div className="border-t border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-red-600 mb-2">Errors</h3>
          <ul className="space-y-1">
            {health.results.errors.map((err: string, i: number) => (
              <li key={i} className="text-xs text-red-600">
                • {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
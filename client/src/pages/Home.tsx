import { useQuery, useQueryClient } from "@tanstack/react-query";
import BalanceCard from "@/components/BalanceCard";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import { StockLodgmentModal } from "@/components/operations/StockLodgmentModal";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { VarianceWidget } from "@/components/widgets/VarianceWidget";
import { TrendingUp, DollarSign, Activity, Plus, ArrowDownLeft, FileText, AlertTriangle } from "lucide-react";
import axios from "axios";

function ShiftAlertBanner() {
  const { data: report } = useQuery({
    queryKey: ["shift-report-latest-dashboard"],
    queryFn: async () => {
      const res = await axios.get("/api/shift-report/latest");
      return res.data;
    },
  });

  if (!report) return null;

  const v = (report.variances as any) || {};
  if (v.level === "GREEN") return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4" data-testid="shift-alert-banner">
      <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">Issues detected in the last shift — Review now.</p>
        <Link to={`/reports/shift-report/view/${report.id}`} className="text-orange-600 underline text-xs font-semibold">
          Open Shift Report
        </Link>
      </div>
    </div>
  );
}

function BalanceHero() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: financeSummary } = useQuery({ queryKey: ["/api/finance/summary/today"] });

  const currentMonthExpenses = (financeSummary as any)?.currentMonthExpenses || 0;
  const month = (financeSummary as any)?.month || "";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 sm:p-6 md:p-8 text-white shadow-sm">
      <div>
        <p className="text-slate-200 text-xs sm:text-sm font-semibold mb-2">Monthly Expenses {month && `(${month})`}</p>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 md:mb-8">
          ฿{currentMonthExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </h1>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/operations/daily-reports")}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 w-full sm:w-auto text-xs font-semibold py-2 px-3 rounded transition-colors flex items-center justify-center gap-2"
            data-testid="button-view-latest-report"
          >
            <FileText className="h-4 w-4" />
            View Latest Report
          </button>
          <ExpenseLodgmentModal
            triggerClassName="bg-orange-500 hover:bg-orange-600 text-white border-orange-500 w-full sm:w-auto text-xs font-semibold"
            triggerText="Add Business Expense"
            triggerIcon={<Plus className="h-4 w-4 mr-2" />}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/finance/summary/today"] });
              queryClient.invalidateQueries({ queryKey: ["expenseTotals"] });
            }}
          />
        </div>
      </div>
    </div>
  );
}

function KPIGrid() {
  const { data: financeSummary, isLoading } = useQuery({ queryKey: ["/api/finance/summary/today"] });

  const mtdSales = Number((financeSummary as any)?.currentMonthSales ?? 0);
  const netProfit = Number((financeSummary as any)?.netProfit ?? 0);
  const totalExpenses = Number((financeSummary as any)?.currentMonthExpenses ?? 0);
  const shiftCount = Number((financeSummary as any)?.shiftCount ?? 0);
  const shiftCoverage = (financeSummary as any)?.shiftCoverage;
  const expectedCompletedShifts = Number(shiftCoverage?.expectedCompletedShifts ?? shiftCount);
  const missingShiftReports = Number(shiftCoverage?.missingShiftReports ?? 0);
  const avgPerShift = shiftCount > 0 ? mtdSales / shiftCount : 0;

  const kpis = [
    {
      title: "MTD Sales",
      value: isLoading ? "—" : `฿${mtdSales.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: missingShiftReports > 0 ? `${shiftCount} / ${expectedCompletedShifts} shifts synced` : `${shiftCount} shifts`,
      icon: DollarSign,
    },
    {
      title: "Net Profit",
      value: isLoading ? "—" : `฿${netProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: "This month",
      icon: TrendingUp,
    },
    {
      title: "Total Expenses",
      value: isLoading ? "—" : `฿${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: "MTD spend",
      icon: ArrowDownLeft,
    },
    {
      title: "Avg Per Shift",
      value: isLoading ? "—" : `฿${avgPerShift.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      subtitle: missingShiftReports > 0 ? `${shiftCount} / ${expectedCompletedShifts} shifts synced` : `${shiftCount} shifts`,
      icon: Activity,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
      {kpis.map((kpi, index) => (
        <div key={index} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200 min-w-0">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="p-2 rounded bg-slate-100">
              <kpi.icon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-900" />
            </div>
          </div>
          <p className="text-base sm:text-xl md:text-2xl font-bold text-slate-900 mb-1 break-words">{kpi.value}</p>
          <p className="text-xs sm:text-sm font-semibold text-slate-900">{kpi.title}</p>
          <p className="text-xs text-slate-500 mt-1">{kpi.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

function StockLodgementQuickActions() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="homepage-stock-lodgement-actions">
      <h2 className="text-sm font-semibold text-slate-900 mb-3">Stock Lodgement</h2>
      <p className="text-xs text-slate-500 mb-4">Open the Finance &gt; Expenses stock modal to record rolls, meat, and drinks.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StockLodgmentModal triggerText="Lodge Rolls" triggerClassName="w-full" initialData={{ type: "rolls" }} />
        <StockLodgmentModal triggerText="Lodge Meat" triggerClassName="w-full" initialData={{ type: "meat" }} />
        <StockLodgmentModal triggerText="Lodge Drinks" triggerClassName="w-full" initialData={{ type: "drinks" }} />
      </div>
    </div>
  );
}

type PCDaily = { sales: number; wages: number; fnb: number; primeCost: number; primePct: number | null };
type PCMtd = { sales: number; wages: number; fnb: number; primeCost: number; primePct: number | null };

function PrimeCostCards() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [daily, setDaily] = useState<PCDaily | null>(null);
  const [mtd, setMtd] = useState<PCMtd | null>(null);
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/metrics/prime-cost");
        const j = await r.json();
        if (!j.ok) {
          setErr(j.error || "failed");
          setLoading(false);
          return;
        }
        setDate(j.date);
        setDaily(j.daily);
        setMtd(j.mtd);
      } catch (e: any) {
        setErr(e?.message || "failed");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pc = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

  const color = (v: number | null) => {
    if (v == null) return "bg-slate-200 text-slate-700";
    if (v <= 55) return "bg-emerald-100 text-emerald-800";
    if (v <= 60) return "bg-amber-100 text-amber-800";
    return "bg-rose-100 text-rose-800";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm">
        <div className="text-sm text-slate-900 font-semibold">Prime Cost — Latest Shift</div>
        <div className="text-xs text-slate-500 mb-2">Shift date: {date || "—"}</div>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : err ? (
          <div className="text-rose-600 text-sm">{err}</div>
        ) : (
          <>
            <div className={`inline-block px-3 py-1 rounded text-lg font-bold ${color(daily?.primePct ?? null)}`}>{pc(daily?.primePct ?? null)}</div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between"><span>Sales:</span><span className="font-medium">฿{(daily?.sales || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Wages:</span><span className="font-medium">฿{(daily?.wages || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Food & Beverage:</span><span className="font-medium">฿{(daily?.fnb || 0).toLocaleString()}</span></div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm">
        <div className="text-sm text-slate-900 font-semibold">Prime Cost — MTD</div>
        <div className="text-xs text-slate-500 mb-2">Month to date</div>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : err ? (
          <div className="text-rose-600 text-sm">{err}</div>
        ) : (
          <>
            <div className={`inline-block px-3 py-1 rounded text-lg font-bold ${color(mtd?.primePct ?? null)}`}>{pc(mtd?.primePct ?? null)}</div>
            <div className="mt-3 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between"><span>Sales:</span><span className="font-medium">฿{(mtd?.sales || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Wages:</span><span className="font-medium">฿{(mtd?.wages || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Food & Beverage:</span><span className="font-medium">฿{(mtd?.fnb || 0).toLocaleString()}</span></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CashBalanceSnapshot() {
  const [posBalances, setPosBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refreshSnapshots = async () => {
      try {
        const [posRes, formsRes] = await Promise.all([fetch("/api/balance/pos"), fetch("/api/balance/forms")]);
        const pos = posRes.ok ? await posRes.json() : [];
        if (formsRes.ok) {
          await formsRes.json();
        }
        setPosBalances(Array.isArray(pos) ? pos : []);
      } catch (err) {
        console.error("Failed to refresh balance snapshots:", err);
        setPosBalances([]);
      } finally {
        setLoading(false);
      }
    };

    refreshSnapshots();
  }, []);

  if (loading) return <div className="w-full lg:w-1/3 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200 text-slate-500">Loading balances...</div>;

  return (
    <div className="w-full lg:w-1/3 bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-slate-200">
      <h2 className="text-xs sm:text-sm font-bold mb-4 text-slate-900">Shift Summary</h2>
      <div>
        {posBalances.length > 0 ? (
          posBalances.map((b: any, i) => <BalanceCard key={i} {...b} />)
        ) : (
          <div className="text-slate-500 text-xs sm:text-sm">No shift data available</div>
        )}
        <div className="mt-4 text-xs text-slate-500">
          Note: Green boxes indicate register difference within ฿50 (acceptable range). Red boxes indicate difference exceeding ฿50 (requires attention).
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="space-y-6 md:space-y-8 p-2 sm:p-0 pb-24 md:pb-8 bg-slate-50">
      <ShiftAlertBanner />
      <BalanceHero />
      <KPIGrid />
      <StockLodgementQuickActions />
      <PrimeCostCards />
      <VarianceWidget />
      <CashBalanceSnapshot />
    </div>
  );
}

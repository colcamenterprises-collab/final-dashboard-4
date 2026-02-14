import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MetricCard, SectionCard, ModernButton } from "@/components/ui";
import BalanceCard from "@/components/BalanceCard";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DoughnutChart } from "@/components/health";
import { VarianceWidget } from "@/components/widgets/VarianceWidget";
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
  Package,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import axios from "axios";
import { resolveShiftDate } from "@/utils/resolveShiftDate";

// PATCH 7 — SHIFT ALERT BANNER
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
    <div
      className="mb-4 flex items-center gap-3 rounded-lg border-l-4 border-orange-500 bg-orange-50 p-4"
      data-testid="shift-alert-banner"
    >
      <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-900">
          Issues detected in the last shift — Review now.
        </p>
        <Link
          to={`/reports/shift-report/view/${report.id}`}
          className="text-orange-600 underline text-xs font-semibold"
        >
          Open Shift Report
        </Link>
      </div>
    </div>
  );
}

// PATCH 7 — EXPENSES V2 TILE
function ExpensesV2Tile() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/expenses-v2/summary"],
    queryFn: async () => {
      const res = await axios.get("/api/expenses-v2/summary");
      return res.data;
    },
  });

  const navigate = useNavigate();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="expenses-v2-tile">
      <h2 className="text-sm font-semibold text-slate-900 mb-2">Monthly Expenses (V2)</h2>
      <div className="text-lg font-bold text-slate-900">
        {isLoading ? "—" : `${(data?.monthlyTotal || 0).toLocaleString()} THB`}
      </div>
      <button
        onClick={() => navigate("/finance/expenses-v2")}
        className="mt-3 text-xs font-semibold text-slate-900 underline"
        data-testid="link-view-expenses-v2"
      >
        View Expenses
      </button>
    </div>
  );
}

// PATCH 7 — SHIFT HEALTH TILE
function ShiftHealthTile() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["shift-report-latest-dashboard"],
    queryFn: async () => {
      const res = await axios.get("/api/shift-report/latest");
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Shift Health</h2>
        <div className="text-slate-500 text-xs">Loading...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 mb-2">Shift Health</h2>
        <div className="text-slate-500 text-xs">No shift report available.</div>
      </div>
    );
  }

  const v = (report.variances as any) || {};

  const severityColor =
    v.level === "RED" ? "text-orange-700"
    : v.level === "YELLOW" ? "text-orange-700"
    : "text-slate-900";

  const severityBg =
    v.level === "RED" ? "bg-orange-50"
    : v.level === "YELLOW" ? "bg-orange-50"
    : "bg-white";

  return (
    <div className={`rounded-xl border border-slate-200 p-4 shadow-sm ${severityBg}`} data-testid="shift-health-tile">
      <h2 className="text-sm font-semibold text-slate-900 mb-2">Shift Health</h2>

      <div className={`text-lg font-bold ${severityColor}`}>
        {v.level || "UNKNOWN"}
      </div>

      <div className="mt-2 text-xs text-slate-700 space-y-1">
        <div>Cash: {v.cashVariance ?? "N/A"}</div>
        <div>QR: {v.qrVariance ?? "N/A"}</div>
        <div>Grab: {v.grabVariance ?? "N/A"}</div>
      </div>

      <Link
        to={`/reports/shift-report/view/${report.id}`}
        className="inline-block mt-3 px-3 py-1.5 bg-slate-900 text-white rounded text-xs font-semibold"
        data-testid="button-view-shift-report"
      >
        View Report
      </Link>
    </div>
  );
}

// Balance Hero Component
function BalanceHero() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: financeSummary } = useQuery({
    queryKey: ["/api/finance/summary/today"],
  });

  const currentMonthExpenses = (financeSummary as any)?.currentMonthExpenses || 0;
  const month = (financeSummary as any)?.month || "";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 sm:p-6 md:p-8 text-white shadow-sm">
      <div>
        <p className="text-slate-200 text-xs sm:text-sm font-semibold mb-2">
          Monthly Expenses {month && `(${month})`}
        </p>
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

// KPI Grid Component
function KPIGrid() {
  const { data: financeSummary, isLoading } = useQuery({
    queryKey: ["/api/finance/summary/today"],
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

      <div className="rounded-xl border border-slate-200 p-4 bg-white shadow-sm">
        <div className="text-sm text-slate-900 font-semibold">Prime Cost — MTD</div>
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

// System Health Section Component
interface HealthCheck {
  name: string;
  ok: boolean;
  error?: string;
}

function SystemHealthSection() {
  const [health, setHealth] = useState<{
    ok: boolean;
    checksPassed: number;
    totalChecks: number;
    checks: HealthCheck[];
    durationMs?: number;
    timestamp?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  async function runTest() {
    try {
      const res = await axios.get("/api/system-health/run");
      setHealth(res.data);
    } catch (err) {
      console.error("Health test failed:", err);
    }
  }

  useEffect(() => {
    runTest();
  }, []);

  const checksPassed = health?.checksPassed ?? 0;
  const totalChecks = health?.totalChecks ?? 0;
  const passRate = totalChecks > 0 ? Math.round((checksPassed / totalChecks) * 100) : 0;

  const getOverallStatus = () => {
    if (passRate >= 80) return { color: "emerald", icon: CheckCircle, label: "Healthy" };
    if (passRate >= 50) return { color: "amber", icon: AlertCircle, label: "Warning" };
    return { color: "red", icon: XCircle, label: "Critical" };
  };

  const status = getOverallStatus();

  const categories = [
    { label: "DB", name: "Database" },
    { label: "APIs", name: "API" },
    { label: "Email", name: "Email" },
    { label: "PDF", name: "PDF" },
    { label: "Ingredients", name: "Ingredients" }
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h2 className="text-xl font-extrabold text-slate-900 mb-6">System Health</h2>

      {/* Overall Health Donut */}
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-6">
        <div className="flex-shrink-0 w-48 h-48">
          <DoughnutChart
            checks={health?.checks}
            checksPassed={checksPassed}
            totalChecks={totalChecks}
          />
        </div>

        <div className="flex-1 min-w-0 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
            <status.icon className={`h-5 w-5 text-${status.color}-600`} />
            <span className={`text-lg font-bold text-${status.color}-600`}>
              {status.label}
            </span>
          </div>

          <p className="text-sm text-slate-700 font-medium">
            {checksPassed} / {totalChecks} checks passed
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {passRate}% operational
          </p>

          {health?.timestamp && (
            <p className="text-xs text-slate-400 mt-3">
              Last checked: {new Date(health.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Mini Donut Graphs for Categories */}
      {health?.checks && health.checks.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-600 mb-4">Component Status</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            {categories.map((cat) => {
              const check = health.checks.find(c => c.name.includes(cat.name));
              return check ? (
                <div key={cat.label} className="flex flex-col items-center gap-2">
                  <div className="relative w-20 h-20">
                    <DoughnutChart
                      mini
                      check={check}
                      size="sm"
                    />
                  </div>
                  <p className="text-xs font-medium text-slate-700 text-center">{cat.label}</p>
                  <p className={`text-[10px] ${check.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {check.ok ? "✓ OK" : "✗ Error"}
                  </p>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* Individual Checks List */}
      {health?.checks && health.checks.length > 0 && (
        <div className="border-t border-slate-100 pt-6">
          <p className="text-xs font-semibold text-slate-600 mb-3">All Checks</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {health.checks.map((check, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded ${
                  check.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}
              >
                {check.ok ? (
                  <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                )}
                <span className="truncate">{check.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}



type StockLedgerSummary = {
  start: number;
  purchased: number;
  used: number;
  actualEnd: number;
  variance: number;
  status: string;
};

function toStockSummary(row: any, kind: 'rolls' | 'meat' | 'drinks'): StockLedgerSummary | null {
  if (!row) return null;

  if (kind === 'rolls') {
    return {
      start: Number(row.rolls_start ?? 0),
      purchased: Number(row.rolls_purchased ?? 0),
      used: Number(row.rolls_used ?? 0),
      actualEnd: Number(row.actual_rolls_end ?? 0),
      variance: Number(row.variance ?? 0),
      status: String(row.status ?? 'PENDING'),
    };
  }

  if (kind === 'meat') {
    return {
      start: Number(row.meat_start_g ?? 0),
      purchased: Number(row.meat_purchased_g ?? 0),
      used: Number(row.meat_used_g ?? 0),
      actualEnd: Number(row.actual_meat_end_g ?? 0),
      variance: Number(row.variance_g ?? 0),
      status: String(row.status ?? 'PENDING'),
    };
  }

  return {
    start: Number(row.drinks_start ?? 0),
    purchased: Number(row.drinks_purchased ?? 0),
    used: Number(row.drinks_sold ?? 0),
    actualEnd: Number(row.actual_drinks_end ?? 0),
    variance: Number(row.variance ?? 0),
    status: String(row.status ?? 'PENDING'),
  };
}

function varianceStatusClass(status: string): string {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'OK') return 'text-emerald-700';
  if (normalized === 'WARNING' || normalized === 'ALERT') return 'text-red-700';
  return 'text-slate-700';
}

function StockSummaryTable({ summary }: { summary: StockLedgerSummary | null }) {
  if (!summary) {
    return <div className="text-xs text-slate-500 mt-2">No ledger snapshot yet.</div>;
  }

  return (
    <div className="mt-2 rounded border border-slate-200 p-3 text-xs text-slate-700">
      <div className="grid grid-cols-2 gap-y-1">
        <div>Start</div><div className="text-right">{summary.start}</div>
        <div>Purchased</div><div className="text-right">{summary.purchased}</div>
        <div>Used</div><div className="text-right">{summary.used}</div>
        <div>Actual End</div><div className="text-right">{summary.actualEnd}</div>
        <div>Variance</div><div className="text-right">{summary.variance}</div>
        <div>Status</div><div className={`text-right font-semibold ${varianceStatusClass(summary.status)}`}>{summary.status}</div>
      </div>
    </div>
  );
}

function StockLodgementPanels() {
  const shiftDate = resolveShiftDate();
  const [rollsStaffName, setRollsStaffName] = useState('');
  const [rollsPurchased, setRollsPurchased] = useState('');
  const [meatStaffName, setMeatStaffName] = useState('');
  const [kilosPurchased, setKilosPurchased] = useState('');
  const [drinksStaffName, setDrinksStaffName] = useState('');
  const [drinkQuantities, setDrinkQuantities] = useState<Record<string, string>>({});
  const [rollsSummary, setRollsSummary] = useState<StockLedgerSummary | null>(null);
  const [meatSummary, setMeatSummary] = useState<StockLedgerSummary | null>(null);
  const [drinksSummary, setDrinksSummary] = useState<StockLedgerSummary | null>(null);
  const [rollsMessage, setRollsMessage] = useState('');
  const [meatMessage, setMeatMessage] = useState('');
  const [drinksMessage, setDrinksMessage] = useState('');
  const [snapshotError, setSnapshotError] = useState<string>('');

  const { data: drinksSkus } = useQuery({
    queryKey: ['purchasing-drinks-skus'],
    queryFn: async () => {
      const res = await axios.get('/api/purchasing', { params: { category: 'Drinks' } });
      return (res.data?.items || []).map((item: any) => item.sku).filter((sku: string) => Boolean(sku));
    },
  });

  const snapshotRequest = async (label: string, endpoint: string, params: Record<string, string>) => {
    console.info('[refreshSnapshots] request', { method: 'GET', endpoint, params });
    try {
      const response = await axios.get(endpoint, { params });
      return response;
    } catch (error: any) {
      console.error('[refreshSnapshots] request_failed', {
        method: 'GET',
        endpoint,
        params,
        status: error?.response?.status,
        responseBody: error?.response?.data,
      });
      throw Object.assign(error ?? new Error('snapshot request failed'), { snapshotLabel: label });
    }
  };

  const refreshSnapshots = async () => {
    setSnapshotError('');
    const results = await Promise.allSettled([
      snapshotRequest('rolls', '/api/analysis/rolls-ledger', { shiftDate }),
      snapshotRequest('meat', '/api/analysis/meat-ledger', { shiftDate }),
      snapshotRequest('drinks', '/api/analysis/drinks-ledger', { shiftDate }),
    ]);

    const [rollsRes, meatRes, drinksRes] = results;

    if (rollsRes.status === 'fulfilled') {
      setRollsSummary(toStockSummary(rollsRes.value.data?.row, 'rolls'));
    } else {
      setRollsSummary(null);
    }

    if (meatRes.status === 'fulfilled') {
      setMeatSummary(toStockSummary(meatRes.value.data?.row, 'meat'));
    } else {
      setMeatSummary(null);
    }

    if (drinksRes.status === 'fulfilled') {
      setDrinksSummary(toStockSummary(drinksRes.value.data?.row, 'drinks'));
    } else {
      setDrinksSummary(null);
    }

    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
      setSnapshotError('Snapshot unavailable. Some stock summaries could not be loaded.');
    }
  };

  useEffect(() => { void refreshSnapshots(); }, []);

  const submitRolls = async () => {
    setRollsMessage('');
    await axios.post('/api/stock/lodge/rolls', {
      shiftDate,
      staffName: rollsStaffName,
      rollsPurchased: Number(rollsPurchased),
    });
    await refreshSnapshots();
    setRollsMessage('Rolls lodgement saved.');
    setRollsPurchased('');
  };

  const submitMeat = async () => {
    setMeatMessage('');
    await axios.post('/api/stock/lodge/meat', {
      shiftDate,
      staffName: meatStaffName,
      kilosPurchased: Number(kilosPurchased),
    });
    await refreshSnapshots();
    setMeatMessage('Meat lodgement saved.');
    setKilosPurchased('');
  };

  const submitDrinks = async () => {
    setDrinksMessage('');
    const items = Object.entries(drinkQuantities)
      .map(([sku, quantity]) => ({ sku, quantity: Number(quantity) }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    await axios.post('/api/stock/lodge/drinks', {
      shiftDate,
      staffName: drinksStaffName,
      items,
    });

    await refreshSnapshots();
    setDrinksMessage('Drinks lodgement saved.');
    setDrinkQuantities({});
  };

  return (
    <div className="space-y-4">
      {snapshotError && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {snapshotError}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Rolls Lodgement</h2>
        <div className="mt-3 space-y-2">
          <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Staff Name" value={rollsStaffName} onChange={(e) => setRollsStaffName(e.target.value)} />
          <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" min="0" placeholder="Rolls Purchased" value={rollsPurchased} onChange={(e) => setRollsPurchased(e.target.value)} />
          <Button onClick={submitRolls} className="w-full" disabled={!rollsStaffName.trim() || !Number(rollsPurchased)}>Submit Rolls</Button>
          {rollsMessage && <div className="text-xs text-emerald-700">{rollsMessage}</div>}
        </div>
        <StockSummaryTable summary={rollsSummary} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Meat Lodgement</h2>
        <div className="mt-3 space-y-2">
          <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Staff Name" value={meatStaffName} onChange={(e) => setMeatStaffName(e.target.value)} />
          <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" type="number" min="0" step="0.01" placeholder="Kilos Purchased" value={kilosPurchased} onChange={(e) => setKilosPurchased(e.target.value)} />
          <Button onClick={submitMeat} className="w-full" disabled={!meatStaffName.trim() || !Number(kilosPurchased)}>Submit Meat</Button>
          {meatMessage && <div className="text-xs text-emerald-700">{meatMessage}</div>}
        </div>
        <StockSummaryTable summary={meatSummary} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Drinks Lodgement</h2>
        <div className="mt-3 space-y-2">
          <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Staff Name" value={drinksStaffName} onChange={(e) => setDrinksStaffName(e.target.value)} />
          <div className="rounded border border-slate-200">
            <div className="grid grid-cols-2 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              <div>Drink SKU</div>
              <div className="text-right">Quantity</div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {(drinksSkus || []).map((sku: string) => (
                <div key={sku} className="grid grid-cols-2 items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm">
                  <div className="truncate">{sku}</div>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1 text-right"
                    type="number"
                    min="0"
                    value={drinkQuantities[sku] || ''}
                    onChange={(e) => setDrinkQuantities((prev) => ({ ...prev, [sku]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <Button
            onClick={submitDrinks}
            className="w-full"
            disabled={!drinksStaffName.trim() || !Object.values(drinkQuantities).some((v) => Number(v) > 0)}
          >
            Submit Drinks
          </Button>
          {drinksMessage && <div className="text-xs text-emerald-700">{drinksMessage}</div>}
        </div>
        <StockSummaryTable summary={drinksSummary} />
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

      <PrimeCostCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ShiftHealthTile />
        <ExpensesV2Tile />
        <VarianceWidget />
      </div>

      <StockLodgementPanels />

      <SystemHealthSection />

      <CashBalanceSnapshot />
    </div>
  );
}

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { AlertTriangle, Search, XCircle } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

// ── types ─────────────────────────────────────────────────────────────────────
interface Summary { grossSales: number; receiptCount: number; averageReceiptValue: number; lineItemCount: number; modifierCount: number; burgersSold: number; friesSold: number; drinksSold: number; chickenSold: number; }
interface Product { name: string; sku: string; category: string; qtySold: number; revenue: number; pctOfTotal: number; }
interface Modifier { name: string; qtySold: number; pctOfTotal: number; }
interface CategoryRow { category: string; qtySold: number; revenue: number; }
interface TrendRow { bizDate: string; grossSales: number; receiptCount: number; burgers: number; fries: number; drinks: number; }
interface HourRow { hour: number; label: string; receiptCount: number; grossSales: number; }
interface StockRow { item: string; qty: number; unit: string; detail: string; }
interface AnalyticsResponse { ok: boolean; summary: Summary; topProducts: Product[]; topModifiers: Modifier[]; categoryMix: CategoryRow[]; dailyTrend: TrendRow[]; hourlySales: HourRow[]; stockUsage: StockRow[]; filters: { from: string; to: string }; blockers?: { code: string; message: string }[]; }

// ── helpers ───────────────────────────────────────────────────────────────────
const m = (n: number) => `฿${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtDate = (d: string) => { if (!d) return ""; const [y, mo, day] = d.split("-"); return `${day}/${mo}/${y}`; };
const fmtShort = (d: string) => { if (!d) return ""; const dt = new Date(`${d}T00:00:00Z`); return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }); };

const CAT_COLORS: Record<string, string> = { Burgers: "#f59e0b", Fries: "#f97316", Drinks: "#3b82f6", Chicken: "#ef4444", Sides: "#10b981", Other: "#8b5cf6" };
const CAT_ORDER = ["Burgers", "Fries", "Drinks", "Chicken", "Sides", "Other"];

// ── preset helpers ────────────────────────────────────────────────────────────
type Preset = "7d" | "14d" | "30d" | "custom";
function getBkkToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
}
function presetDates(p: Preset): { from?: string; to?: string } {
  if (p === "7d" || p === "14d" || p === "30d") return {};
  return {};
}
function presetLabel(p: Preset) {
  return p === "7d" ? "Last 7 shifts" : p === "14d" ? "Last 14 shifts" : p === "30d" ? "Last 30 shifts" : "Custom";
}

// ── sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CategoryBar({ rows }: { rows: CategoryRow[] }) {
  const total = rows.reduce((s, r) => s + r.qtySold, 0) || 1;
  const sorted = [...rows].sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category));
  return (
    <div className="space-y-2">
      {sorted.map((r) => (
        <div key={r.category} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-semibold text-slate-700">{r.category}</span>
            <span className="text-slate-500">{r.qtySold} items · {m(r.revenue)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(r.qtySold / total) * 100}%`, background: CAT_COLORS[r.category] ?? "#64748b" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function ReceiptAnalytics() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");

  // Build query params
  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (preset === "7d") { /* default — API handles */ }
    else if (preset === "14d") { p.set("limit", "14"); }
    else if (preset === "30d") { p.set("limit", "30"); }
    else if (preset === "custom" && customFrom && customTo) {
      p.set("from", customFrom); p.set("to", customTo);
    }
    if (search) p.set("search", search);
    if (catFilter) p.set("category", catFilter);
    return p.toString();
  }, [preset, customFrom, customTo, search, catFilter]);

  const queryKey = useMemo(() => ["/api/reports/receipt-analytics", params], [params]);
  const { data, isLoading, isError } = useQuery<AnalyticsResponse>({
    queryKey,
    queryFn: async () => {
      const url = `/api/reports/receipt-analytics${params ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 30_000,
  });

  const blockers = data?.blockers ?? [];
  const ok = data?.ok ?? false;
  const sum = data?.summary;
  const products = data?.topProducts ?? [];
  const modifiers = data?.topModifiers ?? [];
  const trend = data?.dailyTrend ?? [];
  const hourly = data?.hourlySales ?? [];
  const catMix = data?.categoryMix ?? [];
  const stock = data?.stockUsage ?? [];
  const dateRange = data?.filters ? `${fmtDate(data.filters.from)} – ${fmtDate(data.filters.to)}` : "";

  const filteredProducts = useMemo(() =>
    catFilter ? products.filter(p => p.category === catFilter) : products,
    [products, catFilter]);

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <PageTitle title="Receipt Analytics" meta="POS receipt item analysis · 18:00–03:00 Bangkok shifts" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(["7d", "14d", "30d"] as Preset[]).map((p) => (
          <button key={p} onClick={() => setPreset(p)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${preset === p ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
            {presetLabel(p)}
          </button>
        ))}
        <button onClick={() => setPreset("custom")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${preset === "custom" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>
          Custom range
        </button>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white" />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs bg-white" />
          </div>
        )}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item…"
            className="rounded-lg border border-slate-200 bg-white pl-7 pr-3 py-1.5 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-slate-300" />
        </div>
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setCatFilter("")}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${!catFilter ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600"}`}>
          All
        </button>
        {CAT_ORDER.map((cat) => (
          <button key={cat} onClick={() => setCatFilter(c => c === cat ? "" : cat)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors ${catFilter === cat ? "text-white border-transparent" : "bg-white text-slate-600 border-slate-200"}`}
            style={catFilter === cat ? { background: CAT_COLORS[cat] } : {}}>
            {cat}
          </button>
        ))}
      </div>

      {/* State: loading / error / blocker */}
      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">Loading receipt analytics…</div>}
      {isError && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><XCircle className="h-4 w-4" />Could not load receipt data. Check server connection.</div>}
      {!isLoading && !isError && blockers.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-1">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />No data</div>
          {blockers.map(b => <p key={b.code}>{b.message}</p>)}
        </div>
      )}
      {!isLoading && !isError && ok && (
        <>
          {/* Date range label */}
          {dateRange && <p className="text-[10px] text-slate-400 -mt-3">Period: {dateRange} (Bangkok business shifts)</p>}

          {/* KPI cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            <KpiCard label="Gross Sales" value={m(sum?.grossSales ?? 0)} sub={`${sum?.receiptCount ?? 0} receipts`} />
            <KpiCard label="Avg Receipt" value={m(sum?.averageReceiptValue ?? 0)} />
            <KpiCard label="Burgers" value={String(sum?.burgersSold ?? 0)} sub="beef burgers" />
            <KpiCard label="Fries" value={String(sum?.friesSold ?? 0)} sub="portions" />
            <KpiCard label="Drinks" value={String(sum?.drinksSold ?? 0)} sub="units" />
            <KpiCard label="Chicken" value={String(sum?.chickenSold ?? 0)} sub="items" />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Daily trend — takes 2/3 width */}
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-3">Daily Trend</h2>
              {trend.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No trend data</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trend} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="bizDate" tickFormatter={fmtShort} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: number, name: string) => [name === "grossSales" ? m(val) : val, name === "grossSales" ? "Sales" : name.charAt(0).toUpperCase() + name.slice(1)]}
                      labelFormatter={fmtShort}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="grossSales" name="Sales" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Category mix — takes 1/3 width */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-3">Category Mix</h2>
              {catMix.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No data</p>
              ) : (
                <CategoryBar rows={catMix} />
              )}
            </div>
          </div>

          {/* Hourly Sales */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-3">Hourly Sales (Bangkok)</h2>
            {hourly.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No hourly data</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourly} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number, n: string) => [n === "grossSales" ? m(v) : v, n === "grossSales" ? "Sales" : "Receipts"]} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receiptCount" name="Receipts" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Products */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Top Products</h2>
              <span className="text-[10px] text-slate-400">{filteredProducts.length} items · sorted by qty sold</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Revenue</th>
                    <th className="px-4 py-2 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.slice(0, 30).map((p, i) => (
                    <tr key={`${p.name}-${i}`} className={`border-b border-slate-50 hover:bg-slate-50/60 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-800 max-w-[220px] truncate">{p.name}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: CAT_COLORS[p.category] ?? "#64748b" }}>{p.category}</span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">{p.qtySold}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{m(p.revenue)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{p.pctOfTotal}%</td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No POS receipts found for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Modifiers */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Top Modifiers</h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Add-ons, removals, and customisations</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2">#</th>
                    <th className="px-4 py-2">Modifier</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {modifiers.slice(0, 30).map((mod, i) => (
                    <tr key={mod.name} className={`border-b border-slate-50 hover:bg-slate-50/60 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                      <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-slate-800 max-w-[260px] truncate">{mod.name}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">{mod.qtySold}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{mod.pctOfTotal}%</td>
                    </tr>
                  ))}
                  {modifiers.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">No modifier data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Usage Estimates */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">Stock Usage Estimates</h2>
            <p className="text-[10px] text-slate-400 mb-3">Estimated from POS items sold — not actual stock count</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {stock.map((row) => (
                <div key={row.item} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{row.item}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{row.qty}</p>
                  <p className="text-[10px] text-slate-400">{row.unit}</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

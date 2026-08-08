import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, History, Save, Settings2 } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type Item = {
  source: string;
  name: string;
  sku: string;
  category: string;
  qtySold: number;
  grossSales: number;
  itemsRefunded: number;
  refunds: number;
  discounts: number;
  netSales: number;
  avgPrice: number;
  baseRevenue: number;
  costingStatus?: string;
  costedQty?: number;
  costingCoveragePct?: number;
  costOfGoods: number | null;
  grossProfit: number | null;
  marginPct: number | null;
  taxes: number;
};

type Component = { type: "Modifier" | "Option" | "Upsell"; group: string; name: string; qtySold: number; revenue: number; source?: string; costingStatus?: string; costOfGoods?: number | null };
type Included = { name: string; category: string; qtySold: number; source?: string; costingStatus?: string; costOfGoods?: number | null };
type ReceiptModifier = { group: string; name: string; priceDelta: number; quantity: number; type: "Modifier" | "Option" | "Upsell" };
type ReceiptItem = { id: string; name: string; quantity: number; unitPrice: number; lineTotal: number; isSetComponent: boolean; modifiers: ReceiptModifier[] };
type Receipt = { id: string; order_number: number; receipt_number?: string; items: ReceiptItem[] };

type Data = {
  ok: boolean;
  source: string;
  itemSales: Item[];
  componentSales: Component[];
  includedComponents: Included[];
  receipts?: Receipt[];
  summary: { grossSales: number; receiptCount: number; lineItemCount?: number; historicalUnits?: number; liveUnits?: number; liveCostedUnits?: number; liveCostingCoveragePct?: number; liveCogs?: number | null; liveGrossProfit?: number | null; liveMarginPct?: number | null };
  filters: { windowStart: string; windowEnd: string; timezone: string };
  blockers?: { code?: string; message: string }[];
  reconciliation?: { liveReceiptLinesMatch: boolean; historicalArchiveVerified: boolean };
  historicalArchive?: { available: boolean; included: boolean; aggregateOnly: boolean; periodStart: string; periodEnd: string; expectedRows: number; expectedItemsSold: number; expectedNetSales: number };
  cutover?: { liveSource: string; liveFrom: string; historicalSource: string; liveLoyverseIntegration: boolean };
  costing?: { historicalCostingAvailable: boolean; historicalReason: string; liveCostingBasis: string; draftRecipeAllowedWhenCostComplete: boolean; missingCostNeverAssumedZero: boolean };
};

type RecipeOption = { id: number; name: string; cost_per_serving: number | null; is_active: boolean };
type CostingCoverageRow = {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  group_name?: string;
  costing_mode: "recipe" | "direct" | "unconfigured";
  costing_status: "complete" | "partial" | "missing" | "direct";
  recipe_id: number | null;
  recipe_name: string | null;
  recipe_cost: number | null;
  direct_unit_cost: number | null;
  suggested_recipe_id?: number | null;
  suggested_recipe_name?: string | null;
};
type CoverageData = { ok: boolean; items: CostingCoverageRow[]; modifiers: CostingCoverageRow[]; recipes: RecipeOption[]; summary: { itemsTotal: number; itemsCosted: number; itemsCoveragePct: number; modifiersTotal: number; modifiersCosted: number; modifiersCoveragePct: number } };

type ItemColumnKey = "source" | "item" | "sku" | "category" | "qty" | "refQty" | "gross" | "refunds" | "discount" | "net" | "costing" | "cogs" | "profit" | "margin" | "taxes" | "avg";
type Tab = "items" | "modifiers" | "upsells" | "included" | "costing";

const money = (v: number | null | undefined) => v == null ? "—" : `฿${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const localDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const ALL_COLUMNS: { key: ItemColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: "source", label: "Source", defaultVisible: true },
  { key: "item", label: "Item", defaultVisible: true },
  { key: "sku", label: "SKU", defaultVisible: false },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "qty", label: "Items Sold", defaultVisible: true },
  { key: "refQty", label: "Items Refunded", defaultVisible: false },
  { key: "gross", label: "Gross Sales", defaultVisible: true },
  { key: "refunds", label: "Refunds", defaultVisible: false },
  { key: "discount", label: "Discounts", defaultVisible: true },
  { key: "net", label: "Net Sales", defaultVisible: true },
  { key: "costing", label: "Costing", defaultVisible: true },
  { key: "cogs", label: "COGS", defaultVisible: false },
  { key: "profit", label: "Gross Profit", defaultVisible: false },
  { key: "margin", label: "Margin", defaultVisible: false },
  { key: "taxes", label: "Taxes", defaultVisible: false },
  { key: "avg", label: "Average Price", defaultVisible: false },
];

const DEFAULT_COLUMNS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
const STORAGE_KEY = "sbb:item-sales:visible-columns:v3";

function CostStatus({ value }: { value?: string }) {
  const status = value || "Missing";
  const ok = status === "Complete" || status === "complete" || status === "Direct" || status === "direct";
  const partial = status === "Partial" || status === "partial";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${ok ? "bg-emerald-100 text-emerald-800" : partial ? "bg-amber-100 text-amber-800" : status === "Unavailable" ? "bg-slate-100 text-slate-600" : "bg-red-100 text-red-700"}`}>{status}</span>;
}

function CostingEditor({ row, recipes, kind, onSaved }: { row: CostingCoverageRow; recipes: RecipeOption[]; kind: "items" | "modifiers"; onSaved: () => void }) {
  const [mode, setMode] = useState(row.costing_mode || "unconfigured");
  const [recipeId, setRecipeId] = useState(row.recipe_id ? String(row.recipe_id) : row.suggested_recipe_id ? String(row.suggested_recipe_id) : "");
  const [directCost, setDirectCost] = useState(row.direct_unit_cost == null ? "" : String(row.direct_unit_cost));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setMode(row.costing_mode || "unconfigured");
    setRecipeId(row.recipe_id ? String(row.recipe_id) : row.suggested_recipe_id ? String(row.suggested_recipe_id) : "");
    setDirectCost(row.direct_unit_cost == null ? "" : String(row.direct_unit_cost));
  }, [row.id, row.costing_mode, row.recipe_id, row.direct_unit_cost, row.suggested_recipe_id]);

  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const body: any = { costingMode: mode };
      if (mode === "recipe") body.recipeId = Number(recipeId);
      if (mode === "direct") body.directUnitCost = Number(directCost);
      const response = await fetch(`/api/reports/receipt-analytics/costing-coverage/${kind}/${row.id}`, { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      setMessage("Saved · future sales");
      onSaved();
    } catch (e: any) { setMessage(e.message || "Save failed"); }
    finally { setSaving(false); }
  };

  return <tr>
    <td className="px-3 py-3"><div className="font-bold">{row.name}</div>{row.group_name ? <div className="text-[10px] text-slate-400">{row.group_name}</div> : <div className="text-[10px] text-slate-400">{row.category}{row.sku ? ` · ${row.sku}` : ""}</div>}</td>
    <td className="px-3 py-3"><CostStatus value={row.costing_status} /></td>
    <td className="px-3 py-3"><select value={mode} onChange={e => setMode(e.target.value as any)} className="rounded-lg border px-2 py-2 text-xs"><option value="unconfigured">Not configured</option><option value="recipe">Recipe</option><option value="direct">Direct cost</option></select></td>
    <td className="px-3 py-3">{mode === "recipe" ? <div><select value={recipeId} onChange={e => setRecipeId(e.target.value)} className="w-full min-w-[220px] rounded-lg border px-2 py-2 text-xs"><option value="">Select recipe…</option>{recipes.map(r => <option key={r.id} value={r.id}>{r.name}{r.cost_per_serving == null ? " · cost incomplete" : ` · ${money(r.cost_per_serving)}`}</option>)}</select>{!row.recipe_id && row.suggested_recipe_name ? <div className="mt-1 text-[10px] text-blue-600">Suggested exact match: {row.suggested_recipe_name}</div> : null}</div> : mode === "direct" ? <input type="number" min="0" step="0.01" value={directCost} onChange={e => setDirectCost(e.target.value)} placeholder="Unit cost THB" className="w-36 rounded-lg border px-2 py-2 text-xs" /> : <span className="text-xs text-slate-400">COGS unavailable</span>}</td>
    <td className="px-3 py-3 text-right"><button disabled={saving || (mode === "recipe" && !recipeId) || (mode === "direct" && directCost === "")} onClick={save} className="inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-xs font-bold disabled:opacity-40"><Save className="h-3.5 w-3.5" />{saving ? "Saving…" : "Save"}</button>{message ? <div className="mt-1 text-[10px] text-slate-500">{message}</div> : null}</td>
  </tr>;
}

export default function SalesByItem() {
  const [fromDate, setFromDate] = useState(localDate(-1));
  const [fromTime, setFromTime] = useState("17:00");
  const [toDate, setToDate] = useState(localDate());
  const [toTime, setToTime] = useState("03:00");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("items");
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ItemColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_COLUMNS;
    } catch { return DEFAULT_COLUMNS; }
  });

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns)), [visibleColumns]);

  const params = useMemo(() => new URLSearchParams({ fromDate, fromTime, toDate, toTime }).toString(), [fromDate, fromTime, toDate, toTime]);
  const { data, isLoading, isError, error } = useQuery<Data>({
    queryKey: ["sales-by-item-v4", params],
    queryFn: async () => {
      const response = await fetch(`/api/reports/receipt-analytics?${params}`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
  });
  const coverageQuery = useQuery<CoverageData>({
    queryKey: ["item-sales-costing-coverage"],
    queryFn: async () => {
      const response = await fetch(`/api/reports/receipt-analytics/costing-coverage`, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
  });

  const showHistoricalArchive = () => { setFromDate("2026-01-01"); setFromTime("17:00"); setToDate("2026-08-08"); setToTime("03:00"); setTab("items"); };
  const q = search.trim().toLowerCase();
  const items = (data?.itemSales || []).filter(x => !q || [x.name, x.sku, x.category, x.source].some(v => String(v || "").toLowerCase().includes(q)));
  const modifiers = (data?.componentSales || []).filter(x => x.type !== "Upsell").filter(x => !q || [x.name, x.group, x.type].some(v => String(v).toLowerCase().includes(q)));
  const upsells = (data?.componentSales || []).filter(x => x.type === "Upsell").filter(x => !q || [x.name, x.group].some(v => String(v).toLowerCase().includes(q)));
  const included = (data?.includedComponents || []).filter(x => !q || [x.name, x.category].some(v => String(v).toLowerCase().includes(q)));
  const itemQty = (data?.itemSales || []).reduce((a, x) => a + Number(x.qtySold || 0), 0);
  const modifierRevenue = (data?.componentSales || []).reduce((a, x) => a + Number(x.revenue || 0), 0);
  const reconciled = Boolean(data?.reconciliation?.liveReceiptLinesMatch && data?.reconciliation?.historicalArchiveVerified);

  const toggleColumn = (key: ItemColumnKey) => setVisibleColumns(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  const isVisible = (key: ItemColumnKey) => visibleColumns.includes(key);
  const valueFor = (item: Item, key: ItemColumnKey) => {
    if (key === "source") return item.source; if (key === "item") return item.name; if (key === "sku") return item.sku; if (key === "category") return item.category;
    if (key === "qty") return item.qtySold; if (key === "refQty") return item.itemsRefunded; if (key === "gross") return item.grossSales; if (key === "refunds") return item.refunds;
    if (key === "discount") return item.discounts; if (key === "net") return item.netSales; if (key === "costing") return item.costingStatus || "Missing"; if (key === "cogs") return item.costOfGoods;
    if (key === "profit") return item.grossProfit; if (key === "margin") return item.marginPct == null ? "" : `${item.marginPct}%`; if (key === "taxes") return item.taxes; return item.avgPrice;
  };

  const exportCsv = () => {
    let rows: string[][]; let filename: string;
    if (tab === "items") {
      const cols = ALL_COLUMNS.filter(c => isVisible(c.key));
      rows = [cols.map(c => c.label), ...items.map(item => cols.map(c => String(valueFor(item, c.key) ?? "")))];
      filename = `item-sales-${fromDate}-${fromTime.replace(":", "")}-${toDate}-${toTime.replace(":", "")}.csv`;
    } else if (tab === "included") {
      rows = [["Component", "Category", "Qty Used", "Source", "Costing"], ...included.map(x => [x.name, x.category, String(x.qtySold), x.source || "SBB POS", x.costingStatus || "Missing"])]; filename = `included-components-${fromDate}-${toDate}.csv`;
    } else if (tab === "costing") {
      const c = coverageQuery.data;
      rows = [["Type","Name","Category / Group","SKU","Status","Mode","Recipe","Direct Cost"], ...(c?.items || []).map(x => ["Item",x.name,x.category || "",x.sku || "",x.costing_status,x.costing_mode,x.recipe_name || "",String(x.direct_unit_cost ?? "")]), ...(c?.modifiers || []).map(x => ["Modifier",x.name,x.group_name || "","",x.costing_status,x.costing_mode,x.recipe_name || "",String(x.direct_unit_cost ?? "")])]; filename = `costing-coverage-${localDate()}.csv`;
    } else {
      const source = tab === "upsells" ? upsells : modifiers;
      rows = [["Type", "Group", "Selection", "Qty", "Value", "Source", "Costing", "COGS"], ...source.map(x => [x.type, x.group, x.name, String(x.qtySold), String(x.revenue), x.source || "SBB POS", x.costingStatus || "Missing", String(x.costOfGoods ?? "")])]; filename = `${tab}-${fromDate}-${toDate}.csv`;
    }
    const blob = new Blob([rows.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const renderItemCell = (item: Item, key: ItemColumnKey) => {
    if (["gross", "refunds", "discount", "net", "cogs", "profit", "taxes", "avg"].includes(key)) return money(valueFor(item, key) as number | null);
    if (key === "margin") return item.marginPct == null ? "—" : `${item.marginPct}%`;
    if (key === "costing") return <CostStatus value={item.costingStatus} />;
    return String(valueFor(item, key) ?? "");
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <PageTitle title="Item Sales" meta="Historical archive + live SBB POS + sale-time costing" />

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs font-bold">From date<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label className="text-xs font-bold">From time<input type="time" value={fromTime} onChange={e => setFromTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label className="text-xs font-bold">To date<input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label className="text-xs font-bold">To time<input type="time" value={toTime} onChange={e => setToTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, SKU, source, modifier or upsell…" className="w-full max-w-md rounded-xl border px-3 py-2 text-sm" />
        <button onClick={showHistoricalArchive} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-slate-50"><History className="h-4 w-4" />Historical Archive</button>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-slate-50"><Download className="h-4 w-4" />Export CSV</button>
        {tab === "items" && <div className="relative"><button onClick={() => setShowColumns(v => !v)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-slate-50"><Settings2 className="h-4 w-4" />Columns</button>{showColumns && <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border bg-white p-3 shadow-xl"><p className="mb-2 text-[10px] font-black uppercase text-slate-500">Visible columns</p><div className="grid grid-cols-1 gap-2">{ALL_COLUMNS.map(c => <label key={c.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={isVisible(c.key)} onChange={() => toggleColumn(c.key)} />{c.label}</label>)}</div></div>}</div>}
      </div>
    </div>

    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900"><b>Live source of truth:</b> SBB POS from 8 Aug 2026 17:00. Loyverse is historical only. New COGS uses the recipe/direct-cost configuration captured when each sale occurs; missing costs remain unknown rather than becoming zero.</div>
    {data?.costing?.historicalReason && data?.historicalArchive?.included ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"><b>Historical costing unavailable:</b> {data.costing.historicalReason}</div> : null}

    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
      <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Live receipts</p><p className="text-xl font-black">{data?.summary?.receiptCount || 0}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Units sold</p><p className="text-xl font-black">{itemQty}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Sales</p><p className="text-xl font-black">{money(data?.summary?.grossSales || 0)}</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Live costing</p><p className="text-xl font-black">{Number(data?.summary?.liveCostingCoveragePct ?? 0).toFixed(0)}%</p><p className="text-[10px] text-slate-400">{data?.summary?.liveCostedUnits || 0}/{data?.summary?.liveUnits || 0} units</p></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Live COGS</p><p className="text-xl font-black">{money(data?.summary?.liveCogs)}</p><p className="text-[10px] text-slate-400">only shown at 100% coverage</p></div>
      <div className={`rounded-xl border p-4 ${isError ? "border-red-200 bg-red-50" : reconciled ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}><p className="text-[10px] font-bold uppercase text-slate-500">Reconciliation</p><p className={`text-xl font-black ${isError ? "text-red-700" : reconciled ? "text-emerald-700" : "text-amber-700"}`}>{isError ? "ERROR" : reconciled ? "PASS" : "CHECK"}</p><p className="text-[10px] text-slate-500">receipt lines → report</p></div>
    </div>

    <div className="flex flex-wrap gap-2 border-b pb-2">{([["items", "Items"], ["modifiers", "Modifiers & Options"], ["upsells", "Upsells"], ["included", "Included Components"], ["costing", "Costing Coverage"]] as [Tab, string][]).map(([key, label]) => <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === key ? "bg-slate-900 text-white" : "border bg-white text-slate-600"}`}>{label}{key === "costing" && coverageQuery.data ? ` · ${coverageQuery.data.summary.itemsCoveragePct}%` : ""}</button>)}</div>

    {tab !== "costing" && isLoading && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading item sales…</div>}
    {tab !== "costing" && isError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">Could not load item sales. {error instanceof Error ? error.message : ""}</div>}
    {tab !== "costing" && !isLoading && !isError && data?.blockers?.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.blockers.map((b, i) => <p key={i}>{b.message}</p>)}</div> : null}

    {!isLoading && !isError && tab === "items" && <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-4 py-3"><h2 className="font-black">Items Sold</h2><p className="text-xs text-slate-500">Historical and live records remain source-labelled. COGS/profit are never fabricated when costing is incomplete.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr>{ALL_COLUMNS.filter(c => isVisible(c.key)).map(c => <th key={c.key} className={`px-4 py-3 ${["source", "item", "sku", "category", "costing"].includes(c.key) ? "text-left" : "text-right"}`}>{c.label}</th>)}</tr></thead><tbody className="divide-y">{items.map((item, index) => <tr key={`${item.source}-${item.sku}-${index}`}>{ALL_COLUMNS.filter(c => isVisible(c.key)).map(c => <td key={c.key} className={`px-4 py-3 ${["source", "item", "sku", "category", "costing"].includes(c.key) ? "text-left" : "text-right"} ${c.key === "item" || c.key === "net" ? "font-bold" : ""}`}>{renderItemCell(item, c.key)}</td>)}</tr>)}</tbody></table></div></section>}

    {!isLoading && !isError && tab === "modifiers" && <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-4 py-3"><h2 className="font-black">Modifiers & Options</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-xs"><tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Group</th><th className="px-4 py-3 text-left">Selection</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-left">Costing</th><th className="px-4 py-3 text-right">COGS</th></tr></thead><tbody className="divide-y">{modifiers.map((x, i) => <tr key={`${x.group}-${x.name}-${i}`}><td className="px-4 py-3">{x.type}</td><td className="px-4 py-3">{x.group}</td><td className="px-4 py-3 font-bold">{x.name}</td><td className="px-4 py-3 text-right">{x.qtySold}</td><td className="px-4 py-3 text-right">{money(x.revenue)}</td><td className="px-4 py-3"><CostStatus value={x.costingStatus} /></td><td className="px-4 py-3 text-right">{money(x.costOfGoods)}</td></tr>)}</tbody></table></div></section>}

    {!isLoading && !isError && tab === "upsells" && <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-4 py-3"><h2 className="font-black">Upsells</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-xs"><tr><th className="px-4 py-3 text-left">Group</th><th className="px-4 py-3 text-left">Upsell</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-left">Costing</th><th className="px-4 py-3 text-right">COGS</th></tr></thead><tbody className="divide-y">{upsells.map((x, i) => <tr key={`${x.group}-${x.name}-${i}`}><td className="px-4 py-3">{x.group}</td><td className="px-4 py-3 font-bold">{x.name}</td><td className="px-4 py-3 text-right">{x.qtySold}</td><td className="px-4 py-3 text-right">{money(x.revenue)}</td><td className="px-4 py-3"><CostStatus value={x.costingStatus} /></td><td className="px-4 py-3 text-right">{money(x.costOfGoods)}</td></tr>)}</tbody></table></div></section>}

    {!isLoading && !isError && tab === "included" && <section className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-4 py-3"><h2 className="font-black">Included Components</h2><p className="text-xs text-slate-500">Included fries/drinks/components contribute stock usage and COGS to their parent item.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-xs"><tr><th className="px-4 py-3 text-left">Component</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Qty Used</th><th className="px-4 py-3 text-left">Costing</th><th className="px-4 py-3 text-right">COGS</th></tr></thead><tbody className="divide-y">{included.map((x, i) => <tr key={`${x.category}-${x.name}-${i}`}><td className="px-4 py-3 font-bold">{x.name}</td><td className="px-4 py-3">{x.category}</td><td className="px-4 py-3 text-right">{x.qtySold}</td><td className="px-4 py-3"><CostStatus value={x.costingStatus} /></td><td className="px-4 py-3 text-right">{money(x.costOfGoods)}</td></tr>)}</tbody></table></div></section>}

    {tab === "costing" && <section className="space-y-4">
      {coverageQuery.isLoading ? <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading costing coverage…</div> : coverageQuery.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">Could not load costing coverage.</div> : coverageQuery.data ? <>
        <div className="grid gap-3 md:grid-cols-4"><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Menu items costed</p><p className="text-xl font-black">{coverageQuery.data.summary.itemsCosted}/{coverageQuery.data.summary.itemsTotal}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Item coverage</p><p className="text-xl font-black">{coverageQuery.data.summary.itemsCoveragePct}%</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Modifiers costed</p><p className="text-xl font-black">{coverageQuery.data.summary.modifiersCosted}/{coverageQuery.data.summary.modifiersTotal}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Modifier coverage</p><p className="text-xl font-black">{coverageQuery.data.summary.modifiersCoveragePct}%</p></div></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"><b>Costing rule:</b> Draft recipes are allowed when their ingredient quantities and unit costs are complete. Saving a mapping applies to future sales only. Existing sale snapshots are never rewritten when ingredient prices change.</div>
        <div className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-4 py-3"><h2 className="font-black">Menu Item Costing</h2><p className="text-xs text-slate-500">Food → Recipe. Packaged products may use Direct Cost. Missing stays unknown.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-3 text-left">Menu item</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Method</th><th className="px-3 py-3 text-left">Recipe / Unit Cost</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{coverageQuery.data.items.map(row => <CostingEditor key={row.id} row={row} recipes={coverageQuery.data!.recipes} kind="items" onSaved={() => coverageQuery.refetch()} />)}</tbody></table></div></div>
        <div className="overflow-hidden rounded-2xl border bg-white"><div className="border-b px-4 py-3"><h2 className="font-black">Modifier & Upsell Costing</h2><p className="text-xs text-slate-500">Configure ingredient-bearing extras such as patties, cheese and bacon. Choice-only options with no extra consumption can use direct cost ฿0.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-3 py-3 text-left">Modifier</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-left">Method</th><th className="px-3 py-3 text-left">Recipe / Unit Cost</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y">{coverageQuery.data.modifiers.map(row => <CostingEditor key={row.id} row={row} recipes={coverageQuery.data!.recipes} kind="modifiers" onSaved={() => coverageQuery.refetch()} />)}</tbody></table></div></div>
      </> : null}
    </section>}
  </div>;
}

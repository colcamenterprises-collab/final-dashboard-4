import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Settings2 } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type Item = {
  name: string;
  sku: string;
  category: string;
  qtySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  avgPrice: number;
  baseRevenue: number;
};

type Component = {
  type: "Modifier" | "Option" | "Upsell";
  group: string;
  name: string;
  qtySold: number;
  revenue: number;
};

type Included = { name: string; category: string; qtySold: number };
type ReceiptModifier = { group: string; name: string; priceDelta: number; quantity: number; type: "Modifier" | "Option" | "Upsell" };
type ReceiptItem = { id: string; name: string; quantity: number; unitPrice: number; lineTotal: number; isSetComponent: boolean; modifiers: ReceiptModifier[] };
type Receipt = { id: string; order_number: number; receipt_number?: string; items: ReceiptItem[] };

type Data = {
  ok: boolean;
  itemSales: Item[];
  componentSales: Component[];
  includedComponents: Included[];
  receipts?: Receipt[];
  summary: { grossSales: number; receiptCount: number };
  filters: { windowStart: string; windowEnd: string; timezone: string };
  blockers?: { message: string }[];
};

type ItemColumnKey = "item" | "sku" | "category" | "qty" | "gross" | "discount" | "net" | "avg" | "base";
type Tab = "items" | "modifiers" | "upsells" | "included";

const money = (v: number) => `฿${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const localDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
};
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const ALL_COLUMNS: { key: ItemColumnKey; label: string; defaultVisible: boolean }[] = [
  { key: "item", label: "Item", defaultVisible: true },
  { key: "sku", label: "SKU", defaultVisible: false },
  { key: "category", label: "Category", defaultVisible: true },
  { key: "qty", label: "Items Sold", defaultVisible: true },
  { key: "gross", label: "Gross Sales", defaultVisible: true },
  { key: "discount", label: "Discounts", defaultVisible: true },
  { key: "net", label: "Net Sales", defaultVisible: true },
  { key: "avg", label: "Average Price", defaultVisible: false },
  { key: "base", label: "Base Revenue", defaultVisible: false },
];

const DEFAULT_COLUMNS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
const STORAGE_KEY = "sbb:item-sales:visible-columns:v1";

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
    } catch {
      return DEFAULT_COLUMNS;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const params = useMemo(
    () => new URLSearchParams({ fromDate, fromTime, toDate, toTime }).toString(),
    [fromDate, fromTime, toDate, toTime],
  );

  const { data, isLoading, isError } = useQuery<Data>({
    queryKey: ["sales-by-item-v2", params],
    queryFn: async () => {
      const r = await fetch(`/api/reports/receipt-analytics?${params}`, { credentials: "include", cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const q = search.trim().toLowerCase();
  const items = (data?.itemSales || []).filter(x => !q || x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q) || (x.sku || "").toLowerCase().includes(q));
  const modifiers = (data?.componentSales || []).filter(x => x.type !== "Upsell").filter(x => !q || x.name.toLowerCase().includes(q) || x.group.toLowerCase().includes(q) || x.type.toLowerCase().includes(q));
  const upsells = (data?.componentSales || []).filter(x => x.type === "Upsell").filter(x => !q || x.name.toLowerCase().includes(q) || x.group.toLowerCase().includes(q));
  const included = (data?.includedComponents || []).filter(x => !q || x.name.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));

  const itemQty = (data?.itemSales || []).reduce((a, x) => a + Number(x.qtySold || 0), 0);
  const componentQty = (data?.componentSales || []).reduce((a, x) => a + Number(x.qtySold || 0), 0);
  const modifierRevenue = (data?.componentSales || []).reduce((a, x) => a + Number(x.revenue || 0), 0);

  const receiptItemQty = (data?.receipts || []).reduce((sum, receipt) => sum + (receipt.items || []).filter(i => !i.isSetComponent).reduce((s, i) => s + Number(i.quantity || 0), 0), 0);
  const receiptComponentQty = (data?.receipts || []).reduce((sum, receipt) => sum + (receipt.items || []).reduce((s, i) => s + (i.modifiers || []).reduce((m, mod) => m + Number(mod.quantity || 0), 0), 0), 0);
  const itemReconciled = !data?.receipts || receiptItemQty === itemQty;
  const componentReconciled = !data?.receipts || receiptComponentQty === componentQty;

  const toggleColumn = (key: ItemColumnKey) => {
    setVisibleColumns(current => current.includes(key) ? current.filter(k => k !== key) : [...current, key]);
  };
  const isVisible = (key: ItemColumnKey) => visibleColumns.includes(key);

  const exportCsv = () => {
    let rows: string[][] = [];
    let filename = `item-sales-${fromDate}-${fromTime.replace(":", "")}-${toDate}-${toTime.replace(":", "")}.csv`;

    if (tab === "items") {
      const cols = ALL_COLUMNS.filter(c => isVisible(c.key));
      rows = [cols.map(c => c.label), ...items.map(item => cols.map(c => {
        if (c.key === "item") return item.name;
        if (c.key === "sku") return item.sku;
        if (c.key === "category") return item.category;
        if (c.key === "qty") return String(item.qtySold);
        if (c.key === "gross") return String(item.grossSales);
        if (c.key === "discount") return String(item.discounts);
        if (c.key === "net") return String(item.netSales);
        if (c.key === "avg") return String(item.avgPrice);
        return String(item.baseRevenue);
      }))];
    } else if (tab === "included") {
      rows = [["Component", "Category", "Qty Used"], ...included.map(x => [x.name, x.category, String(x.qtySold)])];
      filename = `included-components-${fromDate}-${toDate}.csv`;
    } else {
      const source = tab === "upsells" ? upsells : modifiers;
      rows = [["Type", "Group", "Selection", "Qty", "Value"], ...source.map(x => [x.type, x.group, x.name, String(x.qtySold), String(x.revenue)])];
      filename = `${tab}-${fromDate}-${toDate}.csv`;
    }

    const blob = new Blob([rows.map(row => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageTitle title="Item Sales" meta="Aggregated directly from paid POS receipts · no duplicate sales ledger" />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-xs font-bold">From date<input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-xs font-bold">From time<input type="time" value={fromTime} onChange={e => setFromTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-xs font-bold">To date<input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-xs font-bold">To time<input type="time" value={toTime} onChange={e => setToTime(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item, SKU, modifier or upsell…" className="w-full max-w-md rounded-xl border px-3 py-2 text-sm" />
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-slate-50"><Download className="h-4 w-4" />Export CSV</button>
          {tab === "items" && <div className="relative">
            <button onClick={() => setShowColumns(v => !v)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-slate-50"><Settings2 className="h-4 w-4" />Columns</button>
            {showColumns && <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border bg-white p-3 shadow-xl">
              <p className="mb-2 text-[10px] font-black uppercase text-slate-500">Visible columns</p>
              <div className="space-y-2">{ALL_COLUMNS.map(c => <label key={c.key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={isVisible(c.key)} onChange={() => toggleColumn(c.key)} />{c.label}</label>)}</div>
            </div>}
          </div>}
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        <b>Source of truth:</b> completed, paid POS receipts. Item Sales aggregates the receipt lines for the selected date/time window. Receipt analysis remains the individual transaction detail.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Receipts</p><p className="text-xl font-black">{data?.summary?.receiptCount || 0}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Units sold</p><p className="text-xl font-black">{itemQty}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Receipt sales</p><p className="text-xl font-black">{money(data?.summary?.grossSales || 0)}</p></div>
        <div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Modifier/Upsell value</p><p className="text-xl font-black">{money(modifierRevenue)}</p><p className="text-[10px] text-slate-400">Included in receipt sales</p></div>
        <div className={`rounded-xl border p-4 ${itemReconciled && componentReconciled ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><p className="text-[10px] font-bold uppercase text-slate-500">Reconciliation</p><p className={`text-xl font-black ${itemReconciled && componentReconciled ? "text-emerald-700" : "text-red-700"}`}>{itemReconciled && componentReconciled ? "PASS" : "CHECK"}</p><p className="text-[10px] text-slate-500">receipt lines → report totals</p></div>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-2">
        {([[
          "items", "Items"
        ], ["modifiers", "Modifiers & Options"], ["upsells", "Upsells"], ["included", "Included Components"]] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 border"}`}>{label}</button>
        ))}
      </div>

      {isLoading && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading POS item sales…</div>}
      {isError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">Could not load item sales.</div>}
      {!isLoading && !isError && data?.blockers?.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.blockers.map((b, i) => <p key={i}>{b.message}</p>)}</div> : null}

      {!isLoading && !isError && tab === "items" && <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-4 py-3"><h2 className="font-black">Items Sold</h2><p className="text-xs text-slate-500">One row per commercial menu item for the selected period. SKU is retained but hidden by default.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr>
          {isVisible("item") && <th className="px-4 py-3 text-left">Item</th>}
          {isVisible("sku") && <th className="px-4 py-3 text-left">SKU</th>}
          {isVisible("category") && <th className="px-4 py-3 text-left">Category</th>}
          {isVisible("qty") && <th className="px-4 py-3 text-right">Items Sold</th>}
          {isVisible("gross") && <th className="px-4 py-3 text-right">Gross Sales</th>}
          {isVisible("discount") && <th className="px-4 py-3 text-right">Discounts</th>}
          {isVisible("net") && <th className="px-4 py-3 text-right">Net Sales</th>}
          {isVisible("avg") && <th className="px-4 py-3 text-right">Avg Price</th>}
          {isVisible("base") && <th className="px-4 py-3 text-right">Base Revenue</th>}
        </tr></thead><tbody className="divide-y">{items.map(x => <tr key={`${x.sku}-${x.name}`}>
          {isVisible("item") && <td className="px-4 py-3 font-bold">{x.name}</td>}
          {isVisible("sku") && <td className="px-4 py-3 font-mono text-xs text-slate-500">{x.sku || "—"}</td>}
          {isVisible("category") && <td className="px-4 py-3">{x.category}</td>}
          {isVisible("qty") && <td className="px-4 py-3 text-right font-bold">{x.qtySold}</td>}
          {isVisible("gross") && <td className="px-4 py-3 text-right">{money(x.grossSales)}</td>}
          {isVisible("discount") && <td className="px-4 py-3 text-right">{money(x.discounts)}</td>}
          {isVisible("net") && <td className="px-4 py-3 text-right font-black">{money(x.netSales)}</td>}
          {isVisible("avg") && <td className="px-4 py-3 text-right">{money(x.avgPrice)}</td>}
          {isVisible("base") && <td className="px-4 py-3 text-right">{money(x.baseRevenue)}</td>}
        </tr>)}</tbody></table></div>
      </section>}

      {!isLoading && !isError && tab === "modifiers" && <ComponentTable title="Modifiers & Options" subtitle="Every stored zero- or paid-price selection is counted, including stock-consuming free options." rows={modifiers} />}
      {!isLoading && !isError && tab === "upsells" && <ComponentTable title="Upsells" subtitle="Selections classified as upgrades/add-ons are reported separately from base item sales." rows={upsells} />}
      {!isLoading && !isError && tab === "included" && <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-4 py-3"><h2 className="font-black">Included Components</h2><p className="text-xs text-slate-500">Set components such as included fries/drinks are kept separate for later recipe and stock consumption calculations.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Component</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Qty Used</th></tr></thead><tbody className="divide-y">{included.map(x => <tr key={`${x.category}-${x.name}`}><td className="px-4 py-3 font-bold">{x.name}</td><td className="px-4 py-3">{x.category}</td><td className="px-4 py-3 text-right font-black">{x.qtySold}</td></tr>)}</tbody></table></div></section>}
    </div>
  );
}

function ComponentTable({ title, subtitle, rows }: { title: string; subtitle: string; rows: Component[] }) {
  return <section className="overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="border-b px-4 py-3"><h2 className="font-black">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr><th className="px-4 py-3 text-left">Type</th><th className="px-4 py-3 text-left">Group</th><th className="px-4 py-3 text-left">Selection</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Value</th></tr></thead><tbody className="divide-y">{rows.map((x, i) => <tr key={`${x.type}-${x.group}-${x.name}-${i}`}><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${x.type === "Upsell" ? "bg-amber-100 text-amber-800" : x.type === "Option" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"}`}>{x.type}</span></td><td className="px-4 py-3">{x.group}</td><td className="px-4 py-3 font-bold">{x.name}</td><td className="px-4 py-3 text-right font-bold">{x.qtySold}</td><td className="px-4 py-3 text-right">{money(x.revenue)}</td></tr>)}</tbody></table></div></section>;
}

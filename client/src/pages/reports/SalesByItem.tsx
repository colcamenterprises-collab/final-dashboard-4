import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import { ExactDateTimeRange, reportingRangeParams, type ExactDateTimeRangeValue } from "@/components/reports/ExactDateTimeRange";
import { PageTitle } from "@/components/ui/sbb-cards";

type Item = {
  item_key: string;
  item_name: string;
  sku?: string;
  category?: string;
  quantity: number;
  gross_sales: number;
  discounts: number;
  refunds: number;
  net_sales: number;
  cost_of_goods: number | null;
  gross_profit: number | null;
  margin_pct: number | null;
  sources: string[];
};
type Data = { ok: boolean; source: string; filters: ExactDateTimeRangeValue & { fromInstant: string; toInstant: string }; items: Item[]; error?: string };

const money = (value: number | null | undefined) => value == null ? "—" : `฿${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
const percent = (value: number | null | undefined) => value == null ? "—" : `${Number(value).toFixed(1)}%`;
function localDate(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function SalesByItem() {
  const [range, setRange] = useState<ExactDateTimeRangeValue>({ fromDate: localDate(-1), fromTime: "17:00", toDate: localDate(), toTime: "03:00", timezone: "Asia/Bangkok" });
  const [search, setSearch] = useState("");
  const params = useMemo(() => reportingRangeParams(range), [range]);
  const query = useQuery<Data>({
    queryKey: ["unified-sales-by-item", params],
    queryFn: async () => {
      const response = await fetch(`/api/reports/unified/items?${params}`, { credentials: "include", cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
      return body;
    },
  });
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (query.data?.items || []).filter(row => !q || [row.item_name, row.sku, row.category, ...(row.sources || [])].some(value => String(value || "").toLowerCase().includes(q)));
  }, [query.data, search]);
  const totals = useMemo(() => ({
    quantity: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    net: rows.reduce((sum, row) => sum + Number(row.net_sales || 0), 0),
    cogsAvailable: rows.length > 0 && rows.every(row => row.cost_of_goods != null),
    cogs: rows.reduce((sum, row) => sum + Number(row.cost_of_goods || 0), 0),
  }), [rows]);
  const profit = totals.cogsAvailable ? totals.net - totals.cogs : null;
  const margin = profit != null && totals.net ? profit / totals.net * 100 : null;

  const exportCsv = () => {
    const header = ["Item", "SKU", "Category", "Qty", "Gross Sales", "Discounts", "Refunds", "Net Sales", "COGS", "Gross Profit", "Margin %", "Sources"];
    const body = rows.map(row => [row.item_name, row.sku, row.category, row.quantity, row.gross_sales, row.discounts, row.refunds, row.net_sales, row.cost_of_goods, row.gross_profit, row.margin_pct, (row.sources || []).join(" + ")].map(csv).join(","));
    const blob = new Blob([[header.map(csv).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `sales-by-item-${range.fromDate}-${range.toDate}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <PageTitle title="Sales by Item" meta="Product performance from the unified historical + live sales ledger" />
    <ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok" />
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search item, SKU, category or source…" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm"/></div><button onClick={exportCsv} disabled={!rows.length} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-black disabled:opacity-40"><Download className="h-4 w-4"/>Export CSV</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Items sold</p><p className="mt-1 text-xl font-black">{totals.quantity.toLocaleString()}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Net sales</p><p className="mt-1 text-xl font-black">{money(totals.net)}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">COGS</p><p className="mt-1 text-xl font-black">{totals.cogsAvailable ? money(totals.cogs) : "—"}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-[10px] font-bold uppercase text-slate-500">Gross margin</p><p className="mt-1 text-xl font-black">{percent(margin)}</p></div></div>
    {query.isLoading && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading item sales…</div>}
    {query.isError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{(query.error as Error).message}</div>}
    {!query.isLoading && !query.isError && rows.length === 0 && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">No item sales found in this exact date/time range.</div>}
    {rows.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Source</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Discount</th><th className="px-4 py-3 text-right">Refund</th><th className="px-4 py-3 text-right">Net Sales</th><th className="px-4 py-3 text-right">COGS</th><th className="px-4 py-3 text-right">Gross Profit</th><th className="px-4 py-3 text-right">Margin</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.item_key} className="hover:bg-slate-50"><td className="px-4 py-3"><div className="font-black">{row.item_name}</div>{row.sku ? <div className="text-[10px] text-slate-400">{row.sku}</div> : null}</td><td className="px-4 py-3">{row.category || "Other"}</td><td className="px-4 py-3 text-xs">{(row.sources || []).map(source => source === "sbb_pos" ? "SBB POS" : source).join(" + ")}</td><td className="px-4 py-3 text-right font-bold">{Number(row.quantity).toLocaleString()}</td><td className="px-4 py-3 text-right">{money(row.gross_sales)}</td><td className="px-4 py-3 text-right">{money(row.discounts)}</td><td className="px-4 py-3 text-right">{money(row.refunds)}</td><td className="px-4 py-3 text-right font-black">{money(row.net_sales)}</td><td className="px-4 py-3 text-right">{money(row.cost_of_goods)}</td><td className="px-4 py-3 text-right">{money(row.gross_profit)}</td><td className="px-4 py-3 text-right">{percent(row.margin_pct)}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

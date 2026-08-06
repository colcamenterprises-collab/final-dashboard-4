import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageTitle } from "@/components/ui/sbb-cards";

type Preset = "current_shift" | "last_completed_shift" | "7s" | "30s" | "shift_date" | "range" | "month";

type ItemSale = {
  name: string;
  sku: string;
  category: string;
  qtySold: number;
  grossSales: number;
  discounts: number;
  netSales: number;
  avgPrice: number;
};

type Response = {
  ok: boolean;
  itemSales: ItemSale[];
  summary: { grossSales: number; receiptCount: number };
  filters: {
    from: string;
    to: string;
    mode?: string;
    timezone?: string;
    windowStart?: string;
    windowEnd?: string;
    shiftStartTime?: string;
    shiftEndTime?: string;
  };
  blockers?: { code: string; message: string }[];
};

const money = (n: number) => `฿${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const isoTodayBkk = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monthStart = () => `${isoTodayBkk().slice(0, 7)}-01`;
const fmtStamp = (value?: string) => {
  if (!value) return "";
  const [date, time = ""] = value.split(" ");
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}${time ? ` ${time.slice(0, 5)}` : ""}`;
};

const categories = ["Burgers", "Fries", "Drinks", "Chicken", "Sides", "Other"];

export default function SalesByItem() {
  const [preset, setPreset] = useState<Preset>("current_shift");
  const [shiftDate, setShiftDate] = useState(isoTodayBkk());
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(isoTodayBkk());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (preset === "current_shift") p.set("mode", "current_shift");
    if (preset === "last_completed_shift") p.set("mode", "last_completed_shift");
    if (preset === "7s") p.set("limit", "7");
    if (preset === "30s") p.set("limit", "30");
    if (preset === "shift_date") {
      p.set("mode", "custom");
      p.set("shiftStartDate", shiftDate);
    }
    if (preset === "range") {
      p.set("mode", "custom");
      p.set("shiftStartDate", fromDate);
      p.set("shiftEndDate", toDate || fromDate);
    }
    if (preset === "month") {
      p.set("mode", "custom");
      p.set("shiftStartDate", monthStart());
      p.set("shiftEndDate", isoTodayBkk());
    }
    if (search.trim()) p.set("search", search.trim());
    if (category) p.set("category", category);
    return p.toString();
  }, [preset, shiftDate, fromDate, toDate, search, category]);

  const { data, isLoading, isError } = useQuery<Response>({
    queryKey: ["/api/reports/receipt-analytics", "sales-by-item", params],
    queryFn: async () => {
      const res = await fetch(`/api/reports/receipt-analytics?${params}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
  });

  const rows = data?.itemSales ?? [];
  const totals = useMemo(() => rows.reduce((acc, row) => ({
    qty: acc.qty + Number(row.qtySold || 0),
    gross: acc.gross + Number(row.grossSales || 0),
    discounts: acc.discounts + Number(row.discounts || 0),
    net: acc.net + Number(row.netSales || 0),
  }), { qty: 0, gross: 0, discounts: 0, net: 0 }), [rows]);

  const windowLabel = data?.filters?.windowStart && data?.filters?.windowEnd
    ? `${fmtStamp(data.filters.windowStart)} → ${fmtStamp(data.filters.windowEnd)} BKK`
    : "";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageTitle title="Sales by Item" meta="SBB POS item sales · shift-date reporting · Asia/Bangkok" />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            ["current_shift", "Current Shift"],
            ["last_completed_shift", "Last Completed Shift"],
            ["7s", "Last 7 Shifts"],
            ["30s", "Last 30 Shifts"],
            ["month", "This Month"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setPreset(key as Preset)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${preset === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>{label}</button>
          ))}
          <button onClick={() => setPreset("shift_date")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${preset === "shift_date" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Shift Date</button>
          <button onClick={() => setPreset("range")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${preset === "range" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>Date Range</button>
        </div>

        {preset === "shift_date" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-slate-600">Shift date
              <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <p className="pb-2 text-xs text-slate-500">One date means the complete shift opened on that Bangkok date, including sales after midnight.</p>
          </div>
        )}

        {preset === "range" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold text-slate-600">From shift date
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-600">To shift date
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item…" className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <b>Shift Date rule:</b> a shift belongs to the Bangkok calendar date it opened. Example: 6 Aug means the shift opened on 6 Aug and includes all sales until that shift closes after midnight on 7 Aug. Default operating window is 17:00 → 03:00 BKK.
      </div>

      {windowLabel && <p className="text-xs font-medium text-slate-500">Reporting window: {windowLabel}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ["Units sold", String(totals.qty)],
          ["Gross sales", money(totals.gross)],
          ["Discounts", money(totals.discounts)],
          ["Net sales", money(totals.net)],
          ["Avg / unit", money(totals.qty ? totals.net / totals.qty : 0)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-slate-900">{value}</p></div>)}
      </div>

      {isLoading && <div className="rounded-2xl border bg-white p-8 text-center text-sm text-slate-500">Loading POS item sales…</div>}
      {isError && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load POS item sales.</div>}
      {!isLoading && !isError && data?.blockers?.length ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{data.blockers[0].message}</div> : null}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3 text-left">Item</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Qty Sold</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3 text-right">Discounts</th><th className="px-4 py-3 text-right">Net Sales</th><th className="px-4 py-3 text-right">Avg Price</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={`${row.sku}-${row.name}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><div className="font-bold text-slate-900">{row.name}</div>{row.sku && <div className="text-[10px] text-slate-400">{row.sku}</div>}</td>
                    <td className="px-4 py-3 text-slate-600">{row.category}</td>
                    <td className="px-4 py-3 text-right font-bold">{row.qtySold}</td>
                    <td className="px-4 py-3 text-right">{money(row.grossSales)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{money(row.discounts)}</td>
                    <td className="px-4 py-3 text-right font-black">{money(row.netSales)}</td>
                    <td className="px-4 py-3 text-right">{money(row.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">Meal-deal components such as included fries and drinks are excluded from commercial item sales here, but remain stored on each receipt for ingredient and stock usage reporting.</div>
        </div>
      )}
    </div>
  );
}

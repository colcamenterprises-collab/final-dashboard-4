import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw } from "lucide-react";

type FlagStatus = "normal" | "high" | "zero" | "insufficient";
type Cadence = "FAST_MOVING" | "MEDIUM_MOVING" | "SLOW_MOVING" | "INSUFFICIENT_HISTORY";

type ShiftLogItem = {
  itemId: number;
  itemName: string;
  category: string | null;
  quantities: Record<string, number>;
  totalQty: number;
  avgQty: number;
  purchaseCount: number;
  avgDaysBetweenOrders: number | null;
  cadenceClass: Cadence;
  baselineQty: number;
  confidence: "high" | "medium" | "low";
};

type ShiftLogResponse = {
  items: ShiftLogItem[];
  shifts: { id: string; date: string }[];
  dateRange: { start: string; end: string; preset: string };
  availableHistory: { minDate: string | null; maxDate: string | null; hasOlderThan30: boolean };
  flagsByItemByShift: Record<number, Record<string, FlagStatus>>;
  summary: {
    totalSpend: number;
    purchaseEvents: number;
    averageSpendPerEvent: number;
    topPurchasedItems: Array<{ itemName: string; value: number; basis: string }>;
    mostFrequentItems: Array<{ itemName: string; events: number }>;
    itemsNotRecentlyPurchasedButNormallyUsed: Array<{ itemName: string; cadence: Cadence; avgDaysBetween: number | null }>;
  };
  categoryBreakdown: Array<{ category: string; quantity: number; purchaseCount: number; spend: number; share: number }>;
  actionInsights: Array<{ type: string; message: string }>;
  stockReconciliation: Array<{
    shift_date: string;
    item_type: string;
    item_name: string;
    start_qty: number;
    purchased_qty: number;
    number_sold_qty: number;
    expected_end_qty: number;
    actual_end_qty: number;
    variance: number;
  }>;
  stockReviewPurchases: Array<{
    id: string;
    date: string;
    staff: string | null;
    supplier: string | null;
    amount_thb: number | null;
    notes: string | null;
    rolls_pcs: number | null;
    meat_grams: number | null;
  }>;
};

const today = new Date().toISOString().slice(0, 10);

function formatMoney(value: number) {
  return `฿${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PurchasingShiftLog() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState("");

  const query = useQuery<ShiftLogResponse>({
    queryKey: ["/api/purchasing-shift-log", preset, from, to],
    queryFn: async () => {
      const params = new URLSearchParams({ preset, to });
      if (preset === "custom" && from) params.set("from", from);
      const res = await fetch(`/api/purchasing-shift-log?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const data = query.data;
  const items = data?.items || [];
  const shifts = data?.shifts || [];

  const categories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(), [items]);

  const filteredItems = useMemo(() => {
    const rows = categoryFilter ? items.filter(i => i.category === categoryFilter) : items;
    return [...rows].sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [items, categoryFilter]);

  const getFlag = (itemId: number, shiftId: string): FlagStatus => data?.flagsByItemByShift?.[itemId]?.[shiftId] || "normal";
  const getFlagClass = (flag: FlagStatus) => {
    if (flag === "high") return "bg-red-100 text-red-700 font-semibold";
    if (flag === "zero") return "bg-amber-100 text-amber-700";
    if (flag === "insufficient") return "bg-slate-100 text-slate-500";
    return "text-slate-900";
  };

  if (query.isLoading) {
    return <div className="p-4 text-sm text-slate-500">Loading stock order history...</div>;
  }

  if (query.error) {
    return <div className="p-4 text-sm text-red-600">Failed to load stock order history.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Order History</h1>
          <p className="text-xs text-slate-500">Consolidated purchasing intelligence and reconciliation review.</p>
          <p className="text-xs text-slate-400 mt-1">
            Selected range: {formatDate(data!.dateRange.start)} - {formatDate(data!.dateRange.end)}
            {data?.availableHistory?.minDate && (
              <span> • Full history: {formatDate(data.availableHistory.minDate)} to {formatDate(data.availableHistory.maxDate || data.availableHistory.minDate)}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select value={preset} onChange={(e) => setPreset(e.target.value as any)} className="text-xs h-9 px-3 border rounded-[4px]">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
          {preset === "custom" && (
            <>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 text-xs w-[160px]" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 text-xs w-[160px]" />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`h-4 w-4 mr-1 ${query.isFetching ? "animate-spin" : ""}`} />Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Total Spend</div><div className="text-xl font-semibold">{formatMoney(data!.summary.totalSpend)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Purchase Events</div><div className="text-xl font-semibold">{data!.summary.purchaseEvents}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Average Spend / Event</div><div className="text-xl font-semibold">{formatMoney(data!.summary.averageSpendPerEvent)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Top Purchased Items</div><div className="text-sm mt-1">{data!.summary.topPurchasedItems.slice(0, 3).map(i => i.itemName).join(", ") || "No data"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Not Recently Purchased</div><div className="text-xl font-semibold">{data!.summary.itemsNotRecentlyPurchasedButNormallyUsed.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Action Insights</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          {data!.actionInsights.map((insight, idx) => <div key={`${insight.type}-${idx}`}>{insight.message}</div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b"><th className="text-left p-2">Category</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Purchase Events</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Share</th></tr></thead>
            <tbody>
              {data!.categoryBreakdown.map((row) => (
                <tr key={row.category} className="border-b border-slate-100">
                  <td className="p-2">{row.category}</td><td className="p-2 text-right">{row.quantity.toFixed(1)}</td><td className="p-2 text-right">{row.purchaseCount}</td><td className="p-2 text-right">{formatMoney(row.spend)}</td><td className="p-2 text-right">{(row.share * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-[4px] border-slate-200 overflow-hidden">
        <CardHeader className="py-3 px-4 bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-900">Order History Quantity Matrix</CardTitle>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-xs px-3 py-1 border rounded-[4px]">
            <option value="">All Categories</option>
            {categories.map(cat => <option key={cat} value={cat || ""}>{cat}</option>)}
          </select>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="min-w-full text-xs" data-testid="table-shift-log">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Cadence</th>
                {shifts.map(shift => <th key={shift.id} className="px-3 py-2 text-center whitespace-nowrap">{formatDate(shift.date)}</th>)}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.itemId} className="border-b border-slate-100">
                  <td className="px-3 py-2">{item.itemName}</td>
                  <td className="px-3 py-2">{item.category || "-"}</td>
                  <td className="px-3 py-2">{item.cadenceClass}</td>
                  {shifts.map((shift) => {
                    const qty = item.quantities[shift.id] || 0;
                    const flag = getFlag(item.itemId, shift.id);
                    return <td key={shift.id} className={`px-3 py-2 text-center ${getFlagClass(flag)}`}>{qty > 0 ? qty : "-"}</td>;
                  })}
                  <td className="px-3 py-2 text-right font-semibold">{item.totalQty.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Reconciliation Review (Moved from Stock Reconciliation)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b"><th className="p-2 text-left">Date</th><th className="p-2 text-left">Item</th><th className="p-2 text-right">Start</th><th className="p-2 text-right">Purchased</th><th className="p-2 text-right">Sold</th><th className="p-2 text-right">Expected End</th><th className="p-2 text-right">Actual End</th><th className="p-2 text-right">Variance</th></tr></thead>
            <tbody>
              {data!.stockReconciliation.map((row, idx) => (
                <tr key={`${row.shift_date}-${row.item_name}-${idx}`} className="border-b border-slate-100">
                  <td className="p-2">{row.shift_date}</td><td className="p-2">{row.item_name}</td><td className="p-2 text-right">{row.start_qty}</td><td className="p-2 text-right">{row.purchased_qty}</td><td className="p-2 text-right">{row.number_sold_qty}</td><td className="p-2 text-right">{row.expected_end_qty}</td><td className="p-2 text-right">{row.actual_end_qty}</td><td className="p-2 text-right">{row.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Purchase Tally Raw Detail (Moved from Stock Review context)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b"><th className="p-2 text-left">Date</th><th className="p-2 text-left">Staff</th><th className="p-2 text-left">Supplier</th><th className="p-2 text-right">Rolls</th><th className="p-2 text-right">Meat (g)</th><th className="p-2 text-right">Amount</th><th className="p-2 text-left">Notes</th></tr></thead>
            <tbody>
              {data!.stockReviewPurchases.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="p-2">{row.date}</td><td className="p-2">{row.staff || "NULL"}</td><td className="p-2">{row.supplier || "NULL"}</td><td className="p-2 text-right">{Number(row.rolls_pcs || 0)}</td><td className="p-2 text-right">{Number(row.meat_grams || 0)}</td><td className="p-2 text-right">{formatMoney(Number(row.amount_thb || 0))}</td><td className="p-2">{row.notes || "NULL"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

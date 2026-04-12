import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Pencil, Trash2, Plus, X, Check } from "lucide-react";

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

type TallyRow = {
  id: string;
  date: string;
  staff: string | null;
  supplier: string | null;
  amount_thb: number | null;
  notes: string | null;
  rolls_pcs: number | null;
  meat_grams: number | null;
};

type DrinkRow = {
  tally_id: string;
  date: string;
  staff: string | null;
  supplier: string | null;
  amount_thb: number | null;
  item_name: string;
  qty: number;
  unit: string;
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
  stockReviewPurchases: TallyRow[];
  drinksPurchases: DrinkRow[];
};

type EditState =
  | { type: "roll"; row: TallyRow }
  | { type: "meat"; row: TallyRow }
  | { type: "drink"; tallyId: string; rows: DrinkRow[] }
  | null;

const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

function formatMoney(value: number | null) {
  if (value == null) return "—";
  return `฿${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function generateMonthOptions(minDate: string | null, maxDate: string | null) {
  const start = minDate ? minDate.slice(0, 7) : currentMonth;
  const end = maxDate ? maxDate.slice(0, 7) : currentMonth;
  const months: string[] = [];
  let cur = end;
  while (cur >= start) {
    months.push(cur);
    const [y, m] = cur.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    cur = prev;
    if (months.length > 36) break;
  }
  return months;
}

// ─── Edit modal for Rolls / Meat ────────────────────────────────────────────
function TallyEditModal({
  type,
  row,
  onClose,
  onSaved,
}: {
  type: "roll" | "meat";
  row: TallyRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [staff, setStaff] = useState(row.staff || "");
  const [qty, setQty] = useState(
    type === "roll" ? String(row.rolls_pcs ?? "") : String(row.meat_grams ?? "")
  );
  const [amount, setAmount] = useState(row.amount_thb != null ? String(row.amount_thb) : "");

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        staff,
        amountTHB: amount ? Number(amount) : null,
      };
      if (type === "roll") body.rollsPcs = qty ? Number(qty) : null;
      else body.meatGrams = qty ? Number(qty) : null;
      const res = await fetch(`/api/purchase-tally/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchasing-shift-log"] });
      onSaved();
    },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/purchase-tally/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchasing-shift-log"] });
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[4px] border border-slate-200 shadow-lg w-[340px] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Edit {type === "roll" ? "Rolls" : "Meat"} Purchase</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="text-xs text-slate-400">{formatDate(row.date)}</div>
        <div className="space-y-2">
          <label className="block text-xs text-slate-500">Staff</label>
          <Input value={staff} onChange={e => setStaff(e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-slate-500">{type === "roll" ? "Rolls (pcs)" : "Meat (g)"}</label>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} className="text-xs h-8" />
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-slate-500">Amount (฿)</label>
          <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="text-xs h-8" placeholder="—" />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 text-xs">
            <Check className="h-3 w-3 mr-1" />{saveMut.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this entry?")) delMut.mutate(); }} disabled={delMut.isPending} className="text-xs">
            <Trash2 className="h-3 w-3 mr-1" />Delete
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit modal for Drinks ───────────────────────────────────────────────────
function DrinksEditModal({
  tallyId,
  rows,
  onClose,
  onSaved,
}: {
  tallyId: string;
  rows: DrinkRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const firstRow = rows[0];
  const [staff, setStaff] = useState(firstRow?.staff || "");
  const [amount, setAmount] = useState(firstRow?.amount_thb != null ? String(firstRow.amount_thb) : "");
  const [drinks, setDrinks] = useState<{ item_name: string; qty: string; unit: string }[]>(
    rows.map(r => ({ item_name: r.item_name, qty: String(r.qty), unit: r.unit }))
  );

  const updateDrink = (idx: number, field: "item_name" | "qty" | "unit", val: string) =>
    setDrinks(prev => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  const removeDrink = (idx: number) => setDrinks(prev => prev.filter((_, i) => i !== idx));

  const addDrink = () => setDrinks(prev => [...prev, { item_name: "", qty: "", unit: "pcs" }]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        staff,
        amountTHB: amount ? Number(amount) : null,
        drinks: drinks.filter(d => d.item_name && Number(d.qty) > 0).map(d => ({
          itemName: d.item_name,
          qty: Number(d.qty),
          unit: d.unit || "pcs",
        })),
      };
      const res = await fetch(`/api/purchase-tally/${tallyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchasing-shift-log"] });
      onSaved();
    },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/purchase-tally/${tallyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchasing-shift-log"] });
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-[4px] border border-slate-200 shadow-lg w-[400px] p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Edit Drinks Purchase</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        <div className="text-xs text-slate-400">{firstRow ? formatDate(firstRow.date) : ""}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="block text-xs text-slate-500">Staff</label>
            <Input value={staff} onChange={e => setStaff(e.target.value)} className="text-xs h-8" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-slate-500">Amount (฿)</label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="text-xs h-8" placeholder="—" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Drink Items</span>
            <button onClick={addDrink} className="text-xs text-emerald-600 flex items-center gap-1 hover:underline">
              <Plus className="h-3 w-3" />Add Item
            </button>
          </div>
          {drinks.map((d, idx) => (
            <div key={idx} className="flex gap-1 items-center">
              <Input value={d.item_name} onChange={e => updateDrink(idx, "item_name", e.target.value)} className="text-xs h-7 flex-1" placeholder="Item name" />
              <Input type="number" value={d.qty} onChange={e => updateDrink(idx, "qty", e.target.value)} className="text-xs h-7 w-14" placeholder="Qty" />
              <Input value={d.unit} onChange={e => updateDrink(idx, "unit", e.target.value)} className="text-xs h-7 w-12" placeholder="pcs" />
              <button onClick={() => removeDrink(idx)} className="text-slate-400 hover:text-red-600"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="flex-1 text-xs">
            <Check className="h-3 w-3 mr-1" />{saveMut.isPending ? "Saving..." : "Save"}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this drinks entry?")) delMut.mutate(); }} disabled={delMut.isPending} className="text-xs">
            <Trash2 className="h-3 w-3 mr-1" />Delete
          </Button>
          <Button size="sm" variant="outline" onClick={onClose} className="text-xs">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

const APPROVED_CATEGORIES = ['Drinks', 'Fresh Food', 'Frozen Food', 'Kitchen Supplies', 'Meat', 'Packaging', 'Shelf Items'];

export default function PurchasingShiftLog() {
  const [preset, setPreset] = useState<"7d" | "30d" | "90d" | "custom">("90d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tallyMonth, setTallyMonth] = useState(currentMonth);
  const [editState, setEditState] = useState<EditState>(null);

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

  const summary = data?.summary;
  const dateRange = data?.dateRange;
  const availableHistory = data?.availableHistory;
  const actionInsights = data?.actionInsights ?? [];
  const categoryBreakdown = data?.categoryBreakdown ?? [];
  const stockReconciliation = data?.stockReconciliation ?? [];
  const stockReviewPurchases = data?.stockReviewPurchases ?? [];
  const drinksPurchases = data?.drinksPurchases ?? [];

  const monthOptions = useMemo(
    () => generateMonthOptions(availableHistory?.minDate ?? null, availableHistory?.maxDate ?? null),
    [availableHistory]
  );

  const rollsPurchases = useMemo(
    () => stockReviewPurchases.filter(r => Number(r.rolls_pcs || 0) > 0 && r.date.slice(0, 7) === tallyMonth),
    [stockReviewPurchases, tallyMonth]
  );
  const meatPurchases = useMemo(
    () => stockReviewPurchases.filter(r => Number(r.meat_grams || 0) > 0 && r.date.slice(0, 7) === tallyMonth),
    [stockReviewPurchases, tallyMonth]
  );
  const drinksFiltered = useMemo(
    () => drinksPurchases.filter(r => r.date.slice(0, 7) === tallyMonth),
    [drinksPurchases, tallyMonth]
  );

  const drinksByTallyId = useMemo(() => {
    const map = new Map<string, DrinkRow[]>();
    for (const r of drinksFiltered) {
      if (!map.has(r.tally_id)) map.set(r.tally_id, []);
      map.get(r.tally_id)!.push(r);
    }
    return map;
  }, [drinksFiltered]);

  if (query.isLoading || !data) {
    return <div className="p-4 text-sm text-slate-500">Loading stock order history...</div>;
  }

  if (query.error) {
    return <div className="p-4 text-sm text-red-600">Failed to load stock order history.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      {editState && editState.type !== "drink" && (
        <TallyEditModal
          type={editState.type}
          row={editState.row}
          onClose={() => setEditState(null)}
          onSaved={() => setEditState(null)}
        />
      )}
      {editState && editState.type === "drink" && (
        <DrinksEditModal
          tallyId={editState.tallyId}
          rows={editState.rows}
          onClose={() => setEditState(null)}
          onSaved={() => setEditState(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Order History</h1>
          <p className="text-xs text-slate-500">Consolidated purchasing intelligence and reconciliation review.</p>
          <p className="text-xs text-slate-400 mt-1">
            {dateRange ? <>Selected range: {formatDate(dateRange.start)} - {formatDate(dateRange.end)}</> : null}
            {availableHistory?.minDate && (
              <span> • Full history: {formatDate(availableHistory.minDate)} to {formatDate(availableHistory.maxDate || availableHistory.minDate)}</span>
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

      {/* ── Month selector + 3 tally tables (FRONT AND CENTER) ────────────── */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
        <span className="text-xs font-medium text-slate-600">Viewing month:</span>
        <select
          value={tallyMonth}
          onChange={e => setTallyMonth(e.target.value)}
          className="text-xs h-8 px-3 border border-slate-200 rounded-[4px] bg-white"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{getMonthLabel(m)}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">
          {rollsPurchases.length + meatPurchases.length} tally entries · {drinksByTallyId.size} drink batches
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Rolls Purchases */}
        <Card>
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold">Rolls Purchases</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {rollsPurchases.length === 0 ? (
              <p className="text-xs text-slate-400 p-3">No rolls purchases for {getMonthLabel(tallyMonth)}.</p>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Staff</th>
                    <th className="p-2 text-right">Rolls</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rollsPurchases.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="p-2">{row.staff || "—"}</td>
                      <td className="p-2 text-right font-semibold">{Number(row.rolls_pcs)}</td>
                      <td className="p-2 text-right">{formatMoney(row.amount_thb)}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setEditState({ type: "roll", row })}
                          className="text-slate-400 hover:text-emerald-600"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Meat Purchases */}
        <Card>
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold">Meat Purchases</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {meatPurchases.length === 0 ? (
              <p className="text-xs text-slate-400 p-3">No meat purchases for {getMonthLabel(tallyMonth)}.</p>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Staff</th>
                    <th className="p-2 text-right">Meat (g)</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {meatPurchases.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 whitespace-nowrap">{formatDate(row.date)}</td>
                      <td className="p-2">{row.staff || "—"}</td>
                      <td className="p-2 text-right font-semibold">{Number(row.meat_grams).toLocaleString()}</td>
                      <td className="p-2 text-right">{formatMoney(row.amount_thb)}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => setEditState({ type: "meat", row })}
                          className="text-slate-400 hover:text-emerald-600"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Drinks Purchases */}
        <Card>
          <CardHeader className="py-3 px-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold">Drinks Purchases</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {drinksFiltered.length === 0 ? (
              <p className="text-xs text-slate-400 p-3">No drinks purchases for {getMonthLabel(tallyMonth)}.</p>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Staff</th>
                    <th className="p-2 text-left">Item</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {drinksFiltered.map((row, idx) => {
                    const isFirstOfTally = idx === 0 || drinksFiltered[idx - 1].tally_id !== row.tally_id;
                    return (
                      <tr key={`${row.tally_id}-${row.item_name}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2 whitespace-nowrap">{isFirstOfTally ? formatDate(row.date) : ""}</td>
                        <td className="p-2">{isFirstOfTally ? (row.staff || "—") : ""}</td>
                        <td className="p-2 font-medium">{row.item_name}</td>
                        <td className="p-2 text-right font-semibold">{Number(row.qty)}</td>
                        <td className="p-2">{row.unit}</td>
                        <td className="p-2 text-right">
                          {isFirstOfTally && (
                            <button
                              onClick={() => setEditState({
                                type: "drink",
                                tallyId: row.tally_id,
                                rows: drinksByTallyId.get(row.tally_id) || [row],
                              })}
                              className="text-slate-400 hover:text-emerald-600"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Summary metrics ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Total Spend</div><div className="text-xl font-semibold">{formatMoney(summary?.totalSpend ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Purchase Events</div><div className="text-xl font-semibold">{summary?.purchaseEvents ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Average Spend / Event</div><div className="text-xl font-semibold">{formatMoney(summary?.averageSpendPerEvent ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Top Purchased Items</div><div className="text-xs mt-1">{(summary?.topPurchasedItems ?? []).slice(0, 3).map(i => i.itemName).join(", ") || "No data"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-slate-500">Not Recently Purchased</div><div className="text-xl font-semibold">{(summary?.itemsNotRecentlyPurchasedButNormallyUsed ?? []).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Action Insights</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-700">
          {actionInsights.map((insight, idx) => <div key={`${insight.type}-${idx}`}>{insight.message}</div>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b"><th className="text-left p-2">Category</th><th className="text-right p-2">Qty</th><th className="text-right p-2">Purchase Events</th><th className="text-right p-2">Spend</th><th className="text-right p-2">Share</th></tr></thead>
            <tbody>
              {categoryBreakdown.map((row) => (
                <tr key={row.category} className="border-b border-slate-100">
                  <td className="p-2">{row.category}</td>
                  <td className="p-2 text-right">{row.quantity.toFixed(1)}</td>
                  <td className="p-2 text-right">{row.purchaseCount}</td>
                  <td className="p-2 text-right">{formatMoney(row.spend)}</td>
                  <td className="p-2 text-right">{(row.share * 100).toFixed(1)}%</td>
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
            {APPROVED_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
        <CardHeader className="pb-2"><CardTitle className="text-base">Reconciliation Review</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="border-b"><th className="p-2 text-left">Date</th><th className="p-2 text-left">Item</th><th className="p-2 text-right">Start</th><th className="p-2 text-right">Purchased</th><th className="p-2 text-right">Sold</th><th className="p-2 text-right">Expected End</th><th className="p-2 text-right">Actual End</th><th className="p-2 text-right">Variance</th></tr></thead>
            <tbody>
              {stockReconciliation.map((row, idx) => (
                <tr key={`${row.shift_date}-${row.item_name}-${idx}`} className="border-b border-slate-100">
                  <td className="p-2">{row.shift_date}</td><td className="p-2">{row.item_name}</td><td className="p-2 text-right">{row.start_qty}</td><td className="p-2 text-right">{row.purchased_qty}</td><td className="p-2 text-right">{row.number_sold_qty}</td><td className="p-2 text-right">{row.expected_end_qty}</td><td className="p-2 text-right">{row.actual_end_qty}</td><td className="p-2 text-right">{row.variance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

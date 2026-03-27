import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

type RollsRow = {
  id: string;
  date: string;
  createdAt: string;
  staff: string | null;
  supplier: string | null;
  quantity: number;
  amountThb: number;
  notes: string | null;
};

type MeatRow = {
  id: string;
  date: string;
  createdAt: string;
  staff: string | null;
  supplier: string | null;
  grams: number;
  amountThb: number;
  notes: string | null;
};

type DrinksRow = {
  id: string;
  date: string;
  createdAt: string;
  staff: string | null;
  supplier: string | null;
  amountThb: number;
  notes: string | null;
  items: Array<{ itemName: string; quantity: number; unit: string | null }>;
};

type PurchaseHistoryResponse = {
  ok: boolean;
  source: string[];
  filters: { from: string | null; to: string | null; limit: number };
  rolls: RollsRow[];
  meat: MeatRow[];
  drinks: DrinksRow[];
};

const today = new Date().toISOString().slice(0, 10);
const defaultFrom = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "NULL";
  return `฿${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "NULL";
}

export default function StockReview() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);

  const { data, isLoading, error } = useQuery<PurchaseHistoryResponse>({
    queryKey: ["/api/analysis/stock-review/purchase-history", from, to],
    queryFn: async () => {
      const res = await fetch(`/api/analysis/stock-review/purchase-history?from=${from}&to=${to}&limit=180`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const summary = useMemo(() => ({
    rollsCount: data?.rolls.length || 0,
    rollsQty: (data?.rolls || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    meatCount: data?.meat.length || 0,
    meatGrams: (data?.meat || []).reduce((sum, row) => sum + Number(row.grams || 0), 0),
    drinksCount: data?.drinks.length || 0,
    drinksUnits: (data?.drinks || []).reduce((sum, row) => sum + row.items.reduce((inner, item) => inner + Number(item.quantity || 0), 0), 0),
  }), [data]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold text-slate-900">Stock Review</h1>
        <p className="text-sm text-slate-500">
          Read-only purchase history sourced only from purchase_tally and purchase_tally_drink.
        </p>
      </div>

      <section className="rounded-[4px] border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">From</div>
            <input type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} className="w-full h-10 rounded-[4px] border border-slate-200 px-3 text-sm" />
          </label>
          <label className="block">
            <div className="text-xs text-slate-500 mb-1">To</div>
            <input type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} className="w-full h-10 rounded-[4px] border border-slate-200 px-3 text-sm" />
          </label>
          <div className="text-xs text-slate-600">Source: {(data?.source || ["purchase_tally", "purchase_tally_drink"]).join(", ")}</div>
          <div className="text-xs text-slate-600">Range: {formatDate(from)} → {formatDate(to)}</div>
        </div>
      </section>

      <section className="rounded-[4px] border border-slate-200 p-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>Rolls entries: <span className="font-medium">{summary.rollsCount}</span> | Units: <span className="font-medium">{summary.rollsQty}</span></div>
          <div>Meat entries: <span className="font-medium">{summary.meatCount}</span> | Grams: <span className="font-medium">{summary.meatGrams}</span></div>
          <div>Drinks entries: <span className="font-medium">{summary.drinksCount}</span> | Units: <span className="font-medium">{summary.drinksUnits}</span></div>
        </div>
      </section>

      {isLoading ? <div className="text-sm text-slate-500">Loading purchase history...</div> : null}
      {error ? <div className="text-sm text-red-600">Failed to load purchase history.</div> : null}

      <PurchaseTable
        title="Rolls Purchase History"
        emptyText="No rolls purchase history in this range."
        headers={["Date", "Staff", "Supplier", "Quantity", "Amount", "Notes"]}
        rows={(data?.rolls || []).map((row) => [
          formatDate(row.date),
          row.staff || "NULL",
          row.supplier || "NULL",
          String(row.quantity),
          formatMoney(row.amountThb),
          row.notes || "NULL",
        ])}
      />

      <PurchaseTable
        title="Meat Purchase History"
        emptyText="No meat purchase history in this range."
        headers={["Date", "Staff", "Supplier", "Grams", "Amount", "Notes"]}
        rows={(data?.meat || []).map((row) => [
          formatDate(row.date),
          row.staff || "NULL",
          row.supplier || "NULL",
          String(row.grams),
          formatMoney(row.amountThb),
          row.notes || "NULL",
        ])}
      />

      <PurchaseTable
        title="Drinks Purchase History"
        emptyText="No drinks purchase history in this range."
        headers={["Date", "Staff", "Supplier", "Items", "Amount", "Notes"]}
        rows={(data?.drinks || []).map((row) => [
          formatDate(row.date),
          row.staff || "NULL",
          row.supplier || "NULL",
          row.items.length > 0 ? row.items.map((item) => `${item.itemName}: ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`).join(" | ") : "NULL",
          formatMoney(row.amountThb),
          row.notes || "NULL",
        ])}
      />
    </div>
  );
}

function PurchaseTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  emptyText: string;
}) {
  return (
    <section className="rounded-[4px] border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">{title}</div>
      {rows.length === 0 ? (
        <div className="p-4 text-sm text-slate-500">{emptyText}</div>
      ) : (
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                {headers.map((header) => (
                  <th key={header} className="text-left p-3 font-medium text-slate-600">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="border-b border-slate-100 hover:bg-slate-100/40">
                  {row.map((value, cellIndex) => (
                    <td key={`${title}-${index}-${cellIndex}`} className="p-3 align-top">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

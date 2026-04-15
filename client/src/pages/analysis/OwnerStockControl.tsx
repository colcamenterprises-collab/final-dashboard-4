import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePinAuth } from "@/components/PinLoginGate";

type StockFlag = "Normal" | "Low Stock" | "Stock Loss" | "Unnecessary Purchase" | "High Risk" | "Needs Review";

type EngineRow = {
  item: string;
  sourceType: "live" | "manual";
  unit: string;
  opening: number | null;
  purchased: number | null;
  usage: number | null;
  expectedClosing: number | null;
  actualClosing: number | null;
  purchaseRequest: number | null;
  variance: number | null;
  minimumThreshold: number;
  flag: StockFlag;
  riskScore: number;
  notes: string[];
};

type ApiResponse = {
  ok: boolean;
  date: string;
  shiftLabel: string | null;
  liveRows: EngineRow[];
  rows: EngineRow[];
  manualInputs: Array<{
    itemName: string;
    closingCount: number | null;
    openingOverride: number | null;
    purchaseCorrection: number | null;
    note: string | null;
    updatedAt: string;
    updatedBy: string | null;
  }>;
  summary: {
    highRisk: string[];
    stockLoss: string[];
    unnecessaryPurchase: string[];
    lowStock: string[];
    needsReview: string[];
  };
};

const MANUAL_ITEMS = ["Bacon Short", "Bacon Long", "Sweet Potato Fries", "French Fries", "Chicken Fillets", "Karaage Chicken", "Chicken Nuggets"];
const TODAY = new Date().toISOString().slice(0, 10);

const numberOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function fmt(v: number | null) {
  return v == null ? "NULL" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function OwnerStockControl() {
  const { currentUser } = usePinAuth();
  const [date, setDate] = useState(TODAY);
  const [shift, setShift] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [flagFilter, setFlagFilter] = useState<"all" | StockFlag>("all");
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "variance" | "risk" | "item">("newest");
  const [manualDraft, setManualDraft] = useState<Record<string, { closingCount: string; openingOverride: string; purchaseCorrection: string; note: string }>>({});

  const { data, isLoading, refetch } = useQuery<ApiResponse>({
    queryKey: ["/api/analysis/owner-stock-control", date, shift],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (shift.trim()) params.set("shift", shift.trim());
      const res = await fetch(`/api/analysis/owner-stock-control?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = MANUAL_ITEMS.map((itemName) => {
        const draft = manualDraft[itemName] || { closingCount: "", openingOverride: "", purchaseCorrection: "", note: "" };
        return {
          itemName,
          closingCount: numberOrNull(draft.closingCount),
          openingOverride: numberOrNull(draft.openingOverride),
          purchaseCorrection: numberOrNull(draft.purchaseCorrection),
          note: draft.note.trim() ? draft.note.trim() : null,
        };
      });

      const res = await fetch("/api/analysis/owner-stock-control/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, shift: shift.trim() || null, entries }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<ApiResponse>;
    },
    onSuccess: () => {
      refetch();
    },
  });

  const manualByItem = useMemo(() => {
    const map = new Map<string, ApiResponse["manualInputs"][number]>();
    for (const row of data?.manualInputs || []) map.set(row.itemName, row);
    return map;
  }, [data]);

  const rows = useMemo(() => {
    let list = [...(data?.rows || [])];
    if (itemFilter.trim()) list = list.filter((r) => r.item.toLowerCase().includes(itemFilter.toLowerCase()));
    if (flagFilter !== "all") list = list.filter((r) => r.flag === flagFilter);
    if (highRiskOnly) list = list.filter((r) => r.flag === "High Risk");

    list.sort((a, b) => {
      if (sortBy === "variance") return Math.abs(b.variance || 0) - Math.abs(a.variance || 0);
      if (sortBy === "risk") return b.riskScore - a.riskScore;
      if (sortBy === "item") return a.item.localeCompare(b.item);
      return b.item.localeCompare(a.item);
    });

    return list;
  }, [data, flagFilter, highRiskOnly, itemFilter, sortBy]);

  if (!currentUser || currentUser.role !== "owner") {
    return <div className="p-4 text-sm text-red-600">Owner access required.</div>;
  }

  return (
    <div className="p-4 space-y-4" data-testid="owner-stock-control-page">
      <h1 className="text-2xl font-semibold text-slate-900">Owner Hybrid Stock Control (Temporary)</h1>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold text-sm mb-2">Header / Shift Selector</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs text-slate-600">Date
            <input className="block mt-1 w-full h-9 border rounded px-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-xs text-slate-600">Shift Label (optional)
            <input className="block mt-1 w-full h-9 border rounded px-2" placeholder="e.g. Dinner" value={shift} onChange={(e) => setShift(e.target.value)} />
          </label>
          <button className="h-9 mt-5 border rounded bg-slate-900 text-white px-3" onClick={() => refetch()} type="button">Load Shift</button>
        </div>
      </section>

      <section className="rounded border border-slate-200 p-4 overflow-x-auto">
        <h2 className="font-semibold text-sm mb-2">Live Pulled Stock (Rolls / Meat / Drinks)</h2>
        <table className="w-full text-xs">
          <thead><tr className="border-b"><th className="text-left p-2">Item</th><th className="p-2 text-right">Opening</th><th className="p-2 text-right">Purchases</th><th className="p-2 text-right">Usage</th><th className="p-2 text-right">Live Closing</th><th className="p-2 text-right">Purchase Request</th><th className="p-2 text-right">Expected</th><th className="p-2 text-right">Variance</th><th className="p-2 text-left">Flag</th></tr></thead>
          <tbody>
            {(data?.liveRows || []).map((row) => (
              <tr key={`live-${row.item}`} className="border-b">
                <td className="p-2">{row.item}</td><td className="p-2 text-right">{fmt(row.opening)}</td><td className="p-2 text-right">{fmt(row.purchased)}</td><td className="p-2 text-right">{fmt(row.usage)}</td><td className="p-2 text-right">{fmt(row.actualClosing)}</td><td className="p-2 text-right">{fmt(row.purchaseRequest)}</td><td className="p-2 text-right">{fmt(row.expectedClosing)}</td><td className="p-2 text-right">{fmt(row.variance)}</td><td className="p-2">{row.flag}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold text-sm mb-2">Owner Manual Stock Input</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b"><th className="text-left p-2">Item</th><th className="p-2">Closing Count</th><th className="p-2">Opening Override</th><th className="p-2">Purchase Correction</th><th className="p-2">Note</th></tr></thead>
            <tbody>
              {MANUAL_ITEMS.map((item) => {
                const existing = manualByItem.get(item);
                const draft = manualDraft[item] || {
                  closingCount: existing?.closingCount?.toString() || "",
                  openingOverride: existing?.openingOverride?.toString() || "",
                  purchaseCorrection: existing?.purchaseCorrection?.toString() || "",
                  note: existing?.note || "",
                };
                return (
                  <tr key={item} className="border-b">
                    <td className="p-2">{item}</td>
                    <td className="p-2"><input className="w-28 border rounded px-2 h-8" value={draft.closingCount} onChange={(e) => setManualDraft((p) => ({ ...p, [item]: { ...draft, closingCount: e.target.value } }))} /></td>
                    <td className="p-2"><input className="w-28 border rounded px-2 h-8" value={draft.openingOverride} onChange={(e) => setManualDraft((p) => ({ ...p, [item]: { ...draft, openingOverride: e.target.value } }))} /></td>
                    <td className="p-2"><input className="w-28 border rounded px-2 h-8" value={draft.purchaseCorrection} onChange={(e) => setManualDraft((p) => ({ ...p, [item]: { ...draft, purchaseCorrection: e.target.value } }))} /></td>
                    <td className="p-2"><input className="w-full min-w-60 border rounded px-2 h-8" value={draft.note} onChange={(e) => setManualDraft((p) => ({ ...p, [item]: { ...draft, note: e.target.value } }))} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="mt-3 h-9 border rounded bg-slate-900 text-white px-3" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving..." : "Save Manual Entries"}</button>
      </section>

      <section className="rounded border border-slate-200 p-4">
        <h2 className="font-semibold text-sm mb-2">Engine Results (Unified)</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3 text-xs">
          <input className="h-8 border rounded px-2" placeholder="Filter item" value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} />
          <select className="h-8 border rounded px-2" value={flagFilter} onChange={(e) => setFlagFilter(e.target.value as any)}>
            <option value="all">All Flags</option><option value="High Risk">High Risk</option><option value="Stock Loss">Stock Loss</option><option value="Unnecessary Purchase">Unnecessary Purchase</option><option value="Low Stock">Low Stock</option><option value="Needs Review">Needs Review</option><option value="Normal">Normal</option>
          </select>
          <label className="h-8 border rounded px-2 flex items-center gap-2"><input type="checkbox" checked={highRiskOnly} onChange={(e) => setHighRiskOnly(e.target.checked)} />High Risk only</label>
          <select className="h-8 border rounded px-2" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="newest">Newest first</option><option value="variance">Highest variance</option><option value="risk">Highest risk</option><option value="item">Item name</option>
          </select>
          <button className="h-8 border rounded px-2" type="button" onClick={() => refetch()}>Refresh</button>
        </div>
        {isLoading ? <div className="text-xs text-slate-500">Loading...</div> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b"><th className="text-left p-2">Item</th><th className="p-2">Source</th><th className="p-2 text-right">Opening</th><th className="p-2 text-right">Purchased</th><th className="p-2 text-right">Usage</th><th className="p-2 text-right">Expected</th><th className="p-2 text-right">Actual</th><th className="p-2 text-right">Request</th><th className="p-2 text-right">Variance</th><th className="p-2 text-right">Min</th><th className="p-2">Flag</th><th className="p-2 text-right">Risk</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.sourceType}-${row.item}`} className="border-b">
                  <td className="p-2">{row.item}</td><td className="p-2">{row.sourceType === "live" ? "Live staff form data" : "Owner manual entry"}</td><td className="p-2 text-right">{fmt(row.opening)}</td><td className="p-2 text-right">{fmt(row.purchased)}</td><td className="p-2 text-right">{fmt(row.usage)}</td><td className="p-2 text-right">{fmt(row.expectedClosing)}</td><td className="p-2 text-right">{fmt(row.actualClosing)}</td><td className="p-2 text-right">{fmt(row.purchaseRequest)}</td><td className="p-2 text-right">{fmt(row.variance)}</td><td className="p-2 text-right">{fmt(row.minimumThreshold)}</td><td className="p-2">{row.flag}</td><td className="p-2 text-right">{row.riskScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded border border-slate-200 p-4 text-xs">
        <h2 className="font-semibold text-sm mb-2">Flag Summary</h2>
        <div>High Risk: {(data?.summary.highRisk || []).join(", ") || "None"}</div>
        <div>Stock Loss: {(data?.summary.stockLoss || []).join(", ") || "None"}</div>
        <div>Unnecessary Purchase: {(data?.summary.unnecessaryPurchase || []).join(", ") || "None"}</div>
        <div>Low Stock: {(data?.summary.lowStock || []).join(", ") || "None"}</div>
        <div>Needs Review: {(data?.summary.needsReview || []).join(", ") || "None"}</div>
      </section>
    </div>
  );
}

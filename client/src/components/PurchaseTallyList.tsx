import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { PurchaseTallyModal } from "./PurchaseTallyModal";
import { SectionTitle } from "@/components/ui/sbb-cards";

// DD/MM/YYYY from any ISO date string
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const parts = String(s).slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : s;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `฿${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  hideHeader?: boolean;
}

export function PurchaseTallyList({ hideHeader }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["/api/purchase-tally", { month, search }],
    queryFn: () => apiRequest("/api/purchase-tally?" + new URLSearchParams({
      month,
      ...(search && { search }),
      limit: "100",
    })),
  });

  const { data: summaryData } = useQuery({
    queryKey: ["/api/purchase-tally/summary", { month }],
    queryFn: () => apiRequest("/api/purchase-tally/summary?" + new URLSearchParams({ month })),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/purchase-tally/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally/summary"] });
      toast({ title: "Purchase deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting purchase", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (entry: any) => { setEditingEntry(entry); setIsModalOpen(true); };
  const handleDelete = (id: string) => { if (confirm("Delete this purchase?")) deleteMutation.mutate(id); };
  const handleCloseModal = () => { setIsModalOpen(false); setEditingEntry(null); };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const entries = entriesData?.entries ?? [];
  const summary = summaryData?.summary ?? {};

  return (
    <div className="space-y-5">

      {/* Header (suppressed when page title handles it) */}
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <SectionTitle title="Purchase Tally" subtitle="Track daily purchases separately from forms" />
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#111111] text-white px-4 py-2 text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Purchase
          </button>
        </div>
      )}

      {/* Top action bar when header is hidden */}
      {hideHeader && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#111111] text-white px-4 py-2 text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Purchase
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Total Amount",  value: `฿${Number(summary.totalAmount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, sub: `${summary.entryCount || 0} entries`, colour: "bg-blue-50 border-blue-100" },
          { label: "Rolls",         value: `${summary.totalRolls || 0} pcs`,                                                               sub: "",                              colour: "bg-purple-50 border-purple-100" },
          { label: "Meat",          value: `${Number(summary.totalMeat || 0).toLocaleString()} g`,                                         sub: "",                              colour: "bg-emerald-50 border-emerald-100" },
          { label: "Drinks",        value: `${summary.totalDrinks || 0} pcs`,                                                              sub: "",                              colour: "bg-amber-50 border-amber-100" },
          { label: "Fries",         value: `${Number(summary.totalFries || 0).toLocaleString()} g`,                                        sub: "",                              colour: "bg-orange-50 border-orange-100" },
          { label: "Sweet Potato",  value: `${Number(summary.totalSweetPotato || 0).toLocaleString()} g`,                                  sub: "",                              colour: "bg-pink-50 border-pink-100" },
        ].map(({ label, value, sub, colour }) => (
          <div key={label} className={`rounded-2xl border p-4 shadow-sm ${colour}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
            {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div className="shrink-0">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Month</label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-40 rounded-xl border-slate-200 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Search</label>
          <Input
            placeholder="Search supplier, staff, or notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border-slate-200 text-xs"
          />
        </div>
      </div>

      {/* Entries table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No purchase tallies found. Click <strong>Add Purchase</strong> to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Date", "Supplier", "Rolls", "Meat (g)", "Fries (g)", "Sw. Potato (g)", "Drinks", "Amount", "Notes", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 font-semibold text-slate-600 uppercase tracking-wide text-[10px] ${
                        i >= 2 && i <= 7 ? "text-right" : i === 9 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any, idx: number) => (
                  <React.Fragment key={entry.id}>
                    <tr className={`border-b border-slate-100 last:border-0 hover:bg-blue-50/20 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"}`}>
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{fmtDate(entry.date)}</td>
                      <td className="px-4 py-2.5">
                        {entry.supplier
                          ? <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{entry.supplier}</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{entry.rollsPcs || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{entry.meatGrams ? Number(entry.meatGrams).toLocaleString() : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{entry.friesGrams ? Number(entry.friesGrams).toLocaleString() : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{entry.sweetPotatoGrams ? Number(entry.sweetPotatoGrams).toLocaleString() : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {entry.drinks && entry.drinks.length > 0 ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-slate-700">{entry.drinks.reduce((s: number, d: any) => s + d.qty, 0)} pcs</span>
                            <button
                              onClick={() => toggleRow(entry.id)}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-200 transition-colors"
                            >
                              {expandedRows.has(entry.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </button>
                          </div>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {entry.amountTHB ? fmt(Number(entry.amountTHB)) : "—"}
                      </td>
                      <td className="px-4 py-2.5 max-w-[140px] truncate text-slate-500">{entry.notes || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleteMutation.isPending}
                            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedRows.has(entry.id) && entry.drinks && entry.drinks.length > 0 && (
                      <tr>
                        <td colSpan={10} className="bg-blue-50/40 px-8 py-3 border-b border-slate-100">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Drinks breakdown</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                            {entry.drinks.map((drink: any, idx: number) => (
                              <div key={idx} className="flex justify-between rounded-lg bg-white border border-blue-100 px-3 py-1.5 text-xs">
                                <span className="text-slate-700">{drink.itemName}</span>
                                <span className="font-semibold text-slate-900">{drink.qty} {drink.unit || "pcs"}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseTallyModal
        open={isModalOpen}
        onClose={handleCloseModal}
        entry={editingEntry}
      />
    </div>
  );
}

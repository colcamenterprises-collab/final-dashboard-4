import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type PersonalTransaction = {
  id: string;
  batchId?: string;
  postedAt: string;
  description: string;
  amountTHB: string | number;
  ref?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

function money(value: string | number) {
  return `฿${Math.abs(Number(value || 0)).toLocaleString("en-TH", { maximumFractionDigits: 2 })}`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function PersonalExpensesTable({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const queryClient = useQueryClient();
  const [exportedIds, setExportedIds] = useState<string[]>([]);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/bank-imports/review-queue", "personal", dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch("/api/bank-imports/review-queue?tab=personal&limit=1000");
      if (!response.ok) throw new Error("Failed to load personal expenses");
      return response.json();
    },
  });

  const rows = useMemo(() => {
    const all: PersonalTransaction[] = data?.txns || [];
    return all.filter((row) => {
      const date = row.postedAt?.slice(0, 10) || "";
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    });
  }, [data, dateFrom, dateTo]);

  const deleteExported = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const response = await fetch(`/api/bank-imports/txns/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to delete exported personal transaction");
      }
    },
    onSuccess: () => {
      setExportedIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard"] });
    },
  });

  const exportCsv = () => {
    if (!rows.length) return;
    const csvRows = [
      ["Date", "Description", "Amount THB", "Reference", "Batch ID"],
      ...rows.map((row) => [row.postedAt?.slice(0, 10) || "", row.description, Math.abs(Number(row.amountTHB || 0)).toFixed(2), row.ref || "", row.batchId || ""]),
    ];
    const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `personal-expenses-${dateFrom || "all"}-to-${dateTo || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportedIds(rows.map((row) => row.id));
  };

  const removeExported = () => {
    if (!exportedIds.length) return;
    if (window.confirm(`Delete ${exportedIds.length} exported personal transaction(s)?`)) {
      deleteExported.mutate(exportedIds);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Table 4 — Personal Expenses</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length || isLoading}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={removeExported} disabled={!exportedIds.length || deleteExported.isPending}>
            <Trash2 className="mr-2 h-4 w-4" />Delete Exported
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[760px] text-xs">
          <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Export Status</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Loading personal expenses...</td></tr>}
            {!isLoading && !rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No personal expenses found for this date range.</td></tr>}
            {rows.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.postedAt)}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2">{row.ref || "—"}</td><td className="px-3 py-2 font-mono text-[10px]">{row.batchId || "—"}</td><td className="px-3 py-2 text-right font-mono">{money(row.amountTHB)}</td><td className="px-3 py-2">{exportedIds.includes(row.id) ? "Exported" : "Ready"}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

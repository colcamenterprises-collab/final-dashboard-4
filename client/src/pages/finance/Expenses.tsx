import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search } from "lucide-react";

interface Expense {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  supplier: string;
  paymentMethod: string;
  month: number;
  year: number;
  source: string;
  sourceLabel: string;
}

function formatDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()}`;
}

export default function Expenses() {
  const [search, setSearch] = useState("");

  const { data: expenses = [], isLoading, isError } = useQuery<Expense[]>({
    queryKey: ["/api/expensesV2"],
  });

  const filtered = expenses.filter(
    (e) =>
      (e.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.supplier || "").toLowerCase().includes(search.toLowerCase()) ||
      (e.category || "").toLowerCase().includes(search.toLowerCase())
  );

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Expenses</h1>
          <p className="text-xs text-slate-500">{expenses.length} records</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">Filtered Total</p>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            ฿{total.toLocaleString("en-TH", { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search description, supplier, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {isLoading && (
        <div className="text-center py-12 text-slate-400 text-xs">Loading expenses...</div>
      )}
      {isError && (
        <div className="text-center py-12 text-red-500 text-xs">Failed to load expenses.</div>
      )}

      {!isLoading && !isError && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Description</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Supplier</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Category</th>
                <th className="text-left px-3 py-2 font-medium text-slate-500">Source</th>
                <th className="text-right px-3 py-2 font-medium text-slate-500">Amount (฿)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                    No expenses found.
                  </td>
                </tr>
              )}
              {filtered.map((exp, idx) => (
                <tr
                  key={exp.id}
                  className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"
                  }`}
                >
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{formatDate(exp.date)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{exp.description || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{exp.supplier || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{exp.category || "—"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{exp.sourceLabel || exp.source || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {(exp.amount || 0).toLocaleString("en-TH", { minimumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

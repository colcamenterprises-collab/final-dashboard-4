import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Upload } from "lucide-react";

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

function weekKey(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  return `${date.getFullYear()}-W${String(Math.ceil((days + firstDay.getDay() + 1) / 7)).padStart(2, "0")}`;
}

export default function Expenses() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [month, setMonth] = useState("");
  const [week, setWeek] = useState("");
  const [category, setCategory] = useState("");
  const [supplier, setSupplier] = useState("");
  const [source, setSource] = useState("");

  const { data: expenses = [], isLoading, isError } = useQuery<Expense[]>({
    queryKey: ["/api/expensesV2"],
  });

  const categoryOptions = useMemo(() => Array.from(new Set(expenses.map(e => e.category).filter(Boolean))).sort(), [expenses]);
  const supplierOptions = useMemo(() => Array.from(new Set(expenses.map(e => e.supplier).filter(Boolean))).sort(), [expenses]);
  const sourceOptions = useMemo(() => Array.from(new Set(expenses.map(e => e.sourceLabel || e.source).filter(Boolean))).sort(), [expenses]);

  const filtered = expenses.filter((e) => {
    const expDate = e.date ? new Date(e.date) : null;
    const haystack = `${e.description || ""} ${e.supplier || ""} ${e.category || ""}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (dateFrom && expDate && expDate < new Date(`${dateFrom}T00:00:00`)) return false;
    if (dateTo && expDate && expDate > new Date(`${dateTo}T23:59:59`)) return false;
    if (month && e.date?.slice(0, 7) !== month) return false;
    if (week && weekKey(e.date) !== week) return false;
    if (category && e.category !== category) return false;
    if (supplier && e.supplier !== supplier) return false;
    if (source && (e.sourceLabel || e.source) !== source) return false;
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Expenses</h1>
          <p className="text-xs text-slate-500">{expenses.length} records</p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => navigate("/finance/expenses-import")}>
            <Upload className="h-4 w-4 mr-2" />
            Import Bank Statement
          </Button>
          <div className="text-right">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Filtered Total</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              ฿{total.toLocaleString("en-TH", { minimumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search description, supplier, category..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 text-xs" />
        </div>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs" aria-label="Date from" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs" aria-label="Date to" />
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="text-xs" aria-label="Month" />
        <Input type="week" value={week} onChange={(e) => setWeek(e.target.value)} className="text-xs" aria-label="Week" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All categories/types</option>
          {categoryOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All suppliers</option>
          {supplierOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 py-2 text-xs">
          <option value="">All sources</option>
          {sourceOptions.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      {isLoading && <div className="text-center py-12 text-slate-400 text-xs">Loading expenses...</div>}
      {isError && <div className="text-center py-12 text-red-500 text-xs">Failed to load expenses.</div>}

      {!isLoading && !isError && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"><th className="text-left px-3 py-2 font-medium text-slate-500">Date</th><th className="text-left px-3 py-2 font-medium text-slate-500">Description</th><th className="text-left px-3 py-2 font-medium text-slate-500">Supplier</th><th className="text-left px-3 py-2 font-medium text-slate-500">Category</th><th className="text-left px-3 py-2 font-medium text-slate-500">Source</th><th className="text-right px-3 py-2 font-medium text-slate-500">Amount (฿)</th></tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No expenses found.</td></tr>}
              {filtered.map((exp, idx) => (
                <tr key={exp.id} className={`border-b border-slate-100 dark:border-slate-800 last:border-0 ${idx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"}`}>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{formatDate(exp.date)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{exp.description || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{exp.supplier || "—"}</td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[10px] px-1.5 py-0">{exp.category || "—"}</Badge></td>
                  <td className="px-3 py-2 text-slate-400">{exp.sourceLabel || exp.source || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">{(exp.amount || 0).toLocaleString("en-TH", { minimumFractionDigits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

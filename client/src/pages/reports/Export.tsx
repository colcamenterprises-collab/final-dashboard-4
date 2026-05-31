import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, FileText, BarChart2, ShoppingBag, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExportOption {
  id: string;
  label: string;
  description: string;
  endpoint: string;
  params?: Record<string, string>;
  icon: "sales" | "receipts" | "expenses" | "analysis" | "ingredients";
  available: boolean;
  note?: string;
}

const ICON_MAP = {
  sales: BarChart2,
  receipts: FileText,
  expenses: FileText,
  analysis: BarChart2,
  ingredients: ShoppingBag,
};

function fmt(s: string) {
  return `฿${Number(s).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Export() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dlError, setDlError] = useState("");

  const EXPORT_OPTIONS: ExportOption[] = [
    {
      id: "daily-sales-csv",
      label: "Daily Sales CSV",
      description: "Export daily sales summary data as CSV",
      endpoint: "/api/analysis/daily-sales/export.csv",
      icon: "sales",
      available: true,
    },
    {
      id: "shift-reports",
      label: "Shift Reports",
      description: "View shift-by-shift financial summaries",
      endpoint: "/api/shift-report/history",
      icon: "receipts",
      available: true,
      note: "Requires reports to be generated first",
    },
    {
      id: "expenses-list",
      label: "Expenses Data",
      description: "Export expense records",
      endpoint: "/api/expensesV2",
      icon: "expenses",
      available: true,
    },
    {
      id: "ingredients",
      label: "Ingredients List",
      description: "Export ingredient stock and cost data",
      endpoint: "/api/ingredients",
      icon: "ingredients",
      available: true,
    },
  ];

  const handleDownload = async (opt: ExportOption) => {
    setDownloading(opt.id);
    setDlError("");
    try {
      const url = opt.endpoint + (opt.params ? "?" + new URLSearchParams(opt.params).toString() : "");
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `HTTP ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || "";
      const blob = await res.blob();
      const a = document.createElement("a");
      const ext = contentType.includes("csv") ? "csv" : "json";
      a.href = URL.createObjectURL(blob);
      a.download = `${opt.id}-${dateFrom}-to-${dateTo}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setDlError(`${opt.label}: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const { data: salesPreview, isLoading: salesLoading } = useQuery<unknown[]>({
    queryKey: ["/api/analysis/daily-sales/export.csv"],
    select: (d) => Array.isArray(d) ? d : [],
    retry: 0,
  });

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Download className="h-5 w-5 text-slate-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Export Data</h1>
          <p className="text-xs text-slate-500">Download reports and data as CSV or JSON</p>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 space-y-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Date Range</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">From</label>
            <input
              type="date"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">To</label>
            <input
              type="date"
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {dlError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{dlError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {EXPORT_OPTIONS.map((opt) => {
          const Icon = ICON_MAP[opt.icon];
          const isActive = downloading === opt.id;
          return (
            <div
              key={opt.id}
              className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 space-y-2"
            >
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-white">{opt.label}</p>
                  <p className="text-[10px] text-slate-400 leading-tight">{opt.description}</p>
                </div>
              </div>
              {opt.note && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">{opt.note}</p>
              )}
              <button
                onClick={() => handleDownload(opt)}
                disabled={!opt.available || isActive}
                className="w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
              >
                <Download className="h-3 w-3" />
                {isActive ? "Downloading..." : "Download"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Full Export Access</p>
        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
          Secured exports (daily sales V2, POS receipts) require the <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">EXPORT_KEY</code> environment variable. Contact your system administrator to enable them.
        </p>
      </div>
    </div>
  );
}

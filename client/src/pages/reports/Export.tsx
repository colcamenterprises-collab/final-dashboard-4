import { useState } from "react";
import { Download, Database, AlertTriangle } from "lucide-react";

const DATASETS = [
  { id: "menu", label: "Menu Items", description: "Products, categories, pricing and availability" },
  { id: "modifiers", label: "Modifiers", description: "Modifier groups, options, pricing and item relationships" },
  { id: "recipes-costings", label: "Recipes & Costings", description: "Recipes, ingredients, quantities, yields and costs" },
  { id: "expenses", label: "Expenses", description: "Historical expenses with categories and suppliers" },
  { id: "purchasing", label: "Purchasing Lists", description: "Purchasing catalogue, suppliers, pack sizes and costs" },
] as const;

function downloadUrl(id: string) {
  return `/api/data-export/${id}.csv`;
}

export default function Export() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const download = async (id: string, clearError = true) => {
    setDownloading(id);
    if (clearError) setError("");
    try {
      const response = await fetch(downloadUrl(id), { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Export failed (HTTP ${response.status})`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || `sbb-${id}.csv`;
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (e: any) {
      setError(e.message || "Export failed");
      throw e;
    } finally {
      setDownloading(null);
    }
  };

  const downloadPack = async () => {
    setError("");
    for (const dataset of DATASETS) {
      try {
        await download(dataset.id, false);
      } catch {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Database className="h-5 w-5 text-slate-500" />
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Export Data</h1>
          <p className="text-xs text-slate-500">Download your restaurant data as standard CSV files.</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <button
        onClick={downloadPack}
        disabled={downloading !== null}
        className="w-full rounded-xl bg-slate-950 text-white dark:bg-white dark:text-slate-950 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        Download Migration Pack
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DATASETS.map((dataset) => (
          <div key={dataset.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{dataset.label}</p>
            <p className="text-xs text-slate-500 mt-1 min-h-8">{dataset.description}</p>
            <button
              onClick={() => download(dataset.id)}
              disabled={downloading !== null}
              className="mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading === dataset.id ? "Downloading..." : "Download CSV"}
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500">
        These files use the same customer export path as any restaurant moving data into Customli. Upload each CSV through V3 Import Data, review the suggested column mapping, validate, then commit.
      </p>
    </div>
  );
}

import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Upload, FileText, CheckCircle, AlertCircle, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";

const AUTH_HEADERS = {
  "x-restaurant-id": "sbb",
  "x-user-id": "manager",
  "x-user-role": "manager",
};

interface ImportedRow {
  id?: number;
  date?: string;
  description?: string;
  amount?: number;
  amountTHB?: number;
  category?: string;
  status?: string;
  [key: string]: unknown;
}

interface BatchResponse {
  batch?: { id: string; status: string; importedAt?: string };
  transactions?: ImportedRow[];
  rows?: ImportedRow[];
  message?: string;
  error?: string;
}

async function uploadCSV(file: File): Promise<BatchResponse> {
  const body = new FormData();
  body.append("csv", file);
  const res = await fetch("/api/bank-imports", {
    method: "POST",
    headers: AUTH_HEADERS,
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function fetchBatches(): Promise<{ batches?: Array<{ id: string; createdAt?: string; status?: string; txnCount?: number }> }> {
  const res = await fetch("/api/bank-imports", { headers: AUTH_HEADERS });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function FmtDate(s?: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB"); } catch { return s; }
}

export default function ExpensesImport() {
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadResult, setUploadResult] = useState<BatchResponse | null>(null);

  const { data: batchesData, isLoading: loadingBatches, refetch: refetchBatches } = useQuery({
    queryKey: ["bank-import-batches"],
    queryFn: fetchBatches,
    retry: 1,
  });

  const batchDetailQuery = useQuery({
    queryKey: ["bank-import-batch", selectedBatch],
    queryFn: async () => {
      const res = await fetch(`/api/bank-imports/${selectedBatch}/txns`, { headers: AUTH_HEADERS });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!selectedBatch,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCSV(file),
    onSuccess: (data) => {
      setUploadError("");
      setUploadResult(data);
      refetchBatches();
    },
    onError: (e: Error) => {
      setUploadError(e.message);
      setUploadResult(null);
    },
  });

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setUploadError("Only CSV files are supported."); return; }
    setUploadError("");
    setUploadResult(null);
    uploadMutation.mutate(file);
  };

  const batches = batchesData?.batches ?? [];

  return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/finance")} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Expenses Import</h1>
          <p className="text-xs text-slate-500">Upload bank CSV statements to import transactions</p>
        </div>
      </div>

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          uploadMutation.isPending
            ? "border-blue-300 bg-blue-50 dark:bg-blue-900/10"
            : "border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
        }`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0] ?? null); }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {uploadMutation.isPending ? "Uploading..." : "Drop CSV here or click to browse"}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">KBank, SCB, or generic CSV formats supported</p>
      </div>

      {uploadError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Upload Failed</p>
            <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5">{uploadError}</p>
          </div>
        </div>
      )}

      {uploadResult && !uploadError && (
        <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-green-700 dark:text-green-400">Upload Successful</p>
            <p className="text-[10px] text-green-600 dark:text-green-500 mt-0.5">
              {uploadResult.message || `Batch ${uploadResult.batch?.id ?? ""} created — review transactions below`}
            </p>
          </div>
        </div>
      )}

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Import History</p>
          <span className="text-[10px] text-slate-400">{batches.length} batches</span>
        </div>

        {loadingBatches && (
          <div className="px-3 py-6 text-center text-xs text-slate-400">Loading...</div>
        )}

        {!loadingBatches && batches.length === 0 && (
          <div className="px-3 py-8 text-center">
            <FileText className="h-6 w-6 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No imports yet. Upload a CSV to get started.</p>
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {batches.map((batch) => {
            const isOpen = selectedBatch === batch.id;
            const detail = isOpen ? batchDetailQuery.data : null;
            const txns: ImportedRow[] = detail?.transactions ?? detail?.rows ?? [];
            return (
              <div key={batch.id} className="bg-white dark:bg-slate-900">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                  onClick={() => setSelectedBatch(isOpen ? null : batch.id)}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white">{batch.id}</p>
                    <p className="text-[10px] text-slate-400">{FmtDate(batch.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {batch.txnCount !== undefined && (
                      <span className="text-[10px] text-slate-500">{batch.txnCount} txns</span>
                    )}
                    <Badge className={`text-[10px] px-1.5 py-0 border ${batch.status === "approved" ? "bg-green-100 text-green-700 border-green-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                      {batch.status ?? "pending"}
                    </Badge>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3">
                    {batchDetailQuery.isLoading && <p className="text-xs text-slate-400 py-2">Loading transactions...</p>}
                    {txns.length > 0 && (
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                              <th className="text-left px-2 py-1.5 text-slate-500 font-semibold">Date</th>
                              <th className="text-left px-2 py-1.5 text-slate-500 font-semibold">Description</th>
                              <th className="text-right px-2 py-1.5 text-slate-500 font-semibold">Amount</th>
                              <th className="text-left px-2 py-1.5 text-slate-500 font-semibold">Category</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {txns.slice(0, 20).map((t, i) => (
                              <tr key={i} className="bg-white dark:bg-slate-900">
                                <td className="px-2 py-1.5 text-slate-500">{FmtDate(t.date as string)}</td>
                                <td className="px-2 py-1.5 text-slate-700 dark:text-slate-300 max-w-[180px] truncate">{String(t.description ?? t.descriptionRaw ?? "—")}</td>
                                <td className="px-2 py-1.5 text-right font-semibold text-slate-800 dark:text-white">
                                  {t.amountTHB !== undefined ? `฿${Number(t.amountTHB).toFixed(2)}` : t.amount !== undefined ? `฿${Number(t.amount).toFixed(2)}` : "—"}
                                </td>
                                <td className="px-2 py-1.5 text-slate-500">{String(t.category ?? "—")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {txns.length > 20 && (
                          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-700">
                            Showing first 20 of {txns.length} transactions
                          </div>
                        )}
                      </div>
                    )}
                    {!batchDetailQuery.isLoading && txns.length === 0 && (
                      <p className="text-xs text-slate-400 py-2">No transactions found in this batch.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

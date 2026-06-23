import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BankStatementUpload } from "@/components/BankStatementUpload";
import { BankTransactionReview } from "@/components/BankTransactionReview";

interface UploadResult {
  batchId: string;
  inserted: number;
  skippedDupes: number;
  format: string;
  source?: string;
}

export default function ExpensesImport() {
  const navigate = useNavigate();
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  const handleUploadComplete = (result: UploadResult) => {
    setSelectedBatch(result.batchId);
  };

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/finance")} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-500" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Bank Statement Import</h1>
          <p className="text-xs text-slate-500">Upload a CSV, then review and approve business expense rows.</p>
        </div>
      </div>

      <BankStatementUpload onUploadComplete={handleUploadComplete} />

      {selectedBatch && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Review Transactions</h2>
            <p className="text-xs text-slate-500">Batch {selectedBatch}</p>
          </div>
          <BankTransactionReview batchId={selectedBatch} onClose={() => setSelectedBatch(null)} />
        </section>
      )}
    </div>
  );
}

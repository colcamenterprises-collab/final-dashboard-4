import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { BankStatementUpload as BankStatementUploadComponent } from "@/components/BankStatementUpload";
import { BankTransactionReview } from "@/components/BankTransactionReview";

interface UploadResult {
  batchId: string;
  inserted: number;
  skippedDupes: number;
  format: string;
  source?: string;
}

export default function ExpensesImport() {
  console.log("EXPENSES_IMPORT_VERSION", "8c1a014a1f3b1d79e1c4d1b5560c3efa4f829d57");
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

      <BankStatementUploadComponent onUploadComplete={handleUploadComplete} />

      <section className="space-y-3">
        {selectedBatch && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            Upload complete. Batch {selectedBatch} was appended to the persistent review queue.
          </div>
        )}
        <BankTransactionReview key={selectedBatch || 'persistent-queue'} aggregateQueue />
      </section>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload } from "lucide-react";

type DashboardResponse = {
  ok: boolean;
  data: {
    summary: Record<string, number | string | null>;
    inShiftExpenses: any[];
    businessExpenses: any[];
    bankReviewQueue: any[];
  };
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function money(value: number | string | null | undefined) {
  const amount = Number(value || 0);
  return `฿${amount.toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function SummaryBox({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{money(value)}</p>
    </div>
  );
}

function DataTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[900px] text-xs">{children}</table>
      </div>
    </section>
  );
}

export default function Expenses() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = new URLSearchParams();
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);

  const { data, isLoading, isError } = useQuery<DashboardResponse>({
    queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch(`/api/finance/expenses-dashboard?${query.toString()}`);
      if (!response.ok) throw new Error("Failed to load finance expenses dashboard");
      return response.json();
    },
  });

  const summary = data?.data?.summary || {};
  const inShiftExpenses = data?.data?.inShiftExpenses || [];
  const businessExpenses = data?.data?.businessExpenses || [];
  const bankReviewQueue = data?.data?.bankReviewQueue || [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Finance / Expenses</h1>
          <p className="text-xs text-slate-500">Expenses are separated to prevent double counting.</p>
        </div>
        <Button size="sm" onClick={() => navigate("/finance/expenses-import")}>
          <Upload className="mr-2 h-4 w-4" />
          Import Bank Statement
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <SummaryBox label="Current Month Business Expenses" value={summary.current_month_business_expenses} />
        <SummaryBox label="Current Month In-Shift Expenses" value={summary.current_month_in_shift_expenses} />
        <SummaryBox label="Pending Bank Statement Review" value={summary.pending_bank_statement_review} />
        <SummaryBox label="Personal Expenses This Month" value={summary.personal_expenses_this_month} />
        <SummaryBox label="Declined Transactions This Month" value={summary.declined_transactions_this_month} />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="text-xs" aria-label="Date from" />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="text-xs" aria-label="Date to" />
      </div>

      {isLoading && <div className="py-12 text-center text-xs text-slate-400">Loading expenses...</div>}
      {isError && <div className="py-12 text-center text-xs text-red-500">Failed to load expenses.</div>}

      {!isLoading && !isError && (
        <>
          <DataTable title="Table 1 — In-Shift Expenses">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Shift Ref</th><th className="px-3 py-2">Category/Type</th><th className="px-3 py-2">Supplier/Payee</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Entered By</th><th className="px-3 py-2">Daily Sales V2 ID</th></tr></thead>
            <tbody>
              {inShiftExpenses.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No in-shift expenses found.</td></tr>}
              {inShiftExpenses.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.shift_reference || "—"}</td><td className="px-3 py-2">{row.category || "UNMAPPED"}</td><td className="px-3 py-2">{row.supplier || "—"}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2 text-right font-mono">{money(row.amount)}</td><td className="px-3 py-2">{row.entered_by || "—"}</td><td className="px-3 py-2 font-mono">{row.submission_id || "—"}</td></tr>)}
            </tbody>
          </DataTable>

          <DataTable title="Table 2 — Business Expenses Outside Shift">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Supplier/Payee</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Payment Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th></tr></thead>
            <tbody>
              {businessExpenses.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-400">No business expenses found.</td></tr>}
              {businessExpenses.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.supplier || "—"}</td><td className="px-3 py-2">{row.category || "UNMAPPED"}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2 text-right font-mono">{money(row.amount)}</td><td className="px-3 py-2">{row.payment_method || "—"}</td><td className="px-3 py-2">Recorded</td><td className="px-3 py-2">{formatDate(row.created_at)}</td></tr>)}
            </tbody>
          </DataTable>

          <DataTable title="Table 3 — Bank Statement Upload / Review Queue">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Transaction Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Bank/Source</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Reviewed By</th><th className="px-3 py-2">Reviewed At</th><th className="px-3 py-2">Approved Expense Ref</th></tr></thead>
            <tbody>
              {bankReviewQueue.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No bank statement transactions found.</td></tr>}
              {bankReviewQueue.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.transaction_date)}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2 text-right font-mono">{money(row.amount)}</td><td className="px-3 py-2">{row.bank_source || "—"}</td><td className="px-3 py-2 font-mono">{row.import_batch_id || "—"}</td><td className="px-3 py-2">{row.status || "Pending Review"}</td><td className="px-3 py-2">{row.reviewed_by || "—"}</td><td className="px-3 py-2">{formatDate(row.reviewed_at)}</td><td className="px-3 py-2 font-mono">{String(row.status).toUpperCase() === "APPROVED" ? row.approved_expense_id : "—"}</td></tr>)}
            </tbody>
          </DataTable>
        </>
      )}
    </div>
  );
}

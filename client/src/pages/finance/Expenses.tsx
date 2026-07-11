import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Pencil, Trash2, Upload } from "lucide-react";
import { BankStatementUpload as BankStatementUploadComponent } from "@/components/BankStatementUpload";
import { BankTransactionReview } from "@/components/BankTransactionReview";

type DashboardResponse = {
  ok: boolean;
  data: {
    summary: Record<string, number | string | null>;
    inShiftExpenses: any[];
    businessExpenses: any[];
    bankReviewQueue: any[];
  };
};

type PersonalTransaction = {
  id: string;
  batchId?: string;
  postedAt: string;
  description: string;
  amountTHB: string | number;
  ref?: string;
  supplier?: string;
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

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function SummaryBox({ label, value }: { label: string; value: number | string | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{money(value)}</p>
    </div>
  );
}

function DataTable({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        {actions}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[760px] text-xs">{children}</table>
      </div>
    </section>
  );
}

export default function Expenses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportedPersonalIds, setExportedPersonalIds] = useState<string[]>([]);

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

  const personalQuery = useQuery<any>({
    queryKey: ["/api/bank-imports/review-queue", "personal", dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch("/api/bank-imports/review-queue?tab=personal&limit=1000");
      if (!response.ok) throw new Error("Failed to load personal expenses");
      return response.json();
    },
  });

  const summary = data?.data?.summary || {};
  const inShiftExpenses = data?.data?.inShiftExpenses || [];
  const businessExpenses = data?.data?.businessExpenses || [];
  const allPersonalTransactions: PersonalTransaction[] = personalQuery.data?.txns || [];

  const personalTransactions = useMemo(() => allPersonalTransactions.filter((row) => {
    const date = row.postedAt?.slice(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }), [allPersonalTransactions, dateFrom, dateTo]);

  const deleteBusinessExpense = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expensesV2/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete business expense");
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] }),
  });

  const deleteExportedPersonal = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const response = await fetch(`/api/bank-imports/txns/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to delete exported personal transaction");
      }
      return { deleted: ids.length };
    },
    onSuccess: () => {
      setExportedPersonalIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
    },
  });

  const exportPersonalCsv = () => {
    if (personalTransactions.length === 0) return;
    const rows = [
      ["Date", "Description", "Amount THB", "Reference", "Supplier", "Batch ID"],
      ...personalTransactions.map((row) => [
        row.postedAt?.slice(0, 10) || "",
        row.description,
        Math.abs(Number(row.amountTHB || 0)).toFixed(2),
        row.ref || "",
        row.supplier || "",
        row.batchId || "",
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `personal-expenses-${dateFrom || "all"}-to-${dateTo || "all"}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setExportedPersonalIds(personalTransactions.map((row) => row.id));
  };

  const confirmDeleteExported = () => {
    if (exportedPersonalIds.length === 0) return;
    const confirmed = window.confirm(`Delete ${exportedPersonalIds.length} exported personal transaction(s)? This will not affect Business Expenses or Shift Expenses.`);
    if (confirmed) deleteExportedPersonal.mutate(exportedPersonalIds);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Finance / Expenses</h1>
          <p className="text-xs text-slate-500">Expenses are separated to prevent double counting.</p>
        </div>
        <Button size="sm" onClick={() => setShowImport((value) => !value)}>
          <Upload className="mr-2 h-4 w-4" />
          Import Bank Statement
        </Button>
      </div>

      {showImport && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <BankStatementUploadComponent onUploadComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
            queryClient.invalidateQueries({ queryKey: ["/api/bank-imports", "review-queue"] });
          }} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <SummaryBox label="Current Month Business Expenses" value={summary.current_month_business_expenses} />
        <SummaryBox label="Current Month In-Shift Expenses" value={summary.current_month_in_shift_expenses} />
        <SummaryBox label="Pending Bank Statement Review" value={summary.pending_bank_statement_review} />
        <SummaryBox label="Personal Expenses This Month" value={summary.personal_expenses_this_month} />
        <SummaryBox label="Declined Transactions This Month" value={summary.declined_transactions_this_month} />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-700 dark:text-slate-200">
          <span>Start date</span>
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="text-xs" aria-label="Start date" placeholder="Start date" />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700 dark:text-slate-200">
          <span>End date</span>
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="text-xs" aria-label="End date" placeholder="End date" />
        </label>
      </div>

      {isLoading && <div className="py-12 text-center text-xs text-slate-400">Loading expenses...</div>}
      {isError && <div className="py-12 text-center text-xs text-red-500">Failed to load expenses.</div>}

      {!isLoading && !isError && (
        <>
          <DataTable title="Table 1 — In-Shift Expenses">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Category/Type</th><th className="px-2 py-1.5">Supplier/Payee</th><th className="px-2 py-1.5">Description</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5">Entered By</th></tr></thead>
            <tbody>
              {inShiftExpenses.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No in-shift expenses found.</td></tr>}
              {inShiftExpenses.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-2 py-1.5">{formatDate(row.date)}</td><td className="px-2 py-1.5">{row.category || "UNMAPPED"}</td><td className="px-2 py-1.5">{row.supplier || "—"}</td><td className="px-2 py-1.5">{row.description || "—"}</td><td className="px-2 py-1.5 text-right font-mono">{money(row.amount)}</td><td className="px-2 py-1.5">{row.entered_by || "—"}</td></tr>)}
            </tbody>
          </DataTable>

          <DataTable title="Table 2 — Business Expenses Outside Shift">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Supplier/Payee</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Payment Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>
            <tbody>
              {businessExpenses.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">No business expenses found.</td></tr>}
              {businessExpenses.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.supplier || "—"}</td><td className="px-3 py-2">{row.category || "UNMAPPED"}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2 text-right font-mono">{money(row.amount)}</td><td className="px-3 py-2">{row.payment_method || "—"}</td><td className="px-3 py-2">Recorded</td><td className="px-3 py-2">{formatDate(row.created_at)}</td><td className="px-3 py-2"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" className="h-7 px-2" onClick={() => navigate(`/expenses?edit=${encodeURIComponent(row.id)}`)}><Pencil className="h-3 w-3" /></Button><Button size="sm" variant="outline" className="h-7 px-2" onClick={() => deleteBusinessExpense.mutate(row.id)} disabled={deleteBusinessExpense.isPending}><Trash2 className="h-3 w-3" /></Button></div></td></tr>)}
            </tbody>
          </DataTable>

          <DataTable title="Table 3 — Pending Imported Bank Transactions">
            <tbody><tr><td className="p-0"><BankTransactionReview key={`${dateFrom}:${dateTo}`} aggregateQueue onApproved={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
              queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal"] });
            }} /></td></tr></tbody>
          </DataTable>

          <DataTable title="Table 4 — Personal Expenses" actions={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={exportPersonalCsv} disabled={personalTransactions.length === 0 || personalQuery.isLoading}><Download className="mr-2 h-4 w-4" />Export CSV</Button><Button size="sm" variant="outline" onClick={confirmDeleteExported} disabled={exportedPersonalIds.length === 0 || deleteExportedPersonal.isPending}><Trash2 className="mr-2 h-4 w-4" />Delete Exported</Button></div>}>
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Batch</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Export Status</th></tr></thead>
            <tbody>
              {personalQuery.isLoading && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">Loading personal expenses...</td></tr>}
              {!personalQuery.isLoading && personalTransactions.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No personal expenses found for this date range.</td></tr>}
              {personalTransactions.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.postedAt)}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2">{row.ref || "—"}</td><td className="px-3 py-2 font-mono text-[10px]">{row.batchId || "—"}</td><td className="px-3 py-2 text-right font-mono">{money(Math.abs(Number(row.amountTHB || 0)))}</td><td className="px-3 py-2">{exportedPersonalIds.includes(row.id) ? "Exported" : "Ready"}</td></tr>)}
            </tbody>
          </DataTable>
        </>
      )}
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Download, Pencil, Save, Trash2, Upload } from "lucide-react";
import { BankStatementUpload as BankStatementUploadComponent } from "@/components/BankStatementUpload";
import { usePinAuth } from "@/components/PinLoginGate";

type DashboardResponse = {
  ok: boolean;
  data: {
    summary: Record<string, number | string | null>;
    inShiftExpenses: any[];
    businessExpenses: any[];
    bankReviewQueue: any[];
    deposits: any[];
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

type ExpenseDraft = {
  date: string;
  supplier: string;
  category: string;
  description: string;
  amount: string;
};

type ShiftExpenseDraft = Omit<ExpenseDraft, "date">;

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
  const queryClient = useQueryClient();
  const { currentUser } = usePinAuth();
  const isOwner = currentUser?.role === "owner";
  const [showImport, setShowImport] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingShiftExpenseId, setEditingShiftExpenseId] = useState<string | null>(null);
  const [shiftExpenseDraft, setShiftExpenseDraft] = useState<ShiftExpenseDraft | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);

  const query = new URLSearchParams();
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);

  const { data, isLoading, isError } = useQuery<DashboardResponse>({
    queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch(`/api/finance/expenses-dashboard?${query.toString()}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load finance expenses dashboard");
      return response.json();
    },
  });

  const personalQuery = useQuery<any>({
    queryKey: ["/api/bank-imports/review-queue", "personal_owner", dateFrom, dateTo],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch("/api/bank-imports/review-queue?tab=personal_owner&limit=1000", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to load personal expenses");
      return response.json();
    },
  });

  const summary = data?.data?.summary || {};
  const inShiftExpenses = data?.data?.inShiftExpenses || [];
  const businessExpenses = data?.data?.businessExpenses || [];
  const deposits = data?.data?.deposits || [];
  const allPersonalTransactions: PersonalTransaction[] = personalQuery.data?.txns || [];

  const personalTransactions = useMemo(() => allPersonalTransactions.filter((row) => {
    const date = row.postedAt?.slice(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }), [allPersonalTransactions, dateFrom, dateTo]);

  const updateBusinessExpense = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: ExpenseDraft }) => {
      const response = await fetch(`/api/expensesV2/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: draft.date,
          supplier: draft.supplier.trim(),
          category: draft.category.trim(),
          description: draft.description.trim(),
          amount: Number(draft.amount),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to save business expense");
      return payload;
    },
    onSuccess: () => {
      setEditingExpenseId(null);
      setExpenseDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
    },
    onError: (error: Error) => window.alert(error.message),
  });

  const updateShiftExpense = useMutation({
    mutationFn: async ({ row, draft }: { row: any; draft: ShiftExpenseDraft }) => {
      const response = await fetch(
        `/api/finance/shift-expenses/${encodeURIComponent(row.submission_id)}/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.ordinality)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            supplier: draft.supplier.trim(),
            category: draft.category.trim(),
            description: draft.description.trim(),
            amount: Number(draft.amount),
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to save shift expense");
      return payload;
    },
    onSuccess: () => {
      setEditingShiftExpenseId(null);
      setShiftExpenseDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
    },
    onError: (error: Error) => window.alert(error.message),
  });

  const deleteShiftExpense = useMutation({
    mutationFn: async (row: any) => {
      const response = await fetch(
        `/api/finance/shift-expenses/${encodeURIComponent(row.submission_id)}/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.ordinality)}`,
        { method: "DELETE", credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to delete shift expense");
      return payload;
    },
    onSuccess: () => {
      setEditingShiftExpenseId(null);
      setShiftExpenseDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
    },
    onError: (error: Error) => window.alert(error.message),
  });

  const deleteBusinessExpense = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/expensesV2/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to delete business expense");
      return payload;
    },
    onSuccess: () => {
      setEditingExpenseId(null);
      setExpenseDraft(null);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
    },
    onError: (error: Error) => window.alert(error.message),
  });

  const markBusinessExpensePersonal = useMutation({
    mutationFn: async (row: any) => {
      const bankTxnId = row?.meta?.bankTxnId || (String(row?.id || "").startsWith("bank_txn:") ? String(row.id).slice("bank_txn:".length) : null);
      if (!bankTxnId) throw new Error("Only bank-statement expenses can be marked Personal from this table.");
      const response = await fetch(`/api/finance/bank-imports/txns/${encodeURIComponent(bankTxnId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category: "Personal / Owner" }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || payload?.reason || "Failed to mark expense Personal");
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal_owner"] });
    },
    onError: (error: Error) => window.alert(error.message),
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
  };

  const beginExpenseEdit = (row: any) => {
    if (!isOwner) return;
    setEditingExpenseId(String(row.id));
    setExpenseDraft({
      date: String(row.date || "").slice(0, 10),
      supplier: String(row.supplier || ""),
      category: String(row.category || ""),
      description: String(row.description || ""),
      amount: String(Number(row.amount || 0)),
    });
  };

  const beginShiftExpenseEdit = (row: any) => {
    if (!isOwner) return;
    setEditingShiftExpenseId(String(row.id));
    setShiftExpenseDraft({
      supplier: String(row.supplier || ""),
      category: String(row.category || ""),
      description: String(row.description || ""),
      amount: String(Number(row.amount || 0)),
    });
  };

  const saveShiftExpense = (row: any) => {
    if (!isOwner || editingShiftExpenseId !== String(row.id) || !shiftExpenseDraft) return;
    if (!shiftExpenseDraft.category.trim() || !shiftExpenseDraft.description.trim()) {
      window.alert("Category and description are required.");
      return;
    }
    const amount = Number(shiftExpenseDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Amount must be greater than zero.");
      return;
    }
    updateShiftExpense.mutate({ row, draft: shiftExpenseDraft });
  };

  const confirmDeleteShiftExpense = (row: any) => {
    if (!isOwner) return;
    const label = row.description || "this shift expense";
    if (window.confirm(`Delete ${label}? The original row will remain recorded in the owner audit trail.`)) {
      deleteShiftExpense.mutate(row);
    }
  };

  const saveExpense = () => {
    if (!isOwner || !editingExpenseId || !expenseDraft) return;
    if (!expenseDraft.date || !expenseDraft.supplier.trim() || !expenseDraft.category.trim()) {
      window.alert("Date, supplier and category are required.");
      return;
    }
    const amount = Number(expenseDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      window.alert("Amount must be greater than zero.");
      return;
    }
    updateBusinessExpense.mutate({ id: editingExpenseId, draft: expenseDraft });
  };

  const confirmDeleteExpense = (row: any) => {
    if (!isOwner) return;
    const label = row.description || row.supplier || "this expense";
    if (window.confirm(`Delete ${label}? This cannot be undone.`)) {
      deleteBusinessExpense.mutate(String(row.id));
    }
  };

  const confirmMarkPersonal = (row: any) => {
    if (!isOwner) return;
    const label = row.description || row.supplier || "this transaction";
    if (window.confirm(`Mark ${label} as Personal? It will be removed from Business Expenses and business reporting.`)) {
      markBusinessExpensePersonal.mutate(row);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Finance / Expenses</h1>
          <p className="text-xs text-slate-500">Bank withdrawals are recorded directly as Business Expenses. Personal rows stay hidden from business reporting.</p>
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setShowImport((value) => !value)}>
            <Upload className="mr-2 h-4 w-4" />
            Import Bank Statement
          </Button>
        )}
      </div>

      {showImport && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <BankStatementUploadComponent onUploadComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });
            queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal_owner"] });
          }} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <SummaryBox label="Current Month Business Expenses" value={summary.current_month_business_expenses} />
        <SummaryBox label="Current Month Shift Expenses" value={summary.current_month_in_shift_expenses} />
        <SummaryBox label="Personal Expenses This Month" value={summary.personal_expenses_this_month} />
        <SummaryBox label="Declined Transactions This Month" value={summary.declined_transactions_this_month} />
        <SummaryBox label="Bank Deposits / Credits This Month" value={summary.current_month_bank_deposits} />
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
          <DataTable title="Shift Expenses">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Category/Type</th><th className="px-2 py-1.5">Supplier/Payee</th><th className="px-2 py-1.5">Description</th><th className="px-2 py-1.5 text-right">Amount</th><th className="px-2 py-1.5">Entered By</th>{isOwner && <th className="w-[92px] min-w-[92px] px-1 py-1.5 text-right">Actions</th>}</tr></thead>
            <tbody>
              {inShiftExpenses.length === 0 && <tr><td colSpan={isOwner ? 7 : 6} className="px-3 py-8 text-center text-slate-400">No shift expenses found.</td></tr>}
              {inShiftExpenses.map((row) => {
                const rowDraft = editingShiftExpenseId === String(row.id) ? shiftExpenseDraft : null;
                return <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-2 py-1.5">{formatDate(row.date)}</td>
                  <td className="px-2 py-1">{rowDraft ? <Input value={rowDraft.category} onChange={(event) => setShiftExpenseDraft({ ...rowDraft, category: event.target.value })} className="h-7 min-w-[120px] px-2 text-xs" aria-label="Shift expense category" /> : row.category || "UNMAPPED"}</td>
                  <td className="px-2 py-1">{rowDraft ? <Input value={rowDraft.supplier} onChange={(event) => setShiftExpenseDraft({ ...rowDraft, supplier: event.target.value })} className="h-7 min-w-[120px] px-2 text-xs" aria-label="Shift expense supplier" /> : row.supplier || "—"}</td>
                  <td className="px-2 py-1">{rowDraft ? <Input value={rowDraft.description} onChange={(event) => setShiftExpenseDraft({ ...rowDraft, description: event.target.value })} className="h-7 min-w-[150px] px-2 text-xs" aria-label="Shift expense description" /> : row.description || "—"}</td>
                  <td className="px-2 py-1 text-right font-mono">{rowDraft ? <Input type="number" min="0.01" step="0.01" value={rowDraft.amount} onChange={(event) => setShiftExpenseDraft({ ...rowDraft, amount: event.target.value })} className="ml-auto h-7 w-24 px-2 text-right text-xs" aria-label="Shift expense amount" /> : money(row.amount)}</td>
                  <td className="px-2 py-1.5">{row.entered_by || "—"}</td>
                  {isOwner && <td className="w-[92px] min-w-[92px] px-1 py-1"><div className="flex justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginShiftExpenseEdit(row)} aria-label="Edit shift expense" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveShiftExpense(row)} disabled={!rowDraft || updateShiftExpense.isPending} aria-label="Save shift expense" title="Save"><Save className="h-3.5 w-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => confirmDeleteShiftExpense(row)} disabled={deleteShiftExpense.isPending} aria-label="Delete shift expense" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div></td>}
                </tr>;
              })}
            </tbody>
          </DataTable>

          <DataTable
            title="Business Expenses"
            actions={isOwner ? (
              <Button size="sm" variant="outline" onClick={exportPersonalCsv} disabled={personalTransactions.length === 0 || personalQuery.isLoading}>
                <Download className="mr-2 h-4 w-4" />Export Personal CSV ({personalTransactions.length})
              </Button>
            ) : undefined}
          >
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800">
                <th className="px-2 py-1.5">Date</th>
                <th className="px-2 py-1.5">Supplier/Payee</th>
                <th className="px-2 py-1.5">Category</th>
                <th className="px-2 py-1.5">Description</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5">Payment Source</th>
                <th className="px-2 py-1.5">Created</th>
                {isOwner && <th className="w-[132px] min-w-[132px] px-1 py-1.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {businessExpenses.length === 0 && (
                <tr><td colSpan={isOwner ? 8 : 7} className="px-3 py-8 text-center text-slate-400">No business expenses found.</td></tr>
              )}
              {businessExpenses.map((row) => {
                const rowDraft = editingExpenseId === String(row.id) ? expenseDraft : null;
                const canMarkPersonal = Boolean(row?.meta?.bankTxnId) || String(row.id || "").startsWith("bank_txn:");
                return (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-2 py-1">{rowDraft ? <Input type="date" value={rowDraft.date} onChange={(event) => setExpenseDraft({ ...rowDraft, date: event.target.value })} className="h-7 min-w-[126px] px-2 text-xs" aria-label="Expense date" /> : formatDate(row.date)}</td>
                    <td className="px-2 py-1">{rowDraft ? <Input value={rowDraft.supplier} onChange={(event) => setExpenseDraft({ ...rowDraft, supplier: event.target.value })} className="h-7 min-w-[120px] px-2 text-xs" aria-label="Expense supplier" /> : row.supplier || "—"}</td>
                    <td className="px-2 py-1">{rowDraft ? <Input value={rowDraft.category} onChange={(event) => setExpenseDraft({ ...rowDraft, category: event.target.value })} className="h-7 min-w-[120px] px-2 text-xs" aria-label="Expense category" /> : row.category || "UNMAPPED"}</td>
                    <td className="px-2 py-1">{rowDraft ? <Input value={rowDraft.description} onChange={(event) => setExpenseDraft({ ...rowDraft, description: event.target.value })} className="h-7 min-w-[150px] px-2 text-xs" aria-label="Expense description" /> : row.description || "—"}</td>
                    <td className="px-2 py-1 text-right font-mono">{rowDraft ? <Input type="number" min="0.01" step="0.01" value={rowDraft.amount} onChange={(event) => setExpenseDraft({ ...rowDraft, amount: event.target.value })} className="ml-auto h-7 w-24 px-2 text-right text-xs" aria-label="Expense amount" /> : money(row.amount)}</td>
                    <td className="px-2 py-1">{row.payment_method || "—"}</td>
                    <td className="px-2 py-1">{formatDate(row.created_at)}</td>
                    {isOwner && <td className="w-[132px] min-w-[132px] px-1 py-1"><div className="flex justify-end gap-1">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginExpenseEdit(row)} aria-label="Edit expense" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={saveExpense} disabled={!rowDraft || updateBusinessExpense.isPending} aria-label="Save expense" title="Save"><Save className="h-3.5 w-3.5" /></Button>
                      {canMarkPersonal && <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => confirmMarkPersonal(row)} disabled={markBusinessExpensePersonal.isPending}>Personal</Button>}
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => confirmDeleteExpense(row)} disabled={deleteBusinessExpense.isPending} aria-label="Delete expense" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div></td>}
                  </tr>
                );
              })}
            </tbody>
          </DataTable>

          <DataTable title="Bank Deposits / Credits — Reconciliation Only">
            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Bank Source</th><th className="px-3 py-2">Classification</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>
              {deposits.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No bank deposits found for this date range.</td></tr>}
              {deposits.map((row) => <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800"><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2">{row.ref || "—"}</td><td className="px-3 py-2">{row.source || "—"}</td><td className="px-3 py-2">{row.classification || "Unclassified Deposit"}</td><td className="px-3 py-2 text-right font-mono text-green-700">{money(row.amount)}</td></tr>)}
            </tbody>
          </DataTable>
        </>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Landmark,
  Pencil,
  Plus,
  Receipt,
  Save,
  Trash2,
  Upload,
  UserRound,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BankStatementUpload as BankStatementUploadComponent } from "@/components/BankStatementUpload";
import { usePinAuth } from "@/components/PinLoginGate";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import DirectorBeneficiaryLoans from "./DirectorBeneficiaryLoans";

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

type VendorRule = {
  id: string;
  matchText: string;
  category: string;
  supplier?: string | null;
};

const BUSINESS_EXPENSE_CATEGORIES = [
  "Review",
  "Food & Beverage",
  "Kitchen Supplies & Packaging",
  "Utilities",
  "Rent",
  "Staff Expenses",
  "Repairs & Maintenance",
  "Marketing",
  "Administration",
  "Software & Subscriptions",
  "Bank Fees",
  "Equipment",
  "Fuel & Transport",
  "Other Business Expense",
];

const cardTones = {
  blue: "from-blue-500 to-indigo-600 text-white",
  amber: "from-amber-300 to-orange-400 text-slate-950",
  mint: "from-emerald-300 to-teal-400 text-slate-950",
  violet: "from-violet-400 to-fuchsia-500 text-white",
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

function sumRows(rows: any[], key: string) {
  return rows.reduce((sum, row) => sum + Math.abs(Number(row?.[key] || 0)), 0);
}

function currentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${day}` };
}

function SummaryBox({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string | null | undefined;
  sub: string;
  tone: keyof typeof cardTones;
  icon: any;
}) {
  return (
    <article className={`relative min-h-40 overflow-hidden rounded-[28px] bg-gradient-to-br p-5 shadow-[0_18px_50px_rgba(0,0,0,.18)] ${cardTones[tone]}`}>
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[.18em] opacity-70">{label}</p>
        <span className="rounded-full bg-black/10 p-2.5"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="relative mt-7 text-3xl font-black tracking-tight">{money(value)}</p>
      <p className="relative mt-2 text-xs font-semibold opacity-65">{sub}</p>
    </article>
  );
}

function DataTable({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[760px] text-xs">{children}</table>
      </div>
    </section>
  );
}

export default function Expenses() {
  const queryClient = useQueryClient();
  const { currentUser } = usePinAuth();
  const isOwner = currentUser?.role === "owner";
  const initialRange = useMemo(() => currentMonthRange(), []);
  const [showImport, setShowImport] = useState(false);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [editingShiftExpenseId, setEditingShiftExpenseId] = useState<string | null>(null);
  const [shiftExpenseDraft, setShiftExpenseDraft] = useState<ShiftExpenseDraft | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft | null>(null);
  const [categoryChanges, setCategoryChanges] = useState<Record<string, string>>({});

  const query = new URLSearchParams();
  if (dateFrom) query.set("dateFrom", dateFrom);
  if (dateTo) query.set("dateTo", dateTo);

  const { data, isLoading, isError } = useQuery<DashboardResponse>({
    queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch(`/api/finance/expenses-dashboard?${query.toString()}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Failed to load finance expenses dashboard");
      return payload;
    },
  });

  const personalQuery = useQuery<any>({
    queryKey: ["/api/bank-imports/review-queue", "personal_owner", dateFrom, dateTo],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch("/api/bank-imports/review-queue?tab=personal_owner&limit=1000", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load personal expenses");
      return response.json();
    },
  });

  const vendorRulesQuery = useQuery<any>({
    queryKey: ["/api/bank-imports/rules"],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch("/api/bank-imports/rules", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load expense auto-category rules");
      return response.json();
    },
  });

  const inShiftExpenses = data?.data?.inShiftExpenses || [];
  const businessExpenses = data?.data?.businessExpenses || [];
  const deposits = data?.data?.deposits || [];
  const allPersonalTransactions: PersonalTransaction[] = personalQuery.data?.txns || [];
  const vendorRules: VendorRule[] = vendorRulesQuery.data?.rules || vendorRulesQuery.data || [];

  const personalTransactions = useMemo(() => allPersonalTransactions.filter((row) => {
    const date = row.postedAt?.slice(0, 10);
    if (dateFrom && date < dateFrom) return false;
    if (dateTo && date > dateTo) return false;
    return true;
  }), [allPersonalTransactions, dateFrom, dateTo]);

  const businessTotal = useMemo(() => sumRows(businessExpenses, "amount"), [businessExpenses]);
  const shiftTotal = useMemo(() => sumRows(inShiftExpenses, "amount"), [inShiftExpenses]);
  const personalTotal = useMemo(() => sumRows(personalTransactions, "amountTHB"), [personalTransactions]);
  const depositTotal = useMemo(() => sumRows(deposits, "amount"), [deposits]);
  const changedCategoryCount = Object.keys(categoryChanges).length;

  const periodLabel = dateFrom && dateTo
    ? `${formatDate(dateFrom)} → ${formatDate(dateTo)}`
    : dateFrom
      ? `From ${formatDate(dateFrom)}`
      : dateTo
        ? `To ${formatDate(dateTo)}`
        : "All available dates";

  const refreshExpenses = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal_owner"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/rules"] });
  };

  const updateBusinessExpense = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: ExpenseDraft }) => {
      const response = await fetch(`/api/expensesV2/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date: draft.date, supplier: draft.supplier.trim(), category: draft.category.trim(), description: draft.description.trim(), amount: Number(draft.amount) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to save business expense");
      return payload;
    },
    onSuccess: () => { setEditingExpenseId(null); setExpenseDraft(null); refreshExpenses(); },
    onError: (error: Error) => window.alert(error.message),
  });

  const bulkSaveCategories = useMutation({
    mutationFn: async () => {
      const changes = Object.entries(categoryChanges);
      if (!changes.length) return { saved: 0, learned: 0, conflicts: 0 };
      let learned = 0;
      let conflicts = 0;

      for (const [id, category] of changes) {
        const row = businessExpenses.find((item: any) => String(item.id) === id);
        if (!row) continue;
        const response = await fetch(`/api/expensesV2/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            date: String(row.date || "").slice(0, 10),
            supplier: String(row.supplier || "").trim(),
            category,
            description: String(row.description || "").trim(),
            amount: Number(row.amount || 0),
          }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || `Failed to save category for ${row.supplier || row.description || id}`);

        const description = String(row.description || "");
        const supplier = String(row.supplier || "").trim();
        const matchingRule = vendorRules.find((rule) => description.toUpperCase().includes(String(rule.matchText || "").toUpperCase()));
        if (matchingRule && matchingRule.category !== category) {
          conflicts += 1;
          continue;
        }
        if (!matchingRule && supplier && description.toUpperCase().includes(supplier.toUpperCase())) {
          const ruleResponse = await fetch("/api/bank-imports/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ matchText: supplier, supplier, category }),
          });
          if (ruleResponse.ok) learned += 1;
        }
      }
      return { saved: changes.length, learned, conflicts };
    },
    onSuccess: (result) => {
      setCategoryChanges({});
      refreshExpenses();
      if (result.conflicts) {
        window.alert(`${result.saved} category changes saved. ${result.learned} supplier rules learned. ${result.conflicts} existing auto-category rule conflict(s) were left unchanged for safety.`);
      }
    },
    onError: (error: Error) => window.alert(error.message),
  });

  const updateShiftExpense = useMutation({
    mutationFn: async ({ row, draft }: { row: any; draft: ShiftExpenseDraft }) => {
      const response = await fetch(`/api/finance/shift-expenses/${encodeURIComponent(row.submission_id)}/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.ordinality)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ supplier: draft.supplier.trim(), category: draft.category.trim(), description: draft.description.trim(), amount: Number(draft.amount) }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to save shift expense");
      return payload;
    },
    onSuccess: () => { setEditingShiftExpenseId(null); setShiftExpenseDraft(null); refreshExpenses(); },
    onError: (error: Error) => window.alert(error.message),
  });

  const deleteShiftExpense = useMutation({
    mutationFn: async (row: any) => {
      const response = await fetch(`/api/finance/shift-expenses/${encodeURIComponent(row.submission_id)}/${encodeURIComponent(row.kind)}/${encodeURIComponent(row.ordinality)}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Failed to delete shift expense");
      return payload;
    },
    onSuccess: () => {
      setEditingShiftExpenseId(null);
      setShiftExpenseDraft(null);
      refreshExpenses();
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
    onSuccess: refreshExpenses,
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
    onSuccess: refreshExpenses,
    onError: (error: Error) => window.alert(error.message),
  });

  const exportPersonalCsv = () => {
    if (personalTransactions.length === 0) return;
    const rows = [
      ["Date", "Description", "Amount THB", "Reference", "Supplier", "Batch ID"],
      ...personalTransactions.map((row) => [row.postedAt?.slice(0, 10) || "", row.description, Math.abs(Number(row.amountTHB || 0)).toFixed(2), row.ref || "", row.supplier || "", row.batchId || ""]),
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
    setExpenseDraft({ date: String(row.date || "").slice(0, 10), supplier: String(row.supplier || ""), category: categoryChanges[String(row.id)] ?? String(row.category || "Review"), description: String(row.description || ""), amount: String(Number(row.amount || 0)) });
  };

  const beginShiftExpenseEdit = (row: any) => {
    if (!isOwner) return;
    setEditingShiftExpenseId(String(row.id));
    setShiftExpenseDraft({ supplier: String(row.supplier || ""), category: String(row.category || ""), description: String(row.description || ""), amount: String(Number(row.amount || 0)) });
  };

  const saveShiftExpense = (row: any) => {
    if (!shiftExpenseDraft) return;
    if (!shiftExpenseDraft.category.trim() || !shiftExpenseDraft.description.trim() || Number(shiftExpenseDraft.amount) <= 0) return window.alert("Category, description and a valid amount are required.");
    updateShiftExpense.mutate({ row, draft: shiftExpenseDraft });
  };

  const saveExpense = () => {
    if (!editingExpenseId || !expenseDraft) return;
    if (!expenseDraft.date || !expenseDraft.supplier.trim() || !expenseDraft.category.trim() || Number(expenseDraft.amount) <= 0) return window.alert("Date, supplier, category and a valid amount are required.");
    updateBusinessExpense.mutate({ id: editingExpenseId, draft: expenseDraft });
  };

  const setThisMonth = () => {
    const range = currentMonthRange();
    setDateFrom(range.from);
    setDateTo(range.to);
  };

  return (
    <div className="min-h-screen rounded-[32px] bg-slate-50 p-4 text-slate-950 md:p-6">
      <header className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.25em] text-blue-600">Finance intelligence</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Expenses</h1>
          <p className="mt-2 text-sm text-slate-500">Business, shift and bank expenses in one reconciled view.</p>
        </div>
        {isOwner ? (
          <div className="flex flex-wrap gap-2">
            <ExpenseLodgmentModal
              onSuccess={refreshExpenses}
              triggerText="Lodge Business Expense"
              triggerIcon={<Plus className="mr-2 h-4 w-4" />}
              triggerClassName="h-10 rounded-xl bg-slate-950 px-4 text-white hover:bg-slate-800"
            />
            <Button className="h-10 rounded-xl" variant="outline" onClick={() => setShowImport((value) => !value)}>
              <Upload className="mr-2 h-4 w-4" />Import Bank Statement
            </Button>
          </div>
        ) : null}
      </header>

      {showImport ? (
        <section className="mb-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)]">
          <BankStatementUploadComponent onUploadComplete={refreshExpenses} />
        </section>
      ) : null}

      <section className="mb-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 md:grid-cols-2">
            <label className="space-y-2 text-xs font-bold text-slate-700"><span>Start date</span><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
            <label className="space-y-2 text-xs font-bold text-slate-700"><span>End date</span><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          </div>
          <Button variant="outline" className="h-10 rounded-xl" onClick={setThisMonth}>This Month</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">Reporting Period: {periodLabel}</span>
          <span>Every summary and table below uses this period.</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryBox label="Business expenses" value={businessTotal} sub={`${businessExpenses.length} records · selected period`} tone="blue" icon={Receipt} />
        <SummaryBox label="Shift expenses" value={shiftTotal} sub={`${inShiftExpenses.length} records · selected period`} tone="amber" icon={WalletCards} />
        <SummaryBox label="Personal expenses" value={personalTotal} sub={`${personalTransactions.length} records · selected period`} tone="violet" icon={UserRound} />
        <SummaryBox label="Bank deposits / credits" value={depositTotal} sub={`${deposits.length} records · selected period`} tone="mint" icon={Landmark} />
      </div>

      {isLoading ? <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-500">Loading expense data…</div> : null}
      {isError ? <div className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-700">Failed to load expenses.</div> : null}

      {!isLoading && !isError ? (
        <div className="mt-5 space-y-5">
          <DataTable title="Shift Expenses" subtitle="Expenses entered during the daily shift workflow.">
            <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Category / Type</th><th className="px-3 py-2">Supplier / Payee</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Entered By</th>{isOwner && <th className="w-[92px] px-2 py-2 text-right">Actions</th>}</tr></thead>
            <tbody>
              {inShiftExpenses.length === 0 ? <tr><td colSpan={isOwner ? 7 : 6} className="px-3 py-8 text-center text-slate-400">No shift expenses found.</td></tr> : null}
              {inShiftExpenses.map((row) => {
                const draft = editingShiftExpenseId === String(row.id) ? shiftExpenseDraft : null;
                return <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{draft ? <Input value={draft.category} onChange={(e) => setShiftExpenseDraft({ ...draft, category: e.target.value })} className="h-8" /> : row.category || "UNMAPPED"}</td><td className="px-3 py-2">{draft ? <Input value={draft.supplier} onChange={(e) => setShiftExpenseDraft({ ...draft, supplier: e.target.value })} className="h-8" /> : row.supplier || "—"}</td><td className="px-3 py-2">{draft ? <Input value={draft.description} onChange={(e) => setShiftExpenseDraft({ ...draft, description: e.target.value })} className="h-8" /> : row.description || "—"}</td><td className="px-3 py-2 text-right font-mono">{draft ? <Input type="number" value={draft.amount} onChange={(e) => setShiftExpenseDraft({ ...draft, amount: e.target.value })} className="ml-auto h-8 w-24 text-right" /> : money(row.amount)}</td><td className="px-3 py-2">{row.entered_by || "—"}</td>{isOwner && <td className="px-2 py-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginShiftExpenseEdit(row)} aria-label="Edit shift expense" title="Edit shift expense"><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveShiftExpense(row)} disabled={!draft || updateShiftExpense.isPending} aria-label="Save shift expense" title="Save shift expense"><Save className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" disabled={deleteShiftExpense.isPending} onClick={() => window.confirm(`Delete ${row.description || "this shift expense"}?`) && deleteShiftExpense.mutate(row)} aria-label="Delete shift expense" title="Delete shift expense"><Trash2 className="h-3.5 w-3.5" /></Button></div></td>}</tr>;
              })}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-black"><td colSpan={4} className="px-3 py-3 text-right">TOTAL</td><td className="px-3 py-3 text-right font-mono">{money(shiftTotal)}</td><td colSpan={isOwner ? 2 : 1} /></tr></tfoot>
          </DataTable>

          <DataTable
            title="Business Expenses"
            subtitle="Direct business expenses and approved bank-statement expenses. Category changes are staged and saved together."
            actions={isOwner ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={exportPersonalCsv} disabled={!personalTransactions.length || personalQuery.isLoading}><Download className="mr-2 h-4 w-4" />Export Personal CSV ({personalTransactions.length})</Button>
                <Button size="sm" className="bg-slate-950 text-white hover:bg-slate-800" disabled={!changedCategoryCount || bulkSaveCategories.isPending} onClick={() => bulkSaveCategories.mutate()}><Save className="mr-2 h-4 w-4" />Save & Learn Categories ({changedCategoryCount})</Button>
              </div>
            ) : undefined}
          >
            <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Supplier / Payee</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th>{isOwner && <th className="w-[132px] px-2 py-2 text-right">Actions</th>}</tr></thead>
            <tbody>
              {businessExpenses.length === 0 ? <tr><td colSpan={isOwner ? 6 : 5} className="px-3 py-8 text-center text-slate-400">No business expenses found.</td></tr> : null}
              {businessExpenses.map((row) => {
                const id = String(row.id);
                const draft = editingExpenseId === id ? expenseDraft : null;
                const canMarkPersonal = Boolean(row?.meta?.bankTxnId) || id.startsWith("bank_txn:");
                const selectedCategory = categoryChanges[id] ?? String(row.category || "Review");
                const matchingRule = vendorRules.find((rule) => String(row.description || "").toUpperCase().includes(String(rule.matchText || "").toUpperCase()));
                const isSuggested = Boolean(matchingRule && matchingRule.category === selectedCategory && !(id in categoryChanges));
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">{draft ? <Input type="date" value={draft.date} onChange={(e) => setExpenseDraft({ ...draft, date: e.target.value })} className="h-8" /> : formatDate(row.date)}</td>
                    <td className="px-3 py-2">{draft ? <Input value={draft.supplier} onChange={(e) => setExpenseDraft({ ...draft, supplier: e.target.value })} className="h-8" /> : row.supplier || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex min-w-[210px] items-center gap-2">
                        <select
                          value={selectedCategory}
                          disabled={!isOwner}
                          onChange={(event) => {
                            const next = event.target.value;
                            setCategoryChanges((current) => {
                              const copy = { ...current };
                              if (next === String(row.category || "Review")) delete copy[id];
                              else copy[id] = next;
                              return copy;
                            });
                            if (draft) setExpenseDraft({ ...draft, category: next });
                          }}
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-800 disabled:cursor-default disabled:bg-transparent"
                        >
                          {BUSINESS_EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        {id in categoryChanges ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">Unsaved</span> : isSuggested ? <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-700">Suggested</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">{draft ? <Input value={draft.description} onChange={(e) => setExpenseDraft({ ...draft, description: e.target.value })} className="h-8" /> : row.description || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{draft ? <Input type="number" value={draft.amount} onChange={(e) => setExpenseDraft({ ...draft, amount: e.target.value })} className="ml-auto h-8 w-24 text-right" /> : money(row.amount)}</td>
                    {isOwner && <td className="px-2 py-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginExpenseEdit(row)} aria-label="Edit business expense" title="Edit business expense"><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveExpense} disabled={!draft || updateBusinessExpense.isPending} aria-label="Save business expense" title="Save business expense"><Save className="h-3.5 w-3.5" /></Button>{canMarkPersonal ? <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => window.confirm(`Mark ${row.description || row.supplier || "this transaction"} as Personal?`) && markBusinessExpensePersonal.mutate(row)}>Personal</Button> : null}<Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => window.confirm(`Delete ${row.description || row.supplier || "this expense"}?`) && deleteBusinessExpense.mutate(id)} aria-label="Delete business expense" title="Delete business expense"><Trash2 className="h-3.5 w-3.5" /></Button></div></td>}
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-black"><td colSpan={4} className="px-3 py-3 text-right">TOTAL</td><td className="px-3 py-3 text-right font-mono">{money(businessTotal)}</td>{isOwner && <td />}</tr></tfoot>
          </DataTable>

          <DirectorBeneficiaryLoans isOwner={isOwner} />

          <DataTable title="Bank Deposits / Credits — Reconciliation Only" subtitle="Incoming bank entries are shown here for reconciliation and are not counted as expenses.">
            <thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Bank Source</th><th className="px-3 py-2">Classification</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
            <tbody>{deposits.length === 0 ? <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">No bank deposits found for this date range.</td></tr> : deposits.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="px-3 py-2">{formatDate(row.date)}</td><td className="px-3 py-2">{row.description || "—"}</td><td className="px-3 py-2">{row.ref || "—"}</td><td className="px-3 py-2">{row.source || "—"}</td><td className="px-3 py-2">{row.classification || "Unclassified Deposit"}</td><td className="px-3 py-2 text-right font-mono text-emerald-700">{money(row.amount)}</td></tr>)}</tbody>
            <tfoot><tr className="border-t-2 border-slate-300 bg-slate-50 font-black"><td colSpan={5} className="px-3 py-3 text-right">TOTAL</td><td className="px-3 py-3 text-right font-mono text-emerald-700">{money(depositTotal)}</td></tr></tfoot>
          </DataTable>
        </div>
      ) : null}
    </div>
  );
}

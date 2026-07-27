import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expensesPath = path.join(root, "client/src/pages/finance/Expenses.tsx");
const componentPath = path.join(root, "client/src/components/GroupedBankExpenseReview.tsx");

const component = String.raw`import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { ChevronDown, ChevronRight, Languages, UserRoundX } from "lucide-react";

type BankTxn = {
  id: string;
  batchId?: string;
  postedAt: string;
  description: string;
  amountTHB: string | number;
  category?: string;
  supplier?: string;
  merchantSuggestion?: string | null;
  status: string;
};

type GroupDraft = { supplier: string; category: string };

const fallbackCategories = [
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

function normalizeDescriptor(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(pos|visa|mastercard|promptpay|transfer|payment|purchase|debit|card)\b/g, " ")
    .replace(/\b\d{4,}\b/g, " ")
    .replace(/[^a-z0-9ก-๙&.' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "unknown supplier";
}

function money(value: string | number) {
  return "฿" + Math.abs(Number(value || 0)).toLocaleString("en-TH", { maximumFractionDigits: 2 });
}

function dateText(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB");
}

export function GroupedBankExpenseReview({ onChanged }: { onChanged?: () => void }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>({});

  const queue = useQuery<any>({
    queryKey: ["/api/bank-imports", "review-queue", "grouped-business"],
    queryFn: () => apiRequest("/api/bank-imports/review-queue?tab=pending_review&limit=1000"),
  });

  const transactions: BankTxn[] = queue.data?.txns || [];
  const categories: string[] = queue.data?.allowedBusinessCategories || fallbackCategories;

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; rows: BankTxn[]; total: number }>();
    for (const txn of transactions.filter((row) => row.status === "pending" && Number(row.amountTHB) > 0)) {
      const label = String(txn.supplier || txn.merchantSuggestion || txn.description || "Unknown supplier").trim();
      const key = normalizeDescriptor(label);
      const group = map.get(key) || { key, label, rows: [], total: 0 };
      group.rows.push(txn);
      group.total += Math.abs(Number(txn.amountTHB || 0));
      if (!map.has(key)) map.set(key, group);
    }
    return [...map.values()].sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
  }, [transactions]);

  const approve = useMutation({
    mutationFn: async ({ groupKey, rows }: { groupKey: string; rows: BankTxn[] }) => {
      const draft = drafts[groupKey] || { supplier: rows[0]?.supplier || rows[0]?.merchantSuggestion || rows[0]?.description || "", category: rows[0]?.category || "" };
      if (!draft.category) throw new Error("Select an expense category first.");
      const byBatch = rows.reduce<Record<string, string[]>>((acc, row) => {
        if (row.batchId) (acc[row.batchId] ||= []).push(row.id);
        return acc;
      }, {});
      const results = [];
      for (const [batchId, ids] of Object.entries(byBatch)) {
        results.push(await apiRequest("/api/bank-imports/" + batchId + "/approve", {
          method: "POST",
          body: JSON.stringify({ ids, defaults: { supplier: draft.supplier, category: draft.category } }),
        }));
      }
      try {
        await apiRequest("/api/bank-imports/rules", {
          method: "POST",
          body: JSON.stringify({ matchText: groupKey, supplier: draft.supplier, category: draft.category }),
        });
      } catch {
        // Rule storage is optional on older production schemas; approval still succeeds.
      }
      return results;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/bank-imports", "review-queue"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard"] });
      onChanged?.();
    },
  });

  const markPersonal = useMutation({
    mutationFn: async (rows: BankTxn[]) => {
      for (const row of rows) {
        await apiRequest("/api/bank-imports/txns/" + row.id, {
          method: "PATCH",
          body: JSON.stringify({ category: "Personal / Owner" }),
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/bank-imports", "review-queue"] });
      onChanged?.();
    },
  });

  if (queue.isLoading) return <div className="p-4 text-xs text-slate-500">Loading uploaded statement expenses…</div>;
  if (queue.isError) return <div className="p-4 text-xs text-red-600">Could not load uploaded statement expenses.</div>;
  if (groups.length === 0) return <div className="border-b bg-emerald-50 px-4 py-3 text-xs text-emerald-800">No uploaded statement expenses need review.</div>;

  return <div className="border-b bg-amber-50/50 p-3">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div><strong className="text-sm text-slate-950">Uploaded statement expenses</strong><p className="text-xs text-slate-600">Grouped by matching statement descriptor. Set the category once and approve the whole group.</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">{transactions.length} pending</span>
    </div>
    <div className="space-y-2">{groups.map((group) => {
      const open = Boolean(expanded[group.key]);
      const draft = drafts[group.key] || { supplier: group.label, category: group.rows[0]?.category || "" };
      const translateUrl = "https://translate.google.com/?sl=auto&tl=" + (/[฀-๿]/.test(group.rows[0]?.description || "") ? "en" : "th") + "&text=" + encodeURIComponent(group.rows[0]?.description || group.label) + "&op=translate";
      return <div key={group.key} className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_220px_220px_auto] lg:items-end">
          <button type="button" onClick={() => setExpanded((current) => ({ ...current, [group.key]: !open }))} className="flex min-w-0 items-center gap-2 text-left">
            {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className="min-w-0"><strong className="block truncate text-sm">{group.label}</strong><span className="text-xs text-slate-500">{group.rows.length} transaction{group.rows.length === 1 ? "" : "s"} · {money(group.total)}</span></span>
          </button>
          <label className="text-[11px] font-semibold text-slate-600">Supplier / Payee<Input value={draft.supplier} onChange={(event) => setDrafts((current) => ({ ...current, [group.key]: { ...draft, supplier: event.target.value } }))} className="mt-1 h-9" /></label>
          <label className="text-[11px] font-semibold text-slate-600">Expense type<select value={draft.category} onChange={(event) => setDrafts((current) => ({ ...current, [group.key]: { ...draft, category: event.target.value } }))} className="mt-1 h-9 w-full rounded-md border px-2 text-xs"><option value="">Select category</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!draft.category || approve.isPending} onClick={() => approve.mutate({ groupKey: group.key, rows: group.rows })}>Approve all {group.rows.length}</Button>
            <Button size="sm" variant="outline" disabled={markPersonal.isPending} onClick={() => markPersonal.mutate(group.rows)}><UserRoundX className="mr-1 h-3.5 w-3.5" />Personal</Button>
            <Button size="sm" variant="outline" onClick={() => window.open(translateUrl, "_blank", "noopener,noreferrer")}><Languages className="mr-1 h-3.5 w-3.5" />EN ↔ TH</Button>
          </div>
        </div>
        {open && <div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-xs"><thead><tr className="bg-slate-50 text-left text-slate-500"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Statement description (read-only)</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody>{group.rows.map((row) => <tr key={row.id} className="border-t"><td className="px-3 py-2">{dateText(row.postedAt)}</td><td className="px-3 py-2">{row.description}</td><td className="px-3 py-2 text-right font-mono">{money(row.amountTHB)}</td></tr>)}</tbody></table></div>}
      </div>;
    })}</div>
    {approve.isError && <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">{(approve.error as Error)?.message || "Bulk approval failed"}</div>}
  </div>;
}
`;

fs.writeFileSync(componentPath, component);

let expenses = fs.readFileSync(expensesPath, "utf8");
expenses = expenses.replace('import { BankTransactionReview } from "@/components/BankTransactionReview";\n', 'import { GroupedBankExpenseReview } from "@/components/GroupedBankExpenseReview";\n');

const oldTable2 = `          <DataTable title="Table 2 — Business Expenses Outside Shift">\n            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Supplier/Payee</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Payment Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>\n            <tbody>`;
const newTable2 = `          <DataTable title="Table 2 — Business Expenses">\n            <tbody><tr><td colSpan={9} className="p-0"><GroupedBankExpenseReview onChanged={() => {\n              queryClient.invalidateQueries({ queryKey: ["/api/finance/expenses-dashboard", dateFrom, dateTo] });\n              queryClient.invalidateQueries({ queryKey: ["/api/bank-imports/review-queue", "personal"] });\n            }} /></td></tr></tbody>\n            <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Supplier/Payee</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Statement description</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Payment Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Created</th><th className="px-3 py-2 text-right">Actions</th></tr></thead>\n            <tbody>`;
if (!expenses.includes(oldTable2)) throw new Error("Business Expenses table anchor not found");
expenses = expenses.replace(oldTable2, newTable2);

const pendingStart = expenses.indexOf('          <DataTable title="Table 3 — Pending Imported Bank Transactions">');
const personalStart = expenses.indexOf('          <DataTable title="Table 4 — Personal Expenses"');
if (pendingStart < 0 || personalStart < 0 || personalStart <= pendingStart) throw new Error("Pending imported table boundaries not found");
expenses = expenses.slice(0, pendingStart) + expenses.slice(personalStart).replace('Table 4 — Personal Expenses', 'Table 3 — Personal Expenses');

fs.writeFileSync(expensesPath, expenses);
console.log("Grouped Business Expenses import workflow applied successfully.");

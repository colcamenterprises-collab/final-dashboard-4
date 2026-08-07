import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";

type Loan = {
  id: string;
  amount: string | number;
  payment_required_date: string | null;
  payment_terms: string | null;
  balance: string | number;
};

type Draft = {
  amount: string;
  payment_required_date: string;
  payment_terms: string;
  balance: string;
};

const emptyDraft: Draft = { amount: "", payment_required_date: "", payment_terms: "", balance: "" };
const money = (value: unknown) => `฿${Number(value || 0).toLocaleString("en-TH", { maximumFractionDigits: 2 })}`;

export default function DirectorBeneficiaryLoans({ isOwner }: { isOwner: boolean }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const { data, isLoading } = useQuery<{ ok: boolean; data: Loan[] }>({
    queryKey: ["/api/finance/director-beneficiary-loans"],
    enabled: isOwner,
    queryFn: async () => {
      const response = await fetch("/api/finance/director-beneficiary-loans", { credentials: "include" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Failed to load loans");
      return payload;
    },
  });

  const save = useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Draft }) => {
      const response = await fetch(id ? `/api/finance/director-beneficiary-loans/${id}` : "/api/finance/director-beneficiary-loans", {
        method: id ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(values.amount),
          payment_required_date: values.payment_required_date || null,
          payment_terms: values.payment_terms.trim(),
          balance: values.balance === "" ? Number(values.amount) : Number(values.balance),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Failed to save loan");
      return payload;
    },
    onSuccess: () => {
      setAdding(false); setEditingId(null); setDraft(emptyDraft);
      queryClient.invalidateQueries({ queryKey: ["/api/finance/director-beneficiary-loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/director-beneficiary-loans/summary"] });
    },
    onError: (error: Error) => window.alert(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/finance/director-beneficiary-loans/${id}`, { method: "DELETE", credentials: "include" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Failed to delete loan");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/director-beneficiary-loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/director-beneficiary-loans/summary"] });
    },
    onError: (error: Error) => window.alert(error.message),
  });

  if (!isOwner) return null;

  const loans = data?.data || [];
  const beginEdit = (loan: Loan) => {
    setAdding(false); setEditingId(loan.id);
    setDraft({
      amount: String(Number(loan.amount || 0)),
      payment_required_date: loan.payment_required_date?.slice(0, 10) || "",
      payment_terms: loan.payment_terms || "",
      balance: String(Number(loan.balance || 0)),
    });
  };
  const valid = Number(draft.amount) >= 0 && (draft.balance === "" || Number(draft.balance) >= 0);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Director / Beneficiary Loans</h2>
          <p className="text-[11px] text-slate-500">Outstanding balances are reported as liabilities and do not reduce operating profit.</p>
        </div>
        {!adding && <Button size="sm" variant="outline" onClick={() => { setAdding(true); setEditingId(null); setDraft(emptyDraft); }}><Plus className="mr-1 h-3.5 w-3.5" />Add Loan</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[720px] text-xs">
          <thead><tr className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800"><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Payment Required Date</th><th className="px-3 py-2">Payment Terms</th><th className="px-3 py-2 text-right">Balance</th><th className="w-[100px] px-2 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {adding && <tr className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-2 py-1"><Input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="ml-auto h-8 w-28 text-right text-xs" placeholder="0" /></td>
              <td className="px-2 py-1"><Input type="date" value={draft.payment_required_date} onChange={(e) => setDraft({ ...draft, payment_required_date: e.target.value })} className="h-8 text-xs" /></td>
              <td className="px-2 py-1"><Input value={draft.payment_terms} onChange={(e) => setDraft({ ...draft, payment_terms: e.target.value })} className="h-8 text-xs" placeholder="e.g. Monthly / On demand" /></td>
              <td className="px-2 py-1"><Input type="number" min="0" step="0.01" value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })} className="ml-auto h-8 w-28 text-right text-xs" placeholder="Defaults to amount" /></td>
              <td className="px-2 py-1"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" disabled={!valid || save.isPending} onClick={() => save.mutate({ values: draft })}><Save className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setAdding(false); setDraft(emptyDraft); }}><X className="h-3.5 w-3.5" /></Button></div></td>
            </tr>}
            {isLoading && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">Loading loans...</td></tr>}
            {!isLoading && loans.length === 0 && !adding && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No director / beneficiary loans recorded.</td></tr>}
            {loans.map((loan) => {
              const editing = editingId === loan.id;
              return <tr key={loan.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-3 py-2 text-right font-mono">{editing ? <Input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="ml-auto h-8 w-28 text-right text-xs" /> : money(loan.amount)}</td>
                <td className="px-3 py-2">{editing ? <Input type="date" value={draft.payment_required_date} onChange={(e) => setDraft({ ...draft, payment_required_date: e.target.value })} className="h-8 text-xs" /> : loan.payment_required_date ? new Date(loan.payment_required_date).toLocaleDateString("en-GB") : "—"}</td>
                <td className="px-3 py-2">{editing ? <Input value={draft.payment_terms} onChange={(e) => setDraft({ ...draft, payment_terms: e.target.value })} className="h-8 text-xs" /> : loan.payment_terms || "—"}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{editing ? <Input type="number" min="0" step="0.01" value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })} className="ml-auto h-8 w-28 text-right text-xs" /> : money(loan.balance)}</td>
                <td className="px-2 py-1"><div className="flex justify-end gap-1">{editing ? <><Button size="icon" variant="ghost" className="h-7 w-7" disabled={!valid || save.isPending} onClick={() => save.mutate({ id: loan.id, values: draft })}><Save className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(null); setDraft(emptyDraft); }}><X className="h-3.5 w-3.5" /></Button></> : <><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => beginEdit(loan)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => { if (window.confirm("Delete this loan record?")) remove.mutate(loan.id); }}><Trash2 className="h-3.5 w-3.5" /></Button></>}</div></td>
              </tr>;
            })}
          </tbody>
          <tfoot><tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800"><td className="px-3 py-2 text-right font-mono">{money(loans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0))}</td><td colSpan={2} className="px-3 py-2 text-slate-500">Total</td><td className="px-3 py-2 text-right font-mono">{money(loans.reduce((sum, loan) => sum + Number(loan.balance || 0), 0))}</td><td /></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

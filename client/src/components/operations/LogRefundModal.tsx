import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

interface Props {
  shiftId?: string;
  shiftDate?: string;
}

export function LogRefundModal({ shiftId, shiftDate }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    reason: "",
    platform: "cash",
    loggedBy: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      axios.post("/api/refunds/log", {
        shiftId: shiftId || null,
        shiftDate: shiftDate || new Date().toISOString().slice(0, 10),
        amount: Number(form.amount),
        reason: form.reason,
        platform: form.platform,
        loggedBy: form.loggedBy,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/refunds"] });
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setForm({ amount: "", reason: "", platform: "cash", loggedBy: "", notes: "" });
      }, 1200);
    },
    onError: (e: any) => {
      setError(e?.response?.data?.error || "Failed to log refund");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.amount || !form.reason || !form.loggedBy) {
      setError("Amount, reason, and logged-by are required");
      return;
    }
    mutation.mutate();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-[4px] border border-red-200 transition-colors"
      >
        Log Refund
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[4px] shadow-lg w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">Log Refund</div>
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>

        {success ? (
          <div className="text-center py-6 text-emerald-600 font-medium text-sm">Refund logged successfully</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-slate-600 block mb-1">Amount (฿) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full border border-slate-300 rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Reason *</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Wrong order, customer complaint"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Platform</label>
              <select
                className="w-full border border-slate-300 rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
              >
                <option value="cash">Cash</option>
                <option value="grab">Grab</option>
                <option value="qr">QR / PromptPay</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Logged By *</label>
              <input
                type="text"
                className="w-full border border-slate-300 rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={form.loggedBy}
                onChange={e => setForm(f => ({ ...f, loggedBy: e.target.value }))}
                placeholder="Staff name"
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-600 block mb-1">Notes</label>
              <textarea
                className="w-full border border-slate-300 rounded-[4px] px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>

            {error && <div className="text-xs text-red-600">{error}</div>}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 px-3 py-1.5 border border-slate-300 rounded-[4px] text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-[4px] text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? "Saving..." : "Log Refund"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

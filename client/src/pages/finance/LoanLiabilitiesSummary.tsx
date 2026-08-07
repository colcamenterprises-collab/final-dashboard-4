import { useQuery } from "@tanstack/react-query";

function fmt(value: unknown) {
  return Number(value || 0).toLocaleString("en-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function LoanLiabilitiesSummary() {
  const { data } = useQuery<any>({
    queryKey: ["/api/finance/director-beneficiary-loans/summary"],
    queryFn: async () => {
      const response = await fetch("/api/finance/director-beneficiary-loans/summary", { credentials: "include" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Failed to load loan liabilities");
      return payload;
    },
  });

  const totalAmount = data?.data?.total_amount || 0;
  const totalBalance = data?.data?.total_balance || 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Liabilities</p>
          <h2 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">Director / Beneficiary Loans</h2>
          <p className="mt-1 text-[11px] text-slate-500">Shown as an outstanding liability. Loan principal does not reduce operating profit.</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-right">
          <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Original Amount</p><p className="font-mono text-sm font-semibold">฿{fmt(totalAmount)}</p></div>
          <div><p className="text-[10px] uppercase tracking-wide text-slate-500">Balance</p><p className="font-mono text-sm font-semibold text-red-600">฿{fmt(totalBalance)}</p></div>
        </div>
      </div>
    </section>
  );
}

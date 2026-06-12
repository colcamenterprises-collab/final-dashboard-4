import { useQuery } from "@tanstack/react-query";

const thb = (value: unknown) => typeof value === "number" ? `฿${value.toLocaleString("en-TH")}` : "Missing";
const val = (value: unknown) => value === null || value === undefined || value === "" ? "Missing" : String(value);
const badge = (status?: string) => status === "PASS" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : status === "FAIL" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800";

export default function DailySalesAnalysis() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ["/api/operations-read/daily-sales-analysis"] });
  const lines = data?.lines ?? [];
  const sales = data?.latestSales ?? {};

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Read-only analysis</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Daily Sales V2 Analysis</h1>
        <p className="mt-1 text-sm text-slate-600">Latest submitted form compared against POS receipt mirror where data exists. This page does not alter saved form data.</p>
      </div>

      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Loading latest sales analysis...</div>}
      {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Failed to load sales analysis.</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Date</p><p className="font-semibold">{val(data?.date)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Submitted by</p><p className="font-semibold">{val(sales.submittedBy)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Sales total</p><p className="font-semibold">{thb(sales.totalSales)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Balance status</p><p className="font-semibold">{val(sales.balanceStatus)}</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Form vs POS mirror</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 text-left">Line</th><th className="px-3 py-2 text-right">Staff form</th><th className="px-3 py-2 text-right">POS mirror</th><th className="px-3 py-2 text-right">Variance</th><th className="px-3 py-2 text-left">Status</th></tr></thead>
            <tbody>{lines.map((line: any) => <tr key={line.label} className="border-t border-slate-100"><td className="px-3 py-3 font-medium">{line.label}</td><td className="px-3 py-3 text-right">{typeof line.staff === "number" && line.label !== "Receipts" ? thb(line.staff) : val(line.staff)}</td><td className="px-3 py-3 text-right">{typeof line.pos === "number" && line.label !== "Receipts" ? thb(line.pos) : val(line.pos)}</td><td className="px-3 py-3 text-right">{line.variance === null ? "Missing" : line.label === "Receipts" ? line.variance : thb(line.variance)}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${badge(line.status)}`}>{line.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      {(data?.blockers ?? []).length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><h2 className="font-semibold">Missing data blockers</h2>{data.blockers.map((b: any, idx: number) => <p key={idx} className="mt-1"><strong>{b.code}</strong>: {b.message}</p>)}</section>}

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-slate-800">Raw response</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre></details>
    </div>
  );
}

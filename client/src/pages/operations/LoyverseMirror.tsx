import { useQuery } from "@tanstack/react-query";

const thb = (value: unknown) => typeof value === "number" ? `฿${value.toLocaleString("en-TH")}` : "Missing";
const shown = (value: unknown) => value === null || value === undefined || value === "" ? "Missing" : String(value);

function statusClass(status?: string) {
  if (status === "MATCH" || status === "VERIFIED") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "MISMATCH" || status === "FAILED") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function LoyverseMirror() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ["/api/operations-read/loyverse-mirror"] });
  const rows = data?.sevenDayComparison ?? [];
  const blockers = data?.blockers ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <section className={`rounded-2xl border p-4 shadow-sm ${statusClass(data?.verdict)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide">Final verdict</p>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">{isLoading ? "Checking Loyverse mirror..." : data?.verdictText ?? "LOYVERSE MIRROR FAILED — APP CANNOT BE TRUSTED YET"}</h1>
        <p className="mt-2 text-sm">Source: lv_receipt and loyverse_shifts. Missing data is shown as Missing or NO_SHIFT_DATA.</p>
      </section>

      {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Failed to load Loyverse mirror status.</div>}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Latest receipt timestamp</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{shown(data?.latestSync?.latestReceiptTimestamp)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Latest shift report date</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{shown(data?.latestSync?.latestShiftReportDate)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Receipt rows mirrored</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{shown(data?.latestSync?.receiptCount)}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Latest shift comparison</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <div><p className="text-xs text-slate-500">Date</p><p className="font-medium">{shown(data?.latestShiftComparison?.date)}</p></div>
          <div><p className="text-xs text-slate-500">Receipt total</p><p className="font-medium">{thb(data?.latestShiftComparison?.receiptTotal)}</p></div>
          <div><p className="text-xs text-slate-500">Shift total</p><p className="font-medium">{thb(data?.latestShiftComparison?.shiftTotal)}</p></div>
          <div><p className="text-xs text-slate-500">Status</p><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(data?.latestShiftComparison?.status)}`}>{shown(data?.latestShiftComparison?.status)}</span></div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">7-day comparison</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Receipts</th><th className="px-3 py-2 text-right">Receipt total</th><th className="px-3 py-2 text-right">Shift total</th><th className="px-3 py-2 text-right">Variance</th><th className="px-3 py-2 text-left">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.date} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-medium">{row.date}</td>
                  <td className="px-3 py-3 text-right">{row.receiptCount}</td>
                  <td className="px-3 py-3 text-right">{thb(row.receiptTotal)}</td>
                  <td className="px-3 py-3 text-right">{thb(row.shiftTotal)}</td>
                  <td className="px-3 py-3 text-right">{row.variance === null ? "Missing" : thb(row.variance)}</td>
                  <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {blockers.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">Blockers and mismatches</h2>
          <div className="mt-2 space-y-2">
            {blockers.map((b: any, idx: number) => <p key={`${b.code}-${idx}`}><strong>{b.code}</strong>: {b.message} ({b.canonical_source})</p>)}
          </div>
        </section>
      )}

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-800">Raw response</summary>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";

const val = (value: unknown) => value === null || value === undefined || value === "" ? "Missing" : String(value);

export default function DailyStockAnalysis() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ["/api/operations-read/daily-stock-analysis"] });
  const stock = data?.latestStock ?? {};
  const drinks = stock.drinks && typeof stock.drinks === "object" ? Object.entries(stock.drinks) : [];
  const shopping = Array.isArray(stock.requestedShopping) ? stock.requestedShopping : [];
  const missing = Array.isArray(stock.missingMappings) ? stock.missingMappings : [];
  const stockMissing = stock.status === "missing";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Read-only analysis</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Daily Stock V2 Analysis</h1>
        <p className="mt-1 text-sm text-slate-600">Latest stock submission, shopping requests, and mapping visibility. No POS usage is invented.</p>
      </div>
      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Loading latest stock analysis...</div>}
      {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Failed to load stock analysis.</div>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Status</p><p className="font-semibold capitalize">{val(stock.status)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Rolls</p><p className="font-semibold">{val(stock.rolls)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Meat</p><p className="font-semibold">{val(stock.meat)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Drinks counted</p><p className="font-semibold">{drinks.length || "Missing"}</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Drinks summary</h2>
          <div className="mt-3 divide-y divide-slate-100 text-sm">{drinks.length === 0 ? <p className="py-2 text-slate-500">Missing</p> : drinks.map(([name, qty]) => <div key={name} className="flex justify-between py-2"><span>{name}</span><span className="font-medium">{val(qty)}</span></div>)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Requested shopping items</h2>
          <div className="mt-3 divide-y divide-slate-100 text-sm">{shopping.length === 0 ? <p className="py-2 text-slate-500">{stockMissing ? "Missing" : "No requested shopping items recorded."}</p> : shopping.map((item: any, idx: number) => <div key={idx} className="flex justify-between gap-3 py-2"><span>{item.name ?? item.item ?? "Unnamed item"}</span><span className="font-medium">{val(item.qty ?? item.quantity)} {val(item.unit ?? "")}</span></div>)}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <h2 className="font-semibold">Missing item mappings</h2>
        {missing.length === 0 ? <p className="mt-2">{stockMissing ? "Missing" : "No missing mappings reported by the latest stock payload."}</p> : missing.map((item: any, idx: number) => <p key={idx} className="mt-1">{item.name ?? item.item ?? `Item ${idx + 1}`} is UNMAPPED.</p>)}
        <p className="mt-3 text-xs">{data?.comparisonNote}</p>
      </section>

      {(data?.blockers ?? []).length > 0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><h2 className="font-semibold">Missing data blockers</h2>{data.blockers.map((b: any, idx: number) => <p key={idx} className="mt-1"><strong>{b.code}</strong>: {b.message}</p>)}</section>}

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-slate-800">Raw response</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre></details>
    </div>
  );
}

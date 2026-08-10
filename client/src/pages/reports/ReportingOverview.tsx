import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExactDateTimeRange, reportingRangeParams, type ExactDateTimeRangeValue } from "@/components/reports/ExactDateTimeRange";
import { PageTitle } from "@/components/ui/sbb-cards";

const money = (value: number) => `฿${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

type OverviewResponse = {
  ok: boolean;
  source: string;
  filters: ExactDateTimeRangeValue & { fromInstant: string; toInstant: string };
  sourcesIncluded: string[];
  overview: {
    receiptCount: number;
    grossSales: number;
    discounts: number;
    refunds: number;
    netSales: number;
    averageOrder: number;
    historicalReceipts: number;
    liveReceipts: number;
    paymentSales: Record<string, number>;
  };
  error?: string;
};

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div>{sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}</div>;
}

function paymentGroup(name: string) {
  const key = name.toLowerCase();
  if (key.includes("grab")) return "Grab";
  if (key.includes("scan") || key.includes("prompt") || key.includes("qr")) return "QR";
  if (key.includes("cash")) return "Cash";
  if (key.includes("card")) return "Card";
  return "Other";
}

export default function ReportingOverview() {
  const [range, setRange] = useState<ExactDateTimeRangeValue>({
    fromDate: localDate(-1),
    fromTime: "17:00",
    toDate: localDate(),
    toTime: "03:00",
    timezone: "Asia/Bangkok",
  });
  const params = useMemo(() => reportingRangeParams(range), [range]);
  const query = useQuery<OverviewResponse>({
    queryKey: ["unified-reporting-overview", params],
    queryFn: async () => {
      const response = await fetch(`/api/reports/unified/overview?${params}`, { credentials: "include", cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw new Error(body.error || `HTTP ${response.status}`);
      return body;
    },
  });

  const paymentGroups = useMemo(() => {
    const grouped: Record<string, number> = { Cash: 0, QR: 0, Grab: 0, Card: 0, Other: 0 };
    for (const [name, amount] of Object.entries(query.data?.overview.paymentSales || {})) grouped[paymentGroup(name)] += Number(amount || 0);
    return grouped;
  }, [query.data]);

  const data = query.data?.overview;
  return <div className="space-y-5">
    <PageTitle title="Reporting Overview" subtitle="One exact date/time range across historical and live POS data" />
    <ExactDateTimeRange value={range} onChange={setRange} timezoneLabel="Venue time · Asia/Bangkok" />

    {query.isLoading ? <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading reporting data…</div> : null}
    {query.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{(query.error as Error).message}</div> : null}
    {data ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Net sales" value={money(data.netSales)} sub={`Gross ${money(data.grossSales)}`} />
        <Metric label="Orders" value={String(data.receiptCount)} sub={`${data.historicalReceipts} historical · ${data.liveReceipts} live`} />
        <Metric label="Average order" value={money(data.averageOrder)} />
        <Metric label="Discounts / refunds" value={money(data.discounts + data.refunds)} sub={`Discounts ${money(data.discounts)} · Refunds ${money(data.refunds)}`} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-base font-black text-slate-950">Sales by payment / channel</h2><p className="text-xs text-slate-500">Grouped for readability while source payment names remain in the ledger.</p></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(paymentGroups).map(([label, amount]) => <Metric key={label} label={label} value={money(amount)} />)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500 shadow-sm">
        <div><strong className="text-slate-700">Sources:</strong> {(query.data?.sourcesIncluded || []).join(" + ") || "No transactions in selected range"}</div>
        <div className="mt-1"><strong className="text-slate-700">Resolved range:</strong> {query.data?.filters.fromInstant} → {query.data?.filters.toInstant}</div>
      </section>
    </> : null}
  </div>;
}

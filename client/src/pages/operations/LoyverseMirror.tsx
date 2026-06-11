import { useEffect, useMemo, useState } from "react";

type Diagnostic = {
  status: "ok" | "warning" | "fail";
  latestSyncAt: string | null;
  latestReceiptDate: string | null;
  latestShiftDate: string | null;
  canonicalTables?: Record<string, any>;
  receiptCounts: Record<string, number | null>;
  integrity?: Record<string, any[]>;
  paymentMapping?: { mappedPayments?: any[]; unmappedPayments?: any[]; rules?: Record<string, any> };
  latestShiftComparison?: any;
  sevenDayComparison?: any[];
  blockers: any[];
  mismatches: any[];
  sourceMap?: Record<string, any>;
};

function formatValue(value: unknown) {
  if (value == null) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "ok" || status === "match"
    ? "bg-green-100 text-green-800 border-green-200"
    : status === "warning"
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-red-100 text-red-800 border-red-200";
  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function KeyValueTable({ data, labelKey = "Field", valueKey = "Value" }: { data?: Record<string, any>; labelKey?: string; valueKey?: string }) {
  const entries = Object.entries(data || {});
  if (entries.length === 0) return <p className="text-sm text-slate-600">No data returned.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead><tr className="border-b"><th className="py-2 pr-4">{labelKey}</th><th className="py-2 pr-4">{valueKey}</th></tr></thead>
        <tbody>{entries.map(([key, value]) => <tr className="border-b" key={key}><td className="py-2 pr-4 font-mono">{key}</td><td className="py-2 pr-4">{formatValue(value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function FindingsTable({ rows, emptyText }: { rows?: any[]; emptyText: string }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-slate-600">{emptyText}</p>;
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead><tr className="border-b">{columns.map((column) => <th className="py-2 pr-3" key={column}>{column}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr className="border-b" key={index}>{columns.map((column) => <td className="py-2 pr-3" key={column}>{formatValue(row?.[column])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function LoyverseMirror() {
  const [data, setData] = useState<Diagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/loyverse/mirror-diagnostic")
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err) => {
        if (active) setError(err?.message || "Failed to load Loyverse mirror diagnostic");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const finalStatus = useMemo(
    () => data?.status === "ok" ? "LOYVERSE MIRROR VERIFIED — APP CAN BE TRUSTED" : "LOYVERSE MIRROR FAILED — APP CANNOT BE TRUSTED YET",
    [data],
  );

  if (loading) {
    return <main className="p-6"><h1 className="text-2xl font-semibold">Loyverse Mirror Verification</h1><p className="mt-4">Loading diagnostic...</p></main>;
  }

  if (error) {
    return <main className="p-6"><h1 className="text-2xl font-semibold">Loyverse Mirror Verification</h1><p className="mt-4 text-red-700">{error}</p></main>;
  }

  if (!data) {
    return <main className="p-6"><h1 className="text-2xl font-semibold">Loyverse Mirror Verification</h1><p className="mt-4 text-red-700">No diagnostic payload returned.</p></main>;
  }

  return (
    <main className="space-y-6 p-6 text-slate-900">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Loyverse Mirror Verification</h1>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={data.status} />
          <span className="text-xl font-bold">{finalStatus}</span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded border bg-white p-4"><div className="text-sm text-slate-500">Latest sync</div><div className="font-medium">{formatDateTime(data.latestSyncAt)}</div></div>
        <div className="rounded border bg-white p-4"><div className="text-sm text-slate-500">Latest receipt</div><div className="font-medium">{formatDateTime(data.latestReceiptDate)}</div></div>
        <div className="rounded border bg-white p-4"><div className="text-sm text-slate-500">Latest shift report</div><div className="font-medium">{formatDateTime(data.latestShiftDate)}</div></div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Canonical table map</h2>
        <KeyValueTable data={data.canonicalTables} />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Receipt table counts</h2>
        <KeyValueTable data={data.receiptCounts} labelKey="Table" valueKey="Rows" />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Seven-day comparison, Bangkok 17:00-03:00</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Receipt diff</th><th className="py-2 pr-3">Gross diff</th><th className="py-2 pr-3">Net diff</th><th className="py-2 pr-3">Discount diff</th><th className="py-2 pr-3">Refund diff</th><th className="py-2 pr-3">Cash diff</th><th className="py-2 pr-3">QR diff</th><th className="py-2 pr-3">Grab diff</th><th className="py-2 pr-3">Other diff</th><th className="py-2 pr-3">Items diff</th><th className="py-2 pr-3">Mods diff</th>
              </tr>
            </thead>
            <tbody>{(data.sevenDayComparison || []).map((day) => <tr className="border-b" key={day.date}><td className="py-2 pr-3 font-medium">{day.date}</td><td className="py-2 pr-3"><StatusBadge status={day.status} /></td><td className="py-2 pr-3">{formatValue(day.difference?.receiptCount)}</td><td className="py-2 pr-3">{formatValue(day.difference?.grossSales)}</td><td className="py-2 pr-3">{formatValue(day.difference?.netSales)}</td><td className="py-2 pr-3">{formatValue(day.difference?.discounts)}</td><td className="py-2 pr-3">{formatValue(day.difference?.refunds)}</td><td className="py-2 pr-3">{formatValue(day.difference?.cash)}</td><td className="py-2 pr-3">{formatValue(day.difference?.qr)}</td><td className="py-2 pr-3">{formatValue(day.difference?.grab)}</td><td className="py-2 pr-3">{formatValue(day.difference?.other)}</td><td className="py-2 pr-3">{formatValue(day.difference?.lineItemCount)}</td><td className="py-2 pr-3">{formatValue(day.difference?.modifierCount)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Latest shift comparison</h2>
        <KeyValueTable data={data.latestShiftComparison || {}} />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Duplicate and missing data</h2>
        <div className="space-y-4">{Object.entries(data.integrity || {}).map(([name, rows]) => <div key={name}><h3 className="mb-2 font-medium">{name}</h3><FindingsTable rows={rows} emptyText="No findings returned." /></div>)}</div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Unmapped payment names</h2>
        <FindingsTable rows={data.paymentMapping?.unmappedPayments || []} emptyText="No unmapped payment names returned." />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Payment mapping rules</h2>
        <KeyValueTable data={data.paymentMapping?.rules || {}} />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Blockers</h2>
        <FindingsTable rows={data.blockers} emptyText="No blockers returned." />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Mismatches</h2>
        <FindingsTable rows={data.mismatches} emptyText="No mismatches returned." />
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Source map</h2>
        <KeyValueTable data={data.sourceMap || {}} />
      </section>
    </main>
  );
}

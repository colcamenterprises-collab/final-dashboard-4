import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

const actions = [
  { to: "/operations/daily-sales", label: "Daily Sales V2" },
  { to: "/operations/daily-stock", label: "Daily Stock V2" },
  { to: "/operations/daily-sales-v2/library", label: "Form Library" },
  { to: "/operations/loyverse-mirror", label: "Loyverse Mirror" },
  { to: "/reports/shift-reports", label: "Shift Reports" },
];

const thb = (value: unknown) => typeof value === "number" ? `฿${value.toLocaleString("en-TH")}` : "Missing";
const shown = (value: unknown) => value === null || value === undefined || value === "" ? "Missing" : String(value);
const statusClass = (status?: string) => {
  if (status === "Verified" || status === "submitted" || status === "Balanced") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Failed" || status === "Variance") return "border-red-200 bg-red-50 text-red-800";
  return "border-amber-200 bg-amber-50 text-amber-800";
};

function Field({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>;
}

export default function Home() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ["/api/operations-read/summary"] });
  const sales = data?.dailySales ?? { status: "missing" };
  const stock = data?.dailyStock ?? { status: "missing" };
  const pos = data?.posMirror ?? {};
  const blockers = data?.blockers ?? [];
  const drinks = stock.drinks && typeof stock.drinks === "object" ? Object.entries(stock.drinks).slice(0, 4).map(([name, qty]) => `${name}: ${qty}`).join(", ") : "Missing";

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-3 sm:p-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Command Center</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Operational Shift Review</h1>
            <p className="mt-1 text-sm text-slate-600">Readable live shift status from source tables only. Missing data is shown clearly.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs text-slate-500">Business date / shift window</p>
            <p className="font-semibold text-slate-900">{shown(data?.businessDate)} · {shown(data?.shiftWindow?.label)}</p>
          </div>
        </div>
      </div>

      {isLoading && <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">Loading operational status...</div>}
      {isError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Failed to load operational status.</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">POS mirror status</h2>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(pos.status)}`}>{shown(pos.status)}</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Latest receipt timestamp" value={shown(pos.latestReceiptTimestamp)} />
          <Field label="Latest shift report date" value={shown(pos.latestShiftReportDate)} />
          <Field label="Receipt rows" value={shown(pos.receiptCount)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Daily Sales V2</h2><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(sales.status)}`}>{sales.status === "submitted" ? "submitted" : "Missing"}</span></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Sales total" value={thb(sales.totalSales)} />
            <Field label="Cash" value={thb(sales.cash)} />
            <Field label="QR" value={thb(sales.qr)} />
            <Field label="Grab" value={thb(sales.grab)} />
            <Field label="Expenses" value={thb(sales.expenses)} />
            <Field label="Balance status" value={shown(sales.balanceStatus)} />
          </div>
          <Link to="/operations/daily-sales-analysis" className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">View sales analysis</Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Daily Stock V2</h2><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(stock.status)}`}>{stock.status === "submitted" ? "submitted" : "Missing"}</span></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Rolls" value={shown(stock.rolls)} />
            <Field label="Meat" value={shown(stock.meat)} />
            <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2"><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Drinks summary</p><p className="mt-1 text-sm font-semibold text-slate-900">{drinks || "Missing"}</p></div>
          </div>
          <Link to="/operations/daily-stock-analysis" className="mt-3 inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">View stock analysis</Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Actions</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {actions.map((item) => <Link key={item.to} to={item.to} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-sm font-semibold text-slate-900 hover:bg-white">{item.label}</Link>)}
        </div>
      </section>

      {blockers.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><h2 className="font-semibold">Visible missing data</h2>{blockers.map((b: any, idx: number) => <p key={idx} className="mt-1"><strong>{b.code}</strong>: {b.message}</p>)}</section>}
    </div>
  );
}

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Activity, Package, Receipt, ShoppingBag, FileText } from "lucide-react";
import { StatCard, PastelCard, PageTitle, SectionTitle, StatusPill } from "@/components/ui/sbb-cards";

const thb = (value: unknown) =>
  typeof value === "number" ? `฿${value.toLocaleString("en-TH")}` : "—";

const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

const quickActions = [
  { to: "/operations/daily-sales",  label: "Daily Sales V2",    icon: Receipt,     colour: "bg-blue-50   text-blue-800   border-blue-100"   },
  { to: "/operations/daily-stock",  label: "Daily Stock V2",    icon: Package,     colour: "bg-emerald-50 text-emerald-800 border-emerald-100" },
  { to: "/operations/purchase-lodgement", label: "Purchase Lodgement", icon: ShoppingBag, colour: "bg-amber-50  text-amber-800  border-amber-100"  },
  { to: "/reports/shift-reports",   label: "Shift Reports",     icon: FileText,    colour: "bg-purple-50 text-purple-800  border-purple-100" },
  { to: "/operations/loyverse-mirror", label: "Loyverse Mirror", icon: Activity,   colour: "bg-slate-50  text-slate-800  border-slate-200"  },
];

function fmtDateTime(s: unknown) {
  if (!s || typeof s !== "string") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hrs   = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${d.getFullYear()} ${hrs}:${mins}`;
}

export default function Home() {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ["/api/operations-read/summary"] });

  const sales    = data?.dailySales    ?? {};
  const stock    = data?.dailyStock    ?? {};
  const pos      = data?.posMirror     ?? {};
  const blockers = data?.blockers      ?? [];
  const drinks   = stock.drinks && typeof stock.drinks === "object"
    ? Object.entries(stock.drinks).slice(0, 4).map(([n, q]) => `${n}: ${q}`).join("  ·  ")
    : "—";

  const businessDate  = shown(data?.businessDate);
  const shiftLabel    = shown(data?.shiftWindow?.label);

  return (
    <div className="mx-auto max-w-5xl space-y-5">

      {/* ── Page title ───────────────────────────────────────────────── */}
      <PageTitle
        title="Overview"
        meta={
          <span>
            {businessDate !== "—" ? businessDate : "Loading…"}
            {shiftLabel !== "—" && <span className="ml-2 text-slate-400">· {shiftLabel}</span>}
          </span>
        }
        right={
          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
            pos.status === "Verified" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : pos.status === "Failed"  ? "bg-red-100 text-red-800 border-red-200"
            : "bg-amber-100 text-amber-800 border-amber-200"
          }`}>
            POS {shown(pos.status)}
          </span>
        }
      />

      {isLoading && (
        <PastelCard variant="gray">
          <p className="text-sm text-slate-500">Loading shift data…</p>
        </PastelCard>
      )}
      {isError && (
        <PastelCard variant="white">
          <p className="text-sm text-red-600">Failed to load operational status.</p>
        </PastelCard>
      )}

      {/* ── Main stat grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-4">

        {/* Largest card — POS mirror (blue, spans 2 cols on tablet) */}
        <div className="col-span-3 md:col-span-2">
          <StatCard
            variant="blue"
            label="POS receipts today"
            value={shown(pos.receiptCount)}
            subValue={`Latest receipt: ${fmtDateTime(pos.latestReceiptTimestamp)}`}
            badge={<StatusPill status={pos.status} />}
            footer={
              <Link to="/operations/loyverse-mirror" className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline">
                View mirror <ArrowRight className="h-3 w-3" />
              </Link>
            }
            className="h-full"
          />
        </div>

        {/* Daily Sales */}
        <div className="col-span-3 md:col-span-3 grid grid-cols-3 gap-4">
          <StatCard
            variant="purple"
            label="Sales total"
            value={thb(sales.totalSales)}
            subValue={`Cash ${thb(sales.cash)}  ·  QR ${thb(sales.qr)}`}
            badge={<StatusPill status={sales.status === "submitted" ? "Submitted" : sales.totalSales ? "Partial" : "Missing"} />}
            footer={
              <Link to="/operations/daily-sales" className="inline-flex items-center gap-1 text-xs text-purple-600 font-medium hover:underline">
                Daily Sales <ArrowRight className="h-3 w-3" />
              </Link>
            }
            className="h-full"
          />

          {/* Daily Stock */}
          <StatCard
            variant="green"
            label="Rolls counted"
            value={shown(stock.rolls)}
            subValue={`Meat: ${shown(stock.meat)}`}
            badge={<StatusPill status={stock.status === "submitted" ? "Submitted" : stock.rolls ? "Partial" : "Missing"} />}
            footer={
              <Link to="/operations/daily-stock" className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium hover:underline">
                Daily Stock <ArrowRight className="h-3 w-3" />
              </Link>
            }
            className="h-full"
          />

          {/* Drinks */}
          <StatCard
            variant="yellow"
            label="Drinks"
            value={shown(stock.drinks ? Object.values(stock.drinks as Record<string, number>).reduce((a: number, b: unknown) => a + Number(b), 0) : "—")}
            subValue={drinks}
            footer={
              <Link to="/operations/daily-stock-analysis" className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium hover:underline">
                Stock analysis <ArrowRight className="h-3 w-3" />
              </Link>
            }
            className="h-full"
          />
        </div>
      </div>

      {/* ── Sales detail (expanded) ───────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
        {[
          { label: "Cash",     value: thb(sales.cash) },
          { label: "QR",       value: thb(sales.qr) },
          { label: "Grab",     value: thb(sales.grab) },
          { label: "Expenses", value: thb(sales.expenses) },
          { label: "Balance",  value: shown(sales.balanceStatus) },
          { label: "Latest shift", value: fmtDateTime(pos.latestShiftReportDate).slice(0, 10) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-bold text-slate-900 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ─────────────────────────────────────────────── */}
      <div>
        <SectionTitle title="Quick actions" className="mb-3" />
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {quickActions.map(({ to, label, icon: Icon, colour }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-xs font-semibold transition-all hover:shadow-md hover:-translate-y-0.5 ${colour}`}
            >
              <Icon className="h-5 w-5" />
              <span className="leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Blockers ─────────────────────────────────────────────────── */}
      {blockers.length > 0 && (
        <PastelCard variant="yellow">
          <SectionTitle title="Issues requiring attention" className="mb-3" />
          <div className="space-y-2">
            {blockers.map((b: any, idx: number) => (
              <div key={idx} className="rounded-lg bg-amber-100/60 px-3 py-2 text-xs text-amber-900">
                <span className="font-semibold">{b.code || "Issue"}: </span>
                {b.message || String(b)}
              </div>
            ))}
          </div>
        </PastelCard>
      )}

    </div>
  );
}

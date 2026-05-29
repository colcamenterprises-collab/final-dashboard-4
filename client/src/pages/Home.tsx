import { Link } from "react-router-dom";

const items = [
  { to: "/operations/daily-sales", label: "Daily Sales V2" },
  { to: "/operations/daily-stock", label: "Daily Stock V2" },
  { to: "/operations/daily-sales-v2/library", label: "Form Library" },
  { to: "/operations/purchasing", label: "Purchasing" },
];

export default function Home() {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">Operations Core</h1>
      <p className="text-sm text-slate-600">Lean production navigation only. No analytics or synthetic KPIs shown.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-900 hover:bg-slate-50">
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// src/pages/Overview.tsx
export default function Overview() {
  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-4">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-500">KPI</div>
          <div className="text-3xl font-bold">—</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Manager Checklist</div>
          <div className="text-base">Status appears here.</div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-neutral-500">Alerts</div>
          <div className="text-base">None</div>
        </div>
      </div>
    </div>
  );
}
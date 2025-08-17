export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Good morning Cam 👋</h1>

      {/* KPI bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: "1,249" },
          { label: "Total Revenue", value: "฿89,542" },
          { label: "Growth", value: "+12.5%" },
          { label: "Active Items", value: "32" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border bg-emerald-600 text-white p-5 shadow-sm">
            <div className="text-base font-medium opacity-90">{k.label}</div>
            <div className="text-3xl font-extrabold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold mb-3">Summary Revenue</div>
          <div className="h-60 grid place-items-center text-neutral-400 text-sm border rounded-xl">
            Chart placeholder
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-lg font-semibold mb-3">Manager's Checklist</div>
          <div className="text-sm text-neutral-600">Today's Tasks <span className="font-semibold">8/12 Complete</span></div>
          <div className="mt-3 h-2 rounded-full bg-neutral-200">
            <div className="h-2 rounded-full bg-emerald-600" style={{width:"70%"}} />
          </div>
          <button className="mt-4 w-full rounded-xl border px-3 py-2">Complete Tasks →</button>
        </div>
      </div>
    </div>
  );
}
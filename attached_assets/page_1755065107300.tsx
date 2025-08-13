// src/app/analysis/page.tsx
"use client";
import useSWR from "swr";

const fetcher = (u: string) => fetch(u).then(r => r.json());

export default function Analysis() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const shiftId = params?.get("shiftId") || "";
  const { data, error } = useSWR(shiftId ? `/api/analysis/${shiftId}` : null, fetcher);

  if (!shiftId) return <div className="p-6">Select a shift from Dashboard.</div>;
  if (error)   return <div className="p-6">Error loading analysis.</div>;
  if (!data)   return <div className="p-6">Loading…</div>;
  if (!data.ok) return <div className="p-6">No data: {data.error}</div>;

  const { meta, totals, payments, variances, staff } = data;

  return (
    <div className="p-6 space-y-6">
      <div className="text-sm text-gray-600">
        Shift: {new Date(meta.window.start).toLocaleString()} → {new Date(meta.window.end).toLocaleString()} •
        Source: {meta.source} • Computed: {new Date(meta.computedAt).toLocaleString()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-2xl p-4">
          <div className="text-gray-500 text-sm">Receipts</div>
          <div className="text-3xl font-semibold">{totals.receipts}</div>
        </div>
        <div className="border rounded-2xl p-4">
          <div className="text-gray-500 text-sm">Sales (Baht)</div>
          <div className="text-3xl font-semibold">{totals.salesBaht}</div>
        </div>
        <div className="border rounded-2xl p-4">
          <div className="text-gray-500 text-sm">Banking Δ</div>
          <div className={`text-3xl font-semibold ${variances.bankingDiff === 0 ? "text-green-700" : "text-red-700"}`}>
            {variances.bankingDiff}
          </div>
        </div>
      </div>

      <div className="border rounded-2xl p-4">
        <div className="text-gray-500 text-sm mb-2">Payments</div>
        <pre className="text-sm">{JSON.stringify(payments, null, 2)}</pre>
      </div>

      <div className="border rounded-2xl p-4">
        <div className="text-gray-500 text-sm mb-2">Staff Figures</div>
        <pre className="text-sm">{JSON.stringify(staff, null, 2)}</pre>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useLocation } from "wouter";

function Lock({ message }: { message: string }) {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="rounded-2xl border bg-white p-8 max-w-xl text-center shadow-sm">
        <h2 className="text-xl font-semibold">Stock Form Locked</h2>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        <a href="/daily-sales" className="inline-block mt-6 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm">Go to Sales</a>
      </div>
    </div>
  );
}

export default function DailyStock() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const shiftId = params.get("shift") || "";

  const [ok, setOk] = useState(false);

  useEffect(() => {
    // Allow access if we have a valid shift ID
    setOk(!!shiftId);
  }, [shiftId]);

  if (!ok) {
    return <Lock message="Please complete Daily Sales first. We'll auto-forward you here after submit." />;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Daily Stock</h1>
          <p className="text-sm text-gray-600 mt-1">Step 2 of 2 — linked to Shift ID: <span className="font-mono">{shiftId}</span></p>
        </div>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold mb-4">Stock Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Buns Used</label>
            <input className="w-full border rounded-xl px-3 py-2.5 h-10" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Patties Used</label>
            <input className="w-full border rounded-xl px-3 py-2.5 h-10" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Drinks Sold</label>
            <input className="w-full border rounded-xl px-3 py-2.5 h-10" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1">Notes</label>
            <input className="w-full border rounded-xl px-3 py-2.5 h-10" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 mt-6">
        <button className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
          Submit Stock
        </button>
      </div>
    </div>
  );
}
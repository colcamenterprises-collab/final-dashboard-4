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
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const salesId = params.get("salesId") || "";

  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("lastSalesFormId");
    const when = Number(sessionStorage.getItem("lastSalesFormTs") || 0);
    const fresh = Date.now() - when < 1000 * 60 * 15; // 15 minutes
    setOk(!!salesId && token === salesId && fresh);
  }, [salesId]);

  if (!ok) {
    return <Lock message="Please complete Daily Sales first. We'll auto-forward you here after submit." />;
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Daily Stock</h1>
      <p className="text-sm text-gray-600">Step 2 of 2 — linked to Sales ID: <span className="font-mono">{salesId}</span></p>

      <div className="mt-6 rounded-2xl border bg-white p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="text-sm text-gray-600">Buns Used</label><input className="w-full border rounded-xl px-3 py-2 mt-1" /></div>
          <div><label className="text-sm text-gray-600">Patties Used</label><input className="w-full border rounded-xl px-3 py-2 mt-1" /></div>
          <div><label className="text-sm text-gray-600">Drinks Sold</label><input className="w-full border rounded-xl px-3 py-2 mt-1" /></div>
          <div><label className="text-sm text-gray-600">Notes</label><input className="w-full border rounded-xl px-3 py-2 mt-1" /></div>
        </div>
      </div>

      <div className="flex items-center justify-end mt-6">
        <button className="rounded-xl bg-teal-600 text-white px-5 py-2">Submit Stock</button>
      </div>
    </div>
  );
}
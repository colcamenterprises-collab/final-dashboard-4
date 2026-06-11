import { useEffect, useState } from "react";
import KitchenOrderCard from "@/components/kitchen/KitchenOrderCard";

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  async function load() { try { const res = await fetch("/api/ordering/kitchen/orders", { credentials: "include" }); const data = await res.json(); if (!res.ok) throw new Error(JSON.stringify(data)); setOrders(data.data ?? []); setError(""); } catch (err: any) { setError(err.message); } }
  useEffect(() => { load(); const id = window.setInterval(load, 8000); return () => window.clearInterval(id); }, []);
  return <main className="p-4"><div className="mb-4 flex items-center justify-between"><h1 className="text-3xl font-bold">Kitchen Display</h1><button className="rounded border px-4 py-2" onClick={load}>Refresh</button></div>{error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3">{error}</div>}<div className="grid gap-4 lg:grid-cols-3">{orders.map((order) => <KitchenOrderCard key={order.id} order={order} onChanged={load} />)}</div>{!orders.length && <div className="rounded border p-4">No active kitchen orders.</div>}</main>;
}

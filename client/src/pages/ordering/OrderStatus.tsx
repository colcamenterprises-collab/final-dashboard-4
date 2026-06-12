import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchOrderingOrder, money } from "@/components/ordering/orderingApi";

export default function OrderStatus() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  async function load() { if (orderId) fetchOrderingOrder(orderId).then((res) => setOrder(res.data)).catch((err) => setError(err.message)); }
  useEffect(() => { load(); const id = window.setInterval(load, 10000); return () => window.clearInterval(id); }, [orderId]);
  return <main className="mx-auto max-w-3xl p-4"><h1 className="text-3xl font-bold">Order status</h1>{error && <div className="mt-4 rounded border border-red-300 bg-red-50 p-3">{error}</div>}{order && <section className="mt-6 rounded-lg border bg-white p-5 shadow-sm"><div className="flex justify-between"><div><div className="text-2xl font-bold">#{order.order_number}</div><div className="text-gray-600">{order.channel}{order.table_code ? ` · Table ${order.table_code}` : ""}</div></div><div className="text-xl font-semibold">{order.status}</div></div><div className="mt-4 space-y-2">{order.items?.map((item: any) => <div key={item.id} className="border-t pt-2"><div>{item.quantity} × {item.item_name_en}</div>{item.modifiers?.map((m: any) => <div key={m.id} className="text-sm text-gray-600">+ {m.modifier_name_en}</div>)}</div>)}</div><div className="mt-4 text-right text-xl font-semibold">{money(order.total)}</div></section>}</main>;
}

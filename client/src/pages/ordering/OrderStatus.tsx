import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchOrderingOrder, money } from "@/components/ordering/orderingApi";
import "./OrderPage.css";

const statusCopy: Record<string, { title: string; message: string; step: number }> = {
  SUBMITTED: { title: "Order received", message: "We have received your order and the kitchen will review it shortly.", step: 1 },
  ACCEPTED: { title: "Order accepted", message: "Your order has been accepted.", step: 2 },
  PREPARING: { title: "Being prepared", message: "The kitchen is preparing your order now.", step: 3 },
  READY: { title: "Ready", message: "Your order is ready for collection or dispatch.", step: 4 },
  COMPLETED: { title: "Completed", message: "Your order has been completed. Thank you for ordering from Smash Brothers.", step: 5 },
  CANCELLED: { title: "Cancelled", message: "This order has been cancelled. Please contact Smash Brothers if you need help.", step: 0 },
};

export default function OrderStatus() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");

  async function load() {
    if (!orderId) return;
    fetchOrderingOrder(orderId).then((res) => { setOrder(res.data); setError(""); }).catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, 5000);
    return () => window.clearInterval(id);
  }, [orderId]);

  const state = statusCopy[order?.status_code] ?? { title: order?.status_code || "Order status", message: "Your order is being updated.", step: 1 };
  const fulfilment = useMemo(() => {
    const notes = String(order?.order_notes || "");
    if (notes.includes("FULFILMENT: DELIVERY")) return "Delivery";
    if (notes.includes("FULFILMENT: PICKUP")) return "Pickup";
    return order?.table_code ? `Table ${order.table_code}` : "Order";
  }, [order]);

  return (
    <main className="sbo-page sbo-status-page">
      <header className="sbo-header">
        <div><p>Smash Brothers Burgers</p><h1>{state.title}</h1><span>{order ? `Order #${order.order_number} · ${fulfilment}` : "Loading your order..."}</span></div>
      </header>
      {error && <div className="sbo-error">{error}</div>}
      {order && (
        <section className="sbo-status-card">
          <div className="sbo-status-steps">
            {["Received","Accepted","Preparing","Ready","Complete"].map((label, index) => <div key={label} className={state.step >= index + 1 ? "done" : ""}><span>{index + 1}</span><b>{label}</b></div>)}
          </div>
          <div className="sbo-status-message">{state.message}</div>
          <div className="sbo-status-items">
            {order.items?.map((item: any) => <div key={item.id}><strong>{item.quantity} × {item.item_name_en}</strong>{item.modifiers?.map((m: any) => <span key={m.id}>+ {m.modifier_name_en}</span>)}</div>)}
          </div>
          <div className="sbo-status-total"><span>Total</span><strong>{money(order.total)}</strong></div>
          <p className="sbo-help">This page updates automatically. Last update: {new Date(order.last_update_time ?? order.updated_at).toLocaleString()}</p>
        </section>
      )}
    </main>
  );
}

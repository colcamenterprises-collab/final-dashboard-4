import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Home } from "lucide-react";

interface CartItem { id: string; name: string; price: number; qty: number; }

interface OrderData {
  ref?: string;
  order?: { ref?: string };
  items: CartItem[];
  total: number;
  form: { name: string; phone: string; type: string; payment: string; notes?: string };
}

function fmt(p: number) {
  return `฿${p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Confirmation() {
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<OrderData | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("sbb_last_order");
      if (raw) setOrder(JSON.parse(raw));
    } catch { /* empty */ }
  }, []);

  if (!order) {
    return (
      <div className="p-4 max-w-xl mx-auto text-center py-20 space-y-4">
        <p className="text-slate-400 text-sm">No order found.</p>
        <button onClick={() => navigate("/online-ordering")} className="text-xs px-4 py-2 bg-black text-white rounded-lg hover:bg-slate-800">
          Browse Menu
        </button>
      </div>
    );
  }

  const ref = order.ref || order.order?.ref || `ORD-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <div className="text-center pt-8 pb-4 space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-full">
          <CheckCircle className="h-8 w-8 text-green-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Order Placed!</h1>
          <p className="text-xs text-slate-500 mt-1">Thank you, {order.form.name}</p>
        </div>
        <div className="inline-block bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2">
          <p className="text-[10px] text-slate-500">Order Reference</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white tracking-wider">{ref}</p>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">What you ordered</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-500 w-5 text-center">{item.qty}×</span>
              <span className="text-xs text-slate-800 dark:text-white flex-1">{item.name}</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
        <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmt(order.total)}</span>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Order Details</p>
        </div>
        <div className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex justify-between px-3 py-2">
            <span className="text-[10px] text-slate-500">Type</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold capitalize">{order.form.type}</span>
          </div>
          <div className="flex justify-between px-3 py-2">
            <span className="text-[10px] text-slate-500">Payment</span>
            <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold capitalize">{order.form.payment}</span>
          </div>
          {order.form.notes && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-[10px] text-slate-500">Notes</span>
              <span className="text-xs text-slate-700 dark:text-slate-300">{order.form.notes}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Payment on {order.form.type === "delivery" ? "Delivery" : "Pickup"}</p>
        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">
          Please have {fmt(order.total)} ready when you {order.form.type === "delivery" ? "receive your order" : "collect your order"}.
        </p>
      </div>

      <button
        onClick={() => navigate("/online-ordering")}
        className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        Order More
      </button>
    </div>
  );
}

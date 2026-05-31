import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { apiRequest } from "@/lib/queryClient";

function fmt(p: number) {
  return `฿${p.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Checkout() {
  const [, navigate] = useLocation();
  const { items, removeItem, total, clearCart } = useCart();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    type: "pickup" as "pickup" | "delivery",
    address: "",
    notes: "",
    payment: "cash",
  });
  const [error, setError] = useState("");

  const orderMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        phone: form.phone,
        type: form.type,
        address: form.address || null,
        payment: form.payment,
        notes: form.notes || null,
        subtotal: total,
        vatAmount: 0,
        total: total,
        lines: items.map((i) => ({
          itemId: i.id,
          sku: i.id,
          name: i.name,
          qty: i.qty,
          basePrice: i.price,
          modifiers: [],
          note: null,
          lineTotal: i.price * i.qty,
        })),
        rawPayload: { items, form },
      };
      const res = await apiRequest("POST", "/api/order", payload);
      return res;
    },
    onSuccess: (data: any) => {
      sessionStorage.setItem("sbb_last_order", JSON.stringify({ ...data, items, total, form }));
      clearCart();
      navigate("/online-ordering/confirmation");
    },
    onError: () => {
      sessionStorage.setItem("sbb_last_order", JSON.stringify({ ref: `LOCAL-${Date.now()}`, items, total, form }));
      clearCart();
      navigate("/online-ordering/confirmation");
    },
  });

  const vat = 0;
  const grandTotal = total + vat;

  if (items.length === 0) {
    return (
      <div className="p-4 max-w-xl mx-auto text-center py-20 space-y-4">
        <p className="text-slate-400 text-sm">Your cart is empty.</p>
        <button
          onClick={() => navigate("/online-ordering")}
          className="text-xs px-4 py-2 bg-black text-white rounded-lg hover:bg-slate-800"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/online-ordering")} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <ArrowLeft className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Checkout</h1>
          <p className="text-xs text-slate-500">{items.length} {items.length === 1 ? "item" : "items"}</p>
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Order Summary</p>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-slate-900">
              <span className="text-xs text-slate-500 w-5 text-center">{item.qty}×</span>
              <span className="text-xs text-slate-800 dark:text-white flex-1">{item.name}</span>
              <span className="text-xs font-semibold text-slate-800 dark:text-white">{fmt(item.price * item.qty)}</span>
              <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Total</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmt(grandTotal)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Your Details</p>

        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Name *</label>
          <input
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
            placeholder="Your name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Phone</label>
          <input
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
            placeholder="Optional"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Order Type</label>
          <div className="flex gap-2">
            {(["pickup", "delivery"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  form.type === t
                    ? "bg-black text-white border-black"
                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {form.type === "delivery" && (
          <div>
            <label className="text-[10px] text-slate-500 block mb-1">Delivery Address</label>
            <textarea
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
              rows={2}
              placeholder="Full delivery address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        )}

        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Payment Method</label>
          <select
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            value={form.payment}
            onChange={(e) => setForm({ ...form, payment: e.target.value })}
          >
            <option value="cash">Cash on Pickup</option>
            <option value="qr">QR Code Transfer</option>
            <option value="card">Card</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 block mb-1">Notes</label>
          <textarea
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400"
            rows={2}
            placeholder="Allergies, special requests..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
        <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">Payment on Pickup</p>
        <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">No payment is taken now. Pay when you collect or we deliver.</p>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={() => {
          if (!form.name.trim()) { setError("Please enter your name."); return; }
          setError("");
          orderMutation.mutate();
        }}
        disabled={orderMutation.isPending}
        className="w-full bg-black text-white rounded-xl py-3.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {orderMutation.isPending ? "Placing order..." : `Place Order · ${fmt(grandTotal)}`}
      </button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OrderingCart from "@/components/ordering/OrderingCart";
import OrderingMenu from "@/components/ordering/OrderingMenu";
import { fetchOrderingMenu, submitOrderingOrder, type CartItem, type OrderingLanguage } from "@/components/ordering/orderingApi";

export default function OrderPage({ tablet = false }: { tablet?: boolean }) {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<OrderingLanguage>("en");
  const [menu, setMenu] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => JSON.parse(localStorage.getItem(tablet ? "sbb_tablet_cart" : "sbb_order_cart") || "[]"));
  const [paymentMethod, setPaymentMethod] = useState("pay_at_counter");
  const [orderNotes, setOrderNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchOrderingMenu().then((data) => setMenu(data.categories ?? [])).catch((err) => setError(err.message)); }, []);
  useEffect(() => { localStorage.setItem(tablet ? "sbb_tablet_cart" : "sbb_order_cart", JSON.stringify(cart)); }, [cart, tablet]);

  function add(item: CartItem) { setCart((prev) => [...prev, item]); }
  function qty(index: number, quantity: number) { setCart((prev) => quantity <= 0 ? prev.filter((_, i) => i !== index) : prev.map((item, i) => i === index ? { ...item, quantity } : item)); }
  function remove(index: number) { setCart((prev) => prev.filter((_, i) => i !== index)); }

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await submitOrderingOrder({
        channel: tablet ? "tablet_counter" : tableCode ? "qr_table" : "online",
        table_code: tableCode || null,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        order_notes: orderNotes || null,
        payment_method: paymentMethod,
        items: cart.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity, notes: item.notes, modifiers: item.modifiers.map((modifier) => ({ item_modifier_id: modifier.item_modifier_id, quantity: modifier.quantity })) })),
      });
      const orderId = res.data.id;
      setCart([]);
      localStorage.removeItem(tablet ? "sbb_tablet_cart" : "sbb_order_cart");
      navigate(`/order/status/${orderId}`);
    } catch (err: any) {
      setError("Unable to submit order. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`mx-auto max-w-7xl p-4 ${tablet ? "text-lg" : ""}`}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">SBB Ordering</h1>
          <p className="text-gray-600">{tablet ? "Tablet counter mode" : tableCode ? `Table ${tableCode}` : "Online order"}</p>
        </div>
        <div className="flex gap-2"><button className="rounded border px-4 py-2" onClick={() => setLanguage("en")}>English</button><button className="rounded border px-4 py-2" onClick={() => setLanguage("th")}>ไทย</button></div>
      </div>
      {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <OrderingMenu categories={menu} language={language} large={tablet} onAdd={add} />
        <div className="space-y-4">
          <OrderingCart cart={cart} language={language} onQty={qty} onRemove={remove} />
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold">Order details</h2>
            {!tablet && <><input className="mt-3 w-full rounded border p-2" placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input className="mt-3 w-full rounded border p-2" placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></>}
            <textarea className="mt-3 w-full rounded border p-2" placeholder="Order notes" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            <select className="mt-3 w-full rounded border p-2" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="pay_at_counter">Pay at counter</option><option value="cash">Cash</option><option value="manual_qr_transfer">QR</option></select>
            <button disabled={!cart.length || loading} className="mt-4 w-full rounded bg-black px-4 py-3 font-semibold text-white disabled:bg-gray-400" onClick={submit}>{loading ? "Submitting..." : "Submit order"}</button>
          </section>
        </div>
      </div>
    </main>
  );
}

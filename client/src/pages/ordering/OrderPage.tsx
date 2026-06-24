import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OrderingCart from "@/components/ordering/OrderingCart";
import OrderingMenu from "@/components/ordering/OrderingMenu";
import { fetchOrderingMenu, submitOrderingOrder, type CartItem, type OrderingLanguage } from "@/components/ordering/orderingApi";
import "./OrderPage.css";

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
    <main className={`sbo-page ${tablet ? "is-tablet" : ""}`}>
      <header className="sbo-header">
        <div>
          <p>Smash Brothers Burgers</p>
          <h1>Build Your Smash</h1>
          <span>{tablet ? "Tablet-first customer ordering" : tableCode ? `Table ${tableCode}` : "Choose a category, add your burger, and keep your cart in view."}</span>
        </div>
        <div className="sbo-language" aria-label="Language selection"><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button><button className={language === "th" ? "active" : ""} onClick={() => setLanguage("th")}>ไทย</button></div>
      </header>
      {error && <div className="sbo-error">{error}</div>}
      <div className="sbo-layout">
        <OrderingMenu categories={menu} language={language} large={tablet} onAdd={add} />
        <div className="sbo-sidebar">
          <OrderingCart cart={cart} language={language} onQty={qty} onRemove={remove} />
          <section className="sbo-panel">
            <h2>Checkout</h2>
            {!tablet && <><input placeholder="Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><input placeholder="Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></>}
            <textarea placeholder="Order notes" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option value="pay_at_counter">Pay at counter</option><option value="cash">Cash</option><option value="manual_qr_transfer">QR</option></select>
            <button disabled={!cart.length || loading} onClick={submit}>{loading ? "Submitting..." : "Place Order"}</button>
          </section>
        </div>
      </div>
    </main>
  );
}

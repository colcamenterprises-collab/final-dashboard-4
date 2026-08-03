import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OrderingCart from "@/components/ordering/OrderingCart";
import OrderingMenu from "@/components/ordering/OrderingMenu";
import {
  fetchOrderingMenu,
  fetchOrderingSettings,
  submitOrderingOrder,
  type CartItem,
  type OrderingLanguage,
} from "@/components/ordering/orderingApi";
import "./OrderPage.css";

type Fulfilment = "pickup" | "delivery";

function readSavedCart(key: string): CartItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

export default function OrderPage({ tablet = false }: { tablet?: boolean }) {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const cartKey = tablet ? "sbb_tablet_cart" : "sbb_order_cart";
  const [language, setLanguage] = useState<OrderingLanguage>("en");
  const [menu, setMenu] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => readSavedCart(cartKey));
  const [paymentMethod, setPaymentMethod] = useState("pay_at_counter");
  const [orderNotes, setOrderNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOrderingMenu()
      .then((data) => {
        if (!active) return;
        setMenu(data.categories ?? []);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err?.message || "Could not load the menu. Please refresh and try again.");
      })
      .finally(() => {
        if (active) setMenuLoading(false);
      });

    // Settings are non-blocking. The menu must render even if this optional request is slow.
    fetchOrderingSettings()
      .then((data) => { if (active) setSettings(data); })
      .catch(() => { /* safe defaults keep ordering available */ });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
    } catch {
      // Cart persistence must never block the public ordering page.
    }
  }, [cart, cartKey]);

  const orderingEnabled = settings.store_order_enabled !== false;
  const qrEnabled = settings.manual_qr_transfer_enabled !== false;
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  function add(item: CartItem) { setCart((prev) => [...prev, item]); }
  function qty(index: number, quantity: number) { setCart((prev) => quantity <= 0 ? prev.filter((_, i) => i !== index) : prev.map((item, i) => i === index ? { ...item, quantity } : item)); }
  function remove(index: number) { setCart((prev) => prev.filter((_, i) => i !== index)); }

  async function submit() {
    setError("");
    if (!orderingEnabled) return setError("Online ordering is currently closed.");
    if (!cart.length) return setError("Add at least one item to your order.");
    if (!tablet && !tableCode && !customerName.trim()) return setError("Please enter your name.");
    if (!tablet && !tableCode && !customerPhone.trim()) return setError("Please enter your phone number.");
    if (!tablet && !tableCode && fulfilment === "delivery" && !deliveryAddress.trim()) return setError("Please enter the delivery address.");

    setLoading(true);
    try {
      const fulfilmentNotes = tablet || tableCode
        ? orderNotes.trim()
        : [
            `FULFILMENT: ${fulfilment.toUpperCase()}`,
            fulfilment === "delivery" ? `DELIVERY ADDRESS: ${deliveryAddress.trim()}` : "COLLECTION: Smash Brothers Burgers, Rawai",
            orderNotes.trim() ? `CUSTOMER NOTE: ${orderNotes.trim()}` : "",
          ].filter(Boolean).join("\n");

      const res = await submitOrderingOrder({
        channel: tablet ? "tablet_counter" : tableCode ? "qr_table" : "online",
        table_code: tableCode || null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        order_notes: fulfilmentNotes || null,
        payment_method: tablet || tableCode ? paymentMethod : fulfilment === "pickup" && paymentMethod === "pay_at_counter" ? "pay_at_counter" : paymentMethod,
        items: cart.map((item) => ({
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          notes: item.notes,
          modifiers: item.modifiers.map((modifier) => ({ item_modifier_id: modifier.item_modifier_id, quantity: modifier.quantity })),
        })),
      });
      const orderId = res.data.id;
      setCart([]);
      localStorage.removeItem(cartKey);
      navigate(`/order/status/${orderId}`);
    } catch (err: any) {
      setError(err?.message || "Unable to submit order. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`sbo-page ${tablet ? "is-tablet" : ""}`}>
      <header className="sbo-header">
        <div>
          <p>Smash Brothers Burgers</p>
          <h1>Order Online</h1>
          <span>{tablet ? "Build your order" : tableCode ? `Table ${tableCode}` : "Fresh smash burgers, made to order in Rawai."}</span>
        </div>
        <div className="sbo-language" aria-label="Language selection">
          <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button>
          <button className={language === "th" ? "active" : ""} onClick={() => setLanguage("th")}>ไทย</button>
        </div>
      </header>

      {!orderingEnabled && <div className="sbo-closed">Online ordering is currently closed. Please check back during opening hours.</div>}
      {error && <div className="sbo-error">{error}</div>}

      <div className="sbo-layout">
        {menuLoading ? <div className="sbo-empty">Loading menu…</div> : <OrderingMenu categories={menu} language={language} large={tablet} onAdd={add} />}
        <div className="sbo-sidebar">
          <OrderingCart cart={cart} language={language} onQty={qty} onRemove={remove} />
          <section className="sbo-panel">
            <div className="sbo-checkout-title"><div><p>Checkout</p><h2>{itemCount} item{itemCount === 1 ? "" : "s"}</h2></div></div>

            {!tablet && !tableCode && (
              <>
                <div className="sbo-fulfilment">
                  <button type="button" className={fulfilment === "pickup" ? "active" : ""} onClick={() => { setFulfilment("pickup"); setPaymentMethod("pay_at_counter"); }}>Pickup</button>
                  <button type="button" className={fulfilment === "delivery" ? "active" : ""} onClick={() => { setFulfilment("delivery"); if (paymentMethod === "pay_at_counter") setPaymentMethod("cash"); }}>Delivery</button>
                </div>
                <label>Name<input placeholder="Your name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></label>
                <label>Phone<input inputMode="tel" placeholder="Phone number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></label>
                {fulfilment === "delivery" && <label>Delivery address<textarea placeholder="Address, hotel / villa name and room or unit" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} /></label>}
              </>
            )}

            <label>Order notes<textarea placeholder="Anything the kitchen should know?" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} /></label>

            <label>Payment
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {fulfilment === "pickup" && <option value="pay_at_counter">Pay at pickup</option>}
                <option value="cash">Cash</option>
                {qrEnabled && <option value="manual_qr_transfer">QR transfer</option>}
              </select>
            </label>
            {paymentMethod === "manual_qr_transfer" && <p className="sbo-help">QR payment will be confirmed by Smash Brothers before the order is treated as paid.</p>}

            <button disabled={!cart.length || loading || !orderingEnabled || menuLoading} onClick={submit}>{loading ? "Sending order..." : "Place Order"}</button>
            <p className="sbo-help">Your order will go directly to the Smash Brothers kitchen after submission.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

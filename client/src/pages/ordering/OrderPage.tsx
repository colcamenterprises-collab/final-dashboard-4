import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import OrderingMenu from "@/components/ordering/OrderingMenu";
import OrderingFlow from "@/components/ordering/OrderingFlow";
import { fetchOrderingMenu, fetchOrderingSettings, submitOrderingOrder, money, type CartItem, type OrderingLanguage } from "@/components/ordering/orderingApi";
import "./OrderPage.css";

type Fulfilment = "pickup" | "delivery";
type FlowStep = "menu" | "cart" | "checkout";

function readSavedCart(key: string): CartItem[] {
  try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; }
  catch { localStorage.removeItem(key); return []; }
}

export default function OrderPage({ tablet = false }: { tablet?: boolean }) {
  const { tableCode } = useParams();
  const navigate = useNavigate();
  const cartKey = tablet ? "sbb_tablet_cart" : "sbb_order_cart";
  const [language, setLanguage] = useState<OrderingLanguage>("en");
  const [menu, setMenu] = useState<any[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>(() => readSavedCart(cartKey));
  const [flowStep, setFlowStep] = useState<FlowStep>("menu");
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
    fetchOrderingMenu().then((data) => { if (active) { setMenu(data.categories ?? []); setError(""); } }).catch((err) => { if (active) setError(err?.message || "Could not load the menu."); }).finally(() => { if (active) setMenuLoading(false); });
    fetchOrderingSettings().then((data) => { if (active) setSettings(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => { try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {} }, [cart, cartKey]);

  const orderingEnabled = settings.store_order_enabled !== false;
  const qrEnabled = settings.manual_qr_transfer_enabled !== false;
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.price) + item.modifiers.reduce((mods, modifier) => mods + Number(modifier.price_delta) * modifier.quantity, 0)) * item.quantity, 0), [cart]);

  function add(item: CartItem) { setCart((prev) => [...prev, item]); }
  function qty(index: number, quantity: number) { setCart((prev) => quantity <= 0 ? prev.filter((_, i) => i !== index) : prev.map((item, i) => i === index ? { ...item, quantity } : item)); }
  function remove(index: number) { setCart((prev) => prev.filter((_, i) => i !== index)); }
  function chooseFulfilment(value: Fulfilment) { setFulfilment(value); if (value === "pickup") setPaymentMethod("pay_at_counter"); else if (paymentMethod === "pay_at_counter") setPaymentMethod("cash"); }

  async function submit() {
    setError("");
    if (!orderingEnabled) return setError("Online ordering is currently closed.");
    if (!cart.length) return setError("Add at least one item to your order.");
    if (!tablet && !tableCode && !customerName.trim()) return setError("Please enter your name.");
    if (!tablet && !tableCode && !customerPhone.trim()) return setError("Please enter your phone number.");
    if (!tablet && !tableCode && fulfilment === "delivery" && !deliveryAddress.trim()) return setError("Please enter the delivery details.");
    setLoading(true);
    try {
      const fulfilmentNotes = tablet || tableCode ? orderNotes.trim() : [`FULFILMENT: ${fulfilment.toUpperCase()}`, fulfilment === "delivery" ? `DELIVERY DETAILS: ${deliveryAddress.trim()}` : "COLLECTION: Smash Brothers Burgers, Rawai", orderNotes.trim() ? `CUSTOMER NOTE: ${orderNotes.trim()}` : ""].filter(Boolean).join("\n");
      const res = await submitOrderingOrder({ channel: tablet ? "tablet_counter" : tableCode ? "qr_table" : "online", table_code: tableCode || null, customer_name: customerName.trim() || null, customer_phone: customerPhone.trim() || null, order_notes: fulfilmentNotes || null, payment_method: paymentMethod, items: cart.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity, notes: item.notes, modifiers: item.modifiers.map((modifier) => ({ item_modifier_id: modifier.item_modifier_id, quantity: modifier.quantity })) })) });
      setCart([]); localStorage.removeItem(cartKey); navigate(`/order/status/${res.data.id}`);
    } catch (err: any) { setError(err?.message || "Unable to submit order. Please try again."); }
    finally { setLoading(false); }
  }

  return <main className={`sbo-page ${tablet ? "is-tablet" : ""}`}>
    <header className="sbo-header"><div><p>Smash<br/>Brothers</p><h1>Freshly smashed</h1><span>{tableCode ? `Table ${tableCode}` : "What are you hungry for?"}</span></div><div className="sbo-language"><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button><button className={language === "th" ? "active" : ""} onClick={() => setLanguage("th")}>ไทย</button></div></header>
    {!orderingEnabled && <div className="sbo-closed">Online ordering is currently closed.</div>}
    {error && flowStep === "menu" && <div className="sbo-error">{error}</div>}
    <div className="sbo-layout">{menuLoading ? <div className="sbo-empty">Loading menu…</div> : <OrderingMenu categories={menu} language={language} large={tablet} onAdd={add} />}</div>
    {itemCount > 0 && flowStep === "menu" && <button className="sbo-floating-cart" onClick={() => setFlowStep("cart")}><span><b>{itemCount}</b> {itemCount === 1 ? "item" : "items"}</span><span>View cart · {money(cartTotal)}</span></button>}
    {flowStep !== "menu" && <OrderingFlow step={flowStep} cart={cart} language={language} total={cartTotal} loading={loading} orderingEnabled={orderingEnabled} qrEnabled={qrEnabled} fulfilment={fulfilment} paymentMethod={paymentMethod} customerName={customerName} customerPhone={customerPhone} deliveryAddress={deliveryAddress} orderNotes={orderNotes} error={error} onQty={qty} onRemove={remove} onClose={() => setFlowStep("menu")} onBack={() => flowStep === "checkout" ? setFlowStep("cart") : setFlowStep("menu")} onCheckout={() => setFlowStep("checkout")} onSubmit={submit} onFulfilment={chooseFulfilment} onPayment={setPaymentMethod} onName={setCustomerName} onPhone={setCustomerPhone} onAddress={setDeliveryAddress} onNotes={setOrderNotes} showCustomerDetails={!tablet && !tableCode} />}
  </main>;
}

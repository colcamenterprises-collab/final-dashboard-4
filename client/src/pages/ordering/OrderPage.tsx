import { useEffect, useMemo, useState } from "react";
import { Bell, Grid2X2, Home, MapPin, Search, ShoppingCart, UserRound } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import OrderingMenu from "@/components/ordering/OrderingMenu";
import OrderingFlow from "@/components/ordering/OrderingFlow";
import MembershipSheet from "@/components/ordering/MembershipSheet";
import { fetchOrderingMenu, fetchOrderingSettings, resolveMembershipQr, resolvePartnerVenueQr, submitOrderingOrder, money, type CartItem, type OrderingLanguage } from "@/components/ordering/orderingApi";
import "./OrderPage.css";
import "./OrderPagePolish.css";

type Fulfilment = "pickup" | "delivery";
type FlowStep = "menu" | "cart" | "checkout";
type PartnerAttribution = {
  channel_source: "partner_venue";
  partner_venue_id: string;
  qr_code_id: string;
  qr_token: string;
  venue: { id: string; name: string; code: string; address: string; latitude?: string | null; longitude?: string | null };
  attribution_started_at: string;
  attribution_expires_at: string;
  delivery_locked_to_venue: true;
};

type MemberIdentity = { id: string; member_number: string; name: string; phone_display: string; qr_code_id?: string; qr_token?: string; qr_data_url?: string; order_count?: number; lifetime_spend?: number };

function readSavedCart(key: string): CartItem[] {
  try { const raw = localStorage.getItem(key); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; }
  catch { localStorage.removeItem(key); return []; }
}

function sessionKey() {
  const key = "sbb_order_session_key";
  let value = localStorage.getItem(key);
  if (!value) { value = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; localStorage.setItem(key, value); }
  return value;
}

function savedPartnerAttribution(): PartnerAttribution | null {
  try {
    const raw = localStorage.getItem("sbb_partner_attribution");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PartnerAttribution;
    if (!parsed?.attribution_expires_at || Date.now() >= new Date(parsed.attribution_expires_at).getTime()) {
      localStorage.removeItem("sbb_partner_attribution");
      return null;
    }
    return parsed;
  } catch { localStorage.removeItem("sbb_partner_attribution"); return null; }
}

function savedMember(): MemberIdentity | null {
  try { const raw = localStorage.getItem("sbb_member_identity"); return raw ? JSON.parse(raw) : null; }
  catch { localStorage.removeItem("sbb_member_identity"); return null; }
}

function firstMenuImage(categories: any[]) {
  for (const category of categories) for (const item of category.items ?? []) {
    const image = item.image_url || item.imageUrl || item.photo_url || item.photoUrl;
    if (image && item.is_active !== false && !item.is_sold_out) return image;
  }
  return "";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("pay_at_counter");
  const [orderNotes, setOrderNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [partnerAttribution, setPartnerAttribution] = useState<PartnerAttribution | null>(() => savedPartnerAttribution());
  const [member, setMember] = useState<MemberIdentity | null>(() => savedMember());
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOrderingMenu().then((data) => { if (active) { setMenu(data.categories ?? []); setError(""); } }).catch((err) => { if (active) setError(err?.message || "Could not load the menu."); }).finally(() => { if (active) setMenuLoading(false); });
    fetchOrderingSettings().then((data) => { if (active) setSettings(data); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (tablet || tableCode) return;
    const params = new URLSearchParams(window.location.search);
    const venueToken = params.get("v");
    const memberToken = params.get("member");
    let active = true;

    if (venueToken) {
      resolvePartnerVenueQr(venueToken, sessionKey()).then((payload) => {
        if (!active) return;
        const attribution = payload.data as PartnerAttribution;
        localStorage.setItem("sbb_partner_attribution", JSON.stringify(attribution));
        setPartnerAttribution(attribution);
        setFulfilment("delivery");
        setPaymentMethod((value) => value === "pay_at_counter" ? "cash" : value);
        setDeliveryAddress(attribution.venue.address);
      }).catch((err) => { if (active) setError(err?.message || "This venue QR code could not be verified."); });
    } else {
      const existing = savedPartnerAttribution();
      if (existing) {
        setPartnerAttribution(existing);
        setFulfilment("delivery");
        setPaymentMethod((value) => value === "pay_at_counter" ? "cash" : value);
        setDeliveryAddress(existing.venue.address);
      }
    }

    if (memberToken) {
      resolveMembershipQr(memberToken).then((payload) => {
        if (!active) return;
        const identity = payload.data as MemberIdentity;
        localStorage.setItem("sbb_member_identity", JSON.stringify(identity));
        setMember(identity);
        setCustomerName(identity.name || "");
        setCustomerPhone(identity.phone_display || "");
        setMembershipOpen(true);
      }).catch(() => {});
    } else {
      const identity = savedMember();
      if (identity) { setMember(identity); setCustomerName(identity.name || ""); setCustomerPhone(identity.phone_display || ""); }
    }
    return () => { active = false; };
  }, [tablet, tableCode]);

  useEffect(() => { try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch {} }, [cart, cartKey]);

  const orderingEnabled = settings.store_order_enabled !== false;
  const qrEnabled = settings.manual_qr_transfer_enabled !== false;
  const itemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (Number(item.price) + item.modifiers.reduce((mods, modifier) => mods + Number(modifier.price_delta) * modifier.quantity, 0)) * item.quantity, 0), [cart]);
  const heroImage = useMemo(() => firstMenuImage(menu), [menu]);
  const deliveryLocked = Boolean(partnerAttribution && Date.now() < new Date(partnerAttribution.attribution_expires_at).getTime());

  function add(item: CartItem) { setCart((prev) => [...prev, item]); }
  function qty(index: number, quantity: number) { setCart((prev) => quantity <= 0 ? prev.filter((_, i) => i !== index) : prev.map((item, i) => i === index ? { ...item, quantity } : item)); }
  function remove(index: number) { setCart((prev) => prev.filter((_, i) => i !== index)); }
  function chooseFulfilment(value: Fulfilment) {
    if (deliveryLocked) { setFulfilment("delivery"); setDeliveryAddress(partnerAttribution!.venue.address); return; }
    setFulfilment(value); if (value === "pickup") setPaymentMethod("pay_at_counter"); else if (paymentMethod === "pay_at_counter") setPaymentMethod("cash");
  }
  function goToMenu() { document.querySelector(".sbo-category-nav")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function adoptMember(identity: MemberIdentity) { setMember(identity); setCustomerName(identity.name || ""); setCustomerPhone(identity.phone_display || ""); }

  async function submit() {
    setError("");
    if (!orderingEnabled) return setError("Online ordering is currently closed.");
    if (!cart.length) return setError("Add at least one item to your order.");
    if (!tablet && !tableCode && !customerName.trim()) return setError("Please enter your name.");
    if (!tablet && !tableCode && !customerPhone.trim()) return setError("Please enter your phone number.");
    if (!tablet && !tableCode && fulfilment === "delivery" && !deliveryAddress.trim()) return setError("Please enter the delivery details.");
    setLoading(true);
    try {
      const fulfilmentNotes = tablet || tableCode ? orderNotes.trim() : [
        `FULFILMENT: ${fulfilment.toUpperCase()}`,
        fulfilment === "delivery" ? `DELIVERY DETAILS: ${deliveryAddress.trim()}` : "COLLECTION: Smash Brothers Burgers, Rawai",
        partnerAttribution ? `PARTNER VENUE: ${partnerAttribution.venue.name} (${partnerAttribution.venue.code})` : "",
        member ? `MEMBER: ${member.member_number}` : "",
        orderNotes.trim() ? `CUSTOMER NOTE: ${orderNotes.trim()}` : "",
      ].filter(Boolean).join("\n");
      const res = await submitOrderingOrder({
        channel: tablet ? "tablet_counter" : tableCode ? "qr_table" : "online",
        channel_source: partnerAttribution ? "partner_venue" : "direct",
        partner_venue_id: partnerAttribution?.partner_venue_id || null,
        member_id: member?.id || null,
        qr_code_id: partnerAttribution?.qr_code_id || member?.qr_code_id || null,
        attribution_started_at: partnerAttribution?.attribution_started_at || null,
        delivery_address_snapshot: fulfilment === "delivery" ? deliveryAddress.trim() : null,
        delivery_fee_standard: Number(settings.standard_delivery_fee || 0),
        delivery_fee_charged: Number(settings.delivery_fee_charged || 0),
        table_code: tableCode || null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        order_notes: fulfilmentNotes || null,
        payment_method: paymentMethod,
        items: cart.map((item) => ({ menu_item_id: item.menu_item_id, quantity: item.quantity, notes: item.notes, modifiers: item.modifiers.map((modifier) => ({ item_modifier_id: modifier.item_modifier_id, quantity: modifier.quantity })) })),
      });
      setCart([]); localStorage.removeItem(cartKey); navigate(`/order/status/${res.data.id}`);
    } catch (err: any) { setError(err?.message || "Unable to submit order. Please try again."); }
    finally { setLoading(false); }
  }

  return <main className={`sbo-page ${tablet ? "is-tablet" : ""}`}>
    <div className="sbo-app-shell">
      <header className="sbo-topbar">
        <img className="sbo-logo" src="/smash-brothers-logo.png" alt="Smash Brothers Burgers" />
        <div className="sbo-top-actions">
          <button type="button" aria-label="Notifications"><Bell size={20}/></button>
          <button type="button" onClick={() => setMembershipOpen(true)} aria-label={member ? `Member ${member.member_number}` : "Join membership"} title={member ? member.member_number : "Membership"}><UserRound size={21}/></button>
        </div>
      </header>

      <section className="sbo-location-row">
        <MapPin className="sbo-pin" size={21}/>
        <button className="sbo-location-copy" type="button" disabled={deliveryLocked} onClick={() => chooseFulfilment(fulfilment === "pickup" ? "delivery" : "pickup")}>
          <small>{deliveryLocked ? "Deliver to partner venue" : fulfilment === "delivery" ? "Deliver to" : "Pickup from"}</small>
          <strong>{deliveryLocked ? partnerAttribution!.venue.name : fulfilment === "delivery" ? (deliveryAddress || "Choose delivery address") : (settings.restaurant_name || "Smash Brothers Burgers")}</strong>
        </button>
        <div className="sbo-search-wrap"><Search size={20}/><input aria-label="Search menu" placeholder="Search menu" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>
      </section>

      {deliveryLocked && <div className="sbo-partner-banner"><strong>{partnerAttribution!.venue.name}</strong><span>Food delivered here · venue attribution active for 12 hours</span></div>}
      <section className="sbo-hero">
        <div className="sbo-hero-copy"><span>FRESHLY SMASHED</span><h1>FRESH.<br/>HANDMADE.<br/>DELICIOUS.</h1><p>Smash burgers, crispy fries and proper comfort food made fresh in Rawai.</p><button type="button" onClick={goToMenu}>Order now <span>→</span></button></div>
        {heroImage ? <img src={heroImage} alt="Smash Brothers burger" /> : <div aria-hidden="true" />}
      </section>

      {!orderingEnabled && <div className="sbo-closed">Online ordering is currently closed.</div>}
      {error && flowStep === "menu" && <div className="sbo-error">{error}</div>}
      <section className="sbo-menu-area">{menuLoading ? <div className="sbo-empty">Loading menu…</div> : <OrderingMenu categories={menu} language={language} large={tablet} searchQuery={searchQuery} onAdd={add} />}</section>

      <footer className="sbo-bottom-nav">
        <button type="button" className="active" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Home/><span>Home</span></button>
        <button type="button" onClick={goToMenu}><Grid2X2/><span>Menu</span></button>
        <button type="button" className="sbo-cart-tab" onClick={() => itemCount && setFlowStep("cart")}><ShoppingCart/>{itemCount > 0 && <b>{itemCount}</b>}<span>Cart</span></button>
        <button type="button" onClick={() => setMembershipOpen(true)}><UserRound/><span>{member ? "Member" : "Join"}</span></button>
      </footer>
    </div>

    {itemCount > 0 && flowStep === "menu" && <button className="sbo-floating-cart" onClick={() => setFlowStep("cart")}><span><b>{itemCount}</b> {itemCount === 1 ? "item" : "items"}</span><span>View cart · {money(cartTotal)}</span></button>}
    {flowStep !== "menu" && <OrderingFlow step={flowStep} cart={cart} language={language} total={cartTotal} loading={loading} orderingEnabled={orderingEnabled} qrEnabled={qrEnabled} fulfilment={fulfilment} paymentMethod={paymentMethod} customerName={customerName} customerPhone={customerPhone} deliveryAddress={deliveryAddress} orderNotes={orderNotes} error={error} partnerVenueName={partnerAttribution?.venue.name} deliveryLocked={deliveryLocked} onQty={qty} onRemove={remove} onClose={() => setFlowStep("menu")} onBack={() => flowStep === "checkout" ? setFlowStep("cart") : setFlowStep("menu")} onCheckout={() => setFlowStep("checkout")} onSubmit={submit} onFulfilment={chooseFulfilment} onPayment={setPaymentMethod} onName={setCustomerName} onPhone={setCustomerPhone} onAddress={deliveryLocked ? () => {} : setDeliveryAddress} onNotes={setOrderNotes} showCustomerDetails={!tablet && !tableCode} />}
    {membershipOpen && !tablet && !tableCode && <MembershipSheet member={member} onMember={adoptMember} onClose={() => setMembershipOpen(false)} />}
  </main>;
}

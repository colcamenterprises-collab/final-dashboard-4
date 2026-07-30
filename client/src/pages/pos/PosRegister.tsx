import { useEffect, useMemo, useState } from "react";
import { readPosPrinterSettings } from "@/lib/posPrinterSettings";

type Item = {
  id: string;
  name_en: string;
  name_th?: string;
  category_name: string;
  active_price: number;
  image_url?: string;
  set_upgrade_eligible: boolean;
};

type Modifier = {
  id: string;
  name_en: string;
  name_th?: string;
  price_delta: number;
  modifier_group_name_en: string;
};

type Line = Item & {
  quantity: number;
  set_upgrade?: boolean;
  set_drink_menu_item_id?: string;
  modifiers?: Modifier[];
  notes?: string;
};

type Customer = {
  id?: string;
  first_name: string;
  last_name: string;
  mobile: string;
  email: string;
  marketing_opt_in: boolean;
};

type Receipt = {
  orderId: string;
  receiptNumber: string;
  createdAt: string;
  orderMode: "direct" | "grab";
  paymentMethod: string;
  total: number;
  lines: Line[];
  customer?: Customer | null;
  grabOrderNumber?: string;
  grabCustomerName?: string;
  grabCustomerMobile?: string;
  reprint?: boolean;
};

type Pending = { item: Item; modifiers: Modifier[] };

const EMPTY_CUSTOMER: Customer = {
  first_name: "",
  last_name: "",
  mobile: "",
  email: "",
  marketing_opt_in: false,
};
const thb = (n: number) => `฿${Number(n || 0).toLocaleString()}`;
const burgerImage = "/burger-placeholder.png";
const isBurger = (item: Item) => /burger|smash/i.test(`${item.category_name} ${item.name_en}`);
const categoryId = (category: string) => `pos-category-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export default function PosRegister() {
  const [mode, setMode] = useState<"direct" | "grab">("direct");
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<Line[]>([]);
  const [cash, setCash] = useState("");
  const [payment, setPayment] = useState("cash");
  const [language, setLanguage] = useState<"en" | "th">("en");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [modifierOptions, setModifierOptions] = useState<Modifier[]>([]);
  const [flow, setFlow] = useState<"modifiers" | "upgrade">("modifiers");
  const [selectedDrink, setSelectedDrink] = useState("");
  const [setUpgrade, setSetUpgrade] = useState(false);
  const [activeCategory, setActiveCategory] = useState("");
  const [orderNumber, setOrderNumber] = useState("Loading…");
  const [printReceipt, setPrintReceipt] = useState<Receipt | null>(null);
  const [lastReceipt, setLastReceipt] = useState<Receipt | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [joinClub, setJoinClub] = useState<boolean | null>(null);
  const [customer, setCustomer] = useState<Customer>(EMPTY_CUSTOMER);
  const [lookupStatus, setLookupStatus] = useState("");
  const [grabOrderNumber, setGrabOrderNumber] = useState("");
  const [grabCustomerName, setGrabCustomerName] = useState("");
  const [grabCustomerMobile, setGrabCustomerMobile] = useState("");

  useEffect(() => {
    fetch(`/api/pos/menu?price_mode=${mode}`, { credentials: "include" })
      .then((response) => response.json())
      .then((body) => {
        setItems((body.data || []).map((item: Item) => ({ ...item, active_price: Number(item.active_price || 0) })));
        setCart([]);
      })
      .catch(() => setNotice("Could not load POS menu"));
  }, [mode]);

  const refreshOrderNumber = () =>
    fetch("/api/pos/orders/next-ticket", { credentials: "include" })
      .then((response) => response.json())
      .then((body) => body?.data?.ticket_number && setOrderNumber(body.data.ticket_number))
      .catch(() => setOrderNumber("Pending"));

  useEffect(() => { refreshOrderNumber(); }, []);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category_name))], [items]);
  const drinks = useMemo(() => items.filter((item) => item.category_name === "Drinks"), [items]);
  const label = (item: { name_en: string; name_th?: string }) => language === "th" && item.name_th ? item.name_th : item.name_en;
  const lineTotal = (line: Line) =>
    (Number(line.active_price || 0) + (line.set_upgrade ? 80 : 0) +
      (line.modifiers || []).reduce((sum, modifier) => sum + Number(modifier.price_delta || 0), 0)) * line.quantity;
  const total = cart.reduce((sum, line) => sum + lineTotal(line), 0);
  const change = Math.max(0, Number(cash || 0) - total);

  useEffect(() => {
    setActiveCategory((current) => current || categories[0] || "");
  }, [categories]);

  const commitLine = (line: Line) => {
    if (isBurger(line)) return setCart((current) => [...current, line]);
    setCart((current) => {
      const index = current.findIndex((item) => item.id === line.id && !item.set_upgrade && !(item.modifiers || []).length);
      return index < 0
        ? [...current, line]
        : current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item);
    });
  };

  const startItem = async (item: Item) => {
    if (mode === "grab" || !isBurger(item)) return commitLine({ ...item, quantity: 1 });
    try {
      const response = await fetch(`/api/pos/menu/${item.id}/modifiers`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load additions");
      setPending({ item, modifiers: [] });
      setModifierOptions(body.data || []);
      setFlow("modifiers");
      setSetUpgrade(false);
      setSelectedDrink("");
    } catch (error: any) {
      setNotice(error.message);
    }
  };

  const finishBurger = () => {
    if (!pending) return;
    if (pending.item.set_upgrade_eligible && setUpgrade && !selectedDrink)
      return setNotice("Select the set drink before continuing");
    commitLine({
      ...pending.item,
      quantity: 1,
      modifiers: pending.modifiers,
      set_upgrade: pending.item.set_upgrade_eligible ? setUpgrade : false,
      set_drink_menu_item_id: selectedDrink || undefined,
    });
    setPending(null);
  };

  const lookupCustomer = async () => {
    const mobile = customer.mobile.replace(/\D/g, "");
    if (mobile.length < 7) return setLookupStatus("Enter a valid mobile number");
    setLookupStatus("Looking up member…");
    try {
      const response = await fetch(`/api/pos/customers/lookup?mobile=${encodeURIComponent(customer.mobile)}`, { credentials: "include" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Lookup failed");
      if (!body.data) return setLookupStatus("New member");
      setCustomer({
        id: body.data.id,
        first_name: body.data.first_name || "",
        last_name: body.data.last_name || "",
        mobile: body.data.mobile || customer.mobile,
        email: body.data.email || "",
        marketing_opt_in: body.data.marketing_opt_in === true,
      });
      setLookupStatus(`Welcome back, ${body.data.first_name}`);
    } catch (error: any) {
      setLookupStatus(error.message);
    }
  };

  const resetCheckout = () => {
    setCheckoutOpen(false);
    setJoinClub(null);
    setCustomer(EMPTY_CUSTOMER);
    setLookupStatus("");
    setGrabOrderNumber("");
    setGrabCustomerName("");
    setGrabCustomerMobile("");
  };

  const recordPrintEvent = (receipt: Receipt, eventType: "print_requested" | "reprint_requested" | "print_failed", error?: string) =>
    fetch(`/api/pos/orders/${receipt.orderId}/print-event`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, print_kind: "customer_and_kitchen", error }),
    }).catch(() => undefined);

  const print58mm = (receipt: Receipt, reprint = false) => {
    const printerSettings = readPosPrinterSettings();
    const printable = { ...receipt, reprint };
    setPrintReceipt(printable);
    setLastReceipt(printable);
    recordPrintEvent(printable, reprint ? "reprint_requested" : "print_requested");
    window.setTimeout(() => {
      if (!printerSettings.autoPrint && !reprint) return;
      try { window.print(); }
      catch (error: any) { recordPrintEvent(printable, "print_failed", error?.message || "Print failed"); }
    }, 250);
  };

  const validateCheckout = () => {
    if (mode === "direct" && payment === "cash" && Number(cash || 0) < total)
      return "Cash received is less than the order total";
    if (mode === "grab") {
      if (!/^GF-[A-Z0-9]{3,12}$/i.test(grabOrderNumber.trim())) return "Enter the Grab order number as GF-xxxxx";
      if (!grabCustomerName.trim()) return "Enter the Grab customer name";
      if (grabCustomerMobile.replace(/\D/g, "").length < 7) return "Enter the Grab customer mobile";
    }
    if (joinClub === null) return "Ask whether the customer wants to join Smash Club";
    if (joinClub) {
      if (!customer.first_name.trim()) return "Member first name is required";
      if (customer.mobile.replace(/\D/g, "").length < 7) return "Member mobile is required";
    }
    return "";
  };

  const charge = async () => {
    const validation = validateCheckout();
    if (validation) return setNotice(validation);
    const lines = cart.map((line) => ({ ...line, modifiers: [...(line.modifiers || [])] }));
    try {
      const response = await fetch("/api/pos/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_mode: mode,
          payment_method: mode === "grab" ? "grab" : payment,
          grab_order_number: mode === "grab" ? grabOrderNumber.trim().toUpperCase() : undefined,
          grab_customer_name: mode === "grab" ? grabCustomerName.trim() : undefined,
          grab_customer_mobile: mode === "grab" ? grabCustomerMobile.trim() : undefined,
          customer: joinClub ? customer : undefined,
          items: lines.map((line) => ({
            menu_item_id: line.id,
            quantity: line.quantity,
            notes: line.notes || undefined,
            set_upgrade: mode === "direct" && !!line.set_upgrade,
            set_drink_menu_item_id: line.set_drink_menu_item_id,
            modifier_ids: (line.modifiers || []).map((modifier) => modifier.id),
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not create order");
      const receipt: Receipt = {
        orderId: body.data.id,
        receiptNumber: body.data.receipt_number || body.data.ticket_number,
        createdAt: body.data.created_at || new Date().toISOString(),
        orderMode: mode,
        paymentMethod: mode === "grab" ? "grab" : payment,
        total: Number(body.data.total || total),
        lines,
        customer: body.data.customer || (joinClub ? customer : null),
        grabOrderNumber: body.data.grab_order_number,
        grabCustomerName: body.data.grab_customer_name,
        grabCustomerMobile: body.data.grab_customer_mobile,
      };
      setNotice(`${receipt.receiptNumber} sent to kitchen`);
      setCart([]);
      setCash("");
      resetCheckout();
      refreshOrderNumber();
      print58mm(receipt);
      window.setTimeout(() => setNotice(""), 4000);
    } catch (error: any) {
      setNotice(error.message);
    }
  };

  return (
    <main className="h-dvh overflow-hidden bg-[#fffdf4] text-[#171717]">
      <style>{`
        .sbb-print-receipt { display: none; }
        @media print {
          @page { size: ${readPosPrinterSettings().paperWidth}mm auto; margin: 0; }
          html, body { width: ${readPosPrinterSettings().paperWidth}mm; margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          .sbb-print-receipt, .sbb-print-receipt * { visibility: visible !important; }
          .sbb-print-receipt { display:block!important; position:absolute; left:0; top:0; width:${readPosPrinterSettings().paperWidth}mm; padding:2.5mm; box-sizing:border-box; color:#000; background:#fff; font:10px/1.3 monospace; }
          .ticket-number { font-size:19px; font-weight:900; text-align:center; }
          .section-title { font-size:14px; font-weight:900; text-align:center; }
          .rule { border-top:1px dashed #000; margin:7px 0; }
          .print-row { display:flex; justify-content:space-between; gap:6px; }
          .modifier { padding-left:9px; font-size:9px; }
          .kitchen-item { font-size:14px; font-weight:900; margin-top:5px; }
          .cut-line { border-top:2px dashed #000; margin:14px 0 10px; text-align:center; }
        }
      `}</style>

      <header className="flex h-[70px] items-center justify-between bg-[#111] px-5 text-white">
        <div className="flex items-center gap-4">
          <img src="/smash-brothers-logo.png" alt="Smash Brothers Burgers" className="h-12 w-12 object-contain" />
          <strong>Smash Brothers POS</strong>
        </div>
        <div className="flex items-center gap-2">
          {lastReceipt && <button onClick={() => print58mm(lastReceipt, true)} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">Reprint</button>}
          <button onClick={() => setLanguage(language === "en" ? "th" : "en")} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold">{language === "en" ? "ไทย" : "EN"}</button>
          <button onClick={() => { setMode("direct"); setPayment("cash"); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === "direct" ? "bg-white text-black" : "bg-white/10"}`}>Counter</button>
          <button onClick={() => { setMode("grab"); setPayment("grab"); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${mode === "grab" ? "bg-[#ffd400] text-black" : "bg-white/10"}`}>Grab</button>
        </div>
      </header>

      {notice && <button onClick={() => setNotice("")} className="absolute left-1/2 top-20 z-50 -translate-x-1/2 rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white shadow-2xl">{notice} · Close</button>}

      <div className="grid h-[calc(100dvh-70px)] grid-cols-[minmax(0,1fr)_348px] overflow-hidden">
        <section className="min-w-0 overflow-y-auto px-4 pb-10 pt-3">
          <div className="sticky top-0 z-10 -mx-4 mb-5 bg-[#ffd400] px-4 py-3">
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((category) => <button key={category} onClick={() => { setActiveCategory(category); document.getElementById(categoryId(category))?.scrollIntoView({ behavior: "smooth" }); }} className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold ${activeCategory === category ? "bg-black text-white" : "bg-white"}`}>{category}</button>)}
            </div>
          </div>
          {categories.map((category) => (
            <section id={categoryId(category)} key={category} className="mb-7 scroll-mt-24">
              <h2 className="mb-3 text-lg font-black">{category}</h2>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {items.filter((item) => item.category_name === category).map((item) => (
                  <button key={item.id} onClick={() => startItem(item)} className="min-h-[142px] rounded-[18px] border bg-white p-2 text-left shadow-sm">
                    <img src={item.image_url || burgerImage} alt="" className="h-[68px] w-full object-contain" />
                    <p className="line-clamp-2 min-h-8 text-xs font-extrabold">{label(item)}</p>
                    <p className="mt-1 text-sm font-black">{thb(item.active_price)}</p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </section>

        <aside className="m-3 ml-0 flex min-w-0 flex-col overflow-hidden rounded-[26px] border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div><h2 className="text-xl font-black">Current order</h2><p className="text-xs font-bold text-zinc-400">Order · {orderNumber}</p></div>
            <button onClick={() => setCart([])} className="text-sm font-semibold text-red-600">Clear</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            {cart.length === 0 ? <div className="grid h-full place-items-center text-sm font-bold text-zinc-400">Add items to start an order</div> : cart.map((line, index) => (
              <div key={`${line.id}-${index}`} className="border-b py-3">
                <div className="flex justify-between text-sm font-bold"><span>{line.quantity} × {label(line)}</span><span>{thb(lineTotal(line))}</span></div>
                {(line.modifiers || []).map((modifier) => <p key={modifier.id} className="text-xs text-green-700">+ {label(modifier)}</p>)}
                {line.set_upgrade && <p className="text-xs font-bold text-amber-700">SET + Fries + {drinks.find((drink) => drink.id === line.set_drink_menu_item_id)?.name_en}</p>}
                {isBurger(line) && <input value={line.notes || ""} onChange={(event) => setCart((current) => current.map((item, i) => i === index ? { ...item, notes: event.target.value } : item))} className="mt-2 w-full rounded-xl border px-3 py-2 text-xs" placeholder="Item request, e.g. No cheese" />}
              </div>
            ))}
          </div>
          <div className="border-t p-5">
            <div className="flex justify-between"><strong>Total</strong><strong className="text-3xl">{thb(total)}</strong></div>
            {mode === "direct" && payment === "cash" && <><input value={cash} onChange={(e) => setCash(e.target.value)} inputMode="decimal" placeholder="Cash received" className="mt-3 w-full rounded-xl border px-3 py-3" /><div className="mt-2 flex justify-between text-sm font-bold"><span>Change</span><span>{thb(change)}</span></div></>}
            <div className="mt-4 grid grid-cols-3 gap-2">{["cash", "manual_qr_transfer", "grab"].map((method) => <button key={method} disabled={mode === "grab" && method !== "grab"} onClick={() => setPayment(method)} className={`rounded-xl py-3 text-xs font-black ${payment === method ? "bg-black text-white" : "bg-zinc-100"}`}>{method === "manual_qr_transfer" ? "QR" : method.toUpperCase()}</button>)}</div>
            <button disabled={!cart.length} onClick={() => { setJoinClub(null); setCheckoutOpen(true); }} className="mt-3 w-full rounded-xl bg-[#ffd400] py-4 text-base font-black disabled:opacity-40">Charge {thb(total)}</button>
          </div>
        </aside>
      </div>

      {pending && <div className="fixed inset-0 z-30 grid place-items-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6">
        <h2 className="text-2xl font-black">{flow === "modifiers" ? "Make it Better" : "Make it a set?"}</h2>
        {flow === "modifiers" ? <><div className="mt-4 grid grid-cols-2 gap-2">{modifierOptions.map((modifier) => <button key={modifier.id} onClick={() => setPending((current) => current && ({ ...current, modifiers: current.modifiers.some((m) => m.id === modifier.id) ? current.modifiers.filter((m) => m.id !== modifier.id) : [...current.modifiers, modifier] }))} className={`rounded-2xl border p-4 text-left font-bold ${pending.modifiers.some((m) => m.id === modifier.id) ? "border-yellow-400 bg-yellow-50" : ""}`}>{label(modifier)}<span className="block text-sm text-green-700">+{thb(modifier.price_delta)}</span></button>)}</div><button onClick={() => pending.item.set_upgrade_eligible ? setFlow("upgrade") : finishBurger()} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">Continue</button></> : <><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => setSetUpgrade(false)} className="rounded-xl border p-4">Burger only</button><button onClick={() => setSetUpgrade(true)} className="rounded-xl border p-4">Set +฿80</button></div>{setUpgrade && <select value={selectedDrink} onChange={(e) => setSelectedDrink(e.target.value)} className="mt-3 w-full rounded-xl border p-3"><option value="">Select included drink</option>{drinks.map((drink) => <option key={drink.id} value={drink.id}>{label(drink)}</option>)}</select>}<button onClick={finishBurger} className="mt-5 w-full rounded-xl bg-[#ffd400] p-4 font-black">Add to order</button></>}
      </div></div>}

      {checkoutOpen && <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4"><div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex justify-between"><div><h2 className="text-2xl font-black">Complete payment</h2><p className="text-sm text-zinc-500">{orderNumber} · {thb(total)}</p></div><button onClick={() => setCheckoutOpen(false)}>Close</button></div>
        {mode === "grab" && <section className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4"><h3 className="font-black">Grab receipt details</h3><div className="mt-3 grid gap-3"><input value={grabOrderNumber} onChange={(e) => setGrabOrderNumber(e.target.value.toUpperCase())} placeholder="GF-XXXXX" className="rounded-xl border px-3 py-3" /><input value={grabCustomerName} onChange={(e) => setGrabCustomerName(e.target.value)} placeholder="Customer name" className="rounded-xl border px-3 py-3" /><input value={grabCustomerMobile} onChange={(e) => setGrabCustomerMobile(e.target.value)} placeholder="Customer mobile" className="rounded-xl border px-3 py-3" /></div></section>}
        <section className="mt-5"><h3 className="font-black">Would you like to join Smash Club?</h3><p className="text-sm text-zinc-500">Members receive exclusive offers and future rewards.</p><div className="mt-3 grid grid-cols-2 gap-3"><button onClick={() => setJoinClub(true)} className={`rounded-xl border p-3 font-bold ${joinClub === true ? "border-yellow-400 bg-yellow-50" : ""}`}>Join</button><button onClick={() => setJoinClub(false)} className={`rounded-xl border p-3 font-bold ${joinClub === false ? "border-yellow-400 bg-yellow-50" : ""}`}>Skip</button></div></section>
        {joinClub && <section className="mt-4 grid gap-3 rounded-2xl bg-zinc-50 p-4"><div className="flex gap-2"><input value={customer.mobile} onChange={(e) => setCustomer({ ...customer, mobile: e.target.value })} placeholder="Mobile" className="min-w-0 flex-1 rounded-xl border px-3 py-3" /><button onClick={lookupCustomer} className="rounded-xl bg-black px-4 font-bold text-white">Lookup</button></div>{lookupStatus && <p className="text-sm font-semibold text-green-700">{lookupStatus}</p>}<input value={customer.first_name} onChange={(e) => setCustomer({ ...customer, first_name: e.target.value })} placeholder="First name" className="rounded-xl border px-3 py-3" /><input value={customer.last_name} onChange={(e) => setCustomer({ ...customer, last_name: e.target.value })} placeholder="Last name (optional)" className="rounded-xl border px-3 py-3" /><input value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="Email (optional)" className="rounded-xl border px-3 py-3" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={customer.marketing_opt_in} onChange={(e) => setCustomer({ ...customer, marketing_opt_in: e.target.checked })} /> Marketing consent</label></section>}
        <button onClick={charge} className="mt-5 w-full rounded-xl bg-[#ffd400] py-4 text-lg font-black">Complete payment · {thb(total)}</button>
      </div></div>}

      {printReceipt && <div className="sbb-print-receipt" aria-hidden="true">
        <div className="section-title">SMASH BROTHERS BURGERS</div>{printReceipt.reprint && <div className="section-title">*** REPRINT ***</div>}<div className="ticket-number">{printReceipt.receiptNumber}</div><div className="print-row"><span>{new Date(printReceipt.createdAt).toLocaleString()}</span><span>{printReceipt.orderMode.toUpperCase()}</span></div><div className="print-row"><span>Payment</span><span>{printReceipt.paymentMethod.toUpperCase()}</span></div>
        {printReceipt.customer && <><div className="rule" /><div>MEMBER: {printReceipt.customer.first_name} {printReceipt.customer.last_name}</div><div>MOBILE: {printReceipt.customer.mobile}</div></>}
        {printReceipt.orderMode === "grab" && <><div className="rule" /><div>GRAB: {printReceipt.grabOrderNumber}</div><div>{printReceipt.grabCustomerName}</div><div>{printReceipt.grabCustomerMobile}</div></>}
        <div className="rule" />{printReceipt.lines.map((line, index) => <div key={`${line.id}-${index}`}><div className="print-row"><span>{line.quantity} x {line.name_en}</span><span>{thb(lineTotal(line))}</span></div>{(line.modifiers || []).map((modifier) => <div className="modifier" key={modifier.id}>+ {modifier.name_en}</div>)}{line.notes && <div className="modifier">NOTE: {line.notes}</div>}</div>)}<div className="rule" /><div className="print-row section-title"><span>TOTAL</span><span>{thb(printReceipt.total)}</span></div><div className="cut-line">CUT / KITCHEN COPY</div><div className="section-title">KITCHEN TICKET</div><div className="ticket-number">{printReceipt.receiptNumber}</div>{printReceipt.orderMode === "grab" && <div className="section-title">GRAB {printReceipt.grabOrderNumber}</div>}<div className="rule" />{printReceipt.lines.map((line, index) => <div key={`k-${line.id}-${index}`}><div className="kitchen-item">{line.quantity} x {line.name_en}</div>{(line.modifiers || []).map((modifier) => <div className="modifier" key={`k-${modifier.id}`}>+ {modifier.name_en}</div>)}{line.notes && <div className="modifier">REQUEST: {line.notes}</div>}</div>)}
      </div>}
    </main>
  );
}

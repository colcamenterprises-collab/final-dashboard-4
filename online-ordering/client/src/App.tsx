import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Category, MenuItem, CartItem, OrderPayload } from "./types";

type MenuResponse = { categories: Category[]; items: MenuItem[] };
const SBB_YELLOW = "#FFEB00";
const THB = (n: number) => `THB ${n.toFixed(2)}`;
const loadLS = <T,>(k: string, f: T) => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const saveLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export default function App() {
  const [menu, setMenu] = useState<MenuResponse>({ categories: [], items: [] });
  const [cart, setCart] = useState<CartItem[]>(() => loadLS<CartItem[]>("sbb.cart", []));
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");

  const fontInjected = useRef(false);
  useEffect(() => {
    if (fontInjected.current) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap";
    document.head.appendChild(link);
    fontInjected.current = true;

    (async () => {
      const r = await fetch("/api/ordering/menu").catch(() => fetch("/api/menu"));
      const data: MenuResponse = await r!.json();
      setMenu({ categories: data.categories, items: data.items });
      if (!activeCat && data.categories.length) setActiveCat(data.categories[0].id);
    })();
  }, []);

  useEffect(() => saveLS("sbb.cart", cart), [cart]);

  const filteredMenu = useMemo(() => {
    return menu.items.filter((m) => m.categoryId === activeCat);
  }, [activeCat, menu.items]);

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.item.price * c.qty, 0), [cart]);
  const total = subtotal;

  const addToCart = (item: MenuItem, qty: number, note?: string) => {
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.item.id === item.id && (ci.note || "") === (note || ""));
      if (idx >= 0) {
        const next = [...prev]; next[idx] = { ...next[idx], qty: next[idx].qty + qty }; return next;
      }
      return [...prev, { item, qty, note }];
    });
    setModalItem(null);
  };

  const removeFromCart = (id: string, note?: string) => {
    setCart(prev => prev.filter(ci => !(ci.item.id === id && (ci.note || "") === (note || ""))));
  };

  const updateQty = (id: string, note: string | undefined, delta: number) => {
    setCart(prev => prev.map(ci => {
      if (ci.item.id === id && (ci.note || "") === (note || "")) {
        return { ...ci, qty: Math.max(1, ci.qty + delta) };
      }
      return ci;
    }));
  };

  const postOrder = async () => {
    if (!cart.length) return;
    const payload: OrderPayload = {
      customer: { ...customer },
      scheduledAt: null,
      items: cart.map(ci => ({ id: ci.item.id, name: ci.item.name, unitPrice: ci.item.price, qty: ci.qty, note: ci.note, categoryId: ci.item.categoryId })),
      subtotal, serviceFee: 0, total, currency: "THB"
    };
    try {
      setSubmitting(true);
      const r = await fetch("/api/ordering/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .catch(() => fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      const data = await r!.json();
      if (!r!.ok) throw new Error(data?.error || "Failed");
      setCart([]); alert(`Order received!\nOrder ID: ${data.id}`);
      setModalItem(null);
    } catch (e: any) {
      alert(`Could not place the order: ${e.message}`);
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
      {/* HEADER */}
      <div className="mx-auto w-full max-w-[700px] px-4 pt-8 pb-4">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
              <img src="/images/sbb-logo.png" alt="SBB" className="h-8 w-8 object-contain" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Smash Brothers Burgers (Rawai)</h1>
          </div>
          <p className="mt-2 text-sm text-white/70">Traditional American Smash Burgers — Opens at 6:00 pm</p>
        </div>

        {/* Tabs */}
        <div className="mt-5">
          <div className="flex flex-wrap items-center gap-4">
            {menu.categories.map((c) => (
              <button key={c.id} onClick={() => setActiveCat(c.id)} className="relative pb-2 text-sm font-semibold">
                <span className="opacity-90">{c.name.toUpperCase()}</span>
                {activeCat === c.id && <span className="absolute left-0 right-0 -bottom-[9px] h-[3px] rounded" style={{ background: SBB_YELLOW }} />}
              </button>
            ))}
          </div>
          <div className="mt-3 h-px w-full bg-white/10" />
        </div>
      </div>

      {/* SECTION + LIST */}
      <div className="mx-auto w-full max-w-[700px] px-4">
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-6 rounded-full" style={{ background: SBB_YELLOW }} />
          <h2 className="text-lg md:text-xl font-extrabold">{menu.categories.find(c=>c.id===activeCat)?.name.toUpperCase()}</h2>
        </div>

        <div className="mt-4 space-y-4">
          {filteredMenu.map((m) => (
            <div key={m.id} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg bg-white/10 overflow-hidden flex-shrink-0">
                  {m.image ? <img src={m.image} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-tight">{m.name}</div>
                  {m.desc && <div className="text-sm text-white/70 line-clamp-2">{m.desc}</div>}
                </div>
                <button onClick={() => setModalItem(m)} className="rounded-xl px-3 py-2 text-sm font-semibold text-black" style={{ background: SBB_YELLOW }}>
                  {THB(m.price)} +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="h-28" />
      </div>

      {/* CART BAR */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-[900px] px-3 pb-4">
          <div className="rounded-2xl border border-white/10 bg-black/90 backdrop-blur p-2 md:p-3 flex items-center gap-2 md:gap-4">
            <div className="text-xs md:text-sm px-3 py-2 rounded-xl bg-white/10">{cart.length} item{cart.length!==1?"s":""}</div>
            <div className="text-xs md:text-sm px-3 py-2 rounded-xl bg-white/10">Subtotal: {THB(subtotal)}</div>
            <button className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-black" style={{ background: SBB_YELLOW }} onClick={() => setModalItem({ id: "__checkout__", categoryId: "", name: "Checkout", desc: "", price: 0 })} disabled={cart.length===0}>Review & Checkout</button>
          </div>
        </div>
      </div>

      {/* ITEM MODAL */}
      {modalItem && modalItem.id !== "__checkout__" && (
        <ModalAddItem item={modalItem} onClose={() => setModalItem(null)} onAdd={(qty, note) => addToCart(modalItem, qty, note)} />
      )}

      {/* CHECKOUT MODAL */}
      {modalItem && modalItem.id === "__checkout__" && (
        <ModalCheckout
          cart={cart}
          subtotal={subtotal}
          total={total}
          customer={customer}
          onCustomerChange={setCustomer}
          onRemove={removeFromCart}
          onUpdateQty={updateQty}
          submitting={submitting}
          onClose={() => setModalItem(null)}
          onSubmit={postOrder}
        />
      )}
    </div>
  );
}

function ModalAddItem({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (qty: number, note?: string) => void; }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60">
      <div className="w-full sm:max-w-[560px] bg-[#0B0B0B] text-white rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold">{item.name}</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="border border-white/20 rounded-lg px-3 py-1" onClick={() => setQty(q => Math.max(1, q - 1))}>-</button>
              <div>{qty}</div>
              <button className="border border-white/20 rounded-lg px-3 py-1" onClick={() => setQty(q => q + 1)}>+</button>
            </div>
            <div className="font-semibold">{THB(item.price * qty)}</div>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Add a note (optional)</div>
            <textarea
              className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none"
              placeholder="No onions, extra sauce…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </div>

          <button onClick={() => onAdd(qty, note || undefined)} className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black" style={{ background: SBB_YELLOW }}>
            Add to order
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCheckout(props: {
  cart: CartItem[];
  subtotal: number;
  total: number;
  customer: { name: string; phone: string; notes: string };
  onCustomerChange: (c: { name: string; phone: string; notes: string }) => void;
  onRemove: (id: string, note?: string) => void;
  onUpdateQty: (id: string, note: string | undefined, delta: number) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { cart, subtotal, total, customer, onCustomerChange, onRemove, onUpdateQty, submitting, onClose, onSubmit } = props;
  const [checkoutType, setCheckoutType] = useState<"Pickup" | "Delivery">("Pickup");
  const [payment, setPayment] = useState<"Cash" | "QR Code" | "Card">("Cash");
  const [address, setAddress] = useState("");
  const vat = subtotal - subtotal / 1.07;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-[560px] bg-[#0B0B0B] text-white rounded-t-2xl sm:rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold">Your Order</div>
          <button className="text-sm underline" onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <div className="p-4 space-y-3">
            {cart.map(ci => (
              <div key={ci.item.id + (ci.note || "")} className="border border-white/10 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold leading-tight">{ci.item.name}</div>
                    {ci.note && <div className="text-xs text-white/70 mt-1">{ci.note}</div>}
                  </div>
                  <div className="text-right min-w-[120px]">
                    <div className="font-semibold">{THB(ci.item.price * ci.qty)}</div>
                    <div className="mt-2 inline-flex items-center gap-2">
                      <button className="border border-white/20 rounded-lg px-2" onClick={() => onUpdateQty(ci.item.id, ci.note, -1)}>-</button>
                      <span className="text-sm w-6 text-center">{ci.qty}</span>
                      <button className="border border-white/20 rounded-lg px-2" onClick={() => onUpdateQty(ci.item.id, ci.note, +1)}>+</button>
                    </div>
                    <div>
                      <button className="mt-2 text-xs underline text-white/70" onClick={() => onRemove(ci.item.id, ci.note)}>Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="border-t border-white/10 pt-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Subtotal</span><span>{THB(subtotal)}</span></div>
              <div className="flex justify-between"><span>VAT (inc)</span><span>{THB(vat)}</span></div>
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span>{THB(total)}</span></div>
            </div>

            <div className="border-t border-white/10 pt-3 grid grid-cols-1 gap-2 text-sm">
              <input className="bg-black/50 border border-white/10 rounded-lg px-3 py-2" placeholder="Name" value={customer.name} onChange={(e) => onCustomerChange({ ...customer, name: e.target.value })} />
              <input className="bg-black/50 border border-white/10 rounded-lg px-3 py-2" placeholder="Phone" value={customer.phone} onChange={(e) => onCustomerChange({ ...customer, phone: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-black/50 border border-white/10 rounded-lg px-3 py-2" value={checkoutType} onChange={(e) => setCheckoutType(e.target.value as any)}>
                  <option>Pickup</option>
                  <option>Delivery</option>
                </select>
                <select className="bg-black/50 border border-white/10 rounded-lg px-3 py-2" value={payment} onChange={(e) => setPayment(e.target.value as any)}>
                  <option>Cash</option>
                  <option>QR Code</option>
                  <option>Card</option>
                </select>
              </div>
              {checkoutType === "Delivery" && (
                <textarea className="bg-black/50 border border-white/10 rounded-lg px-3 py-2 min-h-[80px]" placeholder="Delivery address / notes" value={address} onChange={(e) => setAddress(e.target.value)} />
              )}
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button className="rounded-xl px-4 py-3 text-sm font-semibold text-black" style={{ background: SBB_YELLOW }} onClick={onSubmit} disabled={cart.length === 0 || submitting}>
                {submitting ? "Sending..." : "Send to POS"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Category, MenuItem, CartItem, OrderPayload } from "./types";

type MenuResponse = { categories: Category[]; items: MenuItem[] };
const SBB_YELLOW = "#FFEB00";
const currency = (n: number) => `THB ${n.toFixed(2)}`;
const loadLS = <T,>(k: string, f: T) => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const saveLS = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));

export default function App() {
  const [menu, setMenu] = useState<MenuResponse>({ categories: [], items: [] });
  const [cart, setCart] = useState<CartItem[]>(() => loadLS<CartItem[]>("sbb.cart", []));
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", notes: "" });
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [activeCat, setActiveCat] = useState<string>("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap";
    document.head.appendChild(link);

    (async () => {
      const r = await fetch("/api/ordering/menu").catch(() => fetch("/api/menu"));
      const data: MenuResponse = await r!.json();
      setMenu({
        categories: data.categories,
        items: data.items.sort((a, b) => {
          if (a.categoryId === b.categoryId) return 0;
          return data.categories.findIndex(c => c.id === a.categoryId) - data.categories.findIndex(c => c.id === b.categoryId);
        })
      });
      if (!activeCat && data.categories.length) setActiveCat(data.categories[0].id);
    })();
  }, []);

  useEffect(() => saveLS("sbb.cart", cart), [cart]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
    const serviceFee = 0;
    return { subtotal, serviceFee, total: subtotal + serviceFee };
  }, [cart]);

  useEffect(() => {
    if (!menu.categories.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveCat(visible.target.getAttribute("data-cat-id") || "");
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    menu.categories.forEach(c => {
      const el = sectionRefs.current[c.id];
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [menu.categories]);

  const onTabClick = (id: string) => {
    const el = sectionRefs.current[id];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

  const postOrder = async () => {
    if (!cart.length) return;
    const payload: OrderPayload = {
      customer: { ...customer },
      scheduledAt,
      items: cart.map(ci => ({
        id: ci.item.id, name: ci.item.name, unitPrice: ci.item.price, qty: ci.qty, note: ci.note, categoryId: ci.item.categoryId
      })),
      subtotal: totals.subtotal, serviceFee: totals.serviceFee, total: totals.total, currency: "THB"
    };
    try {
      setSubmitting(true);
      const r = await fetch("/api/ordering/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        .catch(() => fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
      const data = await r!.json();
      if (!r!.ok) throw new Error(data?.error || "Failed");
      setCart([]); alert(`Order received!\nOrder ID: ${data.id}`);
    } catch (e: any) {
      alert(`Could not place the order: ${e.message}`);
    } finally { setSubmitting(false); }
  };

  const itemsByCat = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const c of menu.categories) map[c.id] = [];
    for (const it of menu.items) (map[it.categoryId] ||= []).push(it);
    return map;
  }, [menu]);

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins]">
      {/* HERO / HEADER */}
      <header style={{ background: SBB_YELLOW }} className="w-full">
        <div className="mx-auto w-full max-w-[480px] md:max-w-[700px] px-4 py-8 flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center bg-black/10">
            <img
              src="/images/sbb-logo.png"
              alt="Smash Brothers Burgers"
              className="h-16 w-16 object-contain"
              onLoad={() => setLogoLoaded(true)}
              style={{ opacity: logoLoaded ? 1 : 0.4, transition: "opacity .3s" }}
            />
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight text-black">
            Smash Brothers Burgers
          </h1>
          <p className="mt-1 text-sm md:text-base text-black/80 max-w-[28rem]">
            Traditional American Smash Burgers — 100% Australian beef.
          </p>
        </div>
      </header>

      {/* CATEGORY BAR */}
      <div className="sticky top-0 z-40 border-b border-white/10" style={{ background: "#0A0A0A" }}>
        <nav className="mx-auto w-full max-w-[480px] md:max-w-[700px] px-3 py-2 flex items-center justify-start gap-2 overflow-x-auto">
          {menu.categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onTabClick(cat.id)}
              className="relative px-3 py-2 text-[11px] md:text-xs font-semibold whitespace-nowrap"
            >
              <span className={activeCat === cat.id ? "opacity-100" : "opacity-60"}>
                {cat.name.toUpperCase()}
              </span>
              {activeCat === cat.id && (
                <span className="absolute left-2 right-2 -bottom-[9px] h-[3px] rounded" style={{ background: SBB_YELLOW }} />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* SECTIONS */}
      <main className="mx-auto w-full max-w-[480px] md:max-w-[700px] px-4">
        {menu.categories.map(c => (
          <section
            key={c.id}
            id={c.id}
            data-cat-id={c.id}
            ref={el => (sectionRefs.current[c.id] = el)}
          >
            <h2 className="text-xl md:text-2xl font-bold mt-6">{c.name}</h2>
            <p className="text-sm text-white/70 mt-1">They are worth it!</p>

            <div className="mt-4 divide-y divide-white/10">
              {itemsByCat[c.id]?.map(item => (
                <article key={item.id} className="py-4 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-xs text-white/30">IMG</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold leading-tight text-[15px]">{item.name}</div>
                    <div className="text-sm text-white/70 line-clamp-2">{item.desc || "Delicious menu item"}</div>
                  </div>
                  <div className="pl-2">
                    <button
                      onClick={() => setModalItem(item)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-black"
                      style={{ background: SBB_YELLOW }}
                    >
                      {currency(item.price)} +
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <div className="h-32" />
      </main>

      {/* CART BAR */}
      <div className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto w-full max-w-[480px] md:max-w-[700px] px-4 pb-4">
          <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur p-3 flex items-center gap-3">
            <div className="text-sm flex-1">
              <div className="font-semibold">{cartCount} items</div>
              <div className="text-white/70">Total {currency(totals.total)}</div>
            </div>
            <button
              onClick={() => setModalItem({ id: "__checkout__", categoryId: "", name: "Checkout", desc: "", price: 0 })}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-black"
              style={{ background: SBB_YELLOW }}
            >
              Review & Checkout
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mt-12 mb-6 text-center text-xs text-white/50 pb-24">
        © {new Date().getFullYear()} Smash Brothers Burgers — All rights reserved.
      </footer>

      {/* MODALS */}
      {modalItem && modalItem.id !== "__checkout__" && (
        <ModalAddItem
          item={modalItem}
          onClose={() => setModalItem(null)}
          onAdd={(qty, note) => addToCart(modalItem, qty, note)}
        />
      )}

      {modalItem && modalItem.id === "__checkout__" && (
        <ModalCheckout
          cart={cart}
          totals={totals}
          customer={customer}
          scheduledAt={scheduledAt}
          onCustomerChange={setCustomer}
          onScheduledChange={setScheduledAt}
          onRemove={removeFromCart}
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0A0A0A] border border-white/10 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg">{item.name}</div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>
        
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-full bg-white/10 font-bold">−</button>
          <div className="text-xl font-bold">{qty}</div>
          <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 rounded-full bg-white/10 font-bold">+</button>
          <div className="ml-auto text-xl font-bold">{currency(item.price * qty)}</div>
        </div>

        <div className="text-sm font-semibold mb-2">Add a note (optional)</div>
        <textarea
          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm resize-none"
          placeholder="No onions, extra sauce…"
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
        />

        <div className="h-px bg-white/10 my-4" />

        <button
          onClick={() => onAdd(qty, note || undefined)}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black"
          style={{ background: SBB_YELLOW }}
        >
          Add to cart — {currency(item.price * qty)}
        </button>
      </div>
    </div>
  );
}

function ModalCheckout(props: {
  cart: CartItem[];
  totals: { subtotal: number; serviceFee: number; total: number };
  customer: { name: string; phone: string; notes: string };
  scheduledAt: string | null;
  onCustomerChange: (c: { name: string; phone: string; notes: string }) => void;
  onScheduledChange: (v: string | null) => void;
  onRemove: (id: string, note?: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { cart, totals, customer, scheduledAt, onCustomerChange, onScheduledChange, onRemove, submitting, onClose, onSubmit } = props;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0A0A0A] border border-white/10 rounded-t-3xl md:rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-extrabold text-lg">Your Order</div>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">×</button>
        </div>

        {!cart.length ? (
          <div className="text-white/60 text-sm">Your cart is empty.</div>
        ) : (
          <>
            {cart.map(ci => (
              <div key={ci.item.id + (ci.note || "")} className="flex gap-3 mb-3 py-3 border-b border-white/10">
                <div className="flex-1">
                  <div className="font-semibold">{ci.item.name} <span className="text-white/60 text-sm">×{ci.qty}</span></div>
                  {ci.note && <div className="text-sm text-white/60 mt-1">Note: {ci.note}</div>}
                  <div className="text-sm text-white/60 mt-1">{currency(ci.item.price)} each</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{currency(ci.item.price * ci.qty)}</div>
                  <button onClick={() => onRemove(ci.item.id, ci.note)} className="text-xs text-white/60 hover:text-white mt-2">Remove</button>
                </div>
              </div>
            ))}

            <div className="h-px bg-white/10 my-4" />

            <div className="font-bold text-base mb-3">Your Info</div>
            <div className="space-y-3">
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm"
                placeholder="Name"
                value={customer.name}
                onChange={e => onCustomerChange({ ...customer, name: e.target.value })}
              />
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm"
                placeholder="Phone"
                value={customer.phone}
                onChange={e => onCustomerChange({ ...customer, phone: e.target.value })}
              />
              <textarea
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm resize-none"
                placeholder="Special instructions…"
                value={customer.notes}
                onChange={e => onCustomerChange({ ...customer, notes: e.target.value })}
                rows={3}
              />
              <div>
                <label className="text-sm text-white/60 mb-2 block">Scheduled pickup (optional)</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm"
                  type="datetime-local"
                  value={scheduledAt || ""}
                  onChange={e => onScheduledChange(e.target.value || null)}
                />
              </div>
            </div>

            <div className="h-px bg-white/10 my-4" />

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <div>Subtotal</div>
                <div className="font-bold">{currency(totals.subtotal)}</div>
              </div>
              <div className="flex justify-between text-sm">
                <div>Service Fee</div>
                <div className="font-bold">{currency(totals.serviceFee)}</div>
              </div>
              <div className="flex justify-between text-base font-bold">
                <div>Total</div>
                <div>{currency(totals.total)}</div>
              </div>
            </div>

            <button
              onClick={onSubmit}
              disabled={submitting}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
              style={{ background: SBB_YELLOW }}
            >
              {submitting ? "Placing order…" : `Place Order — ${currency(totals.total)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

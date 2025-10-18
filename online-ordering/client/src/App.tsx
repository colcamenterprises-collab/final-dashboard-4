import React, { useEffect, useMemo, useState } from "react";
import type { Category, MenuItem, CartItem, OrderPayload } from "./types";

type MenuResponse = { categories: Category[]; items: MenuItem[] };

const currency = (n: number) => `THB ${n.toFixed(2)}`;
const loadLS = <T,>(k: string, f: T) => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; }
};
const saveLS = (k: string, v: unknown) => { localStorage.setItem(k, JSON.stringify(v)); };

export default function App() {
  const [menu, setMenu] = useState<MenuResponse>({ categories: [], items: [] });
  const [active, setActive] = useState<string>("");
  const [modalItem, setModalItem] = useState<MenuItem | null>(null);
  const [cart, setCart] = useState<CartItem[]>(() => loadLS<CartItem[]>("sbb.cart", []));
  const [customer, setCustomer] = useState({ name: "", phone: "", notes: "" });
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/ordering/menu");
      const data: MenuResponse = await r.json();
      setMenu(data);
      if (!active && data.categories.length) setActive(data.categories[0].id);
    })();
  }, []);

  useEffect(() => saveLS("sbb.cart", cart), [cart]);

  const itemsInActive = useMemo(
    () => menu.items.filter(i => i.categoryId === active),
    [menu.items, active]
  );

  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
    const serviceFee = 0;
    return { subtotal, serviceFee, total: subtotal + serviceFee };
  }, [cart]);

  const addToCart = (item: MenuItem, qty: number, note?: string) => {
    setCart(prev => {
      const idx = prev.findIndex(ci => ci.item.id === item.id && (ci.note || "") === (note || ""));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
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
        id: ci.item.id,
        name: ci.item.name,
        unitPrice: ci.item.price,
        qty: ci.qty,
        note: ci.note,
        categoryId: ci.item.categoryId
      })),
      subtotal: totals.subtotal,
      serviceFee: totals.serviceFee,
      total: totals.total,
      currency: "THB"
    };

    try {
      setSubmitting(true);
      const r = await fetch("/api/ordering/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Failed");
      setCart([]);
      alert(`Order received!\nOrder ID: ${data.id}`);
    } catch (e: any) {
      alert(`Could not place the order: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wrapper">
      <header className="header">
        <div className="title">Smash Brothers Burgers (Rawai)</div>
        <div className="subtitle">Traditional American Smash Burgers — Opens at 6:00 pm</div>
      </header>

      <nav className="tabs" role="tablist" aria-label="menu categories">
        {menu.categories.map(c => (
          <div
            key={c.id}
            className={`tab ${active === c.id ? "active" : ""}`}
            onClick={() => setActive(c.id)}
            role="tab"
            aria-selected={active === c.id}
          >
            {c.name}
          </div>
        ))}
      </nav>

      <section className="grid" aria-live="polite">
        {itemsInActive.map(item => (
          <article key={item.id} className="card">
            <div className="thumb">
              {item.image ? <img src={item.image} alt="" /> : <span>IMG</span>}
            </div>
            <div className="meta">
              <div className="name">{item.name}</div>
              <div className="desc">{item.desc}</div>
            </div>
            <button className="priceBtn" onClick={() => setModalItem(item)}>
              {currency(item.price)} +
            </button>
          </article>
        ))}
      </section>

      <footer className="footerCart">
        <div className="badge">{cart.reduce((s, c) => s + c.qty, 0)} items</div>
        <div className="badge">Subtotal: {currency(totals.subtotal)}</div>
        <button className="btn" onClick={() => setModalItem({ id: "__checkout__", categoryId: "", name: "Checkout", desc: "", price: 0 })}>
          Review & Checkout
        </button>
      </footer>

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
    <div className="modal" role="dialog" aria-modal="true">
      <div className="sheet">
        <div className="sheetHeader">
          <div style={{ fontWeight: 800 }}>{item.name}</div>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        <div className="qrow">
          <button className="qtyBtn" onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <div className="qty">{qty}</div>
          <button className="qtyBtn" onClick={() => setQty(q => q + 1)}>+</button>
          <div style={{ marginLeft: "auto", fontWeight: 800 }}>{currency(item.price * qty)}</div>
        </div>

        <div className="sectionTitle">Add a note (optional)</div>
        <textarea className="textarea" placeholder="No onions, extra sauce…" value={note} onChange={e => setNote(e.target.value)} />

        <div className="hr"></div>

        <button className="priceBtn" style={{ width: "100%" }} onClick={() => onAdd(qty, note || undefined)}>
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
    <div className="modal" role="dialog" aria-modal="true">
      <div className="sheet">
        <div className="sheetHeader">
          <div style={{ fontWeight: 800 }}>Your Order</div>
          <button className="close" onClick={onClose}>✕</button>
        </div>

        {!cart.length ? (
          <div className="small">Your cart is empty.</div>
        ) : (
          <>
            {cart.map(ci => (
              <div key={ci.item.id + (ci.note || "")} className="card" style={{ marginBottom: 8 }}>
                <div className="meta" style={{ gap: 6 }}>
                  <div className="name">{ci.item.name} <span className="small">×{ci.qty}</span></div>
                  {ci.note && <div className="small">Note: {ci.note}</div>}
                </div>
                <div style={{ fontWeight: 700 }}>{currency(ci.item.price * ci.qty)}</div>
                <button className="close" onClick={() => onRemove(ci.item.id, ci.note)}>✕</button>
              </div>
            ))}

            <div className="hr"></div>

            <div className="sectionTitle">Your Info</div>
            <input className="input" placeholder="Name" value={customer.name} onChange={e => onCustomerChange({ ...customer, name: e.target.value })} />
            <input className="input" style={{ marginTop: 8 }} placeholder="Phone" value={customer.phone} onChange={e => onCustomerChange({ ...customer, phone: e.target.value })} />
            <textarea className="textarea" style={{ marginTop: 8 }} placeholder="Special instructions…" value={customer.notes} onChange={e => onCustomerChange({ ...customer, notes: e.target.value })} />

            <div className="sectionTitle">Scheduled pickup (optional)</div>
            <input className="input" type="datetime-local" value={scheduledAt || ""} onChange={e => onScheduledChange(e.target.value || null)} />

            <div className="hr"></div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span>Subtotal</span>
              <span className="name">{currency(totals.subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="small">Service Fee</span>
              <span className="small">{currency(totals.serviceFee)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 18 }}>
              <span>Total</span>
              <span>{currency(totals.total)}</span>
            </div>

            <div className="hr"></div>

            <button className="priceBtn" style={{ width: "100%" }} onClick={onSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : `Place Order — ${currency(totals.total)}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

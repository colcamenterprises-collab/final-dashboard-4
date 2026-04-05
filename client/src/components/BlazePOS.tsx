import { useMemo, useState } from "react";

type MenuItem = {
  id: string;
  name: string;
  price: number;
};

type CartItem = MenuItem & { qty: number };

type OrderResponse = {
  ok: boolean;
  order?: { id: string; total: number; createdAt: string };
  upsell?: string | null;
  error?: string;
};

const fallbackMenu: MenuItem[] = [
  { id: "classic", name: "Classic Burger", price: 159 },
  { id: "cheese", name: "Cheese Burger", price: 179 },
  { id: "fries", name: "Fries", price: 79 },
  { id: "cola", name: "Cola", price: 45 },
];

export default function BlazePOS() {
  const [menu] = useState<MenuItem[]>(fallbackMenu);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableLabel, setTableLabel] = useState("");
  const [wantsUpsell, setWantsUpsell] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [upsell, setUpsell] = useState<string>("");
  const [lastOrderId, setLastOrderId] = useState<string>("");

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * item.price, 0),
    [cart]
  );

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      if (!exists) return [...prev, { ...item, qty: 1 }];
      return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
    });
  };

  const checkout = async () => {
    if (!cart.length) return;
    setBusy(true);
    setStatus("Submitting order...");
    setUpsell("");

    try {
      const res = await fetch("/api/pos/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableLabel: tableLabel || undefined,
          wantsUpsell,
          paymentMethod: "cash",
          source: "in_store",
          items: cart.map((item) => ({
            itemId: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
          })),
        }),
      });

      const data = (await res.json()) as OrderResponse;
      if (!res.ok || !data.ok || !data.order) {
        throw new Error(data.error || "Checkout failed");
      }

      setStatus(`Order created: ${data.order.id}`);
      setLastOrderId(data.order.id);
      if (data.upsell) setUpsell(data.upsell);
      setCart([]);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>BlazePOS</h2>
      <input
        value={tableLabel}
        onChange={(e) => setTableLabel(e.target.value)}
        placeholder="Table label (optional)"
      />
      <label style={{ marginLeft: 12 }}>
        <input type="checkbox" checked={wantsUpsell} onChange={(e) => setWantsUpsell(e.target.checked)} /> AI upsell
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginTop: 12 }}>
        {menu.map((item) => (
          <button key={item.id} onClick={() => addToCart(item)} style={{ minHeight: 70 }}>
            <div>{item.name}</div>
            <div>{item.price.toFixed(2)}</div>
          </button>
        ))}
      </div>

      <h3>Cart</h3>
      {cart.map((item) => (
        <div key={item.id}>{item.name} x {item.qty} = {(item.qty * item.price).toFixed(2)}</div>
      ))}
      <strong>Total: {total.toFixed(2)}</strong>
      <div>
        <button onClick={checkout} disabled={busy || !cart.length}>Checkout</button>
      </div>
      {status && <p>{status}</p>}
      {upsell && <p>Upsell: {upsell}</p>}
      {lastOrderId && <a href={`/api/pos/receipt/${lastOrderId}`} target="_blank" rel="noreferrer">Open receipt payload</a>}
    </div>
  );
}

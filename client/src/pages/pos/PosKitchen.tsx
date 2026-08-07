import { useEffect, useRef, useState } from "react";

const ageMinutes = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
const displayTicket = (order: any) => {
  const stored = String(order.ticket_number || "");
  if (stored) return stored.slice(0, 3);
  return String(order.order_number || "");
};
const spokenTicket = (ticket: string) => ticket.split("").join(" ");
const speakReady = (ticket: string) => {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(
    `Order ${spokenTicket(ticket)} is ready for collection`,
  );
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
};

const chime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(1040, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Audio is a convenience only. Never block the kitchen display.
  }
};

function orderSource(order: any) {
  const origin = order.pos_origin_channel || order.channel;
  if (order.channel_source === "partner_venue") return "PARTNER DELIVERY";
  if (origin === "qr_table") return order.table_code ? `TABLE ${order.table_code}` : "QR TABLE";
  if (origin === "tablet_counter") return "TABLET COUNTER";
  if (origin === "online" && order.dining_type === "delivery") return "ONLINE DELIVERY";
  if (origin === "online") return "ONLINE PICKUP";
  if (origin === "grab" || order.order_mode === "grab") return "GRAB";
  return "COUNTER";
}

function isCollectionOrder(order: any) {
  return !["delivery", "table"].includes(String(order.dining_type || "").toLowerCase());
}

export default function PosKitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("sbb_kitchen_sound") !== "off");
  const [, tick] = useState(0);
  const knownOrders = useRef<Set<string> | null>(null);

  const load = async () => {
    try {
      const response = await fetch("/api/ordering/kitchen/orders", { credentials: "include", cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.ok) throw Error(body.error || body?.blockers?.[0]?.message || "Could not load kitchen tickets");
      const next = body.data || [];
      const nextIds = new Set<string>(next.map((order: any) => String(order.id)));
      if (knownOrders.current) {
        const hasNewOrder = next.some((order: any) => order.status !== "ready" && !knownOrders.current?.has(String(order.id)));
        if (hasNewOrder && soundEnabled) chime();
      }
      knownOrders.current = nextIds;
      setOrders(next);
      setError("");
    } catch (cause: any) {
      setError(cause.message || "Could not load kitchen tickets");
    }
  };

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 3000);
    const clock = window.setInterval(() => tick((value) => value + 1), 30000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("sbb_kitchen_sound", next ? "on" : "off");
    if (next) chime();
  };

  const updateStatus = async (order: any, status: "ready" | "completed") => {
    try {
      const response = await fetch(`/api/ordering/orders/${order.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, actor: "kitchen" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || body?.blockers?.[0]?.message || "Could not update ticket");
      await load();
      return true;
    } catch (cause: any) {
      setError(cause.message || "Could not update ticket");
      return false;
    }
  };

  const markReady = async (order: any) => {
    if (await updateStatus(order, "ready")) {
      if (isCollectionOrder(order)) speakReady(displayTicket(order));
    }
  };

  const clearAllReady = async () => {
    if (!window.confirm("Clear every ready ticket?")) return;
    try {
      for (const order of ready) {
        const response = await fetch(`/api/ordering/orders/${order.id}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed", actor: "kitchen_bulk_clear" }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || body?.blockers?.[0]?.message || "Could not clear ready tickets");
      }
      await load();
    } catch (cause: any) {
      setError(cause.message || "Could not clear ready tickets");
    }
  };

  const active = orders.filter((order) => order.status !== "ready");
  const ready = orders.filter((order) => order.status === "ready");

  const card = (order: any, isReady: boolean) => {
    const minutes = ageMinutes(order.created_at);
    const urgency = isReady
      ? "border-green-600 bg-green-50"
      : minutes >= 15
        ? "border-red-600 bg-red-50"
        : minutes >= 10
          ? "border-amber-500 bg-amber-50"
          : "border-neutral-300 bg-white";
    const source = orderSource(order);
    const completionLabel = order.dining_type === "delivery"
      ? "Dispatched — clear ticket"
      : order.dining_type === "table"
        ? "Served — clear ticket"
        : "Collected — clear ticket";
    const readyLabel = order.dining_type === "delivery"
      ? "Mark ready for delivery"
      : order.dining_type === "table"
        ? "Mark ready to serve"
        : "Mark ready & call ticket";
    return (
      <article key={order.id} className={`w-[280px] shrink-0 rounded-xl border-2 p-4 shadow-sm ${urgency}`}>
        <div className="flex justify-between gap-2">
          <strong className="text-3xl">{displayTicket(order)}</strong>
          <span className="rounded bg-yellow-100 px-2 py-1 text-right text-[10px] font-bold leading-tight">{source}</span>
        </div>
        {order.customer_name && <p className="mt-2 text-sm font-black text-neutral-800">{order.customer_name}</p>}
        <p className="mt-2 text-sm font-black text-neutral-600">
          {minutes} min · {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
        <ul className="my-4 space-y-3">
          {order.items?.map((item: any) => (
            <li key={item.id}>
              <strong>{item.quantity} × {item.item_name_en}</strong>
              {item.is_set_component && <p className="text-sm font-black text-amber-700">SET COMPONENT</p>}
              {item.modifiers?.map((modifier: any, index: number) => (
                <p key={modifier.id || index} className="text-sm text-green-700">
                  + {modifier.name_en || modifier.modifier_name_en}
                </p>
              ))}
              {item.notes && (
                <p className="mt-1 rounded bg-red-100 px-2 py-1 text-sm font-bold text-red-800">REQUEST: {item.notes}</p>
              )}
            </li>
          ))}
        </ul>
        {isReady ? (
          <button className="w-full rounded bg-neutral-900 p-3 font-bold text-white" onClick={() => updateStatus(order, "completed")}>
            {completionLabel}
          </button>
        ) : (
          <button className="w-full rounded bg-green-600 p-3 font-bold text-white" onClick={() => markReady(order)}>
            {readyLabel}
          </button>
        )}
      </article>
    );
  };

  return (
    <main className="min-h-dvh bg-neutral-100 p-5">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-bold text-yellow-600">SBB POS</p>
          <h1 className="text-3xl font-black">Kitchen tickets</h1>
          <p className="mt-1 text-sm text-neutral-500">Counter, Grab, online pickup, delivery and QR-table orders · live refresh every 3 seconds</p>
        </div>
        <button onClick={toggleSound} className={`rounded-xl px-4 py-3 text-sm font-black ${soundEnabled ? "bg-green-600 text-white" : "bg-white text-neutral-700"}`}>
          New-order sound: {soundEnabled ? "ON" : "OFF"}
        </button>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 font-bold text-red-700">{error}</p>}

      <section>
        <h2 className="mb-3 text-xl font-black">Preparing</h2>
        <div className="flex items-start gap-3 overflow-x-auto pb-5">{active.map((order) => card(order, false))}</div>
        {!active.length && !error && <p className="rounded border bg-white p-6 text-center text-neutral-500">No orders being prepared.</p>}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Ready</h2>
            <p className="text-sm text-neutral-500">Collection, delivery and table orders stay here until handed over or dispatched.</p>
          </div>
          {ready.length > 0 && (
            <button className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700" onClick={clearAllReady}>
              Clear all ready
            </button>
          )}
        </div>
        <div className="flex items-start gap-3 overflow-x-auto pb-5">{ready.map((order) => card(order, true))}</div>
        {!ready.length && <p className="rounded border bg-white p-6 text-center text-neutral-500">No tickets waiting for handoff.</p>}
      </section>
    </main>
  );
}

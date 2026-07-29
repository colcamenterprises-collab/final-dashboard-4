import { useEffect, useState } from "react";

const ageMinutes = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
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

export default function PosKitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [, tick] = useState(0);

  const load = () =>
    fetch("/api/pos/kitchen/orders", { credentials: "include" })
      .then((response) => response.json())
      .then((body) => {
        if (!body.ok) throw Error(body.error);
        setOrders(body.data || []);
        setError("");
      })
      .catch((cause) => setError(cause.message));

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const clock = setInterval(() => tick((value) => value + 1), 30000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, []);

  const updateStatus = async (id: string, status: "ready" | "completed") => {
    const response = await fetch(`/api/pos/orders/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not update ticket");
      return false;
    }
    await load();
    return true;
  };

  const markReady = async (id: string, ticket: string) => {
    if (await updateStatus(id, "ready")) speakReady(ticket);
  };

  const clearAllReady = async () => {
    if (!window.confirm("Clear every ready ticket from the customer display?")) return;
    const response = await fetch("/api/pos/display/clear-ready", {
      method: "POST",
      credentials: "include",
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Could not clear ready tickets");
      return;
    }
    await load();
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
    return (
      <article
        key={order.id}
        className={`w-[280px] shrink-0 rounded-xl border-2 p-4 shadow-sm ${urgency}`}
      >
        <div className="flex justify-between">
          <strong className="text-3xl">{order.ticket_number}</strong>
          <span className="rounded bg-yellow-100 px-2 py-1 text-xs font-bold">
            {order.order_mode}
          </span>
        </div>
        <p className="mt-2 text-sm font-black text-neutral-600">
          {minutes} min ·{" "}
          {new Date(order.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <ul className="my-4 space-y-3">
          {order.items?.map((item: any) => (
            <li key={item.id}>
              <strong>
                {item.quantity} × {item.item_name_en}
              </strong>
              {item.is_set_component && (
                <p className="text-sm font-black text-amber-700">SET COMPONENT</p>
              )}
              {item.modifiers?.map((modifier: any, index: number) => (
                <p key={index} className="text-sm text-green-700">
                  + {modifier.name_en}
                </p>
              ))}
              {item.notes && (
                <p className="mt-1 rounded bg-red-100 px-2 py-1 text-sm font-bold text-red-800">
                  REQUEST: {item.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
        {isReady ? (
          <button
            className="w-full rounded bg-neutral-900 p-3 font-bold text-white"
            onClick={() => updateStatus(order.id, "completed")}
          >
            Collected — clear ticket
          </button>
        ) : (
          <button
            className="w-full rounded bg-green-600 p-3 font-bold text-white"
            onClick={() => markReady(order.id, order.ticket_number)}
          >
            Mark ready & call ticket
          </button>
        )}
      </article>
    );
  };

  return (
    <main className="min-h-dvh bg-neutral-100 p-5">
      <div className="mb-5">
        <p className="font-bold text-yellow-600">SBB POS</p>
        <h1 className="text-3xl font-black">Kitchen tickets</h1>
      </div>
      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}

      <section>
        <h2 className="mb-3 text-xl font-black">Preparing</h2>
        <div className="flex items-start gap-3 overflow-x-auto pb-5">
          {active.map((order) => card(order, false))}
        </div>
        {!active.length && !error && (
          <p className="rounded border bg-white p-6 text-center text-neutral-500">
            No orders being prepared.
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Ready for collection</h2>
            <p className="text-sm text-neutral-500">
              Select Collected when the order is handed over.
            </p>
          </div>
          {ready.length > 0 && (
            <button
              className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700"
              onClick={clearAllReady}
            >
              Clear all ready
            </button>
          )}
        </div>
        <div className="flex items-start gap-3 overflow-x-auto pb-5">
          {ready.map((order) => card(order, true))}
        </div>
        {!ready.length && (
          <p className="rounded border bg-white p-6 text-center text-neutral-500">
            No tickets waiting for collection.
          </p>
        )}
      </section>
    </main>
  );
}

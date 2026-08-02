import { useEffect, useRef, useState } from "react";
import KitchenOrderCard from "@/components/kitchen/KitchenOrderCard";

function playKitchenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    gain.connect(context.destination);
    [880, 1174].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + index * 0.12);
      oscillator.stop(context.currentTime + 0.55 + index * 0.12);
    });
    window.setTimeout(() => void context.close(), 1000);
  } catch {
    // Sound is supplemental; kitchen order loading must never fail because audio is blocked.
  }
}

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("sbb_kds_sound") === "on");
  const knownOrderIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  async function load() {
    try {
      const res = await fetch("/api/ordering/kitchen/orders", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(data));
      const nextOrders = data.data ?? [];
      const nextIds = new Set<string>(nextOrders.map((order: any) => String(order.id)));
      if (initialized.current && soundEnabled) {
        const hasNewOrder = [...nextIds].some((id) => !knownOrderIds.current.has(id));
        if (hasNewOrder) playKitchenChime();
      }
      knownOrderIds.current = nextIds;
      initialized.current = true;
      setOrders(nextOrders);
      setError("");
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleSound() {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem("sbb_kds_sound", next ? "on" : "off");
    if (next) playKitchenChime();
  }

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(id);
  }, [soundEnabled]);

  return <main className="p-4">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-3xl font-bold">Kitchen Display</h1>
      <div className="flex gap-2">
        <button className={`rounded border px-4 py-2 font-semibold ${soundEnabled ? "border-emerald-500 bg-emerald-50 text-emerald-800" : ""}`} onClick={toggleSound}>{soundEnabled ? "Sound On" : "Enable Sound"}</button>
        <button className="rounded border px-4 py-2" onClick={() => void load()}>Refresh</button>
      </div>
    </div>
    {error && <div className="mb-4 rounded border border-red-300 bg-red-50 p-3">{error}</div>}
    <div className="grid gap-4 lg:grid-cols-3">{orders.map((order) => <KitchenOrderCard key={order.id} order={order} onChanged={load} />)}</div>
    {!orders.length && <div className="rounded border p-4">No active kitchen orders.</div>}
  </main>;
}

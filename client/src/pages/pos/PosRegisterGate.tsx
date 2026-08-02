import { useEffect, useState } from "react";
import PosRegister from "./PosRegister";

type Shift = {
  id: string;
  staff_name: string;
  opened_at: string;
  status: string;
};

export default function PosRegisterGate() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadShift = async () => {
    try {
      const response = await fetch("/api/pos-shifts/current", { credentials: "include", cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not verify POS shift");
      setShift(body.data?.shift || null);
      setError("");
    } catch (cause: any) {
      setError(cause.message || "Could not verify POS shift");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadShift();
    const timer = window.setInterval(() => void loadShift(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-[#fffdf4] text-lg font-black">Checking POS shift…</main>;
  }

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#fffdf4] p-5">
        <section className="w-full max-w-lg rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl">
          <p className="text-xs font-black tracking-widest text-red-600">POS UNAVAILABLE</p>
          <h1 className="mt-2 text-3xl font-black">Could not verify the shift</h1>
          <p className="mt-3 text-sm text-zinc-500">{error}</p>
          <button onClick={() => { setLoading(true); void loadShift(); }} className="mt-6 w-full rounded-xl bg-black px-5 py-4 font-black text-white">Retry</button>
        </section>
      </main>
    );
  }

  if (!shift) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#fffdf4] p-5">
        <section className="w-full max-w-lg rounded-3xl border bg-white p-7 text-center shadow-xl">
          <img src="/smash-brothers-logo.png" alt="Smash Brothers Burgers" className="mx-auto h-20 w-20 object-contain" />
          <p className="mt-5 text-xs font-black tracking-widest text-red-600">REGISTER LOCKED</p>
          <h1 className="mt-2 text-3xl font-black">Open a shift before taking orders</h1>
          <p className="mt-3 text-sm text-zinc-500">Sales are blocked at both the register and the server until a cashier shift is open.</p>
          <a href="/pos/shifts" className="mt-7 block w-full rounded-xl bg-[#ffd400] px-5 py-4 text-lg font-black text-black shadow-[0_6px_0_#d7ae00]">Open Shift</a>
          <a href="/dashboard" className="mt-4 block text-sm font-bold text-zinc-500">Back to dashboard</a>
        </section>
      </main>
    );
  }

  return <PosRegister />;
}

import { useEffect, useMemo, useState } from "react";

type Shift = {
  id: string;
  staff_name: string;
  opened_at: string;
  starting_float: number;
  status: "open" | "closed";
  closed_at?: string | null;
  closing_cash?: number | null;
  cash_banked?: number | null;
  expected_cash?: number | null;
  variance?: number | null;
};

type Movement = {
  id: string;
  movement_type: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  created_at: string;
};

const thb = (amount: number) => `฿${Number(amount || 0).toLocaleString("en-AU")}`;

export default function PosShifts() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [history, setHistory] = useState<Shift[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [cashSales, setCashSales] = useState(0);
  const [staffName, setStaffName] = useState("");
  const [startingFloat, setStartingFloat] = useState("2500");
  const [movementType, setMovementType] = useState<"cash_in" | "cash_out">("cash_out");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [cashBanked, setCashBanked] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/pos-shifts/current", { credentials: "include", cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Could not load POS shift");
    setShift(body.data.shift || null);
    setMovements(body.data.movements || []);
    setHistory(body.data.history || []);
    setCashSales(Number(body.data.cashSales || 0));
  };

  useEffect(() => {
    void load().catch((error) => setNotice(error.message));
    const timer = window.setInterval(() => void load().catch(() => undefined), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const movementTotal = useMemo(
    () => movements.reduce((sum, movement) => sum + (movement.movement_type === "cash_in" ? Number(movement.amount) : -Number(movement.amount)), 0),
    [movements],
  );
  const expectedBeforeBanking = Number(shift?.starting_float || 0) + cashSales + movementTotal;
  const expectedAfterBanking = expectedBeforeBanking - Number(cashBanked || 0);
  const previewVariance = closingCash === "" ? null : Number(closingCash) - expectedAfterBanking;

  const run = async (request: () => Promise<Response>, success: string) => {
    setBusy(true);
    try {
      const response = await request();
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      await load();
      setNotice(success);
    } catch (error: any) {
      setNotice(error.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const openShift = () => {
    if (!staffName.trim()) return setNotice("Enter the cashier name");
    return run(
      () => fetch("/api/pos-shifts/open", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_name: staffName.trim(), starting_float: Number(startingFloat) }),
      }),
      "Shift opened. POS is ready.",
    );
  };

  const addMovement = () => {
    if (!shift) return;
    if (Number(movementAmount) <= 0 || !movementReason.trim()) return setNotice("Enter an amount and reason");
    return run(
      () => fetch(`/api/pos-shifts/${shift.id}/movements`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movement_type: movementType, amount: Number(movementAmount), reason: movementReason.trim() }),
      }),
      "Cash movement recorded.",
    ).then(() => {
      setMovementAmount("");
      setMovementReason("");
    });
  };

  const closeShift = () => {
    if (!shift) return;
    if (closingCash === "" || cashBanked === "") return setNotice("Enter closing cash and cash banked");
    return run(
      () => fetch(`/api/pos-shifts/${shift.id}/close`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closing_cash: Number(closingCash), cash_banked: Number(cashBanked) }),
      }),
      "Shift closed and locked.",
    ).then(() => {
      setClosingCash("");
      setCashBanked("");
    });
  };

  return (
    <main className="min-h-dvh bg-[#fffdf4] text-[#171717]">
      <header className="flex h-[70px] items-center justify-between bg-black px-5 text-white">
        <div className="flex items-center gap-3">
          <img src="/smash-brothers-logo.png" alt="Smash Brothers Burgers" className="h-11 w-11 object-contain" />
          <div><h1 className="text-xl font-black">POS Shift</h1><p className="text-xs text-zinc-400">Cash register control</p></div>
        </div>
        <a href="/pos" className="rounded-xl bg-[#ffd400] px-4 py-2 text-sm font-black text-black">Back to POS</a>
      </header>

      {notice && <button type="button" onClick={() => setNotice("")} className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white shadow-xl">{notice} · Close</button>}

      <section className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[1.1fr_.9fr]">
        {!shift ? (
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <p className="text-xs font-black tracking-widest text-red-600">REGISTER LOCKED</p>
            <h2 className="mt-2 text-3xl font-black">Open shift</h2>
            <p className="mt-2 text-sm text-zinc-500">Open the cashier shift before taking orders. The POS backend will reject sales until this is complete.</p>
            <label className="mt-6 block text-sm font-bold">Cashier name<input value={staffName} onChange={(event) => setStaffName(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
            <label className="mt-4 block text-sm font-bold">Starting float<input type="number" min="0" value={startingFloat} onChange={(event) => setStartingFloat(event.target.value)} className="mt-2 w-full rounded-xl border px-4 py-3" /></label>
            <button disabled={busy} onClick={openShift} className="mt-6 w-full rounded-xl bg-[#ffd400] px-5 py-4 text-lg font-black disabled:opacity-50">Open shift</button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="flex justify-between gap-4"><div><p className="text-xs font-black tracking-widest text-emerald-600">SHIFT OPEN — REGISTER ACTIVE</p><h2 className="mt-1 text-2xl font-black">{shift.staff_name}</h2><p className="text-sm text-zinc-500">Opened {new Date(shift.opened_at).toLocaleString()}</p></div><a href="/pos" className="h-fit rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">Go to POS</a></div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold text-zinc-500">Starting float</p><p className="mt-1 text-xl font-black">{thb(shift.starting_float)}</p></div>
                <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold text-zinc-500">Cash sales</p><p className="mt-1 text-xl font-black">{thb(cashSales)}</p></div>
                <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-xs font-bold text-zinc-500">Net movements</p><p className="mt-1 text-xl font-black">{thb(movementTotal)}</p></div>
                <div className="rounded-2xl bg-[#fff8cc] p-4"><p className="text-xs font-bold text-zinc-600">Expected cash now</p><p className="mt-1 text-xl font-black">{thb(expectedBeforeBanking)}</p></div>
              </div>
            </div>
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black">Money in / money out</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3"><select value={movementType} onChange={(event) => setMovementType(event.target.value as "cash_in" | "cash_out")} className="rounded-xl border px-3 py-3"><option value="cash_out">Money out</option><option value="cash_in">Money in</option></select><input type="number" min="0" placeholder="Amount" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} className="rounded-xl border px-3 py-3" /><input placeholder="Reason" value={movementReason} onChange={(event) => setMovementReason(event.target.value)} className="rounded-xl border px-3 py-3" /></div>
              <button disabled={busy} onClick={addMovement} className="mt-3 rounded-xl bg-black px-5 py-3 font-black text-white disabled:opacity-50">Record movement</button>
              <div className="mt-4 divide-y">{movements.map((movement) => <div key={movement.id} className="flex justify-between py-3 text-sm"><span><b>{movement.movement_type === "cash_in" ? "Money in" : "Money out"}</b> · {movement.reason}</span><span className="font-black">{movement.movement_type === "cash_in" ? "+" : "-"}{thb(movement.amount)}</span></div>)}</div>
              <p className="mt-3 text-right text-sm font-bold">Net movement: {thb(movementTotal)}</p>
            </div>
            <div className="rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black">Close shift</h3>
              <p className="mt-1 text-sm text-zinc-500">Expected cash includes starting float + confirmed cash sales + cash movements − cash banked.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Cash physically in register<input type="number" min="0" value={closingCash} onChange={(event) => setClosingCash(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3" /></label><label className="text-sm font-bold">Cash banked<input type="number" min="0" value={cashBanked} onChange={(event) => setCashBanked(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3" /></label></div>
              <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs font-bold text-zinc-500">Expected after banking</p><p className="text-lg font-black">{thb(expectedAfterBanking)}</p></div><div className={`rounded-xl p-3 ${previewVariance === null ? "bg-zinc-50" : Math.abs(previewVariance) <= 30 ? "bg-emerald-50" : "bg-red-50"}`}><p className="text-xs font-bold text-zinc-500">Preview variance</p><p className="text-lg font-black">{previewVariance === null ? "—" : thb(previewVariance)}</p></div></div>
              <button disabled={busy} onClick={closeShift} className="mt-5 w-full rounded-xl bg-red-600 px-5 py-4 text-lg font-black text-white disabled:opacity-50">Close and lock shift</button>
            </div>
          </div>
        )}

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black">Recent shifts</h3>
          <div className="mt-3 divide-y">{history.map((item) => <div key={item.id} className="py-3 text-sm"><div className="flex justify-between"><b>{item.staff_name}</b><span className={item.status === "open" ? "font-black text-emerald-600" : "font-bold text-zinc-500"}>{item.status.toUpperCase()}</span></div><div className="mt-1 flex justify-between text-zinc-500"><span>{new Date(item.opened_at).toLocaleString()}</span><span>{thb(item.starting_float)}</span></div>{item.status === "closed" && <div className="mt-1 flex justify-between text-xs"><span>Closing {thb(Number(item.closing_cash || 0))} · Banked {thb(Number(item.cash_banked || 0))}</span><b>Variance {thb(Number(item.variance || 0))}</b></div>}</div>)}</div>
        </div>
      </section>
    </main>
  );
}

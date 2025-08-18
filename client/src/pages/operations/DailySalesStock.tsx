import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type WageType = "WAGES" | "OVERTIME" | "BONUS" | "REIMBURSEMENT";
type ShoppingRow = { id: string; item: string; cost: number; shop: string };
type WageRow = { id: string; staff: string; amount: number; type: WageType };
type OtherRow = { id: string; label: string; amount: number };

const uid = () => Math.random().toString(36).slice(2, 9);

export default function DailySalesStock() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Log shift parameter once for QA verification
  useEffect(() => {
    const shiftParam = searchParams.get('shift');
    if (shiftParam) {
      console.log('[Form2] Received shift parameter:', shiftParam);
    }
  }, [searchParams]);

  // ---- Shift info ----
  const [completedBy, setCompletedBy] = useState("");
  const [shiftDate, setShiftDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  });
  const submittedAtISO = new Date().toISOString();

  // ---- Cash management (ONLY starting cash) ----
  const [startingCash, setStartingCash] = useState<number>(0);

  // ---- Sales ----
  const [cashSales, setCashSales] = useState<number>(0);
  const [qrSales, setQrSales] = useState<number>(0);
  const [grabSales, setGrabSales] = useState<number>(0);
  const [aroiSales, setAroiSales] = useState<number>(0);
  const totalSales = useMemo(
    () => (cashSales || 0) + (qrSales || 0) + (grabSales || 0) + (aroiSales || 0),
    [cashSales, qrSales, grabSales, aroiSales]
  );

  // ---- Expenses ----
  const [shopping, setShopping] = useState<ShoppingRow[]>([{ id: uid(), item: "", cost: 0, shop: "" }]);
  const addShopping = () => setShopping((s) => [...s, { id: uid(), item: "", cost: 0, shop: "" }]);
  const remShopping = (id: string) => setShopping((s) => (s.length > 1 ? s.filter((r) => r.id !== id) : s));
  const shoppingTotal = useMemo(() => shopping.reduce((sum, r) => sum + (Number(r.cost) || 0), 0), [shopping]);

  const [wages, setWages] = useState<WageRow[]>([{ id: uid(), staff: "", amount: 0, type: "WAGES" }]);
  const addWage = () => setWages((w) => [...w, { id: uid(), staff: "", amount: 0, type: "WAGES" }]);
  const remWage = (id: string) => setWages((w) => (w.length > 1 ? w.filter((r) => r.id !== id) : w));
  const wagesTotal = useMemo(() => wages.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [wages]);

  const [others, setOthers] = useState<OtherRow[]>([{ id: uid(), label: "", amount: 0 }]);
  const addOther = () => setOthers((o) => [...o, { id: uid(), label: "", amount: 0 }]);
  const remOther = (id: string) => setOthers((o) => (o.length > 1 ? o.filter((r) => r.id !== id) : o));
  const othersTotal = useMemo(() => others.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [others]);

  const totalExpenses = useMemo(() => shoppingTotal + wagesTotal, [shoppingTotal, wagesTotal]);

  // ---- Banking (moved here; the only place for these numbers) ----
  const [closingCash, setClosingCash] = useState<number>(0); // a.k.a. ending cash
  const [cashBanked, setCashBanked] = useState<number>(0);
  const [qrTransfer, setQrTransfer] = useState<number>(0);

  // ---- Submit payload ----
  const payload = {
    shiftDate,
    completedBy,
    submittedAtISO,

    cashManagement: {
      startingCash, // ONLY this up front
    },

    sales: { cashSales, qrSales, grabSales, aroiSales, totalSales },

    expenses: {
      shopping, wages, others,
      totals: { shoppingTotal, wagesTotal, othersTotal, totalExpenses },
    },

    banking: {
      closingCash, // will be mirrored to endingCash on server
      cashBanked,
      qrTransfer,
    },
  };

  async function onSubmit() {
    const res = await fetch("/api/forms/daily-sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await res.text();
      alert(`Save failed: ${res.status} ${msg}`);
      return;
    }
    const { salesId } = await res.json();
    localStorage.setItem("currentSalesId", salesId);
    // push to Form 2 when you add it
    // setLocation("/operations/daily-stock?salesId=" + salesId);
    alert("Saved Form 1.");
  }

  const box = "rounded-2xl border bg-white p-5 shadow-sm";
  const label = "text-sm font-medium";
  const input = "mt-1 w-full border rounded-xl px-3 py-2";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Daily Sales & Stock Form</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 border rounded-xl" onClick={() => window.history.back()}>Back</button>
          <button className="px-3 py-2 border rounded-xl bg-emerald-600 text-white" onClick={onSubmit}>Submit</button>
        </div>
      </div>

      {/* Shift info */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-3">Shift Information</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={label}>
            Shift Date
            <input className={input} value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} placeholder="DD/MM/YYYY" />
          </label>
          <label className={label}>
            Completed By
            <input className={input} value={completedBy} onChange={(e) => setCompletedBy(e.target.value)} placeholder="Staff name" />
          </label>
        </div>
        <div className="text-xs text-neutral-500 mt-2">Auto timestamp: {new Date(submittedAtISO).toLocaleString()}</div>
      </div>

      {/* Cash management (ONLY Starting Cash) */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-3">Cash Management</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className={label}>
            Starting Cash (฿)
            <input type="number" className={input} value={startingCash} onChange={(e) => setStartingCash(Number(e.target.value))} />
          </label>
        </div>
      </div>

      {/* Sales */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-3">Sales Information</div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <label className={label}>Cash Sales (฿)
            <input type="number" className={input} value={cashSales} onChange={(e) => setCashSales(Number(e.target.value))} />
          </label>
          <label className={label}>QR Sales (฿)
            <input type="number" className={input} value={qrSales} onChange={(e) => setQrSales(Number(e.target.value))} />
          </label>
          <label className={label}>Grab Sales (฿)
            <input type="number" className={input} value={grabSales} onChange={(e) => setGrabSales(Number(e.target.value))} />
          </label>
          <label className={label}>Aroi Dee Sales (฿)
            <input type="number" className={input} value={aroiSales} onChange={(e) => setAroiSales(Number(e.target.value))} />
          </label>
        </div>
        <div className="mt-3 font-semibold">Total Sales: ฿ {totalSales.toLocaleString()}</div>
      </div>

      {/* Expenses (unchanged) */}
      {/* Shopping */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-4">Expenses</div>

        <div className="mb-4">
          <div className="font-medium mb-2">Shift Expenses</div>
          <div className="space-y-3">
            {shopping.map((row) => (
              <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <label className={`${label} md:col-span-5`}>Item
                  <input className={input} value={row.item} onChange={(e) => setShopping((s) => s.map(r => r.id===row.id ? { ...r, item: e.target.value } : r))} placeholder="e.g., Buns 140pcs" />
                </label>
                <label className={`${label} md:col-span-3`}>Cost (฿)
                  <input type="number" className={input} value={row.cost} onChange={(e) => setShopping((s) => s.map(r => r.id===row.id ? { ...r, cost: Number(e.target.value) } : r))} />
                </label>
                <label className={`${label} md:col-span-3`}>Shop Name
                  <input className={input} value={row.shop} onChange={(e) => setShopping((s) => s.map(r => r.id===row.id ? { ...r, shop: e.target.value } : r))} placeholder="Makro / Lotus" />
                </label>
                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={() => remShopping(row.id)}
                    className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button className="px-3 py-2 border rounded-xl" onClick={addShopping}>+ Add Row</button>
            <div className="font-semibold">Subtotal: ฿ {shoppingTotal.toLocaleString()}</div>
          </div>
        </div>

        {/* Wages */}
        <div className="mb-4">
          <div className="font-medium mb-2">Staff Wages</div>
          <div className="space-y-3">
            {wages.map((row) => (
              <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <label className={`${label} md:col-span-5`}>Staff Name
                  <input className={input} value={row.staff} onChange={(e) => setWages((w) => w.map(r => r.id===row.id ? { ...r, staff: e.target.value } : r))} placeholder="Staff Name" />
                </label>
                <label className={`${label} md:col-span-3`}>Amount (฿)
                  <input type="number" className={input} value={row.amount} onChange={(e) => setWages((w) => w.map(r => r.id===row.id ? { ...r, amount: Number(e.target.value) } : r))} />
                </label>
                <label className={`${label} md:col-span-3`}>Type
                  <select className={input} value={row.type} onChange={(e) => setWages((w) => w.map(r => r.id===row.id ? { ...r, type: e.target.value as WageType } : r))}>
                    <option value="WAGES">Wages</option>
                    <option value="OVERTIME">Overtime</option>
                    <option value="BONUS">Bonus</option>
                    <option value="REIMBURSEMENT">Reimbursement</option>
                  </select>
                </label>
                <div className="md:col-span-1">
                  <button
                    type="button"
                    onClick={() => remWage(row.id)}
                    className="h-9 rounded-lg border border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button className="px-3 py-2 border rounded-xl" onClick={addWage}>+ Add Row</button>
            <div className="font-semibold">Subtotal: ฿ {wagesTotal.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-4 text-right font-bold">Total Expenses: ฿ {totalExpenses.toLocaleString()}</div>
      </div>

      {/* Banking */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-3">Banking</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className={label}>Closing Cash (฿)
            <input type="number" className={input} value={closingCash} onChange={(e) => setClosingCash(Number(e.target.value))} />
          </label>
          <label className={label}>Cash Banked (฿)
            <input type="number" className={input} value={cashBanked} onChange={(e) => setCashBanked(Number(e.target.value))} />
          </label>
          <label className={label}>QR Transfer Amount (฿)
            <input type="number" className={input} value={qrTransfer} onChange={(e) => setQrTransfer(Number(e.target.value))} />
          </label>
        </div>
      </div>
    </div>
  );
}
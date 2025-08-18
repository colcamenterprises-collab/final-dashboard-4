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
  
  // Save state for inline success/error messages
  const [saved, setSaved] = useState<null | "ok" | "err">(null);

  // Always render the form; if shiftId missing, show a small note near the title:
  const shiftId = searchParams.get('shift');
  console.log('[Form2] shift:', shiftId ?? 'none');

  // ---- Shift info ----
  const [completedBy, setCompletedBy] = useState("");
  const [shiftDate, setShiftDate] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  });
  const submittedAtISO = new Date().toISOString();

  // ---- Stock counts ----
  const [burgerBuns, setBurgerBuns] = useState<number>(0);
  const [meatGrams, setMeatGrams] = useState<number>(0);
  const [drinks, setDrinks] = useState<number>(0);
  const [otherRequests, setOtherRequests] = useState<string>("");

  // ---- Submit payload ----
  const payload = {
    shiftDate,
    completedBy,
    submittedAtISO,
    shiftId,
    stock: {
      burgerBuns,
      meatGrams,
      drinks,
      otherRequests,
    },
  };

  async function onSubmit() {
    const res = await fetch("/api/forms/daily-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setSaved("err");
      setTimeout(() => setSaved(null), 4000);
      return;
    }
    const json = await res.json();
    setSaved("ok");
    setTimeout(() => setSaved(null), 4000);
  }

  const box = "rounded-2xl border bg-white p-5 shadow-sm";
  const label = "text-sm font-medium";
  const input = "mt-1 w-full border rounded-xl px-3 py-2";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Daily Stock</h1>
          {!shiftId && (
            <div className="text-sm text-amber-600 mt-1">No shift ID found - form can still be submitted</div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {saved === "ok" && (
            <div className="rounded-md bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">
              Stock & expenses saved
            </div>
          )}
          {saved === "err" && (
            <div className="rounded-md bg-rose-50 text-rose-700 px-3 py-2 text-sm">
              Save failed — please try again
            </div>
          )}
          <div className="flex gap-2">
            <button className="px-3 py-2 border rounded-xl" onClick={() => window.history.back()}>Back</button>
            <button className="px-3 py-2 border rounded-xl bg-emerald-600 text-white" onClick={onSubmit}>Save</button>
          </div>
        </div>
      </div>

      {/* Shift info (readonly) */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-3">Shift Information</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className={label}>
            Shift Date
            <input className={`${input} bg-gray-50`} value={shiftDate} readOnly placeholder="Pulled from Form 1" />
          </label>
          <label className={label}>
            Completed By
            <input className={`${input} bg-gray-50`} value={completedBy} readOnly placeholder="Pulled from Form 1" />
          </label>
        </div>
        <div className="text-xs text-neutral-500 mt-2">Information from Form 1 • {new Date(submittedAtISO).toLocaleString()}</div>
      </div>

      {/* Stock Counts */}
      <div className={`${box} mb-5`}>
        <div className="text-lg font-semibold mb-3">Stock Counts</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <label className={label}>
            Burger Buns (count)
            <input type="number" className={input} value={burgerBuns} onChange={e=>setBurgerBuns(+e.target.value||0)} placeholder="e.g., 50" />
          </label>
          <label className={label}>
            Meat (grams)
            <input type="number" className={input} value={meatGrams} onChange={e=>setMeatGrams(+e.target.value||0)} placeholder="e.g., 2500" />
          </label>
          <label className={label}>
            Drinks (count)
            <input type="number" className={input} value={drinks} onChange={e=>setDrinks(+e.target.value||0)} placeholder="e.g., 24" />
          </label>
          <label className={label}>
            Other Ingredient Purchase Requests
            <textarea className={`${input} min-h-20`} value={otherRequests} onChange={e=>setOtherRequests(e.target.value)} placeholder="List any ingredient requests..." />
          </label>
        </div>
      </div>

      {/* Actions Section */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          {saved === "ok" && (
            <div className="text-emerald-600 font-medium">Stock form saved successfully!</div>
          )}
          {saved === "err" && (
            <div className="text-red-600 font-medium">Error saving stock form. Please try again.</div>
          )}
          {!saved && <div></div>}
          
          <button
            type="button"
            onClick={onSubmit}
            className="h-10 rounded-lg bg-emerald-600 px-6 font-semibold text-white hover:bg-emerald-700"
          >
            Save
          </button>
        </div>
      </div>

    </div>
  );
}
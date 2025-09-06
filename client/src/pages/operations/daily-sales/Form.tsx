// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Form (V2)
// This is the full preserved form (13 sections).

import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";


const FORM2_PATH = "/operations/daily-stock"; // Route to Form 2

// Success Modal Component
function SuccessModal({
  open,
  onClose,
  onGo,
  countdown
}: {
  open: boolean;
  onClose: () => void;
  onGo: () => void;
  countdown: number;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold">Form submitted 🎉</h3>
        <p className="mt-2 text-sm text-gray-600">
          Daily Sales has been saved successfully.
        </p>
        <p className="mt-2 text-sm">
          Continue to <span className="font-medium">Form 2 (Stock)</span> in{" "}
          <span className="font-semibold">{countdown}</span> sec…
        </p>

        <div className="mt-5 flex gap-3">
          <button
            onClick={onGo}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Go to Stock now
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Stay here
          </button>
        </div>
      </div>
    </div>
  );
}

type ShiftExpenseRow = { id: string; item: string; cost: number; shop: string };
type WageRow = { id: string; staff: string; amount: number; type: "WAGES" | "OVERTIME" | "BONUS" | "REIMBURSEMENT" };

const uid = () => Math.random().toString(36).slice(2, 9);

export default function DailySales() {
  const navigate = useNavigate();
  const [completedBy, setCompletedBy] = useState("");
  const [cashStart, setCashStart] = useState(0);
  const [cash, setCash] = useState(0);
  const [qr, setQr] = useState(0);
  const [grab, setGrab] = useState(0);
  const [aroi, setAroi] = useState(0);
  
  // Expenses state
  const [shiftExpenses, setShiftExpenses] = useState<ShiftExpenseRow[]>([{ id: uid(), item: "", cost: 0, shop: "" }]);
  const [staffWages, setStaffWages] = useState<WageRow[]>([{ id: uid(), staff: "", amount: 0, type: "WAGES" }]);
  
  // Banking state
  const [closingCash, setClosingCash] = useState(0);
  const [cashBanked, setCashBanked] = useState(0);
  const [qrTransfer, setQrTransfer] = useState(0);
  
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showSuccess) return;
    setCountdown(4);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          if (shiftId) navigate(`${FORM2_PATH}?shift=${shiftId}`);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [showSuccess, shiftId, navigate]);

  // Restore drafts on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("daily_sales_draft");
      if (raw) {
        const draft = JSON.parse(raw);
        setCompletedBy(draft.completedBy || "");
        setCashStart(draft.cashStart || 0);
        setCash(draft.cash || 0);
        setQr(draft.qr || 0);
        setGrab(draft.grab || 0);
        setAroi(draft.aroi || 0);
      }
    } catch {}
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault(); // allow call from button with no event
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    
    try {
      const formData = {
        completedBy,
        startingCash: cashStart,  // Fix field name mismatch
        cashSales: cash,
        qrSales: qr,
        grabSales: grab,
        aroiSales: aroi,
        totalSales: cash + qr + grab + aroi,
        expenses: shiftExpenses,  // Fix field name mismatch
        wages: staffWages,        // Fix field name mismatch
        closingCash,
        cashBanked,
        qrTransfer,
        shiftDate: new Date().toISOString(),
        status: 'submitted'
      };

      // Always call the canonical endpoint
      const res = await fetch("/api/forms/daily-sales/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json().catch(() => ({} as any));
      console.log("[Form1] submit response:", data);
      
      // Accept any ID shape we might get back
      const shiftId = 
        data?.shiftId ?? 
        data?.salesId ?? // some endpoints return salesId
        data?.id ?? null;
      
      if (!shiftId) {
        console.error("[Form1] Missing shiftId in response:", data);
        // Last resort: still move user to Form 2 (without context)
        window.location.assign(FORM2_PATH);
        return;
      }
      
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || "Submit OK flag missing from response."
        );
      }
      
      // on success -> hard navigation (no alert, no setTimeout)
      const target = `${FORM2_PATH}?shift=${shiftId}`;
      console.log('[Form1] will navigate:', target);
      window.location.assign(target);
    } catch (e: any) {
      console.error("[Form1] submit error:", e);
      setError(e?.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const collectDailySalesValues = () => ({
    completedBy,
    cashStart,
    cash,
    qr,
    grab,
    aroi,
    shiftExpenses,
    staffWages,
    closingCash,
    cashBanked,
    qrTransfer
  });

  const handleSaveDraft = () => {
    const draft = collectDailySalesValues();
    localStorage.setItem("daily_sales_draft", JSON.stringify(draft));
  };

  return (
    <>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Daily Sales & Expenses</h1>
            <p className="text-sm text-gray-600 mt-1">Step 1 of 2 — complete Sales & Expenses, then you'll be redirected to Stock.</p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50"
          >
            Back
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <section className="rounded-xl border bg-white p-5">
            <h3 className="mb-4 text-lg font-semibold">Shift Information</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Shift Date</label>
                <input 
                  type="text"
                  value={new Date().toLocaleDateString()}
                  readOnly
                  className="w-full border rounded-xl px-3 py-2.5 h-10 bg-gray-50" 
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Completed By</label>
                <input 
                  value={completedBy} 
                  onChange={e=>setCompletedBy(e.target.value)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10" 
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Starting Cash (฿)</label>
                <input 
                  type="number" 
                  value={cashStart} 
                  onChange={e=>setCashStart(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10" 
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Auto timestamp: {new Date().toISOString()}</p>
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold mb-4">Sales Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Cash Sales</label>
                <input 
                  type="number" 
                  value={cash} 
                  onChange={e=>setCash(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">QR Sales</label>
                <input 
                  type="number" 
                  value={qr} 
                  onChange={e=>setQr(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Grab Sales</label>
                <input 
                  type="number" 
                  value={grab} 
                  onChange={e=>setGrab(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Aroi Dee Sales</label>
                <input 
                  type="number" 
                  value={aroi} 
                  onChange={e=>setAroi(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
            </div>
            <div className="mt-3 font-semibold text-right">Total Sales: ฿{(cash + qr + grab + aroi).toLocaleString()}</div>
          </section>

          {/* Expenses Section */}
          <section className="rounded-xl border bg-white p-6 mt-6">
            <h3 className="mb-4 text-[14px] font-semibold">Expenses</h3>
            
            {/* Shift Expenses */}
            <div className="mb-8">
              <h4 className="mb-3 text-[14px] font-semibold">Shift Expenses</h4>
              <div className="space-y-4">
                {shiftExpenses.map((row) => (
                  <div key={row.id} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Item</label>
                      <input 
                        className="w-full border rounded-xl px-3 py-2.5 h-10" 
                        value={row.item} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, item: e.target.value } : r))}
                        placeholder="eg: 2 Gas Bottles, 1kg french Fries" 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Cost (฿)</label>
                      <input 
                        type="number" 
                        className="w-full border rounded-xl px-3 py-2.5 h-10" 
                        value={row.cost} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, cost: Number(e.target.value) } : r))} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Shop Name</label>
                      <input 
                        className="w-full border rounded-xl px-3 py-2.5 h-10" 
                        value={row.shop} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, shop: e.target.value } : r))}
                        placeholder="Makro / Lotus" 
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setShiftExpenses(prev => prev.filter(r => r.id !== row.id))}
                        className="h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button 
                  type="button"
                  className="px-3 py-2 border rounded-xl" 
                  onClick={() => setShiftExpenses(prev => [...prev, { id: uid(), item: "", cost: 0, shop: "" }])}
                >
                  + Add Row
                </button>
                <div className="font-semibold">Subtotal: ฿{shiftExpenses.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Staff Wages */}
            <div>
              <h4 className="mb-3 text-[14px] font-semibold">Staff Wages</h4>
              <div className="space-y-4">
                {staffWages.map((row) => (
                  <div key={row.id} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Staff Name</label>
                      <input 
                        className="w-full border rounded-xl px-3 py-2.5 h-10" 
                        value={row.staff} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, staff: e.target.value } : r))}
                        placeholder="Staff Name" 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Amount (฿)</label>
                      <input 
                        type="number" 
                        className="w-full border rounded-xl px-3 py-2.5 h-10" 
                        value={row.amount} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, amount: Number(e.target.value) } : r))} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">Type</label>
                      <select 
                        className="w-full border rounded-xl px-3 py-2.5 h-10" 
                        value={row.type} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, type: e.target.value as any } : r))}
                      >
                        <option value="WAGES">Wages</option>
                        <option value="OVERTIME">Overtime</option>
                        <option value="BONUS">Bonus</option>
                        <option value="REIMBURSEMENT">Reimbursement</option>
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setStaffWages(prev => prev.filter(r => r.id !== row.id))}
                        className="h-10 rounded-lg border border-red-200 bg-red-50 px-3 text-red-700 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button 
                  type="button"
                  className="px-3 py-2 border rounded-xl" 
                  onClick={() => setStaffWages(prev => [...prev, { id: uid(), staff: "", amount: 0, type: "WAGES" }])}
                >
                  + Add Row
                </button>
                <div className="font-semibold">Subtotal: ฿{staffWages.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t text-[14px] text-right font-bold">
              Total Expenses: ฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}
            </div>
          </section>

          {/* Summary Section */}
          <section className="rounded-xl border bg-white p-5">
            <h3 className="mb-4 text-lg font-semibold">Summary</h3>
            <div className="space-y-2 text-lg">
              <div className="flex justify-between">
                <span>Total Sales:</span>
                <span>฿{(cash + qr + grab + aroi).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Expenses:</span>
                <span>฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-xl border-t pt-2">
                <span>Net Position:</span>
                <span className={(cash + qr + grab + aroi) - (shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ฿{((cash + qr + grab + aroi) - (shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0))).toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {/* Banking Section */}
          <section className="rounded-xl border bg-white p-5">
            <h3 className="mb-4 text-lg font-semibold">Banking</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">Closing Cash (฿)</label>
                <input 
                  type="number" 
                  value={closingCash} 
                  onChange={e=>setClosingCash(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Cash Banked (฿)</label>
                <input 
                  type="number" 
                  value={cashBanked} 
                  onChange={e=>setCashBanked(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">QR Transfer Amount (฿)</label>
                <input 
                  type="number" 
                  value={qrTransfer} 
                  onChange={e=>setQrTransfer(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* END-OF-FORM ACTIONS (non-floating) */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="h-10 rounded-lg border border-gray-300 px-4 text-[14px] font-medium text-gray-700 hover:bg-gray-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => submit()}
              className="h-10 rounded-lg bg-emerald-600 px-5 text-[14px] font-semibold text-white hover:bg-emerald-700"
            >
              Next →
            </button>
          </div>

        </form>
      </div>

      <SuccessModal
        open={showSuccess}
        countdown={countdown}
        onClose={() => setShowSuccess(false)}
        onGo={() => shiftId && navigate(`${FORM2_PATH}?shift=${shiftId}`)}
      />
    </>
  );
}
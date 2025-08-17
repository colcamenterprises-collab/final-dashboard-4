import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const FORM2_PATH = "/operations/stock"; // Route to Form 2

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

export default function DailySales() {
  const navigate = useNavigate();
  const [completedBy, setCompletedBy] = useState("");
  const [cashStart, setCashStart] = useState(0);
  const [cash, setCash] = useState(0);
  const [qr, setQr] = useState(0);
  const [grab, setGrab] = useState(0);
  const [aroi, setAroi] = useState(0);
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
          if (shiftId) navigate(`/daily-stock?shift=${shiftId}`);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [showSuccess, shiftId, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission/page reload
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    
    try {
      const formData = {
        completedBy,
        cashStart,
        cashSales: cash,
        qrSales: qr,
        grabSales: grab,
        aroiDeeSales: aroi,
        totalSales: cash + qr + grab + aroi,
        shiftDate: new Date().toISOString(),
        status: 'submitted'
      };

      // Always call the canonical endpoint
      const res = await fetch("/api/daily-sales", {
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
      
      if (!res.ok || !data?.ok || !shiftId) {
        throw new Error(
          data?.error || "Submit OK flag or shiftId missing from response."
        );
      }
      
      // Helpful debugging during development
      const target = `${FORM2_PATH}?shift=${encodeURIComponent(String(shiftId))}`;
      (window as any).__lastNav = target; // dev helper
      console.log("[Form1] will navigate:", target);
      
      // Navigate directly to Form 2 with shift parameter
      navigate(target);
    } catch (e: any) {
      console.error("[Form1] submit error:", e);
      setError(e?.message || "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Daily Sales</h1>
            <p className="text-sm text-gray-600 mt-1">Step 1 of 2 — complete Sales, then you'll be redirected to Stock.</p>
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
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold mb-4">Shift Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <label className="text-sm text-gray-600 block mb-1">Starting Cash</label>
                <input 
                  type="number" 
                  value={cashStart} 
                  onChange={e=>setCashStart(+e.target.value||0)} 
                  className="w-full border rounded-xl px-3 py-2.5 h-10" 
                />
              </div>
            </div>
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
          </section>

          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Submit & Continue"}
            </button>
          </div>
        </form>
      </div>

      <SuccessModal
        open={showSuccess}
        countdown={countdown}
        onClose={() => setShowSuccess(false)}
        onGo={() => shiftId && navigate(`/daily-stock?shift=${shiftId}`)}
      />
    </>
  );
}
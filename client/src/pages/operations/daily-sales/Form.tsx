// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Form (V2)
// This is the full preserved form (13 sections).

import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";


const FORM2_PATH = "/operations/daily-stock"; // Route to Form 2

// EXACT Language labels from consolidated patch (inline, no new file)
const labels = {
  en: { completedBy: 'Completed By', startingCash: 'Starting Cash', cashSales: 'Cash Sales', qrSales: 'QR Sales', grabSales: 'Grab Sales', otherSales: 'Other Sales' },
  th: { completedBy: 'กรอกโดย', startingCash: 'เงินสดเริ่มต้น', cashSales: 'ยอดขายเงินสด', qrSales: 'ยอดขาย QR', grabSales: 'ยอดขาย Grab', otherSales: 'ยอดขายอื่นๆ' }
};

// EXACT LanguageToggle as inline component (NO new file) - styled as toggle switch
const LanguageToggle = ({ onChange }: { onChange: (lang: string) => void }) => {
  const [lang, setLang] = useState('en');
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`text-sm font-medium ${lang === 'en' ? 'text-blue-600' : 'text-gray-500'}`}>EN</span>
      <button 
        className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 ${lang === 'en' ? 'bg-blue-500 border-blue-500' : 'bg-emerald-500 border-emerald-500'}`}
        onClick={() => { const newLang = lang === 'en' ? 'th' : 'en'; setLang(newLang); onChange(newLang); }}
      >
        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${lang === 'en' ? 'left-0' : 'left-6'}`} />
      </button>
      <span className={`text-sm font-medium ${lang === 'th' ? 'text-emerald-600' : 'text-gray-500'}`}>ไทย</span>
    </div>
  );
};

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
  const { id } = useParams();
  const isEditMode = Boolean(id);
  
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
  
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [lang, setLang] = useState<'en' | 'th'>('en');
  const [loading, setLoading] = useState(isEditMode);
  const [originalShiftDate, setOriginalShiftDate] = useState<string | null>(null);

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

  // Load existing form data when editing
  useEffect(() => {
    if (!isEditMode || !id) return;
    
    async function loadFormData() {
      try {
        const response = await fetch(`/api/forms/daily-sales/v2/${id}`);
        const data = await response.json();
        
        if (data.ok && data.record) {
          const p = data.record.payload || {};
          setCompletedBy(data.record.staff || "");
          setCashStart(p.startingCash || 0);
          setCash(p.cashSales || 0);
          setQr(p.qrSales || 0);
          setGrab(p.grabSales || 0);
          setAroi(p.otherSales || 0);
          setClosingCash(p.closingCash || 0);
          
          // Preserve original shift date for editing
          if (data.record.shift_date) {
            setOriginalShiftDate(data.record.shift_date);
          }
          
          // Load expenses
          if (p.shiftExpenses && Array.isArray(p.shiftExpenses)) {
            setShiftExpenses(p.shiftExpenses.map((e: any) => ({
              id: uid(),
              item: e.item || "",
              cost: e.cost || 0,
              shop: e.shop || ""
            })));
          }
          
          // Load wages
          if (p.staffWages && Array.isArray(p.staffWages)) {
            setStaffWages(p.staffWages.map((w: any) => ({
              id: uid(),
              staff: w.staff || "",
              amount: w.amount || 0,
              type: w.type || "WAGES"
            })));
          }
          
          setShiftId(data.record.id);
        } else {
          setError("Failed to load form data");
        }
      } catch (err) {
        setError("Failed to load form");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    loadFormData();
  }, [isEditMode, id]);

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
    
    // EXACT VALIDATION from consolidated patch - prevent Form 2 progression without proper data
    const formData = {
      completedBy,
      startingCash: cashStart,
      cashSales: cash,
      qrSales: qr,
      grabSales: grab,
      otherSales: aroi
    };
    
    const required = ['completedBy', 'startingCash', 'cashSales', 'qrSales', 'grabSales', 'otherSales'];
    const newErrors = required.filter(f => {
      const value = formData[f as keyof typeof formData];
      if (f === 'completedBy') return !value || value.toString().trim() === '';
      return value == null || isNaN(Number(value)) || Number(value) < 0;
    });
    setErrors(newErrors);
    if (newErrors.length) {
      setError(`Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas: ${newErrors.join(', ')}`);
      return; // Block navigation to Form 2
    }
    
    setSubmitting(true);
    setError(null);
    
    try {
      const submitData = {
        completedBy,
        startingCash: cashStart,
        cashSales: cash,
        qrSales: qr,
        grabSales: grab,
        otherSales: aroi,
        totalSales: cash + qr + grab + aroi,
        expenses: shiftExpenses,
        wages: staffWages,
        closingCash,
        shiftDate: isEditMode && originalShiftDate ? originalShiftDate : new Date().toISOString(),
        status: 'submitted'
      };

      // Use update endpoint for edit mode, create endpoint for new forms
      const endpoint = isEditMode ? `/api/forms/daily-sales/v2/${id}` : "/api/forms/daily-sales/v3";
      const method = isEditMode ? "PATCH" : "POST";
      
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      
      const data = await res.json().catch(() => ({} as any));
      console.log("[Form1] submit response:", data);
      
      // CRITICAL FIX: Check success FIRST before navigation
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error || "Submit failed - please check required fields."
        );
      }
      
      // Accept any ID shape we might get back
      const shiftId = 
        data?.shiftId ?? 
        data?.salesId ?? // some endpoints return salesId
        data?.id ?? null;
      
      if (!shiftId) {
        console.error("[Form1] Missing shiftId in response:", data);
        throw new Error("Server error: missing shift ID. Please try again.");
      }
      
      // Invalidate finance cache to refresh home page data
      queryClient.invalidateQueries({ queryKey: ['/api/finance/summary/today'] });
      
      if (isEditMode) {
        // In edit mode, navigate back to library
        setTimeout(() => {
          window.location.assign('/operations/daily-sales-library');
        }, 500);
      } else {
        // Show loading indicator before navigation
        setSubmitting(true);
        
        // Brief delay to show loading state before navigation
        setTimeout(() => {
          const target = `${FORM2_PATH}?shift=${shiftId}`;
          console.log('[Form1] will navigate:', target);
          window.location.assign(target);
        }, 500);
      }
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
    closingCash
  });

  const handleSaveDraft = () => {
    const draft = collectDailySalesValues();
    localStorage.setItem("daily_sales_draft", JSON.stringify(draft));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {isEditMode ? 'Edit Daily Sales & Expenses' : 'Daily Sales & Expenses'}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {isEditMode 
                ? 'Edit and save changes to this form' 
                : 'Step 1 of 2 — complete Sales & Expenses, then you\'ll be redirected to Stock.'}
            </p>
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
          {/* EXACT LanguageToggle from consolidated patch */}
          <LanguageToggle onChange={setLang} />
          
          {/* EXACT error display from consolidated patch */}
          {errors.length > 0 && <p className="text-red-500 text-sm">Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas.</p>}
          
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
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].completedBy}</label>
                <input 
                  placeholder={labels[lang].completedBy}
                  value={completedBy} 
                  onChange={e=>setCompletedBy(e.target.value)} 
                  className={`w-full border rounded-xl px-3 py-2.5 h-10 text-base ${errors.includes('completedBy') ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].startingCash}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].startingCash}
                  value={cashStart} 
                  onChange={e=>setCashStart(+e.target.value||0)} 
                  className={`w-full border rounded-xl px-3 py-2.5 h-10 text-base ${errors.includes('startingCash') ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Auto timestamp: {new Date().toISOString()}</p>
          </section>

          <section className="rounded-2xl border bg-white p-5">
            <h2 className="text-lg font-bold mb-4">Sales Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].cashSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].cashSales}
                  value={cash} 
                  onChange={e=>setCash(+e.target.value||0)} 
                  className={`w-full border rounded-xl px-3 py-2.5 h-10 text-base ${errors.includes('cashSales') ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].qrSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].qrSales}
                  value={qr} 
                  onChange={e=>setQr(+e.target.value||0)} 
                  className={`w-full border rounded-xl px-3 py-2.5 h-10 text-base ${errors.includes('qrSales') ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].grabSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].grabSales}
                  value={grab} 
                  onChange={e=>setGrab(+e.target.value||0)} 
                  className={`w-full border rounded-xl px-3 py-2.5 h-10 text-base ${errors.includes('grabSales') ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].otherSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].otherSales}
                  value={aroi} 
                  onChange={e=>setAroi(+e.target.value||0)} 
                  className={`w-full border rounded-xl px-3 py-2.5 h-10 text-base ${errors.includes('otherSales') ? 'border-red-500' : ''}`}
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
                  className="h-10 px-3 border rounded-xl hover:bg-gray-50" 
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
                  className="h-10 px-3 border rounded-xl hover:bg-gray-50" 
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
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-medium">
                <span>Total Sales:</span>
                <span>฿{(cash + qr + grab + aroi).toLocaleString()}</span>
              </div>
              <div className="ml-4 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>• Cash Sales:</span>
                  <span>฿{cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• QR Sales:</span>
                  <span>฿{qr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Grab Sales:</span>
                  <span>฿{grab.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Other Sales:</span>
                  <span>฿{aroi.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex justify-between font-medium">
                <span>Total Expenses:</span>
                <span>฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}</span>
              </div>
              <div className="ml-4 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>• Shift Expenses:</span>
                  <span>฿{shiftExpenses.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Staff Wages:</span>
                  <span>฿{staffWages.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
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
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-500">Expected Cash to Bank</div>
              <div className="text-right font-semibold">฿{(() => {
                const cashExpenses = shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0);
                const expectedCashBank = Math.max(0, (cashStart + cash) - (closingCash + cashExpenses));
                return expectedCashBank.toLocaleString();
              })()}</div>
              <div className="text-xs text-gray-500">Expected QR to Bank</div>
              <div className="text-right font-semibold">฿{qr.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Expected Total to Bank</div>
              <div className="text-right font-semibold">฿{(() => {
                const cashExpenses = shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0);
                const expectedCashBank = Math.max(0, (cashStart + cash) - (closingCash + cashExpenses));
                const expectedQRBank = qr;
                return (expectedCashBank + expectedQRBank).toLocaleString();
              })()}</div>
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
              disabled={submitting}
            >
              {submitting ? 'Saving...' : (isEditMode ? 'Update Form' : 'Next →')}
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
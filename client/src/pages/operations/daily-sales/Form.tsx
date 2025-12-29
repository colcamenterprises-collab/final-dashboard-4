// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Smash Brothers Burgers — Daily Sales & Stock Form (V2)
// This is the full preserved form (13 sections).

import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { queryClient } from "@/lib/queryClient";


const FORM2_PATH = "/operations/daily-stock"; // Route to Form 2

// EXACT Language labels from consolidated patch (inline, no new file)
const labels = {
  en: {
    pageTitle: 'Daily Sales & Expenses',
    pageTitleEdit: 'Edit Daily Sales & Expenses',
    pageSubtitle: 'Step 1 of 2 — complete Sales & Expenses, then you\'ll be redirected to Stock.',
    pageSubtitleEdit: 'Edit and save changes to this form',
    back: 'Back',
    shiftInfo: 'Shift Information',
    shiftDate: 'Shift Date',
    completedBy: 'Completed By',
    startingCash: 'Starting Cash',
    salesInfo: 'Sales Information',
    cashSales: 'Cash Sales',
    qrSales: 'QR Sales',
    grabSales: 'Grab Sales',
    otherSales: 'Other Sales',
    totalSales: 'Total Sales',
    expenses: 'Expenses',
    shiftExpenses: 'Shift Expenses',
    shiftExpensesHint: 'Do not group together items - Enter each expense separately',
    item: 'Item',
    cost: 'Cost',
    shopName: 'Shop Name',
    delete: 'Delete',
    addRow: '+ Add Row',
    subtotal: 'Subtotal',
    staffWages: 'Staff Wages',
    staffName: 'Staff Name',
    amount: 'Amount',
    type: 'Type',
    wages: 'Wages',
    overtime: 'Overtime',
    bonus: 'Bonus',
    reimbursement: 'Reimbursement',
    totalExpenses: 'Total Expenses',
    cashBanking: 'Cash & Banking',
    closingCash: 'Closing Cash',
    closingCashHint: 'Enter the total amount of cash that remains in the register after all expenses. Include the starting cash (float amount)',
    expectedCashToBank: 'Expected Cash to Bank',
    expectedQrToBank: 'Expected QR to Bank',
    expectedTotalToBank: 'Expected Total to Bank',
    summary: 'Summary',
    netPosition: 'Net Position',
    saveDraft: 'Save draft',
    next: 'Next →',
    updateForm: 'Update Form',
    saving: 'Saving...',
    loading: 'Loading form data...',
    formSubmitted: 'Form submitted 🎉',
    dailySalesSaved: 'Daily Sales has been saved successfully.',
    continueToStock: 'Continue to',
    formStock: 'Form 2 (Stock)',
    inSeconds: 'in',
    seconds: 'sec…',
    goToStock: 'Go to Stock now',
    stayHere: 'Stay here',
    validationError: 'Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas.',
    autoTimestamp: 'Auto timestamp'
  },
  th: {
    pageTitle: 'ยอดขายและค่าใช้จ่ายประจำวัน',
    pageTitleEdit: 'แก้ไขยอดขายและค่าใช้จ่ายประจำวัน',
    pageSubtitle: 'ขั้นตอนที่ 1 จาก 2 — กรอกยอดขายและค่าใช้จ่าย จากนั้นจะไปยังหน้าสต๊อก',
    pageSubtitleEdit: 'แก้ไขและบันทึกการเปลี่ยนแปลงแบบฟอร์มนี้',
    back: 'กลับ',
    shiftInfo: 'ข้อมูลกะ',
    shiftDate: 'วันที่กะ',
    completedBy: 'กรอกโดย',
    startingCash: 'เงินสดเริ่มต้น',
    salesInfo: 'ข้อมูลยอดขาย',
    cashSales: 'ยอดขายเงินสด',
    qrSales: 'ยอดขาย QR',
    grabSales: 'ยอดขาย Grab',
    otherSales: 'ยอดขายอื่นๆ',
    totalSales: 'ยอดขายรวม',
    expenses: 'ค่าใช้จ่าย',
    shiftExpenses: 'ค่าใช้จ่ายกะ',
    shiftExpensesHint: 'ห้ามรวมรายการ - กรอกค่าใช้จ่ายแต่ละรายการแยกกัน',
    item: 'รายการ',
    cost: 'ราคา',
    shopName: 'ชื่อร้าน',
    delete: 'ลบ',
    addRow: '+ เพิ่มแถว',
    subtotal: 'รวมย่อย',
    staffWages: 'ค่าจ้างพนักงาน',
    staffName: 'ชื่อพนักงาน',
    amount: 'จำนวนเงิน',
    type: 'ประเภท',
    wages: 'ค่าจ้าง',
    overtime: 'ล่วงเวลา',
    bonus: 'โบนัส',
    reimbursement: 'เบิกคืน',
    totalExpenses: 'ค่าใช้จ่ายรวม',
    cashBanking: 'เงินสดและธนาคาร',
    closingCash: 'เงินสดปิดยอด',
    closingCashHint: 'ใส่จำนวนเงินสดที่เหลือในลิ้นชักหลังหักค่าใช้จ่าย รวมเงินสดเริ่มต้นด้วย',
    expectedCashToBank: 'เงินสดที่ต้องนำส่งธนาคาร',
    expectedQrToBank: 'ยอด QR ที่ต้องนำส่งธนาคาร',
    expectedTotalToBank: 'ยอดรวมที่ต้องนำส่งธนาคาร',
    summary: 'สรุป',
    netPosition: 'ยอดสุทธิ',
    saveDraft: 'บันทึกร่าง',
    next: 'ถัดไป →',
    updateForm: 'อัปเดตแบบฟอร์ม',
    saving: 'กำลังบันทึก...',
    loading: 'กำลังโหลดข้อมูล...',
    formSubmitted: 'ส่งแบบฟอร์มแล้ว 🎉',
    dailySalesSaved: 'บันทึกยอดขายประจำวันเรียบร้อยแล้ว',
    continueToStock: 'ไปต่อที่',
    formStock: 'แบบฟอร์ม 2 (สต๊อก)',
    inSeconds: 'ใน',
    seconds: 'วินาที…',
    goToStock: 'ไปหน้าสต๊อกเลย',
    stayHere: 'อยู่ที่นี่',
    validationError: 'ไม่สามารถดำเนินการต่อได้: ฟิลด์ไม่ครบ/ไม่ถูกต้อง กรุณาแก้ไขช่องที่ไฮไลท์',
    autoTimestamp: 'บันทึกเวลาอัตโนมัติ'
  }
};

// EXACT LanguageToggle as inline component (NO new file) - styled as toggle switch
const LanguageToggle = ({ onChange }: { onChange: (lang: string) => void }) => {
  const [lang, setLang] = useState('en');
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className={`text-xs font-medium ${lang === 'en' ? 'text-emerald-600' : 'text-slate-600'}`}>EN</span>
      <button 
        className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 ${lang === 'en' ? 'bg-emerald-500 border-emerald-500' : 'bg-emerald-500 border-emerald-500'}`}
        onClick={() => { const newLang = lang === 'en' ? 'th' : 'en'; setLang(newLang); onChange(newLang); }}
      >
        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${lang === 'en' ? 'left-0' : 'left-6'}`} />
      </button>
      <span className={`text-xs font-medium ${lang === 'th' ? 'text-emerald-600' : 'text-slate-600'}`}>ไทย</span>
    </div>
  );
};

// Success Modal Component
function SuccessModal({
  open,
  onClose,
  onGo,
  countdown,
  lang
}: {
  open: boolean;
  onClose: () => void;
  onGo: () => void;
  countdown: number;
  lang: 'en' | 'th';
}) {
  if (!open) return null;
  const L = labels[lang];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-[4px] bg-white p-4 shadow-xl">
        <h3 className="text-sm font-semibold">{L.formSubmitted}</h3>
        <p className="mt-2 text-xs text-slate-600">
          {L.dailySalesSaved}
        </p>
        <p className="mt-2 text-xs">
          {L.continueToStock} <span className="font-medium">{L.formStock}</span> {L.inSeconds}{" "}
          <span className="font-semibold">{countdown}</span> {L.seconds}
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onGo}
            className="inline-flex h-10 items-center justify-center rounded-[4px] bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            {L.goToStock}
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[4px] border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            {L.stayHere}
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
  const [shiftDate, setShiftDate] = useState<string>(new Date().toISOString().split('T')[0]);

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
          
          // Load shift date for editing
          if (data.record.date) {
            // Convert DD/MM/YYYY to YYYY-MM-DD for input[type="date"]
            const parts = data.record.date.split('/');
            if (parts.length === 3) {
              setShiftDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else if (data.record.date.includes('-')) {
              // Already in YYYY-MM-DD format
              setShiftDate(data.record.date);
            }
          }
          
          // Load expenses (API returns "expenses" not "shiftExpenses")
          if (p.expenses && Array.isArray(p.expenses)) {
            setShiftExpenses(p.expenses.map((e: any) => ({
              id: e.id || uid(),
              item: e.item || "",
              cost: e.cost || 0,
              shop: e.shop || ""
            })));
          }
          
          // Load wages (API returns "wages" not "staffWages")
          if (p.wages && Array.isArray(p.wages)) {
            setStaffWages(p.wages.map((w: any) => ({
              id: w.id || uid(),
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

  // Restore drafts on mount (only when NOT in edit mode)
  useEffect(() => {
    if (isEditMode) return; // Don't restore drafts when editing existing form
    
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
  }, [isEditMode]);

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
      // Convert date from YYYY-MM-DD to ISO string
      const dateToSubmit = isEditMode 
        ? new Date(shiftDate + 'T00:00:00').toISOString()
        : new Date().toISOString();
      
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
        shiftDate: dateToSubmit,
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

  // Create a shorthand for current language labels
  const L = labels[lang];

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="bg-white rounded-[4px] shadow p-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-xs text-slate-600">{L.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">
              {isEditMode ? L.pageTitleEdit : L.pageTitle}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {isEditMode ? L.pageSubtitleEdit : L.pageSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="h-10 rounded-[4px] border border-gray-300 px-4 text-sm font-semibold hover:bg-gray-50"
          >
            {L.back}
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-6">
          {/* EXACT LanguageToggle from consolidated patch */}
          <LanguageToggle onChange={setLang} />
          
          {/* EXACT error display from consolidated patch */}
          {errors.length > 0 && <p className="text-red-500 text-sm">{L.validationError}</p>}
          
          <section className="rounded-[4px] border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold">{L.shiftInfo}</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm text-gray-600 block mb-1">{L.shiftDate}</label>
                {isEditMode ? (
                  <input 
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                  />
                ) : (
                  <input 
                    type="text"
                    value={new Date().toLocaleDateString()}
                    readOnly
                    className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm bg-gray-50" 
                  />
                )}
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].completedBy}</label>
                <input 
                  placeholder={labels[lang].completedBy}
                  value={completedBy} 
                  onChange={e=>setCompletedBy(e.target.value)} 
                  className={`w-full border rounded-[4px] px-3 py-2 h-9 text-sm ${errors.includes('completedBy') ? 'border-red-500' : ''}`}
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
                  className={`w-full border rounded-[4px] px-3 py-2 h-9 text-sm ${errors.includes('startingCash') ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">{L.autoTimestamp}: {new Date().toISOString()}</p>
          </section>

          <section className="rounded-[4px] border bg-white p-5">
            <h2 className="text-sm font-bold mb-4">{L.salesInfo}</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">{labels[lang].cashSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].cashSales}
                  value={cash} 
                  onChange={e=>setCash(+e.target.value||0)} 
                  className={`w-full border rounded-[4px] px-3 py-2 h-9 text-sm ${errors.includes('cashSales') ? 'border-red-500' : ''}`}
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
                  className={`w-full border rounded-[4px] px-3 py-2 h-9 text-sm ${errors.includes('qrSales') ? 'border-red-500' : ''}`}
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
                  className={`w-full border rounded-[4px] px-3 py-2 h-9 text-sm ${errors.includes('grabSales') ? 'border-red-500' : ''}`}
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
                  className={`w-full border rounded-[4px] px-3 py-2 h-9 text-sm ${errors.includes('otherSales') ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <div className="mt-3 font-semibold text-right">{L.totalSales}: ฿{(cash + qr + grab + aroi).toLocaleString()}</div>
          </section>

          {/* Expenses Section */}
          <section className="rounded-[4px] border bg-white p-6 mt-6">
            <h3 className="mb-4 text-sm font-semibold">{L.expenses}</h3>
            
            {/* Shift Expenses */}
            <div className="mb-8">
              <h4 className="mb-1 text-sm font-semibold">{L.shiftExpenses}</h4>
              <p className="mb-3 text-xs text-slate-500">{L.shiftExpensesHint}</p>
              <div className="space-y-4">
                {shiftExpenses.map((row) => (
                  <div key={row.id} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{L.item}</label>
                      <input 
                        className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                        value={row.item} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, item: e.target.value } : r))}
                        placeholder="eg: 2 Gas Bottles, 1kg french Fries" 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{L.cost} (฿)</label>
                      <input 
                        type="number" 
                        className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                        value={row.cost} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, cost: Number(e.target.value) } : r))} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{L.shopName}</label>
                      <input 
                        className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                        value={row.shop} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, shop: e.target.value } : r))}
                        placeholder="Makro / Lotus" 
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setShiftExpenses(prev => prev.filter(r => r.id !== row.id))}
                        className="h-9 rounded-[4px] border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100"
                      >
                        {L.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button 
                  type="button"
                  className="h-9 px-3 border rounded-[4px] text-sm hover:bg-gray-50" 
                  onClick={() => setShiftExpenses(prev => [...prev, { id: uid(), item: "", cost: 0, shop: "" }])}
                >
                  {L.addRow}
                </button>
                <div className="font-semibold">{L.subtotal}: ฿{shiftExpenses.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Staff Wages */}
            <div>
              <h4 className="mb-3 text-sm font-semibold">{L.staffWages}</h4>
              <div className="space-y-4">
                {staffWages.map((row) => (
                  <div key={row.id} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{L.staffName}</label>
                      <input 
                        className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                        value={row.staff} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, staff: e.target.value } : r))}
                        placeholder={L.staffName} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{L.amount} (฿)</label>
                      <input 
                        type="number" 
                        className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                        value={row.amount} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, amount: Number(e.target.value) } : r))} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-600 block mb-1">{L.type}</label>
                      <select 
                        className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm" 
                        value={row.type} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, type: e.target.value as any } : r))}
                      >
                        <option value="WAGES">{L.wages}</option>
                        <option value="OVERTIME">{L.overtime}</option>
                        <option value="BONUS">{L.bonus}</option>
                        <option value="REIMBURSEMENT">{L.reimbursement}</option>
                      </select>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setStaffWages(prev => prev.filter(r => r.id !== row.id))}
                        className="h-9 rounded-[4px] border border-red-200 bg-red-50 px-3 text-sm text-red-700 hover:bg-red-100"
                      >
                        {L.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button 
                  type="button"
                  className="h-9 px-3 border rounded-[4px] text-sm hover:bg-gray-50" 
                  onClick={() => setStaffWages(prev => [...prev, { id: uid(), staff: "", amount: 0, type: "WAGES" }])}
                >
                  {L.addRow}
                </button>
                <div className="font-semibold">{L.subtotal}: ฿{staffWages.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t text-sm text-right font-bold">
              {L.totalExpenses}: ฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}
            </div>
          </section>

          {/* Banking Section */}
          <section className="rounded-[4px] border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold">{L.cashBanking}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-gray-600 block mb-1">{L.closingCash} (฿)</label>
                <input 
                  type="number" 
                  value={closingCash} 
                  onChange={e=>setClosingCash(+e.target.value||0)} 
                  className="w-full border rounded-[4px] px-3 py-2 h-9 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">{L.closingCashHint}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 bg-gray-50 p-3 rounded-[4px]">
              <div className="text-xs text-gray-500">{L.expectedCashToBank}</div>
              <div className="text-right font-semibold">฿{(() => {
                const cashExpenses = shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0);
                const expectedCashBank = Math.max(0, (cashStart + cash) - (closingCash + cashExpenses));
                return expectedCashBank.toLocaleString();
              })()}</div>
              <div className="text-xs text-gray-500">{L.expectedQrToBank}</div>
              <div className="text-right font-semibold">฿{qr.toLocaleString()}</div>
              <div className="text-xs text-gray-500">{L.expectedTotalToBank}</div>
              <div className="text-right font-semibold">฿{(() => {
                const cashExpenses = shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0);
                const expectedCashBank = Math.max(0, (cashStart + cash) - (closingCash + cashExpenses));
                const expectedQRBank = qr;
                return (expectedCashBank + expectedQRBank).toLocaleString();
              })()}</div>
            </div>
          </section>

          {/* Summary Section */}
          <section className="rounded-[4px] border bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold">{L.summary}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-medium">
                <span>{L.totalSales}:</span>
                <span>฿{(cash + qr + grab + aroi).toLocaleString()}</span>
              </div>
              <div className="ml-4 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>• {L.cashSales}:</span>
                  <span>฿{cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {L.qrSales}:</span>
                  <span>฿{qr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {L.grabSales}:</span>
                  <span>฿{grab.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {L.otherSales}:</span>
                  <span>฿{aroi.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex justify-between font-medium">
                <span>{L.totalExpenses}:</span>
                <span>฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}</span>
              </div>
              <div className="ml-4 space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>• {L.shiftExpenses}:</span>
                  <span>฿{shiftExpenses.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {L.staffWages}:</span>
                  <span>฿{staffWages.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>{L.netPosition}:</span>
                <span className={(cash + qr + grab + aroi) - (shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ฿{((cash + qr + grab + aroi) - (shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0))).toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-3 rounded-[4px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* END-OF-FORM ACTIONS (non-floating) */}
          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="h-9 rounded-[4px] border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {L.saveDraft}
            </button>
            <button
              type="button"
              onClick={() => submit()}
              className="h-9 rounded-[4px] bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
              disabled={submitting}
            >
              {submitting ? L.saving : (isEditMode ? L.updateForm : L.next)}
            </button>
          </div>

        </form>
      </div>

      <SuccessModal
        open={showSuccess}
        countdown={countdown}
        onClose={() => setShowSuccess(false)}
        onGo={() => shiftId && navigate(`${FORM2_PATH}?shift=${shiftId}`)}
        lang={lang}
      />
    </>
  );
}
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
    // Header
    pageTitle: 'Daily Sales & Expenses',
    pageTitleEdit: 'Edit Daily Sales & Expenses',
    pageSubtitle: 'Step 1 of 2 — complete Sales & Expenses, then you\'ll be redirected to Stock.',
    pageSubtitleEdit: 'Edit and save changes to this form',
    back: 'Back',
    // Sections
    shiftInfo: 'Shift Information',
    expenses: 'Expenses',
    shiftExpenses: 'Shift Expenses',
    staffWages: 'Staff Wages',
    summary: 'Summary',
    banking: 'Banking',
    managerSignOff: 'Manager Sign Off',
    // Fields
    shiftDate: 'Shift Date',
    completedBy: 'Completed By',
    startingCash: 'Starting Cash',
    cashSales: 'Cash Sales',
    qrSales: 'QR Sales',
    grabSales: 'Grab Sales',
    otherSales: 'Other Sales',
    item: 'Item',
    cost: 'Cost (฿)',
    shopName: 'Shop Name',
    staffName: 'Staff Name',
    amount: 'Amount (฿)',
    type: 'Type',
    closingCash: 'Closing Cash (฿)',
    // Summary labels
    totalSales: 'Total Sales:',
    totalExpenses: 'Total Expenses:',
    subtotal: 'Subtotal:',
    netPosition: 'Net Position:',
    // Banking labels
    expectedCashToBank: 'Expected Cash to Bank',
    expectedQRToBank: 'Expected QR to Bank',
    expectedTotalToBank: 'Expected Total to Bank',
    // Manager Sign Off
    netAmountLabel: 'Amount after all expenses (excluding float)',
    registerBalanceQ: 'Does the register balance?',
    expensesReviewQ: 'Manager review of expenses',
    expensesReviewDesc: 'Please confirm that all expenses recorded for this shift match the supporting receipts/transactions. Note any issues or discrepancies.',
    varianceExplain: 'If no, please explain why the register does not balance',
    // Buttons
    delete: 'Delete',
    addRow: '+ Add Row',
    saveDraft: 'Save draft',
    next: 'Next →',
    updateForm: 'Update Form',
    saving: 'Saving...',
    yes: 'Yes',
    no: 'No',
    // Placeholders
    itemPlaceholder: 'eg: 2 Gas Bottles, 1kg french Fries',
    shopPlaceholder: 'Makro / Lotus',
    staffPlaceholder: 'Staff Name',
    variancePlaceholder: 'Explain the variance (cash shortage/overage, missing receipts, etc.)',
    expensesReviewPlaceholder: 'I confirm all expenses match receipts and documentation...',
    // Error messages
    fieldRequired: 'This field is required and must be ≥ 0',
    selectYesNo: 'Please select Yes or No',
    varianceRequired: 'Explanation is required when register does not balance',
    reviewRequired: 'Manager review confirmation is required'
  },
  th: { 
    // Header
    pageTitle: 'ยอดขายและค่าใช้จ่ายประจำวัน',
    pageTitleEdit: 'แก้ไขยอดขายและค่าใช้จ่ายประจำวัน',
    pageSubtitle: 'ขั้นตอน 1 จาก 2 — กรอกยอดขายและค่าใช้จ่าย จากนั้นจะถูกนำไปหน้าสต็อก',
    pageSubtitleEdit: 'แก้ไขและบันทึกการเปลี่ยนแปลงในแบบฟอร์มนี้',
    back: 'กลับ',
    // Sections
    shiftInfo: 'ข้อมูลกะ',
    expenses: 'ค่าใช้จ่าย',
    shiftExpenses: 'ค่าใช้จ่ายกะ',
    staffWages: 'ค่าแรงพนักงาน',
    summary: 'สรุป',
    banking: 'การธนาคาร',
    managerSignOff: 'ผู้จัดการเซ็นรับทราบ',
    // Fields
    shiftDate: 'วันที่กะ',
    completedBy: 'กรอกโดย',
    startingCash: 'เงินสดเริ่มต้น',
    cashSales: 'ยอดขายเงินสด',
    qrSales: 'ยอดขาย QR',
    grabSales: 'ยอดขาย Grab',
    otherSales: 'ยอดขายอื่นๆ',
    item: 'รายการ',
    cost: 'ราคา (฿)',
    shopName: 'ชื่อร้าน',
    staffName: 'ชื่อพนักงาน',
    amount: 'จำนวนเงิน (฿)',
    type: 'ประเภท',
    closingCash: 'เงินสดปิดกะ (฿)',
    // Summary labels
    totalSales: 'ยอดขายรวม:',
    totalExpenses: 'ค่าใช้จ่ายรวม:',
    subtotal: 'รวมย่อย:',
    netPosition: 'สุทธิ:',
    // Banking labels
    expectedCashToBank: 'เงินสดคาดว่าจะฝากธนาคาร',
    expectedQRToBank: 'QR คาดว่าจะฝากธนาคาร',
    expectedTotalToBank: 'รวมคาดว่าจะฝากธนาคาร',
    // Manager Sign Off
    netAmountLabel: 'ยอดเงินหลังหักค่าใช้จ่ายทั้งหมด (ไม่รวมเงินทอน)',
    registerBalanceQ: 'เงินในลิ้นชักสมดุลหรือไม่?',
    expensesReviewQ: 'การตรวจสอบค่าใช้จ่ายของผู้จัดการ',
    expensesReviewDesc: 'กรุณายืนยันว่าค่าใช้จ่ายทั้งหมดที่บันทึกสำหรับกะนี้ตรงกับใบเสร็จ/ธุรกรรมที่สนับสนุน โปรดระบุปัญหาหรือความแตกต่างใดๆ',
    varianceExplain: 'หากไม่สมดุล โปรดอธิบายว่าทำไมเงินในลิ้นชักไม่สมดุล',
    // Buttons
    delete: 'ลบ',
    addRow: '+ เพิ่มแถว',
    saveDraft: 'บันทึกแบบร่าง',
    next: 'ถัดไป →',
    updateForm: 'อัปเดตแบบฟอร์ม',
    saving: 'กำลังบันทึก...',
    yes: 'ใช่',
    no: 'ไม่ใช่',
    // Placeholders
    itemPlaceholder: 'เช่น: แก๊ส 2 ถัง, มันฝรั่งทอด 1kg',
    shopPlaceholder: 'มาโคร / โลตัส',
    staffPlaceholder: 'ชื่อพนักงาน',
    variancePlaceholder: 'อธิบายความแตกต่าง (เงินสดขาด/เกิน, ใบเสร็จหาย ฯลฯ)',
    expensesReviewPlaceholder: 'ข้าพเจ้ายืนยันว่าค่าใช้จ่ายทั้งหมดตรงกับใบเสร็จและเอกสาร...',
    // Error messages
    fieldRequired: 'ต้องระบุฟิลด์นี้และต้อง ≥ 0',
    selectYesNo: 'กรุณาเลือกใช่หรือไม่ใช่',
    varianceRequired: 'ต้องอธิบายเมื่อเงินในลิ้นชักไม่สมดุล',
    reviewRequired: 'ต้องยืนยันการตรวจสอบของผู้จัดการ'
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
      <div className="w-full max-w-md rounded-[4px] bg-white p-4 shadow-xl">
        <h3 className="text-sm font-semibold">Form submitted 🎉</h3>
        <p className="mt-2 text-xs text-slate-600">
          Daily Sales has been saved successfully.
        </p>
        <p className="mt-2 text-xs">
          Continue to <span className="font-medium">Form 2 (Stock)</span> in{" "}
          <span className="font-semibold">{countdown}</span> sec…
        </p>

        <div className="mt-4 flex gap-3">
          <button
            onClick={onGo}
            className="inline-flex h-10 items-center justify-center rounded-[4px] bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Go to Stock now
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-[4px] border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
  
  // Manager Sign Off state
  const [managerNetAmount, setManagerNetAmount] = useState(0);
  const [registerBalances, setRegisterBalances] = useState<boolean | null>(null);
  const [varianceNotes, setVarianceNotes] = useState("");
  const [expensesReview, setExpensesReview] = useState("");
  
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
          
          // Load Manager Sign Off fields
          if (p.managerNetAmount !== undefined) setManagerNetAmount(p.managerNetAmount || 0);
          if (p.registerBalances !== undefined) setRegisterBalances(p.registerBalances);
          if (p.varianceNotes) setVarianceNotes(p.varianceNotes);
          if (p.expensesReview) setExpensesReview(p.expensesReview);
          
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
        if (draft.managerNetAmount !== undefined) setManagerNetAmount(draft.managerNetAmount);
        if (draft.registerBalances !== undefined) setRegisterBalances(draft.registerBalances);
        if (draft.varianceNotes) setVarianceNotes(draft.varianceNotes);
        if (draft.expensesReview) setExpensesReview(draft.expensesReview);
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
    
    // Manager Sign Off validation
    if (managerNetAmount == null || isNaN(Number(managerNetAmount)) || Number(managerNetAmount) < 0) {
      newErrors.push('managerNetAmount');
    }
    if (registerBalances === null) {
      newErrors.push('registerBalances');
    }
    if (registerBalances === false && (!varianceNotes || varianceNotes.trim() === '')) {
      newErrors.push('varianceNotes');
    }
    if (!expensesReview || expensesReview.trim() === '') {
      newErrors.push('expensesReview');
    }
    
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
        status: 'submitted',
        managerNetAmount,
        registerBalances,
        varianceNotes,
        expensesReview
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
    closingCash,
    managerNetAmount,
    registerBalances,
    varianceNotes,
    expensesReview
  });

  const handleSaveDraft = () => {
    const draft = collectDailySalesValues();
    localStorage.setItem("daily_sales_draft", JSON.stringify(draft));
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="bg-white rounded-[4px] shadow p-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-xs text-slate-600">Loading form data...</p>
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
              {isEditMode ? labels[lang].pageTitleEdit : labels[lang].pageTitle}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {isEditMode ? labels[lang].pageSubtitleEdit : labels[lang].pageSubtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="h-10 rounded-[4px] border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50"
          >
            {labels[lang].back}
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          {/* EXACT LanguageToggle from consolidated patch */}
          <LanguageToggle onChange={setLang} />
          
          {/* EXACT error display from consolidated patch */}
          {errors.length > 0 && <p className="text-red-500 text-sm">Cannot proceed: Missing/invalid fields (non-negative required). Correct highlighted areas.</p>}
          
          <section className="rounded-[4px] border bg-white p-4">
            <h3 className="mb-4 text-sm font-semibold">{labels[lang].shiftInfo}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].shiftDate}</label>
                {isEditMode ? (
                  <input 
                    type="date"
                    value={shiftDate}
                    onChange={(e) => setShiftDate(e.target.value)}
                    className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
                  />
                ) : (
                  <input 
                    type="text"
                    value={new Date().toLocaleDateString()}
                    readOnly
                    className="w-full border rounded-[4px] px-3 py-2.5 h-10 bg-gray-50" 
                  />
                )}
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].completedBy}</label>
                <input 
                  placeholder={labels[lang].completedBy}
                  value={completedBy} 
                  onChange={e=>setCompletedBy(e.target.value)} 
                  className={`w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('completedBy') ? 'border-red-500' : ''}`}
                  required
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].startingCash}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].startingCash}
                  value={cashStart} 
                  onChange={e=>setCashStart(+e.target.value||0)} 
                  className={`w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('startingCash') ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-600">Auto timestamp: {new Date().toISOString()}</p>
          </section>

          <section className="rounded-[4px] border bg-white p-4">
            <h2 className="text-sm font-bold mb-4">Sales Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].cashSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].cashSales}
                  value={cash} 
                  onChange={e=>setCash(+e.target.value||0)} 
                  className={`w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('cashSales') ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].qrSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].qrSales}
                  value={qr} 
                  onChange={e=>setQr(+e.target.value||0)} 
                  className={`w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('qrSales') ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].grabSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].grabSales}
                  value={grab} 
                  onChange={e=>setGrab(+e.target.value||0)} 
                  className={`w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('grabSales') ? 'border-red-500' : ''}`}
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].otherSales}</label>
                <input 
                  type="number" 
                  min="0"
                  placeholder={labels[lang].otherSales}
                  value={aroi} 
                  onChange={e=>setAroi(+e.target.value||0)} 
                  className={`w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('otherSales') ? 'border-red-500' : ''}`}
                />
              </div>
            </div>
            <div className="mt-3 font-semibold text-right">{labels[lang].totalSales} ฿{(cash + qr + grab + aroi).toLocaleString()}</div>
          </section>

          {/* Expenses Section */}
          <section className="rounded-[4px] border bg-white p-4 mt-4">
            <h3 className="mb-4 text-sm font-semibold">{labels[lang].expenses}</h3>
            
            {/* Shift Expenses */}
            <div className="mb-4">
              <h4 className="mb-3 text-sm font-semibold">{labels[lang].shiftExpenses}</h4>
              <div className="space-y-4">
                {shiftExpenses.map((row) => (
                  <div key={row.id} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                    <div>
                      <label className="text-sm text-slate-600 block mb-1">{labels[lang].item}</label>
                      <input 
                        className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
                        value={row.item} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, item: e.target.value } : r))}
                        placeholder={labels[lang].itemPlaceholder} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 block mb-1">{labels[lang].cost}</label>
                      <input 
                        type="number" 
                        className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
                        value={row.cost} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, cost: Number(e.target.value) } : r))} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 block mb-1">{labels[lang].shopName}</label>
                      <input 
                        className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
                        value={row.shop} 
                        onChange={(e) => setShiftExpenses(prev => prev.map(r => r.id === row.id ? { ...r, shop: e.target.value } : r))}
                        placeholder={labels[lang].shopPlaceholder} 
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setShiftExpenses(prev => prev.filter(r => r.id !== row.id))}
                        className="h-10 rounded-[4px] border border-red-200 bg-red-50 px-3 text-xs text-red-700 hover:bg-red-100"
                      >
                        {labels[lang].delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button 
                  type="button"
                  className="h-10 px-3 border rounded-[4px] text-xs hover:bg-slate-50" 
                  onClick={() => setShiftExpenses(prev => [...prev, { id: uid(), item: "", cost: 0, shop: "" }])}
                >
                  {labels[lang].addRow}
                </button>
                <div className="font-semibold">{labels[lang].subtotal} ฿{shiftExpenses.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</div>
              </div>
            </div>

            {/* Staff Wages */}
            <div>
              <h4 className="mb-3 text-sm font-semibold">{labels[lang].staffWages}</h4>
              <div className="space-y-4">
                {staffWages.map((row) => (
                  <div key={row.id} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] items-end">
                    <div>
                      <label className="text-sm text-slate-600 block mb-1">{labels[lang].staffName}</label>
                      <input 
                        className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
                        value={row.staff} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, staff: e.target.value } : r))}
                        placeholder={labels[lang].staffPlaceholder} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 block mb-1">{labels[lang].amount}</label>
                      <input 
                        type="number" 
                        className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
                        value={row.amount} 
                        onChange={(e) => setStaffWages(prev => prev.map(r => r.id === row.id ? { ...r, amount: Number(e.target.value) } : r))} 
                      />
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 block mb-1">{labels[lang].type}</label>
                      <select 
                        className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs" 
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
                        className="h-10 rounded-[4px] border border-red-200 bg-red-50 px-3 text-xs text-red-700 hover:bg-red-100"
                      >
                        {labels[lang].delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <button 
                  type="button"
                  className="h-10 px-3 border rounded-[4px] text-xs hover:bg-slate-50" 
                  onClick={() => setStaffWages(prev => [...prev, { id: uid(), staff: "", amount: 0, type: "WAGES" }])}
                >
                  {labels[lang].addRow}
                </button>
                <div className="font-semibold">{labels[lang].subtotal} ฿{staffWages.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t text-sm text-right font-bold">
              {labels[lang].totalExpenses} ฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}
            </div>
          </section>

          {/* Summary Section */}
          <section className="rounded-[4px] border bg-white p-4">
            <h3 className="mb-4 text-sm font-semibold">{labels[lang].summary}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between font-medium">
                <span>{labels[lang].totalSales}</span>
                <span>฿{(cash + qr + grab + aroi).toLocaleString()}</span>
              </div>
              <div className="ml-4 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>• {labels[lang].cashSales}:</span>
                  <span>฿{cash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {labels[lang].qrSales}:</span>
                  <span>฿{qr.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {labels[lang].grabSales}:</span>
                  <span>฿{grab.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {labels[lang].otherSales}:</span>
                  <span>฿{aroi.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="flex justify-between font-medium">
                <span>{labels[lang].totalExpenses}</span>
                <span>฿{(shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)).toLocaleString()}</span>
              </div>
              <div className="ml-4 space-y-1 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>• {labels[lang].shiftExpenses}:</span>
                  <span>฿{shiftExpenses.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• {labels[lang].staffWages}:</span>
                  <span>฿{staffWages.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-xs border-t pt-2">
                <span>{labels[lang].netPosition}</span>
                <span className={(cash + qr + grab + aroi) - (shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0)) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  ฿{((cash + qr + grab + aroi) - (shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0))).toLocaleString()}
                </span>
              </div>
            </div>
          </section>

          {/* Banking Section */}
          <section className="rounded-[4px] border bg-white p-4">
            <h3 className="mb-4 text-sm font-semibold">{labels[lang].banking}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm text-slate-600 block mb-1">{labels[lang].closingCash}</label>
                <input 
                  type="number" 
                  value={closingCash} 
                  onChange={e=>setClosingCash(+e.target.value||0)} 
                  className="w-full border rounded-[4px] px-3 py-2.5 h-10 text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4 bg-gray-50 p-3 rounded-[4px]">
              <div className="text-xs text-slate-600">{labels[lang].expectedCashToBank}</div>
              <div className="text-right font-semibold">฿{(() => {
                const cashExpenses = shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0);
                const expectedCashBank = Math.max(0, (cashStart + cash) - (closingCash + cashExpenses));
                return expectedCashBank.toLocaleString();
              })()}</div>
              <div className="text-xs text-slate-600">{labels[lang].expectedQRToBank}</div>
              <div className="text-right font-semibold">฿{qr.toLocaleString()}</div>
              <div className="text-xs text-slate-600">{labels[lang].expectedTotalToBank}</div>
              <div className="text-right font-semibold">฿{(() => {
                const cashExpenses = shiftExpenses.reduce((sum, r) => sum + r.cost, 0) + staffWages.reduce((sum, r) => sum + r.amount, 0);
                const expectedCashBank = Math.max(0, (cashStart + cash) - (closingCash + cashExpenses));
                const expectedQRBank = qr;
                return (expectedCashBank + expectedQRBank).toLocaleString();
              })()}</div>
            </div>
          </section>

          {/* Manager Sign Off Section */}
          <section className="rounded-[4px] border bg-white p-4 mt-4 border-t-4 border-t-emerald-600">
            <h3 className="mb-4 text-sm font-semibold">{labels[lang].managerSignOff}</h3>
            
            {/* Q1: Amount after all expenses (excluding float) */}
            <div className="mb-5">
              <label className="text-sm text-slate-600 font-medium block mb-2">
                {labels[lang].netAmountLabel} <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">฿</span>
                <input 
                  type="number" 
                  value={managerNetAmount} 
                  onChange={e=>setManagerNetAmount(+e.target.value||0)} 
                  className={`w-full max-w-xs border rounded-[4px] px-3 py-2.5 h-10 text-xs ${errors.includes('managerNetAmount') ? 'border-red-500 bg-red-50' : ''}`}
                  min="0"
                  step="0.01"
                />
              </div>
              {errors.includes('managerNetAmount') && (
                <p className="text-red-500 text-xs mt-1">{labels[lang].fieldRequired}</p>
              )}
            </div>

            {/* Q2: Does the register balance? */}
            <div className="mb-5">
              <label className="text-sm text-slate-600 font-medium block mb-2">
                {labels[lang].registerBalanceQ} <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="registerBalances" 
                    checked={registerBalances === true}
                    onChange={() => setRegisterBalances(true)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs">{labels[lang].yes}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="registerBalances" 
                    checked={registerBalances === false}
                    onChange={() => setRegisterBalances(false)}
                    className="w-4 h-4"
                  />
                  <span className="text-xs">{labels[lang].no}</span>
                </label>
              </div>
              {errors.includes('registerBalances') && (
                <p className="text-red-500 text-xs mb-2">{labels[lang].selectYesNo}</p>
              )}
              
              {registerBalances === false && (
                <div className="mt-3">
                  <label className="text-sm text-slate-600 block mb-2">
                    {labels[lang].varianceExplain} <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    value={varianceNotes}
                    onChange={e => setVarianceNotes(e.target.value)}
                    className={`w-full border rounded-[4px] px-3 py-2.5 min-h-[80px] text-xs ${errors.includes('varianceNotes') ? 'border-red-500 bg-red-50' : ''}`}
                    placeholder={labels[lang].variancePlaceholder}
                  />
                  {errors.includes('varianceNotes') && (
                    <p className="text-red-500 text-xs mt-1">{labels[lang].varianceRequired}</p>
                  )}
                </div>
              )}
            </div>

            {/* Q3: Manager review of expenses */}
            <div className="mb-2">
              <label className="text-sm text-slate-600 font-medium block mb-2">
                {labels[lang].expensesReviewQ} <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-600 mb-2">
                {labels[lang].expensesReviewDesc}
              </p>
              <textarea 
                value={expensesReview}
                onChange={e => setExpensesReview(e.target.value)}
                className={`w-full border rounded-[4px] px-3 py-2.5 min-h-[100px] text-xs ${errors.includes('expensesReview') ? 'border-red-500 bg-red-50' : ''}`}
                placeholder={labels[lang].expensesReviewPlaceholder}
              />
              {errors.includes('expensesReview') && (
                <p className="text-red-500 text-xs mt-1">{labels[lang].reviewRequired}</p>
              )}
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
              className="h-10 rounded-[4px] border border-slate-200 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {labels[lang].saveDraft}
            </button>
            <button
              type="button"
              onClick={() => submit()}
              className="h-10 rounded-[4px] bg-emerald-600 px-5 text-xs font-semibold text-white hover:bg-emerald-700"
              disabled={submitting}
            >
              {submitting ? labels[lang].saving : (isEditMode ? labels[lang].updateForm : labels[lang].next)}
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
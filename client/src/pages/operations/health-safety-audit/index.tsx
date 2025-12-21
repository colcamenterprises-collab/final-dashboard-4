import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";

type Question = {
  id: string;
  section: string;
  label: string;
  labelThai?: string;
  isCritical: boolean;
};

const thaiTranslations: Record<string, { section: string; label: string }> = {
  "Food Storage": { section: "การจัดเก็บอาหาร", label: "" },
  "Temperature Control": { section: "การควบคุมอุณหภูมิ", label: "" },
  "Personal Hygiene": { section: "สุขอนามัยส่วนบุคคล", label: "" },
  "Cleaning & Sanitation": { section: "การทำความสะอาดและฆ่าเชื้อ", label: "" },
  "Pest Control": { section: "การควบคุมสัตว์รบกวน", label: "" },
  "Waste Management": { section: "การจัดการขยะ", label: "" },
  "Equipment Safety": { section: "ความปลอดภัยของอุปกรณ์", label: "" },
  "Fire Safety": { section: "ความปลอดภัยจากอัคคีภัย", label: "" },
};

const questionTranslations: Record<string, string> = {
  "All food stored off floor (min 15cm)": "อาหารทั้งหมดเก็บไว้เหนือพื้น (อย่างน้อย 15 ซม.)",
  "Raw and cooked foods separated": "แยกอาหารดิบและอาหารสุกออกจากกัน",
  "All items labeled with date": "สินค้าทั้งหมดติดฉลากวันที่",
  "FIFO system followed": "ปฏิบัติตามระบบ FIFO (เข้าก่อนออกก่อน)",
  "Fridge temperature 0-5°C": "อุณหภูมิตู้เย็น 0-5°C",
  "Freezer temperature -18°C or below": "อุณหภูมิช่องแช่แข็ง -18°C หรือต่ำกว่า",
  "Hot food held above 63°C": "อาหารร้อนเก็บไว้ที่อุณหภูมิสูงกว่า 63°C",
  "All staff wearing clean uniforms": "พนักงานทุกคนสวมชุดยูนิฟอร์มสะอาด",
  "Hands washed correctly": "ล้างมืออย่างถูกวิธี",
  "No jewelry worn (except wedding band)": "ไม่สวมเครื่องประดับ (ยกเว้นแหวนแต่งงาน)",
  "Hair restrained/covered": "รวบผมหรือสวมหมวกคลุมผม",
  "All surfaces clean and sanitized": "พื้นผิวทั้งหมดสะอาดและผ่านการฆ่าเชื้อ",
  "Cleaning schedule followed": "ปฏิบัติตามตารางการทำความสะอาด",
  "No evidence of pests": "ไม่พบร่องรอยสัตว์รบกวน",
  "Bins emptied and clean": "ถังขยะว่างและสะอาด",
  "All equipment in good working order": "อุปกรณ์ทั้งหมดอยู่ในสภาพใช้งานได้ดี",
  "Fire extinguisher accessible and in-date": "ถังดับเพลิงเข้าถึงได้ง่ายและยังไม่หมดอายุ",
};

export default function HealthSafetyAuditPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [managerName, setManagerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastAuditId, setLastAuditId] = useState<string | null>(null);
  const [showThai, setShowThai] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get("/api/health-safety/questions").then(res => {
      setQuestions(res.data);
    });
  }, []);

  const grouped = questions.reduce<Record<string, Question[]>>((acc, q) => {
    acc[q.section] = acc[q.section] || [];
    acc[q.section].push(q);
    return acc;
  }, {});

  const getTranslatedSection = (section: string) => {
    if (!showThai) return section;
    return thaiTranslations[section]?.section || section;
  };

  const getTranslatedLabel = (label: string) => {
    if (!showThai) return label;
    return questionTranslations[label] || label;
  };

  const submitAudit = async () => {
    if (!managerName.trim()) {
      alert(showThai ? "กรุณากรอกชื่อผู้จัดการ" : "Manager name is required");
      return;
    }

    const items = questions.map(q => ({
      questionId: q.id,
      checked: answers[q.id] ?? false,
      note: notes[q.id] || "",
    }));

    setSubmitting(true);
    try {
      const res = await axios.post("/api/health-safety/audits", {
        managerName,
        items,
      });
      setLastAuditId(res.data.id);
      alert(showThai ? "ส่งรายงานสำเร็จ" : "Audit submitted successfully");
      setAnswers({});
      setNotes({});
      setManagerName("");
    } catch (err) {
      alert(showThai ? "ส่งรายงานไม่สำเร็จ" : "Failed to submit audit");
    }
    setSubmitting(false);
  };

  return (
    <div className="p-3 sm:p-4 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-lg sm:text-xl font-semibold" data-testid="text-page-title">
          {showThai ? "การตรวจสอบสุขภาพและความปลอดภัย" : "Health & Safety Audit"}
        </h1>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">TH</span>
            <Switch
              checked={showThai}
              onCheckedChange={setShowThai}
              data-testid="switch-thai"
            />
          </div>
          <button
            className="border border-slate-200 px-3 py-1.5 rounded-[4px] text-xs hover:bg-slate-50"
            onClick={() => navigate("/operations/health-safety-audit/questions")}
            data-testid="button-manage-questions"
          >
            {showThai ? "จัดการคำถาม" : "Manage Questions"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs text-slate-600 mb-1">
          {showThai ? "ชื่อผู้จัดการ" : "Manager Name"}
        </label>
        <input
          className="w-full border border-slate-200 rounded-[4px] px-3 py-1.5 text-xs"
          value={managerName}
          onChange={e => setManagerName(e.target.value)}
          placeholder={showThai ? "กรอกชื่อผู้จัดการ" : "Enter manager name"}
          data-testid="input-manager-name"
        />
      </div>

      {Object.entries(grouped).map(([section, qs]) => (
        <div key={section} className="mb-6">
          <h2 className="text-sm font-medium mb-2 text-slate-700" data-testid={`text-section-${section.replace(/\s+/g, '-').toLowerCase()}`}>
            {getTranslatedSection(section)}
          </h2>

          {/* Desktop Table View */}
          <div className="hidden sm:block border border-slate-200 rounded-[4px] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="p-2 text-left font-medium text-slate-600 w-16">
                    {showThai ? "หัวข้อ" : "Title"}
                  </th>
                  <th className="p-2 text-left font-medium text-slate-600">
                    {showThai ? "รายละเอียด" : "Description"}
                  </th>
                  <th className="p-2 text-left font-medium text-slate-600 w-32">
                    {showThai ? "หมายเหตุ" : "Notes"}
                  </th>
                  <th className="p-2 text-center font-medium text-slate-600 w-16">
                    {showThai ? "ตรวจสอบ" : "Check"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {qs.map((q, idx) => (
                  <tr 
                    key={q.id} 
                    className={`border-t border-slate-200 ${q.isCritical ? "bg-red-50" : ""}`}
                    data-testid={`row-question-${q.id}`}
                  >
                    <td className="p-2 text-slate-700 align-top">
                      <span className={q.isCritical ? "text-red-600 font-medium" : ""}>
                        {idx + 1}
                        {q.isCritical && <span className="ml-0.5 text-red-500">*</span>}
                      </span>
                    </td>
                    <td className="p-2 text-slate-600 align-top">
                      {getTranslatedLabel(q.label)}
                    </td>
                    <td className="p-2 align-top">
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded px-1.5 py-1 text-xs"
                        placeholder={showThai ? "เพิ่มหมายเหตุ..." : "Add note..."}
                        value={notes[q.id] || ""}
                        onChange={e => setNotes(n => ({ ...n, [q.id]: e.target.value }))}
                        data-testid={`input-note-${q.id}`}
                      />
                    </td>
                    <td className="p-2 text-center align-top">
                      <input
                        type="checkbox"
                        className="w-5 h-5 accent-emerald-600 cursor-pointer"
                        checked={answers[q.id] || false}
                        onChange={e =>
                          setAnswers(a => ({
                            ...a,
                            [q.id]: e.target.checked,
                          }))
                        }
                        data-testid={`checkbox-question-${q.id}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-2">
            {qs.map((q, idx) => (
              <div
                key={q.id}
                className={`border border-slate-200 rounded-[4px] p-3 ${q.isCritical ? "bg-red-50 border-red-300" : "bg-white"}`}
                data-testid={`card-question-${q.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium mb-1 ${q.isCritical ? "text-red-600" : "text-slate-700"}`}>
                      {showThai ? "ข้อ" : "Item"} {idx + 1}
                      {q.isCritical && <span className="ml-1 text-red-500">*</span>}
                    </div>
                    <p className="text-xs text-slate-600 break-words">
                      {getTranslatedLabel(q.label)}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    className="w-6 h-6 accent-emerald-600 cursor-pointer flex-shrink-0 mt-1"
                    checked={answers[q.id] || false}
                    onChange={e =>
                      setAnswers(a => ({
                        ...a,
                        [q.id]: e.target.checked,
                      }))
                    }
                    data-testid={`checkbox-question-mobile-${q.id}`}
                  />
                </div>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs mt-1"
                  placeholder={showThai ? "เพิ่มหมายเหตุ..." : "Add note..."}
                  value={notes[q.id] || ""}
                  onChange={e => setNotes(n => ({ ...n, [q.id]: e.target.value }))}
                  data-testid={`input-note-mobile-${q.id}`}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        disabled={submitting}
        onClick={submitAudit}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-[4px] text-xs font-medium disabled:opacity-50"
        data-testid="button-submit-audit"
      >
        {submitting 
          ? (showThai ? "กำลังส่ง..." : "Submitting...") 
          : (showThai ? "ส่งรายงาน" : "Submit Audit")}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          className="border border-slate-200 py-2 rounded-[4px] text-xs hover:bg-slate-50"
          onClick={() => window.print()}
          data-testid="button-print"
        >
          {showThai ? "พิมพ์" : "Print"}
        </button>

        <button
          className="border border-slate-200 py-2 rounded-[4px] text-xs hover:bg-slate-50"
          onClick={() => {
            if (!lastAuditId) {
              alert(showThai ? "กรุณาส่งรายงานก่อน" : "Submit audit first");
              return;
            }
            window.open(`/api/health-safety/pdf/${lastAuditId}`, "_blank");
          }}
          data-testid="button-download-pdf"
        >
          {showThai ? "ดาวน์โหลด PDF" : "Download PDF"}
        </button>
      </div>
    </div>
  );
}

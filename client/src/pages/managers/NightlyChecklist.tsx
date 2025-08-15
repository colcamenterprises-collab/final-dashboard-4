import { useEffect, useMemo, useRef, useState } from "react";

type Draw = { dateISO:string; questionIds:string[] };
type Q = { id:string; text:string; area?:string };

export default function ManagerChecklistPage(){
  const [loading, setLoading] = useState(true);
  const [draw, setDraw] = useState<Draw|null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, {value:boolean; note?:string}>>({});
  const [managerName, setManagerName] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const attesterPhotoUrlRef = useRef<string|undefined>(undefined);

  const selectedQuestions = useMemo(()=> {
    if (!draw) return [];
    const ids = new Set(draw.questionIds);
    return questions.filter(q=>ids.has(q.id));
  }, [draw, questions]);

  useEffect(()=> {
    (async ()=> {
      const today = new Date().toISOString().split('T')[0];
      const d = await fetch(`/api/manager-checklist/nightly?date=${today}&count=5`).then(r=>r.json());
      setDraw(d);
      const qs = await fetch(`/api/manager-checklist/questions`).then(r=>r.json());
      setQuestions(qs.rows || []);
      setLoading(false);
    })();
  }, []);

  async function handleStartViaGate() {
    // If you used the random pop-up/photo gate, pass the photo URL here
    // For now, we try to fetch a temporary from session (optional)
    try {
      const r = await fetch("/api/tmp/attester-photo"); // optional endpoint if you saved it
      if (r.ok) { const { url } = await r.json(); attesterPhotoUrlRef.current = url; }
    } catch {}
  }

  async function submit() {
    if (!managerName.trim()) { alert("Enter manager name"); return; }
    
    const payload = {
      dateISO: draw?.dateISO,
      managerName,
      attesterPhotoUrl: attesterPhotoUrlRef.current,
      shiftNotes,
      answers: selectedQuestions.map(q => ({
        questionId: q.id,
        value: !!answers[q.id]?.value,
        note: answers[q.id]?.note || ""
      }))
    };
    const r = await fetch("/api/manager-checklist/submit", {
      method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
    });
    if (r.ok) {
      alert("Submitted. ขอบคุณครับ/ค่ะ");
      window.location.href = "/dashboard";
    } else {
      alert("Submit failed");
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Manager Checklist — {draw?.dateISO}</h1>
      <p className="text-sm text-gray-600 mt-1">
        5 randomized items per night. Answer honestly. Shift notes are anonymous.
      </p>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Manager Name</label>
          <input className="mt-1 w-full rounded-lg border p-2" value={managerName} onChange={e=>setManagerName(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Date</label>
          <input className="mt-1 w-full rounded-lg border p-2" value={draw?.dateISO || ""} readOnly />
        </div>
      </div>

      <button className="mt-4 text-xs text-emerald-700 underline" onClick={handleStartViaGate}>
        (If camera gate used, bind photo now)
      </button>

      <div className="mt-6 space-y-4">
        {selectedQuestions.map((q,idx)=> (
          <div key={q.id} className="rounded-xl border p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-wide text-gray-500">{q.area || "General"}</div>
                <div className="font-medium text-gray-900 mt-1">{idx+1}. {q.text}</div>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1 text-sm">
                  <input type="radio" name={`ans-${q.id}`} onChange={()=>setAnswers(a=>({...a,[q.id]:{...a[q.id],value:true}}))} />
                  Yes
                </label>
                <label className="inline-flex items-center gap-1 text-sm">
                  <input type="radio" name={`ans-${q.id}`} onChange={()=>setAnswers(a=>({...a,[q.id]:{...a[q.id],value:false}}))} />
                  No
                </label>
              </div>
            </div>
            <textarea
              className="mt-3 w-full rounded-lg border p-2 text-sm"
              placeholder="Note (optional)…"
              value={answers[q.id]?.note || ""}
              onChange={e=>setAnswers(a=>({...a,[q.id]:{...a[q.id],note:e.target.value}}))}
            />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <label className="text-sm font-medium">Anonymous Shift Notes (optional)</label>
        <textarea
          className="mt-1 w-full rounded-lg border p-3"
          rows={4}
          placeholder="Anything the owner should know (anonymous)…"
          value={shiftNotes}
          onChange={(e)=>setShiftNotes(e.target.value)}
        />
      </div>

      <div className="mt-6 flex justify-end">
        <button className="rounded-xl bg-emerald-600 text-white px-5 py-2" onClick={submit}>Submit</button>
      </div>
    </div>
  );
}
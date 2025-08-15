import { useEffect, useMemo, useState } from "react";

type Role = "kitchen" | "cashier";
type Item = { taskId:string; text:string; requiresPhoto?:boolean; requiresNote?:boolean };

export default function NightlyChecklist(){
  const [dateISO, setDateISO] = useState<string>(new Date().toLocaleDateString("sv-SE")); // YYYY-MM-DD
  const [role, setRole] = useState<Role>("kitchen");
  const [managerName, setManagerName] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<string, {done:boolean; note?:string; photoUrl?:string}>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function fetchChecklist(){
    setLoading(true);
    try{
      const r = await fetch(`/api/manager/checklist?date=${dateISO}&role=${role}`);
      const data = await r.json();
      setItems(data.items);
      // reset answers
      const init: any = {};
      data.items.forEach((it:Item)=> init[it.taskId] = { done:false });
      setAnswers(init);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ fetchChecklist(); /* eslint-disable-next-line */ },[dateISO, role]);

  async function uploadPhoto(taskId: string, file: File){
    const fd = new FormData();
    fd.append("image", file);
    const r = await fetch("/api/upload/image", { method:"POST", body:fd });
    if(!r.ok) { alert("Upload failed"); return; }
    const { url } = await r.json();
    setAnswers(a => ({ ...a, [taskId]: { ...(a[taskId]||{}), photoUrl: url }}));
  }

  async function submit(){
    if (!managerName.trim()) { alert("Enter manager name"); return; }
    setSaving(true);
    try{
      const payload = {
        dateISO, role, managerName,
        items: items.map(it => ({
          taskId: it.taskId,
          text: it.text,
          done: !!answers[it.taskId]?.done,
          note: answers[it.taskId]?.note,
          photoUrl: answers[it.taskId]?.photoUrl
        }))
      };
      const r = await fetch("/api/manager/checklist/submit", {
        method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)
      });
      const data = await r.json();
      if(!r.ok || !data.ok) throw new Error("Submit failed");
      alert("Submitted. Nice work. ✅");
    } catch (e:any){
      alert(e.message || "Failed");
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Nightly Checklist</h1>
        <div className="flex gap-2">
          <input type="date" value={dateISO} onChange={e=>setDateISO(e.target.value)} className="border rounded-lg px-3 py-2"/>
          <select value={role} onChange={e=>setRole(e.target.value as Role)} className="border rounded-lg px-3 py-2">
            <option value="kitchen">Kitchen</option>
            <option value="cashier">Cashier</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm text-gray-600">Manager Name</label>
            <input value={managerName} onChange={e=>setManagerName(e.target.value)} className="w-full border rounded-lg px-3 py-2"/>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-500">Loading checklist…</div>
        ) : (
          <ul className="space-y-4">
            {items.map((it, idx)=>(
              <li key={it.taskId} className="rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 w-5 h-5 accent-emerald-600"
                    checked={!!answers[it.taskId]?.done}
                    onChange={e=>setAnswers(a=>({ ...a, [it.taskId]: { ...(a[it.taskId]||{}), done: e.target.checked }}))}
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{idx+1}. {it.text}</div>

                    {it.requiresNote && (
                      <div className="mt-2">
                        <textarea
                          placeholder="Note"
                          value={answers[it.taskId]?.note || ""}
                          onChange={e=>setAnswers(a=>({ ...a, [it.taskId]: { ...(a[it.taskId]||{}), note: e.target.value }}))}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                    )}

                    {it.requiresPhoto && (
                      <div className="mt-3 flex items-center gap-3">
                        <label className="px-3 py-2 rounded-lg bg-emerald-600 text-white cursor-pointer">
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadPhoto(it.taskId, f); }}
                          />
                          Upload Photo
                        </label>
                        {answers[it.taskId]?.photoUrl && (
                          <img src={answers[it.taskId]?.photoUrl} className="w-16 h-16 rounded-lg object-cover border" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={submit}
            disabled={saving || loading}
            className="px-5 py-2 rounded-xl bg-emerald-600 text-white disabled:opacity-50"
          >
            {saving ? "Submitting…" : "Submit Checklist"}
          </button>
        </div>
      </div>
    </div>
  );
}
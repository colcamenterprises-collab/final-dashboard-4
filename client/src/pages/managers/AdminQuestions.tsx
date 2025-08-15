import { useEffect, useState } from "react";

type Question = { id:string; text:string; area?:string; active:boolean };

export default function AdminQuestionsPage(){
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [newArea, setNewArea] = useState("Kitchen");

  async function fetchQuestions(){
    const r = await fetch("/api/manager-checklist/questions");
    const data = await r.json();
    setQuestions(data.rows || []);
    setLoading(false);
  }

  useEffect(()=>{ fetchQuestions(); },[]);

  async function addQuestion(){
    if(!newText.trim()) return;
    await fetch("/api/manager-checklist/questions", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ text: newText, area: newArea, active: true })
    });
    setNewText("");
    fetchQuestions();
  }

  async function toggleActive(id:string, active:boolean){
    await fetch("/api/manager-checklist/questions", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, active })
    });
    fetchQuestions();
  }

  async function deleteQuestion(id:string){
    if(!confirm("Delete this question?")) return;
    await fetch(`/api/manager-checklist/questions/${id}`, { method:"DELETE" });
    fetchQuestions();
  }

  if(loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Admin: Manage Checklist Questions</h1>
      
      <div className="rounded-xl border bg-white p-5 mb-6">
        <h2 className="font-bold mb-4">Add New Question</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="rounded-lg border p-2"
            placeholder="Question text…"
            value={newText}
            onChange={e=>setNewText(e.target.value)}
          />
          <select
            className="rounded-lg border p-2"
            value={newArea}
            onChange={e=>setNewArea(e.target.value)}
          >
            <option value="Kitchen">Kitchen</option>
            <option value="Cashier">Cashier</option>
            <option value="Front">Front</option>
            <option value="General">General</option>
          </select>
          <button
            onClick={addQuestion}
            className="rounded-lg bg-emerald-600 text-white px-4 py-2"
          >
            Add Question
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map(q=>(
          <div key={q.id} className={`rounded-xl border p-4 ${q.active ? 'bg-white' : 'bg-gray-50'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm uppercase tracking-wide text-gray-500">{q.area || "General"}</div>
                <div className={`font-medium mt-1 ${q.active ? 'text-gray-900' : 'text-gray-500'}`}>
                  {q.text}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={()=>toggleActive(q.id, !q.active)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    q.active 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {q.active ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={()=>deleteQuestion(q.id)}
                  className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type Question = {
  id: string;
  section: string;
  label: string;
  isCritical: boolean;
  isActive: boolean;
  sortOrder: number;
};

type EditingState = {
  [key: string]: {
    section: string;
    label: string;
  };
};

export default function HealthSafetyQuestionManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editing, setEditing] = useState<EditingState>({});
  const [saving, setSaving] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    const res = await axios.get("/api/health-safety/questions/all");
    setQuestions(res.data);
    const editState: EditingState = {};
    res.data.forEach((q: Question) => {
      editState[q.id] = { section: q.section, label: q.label };
    });
    setEditing(editState);
  };

  useEffect(() => {
    load();
  }, []);

  const handleFieldChange = (id: string, field: 'section' | 'label', value: string) => {
    setEditing(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const saveField = async (id: string, field: 'section' | 'label') => {
    const value = editing[id]?.[field];
    if (value === undefined) return;
    
    const question = questions.find(q => q.id === id);
    if (!question || question[field] === value) return;

    setSaving(id);
    try {
      await axios.put(`/api/health-safety/questions/${id}`, { [field]: value });
      setQuestions(prev => prev.map(q => 
        q.id === id ? { ...q, [field]: value } : q
      ));
    } catch (err) {
      alert("Failed to save changes");
      setEditing(prev => ({
        ...prev,
        [id]: { ...prev[id], [field]: question[field] }
      }));
    }
    setSaving(null);
  };

  const updateToggle = async (id: string, data: Partial<Question>) => {
    setSaving(id);
    try {
      await axios.put(`/api/health-safety/questions/${id}`, data);
      setQuestions(prev => prev.map(q => 
        q.id === id ? { ...q, ...data } : q
      ));
    } catch (err) {
      alert("Failed to update");
    }
    setSaving(null);
  };

  const create = async () => {
    try {
      const res = await axios.post("/api/health-safety/questions", {
        section: "New Section",
        label: "New question",
        isCritical: false,
        sortOrder: questions.length,
      });
      const newQ = res.data;
      setQuestions(prev => [...prev, newQ]);
      setEditing(prev => ({
        ...prev,
        [newQ.id]: { section: newQ.section, label: newQ.label }
      }));
    } catch (err) {
      alert("Failed to create question");
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">
          Health & Safety Questions
        </h1>
        <button
          className="border border-slate-200 px-3 py-1.5 rounded-[4px] text-xs hover:bg-slate-50"
          onClick={() => navigate("/operations/health-safety-audit")}
          data-testid="button-back-to-audit"
        >
          Back to Audit
        </button>
      </div>

      <button
        className="border border-slate-200 px-3 py-1.5 rounded-[4px] mb-4 text-xs hover:bg-slate-50"
        onClick={create}
        data-testid="button-add-question"
      >
        Add Question
      </button>

      <div className="border border-slate-200 rounded-[4px] overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left font-medium text-slate-600">Section</th>
              <th className="p-2 text-left font-medium text-slate-600">Description</th>
              <th className="p-2 text-center font-medium text-slate-600 w-20">Critical</th>
              <th className="p-2 text-center font-medium text-slate-600 w-20">Active</th>
            </tr>
          </thead>
          <tbody>
            {questions.map(q => (
              <tr key={q.id} className={`border-t border-slate-200 ${saving === q.id ? 'opacity-50' : ''}`}>
                <td className="p-2">
                  <input
                    className="border border-slate-200 p-1.5 w-full rounded-[4px] text-xs"
                    value={editing[q.id]?.section ?? q.section}
                    onChange={e => handleFieldChange(q.id, 'section', e.target.value)}
                    onBlur={() => saveField(q.id, 'section')}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    data-testid={`input-section-${q.id}`}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border border-slate-200 p-1.5 w-full rounded-[4px] text-xs"
                    value={editing[q.id]?.label ?? q.label}
                    onChange={e => handleFieldChange(q.id, 'label', e.target.value)}
                    onBlur={() => saveField(q.id, 'label')}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    data-testid={`input-label-${q.id}`}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-red-600 cursor-pointer"
                    checked={q.isCritical}
                    onChange={e => updateToggle(q.id, { isCritical: e.target.checked })}
                    data-testid={`checkbox-critical-${q.id}`}
                  />
                </td>
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-emerald-600 cursor-pointer"
                    checked={q.isActive}
                    onChange={e => updateToggle(q.id, { isActive: e.target.checked })}
                    data-testid={`checkbox-active-${q.id}`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500 mt-3">
        Changes to section and description are saved when you click away or press Enter.
      </p>
    </div>
  );
}

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

export default function HealthSafetyQuestionManager() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    const res = await axios.get("/api/health-safety/questions/all");
    setQuestions(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, data: Partial<Question>) => {
    await axios.put(`/api/health-safety/questions/${id}`, data);
    load();
  };

  const create = async () => {
    await axios.post("/api/health-safety/questions", {
      section: "New Section",
      label: "New question",
      isCritical: false,
      sortOrder: questions.length,
    });
    load();
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">
          Health & Safety Questions
        </h1>
        <button
          className="border px-3 py-2 rounded text-sm"
          onClick={() => navigate("/operations/health-safety-audit")}
          data-testid="button-back-to-audit"
        >
          Back to Audit
        </button>
      </div>

      <button
        className="border px-3 py-2 rounded mb-4 text-sm"
        onClick={create}
        data-testid="button-add-question"
      >
        Add Question
      </button>

      <table className="w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Section</th>
            <th className="p-2 text-left">Description</th>
            <th className="p-2 text-center">Critical</th>
            <th className="p-2 text-center">Active</th>
          </tr>
        </thead>
        <tbody>
          {questions.map(q => (
            <tr key={q.id} className="border-t">
              <td className="p-2">
                <input
                  className="border p-1 w-full rounded"
                  value={q.section}
                  onChange={e =>
                    update(q.id, { section: e.target.value })
                  }
                  data-testid={`input-section-${q.id}`}
                />
              </td>
              <td className="p-2">
                <input
                  className="border p-1 w-full rounded"
                  value={q.label}
                  onChange={e =>
                    update(q.id, { label: e.target.value })
                  }
                  data-testid={`input-label-${q.id}`}
                />
              </td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={q.isCritical}
                  onChange={e =>
                    update(q.id, { isCritical: e.target.checked })
                  }
                  data-testid={`checkbox-critical-${q.id}`}
                />
              </td>
              <td className="p-2 text-center">
                <input
                  type="checkbox"
                  checked={q.isActive}
                  onChange={e =>
                    update(q.id, { isActive: e.target.checked })
                  }
                  data-testid={`checkbox-active-${q.id}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

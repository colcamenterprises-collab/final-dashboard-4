import { useEffect, useState } from "react";
import axios from "axios";

type Question = {
  id: string;
  section: string;
  label: string;
  isCritical: boolean;
};

export default function HealthSafetyAuditPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [managerName, setManagerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const submitAudit = async () => {
    if (!managerName.trim()) {
      alert("Manager name is required");
      return;
    }

    const items = questions.map(q => ({
      questionId: q.id,
      checked: answers[q.id] ?? false,
    }));

    setSubmitting(true);
    await axios.post("/api/health-safety/audits", {
      managerName,
      items,
    });
    setSubmitting(false);

    alert("Audit submitted successfully");
    setAnswers({});
    setManagerName("");
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-2" data-testid="text-page-title">Daily Health & Safety Audit</h1>

      <div className="mb-4">
        <label className="block text-sm mb-1">Manager Name</label>
        <input
          className="w-full border rounded px-3 py-2"
          value={managerName}
          onChange={e => setManagerName(e.target.value)}
          data-testid="input-manager-name"
        />
      </div>

      {Object.entries(grouped).map(([section, qs]) => (
        <div key={section} className="mb-6">
          <h2 className="font-semibold mb-2" data-testid={`text-section-${section.replace(/\s+/g, '-').toLowerCase()}`}>{section}</h2>

          <div className="space-y-2">
            {qs.map(q => (
              <label
                key={q.id}
                className={`flex items-start gap-3 p-3 border rounded ${
                  q.isCritical ? "border-red-400" : ""
                }`}
                data-testid={`label-question-${q.id}`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={answers[q.id] || false}
                  onChange={e =>
                    setAnswers(a => ({
                      ...a,
                      [q.id]: e.target.checked,
                    }))
                  }
                  data-testid={`checkbox-question-${q.id}`}
                />
                <span>{q.label}</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button
        disabled={submitting}
        onClick={submitAudit}
        className="w-full bg-black text-white py-3 rounded"
        data-testid="button-submit-audit"
      >
        {submitting ? "Submitting..." : "Submit Audit"}
      </button>
    </div>
  );
}

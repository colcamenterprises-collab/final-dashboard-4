import React, { useEffect, useState } from 'react';

type Question = { id:number; text:string; category?:string|null };
type Props = {
  salesId: number;
  onDone: (result: {status: 'COMPLETED'|'SKIPPED'|'UNAVAILABLE'}) => void;
  onCancel: () => void;
};

export default function ManagerQuickCheck({ salesId, onDone, onCancel }: Props) {
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);
  const [status, setStatus] = useState<'PENDING'|'UNAVAILABLE'|'COMPLETED'|'SKIPPED'>('PENDING');
  const [dailyCheckId, setDailyCheckId] = useState<number| null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, {response:string; note?:string}>>({});
  const [answeredBy, setAnsweredBy] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [skipReason, setSkipReason] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/manager-check/questions?salesId=${salesId}`);
        const data = await r.json();
        setRequired(!!data.required);
        setStatus(data.status);
        setDailyCheckId(data.dailyCheckId ?? null);
        setQuestions(data.questions ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [salesId]);

  const setAns = (qid:number, field:'response'|'note', val:string) => {
    setAnswers(p => ({ ...p, [qid]: { ...p[qid], [field]: val } }));
  };

  const submit = async () => {
    if (!dailyCheckId) return;
    const payload = {
      dailyCheckId,
      answeredBy,
      managerPin: managerPin || undefined,
      answers: Object.entries(answers).map(([qid, v]) => ({
        questionId: Number(qid), response: v.response || null, note: v.note || null
      }))
    };
    const r = await fetch('/api/manager-check/submit', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (data.ok) onDone({ status: 'COMPLETED' });
  };

  const skip = async () => {
    if (!skipReason.trim()) return;
    const r = await fetch('/api/manager-check/skip', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ salesId, reason: skipReason })
    });
    const data = await r.json();
    if (data.ok) onDone({ status: 'SKIPPED' });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6">
        <div className="text-xl font-semibold mb-2">Manager Quick Check</div>

        {loading ? (
          <div>Loading…</div>
        ) : status === 'UNAVAILABLE' ? (
          <div className="space-y-4">
            <div className="p-3 bg-yellow-100 rounded">Checklist unavailable. Submission will be allowed but flagged.</div>
            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 rounded border" onClick={() => onDone({ status: 'UNAVAILABLE' })}>Continue</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4">
              {questions.map(q => (
                <div key={q.id} className="border rounded-xl p-3">
                  <div className="font-medium">{q.text}</div>
                  <div className="mt-2 flex gap-3">
                    {['PASS','FAIL','NA'].map(opt => (
                      <label key={opt} className="flex items-center gap-2">
                        <input type="radio" name={`q-${q.id}`}
                               onChange={() => setAns(q.id, 'response', opt)}
                               checked={answers[q.id]?.response === opt}/>
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                  <textarea className="mt-2 w-full border rounded p-2"
                            placeholder="Note (optional)"
                            value={answers[q.id]?.note ?? ''}
                            onChange={(e) => setAns(q.id, 'note', e.target.value)} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="border rounded p-2" placeholder="Manager name (required)"
                     value={answeredBy} onChange={(e)=>setAnsweredBy(e.target.value)} />
              <input className="border rounded p-2" placeholder="Manager PIN (optional)"
                     value={managerPin} onChange={(e)=>setManagerPin(e.target.value)} />
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                <button 
                  className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                  onClick={onCancel}
                >
                  Cancel
                </button>
                <details className="inline-block">
                  <summary className="px-4 py-2 rounded bg-red-200 hover:bg-red-300 cursor-pointer">
                    Skip
                  </summary>
                  <div className="absolute mt-2 p-3 bg-white border rounded shadow-lg">
                    <textarea 
                      className="w-64 h-20 border rounded p-2"
                      placeholder="Reason for skipping (required)"
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                    />
                    <div className="mt-2">
                      <button 
                        className="px-3 py-1 rounded bg-red-500 text-white"
                        onClick={skip}
                        disabled={!skipReason.trim()}
                      >
                        Confirm Skip
                      </button>
                    </div>
                  </div>
                </details>
              </div>
              <button 
                className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={submit}
                disabled={!answeredBy || Object.keys(answers).length === 0}
              >
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
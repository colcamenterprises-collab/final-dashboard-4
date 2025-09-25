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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <div className="text-2xl md:text-3xl font-semibold mb-6 text-center">Manager Quick Check</div>

        {loading ? (
          <div className="text-center text-lg py-8">Loading…</div>
        ) : status === 'UNAVAILABLE' ? (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-100 rounded-lg text-center text-lg">Checklist unavailable. Submission will be allowed but flagged.</div>
            <div className="flex justify-center">
              <button className="px-8 py-4 text-lg rounded-lg border-2 bg-gray-100 hover:bg-gray-200 min-h-[48px]" 
                      onClick={() => onDone({ status: 'UNAVAILABLE' })}>Continue</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6">
              {questions.map(q => (
                <div key={q.id} className="border-2 rounded-xl p-4 md:p-6 bg-gray-50">
                  <div className="font-semibold text-lg md:text-xl mb-4">{q.text}</div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {['PASS','FAIL','NA'].map(opt => (
                      <label key={opt} className="flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-100 min-h-[56px]"
                             style={{ backgroundColor: answers[q.id]?.response === opt ? '#e3f2fd' : 'white' }}>
                        <input type="radio" name={`q-${q.id}`}
                               className="w-5 h-5"
                               onChange={() => setAns(q.id, 'response', opt)}
                               checked={answers[q.id]?.response === opt}/>
                        <span className="text-lg font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                  <textarea className="w-full border-2 rounded-lg p-4 text-lg min-h-[80px]"
                            placeholder="Note (optional)"
                            value={answers[q.id]?.note ?? ''}
                            onChange={(e) => setAns(q.id, 'note', e.target.value)} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="border-2 rounded-lg p-4 text-lg min-h-[56px]" placeholder="Manager name (required)"
                     value={answeredBy} onChange={(e)=>setAnsweredBy(e.target.value)} />
              <input className="border-2 rounded-lg p-4 text-lg min-h-[56px]" placeholder="Manager PIN (optional)"
                     value={managerPin} onChange={(e)=>setManagerPin(e.target.value)} />
            </div>

            <div className="space-y-4">
              <div className="text-base md:text-lg text-gray-600 text-center p-4 bg-blue-50 rounded-lg">
                {required ? 'Checklist is required before final submit.' : 'Checklist is recommended. You can skip with a reason.'}
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                {!required && (
                  <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <input className="border-2 rounded-lg p-4 text-lg min-h-[56px] md:min-w-[300px]" 
                           placeholder="Skip reason (required to skip)"
                           value={skipReason} onChange={(e)=>setSkipReason(e.target.value)} />
                    <button className="px-6 py-4 text-lg border-2 rounded-lg bg-red-100 hover:bg-red-200 min-h-[56px] min-w-[120px]" 
                            onClick={skip}
                            disabled={!skipReason.trim()}>Skip</button>
                  </div>
                )}
                <button className="px-6 py-4 text-lg border-2 rounded-lg bg-gray-100 hover:bg-gray-200 min-h-[56px] min-w-[120px]" 
                        onClick={onCancel}>Cancel</button>
                <button className="px-8 py-4 text-lg rounded-lg bg-black text-white hover:bg-gray-800 min-h-[56px] min-w-[160px] font-semibold"
                        onClick={submit}
                        disabled={required && (!answeredBy || questions.some(q => !answers[q.id]?.response))}>
                  Submit Check
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
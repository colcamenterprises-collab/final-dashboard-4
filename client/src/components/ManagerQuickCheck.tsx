import React, { useEffect, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';

type Question = { id:number; text:string; category?:string|null };
type Props = {
  salesId: number;
  onDone: (result: {status: 'COMPLETED'|'SKIPPED'|'UNAVAILABLE'}) => void;
  onCancel: () => void;
};

export default function ManagerQuickCheck({ salesId, onDone, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);
  const [status, setStatus] = useState<'PENDING'|'UNAVAILABLE'|'COMPLETED'|'SKIPPED'>('PENDING');
  const [dailyCheckId, setDailyCheckId] = useState<number| null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, {response:string; note?:string}>>({});
  const [answeredBy, setAnsweredBy] = useState('');
  const [skipReason, setSkipReason] = useState('');

  const lang = (i18n?.language || 'en').startsWith('th') ? 'th' : 'en';

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/manager-check/questions?salesId=${salesId}&lang=${lang}`);
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

  // Language Toggle Component (inline)
  const LanguageToggle = () => (
    <div className="mb-4 flex items-center justify-center gap-3">
      <span className={`text-sm font-medium ${lang === 'en' ? 'text-blue-600' : 'text-gray-500'}`}>EN</span>
      <button 
        className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 ${lang === 'en' ? 'bg-blue-500 border-blue-500' : 'bg-emerald-500 border-emerald-500'}`}
        onClick={() => i18n.changeLanguage(lang === 'en' ? 'th' : 'en')}
      >
        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${lang === 'en' ? 'left-0' : 'left-6'}`} />
      </button>
      <span className={`text-sm font-medium ${lang === 'th' ? 'text-emerald-600' : 'text-gray-500'}`}>ไทย</span>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <LanguageToggle />
        <div className="text-2xl md:text-3xl font-semibold mb-6 text-center">{t('managerCheck.title')}</div>

        {loading ? (
          <div className="text-center text-lg py-8">Loading…</div>
        ) : status === 'UNAVAILABLE' ? (
          <div className="space-y-6">
            <div className="p-4 bg-yellow-100 rounded-lg text-center text-lg">{t('managerCheck.unavailable')}</div>
            <div className="flex justify-center">
              <button className="px-8 py-4 text-lg rounded-lg border-2 bg-gray-100 hover:bg-gray-200 min-h-[48px]" 
                      onClick={() => onDone({ status: 'UNAVAILABLE' })}>{t('managerCheck.continue')}</button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-6">
              {questions.map(q => (
                <div key={q.id} className="border-2 rounded-xl p-4 md:p-6 bg-gray-50">
                  <div className="font-semibold text-lg md:text-xl mb-4">{q.text}</div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {(['PASS','FAIL','NA'] as const).map(opt => (
                      <label key={opt} className="flex items-center justify-center gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-100 min-h-[56px]"
                             style={{ backgroundColor: answers[q.id]?.response === opt ? '#e3f2fd' : 'white' }}>
                        <input type="radio" name={`q-${q.id}`}
                               className="w-5 h-5"
                               onChange={() => setAns(q.id, 'response', opt)}
                               checked={answers[q.id]?.response === opt}/>
                        <span className="text-lg font-medium">{t(`managerCheck.${opt.toLowerCase()}`)}</span>
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

            <div className="grid grid-cols-1 gap-4">
              <input className="border-2 rounded-lg p-4 text-lg min-h-[56px]" placeholder={t('managerCheck.managerName')}
                     value={answeredBy} onChange={(e)=>setAnsweredBy(e.target.value)} />
            </div>

            <div className="space-y-4">
              <div className="text-base md:text-lg text-gray-600 text-center p-4 bg-blue-50 rounded-lg">
                {required ? t('managerCheck.required') : t('managerCheck.optional')}
              </div>
              
              <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                {!required && (
                  <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                    <input className="border-2 rounded-lg p-4 text-lg min-h-[56px] md:min-w-[300px]" 
                           placeholder={t('managerCheck.skipReason')}
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
                  {t('managerCheck.submit')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
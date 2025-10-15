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
  
  // MEGA PATCH V3: Validation helpers
  const allAnswered = questions && questions.length > 0 && questions.every(q => answers?.[q.id]?.response);
  const managerOk = (answeredBy || "").trim().length > 0;

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
  }, [salesId, lang]);

  const setAns = (qid:number, field:'response'|'note', val:string) => {
    setAnswers(p => ({ ...p, [qid]: { ...p[qid], [field]: val } }));
  };

  const handleResponseClick = (qid: number, response: string) => {
    setAns(qid, 'response', response);
  };

  const submit = async () => {
    if (!dailyCheckId) return;
    if (!answeredBy.trim()) {
      alert(t('managerCheck.managerNameRequired') || 'Manager name is required');
      return;
    }
    
    const payload = {
      dailyCheckId,
      answeredBy: answeredBy.trim(),
      answers: Object.entries(answers).map(([qid, v]) => ({
        questionId: Number(qid), 
        response: v.response || 'NA', 
        note: v.note || null
      }))
    };
    
    const r = await fetch('/api/manager-check/submit', {
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify(payload)
    });
    const data = await r.json();
    if (data.ok) onDone({ status: 'COMPLETED' });
  };

  const skip = async () => {
    const reason = skipReason.trim();
    if (!reason) {
      alert(t('managerCheck.skipReasonRequired') || 'Please provide a reason to skip');
      return;
    }
    
    const r = await fetch('/api/manager-check/skip', {
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify({ salesId, reason })
    });
    const data = await r.json();
    if (data.ok) onDone({ status: 'SKIPPED' });
  };

  const LanguageToggle = () => (
    <div className="mb-4 flex items-center justify-center gap-3">
      <span className={`text-sm font-medium ${lang === 'en' ? 'text-blue-600' : 'text-gray-500'}`}>EN</span>
      <button 
        type="button"
        className={`relative w-12 h-6 rounded-full border-2 transition-all duration-300 ${lang === 'en' ? 'bg-blue-500 border-blue-500' : 'bg-emerald-500 border-emerald-500'}`}
        onClick={() => i18n.changeLanguage(lang === 'en' ? 'th' : 'en')}
        data-testid="language-toggle"
      >
        <div className={`absolute top-0 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${lang === 'en' ? 'left-0' : 'left-6'}`} />
      </button>
      <span className={`text-sm font-medium ${lang === 'th' ? 'text-emerald-600' : 'text-gray-500'}`}>ไทย</span>
    </div>
  );

  const canSubmit = answeredBy.trim() && (!required || allAnswered);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-4xl my-2 sm:my-4 p-3 sm:p-4 md:p-6 max-h-[95vh] overflow-y-auto">
        <LanguageToggle />
        <div className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-center">{t('managerCheck.title')}</div>

        {loading ? (
          <div className="text-center text-sm py-4">Loading…</div>
        ) : status === 'UNAVAILABLE' ? (
          <div className="space-y-3">
            <div className="p-3 bg-yellow-100 rounded-[8px] text-center text-sm">{t('managerCheck.unavailable')}</div>
            <div className="flex justify-center">
              <button 
                type="button"
                className="px-6 py-2 text-sm rounded-[8px] border-2 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 min-h-[44px]" 
                onClick={() => onDone({ status: 'UNAVAILABLE' })}
                data-testid="button-continue"
              >
                {t('managerCheck.continue')}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            <div className="grid gap-3 sm:gap-4">
              {questions.map(q => (
                <div key={q.id} className="border-2 rounded-[8px] p-3 sm:p-4 bg-gray-50">
                  <div className="font-semibold text-sm sm:text-base mb-2 sm:mb-3">{q.text}</div>
                  
                  {/* Touch-friendly button group for responses */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
                    {(['PASS','FAIL','NA'] as const).map(opt => {
                      const isSelected = answers[q.id]?.response === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleResponseClick(q.id, opt)}
                          className={`
                            flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3 md:p-4 
                            border-2 rounded-[8px] cursor-pointer 
                            min-h-[48px] sm:min-h-[56px] md:min-h-[64px]
                            transition-all duration-200
                            active:scale-95
                            ${isSelected 
                              ? 'bg-blue-100 border-blue-500 shadow-md' 
                              : 'bg-white border-gray-300 hover:bg-gray-50 active:bg-gray-100'
                            }
                          `}
                          data-testid={`response-${q.id}-${opt.toLowerCase()}`}
                        >
                          <div className={`
                            w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center
                            ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-400'}
                          `}>
                            {isSelected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full" />}
                          </div>
                          <span className={`text-xs sm:text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                            {t(`managerCheck.${opt.toLowerCase()}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Optional note */}
                  <textarea 
                    className="w-full border-2 rounded-[8px] p-2 sm:p-3 text-[12px] min-h-[60px] focus:outline-none focus:border-blue-500 placeholder:text-[12px]"
                    placeholder={t('managerCheck.noteOptional') || "Note (optional)"}
                    value={answers[q.id]?.note ?? ''}
                    onChange={(e) => setAns(q.id, 'note', e.target.value)}
                    data-testid={`note-${q.id}`}
                  />
                </div>
              ))}
            </div>

            {/* Manager name input */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <input 
                type="text"
                className="border-2 rounded-[8px] p-2 sm:p-3 text-[12px] min-h-[44px] focus:outline-none focus:border-blue-500 placeholder:text-[12px]" 
                placeholder={t('managerCheck.managerName')}
                value={answeredBy} 
                onChange={(e)=>setAnsweredBy(e.target.value)}
                data-testid="input-manager-name"
              />
            </div>

            {/* Status message */}
            <div className="text-xs sm:text-sm text-gray-600 text-center p-2 sm:p-3 bg-blue-50 rounded-[8px]">
              {required ? t('managerCheck.required') : t('managerCheck.optional')}
            </div>
            
            {/* Action buttons */}
            <div className="space-y-3 sm:space-y-4">
              {/* Skip section (only if not required) */}
              {!required && (
                <div className="flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <label className="text-xs sm:text-sm font-medium text-red-700">
                    {t('managerCheck.skipSection') || 'Skip Checklist'}
                  </label>
                  <input 
                    type="text"
                    className="border-2 border-red-300 rounded-lg p-2 sm:p-3 text-xs sm:text-sm min-h-[44px] focus:outline-none focus:border-red-500" 
                    placeholder={t('managerCheck.skipReason') || 'Reason for skipping...'}
                    value={skipReason} 
                    onChange={(e)=>setSkipReason(e.target.value)}
                    data-testid="input-skip-reason"
                  />
                  <button 
                    type="button"
                    className="w-full px-4 py-2 text-xs sm:text-sm border-2 border-red-500 rounded-lg bg-red-100 hover:bg-red-200 active:bg-red-300 min-h-[44px] font-medium text-red-700 transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed" 
                    onClick={skip}
                    disabled={!skipReason.trim()}
                    data-testid="button-skip"
                  >
                    {t('managerCheck.skipButton') || 'Skip Checklist'}
                  </button>
                </div>
              )}

              {/* Main action buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center items-stretch sm:items-center">
                <button 
                  type="button"
                  className="px-4 py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-lg bg-white hover:bg-gray-50 active:bg-gray-100 min-h-[44px] font-medium transition-all active:scale-98" 
                  onClick={onCancel}
                  data-testid="button-cancel"
                >
                  {t('managerCheck.cancel') || 'Cancel'}
                </button>
                
                <button 
                  type="button"
                  className="px-6 py-2 text-xs sm:text-sm rounded-lg bg-black text-white hover:bg-gray-800 active:bg-gray-900 min-h-[44px] font-semibold transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                  onClick={submit}
                  disabled={!canSubmit}
                  data-testid="button-submit"
                >
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

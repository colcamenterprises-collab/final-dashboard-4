import React, { useState } from 'react';

type Props = {
  onDone: (result: {status: 'COMPLETED'|'SKIPPED'}) => void;
  onCancel: () => void;
};

export default function ManagerQuickCheck({ onDone, onCancel }: Props) {
  const [q1CashInRegister, setQ1CashInRegister] = useState(0);
  const [q2ExpensesMirrorReport, setQ2ExpensesMirrorReport] = useState<boolean | null>(null);
  const [q3CorrectDescriptions, setQ3CorrectDescriptions] = useState<boolean | null>(null);
  const [q4RegisterBalances, setQ4RegisterBalances] = useState<boolean | null>(null);
  const [q5AmountToBanked, setQ5AmountToBanked] = useState(0);
  const [q6ManagerName, setQ6ManagerName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    const newErrors: string[] = [];

    if (q1CashInRegister == null || isNaN(Number(q1CashInRegister)) || Number(q1CashInRegister) < 0) {
      newErrors.push('q1CashInRegister');
    }
    if (q2ExpensesMirrorReport === null) {
      newErrors.push('q2ExpensesMirrorReport');
    }
    if (q3CorrectDescriptions === null) {
      newErrors.push('q3CorrectDescriptions');
    }
    if (q4RegisterBalances === null) {
      newErrors.push('q4RegisterBalances');
    }
    if (q5AmountToBanked == null || isNaN(Number(q5AmountToBanked)) || Number(q5AmountToBanked) < 0) {
      newErrors.push('q5AmountToBanked');
    }
    if (!q6ManagerName || q6ManagerName.trim() === '') {
      newErrors.push('q6ManagerName');
    }

    setErrors(newErrors);
    
    if (newErrors.length > 0) {
      return;
    }

    // Store the answers (you can send to backend here if needed)
    const managerSignOff = {
      q1CashInRegister,
      q2ExpensesMirrorReport,
      q3CorrectDescriptions,
      q4RegisterBalances,
      q5AmountToBanked,
      q6ManagerName
    };
    
    console.log('Manager Sign-Off Complete:', managerSignOff);
    onDone({ status: 'COMPLETED' });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-[4px] w-full max-w-2xl my-auto p-4 max-h-[90vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="mb-4 pb-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Manager Sign-Off</h2>
          <p className="text-xs text-slate-600 mt-1">Please confirm all details before submitting</p>
        </div>

        <div className="space-y-4">
          {/* Q1: Cash in register */}
          <div>
            <label className="text-xs text-slate-700 font-medium block mb-2">
              Please confirm the amount of cash in register after all expenses (wages, expenses & exclude starting cash) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">฿</span>
              <input 
                type="number" 
                value={q1CashInRegister} 
                onChange={e=>setQ1CashInRegister(+e.target.value||0)} 
                className={`w-full max-w-xs border rounded-[4px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.includes('q1CashInRegister') ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                min="0"
                step="0.01"
                data-testid="input-q1-cash-register"
              />
            </div>
            {errors.includes('q1CashInRegister') && (
              <p className="text-red-500 text-xs mt-1">This field is required and must be ≥ 0</p>
            )}
          </div>

          {/* Q2: Expenses mirror report */}
          <div>
            <label className="text-xs text-slate-700 font-medium block mb-2">
              Does the expenses listed in the Daily Sheet mirror the shift report? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-[4px] cursor-pointer transition-colors ${q2ExpensesMirrorReport === true ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'} ${errors.includes('q2ExpensesMirrorReport') ? 'border-red-500 bg-red-50' : ''}`}>
                <input 
                  type="radio" 
                  name="q2ExpensesMirrorReport" 
                  checked={q2ExpensesMirrorReport === true}
                  onChange={() => setQ2ExpensesMirrorReport(true)}
                  className="w-4 h-4 text-emerald-600"
                  data-testid="radio-q2-yes"
                />
                <span className="text-xs text-slate-700 font-medium">Yes</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-[4px] cursor-pointer transition-colors ${q2ExpensesMirrorReport === false ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'} ${errors.includes('q2ExpensesMirrorReport') ? 'border-red-500 bg-red-50' : ''}`}>
                <input 
                  type="radio" 
                  name="q2ExpensesMirrorReport" 
                  checked={q2ExpensesMirrorReport === false}
                  onChange={() => setQ2ExpensesMirrorReport(false)}
                  className="w-4 h-4 text-emerald-600"
                  data-testid="radio-q2-no"
                />
                <span className="text-xs text-slate-700 font-medium">No</span>
              </label>
            </div>
            {errors.includes('q2ExpensesMirrorReport') && (
              <p className="text-red-500 text-xs mt-1">Please select Yes or No</p>
            )}
          </div>

          {/* Q3: Correct descriptions */}
          <div>
            <label className="text-xs text-slate-700 font-medium block mb-2">
              Do all expenses have the correct descriptions (eg Bin Bags)? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-[4px] cursor-pointer transition-colors ${q3CorrectDescriptions === true ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'} ${errors.includes('q3CorrectDescriptions') ? 'border-red-500 bg-red-50' : ''}`}>
                <input 
                  type="radio" 
                  name="q3CorrectDescriptions" 
                  checked={q3CorrectDescriptions === true}
                  onChange={() => setQ3CorrectDescriptions(true)}
                  className="w-4 h-4 text-emerald-600"
                  data-testid="radio-q3-yes"
                />
                <span className="text-xs text-slate-700 font-medium">Yes</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-[4px] cursor-pointer transition-colors ${q3CorrectDescriptions === false ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'} ${errors.includes('q3CorrectDescriptions') ? 'border-red-500 bg-red-50' : ''}`}>
                <input 
                  type="radio" 
                  name="q3CorrectDescriptions" 
                  checked={q3CorrectDescriptions === false}
                  onChange={() => setQ3CorrectDescriptions(false)}
                  className="w-4 h-4 text-emerald-600"
                  data-testid="radio-q3-no"
                />
                <span className="text-xs text-slate-700 font-medium">No</span>
              </label>
            </div>
            {errors.includes('q3CorrectDescriptions') && (
              <p className="text-red-500 text-xs mt-1">Please select Yes or No</p>
            )}
          </div>

          {/* Q4: Register balances */}
          <div>
            <label className="text-xs text-slate-700 font-medium block mb-2">
              Does the Register Balance? <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-[4px] cursor-pointer transition-colors ${q4RegisterBalances === true ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'} ${errors.includes('q4RegisterBalances') ? 'border-red-500 bg-red-50' : ''}`}>
                <input 
                  type="radio" 
                  name="q4RegisterBalances" 
                  checked={q4RegisterBalances === true}
                  onChange={() => setQ4RegisterBalances(true)}
                  className="w-4 h-4 text-emerald-600"
                  data-testid="radio-q4-yes"
                />
                <span className="text-xs text-slate-700 font-medium">Yes</span>
              </label>
              <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border rounded-[4px] cursor-pointer transition-colors ${q4RegisterBalances === false ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'} ${errors.includes('q4RegisterBalances') ? 'border-red-500 bg-red-50' : ''}`}>
                <input 
                  type="radio" 
                  name="q4RegisterBalances" 
                  checked={q4RegisterBalances === false}
                  onChange={() => setQ4RegisterBalances(false)}
                  className="w-4 h-4 text-emerald-600"
                  data-testid="radio-q4-no"
                />
                <span className="text-xs text-slate-700 font-medium">No</span>
              </label>
            </div>
            {errors.includes('q4RegisterBalances') && (
              <p className="text-red-500 text-xs mt-1">Please select Yes or No</p>
            )}
          </div>

          {/* Q5: Amount to be banked */}
          <div>
            <label className="text-xs text-slate-700 font-medium block mb-2">
              Please confirm the amount to be banked (Combined Total) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600 font-medium">฿</span>
              <input 
                type="number" 
                value={q5AmountToBanked} 
                onChange={e=>setQ5AmountToBanked(+e.target.value||0)} 
                className={`w-full max-w-xs border rounded-[4px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.includes('q5AmountToBanked') ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                min="0"
                step="0.01"
                data-testid="input-q5-amount-banked"
              />
            </div>
            {errors.includes('q5AmountToBanked') && (
              <p className="text-red-500 text-xs mt-1">This field is required and must be ≥ 0</p>
            )}
          </div>

          {/* Q6: Manager name */}
          <div>
            <label className="text-xs text-slate-700 font-medium block mb-2">
              Please list your Name <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={q6ManagerName}
              onChange={e => setQ6ManagerName(e.target.value)}
              className={`w-full border rounded-[4px] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errors.includes('q6ManagerName') ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
              placeholder="Manager name"
              data-testid="input-q6-manager-name"
            />
            {errors.includes('q6ManagerName') && (
              <p className="text-red-500 text-xs mt-1">Manager name is required</p>
            )}
          </div>
        </div>

        {/* Action buttons - Stack on mobile, row on tablet+ */}
        <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-slate-200">
          <button 
            type="button"
            className="flex-1 sm:flex-none px-4 py-2 text-xs border border-slate-200 rounded-[4px] bg-white hover:bg-slate-50 font-medium transition-colors text-slate-700" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Cancel
          </button>
          
          <button 
            type="button"
            className="flex-1 sm:flex-none px-6 py-2 text-xs rounded-[4px] bg-emerald-600 text-white hover:bg-emerald-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            data-testid="button-submit"
          >
            Complete & Submit
          </button>
        </div>
      </div>
    </div>
  );
}

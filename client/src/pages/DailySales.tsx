import { useState } from 'react';
import axios from 'axios';

function DailySalesForm() {
  const [form, setForm] = useState({
    shiftDate: '',
    cashSales: '',
    qrSales: '',
    grabSales: '',
    aroiDeeSales: '',
    discounts: '',
    refunds: '',
    amountBanked: '',
    notes: '',
    expenses: [{ item: '', amount: '' }],
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleExpenseChange = (index: number, field: string, value: string) => {
    const updated = [...form.expenses];
    (updated[index] as any)[field] = value;
    setForm((prev) => ({ ...prev, expenses: updated }));
  };

  const addExpense = () => {
    setForm((prev) => ({
      ...prev,
      expenses: [...prev.expenses, { item: '', amount: '' }],
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const res = await axios.post('/api/daily-sales', form);
    const salesId = res.data.id;
    window.location.href = `/daily-stock?salesId=${salesId}`;
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Daily Sales Form</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
          type="date" 
          value={form.shiftDate} 
          onChange={(e) => handleChange('shiftDate', e.target.value)} 
          required 
          className="input" 
        />

        <div className="grid grid-cols-2 gap-4">
          {['cashSales', 'qrSales', 'grabSales', 'aroiDeeSales', 'discounts', 'refunds', 'amountBanked'].map((field) => (
            <input
              key={field}
              type="number"
              step="0.01"
              placeholder={field}
              value={form[field as keyof typeof form] as string}
              onChange={(e) => handleChange(field, e.target.value)}
              className="input"
            />
          ))}
        </div>

        <div>
          <label className="font-bold">Expenses</label>
          {form.expenses.map((exp, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input 
                type="text" 
                placeholder="Item" 
                value={exp.item} 
                onChange={(e) => handleExpenseChange(i, 'item', e.target.value)} 
                className="input" 
              />
              <input 
                type="number" 
                step="0.01" 
                placeholder="Amount" 
                value={exp.amount} 
                onChange={(e) => handleExpenseChange(i, 'amount', e.target.value)} 
                className="input" 
              />
            </div>
          ))}
          <button type="button" onClick={addExpense} className="text-blue-600 underline">+ Add Expense</button>
        </div>

        <textarea 
          placeholder="Notes" 
          value={form.notes} 
          onChange={(e) => handleChange('notes', e.target.value)} 
          className="input w-full h-24" 
        />

        <button type="submit" className="bg-black text-white px-4 py-2 rounded">
          Submit & Go to Stock Form
        </button>
      </form>
    </div>
  );
}

export default DailySalesForm;
import { useState, useEffect } from 'react';
import axios from 'axios';

function DailySalesForm() {
  const [form, setForm] = useState({
    completedBy: '',
    startingCash: '',
    cashSales: '',
    qrSales: '',
    grabSales: '',
    aroiDeeSales: '',
    discounts: '',
    refunds: '',
    amountBanked: '',
    notes: '',
    shoppingExpenses: [{ item: '', amount: '' }],
    wageExpenses: [
      { name: 'Manager', amount: '' },
      { name: 'Chef', amount: '' },
      { name: 'Cashier', amount: '' },
      { name: 'Kitchen Staff', amount: '' },
      { name: 'Part-time Helper', amount: '' }
    ],
  });

  const [totals, setTotals] = useState({
    totalSales: 0,
    totalExpenses: 0,
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleShoppingExpenseChange = (index: number, field: string, value: string) => {
    const updated = [...form.shoppingExpenses];
    (updated[index] as any)[field] = value;
    setForm((prev) => ({ ...prev, shoppingExpenses: updated }));
  };

  const handleWageExpenseChange = (index: number, field: string, value: string) => {
    const updated = [...form.wageExpenses];
    (updated[index] as any)[field] = value;
    setForm((prev) => ({ ...prev, wageExpenses: updated }));
  };

  const addShoppingExpense = () => {
    setForm((prev) => ({
      ...prev,
      shoppingExpenses: [...prev.shoppingExpenses, { item: '', amount: '' }],
    }));
  };

  // Auto-calculate totals
  useEffect(() => {
    const salesFields = [form.cashSales, form.qrSales, form.grabSales, form.aroiDeeSales];
    const totalSales = salesFields.reduce((sum, field) => sum + (parseFloat(field) || 0), 0);
    
    const shoppingTotal = form.shoppingExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const wageTotal = form.wageExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const totalExpenses = shoppingTotal + wageTotal;
    
    setTotals({ totalSales, totalExpenses });
  }, [form.cashSales, form.qrSales, form.grabSales, form.aroiDeeSales, form.shoppingExpenses, form.wageExpenses]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const submissionData = {
      ...form,
      shiftDate: new Date().toISOString(),
    };
    const res = await axios.post('/api/daily-sales', submissionData);
    const salesId = res.data.id;
    window.location.href = `/daily-stock?salesId=${salesId}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Daily Sales Form</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Form Header Fields */}
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Completed By"
            value={form.completedBy}
            onChange={(e) => handleChange('completedBy', e.target.value)}
            required
            className="input"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Starting Cash"
            value={form.startingCash}
            onChange={(e) => handleChange('startingCash', e.target.value)}
            required
            className="input"
          />
        </div>

        {/* Sales Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Sales Information</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { field: 'cashSales', label: 'Cash Sales' },
              { field: 'qrSales', label: 'QR Sales' },
              { field: 'grabSales', label: 'Grab Sales' },
              { field: 'aroiDeeSales', label: 'Aroi Dee Sales' },
              { field: 'discounts', label: 'Discounts' },
              { field: 'refunds', label: 'Refunds' },
            ].map(({ field, label }) => (
              <input
                key={field}
                type="number"
                step="0.01"
                placeholder={label}
                value={form[field as keyof typeof form] as string}
                onChange={(e) => handleChange(field, e.target.value)}
                className="input"
              />
            ))}
          </div>
        </div>

        {/* Shopping Expenses Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Shopping Purchases</h3>
          {form.shoppingExpenses.map((exp, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input 
                type="text" 
                placeholder="Item" 
                value={exp.item} 
                onChange={(e) => handleShoppingExpenseChange(i, 'item', e.target.value)} 
                className="input flex-1" 
              />
              <input 
                type="number" 
                step="0.01" 
                placeholder="Amount" 
                value={exp.amount} 
                onChange={(e) => handleShoppingExpenseChange(i, 'amount', e.target.value)} 
                className="input w-32" 
              />
            </div>
          ))}
          <button type="button" onClick={addShoppingExpense} className="text-blue-600 underline">+ Add Shopping Item</button>
        </div>

        {/* Wages Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Staff Wages</h3>
          {form.wageExpenses.map((wage, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input 
                type="text" 
                value={wage.name} 
                onChange={(e) => handleWageExpenseChange(i, 'name', e.target.value)} 
                className="input flex-1" 
                readOnly
              />
              <input 
                type="number" 
                step="0.01" 
                placeholder="Amount" 
                value={wage.amount} 
                onChange={(e) => handleWageExpenseChange(i, 'amount', e.target.value)} 
                className="input w-32" 
              />
            </div>
          ))}
        </div>

        {/* Banking */}
        <div className="border rounded-lg p-4">
          <h3 className="font-bold text-lg mb-3">Banking</h3>
          <input
            type="number"
            step="0.01"
            placeholder="Amount Banked"
            value={form.amountBanked}
            onChange={(e) => handleChange('amountBanked', e.target.value)}
            className="input w-full"
          />
        </div>

        {/* Summary Section */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-bold text-lg mb-3">Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between">
              <span className="font-medium">Total Sales:</span>
              <span className="font-bold text-green-600">₿{totals.totalSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Total Expenses:</span>
              <span className="font-bold text-red-600">₿{totals.totalExpenses.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <textarea 
          placeholder="Notes" 
          value={form.notes} 
          onChange={(e) => handleChange('notes', e.target.value)} 
          className="input w-full h-24" 
        />

        <button type="submit" className="bg-black text-white px-6 py-3 rounded w-full">
          Submit & Go to Stock Form
        </button>
      </form>
    </div>
  );
}

export default DailySalesForm;
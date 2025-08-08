import { useState } from 'react';
import axios from 'axios';

export default function DailySalesForm() {
  const [form, setForm] = useState({
    completedBy: '',
    startingCash: '',
    cashSales: '',
    qrSales: '',
    grabSales: '',
    aroiDeeSales: '',
    shopping: [{ item: '', cost: '', shop: '' }],
    wages: [{ name: '', amount: '', type: 'Wages' }],
    closingCash: '',
    cashBanked: '',
    qrTransferred: '',
    amountBanked: '',
    notes: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (section: string, index: number, field: string, value: string) => {
    const updated = [...(form[section as keyof typeof form] as any[])];
    updated[index][field] = value;
    setForm((prev) => ({ ...prev, [section]: updated }));
  };

  const addRow = (section: string, template: object) => {
    setForm((prev) => ({
      ...prev,
      [section]: [...(prev[section as keyof typeof prev] as any[]), template],
    }));
  };

  const totalSales =
    ['cashSales', 'qrSales', 'grabSales', 'aroiDeeSales'].reduce(
      (sum, key) => sum + parseFloat((form[key as keyof typeof form] as string) || '0'),
      0
    );

  const totalExpenses = form.shopping.reduce((sum, i) => sum + parseFloat(i.cost || '0'), 0)
    + form.wages.reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const payload = {
      ...form,
      totalSales,
      totalExpenses,
    };
    const { data } = await axios.post('/api/daily-sales', payload);
    const { id } = data; // must exist
    window.location.href = `/daily-stock?salesId=${id}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Daily Sales Form</h1>

      {/* Shift Info */}
      <div className="grid grid-cols-2 gap-4">
        <input className="input" placeholder="Completed By" value={form.completedBy} onChange={(e) => handleChange('completedBy', e.target.value)} />
        <input className="input" placeholder="Starting Cash" type="number" value={form.startingCash} onChange={(e) => handleChange('startingCash', e.target.value)} />
      </div>

      {/* Sales Info */}
      <div>
        <h2 className="font-bold mb-2">Sales Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cash Sales</label>
            <input className="input" type="number" value={form.cashSales} onChange={(e) => handleChange('cashSales', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">QR Sales</label>
            <input className="input" type="number" value={form.qrSales} onChange={(e) => handleChange('qrSales', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grab Sales</label>
            <input className="input" type="number" value={form.grabSales} onChange={(e) => handleChange('grabSales', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aroi Dee Sales</label>
            <input className="input" type="number" value={form.aroiDeeSales} onChange={(e) => handleChange('aroiDeeSales', e.target.value)} />
          </div>
        </div>
        <div className="mt-2 font-bold">Total Sales: ฿{totalSales.toFixed(2)}</div>
      </div>

      {/* Shopping Purchases */}
      <div>
        <h2 className="font-bold mb-2">Shopping Purchases</h2>
        {form.shopping.map((entry, i) => (
          <div key={i} className="grid grid-cols-3 gap-4 mb-2">
            <input className="input" placeholder="Item" value={entry.item} onChange={(e) => handleNestedChange('shopping', i, 'item', e.target.value)} />
            <input className="input" type="number" placeholder="Cost" value={entry.cost} onChange={(e) => handleNestedChange('shopping', i, 'cost', e.target.value)} />
            <input className="input" placeholder="Shop Name" value={entry.shop} onChange={(e) => handleNestedChange('shopping', i, 'shop', e.target.value)} />
          </div>
        ))}
        <button type="button" onClick={() => addRow('shopping', { item: '', cost: '', shop: '' })} className="text-blue-600 underline">+ Add Shopping Item</button>
      </div>

      {/* Staff Wages */}
      <div>
        <h2 className="font-bold mb-2">Staff Wages</h2>
        {form.wages.map((entry, i) => (
          <div key={i} className="grid grid-cols-3 gap-4 mb-2">
            <input className="input" placeholder="Staff Name" value={entry.name} onChange={(e) => handleNestedChange('wages', i, 'name', e.target.value)} />
            <input className="input" type="number" placeholder="Amount" value={entry.amount} onChange={(e) => handleNestedChange('wages', i, 'amount', e.target.value)} />
            <select className="input" value={entry.type} onChange={(e) => handleNestedChange('wages', i, 'type', e.target.value)}>
              <option>Wages</option>
              <option>Overtime</option>
              <option>Bonus</option>
              <option>Reimbursement</option>
            </select>
          </div>
        ))}
        <button type="button" onClick={() => addRow('wages', { name: '', amount: '', type: 'Wages' })} className="text-blue-600 underline">+ Add Wage Entry</button>
      </div>

      {/* Banking */}
      <div>
        <h2 className="font-bold mb-2">Banking</h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Closing Cash</label>
            <input className="input" type="number" value={form.closingCash} onChange={(e) => handleChange('closingCash', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cash Banked</label>
            <input className="input" type="number" value={form.cashBanked} onChange={(e) => handleChange('cashBanked', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">QR Code Transfer Amount</label>
            <input className="input" type="number" value={form.qrTransferred} onChange={(e) => handleChange('qrTransferred', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Notes + Total Expenses */}
      <div className="mt-6">
        <textarea className="input w-full h-24" placeholder="Notes..." value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} />
        <div className="font-bold mt-2">Total Expenses: ฿{totalExpenses.toFixed(2)}</div>
      </div>

      {/* Submit */}
      <button type="submit" onClick={handleSubmit} className="bg-black text-white px-4 py-2 rounded mt-4">Submit & Continue</button>
    </div>
  );
}
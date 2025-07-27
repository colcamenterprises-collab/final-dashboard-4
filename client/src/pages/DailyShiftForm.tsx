import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface WageEntry {
  name: string;
  amount: number;
  type: string;
}

interface ShoppingEntry {
  item: string;
  amount: number;
  shop: string;
}

interface FormData {
  completedBy: string;
  shiftDate: string;
  grabSales: number;
  aroiDeeSales: number;
  qrScanSales: number;
  cashSales: number;
  wages: WageEntry[];
  shopping: ShoppingEntry[];
  gasExpense: number;
  startingCash: number;
  endingCash: number;
  bankedAmount: number;
  rollsStock: number;
  meatStock: number;
  numberNeeded: Record<string, string>;
}

interface Submission extends FormData {
  date: string;
}

interface Item {
  "Item ": string;
  "Internal Category": string;
}

const DailyShiftForm = () => {
  const [formData, setFormData] = useState<FormData>({
    completedBy: '',
    shiftDate: new Date().toISOString().split('T')[0],
    grabSales: 0,
    aroiDeeSales: 0,
    qrScanSales: 0,
    cashSales: 0,
    wages: [],
    shopping: [],
    gasExpense: 0,
    startingCash: 0,
    endingCash: 0,
    bankedAmount: 0,
    rollsStock: 0,
    meatStock: 0,
    numberNeeded: {}
  });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Items from CSV (complete supplier list)
  const items: Item[] = [
    { "Item ": "Topside Beef", "Internal Category": "Fresh Food" },
    { "Item ": "Brisket Point End", "Internal Category": "Fresh Food" },
    { "Item ": "Chuck Roll Beef", "Internal Category": "Fresh Food" },
    { "Item ": "Other Beef (Mixed)", "Internal Category": "Fresh Food" },
    { "Item ": "Salad (Iceberg Lettuce)", "Internal Category": "Fresh Food" },
    { "Item ": "Milk", "Internal Category": "Fresh Food" },
    { "Item ": "Burger Bun", "Internal Category": "Fresh Food" },
    { "Item ": "Tomatos", "Internal Category": "Fresh Food" },
    { "Item ": "White Cabbage", "Internal Category": "Fresh Food" },
    { "Item ": "Purple Cabbage", "Internal Category": "Fresh Food" },
    { "Item ": "Onions Bulk 10kg", "Internal Category": "Fresh Food" },
    { "Item ": "Onions (small bags)", "Internal Category": "Fresh Food" },
    { "Item ": "Cheese", "Internal Category": "Fresh Food" },
    { "Item ": "Bacon Short", "Internal Category": "Fresh Food" },
    { "Item ": "Bacon Long", "Internal Category": "Fresh Food" },
    { "Item ": "Jalapenos", "Internal Category": "Fresh Food" },
    { "Item ": "French Fries 7mm", "Internal Category": "Frozen Food" },
    { "Item ": "Chicken Nuggets", "Internal Category": "Frozen Food" },
    { "Item ": "Chicken Fillets", "Internal Category": "Frozen Food" },
    { "Item ": "Sweet Potato Fries", "Internal Category": "Frozen Food" },
    { "Item ": "Cajun Fries Seasoning", "Internal Category": "Shelf Items" },
    { "Item ": "Crispy Fried Onions", "Internal Category": "Shelf Items" },
    { "Item ": "Pickles(standard dill pickles)", "Internal Category": "Shelf Items" },
    { "Item ": "Pickles Sweet (standard)", "Internal Category": "Shelf Items" },
    { "Item ": "Mustard", "Internal Category": "Shelf Items" },
    { "Item ": "Mayonnaise", "Internal Category": "Shelf Items" },
    { "Item ": "Tomato Sauce", "Internal Category": "Shelf Items" },
    { "Item ": "Chili Sauce (Sriracha)", "Internal Category": "Shelf Items" },
    { "Item ": "BBQ Sauce", "Internal Category": "Shelf Items" },
    { "Item ": "Sriracha Sauce", "Internal Category": "Shelf Items" },
    { "Item ": "Salt (Coarse Sea Salt)", "Internal Category": "Shelf Items" },
    { "Item ": "Oil (Fryer)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Plastic Food Wrap", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Paper Towel Long", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Paper Towel Short (Serviettes)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Food Gloves (Large)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Food Gloves (Medium)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Food Gloves (Small)", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Aluminum Foil", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Plastic Meat Gloves", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Kitchen Cleaner", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Alcohol Sanitiser", "Internal Category": "Kitchen Supplies" },
    { "Item ": "Coke", "Internal Category": "Drinks" },
    { "Item ": "Coke Zero", "Internal Category": "Drinks" },
    { "Item ": "Fanta Orange", "Internal Category": "Drinks" },
    { "Item ": "Fanta Strawberry", "Internal Category": "Drinks" },
    { "Item ": "Schweppes Manow", "Internal Category": "Drinks" },
    { "Item ": "Kids Juice (Orange)", "Internal Category": "Drinks" },
    { "Item ": "Kids Juice (Apple)", "Internal Category": "Drinks" },
    { "Item ": "Sprite", "Internal Category": "Drinks" },
    { "Item ": "Soda Water", "Internal Category": "Drinks" },
    { "Item ": "Bottled Water", "Internal Category": "Drinks" },
    { "Item ": "French Fries Box", "Internal Category": "Packaging" },
    { "Item ": "Plastic Carry Bags (Size- 6×14)", "Internal Category": "Packaging" },
    { "Item ": "Plastic Carry Bags (Size - 9×18)", "Internal Category": "Packaging" },
    { "Item ": "Brown Paper Food Bags", "Internal Category": "Packaging" },
    { "Item ": "Loaded Fries Boxes", "Internal Category": "Packaging" },
    { "Item ": "Packaging Labels", "Internal Category": "Packaging" },
    { "Item ": "Knife, Fork, Spoon Set", "Internal Category": "Packaging" }
  ];

  useEffect(() => {
    const savedDraft = localStorage.getItem('dailyShiftDraft');
    if (savedDraft) {
      setFormData(JSON.parse(savedDraft));
      setErrorMessage('Loaded from draft.');
    }
  }, []);

  const handleNumberNeededChange = (itemName: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({
        ...formData,
        numberNeeded: { ...formData.numberNeeded, [itemName]: value }
      });
    } else {
      setErrorMessage(`Invalid input for ${itemName}: Only numbers or empty. Reasoning: Text/symbols cause DB errors (22P02).`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSubmission = { ...formData, date: new Date().toLocaleString() };
    const updatedSubmissions = [...submissions, newSubmission];
    setSubmissions(updatedSubmissions);
    localStorage.setItem('dailyShiftSubmissions', JSON.stringify(updatedSubmissions));
    setFormData({
      completedBy: '',
      shiftDate: new Date().toISOString().split('T')[0],
      grabSales: 0,
      aroiDeeSales: 0,
      qrScanSales: 0,
      cashSales: 0,
      wages: [],
      shopping: [],
      gasExpense: 0,
      startingCash: 0,
      endingCash: 0,
      bankedAmount: 0,
      rollsStock: 0,
      meatStock: 0,
      numberNeeded: {}
    });
    localStorage.removeItem('dailyShiftDraft');
    setErrorMessage('');
    setSuccessMessage('Thank you, form submitted!');
    setTimeout(() => setSuccessMessage(''), 6000);
    
    // Optional backend
    try {
      await axios.post('/api/daily-shift-forms', newSubmission);
    } catch (err) {
      setErrorMessage('Backend failed but saved locally. Reasoning: Connection/schema issue – retry later.');
    }
  };

  const saveDraft = () => {
    localStorage.setItem('dailyShiftDraft', JSON.stringify(formData));
    setErrorMessage('Draft saved.');
  };

  // Calculate totals
  const totalSales = formData.grabSales + formData.aroiDeeSales + formData.qrScanSales + formData.cashSales;
  const totalWages = formData.wages.reduce((sum, wage) => sum + (wage.amount || 0), 0);
  const totalShopping = formData.shopping.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalExpenses = totalWages + totalShopping + formData.gasExpense;

  // Wage Management
  const addWageEntry = () => {
    setFormData({
      ...formData,
      wages: [...formData.wages, { name: '', amount: 0, type: 'staff' }]
    });
  };

  const removeWageEntry = (index: number) => {
    setFormData({
      ...formData,
      wages: formData.wages.filter((_, i) => i !== index)
    });
  };

  const updateWage = (index: number, field: keyof WageEntry, value: string | number) => {
    const updatedWages = [...formData.wages];
    updatedWages[index] = { ...updatedWages[index], [field]: value };
    setFormData({ ...formData, wages: updatedWages });
  };

  // Shopping Management
  const addShoppingEntry = () => {
    setFormData({
      ...formData,
      shopping: [...formData.shopping, { item: '', amount: 0, shop: 'Big C' }]
    });
  };

  const removeShoppingEntry = (index: number) => {
    setFormData({
      ...formData,
      shopping: formData.shopping.filter((_, i) => i !== index)
    });
  };

  const updateShopping = (index: number, field: keyof ShoppingEntry, value: string | number) => {
    const updatedShopping = [...formData.shopping];
    updatedShopping[index] = { ...updatedShopping[index], [field]: value };
    setFormData({ ...formData, shopping: updatedShopping });
  };

  const groupedItems = items.reduce((acc, item) => {
    const cat = item["Internal Category"] || 'Other';
    if (cat) {
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
    }
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 bg-white text-gray-900 min-h-screen">
      <h1 className="font-bold text-[12px] mb-4 sm:mb-6">Daily Sales & Stock</h1>
      
      <form onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-50">
          <h2 className="font-bold text-[12px] mb-4 border-b border-gray-200 pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-[11px] font-semibold">Completed By</label>
              <input
                type="text"
                value={formData.completedBy}
                onChange={(e) => setFormData({ ...formData, completedBy: e.target.value })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block mb-2 text-[11px] font-semibold">Shift Date</label>
              <input
                type="date"
                value={formData.shiftDate}
                onChange={(e) => setFormData({ ...formData, shiftDate: e.target.value })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
          </div>
        </div>

        {/* Sales Information */}
        <div className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-50">
          <h2 className="font-bold text-[12px] mb-4 border-b border-gray-200 pb-2">Sales Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block mb-2 text-[11px] font-semibold">Grab Sales</label>
              <input
                type="number"
                value={formData.grabSales}
                onChange={(e) => setFormData({ ...formData, grabSales: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block mb-2 text-[11px] font-semibold">Aroi Dee Sales</label>
              <input
                type="number"
                value={formData.aroiDeeSales}
                onChange={(e) => setFormData({ ...formData, aroiDeeSales: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block mb-2 text-[11px] font-semibold">QR Scan Sales</label>
              <input
                type="number"
                value={formData.qrScanSales}
                onChange={(e) => setFormData({ ...formData, qrScanSales: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block mb-2 text-[11px] font-semibold">Cash Sales</label>
              <input
                type="number"
                value={formData.cashSales}
                onChange={(e) => setFormData({ ...formData, cashSales: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-100 text-gray-900 rounded border border-gray-300 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded text-green-800">
            <strong className="text-[11px]">Total Sales: ฿{totalSales.toFixed(2)}</strong>
          </div>
        </div>

        {/* Wages Section */}
        <div className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-800">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-600 pb-2">Wages & Staff Payments</h2>
          {formData.wages.map((wage, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-3 bg-gray-700 rounded">
              <input
                type="text"
                placeholder="Staff Name"
                value={wage.name}
                onChange={(e) => updateWage(index, 'name', e.target.value)}
                className="p-2 bg-gray-600 text-white rounded border-none focus:outline-none"
              />
              <input
                type="number"
                placeholder="Amount"
                value={wage.amount}
                onChange={(e) => updateWage(index, 'amount', parseFloat(e.target.value) || 0)}
                className="p-2 bg-gray-600 text-white rounded border-none focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={wage.type}
                  onChange={(e) => updateWage(index, 'type', e.target.value)}
                  className="flex-1 p-2 bg-gray-600 text-white rounded border-none focus:outline-none"
                >
                  <option value="staff">Staff</option>
                  <option value="bonus">Bonus</option>
                  <option value="overtime">Overtime</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeWageEntry(index)}
                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addWageEntry}
            className="mb-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Wage Entry
          </button>
          <div className="mt-4 p-3 bg-blue-700 rounded">
            <strong>Total Wages: ฿{totalWages.toFixed(2)}</strong>
          </div>
        </div>

        {/* Shopping & Expenses */}
        <div className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-800">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-600 pb-2">Shopping & Expenses</h2>
          {formData.shopping.map((item, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-3 bg-gray-700 rounded">
              <input
                type="text"
                placeholder="Item/Expense"
                value={item.item}
                onChange={(e) => updateShopping(index, 'item', e.target.value)}
                className="p-2 bg-gray-600 text-white rounded border-none focus:outline-none"
              />
              <input
                type="number"
                placeholder="Amount"
                value={item.amount}
                onChange={(e) => updateShopping(index, 'amount', parseFloat(e.target.value) || 0)}
                className="p-2 bg-gray-600 text-white rounded border-none focus:outline-none"
              />
              <div className="flex gap-2">
                <select
                  value={item.shop}
                  onChange={(e) => updateShopping(index, 'shop', e.target.value)}
                  className="flex-1 p-2 bg-gray-600 text-white rounded border-none focus:outline-none"
                >
                  <option value="Big C">Big C</option>
                  <option value="Tesco Lotus">Tesco Lotus</option>
                  <option value="Villa Market">Villa Market</option>
                  <option value="Other">Other</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeShoppingEntry(index)}
                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addShoppingEntry}
            className="mb-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Expense
          </button>
          
          <div className="mt-4">
            <label className="block mb-2 font-semibold">Gas Expense</label>
            <input
              type="number"
              value={formData.gasExpense}
              onChange={(e) => setFormData({ ...formData, gasExpense: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none"
            />
          </div>
          
          <div className="mt-4 p-3 bg-orange-700 rounded">
            <strong>Total Shopping: ฿{totalShopping.toFixed(2)}</strong><br/>
            <strong>Total Expenses: ฿{totalExpenses.toFixed(2)}</strong>
          </div>
        </div>

        {/* Cash Management */}
        <div className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-800">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-600 pb-2">Cash Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block mb-2 font-semibold">Starting Cash</label>
              <input
                type="number"
                value={formData.startingCash}
                onChange={(e) => setFormData({ ...formData, startingCash: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-2 font-semibold">Ending Cash (Manual)</label>
              <input
                type="number"
                value={formData.endingCash}
                onChange={(e) => setFormData({ ...formData, endingCash: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-2 font-semibold">Banked Amount</label>
              <input
                type="number"
                value={formData.bankedAmount}
                onChange={(e) => setFormData({ ...formData, bankedAmount: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Stock Information */}
        <div className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-800">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-600 pb-2">Stock Counts</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-2 font-semibold">Burger Rolls Stock</label>
              <input
                type="number"
                value={formData.rollsStock}
                onChange={(e) => setFormData({ ...formData, rollsStock: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none"
              />
            </div>
            <div>
              <label className="block mb-2 font-semibold">Meat Stock (kg)</label>
              <input
                type="number"
                value={formData.meatStock}
                onChange={(e) => setFormData({ ...formData, meatStock: parseFloat(e.target.value) || 0 })}
                className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Inventory Categories */}
        {Object.entries(groupedItems).map(([category, catItems]) => (
          <div key={category} className="mb-6 shadow-md rounded-lg p-4 sm:p-6 bg-gray-800">
            <h2 className="text-xl font-bold uppercase tracking-wide mb-3 sm:mb-4 border-b border-gray-600 pb-2">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {catItems.map((item) => (
                <div key={item["Item "]} className="bg-white/10 p-3 sm:p-4 rounded-lg">
                  <label className="block mb-1 sm:mb-2 font-semibold text-sm sm:text-base">{item["Item "]}</label>
                  <input
                    type="number"
                    placeholder="Number Needed"
                    value={formData.numberNeeded[item["Item "]] || ''}
                    onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                    className="w-full p-1 sm:p-2 bg-gray-700 text-white rounded border-none focus:outline-none text-sm sm:text-base"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <button type="button" onClick={saveDraft} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded font-bold text-[11px] sm:text-base">Save as Draft</button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 sm:px-6 sm:py-3 rounded font-bold text-[11px] sm:text-base">Save and Submit</button>
        </div>
      </form>
      {successMessage && (
        <div className="mt-4 p-3 sm:p-4 bg-green-500 rounded text-white text-sm sm:text-base">
          <strong>Success:</strong> {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="mt-4 p-3 sm:p-4 bg-red-500 rounded text-white text-sm sm:text-base">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
      
      <h2 className="text-xl font-bold mt-6 sm:mt-8 mb-4">Previous Submissions</h2>
      {submissions.length === 0 ? (
        <p className="text-gray-300">No submissions yet.</p>
      ) : (
        <div className="space-y-4">
          {submissions.map((sub, index) => (
            <div key={index} className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-bold mb-2">Submission {index + 1} - {sub.date}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Completed by:</strong> {sub.completedBy}<br/>
                  <strong>Date:</strong> {sub.shiftDate}<br/>
                  <strong>Total Sales:</strong> ฿{(sub.grabSales + sub.aroiDeeSales + sub.qrScanSales + sub.cashSales).toFixed(2)}
                </div>
                <div>
                  <strong>Total Wages:</strong> ฿{sub.wages.reduce((sum, wage) => sum + (wage.amount || 0), 0).toFixed(2)}<br/>
                  <strong>Total Shopping:</strong> ฿{sub.shopping.reduce((sum, item) => sum + (item.amount || 0), 0).toFixed(2)}<br/>
                  <strong>Gas Expense:</strong> ฿{sub.gasExpense.toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyShiftForm;
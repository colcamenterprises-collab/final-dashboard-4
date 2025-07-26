import { useState, useEffect } from 'react';
import axios from 'axios';

const DailyShiftForm = () => {
  const [formData, setFormData] = useState({ 
    completedBy: '',
    shiftType: '',
    shiftDate: new Date().toISOString().split('T')[0],
    numberNeeded: {} 
  });
  const [submissions, setSubmissions] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Authentic items from CSV - Full supplier list
  const items = [
    // Fresh Food
    { "Item ": "Topside Beef", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿319.00" },
    { "Item ": "Brisket Point End", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿299.00" },
    { "Item ": "Chuck Roll Beef", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿319.00" },
    { "Item ": "Other Beef (Mixed)", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿310.00" },
    { "Item ": "Salad (Iceberg Lettuce)", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿99.00" },
    { "Item ": "Milk", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿80.00" },
    { "Item ": "Burger Bun", "Internal Category": "Fresh Food", "Supplier": "Bakery", "Cost ": "฿8.00" },
    { "Item ": "Tomatos", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿89.00" },
    { "Item ": "White Cabbage", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿45.00" },
    { "Item ": "Purple Cabbage", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿41.25" },
    { "Item ": "Onions Bulk 10kg", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿290.00" },
    { "Item ": "Onions (small bags)", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿29.00" },
    { "Item ": "Cheese", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿359.00" },
    { "Item ": "Bacon Short", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿305.00" },
    { "Item ": "Bacon Long", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿430.00" },
    { "Item ": "Jalapenos", "Internal Category": "Fresh Food", "Supplier": "Makro", "Cost ": "฿190.00" },
    
    // Frozen Food
    { "Item ": "French Fries 7mm", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿129.00" },
    { "Item ": "Chicken Nuggets", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿155.00" },
    { "Item ": "Chicken Fillets", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿199.00" },
    { "Item ": "Sweet Potato Fries", "Internal Category": "Frozen Food", "Supplier": "Makro", "Cost ": "฿145.00" },
    
    // Shelf Items
    { "Item ": "Cajun Fries Seasoning", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿508.00" },
    { "Item ": "Crispy Fried Onions", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿79.00" },
    { "Item ": "Pickles(standard dill pickles)", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿89.00" },
    { "Item ": "Pickles Sweet (standard)", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿89.00" },
    { "Item ": "Mustard", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿88.00" },
    { "Item ": "Mayonnaise", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿90.00" },
    { "Item ": "Tomato Sauce", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿175.00" },
    { "Item ": "Chili Sauce (Sriracha)", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿108.00" },
    { "Item ": "BBQ Sauce", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿110.00" },
    { "Item ": "Sriracha Sauce", "Internal Category": "Shelf Items", "Supplier": "Makro", "Cost ": "฿108.00" },
    { "Item ": "Salt (Coarse Sea Salt)", "Internal Category": "Shelf Items", "Supplier": "Online", "Cost ": "฿121.00" },
    
    // Kitchen Supplies
    { "Item ": "Oil (Fryer)", "Internal Category": "Kitchen Supplies", "Supplier": "Makro", "Cost ": "฿195.00" },
    
    // Drinks
    { "Item ": "Coke", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿315.00" },
    { "Item ": "Coke Zero", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿315.00" },
    { "Item ": "Fanta Orange", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿81.00" },
    { "Item ": "Fanta Strawberry", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿81.00" },
    { "Item ": "Schweppes Manow", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿84.00" },
    { "Item ": "Kids Juice (Orange)", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿99.00" },
    { "Item ": "Kids Juice (Apple)", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿99.00" },
    { "Item ": "Sprite", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿81.00" },
    { "Item ": "Soda Water", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿52.00" },
    { "Item ": "Bottled Water", "Internal Category": "Drinks", "Supplier": "Makro", "Cost ": "฿49.00" }
  ];

  useEffect(() => {
    const savedDraft = localStorage.getItem('dailyShiftDraft');
    if (savedDraft) {
      try {
        setFormData(JSON.parse(savedDraft));
        setErrorMessage('Draft loaded successfully.');
      } catch (error) {
        console.error('Error loading draft:', error);
        setErrorMessage('Error loading draft from storage.');
      }
    }
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  const handleNumberNeededChange = (itemName: string, value: string) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({
        ...formData,
        numberNeeded: { ...formData.numberNeeded, [itemName]: value }
      });
      setErrorMessage(''); // Clear error when valid input
    } else {
      setErrorMessage(`Invalid input for ${itemName}: Enter positive number or empty. Text/symbols not allowed to avoid database type errors.`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all inputs are numeric before submission
    for (const [item, value] of Object.entries(formData.numberNeeded)) {
      if (value && isNaN(parseFloat(value))) {
        setErrorMessage(`Invalid input for ${item}: Must be a number. Reasoning: Database expects numeric values; text causes syntax errors (22P02).`);
        return;
      }
    }
    
    // Prepare data with proper field mapping and numeric parsing
    const submitData = {
      completed_by: formData.completedBy,
      shift_type: formData.shiftType,
      shift_date: formData.shiftDate,
      numberNeeded: Object.fromEntries(
        Object.entries(formData.numberNeeded).map(([k, v]) => [k, parseFloat(v) || 0])
      ),
      status: 'completed',
      is_draft: false
    };

    try {
      const response = await axios.post('/api/daily-shift-forms', submitData);
      
      // Add to submissions display
      const newSubmission = { 
        ...response.data, 
        date: new Date().toLocaleString(),
        numberNeeded: formData.numberNeeded
      };
      setSubmissions([newSubmission, ...submissions]);
      
      // Reset form
      setFormData({ 
        completedBy: '',
        shiftType: '',
        shiftDate: new Date().toISOString().split('T')[0],
        numberNeeded: {} 
      });
      
      // Clear draft and error
      localStorage.removeItem('dailyShiftDraft');
      setErrorMessage('Form submitted successfully!');
      
    } catch (err) {
      const msg = err.response?.data?.error || 'Internal Server Error';
      setErrorMessage(`${msg}. Reasoning: Likely invalid data type in submission (e.g., non-number in numeric field). Check inputs and try again.`);
    }
  };

  const saveDraft = () => {
    localStorage.setItem('dailyShiftDraft', JSON.stringify(formData));
    setErrorMessage('Draft saved successfully.');
  };

  const groupedItems = items.reduce((acc, item) => {
    const cat = item["Internal Category"] || 'Other';
    if (cat) {
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
    }
    return acc;
  }, {} as Record<string, typeof items>);

  return (
    <div className="p-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-center">Daily Sales & Stock</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 rounded-lg bg-gray-700 shadow-lg">
          <div>
            <label className="block text-white font-semibold mb-2">Completed By</label>
            <input
              type="text"
              placeholder="Staff Name"
              value={formData.completedBy}
              onChange={(e) => handleInputChange('completedBy', e.target.value)}
              className="w-full p-2 bg-gray-600 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-white font-semibold mb-2">Shift Type</label>
            <select
              value={formData.shiftType}
              onChange={(e) => handleInputChange('shiftType', e.target.value)}
              className="w-full p-2 bg-gray-600 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            >
              <option value="">Select Shift</option>
              <option value="Day Shift">Day Shift</option>
              <option value="Evening Shift">Evening Shift</option>
              <option value="Night Shift">Night Shift</option>
            </select>
          </div>
          <div>
            <label className="block text-white font-semibold mb-2">Date</label>
            <input
              type="date"
              value={formData.shiftDate}
              onChange={(e) => handleInputChange('shiftDate', e.target.value)}
              className="w-full p-2 bg-gray-600 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
        </div>

        {/* Inventory Categories */}
        {Object.entries(groupedItems).map(([category, catItems]) => (
          <div key={category} className="mb-8 p-4 rounded-lg shadow-xl bg-gray-800 border border-gray-600">
            <h2 className="text-2xl font-bold uppercase tracking-wide mb-4 border-b-2 border-orange-500 pb-2 text-orange-500">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {catItems.map((item) => (
                <div key={item["Item "]} className="bg-white/10 p-4 rounded-lg border border-gray-600 hover:bg-white/20 transition-colors">
                  <label className="block mb-2 font-semibold text-white">{item["Item "]}</label>
                  <input
                    type="text"
                    placeholder="Number Needed"
                    value={formData.numberNeeded[item["Item "]] || ''}
                    onChange={(e) => handleNumberNeededChange(item["Item "], e.target.value)}
                    className="w-full p-2 bg-gray-700 text-white rounded border-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex space-x-4 justify-center">
          <button 
            type="button" 
            onClick={saveDraft} 
            className="bg-gray-500 hover:bg-gray-600 text-white px-8 py-3 rounded font-bold"
          >
            Save as Draft
          </button>
          <button 
            type="submit" 
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded font-bold"
          >
            Submit Form
          </button>
        </div>
      </form>

      {/* Error/Success Message */}
      {errorMessage && (
        <div className={`mt-4 p-4 rounded text-white ${errorMessage.includes('successfully') ? 'bg-green-500' : 'bg-red-500'}`}>
          <strong>{errorMessage.includes('successfully') ? 'Success:' : 'Error:'}</strong> {errorMessage}
        </div>
      )}

      {/* Submission List */}
      {submissions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-white">Recent Submissions</h2>
          <div className="space-y-2">
            {submissions.slice(0, 5).map((sub, index) => (
              <div key={index} className="p-3 bg-gray-700 rounded border border-gray-600">
                <div className="font-semibold">{sub.completedBy || 'Unknown'} - {sub.shiftType || 'Unknown Shift'}</div>
                <div className="text-sm text-gray-300">{sub.date}</div>
                <div className="text-sm text-gray-400">
                  {Object.entries(sub.numberNeeded || {}).filter(([_, value]) => value && value !== '0').length} items requested
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyShiftForm;
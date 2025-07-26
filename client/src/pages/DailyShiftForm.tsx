import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DailyShiftForm = () => {
  const [formData, setFormData] = useState({ numberNeeded: {} });
  const [submissions, setSubmissions] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Items from CSV (complete supplier list)
  const items = [
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

  const handleNumberNeededChange = (itemName, value) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData({
        ...formData,
        numberNeeded: { ...formData.numberNeeded, [itemName]: value }
      });
    } else {
      setErrorMessage(`Invalid input for ${itemName}: Only numbers or empty. Reasoning: Text/symbols cause DB errors (22P02).`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/daily-shift-forms', formData);
      setSubmissions([...submissions, { ...response.data, date: new Date().toLocaleString() }]);
      setFormData({ numberNeeded: {} });
      localStorage.removeItem('dailyShiftDraft');
      setErrorMessage('');
    } catch (err) {
      const msg = err.response?.data?.error || 'Internal Server Error';
      setErrorMessage(`${msg}. Reasoning: Likely type mismatch (e.g., non-number in numeric field). Check inputs and try again.`);
    }
  };

  const saveDraft = () => {
    localStorage.setItem('dailyShiftDraft', JSON.stringify(formData));
    setErrorMessage('Draft saved.');
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
    <div className="p-4 sm:p-6 bg-gradient-to-r from-gray-800 to-gray-900 text-white min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">Daily Sales & Stock</h1>
      <form onSubmit={handleSubmit}>
        {Object.entries(groupedItems).map(([category, catItems]) => (
          <div key={category} className="mb-6 sm:mb-8 shadow-md rounded-lg p-4 sm:p-6 bg-gray-800">
            <h2 className="text-xl font-bold uppercase tracking-wide mb-3 sm:mb-4 border-b border-gray-600 pb-2">{category}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {catItems.map((item) => (
                <div key={item["Item "]} className="bg-white/10 p-3 sm:p-4 rounded-lg">
                  <label className="block mb-1 sm:mb-2 font-semibold text-sm sm:text-base">{item["Item "]}</label>
                  <input
                    type="text"
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
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <button type="button" onClick={saveDraft} className="bg-gray-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded font-bold text-sm sm:text-base">Save as Draft</button>
          <button type="submit" className="bg-orange-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded font-bold text-sm sm:text-base">Submit Form</button>
        </div>
      </form>
      {errorMessage && (
        <div className="mt-4 p-3 sm:p-4 bg-red-500 rounded text-white text-sm sm:text-base">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}
      <h2 className="text-xl font-bold mt-6 sm:mt-8 mb-4">Submission List</h2>
      <ul className="list-disc pl-5 text-sm sm:text-base">
        {submissions.map((sub, index) => (
          <li key={index} className="mb-4">
            <strong>{sub.date}</strong>: {Object.entries(sub.numberNeeded).map(([item, value]) => `${item}: ${value}`).join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DailyShiftForm;
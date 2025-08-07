import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearch } from 'wouter';

export default function DailyStockForm() {
  const searchParams = new URLSearchParams(useSearch());
  const salesFormId = searchParams.get('salesId') || '';

  const [ingredients, setIngredients] = useState<any[]>([]);
  const [form, setForm] = useState({
    meatWeight: '',
    burgerBunsStock: '',
    drinkStock: {},
    freshFood: {},
    frozenFood: {},
    shelfItems: {},
    kitchenSupplies: {},
    packaging: {},
  });

  const categoriesOrder = [
    'Fresh Food',
    'Frozen Food', 
    'Shelf Items',
    'Kitchen Supplies',
    'Packaging',
  ];

  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const res = await axios.get('/api/ingredients');
        setIngredients(res.data);
      } catch (err) {
        console.error('Failed to fetch ingredients:', err);
      }
    };
    fetchIngredients();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDrinkChange = (drink: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      drinkStock: { ...prev.drinkStock, [drink]: parseInt(value) || 0 },
    }));
  };

  const handleIngredientChange = (category: string, name: string, value: string) => {
    const categoryKey = category.replace(/\s+/g, '').toLowerCase();
    const formattedKey = categoryKey === 'freshfood' ? 'freshFood' : 
                        categoryKey === 'frozenfood' ? 'frozenFood' :
                        categoryKey === 'shelfitems' ? 'shelfItems' :
                        categoryKey === 'kitchensupplies' ? 'kitchenSupplies' :
                        categoryKey;
    
    setForm((prev) => ({
      ...prev,
      [formattedKey]: {
        ...prev[formattedKey as keyof typeof prev],
        [name]: parseInt(value) || 0,
      },
    }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await axios.post('/api/daily-stock', { 
        ...form, 
        salesFormId,
        meatWeight: parseInt(form.meatWeight) || 0,
        burgerBunsStock: parseInt(form.burgerBunsStock) || 0
      });
      alert('Stock submitted successfully');
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to submit stock form:', err);
      alert('Failed to submit stock form');
    }
  };

  // Sort and group ingredients
  const groupedIngredients = categoriesOrder.reduce((acc, category) => {
    acc[category] = ingredients.filter((i) => i.category === category);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold mb-4">Daily Stock Form</h1>
      
      {salesFormId && (
        <div className="text-sm text-gray-600 mb-4">
          Linked to Sales Form: {salesFormId}
        </div>
      )}

      {/* Meat & Rolls */}
      <div className="grid grid-cols-2 gap-4">
        <input 
          className="input" 
          type="number" 
          placeholder="Meat Weight (grams)" 
          value={form.meatWeight} 
          onChange={(e) => handleChange('meatWeight', e.target.value)} 
        />
        <input 
          className="input" 
          type="number" 
          placeholder="Burger Buns Stock" 
          value={form.burgerBunsStock} 
          onChange={(e) => handleChange('burgerBunsStock', e.target.value)} 
        />
      </div>

      {/* Drinks */}
      <div>
        <h2 className="font-bold mb-2">Drink Stock</h2>
        <div className="grid grid-cols-2 gap-4">
          {['Coke', 'Sprite', 'Fanta', 'Water'].map((drink) => (
            <input 
              key={drink} 
              type="number" 
              className="input" 
              placeholder={`${drink} quantity`} 
              onChange={(e) => handleDrinkChange(drink, e.target.value)} 
            />
          ))}
        </div>
      </div>

      {/* Ingredient Sections */}
      {categoriesOrder.map((category) => (
        <div key={category} className="border rounded-lg p-4">
          <h2 className="font-bold text-lg mb-3">{category}</h2>
          <div className="grid grid-cols-2 gap-4">
            {groupedIngredients[category]?.map((item) => (
              <div key={item.name} className="flex flex-col">
                <label className="text-sm font-medium mb-1">{item.name}</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Qty to purchase"
                  onChange={(e) => handleIngredientChange(category, item.name, e.target.value)}
                />
              </div>
            ))}
          </div>
          {(!groupedIngredients[category] || groupedIngredients[category].length === 0) && (
            <p className="text-gray-500 text-sm">No items in this category</p>
          )}
        </div>
      ))}

      {/* Submit */}
      <button 
        onClick={handleSubmit} 
        className="bg-black text-white px-6 py-3 rounded w-full text-lg font-medium"
      >
        Submit Stock Form
      </button>
    </div>
  );
}
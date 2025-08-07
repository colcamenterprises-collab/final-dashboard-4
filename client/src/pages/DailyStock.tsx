import { useEffect, useState } from 'react';
import axios from 'axios';
import { useLocation } from 'wouter';

function DailyStockForm() {
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1]);
  const salesId = urlParams.get('salesId') || '';
  
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [form, setForm] = useState({
    burgerBuns: '',
    meatGrams: '',
    drinks: {} as Record<string, number>,
    ingredients: {} as Record<string, number>,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const res = await axios.get('/api/ingredients');
        setIngredients(res.data || []);
      } catch (error) {
        console.error('Failed to load ingredients:', error);
        setIngredients([]);
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
      drinks: { ...prev.drinks, [drink]: parseInt(value) || 0 },
    }));
  };

  const handleIngredientChange = (name: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      ingredients: { ...prev.ingredients, [name]: parseInt(value) || 0 },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post('/api/daily-stock', { 
        ...form, 
        salesFormId: salesId,
        burgerBuns: parseInt(form.burgerBuns),
        meatGrams: parseInt(form.meatGrams)
      });
      alert('Stock submitted successfully! Your daily forms are complete.');
      window.location.href = '/'; // Redirect to dashboard
    } catch (error) {
      console.error('Failed to submit stock form:', error);
      alert('Failed to submit stock form. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!salesId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: No sales form ID provided. Please start from the Daily Sales form.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Daily Stock Count & Purchasing</h1>
      <p className="text-gray-600 mb-6">Sales ID: {salesId}</p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Stock */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Basic Stock Counts</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Burger Buns Remaining</label>
              <input 
                type="number" 
                placeholder="0" 
                className="input" 
                value={form.burgerBuns} 
                onChange={(e) => handleChange('burgerBuns', e.target.value)}
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Meat Weight (grams)</label>
              <input 
                type="number" 
                placeholder="0" 
                className="input" 
                value={form.meatGrams} 
                onChange={(e) => handleChange('meatGrams', e.target.value)}
                required 
              />
            </div>
          </div>
        </div>

        {/* Drink Stock */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Drink Stock</h2>
          <div className="grid grid-cols-2 gap-4">
            {['Coke', 'Sprite', 'Fanta', 'Water', 'Orange Juice', 'Beer'].map((drink) => (
              <div key={drink}>
                <label className="block text-sm font-medium mb-1">{drink}</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  className="input" 
                  onChange={(e) => handleDrinkChange(drink, e.target.value)} 
                />
              </div>
            ))}
          </div>
        </div>

        {/* Ingredient Purchasing */}
        <div className="bg-white p-4 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Ingredient Purchasing Needs</h2>
          <p className="text-sm text-gray-600 mb-4">Enter quantities needed for tomorrow's service</p>
          
          {ingredients.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto">
              {ingredients.map((item) => (
                <div key={item.id || item.name}>
                  <label className="block text-sm font-medium mb-1">
                    {item.name} ({item.category})
                  </label>
                  <input 
                    type="number" 
                    className="input" 
                    placeholder="0" 
                    onChange={(e) => handleIngredientChange(item.name, e.target.value)} 
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Loading ingredients...</p>
          )}
        </div>

        <button 
          type="submit" 
          className="bg-black text-white px-6 py-3 rounded-lg w-full hover:bg-gray-800 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Stock Report & Complete Daily Forms'}
        </button>
      </form>
    </div>
  );
}

export default DailyStockForm;
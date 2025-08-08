import React, { useState } from 'react';
import { useSearch, useLocation } from 'wouter';
import stockItems from '../../../data/stock_items_by_category.json';

const DailyStockForm = () => {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(useSearch());
  const salesFormId = searchParams.get('salesId');

  const [formData, setFormData] = useState({
    meatGrams: '',
    burgerBuns: '',
    drinks: {} as Record<string, number>,
    stockRequests: {} as Record<string, number>,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDrinkChange = (drink: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      drinks: { ...prev.drinks, [drink]: parseInt(value) || 0 }
    }));
  };

  const handleStockRequestChange = (item: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      stockRequests: { ...prev.stockRequests, [item]: parseInt(value) || 0 }
    }));
  };

  const toGrams = (v: string | number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    // if looks like kg (e.g., 5.5) and small, convert to grams
    return n <= 50 && String(v).includes('.') ? Math.round(n * 1000) : Math.round(n);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        salesFormId,
        meatGrams: toGrams(formData.meatGrams),  // handles 5.5 -> 5500
        burgerBuns: Number(formData.burgerBuns) || 0,
        drinks: formData.drinks,
        stockRequests: formData.stockRequests,
      };

      const response = await fetch('/api/daily-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert('Stock form submitted successfully! Email sent to management.');
        setLocation('/form-library');
      } else {
        alert('Failed to submit stock form');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      alert('Error submitting form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Daily Stock Form</h1>
      
      {salesFormId && (
        <div className="mb-4 p-3 bg-blue-50 rounded border">
          Linked to Sales Form: {salesFormId}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Meat Count */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Meat Count</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Meat (kg or grams)</label>
              <input
                type="number"
                step="0.1"
                value={formData.meatGrams}
                onChange={(e) => handleInputChange('meatGrams', e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="5.5 (kg) or 5500 (grams)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Burger Buns Count</label>
              <input
                type="number"
                value={formData.burgerBuns}
                onChange={(e) => handleInputChange('burgerBuns', e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        {/* Drink Count */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Drink Count</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {stockItems.Drinks.map((drink) => (
              <div key={drink}>
                <label className="block text-sm font-medium mb-1">{drink}</label>
                <input
                  type="number"
                  onChange={(e) => handleDrinkChange(drink, e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Fresh Food */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Fresh Food</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems["Fresh Food"].map((item) => (
              <div key={item}>
                <label className="block text-sm font-medium mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Frozen Food */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Frozen Food</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems["Frozen Food"].map((item) => (
              <div key={item}>
                <label className="block text-sm font-medium mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Shelf Items */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Shelf Items</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems["Shelf Items"].map((item) => (
              <div key={item}>
                <label className="block text-sm font-medium mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Kitchen Supplies */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Kitchen Supplies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems["Kitchen Supplies"].map((item) => (
              <div key={item}>
                <label className="block text-sm font-medium mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Packaging */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Packaging</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems.Packaging.map((item) => (
              <div key={item}>
                <label className="block text-sm font-medium mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-black text-white py-3 px-6 rounded font-medium disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Stock Form'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DailyStockForm;
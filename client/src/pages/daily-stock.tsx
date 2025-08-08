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
    <div className="space-y-3 md:space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">Daily Stock Form</h1>
      
      {salesFormId && (
        <div className="mb-4 p-3 bg-blue-50 rounded border text-sm md:text-base">
          Linked to Sales Form: {salesFormId}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 md:space-y-4">
        {/* Meat Count */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Meat Count</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Meat (kg or grams)</label>
              <input
                type="number"
                step="0.1"
                value={formData.meatGrams}
                onChange={(e) => handleInputChange('meatGrams', e.target.value)}
                className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                placeholder="5.5 (kg) or 5500 (grams)"
              />
            </div>
            <div>
              <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">Burger Buns Count</label>
              <input
                type="number"
                value={formData.burgerBuns}
                onChange={(e) => handleInputChange('burgerBuns', e.target.value)}
                className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                placeholder="0"
              />
            </div>
          </div>
        </section>

        {/* Drink Count */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Drink Count</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {stockItems.Drinks.map((drink) => (
              <div key={drink}>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">{drink}</label>
                <input
                  type="number"
                  onChange={(e) => handleDrinkChange(drink, e.target.value)}
                  className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Fresh Food */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Fresh Food</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {stockItems["Fresh Food"].map((item) => (
              <div key={item}>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Frozen Food */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Frozen Food</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {stockItems["Frozen Food"].map((item) => (
              <div key={item}>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Shelf Items */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Shelf Items</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {stockItems["Shelf Items"].map((item) => (
              <div key={item}>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Kitchen Supplies */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Kitchen Supplies</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {stockItems["Kitchen Supplies"].map((item) => (
              <div key={item}>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Packaging */}
        <section className="bg-white border rounded-lg p-3 md:p-4 mb-3 md:mb-4">
          <h2 className="text-lg md:text-xl font-semibold mb-2">Packaging</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {stockItems.Packaging.map((item) => (
              <div key={item}>
                <label className="block text-sm md:text-base font-medium text-gray-700 mb-1">{item}</label>
                <input
                  type="number"
                  onChange={(e) => handleStockRequestChange(item, e.target.value)}
                  className="w-full h-11 md:h-10 rounded-md border px-3 text-sm md:text-base"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Submit Button */}
        <div className="pt-3 md:pt-6">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto bg-black text-white px-6 py-3 rounded-md text-sm md:text-base font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400"
          >
            {submitting ? 'Submitting...' : 'Submit Stock Form'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default DailyStockForm;
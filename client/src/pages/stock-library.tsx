import React, { useState, useEffect } from 'react';

interface StockForm {
  id: string;
  createdAt: string;
  meatGrams: number;
  burgerBuns: number;
  drinkStock: Record<string, number>;
  stockRequests: Record<string, number>;
}

const StockLibrary = () => {
  const [stockForms, setStockForms] = useState<StockForm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStockForms();
  }, []);

  const fetchStockForms = async () => {
    try {
      const response = await fetch('/api/daily-stock');
      if (response.ok) {
        const data = await response.json();
        setStockForms(data);
      }
    } catch (error) {
      console.error('Error fetching stock forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const countNonZero = (obj: Record<string, number>) => {
    return Object.values(obj).filter(val => val > 0).length;
  };

  if (loading) {
    return <div className="p-6">Loading stock forms...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Stock Forms Library</h1>
      
      {stockForms.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No stock forms found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Meat (grams)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Burger Buns
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Drinks Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock Requests Count
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stockForms.map((form) => (
                <tr key={form.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(form.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {form.meatGrams}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {form.burgerBuns}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {countNonZero(form.drinkStock)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {countNonZero(form.stockRequests)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockLibrary;
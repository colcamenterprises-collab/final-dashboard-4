import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

// Currency formatter
const THB = (amount: number) => {
  if (amount === 0) return '฿0.00';
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2
  }).format(amount / 100);
};

export default function ViewDailySales() {
  const [location] = useLocation();
  const [salesData, setSalesData] = useState<any>(null);
  const [stockData, setStockData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Extract ID from query params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const salesId = urlParams.get('id');

  useEffect(() => {
    if (!salesId) return;
    
    const fetchData = async () => {
      try {
        // Fetch sales data
        const salesRes = await fetch(`/api/daily-sales/${salesId}`);
        if (salesRes.ok) {
          const sales = await salesRes.json();
          setSalesData(sales);
          
          // Try to fetch corresponding stock data
          const stockRes = await fetch(`/api/daily-stock?salesId=${salesId}`);
          if (stockRes.ok) {
            const stock = await stockRes.json();
            setStockData(stock);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [salesId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg border p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading form data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!salesData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-red-600">Sales form not found</p>
            <a href="/operations/daily-sales/library" className="text-teal-600 hover:underline mt-2 inline-block">
              Return to Library
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 font-['Poppins']">Daily Sales & Stock Form</h1>
              <p className="text-gray-600 mt-1">
                Date: {salesData.createdAt ? new Date(salesData.createdAt).toLocaleDateString() : 'N/A'} | 
                Completed by: {salesData.completedBy || 'N/A'}
              </p>
            </div>
            <a 
              href="/operations/daily-sales/library" 
              className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 transition-colors"
            >
              Back to Library
            </a>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          
          {/* Sales Form Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 font-['Poppins']">Sales Information</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Starting Cash</label>
                  <p className="text-lg font-semibold text-gray-900">{THB(salesData.startingCash || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Closing Cash</label>
                  <p className="text-lg font-semibold text-gray-900">{THB(salesData.closingCash || 0)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cash Banked</label>
                  <p className="text-lg font-semibold text-gray-900">{THB(salesData.cashBanked || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">QR Transferred</label>
                  <p className="text-lg font-semibold text-gray-900">{THB(salesData.qrTransferred || 0)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Sales</label>
                  <p className="text-lg font-semibold text-green-600">{THB(salesData.totalSales || 0)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Expenses</label>
                  <p className="text-lg font-semibold text-red-600">{THB(salesData.totalExpenses || 0)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Variance</label>
                <p className={`text-lg font-semibold ${Math.abs(salesData.variance || 0) > 20 ? 'text-amber-600' : 'text-green-600'}`}>
                  {THB(salesData.variance || 0)}
                </p>
              </div>

              {salesData.aroiDeeSales && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Aroi Dee Sales</label>
                  <p className="text-lg font-semibold text-gray-900">{THB(salesData.aroiDeeSales)}</p>
                </div>
              )}

              {(salesData.burgerBunsCount || salesData.meatCount) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Burger Buns Count</label>
                    <p className="text-lg font-semibold text-gray-900">{salesData.burgerBunsCount || 0}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Meat Count</label>
                    <p className="text-lg font-semibold text-gray-900">{salesData.meatCount || 0}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stock Form Section */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 font-['Poppins']">Stock Information</h2>
            
            {stockData ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <p className="text-lg font-semibold text-green-600">Completed</p>
                  <p className="text-sm text-gray-600">Completed by: {stockData.completedBy || 'N/A'}</p>
                </div>

                {stockData.stockItems && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Stock Items</label>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto">
                      {Object.entries(stockData.stockItems).map(([item, quantity]: [string, any]) => (
                        <div key={item} className="flex justify-between py-1 border-b border-gray-200 last:border-b-0">
                          <span className="text-sm text-gray-700">{item}</span>
                          <span className="text-sm font-medium text-gray-900">{quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stockData.shoppingList && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Shopping List</label>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">{stockData.shoppingList}</pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500">No stock form submitted</p>
                <p className="text-sm text-gray-400 mt-1">Stock information not available for this shift</p>
              </div>
            )}
          </div>
        </div>

        {/* Form Data Details */}
        {salesData.formData && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 font-['Poppins']">Detailed Form Data</h2>
            <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-700">{JSON.stringify(salesData.formData, null, 2)}</pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
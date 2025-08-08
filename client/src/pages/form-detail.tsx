import { useEffect, useState } from 'react';
import axios from 'axios';

export default function FormDetail() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id')!;
  const shouldPrint = params.get('print') === '1';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    axios.get(`/api/forms/${id}`)
      .then(r => {
        setData(r.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading form:', err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (shouldPrint && data) {
      setTimeout(() => window.print(), 300);
    }
  }, [shouldPrint, data]);

  if (loading) return (
    <div className="p-6 flex items-center justify-center">
      <div className="animate-pulse text-gray-600">Loading form details...</div>
    </div>
  );

  if (!data) return (
    <div className="p-6 text-center">
      <div className="text-red-600 mb-4">Form not found</div>
      <button onClick={() => window.close()} className="text-blue-600 underline">
        Close Window
      </button>
    </div>
  );

  const s = data.sales, st = data.stock;
  const totalSales = (s.totalSales ?? (s.cashSales + s.qrSales + s.grabSales + s.aroiDeeSales)) || 0;

  return (
    <div className="p-6 max-w-3xl mx-auto print:max-w-full print:p-4">
      {/* Header */}
      <div className="border-b pb-4 mb-6 print:border-gray-300">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Submission Report</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-semibold">Form ID:</span>
            <div className="font-mono text-xs mt-1">{s.id}</div>
          </div>
          <div>
            <span className="font-semibold">Date:</span>
            <div className="mt-1">{new Date(s.createdAt).toLocaleString('en-TH')}</div>
          </div>
          <div>
            <span className="font-semibold">Completed By:</span>
            <div className="mt-1 font-medium">{s.completedBy}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1 print:gap-4">
        {/* Sales Section */}
        <section className="bg-blue-50 p-4 rounded-lg print:bg-white print:border print:border-gray-300">
          <h2 className="font-bold text-lg mb-3 text-blue-900">💰 Sales Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Cash Sales:</span>
              <span className="font-mono">฿{s.cashSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>QR Payments:</span>
              <span className="font-mono">฿{s.qrSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Grab Food:</span>
              <span className="font-mono">฿{s.grabSales.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Aroi Dee:</span>
              <span className="font-mono">฿{s.aroiDeeSales.toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total Sales:</span>
              <span className="font-mono text-green-600">฿{totalSales.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Expenses Section */}
        <section className="bg-red-50 p-4 rounded-lg print:bg-white print:border print:border-gray-300">
          <h2 className="font-bold text-lg mb-3 text-red-900">💳 Expenses</h2>
          <div className="flex justify-between font-semibold">
            <span>Total Expenses:</span>
            <span className="font-mono text-red-600">฿{(s.totalExpenses ?? 0).toFixed(2)}</span>
          </div>
        </section>

        {/* Banking Section */}
        <section className="bg-green-50 p-4 rounded-lg print:bg-white print:border print:border-gray-300">
          <h2 className="font-bold text-lg mb-3 text-green-900">🏦 Banking</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Closing Cash:</span>
              <span className="font-mono">฿{s.closingCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cash Banked:</span>
              <span className="font-mono">฿{s.cashBanked.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>QR Transfer:</span>
              <span className="font-mono">฿{s.qrTransferred.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Stock Section */}
        <section className="bg-yellow-50 p-4 rounded-lg print:bg-white print:border print:border-gray-300">
          <h2 className="font-bold text-lg mb-3 text-yellow-900">📦 Stock Status</h2>
          {st ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Inventory Counts</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Meat (grams):</span>
                    <span className="font-mono">{st.meatGrams}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Burger Buns:</span>
                    <span className="font-mono">{st.burgerBuns}</span>
                  </div>
                </div>
              </div>

              {/* Drinks with stock > 0 */}
              {Object.entries(st.drinkStock || {}).filter(([, n]) => (n as number) > 0).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Drinks Available</h3>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(st.drinkStock || {})
                      .filter(([, n]) => (n as number) > 0)
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span>{k}:</span>
                          <span className="font-mono">{v as number}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {/* Purchase Requests > 0 */}
              {Object.entries(st.stockRequests || {}).filter(([, n]) => (n as number) > 0).length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Purchase Requests</h3>
                  <ul className="space-y-1 text-sm">
                    {Object.entries(st.stockRequests || {})
                      .filter(([, n]) => (n as number) > 0)
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span>{k}:</span>
                          <span className="font-mono text-red-600">{v as number} needed</span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-red-600 font-medium">
              ❌ Stock form not submitted yet
            </div>
          )}
        </section>
      </div>

      {/* Print Controls */}
      {!shouldPrint && (
        <div className="mt-8 pt-4 border-t print:hidden">
          <div className="flex gap-4">
            <button 
              onClick={() => window.print()} 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Print Form
            </button>
            <button 
              onClick={() => window.close()} 
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
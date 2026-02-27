import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import axios from 'axios';

type Row = {
  id: string;
  createdAt: string;
  completedBy: string;
  totalSales: number;
  meatGrams: number;
  burgerBuns: number;
  shoppingListCount: number;
  shoppingPreview: string[];
};

export default function FormLibrary() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/forms').then(r => { setRows(r.data); setLoading(false); })
      .catch(err => {
        console.error('Error loading forms:', err);
        setLoading(false);
      });
  }, []);

  const emailForm = async (id: string) => {
    try {
      await axios.post(`/api/forms/${id}/email`);
      alert('Email sent successfully!');
    } catch (error) {
      console.error('Email error:', error);
      alert('Failed to send email');
    }
  };

  const printForm = (id: string) => {
    window.open(`/form-detail?id=${id}&print=1`, '_blank');
  };

  if (loading) return (
    <div className="p-6">
      <div className="animate-pulse">Loading forms...</div>
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-2xl md:text-3xl font-bold">Form Library</h1>
        <div className="text-sm md:text-base text-gray-600">
          {rows.length} form{rows.length !== 1 ? 's' : ''} found
        </div>
      </div>
      
      <div className="overflow-x-auto bg-white border rounded-lg">
        <table className="min-w-full border-collapse text-sm md:text-base">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-2 md:p-3 text-left font-semibold text-xs md:text-sm">Date</th>
              <th className="p-2 md:p-3 text-left font-semibold text-xs md:text-sm hidden sm:table-cell">Form ID</th>
              <th className="p-2 md:p-3 text-left font-semibold text-xs md:text-sm">Completed By</th>
              <th className="p-2 md:p-3 text-left font-semibold text-xs md:text-sm">Total Sales</th>
              <th className="p-2 md:p-3 text-left font-semibold text-xs md:text-sm hidden md:table-cell">Stock (Meat/Buns)</th>
              <th className="p-2 md:p-3 border text-xs md:text-sm hidden lg:table-cell">Shopping Items</th>
              <th className="p-2 md:p-3 text-left font-semibold text-xs md:text-sm">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-2 md:p-3 border-b text-xs md:text-sm">
                  <div className="sm:hidden font-medium">{r.completedBy}</div>
                  {new Date(r.createdAt).toLocaleString('en-TH', {
                    year: '2-digit',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
                <td className="p-2 md:p-3 border-b hidden sm:table-cell">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {r.id.slice(0,8)}...
                  </code>
                </td>
                <td className="p-2 md:p-3 border-b font-medium text-xs md:text-sm hidden sm:table-cell">{r.completedBy}</td>
                <td className="p-2 md:p-3 border-b text-xs md:text-sm">
                  <span className="font-mono">฿{(r.totalSales ?? 0).toFixed(2)}</span>
                </td>
                <td className="p-2 md:p-3 border-b text-xs md:text-sm hidden md:table-cell">
                  <div className="text-green-600 font-medium">
                    {r.meatGrams}g • {r.burgerBuns}
                  </div>
                </td>
                <td className="p-2 md:p-3 border text-xs md:text-sm hidden lg:table-cell" title={(r.shoppingPreview || []).join(', ')}>
                  {r.shoppingListCount ?? 0}
                </td>
                <td className="p-2 md:p-3 border-b">
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-2">
                    <Link 
                      href={`/form-detail?id=${r.id}`} 
                      className="text-blue-600 hover:text-blue-800 underline text-xs md:text-sm"
                    >
                      View
                    </Link>
                    <button 
                      onClick={() => printForm(r.id)} 
                      className="text-green-600 hover:text-green-800 underline text-xs md:text-sm text-left"
                    >
                      Print
                    </button>
                    <button 
                      onClick={() => emailForm(r.id)} 
                      className="text-purple-600 hover:text-purple-800 underline text-xs md:text-sm text-left"
                    >
                      Email
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {rows.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No forms found. Submit your first daily sales form to see it here.
          </div>
        )}
      </div>
    </div>
  );
}

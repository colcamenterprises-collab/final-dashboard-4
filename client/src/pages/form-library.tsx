import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import axios from 'axios';

type Row = {
  id: string;
  createdAt: string;
  completedBy: string;
  totalSales: number;
  hasStock: boolean;
  meatGrams: number | null;
  burgerBuns: number | null;
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Form Library</h1>
        <div className="text-sm text-gray-600">
          {rows.length} form{rows.length !== 1 ? 's' : ''} found
        </div>
      </div>
      
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-3 text-left font-semibold">Date</th>
              <th className="p-3 text-left font-semibold">Form ID</th>
              <th className="p-3 text-left font-semibold">Completed By</th>
              <th className="p-3 text-left font-semibold">Total Sales</th>
              <th className="p-3 text-left font-semibold">Stock Status</th>
              <th className="p-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, index) => (
              <tr key={r.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3 border-b">
                  {new Date(r.createdAt).toLocaleString('en-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </td>
                <td className="p-3 border-b">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {r.id.slice(0,8)}...
                  </code>
                </td>
                <td className="p-3 border-b font-medium">{r.completedBy}</td>
                <td className="p-3 border-b">
                  <span className="font-mono">฿{(r.totalSales ?? 0).toFixed(2)}</span>
                </td>
                <td className="p-3 border-b">
                  {r.hasStock ? (
                    <div className="text-green-600">
                      <div>✓ Complete</div>
                      <div className="text-xs text-gray-600">
                        Meat: {r.meatGrams}g • Buns: {r.burgerBuns}
                      </div>
                    </div>
                  ) : (
                    <span className="text-amber-600">⏳ Stock Pending</span>
                  )}
                </td>
                <td className="p-3 border-b">
                  <div className="flex gap-2">
                    <Link 
                      href={`/form-detail?id=${r.id}`} 
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      View
                    </Link>
                    <button 
                      onClick={() => printForm(r.id)} 
                      className="text-green-600 hover:text-green-800 underline text-sm"
                    >
                      Print
                    </button>
                    <button 
                      onClick={() => emailForm(r.id)} 
                      className="text-purple-600 hover:text-purple-800 underline text-sm"
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
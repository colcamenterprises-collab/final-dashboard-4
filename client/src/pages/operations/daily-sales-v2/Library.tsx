// 🚫 GOLDEN FILE — DO NOT MODIFY WITHOUT CAM'S APPROVAL
// Active Daily Sales & Stock system (V2).

// Do not do this:
// – Do not rename, move, or split this file
// – Do not change API routes
// – Do not add dependencies
// – Only apply exactly what is written below

import React, { useEffect, useState } from "react";

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type RecordType = {
  id: string;
  date: string;
  staff: string;
  totalSales: number;
  buns: string;
  meat: string;
  status: string;
  payload?: { balanced?: boolean };
  deletedAt?: string | null;
};

type FullRecord = {
  id: string;
  date: string;
  staff: string;
  sales: any;
  expenses: any;
  banking: any;
  stock: any;
  shoppingList: { name: string; qty: number; unit: string }[];
};

export default function DailySalesV2Library() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<FullRecord | null>(null);

  async function fetchRecords() {
    setLoading(true);
    try {
      const res = await fetch("/api/forms/daily-sales/v2");
      const data = await res.json();
      if (data.ok && data.records) {
        setRecords(data.records);
      } else {
        setError("No records found");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  async function deleteRecord(id: string) {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await fetch(`/api/forms/daily-sales/v2/${id}`, { method: "DELETE" });
        fetchRecords();
        alert('Record deleted successfully');
      } catch (err) {
        alert('Failed to delete record');
      }
    }
  }
  
  function printRecord(id: string) {
    window.open(`/api/forms/daily-sales/v2/${id}/print`, '_blank');
  }
  
  function downloadRecord(record: RecordType) {
    try {
      // Simple CSV download for now since jsPDF isn't imported yet
      const csvContent = `Date,Staff,Total Sales,Rolls,Meat,Status\n${record.date},${record.staff},${record.totalSales},${record.rolls},${record.meat},${record.status}`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-sales-${record.date}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download record');
    }
  }

  async function restoreRecord(id: string) {
    await fetch(`/api/forms/daily-sales/v2/${id}/restore`, { method: "PATCH" });
    fetchRecords();
  }

  async function viewRecord(id: string) {
    const res = await fetch(`/api/forms/daily-sales/v2/${id}`);
    const data = await res.json();
    if (data.ok) {
      const record = data.record;
      const p = record.payload || {};
      
      // Transform the data to match expected structure
      const transformedRecord = {
        id: record.id,
        date: record.date,
        staff: record.staff,
        sales: {
          cash: p.cashSales || 0,
          qr: p.qrSales || 0,
          grab: p.grabSales || 0,
          other: p.otherSales || 0,
          total: p.totalSales || 0
        },
        expenses: p.expenses || [],
        wages: p.wages || [],
        banking: {
          startingCash: p.startingCash || 0,
          closingCash: p.closingCash || 0,
          cashBanked: p.cashBanked || 0,
          qrTransfer: p.qrTransfer || 0
        },
        stock: {
          rolls: p.rollsEnd || 0,
          meat: p.meatEnd || 0
        },
        shoppingList: p.requisition || []
      };
      
      setSelected(transformedRecord);
    }
  }

  function editRecord(id: string) {
    window.location.href = `/operations/daily-sales/edit/${id}`;
  }

  const filteredRecords = showArchived
    ? records.filter((r) => r.deletedAt)
    : records.filter((r) => !r.deletedAt);

  return (
    <div className="p-3 md:p-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <h1 className="text-xl md:text-2xl font-extrabold font-[Poppins]">
          Daily Sales Library (V2)
        </h1>
        <button
          className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm sm:text-base w-full sm:w-auto"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Show Active" : "Show Archived"}
        </button>
      </div>

      {loading && <p className="text-center py-4">Loading...</p>}
      {error && <p className="text-red-500 text-center py-4">{error}</p>}
      
      {/* Desktop Table - Hidden on Mobile */}
      <div className="hidden lg:block">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead>
            <tr className="bg-gray-100 text-left text-sm font-semibold font-[Poppins]">
              <th className="p-2 border-b">Date</th>
              <th className="p-2 border-b">Staff</th>
              <th className="p-2 border-b">Total Sales</th>
              <th className="p-2 border-b">Rolls</th>
              <th className="p-2 border-b">Meat</th>
              <th className="p-2 border-b">Balanced</th>
              <th className="p-2 border-b">Status</th>
              <th className="p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-500">
                  No records found
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => (
                <tr key={rec.id} className="text-sm font-[Poppins] hover:bg-gray-50">
                  <td className="p-2 border-b">
                    {new Date(rec.date).toLocaleDateString()}
                  </td>
                  <td className="p-2 border-b">{rec.staff}</td>
                  <td className="p-2 border-b">{thb(rec.totalSales)}</td>
                  <td className="p-2 border-b">{rec.buns}</td>
                  <td className="p-2 border-b">{rec.meat}</td>
                  <td className="p-2 border-b">
                    {rec.payload?.balanced ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700">
                        Balanced
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700">
                        Not Balanced
                      </span>
                    )}
                  </td>
                  <td className="p-2 border-b">
                    {rec.deletedAt ? (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        Archived
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        {rec.status}
                      </span>
                    )}
                  </td>
                  <td className="p-2 border-b">
                    <div className="flex flex-wrap gap-1">
                      <button
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-black font-[Poppins] rounded text-xs"
                        onClick={() => viewRecord(rec.id)}
                      >
                        View
                      </button>
                      <button
                        className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-[Poppins] rounded text-xs"
                        onClick={() => printRecord(rec.id)}
                      >
                        Print
                      </button>
                      <button
                        className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded text-xs"
                        onClick={() => downloadRecord(rec)}
                      >
                        Download
                      </button>
                      {!rec.deletedAt && (
                        <>
                          <button
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-black font-[Poppins] rounded text-xs"
                            onClick={() => editRecord(rec.id)}
                          >
                            Edit
                          </button>
                          <button
                            className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-[Poppins] rounded text-xs"
                            onClick={() => deleteRecord(rec.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {rec.deletedAt && (
                        <button
                          className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded text-xs"
                          onClick={() => restoreRecord(rec.id)}
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout - Shown on Small Screens */}
      <div className="lg:hidden space-y-4">
        {filteredRecords.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500">
            No records found
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold font-[Poppins] text-lg">
                    {new Date(rec.date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-600 text-sm">By: {rec.staff}</p>
                </div>
                <div className="text-right">
                  {rec.deletedAt ? (
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                      Archived
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      {rec.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Sales Info */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Total Sales</p>
                  <p className="font-semibold">{thb(rec.totalSales)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Balanced</p>
                  <div className="font-semibold">
                    {rec.payload?.balanced ? (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700">
                        Balanced
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700">
                        Not Balanced
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Stock Info */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Rolls</p>
                  <p className="font-semibold">{rec.buns}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Meat</p>
                  <p className="font-semibold">{rec.meat}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-black font-[Poppins] rounded text-sm"
                  onClick={() => viewRecord(rec.id)}
                >
                  View
                </button>
                <button
                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-[Poppins] rounded text-sm"
                  onClick={() => window.open(`/api/forms/daily-sales/v2/${rec.id}/pdf`, "_blank")}
                >
                  Print
                </button>
                <button
                  className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded text-sm"
                  onClick={() => {
                    const link = document.createElement("a");
                    link.href = `/api/forms/daily-sales/v2/${rec.id}/pdf`;
                    link.download = `daily-sales-${rec.id}.pdf`;
                    link.click();
                  }}
                >
                  Download
                </button>
                {!rec.deletedAt && (
                  <>
                    <button
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-black font-[Poppins] rounded text-sm"
                      onClick={() => editRecord(rec.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-[Poppins] rounded text-sm"
                      onClick={() => deleteRecord(rec.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
                {rec.deletedAt && (
                  <button
                    className="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded text-sm col-span-2"
                    onClick={() => restoreRecord(rec.id)}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* View Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full p-6 overflow-y-auto max-h-[90vh]">
            <h2 className="text-xl font-bold mb-4">Complete Daily Sales & Stock Form</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* FORM 1 - Daily Sales Data */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-emerald-700 border-b pb-2">Daily Sales (Form 1)</h3>
                
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-semibold mb-2">Basic Info</h4>
                  <p><strong>Date:</strong> {new Date(selected.date).toLocaleDateString()}</p>
                  <p><strong>Completed By:</strong> {selected.staff}</p>
                </div>

                <div className="bg-blue-50 p-3 rounded">
                  <h4 className="font-semibold mb-2">Sales Breakdown</h4>
                  <p><strong>Cash Sales:</strong> ฿{selected.sales.cash.toLocaleString()}</p>
                  <p><strong>QR Sales:</strong> ฿{selected.sales.qr.toLocaleString()}</p>
                  <p><strong>Grab Sales:</strong> ฿{selected.sales.grab.toLocaleString()}</p>
                  <p><strong>Other Sales:</strong> ฿{selected.sales.other.toLocaleString()}</p>
                  <p className="font-bold border-t pt-2"><strong>Total Sales:</strong> ฿{selected.sales.total.toLocaleString()}</p>
                </div>

                <div className="bg-red-50 p-3 rounded">
                  <h4 className="font-semibold mb-2">Expenses & Wages</h4>
                  
                  {/* Regular Expenses */}
                  {selected.expenses.length > 0 && (
                    <div className="mb-3">
                      <h5 className="font-medium text-sm mb-1">Expenses</h5>
                      <ul className="space-y-1">
                        {selected.expenses.map((expense, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>{expense.item} ({expense.shop})</span>
                            <span>฿{expense.cost.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Staff Wages */}
                  {selected.wages && selected.wages.length > 0 && (
                    <div>
                      <h5 className="font-medium text-sm mb-1">Staff Wages</h5>
                      <ul className="space-y-1">
                        {selected.wages.map((wage, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>{wage.staff} (Wages)</span>
                            <span>฿{wage.amount.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-semibold">
                          <span>Total Wages:</span>
                          <span>฿{(selected.wages ? selected.wages.reduce((sum, w) => sum + w.amount, 0) : 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {selected.expenses.length === 0 && (!selected.wages || selected.wages.length === 0) && (
                    <p>No expenses or wages recorded</p>
                  )}
                </div>

                <div className="bg-green-50 p-3 rounded">
                  <h4 className="font-semibold mb-2">Banking & Cash</h4>
                  <p><strong>Starting Cash:</strong> ฿{selected.banking.startingCash.toLocaleString()}</p>
                  <p><strong>Closing Cash:</strong> ฿{selected.banking.closingCash.toLocaleString()}</p>
                  <p><strong>Cash Banked:</strong> ฿{selected.banking.cashBanked.toLocaleString()}</p>
                  <p><strong>QR Transfer:</strong> ฿{selected.banking.qrTransfer.toLocaleString()}</p>
                  
                  {(() => {
                    const startingCash = selected.banking.startingCash;
                    const cashSales = selected.sales.cash;
                    const totalExpenses = selected.expenses.reduce((sum, e) => sum + e.cost, 0);
                    const totalWages = selected.wages ? selected.wages.reduce((sum, w) => sum + w.amount, 0) : 0;
                    const cashBanked = selected.banking.cashBanked;
                    const closingCash = selected.banking.closingCash;
                    
                    const expectedClosing = startingCash + cashSales - totalExpenses - totalWages - cashBanked;
                    const difference = closingCash - expectedClosing;
                    const isBalanced = Math.abs(difference) <= 0.30; // ±30 THB tolerance
                    
                    return (
                      <div className="border-t pt-2 mt-2">
                        <h5 className="font-medium text-sm mb-2">Balance Check</h5>
                        <div className="text-xs space-y-1">
                          <p>Expected: ฿{startingCash.toLocaleString()} + ฿{cashSales.toLocaleString()} - ฿{totalExpenses.toLocaleString()} - ฿{totalWages.toLocaleString()} - ฿{cashBanked.toLocaleString()}</p>
                          <p><strong>Expected Closing:</strong> ฿{expectedClosing.toLocaleString()}</p>
                          <p><strong>Actual Closing:</strong> ฿{closingCash.toLocaleString()}</p>
                          <p className={`font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                            <strong>Difference:</strong> ฿{difference.toLocaleString()} 
                            {isBalanced ? ' BALANCED' : ' NOT BALANCED'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* FORM 2 - Stock Data */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-700 border-b pb-2">Stock Management (Form 2)</h3>
                
                <div className="bg-purple-50 p-3 rounded">
                  <h4 className="font-semibold mb-2">End Count</h4>
                  <p><strong>Rolls:</strong> {selected.stock.rolls} pcs</p>
                  <p><strong>Meat:</strong> {selected.stock.meat} grams</p>
                </div>

                <div className="bg-orange-50 p-3 rounded">
                  <h4 className="font-semibold mb-2">Shopping List / Requisition</h4>
                  {selected.shoppingList.length === 0 ? (
                    <p className="text-gray-500">No items to purchase</p>
                  ) : (
                    <div className="space-y-2">
                      {selected.shoppingList.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border">
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <span className="text-xs text-gray-500 ml-2">({item.category})</span>
                          </div>
                          <span className="font-bold">{item.qty} {item.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Raw Data Section (for debugging) */}
            <div className="mt-6 border-t pt-4">
              <details className="cursor-pointer">
                <summary className="font-semibold text-gray-600">Raw Data (Debug)</summary>
                <div className="mt-2 bg-gray-100 p-3 rounded text-xs">
                  <pre>{JSON.stringify(selected, null, 2)}</pre>
                </div>
              </details>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button
                className="px-3 py-1 bg-gray-300 rounded"
                onClick={() => setSelected(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
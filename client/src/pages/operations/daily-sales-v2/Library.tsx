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
  rolls: string;
  meat: string;
  status: string;
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
    await fetch(`/api/forms/daily-sales/v2/${id}`, { method: "DELETE" });
    fetchRecords();
  }

  async function restoreRecord(id: string) {
    await fetch(`/api/forms/daily-sales/v2/${id}/restore`, { method: "PATCH" });
    fetchRecords();
  }

  async function viewRecord(id: string) {
    const res = await fetch(`/api/forms/daily-sales/v2/${id}`);
    const data = await res.json();
    if (data.ok) {
      setSelected(data.record);
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
              <th className="p-2 border-b">Status</th>
              <th className="p-2 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-gray-500">
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
                  <td className="p-2 border-b">{rec.rolls}</td>
                  <td className="p-2 border-b">{rec.meat}</td>
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
                        onClick={() => window.open(`/api/forms/daily-sales/v2/${rec.id}/pdf`, "_blank")}
                      >
                        Print
                      </button>
                      <button
                        className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded text-xs"
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
              <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Total Sales</p>
                  <p className="font-semibold">{thb(rec.totalSales)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide">Rolls</p>
                  <p className="font-semibold">{rec.rolls}</p>
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
            <h2 className="text-xl font-bold mb-4">Form Details</h2>
            <p className="mb-2"><strong>Date:</strong> {new Date(selected.date).toLocaleDateString()}</p>
            <p className="mb-2"><strong>Staff:</strong> {selected.staff}</p>

            <h3 className="font-semibold mt-4">Sales</h3>
            <pre className="bg-gray-50 p-2 rounded text-sm">
              {JSON.stringify(selected.sales, null, 2)}
            </pre>

            <h3 className="font-semibold mt-4">Expenses</h3>
            <pre className="bg-gray-50 p-2 rounded text-sm">
              {JSON.stringify(selected.expenses, null, 2)}
            </pre>

            <h3 className="font-semibold mt-4">Banking</h3>
            <pre className="bg-gray-50 p-2 rounded text-sm">
              {JSON.stringify(selected.banking, null, 2)}
            </pre>

            <h3 className="font-semibold mt-4">Stock</h3>
            <p>Rolls: {selected.stock.rolls}</p>
            <p>Meat: {selected.stock.meat}</p>

            <h3 className="font-semibold mt-4">Shopping List</h3>
            {selected.shoppingList.length === 0 ? (
              <p>No items to purchase</p>
            ) : (
              <ul className="list-disc pl-6">
                {selected.shoppingList.map((item, idx) => (
                  <li key={idx}>
                    {item.name} – {item.qty} {item.unit}
                  </li>
                ))}
              </ul>
            )}

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
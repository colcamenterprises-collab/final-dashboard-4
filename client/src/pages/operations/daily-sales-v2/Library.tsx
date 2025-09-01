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
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-extrabold font-[Poppins]">
          Daily Sales Library (V2)
        </h1>
        <button
          className="px-3 py-1 bg-gray-200 rounded"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Show Active" : "Show Archived"}
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
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
              <tr key={rec.id} className="text-sm font-[Poppins]">
                <td className="p-2 border-b">
                  {new Date(rec.date).toLocaleDateString()}
                </td>
                <td className="p-2 border-b">{rec.staff}</td>
                <td className="p-2 border-b">{thb(rec.totalSales)}</td>
                <td className="p-2 border-b">{rec.rolls}</td>
                <td className="p-2 border-b">{rec.meat}</td>
                <td className="p-2 border-b">
                  {rec.deletedAt ? "Archived" : rec.status}
                </td>
                <td className="p-2 border-b space-x-2">
                  <button
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-black font-[Poppins] rounded-lg text-sm"
                    onClick={() => viewRecord(rec.id)}
                  >
                    View
                  </button>
                  <button
                    className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 font-[Poppins] rounded-lg text-sm"
                    onClick={() => window.open(`/api/forms/daily-sales/v2/${rec.id}/pdf`, "_blank")}
                  >
                    Print
                  </button>
                  <button
                    className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded-lg text-sm"
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
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-black font-[Poppins] rounded-lg text-sm"
                        onClick={() => editRecord(rec.id)}
                      >
                        Edit
                      </button>
                      <button
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-[Poppins] rounded-lg text-sm"
                        onClick={() => deleteRecord(rec.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {rec.deletedAt && (
                    <button
                      className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 font-[Poppins] rounded-lg text-sm"
                      onClick={() => restoreRecord(rec.id)}
                    >
                      Restore
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

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
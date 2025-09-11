// Do not do this:
// – Do not rename, move, or split this file
// – Do not change API routes
// – Do not add dependencies
// – Only apply exactly what is written below

import React, { useEffect, useState } from "react";
import { Trash2, Check, X } from "lucide-react";

// THB formatting helper
const thb = (v: unknown): string => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  return "฿" + n.toLocaleString("en-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type RecordType = {
  id: string;
  date: string;
  staff: string;
  cashStart: number;
  cashEnd: number;
  totalSales: number;
  buns: string;
  meat: string;
  status: string;
  payload: {
    balanced: boolean;
  };
};

// Custom Confirmation Modal Component
function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  count
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 w-10 h-10 mx-auto flex items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900">Delete Records</h3>
          </div>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-500">
            Are you sure you want to delete {count} record{count > 1 ? 's' : ''}? This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DailySalesLibrary() {
  const [records, setRecords] = useState<RecordType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch records function
  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/forms/daily-sales/v2");
      const data = await res.json();
      if (data.ok && data.records) {
        setRecords(data.records);
        setError("");
      } else {
        setError("No records found");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Handle checkbox selection
  const handleSelectRecord = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(records.map(r => r.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  // Delete selected records
  const deleteSelectedRecords = async () => {
    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/forms/daily-sales/v2/${id}`, { method: "DELETE" })
      );
      
      const results = await Promise.all(deletePromises);
      const successful = results.filter(r => r.ok).length;
      
      if (successful === selectedIds.size) {
        // All deletions successful
        await fetchRecords(); // Refresh the list
        setSelectedIds(new Set()); // Clear selection
      } else {
        setError(`Failed to delete ${selectedIds.size - successful} records`);
      }
    } catch (err) {
      setError("Failed to delete records");
    } finally {
      setDeleting(false);
      setShowConfirmModal(false);
    }
  };

  const isAllSelected = records.length > 0 && selectedIds.size === records.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < records.length;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-extrabold font-[Poppins]">
          Daily Sales Library
        </h1>
        {selectedIds.size > 0 && (
          <button
            onClick={() => setShowConfirmModal(true)}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedIds.size})
          </button>
        )}
      </div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-100 text-left text-sm font-semibold font-[Poppins]">
            <th className="p-2 border-b w-12">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isPartiallySelected;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
              />
            </th>
            <th className="p-2 border-b">Date</th>
            <th className="p-2 border-b">Staff</th>
            <th className="p-2 border-b">Cash Start</th>
            <th className="p-2 border-b">Cash End</th>
            <th className="p-2 border-b">Total Sales</th>
            <th className="p-2 border-b">Buns (End)</th>
            <th className="p-2 border-b">Meat (End)</th>
            <th className="p-2 border-b">Status</th>
            <th className="p-2 border-b">Balanced</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={10} className="p-4 text-center text-gray-500">
                No records found
              </td>
            </tr>
          ) : (
            records.map((rec) => (
              <tr key={rec.id} className="text-sm font-[Poppins] hover:bg-gray-50">
                <td className="p-2 border-b">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(rec.id)}
                    onChange={(e) => handleSelectRecord(rec.id, e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </td>
                <td className="p-2 border-b">
                  {new Date(rec.date).toLocaleDateString()}
                </td>
                <td className="p-2 border-b">{rec.staff}</td>
                <td className="p-2 border-b">{thb(rec.cashStart)}</td>
                <td className="p-2 border-b">{thb(rec.cashEnd)}</td>
                <td className="p-2 border-b">{thb(rec.totalSales)}</td>
                <td className="p-2 border-b">{rec.buns}</td>
                <td className="p-2 border-b">{rec.meat}</td>
                <td className="p-2 border-b">{rec.status}</td>
                <td className="p-2 border-b">
                  {rec.payload.balanced ? (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-700">
                      Balanced
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-700">
                      Not Balanced
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <ConfirmDeleteModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={deleteSelectedRecords}
        count={selectedIds.size}
      />
    </div>
  );
}
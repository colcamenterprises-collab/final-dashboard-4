import { useState, useEffect } from "react";

export default function ShiftSummary() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [shiftData, setShiftData] = useState<any[]>([]);

  // Fetch uploaded shift data
  const fetchShiftData = async () => {
    try {
      const res = await fetch("/api/pos/shifts");
      const data = await res.json();
      setShiftData(data.shifts || []);
    } catch (err) {
      console.error("Failed to fetch shift data:", err);
    }
  };

  // Load shift data on component mount
  useEffect(() => {
    fetchShiftData();
  }, []);

  // Helper function to extract shift data from different formats
  const extractShiftData = (shift: any) => {
    // If it's CSV format (flat structure)
    if (shift.data?.Store || shift.data?.['Shift number']) {
      return {
        store: shift.data?.Store || '-',
        shiftNumber: shift.data?.['Shift number'] || '-',
        cashPayments: shift.data?.['Cash payments'] || '-',
        expectedCash: shift.data?.['Expected cash amount'] || '-',
        actualCash: shift.data?.['Actual cash amount'] || '-',
        difference: shift.data?.['Difference'] || '-'
      };
    }
    
    // If it's API format (nested structure with shifts array)
    if (shift.data?.shifts && shift.data.shifts.length > 0) {
      const shiftInfo = shift.data.shifts[0]; // Take first shift
      return {
        store: 'Smash Bros Burgers (Rawai)', // Default store name for API data
        shiftNumber: '-', // Not available in API format
        cashPayments: shiftInfo.cash_payments ? (shiftInfo.cash_payments / 100).toFixed(2) : '-',
        expectedCash: shiftInfo.expected_cash ? (shiftInfo.expected_cash / 100).toFixed(2) : '-',
        actualCash: shiftInfo.actual_cash ? (shiftInfo.actual_cash / 100).toFixed(2) : '-',
        difference: shiftInfo.expected_cash && shiftInfo.actual_cash ? 
          ((shiftInfo.actual_cash - shiftInfo.expected_cash) / 100).toFixed(2) : '-'
      };
    }
    
    // Fallback for unknown format
    return {
      store: '-',
      shiftNumber: '-',
      cashPayments: '-',
      expectedCash: '-',
      actualCash: '-',
      difference: '-'
    };
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/pos/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    setResult(data);
    setLoading(false);

    // Refresh shift data after successful upload
    if (data.status === "ok" && data.rows > 0) {
      fetchShiftData();
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shift Summary Upload</h1>
      <form onSubmit={handleUpload} className="space-y-4">
        <input type="file" name="file" className="border p-2" />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Uploading…" : "Upload"}
        </button>
      </form>

      {result && (
        <div className="mt-4 p-4 bg-gray-100 border rounded">
          <p className="font-bold">Upload Result</p>
          <p>Status: {result.status}</p>
          <p>Type: {result.type}</p>
          <p>Rows Processed: {result.rows}</p>
        </div>
      )}

      {/* Display uploaded shift data */}
      {shiftData.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Uploaded Shift Data</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 border-b text-left">Date</th>
                  <th className="px-4 py-2 border-b text-left">Store</th>
                  <th className="px-4 py-2 border-b text-left">Shift Number</th>
                  <th className="px-4 py-2 border-b text-left">Cash Payments</th>
                  <th className="px-4 py-2 border-b text-left">Expected Cash</th>
                  <th className="px-4 py-2 border-b text-left">Actual Cash</th>
                  <th className="px-4 py-2 border-b text-left">Difference</th>
                </tr>
              </thead>
              <tbody>
                {shiftData.map((shift, index) => {
                  const data = extractShiftData(shift);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 border-b">{shift.shiftDate}</td>
                      <td className="px-4 py-2 border-b">{data.store}</td>
                      <td className="px-4 py-2 border-b">{data.shiftNumber}</td>
                      <td className="px-4 py-2 border-b">{data.cashPayments}</td>
                      <td className="px-4 py-2 border-b">{data.expectedCash}</td>
                      <td className="px-4 py-2 border-b">{data.actualCash}</td>
                      <td className="px-4 py-2 border-b">{data.difference}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
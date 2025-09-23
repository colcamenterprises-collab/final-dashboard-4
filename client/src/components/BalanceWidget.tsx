// client/src/components/BalanceWidget.tsx
import { useEffect, useState } from "react";

interface BalanceEntry {
  source: string;
  date: string;
  expected: number;
  actual: number;
  difference: number;
  status: string;
}

export default function BalanceWidget() {
  const [balances, setBalances] = useState<{
    posBalances: BalanceEntry[];
    formBalances: BalanceEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/balance/daily")
      .then((res) => res.json())
      .then((data) => {
        setBalances(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch balances:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-4 text-gray-500">Loading balances...</div>;
  if (!balances) return <div className="p-4 text-red-500">Failed to load balances</div>;

  const renderCard = (entry: BalanceEntry) => (
    <div
      key={`${entry.source}-${entry.date}`}
      className={`p-3 rounded-xl shadow-md mb-2 border ${
        entry.status === "Balanced" 
          ? "bg-green-50 border-green-200" 
          : "bg-red-50 border-red-200"
      }`}
      data-testid={`balance-card-${entry.source.toLowerCase()}-${entry.date}`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-gray-800">{entry.date}</span>
        <span className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-600">
          {entry.source}
        </span>
      </div>
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span>Expected:</span>
          <span className="font-medium">
            ฿{entry.expected.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Actual:</span>
          <span className="font-medium">
            ฿{entry.actual.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Difference:</span>
          <span
            className={`font-bold ${
              entry.status === "Balanced" ? "text-green-700" : "text-red-700"
            }`}
          >
            {entry.difference >= 0 ? "+" : ""}
            ฿{entry.difference.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </span>
        </div>
        <div
          className={`mt-2 text-xs font-semibold ${
            entry.status === "Balanced" ? "text-green-700" : "text-red-700"
          }`}
          data-testid={`status-${entry.status.toLowerCase()}`}
        >
          {entry.status}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow p-6" data-testid="balance-widget">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Cash Balance Reconciliation</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-bold mb-3 text-blue-700">POS Balances</h3>
          {balances.posBalances.length > 0 ? (
            balances.posBalances.map(renderCard)
          ) : (
            <div className="text-gray-500 text-sm">No POS data available</div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold mb-3 text-purple-700">Form Balances</h3>
          {balances.formBalances.length > 0 ? (
            balances.formBalances.map(renderCard)
          ) : (
            <div className="text-gray-500 text-sm">No form data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
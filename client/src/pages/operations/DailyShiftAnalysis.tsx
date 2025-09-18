import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DailyShiftAnalysis() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analysis").then(r => r.json()).then(json => {
      setRows(json.rows || []);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to fetch analysis data:', err);
      setLoading(false);
    });
  }, []);

  const generateAnalysis = async () => {
    const today = new Date().toISOString().slice(0,10);
    try {
      const response = await fetch('/api/analysis/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today })
      });
      const result = await response.json();
      if (result.ok) {
        // Refresh the data
        fetch("/api/analysis").then(r => r.json()).then(json => {
          setRows(json.rows || []);
        });
      }
    } catch (err) {
      console.error('Failed to generate analysis:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Daily Shift Analysis</h1>
        <p>Loading analysis data...</p>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="daily-shift-analysis">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Daily Shift Analysis</h1>
          <p className="text-gray-600">Side-by-side reconciliation of Staff Forms vs POS Reports</p>
        </div>
        <Button onClick={generateAnalysis} data-testid="button-generate-analysis">
          Generate Today's Analysis
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-gray-500">No analysis data available. Click "Generate Today's Analysis" to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Sales vs POS Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Comparison: Staff Form vs POS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300" data-testid="table-sales-comparison">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-left">Field</th>
                      <th className="border border-gray-300 p-2 text-left">Staff Form</th>
                      <th className="border border-gray-300 p-2 text-left">POS Report</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.salesVsPOS?.map((s: any, idx: number) => (
                        <tr key={`${row.shiftDate}-${idx}`} className={s.status.includes("🚨") ? "bg-red-50" : "bg-green-50"}>
                          <td className="border border-gray-300 p-2">{row.shiftDate}</td>
                          <td className="border border-gray-300 p-2">{s.field}</td>
                          <td className="border border-gray-300 p-2">{s.form || 0}</td>
                          <td className="border border-gray-300 p-2">{s.pos || 0}</td>
                          <td className="border border-gray-300 p-2">{s.status}</td>
                        </tr>
                      )) || []
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Stock Variances */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Variances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300" data-testid="table-stock-variances">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-left">Item</th>
                      <th className="border border-gray-300 p-2 text-left">Expected</th>
                      <th className="border border-gray-300 p-2 text-left">Actual</th>
                      <th className="border border-gray-300 p-2 text-left">Variance</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.stockUsage?.map((s: any, idx: number) => (
                        <tr key={`${row.shiftDate}-stock-${idx}`} className={s.status === "🚨" ? "bg-red-50" : "bg-green-50"}>
                          <td className="border border-gray-300 p-2">{row.shiftDate}</td>
                          <td className="border border-gray-300 p-2">{s.item}</td>
                          <td className="border border-gray-300 p-2">{s.expected}</td>
                          <td className="border border-gray-300 p-2">{s.actual}</td>
                          <td className="border border-gray-300 p-2">{s.variance}</td>
                          <td className="border border-gray-300 p-2">{s.status}</td>
                        </tr>
                      )) || []
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Flags Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">🚨 Flags Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2" data-testid="flags-summary">
                {rows.map((row) =>
                  row.analysis?.flags?.map((f: string, idx: number) => (
                    <div key={`${row.shiftDate}-flag-${idx}`} className="flex items-center space-x-2 p-2 bg-red-50 border border-red-200 rounded">
                      <span className="font-semibold text-red-700">{row.shiftDate}:</span>
                      <span className="text-red-600">{f}</span>
                    </div>
                  )) || []
                )}
                {rows.every(row => !row.analysis?.flags?.length) && (
                  <p className="text-gray-500 italic">No flags detected - all variances within acceptable tolerances.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
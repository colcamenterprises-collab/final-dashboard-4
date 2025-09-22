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
    <div className="p-2 sm:p-3 lg:p-6" data-testid="daily-shift-analysis">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Daily Shift Analysis</h1>
          <p className="text-xs sm:text-sm lg:text-base text-gray-600">Side-by-side reconciliation of Staff Forms vs POS Reports</p>
        </div>
        <Button 
          onClick={generateAnalysis} 
          data-testid="button-generate-analysis"
          className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 p-2 sm:p-3 lg:p-4"
        >
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
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Date</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Field</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Staff Form</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">POS Report</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.salesVsPOS?.map((s: any, idx: number) => (
                        <tr key={`${row.shiftDate}-${idx}`} className={s.status.includes("🚨") ? "bg-red-50 border-b border-gray-200" : "bg-green-50 border-b border-gray-200"}>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm">{row.shiftDate}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm font-medium">{s.field}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.form || 0}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.pos || 0}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.status}</td>
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
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Date</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Item</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Expected</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Actual</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Variance</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.stockUsage?.map((s: any, idx: number) => (
                        <tr key={`${row.shiftDate}-stock-${idx}`} className={s.status === "🚨" ? "bg-red-50 border-b border-gray-200" : "bg-green-50 border-b border-gray-200"}>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm">{row.shiftDate}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm font-medium">{s.item}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.expected}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.actual}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.variance}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center">{s.status}</td>
                        </tr>
                      )) || []
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Drinks Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle>🥤 Drinks Analysis</CardTitle>
              <p className="text-sm text-gray-600">Individual drink type analysis based on POS sales vs form counts</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300" data-testid="table-drinks-analysis">
                  <thead>
                    <tr className="bg-blue-50 border-b border-blue-200">
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Date</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Item Name</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Qty Sold (POS)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Expected Usage</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Actual Count (Form)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Variance</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-blue-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.drinksAnalysis?.map((d: any, idx: number) => (
                        <tr key={`${row.shiftDate}-drinks-${idx}`} className={d.status === "🚨" ? "bg-red-50 border-b border-gray-200" : "bg-green-50 border-b border-gray-200"} data-testid={`row-drinks-${idx}`}>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm" data-testid={`text-date-${row.shiftDate}`}>{row.shiftDate}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm font-medium" data-testid={`text-drink-name-${idx}`}>{d.itemName}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-qty-sold-${idx}`}>{d.qtySold}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-expected-${idx}`}>{d.expectedUsage}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-actual-${idx}`}>{d.actualCount}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-variance-${idx}`}>{d.variance > 0 ? `+${d.variance}` : d.variance}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-status-${idx}`}>{d.status}</td>
                        </tr>
                      )) || []
                    )}
                    {rows.every(row => !row.analysis?.drinksAnalysis?.length) && (
                      <tr>
                        <td colSpan={7} className="border border-gray-300 p-4 text-center text-gray-500 italic">
                          No drinks analysis data available. Generate analysis to see drink-specific variances.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Rolls/Buns Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle>🍞 Rolls/Buns Analysis</CardTitle>
              <p className="text-sm text-gray-600">Burger bun usage analysis based on burger sales vs actual bun counts</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300" data-testid="table-rolls-analysis">
                  <thead>
                    <tr className="bg-yellow-50 border-b border-yellow-200">
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Date</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Item Name</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Qty Sold (POS)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Expected Usage</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Actual Count (Form)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Variance</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-yellow-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.rollsAnalysis?.map((r: any, idx: number) => (
                        <tr key={`${row.shiftDate}-rolls-${idx}`} className={r.status === "🚨" ? "bg-red-50 border-b border-gray-200" : "bg-green-50 border-b border-gray-200"} data-testid={`row-rolls-${idx}`}>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm" data-testid={`text-date-${row.shiftDate}`}>{row.shiftDate}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm font-medium" data-testid={`text-roll-name-${idx}`}>{r.itemName}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-qty-sold-${idx}`}>{r.qtySold}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-expected-${idx}`}>{r.expectedUsage}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-actual-${idx}`}>{r.actualCount}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-variance-${idx}`}>{r.variance > 0 ? `+${r.variance}` : r.variance}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-status-${idx}`}>{r.status}</td>
                        </tr>
                      )) || []
                    )}
                    {rows.every(row => !row.analysis?.rollsAnalysis?.length) && (
                      <tr>
                        <td colSpan={7} className="border border-gray-300 p-4 text-center text-gray-500 italic">
                          No rolls analysis data available. Generate analysis to see bun usage variances.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Meat Analysis Table */}
          <Card>
            <CardHeader>
              <CardTitle>🥩 Meat Analysis</CardTitle>
              <p className="text-sm text-gray-600">Meat usage analysis based on burger patty requirements vs actual consumption</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300" data-testid="table-meat-analysis">
                  <thead>
                    <tr className="bg-red-50 border-b border-red-200">
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Date</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Item Name</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Qty Sold (POS)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Expected Usage (g)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Actual Count (g)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Variance (g)</th>
                      <th className="p-2 sm:p-3 lg:p-4 text-left text-xs sm:text-sm font-semibold text-red-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) =>
                      row.analysis?.meatAnalysis?.map((m: any, idx: number) => (
                        <tr key={`${row.shiftDate}-meat-${idx}`} className={m.status === "🚨" ? "bg-red-50 border-b border-gray-200" : "bg-green-50 border-b border-gray-200"} data-testid={`row-meat-${idx}`}>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm" data-testid={`text-date-${row.shiftDate}`}>{row.shiftDate}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm font-medium" data-testid={`text-meat-name-${idx}`}>{m.itemName}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-qty-sold-${idx}`}>{m.qtySold}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-expected-${idx}`}>{m.expectedUsage}g</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-actual-${idx}`}>{m.actualCount}g</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-variance-${idx}`}>{m.variance > 0 ? `+${m.variance}g` : `${m.variance}g`}</td>
                          <td className="p-2 sm:p-3 lg:p-4 text-xs sm:text-sm text-center" data-testid={`text-status-${idx}`}>{m.status}</td>
                        </tr>
                      )) || []
                    )}
                    {rows.every(row => !row.analysis?.meatAnalysis?.length) && (
                      <tr>
                        <td colSpan={7} className="border border-gray-300 p-4 text-center text-gray-500 italic">
                          No meat analysis data available. Generate analysis to see meat usage variances.
                        </td>
                      </tr>
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
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, AlertCircle, Banknote } from "lucide-react";

// Minimal CSV parser (handles quotes and commas)
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];

    if (c === '"' && inQuotes && n === '"') { cell += '"'; i++; continue; }
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === ',' && !inQuotes) { row.push(cell); cell = ""; continue; }
    if ((c === '\n' || c === '\r') && !inQuotes) {
      if (cell !== "" || row.length) { row.push(cell); rows.push(row); row = []; cell = ""; }
      continue;
    }
    cell += c;
  }
  if (cell !== "" || row.length) row.push(cell);
  if (row.length) rows.push(row);
  return rows.filter(r => r.some(x => x.trim() !== ""));
}

export default function BusinessExpenses() {
  const [url, setUrl] = useState<string>("");
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const u = import.meta.env.VITE_EXPENSES_SHEET_CSV_URL || "";
    setUrl(u);
    
    async function load() {
      if (!u) return;
      setLoading(true);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed ${res.status}`);
        const text = await res.text();
        setRows(parseCSV(text));
      } catch (e: any) {
        setError(e.message || "Failed to fetch CSV");
      } finally {
        setLoading(false);
      }
    }
    
    load();
  }, []);

  const { headers, data, total } = useMemo(() => {
    if (!rows.length) return { headers: [], data: [], total: 0 };
    const headers = rows[0];
    const data = rows.slice(1);
    const totalIndex = headers.findIndex(h => h.toLowerCase().includes('total'));
    const total = data.reduce((acc, row) => {
      const totalValue = totalIndex >= 0 ? row[totalIndex] || "0" : "0";
      return acc + Number(totalValue.replace(/[,\s฿]/g, ""));
    }, 0);
    return { headers, data, total };
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Business Expenses</h1>
          <p className="text-muted-foreground">
            Out-of-shift business costs tracked via Google Sheets (read-only)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
            <ExternalLink className="w-3 h-3 mr-1" />
            Sheet-Backed
          </Badge>
        </div>
      </div>

      {/* Setup Instructions */}
      {!url && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Setup Required:</strong> Add <code>VITE_EXPENSES_SHEET_CSV_URL</code> to Replit Secrets with your published Google Sheet CSV URL.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Connection Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="text-muted-foreground">Loading expenses data...</div>
        </div>
      )}

      {/* Summary Card */}
      {headers.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Business Expenses</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">฿{total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {data.length} expense{data.length !== 1 ? 's' : ''} recorded
            </p>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
            <CardDescription>
              All business expenses tracked outside of daily shift operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {headers.map((header, i) => (
                      <th key={i} className="text-left p-3 border-b font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, ri) => (
                    <tr key={ri} className="hover:bg-muted/25">
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-3 border-b">
                          {headers[ci]?.toLowerCase().includes('total') ? (
                            <span className="font-medium">
                              ฿{Number(cell.replace(/[,\s฿]/g, "")).toLocaleString()}
                            </span>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!loading && !error && headers.length === 0 && url && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-muted-foreground">
              No expense data found. Check your Google Sheet format and ensure it's published to web as CSV.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
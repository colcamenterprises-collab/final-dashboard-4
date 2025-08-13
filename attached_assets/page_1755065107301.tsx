// src/app/expenses/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";

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

type Exp = {
  Date: string; Supplier: string; Category?: string; Item?: string;
  Quantity?: string; UnitCost?: string; Total?: string; Note?: string;
}

export default function ExpensesSheet() {
  const [url, setUrl] = useState<string>("");
  const [rows, setRows] = useState<string[][]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const u = process.env.NEXT_PUBLIC_EXPENSES_SHEET_CSV_URL || "";
    setUrl(u);
    async function load() {
      if (!u) return;
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed ${res.status}`);
        const text = await res.text();
        setRows(parseCSV(text));
      } catch (e:any) {
        setError(e.message || "Failed to fetch CSV");
      }
    }
    load();
  }, []);

  const { headers, data, total } = useMemo(() => {
    if (!rows.length) return { headers: [], data: [], total: 0 };
    const headers = rows[0];
    const data = rows.slice(1);
    const ti = headers.findIndex(h => h.toLowerCase() === "total");
    const total = data.reduce((acc, r) => acc + (ti >= 0 ? Number((r[ti] || "0").replace(/[, ]/g, "")) : 0), 0);
    return { headers, data, total };
  }, [rows]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Expenses (Business)</h1>
      <p className="text-sm text-gray-600 mb-4">
        Source: Google Sheet CSV (read-only). Set <code>NEXT_PUBLIC_EXPENSES_SHEET_CSV_URL</code> in Replit Secrets.
      </p>
      {!url && <div className="text-red-700">Missing NEXT_PUBLIC_EXPENSES_SHEET_CSV_URL secret.</div>}
      {error && <div className="text-red-700">{error}</div>}
      {headers.length > 0 && (
        <div className="mt-4">
          <div className="mb-2">Total: <strong>{total.toLocaleString()}</strong></div>
          <div className="overflow-auto border rounded-2xl">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>{headers.map((h,i) => <th key={i} className="text-left p-2 border-b">{h}</th>)}</tr>
              </thead>
              <tbody>
                {data.map((r,ri) => (
                  <tr key={ri} className="odd:bg-white even:bg-gray-50">
                    {r.map((c,ci) => <td key={ci} className="p-2 border-b whitespace-nowrap">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

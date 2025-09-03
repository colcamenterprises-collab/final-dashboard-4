import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

const COLORS = ["#00C49F", "#FF8042", "#0088FE", "#FFBB28", "#FF4444"];

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [parsed, setParsed] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [totals, setTotals] = useState({ mtd: 0, ytd: 0, today: 0 });

  useEffect(() => { fetchExpenses(); }, []);

  async function fetchExpenses() {
    try {
      const now = new Date();
      const { data } = await axios.get("/api/expensesV2", {
        params: { month: now.getMonth() + 1, year: now.getFullYear() }
      });
      setExpenses(data.expenses || []);
      setTotals({
        mtd: data.total || 0,
        ytd: (data.expenses || []).reduce((s: number, e: any) => s + (e.amountMinor || 0), 0),
        today: (data.expenses || [])
          .filter((e: any) => new Date(e.date).toDateString() === now.toDateString())
          .reduce((s: number, e: any) => s + (e.amountMinor || 0), 0),
      });
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post("/api/expensesV2/upload", formData);
      setParsed(data.parsed || []);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  }

  async function approveLine(line: any) {
    try {
      await axios.post("/api/expensesV2/approve", line);
      setParsed(parsed.filter(l => l.id !== line.id));
      fetchExpenses();
    } catch (error) {
      console.error("Approve failed:", error);
    }
  }

  function deleteLine(id: number) {
    setParsed(parsed.filter(l => l.id !== id));
  }

  // Category summary
  const categoryData = Object.entries(
    expenses.reduce((acc: any, e: any) => {
      acc[e.category] = (acc[e.category] || 0) + (e.amountMinor || 0);
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: Number(value) / 100 })).filter(item => item.value > 0);

  return (
    <div className="space-y-6 font-['Poppins'] text-gray-800">
      <h1 className="text-xl font-bold mb-4">Expenses</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white shadow rounded p-4 text-center">
          <h4 className="text-sm font-semibold">Today</h4>
          <p className="text-lg font-bold">฿{(totals.today/100).toFixed(2)}</p>
        </div>
        <div className="bg-white shadow rounded p-4 text-center">
          <h4 className="text-sm font-semibold">Month-to-Date</h4>
          <p className="text-lg font-bold">฿{(totals.mtd/100).toFixed(2)}</p>
        </div>
        <div className="bg-white shadow rounded p-4 text-center">
          <h4 className="text-sm font-semibold">Year-to-Date</h4>
          <p className="text-lg font-bold">฿{(totals.ytd/100).toFixed(2)}</p>
        </div>
      </div>

      {/* Upload */}
      <form onSubmit={handleUpload} className="mb-6">
        <div className="flex gap-3">
          <input 
            type="file" 
            accept=".pdf,.csv,.png,.jpg"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="text-sm flex-1"
          />
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
            disabled={!file}
          >
            Upload
          </button>
        </div>
      </form>

      {/* Parsed Transactions */}
      {parsed.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h3 className="font-semibold text-sm mb-2">Review Uploaded Transactions ({parsed.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-1 border text-left">Date</th>
                  <th className="p-1 border text-left">Supplier</th>
                  <th className="p-1 border text-left">Category</th>
                  <th className="p-1 border text-left">Description</th>
                  <th className="p-1 border text-right">Amount</th>
                  <th className="p-1 border text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((line, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-1">
                      <input 
                        type="text" 
                        defaultValue={line.date} 
                        className="border w-full text-sm p-1" 
                        onChange={e => line.date = e.target.value}
                      />
                    </td>
                    <td className="border p-1">
                      <input 
                        type="text" 
                        defaultValue={line.supplier} 
                        className="border w-full text-sm p-1" 
                        onChange={e => line.supplier = e.target.value}
                      />
                    </td>
                    <td className="border p-1">
                      <input 
                        type="text" 
                        defaultValue={line.category} 
                        className="border w-full text-sm p-1" 
                        onChange={e => line.category = e.target.value}
                      />
                    </td>
                    <td className="border p-1">
                      <input 
                        type="text" 
                        defaultValue={line.description} 
                        className="border w-full text-sm p-1" 
                        onChange={e => line.description = e.target.value}
                      />
                    </td>
                    <td className="border p-1">
                      <input 
                        type="number" 
                        defaultValue={line.amount} 
                        className="border w-full text-sm p-1 text-right" 
                        step="0.01"
                        onChange={e => line.amount = e.target.value}
                      />
                    </td>
                    <td className="border p-1 space-x-1 text-center">
                      <button 
                        onClick={() => approveLine(line)} 
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => deleteLine(line.id)} 
                        className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expense Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">This Month's Expenses</h2>
        <div className="overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 border text-left">Date</th>
                <th className="p-1 border text-left">Supplier</th>
                <th className="p-1 border text-left">Category</th>
                <th className="p-1 border text-left">Description</th>
                <th className="p-1 border text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="border p-1">{exp.supplier}</td>
                  <td className="border p-1">{exp.category}</td>
                  <td className="border p-1">{exp.description}</td>
                  <td className="border p-1 text-right">฿{((exp.amountMinor || 0)/100).toFixed(2)}</td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="border p-4 text-center text-gray-500">
                    No expenses recorded this month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pie Chart */}
      {categoryData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-2">Category Summary</h2>
          <PieChart width={400} height={300}>
            <Pie 
              data={categoryData} 
              dataKey="value" 
              nameKey="name" 
              cx="50%" 
              cy="50%" 
              outerRadius={100}
            >
              {categoryData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `฿${value.toFixed(2)}`} />
            <Legend />
          </PieChart>
        </div>
      )}
    </div>
  );
}
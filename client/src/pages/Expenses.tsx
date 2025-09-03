import React, { useState, useEffect } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import PageShell from "@/layouts/PageShell";

const suppliers = ["Other", "Mr DIY", "Bakery", "Makro", "Supercheap", "Lazada", "Lotus", "Big C", "Landlord - Rent", "Printing Shop", "Company Expenses", "Wages", "Wages - Bonus", "GO Wholesale", "Director - Personal", "Utilities - GAS/Electric/Phone"];
const categories = ["Food", "Beverage", "Wages", "Rent", "Utilities", "Kitchen Supplies & Packaging", "Administration", "Marketing", "Printing", "Staff Expenses (from account)", "Travel", "Personal (director)", "Maintenance", "Company Expense"];

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<any[]>([]);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [activeStockTab, setActiveStockTab] = useState<"rolls"|"meat"|"drinks">("rolls");

  useEffect(() => { fetchExpenses(); }, []);

  async function fetchExpenses() {
    try {
      const { data } = await axios.get("/api/expensesV2");
      setExpenses(data.expenses || []);
      setTotal(data.total || 0);
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
      fetchExpenses();
      // Remove from parsed list
      setParsed(prev => prev.filter(p => p !== line));
    } catch (error) {
      console.error("Approve failed:", error);
    }
  }

  // Prepare chart data
  const chartData = categories.map(cat => ({
    name: cat,
    value: expenses.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + (e.amountMinor || 0), 0) / 100
  })).filter(item => item.value > 0);

  const colors = ["#00C49F", "#FF8042", "#0088FE", "#FFBB28", "#FF4444"];

  return (
    <PageShell>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Expenses</h1>

        {/* Buttons */}
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={() => setShowGeneralModal(true)} 
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Lodge Business Expense
          </button>
          <button 
            onClick={() => setShowStockModal(true)} 
            className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Lodge Stock Purchase
          </button>
        </div>

        {/* Upload */}
        <form onSubmit={handleUpload} className="mb-6">
          <div className="flex gap-3">
            <input 
              type="file" 
              accept=".pdf,.csv,.png,.jpg" 
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="flex-1 p-2 border rounded"
            />
            <button 
              type="submit" 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              disabled={!file}
            >
              Upload File
            </button>
          </div>
        </form>

        {parsed.length > 0 && (
          <div className="mb-6 bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold mb-2">Review Parsed Items ({parsed.length})</h3>
            {parsed.map((line, i) => (
              <div key={i} className="flex space-x-2 mb-2 p-2 bg-white rounded border">
                <input 
                  className="border p-1 flex-1" 
                  value={line.raw || line.description || ""} 
                  onChange={e => {
                    const newParsed = [...parsed];
                    newParsed[i] = { ...line, raw: e.target.value };
                    setParsed(newParsed);
                  }}
                />
                <button 
                  onClick={() => approveLine({ 
                    date: new Date().toISOString().split('T')[0], 
                    supplier: "Other", 
                    category: "Food", 
                    items: line.raw || line.description || "", 
                    amount: 0, 
                    notes: "" 
                  })} 
                  className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Expenses Table */}
        <h2 className="text-lg font-semibold mb-2">Expenses This Month (Total: ฿{(total/100).toFixed(2)})</h2>
        <div className="overflow-x-auto mb-6">
          <table className="w-full border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 border text-left">Date</th>
                <th className="p-2 border text-left">Supplier</th>
                <th className="p-2 border text-left">Category</th>
                <th className="p-2 border text-left">Items</th>
                <th className="p-2 border text-left">Notes</th>
                <th className="p-2 border text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-gray-50">
                  <td className="p-2 border">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="p-2 border">{exp.supplier}</td>
                  <td className="p-2 border">{exp.category}</td>
                  <td className="p-2 border">{exp.description}</td>
                  <td className="p-2 border">{exp.notes}</td>
                  <td className="p-2 border text-right">฿{((exp.amountMinor || 0)/100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pie Chart */}
        {chartData.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-2">Category Summary</h2>
            <PieChart width={400} height={300}>
              <Pie 
                data={chartData} 
                dataKey="value" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={100}
              >
                {chartData.map((_, idx) => (
                  <Cell key={idx} fill={colors[idx % colors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `฿${value.toFixed(2)}`} />
              <Legend />
            </PieChart>
          </div>
        )}

        {/* Business Expense Modal */}
        {showGeneralModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded w-96 max-h-96 overflow-y-auto">
              <h3 className="font-bold mb-4">Business Expense</h3>
              <form onSubmit={async e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const data = Object.fromEntries(new FormData(form).entries());
                try {
                  await axios.post("/api/expensesV2", data);
                  setShowGeneralModal(false);
                  fetchExpenses();
                } catch (error) {
                  console.error("Failed to save expense:", error);
                }
              }} className="space-y-3">
                <input 
                  type="date" 
                  name="date" 
                  className="border p-2 w-full rounded" 
                  defaultValue={new Date().toISOString().split('T')[0]}
                  required 
                />
                <select name="supplier" className="border p-2 w-full rounded" required>
                  {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input 
                  type="number" 
                  step="0.01" 
                  name="amount" 
                  placeholder="Amount (฿)" 
                  className="border p-2 w-full rounded" 
                  required 
                />
                <select name="category" className="border p-2 w-full rounded" required>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input 
                  type="text" 
                  name="items" 
                  placeholder="Items/Description" 
                  className="border p-2 w-full rounded" 
                />
                <textarea 
                  name="notes" 
                  placeholder="Notes" 
                  className="border p-2 w-full rounded h-16" 
                />
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowGeneralModal(false)}
                    className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stock Purchase Modal */}
        {showStockModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded w-96">
              <h3 className="font-bold mb-4">Stock Purchase</h3>
              <div className="flex mb-4">
                <button 
                  onClick={() => setActiveStockTab("rolls")} 
                  className={`flex-1 px-2 py-1 ${activeStockTab==="rolls"?"bg-black text-white":"bg-gray-200"}`}
                >
                  Rolls
                </button>
                <button 
                  onClick={() => setActiveStockTab("meat")} 
                  className={`flex-1 px-2 py-1 ${activeStockTab==="meat"?"bg-black text-white":"bg-gray-200"}`}
                >
                  Meat
                </button>
                <button 
                  onClick={() => setActiveStockTab("drinks")} 
                  className={`flex-1 px-2 py-1 ${activeStockTab==="drinks"?"bg-black text-white":"bg-gray-200"}`}
                >
                  Drinks
                </button>
              </div>
              <form onSubmit={async e => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const data = Object.fromEntries(new FormData(form).entries());
                data.type = activeStockTab==="rolls"?"Rolls":activeStockTab==="meat"?"Meat":"Drinks";
                try {
                  await axios.post("/api/expensesV2", data);
                  setShowStockModal(false);
                  fetchExpenses();
                } catch (error) {
                  console.error("Failed to save stock purchase:", error);
                }
              }} className="space-y-3">
                {activeStockTab==="rolls" && (
                  <>
                    <input 
                      type="number" 
                      name="qty" 
                      placeholder="Quantity" 
                      className="border p-2 w-full rounded" 
                      required
                    />
                    <select name="paid" className="border p-2 w-full rounded" required>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                    </select>
                    <input 
                      type="number" 
                      step="0.01" 
                      name="amount" 
                      placeholder="Amount (฿)" 
                      className="border p-2 w-full rounded" 
                      required
                    />
                    <select name="supplier" className="border p-2 w-full rounded" required>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </>
                )}
                {activeStockTab==="meat" && (
                  <>
                    <select name="meatType" className="border p-2 w-full rounded" required>
                      <option value="Topside">Topside</option>
                      <option value="Chuck">Chuck</option>
                      <option value="Brisket">Brisket</option>
                      <option value="Other">Other</option>
                    </select>
                    <input 
                      type="number" 
                      name="weightKg" 
                      placeholder="Weight (kg)" 
                      className="border p-2 w-full rounded" 
                    />
                    <input 
                      type="number" 
                      name="weightG" 
                      placeholder="Weight (g)" 
                      className="border p-2 w-full rounded" 
                    />
                    <input 
                      type="number" 
                      step="0.01" 
                      name="amount" 
                      placeholder="Amount (฿)" 
                      className="border p-2 w-full rounded" 
                      required
                    />
                    <select name="supplier" className="border p-2 w-full rounded" required>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </>
                )}
                {activeStockTab==="drinks" && (
                  <>
                    <select name="drinkType" className="border p-2 w-full rounded" required>
                      <option value="Coke">Coke</option>
                      <option value="Sprite">Sprite</option>
                      <option value="Water">Water</option>
                      <option value="Juice">Juice</option>
                      <option value="Other">Other</option>
                    </select>
                    <input 
                      type="number" 
                      name="qty" 
                      placeholder="Quantity" 
                      className="border p-2 w-full rounded" 
                      required
                    />
                    <input 
                      type="number" 
                      step="0.01" 
                      name="amount" 
                      placeholder="Amount (฿)" 
                      className="border p-2 w-full rounded" 
                      required
                    />
                    <select name="supplier" className="border p-2 w-full rounded" required>
                      {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </>
                )}
                <div className="flex gap-2 mt-4">
                  <button 
                    type="button"
                    onClick={() => setShowStockModal(false)}
                    className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
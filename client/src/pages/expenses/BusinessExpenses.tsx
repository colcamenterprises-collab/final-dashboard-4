import React, { useState, useEffect } from "react";
import axios from "axios";

export function BusinessExpenses() {
  const [activeTab, setActiveTab] = useState<"stock" | "general">("stock");
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    const { data } = await axios.get("/api/expensesV2");
    setExpenses(data.expenses);
    setTotal(data.total);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    await axios.post("/api/expensesV2", Object.fromEntries(formData.entries()));
    form.reset();
    fetchExpenses();
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const { data } = await axios.post("/api/expensesV2/upload", formData);
    console.log("Parsed PDF:", data);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Business Expenses</h1>

      {/* Tabs */}
      <div className="flex mb-4">
        <button
          className={`px-4 py-2 rounded-l ${activeTab === "stock" ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={() => setActiveTab("stock")}
        >
          Stock Purchases
        </button>
        <button
          className={`px-4 py-2 rounded-r ${activeTab === "general" ? "bg-black text-white" : "bg-gray-200"}`}
          onClick={() => setActiveTab("general")}
        >
          Business Expenses
        </button>
      </div>

      {/* Forms */}
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <input type="date" name="date" className="border p-2 w-full" required />
        {activeTab === "stock" ? (
          <>
            <select name="type" className="border p-2 w-full" required>
              <option value="">Select Item</option>
              <option value="Rolls">Rolls</option>
              <option value="Meat">Meat</option>
              <option value="Drinks">Drinks</option>
            </select>
            <input type="number" step="0.01" name="amount" placeholder="Amount (THB)" className="border p-2 w-full" required />
          </>
        ) : (
          <>
            <input type="text" name="supplier" placeholder="Supplier" className="border p-2 w-full" required />
            <input type="text" name="description" placeholder="Description" className="border p-2 w-full" />
            <input type="number" step="0.01" name="amount" placeholder="Amount (THB)" className="border p-2 w-full" required />
            <select name="category" className="border p-2 w-full" required>
              <option value="">Select Category</option>
              <option value="Rent">Rent</option>
              <option value="Marketing">Marketing</option>
              <option value="Utilities">Utilities</option>
              <option value="Travel">Travel</option>
              <option value="Other">Other</option>
            </select>
          </>
        )}
        <button type="submit" className="bg-black text-white px-4 py-2 rounded">
          Save Expense
        </button>
      </form>

      {/* PDF Upload */}
      <form onSubmit={handleUpload} className="mb-6">
        <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
        <button type="submit" className="ml-2 bg-blue-600 text-white px-4 py-2 rounded">
          Upload PDF
        </button>
      </form>

      {/* Expenses List */}
      <h2 className="text-lg font-semibold mb-2">Expenses This Month (Total: ฿{(total/100).toFixed(2)})</h2>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">Date</th>
            <th className="p-2 border">Type</th>
            <th className="p-2 border">Supplier</th>
            <th className="p-2 border">Description</th>
            <th className="p-2 border">Amount</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((exp: any) => (
            <tr key={exp.id}>
              <td className="p-2 border">{new Date(exp.date).toLocaleDateString()}</td>
              <td className="p-2 border">{exp.typeOfExpense}</td>
              <td className="p-2 border">{exp.supplier || "-"}</td>
              <td className="p-2 border">{exp.description || "-"}</td>
              <td className="p-2 border">฿{(exp.amountMinor/100).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
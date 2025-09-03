import React, { useState, useEffect } from "react";
import axios from "axios";

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [parsed, setParsed] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"rolls"|"meat"|"drinks">("rolls");

  useEffect(() => { fetchExpenses(); }, []);

  async function fetchExpenses() {
    try {
      const now = new Date();
      const { data } = await axios.get("/api/expensesV2?source=DIRECT");
      setExpenses(data || []);
    } catch (error) {
      console.error("Failed to fetch expenses:", error);
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return alert("Select a file first");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post("/api/expensesV2/upload", formData, { headers: { "Content-Type": "multipart/form-data" }});
      setParsed(data.parsed || []);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check console for details.");
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

  // Filter helpers
  const rolls = expenses.filter(e => e.description?.includes("Rolls"));
  const meat = expenses.filter(e => e.notes?.includes("Meat"));
  const drinks = expenses.filter(e => e.notes?.includes("Drinks"));

  return (
    <div className="space-y-6 font-['Poppins'] text-gray-800">
      <h1 className="text-xl font-bold mb-4">Expenses</h1>

      {/* Buttons */}
      <div className="flex space-x-4 mb-4">
        <button onClick={() => setShowGeneralModal(true)} className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800">Lodge Business Expense</button>
        <button onClick={() => setShowStockModal(true)} className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800">Lodge Stock Purchase</button>
      </div>

      {/* Upload */}
      <form onSubmit={handleUpload} className="mb-6">
        <div className="flex gap-3">
          <input type="file" accept=".pdf,.csv,.png,.jpg" onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1" />
          <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700" disabled={!file}>Upload</button>
        </div>
      </form>

      {/* Review Parsed */}
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
                  <th className="p-1 border text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((line,i)=>(
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-1">
                      <input defaultValue={line.date} className="border p-1 text-sm w-full" onChange={e => line.date = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.supplier} className="border p-1 text-sm w-full" onChange={e => line.supplier = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.category} className="border p-1 text-sm w-full" onChange={e => line.category = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.description} className="border p-1 text-sm w-full" onChange={e => line.description = e.target.value} />
                    </td>
                    <td className="border p-1">
                      <input defaultValue={line.amount} className="border p-1 text-sm w-full text-right" type="number" step="0.01" onChange={e => line.amount = e.target.value} />
                    </td>
                    <td className="border p-1 text-center">
                      <button onClick={()=>approveLine(line)} className="bg-green-600 text-white px-2 py-1 rounded text-xs hover:bg-green-700 mr-1">Approve</button>
                      <button onClick={()=>deleteLine(line.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Expense Table */}
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
              {expenses.map((exp,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="border p-1">{exp.supplier}</td>
                  <td className="border p-1">{exp.category}</td>
                  <td className="border p-1">{exp.description}</td>
                  <td className="border p-1 text-right">฿{((exp.amount || 0)/100).toFixed(2)}</td>
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

      {/* Rolls Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Rolls Purchases</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">Date</th>
              <th className="p-1 border text-left">Quantity</th>
              <th className="p-1 border text-left">Paid</th>
              <th className="p-1 border text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((r,i)=>(
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-1">{new Date(r.date).toLocaleDateString()}</td>
                <td className="border p-1">{r.notes}</td>
                <td className="border p-1">{r.notes}</td>
                <td className="border p-1 text-right">฿{((r.amount || 0)/100).toFixed(2)}</td>
              </tr>
            ))}
            {rolls.length === 0 && (
              <tr>
                <td colSpan={4} className="border p-4 text-center text-gray-500">No rolls purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Meat Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Meat Purchases</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">Date</th>
              <th className="p-1 border text-left">Type</th>
              <th className="p-1 border text-left">Weight</th>
              <th className="p-1 border text-left">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {meat.map((m,i)=>(
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-1">{new Date(m.date).toLocaleDateString()}</td>
                <td className="border p-1">{m.notes}</td>
                <td className="border p-1">{m.notes}</td>
                <td className="border p-1">{m.supplier}</td>
              </tr>
            ))}
            {meat.length === 0 && (
              <tr>
                <td colSpan={4} className="border p-4 text-center text-gray-500">No meat purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drinks Table */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Drinks Purchases</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-1 border text-left">Date</th>
              <th className="p-1 border text-left">Type</th>
              <th className="p-1 border text-left">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {drinks.map((d,i)=>(
              <tr key={i} className="hover:bg-gray-50">
                <td className="border p-1">{new Date(d.date).toLocaleDateString()}</td>
                <td className="border p-1">{d.notes}</td>
                <td className="border p-1">{d.notes}</td>
              </tr>
            ))}
            {drinks.length === 0 && (
              <tr>
                <td colSpan={3} className="border p-4 text-center text-gray-500">No drinks purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Business Expense Modal */}
      {showGeneralModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Lodge Business Expense</h3>
            <form onSubmit={async e => {
              e.preventDefault();
              try {
                const formData = new FormData(e.target as HTMLFormElement);
                const data = Object.fromEntries(formData.entries());
                await axios.post("/api/expensesV2", data);
                setShowGeneralModal(false); 
                fetchExpenses();
              } catch (error) {
                console.error("Failed to create expense:", error);
                alert("Failed to create expense");
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" name="date" className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <select name="supplier" className="border p-2 w-full rounded" required>
                  {[
                    "Other","Mr DIY","Bakery","Makro","Supercheap","Lazada","Lotus","Big C","Landlord - Rent",
                    "Printing Shop","Company Expenses","Wages","Wages - Bonus","GO Wholesale",
                    "Director - Personal","Utilities - GAS/Electric/Phone"
                  ].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (THB)</label>
                <input type="number" name="amount" placeholder="0.00" step="0.01" className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select name="category" className="border p-2 w-full rounded" required>
                  {[
                    "Food","Beverage","Wages","Rent","Utilities","Kitchen Supplies & Packaging",
                    "Administration","Marketing","Printing","Staff Expenses (from account)",
                    "Travel","Personal (director)","Maintenance","Company Expense"
                  ].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" name="description" placeholder="Description" className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea name="notes" placeholder="Additional notes..." className="border p-2 w-full rounded h-20"></textarea>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowGeneralModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Purchase Modal */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-full mx-4">
            <h3 className="font-bold text-lg mb-4">Lodge Stock Purchase</h3>
            
            {/* Tab Navigation */}
            <div className="flex border-b mb-4">
              <button 
                onClick={() => setActiveTab("rolls")} 
                className={`px-4 py-2 ${activeTab === "rolls" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600"}`}
              >
                Rolls
              </button>
              <button 
                onClick={() => setActiveTab("meat")} 
                className={`px-4 py-2 ${activeTab === "meat" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600"}`}
              >
                Meat
              </button>
              <button 
                onClick={() => setActiveTab("drinks")} 
                className={`px-4 py-2 ${activeTab === "drinks" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-600"}`}
              >
                Drinks
              </button>
            </div>

            <form onSubmit={async e => {
              e.preventDefault();
              try {
                const formData = new FormData(e.target as HTMLFormElement);
                const data = Object.fromEntries(formData.entries());
                data.notes = `${activeTab}: ${data.notes}`;
                await axios.post("/api/expensesV2", data);
                setShowStockModal(false); 
                fetchExpenses();
              } catch (error) {
                console.error("Failed to create stock purchase:", error);
                alert("Failed to create stock purchase");
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Date</label>
                <input type="date" name="date" className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Supplier</label>
                <input type="text" name="supplier" placeholder="Supplier" className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (THB)</label>
                <input type="number" name="amount" placeholder="0.00" step="0.01" className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <input type="text" name="category" value="Stock Purchase" className="border p-2 w-full rounded bg-gray-100" readOnly />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input type="text" name="description" placeholder={`${activeTab} purchase details`} className="border p-2 w-full rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea name="notes" placeholder={`${activeTab} specific details (quantity, weight, etc.)`} className="border p-2 w-full rounded h-20"></textarea>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowStockModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Save Purchase</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [parsed, setParsed] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"rolls"|"meat"|"drinks">("rolls");
  const [editingExpense, setEditingExpense] = useState<any | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch expense totals for top displays
  const { data: totals } = useQuery({
    queryKey: ['expenseTotals'],
    queryFn: () => axios.get('/api/expensesV2/totals').then(res => res.data),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Delete expense mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/expensesV2/${id}`),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
      fetchExpenses();
      queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete expense",
        variant: "destructive",
      });
    },
  });

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
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await axios.post("/api/expensesV2/upload", formData, { headers: { "Content-Type": "multipart/form-data" }});
      setParsed(data.parsed || []);
      setFile(null); // Clear file selection after successful upload
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Check console for details.");
    } finally {
      setUploading(false);
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

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Get trend icon based on MoM percentage
  const getTrendIcon = (mom: number) => {
    if (mom > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (mom < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6 font-['Poppins'] text-gray-800">
      <h1 className="text-xl font-bold mb-4">Expenses</h1>

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Month to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals?.mtd ? formatCurrency(totals.mtd) : '฿0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Year to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totals?.ytd ? formatCurrency(totals.ytd) : '฿0'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              MoM Trend
              {totals?.mom && getTrendIcon(totals.mom)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              totals?.mom > 0 ? 'text-red-600' : 
              totals?.mom < 0 ? 'text-green-600' : 
              'text-gray-600'
            }`}>
              {totals?.mom ? `${totals.mom > 0 ? '+' : ''}${totals.mom}%` : '0%'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Top Expense Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {totals?.top5?.slice(0, 3).map((item: any, idx: number) => (
                <div key={idx} className="text-xs flex justify-between">
                  <span className="truncate">{item.type}</span>
                  <span className="font-medium">{formatCurrency(item.total)}</span>
                </div>
              )) || <div className="text-xs text-gray-500">No data</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buttons */}
      <div className="flex space-x-4 mb-4">
        <ExpenseLodgmentModal 
          onSuccess={() => {
            fetchExpenses();
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
          }} 
          triggerClassName="px-4 py-2 rounded text-sm" 
        />
        <button onClick={() => setShowStockModal(true)} className="bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800">Lodge Stock Purchase</button>
      </div>

      {/* Edit Modal */}
      {editingExpense && (
        <ExpenseLodgmentModal 
          isOpen={true}
          onOpenChange={(open) => !open && setEditingExpense(null)}
          initialData={{
            date: editingExpense.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            category: editingExpense.category || '',
            supplier: editingExpense.supplier || '',
            description: editingExpense.description || '',
            amount: (editingExpense.amount || 0).toString() // Already in THB from backend
          }}
          expenseId={editingExpense.id}
          onSuccess={() => {
            fetchExpenses();
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
            setEditingExpense(null);
          }}
        />
      )}

      {/* Upload */}
      <form onSubmit={handleUpload} className="mb-6">
        <div className="flex gap-3">
          <input type="file" accept=".pdf,.csv,.png,.jpg" onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1" />
          <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50" disabled={!file || uploading}>
            {uploading ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : 'Upload'}
          </button>
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
                <th className="p-1 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="border p-1">{exp.supplier}</td>
                  <td className="border p-1">{exp.category}</td>
                  <td className="border p-1">{exp.description}</td>
                  <td className="border p-1 text-right">฿{(exp.amount || 0).toLocaleString()}</td>
                  <td className="border p-1 text-center">
                    <div className="flex justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingExpense(exp)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this expense?')) {
                            deleteMutation.mutate(exp.id);
                          }
                        }}
                        className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="border p-4 text-center text-gray-500">
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
                <td className="border p-1 text-right">฿{(r.amount || 0).toLocaleString()}</td>
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

            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const data = Object.fromEntries(new FormData(form).entries());

              let payload: any = { type: activeTab };

              if (activeTab === "rolls") {
                payload.qty = data.qty;
                payload.amount = data.amount;
              }

              if (activeTab === "meat") {
                payload.meatType = data.meatType;
                payload.weightKg = data.weightKg;
              }

              if (activeTab === "drinks") {
                payload.drinkType = data.drinkType;
                payload.qty = data.qty;
              }

              try {
                await axios.post("/api/expensesV2/stock", payload);
                setShowStockModal(false);
                fetchExpenses();
              } catch (error) {
                console.error("Failed to create stock purchase:", error);
                alert("Failed to create stock purchase");
              }
            }} className="space-y-4">
              {/* Tab-specific fields only */}
              {activeTab === "rolls" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity (Rolls)</label>
                    <input type="number" name="qty" placeholder="Quantity (Rolls)" className="border p-2 w-full rounded" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount (THB)</label>
                    <input type="number" step="0.01" name="amount" placeholder="Amount (THB)" className="border p-2 w-full rounded" required />
                  </div>
                </>
              )}
              
              {activeTab === "meat" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Meat Type</label>
                    <select name="meatType" className="border p-2 w-full rounded" required>
                      <option value="Topside">Topside</option>
                      <option value="Chuck">Chuck</option>
                      <option value="Brisket">Brisket</option>
                      <option value="Rump">Rump</option>
                      <option value="Outside">Outside</option>
                      <option value="Mixed">Mixed</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                    <input type="number" step="0.01" name="weightKg" placeholder="Weight (kg)" className="border p-2 w-full rounded" required />
                  </div>
                </>
              )}
              
              {activeTab === "drinks" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Drink Type</label>
                    <select name="drinkType" className="border p-2 w-full rounded" required>
                      <option value="Coke">Coke</option>
                      <option value="Coke Zero">Coke Zero</option>
                      <option value="Sprite">Sprite</option>
                      <option value="Schweppes Manow">Schweppes Manow</option>
                      <option value="Red Fanta">Red Fanta</option>
                      <option value="Orange Fanta">Orange Fanta</option>
                      <option value="Red Singha">Red Singha</option>
                      <option value="Yellow Singha">Yellow Singha</option>
                      <option value="Pink Singha">Pink Singha</option>
                      <option value="Soda Water">Soda Water</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input type="number" name="qty" placeholder="Quantity" className="border p-2 w-full rounded" required />
                  </div>
                </>
              )}
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
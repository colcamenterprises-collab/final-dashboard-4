import React, { useState, useEffect } from "react";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ExpenseLodgmentModal } from "@/components/operations/ExpenseLodgmentModal";
import { StockLodgmentModal } from "@/components/operations/StockLodgmentModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function Expenses() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [parsed, setParsed] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

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
    mutationFn: (id: string) => {
      console.log("Deleting expense with ID:", id);
      return axios.delete(`/api/expensesV2/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Expense deleted successfully",
      });
      fetchExpenses();
      queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
    },
    onError: (error: any) => {
      console.error("Delete mutation error:", error);
      toast({
        title: "Error",
        description: error?.response?.data?.error || "Failed to delete expense",
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

  // Get purchase tally entries directly
  const { data: purchaseTallyData } = useQuery({
    queryKey: ["/api/purchase-tally"],
    queryFn: () => axios.get("/api/purchase-tally").then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });

  // Filter helpers - ensure arrays are always defined
  const rolls = expenses ? expenses.filter(e => e.description?.includes("Rolls") || (e.source === 'STOCK_LODGMENT' && e.item?.includes("Rolls"))) : [];
  const meat = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries)) 
    ? purchaseTallyData.entries.filter((item: any) => item.meatGrams != null && item.meatGrams > 0) : [];
  const drinks = (purchaseTallyData?.entries && Array.isArray(purchaseTallyData.entries)) 
    ? purchaseTallyData.entries.filter((item: any) => {
        try {
          const notes = typeof item.notes === 'string' ? JSON.parse(item.notes) : item.notes;
          return notes?.type === 'drinks';
        } catch (e) {
          return false;
        }
      }) : [];

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
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

      {/* Buttons - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <ExpenseLodgmentModal 
          onSuccess={() => {
            fetchExpenses();
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
          }} 
          triggerClassName="px-6 py-3 rounded-lg text-sm font-medium min-h-[44px] flex items-center justify-center w-full sm:w-auto" 
        />
        <StockLodgmentModal 
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/expensesV2"] });
            queryClient.invalidateQueries({ queryKey: ['expenseTotals'] });
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-tally"] });
            fetchExpenses();
          }} 
          triggerClassName="bg-black text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-gray-800 min-h-[44px] flex items-center justify-center w-full sm:w-auto" 
        />
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

      {/* Statistics Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
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

      {/* Upload - Mobile Optimized */}
      <form onSubmit={handleUpload} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="file" 
            accept=".pdf,.csv,.png,.jpg" 
            onChange={e => setFile(e.target.files?.[0] || null)} 
            className="flex-1 p-3 border border-gray-300 rounded-lg text-sm" 
          />
          <button 
            type="submit" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px] flex items-center justify-center whitespace-nowrap" 
            disabled={!file || uploading}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Processing...
              </span>
            ) : 'Upload Document'}
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

      {/* Main Expense Table/Cards - Mobile Responsive */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">This Month's Expenses</h2>
        
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-3 border text-left">Date</th>
                <th className="p-3 border text-left">Supplier</th>
                <th className="p-3 border text-left">Category</th>
                <th className="p-3 border text-left">Description</th>
                <th className="p-3 border text-right">Amount</th>
                <th className="p-3 border text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp,i)=>(
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-3">{new Date(exp.date).toLocaleDateString()}</td>
                  <td className="border p-3">{exp.supplier}</td>
                  <td className="border p-3">{exp.category}</td>
                  <td className="border p-3">{exp.description}</td>
                  <td className="border p-3 text-right">{formatCurrency(exp.amount || 0)}</td>
                  <td className="border p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingExpense(exp)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{exp.description}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(exp.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {expenses.map((exp,i)=>(
            <div key={i} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-base text-gray-900">{exp.description}</h3>
                  <p className="text-sm text-gray-600">{exp.supplier} • {exp.category}</p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">{formatCurrency(exp.amount || 0)}</div>
                  <div className="text-sm text-gray-500">{new Date(exp.date).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  onClick={() => setEditingExpense(exp)}
                  className="min-h-[44px] px-4 flex items-center gap-2 text-sm"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="min-h-[44px] px-4 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 flex items-center gap-2 text-sm"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="mx-4">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{exp.description}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                      <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(exp.id)}
                        className="bg-red-600 hover:bg-red-700 w-full sm:w-auto"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
          {expenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No expenses recorded this month
            </div>
          )}
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
            {rolls.map((r,i)=>{
              // Parse the meta JSON to get quantity and paid status
              let quantity = "N/A";
              let paid = "N/A";
              try {
                const meta = typeof r.notes === 'string' ? JSON.parse(r.notes) : r.notes;
                quantity = meta.quantity || meta.qty || "N/A";
                paid = meta.paid ? "Yes" : "No";
              } catch (e) {
                // If parsing fails, try to extract from the raw string
                if (typeof r.notes === 'string' && r.notes.includes('qty')) {
                  const qtyMatch = r.notes.match(/"qty":\s*(\d+)/);
                  if (qtyMatch) quantity = qtyMatch[1];
                }
              }
              
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="border p-1">{quantity}</td>
                  <td className="border p-1">{paid}</td>
                  <td className="border p-1 text-right">฿{(r.amount || 0).toLocaleString()}</td>
                </tr>
              );
            })}
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
                <td className="border p-1">{m.notes || m.meatType}</td>
                <td className="border p-1">{m.meatGrams ? (m.meatGrams / 1000).toFixed(2) + ' kg' : 'N/A'}</td>
                <td className="border p-1">{m.supplier || 'Meat Supplier'}</td>
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
            {drinks.map((d,i)=>{
              // Parse the meta JSON to get drink type and quantity
              let drinkType = "N/A";
              let quantity = "N/A";
              try {
                const meta = typeof d.notes === 'string' ? JSON.parse(d.notes) : d.notes;
                drinkType = meta.drinkType || "N/A";
                quantity = meta.qty || meta.quantity || "N/A";
              } catch (e) {
                // If parsing fails, use raw notes as fallback
                drinkType = d.notes || "N/A";
              }
              
              return (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="border p-1">{new Date(d.date || d.created_at).toLocaleDateString()}</td>
                  <td className="border p-1">{drinkType}</td>
                  <td className="border p-1">{quantity}</td>
                </tr>
              );
            })}
            {drinks.length === 0 && (
              <tr>
                <td colSpan={3} className="border p-4 text-center text-gray-500">No drinks purchases this month</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


    </div>
  );
}
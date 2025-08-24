import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageShell from "@/layouts/PageShell";

export default function Expenses() {
  const [showRollsModal, setShowRollsModal] = useState(false);
  const [showMeatModal, setShowMeatModal] = useState(false);
  const [showDrinksModal, setShowDrinksModal] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Data fetching queries
  const rollsQuery = useQuery({
    queryKey: ['/api/expenses/rolls'],
    queryFn: () => apiRequest('/api/expenses/rolls', 'GET')
  });

  const meatQuery = useQuery({
    queryKey: ['/api/expenses/meat'],
    queryFn: () => apiRequest('/api/expenses/meat', 'GET')
  });

  const drinksQuery = useQuery({
    queryKey: ['/api/expenses/drinks'],
    queryFn: () => apiRequest('/api/expenses/drinks', 'GET')
  });

  const rollsMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/expenses/rolls", "POST", data),
    onSuccess: () => {
      toast({ title: "Success", description: "Rolls expense recorded" });
      setShowRollsModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/rolls'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const meatMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/expenses/meat", "POST", data),
    onSuccess: () => {
      toast({ title: "Success", description: "Meat expense recorded" });
      setShowMeatModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/meat'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const drinksMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/expenses/drinks", "POST", data),
    onSuccess: () => {
      toast({ title: "Success", description: "Drinks expense recorded" });
      setShowDrinksModal(false);
      queryClient.invalidateQueries({ queryKey: ['/api/expenses/drinks'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `฿${amount.toFixed(2)}`;
  };

  return (
    <PageShell>
      <div className="space-y-6">
        <h1 className="h1">Expenses</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Rolls */}
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="h2 mb-4">Rolls</h2>
            <p className="text-sm text-gray-600 mb-4">Record roll purchases and status</p>
            <button
              onClick={() => setShowRollsModal(true)}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 mb-4"
            >
              Add Roll Purchase
            </button>

            {/* Rolls Data Display */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Recent Entries</h3>
              {rollsQuery.isLoading && <p className="text-sm text-gray-500">Loading...</p>}
              {rollsQuery.error && <p className="text-sm text-red-600">Error loading data</p>}
              {rollsQuery.data && Array.isArray(rollsQuery.data) && rollsQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {rollsQuery.data.slice(0, 5).map((entry: any, index: number) => (
                    <div key={index} className="text-sm border rounded p-2">
                      <div className="flex justify-between">
                        <span>{entry.amount || 'N/A'} rolls</span>
                        <span className="text-gray-600">{entry.cost ? formatCurrency(Number(entry.cost)) : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{entry.status || 'N/A'}</span>
                        <span>{entry.timestamp ? formatDate(entry.timestamp) : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : rollsQuery.data && !rollsQuery.isLoading ? (
                <p className="text-sm text-gray-500">No entries yet</p>
              ) : null}
            </div>
          </div>

          {/* Meat */}
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="h2 mb-4">Meat</h2>
            <p className="text-sm text-gray-600 mb-4">Track meat weight and type</p>
            <button
              onClick={() => setShowMeatModal(true)}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 mb-4"
            >
              Add Meat Entry
            </button>

            {/* Meat Data Display */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Recent Entries</h3>
              {meatQuery.isLoading && <p className="text-sm text-gray-500">Loading...</p>}
              {meatQuery.error && <p className="text-sm text-red-600">Error loading data</p>}
              {meatQuery.data && Array.isArray(meatQuery.data) && meatQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {meatQuery.data.slice(0, 5).map((entry: any, index: number) => (
                    <div key={index} className="text-sm border rounded p-2">
                      <div className="flex justify-between">
                        <span>{entry.weightG || 'N/A'}g</span>
                        <span className="text-gray-600 capitalize">{entry.meatType || 'N/A'}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span>{entry.timestamp ? formatDate(entry.timestamp) : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : meatQuery.data && !meatQuery.isLoading ? (
                <p className="text-sm text-gray-500">No entries yet</p>
              ) : null}
            </div>
          </div>

          {/* Drinks */}
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="h2 mb-4">Drinks</h2>
            <p className="text-sm text-gray-600 mb-4">Log drink quantities</p>
            <button
              onClick={() => setShowDrinksModal(true)}
              className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 mb-4"
            >
              Add Drinks Entry
            </button>

            {/* Drinks Data Display */}
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">Recent Entries</h3>
              {drinksQuery.isLoading && <p className="text-sm text-gray-500">Loading...</p>}
              {drinksQuery.error && <p className="text-sm text-red-600">Error loading data</p>}
              {drinksQuery.data && Array.isArray(drinksQuery.data) && drinksQuery.data.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {drinksQuery.data.slice(0, 5).map((entry: any, index: number) => (
                    <div key={index} className="text-sm border rounded p-2">
                      <div className="flex justify-between">
                        <span className="capitalize">{entry.drink || 'N/A'}</span>
                        <span className="text-gray-600">{entry.qty || 'N/A'} qty</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span>{entry.timestamp ? formatDate(entry.timestamp) : 'N/A'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : drinksQuery.data && !drinksQuery.isLoading ? (
                <p className="text-sm text-gray-500">No entries yet</p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Rolls Modal */}
        {showRollsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h3 className="h3 mb-4">Add Roll Purchase</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                rollsMutation.mutate({
                  amount: formData.get('amount'),
                  timestamp: new Date().toISOString(),
                  cost: formData.get('cost'),
                  status: formData.get('status')
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount</label>
                    <input name="amount" type="number" min="1" required className="w-full p-3 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cost (฿)</label>
                    <input name="cost" type="number" min="0" step="0.01" required className="w-full p-3 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Status</label>
                    <select name="status" className="w-full p-3 border rounded-xl">
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowRollsModal(false)}
                    className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={rollsMutation.isPending}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {rollsMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Meat Modal */}
        {showMeatModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h3 className="h3 mb-4">Add Meat Entry</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                meatMutation.mutate({
                  weightG: formData.get('weightG'),
                  meatType: formData.get('meatType'),
                  timestamp: new Date().toISOString()
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Weight (grams)</label>
                    <input name="weightG" type="number" min="1" required className="w-full p-3 border rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Meat Type</label>
                    <select name="meatType" className="w-full p-3 border rounded-xl">
                      <option value="beef">Beef</option>
                      <option value="chicken">Chicken</option>
                      <option value="pork">Pork</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowMeatModal(false)}
                    className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={meatMutation.isPending}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {meatMutation.isPending ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Drinks Modal */}
        {showDrinksModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md">
              <h3 className="h3 mb-4">Add Drinks Entry</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                drinksMutation.mutate({
                  drink: formData.get('drink'),
                  qty: formData.get('qty'),
                  timestamp: new Date().toISOString()
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Drink</label>
                    <select name="drink" className="w-full p-3 border rounded-xl">
                      <option value="coke">Coke</option>
                      <option value="sprite">Sprite</option>
                      <option value="water">Water</option>
                      <option value="juice">Juice</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Quantity</label>
                    <input name="qty" type="number" min="1" required className="w-full p-3 border rounded-xl" />
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowDrinksModal(false)}
                    className="flex-1 px-4 py-2 border rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={drinksMutation.isPending}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {drinksMutation.isPending ? "Saving..." : "Save"}
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
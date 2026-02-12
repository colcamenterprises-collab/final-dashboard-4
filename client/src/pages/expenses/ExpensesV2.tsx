// PATCH — EXPENSES V2 FRONTEND
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt } from "lucide-react";

interface ExpenseV2 {
  id: string;
  date: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  amount: number;
  paymentType: string | null;
  vendor: string | null;
  createdAt: string;
}

export default function ExpensesV2Page() {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("Cash");
  const [vendor, setVendor] = useState("");

  const { data: list = [], isLoading } = useQuery<ExpenseV2[]>({
    queryKey: ["/api/expenses-v2/all"],
    queryFn: async () => {
      const res = await axios.get("/api/expenses-v2/all");
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { description: string; amount: number; paymentType: string; vendor: string }) => {
      const res = await axios.post("/api/expenses-v2/create", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses-v2/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses-v2/summary"] });
      setDescription("");
      setAmount("");
      setVendor("");
    }
  });

  const submitExpense = () => {
    if (!description || !amount) return;
    createMutation.mutate({
      description,
      amount: Number(amount),
      paymentType,
      vendor
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-emerald-600" />
        <h1 className="text-2xl font-bold text-slate-800">Expenses V2</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Expense</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Description (e.g. Burger Buns, Meat, Gas)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-expense-description"
          />

          <Input
            placeholder="Amount (THB)"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            data-testid="input-expense-amount"
          />

          <Input
            placeholder="Vendor"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            data-testid="input-expense-vendor"
          />

          <Select value={paymentType} onValueChange={setPaymentType}>
            <SelectTrigger data-testid="select-payment-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="QR">QR</SelectItem>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={submitExpense}
            disabled={createMutation.isPending || !description || !amount}
            className="w-full bg-slate-800 hover:bg-slate-700"
            data-testid="button-add-expense"
          >
            <Plus className="h-4 w-4 mr-2" />
            {createMutation.isPending ? "Adding..." : "Add Expense"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-slate-400 text-xs">Loading...</div>
          ) : list.length === 0 ? (
            <div className="text-slate-400 text-xs">No expenses recorded yet.</div>
          ) : (
            <div className="space-y-3">
              {list.map((e) => (
                <div
                  className="border border-slate-200 p-3 rounded bg-white"
                  key={e.id}
                  data-testid={`expense-item-${e.id}`}
                >
                  <div className="font-semibold text-slate-800 text-sm">{e.description || "No description"}</div>
                  <div className="text-xs text-slate-500">{e.vendor || "No vendor"}</div>
                  <div className="text-xs text-emerald-600 font-medium">
                    {e.category} → {e.subcategory || "General"}
                  </div>
                  <div className="text-sm font-bold text-slate-700 mt-1">{e.amount.toLocaleString()} THB</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {new Date(e.date).toLocaleString("en-TH", {
                      timeZone: "Asia/Bangkok",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

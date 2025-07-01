import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Zap, Users, Receipt, Plus, Filter } from "lucide-react";
import { api, mutations } from "@/lib/api";
import KPICard from "@/components/KPICard";

export default function Expenses() {
  const [newExpense, setNewExpense] = useState({
    description: "",
    amount: "",
    category: "Food & Supplies",
    date: new Date().toISOString().split('T')[0],
    paymentMethod: "Credit Card"
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["/api/expenses"],
    queryFn: api.getExpenses
  });

  const { data: expensesByCategory } = useQuery({
    queryKey: ["/api/expenses/by-category"],
    queryFn: api.getExpensesByCategory
  });

  const createExpenseMutation = useMutation({
    mutationFn: mutations.createExpense
  });

  const handleInputChange = (field: string, value: string) => {
    setNewExpense(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    createExpenseMutation.mutate({
      ...newExpense,
      date: new Date(newExpense.date).toISOString()
    });
    setNewExpense({
      description: "",
      amount: "",
      category: "Food & Supplies",
      date: new Date().toISOString().split('T')[0],
      paymentMethod: "Credit Card"
    });
  };

  const getExpenseIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & supplies':
        return <ShoppingCart className="text-green-600 text-xl" />;
      case 'utilities':
        return <Zap className="text-blue-600 text-xl" />;
      case 'labor':
        return <Users className="text-purple-600 text-xl" />;
      default:
        return <Receipt className="text-gray-600 text-xl" />;
    }
  };

  const getExpenseIconBg = (category: string) => {
    switch (category.toLowerCase()) {
      case 'food & supplies':
        return 'bg-green-100';
      case 'utilities':
        return 'bg-blue-100';
      case 'labor':
        return 'bg-purple-100';
      default:
        return 'bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Expenses</h1>
        <div className="flex flex-col xs:flex-row items-start xs:items-center space-y-2 xs:space-y-0 xs:space-x-4">
          <Button className="restaurant-primary w-full xs:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Expense
          </Button>
          <Button variant="outline" className="bg-gray-600 text-white hover:bg-gray-700 w-full xs:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Expense Categories Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <KPICard
          title="Food & Supplies"
          value={`$${(expensesByCategory?.['Food & Supplies'] || 1245.80).toLocaleString()}`}
          icon={ShoppingCart}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <KPICard
          title="Utilities"
          value={`$${(expensesByCategory?.['Utilities'] || 456.25).toLocaleString()}`}
          icon={Zap}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <KPICard
          title="Labor"
          value={`$${(expensesByCategory?.['Labor'] || 2340.00).toLocaleString()}`}
          icon={Users}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
        <KPICard
          title="Other"
          value={`$${(expensesByCategory?.['Other'] || 189.45).toLocaleString()}`}
          icon={Receipt}
          iconColor="text-gray-600"
          iconBgColor="bg-gray-100"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Expenses */}
        <div className="lg:col-span-2">
          <Card className="restaurant-card">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold text-gray-900">Recent Expenses</CardTitle>
                <Button variant="ghost" className="text-primary hover:text-primary-dark text-sm font-medium">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {expenses?.slice(0, 10).map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between py-4 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getExpenseIconBg(expense.category)}`}>
                        {getExpenseIcon(expense.category)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{expense.description}</p>
                        <p className="text-xs text-gray-500">{formatDate(expense.date)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-600">-${parseFloat(expense.amount).toFixed(2)}</p>
                      <p className="text-xs text-gray-500">{expense.category}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Expense Form */}
        <Card className="restaurant-card">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">Quick Add Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Description</Label>
                <Input
                  value={newExpense.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter description"
                  required
                />
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Category</Label>
                <Select value={newExpense.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food & Supplies">Food & Supplies</SelectItem>
                    <SelectItem value="Utilities">Utilities</SelectItem>
                    <SelectItem value="Labor">Labor</SelectItem>
                    <SelectItem value="Rent">Rent</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</Label>
                <Select value={newExpense.paymentMethod} onValueChange={(value) => handleInputChange('paymentMethod', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                    <SelectItem value="Check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">Date</Label>
                <Input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full restaurant-primary"
                disabled={createExpenseMutation.isPending}
              >
                {createExpenseMutation.isPending ? "Adding..." : "Add Expense"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
